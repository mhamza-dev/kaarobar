export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  business_id TEXT NULL,
  branch_id TEXT NULL,
  name TEXT NOT NULL,
  image_path TEXT,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','manager','cashier')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PKR',
  brand_color TEXT NOT NULL DEFAULT '#2d6df6',
  business_nature TEXT NOT NULL DEFAULT 'retail' CHECK (business_nature IN ('retail','food','salon','services')),
  logo_path TEXT,
  social_whatsapp TEXT,
  social_instagram TEXT,
  social_facebook TEXT,
  social_tiktok TEXT,
  social_website TEXT,
  receipt_header TEXT,
  receipt_footer TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_main_branch INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_branches_business ON branches(business_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price REAL NOT NULL CHECK (price >= 0),
  cost_price REAL CHECK (cost_price IS NULL OR cost_price >= 0),
  stock_qty REAL NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  kind TEXT NOT NULL DEFAULT 'item' CHECK (kind IN ('item','service','package','deal')),
  tracks_stock INTEGER NOT NULL DEFAULT 1 CHECK (tracks_stock IN (0, 1)),
  unit TEXT DEFAULT 'pcs',
  kitchen_station TEXT NOT NULL DEFAULT 'main',
  image_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(business_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_active_stock ON products(business_id, is_active, stock_qty);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  opening_balance REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_business_balance ON customers(business_id, is_active, current_balance);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers(business_id);

CREATE TABLE IF NOT EXISTS supplier_products (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (supplier_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product ON supplier_products(product_id);

CREATE TABLE IF NOT EXISTS dining_tables (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  seats INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (business_id, name)
);
CREATE INDEX IF NOT EXISTS idx_dining_tables_business ON dining_tables(business_id);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  invoice_no TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
  cashier_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax REAL NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total REAL NOT NULL CHECK (total >= 0),
  amount_paid REAL NOT NULL CHECK (amount_paid >= 0),
  change_due REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','void','refunded','partially_refunded')),
  served_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  service_mode TEXT CHECK (service_mode IS NULL OR service_mode IN ('dine_in','takeaway','delivery')),
  table_id TEXT REFERENCES dining_tables(id) ON DELETE RESTRICT,
  rider_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  delivery_status TEXT CHECK (delivery_status IS NULL OR delivery_status IN ('pending','assigned','out_for_delivery','delivered','cancelled')),
  delivery_notes TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_invoice ON sales(business_id, invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_business_date ON sales(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_business_created_status ON sales(business_id, created_at, status);

CREATE TABLE IF NOT EXISTS pos_tickets (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  table_id TEXT REFERENCES dining_tables(id) ON DELETE RESTRICT,
  service_mode TEXT NOT NULL CHECK (service_mode IN ('dine_in','takeaway','delivery')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','billed','cancelled')),
  opened_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes TEXT,
  rider_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  delivery_status TEXT CHECK (delivery_status IS NULL OR delivery_status IN ('pending','assigned','out_for_delivery','delivered','cancelled')),
  delivery_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pos_tickets_business ON pos_tickets(business_id);
CREATE INDEX IF NOT EXISTS idx_pos_tickets_table_open ON pos_tickets(table_id, status);

CREATE TABLE IF NOT EXISTS pos_ticket_items (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES pos_tickets(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  qty REAL NOT NULL CHECK (qty > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  line_total REAL NOT NULL CHECK (line_total >= 0),
  seat_no INTEGER,
  kitchen_status TEXT NOT NULL DEFAULT 'held' CHECK (kitchen_status IN ('held','fired','ready','bumped')),
  fired_at TEXT,
  bumped_at TEXT,
  billed_qty REAL NOT NULL DEFAULT 0 CHECK (billed_qty >= 0),
  price_rule_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_pos_ticket_items_ticket ON pos_ticket_items(ticket_id);
CREATE INDEX IF NOT EXISTS idx_pos_ticket_items_kitchen ON pos_ticket_items(kitchen_status);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  qty REAL NOT NULL CHECK (qty > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  line_total REAL NOT NULL CHECK (line_total >= 0),
  refunded_qty REAL NOT NULL DEFAULT 0 CHECK (refunded_qty >= 0),
  price_rule_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refund_requests_sale ON refund_requests(sale_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_business ON refund_requests(business_id);

CREATE TABLE IF NOT EXISTS refund_request_items (
  id TEXT PRIMARY KEY,
  refund_request_id TEXT NOT NULL REFERENCES refund_requests(id) ON DELETE RESTRICT,
  sale_item_id TEXT NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  qty REAL NOT NULL CHECK (qty > 0)
);
CREATE INDEX IF NOT EXISTS idx_refund_request_items_request ON refund_request_items(refund_request_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_business ON activity_log(business_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK (method IN ('cash','card','credit')),
  amount REAL NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('sale','payment','adjustment','opening')),
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  reference_sale_id TEXT REFERENCES sales(id) ON DELETE RESTRICT,
  note TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_customer ON ledger_entries(customer_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','partially_received','received','cancelled')),
  order_date TEXT NOT NULL,
  expected_date TEXT,
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(business_id, po_number);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  po_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  ordered_qty REAL NOT NULL CHECK (ordered_qty > 0),
  received_qty REAL NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
  line_total REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

CREATE TABLE IF NOT EXISTS supplier_ledger_entries (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('purchase','payment','adjustment')),
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  reference_po_id TEXT REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  note TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier ON supplier_ledger_entries(supplier_id);

CREATE TABLE IF NOT EXISTS happy_hour_price_rules (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
  override_price REAL CHECK (override_price IS NULL OR override_price >= 0),
  percent_off REAL CHECK (percent_off IS NULL OR (percent_off >= 0 AND percent_off <= 100)),
  weekdays_mask INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (override_price IS NOT NULL AND percent_off IS NULL)
    OR (override_price IS NULL AND percent_off IS NOT NULL)
  ),
  CHECK (product_id IS NULL OR category_id IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_hh_rules_business_active
  ON happy_hour_price_rules(business_id, is_active, priority DESC);

CREATE TABLE IF NOT EXISTS settings (
  business_id TEXT NOT NULL DEFAULT '',
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (business_id, key)
);

CREATE TABLE IF NOT EXISTS app_license (
  id TEXT PRIMARY KEY CHECK (id = 'local'),
  license_key TEXT NOT NULL,
  expires_at TEXT,
  issued_to TEXT,
  fingerprint TEXT NOT NULL,
  activated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  blob TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS trg_businesses_updated_at
AFTER UPDATE ON businesses
BEGIN
  UPDATE businesses SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_products_updated_at
AFTER UPDATE ON products
BEGIN
  UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_customers_updated_at
AFTER UPDATE ON customers
BEGIN
  UPDATE customers SET updated_at = datetime('now') WHERE id = NEW.id;
END;
`
