/**
 * verificationView.js — Screen 2: Physical Inspection & Payment.
 * Covers FR-07 .. FR-11. The view never decides whether payment may
 * proceed; it asks Transaction.blockingReason() and displays the answer,
 * so the button state and the service's refusal can never disagree.
 */
(function () {
  const { BaseView } = window.SmartCart;

  class VerificationView extends BaseView {
    constructor(ctx) {
      super(ctx);
      this.state = { txId: null, payMethod: 'cash', tendered: '' };
    }

    get title() {
      return 'Verification Workspace';
    }

    async open(txId) {
      this.state = { txId, payMethod: 'cash', tendered: '' };
      this.modal = null;
    }

    async render() {
      const { ICONS } = window.SmartCart;
      const { esc, money, stamp, emptyState } = window.SmartCart.dom;
      const tx = await this.guard(() => this.ctx.cashierService.retrieve(this.state.txId));
      if (!tx) return emptyState('search', 'Transaction not found', 'It may have been reset.');
      this.tx = tx;

      const readOnly = tx.isClosed;
      const diffs = tx.discrepancies;
      const checked = tx.checkedCount;
      const pct = tx.recordedItems.length ? Math.round((checked / tx.recordedItems.length) * 100) : 0;
      const blocked = readOnly ? null : tx.blockingReason(this.state.payMethod, this.state.tendered);

      return `
    <div class="page-head">
      <div>
        <h2>Transaction #${esc(tx.id)}</h2>
        <p>${esc(tx.cartId)} · finalised ${stamp(tx.createdAt)} ${tx.cashier ? '· handled by ' + esc(tx.cashier) : ''}</p>
      </div>
      <div class="actions">
        <button class="btn btn-ghost" data-act="go" data-page="${this.user.isAdmin ? 'transactions' : 'queue'}">${ICONS.back} Back</button>
        ${readOnly && this.user.isAdmin ? `<button class="btn btn-outline" data-act="reopen">${ICONS.refresh} Reopen</button>` : ''}
      </div>
    </div>

    ${this._banner(tx, readOnly, diffs)}
    ${readOnly ? '' : this._progress(tx, checked, pct)}

    <div class="verify-grid">
      ${this._recordedCard(tx)}
      ${this._inspectionCard(tx, readOnly)}
    </div>

    ${
      tx.override && tx.override.applied
        ? `<div class="banner banner-ok" style="margin-top:18px;">${ICONS.edit}<div>
            <h4>Subtotal recalculated</h4>
            <p>${money(tx.override.from)} → ${money(tx.override.to)} · ${esc(tx.override.note)} — approved by ${esc(tx.override.by)}</p>
          </div></div>`
        : ''
    }

    ${readOnly ? this._summaryCard(tx) : this._paymentCard(tx, diffs, blocked)}`;
    }

    // ---- sections ------------------------------------------------------
    _banner(tx, readOnly, diffs) {
      const { ICONS } = window.SmartCart;
      const { esc, money, stamp } = window.SmartCart.dom;
      if (readOnly && tx.status === 'flagged') {
        return `<div class="banner banner-warn">${ICONS.flag}<div><h4>Flagged for administrator review</h4><p>${esc(tx.flagReason || 'No reason recorded.')}</p></div></div>`;
      }
      if (readOnly) {
        return `<div class="banner banner-ok">${ICONS.check}<div><h4>Verified and paid</h4>
          <p>${money(tx.payment ? tx.payment.amount : tx.recalculatedTotal)} settled by ${tx.payment && tx.payment.method === 'card' ? 'card' : 'cash'} · closed ${stamp(tx.closedAt)}</p></div></div>`;
      }
      if (diffs.length) {
        return `<div class="banner banner-warn">${ICONS.alert}<div>
          <h4>${diffs.length} quantity discrepanc${diffs.length === 1 ? 'y' : 'ies'} detected</h4>
          <p>${diffs.map((d) => `${esc(d.name)} — recorded ${d.cartQuantity}, verified ${d.physicalQuantity}`).join('; ')}</p>
        </div></div>`;
      }
      return `<div class="banner banner-ok">${ICONS.check}<div><h4>All quantities match</h4><p>Recorded and verified quantities agree — this cart is ready for payment.</p></div></div>`;
    }

    _progress(tx, checked, pct) {
      return `<div class="card" style="padding:16px 22px;margin:20px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <strong style="font-size:14px;">Physical inspection progress</strong>
        <button class="link-btn" data-act="check-all">Mark all as checked</button>
      </div>
      <div class="progress-wrap">
        <div class="progress ${checked === tx.recordedItems.length ? 'full' : ''}"><span style="width:${pct}%"></span></div>
        <span class="progress-label">${checked} / ${tx.recordedItems.length} items</span>
      </div>
    </div>`;
    }

    _recordedCard(tx) {
      const { ICONS } = window.SmartCart;
      const { esc, money } = window.SmartCart.dom;
      return `<div class="card">
      <div class="card-head"><h3>${ICONS.cart} Customer's recorded cart</h3><span class="pill pill-neutral">Self-scanned</span></div>
      <div>
        ${tx.recordedItems
          .map(
            (i) => `
        <div class="verify-item">
          <div class="item-thumb">${i.icon}</div>
          <div style="flex:1;min-width:0;">
            <div class="name">${esc(i.name)}</div>
            <div class="upc">${esc(i.barcode)}</div>
          </div>
          <div class="cell-muted mono" style="width:60px;text-align:center;">×${i.cartQuantity}</div>
          <div class="cell-primary mono" style="width:92px;text-align:right;">${money(i.recordedSubtotal)}</div>
        </div>`
          )
          .join('')}
      </div>
      <div class="cart-total-row"><span class="label">Recorded total</span><span class="amount mono">${money(tx.recordedTotal)}</span></div>
    </div>`;
    }

    _inspectionCard(tx, readOnly) {
      const { ICONS } = window.SmartCart;
      const { esc, money } = window.SmartCart.dom;
      return `<div class="card">
      <div class="card-head">
        <h3>${ICONS.scan} Physical inspection</h3>
        ${readOnly ? '<span class="pill pill-neutral">Read only</span>' : '<span class="pill pill-primary">Count what is in the trolley</span>'}
      </div>
      <div>
        ${tx.recordedItems
          .map((i) => {
            const bad = i.status === 'mismatch';
            return `
        <div class="verify-item ${bad ? 'discrepancy' : ''}">
          ${bad ? '<span class="discrepancy-tag">Discrepancy</span>' : ''}
          <div class="item-thumb">${i.icon}</div>
          <div style="flex:1;min-width:0;">
            <div class="name">${esc(i.name)}</div>
            ${
              bad
                ? `<div class="note">Recorded ${i.cartQuantity} · counted ${i.physicalQuantity} · ${money((i.physicalQuantity - i.cartQuantity) * i.unitPrice)} difference</div>`
                : `<div class="upc">${money(i.unitPrice)} each</div>`
            }
          </div>
          ${
            readOnly
              ? `<div class="cell-muted mono" style="width:60px;text-align:center;">×${i.physicalQuantity}</div>`
              : `<div class="stepper">
                  <button data-act="phys-qty" data-id="${esc(i.productId)}" data-n="${i.physicalQuantity - 1}">–</button>
                  <span class="qty">${i.physicalQuantity}</span>
                  <button data-act="phys-qty" data-id="${esc(i.productId)}" data-n="${i.physicalQuantity + 1}">+</button>
                </div>
                <button class="icon-btn" data-act="toggle-check" data-id="${esc(i.productId)}" title="${i.checked ? 'Checked' : 'Mark as checked'}"
                        style="${i.checked ? 'background:var(--success-tint);color:var(--success);border-color:var(--success);' : ''}">${ICONS.check}</button>`
          }
        </div>`;
          })
          .join('')}
      </div>
      <div class="cart-total-row"><span class="label">Verified total</span><span class="amount mono">${money(tx.recalculatedTotal)}</span></div>
    </div>`;
    }

    /**
     * FR-09. One flow: the amount is shown, the cashier types what the
     * customer handed over, the change appears. No separate "record
     * payment" step to forget.
     */
    _paymentCard(tx, diffs, blocked) {
      const { ICONS } = window.SmartCart;
      const { esc, money } = window.SmartCart.dom;
      const due = tx.amountDue;
      const cash = parseFloat(this.state.tendered);
      const enough = !Number.isNaN(cash) && cash >= due;
      const change = enough ? +(cash - due).toFixed(2) : null;
      const short = !Number.isNaN(cash) && cash < due ? +(due - cash).toFixed(2) : null;
      const quick = [{ v: due, l: 'Exact' }].concat(
        [100, 200, 500, 1000].filter((n) => n >= due).slice(0, 3).map((n) => ({ v: n, l: money(n) }))
      );

      return `<div class="card" style="margin-top:20px;">
      <div class="card-head"><h3>${ICONS.wallet} Payment</h3>
        ${diffs.length && !(tx.override && tx.override.applied) ? `<button class="btn btn-outline btn-sm" data-act="open-override">${ICONS.edit} Override &amp; recalculate</button>` : ''}
      </div>
      <div class="card-body">
        <div class="pay-split">
          <div class="amount-due">
            <div class="cap">Amount to charge</div>
            <div class="big">${money(due)}</div>
            <div class="sub">${tx.recordedItems.reduce((s, i) => s + i.physicalQuantity, 0)} items${tx.override && tx.override.applied ? ' · recalculated from the verified count' : ''}</div>
          </div>
          <div>
            <div class="paymethod-group" style="margin-bottom:16px;">
              <button class="${this.state.payMethod === 'cash' ? 'active' : ''}" data-act="pay-method" data-m="cash">${ICONS.cash} Cash</button>
              <button class="${this.state.payMethod === 'card' ? 'active' : ''}" data-act="pay-method" data-m="card">${ICONS.card} Card</button>
            </div>
            ${
              this.state.payMethod === 'cash'
                ? `<div class="field" style="margin-bottom:10px;">
                  <label for="tendered">Cash received from the customer</label>
                  <div class="input-wrap">
                    <input class="input mono" id="tendered" data-fkey="tendered" data-bind="tendered" inputmode="decimal"
                           value="${esc(this.state.tendered)}" placeholder="0.00" style="font-size:20px;height:52px;font-weight:700;">
                  </div>
                </div>
                <div class="quick-tender">
                  ${quick.map((q) => `<button class="btn btn-outline btn-sm" data-act="tender" data-v="${q.v}">${q.l}</button>`).join('')}
                  ${this.state.tendered ? '<button class="btn btn-ghost btn-sm" data-act="tender" data-v="">Clear</button>' : ''}
                </div>
                <div class="change-box ${enough ? 'ok' : short !== null ? 'short' : ''}">
                  <span class="k">${short !== null ? 'Still short by' : 'Change to give'}</span>
                  <span class="v mono">${change !== null ? money(change) : short !== null ? money(short) : '—'}</span>
                </div>`
                : `<div class="change-box ok"><span class="k">Charge the card terminal</span><span class="v mono">${money(due)}</span></div>
                 <p style="font-size:12.5px;color:var(--text-muted);margin:10px 0 0;line-height:1.5;">No cash handling — approve once the card terminal returns an approved slip.</p>`
            }
          </div>
        </div>
      </div>
      <div class="modal-foot" style="justify-content:space-between;">
        <button class="btn btn-danger-outline" data-act="open-flag">${ICONS.flag} Flag for review</button>
        <button class="btn btn-primary" ${blocked ? 'disabled' : ''} data-act="approve">${ICONS.check} Approve &amp; complete</button>
      </div>
      ${blocked ? `<div style="padding:0 22px 18px;"><div class="inline-warn">${ICONS.alert}<span>${esc(blocked)}</span></div></div>` : ''}
    </div>`;
    }

    _summaryCard(tx) {
      const { ICONS } = window.SmartCart;
      const { esc, money, stamp } = window.SmartCart.dom;
      const p = tx.payment;
      return `<div class="card" style="margin-top:20px;">
      <div class="card-head"><h3>${ICONS.receipt} Transaction summary</h3>
        ${p ? `<button class="btn btn-outline btn-sm" data-act="show-receipt">${ICONS.print} View receipt</button>` : ''}
      </div>
      <div class="card-body">
        <div class="kv"><span class="k">Status</span><span class="v">${tx.status === 'verified' ? 'Verified &amp; paid' : 'Flagged'}</span></div>
        <div class="kv"><span class="k">Cashier</span><span class="v">${esc(tx.cashier || '—')}</span></div>
        <div class="kv"><span class="k">Closed</span><span class="v">${tx.closedAt ? stamp(tx.closedAt) : '—'}</span></div>
        ${p ? `<div class="kv"><span class="k">Payment method</span><span class="v">${p.method === 'cash' ? 'Cash' : 'Card'}</span></div>` : ''}
        ${p && p.tendered ? `<div class="kv"><span class="k">Received / change</span><span class="v mono">${money(p.tendered)} / ${money(p.change)}</span></div>` : ''}
        <div class="kv grand"><span class="k">Amount ${tx.status === 'verified' ? 'paid' : 'recorded'}</span><span class="v mono">${money(p ? p.amount : tx.recordedTotal)}</span></div>
      </div>
    </div>`;
    }

    // ---- modals ---------------------------------------------------------
    async renderModal() {
      if (!this.modal) return '';
      if (this.modal === 'override') return this._overrideModal();
      if (this.modal === 'flag') return this._flagModal();
      if (this.modal === 'receipt') return this._receiptModal();
      return '';
    }

    _overrideModal() {
      const { ICONS } = window.SmartCart;
      const { esc, money } = window.SmartCart.dom;
      const tx = this.tx;
      return this.modalShell(
        'Override &amp; recalculate subtotal',
        `<div class="banner banner-warn" style="margin-bottom:16px;">${ICONS.alert}<div>
          <h4>${tx.discrepancies.length} line(s) do not match</h4>
          <p>The customer will be charged for the quantities you physically counted.</p>
        </div></div>
        ${tx.discrepancies
          .map((d) => `<div class="kv"><span class="k">${esc(d.name)}</span><span class="v mono">${d.cartQuantity} → ${d.physicalQuantity}</span></div>`)
          .join('')}
        <div class="kv grand"><span class="k">New amount due</span><span class="v mono">${money(tx.recalculatedTotal)}</span></div>
        <div class="field" style="margin-top:16px;">
          <label for="ov-note">Discrepancy note (required)</label>
          <textarea class="input" id="ov-note" data-fkey="ov-note" placeholder="e.g. Customer returned one carton of milk to the shelf before reaching the counter."></textarea>
        </div>`,
        `<button class="btn btn-outline" data-act="close-modal">Cancel</button>
         <button class="btn btn-primary" data-act="save-override">Apply &amp; recalculate</button>`
      );
    }

    _flagModal() {
      const { ICONS } = window.SmartCart;
      return this.modalShell(
        'Flag for administrator review',
        `<p style="font-size:13.5px;color:var(--text-muted);margin:0 0 14px;line-height:1.55;">The transaction is held unpaid and sent to the administrator. Explain what you observed.</p>
         <div class="field"><label for="fl-note">Reason (required)</label>
           <textarea class="input" id="fl-note" data-fkey="fl-note" placeholder="e.g. Two items in the trolley had no matching scan record."></textarea>
         </div>`,
        `<button class="btn btn-outline" data-act="close-modal">Cancel</button>
         <button class="btn btn-danger-outline" data-act="save-flag">${ICONS.flag} Flag transaction</button>`
      );
    }

    _receiptModal() {
      const { ICONS } = window.SmartCart;
      const { esc, money, stamp } = window.SmartCart.dom;
      const tx = this.tx;
      const p = tx.payment || {};
      return this.modalShell(
        'Receipt',
        `<div class="receipt-paper">
          <div class="r-head"><strong>SMARTCART OS</strong><div>Main Register · POS-T049</div></div>
          <div class="rule"></div>
          ${tx.recordedItems
            .filter((i) => i.physicalQuantity > 0)
            .map((i) => `<div class="r-line"><span>${esc(i.name)} ×${i.physicalQuantity}</span><span>${money(i.subtotal)}</span></div>`)
            .join('')}
          <div class="rule"></div>
          <div class="r-line"><span>TOTAL</span><span>${money(p.amount || 0)}</span></div>
          <div class="r-line"><span>${p.method === 'card' ? 'CARD' : 'CASH'}</span><span>${money(p.tendered || p.amount || 0)}</span></div>
          ${p.method === 'cash' ? `<div class="r-line"><span>CHANGE</span><span>${money(p.change || 0)}</span></div>` : ''}
          <div class="rule"></div>
          <div class="r-line"><span>${esc(tx.id)}</span><span>${esc(tx.cartId)}</span></div>
          <div class="r-line"><span>${esc(tx.cashier || '')}</span><span>${stamp(tx.closedAt || new Date().toISOString())}</span></div>
          <div style="text-align:center;margin-top:12px;">THANK YOU FOR SHOPPING</div>
        </div>`,
        `<button class="btn btn-outline" data-act="print">${ICONS.print} Print</button>
         <button class="btn btn-primary" data-act="close-modal">Done</button>`
      );
    }

    // ---- actions ---------------------------------------------------------
    async onAction(act, data) {
      const id = this.state.txId;
      switch (act) {
        case 'phys-qty':
          await this.guard(() =>
            this.ctx.cashierService.setPhysicalQuantity(id, data.id, parseInt(data.n, 10))
          );
          await this.ctx.app.refresh();
          return true;
        case 'toggle-check':
          await this.guard(() => this.ctx.cashierService.toggleChecked(id, data.id));
          await this.ctx.app.refresh();
          return true;
        case 'check-all':
          await this.guard(() => this.ctx.cashierService.checkAll(id));
          await this.ctx.app.refresh();
          return true;
        case 'pay-method':
          await this.setState({ payMethod: data.m });
          return true;
        case 'tender':
          await this.setState({ tendered: data.v });
          return true;
        case 'open-override':
          this.modal = 'override';
          await this.ctx.app.refresh();
          return true;
        case 'save-override': {
          const ok = await this.guard(
            () => this.ctx.cashierService.applyOverride(id, this.field('ov-note')),
            'Subtotal recalculated from the verified quantities.'
          );
          if (ok) this.modal = null;
          await this.ctx.app.refresh();
          return true;
        }
        case 'open-flag':
          this.modal = 'flag';
          await this.ctx.app.refresh();
          return true;
        case 'save-flag': {
          const ok = await this.guard(() => this.ctx.cashierService.flag(id, this.field('fl-note')));
          if (ok) {
            this.modal = null;
            this.toast.success(`${id} flagged for administrator review.`);
            await this.ctx.app.go(this.user.isAdmin ? 'transactions' : 'queue');
          } else {
            await this.ctx.app.refresh();
          }
          return true;
        }
        case 'approve': {
          const tx = await this.guard(() =>
            this.ctx.cashierService.completePayment(id, {
              method: this.state.payMethod,
              tendered: this.state.tendered,
            })
          );
          if (tx) {
            this.tx = tx;
            this.modal = 'receipt';
          }
          await this.ctx.app.refresh();
          return true;
        }
        case 'show-receipt':
          this.modal = 'receipt';
          await this.ctx.app.refresh();
          return true;
        case 'reopen':
          await this.guard(() => this.ctx.cashierService.reopen(id), `${id} reopened for verification.`);
          await this.ctx.app.refresh();
          return true;
        case 'print':
          window.print();
          return true;
        default:
          return false;
      }
    }
  }

  window.SmartCart.VerificationView = VerificationView;
})();
