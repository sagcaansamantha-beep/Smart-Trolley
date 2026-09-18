/**
 * queueView.js — Screen 1: Verification Queue (FR-06).
 * The scan/type field accepts either a transaction ID or a cart session
 * code, because at the counter the cashier may be reading either one.
 */
(function () {
  const { BaseView } = window.SmartCart;

  class QueueView extends BaseView {
    constructor(ctx) {
      super(ctx);
      this.state = { search: '' };
    }

    get title() {
      return 'Verification Queue';
    }

    async render() {
      const { ICONS, icon } = window.SmartCart;
      const { esc, money, minutesSince, timeAgo, emptyState } = window.SmartCart.dom;
      const queue = await this.ctx.cashierService.getQueue(this.state.search);

      return `
    <div class="page-head">
      <div><h2>Verification Queue</h2><p>Finalised carts waiting to be checked and paid for.</p></div>
    </div>
    <div class="card" style="padding:18px 20px;margin-bottom:22px;">
      <div class="input-wrap">${icon('scan', 'leading')}
        <input class="input has-icon mono" data-fkey="q-search" data-bind="search" data-retrieve="1"
               value="${esc(this.state.search)}"
               placeholder="Scan or type a transaction ID / cart session — press Enter to retrieve">
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${
        queue.length
          ? queue
              .map((tx) => {
                const waited = minutesSince(tx.createdAt);
                return `
        <div class="card" style="padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div class="item-thumb" style="width:46px;height:46px;">${ICONS.receipt}</div>
            <div>
              <div class="cell-primary mono" style="font-size:15px;">#${esc(tx.id)}</div>
              <div class="cell-muted" style="font-size:13px;margin-top:2px;">
                ${tx.itemCount} items · <span class="mono">${money(tx.recordedTotal)}</span> · ${esc(tx.cartId)} · ${timeAgo(tx.createdAt)}
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="pill ${waited > 10 ? 'pill-danger' : 'pill-warning'}">${ICONS.clock} Waiting ${waited} min</span>
            <button class="btn btn-primary" data-act="open-tx" data-id="${esc(tx.id)}">Retrieve &amp; verify</button>
          </div>
        </div>`;
              })
              .join('')
          : emptyState('check', 'Queue is clear', 'No carts are waiting for verification right now.')
      }
    </div>`;
    }

    async onAction(act, data) {
      if (act === 'open-tx') {
        await this.ctx.app.openTransaction(data.id);
        return true;
      }
      return false;
    }

    async onEnter(target) {
      if (!target.dataset.retrieve) return false;
      const code = target.value.trim();
      if (!code) return true;
      const tx = await this.guard(() => this.ctx.cashierService.retrieve(code));
      if (tx) {
        this.state.search = '';
        await this.ctx.app.openTransaction(tx.id);
      }
      return true;
    }
  }

  window.SmartCart.QueueView = QueueView;
})();
