/**
 * server.js
 * ---------------------------------------------------------------------------
 * Node + Express + SQLite API for SmartCart OS.
 *
 *   npm install      install express, better-sqlite3, bcryptjs
 *   npm run seed     create smartcart.db from db/schema.sql + db/seed.sql
 *   npm start        serve the API and the front-end on :3000
 *
 * Then open  http://localhost:3000/index-sqlite.html
 *
 * Every route here does one thing: translate JSON to SQL and back. All the
 * business rules stay in the browser's service layer, so this file has no
 * opinion about discrepancies, overrides or payments — it just stores what
 * it is told. If you move rules to the server later, put them here and have
 * the front-end call these endpoints instead.
 * ---------------------------------------------------------------------------
 */
const path = require('node:path');
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'smartcart.db');
const PORT = process.env.PORT || 3000;

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const app = express();
app.use(express.json());

// The front-end is served from this same origin, so no CORS is needed in
// normal use. This header only helps if you open the HTML from elsewhere.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------------------------------------------------------------------------
// row <-> json mapping (snake_case in SQLite, camelCase in JavaScript)
// ---------------------------------------------------------------------------
const toProduct = (r) =>
  r && {
    id: r.id, barcode: r.barcode, name: r.name, description: r.description,
    category: r.category, price: r.price, stock: r.stock, icon: r.icon,
  };

const toCart = (r) =>
  r && {
    id: r.id,
    status: r.status,
    createdAt: r.created_at,
    finalizedAt: r.finalized_at,
    items: db
      .prepare(
        `SELECT ci.quantity, p.* FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
         WHERE ci.cart_id = ?`
      )
      .all(r.id)
      .map((row) => ({ quantity: row.quantity, product: toProduct(row) })),
  };

const toTransaction = (r) =>
  r && {
    id: r.id,
    cartId: r.cart_id,
    status: r.status,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    cashier: r.cashier,
    originalTotal: r.original_total,
    payment: r.payment_method
      ? {
          method: r.payment_method,
          amount: r.payment_amount,
          tendered: r.payment_tendered,
          change: r.payment_change,
        }
      : null,
    override: r.override_applied
      ? {
          applied: true, note: r.override_note, by: r.override_by,
          at: r.override_at, from: r.override_from, to: r.override_to,
        }
      : null,
    flagReason: r.flag_reason,
    recordedItems: db
      .prepare('SELECT * FROM transaction_items WHERE transaction_id = ?')
      .all(r.id)
      .map((i) => ({
        productId: i.product_id, name: i.name, barcode: i.barcode, icon: i.icon,
        unitPrice: i.unit_price, cartQuantity: i.cart_quantity,
        physicalQuantity: i.physical_quantity, checked: !!i.checked,
      })),
  };

