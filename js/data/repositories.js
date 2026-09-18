/**
 * repositories.js
 * -----------------------------------------------------------------------
 * Repositories are the ONLY code that talks to the Database directly, and
 * every method returns a Promise even though it resolves synchronously.
 * That is deliberate: js/data/apiRepositories.js implements exactly these
 * same method signatures over fetch() against the Node + SQLite server,
 * so switching backends never changes a Service or a View.
 *
 * If data is saved or loaded wrongly, the bug is in this file (local mode)
 * or apiRepositories.js (server mode) — nowhere else.
 * -----------------------------------------------------------------------
 */
(function () {
  const { Product, Cart, CartItem, Transaction, VerificationItem, Staff, AuditEntry } = window.SmartCart;

  class ProductRepository {
    constructor(db) {
      this.db = db;
    }

    async list() {
      return this.db.all('products').map((p) => new Product(p));
    }

    async findById(id) {
      const row = this.db.all('products').find((p) => p.id === id);
      return row ? new Product(row) : null;
    }

    /** FR-02: the lookup the scanner performs on every scan. */
    async findByBarcode(barcode) {
      const code = String(barcode).trim();
      const row = this.db.all('products').find((p) => p.barcode === code);
      return row ? new Product(row) : null;
    }

    async search(query, category) {
      const q = (query || '').trim().toLowerCase();
      return this.db
        .all('products')
        .filter((p) => {
          const matchesQuery =
            !q ||
            p.name.toLowerCase().includes(q) ||
            p.barcode.includes(q) ||
            p.id.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q);
          const matchesCategory = !category || category === 'All' || p.category === category;
          return matchesQuery && matchesCategory;
        })
        .map((p) => new Product(p));
    }

    async create(data) {
      const row = { id: this.db.nextProductId(), description: '', ...data };
      this.db.tables.products.push(row);
      this.db.save();
      return new Product(row);
    }

    async update(id, data) {
      const row = this.db.tables.products.find((p) => p.id === id);
      if (!row) throw new Error('Product not found');
      Object.assign(row, data);
      this.db.save();
      return new Product(row);
    }

    async remove(id) {
      this.db.tables.products = this.db.tables.products.filter((p) => p.id !== id);
      this.db.save();
    }

    /** Called when a sale is approved — stock never moves anywhere else. */
    async adjustStock(id, delta) {
      const row = this.db.tables.products.find((p) => p.id === id);
      if (!row) return null;
      row.stock = Math.max(0, Number(row.stock) + Number(delta));
      this.db.save();
      return new Product(row);
    }

    async categories() {
      return [...new Set(this.db.all('products').map((p) => p.category))].sort();
    }
  }

  class CartRepository {
    constructor(db) {
      this.db = db;
    }

    _hydrate(row) {
      const cart = new Cart(row.id);
      cart.status = row.status;
      cart.createdAt = row.createdAt;
      cart.finalizedAt = row.finalizedAt;
      cart.items = row.items.map((i) => new CartItem(new Product(i.product), i.quantity));
      return cart;
    }

    _serialize(cart) {
      return {
        id: cart.id,
        status: cart.status,
        createdAt: cart.createdAt,
        finalizedAt: cart.finalizedAt,
        items: cart.items.map((i) => ({ product: { ...i.product }, quantity: i.quantity })),
      };
    }

    async create() {
      const cart = new Cart(this.db.nextCartId());
      this.db.tables.carts.push(this._serialize(cart));
      this.db.save();
      return cart;
    }

    async findById(id) {
      const row = this.db.tables.carts.find((c) => c.id === id);
      return row ? this._hydrate(row) : null;
    }

    async findActive() {
      const row = this.db.tables.carts.find((c) => c.status === 'active');
      return row ? this._hydrate(row) : null;
    }

    async save(cart) {
      const idx = this.db.tables.carts.findIndex((c) => c.id === cart.id);
      const serialized = this._serialize(cart);
      if (idx === -1) this.db.tables.carts.push(serialized);
      else this.db.tables.carts[idx] = serialized;
      this.db.save();
      return cart;
    }
  }

  class TransactionRepository {
    constructor(db) {
      this.db = db;
    }

    _hydrate(row) {
      const tx = Object.assign(Object.create(Transaction.prototype), row);
      tx.recordedItems = row.recordedItems.map((i) =>
        Object.assign(Object.create(VerificationItem.prototype), i)
      );
      return tx;
    }

    _serialize(tx) {
      return JSON.parse(JSON.stringify(tx));
    }

    async createFromCart(cart) {
      const tx = new Transaction(this.db.nextTransactionId(), cart);
      this.db.tables.transactions.push(this._serialize(tx));
      this.db.save();
      return tx;
    }

    async findById(id) {
      const row = this.db.tables.transactions.find((t) => t.id === id);
      return row ? this._hydrate(row) : null;
    }

    async findByCartId(cartId) {
      const row = this.db.tables.transactions.find((t) => t.cartId === cartId);
      return row ? this._hydrate(row) : null;
    }

    /** FR-06 / FR-13: one query serves both the queue and the audit ledger. */
    async list(filter = {}) {
      let rows = this.db.tables.transactions.slice();
      if (filter.query) {
        const q = filter.query.trim().toLowerCase();
        rows = rows.filter(
          (t) =>
            t.id.toLowerCase().includes(q) ||
            t.cartId.toLowerCase().includes(q) ||
            (t.cashier || '').toLowerCase().includes(q)
        );
      }
      if (filter.status && filter.status !== 'all') {
        if (filter.status === 'discrepancy') {
          rows = rows.filter((t) =>
            t.recordedItems.some((i) => i.physicalQuantity !== i.cartQuantity)
          );
        } else {
          rows = rows.filter((t) => t.status === filter.status);
        }
      }
      if (filter.since) rows = rows.filter((t) => new Date(t.createdAt) >= new Date(filter.since));
      return rows
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map((r) => this._hydrate(r));
    }

    async save(tx) {
      const idx = this.db.tables.transactions.findIndex((t) => t.id === tx.id);
      const serialized = this._serialize(tx);
      if (idx === -1) this.db.tables.transactions.push(serialized);
      else this.db.tables.transactions[idx] = serialized;
      this.db.save();
      return tx;
    }
  }

  /** Module 4: the append-only activity log. */
  class AuditRepository {
    constructor(db) {
      this.db = db;
    }

    async add({ type, text, detail, actor }) {
      const entry = new AuditEntry({
        id: this.db.nextAuditId(),
        type,
        text,
        detail,
        actor,
        timestamp: new Date().toISOString(),
      });
      this.db.tables.audit_log.unshift({ ...entry });
      if (this.db.tables.audit_log.length > 500) this.db.tables.audit_log.length = 500;
      this.db.save();
      return entry;
    }

    /**
     * @param {object} filter  { actor } restricts the log to one person —
     *        this is what keeps a cashier from reading everyone else's
     *        activity while the administrator still sees all of it.
     */
    async list(filter = {}) {
      let rows = this.db.tables.audit_log.slice();
      if (filter.actor) rows = rows.filter((r) => r.actor === filter.actor);
      if (filter.query) {
        const q = filter.query.trim().toLowerCase();
        rows = rows.filter(
          (r) => r.text.toLowerCase().includes(q) || (r.detail || '').toLowerCase().includes(q)
        );
      }
      return rows.map((r) => new AuditEntry(r));
    }
  }

  class StaffRepository {
    constructor(db) {
      this.db = db;
    }

    async list() {
      return this.db.all('staff').map((s) => new Staff(s));
    }

    async findById(id) {
      const row = this.db
        .all('staff')
        .find((s) => s.id.toLowerCase() === String(id).trim().toLowerCase());
      return row ? new Staff(row) : null;
    }

    /**
     * Local mode only. Passwords are stored as 'plain:xxxx' because there
     * is no server to hold a bcrypt hash — see SQLITE.md. In server mode
     * this method is never called; the API verifies the hash instead.
     */
    async verify(id, password) {
      const staff = await this.findById(id);
      if (!staff) return null;
      return staff.passwordHash === `plain:${String(password).trim()}` ? staff : null;
    }

    /**
     * Admin-only (enforced in AdminService). Creates a new staff account.
     * Local mode stores 'plain:xxxx' — see verify() above for why.
     */
    async create(data) {
      const id = data.id.trim();
      if (await this.findById(id)) throw new Error(`Employee ID ${id} is already in use.`);
      const row = {
        id,
        name: data.name.trim(),
        role: data.role === 'admin' ? 'admin' : 'cashier',
        initials: data.initials || this._initials(data.name),
        passwordHash: `plain:${String(data.password).trim()}`,
      };
      this.db.tables.staff.push(row);
      this.db.save();
      return new Staff(row);
    }

    async update(id, data) {
      const key = String(id).trim().toLowerCase();
      const row = this.db.tables.staff.find((s) => s.id.toLowerCase() === key);
      if (!row) throw new Error('Staff account not found.');
      if (data.name) row.name = data.name.trim();
      if (data.role) row.role = data.role === 'admin' ? 'admin' : 'cashier';
      if (data.password) row.passwordHash = `plain:${String(data.password).trim()}`;
      this.db.save();
      return new Staff(row);
    }

    async remove(id) {
      const key = String(id).trim().toLowerCase();
      const before = this.db.tables.staff.length;
      this.db.tables.staff = this.db.tables.staff.filter((s) => s.id.toLowerCase() !== key);
      this.db.save();
      return this.db.tables.staff.length < before;
    }

    _initials(name) {
      return String(name || '')
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }
  }

  Object.assign(window.SmartCart, {
    ProductRepository,
    CartRepository,
    TransactionRepository,
    AuditRepository,
    StaffRepository,
  });
})();
