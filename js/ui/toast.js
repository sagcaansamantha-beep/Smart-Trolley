/**
 * toast.js — on-screen success/error feedback (NFR-09).
 * Uses the single #toast element from index.html, matching the
 * Smart Trolly build's toast styling.
 */
(function () {
  class ToastManager {
    constructor(node) {
      this.node = node;
      this.timer = null;
    }

    show(message, type = 'success') {
      if (!this.node) return;
      const { ICONS } = window.SmartCart;
      const { esc } = window.SmartCart.dom;
      this.node.innerHTML = (type === 'error' ? ICONS.alert : ICONS.check) + `<span>${esc(message)}</span>`;
      this.node.classList.add('show');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.node.classList.remove('show'), type === 'error' ? 4000 : 2600);
    }

    success(message) {
      this.show(message, 'success');
    }

    error(message) {
      this.show(message, 'error');
    }
  }

  window.SmartCart.ToastManager = ToastManager;
})();
