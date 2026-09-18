/**
 * inventoryView.js — Inventory Management.
 * Stock falls automatically when a sale is approved (CashierService);
 * this screen is for manual corrections, deliveries and write-offs, each
 * of which must carry a reason so Module 4 can explain the movement.
 */
(function () {
  const { BaseView } = window.SmartCart;

  class InventoryView extends BaseView {
    constructor(ctx) {
      super(ctx);
      this.state = { search: '', lowOnly: false, adjustId: null, adjustProduct: null };
    }

    get title() {
      return 'Inventory Management';
    }

    async render() {
      const { ICONS } = window.SmartCart;
      const { esc, stockPill, searchInput, emptyState } = window.SmartCart.dom;
      const isAdmin = this.user.isAdmin;
      let rows = await this.ctx.adminService.listProducts(this.state.search);
      if (this.state.lowOnly) rows = rows.filter((p) => p.stock < 10);

      return `
    <div class="page-head">
      <div><h2>Inventory Management</h2><p>Stock levels fall automatically as transactions are approved.</p></div>
      <div class="actions"><button class="btn btn-outline" data-act="export-stock">${ICONS.download} Export stock report</button></div>
    </div>
    <div class="filter-row">
      ${searchInput('search', this.state.search, 'Search products by name or ID…')}
      <button class="btn ${this.state.lowOnly ? 'btn-primary' : 'btn-outline'}" data-act="toggle-low">${ICONS.alert} Low stock only</button>
    </div>
    <div class="card">${
      rows.length
        ? `<table>
      <thead><tr><th>Product</th><th>On hand</th><th>Status</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
      <tbody>
        ${rows
          .map(
            (p) => `
        <tr>
          <td><div class="row-item"><div class="item-thumb">${p.icon}</div><div>
            <div class="cell-primary">${esc(p.name)}</div>
            <div class="cell-muted mono" style="font-size:12px;">${esc(p.id)} · ${esc(p.barcode)}</div>
          </div></div></td>
          <td class="mono" style="font-size:17px;font-weight:800;${p.stock === 0 ? 'color:var(--danger);' : ''}">${p.stock}</td>
          <td>${stockPill(p)}</td>
          ${isAdmin ? `<td><button class="btn btn-outline btn-sm" data-act="adjust" data-id="${esc(p.id)}">Adjust stock</button></td>` : ''}
        </tr>`
          )
          .join('')}
      </tbody></table>`
        : emptyState('archive', 'No products found', 'Try a different search term.')
    }</div>`;
    }

    async renderModal() {
      if (!this.state.adjustId) return '';
      const { esc } = window.SmartCart.dom;
      const p = this.state.adjustProduct;
      return this.modalShell(
        'Adjust stock',
        `<div class="row-item" style="margin-bottom:16px;">
          <div class="item-thumb">${p.icon}</div>
          <div><div class="cell-primary">${esc(p.name)}</div>
          <div class="cell-muted mono" style="font-size:12px;">${esc(p.id)} · ${p.stock} on hand</div></div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label for="st-delta">Quantity change</label>
            <div class="input-wrap"><input class="input mono" id="st-delta" data-fkey="st-delta" inputmode="numeric" placeholder="e.g. 24 or -3"></div>
          </div>
          <div class="field"><label for="st-reason">Reason</label>
            <select class="input" id="st-reason">
              <option>Restock delivery</option>
              <option>Damaged / written off</option>
              <option>Inventory recount</option>
              <option>Return to supplier</option>
              <option>Correction</option>
            </select>
          </div>
        </div>
        <p style="font-size:12.5px;color:var(--text-muted);margin:4px 0 0;">Use a negative number to deduct. Every adjustment is written to the activity log.</p>`,
        `<button class="btn btn-outline" data-act="close-adjust">Cancel</button>
         <button class="btn btn-primary" data-act="save-adjust">Save adjustment</button>`
      );
    }

    async closeModal() {
      this.state.adjustId = null;
      this.state.adjustProduct = null;
      await this.ctx.app.refresh();
    }

    async onAction(act, data) {
      switch (act) {
        case 'toggle-low':
          await this.setState({ lowOnly: !this.state.lowOnly });
          return true;
        case 'adjust':
          this.state.adjustId = data.id;
          this.state.adjustProduct = await this.ctx.productRepo.findById(data.id);
          await this.ctx.app.refresh();
          return true;
        case 'close-adjust':
          this.state.adjustId = null;
          this.state.adjustProduct = null;
          await this.ctx.app.refresh();
          return true;
        case 'save-adjust': {
          const updated = await this.guard(() =>
            this.ctx.adminService.adjustStock(this.state.adjustId, this.field('st-delta'), this.field('st-reason'))
          );
          if (updated) {
            this.state.adjustId = null;
            this.state.adjustProduct = null;
            this.toast.success(`${updated.name} updated to ${updated.stock} on hand.`);
          }
          await this.ctx.app.refresh();
          return true;
        }
        case 'export-stock': {
          const csv = await this.ctx.adminService.exportStockCSV();
          window.SmartCart.dom.downloadFile('smartcart-stock-report.csv', csv, 'text/csv');
          this.toast.success('smartcart-stock-report.csv downloaded.');
          return true;
        }
        default:
          return false;
      }
    }
  }

  window.SmartCart.InventoryView = InventoryView;
})();
