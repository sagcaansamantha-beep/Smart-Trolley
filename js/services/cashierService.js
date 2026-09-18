/**
 * cashierService.js
 * -----------------------------------------------------------------------
 * Module 2: Cashier Verification & Checkout (FR-06 .. FR-11).
 *
 * The rule that matters most lives here: FR-11 / NFR-07 — a transaction
 * can never be paid or approved while a discrepancy is unresolved. The
 * check itself is Transaction.blockingReason() in models.js; this class
 * refuses to proceed whenever it returns a reason, so a broken view or a
 * console call can't bypass it either.
 * -----------------------------------------------------------------------
 */
(function () {
  class CashierService {
    constructor(transactionRepo, productRepo, auditRepo, authService) {
      this.transactionRepo = transactionRepo;
      this.productRepo = productRepo;
      this.auditRepo = auditRepo;
      this.auth = authService;
    }

    /** FR-06: the queue of finalized carts waiting at the counter. */
    async getQueue(query = '') {
      const rows = await this.transactionRepo.list({ query, status: 'pending' });
      return rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    /** FR-06: retrieve one transaction by its own ID or by cart session. */
    async retrieve(idOrCartId) {
      const key = String(idOrCartId || '').trim();
      let tx = await this.transactionRepo.findById(key);
      if (!tx) tx = await this.transactionRepo.findByCartId(key);
      if (!tx) {
        const err = new Error('No transaction matches that code.');
        err.code = 'TRANSACTION_NOT_FOUND';
        throw err;
      }
      return tx;
    }

    /** FR-07/FR-08: the cashier records what is physically in the trolley. */
    async setPhysicalQuantity(txId, productId, physicalQuantity) {
      const tx = await this._openTx(txId);
      const item = tx.recordedItems.find((i) => i.productId === productId);
      if (!item) throw new Error('ITEM_NOT_FOUND');
      item.physicalQuantity = Math.max(0, Number(physicalQuantity));
      item.checked = true;
      // Editing a line back into agreement retires a stale override.
      if (tx.override && tx.override.applied && !tx.hasDiscrepancy) tx.override = null;
      await this.transactionRepo.save(tx);
      return tx;
    }

    /** FR-07: mark one line as physically inspected. */
    async toggleChecked(txId, productId) {
      const tx = await this._openTx(txId);
      const item = tx.recordedItems.find((i) => i.productId === productId);
      if (!item) throw new Error('ITEM_NOT_FOUND');
      item.checked = !item.checked;
      await this.transactionRepo.save(tx);
      return tx;
    }

    async checkAll(txId) {
      const tx = await this._openTx(txId);
      tx.recordedItems.forEach((i) => {
        i.checked = true;
      });
      await this.transactionRepo.save(tx);
      return tx;
    }

    /**
     * FR-08 "Override & Recalculate Subtotal". Requires a written reason:
     * an unexplained override is indistinguishable from a cashier quietly
     * discounting a cart, which is exactly what Module 4 exists to catch.
     */
    async applyOverride(txId, note) {
      const tx = await this._openTx(txId);
      if (!tx.hasDiscrepancy) throw new Error('There is no discrepancy to override.');
      if (!note || note.trim().length < 6)
        throw new Error('Describe the discrepancy before overriding.');

      tx.override = {
        applied: true,
        note: note.trim(),
        by: this.auth.user ? this.auth.user.name : 'Unknown',
        at: new Date().toISOString(),
        from: tx.recordedTotal,
        to: tx.recalculatedTotal,
      };
      await this.transactionRepo.save(tx);
      await this.auditRepo.add({
        type: 'override',
        text: `Subtotal recalculated on ${tx.id}`,
        detail: `₱${tx.override.from.toFixed(2)} → ₱${tx.override.to.toFixed(2)} · ${tx.override.note}`,
        actor: tx.override.by,
      });
      return tx;
    }

    /**
     * FR-09 + FR-10: take payment and close the transaction in one step.
     * Cash change is computed here, not in the view, so the receipt and
     * the stored record can never disagree with what was on screen.
     */
    async completePayment(txId, { method = 'cash', tendered = null } = {}) {
      const tx = await this._openTx(txId);
      const reason = tx.blockingReason(method, method === 'cash' ? tendered : null);
      if (reason) {
        const err = new Error(reason);
        err.code = 'PAYMENT_BLOCKED';
        throw err;
      }

      const amount = tx.amountDue;
      const cash = method === 'cash' ? Number(tendered) : null;
      tx.status = 'verified';
      tx.cashier = this.auth.user ? this.auth.user.name : 'Unknown';
      tx.closedAt = new Date().toISOString();
      tx.payment = {
        method,
        amount,
        tendered: cash,
        change: cash === null ? 0 : +(cash - amount).toFixed(2),
      };

      // Module 3 link: an approved sale is the only thing that draws stock down.
      for (const item of tx.recordedItems) {
        if (item.physicalQuantity > 0) await this.productRepo.adjustStock(item.productId, -item.physicalQuantity);
      }

      await this.transactionRepo.save(tx);
      await this.auditRepo.add({
        type: 'payment',
        text: `${tx.id} approved and paid`,
        detail: `₱${amount.toFixed(2)} · ${method === 'cash' ? 'Cash' : 'Card'}`,
        actor: tx.cashier,
      });
      return tx;
    }

    /** FR-10: hold a transaction for administrator review. Never paid. */
    async flag(txId, reason) {
      const tx = await this._openTx(txId);
      if (!reason || reason.trim().length < 6)
        throw new Error('Give a reason so the administrator can review this.');
      tx.status = 'flagged';
      tx.cashier = this.auth.user ? this.auth.user.name : 'Unknown';
      tx.closedAt = new Date().toISOString();
      tx.flagReason = reason.trim();
      await this.transactionRepo.save(tx);
      await this.auditRepo.add({
        type: 'flag',
        text: `${tx.id} flagged for review`,
        detail: tx.flagReason,
        actor: tx.cashier,
      });
      return tx;
    }

    /** Administrator only: send a closed transaction back to the queue. */
    async reopen(txId) {
      this.auth.requireAdmin();
      const tx = await this.retrieve(txId);
      tx.status = 'pending';
      tx.flagReason = null;
      tx.closedAt = null;
      tx.recordedItems.forEach((i) => {
        i.checked = false;
      });
      await this.transactionRepo.save(tx);
      await this.auditRepo.add({
        type: 'cart',
        text: `${tx.id} returned to the verification queue`,
        detail: '',
        actor: this.auth.user.name,
      });
      return tx;
    }

    async _openTx(txId) {
      const tx = await this.retrieve(txId);
      if (tx.isClosed) {
        const err = new Error('This transaction is already closed.');
        err.code = 'TRANSACTION_CLOSED';
        throw err;
      }
      return tx;
    }
  }

  window.SmartCart.CashierService = CashierService;
})();
