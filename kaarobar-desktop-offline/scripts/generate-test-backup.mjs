#!/usr/bin/env node
/**
 * Builds fixtures/kaarobar-test-app.kaarobar-backup — demo shop from 1 Jan 2025
 * through today: 5–20 sales/day, expanded customers/products/suppliers/POs.
 *
 * Run: npm run generate:test-backup
 */
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import JSZip from 'jszip'
import { v4 as uuidv4 } from 'uuid'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

function abbreviateName(name, maxLen = 4) {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
  if (words.length === 0) return 'X'
  if (words.length >= 2) {
    const initials = words
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase()
    return initials.slice(0, maxLen) || 'X'
  }
  return words[0].toUpperCase().slice(0, Math.min(3, maxLen)) || 'X'
}

function formatInvoiceNumber(businessName, branchName, sequence) {
  return `KB-${abbreviateName(businessName)}-${abbreviateName(branchName)}-${sequence}`
}
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outPath = path.join(root, 'fixtures', 'kaarobar-test-app.kaarobar-backup')

const MIGRATION_NAMES = [
  '001_initial_schema',
  '002_refunds_audit_updates',
  '003_product_image',
  '004_business_socials',
  '005_supplier_products',
  '006_app_license',
  '007_user_profile_image',
  '008_analytics_indexes',
  '009_business_nature_pos',
  '010_payment_method_credit',
  '011_receipt_messages',
]

const MAGIC = Buffer.from('KAAROBKB1', 'utf8')
const SALT = 'kaarobar-backup-salt-v1'
const DEMO_PASSWORD = 'Password@123'

function loadSchemaSql() {
  const src = fs.readFileSync(path.join(root, 'electron/db/schema.ts'), 'utf8')
  const match = src.match(/export const SCHEMA_SQL = `([\s\S]*?)`/)
  if (!match) throw new Error('Could not extract SCHEMA_SQL from electron/db/schema.ts')
  return match[1]
}

function encryptBackupPayload(plainBytes, secret) {
  const key = scryptSync(secret, SALT, 32)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainBytes), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([MAGIC, iv, tag, encrypted])
}

function isoAt(year, month, day, hour = 12, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0)).toISOString()
}

function dateStr(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function eachDay(startY, startM, startD, endDate, fn) {
  const cur = new Date(Date.UTC(startY, startM - 1, startD))
  const end = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()),
  )
  while (cur <= end) {
    fn(cur.getUTCFullYear(), cur.getUTCMonth() + 1, cur.getUTCDate())
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
}

