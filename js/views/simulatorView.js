/**
 * simulatorView.js
 * -----------------------------------------------------------------------
 * DEVELOPMENT TOOL, not a customer screen.
 *
 * The real trolley has no display: the Arduino reads a barcode and calls
 * CartService.scanBarcode(). This page fires that same method by hand so
 * you can produce finalized carts and exercise the cashier and admin
 * screens before the hardware exists.
 *
 * When the Arduino is ready, delete this file and its nav entry. Nothing
 * else in the system references it — the hardware bridge in app.js
 * (SmartCart.scan) already calls the same service.
 * -----------------------------------------------------------------------
 */
(function () {
  const { BaseView } = window.SmartCart;

  class SimulatorView extends BaseView {
    constructor(ctx) {
      super(ctx);
      this.state = { scanner: { tone: 'ready', title: '', message: '' }, lastAdded: null, handedOff: null };
    }

    get title() {
      return 'Cart Simulator';
    }

    async onShow() {
      this.cart = await this.ctx.cartService.currentCart();
    }

    async render() {
      const { ICONS, icon } = window.SmartCart;
      const { esc, money } = window.SmartCart.dom;
      if (this.state.handedOff) return this._renderHandoff();

      this.cart = await this.ctx.cartService.currentCart();
      const cart = this.cart;
      const products = await this.ctx.productRepo.list();
      const { tone, title, message } = this.state.scanner;
      const toneClass = tone === 'error' ? 'err' : tone === 'hit' ? 'hit' : '';
      const ringIcon = tone === 'error' ? ICONS.alert : tone === 'hit' ? ICONS.check : ICONS.scan;

      return `
    <div class="page-head">
      <div><h2>Cart Simulator</h2><p>Stands in for the Arduino trolley until the hardware is wired up. Every scan here runs the same code path the scanner will.</p></div>
      <div class="actions"><span class="pill pill-warning">${ICONS.alert} Testing tool</span></div>
    </div>

    <div class="scanner-box ${toneClass}" style="margin-bottom:20px;">
      <div class="scanner-ring">${ringIcon}</div>
      <div style="flex:1;min-width:0;">
        <h4>${title ? esc(title) : 'Waiting for a scan'}</h4>
        <p>${message ? esc(message) : 'Type a barcode below and press Enter, or tap a product tile. A USB/HID scanner plugged into this machine also works — it types the digits and sends Enter.'}</p>
      </div>
    </div>

    <div class="verify-grid">
      <div class="card">
        <div class="card-head">
          <h3>${ICONS.cart} Cart ${esc(cart.id)}</h3>
          <span class="pill pill-neutral">${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}</span>
        </div>
        <div style="padding:16px 22px 0;">
          <div class="input-wrap">${icon('scan', 'leading')}
            <input class="input has-icon mono" data-fkey="sim-scan" data-scan="1" placeholder="Barcode, e.g. 4801234500011">
          </div>
        </div>
        ${
          cart.items.length
            ? cart.items
                .map(
                  (item) => `
          <div class="tr-line ${this.state.lastAdded === item.product.id ? 'justadded' : ''}">
            <div class="item-thumb">${item.product.icon}</div>
            <div class="meta">
              <div class="name">${esc(item.product.name)}</div>
              <div class="sub">${esc(item.product.barcode)} · ${money(item.product.price)}</div>
            </div>
            <div class="stepper">
              <button data-act="sim-qty" data-id="${esc(item.product.id)}" data-n="${item.quantity - 1}">–</button>
              <span class="qty">${item.quantity}</span>
              <button data-act="sim-qty" data-id="${esc(item.product.id)}" data-n="${item.quantity + 1}">+</button>
            </div>
            <div class="line-amt mono">${money(item.subtotal)}</div>
            <button class="kill" data-act="sim-remove" data-id="${esc(item.product.id)}" aria-label="Remove">${ICONS.trash}</button>
          </div>`
                )
                .join('')
            : window.SmartCart.dom.emptyState('scan', 'Nothing scanned yet', 'Scan a barcode to start building a cart.')
        }
        <div class="cart-total-row"><span class="label">Cart total</span><span class="amount mono">${money(cart.total)}</span></div>
        <div class="modal-foot" style="justify-content:space-between;">
          <button class="btn btn-outline" data-act="sim-new">${ICONS.refresh} Clear cart</button>
          <button class="btn btn-primary" data-act="sim-finalize" ${cart.isEmpty ? 'disabled' : ''}>${ICONS.check} Send to cashier queue</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>${ICONS.box} Tap to scan</h3></div>
        <div class="tile-grid">
          ${products
            .map(
              (p) => `
            <button class="tile" data-act="sim-scan-tile" data-code="${esc(p.barcode)}" ${p.isInStock ? '' : 'disabled'}>
              <div class="em">${p.icon}</div>
              <div class="nm">${esc(p.name)}</div>
              <div class="pr">${p.isInStock ? money(p.price) : 'Out of stock'}</div>
            </button>`
            )
            .join('')}
        </div>
      </div>
    </div>`;
    }

    _renderHandoff() {
      const { ICONS } = window.SmartCart;
      const { esc, money } = window.SmartCart.dom;
      const tx = this.state.handedOff;
      return `
    <div class="page-head">
      <div><h2>Cart Simulator</h2><p>Cart handed over to the checkout queue.</p></div>
    </div>
    <div class="banner banner-ok">${ICONS.check}<div>
      <h4>${esc(tx.id)} is now in the verification queue</h4>
      <p>${tx.itemCount} items · ${money(tx.recordedTotal)} · cart session ${esc(tx.cartId)}</p>
    </div></div>
    <div style="display:flex;gap:12px;margin-top:18px;flex-wrap:wrap;">
      <button class="btn btn-primary" data-act="go" data-page="queue">${ICONS.receipt} Open the queue</button>
      <button class="btn btn-outline" data-act="sim-new">${ICONS.refresh} Build another cart</button>
    </div>`;
    }

    async onAction(act, data) {
      switch (act) {
        case 'sim-scan-tile':
          await this.scan(data.code);
          return true;
        case 'sim-qty':
          await this.guard(() =>
            this.ctx.cartService.setQuantity(this.cart.id, data.id, parseInt(data.n, 10))
          );
          await this.ctx.app.refresh();
          return true;
        case 'sim-remove':
          await this.ctx.cartService.removeItem(this.cart.id, data.id);
          await this.ctx.app.refresh();
          return true;
        case 'sim-new':
          await this.ctx.cartService.startCart();
          this.state = { scanner: { tone: 'ready', title: '', message: '' }, lastAdded: null, handedOff: null };
          await this.ctx.app.refresh();
          return true;
        case 'sim-finalize': {
          const result = await this.guard(() => this.ctx.cartService.finalizeCart(this.cart.id));
          if (result) this.state.handedOff = result.transaction;
          await this.ctx.app.refresh();
          return true;
        }
        default:
          return false;
      }
    }

    async onEnter(target) {
      if (!target.dataset.scan) return false;
      const code = target.value;
      target.value = '';
      await this.scan(code);
      return true;
    }

    /** Single entry point for a scan — the Arduino bridge calls this too. */
    async scan(barcode) {
      try {
        const { product, lookupMs } = await this.ctx.cartService.scanBarcode(this.cart.id, barcode);
        this.state.scanner = {
          tone: 'hit',
          title: product.name,
          message: `${window.SmartCart.dom.money(product.price)} added to the cart · matched in ${lookupMs} ms`,
        };
        this.state.lastAdded = product.id;
      } catch (err) {
        // NFR-09: the specific reason, not a generic failure
        this.state.scanner = {
          tone: 'error',
          title: err.code === 'UNRECOGNIZED_BARCODE' ? 'Barcode not recognised' : 'Scan rejected',
          message: err.message,
        };
        this.state.lastAdded = null;
      }
      await this.ctx.app.refresh();
    }
  }

  window.SmartCart.SimulatorView = SimulatorView;
})();
