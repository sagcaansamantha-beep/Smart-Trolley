/**
 * transactionsView.js — Transaction Audit Ledger (FR-13).
 * Search by ID / cart / cashier, filter by status and date range,
 * export the filtered set as CSV.
 */
(function () {
  const { BaseView } = window.SmartCart;

  class TransactionsView extends BaseView {
    constructor(ctx) {
      super(ctx);
      this.state = { search: '', status: 'all', range: 'all' };
    }

    get title() {
      return 'Transactions';
    }

    async _rows() {
      const filter = { query: this.state.search, status: this.state.status };
      if (this.state.range === 'today') filter.since = window.SmartCart.dom.startOfToday();
      if (this.state.range === 'week') filter.since = new Date(Date.now() - 7 * 864e5).toISOString();
      const rows = await this.ctx.adminService.listTransactions(filter);
      return rows.filter((t) => t.status !== 'active');
    }

    async render() {
      const { ICONS } = window.SmartCart;
      const { searchInput } = window.SmartCart.dom;
      const rows = await this._rows();
      const select = (key, options) =>
        `<select class="input" data-bind="${key}" style="max-width:200px;">
          ${options.map(([v, l]) => `<option value="${v}" ${this.state[key] === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>`;

      return `
    <div class="page-head">
      <div><h2>Transactions</h2><p>Search, review and reopen recorded transactions.</p></div>
      <div class="actions"><button class="btn btn-outline" data-act="export-tx">${ICONS.download} Export CSV</button></div>
    </div>
    <div class="filter-row">
      ${searchInput('search', this.state.search, 'Search by transaction ID, cart session or cashier…')}
      ${select('status', [['all', 'All statuses'], ['pending', 'Pending'], ['verified', 'Verified'], ['flagged', 'Flagged'], ['discrepancy', 'With discrepancy']])}
      ${select('range', [['all', 'All time'], ['today', 'Today'], ['week', 'Last 7 days']])}
    </div>
    <div class="card">${TransactionsView.table(rows)}</div>`;
    }

    /** Static so the admin dashboard can reuse the exact same table. */
    static table(rows) {
      const { ICONS } = window.SmartCart;
      const { esc, money, timeAgo, statusPill, emptyState } = window.SmartCart.dom;
      if (!rows.length)
        return emptyState('search', 'No matching transactions', 'Try a different search term, status or date range.');
      return `
    <table>
      <thead><tr><th>Transaction</th><th>Cart</th><th>Items</th><th>Amount</th><th>Status</th><th>Time</th><th></th></tr></thead>
      <tbody>
        ${rows
          .map(
            (t) => `
        <tr class="clickable" data-act="open-tx" data-id="${esc(t.id)}">
          <td class="cell-primary mono">#${esc(t.id)}</td>
          <td class="cell-muted mono">${esc(t.cartId)}</td>
          <td class="cell-muted">${t.itemCount}</td>
          <td class="mono">${money(t.payment ? t.payment.amount : t.recordedTotal)}</td>
          <td>${statusPill(t.status)}${t.hasDiscrepancy ? ` <span class="pill pill-danger">${ICONS.alert} ${t.discrepancies.length}</span>` : ''}</td>
          <td class="cell-muted">${timeAgo(t.createdAt)}</td>
          <td><span class="btn btn-ghost btn-sm" style="pointer-events:none;">Open ${ICONS.chev}</span></td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>`;
    }

    async onAction(act, data) {
      if (act === 'open-tx') {
        await this.ctx.app.openTransaction(data.id);
        return true;
      }
      if (act === 'export-tx') {
        const rows = await this._rows();
        const csv = this.ctx.adminService.exportTransactionsCSV(rows);
        window.SmartCart.dom.downloadFile('smartcart-transactions.csv', csv, 'text/csv');
        this.toast.success('smartcart-transactions.csv downloaded.');
        return true;
      }
      return false;
    }
  }

  window.SmartCart.TransactionsView = TransactionsView;
})();