/** Next id in a series, e.g. nextId('products', 'P', 4) -> 'P0016'. */
function nextId(table, prefix, width) {
  const row = db.prepare(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1`).get();
  const n = row ? parseInt(String(row.id).replace(/\D/g, ''), 10) + 1 : 1;
  return prefix + String(n).padStart(width, '0');
}

const wrap = (handler) => (req, res) => {
  try {
    handler(req, res);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------
app.get('/api/products/categories', wrap((req, res) => {
  res.json(db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all().map((r) => r.category));
}));

app.get('/api/products/barcode/:code', wrap((req, res) => {
  // The single hottest query in the system — one indexed lookup per scan.
  const row = db.prepare('SELECT * FROM products WHERE barcode = ?').get(req.params.code.trim());
  res.json(toProduct(row) || null);
}));

app.get('/api/products', wrap((req, res) => {
  const { q, category } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (LOWER(name) LIKE ? OR barcode LIKE ? OR LOWER(id) LIKE ? OR LOWER(category) LIKE ?)';
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like, like, like);
  }
  if (category && category !== 'All') {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY id';
  res.json(db.prepare(sql).all(...params).map(toProduct));
}));

app.get('/api/products/:id', wrap((req, res) => {
  res.json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)) || null);
}));

app.post('/api/products', wrap((req, res) => {
  const p = req.body;
  const id = nextId('products', 'P', 4);
  db.prepare(
    `INSERT INTO products (id, barcode, name, description, category, price, stock, icon)
     VALUES (@id, @barcode, @name, @description, @category, @price, @stock, @icon)`
  ).run({
    id, barcode: String(p.barcode), name: p.name, description: p.description || '',
    category: p.category || 'General', price: Number(p.price), stock: Number(p.stock), icon: p.icon || '🛒',
  });
  res.json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)));
}));

app.put('/api/products/:id', wrap((req, res) => {
  const p = req.body;
  db.prepare(
    `UPDATE products SET barcode=@barcode, name=@name, category=@category,
     price=@price, stock=@stock, icon=@icon, description=@description WHERE id=@id`
  ).run({
    id: req.params.id, barcode: String(p.barcode), name: p.name,
    category: p.category || 'General', price: Number(p.price), stock: Number(p.stock),
    icon: p.icon || '🛒', description: p.description || '',
  });
  res.json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));
}));

app.delete('/api/products/:id', wrap((req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

app.post('/api/products/:id/stock', wrap((req, res) => {
  // MAX(0, ...) keeps the CHECK (stock >= 0) constraint from ever firing.
  db.prepare('UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?').run(
    Number(req.body.delta),
    req.params.id
  );
  res.json(toProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));
}));

// ---------------------------------------------------------------------------
// carts
// ---------------------------------------------------------------------------
app.get('/api/carts/active', wrap((req, res) => {
  const row = db.prepare("SELECT * FROM carts WHERE status = 'active' ORDER BY created_at DESC LIMIT 1").get();
  res.json(toCart(row) || null);
}));

app.post('/api/carts', wrap((req, res) => {
  const id = nextId('carts', 'CART-', 5);
  db.prepare("INSERT INTO carts (id, status, created_at) VALUES (?, 'active', datetime('now'))").run(id);
  res.json(toCart(db.prepare('SELECT * FROM carts WHERE id = ?').get(id)));
}));

app.get('/api/carts/:id', wrap((req, res) => {
  res.json(toCart(db.prepare('SELECT * FROM carts WHERE id = ?').get(req.params.id)) || null);
}));

app.put('/api/carts/:id', wrap((req, res) => {
  const { status, finalizedAt, items } = req.body;
  const save = db.transaction(() => {
    db.prepare('UPDATE carts SET status = ?, finalized_at = ? WHERE id = ?').run(
      status, finalizedAt || null, req.params.id
    );
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(req.params.id);
    const insert = db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)');
    (items || []).forEach((i) => insert.run(req.params.id, i.productId, i.quantity));
  });
  save();
  res.json(toCart(db.prepare('SELECT * FROM carts WHERE id = ?').get(req.params.id)));
}));

// ---------------------------------------------------------------------------
// transactions
// ---------------------------------------------------------------------------
app.get('/api/transactions/by-cart/:cartId', wrap((req, res) => {
  res.json(toTransaction(db.prepare('SELECT * FROM transactions WHERE cart_id = ?').get(req.params.cartId)) || null);
}));

app.get('/api/transactions', wrap((req, res) => {
  const { q, status, since } = req.query;
  let sql = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (LOWER(id) LIKE ? OR LOWER(cart_id) LIKE ? OR LOWER(IFNULL(cashier,"")) LIKE ?)';
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like, like);
  }
  if (status && status !== 'all' && status !== 'discrepancy') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (status === 'discrepancy') {
    sql += ` AND id IN (SELECT transaction_id FROM transaction_items
                        WHERE physical_quantity <> cart_quantity)`;
  }
  if (since) {
    sql += ' AND created_at >= ?';
    params.push(since);
  }
  sql += ' ORDER BY created_at DESC';
  res.json(db.prepare(sql).all(...params).map(toTransaction));
}));

app.get('/api/transactions/:id', wrap((req, res) => {
  res.json(toTransaction(db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id)) || null);
}));

app.post('/api/transactions', wrap((req, res) => {
  const cart = toCart(db.prepare('SELECT * FROM carts WHERE id = ?').get(req.body.cartId));
  if (!cart) throw new Error('Cart not found');
  const id = nextId('transactions', 'TX-', 5);
  const total = cart.items.reduce((s, i) => s + i.product.price * i.quantity, 0);

  const create = db.transaction(() => {
    db.prepare(
      `INSERT INTO transactions (id, cart_id, status, created_at, original_total)
       VALUES (?, ?, 'pending', ?, ?)`
    ).run(id, cart.id, cart.finalizedAt || new Date().toISOString(), total);
    const insert = db.prepare(
      `INSERT INTO transaction_items
        (transaction_id, product_id, name, barcode, icon, unit_price, cart_quantity, physical_quantity, checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    );
    cart.items.forEach((i) =>
      insert.run(id, i.product.id, i.product.name, i.product.barcode, i.product.icon, i.product.price, i.quantity, i.quantity)
    );
  });
  create();
  res.json(toTransaction(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)));
}));

app.put('/api/transactions/:id', wrap((req, res) => {
  const t = req.body;
  const p = t.payment || {};
  const o = t.override || {};
  const save = db.transaction(() => {
    db.prepare(
      `UPDATE transactions SET
         status=@status, closed_at=@closedAt, cashier=@cashier,
         payment_method=@method, payment_amount=@amount,
         payment_tendered=@tendered, payment_change=@change,
         override_applied=@applied, override_note=@note, override_by=@by,
         override_at=@at, override_from=@from, override_to=@to,
         flag_reason=@flagReason
       WHERE id=@id`
    ).run({
      id: req.params.id, status: t.status, closedAt: t.closedAt || null, cashier: t.cashier || null,
      method: p.method || null, amount: p.amount ?? null, tendered: p.tendered ?? null, change: p.change ?? null,
      applied: o.applied ? 1 : 0, note: o.note || null, by: o.by || null,
      at: o.at || null, from: o.from ?? null, to: o.to ?? null,
      flagReason: t.flagReason || null,
    });
    const update = db.prepare(
      `UPDATE transaction_items SET physical_quantity = ?, checked = ?
       WHERE transaction_id = ? AND product_id = ?`
    );
    (t.recordedItems || []).forEach((i) =>
      update.run(i.physicalQuantity, i.checked ? 1 : 0, req.params.id, i.productId)
    );
  });
  save();
  res.json(toTransaction(db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id)));
}));

