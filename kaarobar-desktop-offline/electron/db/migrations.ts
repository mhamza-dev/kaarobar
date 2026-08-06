import type Database from 'better-sqlite3'
import { SCHEMA_SQL } from './schema'

type Migration = {
  name: string
  up: (db: Database.Database) => void
}

const MIGRATIONS: Migration[] = [
  {
    name: '001_initial_schema',
    up: (db) => {
      db.exec(SCHEMA_SQL)
    },
  },
  {
    name: '002_refunds_audit_updates',
    up: (db) => {
      const hasActivity = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'activity_log'`)
        .get() as { name: string } | undefined

      if (!hasActivity) {
        db.pragma('foreign_keys = OFF')
        db.exec(`
          CREATE TABLE sales_new (
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
            created_at TEXT NOT NULL
          );
          INSERT INTO sales_new
            SELECT id, business_id, branch_id, invoice_no, customer_id, cashier_id, subtotal, discount, tax, total, amount_paid, change_due, status, created_at
            FROM sales;
          DROP TABLE sales;
          ALTER TABLE sales_new RENAME TO sales;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_invoice ON sales(business_id, invoice_no);
          CREATE INDEX IF NOT EXISTS idx_sales_business_date ON sales(business_id, created_at);
        `)
        db.pragma('foreign_keys = ON')

        db.exec(`
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
        `)
      }

      const saleItemCols = db.prepare(`PRAGMA table_info(sale_items)`).all() as Array<{ name: string }>
      if (!saleItemCols.some((c) => c.name === 'refunded_qty')) {
        db.exec(`ALTER TABLE sale_items ADD COLUMN refunded_qty REAL NOT NULL DEFAULT 0`)
      }
    },
  },
  {
    name: '003_product_image',
    up: (db) => {
      const cols = db.prepare(`PRAGMA table_info(products)`).all() as Array<{ name: string }>
      if (!cols.some((c) => c.name === 'image_path')) {
        db.exec(`ALTER TABLE products ADD COLUMN image_path TEXT`)
      }
    },
  },
  {
    name: '004_business_socials',
    up: (db) => {
      const cols = db.prepare(`PRAGMA table_info(businesses)`).all() as Array<{ name: string }>
      const names = new Set(cols.map((c) => c.name))
      for (const col of [
        'social_whatsapp',
        'social_instagram',
        'social_facebook',
        'social_tiktok',
        'social_website',
      ]) {
        if (!names.has(col)) db.exec(`ALTER TABLE businesses ADD COLUMN ${col} TEXT`)
      }
    },
  },
  {
    name: '005_supplier_products',
    up: (db) => {
      db.exec(`
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
      `)
    },
  },
  {
    name: '006_app_license',
    up: (db) => {
      db.exec(`
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
      `)
    },
  },
  {
    name: '007_user_profile_image',
    up: (db) => {
      const cols = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>
      if (!cols.some((c) => c.name === 'image_path')) {
        db.exec(`ALTER TABLE users ADD COLUMN image_path TEXT`)
      }
    },
  },
  {
    name: '008_analytics_indexes',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_business_created_status ON sales(business_id, created_at, status);
        CREATE INDEX IF NOT EXISTS idx_customers_business_balance ON customers(business_id, is_active, current_balance);
        CREATE INDEX IF NOT EXISTS idx_products_business_active_stock ON products(business_id, is_active, stock_qty);
        ANALYZE;
      `)
    },
  },
  {
    name: '009_business_nature_pos',
    up: (db) => {
      const bizCols = db.prepare(`PRAGMA table_info(businesses)`).all() as Array<{ name: string }>
      if (!bizCols.some((c) => c.name === 'business_nature')) {
        db.exec(
          `ALTER TABLE businesses ADD COLUMN business_nature TEXT NOT NULL DEFAULT 'retail'`,
        )
      }

      const productCols = db.prepare(`PRAGMA table_info(products)`).all() as Array<{ name: string }>
      if (!productCols.some((c) => c.name === 'kind')) {
        db.exec(`ALTER TABLE products ADD COLUMN kind TEXT NOT NULL DEFAULT 'item'`)
      }
      if (!productCols.some((c) => c.name === 'tracks_stock')) {
        db.exec(`ALTER TABLE products ADD COLUMN tracks_stock INTEGER NOT NULL DEFAULT 1`)
      }

      const saleCols = db.prepare(`PRAGMA table_info(sales)`).all() as Array<{ name: string }>
      if (!saleCols.some((c) => c.name === 'served_by_user_id')) {
        db.exec(`ALTER TABLE sales ADD COLUMN served_by_user_id TEXT`)
      }
      if (!saleCols.some((c) => c.name === 'service_mode')) {
        db.exec(`ALTER TABLE sales ADD COLUMN service_mode TEXT`)
      }
      if (!saleCols.some((c) => c.name === 'table_id')) {
        db.exec(`ALTER TABLE sales ADD COLUMN table_id TEXT`)
      }

      db.exec(`
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

        CREATE TABLE IF NOT EXISTS pos_tickets (
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
          branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          table_id TEXT REFERENCES dining_tables(id) ON DELETE RESTRICT,
          service_mode TEXT NOT NULL CHECK (service_mode IN ('dine_in','takeaway','delivery')),
          status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','billed','cancelled')),
          opened_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          notes TEXT,
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
          line_total REAL NOT NULL CHECK (line_total >= 0)
        );
        CREATE INDEX IF NOT EXISTS idx_pos_ticket_items_ticket ON pos_ticket_items(ticket_id);
      `)
    },
  },
  {
    name: '010_payment_method_credit',
    up: (db) => {
      const hasPayments = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'payments'`)
        .get() as { name: string } | undefined
      if (!hasPayments) return

      // SQLite cannot ALTER CHECK constraints — rebuild payments with credit instead of khata.
      db.pragma('foreign_keys = OFF')
      db.exec(`
        CREATE TABLE payments_new (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
          method TEXT NOT NULL CHECK (method IN ('cash','card','credit')),
          amount REAL NOT NULL CHECK (amount > 0),
          created_at TEXT NOT NULL
        );
        INSERT INTO payments_new (id, sale_id, method, amount, created_at)
        SELECT
          id,
          sale_id,
          CASE WHEN method = 'khata' THEN 'credit' ELSE method END,
          amount,
          created_at
        FROM payments;
        DROP TABLE payments;
        ALTER TABLE payments_new RENAME TO payments;
        CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
      `)
      db.pragma('foreign_keys = ON')
    },
  },
  {
    name: '011_receipt_messages',
    up: (db) => {
      const cols = db.prepare(`PRAGMA table_info(businesses)`).all() as Array<{ name: string }>
      const names = new Set(cols.map((c) => c.name))
      if (!names.has('receipt_header')) {
        db.exec(`ALTER TABLE businesses ADD COLUMN receipt_header TEXT`)
      }
      if (!names.has('receipt_footer')) {
        db.exec(`ALTER TABLE businesses ADD COLUMN receipt_footer TEXT`)
      }

      // Prefer legacy settings.receipt_footer when present.
      db.exec(`
        UPDATE businesses
        SET receipt_footer = (
          SELECT value FROM settings
          WHERE settings.business_id = businesses.id AND settings.key = 'receipt_footer'
          LIMIT 1
        )
        WHERE receipt_footer IS NULL OR trim(receipt_footer) = ''
      `)
      db.exec(`
        UPDATE businesses
        SET receipt_footer = 'Thank you for shopping with us'
        WHERE receipt_footer IS NULL OR trim(receipt_footer) = ''
      `)
    },
  },
]

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `)

  const hasMigration = db.prepare('SELECT name FROM schema_migrations WHERE name = ?')
  const insertMigration = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)')

  for (const migration of MIGRATIONS) {
    const applied = hasMigration.get(migration.name) as { name: string } | undefined
    if (applied) continue

    const run = db.transaction(() => {
      migration.up(db)
      insertMigration.run(migration.name, new Date().toISOString())
    })
    run()
  }
}
