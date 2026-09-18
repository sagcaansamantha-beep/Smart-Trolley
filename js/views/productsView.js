/**
 * productsView.js — Product Directory (FR-12).
 * Cashiers get a read-only view; only an administrator sees the
 * add/edit/delete controls (NFR-05), and AdminService re-checks the role
 * on every write so hiding a button is not the only defence.
 */
(function () {
  const { BaseView } = window.SmartCart;

  class ProductsView extends BaseView {
    constructor(ctx) {
      super(ctx);
      this.state = { search: '', draft: null, error: '', editingId: null, confirmId: null };
    }

    get title() {
      return 'Product Catalog';
    }

    async render() {
      const { ICONS } = window.SmartCart;
      const { esc, money, stockPill, searchInput, emptyState } = window.SmartCart.dom;
      const isAdmin = this.user.isAdmin;
      const rows = await this.ctx.adminService.listProducts(this.state.search);

      return `
    <div class="page-head">
      <div><h2>Product Catalog</h2><p>${isAdmin ? 'Add, edit and remove the records the scanner looks up.' : 'Browse the records the scanner looks up.'}</p></div>
      ${isAdmin ? `<div class="actions"><button class="btn btn-primary" data-act="new-product">${ICONS.plus} Add product</button></div>` : ''}
    </div>
    <div class="filter-row">${searchInput('search', this.state.search, 'Search by name, barcode, ID or category…')}</div>
    <div class="card">${
      rows.length
        ? `<table>
      <thead><tr><th>Product</th><th>Barcode</th><th>ID</th><th>Category</th><th>Price</th><th>Stock</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
      <tbody>
        ${rows
          .map(
            (p) => `
        <tr>
          <td><div class="row-item"><div class="item-thumb">${p.icon}</div><span class="cell-primary">${esc(p.name)}</span></div></td>
          <td class="mono cell-muted">${esc(p.barcode)}</td>
          <td class="mono cell-muted">${esc(p.id)}</td>
          <td class="cell-muted">${esc(p.category)}</td>
          <td class="mono">${money(p.price)}</td>
          <td>${stockPill(p)}</td>
          ${
            isAdmin
              ? `<td><div style="display:flex;gap:6px;">
                  <button class="icon-btn" data-act="edit-product" data-id="${esc(p.id)}" title="Edit">${ICONS.edit}</button>
                  <button class="icon-btn" data-act="ask-delete" data-id="${esc(p.id)}" title="Delete">${ICONS.trash}</button>
                </div></td>`
              : ''
          }
        </tr>`
          )
          .join('')}
      </tbody></table>`
        : emptyState('tag', 'No products found', 'Try a different search term.')
    }</div>`;
    }

    async renderModal() {
      if (this.state.confirmId) return this._confirmModal();
      if (!this.state.draft) return '';
      return this._formModal();
    }

    _formModal() {
      const { ICONS } = window.SmartCart;
      const { esc } = window.SmartCart.dom;
      const d = this.state.draft;
      const editing = !!this.state.editingId;
      return this.modalShell(
        editing ? 'Edit product' : 'Add product',
        `${this.state.error ? `<div class="help-error" style="margin-bottom:14px;">${ICONS.alert}<span>${esc(this.state.error)}</span></div>` : ''}
        <div class="field"><label for="pf-name">Product name</label>
          <input class="input" id="pf-name" data-fkey="pf-name" value="${esc(d.name)}" placeholder="e.g. Sunrise Whole Milk 1L"></div>
        <div class="form-grid-2">
          <div class="field"><label for="pf-bar">Barcode (UPC/EAN)</label>
            <input class="input mono" id="pf-bar" value="${esc(d.barcode)}" placeholder="8–13 digits"></div>
          <div class="field"><label for="pf-cat">Category</label>
            <input class="input" id="pf-cat" value="${esc(d.category)}" placeholder="e.g. Dairy"></div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label for="pf-price">Price (₱)</label>
            <input class="input mono" id="pf-price" inputmode="decimal" value="${esc(d.price)}" placeholder="0.00"></div>
          <div class="field"><label for="pf-stock">${editing ? 'On hand' : 'Starting stock'}</label>
            <input class="input mono" id="pf-stock" inputmode="numeric" value="${esc(d.stock)}" placeholder="0"></div>
        </div>
        <div class="field"><label for="pf-icon">Display icon</label>
          <input class="input" id="pf-icon" value="${esc(d.icon)}" placeholder="🛒"></div>`,
        `<button class="btn btn-outline" data-act="close-form">Cancel</button>
         <button class="btn btn-primary" data-act="save-product">${editing ? 'Save changes' : 'Add product'}</button>`
      );
    }

    _confirmModal() {
      const { esc } = window.SmartCart.dom;
      const p = this.state.confirmProduct;
      return this.modalShell(
        'Delete product',
        `<p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin:0;">
          ${esc(p.name)} (${esc(p.id)}) will be removed from the catalog. Its barcode will no longer resolve at the trolley scanner.
          Past transactions keep their own copy of the name and price, so records stay intact.
        </p>`,
        `<button class="btn btn-outline" data-act="close-form">Cancel</button>
         <button class="btn btn-danger-outline" data-act="confirm-delete">Delete product</button>`
      );
    }

    async closeModal() {
      this.state.draft = null;
      this.state.editingId = null;
      this.state.confirmId = null;
      this.state.confirmProduct = null;
      this.state.error = '';
      await this.ctx.app.refresh();
    }

    async onAction(act, data) {
      switch (act) {
        case 'new-product':
          this.state.draft = { name: '', barcode: '', category: '', price: '', stock: '', icon: '🛒' };
          this.state.editingId = null;
          this.state.error = '';
          await this.ctx.app.refresh();
          return true;
        case 'edit-product': {
          const p = await this.ctx.productRepo.findById(data.id);
          this.state.draft = { name: p.name, barcode: p.barcode, category: p.category, price: p.price, stock: p.stock, icon: p.icon };
          this.state.editingId = p.id;
          this.state.error = '';
          await this.ctx.app.refresh();
          return true;
        }
        case 'save-product':
          await this._save();
          return true;
        case 'ask-delete':
          this.state.confirmId = data.id;
          this.state.confirmProduct = await this.ctx.productRepo.findById(data.id);
          await this.ctx.app.refresh();
          return true;
        case 'confirm-delete': {
          const removed = await this.guard(() => this.ctx.adminService.deleteProduct(this.state.confirmId));
          this.state.confirmId = null;
          this.state.confirmProduct = null;
          if (removed) this.toast.success(`${removed.name} removed.`);
          await this.ctx.app.refresh();
          return true;
        }
        case 'close-form':
          this.state.draft = null;
          this.state.editingId = null;
          this.state.confirmId = null;
          this.state.error = '';
          await this.ctx.app.refresh();
          return true;
        default:
          return false;
      }
    }

    async _save() {
      // Read the form back into the draft first, so a validation error
      // never wipes what the user typed.
      const draft = {
        name: this.field('pf-name'),
        barcode: this.field('pf-bar'),
        category: this.field('pf-cat'),
        price: this.field('pf-price'),
        stock: this.field('pf-stock'),
        icon: this.field('pf-icon'),
      };
      this.state.draft = draft;
      try {
        if (this.state.editingId) {
          const p = await this.ctx.adminService.editProduct(this.state.editingId, draft);
          this.toast.success(`${p.name} updated.`);
        } else {
          const p = await this.ctx.adminService.addProduct(draft);
          this.toast.success(`${p.name} added to the catalog.`);
        }
        this.state.draft = null;
        this.state.editingId = null;
        this.state.error = '';
      } catch (err) {
        this.state.error = err.message;
      }
      await this.ctx.app.refresh();
    }
  }

  window.SmartCart.ProductsView = ProductsView;
})();