// ---------------------------------------------------------------------------
// audit log — append only
// ---------------------------------------------------------------------------
app.post('/api/audit', wrap((req, res) => {
  const { type, text, detail, actor } = req.body;
  const info = db
    .prepare('INSERT INTO audit_log (type, text, detail, actor) VALUES (?, ?, ?, ?)')
    .run(type, text, detail || '', actor || 'System');
  const row = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(info.lastInsertRowid);
  res.json({ id: String(row.id), timestamp: row.timestamp, type: row.type, text: row.text, detail: row.detail, actor: row.actor });
}));

app.get('/api/audit', wrap((req, res) => {
  const { actor, q } = req.query;
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  // A cashier's screen passes ?actor=<their name>; the administrator does
  // not, so the WHERE clause is what enforces the visibility rule here.
  if (actor) {
    sql += ' AND actor = ?';
    params.push(actor);
  }
  if (q) {
    sql += ' AND (LOWER(text) LIKE ? OR LOWER(detail) LIKE ?)';
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like);
  }
  sql += ' ORDER BY id DESC LIMIT 500';
  res.json(
    db.prepare(sql).all(...params).map((r) => ({
      id: String(r.id), timestamp: r.timestamp, type: r.type,
      text: r.text, detail: r.detail, actor: r.actor,
    }))
  );
}));

// ---------------------------------------------------------------------------
// staff / auth (NFR-05, NFR-06)
// ---------------------------------------------------------------------------
const publicStaff = (r) => ({ id: r.id, name: r.name, role: r.role, initials: r.initials });

app.get('/api/staff', wrap((req, res) => {
  res.json(db.prepare('SELECT * FROM staff ORDER BY id').all().map(publicStaff));
}));

app.get('/api/staff/:id', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
  res.json(row ? publicStaff(row) : null);
}));

app.post('/api/staff', wrap((req, res) => {
  const s = req.body;
  const id = String(s.id || '').trim();
  if (!id) throw new Error('Employee ID is required.');
  if (!s.password || String(s.password).length < 4) throw new Error('Password must be at least 4 characters.');
  const clash = db.prepare('SELECT id FROM staff WHERE LOWER(id) = LOWER(?)').get(id);
  if (clash) throw new Error(`Employee ID ${id} is already in use.`);
  const initials = (s.initials || String(s.name || '').trim().split(/\s+/).map((p) => p[0]).join('')).slice(0, 2).toUpperCase();
  const hash = bcrypt.hashSync(String(s.password), 10);
  db.prepare(
    `INSERT INTO staff (id, name, role, initials, password_hash) VALUES (?, ?, ?, ?, ?)`
  ).run(id, s.name, s.role === 'admin' ? 'admin' : 'cashier', initials, hash);
  res.json(publicStaff(db.prepare('SELECT * FROM staff WHERE id = ?').get(id)));
}));

app.put('/api/staff/:id', wrap((req, res) => {
  const s = req.body;
  const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
  if (!existing) throw new Error('Staff account not found.');
  const name = s.name ? s.name.trim() : existing.name;
  const role = s.role === 'admin' || s.role === 'cashier' ? s.role : existing.role;
  const hash = s.password ? bcrypt.hashSync(String(s.password), 10) : existing.password_hash;
  db.prepare('UPDATE staff SET name=?, role=?, password_hash=? WHERE id=?').run(name, role, hash, req.params.id);
  res.json(publicStaff(db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id)));
}));

app.delete('/api/staff/:id', wrap((req, res) => {
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

app.post('/api/auth/login', wrap((req, res) => {
  const { id, password } = req.body || {};
  const row = db.prepare('SELECT * FROM staff WHERE LOWER(id) = LOWER(?)').get(String(id || '').trim());
  // The hash never leaves this function, and the response never includes it.
  let ok = false;
  try {
    ok = !!row && bcrypt.compareSync(String(password || ''), row.password_hash);
  } catch (e) {
    // A corrupted/placeholder hash (e.g. left over from an interrupted seed
    // run) must never crash the request — treat it as "wrong credentials".
    ok = false;
  }
  if (!ok) return res.status(401).json({ error: 'Employee ID or password is incorrect.' });
  res.json(publicStaff(row));
}));

// ---------------------------------------------------------------------------
// static front-end: serves index-sqlite.html, css/ and js/ from the parent
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
  console.log(`SmartCart OS API  ->  http://localhost:${PORT}/api`);
  console.log(`SmartCart OS app  ->  http://localhost:${PORT}/index-sqlite.html`);
  console.log(`SQLite file       ->  ${DB_PATH}`);
});
