/**
 * baseView.js
 * -----------------------------------------------------------------------
 * The contract every screen implements. The AppController never reaches
 * into a view's internals — it only calls these four things:
 *
 *   render()            -> HTML string for the content area
 *   renderModal()       -> HTML string for an overlay, or '' for none
 *   onAction(act, data) -> handle a [data-act] click; return true if handled
 *   onEnter(target)     -> handle the Enter key inside one of its inputs
 *
 * Adding a new screen means writing one subclass and registering it in
 * app.js. Nothing else in the system has to change.
 * -----------------------------------------------------------------------
 */
(function () {
  class BaseView {
    /** @param {object} ctx shared services + app handle, built in app.js */
    constructor(ctx) {
      this.ctx = ctx;
      this.state = {}; // per-view UI state: search text, filters, open modal
      this.modal = null;
    }

    /** Title shown in the top bar breadcrumb. */
    get title() {
      return '';
    }

    async render() {
      return '';
    }

    async renderModal() {
      return '';
    }

    // eslint-disable-next-line no-unused-vars
    async onAction(act, data) {
      return false;
    }

    // eslint-disable-next-line no-unused-vars
    async onEnter(target) {
      return false;
    }

    /** Called every time the view becomes visible. */
    async onShow() {}

    /** Merge UI state and re-render. */
    async setState(patch) {
      Object.assign(this.state, patch);
      await this.ctx.app.refresh();
    }

    async closeModal() {
      this.modal = null;
      await this.ctx.app.refresh();
    }

    // ---- shared conveniences ------------------------------------------
    get toast() {
      return this.ctx.toast;
    }

    get user() {
      return this.ctx.auth.user;
    }

    /** Runs a service call and turns any thrown error into a toast. */
    async guard(fn, successMessage) {
      try {
        const result = await fn();
        if (successMessage) this.toast.success(successMessage);
        return result;
      } catch (err) {
        this.toast.error(err.message || 'Something went wrong.');
        return null;
      }
    }

    modalShell(title, body, footer) {
      const { ICONS } = window.SmartCart;
      return `<div class="modal-overlay" data-act="overlay">
        <div class="modal">
          <div class="modal-head"><h3>${title}</h3><button class="icon-btn" data-act="close-modal">${ICONS.x}</button></div>
          <div class="modal-body">${body}</div>
          <div class="modal-foot">${footer}</div>
        </div>
      </div>`;
    }

    field(id) {
      const node = document.getElementById(id);
      return node ? node.value : '';
    }
  }

  window.SmartCart.BaseView = BaseView;
})();
