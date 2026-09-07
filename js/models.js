/**
 * models.js
 * -----------------------------------------------------------------------
 * Plain domain classes. NO DOM code, NO storage code — only data and the
 * business rules that apply to that data (FR-03, FR-04, FR-08, NFR-04).
 *
 * Keeping models "dumb but correct" means the UI layer and the storage
 * layer can change independently without breaking a business rule.
 * If a TOTAL or a DISCREPANCY is ever wrong, the bug is in this file.
 * -----------------------------------------------------------------------
 */

/** A catalog item, as managed by the Administrator (FR-12). */
class Product {
  constructor({ id, name, description = '', barcode, category = 'General', price, stock = 0, icon = '🛒' }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.barcode = String(barcode);
    this.category = category;
    this.price = Number(price);
    this.stock = Number(stock);
    this.icon = icon;
  }

  get isInStock() {
    return this.stock > 0;
  }

  /** Used by the stock pill in the product/inventory tables. */
  get stockLevel() {
    if (this.stock === 0) return 'out';
    if (this.stock < 10) return 'low';
    return 'ok';
  }

  clone() {
    return new Product({ ...this });
  }
}

/** One line of a Cart: a Product plus the quantity the scanner recorded. */
class CartItem {
  constructor(product, quantity = 1) {
    this.product = product;
    this.quantity = quantity;
  }

  /** NFR-04: totals always derive from the current product price. */
  get subtotal() {
    return +(this.product.price * this.quantity).toFixed(2);
  }
}

/**
 * A customer's active shopping session (Module 1).
 * Lifecycle: active -> finalized -> (becomes a Transaction for the cashier)
 */
class Cart {
  constructor(id) {
    this.id = id;
    this.status = 'active'; // active | finalized
    this.items = [];
    this.createdAt = new Date().toISOString();
    this.finalizedAt = null;
  }

  /** FR-02/FR-03: add a scanned product, or bump quantity if already present. */
  addItem(product, quantity = 1) {
    const existing = this.items.find((i) => i.product.id === product.id);
    if (existing) existing.quantity += quantity;
    else this.items.push(new CartItem(product, quantity));
  }

  removeItem(productId) {
    this.items = this.items.filter((i) => i.product.id !== productId);
  }

  updateQuantity(productId, quantity) {
    const item = this.items.find((i) => i.product.id === productId);
    if (!item) return;
    if (quantity <= 0) this.removeItem(productId);
    else item.quantity = quantity;
  }

  /** FR-04: running total, recalculated on every mutation. */
  get total() {
    return +this.items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2);
  }

  get itemCount() {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  get isEmpty() {
    return this.items.length === 0;
  }

  /** FR-05: lock the cart so it can be handed to a cashier. */
  finalize() {
    this.status = 'finalized';
    this.finalizedAt = new Date().toISOString();
  }
}

/** One row of the cashier's physical inspection checklist (Module 2). */
class VerificationItem {
  constructor({ productId, name, barcode, icon, unitPrice, cartQuantity }) {
    this.productId = productId;
    this.name = name;
    this.barcode = barcode;
    this.icon = icon || '🛒';
    this.unitPrice = Number(unitPrice);
    this.cartQuantity = cartQuantity; // what the cart scanner recorded
    this.physicalQuantity = cartQuantity; // what the cashier actually counts
    this.checked = false; // cashier has physically inspected this line
  }

  /** FR-08: a mismatch is any difference between recorded and physical qty. */
  get status() {
    return this.physicalQuantity === this.cartQuantity ? 'match' : 'mismatch';
  }

  get recordedSubtotal() {
    return +(this.unitPrice * this.cartQuantity).toFixed(2);
  }

  get subtotal() {
    return +(this.unitPrice * this.physicalQuantity).toFixed(2);
  }
}

/**
 * A finalized cart once it reaches the cashier terminal (Modules 2 + 4).
 * This is the record that is verified, paid, audited and stored.
 *
 * status: pending  — waiting in the queue / being verified
 *         verified — inspected, paid and approved
 *         flagged  — held for administrator review, never paid
 */
