/**
 * apiRepositories.js
 * -----------------------------------------------------------------------
 * The SERVER-MODE data layer. Every class here exposes exactly the same
 * methods as its counterpart in repositories.js, so services and views
 * cannot tell which one they are holding. That is the whole point of the
 * repository pattern: swapping localStorage for SQLite is a one-line
 * change in config.js, not a rewrite.
 *
 * Requires the Node + SQLite server in /server to be running.
 * See SQLITE.md for the walkthrough.
 * -----------------------------------------------------------------------
 */
(function () {
  const { Product, Cart, CartItem, Transaction, VerificationItem, Staff, AuditEntry } = window.SmartCart;

  /** Thin fetch wrapper: one place to handle URLs, JSON and error shape. */
  class HttpClient {
    constructor(baseUrl) {
      this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    async request(method, path, body) {
      let response;
      try {
        response = await fetch(this.baseUrl + path, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (networkError) {
        throw new Error(
          `Cannot reach the SmartCart server at ${this.baseUrl}. Start it with "npm start" inside the server folder.`
        );
      }
      const payload = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((payload && payload.error) || `Server returned ${response.status}.`);
      }
      return payload;
    }

    get(path) {
      return this.request('GET', path);
    }
    post(path, body) {
      return this.request('POST', path, body);
    }
    put(path, body) {
      return this.request('PUT', path, body);
    }
    del(path) {
      return this.request('DELETE', path);
    }
  }

  const query = (params) => {
    const usable = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    return usable.length ? '?' + new URLSearchParams(Object.fromEntries(usable)).toString() : '';
  };

  class ApiProductRepository {
    constructor(http) {
      this.http = http;
    }
    async list() {
      return (await this.http.get('/products')).map((p) => new Product(p));
    }
    async findById(id) {
      const row = await this.http.get(`/products/${encodeURIComponent(id)}`);
      return row ? new Product(row) : null;
    }
    async findByBarcode(barcode) {
      const row = await this.http.get(`/products/barcode/${encodeURIComponent(String(barcode).trim())}`);
      return row ? new Product(row) : null;
    }
    async search(q, category) {
      const rows = await this.http.get('/products' + query({ q, category }));
      return rows.map((p) => new Product(p));
    }
    async create(data) {
      return new Product(await this.http.post('/products', data));
    }
    async update(id, data) {
      return new Product(await this.http.put(`/products/${encodeURIComponent(id)}`, data));
    }
    async remove(id) {
      await this.http.del(`/products/${encodeURIComponent(id)}`);
    }
    async adjustStock(id, delta) {
      return new Product(await this.http.post(`/products/${encodeURIComponent(id)}/stock`, { delta }));
    }
    async categories() {
      return this.http.get('/products/categories');
    }
  }

  class ApiCartRepository {
    constructor(http) {
      this.http = http;
    }
    _hydrate(row) {
      if (!row) return null;
      const cart = new Cart(row.id);
      cart.status = row.status;
      cart.createdAt = row.createdAt;
      cart.finalizedAt = row.finalizedAt;
      cart.items = (row.items || []).map((i) => new CartItem(new Product(i.product), i.quantity));
      return cart;
    }
    async create() {
      return this._hydrate(await this.http.post('/carts', {}));
    }
    async findById(id) {
      return this._hydrate(await this.http.get(`/carts/${encodeURIComponent(id)}`));
    }
    async findActive() {
      return this._hydrate(await this.http.get('/carts/active'));
    }
    async save(cart) {
      await this.http.put(`/carts/${encodeURIComponent(cart.id)}`, {
        status: cart.status,
        finalizedAt: cart.finalizedAt,
        items: cart.items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      });
      return cart;
    }
  }

  class ApiTransactionRepository {
    constructor(http) {
      this.http = http;
    }
    _hydrate(row) {
      if (!row) return null;
      const tx = Object.assign(Object.create(Transaction.prototype), row);
      tx.recordedItems = (row.recordedItems || []).map((i) =>
        Object.assign(Object.create(VerificationItem.prototype), i)
      );
      return tx;
    }
    async createFromCart(cart) {
      return this._hydrate(await this.http.post('/transactions', { cartId: cart.id }));
    }
    async findById(id) {
      return this._hydrate(await this.http.get(`/transactions/${encodeURIComponent(id)}`));
    }
    async findByCartId(cartId) {
      return this._hydrate(await this.http.get(`/transactions/by-cart/${encodeURIComponent(cartId)}`));
    }
    async list(filter = {}) {
      const rows = await this.http.get(
        '/transactions' + query({ q: filter.query, status: filter.status, since: filter.since })
      );
      return rows.map((r) => this._hydrate(r));
    }
    async save(tx) {
      await this.http.put(`/transactions/${encodeURIComponent(tx.id)}`, JSON.parse(JSON.stringify(tx)));
      return tx;
    }
  }

  class ApiAuditRepository {
    constructor(http) {
      this.http = http;
    }
    async add(entry) {
      return new AuditEntry(await this.http.post('/audit', entry));
    }
    async list(filter = {}) {
      const rows = await this.http.get('/audit' + query({ actor: filter.actor, q: filter.query }));
      return rows.map((r) => new AuditEntry(r));
    }
  }

  class ApiStaffRepository {
    constructor(http) {
      this.http = http;
    }
    async list() {
      return (await this.http.get('/staff')).map((s) => new Staff(s));
    }
    async findById(id) {
      const row = await this.http.get(`/staff/${encodeURIComponent(id)}`);
      return row ? new Staff(row) : null;
    }
    /**
     * The password is posted once and compared against the bcrypt hash on
     * the server (NFR-06). The hash never reaches the browser.
     */
    async verify(id, password) {
      try {
        const row = await this.http.post('/auth/login', { id, password });
        return row ? new Staff(row) : null;
      } catch (err) {
        if (/401|credential|incorrect/i.test(err.message)) return null;
        throw err;
      }
    }
    /** Admin-only (enforced in AdminService). Posts to the server, which bcrypt-hashes the password. */
    async create(data) {
      return new Staff(await this.http.post('/staff', data));
    }
    async update(id, data) {
      return new Staff(await this.http.put(`/staff/${encodeURIComponent(id)}`, data));
    }
    async remove(id) {
      await this.http.del(`/staff/${encodeURIComponent(id)}`);
      return true;
    }
  }

  Object.assign(window.SmartCart, {
    HttpClient,
    ApiProductRepository,
    ApiCartRepository,
    ApiTransactionRepository,
    ApiAuditRepository,
    ApiStaffRepository,
  });
})();
