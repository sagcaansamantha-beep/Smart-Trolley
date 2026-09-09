-- ===========================================================================
-- SmartCart OS — sample barcode catalog (15 products)
-- ---------------------------------------------------------------------------
--     sqlite3 smartcart.db < schema.sql
--     sqlite3 smartcart.db < seed.sql
-- or simply:  npm run seed
--
-- These are the SAME 15 rows seeded by js/data/database.js, so the local
-- build and the SQLite build behave identically.
--
-- About the barcodes: 4801234500011 .. 4801234500158 are EAN-13 codes in a
-- private/internal range. They are fine for a prototype and for printing
-- your own test labels, but they are not registered to a real manufacturer.
-- If you scan a real product from a store, add its actual barcode through
-- the Admin screen — that is exactly what FR-12 is for.
-- ===========================================================================

DELETE FROM products;

INSERT INTO products (id, barcode, name, category, price, stock, icon) VALUES
  ('P0001', '4801234500011', 'Sunrise Whole Milk 1L',        'Dairy',         89.50,  42, '🥛'),
  ('P0002', '4801234500028', 'Golden Wheat Bread Loaf',      'Bakery',        65.00,  30, '🍞'),
  ('P0003', '4801234500035', 'Farm Fresh Eggs (12pc)',       'Dairy',        110.00,  25, '🥚'),
  ('P0004', '4801234500042', 'Extra Virgin Olive Oil 500ml', 'Pantry',       245.75,   8, '🫒'),
  ('P0005', '4801234500059', 'Jasmine Rice 5kg',             'Pantry',       320.00,  50, '🍚'),
  ('P0006', '4801234500066', 'Instant Coffee 200g',          'Beverages',    178.25,  33, '☕'),
  ('P0007', '4801234500073', 'Bottled Water 1.5L',           'Beverages',     35.00,  80, '💧'),
  ('P0008', '4801234500080', 'Dishwashing Liquid 1L',        'Household',     95.50,  27, '🧴'),
  ('P0009', '4801234500097', 'Bath Soap Bar 135g',           'Personal Care', 42.00,  60, '🧼'),
  ('P0010', '4801234500103', 'Instant Noodles (5pc pack)',   'Pantry',        58.00,  45, '🍜'),
  ('P0011', '4801234500110', 'Canned Tuna Flakes 155g',      'Pantry',        39.75,  55, '🐟'),
  ('P0012', '4801234500127', 'Laundry Detergent Powder 1kg', 'Household',    132.00,   6, '🧺'),
  ('P0013', '4801234500134', 'Fresh Bananas (1kg)',          'Produce',       68.00,  40, '🍌'),
  ('P0014', '4801234500141', 'Toothpaste 150g',              'Personal Care', 87.50,  38, '🪥'),
  ('P0015', '4801234500158', 'Chocolate Bar 45g',            'Snacks',        32.00,   0, '🍫');

-- ---------------------------------------------------------------------------
-- Staff accounts.
-- password_hash below is a bcrypt hash, NOT the password itself (NFR-06).
-- Passwords: EMP-1042 -> 1042,  EMP-2007 -> 2007,  ADM-0001 -> 0001
-- `npm run seed` regenerates these hashes, so use that rather than copying
-- the strings below into a different database.
-- ---------------------------------------------------------------------------
DELETE FROM staff;

INSERT INTO staff (id, name, role, initials, password_hash) VALUES
  ('EMP-1042', 'Elena Reyes',    'cashier', 'ER', '$2b$10$REPLACED_BY_NPM_RUN_SEED'),
  ('EMP-2007', 'Mark Tolentino', 'cashier', 'MT', '$2b$10$REPLACED_BY_NPM_RUN_SEED'),
  ('ADM-0001', 'Alex Rivera',    'admin',   'AR', '$2b$10$REPLACED_BY_NPM_RUN_SEED');

INSERT INTO audit_log (type, text, detail, actor)
VALUES ('system', 'Database seeded', '15 products, 3 staff accounts', 'System');