function populateTestShop(db) {
  const today = new Date()
  const shopOpenedAt = isoAt(2025, 1, 1, 9)
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 12)
  const rand = mulberry32(20250101)

  const ownerId = uuidv4()
  const adminId = uuidv4()
  const cashierId = uuidv4()
  const managerId = uuidv4()
  const cashier2Id = uuidv4()
  const businessId = uuidv4()
  const branchId = uuidv4()

  const catGrocery = uuidv4()
  const catDrinks = uuidv4()
  const catHousehold = uuidv4()
  const catSnacks = uuidv4()
  const catDairy = uuidv4()
  const catServices = uuidv4()

  const productDefs = [
    { name: 'Basmati Rice 5kg', barcode: '8901001001001', price: 1850, cost: 1400, cat: catGrocery },
    { name: 'Cooking Oil 1L', barcode: '8901001001002', price: 520, cost: 390, cat: catGrocery },
    { name: 'Sugar 1kg', barcode: '8901001001003', price: 220, cost: 160, cat: catGrocery },
    { name: 'Tea Bags 100ct', barcode: '8901001001004', price: 450, cost: 310, cat: catGrocery },
    { name: 'Wheat Flour 10kg', barcode: '8901001001010', price: 980, cost: 720, cat: catGrocery },
    { name: 'Lentils 1kg', barcode: '8901001001011', price: 310, cost: 230, cat: catGrocery },
    { name: 'Salt 800g', barcode: '8901001001012', price: 60, cost: 35, cat: catGrocery },
    { name: 'Red Chili Powder 200g', barcode: '8901001001020', price: 180, cost: 110, cat: catGrocery },
    { name: 'Turmeric 200g', barcode: '8901001001021', price: 160, cost: 95, cat: catGrocery },
    { name: 'Pasta 500g', barcode: '8901001001022', price: 240, cost: 150, cat: catGrocery },
    { name: 'Mineral Water 1.5L', barcode: '8901001001005', price: 80, cost: 45, cat: catDrinks },
    { name: 'Cola Can 330ml', barcode: '8901001001006', price: 90, cost: 55, cat: catDrinks },
    { name: 'Orange Juice 1L', barcode: '8901001001013', price: 280, cost: 190, cat: catDrinks },
    { name: 'Energy Drink 250ml', barcode: '8901001001014', price: 220, cost: 150, cat: catDrinks },
    { name: 'Green Tea Bottle', barcode: '8901001001023', price: 120, cost: 70, cat: catDrinks },
    { name: 'Sparkling Water 500ml', barcode: '8901001001024', price: 100, cost: 55, cat: catDrinks },
    { name: 'Instant Noodles Pack', barcode: '8901001001007', price: 65, cost: 40, cat: catSnacks },
    { name: 'Potato Chips 50g', barcode: '8901001001015', price: 80, cost: 50, cat: catSnacks },
    { name: 'Biscuits Pack', barcode: '8901001001016', price: 120, cost: 75, cat: catSnacks },
    { name: 'Chocolate Bar', barcode: '8901001001017', price: 150, cost: 95, cat: catSnacks },
    { name: 'Nuts Mix 200g', barcode: '8901001001025', price: 450, cost: 300, cat: catSnacks },
    { name: 'Candy Jar', barcode: '8901001001026', price: 200, cost: 120, cat: catSnacks },
    { name: 'Dish Soap 500ml', barcode: '8901001001008', price: 280, cost: 190, cat: catHousehold },
    { name: 'Laundry Detergent 1kg', barcode: '8901001001018', price: 650, cost: 480, cat: catHousehold },
    { name: 'Toilet Paper 4pk', barcode: '8901001001019', price: 320, cost: 210, cat: catHousehold },
    { name: 'Notebook A4', barcode: '8901001001009', price: 150, cost: 90, cat: catHousehold },
    { name: 'Trash Bags 30ct', barcode: '8901001001027', price: 260, cost: 170, cat: catHousehold },
    { name: 'Hand Sanitizer 250ml', barcode: '8901001001028', price: 350, cost: 220, cat: catHousehold },
    { name: 'Fresh Milk 1L', barcode: '8901001001029', price: 280, cost: 200, cat: catDairy },
    { name: 'Yogurt Cup', barcode: '8901001001030', price: 90, cost: 55, cat: catDairy },
    { name: 'Cheese Slices', barcode: '8901001001031', price: 420, cost: 280, cat: catDairy },
    { name: 'Butter 200g', barcode: '8901001001032', price: 380, cost: 260, cat: catDairy },
    { name: 'Eggs Dozen', barcode: '8901001001033', price: 360, cost: 250, cat: catDairy },
    { name: 'Gift Wrapping', barcode: null, price: 100, cost: 0, cat: catServices, tracksStock: 0 },
    { name: 'Delivery Fee', barcode: null, price: 150, cost: 0, cat: catServices, tracksStock: 0 },
  ]

  const products = productDefs.map((def, i) => ({
    id: uuidv4(),
    name: def.name,
    barcode: def.barcode,
    price: def.price,
    cost: def.cost,
    stock: def.tracksStock === 0 ? 0 : 25000,
    tracksStock: def.tracksStock === 0 ? 0 : 1,
    categoryId: def.cat,
    createdAt: isoAt(2025, 1, 1 + Math.min(i, 20), 10),
  }))

  const byName = Object.fromEntries(products.map((p) => [p.name, p]))
  const stockable = products.filter((p) => p.tracksStock)

  const firstNames = [
    'Ahmed', 'Sara', 'Bilal', 'Fatima', 'Omar', 'Nadia', 'Hassan', 'Ayesha', 'Imran', 'Zainab',
    'Usman', 'Maryam', 'Kamran', 'Hina', 'Tariq', 'Sana', 'Asad', 'Rabia', 'Faisal', 'Mehwish',
    'Junaid', 'Iqra', 'Shahid', 'Noor', 'Waqas', 'Saima', 'Danish', 'Amina', 'Rizwan', 'Lubna',
  ]
  const lastNames = [
    'Khan', 'Ali', 'Sheikh', 'Hussain', 'Raza', 'Malik', 'Qureshi', 'Ahmed', 'Butt', 'Mirza',
    'Chaudhry', 'Siddiqui', 'Hashmi', 'Abbas', 'Iqbal',
  ]
  const businessNames = [
    'City Mart LLC', 'Green Valley Cafe', 'Sunrise Grocers', 'Corner Shop Co.', 'Blue Ocean Traders',
    'Pearl Mini Mart', 'Family Foods', 'Quick Stop Store', 'Horizon Wholesale Buyer', 'Metro Kitchen',
  ]

  const customerDefs = [{ name: 'Walk-in Customer', phone: null }]
  for (let i = 0; i < 45; i++) {
    if (i < businessNames.length) {
      customerDefs.push({
        name: businessNames[i],
        phone: `02${1 + (i % 5)}-${String(3000000 + i * 111).slice(0, 7)}`,
      })
    } else {
      const fn = firstNames[i % firstNames.length]
      const ln = lastNames[(i * 3) % lastNames.length]
      customerDefs.push({
        name: `${fn} ${ln}`,
        phone: `03${String(i % 10)}${String(i % 10)}-${String(1000000 + i * 7919).slice(0, 7)}`,
      })
    }
  }

  const customers = customerDefs.map((c, i) => ({
    id: uuidv4(),
    name: c.name,
    phone: c.phone,
    createdAt: isoAt(2025, 1, 1 + (i % 28), 11 + (i % 6)),
  }))

  const supplierDefs = [
    {
      name: 'Metro Wholesale',
      phone: '021-5551000',
      address: 'Industrial Area, Karachi',
      products: [
        'Basmati Rice 5kg', 'Cooking Oil 1L', 'Sugar 1kg', 'Tea Bags 100ct', 'Wheat Flour 10kg',
        'Lentils 1kg', 'Salt 800g', 'Red Chili Powder 200g', 'Turmeric 200g', 'Pasta 500g',
        'Dish Soap 500ml', 'Laundry Detergent 1kg', 'Toilet Paper 4pk', 'Notebook A4',
      ],
    },
    {
      name: 'Fresh Supply Co.',
      phone: '042-7772000',
      address: 'Warehouse Rd, Lahore',
      products: [
        'Mineral Water 1.5L', 'Cola Can 330ml', 'Orange Juice 1L', 'Energy Drink 250ml',
        'Green Tea Bottle', 'Sparkling Water 500ml', 'Instant Noodles Pack', 'Potato Chips 50g',
        'Biscuits Pack', 'Chocolate Bar', 'Nuts Mix 200g', 'Candy Jar',
      ],
    },
    {
      name: 'Punjab Distributors',
      phone: '041-3344556',
      address: 'Canal Rd, Faisalabad',
      products: ['Basmati Rice 5kg', 'Wheat Flour 10kg', 'Sugar 1kg', 'Cooking Oil 1L', 'Lentils 1kg', 'Pasta 500g'],
    },
    {
      name: 'HomeCare Imports',
      phone: '051-8899001',
      address: 'I-9 Industrial, Islamabad',
      products: [
        'Dish Soap 500ml', 'Laundry Detergent 1kg', 'Toilet Paper 4pk', 'Notebook A4',
        'Trash Bags 30ct', 'Hand Sanitizer 250ml',
      ],
    },
    {
      name: 'Dairy Fresh Ltd',
      phone: '042-2211000',
      address: 'Dairy Colony, Lahore',
      products: ['Fresh Milk 1L', 'Yogurt Cup', 'Cheese Slices', 'Butter 200g', 'Eggs Dozen'],
    },
    {
      name: 'National Spices Hub',
      phone: '021-6677889',
      address: 'Jodia Bazaar, Karachi',
      products: ['Red Chili Powder 200g', 'Turmeric 200g', 'Salt 800g', 'Tea Bags 100ct'],
    },
  ]

  const suppliers = supplierDefs.map((s, i) => ({
    id: uuidv4(),
    name: s.name,
    phone: s.phone,
    address: s.address,
    productNames: s.products,
    createdAt: isoAt(2025, 1, 2 + i, 14),
  }))

  db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, NULL, NULL, ?, ?, ?, 'owner', 1, ?)`,
    ).run(ownerId, 'Demo Owner', 'owner@kaarobar.test', passwordHash, shopOpenedAt)

    db.prepare(
      `INSERT INTO businesses (
         id, owner_id, name, currency, brand_color, business_nature, logo_path,
         receipt_header, receipt_footer,
         is_active, created_at, updated_at
       ) VALUES (?, ?, ?, 'USD', '#2d6df6', 'retail', NULL, ?, ?, 1, ?, ?)`,
    ).run(
      businessId,
      ownerId,
      'Kaarobar Test App',
      'Welcome to Kaarobar Test App',
      'Thank you for shopping with us',
      shopOpenedAt,
      shopOpenedAt,
    )

    db.prepare(
      `INSERT INTO branches (id, business_id, name, address, phone, is_main_branch, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?)`,
    ).run(branchId, businessId, 'Main Branch', '123 Test Street', '555-0100', shopOpenedAt)

    db.prepare(
      `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'admin', 1, ?)`,
    ).run(adminId, businessId, branchId, 'Demo Admin', 'admin@kaarobar.test', passwordHash, shopOpenedAt)

    db.prepare(
      `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'manager', 1, ?)`,
    ).run(managerId, businessId, branchId, 'Demo Manager', 'manager@kaarobar.test', passwordHash, shopOpenedAt)

    db.prepare(
      `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'cashier', 1, ?)`,
    ).run(cashierId, businessId, branchId, 'Demo Cashier', 'cashier@kaarobar.test', passwordHash, shopOpenedAt)

    db.prepare(
      `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'cashier', 1, ?)`,
    ).run(cashier2Id, businessId, branchId, 'Demo Cashier 2', 'cashier2@kaarobar.test', passwordHash, shopOpenedAt)

    db.prepare('INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)').run('', 'language', 'en')
    db.prepare('INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)').run(
      businessId,
      'receipt_footer',
      'Thank you for shopping with us',
    )
    db.prepare('INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)').run(
      businessId,
      'idle_lock_minutes',
      '10',
    )

    for (const [id, name] of [
      [catGrocery, 'Grocery'],
      [catDrinks, 'Drinks'],
      [catHousehold, 'Household'],
      [catSnacks, 'Snacks'],
      [catDairy, 'Dairy'],
      [catServices, 'Services'],
    ]) {
      db.prepare('INSERT INTO categories (id, business_id, name) VALUES (?, ?, ?)').run(id, businessId, name)
    }

    const insertProduct = db.prepare(
      `INSERT INTO products (
         id, business_id, branch_id, category_id, name, sku, barcode, price, cost_price,
         stock_qty, kind, tracks_stock, unit, image_path, is_active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'item', ?, 'pcs', NULL, 1, ?, ?)`,
    )
    for (const p of products) {
      insertProduct.run(
        p.id,
        businessId,
        branchId,
        p.categoryId,
        p.name,
        p.barcode,
        p.price,
        p.cost || null,
        p.stock,
        p.tracksStock,
        p.createdAt,
        p.createdAt,
      )
    }

    const insertCustomer = db.prepare(
      `INSERT INTO customers (
         id, business_id, name, phone, address, opening_balance, current_balance, is_active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, NULL, 0, 0, 1, ?, ?)`,
    )
    for (const c of customers) {
      insertCustomer.run(c.id, businessId, c.name, c.phone, c.createdAt, c.createdAt)
    }

    const insertSupplier = db.prepare(
      `INSERT INTO suppliers (id, business_id, name, phone, address, notes, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, 1, ?)`,
    )
    const insertSp = db.prepare(
      `INSERT INTO supplier_products (id, supplier_id, product_id, unit_cost, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    for (const s of suppliers) {
      insertSupplier.run(s.id, businessId, s.name, s.phone, s.address, s.createdAt)
      for (const name of s.productNames) {
        const p = byName[name]
        if (!p) continue
        insertSp.run(uuidv4(), s.id, p.id, p.cost, s.createdAt)
      }
    }

    const insertPo = db.prepare(
      `INSERT INTO purchase_orders (
         id, business_id, branch_id, supplier_id, po_number, status, order_date,
         expected_date, notes, created_by, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertPoItem = db.prepare(
      `INSERT INTO purchase_order_items (id, po_id, product_id, ordered_qty, received_qty, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const bumpStock = db.prepare(
      'UPDATE products SET stock_qty = stock_qty + ? WHERE id = ? AND tracks_stock = 1',
    )

    let poSeq = 1001
    let poCount = 0
    // Monthly restock POs from Jan 2025 through current month
    for (let y = 2025; y <= today.getUTCFullYear(); y++) {
      const monthStart = y === 2025 ? 1 : 1
      const monthEnd = y === today.getUTCFullYear() ? today.getUTCMonth() + 1 : 12
      for (let m = monthStart; m <= monthEnd; m++) {
        const supplier = suppliers[Math.floor(rand() * suppliers.length)]
        const day = 5 + Math.floor(rand() * 18)
        const safeDay = Math.min(day, daysInMonth(y, m))
        const isLatest = y === today.getUTCFullYear() && m === today.getUTCMonth() + 1
        const status = isLatest && rand() > 0.5 ? 'ordered' : 'received'
        const names = supplier.productNames.filter((n) => byName[n]?.tracksStock)
        const lineCount = Math.min(names.length, 3 + Math.floor(rand() * 4))
        const lines = []
        const used = new Set()
        while (lines.length < lineCount && used.size < names.length) {
          const name = names[Math.floor(rand() * names.length)]
          if (used.has(name)) continue
          used.add(name)
          const qty = 40 + Math.floor(rand() * 120)
          lines.push([name, qty])
        }
        if (!lines.length) continue

        const poId = uuidv4()
        const number = `PO-${poSeq++}`
        insertPo.run(
          poId,
          businessId,
          branchId,
          supplier.id,
          number,
          status,
          dateStr(y, m, safeDay),
          null,
          `${dateStr(y, m, 1)} restock`,
          ownerId,
          isoAt(y, m, safeDay, 10),
        )
        for (const [name, orderedQty] of lines) {
          const p = byName[name]
          const receivedQty = status === 'received' ? orderedQty : 0
          insertPoItem.run(uuidv4(), poId, p.id, orderedQty, receivedQty, p.cost, orderedQty * p.cost)
          if (receivedQty > 0) bumpStock.run(receivedQty, p.id)
        }
        poCount += 1

        // Extra mid-month PO every other month
        if (m % 2 === 0 && !isLatest) {
          const s2 = suppliers[Math.floor(rand() * suppliers.length)]
          const names2 = s2.productNames.filter((n) => byName[n]?.tracksStock)
          const lines2 = names2.slice(0, 3).map((name) => [name, 50 + Math.floor(rand() * 80)])
          if (!lines2.length) continue
          const poId2 = uuidv4()
          insertPo.run(
            poId2,
            businessId,
            branchId,
            s2.id,
            `PO-${poSeq++}`,
            'received',
            dateStr(y, m, 18),
            null,
            'Mid-month top-up',
            managerId,
            isoAt(y, m, 18, 15),
          )
          for (const [name, orderedQty] of lines2) {
            const p = byName[name]
            insertPoItem.run(uuidv4(), poId2, p.id, orderedQty, orderedQty, p.cost, orderedQty * p.cost)
            bumpStock.run(orderedQty, p.id)
          }
          poCount += 1
        }
      }
    }

    // One draft PO for current period
    {
      const s = suppliers[0]
      const poId = uuidv4()
      insertPo.run(
        poId,
        businessId,
        branchId,
        s.id,
        `PO-${poSeq++}`,
        'draft',
        dateStr(today.getUTCFullYear(), today.getUTCMonth() + 1, Math.min(28, today.getUTCDate())),
        null,
        'Draft upcoming order',
        ownerId,
        isoAt(today.getUTCFullYear(), today.getUTCMonth() + 1, Math.min(28, today.getUTCDate()), 16),
      )
      for (const name of s.productNames.slice(0, 3)) {
        const p = byName[name]
        if (!p?.tracksStock) continue
        insertPoItem.run(uuidv4(), poId, p.id, 30, 0, p.cost, 30 * p.cost)
      }
      poCount += 1
    }

    const insertSale = db.prepare(
      `INSERT INTO sales (
         id, business_id, branch_id, invoice_no, customer_id, cashier_id,
         subtotal, discount, tax, total, amount_paid, change_due, status,
         served_by_user_id, service_mode, table_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 'completed', NULL, NULL, NULL, ?)`,
    )
    const insertSaleItem = db.prepare(
      `INSERT INTO sale_items (
         id, sale_id, product_id, product_name_snapshot, qty, unit_price, discount, line_total, refunded_qty
       ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0)`,
    )
    const updateStock = db.prepare(
      'UPDATE products SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ? AND tracks_stock = 1',
    )
    const insertPayment = db.prepare(
      'INSERT INTO payments (id, sale_id, method, amount, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    const insertLedger = db.prepare(
      `INSERT INTO ledger_entries (
         id, customer_id, business_id, branch_id, type, amount, balance_after,
         reference_sale_id, note, created_by, created_at
       ) VALUES (?, ?, ?, ?, 'sale', ?, ?, ?, 'Sale on credit', ?, ?)`,
    )

    const cashiers = [ownerId, adminId, managerId, cashierId, cashier2Id]
    const namedCustomers = customers.filter((c) => c.name !== 'Walk-in Customer')
    let invoiceSeq = 1
    let saleCount = 0

    eachDay(2025, 1, 1, today, (y, m, day) => {
      const salesToday = 5 + Math.floor(rand() * 16) // 5–20
      for (let s = 0; s < salesToday; s++) {
        const hour = 8 + Math.floor(rand() * 12)
        const minute = Math.floor(rand() * 60)
        const createdAt = isoAt(y, m, day, hour, minute)
        const itemCount = 1 + Math.floor(rand() * 4)
        const lines = []
        const used = new Set()
        for (let i = 0; i < itemCount; i++) {
          const p = stockable[Math.floor(rand() * stockable.length)]
          if (used.has(p.id)) continue
          used.add(p.id)
          const qty = 1 + Math.floor(rand() * (p.price > 500 ? 2 : 4))
          lines.push({ product: p, qty })
        }
        if (!lines.length) continue

        const useNamed = rand() > 0.3
        const customer = useNamed
          ? namedCustomers[Math.floor(rand() * namedCustomers.length)]
          : null
        const subtotal = lines.reduce((sum, line) => sum + line.qty * line.product.price, 0)
        const discount = rand() > 0.88 ? Math.min(150, Math.round(subtotal * 0.05)) : 0
        const total = subtotal - discount
        const methodRoll = rand()
        let payments
        if (customer && methodRoll > 0.82) {
          payments = [{ method: 'credit', amount: total }]
        } else if (methodRoll > 0.55) {
          payments = [{ method: 'card', amount: total }]
        } else if (customer && methodRoll > 0.42 && total > 400) {
          const cashPart = Math.max(50, Math.round(total * 0.45))
          payments = [
            { method: 'cash', amount: cashPart },
            { method: 'credit', amount: total - cashPart },
          ]
        } else {
          payments = [{ method: 'cash', amount: total }]
        }

        const saleId = uuidv4()
        const invoice = formatInvoiceNumber('Kaarobar Test App', 'Main Branch', invoiceSeq++)
        const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0)
        const saleCashier = cashiers[Math.floor(rand() * cashiers.length)]

        insertSale.run(
          saleId,
          businessId,
          branchId,
          invoice,
          customer?.id ?? null,
          saleCashier,
          subtotal,
          discount,
          total,
          amountPaid,
          createdAt,
        )

        for (const line of lines) {
          insertSaleItem.run(
            uuidv4(),
            saleId,
            line.product.id,
            line.product.name,
            line.qty,
            line.product.price,
            line.qty * line.product.price,
          )
          updateStock.run(line.qty, line.product.id)
        }

        for (const payment of payments) {
          insertPayment.run(uuidv4(), saleId, payment.method, payment.amount, createdAt)
        }

        const creditAmount = payments
          .filter((p) => p.method === 'credit')
          .reduce((sum, p) => sum + p.amount, 0)
        if (customer && creditAmount > 0) {
          const row = db
            .prepare('SELECT current_balance FROM customers WHERE id = ?')
            .get(customer.id)
          const newBalance = row.current_balance + creditAmount
          db.prepare('UPDATE customers SET current_balance = ? WHERE id = ?').run(
            newBalance,
            customer.id,
          )
          insertLedger.run(
            uuidv4(),
            customer.id,
            businessId,
            branchId,
            creditAmount,
            newBalance,
            saleId,
            saleCashier,
            createdAt,
          )
        }

        saleCount += 1
      }
    })

    db.prepare(`UPDATE products SET stock_qty = 3 WHERE name = 'Dish Soap 500ml'`).run()

    console.log(
      `Seeded ${products.length} products, ${customers.length} customers, ${suppliers.length} suppliers, ${poCount} POs, ${saleCount} sales (2025-01-01 → ${dateStr(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate())})`,
    )
  })()
}

