/**
 * adminService.js
 * -----------------------------------------------------------------------
 * Module 3: Administrative & Inventory Management (FR-12, FR-13).
 * Every write here is admin-gated (NFR-05) and logged (Module 4).
 * -----------------------------------------------------------------------
 */
(function () {
  class AdminService {
    constructor(productRepo, transactionRepo, auditRepo, authService, staffRepo) {
      this.productRepo = productRepo;
      this.transactionRepo = transactionRepo;
      this.auditRepo = auditRepo;
      this.auth = authService;
      this.staffRepo = staffRepo;
    }

    // ---- staff accounts (NFR-05 / NFR-06) ---------------------------------
    // Administrators share one login; each cashier gets their own account,
    // created here by an admin from Settings. Never call these without a
    // signed-in admin — requireAdmin() throws otherwise.
    async listStaff() {
      this.auth.requireAdmin();
      return this.staffRepo.list();
    }

    async addStaff(data) {
      this.auth.requireAdmin();
      this._validateStaff(data, true);
      const staff = await this.staffRepo.create(data);
      await this._log('staff', `${staff.name} added as ${staff.roleLabel}`, staff.id);
      return staff;
    }

    async editStaff(id, data) {
      this.auth.requireAdmin();
      this._validateStaff(data, false);
      const staff = await this.staffRepo.update(id, data);
      await this._log('staff', `${staff.name} account updated`, staff.id);
      return staff;
    }

    async removeStaff(id) {
      this.auth.requireAdmin();
      if (this.auth.user && this.auth.user.id === id) throw new Error("You can't remove the account you're signed in with.");
      const staff = await this.staffRepo.findById(id);
      await this.staffRepo.remove(id);
      if (staff) await this._log('staff', `${staff.name} account removed`, staff.id);
      return staff;
    }

    _validateStaff(data, isNew) {
      if (isNew && (!data.id || !data.id.trim())) throw new Error('Employee ID is required (e.g. EMP-1050).');
      if (!data.name || !data.name.trim()) throw new Error('Name is required.');
      if (isNew && (!data.password || String(data.password).trim().length < 4))
        throw new Error('Password must be at least 4 characters.');
      if (!isNew && data.password && String(data.password).trim().length < 4)
        throw new Error('Password must be at least 4 characters.');
    }

    // ---- catalog (FR-12) -------------------------------------------------
    async listProducts(query = '', category = 'All') {
      return this.productRepo.search(query, category);
    }

    async categories() {
      return this.productRepo.categories();
    }

    async addProduct(data) {
      this.auth.requireAdmin();
      await this._validate(data, null);
      const product = await this.productRepo.create(this._normalize(data));
      await this._log('product', `${product.name} added to the catalog`, `${product.id} · ${product.barcode}`);
      return product;
    }

    async editProduct(id, data) {
      this.auth.requireAdmin();
      await this._validate(data, id);
      const product = await this.productRepo.update(id, this._normalize(data));
      await this._log('product', `${product.name} updated`, `${product.id} · ₱${product.price.toFixed(2)}`);
      return product;
    }

    async deleteProduct(id) {
      this.auth.requireAdmin();
      const product = await this.productRepo.findById(id);
      await this.productRepo.remove(id);
      if (product) await this._log('product', `${product.name} removed from the catalog`, product.id);
      return product;
    }

    // ---- inventory --------------------------------------------------------
    async adjustStock(id, delta, reason) {
      this.auth.requireAdmin();
      const amount = parseInt(delta, 10);
      if (Number.isNaN(amount) || amount === 0) throw new Error('Enter a non-zero quantity change.');
      const before = await this.productRepo.findById(id);
      if (!before) throw new Error('Product not found.');
      const after = await this.productRepo.adjustStock(id, amount);
      await this._log(
        'stock',
        `${after.name} stock ${before.stock} → ${after.stock}`,
        reason || 'Manual adjustment'
      );
      return after;
    }

    async lowStock(threshold = 10) {
      const products = await this.productRepo.list();
      return products.filter((p) => p.stock < threshold).sort((a, b) => a.stock - b.stock);
    }

    // ---- audit ledger (FR-13) ---------------------------------------------
    async listTransactions(filter = {}) {
      return this.transactionRepo.list(filter);
    }

    async dashboardStats() {
      const [products, transactions] = await Promise.all([
        this.productRepo.list(),
        this.transactionRepo.list(),
      ]);
      const closed = transactions.filter((t) => t.status !== 'pending');
      const flagged = transactions.filter((t) => t.status === 'flagged');
      const pending = transactions.filter((t) => t.status === 'pending');
      const withDiscrepancy = transactions.filter((t) => t.hasDiscrepancy);
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);

      return {
        todayCount: transactions.filter((t) => new Date(t.createdAt) >= midnight).length,
        pendingCount: pending.length,
        flaggedCount: flagged.length,
        discrepancyCount: withDiscrepancy.length,
        discrepancyRate: closed.length ? Math.round((withDiscrepancy.length / closed.length) * 100) : 0,
        revenue: transactions
          .filter((t) => t.status === 'verified')
          .reduce((sum, t) => sum + (t.payment ? t.payment.amount : t.recalculatedTotal), 0),
        lowStock: products.filter((p) => p.stock < 10).sort((a, b) => a.stock - b.stock),
        recentTransactions: transactions.slice(0, 6),
      };
    }

    // ---- exports -----------------------------------------------------------
    exportTransactionsCSV(transactions) {
      const header = [
        'Transaction', 'Cart', 'Status', 'Items', 'Recorded', 'Verified',
        'Charged', 'Method', 'Cashier', 'Created', 'Closed', 'Discrepancies',
      ];
      const rows = transactions.map((t) => [
        t.id, t.cartId, t.status, t.itemCount,
        t.recordedTotal.toFixed(2), t.recalculatedTotal.toFixed(2),
        t.payment ? t.payment.amount.toFixed(2) : '',
        t.payment ? t.payment.method : '',
        t.cashier || '', t.createdAt, t.closedAt || '', t.discrepancies.length,
      ]);
      return this._csv([header, ...rows]);
    }

    async exportStockCSV() {
      const products = await this.productRepo.list();
      const header = ['ID', 'Barcode', 'Name', 'Category', 'Price', 'OnHand', 'Status'];
      const rows = products.map((p) => [
        p.id, p.barcode, p.name, p.category, p.price.toFixed(2), p.stock,
        p.stockLevel === 'out' ? 'Out of stock' : p.stockLevel === 'low' ? 'Low stock' : 'In stock',
      ]);
      return this._csv([header, ...rows]);
    }

    _csv(rows) {
      return rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    }

    // ---- validation --------------------------------------------------------
    async _validate(data, existingId) {
      if (!data.name || !data.name.trim()) throw new Error('Product name is required.');
      if (!/^\d{8,13}$/.test(String(data.barcode || '').trim()))
        throw new Error('Barcode must be 8–13 digits — this is what the scanner sends.');
      if (Number.isNaN(Number(data.price)) || Number(data.price) < 0)
        throw new Error('Enter a valid price.');
      if (Number.isNaN(Number(data.stock)) || Number(data.stock) < 0)
        throw new Error('Enter a valid stock quantity.');

      const clash = await this.productRepo.findByBarcode(String(data.barcode).trim());
      if (clash && clash.id !== existingId)
        throw new Error(`Barcode ${data.barcode} is already used by ${clash.name}.`);
    }

    _normalize(data) {
      return {
        name: data.name.trim(),
        barcode: String(data.barcode).trim(),
        category: (data.category || 'General').trim(),
        price: Number(data.price),
        stock: Number(data.stock),
        icon: (data.icon || '🛒').trim(),
        description: (data.description || '').trim(),
      };
    }

    _log(type, text, detail) {
      return this.auditRepo.add({
        type,
        text,
        detail,
        actor: this.auth.user ? this.auth.user.name : 'System',
      });
    }
  }

  window.SmartCart.AdminService = AdminService;
})();