class Transaction {
  constructor(id, cart) {
    this.id = id;
    this.cartId = cart.id;
    this.createdAt = cart.finalizedAt || new Date().toISOString();
    this.closedAt = null;

    // Snapshot of what the cart recorded — never mutated after finalize.
    this.recordedItems = cart.items.map(
      (i) =>
        new VerificationItem({
          productId: i.product.id,
          name: i.product.name,
          barcode: i.product.barcode,
          icon: i.product.icon,
          unitPrice: i.product.price,
          cartQuantity: i.quantity,
        })
    );
    this.originalTotal = cart.total;

    this.status = 'pending';
    this.cashier = null;
    this.payment = null; // { method, amount, tendered, change }
    this.override = null; // { applied, note, by, at, from, to }
    this.flagReason = null;
  }

  get itemCount() {
    return this.recordedItems.reduce((s, i) => s + i.cartQuantity, 0);
  }

  get checkedCount() {
    return this.recordedItems.filter((i) => i.checked).length;
  }

  get fullyInspected() {
    return this.recordedItems.length > 0 && this.checkedCount === this.recordedItems.length;
  }

  get discrepancies() {
    return this.recordedItems.filter((i) => i.status === 'mismatch');
  }

  /** FR-08: does the cashier's physical count disagree anywhere? */
  get hasDiscrepancy() {
    return this.discrepancies.length > 0;
  }

  get recordedTotal() {
    return +this.recordedItems.reduce((s, i) => s + i.recordedSubtotal, 0).toFixed(2);
  }

  /** FR-08: total recomputed from the physically verified quantities. */
  get recalculatedTotal() {
    return +this.recordedItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2);
  }

  /**
   * What the customer actually pays. Only an explicit, noted override
   * lets the verified total replace the recorded one — a cashier can
   * never quietly discount a cart.
   */
  get amountDue() {
    return this.override && this.override.applied ? this.recalculatedTotal : this.recordedTotal;
  }

  get isClosed() {
    return this.status !== 'pending';
  }

  /**
   * FR-11 / NFR-07: the single source of truth for "can this be paid?".
   * Returns null when payment may proceed, otherwise the reason why not,
   * phrased for the cashier to read on screen.
   */
  blockingReason(payMethod, tendered) {
    if (!this.recordedItems.length) return 'This transaction has no items.';
    if (!this.fullyInspected) {
      const left = this.recordedItems.length - this.checkedCount;
      return `${left} item${left === 1 ? '' : 's'} still need to be physically checked.`;
    }
    if (this.hasDiscrepancy && !(this.override && this.override.applied)) {
      return 'Resolve the quantity discrepancy, or use Override & Recalculate to charge the verified amount.';
    }
    if (payMethod === 'cash') {
      const amount = Number(tendered);
      if (tendered === '' || tendered === null || tendered === undefined || Number.isNaN(amount)) {
        return 'Enter how much cash the customer handed over.';
      }
      if (amount < this.amountDue - 0.001) return 'The cash received is less than the amount due.';
    }
    return null;
  }
}

/** A staff account (NFR-05 role-based access; NFR-06 hashed passwords). */
class Staff {
  constructor({ id, name, role, initials, passwordHash }) {
    this.id = id;
    this.name = name;
    this.role = role; // 'cashier' | 'admin'
    this.initials = initials;
    this.passwordHash = passwordHash;
  }

  get isAdmin() {
    return this.role === 'admin';
  }

  get roleLabel() {
    return this.isAdmin ? 'System Admin' : 'Cashier';
  }
}

/** One line of the activity log (Module 4: Transaction Auditing). */
class AuditEntry {
  constructor({ id, timestamp, type, text, detail = '', actor }) {
    this.id = id;
    this.timestamp = timestamp || new Date().toISOString();
    this.type = type; // auth | cart | payment | override | flag | stock | product | system
    this.text = text;
    this.detail = detail;
    this.actor = actor;
  }
}

window.SmartCart = window.SmartCart || {};
Object.assign(window.SmartCart, { Product, CartItem, Cart, VerificationItem, Transaction, Staff, AuditEntry });
