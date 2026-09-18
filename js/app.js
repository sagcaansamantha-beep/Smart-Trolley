/**
 * app.js
 * -----------------------------------------------------------------------
 * Composition root + AppController.
 *
 * Nothing here contains business logic. It does three jobs:
 *   1. builds the object graph once  (Database -> Repositories ->
 *      Services -> Views), choosing local or API repositories from
 *      config.js;
 *   2. renders the shell and the active view, preserving focus and
 *      scroll so typing in a search box never jumps;
 *   3. routes every [data-act] click, [data-bind] input and Enter key to
 *      the active view.
 *
 * Where to fix things:
 *   totals / discrepancy maths        -> js/models.js
 *   saving & loading                  -> js/data/*.js
 *   a business rule                   -> js/services/*.js
 *   something looks or behaves wrong  -> js/views/*.js
 *   colours, spacing, fonts           -> css/styles.css
 * -----------------------------------------------------------------------
 */
(function () {
  class AppController {
    constructor(ctx, views, shell) {
      this.ctx = ctx;
      this.views = views;
      this.shell = shell;
      this.page = 'login';
      this.root = document.getElementById('root');
      this.activeTxId = null;
    }

    get activeView() {
      return this.views[this.page];
    }

    async start() {
      this._bindGlobalEvents();
      await this.refresh();
      // Refresh time-sensitive screens (the "waiting 6 min" pills).
      setInterval(() => {
        if (this.page === 'queue' || this.page === 'transactions') this.refresh();
      }, 30000);
    }

    async onSignedIn(staff) {
      await this.go(staff.isAdmin ? 'dashboard' : 'queue');
    }

    async signOut() {
      await this.ctx.auth.signOut();
      this.page = 'login';
      this.activeTxId = null;
      await this.refresh(true);
    }

    async go(page) {
      if (!this.views[page]) return;
      this.page = page;
      const view = this.activeView;
      view.modal = null;
      if (view.onShow) await view.onShow();
      await this.refresh(true);
    }

    async openTransaction(txId) {
      this.activeTxId = txId;
      await this.views.verification.open(txId);
      this.page = 'verification';
      await this.refresh(true);
    }

    /**
     * Re-render everything. Cheap enough at this scale, and it removes a
     * whole class of bug where one part of the screen is stale.
     * @param {boolean} toTop scroll the content area back to the top
     */
    async refresh(toTop = false) {
      const active = document.activeElement;
      const focusKey = active && active.dataset ? active.dataset.fkey : null;
      const caret = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
      const scroller = document.querySelector('.content');
      const scrollTop = scroller ? scroller.scrollTop : 0;

      const user = this.ctx.auth.user;
      if (!user) this.page = 'login';

      const view = this.activeView;
      const content = await view.render();
      const modal = view.renderModal ? await view.renderModal() : '';

      if (!user) {
        this.root.innerHTML = content + modal;
      } else {
        const badges = await this._badges();
        this.root.innerHTML = this.shell.render(user, this.page, view.title, content, badges) + modal;
      }

      if (focusKey) {
        const node = document.querySelector(`[data-fkey="${focusKey}"]`);
        if (node) {
          node.focus();
          if (caret !== null) {
            try {
              node.setSelectionRange(caret, caret);
            } catch (e) {
              /* not a text input */
            }
          }
        }
      }
      const newScroller = document.querySelector('.content');
      if (newScroller) newScroller.scrollTop = toTop ? 0 : scrollTop;
    }

    async _badges() {
      const all = await this.ctx.transactionRepo.list({});
      return {
        pending: all.filter((t) => t.status === 'pending').length,
        flagged: all.filter((t) => t.status === 'flagged').length,
        activeTxId: this.page === 'verification' ? this.activeTxId : null,
      };
    }

    // ---- global event routing -------------------------------------------
    _bindGlobalEvents() {
      document.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-act]');
        if (!target) return;
        const act = target.dataset.act;

        if (act === 'overlay' && event.target !== target) return;
        if (act === 'overlay' || act === 'close-modal') {
          await this.activeView.closeModal();
          return;
        }
        if (act === 'go') {
          await this.go(target.dataset.page);
          return;
        }
        if (act === 'sign-out') {
          await this.signOut();
          return;
        }
        const handled = await this.activeView.onAction(act, { ...target.dataset }, event);
        if (!handled) console.debug('Unhandled action:', act);
      });

      // Two-way binding for search boxes, selects and amount fields.
      const bind = async (event) => {
        const key = event.target.dataset && event.target.dataset.bind;
        if (!key) return;
        this.activeView.state[key] = event.target.value;
        await this.refresh();
      };
      document.addEventListener('input', bind);
      document.addEventListener('change', (event) => {
        if (event.target.tagName === 'SELECT') bind(event);
      });

      document.addEventListener('keydown', async (event) => {
        if (event.key === 'Escape' && this.activeView.modal) {
          await this.activeView.closeModal();
          return;
        }
        if (event.key !== 'Enter') return;
        // A barcode scanner in keyboard-wedge mode types the digits then
        // sends Enter — exactly this path.
        const handled = await this.activeView.onEnter(event.target);
        if (handled) event.preventDefault();
      });
    }
  }

  // =======================================================================
  // Composition root
  // =======================================================================
  function bootstrap() {
    const SC = window.SmartCart;
    const cfg = SC.CONFIG;
    const useApi = cfg.backend === 'api';

    // ---- data layer: the ONLY place local vs server is decided ----------
    let db = null;
    let productRepo;
    let cartRepo;
    let transactionRepo;
    let auditRepo;
    let staffRepo;

    if (useApi) {
      const http = new SC.HttpClient(cfg.apiBaseUrl);
      productRepo = new SC.ApiProductRepository(http);
      cartRepo = new SC.ApiCartRepository(http);
      transactionRepo = new SC.ApiTransactionRepository(http);
      auditRepo = new SC.ApiAuditRepository(http);
      staffRepo = new SC.ApiStaffRepository(http);
    } else {
      db = new SC.Database();
      productRepo = new SC.ProductRepository(db);
      cartRepo = new SC.CartRepository(db);
      transactionRepo = new SC.TransactionRepository(db);
      auditRepo = new SC.AuditRepository(db);
      staffRepo = new SC.StaffRepository(db);
    }

    // ---- services --------------------------------------------------------
    const auth = new SC.AuthService(staffRepo, auditRepo);
    const cartService = new SC.CartService(productRepo, cartRepo, transactionRepo, auditRepo);
    const cashierService = new SC.CashierService(transactionRepo, productRepo, auditRepo, auth);
    const adminService = new SC.AdminService(productRepo, transactionRepo, auditRepo, auth, staffRepo);
    const auditService = new SC.AuditService(auditRepo, auth);

    // ---- ui --------------------------------------------------------------
    const toast = new SC.ToastManager(document.getElementById('toast'));
    const ctx = {
      db, productRepo, cartRepo, transactionRepo, auditRepo, staffRepo,
      auth, cartService, cashierService, adminService, auditService, toast,
      app: null,
    };

    const views = {
      login: new SC.LoginView(ctx),
      queue: new SC.QueueView(ctx),
      verification: new SC.VerificationView(ctx),
      transactions: new SC.TransactionsView(ctx),
      products: new SC.ProductsView(ctx),
      inventory: new SC.InventoryView(ctx),
      audit: new SC.ActivityLogView(ctx),
      settings: new SC.SettingsView(ctx),
      dashboard: new SC.DashboardView(ctx),
      simulator: new SC.SimulatorView(ctx),
    };

    const app = new AppController(ctx, views, new SC.ShellView(ctx));
    ctx.app = app;
    app.start();

    /**
     * HARDWARE BRIDGE — the Arduino plugs in here.
     *
     * A keyboard-wedge (USB/HID) scanner needs no code at all: focus the
     * scan field and the device types the digits and presses Enter.
     *
     * For a serial Arduino, read lines from the port and call:
     *     SmartCart.scan('4801234500011');
     * from your Web Serial read loop. It runs the same CartService call
     * the simulator does, so stock checks and unknown-barcode errors
     * behave identically.
     */
    SC.scan = async (barcode) => {
      const cart = await cartService.currentCart();
      try {
        const result = await cartService.scanBarcode(cart.id, barcode);
        toast.success(`${result.product.name} added`);
        await app.refresh();
        return result;
      } catch (err) {
        toast.error(err.message);
        await app.refresh();
        throw err;
      }
    };

    // Exposed for debugging and for the class demo.
    SC.app = app;
    SC.context = ctx;
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
  window.SmartCart = window.SmartCart || {};
  window.SmartCart.AppController = AppController;
})();
