# SmartCart OS

Front-end and back-end for the Smart Trolley / SmartCart OS system described in Chapters 1–3 of the project document. Plain HTML/CSS/JavaScript, organised as an OOP system so each concern lives in its own file and can be fixed or swapped independently.

## Two builds

**`index.html`** — double-click it. Data lives in the browser. No install, no server, nothing to break. Use this while you are wiring the Arduino.

**`index-sqlite.html`** — the real thing, backed by Node + SQLite:

```bash
cd server
npm install
npm run seed
npm start
```
then open `http://localhost:3000/index-sqlite.html`.

Both builds run identical application code. The only difference is one line in `config.js`, which decides whether the repository layer talks to localStorage or to the API. Full walkthrough in **[SQLITE.md](SQLITE.md)**.

**Sign in:** `EMP-1042` / `1042` (cashier) · `ADM-0001` / `0001` (administrator).

---

## How it's organised

```
index.html / index-sqlite.html  → app shell + script load order
css/styles.css                  → design tokens and every component style

js/config.js                    → the local-vs-SQLite switch

js/models.js                    → Product, CartItem, Cart, VerificationItem,
                                   Transaction, Staff, AuditEntry. Pure domain
                                   objects: no DOM, no storage. Totals,
                                   discrepancy detection and the FR-11 payment
                                   lock all live here.

js/data/database.js             → localStorage engine, mirroring the SQLite
                                   schema table for table
js/data/repositories.js         → local repositories — the ONLY classes that
                                   touch Database directly
js/data/apiRepositories.js      → the same method signatures over fetch(),
                                   talking to the Node + SQLite server

js/services/authService.js      → sign in, roles (NFR-05/06)
js/services/cartService.js      → Module 1: self-scanning (FR-01–FR-05)
js/services/cashierService.js   → Module 2: verification, override, payment,
                                   approval, flagging (FR-06–FR-11)
js/services/adminService.js     → Module 3: catalog, inventory, exports (FR-12/13)
js/services/auditService.js     → Module 4 read side, including who may see what

js/ui/icons.js · dom.js · toast.js
                                → icon set, formatting and escaping helpers,
                                   on-screen notifications (NFR-09)

js/views/baseView.js            → the contract every screen implements
js/views/shellView.js           → sidebar + top bar; NAV decides which pages
                                   each role can reach
js/views/loginView.js           → staff sign in
js/views/queueView.js           → verification queue
js/views/verificationView.js    → physical inspection + payment
js/views/transactionsView.js    → audit ledger with filters and CSV export
js/views/productsView.js        → catalog CRUD
js/views/inventoryView.js       → stock levels and adjustments
js/views/activityLogView.js     → activity log
js/views/dashboardView.js       → administrator dashboard
js/views/settingsView.js        → terminal info, reset, exports
js/views/simulatorView.js       → dev tool standing in for the Arduino cart

js/app.js                       → composition root: builds the object graph,
                                   renders, routes every click and keypress

server/server.js                → Express API over SQLite
server/seed.js                  → creates the database and hashes passwords
server/db/schema.sql            → tables, constraints, indexes
server/db/seed.sql              → the 15 sample products
```

## "Where do I fix X?"

| Symptom | Look in |
|---|---|
| A total or discrepancy is wrong | `js/models.js` |
| Data isn't saving or loading | `js/data/repositories.js` (local) or `apiRepositories.js` + `server/server.js` |
| A rule is wrong — payment lock, override, stock | `js/services/*.js` |
| Something displays wrong or a button does nothing | `js/views/*.js` |
| Colours, spacing, fonts | `css/styles.css` |
| A screen is missing from a role's menu | `NAV` in `js/views/shellView.js` |

---

## Why there is no customer screen

Per Chapter 2.1 of the SRS: *the customer requires no account or separate dashboard — interaction with the system is limited entirely to the cart-mounted scanner.* The Arduino on the trolley **is** the customer interface.

What exists instead is a **Cart Simulator** page, marked in the UI as a testing tool. It builds carts by calling `CartService.scanBarcode()` — the same method the hardware will call — so the cashier and admin screens can be exercised before the scanner exists. When the Arduino works, delete `js/views/simulatorView.js` and its two `NAV` entries. Nothing else references it.

## Connecting the Arduino

A **keyboard-wedge (USB/HID) scanner needs no code**: focus the scan field and the device types the digits and presses Enter. That path is already handled.

For a serial Arduino, read lines from the port and call the bridge in `app.js`:

```js
SmartCart.scan('4801234500011');
```

That runs the same service call as every other scan, so stock checks, unknown-barcode errors and totals behave identically. The 15 sample barcodes are listed in `server/db/seed.sql` — print them from any free EAN-13 generator to make test labels.

---

## The full flow to demo

1. **Cart Simulator** — tap a few products or type a barcode and press Enter. Try `0000000000000` to see the unknown-barcode error, and the chocolate bar to see the out-of-stock guard. Then **Send to cashier queue**.
2. **Verification Queue** — scan or type the transaction ID (or the cart session code) and press Enter, or click **Retrieve & verify**.
3. **Workspace** — the recorded cart sits beside your physical count. Check each line off; the progress bar fills. Knock a quantity down to create a discrepancy and watch payment lock. **Override & Recalculate** with a written reason unlocks it at the verified amount.
4. **Payment** — the amount shows large, you type what the customer handed over, change appears. Approve prints a receipt, decrements stock, and writes the activity log.
5. **Activity Log** — sign in as the cashier and as the admin to see the difference: the cashier sees only their own actions, the admin sees everyone's.
6. **Admin Dashboard** — discrepancy rate, flagged transactions, low stock, verified revenue.

## What's real and what's simulated

- **Barcode scanner** — simulated by the Cart Simulator; the hardware bridge is written and waiting.
- **SQLite + Node** — real, in `server/`. The local build simulates it with localStorage.
- **Password hashing** — real bcrypt in the server build. The local build cannot do this honestly and says so in a comment.
- **Business rules** — enforced in the browser's service layer. Moving them server-side is the natural next step and is described at the end of SQLITE.md.