function resolveNativeBinding() {
  try {
    const packageJsonPath = require.resolve('better-sqlite3/package.json')
    const packageDir = path.dirname(packageJsonPath)
    const prebuildTarget = `${process.platform}-${process.arch}`
    const prebuildPath = path.join(packageDir, 'prebuilds', `${prebuildTarget}.node`)
    if (fs.existsSync(prebuildPath)) return prebuildPath
    const releaseBinding = path.join(packageDir, 'build', 'Release', 'better_sqlite3.node')
    if (fs.existsSync(releaseBinding)) return releaseBinding
  } catch {
    // default resolution
  }
  return undefined
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaarobar-test-backup-'))
  const dbPath = path.join(tmpDir, 'kaarobar.sqlite')
  const nativeBinding = resolveNativeBinding()
  const db = new Database(dbPath, nativeBinding ? { nativeBinding } : undefined)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  try {
    const schemaSql = loadSchemaSql()
    db.exec(schemaSql)

    const insertMigration = db.prepare(
      'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)',
    )
    const appliedAt = new Date().toISOString()
    for (const name of MIGRATION_NAMES) {
      insertMigration.run(name, appliedAt)
    }

    populateTestShop(db)
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.close()

    const sqliteBytes = fs.readFileSync(dbPath)
    const zip = new JSZip()
    zip.file(
      'manifest.json',
      JSON.stringify(
        {
          formatVersion: 2,
          app: 'kaarobar',
          createdAt: new Date().toISOString(),
          includes: ['db', 'files'],
        },
        null,
        2,
      ),
    )
    zip.file('db/kaarobar.sqlite', sqliteBytes)

    const archived = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
    const encrypted = encryptBackupPayload(Buffer.from(archived), 'kaarobar-dev-backup-secret')

    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, encrypted)
    console.log(`Wrote ${outPath} (${encrypted.length} bytes)`)
    console.log('Demo logins (password Password@123):')
    console.log('  owner@kaarobar.test    (Demo Owner)')
    console.log('  admin@kaarobar.test    (Demo Admin)')
    console.log('  manager@kaarobar.test  (Demo Manager)')
    console.log('  cashier@kaarobar.test  (Demo Cashier)')
    console.log('  cashier2@kaarobar.test (Demo Cashier 2)')
  } finally {
    try {
      db.close()
    } catch {
      // already closed
    }
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
