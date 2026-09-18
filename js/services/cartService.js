/**
 * cartService.js
 * -----------------------------------------------------------------------
 * Module 1: Customer Cart & Self-Scanning (FR-01 .. FR-05).
 *
 * This is the ONLY class allowed to mutate a Cart. The Arduino scanner,
 * the on-screen simulator and any future serial bridge all funnel into
 * scanBarcode(), so every scan path enforces the same rules — including
 * NFR-04 (prices always come from the product record, never from the UI).
 * -----------------------------------------------------------------------
 */
(function () {
  class CartService {
    constructor(productRepo, cartRepo, transactionRepo, auditRepo) {
      this.productRepo = productRepo;
      this.cartRepo = cartRepo;
      this.transactionRepo = transactionRepo;
      this.auditRepo = auditRepo;
    }

    /** FR-01: start a session. Reuses an already-open cart if one exists. */
    async startCart() {
      return this.cartRepo.create();
    }

    async currentCart() {
      const open = await this.cartRepo.findActive();
      return open || this.cartRepo.create();
    }

    async getCart(cartId) {
      return this.cartRepo.findById(cartId);
    }

    /**
     * FR-02: scan a barcode, look it up, add it to the cart.
     * NFR-09: every failure throws a coded error so the UI can show a
     * specific message instead of a generic "something went wrong".
     */
    async scanBarcode(cartId, barcode) {
      const code = String(barcode || '').trim();
      if (!code) throw this._err('EMPTY_BARCODE', 'No barcode was read. Try scanning again.');

      const cart = await this.cartRepo.findById(cartId);
      if (!cart) throw this._err('CART_NOT_FOUND', 'This cart session no longer exists.');
      if (cart.status !== 'active')
        throw this._err('CART_NOT_ACTIVE', 'This cart has already been sent to a cashier.');

      const started = performance.now();
      const product = await this.productRepo.findByBarcode(code);
      const lookupMs = +(performance.now() - started).toFixed(2);

      if (!product) {
        throw this._err(
          'UNRECOGNIZED_BARCODE',
          `Barcode ${code} is not in the product database. Please try again or ask a store attendant.`
        );
      }
      if (!product.isInStock) {
        throw this._err('OUT_OF_STOCK', `${product.name} is out of stock and cannot be added.`);
      }

      const alreadyInCart = cart.items.find((i) => i.product.id === product.id);
      if (alreadyInCart && alreadyInCart.quantity >= product.stock) {
        throw this._err(
          'STOCK_LIMIT',
          `Only ${product.stock} unit(s) of ${product.name} are available.`
        );
      }

      cart.addItem(product, 1); // FR-03
      await this.cartRepo.save(cart); // FR-04: total recalculates via the getter
      return { cart, product, lookupMs };
    }

    /** FR-03: +/- quantity controls. */
    async setQuantity(cartId, productId, quantity) {
      const cart = await this.cartRepo.findById(cartId);
      if (!cart) throw this._err('CART_NOT_FOUND', 'This cart session no longer exists.');
      if (quantity > 0) {
        const product = await this.productRepo.findById(productId);
        if (product && quantity > product.stock)
          throw this._err('STOCK_LIMIT', `Only ${product.stock} unit(s) of ${product.name} are available.`);
      }
      cart.updateQuantity(productId, quantity);
      await this.cartRepo.save(cart);
      return cart;
    }

    async removeItem(cartId, productId) {
      const cart = await this.cartRepo.findById(cartId);
      if (!cart) throw this._err('CART_NOT_FOUND', 'This cart session no longer exists.');
      cart.removeItem(productId);
      await this.cartRepo.save(cart);
      return cart;
    }

    /** FR-05: lock the cart and hand it to the cashier queue. */
    async finalizeCart(cartId) {
      const cart = await this.cartRepo.findById(cartId);
      if (!cart) throw this._err('CART_NOT_FOUND', 'This cart session no longer exists.');
      if (cart.isEmpty) throw this._err('CART_EMPTY', 'Scan at least one item before checking out.');

      cart.finalize();
      await this.cartRepo.save(cart);
      const transaction = await this.transactionRepo.createFromCart(cart);
      await this.auditRepo.add({
        type: 'cart',
        text: `Cart ${cart.id} finalised as ${transaction.id}`,
        detail: `${cart.itemCount} items · ₱${cart.total.toFixed(2)}`,
        actor: 'Cart terminal',
      });
      return { cart, transaction };
    }

    _err(code, message) {
      const err = new Error(message);
      err.code = code;
      return err;
    }
  }

  window.SmartCart.CartService = CartService;
})();
