/**
 * dashboardView.js — Administrator Dashboard.
 * Read-only roll-up of what the other modules produced; every number
 * comes from AdminService.dashboardStats() so the arithmetic is testable
 * without a browser.
 */
(function () {
  const { BaseView } = window.SmartCart;

  class DashboardView extends BaseView {
    get title() {
      return 'Administrator Dashboard';
    }

    async render() {
      const { ICONS } = window.SmartCart;
      const { esc, money, statCard } = window.SmartCart.dom;
      const s = await this.ctx.adminService.dashboardStats();

      return `
    <div class="page-head"><div><h2>Administrator Dashboard</h2><p>System-wide view of transactions, discrepancies and stock.</p></div></div>
    <div class="stat-grid">
      ${statCard('Transactions today', s.todayCount, 'receipt', 'primary', `${s.pendingCount} still pending`)}
      ${statCard('Flagged', s.flaggedCount, 'flag', 'danger', s.flaggedCount ? 'Needs review' : 'All clear')}
      ${statCard('Discrepancy rate', s.discrepancyRate + '%', 'alert', 'warning', `${s.discrepancyCount} carts affected`)}
      ${statCard('Verified revenue', money(s.revenue), 'wallet', 'teal', 'From completed carts')}
    </div>
    <div class="verify-grid">
      <div class="card">
        <div class="card-head"><h3>${ICONS.receipt} Recent transactions</h3>
          <span class="pill pill-neutral" style="cursor:pointer;" data-act="go" data-page="transactions">View all ${ICONS.chev}</span>
        </div>
        ${window.SmartCart.TransactionsView.table(s.recentTransactions)}
      </div>
      <div class="card">
        <div class="card-head"><h3>${ICONS.alert} Low stock alerts</h3></div>
        <div>
          ${
            s.lowStock.length
              ? s.lowStock
                  .slice(0, 6)
                  .map(
                    (p) => `
            <div class="verify-item">
              <div class="item-thumb">${p.icon}</div>
              <div style="flex:1;min-width:0;">
                <div class="name">${esc(p.name)}</div>
                <div class="upc">${esc(p.category)}</div>
              </div>
              <span class="pill ${p.stock === 0 ? 'pill-danger' : 'pill-warning'}">${p.stock} left</span>
            </div>`
                  )
                  .join('')
              : '<div style="padding:20px;color:var(--text-muted);font-size:13.5px;">Nothing running low right now.</div>'
          }
        </div>
        <div style="padding:16px 22px;"><button class="btn btn-outline btn-block" data-act="go" data-page="inventory">Open inventory</button></div>
      </div>
    </div>`;
    }

    async onAction(act, data) {
      if (act === 'open-tx') {
        await this.ctx.app.openTransaction(data.id);
        return true;
      }
      return false;
    }
  }

  window.SmartCart.DashboardView = DashboardView;
})();
