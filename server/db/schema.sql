-- ===========================================================================
-- SmartCart OS — SQLite schema
-- ---------------------------------------------------------------------------
-- Run this once to create an empty database:
--     sqlite3 smartcart.db < schema.sql
-- or let the server do it for you:
--     npm run seed
--
-- Every table here matches a "table" in js/data/database.js, so the local
-- build and the server build store the same shapes.
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- Dropped in reverse dependency order so re-running is safe.
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS transaction_items;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS staff;

-- ---------------------------------------------------------------------------
-- products — the catalog the scanner looks up (FR-02, FR-12)
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id          TEXT PRIMARY KEY,            -- P0001, P0002, ...
  barcode     TEXT NOT NULL UNIQUE,        -- what the Arduino scanner sends
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'General',
  price       REAL NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  icon        TEXT NOT NULL DEFAULT '🛒',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The scanner hits this index on every single scan (NFR-02: < 2 s lookup).
CREATE UNIQUE INDEX idx_products_barcode ON products (barcode);
CREATE INDEX idx_products_category ON products (category);

-- ---------------------------------------------------------------------------
-- staff — cashier and administrator accounts (NFR-05, NFR-06)
-- Customers have no account: they only use the cart-mounted scanner.
-- ---------------------------------------------------------------------------
CREATE TABLE staff (
  id            TEXT PRIMARY KEY,          -- EMP-1042 / ADM-0001
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('cashier', 'admin')),
  initials      TEXT NOT NULL,
  password_hash TEXT NOT NULL,             -- bcrypt hash, never a plain password
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- carts — one shopping session per trolley (FR-01, FR-05)
-- ---------------------------------------------------------------------------
CREATE TABLE carts (
  id           TEXT PRIMARY KEY,           -- CART-00001
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finalized')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  finalized_at TEXT
);

CREATE TABLE cart_items (
  cart_id    TEXT NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products (id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (cart_id, product_id)
);

-- ---------------------------------------------------------------------------
-- transactions — a finalized cart at the counter (Modules 2 + 4)
-- ---------------------------------------------------------------------------
CREATE TABLE transactions (
  id              TEXT PRIMARY KEY,        -- TX-00001
  cart_id         TEXT NOT NULL REFERENCES carts (id),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'verified', 'flagged')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at       TEXT,
  cashier         TEXT,
  original_total  REAL NOT NULL DEFAULT 0,

  -- payment (FR-09)
  payment_method  TEXT CHECK (payment_method IN ('cash', 'card')),
  payment_amount  REAL,
  payment_tendered REAL,
  payment_change  REAL,

  -- override & recalculate (FR-08): a note is mandatory in the service layer
  override_applied INTEGER NOT NULL DEFAULT 0,
  override_note   TEXT,
  override_by     TEXT,
  override_at     TEXT,
  override_from   REAL,
  override_to     REAL,

  flag_reason     TEXT
);

CREATE INDEX idx_transactions_status ON transactions (status);
CREATE INDEX idx_transactions_created ON transactions (created_at);

-- One row per line of the cashier's inspection checklist (FR-07, FR-08).
-- cart_quantity is what the scanner recorded and is never updated;
-- physical_quantity is what the cashier counted.
CREATE TABLE transaction_items (
  transaction_id    TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL,
  name              TEXT NOT NULL,         -- snapshot: survives a catalog edit
  barcode           TEXT NOT NULL,
  icon              TEXT NOT NULL DEFAULT '🛒',
  unit_price        REAL NOT NULL,         -- snapshot: price at time of sale
  cart_quantity     INTEGER NOT NULL,
  physical_quantity INTEGER NOT NULL,
  checked           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (transaction_id, product_id)
);

-- ---------------------------------------------------------------------------
-- audit_log — Module 4. Append-only: never UPDATE or DELETE these rows.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  type      TEXT NOT NULL,                 -- auth|cart|payment|override|flag|stock|product|system
  text      TEXT NOT NULL,
  detail    TEXT NOT NULL DEFAULT '',
  actor     TEXT NOT NULL
);

-- A cashier's activity screen filters on actor, so index it.
CREATE INDEX idx_audit_actor ON audit_log (actor);
CREATE INDEX idx_audit_timestamp ON audit_log (timestamp);
