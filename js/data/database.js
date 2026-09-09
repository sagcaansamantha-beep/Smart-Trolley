/**
 * database.js
 * -----------------------------------------------------------------------
 * The LOCAL storage engine. Mirrors the SQLite schema in
 * server/db/schema.sql table-for-table, so the same data shapes work
 * whether you run the app standalone (this file) or against the Node +
 * SQLite server (js/data/apiRepositories.js).
 *
 *   products | carts | transactions | audit_log | staff
 *
 * Everything is kept in memory and mirrored into localStorage, so a demo
 * survives a refresh and the app still runs when opened straight from
 * disk with file:// (which is how you will run it on the Arduino test
 * bench, with no server at all).
 * -----------------------------------------------------------------------
 */

class Database {
  static STORAGE_KEY = 'smartcart_os_db_v2';

  constructor() {
    this.tables = { products: [], carts: [], transactions: [], audit_log: [], staff: [] };
    this._nextId = { product: 1, cart: 1, transaction: 1, audit: 1 };
    this._load();
    if (this.tables.products.length === 0) this._seedProducts();
    if (this.tables.staff.length === 0) this._seedStaff();
  }

  // ---- id helpers ------------------------------------------------------
  nextProductId() {
    return `P${String(this._nextId.product++).padStart(4, '0')}`;
  }
  nextCartId() {
    return `CART-${String(this._nextId.cart++).padStart(5, '0')}`;
  }
  nextTransactionId() {
    return `TX-${String(this._nextId.transaction++).padStart(5, '0')}`;
  }
  nextAuditId() {
    return `A${String(this._nextId.audit++).padStart(6, '0')}`;
  }

  // ---- persistence -----------------------------------------------------
  save() {
    try {
      window.localStorage.setItem(
        Database.STORAGE_KEY,
        JSON.stringify({ tables: this.tables, nextId: this._nextId })
      );
    } catch (err) {
      // file:// or private browsing — the app still works, just in memory
      console.warn('SmartCart OS: could not persist database', err);
    }
  }

  _load() {
    try {
      const raw = window.localStorage.getItem(Database.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.tables = Object.assign(this.tables, parsed.tables || {});
      this._nextId = parsed.nextId || this._nextId;
    } catch (err) {
      console.warn('SmartCart OS: saved database unreadable, starting fresh', err);
    }
  }

  resetAll() {
    try {
      window.localStorage.removeItem(Database.STORAGE_KEY);
    } catch (err) {
      /* ignore */
    }
    this.tables = { products: [], carts: [], transactions: [], audit_log: [], staff: [] };
    this._nextId = { product: 1, cart: 1, transaction: 1, audit: 1 };
    this._seedProducts();
    this._seedStaff();
    this.save();
  }

  /**
   * The 15 seed products. These are the SAME rows as server/db/seed.sql —
   * if you add a product here, add it there too (or just run the app
   * against the server and manage the catalog from the Admin screen).
   */
  _seedProducts() {
    const seed = [
      { barcode: '4801234500011', name: 'Sunrise Whole Milk 1L',         category: 'Dairy',         price: 89.5,  stock: 42, icon: '🥛' },
      { barcode: '4801234500028', name: 'Golden Wheat Bread Loaf',       category: 'Bakery',        price: 65.0,  stock: 30, icon: '🍞' },
      { barcode: '4801234500035', name: 'Farm Fresh Eggs (12pc)',        category: 'Dairy',         price: 110.0, stock: 25, icon: '🥚' },
      { barcode: '4801234500042', name: 'Extra Virgin Olive Oil 500ml',  category: 'Pantry',        price: 245.75, stock: 8, icon: '🫒' },
      { barcode: '4801234500059', name: 'Jasmine Rice 5kg',              category: 'Pantry',        price: 320.0, stock: 50, icon: '🍚' },
      { barcode: '4801234500066', name: 'Instant Coffee 200g',           category: 'Beverages',     price: 178.25, stock: 33, icon: '☕' },
      { barcode: '4801234500073', name: 'Bottled Water 1.5L',            category: 'Beverages',     price: 35.0,  stock: 80, icon: '💧' },
      { barcode: '4801234500080', name: 'Dishwashing Liquid 1L',         category: 'Household',     price: 95.5,  stock: 27, icon: '🧴' },
      { barcode: '4801234500097', name: 'Bath Soap Bar 135g',            category: 'Personal Care', price: 42.0,  stock: 60, icon: '🧼' },
      { barcode: '4801234500103', name: 'Instant Noodles (5pc pack)',    category: 'Pantry',        price: 58.0,  stock: 45, icon: '🍜' },
      { barcode: '4801234500110', name: 'Canned Tuna Flakes 155g',       category: 'Pantry',        price: 39.75, stock: 55, icon: '🐟' },
      { barcode: '4801234500127', name: 'Laundry Detergent Powder 1kg',  category: 'Household',     price: 132.0, stock: 6,  icon: '🧺' },
      { barcode: '4801234500134', name: 'Fresh Bananas (1kg)',           category: 'Produce',       price: 68.0,  stock: 40, icon: '🍌' },
      { barcode: '4801234500141', name: 'Toothpaste 150g',               category: 'Personal Care', price: 87.5,  stock: 38, icon: '🪥' },
      { barcode: '4801234500158', name: 'Chocolate Bar 45g',             category: 'Snacks',        price: 32.0,  stock: 0,  icon: '🍫' },
    ];
    this.tables.products = seed.map((p) => ({ id: this.nextProductId(), description: '', ...p }));
  }

  /**
   * Staff accounts. NFR-06 calls for bcrypt-hashed passwords held
   * server-side; in local mode there is no server, so this uses a plain
   * marker string. See server/db/seed.sql for the hashed version and
   * SQLITE.md for how the real check works.
   */
  _seedStaff() {
    this.tables.staff = [
      { id: 'EMP-1042', name: 'Elena Reyes',    role: 'cashier', initials: 'ER', passwordHash: 'plain:1042' },
      { id: 'EMP-2007', name: 'Mark Tolentino', role: 'cashier', initials: 'MT', passwordHash: 'plain:2007' },
      { id: 'ADM-0001', name: 'Alex Rivera',    role: 'admin',   initials: 'AR', passwordHash: 'plain:0001' },
    ];
  }

  all(table) {
    return this.tables[table];
  }
}

window.SmartCart = window.SmartCart || {};
window.SmartCart.Database = Database;
