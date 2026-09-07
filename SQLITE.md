# Working with SQLite

Two builds ship in this folder, and they share every line of code except one config value.

| | `index.html` | `index-sqlite.html` |
|---|---|---|
| Data lives in | the browser's localStorage | `server/smartcart.db` |
| Needs Node installed | no | yes |
| How you open it | double-click the file | `http://localhost:3000/index-sqlite.html` |
| Survives clearing browser data | no | yes |
| Two computers see the same data | no | yes |
| Use it for | **Arduino testing**, quick demos | the real system, your defense |

Use `index.html` while you are wiring the scanner. There is nothing to start, nothing to install, and a wrong move can't corrupt a database. Move to the SQLite build once the hardware works.

---

## 1. First-time setup

Install Node.js (LTS) from nodejs.org, then:

```bash
cd smartcart-os/server
npm install      # express, better-sqlite3, bcryptjs
npm run seed     # creates smartcart.db with 15 products + 3 staff accounts
npm start
```

You should see:

```
SmartCart OS API  ->  http://localhost:3000/api
SmartCart OS app  ->  http://localhost:3000/index-sqlite.html
SQLite file       ->  .../server/smartcart.db
```

Open that second URL. Sign in with `ADM-0001` / `0001`. Check **Settings** — the Data store row should say *SQLite via http://localhost:3000/api* with a green **Server mode** pill. If it says Local mode, you opened the wrong file.

**Open it through `http://localhost:3000`, not by double-clicking `index-sqlite.html`.** A page opened from disk is not allowed to call `http://localhost`, so every request fails. This is the single most common mistake.

---

## 2. How a scan reaches the database

Worth being able to draw on a whiteboard during your defense:

```
Arduino reads a barcode
        │
        ▼
SmartCart.scan('4801234500011')        app.js — hardware bridge
        │
        ▼
CartService.scanBarcode()              services/ — business rules
        │                              (is it real? in stock? add it)
        ▼
ApiProductRepository.findByBarcode()   data/ — the only layer that knows
        │                              where data lives
        ▼
GET /api/products/barcode/4801234500011
        │
        ▼
SELECT * FROM products WHERE barcode = ?     ← indexed, sub-millisecond
```

Swap the bottom three boxes for localStorage and everything above is untouched. That is why the repository layer exists, and it is the strongest design point you have to talk about.

---

## 3. The schema

`server/db/schema.sql`, seven tables:

- **products** — the catalog. `barcode` is `UNIQUE` and indexed, because a scan hits it every time.
- **staff** — cashier and admin accounts. Stores a bcrypt hash, never a password.
- **carts** / **cart_items** — one shopping session per trolley.
- **transactions** / **transaction_items** — a finalized cart at the counter.
- **audit_log** — append-only history.

Two design points that are worth defending:

**Snapshots.** `transaction_items` copies `name`, `barcode` and `unit_price` instead of only pointing at `products`. If someone changes a price next week, last week's receipt must not change with it. A pure foreign key would rewrite history.

**Two quantity columns.** `cart_quantity` is what the scanner recorded and is never updated; `physical_quantity` is what the cashier counted. Discrepancy detection is just `WHERE physical_quantity <> cart_quantity` — the database itself can answer "which transactions had mismatches?", which is exactly what Module 4 needs.

---

## 4. Adding products

Three ways, in order of preference:

**From the app** — sign in as admin → Products → Add product. Nothing else to do; this is what FR-12 describes.

**Add a permanent seed row** — edit `server/db/seed.sql`, add a line to the `INSERT INTO products` list, then `npm run seed`. Do this for products you want back every time you reset. Keep `js/data/database.js` `_seedProducts()` in step if you want the local build to match.

**Straight SQL**, for a one-off:

```bash
cd server
sqlite3 smartcart.db
```
```sql
INSERT INTO products (id, barcode, name, category, price, stock, icon)
VALUES ('P0016', '4801234500165', 'Corned Beef 150g', 'Pantry', 78.00, 30, '🥫');
.quit
```

Anything that inserts a duplicate barcode is rejected by the `UNIQUE` constraint — which is the database protecting you from two products answering the same scan.

### About the sample barcodes

`4801234500011` through `4801234500158` are EAN-13 codes in a private range. They are fine for the prototype and for printing your own test labels, but they belong to no real manufacturer. If you scan an actual product from a store, its real barcode won't be in the catalog — that is the correct behaviour, and adding it through the Admin screen is the demo of FR-12. Print your 15 test labels from any free EAN-13 barcode generator using the codes in `seed.sql`.

---

## 5. Useful commands

```bash
sqlite3 smartcart.db                                  # open a shell
.tables                                               # list tables
.schema products                                      # show a table's definition
.headers on
.mode column

SELECT id, barcode, name, price, stock FROM products ORDER BY stock;
SELECT * FROM audit_log ORDER BY id DESC LIMIT 20;

-- which transactions had a mismatch, and how big was it?
SELECT t.id, ti.name, ti.cart_quantity, ti.physical_quantity,
       (ti.cart_quantity - ti.physical_quantity) * ti.unit_price AS value_gap
FROM transaction_items ti
JOIN transactions t ON t.id = ti.transaction_id
WHERE ti.physical_quantity <> ti.cart_quantity;

-- takings per cashier
SELECT cashier, COUNT(*) AS sales, SUM(payment_amount) AS total
FROM transactions WHERE status = 'verified' GROUP BY cashier;
```

Back up by copying the file: `cp smartcart.db smartcart-backup.db`. That's the whole backup procedure — one of SQLite's real advantages for a project like this, and worth saying out loud in your defense.

Reset before a demo with `npm run seed`. It drops and recreates everything.

For a GUI, **DB Browser for SQLite** (sqlitebrowser.org, free) opens `smartcart.db` and lets you browse and edit rows in a spreadsheet-like view. Close it before running the server — two writers on one file will lock each other out.

---

## 6. Passwords

`seed.sql` contains a placeholder string, not a usable hash. `npm run seed` replaces it with a real bcrypt hash after loading the SQL. To change a password, edit the `PASSWORDS` map at the top of `server/seed.js` and re-run the seed.

`POST /api/auth/login` compares the submitted password against the stored hash with `bcrypt.compareSync` and returns only `{id, name, role, initials}`. The hash never reaches the browser — there is a test asserting exactly that.

The local build can't do this: with no server, there is nowhere to keep a hash the user can't read, so `database.js` stores `plain:1042` and is honest about it in a comment. If an examiner asks how you meet NFR-06, the answer is the server build.

---

## 7. When something breaks

| Symptom | Cause |
|---|---|
| "Cannot reach the SmartCart server" | server isn't running, or you opened the file from disk instead of `http://localhost:3000` |
| Page loads but everything is empty | you ran `npm start` before `npm run seed` |
| `SQLITE_ERROR: no such table` | same — seed first |
| `EADDRINUSE` | port 3000 is taken; `PORT=3001 npm start`, and update `apiBaseUrl` in `index-sqlite.html` |
| `npm install` fails on better-sqlite3 | usually a missing build toolchain on Windows; install the Node LTS version, which ships prebuilt binaries |
| Changes vanish on refresh | you're on `index.html` (local build), which is expected |
| Database is locked | DB Browser has the file open — close it |

---

## 8. What is left for later

The server stores what it is told; the business rules still run in the browser. That is fine for a prototype and honest to say so. The next step, if you have time, is moving the rules from `js/services/` into server routes so a modified browser can't approve a transaction that has an unresolved discrepancy. The service classes are already the right shape for that move — the method bodies would become route handlers almost unchanged.
