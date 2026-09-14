/**
 * seed.js
 * ---------------------------------------------------------------------------
 * Creates smartcart.db from db/schema.sql and db/seed.sql, then replaces the
 * placeholder password hashes with real bcrypt hashes (NFR-06).
 *
 *     npm run seed
 *
 * Safe to re-run: schema.sql drops the tables first, so this always gives
 * you a clean database. Run it before a demo.
 * ---------------------------------------------------------------------------
 */
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'smartcart.db');
const read = (file) => fs.readFileSync(path.join(__dirname, 'db', file), 'utf8');

// Passwords for the demo accounts. Change them here, then re-run the seed.
const PASSWORDS = {
  'EMP-1042': '1042',
  'EMP-2007': '2007',
  'ADM-0001': '0001',
};

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

console.log('Applying db/schema.sql …');
db.exec(read('schema.sql'));

console.log('Applying db/seed.sql …');
db.exec(read('seed.sql'));

console.log('Hashing staff passwords with bcrypt …');
const update = db.prepare('UPDATE staff SET password_hash = ? WHERE id = ?');
const rehash = db.transaction(() => {
  for (const [id, plain] of Object.entries(PASSWORDS)) {
    update.run(bcrypt.hashSync(plain, 10), id);
  }
});
rehash();

const products = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
const staff = db.prepare('SELECT COUNT(*) AS n FROM staff').get().n;

console.log('');
console.log(`Done. ${DB_PATH}`);
console.log(`  products : ${products}`);
console.log(`  staff    : ${staff}`);
console.log('');
console.log('Start the server with:  npm start');

db.close();
// Some Node + better-sqlite3 builds crash during normal process shutdown
// (a native cleanup-hook bug, unrelated to this script). Everything above
// this line has already run and committed, so exit immediately rather
// than letting Node's normal exit sequence reach that crash.
process.exit(0);
