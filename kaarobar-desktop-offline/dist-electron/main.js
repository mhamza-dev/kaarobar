import { app as Xe, dialog as Uc, BrowserWindow as Gr, ipcMain as C, protocol as Pc } from "electron";
import { fileURLToPath as Zd } from "node:url";
import F from "node:path";
import tn from "fs";
import Jd from "path";
import Qd from "os";
import ef from "crypto";
import { createRequire as Js } from "node:module";
import M from "node:fs";
import { randomBytes as Bc, createCipheriv as Fc, createHash as Mc, randomUUID as $c, scryptSync as Hc, createDecipheriv as Xc } from "node:crypto";
import dr from "bcryptjs";
import tf from "better-sqlite3";
import rf from "electron-store";
import { execFileSync as Wc } from "node:child_process";
import Je from "node:os";
import Vr from "stream";
import nf from "events";
import zc from "buffer";
import lt from "util";
import Zr from "zlib";
import sf from "assert";
var ye = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function Qs(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var dt = { exports: {} };
const Is = tn, Xi = Jd, af = Qd, of = ef, Ma = [
  "◈ encrypted .env [www.dotenvx.com]",
  "◈ secrets for agents [www.dotenvx.com]",
  "⌁ auth for agents [www.vestauth.com]",
  "⌘ custom filepath { path: '/custom/path/.env' }",
  "⌘ enable debugging { debug: true }",
  "⌘ override existing { override: true }",
  "⌘ suppress logs { quiet: true }",
  "⌘ multiple files { path: ['.env.local', '.env'] }"
];
function cf() {
  return Ma[Math.floor(Math.random() * Ma.length)];
}
function nr(e) {
  return typeof e == "string" ? !["false", "0", "no", "off", ""].includes(e.toLowerCase()) : !!e;
}
function uf() {
  return process.stdout.isTTY;
}
function lf(e) {
  return uf() ? `\x1B[2m${e}\x1B[0m` : e;
}
const df = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
function ff(e) {
  const t = {};
  let r = e.toString();
  r = r.replace(/\r\n?/mg, `
`);
  let i;
  for (; (i = df.exec(r)) != null; ) {
    const s = i[1];
    let n = i[2] || "";
    n = n.trim();
    const a = n[0];
    n = n.replace(/^(['"`])([\s\S]*)\1$/mg, "$2"), a === '"' && (n = n.replace(/\\n/g, `
`), n = n.replace(/\\r/g, "\r")), t[s] = n;
  }
  return t;
}
function hf(e) {
  e = e || {};
  const t = Yc(e);
  e.path = t;
  const r = me.configDotenv(e);
  if (!r.parsed) {
    const a = new Error(`MISSING_DATA: Cannot parse ${t} for an unknown reason`);
    throw a.code = "MISSING_DATA", a;
  }
  const i = Kc(e).split(","), s = i.length;
  let n;
  for (let a = 0; a < s; a++)
    try {
      const o = i[a].trim(), c = _f(r, o);
      n = me.decrypt(c.ciphertext, c.key);
      break;
    } catch (o) {
      if (a + 1 >= s)
        throw o;
    }
  return me.parse(n);
}
function pf(e) {
  console.error(`⚠ ${e}`);
}
function Dr(e) {
  console.log(`┆ ${e}`);
}
function qc(e) {
  console.log(`◇ ${e}`);
}
function Kc(e) {
  return e && e.DOTENV_KEY && e.DOTENV_KEY.length > 0 ? e.DOTENV_KEY : process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0 ? process.env.DOTENV_KEY : "";
}
function _f(e, t) {
  let r;
  try {
    r = new URL(t);
  } catch (o) {
    if (o.code === "ERR_INVALID_URL") {
      const c = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
      throw c.code = "INVALID_DOTENV_KEY", c;
    }
    throw o;
  }
  const i = r.password;
  if (!i) {
    const o = new Error("INVALID_DOTENV_KEY: Missing key part");
    throw o.code = "INVALID_DOTENV_KEY", o;
  }
  const s = r.searchParams.get("environment");
  if (!s) {
    const o = new Error("INVALID_DOTENV_KEY: Missing environment part");
    throw o.code = "INVALID_DOTENV_KEY", o;
  }
  const n = `DOTENV_VAULT_${s.toUpperCase()}`, a = e.parsed[n];
  if (!a) {
    const o = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${n} in your .env.vault file.`);
    throw o.code = "NOT_FOUND_DOTENV_ENVIRONMENT", o;
  }
  return { ciphertext: a, key: i };
}
function Yc(e) {
  let t = null;
  if (e && e.path && e.path.length > 0)
    if (Array.isArray(e.path))
      for (const r of e.path)
        Is.existsSync(r) && (t = r.endsWith(".vault") ? r : `${r}.vault`);
    else
      t = e.path.endsWith(".vault") ? e.path : `${e.path}.vault`;
  else
    t = Xi.resolve(process.cwd(), ".env.vault");
  return Is.existsSync(t) ? t : null;
}
function $a(e) {
  return e[0] === "~" ? Xi.join(af.homedir(), e.slice(1)) : e;
}
function Ef(e) {
  const t = nr(process.env.DOTENV_CONFIG_DEBUG || e && e.debug), r = nr(process.env.DOTENV_CONFIG_QUIET || e && e.quiet);
  (t || !r) && qc("loading env from encrypted .env.vault");
  const i = me._parseVault(e);
  let s = process.env;
  return e && e.processEnv != null && (s = e.processEnv), me.populate(s, i, e), { parsed: i };
}
function mf(e) {
  const t = Xi.resolve(process.cwd(), ".env");
  let r = "utf8", i = process.env;
  e && e.processEnv != null && (i = e.processEnv);
  let s = nr(i.DOTENV_CONFIG_DEBUG || e && e.debug), n = nr(i.DOTENV_CONFIG_QUIET || e && e.quiet);
  e && e.encoding ? r = e.encoding : s && Dr("no encoding is specified (UTF-8 is used by default)");
  let a = [t];
  if (e && e.path)
    if (!Array.isArray(e.path))
      a = [$a(e.path)];
    else {
      a = [];
      for (const l of e.path)
        a.push($a(l));
    }
  let o;
  const c = {};
  for (const l of a)
    try {
      const p = me.parse(Is.readFileSync(l, { encoding: r }));
      me.populate(c, p, e);
    } catch (p) {
      s && Dr(`failed to load ${l} ${p.message}`), o = p;
    }
  const u = me.populate(i, c, e);
  if (s = nr(i.DOTENV_CONFIG_DEBUG || s), n = nr(i.DOTENV_CONFIG_QUIET || n), s || !n) {
    const l = Object.keys(u).length, p = [];
    for (const d of a)
      try {
        const f = Xi.relative(process.cwd(), d);
        p.push(f);
      } catch (f) {
        s && Dr(`failed to load ${d} ${f.message}`), o = f;
      }
    qc(`injected env (${l}) from ${p.join(",")} ${lf(`// tip: ${cf()}`)}`);
  }
  return o ? { parsed: c, error: o } : { parsed: c };
}
function Tf(e) {
  if (Kc(e).length === 0)
    return me.configDotenv(e);
  const t = Yc(e);
  return t ? me._configVault(e) : (pf(`you set DOTENV_KEY but you are missing a .env.vault file at ${t}`), me.configDotenv(e));
}
function gf(e, t) {
  const r = Buffer.from(t.slice(-64), "hex");
  let i = Buffer.from(e, "base64");
  const s = i.subarray(0, 12), n = i.subarray(-16);
  i = i.subarray(12, -16);
  try {
    const a = of.createDecipheriv("aes-256-gcm", r, s);
    return a.setAuthTag(n), `${a.update(i)}${a.final()}`;
  } catch (a) {
    const o = a instanceof RangeError, c = a.message === "Invalid key length", u = a.message === "Unsupported state or unable to authenticate data";
    if (o || c) {
      const l = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
      throw l.code = "INVALID_DOTENV_KEY", l;
    } else if (u) {
      const l = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
      throw l.code = "DECRYPTION_FAILED", l;
    } else
      throw a;
  }
}
function bf(e, t, r = {}) {
  const i = !!(r && r.debug), s = !!(r && r.override), n = {};
  if (typeof t != "object") {
    const a = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
    throw a.code = "OBJECT_REQUIRED", a;
  }
  for (const a of Object.keys(t))
    Object.prototype.hasOwnProperty.call(e, a) ? (s === !0 && (e[a] = t[a], n[a] = t[a]), i && Dr(s === !0 ? `"${a}" is already defined and WAS overwritten` : `"${a}" is already defined and was NOT overwritten`)) : (e[a] = t[a], n[a] = t[a]);
  return n;
}
const me = {
  configDotenv: mf,
  _configVault: Ef,
  _parseVault: hf,
  config: Tf,
  decrypt: gf,
  parse: ff,
  populate: bf
};
dt.exports.configDotenv = me.configDotenv;
dt.exports._configVault = me._configVault;
dt.exports._parseVault = me._parseVault;
dt.exports.config = me.config;
dt.exports.decrypt = me.decrypt;
dt.exports.parse = me.parse;
dt.exports.populate = me.populate;
dt.exports = me;
var vf = dt.exports;
const yf = /* @__PURE__ */ Qs(vf), A = {
  APP_GET_INFO: "app:getInfo",
  APP_PING: "app:ping",
  APP_GET_BOOT_STATE: "app:getBootState",
  APP_GET_BRAND_COLOR: "app:getBrandColor",
  APP_GET_LANGUAGE: "app:getLanguage",
  APP_SET_LANGUAGE: "app:setLanguage",
  APP_GET_LICENSE_STATUS: "app:getLicenseStatus",
  APP_GET_RESTOCK_ALERTS: "app:getRestockAlerts",
  REMINDERS_DAILY: "reminders:daily",
  REMINDERS_MAYBE_RUN: "reminders:maybeRunDaily",
  LICENSE_ACTIVATE: "license:activate",
  SETUP_COMPLETE: "setup:complete",
  SETUP_RESTORE_FROM_BACKUP: "setup:restoreFromBackup",
  AUTH_LOGIN: "auth:login",
  AUTH_RESET_OWNER_PASSWORD_OFFLINE: "auth:resetOwnerPasswordOffline",
  AUTH_LOGOUT: "auth:logout",
  AUTH_SESSION: "auth:session",
  BUSINESS_LIST: "business:list",
  BUSINESS_CREATE: "business:create",
  BUSINESS_UPDATE: "business:update",
  BUSINESS_SET_ACTIVE: "business:setActive",
  BRANCH_LIST: "branch:list",
  BRANCH_CREATE: "branch:create",
  BRANCH_UPDATE: "branch:update",
  USER_LIST: "user:list",
  USER_CREATE: "user:create",
  USER_UPDATE_SELF: "user:updateSelf",
  USER_SET_ACTIVE: "user:setActive",
  PRODUCT_LIST: "product:list",
  PRODUCT_CREATE: "product:create",
  PRODUCT_UPDATE: "product:update",
  PRODUCT_SET_ACTIVE: "product:setActive",
  PRODUCT_DELETE: "product:delete",
  PRODUCT_GENERATE_BARCODE: "product:generateBarcode",
  PRODUCT_ACTIVITY: "product:activity",
  PRODUCT_LIST_SUPPLIERS: "product:listSuppliers",
  SUPPLIER_LIST: "supplier:list",
  SUPPLIER_GET_DETAIL: "supplier:getDetail",
  SUPPLIER_CREATE: "supplier:create",
  SUPPLIER_UPDATE: "supplier:update",
  SUPPLIER_LIST_PRODUCTS: "supplier:listProducts",
  SUPPLIER_LINK_PRODUCT: "supplier:linkProduct",
  SUPPLIER_UNLINK_PRODUCT: "supplier:unlinkProduct",
  SUPPLIER_UPDATE_LINKED_PRODUCT: "supplier:updateLinkedProduct",
  PO_LIST: "po:list",
  PO_GET_DETAIL: "po:getDetail",
  PO_CREATE: "po:create",
  PO_PRINT: "po:print",
  CUSTOMER_LIST: "customer:list",
  CUSTOMER_GET_DETAIL: "customer:getDetail",
  CUSTOMER_CREATE: "customer:create",
  CUSTOMER_UPDATE: "customer:update",
  CUSTOMER_RECORD_PAYMENT: "customer:recordPayment",
  CUSTOMER_PRINT_LEDGER: "customer:printLedger",
  SALES_LIST: "sales:list",
  SALES_GET_DETAIL: "sales:getDetail",
  SALES_FIND_BY_INVOICE: "sales:findByInvoice",
  SALES_CREATE: "sales:create",
  SALES_REFUND_REQUEST: "sales:refundRequest",
  SALES_REFUND_REVIEW: "sales:refundReview",
  SALES_PRINT: "sales:print",
  PRINTER_LIST: "printer:list",
  PRINTER_GET_SETTINGS: "printer:getSettings",
  PRINTER_SET_SETTINGS: "printer:setSettings",
  PRINTER_TEST: "printer:test",
  TABLE_LIST: "table:list",
  TABLE_CREATE: "table:create",
  TABLE_UPDATE: "table:update",
  TICKET_LIST_OPEN: "ticket:listOpen",
  TICKET_GET: "ticket:get",
  TICKET_OPEN: "ticket:open",
  TICKET_SET_ITEMS: "ticket:setItems",
  TICKET_CANCEL: "ticket:cancel",
  TICKET_FIRE_ITEMS: "ticket:fireItems",
  TICKET_ASSIGN_RIDER: "ticket:assignRider",
  KITCHEN_LIST_ACTIVE: "kitchen:listActive",
  KITCHEN_BUMP: "kitchen:bump",
  KITCHEN_RECALL: "kitchen:recall",
  HAPPY_HOUR_LIST: "happyHour:list",
  HAPPY_HOUR_CREATE: "happyHour:create",
  HAPPY_HOUR_UPDATE: "happyHour:update",
  HAPPY_HOUR_SET_ACTIVE: "happyHour:setActive",
  HAPPY_HOUR_RESOLVE_PRICE: "happyHour:resolvePrice",
  SALES_UPDATE_DELIVERY: "sales:updateDelivery",
  ACTIVITY_LIST: "activity:list",
  ANALYTICS_SUMMARY: "analytics:summary",
  ASSETS_PICK_AND_SAVE: "assets:pickAndSave",
  BACKUP_CREATE: "backup:create",
  BACKUP_RESTORE: "backup:restore",
  BACKUP_PICK_FILE: "backup:pickFile",
  BACKUP_PROGRESS: "backup:progress",
  BACKUP_GET_AUTO_SETTINGS: "backup:getAutoSettings",
  BACKUP_SET_AUTO_SETTINGS: "backup:setAutoSettings"
};
function tt() {
  return F.join(Xe.getPath("appData"), "Kaarobar");
}
function ea() {
  return F.join(tt(), "assets");
}
let ke = null;
const wf = Js(import.meta.url);
function Sf() {
  var e, t, r;
  if (process.platform !== "linux") return !1;
  try {
    const i = (t = (e = process.report) == null ? void 0 : e.getReport) == null ? void 0 : t.call(e);
    return !((r = i == null ? void 0 : i.header) != null && r.glibcVersionRuntime);
  } catch {
    return !1;
  }
}
function Rf() {
  try {
    const e = wf.resolve("better-sqlite3/package.json"), t = F.dirname(e), r = `${Sf() ? "linuxmusl" : process.platform}-${process.arch}`, i = F.join(t, "prebuilds", `${r}.node`);
    if (M.existsSync(i)) return i;
    const s = F.join(t, "build", "Release", "better_sqlite3.node");
    if (M.existsSync(s)) return s;
    const n = F.join(t, "build", "Debug", "better_sqlite3.node");
    if (M.existsSync(n)) return n;
  } catch {
  }
}
function rn() {
  return F.join(tt(), "kaarobar.sqlite");
}
function nn() {
  return M.existsSync(rn());
}
function We() {
  if (ke) return ke;
  const e = rn();
  M.mkdirSync(F.dirname(e), { recursive: !0 });
  const t = Rf();
  if (!t)
    throw new Error(
      "better-sqlite3 native build is missing (prebuilds/*.node or build/Release/better_sqlite3.node). Run: npm run rebuild:native"
    );
  return ke = new tf(e, { nativeBinding: t }), ke.pragma("journal_mode = WAL"), ke.pragma("foreign_keys = ON"), ke;
}
function he() {
  if (!ke) throw new Error("Database is not open. Call openDatabase() first.");
  return ke;
}
function ta() {
  ke && (ke.close(), ke = null);
}
function sn() {
  return ke != null;
}
const Nf = `
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
`, If = [
  {
    name: "001_initial_schema",
    up: (e) => {
      e.exec(Nf);
    }
  },
  {
    name: "002_refunds_audit_updates",
    up: (e) => {
      e.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'activity_log'"
      ).get() || (e.pragma("foreign_keys = OFF"), e.exec(`
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
        `), e.pragma("foreign_keys = ON"), e.exec(`
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
        `)), e.prepare("PRAGMA table_info(sale_items)").all().some((i) => i.name === "refunded_qty") || e.exec(
        "ALTER TABLE sale_items ADD COLUMN refunded_qty REAL NOT NULL DEFAULT 0"
      );
    }
  },
  {
    name: "003_product_image",
    up: (e) => {
      e.prepare("PRAGMA table_info(products)").all().some((r) => r.name === "image_path") || e.exec("ALTER TABLE products ADD COLUMN image_path TEXT");
    }
  },
  {
    name: "004_business_socials",
    up: (e) => {
      const t = e.prepare("PRAGMA table_info(businesses)").all(), r = new Set(t.map((i) => i.name));
      for (const i of [
        "social_whatsapp",
        "social_instagram",
        "social_facebook",
        "social_tiktok",
        "social_website"
      ])
        r.has(i) || e.exec(`ALTER TABLE businesses ADD COLUMN ${i} TEXT`);
    }
  },
  {
    name: "005_supplier_products",
    up: (e) => {
      e.exec(`
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
      `);
    }
  },
  {
    name: "006_app_license",
    up: (e) => {
      e.exec(`
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
      `);
    }
  },
  {
    name: "007_user_profile_image",
    up: (e) => {
      e.prepare("PRAGMA table_info(users)").all().some((r) => r.name === "image_path") || e.exec("ALTER TABLE users ADD COLUMN image_path TEXT");
    }
  },
  {
    name: "008_analytics_indexes",
    up: (e) => {
      e.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_business_created_status ON sales(business_id, created_at, status);
        CREATE INDEX IF NOT EXISTS idx_customers_business_balance ON customers(business_id, is_active, current_balance);
        CREATE INDEX IF NOT EXISTS idx_products_business_active_stock ON products(business_id, is_active, stock_qty);
        ANALYZE;
      `);
    }
  },
  {
    name: "009_business_nature_pos",
    up: (e) => {
      e.prepare("PRAGMA table_info(businesses)").all().some((s) => s.name === "business_nature") || e.exec(
        "ALTER TABLE businesses ADD COLUMN business_nature TEXT NOT NULL DEFAULT 'retail'"
      );
      const r = e.prepare("PRAGMA table_info(products)").all();
      r.some((s) => s.name === "kind") || e.exec(
        "ALTER TABLE products ADD COLUMN kind TEXT NOT NULL DEFAULT 'item'"
      ), r.some((s) => s.name === "tracks_stock") || e.exec(
        "ALTER TABLE products ADD COLUMN tracks_stock INTEGER NOT NULL DEFAULT 1"
      );
      const i = e.prepare("PRAGMA table_info(sales)").all();
      i.some((s) => s.name === "served_by_user_id") || e.exec("ALTER TABLE sales ADD COLUMN served_by_user_id TEXT"), i.some((s) => s.name === "service_mode") || e.exec("ALTER TABLE sales ADD COLUMN service_mode TEXT"), i.some((s) => s.name === "table_id") || e.exec("ALTER TABLE sales ADD COLUMN table_id TEXT"), e.exec(`
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
      `);
    }
  },
  {
    name: "010_payment_method_credit",
    up: (e) => {
      e.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'payments'"
      ).get() && (e.pragma("foreign_keys = OFF"), e.exec(`
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
      `), e.pragma("foreign_keys = ON"));
    }
  },
  {
    name: "011_receipt_messages",
    up: (e) => {
      const t = e.prepare("PRAGMA table_info(businesses)").all(), r = new Set(t.map((i) => i.name));
      r.has("receipt_header") || e.exec("ALTER TABLE businesses ADD COLUMN receipt_header TEXT"), r.has("receipt_footer") || e.exec("ALTER TABLE businesses ADD COLUMN receipt_footer TEXT"), e.exec(`
        UPDATE businesses
        SET receipt_footer = (
          SELECT value FROM settings
          WHERE settings.business_id = businesses.id AND settings.key = 'receipt_footer'
          LIMIT 1
        )
        WHERE receipt_footer IS NULL OR trim(receipt_footer) = ''
      `), e.exec(`
        UPDATE businesses
        SET receipt_footer = 'Thank you for shopping with us'
        WHERE receipt_footer IS NULL OR trim(receipt_footer) = ''
      `);
    }
  },
  {
    name: "012_kot_split_rider_happy_hour",
    up: (e) => {
      e.prepare("PRAGMA table_info(products)").all().some((u) => u.name === "kitchen_station") || e.exec(
        "ALTER TABLE products ADD COLUMN kitchen_station TEXT NOT NULL DEFAULT 'main'"
      );
      const r = e.prepare("PRAGMA table_info(sales)").all(), i = new Set(r.map((u) => u.name));
      i.has("rider_user_id") || e.exec("ALTER TABLE sales ADD COLUMN rider_user_id TEXT"), i.has("delivery_status") || e.exec("ALTER TABLE sales ADD COLUMN delivery_status TEXT"), i.has("delivery_notes") || e.exec("ALTER TABLE sales ADD COLUMN delivery_notes TEXT");
      const s = e.prepare("PRAGMA table_info(pos_tickets)").all(), n = new Set(s.map((u) => u.name));
      n.has("rider_user_id") || e.exec("ALTER TABLE pos_tickets ADD COLUMN rider_user_id TEXT"), n.has("delivery_status") || e.exec("ALTER TABLE pos_tickets ADD COLUMN delivery_status TEXT"), n.has("delivery_notes") || e.exec("ALTER TABLE pos_tickets ADD COLUMN delivery_notes TEXT");
      const a = e.prepare("PRAGMA table_info(pos_ticket_items)").all(), o = new Set(a.map((u) => u.name));
      o.has("seat_no") || e.exec("ALTER TABLE pos_ticket_items ADD COLUMN seat_no INTEGER"), o.has("kitchen_status") || e.exec(
        "ALTER TABLE pos_ticket_items ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'held'"
      ), o.has("fired_at") || e.exec("ALTER TABLE pos_ticket_items ADD COLUMN fired_at TEXT"), o.has("bumped_at") || e.exec("ALTER TABLE pos_ticket_items ADD COLUMN bumped_at TEXT"), o.has("billed_qty") || e.exec(
        "ALTER TABLE pos_ticket_items ADD COLUMN billed_qty REAL NOT NULL DEFAULT 0"
      ), o.has("price_rule_id") || e.exec("ALTER TABLE pos_ticket_items ADD COLUMN price_rule_id TEXT"), e.prepare("PRAGMA table_info(sale_items)").all().some((u) => u.name === "price_rule_id") || e.exec("ALTER TABLE sale_items ADD COLUMN price_rule_id TEXT"), e.exec(`
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
        CREATE INDEX IF NOT EXISTS idx_pos_ticket_items_kitchen ON pos_ticket_items(kitchen_status);
      `);
    }
  },
  {
    name: "013_customer_address_starting_balance",
    up: (e) => {
      const t = e.prepare("PRAGMA table_info(customers)").all(), r = new Set(t.map((i) => i.name));
      r.has("address") || e.exec("ALTER TABLE customers ADD COLUMN address TEXT"), r.has("opening_balance") || e.exec(
        "ALTER TABLE customers ADD COLUMN opening_balance REAL NOT NULL DEFAULT 0"
      ), r.has("current_balance") || e.exec(
        "ALTER TABLE customers ADD COLUMN current_balance REAL NOT NULL DEFAULT 0"
      ), e.exec(`
        UPDATE customers
        SET opening_balance = COALESCE(opening_balance, 0),
            current_balance = COALESCE(current_balance, opening_balance, 0)
        WHERE opening_balance IS NULL OR current_balance IS NULL;
      `);
    }
  }
];
function ft(e) {
  e.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
  const t = e.prepare(
    "SELECT name FROM schema_migrations WHERE name = ?"
  ), r = e.prepare(
    "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)"
  );
  for (const i of If) {
    if (t.get(i.name)) continue;
    e.transaction(() => {
      i.up(e), r.run(i.name, (/* @__PURE__ */ new Date()).toISOString());
    })();
  }
}
const j = new rf({
  name: "kaarobar-config",
  cwd: tt(),
  defaults: {
    language: "en",
    lastBusinessId: null,
    licenseBlob: null,
    setupComplete: !1,
    autoBackupEnabled: !1,
    autoBackupTime: "22:00",
    lastAutoBackupAt: null,
    // On by default: this is a point-of-sale app, so a sale receipt should go to
    // the receipt printer. If POS printing fails for any reason the caller falls
    // back to the HTML preview window, which is the pre-existing behaviour.
    posPrintEnabled: !0,
    posPrinterName: "",
    posPaperWidth: "80mm",
    posSilent: !0,
    posCopies: 1
  }
}), Lf = /^([01]\d|2[0-3]):([0-5]\d)$/;
function ra(e) {
  return e && Lf.test(e) ? e : "22:00";
}
function ia() {
  return {
    autoBackupEnabled: !!j.get("autoBackupEnabled"),
    autoBackupTime: ra(j.get("autoBackupTime")),
    lastAutoBackupAt: j.get("lastAutoBackupAt") ?? null
  };
}
function Af(e) {
  return typeof e.autoBackupEnabled == "boolean" && j.set("autoBackupEnabled", e.autoBackupEnabled), e.autoBackupTime !== void 0 && j.set("autoBackupTime", ra(e.autoBackupTime)), ia();
}
function Cf(e = (/* @__PURE__ */ new Date()).toISOString()) {
  j.set("lastAutoBackupAt", e);
}
const Of = "", kf = "kaarobar-license-salt";
let pi = null, _i = null;
function xf() {
  if (_i) return _i;
  let e = "";
  try {
    const r = Je.networkInterfaces();
    e = Object.values(r).flatMap((i) => i ?? []).filter((i) => i && !i.internal && i.mac && i.mac !== "00:00:00:00:00:00").map((i) => i.mac).sort().join("|");
  } catch {
    e = "";
  }
  const t = [
    "kaarobar",
    Je.hostname(),
    Je.platform(),
    Je.arch(),
    Je.userInfo().username,
    e
  ].join("::");
  return _i = Mc("sha256").update(t).digest("hex"), _i;
}
function Df(e) {
  return Mc("sha256").update(`kaarobar::${e}`).digest("hex");
}
function Uf() {
  var e;
  try {
    const r = Wc("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
      encoding: "utf8",
      timeout: 5e3,
      windowsHide: !0
    }).match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    return ((e = r == null ? void 0 : r[1]) == null ? void 0 : e.trim()) || null;
  } catch {
    return null;
  }
}
function Pf() {
  var e;
  try {
    const r = Wc(
      "reg",
      ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      { encoding: "utf8", timeout: 5e3, windowsHide: !0 }
    ).match(/MachineGuid\s+REG_SZ\s+([0-9A-Fa-f-]+)/);
    return ((e = r == null ? void 0 : r[1]) == null ? void 0 : e.trim()) || null;
  } catch {
    return null;
  }
}
function Bf() {
  for (const e of ["/etc/machine-id", "/var/lib/dbus/machine-id"])
    try {
      const t = M.readFileSync(e, "utf8").trim();
      if (t) return t;
    } catch {
    }
  return null;
}
function Ff() {
  switch (Je.platform()) {
    case "darwin":
      return Uf();
    case "win32":
      return Pf();
    default:
      return Bf();
  }
}
function jc() {
  const e = Je.homedir();
  switch (Je.platform()) {
    case "darwin":
      return F.join(e, "Library", "Application Support", "2ndHub", "Kaarobar", "device.id");
    case "win32": {
      const t = process.env.PROGRAMDATA || "C:\\ProgramData";
      return F.join(t, "2ndHub", "Kaarobar", "device.id");
    }
    default:
      return F.join(e, ".local", "share", "2ndHub", "Kaarobar", "device.id");
  }
}
function Mf() {
  try {
    return M.readFileSync(jc(), "utf8").trim() || null;
  } catch {
    return null;
  }
}
function $f(e) {
  const t = jc();
  M.mkdirSync(F.dirname(t), { recursive: !0 }), M.writeFileSync(t, e, { encoding: "utf8", mode: 384 });
}
function Hf() {
  const e = Ff();
  if (e) return e;
  const t = Mf();
  if (t) return t;
  const r = $c();
  try {
    return $f(r), r;
  } catch {
    if (Je.platform() === "win32") {
      const i = F.join(
        process.env.LOCALAPPDATA || F.join(Je.homedir(), "AppData", "Local"),
        "2ndHub",
        "Kaarobar",
        "device.id"
      );
      try {
        const s = M.readFileSync(i, "utf8").trim();
        return s || (M.mkdirSync(F.dirname(i), { recursive: !0 }), M.writeFileSync(i, r, { encoding: "utf8", mode: 384 }), r);
      } catch {
        return r;
      }
    }
    return r;
  }
}
function Gc() {
  return pi || (pi = Df(Hf()), pi);
}
function Vc(e) {
  return Hc(`${Of}:${e}`, kf, 32);
}
function Zc(e) {
  const t = Vc(e.fingerprint), r = Bc(12), i = Fc("aes-256-gcm", t, r), s = Buffer.from(JSON.stringify(e), "utf8"), n = Buffer.concat([i.update(s), i.final()]), a = i.getAuthTag();
  return Buffer.concat([r, a, n]).toString("base64");
}
function Ha(e, t) {
  try {
    const r = Buffer.from(e, "base64"), i = r.subarray(0, 12), s = r.subarray(12, 28), n = r.subarray(28), a = Vc(t), o = Xc("aes-256-gcm", a, i);
    o.setAuthTag(s);
    const c = Buffer.concat([o.update(n), o.final()]).toString("utf8"), u = JSON.parse(c);
    return u.fingerprint === t ? u : null;
  } catch {
    return null;
  }
}
function Jc(e) {
  const t = Gc(), r = Ha(e, t);
  if (r) return { record: r, migratedFromLegacy: !1 };
  const i = xf();
  if (i === t) return null;
  const s = Ha(e, i);
  return s ? {
    record: {
      ...s,
      fingerprint: t
    },
    migratedFromLegacy: !0
  } : null;
}
function Xf(e, t = /* @__PURE__ */ new Date()) {
  return e.expiresAt ? new Date(e.expiresAt).getTime() < t.getTime() : !1;
}
let Dn = null;
const Ls = /* @__PURE__ */ new Set();
function Wf() {
  return null;
}
function zf(e) {
  const t = Zc(e);
  return j.set("licenseBlob", t), t;
}
function Qc(e, t) {
  if (!sn()) return;
  const r = (/* @__PURE__ */ new Date()).toISOString();
  he().prepare(
    `INSERT INTO app_license (id, license_key, expires_at, issued_to, fingerprint, activated_at, updated_at, blob)
       VALUES ('local', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         license_key = excluded.license_key,
         expires_at = excluded.expires_at,
         issued_to = excluded.issued_to,
         fingerprint = excluded.fingerprint,
         activated_at = excluded.activated_at,
         updated_at = excluded.updated_at,
         blob = excluded.blob`
  ).run(
    e.licenseKey,
    e.expiresAt,
    e.issuedTo,
    e.fingerprint,
    e.activatedAt,
    r,
    t
  );
}
function Wi(e) {
  const t = zf(e);
  Qc(e, t);
}
function qf(e) {
  e.mode !== "dev" && (!e.licenseKey || Ls.has(e.licenseKey) || Dn || (Dn = an(e.licenseKey).then((t) => {
    if (t.ok) {
      Ls.add(e.licenseKey);
      return;
    }
    t.error === "device_limit_reached" || t.error === "offline" || t.error;
  }).catch(() => {
  }).finally(() => {
    Dn = null;
  })));
}
function eu(e) {
  return e ? (e.migratedFromLegacy && (Wi(e.record), qf(e.record)), e.record) : null;
}
function zi() {
  if (!sn()) return;
  const e = na();
  if (!e) return;
  const t = j.get("licenseBlob") || Zc(e);
  Qc(e, t);
}
function Kf() {
  if (!sn()) return null;
  try {
    return he().prepare(
      `SELECT license_key, expires_at, issued_to, fingerprint, activated_at, blob
         FROM app_license WHERE id = 'local'`
    ).get() ?? null;
  } catch {
    return null;
  }
}
function Yf() {
  const e = j.get("licenseBlob");
  return e ? eu(Jc(e)) : null;
}
function jf(e) {
  const t = eu(Jc(e.blob));
  return t || {
    licenseKey: e.license_key,
    fingerprint: e.fingerprint,
    issuedTo: e.issued_to || "Licensed Customer",
    expiresAt: e.expires_at,
    maxDevices: 1,
    activatedAt: e.activated_at,
    lastVerifiedAt: e.activated_at,
    mode: "supabase"
  };
}
function na() {
  const e = Kf();
  if (e) return jf(e);
  const t = Yf();
  return t && sn() && Wi(t), t;
}
function qi() {
  const e = Tr();
  return e.status === "valid" ? e.record : null;
}
function Tr() {
  const e = na();
  return e != null && e.licenseKey ? Xf(e) ? { status: "expired", record: e } : { status: "valid", record: e } : { status: "none" };
}
function Gf(e) {
  const r = ["invalid_key", "revoked", "expired", "device_limit_reached"].find((s) => s === e);
  return r ? { ok: !1, error: r, message: {
    invalid_key: "This license key is not valid.",
    revoked: "This license has been revoked. Contact support.",
    expired: "This license has expired.",
    device_limit_reached: "This license has reached its device limit."
  }[r] } : { ok: !1, error: "unknown", message: `Activation failed: ${e}` };
}
async function an(e) {
  const t = e.trim(), r = Gc(), i = Wf();
  if (!i) {
    if (!Xe.isPackaged && t === "KAAROBAR-DEV-LOCAL") {
      const s = (/* @__PURE__ */ new Date()).toISOString(), n = {
        licenseKey: t,
        fingerprint: r,
        issuedTo: "Local Development",
        expiresAt: null,
        maxDevices: 1,
        activatedAt: s,
        lastVerifiedAt: s,
        mode: "dev"
      };
      return Wi(n), { ok: !0, issuedTo: n.issuedTo, expiresAt: null, maxDevices: 1, mode: "dev" };
    }
    return {
      ok: !1,
      error: "network_error",
      message: "License server is not configured. Set KAAROBAR_SUPABASE_URL and KAAROBAR_SUPABASE_ANON_KEY, or use KAAROBAR-DEV-LOCAL in development."
    };
  }
  try {
    const s = `${i.url.replace(/\/$/, "")}/rest/v1/rpc/validate_and_activate_license`, n = await fetch(s, {
      method: "POST",
      headers: {
        apikey: i.anonKey,
        Authorization: `Bearer ${i.anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_key: t,
        p_fingerprint: r
      })
    });
    if (!n.ok)
      return {
        ok: !1,
        error: "network_error",
        message: await n.text() || `License server request failed (${n.status})`
      };
    const a = await n.json();
    if (!(a != null && a.ok)) return Gf((a == null ? void 0 : a.error) ?? "unknown");
    const o = (/* @__PURE__ */ new Date()).toISOString(), c = {
      licenseKey: t,
      fingerprint: r,
      issuedTo: a.issuedTo ?? "Licensed Customer",
      expiresAt: a.expiresAt ?? null,
      maxDevices: a.maxDevices ?? 1,
      activatedAt: o,
      lastVerifiedAt: o,
      mode: "supabase"
    };
    return Wi(c), Ls.add(t), {
      ok: !0,
      issuedTo: c.issuedTo,
      expiresAt: c.expiresAt,
      maxDevices: c.maxDevices,
      mode: "supabase"
    };
  } catch (s) {
    const n = s instanceof Error ? s.message : "Network request failed", a = /fetch|network|ENOTFOUND|ECONNREFUSED/i.test(n);
    return {
      ok: !1,
      error: a ? "offline" : "network_error",
      message: a ? "No internet connection. License activation requires internet once." : n
    };
  }
}
let Bt = null;
function tu() {
  return Bt;
}
function ru() {
  return Bt = null, { ok: !0 };
}
function Vf(e) {
  try {
    We(), ft(he());
    const t = he().prepare(
      `SELECT id, business_id, branch_id, name, image_path, email, password_hash, role, is_active
         FROM users
         WHERE email = ?`
    ).get(e.email.trim().toLowerCase());
    if (!t)
      return { ok: !1, error: "invalid_credentials", message: "Email or password is incorrect." };
    if (!t.is_active)
      return { ok: !1, error: "inactive", message: "This account is inactive." };
    if (!dr.compareSync(e.password, t.password_hash))
      return { ok: !1, error: "invalid_credentials", message: "Email or password is incorrect." };
    const i = {
      id: t.id,
      name: t.name,
      email: t.email,
      role: t.role,
      businessId: t.business_id,
      branchId: t.branch_id,
      imagePath: t.image_path
    };
    return he().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), t.id), Bt = i, { ok: !0, user: i };
  } catch (t) {
    return {
      ok: !1,
      error: "unknown",
      message: t instanceof Error ? t.message : "Login failed"
    };
  }
}
function Zf(e) {
  const t = {
    ok: !1,
    error: "invalid_credentials",
    message: "Could not verify owner account details."
  };
  try {
    const r = e.email.trim().toLowerCase(), i = e.licenseKey.trim(), s = e.newPassword.trim();
    if (!r || !i || !s)
      return { ok: !1, error: "validation_failed", message: "All fields are required." };
    if (s.length < 8)
      return {
        ok: !1,
        error: "validation_failed",
        message: "Password must be at least 8 characters."
      };
    We(), ft(he());
    const n = Tr();
    if (n.status === "none")
      return {
        ok: !1,
        error: "not_configured",
        message: "License is not configured on this device."
      };
    if (n.status === "expired")
      return {
        ok: !1,
        error: "license_expired",
        message: "License has expired. Renew license before resetting password."
      };
    const a = na();
    if (!a || a.licenseKey !== i)
      return { ok: !1, error: "invalid_license", message: "License key is invalid for this device." };
    const o = he().prepare(
      `SELECT id
         FROM users
         WHERE role = 'owner' AND is_active = 1 AND email = ?`
    ).get(r);
    if (!o) return t;
    const c = dr.hashSync(s, 12);
    return he().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(c, o.id), (Bt == null ? void 0 : Bt.id) === o.id && (Bt = null), { ok: !0 };
  } catch (r) {
    return {
      ok: !1,
      error: "unknown",
      message: r instanceof Error ? r.message : "Password reset failed."
    };
  }
}
const Jf = {
  owner: [
    "business:edit",
    "branch:edit",
    "business:view",
    "users:manage",
    "products:edit",
    "products:view",
    "suppliers:edit",
    "purchaseOrders:edit",
    "customers:edit",
    "sales:checkout",
    "sales:refund_request",
    "sales:refund_approve",
    "sales:print",
    "tables:edit",
    "system:backup_create",
    "system:backup_restore"
  ],
  admin: [
    "business:edit",
    "branch:edit",
    "business:view",
    "users:manage",
    "products:edit",
    "products:view",
    "suppliers:edit",
    "purchaseOrders:edit",
    "customers:edit",
    "sales:checkout",
    "sales:refund_request",
    "sales:refund_approve",
    "sales:print",
    "tables:edit",
    "system:backup_create",
    "system:backup_restore"
  ],
  manager: [
    "business:view",
    "products:edit",
    "products:view",
    "suppliers:edit",
    "purchaseOrders:edit",
    "customers:edit",
    "sales:checkout",
    "sales:refund_request",
    "sales:refund_approve",
    "sales:print",
    "tables:edit",
    "system:backup_create"
  ],
  cashier: [
    "purchaseOrders:edit",
    "customers:edit",
    "sales:checkout",
    "sales:refund_request",
    "sales:print",
    "system:backup_create"
  ]
};
function Qf(e, t) {
  return e ? Jf[e.role].includes(t) : !1;
}
function ie() {
  const e = tu();
  if (!e) throw new Error("Not authenticated");
  return e;
}
function G() {
  if (Tr().status !== "valid")
    throw new Error("License expired");
}
function X(e) {
  const t = ie();
  if (!Qf(t, e)) throw new Error("Forbidden");
  return t;
}
function $(e) {
  const t = ie();
  if (t.role !== "owner" && t.businessId !== e)
    throw new Error("Forbidden business scope");
}
function gr(e) {
  const t = ie();
  if (!(t.role === "owner" || t.role === "admin") && t.branchId !== e)
    throw new Error("Forbidden branch scope");
}
function iu() {
  return ea();
}
function eh(e) {
  const t = F.join(iu(), e === "logo" ? "logos" : "products");
  return M.mkdirSync(t, { recursive: !0 }), t;
}
function Jr(e) {
  const t = e.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!t || t.includes(".."))
    throw new Error("Invalid asset path");
  const r = F.resolve(iu()), i = F.resolve(r, t), s = r.endsWith(F.sep) ? r : r + F.sep;
  if (i !== r && !i.startsWith(s))
    throw new Error("Invalid asset path");
  return i;
}
function th(e) {
  return e ? `kaarobar-asset:///${e.replace(/\\/g, "/").replace(/^\/+/, "")}` : null;
}
function rh(e) {
  switch (F.extname(e).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".png":
    default:
      return "image/png";
  }
}
function ih(e) {
  try {
    const t = new URL(e), r = decodeURIComponent(
      t.hostname ? `${t.hostname}${t.pathname}` : t.pathname
    ).replace(/^\/+/, ""), i = Jr(r);
    if (!M.existsSync(i))
      return new Response("Not found", { status: 404 });
    const s = M.readFileSync(i);
    return new Response(s, {
      status: 200,
      headers: {
        "Content-Type": rh(i),
        "Content-Length": String(s.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
async function nh(e) {
  X(e === "logo" ? "business:edit" : "products:edit");
  const t = await Uc.showOpenDialog({
    title: e === "logo" ? "Choose business logo" : "Choose product image",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
  });
  if (t.canceled || !t.filePaths[0]) return null;
  const r = t.filePaths[0], i = F.extname(r).toLowerCase() || ".png", s = `${$c()}${i}`, n = e === "logo" ? "logos" : "products", a = eh(e), o = F.join(a, s);
  M.copyFileSync(r, o);
  const c = `${n}/${s}`;
  return { relativePath: c, url: th(c) };
}
const sh = {
  PKR: "Rs",
  RS: "Rs",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
  SAR: "﷼",
  INR: "₹",
  BRL: "R$",
  TRY: "₺",
  IDR: "Rp",
  MXN: "MX$",
  CAD: "CA$",
  AUD: "A$",
  QAR: "QR",
  KWD: "KD",
  EGP: "E£",
  MYR: "RM",
  SGD: "S$"
};
function on(e) {
  const t = (e || "PKR").trim().toUpperCase();
  return sh[t] ?? t;
}
const ah = ["en", "ur", "de", "pt", "es", "fr", "ar"], oh = /* @__PURE__ */ new Set(["ur", "ar"]), ch = {
  en: "en-US",
  ur: "ur-PK",
  de: "de-DE",
  pt: "pt-BR",
  es: "es-ES",
  fr: "fr-FR",
  ar: "ar-SA"
};
function uh(e) {
  return ah.includes(e);
}
function Xt(e) {
  const t = e == null ? void 0 : e.trim().toLowerCase().split(/[-_]/)[0];
  return t && uh(t) ? t : "en";
}
function lh(e) {
  return oh.has(e);
}
function dh(e) {
  return ch[e];
}
function Ke() {
  return Xt(j.get("language"));
}
const fe = {
  en: "Powered by Kaarobar POS · 2ndHub Solutions",
  ur: "کاروبار POS · 2ndHub Solutions سے تقویت یافتہ",
  de: "Bereitgestellt von Kaarobar POS · 2ndHub Solutions",
  pt: "Desenvolvido por Kaarobar POS · 2ndHub Solutions",
  es: "Desarrollado por Kaarobar POS · 2ndHub Solutions",
  fr: "Propulsé par Kaarobar POS · 2ndHub Solutions",
  ar: "مدعوم من Kaarobar POS · 2ndHub Solutions"
}, fh = {
  en: {
    cashReceipt: "CASH RECEIPT",
    creditReceipt: "CREDIT RECEIPT",
    cardReceipt: "CARD / ONLINE RECEIPT",
    invoice: "Invoice",
    date: "Date",
    customer: "Customer",
    cashier: "Cashier",
    printedBy: "Printed by",
    description: "Description",
    price: "Price",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    change: "Change",
    tel: "Tel",
    followUs: "Follow us",
    thankYou: "THANK YOU!",
    customSoftwareSupport: "For custom software solutions, contact us at support.kaarobar@gmail.com or +93304757253",
    poweredBy: fe.en,
    cash: "Cash",
    card: "Card / Online",
    credit: "Credit"
  },
  ur: {
    cashReceipt: "نقد رسید",
    creditReceipt: "کریڈٹ رسید",
    cardReceipt: "کارڈ / آن لائن رسید",
    invoice: "انوائس",
    date: "تاریخ",
    customer: "کسٹمر",
    cashier: "کیشیئر",
    printedBy: "پرنٹ کرنے والا",
    description: "تفصیل",
    price: "قیمت",
    subtotal: "ذیلی کل",
    discount: "رعایت",
    total: "کل",
    change: "بقایا واپسی",
    tel: "فون",
    followUs: "ہمیں فالو کریں",
    thankYou: "شکریہ!",
    customSoftwareSupport: "اس طرح کے سسٹمز بنانے کے لیے رابطہ کریں: support.kaarobar@gmail.com یا +93304757253",
    poweredBy: fe.ur,
    cash: "نقد",
    card: "کارڈ / آن لائن",
    credit: "کریڈٹ"
  },
  de: {
    cashReceipt: "BARKWITTTUNG",
    creditReceipt: "KREDITBELEG",
    cardReceipt: "KARTEN- / ONLINE-BELEG",
    invoice: "Rechnung",
    date: "Datum",
    customer: "Kunde",
    cashier: "Kassierer",
    printedBy: "Gedruckt von",
    description: "Beschreibung",
    price: "Preis",
    subtotal: "Zwischensumme",
    discount: "Rabatt",
    total: "Gesamt",
    change: "Rückgeld",
    tel: "Tel",
    followUs: "Folgen Sie uns",
    thankYou: "VIELEN DANK!",
    customSoftwareSupport: "Für individuelle Software kontaktieren Sie uns unter support.kaarobar@gmail.com oder +93304757253",
    poweredBy: fe.de,
    cash: "Bar",
    card: "Karte / Online",
    credit: "Kredit"
  },
  pt: {
    cashReceipt: "RECIBO EM DINHEIRO",
    creditReceipt: "RECIBO CRÉDITO",
    cardReceipt: "RECIBO CARTÃO / ONLINE",
    invoice: "Fatura",
    date: "Data",
    customer: "Cliente",
    cashier: "Caixa",
    printedBy: "Impresso por",
    description: "Descrição",
    price: "Preço",
    subtotal: "Subtotal",
    discount: "Desconto",
    total: "Total",
    change: "Troco",
    tel: "Tel",
    followUs: "Siga-nos",
    thankYou: "OBRIGADO!",
    customSoftwareSupport: "Para soluções de software personalizadas, entre em contato em support.kaarobar@gmail.com ou +93304757253",
    poweredBy: fe.pt,
    cash: "Dinheiro",
    card: "Cartão / Online",
    credit: "Crédito"
  },
  es: {
    cashReceipt: "RECIBO EN EFECTIVO",
    creditReceipt: "RECIBO CRÉDITO",
    cardReceipt: "RECIBO TARJETA / EN LÍNEA",
    invoice: "Factura",
    date: "Fecha",
    customer: "Cliente",
    cashier: "Cajero",
    printedBy: "Impreso por",
    description: "Descripción",
    price: "Precio",
    subtotal: "Subtotal",
    discount: "Descuento",
    total: "Total",
    change: "Cambio",
    tel: "Tel",
    followUs: "Síguenos",
    thankYou: "¡GRACIAS!",
    customSoftwareSupport: "Para software a medida, contáctanos en support.kaarobar@gmail.com o +93304757253",
    poweredBy: fe.es,
    cash: "Efectivo",
    card: "Tarjeta / En línea",
    credit: "Crédito"
  },
  fr: {
    cashReceipt: "REÇU ESPÈCES",
    creditReceipt: "REÇU CRÉDIT",
    cardReceipt: "REÇU CARTE / EN LIGNE",
    invoice: "Facture",
    date: "Date",
    customer: "Client",
    cashier: "Caissier",
    printedBy: "Imprimé par",
    description: "Description",
    price: "Prix",
    subtotal: "Sous-total",
    discount: "Remise",
    total: "Total",
    change: "Monnaie",
    tel: "Tél",
    followUs: "Suivez-nous",
    thankYou: "MERCI !",
    customSoftwareSupport: "Pour un logiciel sur mesure, contactez-nous à support.kaarobar@gmail.com ou +93304757253",
    poweredBy: fe.fr,
    cash: "Espèces",
    card: "Carte / En ligne",
    credit: "Crédit"
  },
  ar: {
    cashReceipt: "إيصال نقدي",
    creditReceipt: "إيصال ائتمان",
    cardReceipt: "إيصال بطاقة / أونلاين",
    invoice: "فاتورة",
    date: "التاريخ",
    customer: "العميل",
    cashier: "أمين الصندوق",
    printedBy: "طُبع بواسطة",
    description: "الوصف",
    price: "السعر",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    total: "الإجمالي",
    change: "الباقي",
    tel: "هاتف",
    followUs: "تابعنا",
    thankYou: "شكراً لك!",
    customSoftwareSupport: "للحلول البرمجية حسب الطلب، تواصل معنا على support.kaarobar@gmail.com أو +93304757253",
    poweredBy: fe.ar,
    cash: "نقد",
    card: "بطاقة / أونلاين",
    credit: "ائتمان"
  }
}, hh = {
  en: {
    purchaseOrder: "PURCHASE ORDER",
    poNumber: "PO #",
    date: "Date",
    status: "Status",
    supplier: "Supplier",
    phone: "Phone",
    address: "Address",
    product: "Product",
    qty: "Qty",
    unitCost: "Unit cost",
    total: "Total",
    poweredBy: fe.en
  },
  ur: {
    purchaseOrder: "خریداری آرڈر",
    poNumber: "پی او #",
    date: "تاریخ",
    status: "حالت",
    supplier: "سپلائر",
    phone: "فون",
    address: "پتہ",
    product: "پروڈکٹ",
    qty: "مقدار",
    unitCost: "یونٹ لاگت",
    total: "کل",
    poweredBy: fe.ur
  },
  de: {
    purchaseOrder: "BESTELLUNG",
    poNumber: "PO #",
    date: "Datum",
    status: "Status",
    supplier: "Lieferant",
    phone: "Telefon",
    address: "Adresse",
    product: "Produkt",
    qty: "Menge",
    unitCost: "Stückkosten",
    total: "Gesamt",
    poweredBy: fe.de
  },
  pt: {
    purchaseOrder: "PEDIDO DE COMPRA",
    poNumber: "PC #",
    date: "Data",
    status: "Status",
    supplier: "Fornecedor",
    phone: "Telefone",
    address: "Endereço",
    product: "Produto",
    qty: "Qtd",
    unitCost: "Custo unitário",
    total: "Total",
    poweredBy: fe.pt
  },
  es: {
    purchaseOrder: "ORDEN DE COMPRA",
    poNumber: "OC #",
    date: "Fecha",
    status: "Estado",
    supplier: "Proveedor",
    phone: "Teléfono",
    address: "Dirección",
    product: "Producto",
    qty: "Cant",
    unitCost: "Costo unitario",
    total: "Total",
    poweredBy: fe.es
  },
  fr: {
    purchaseOrder: "BON DE COMMANDE",
    poNumber: "BC #",
    date: "Date",
    status: "Statut",
    supplier: "Fournisseur",
    phone: "Téléphone",
    address: "Adresse",
    product: "Produit",
    qty: "Qté",
    unitCost: "Coût unitaire",
    total: "Total",
    poweredBy: fe.fr
  },
  ar: {
    purchaseOrder: "أمر شراء",
    poNumber: "أمر شراء #",
    date: "التاريخ",
    status: "الحالة",
    supplier: "المورد",
    phone: "الهاتف",
    address: "العنوان",
    product: "المنتج",
    qty: "الكمية",
    unitCost: "تكلفة الوحدة",
    total: "الإجمالي",
    poweredBy: fe.ar
  }
}, ph = {
  en: {
    title: "CUSTOMER LEDGER",
    customer: "Customer",
    phone: "Phone",
    period: "Period",
    allEntries: "All entries",
    printedAt: "Printed",
    date: "Date",
    particulars: "Particulars",
    debit: "Debit",
    credit: "Credit",
    balance: "Balance",
    balanceBroughtForward: "Balance brought forward",
    totals: "Totals",
    closingBalance: "Closing balance",
    poweredBy: fe.en,
    sale: "Sale",
    payment: "Payment",
    adjustment: "Adjustment",
    opening: "Opening",
    cash: "Cash",
    card: "Card / Online"
  },
  ur: {
    title: "کسٹمر کریڈٹ",
    customer: "کسٹمر",
    phone: "فون",
    period: "مدت",
    allEntries: "تمام اندراجات",
    printedAt: "پرنٹ",
    date: "تاریخ",
    particulars: "تفصیل",
    debit: "ڈیبٹ",
    credit: "کریڈٹ",
    balance: "بیلنس",
    balanceBroughtForward: "پچھلا بیلنس",
    totals: "کل",
    closingBalance: "اختتامی بیلنس",
    poweredBy: fe.ur,
    sale: "فروخت",
    payment: "ادائیگی",
    adjustment: "ایڈجسٹمنٹ",
    opening: "ابتدائی",
    cash: "نقد",
    card: "کارڈ / آن لائن"
  },
  de: {
    title: "KUNDENKONTO",
    customer: "Kunde",
    phone: "Telefon",
    period: "Zeitraum",
    allEntries: "Alle Einträge",
    printedAt: "Gedruckt",
    date: "Datum",
    particulars: "Details",
    debit: "Soll",
    credit: "Haben",
    balance: "Saldo",
    balanceBroughtForward: "Saldo vorgetragen",
    totals: "Summen",
    closingBalance: "Abschlusssaldo",
    poweredBy: fe.de,
    sale: "Verkauf",
    payment: "Zahlung",
    adjustment: "Anpassung",
    opening: "Eröffnung",
    cash: "Bar",
    card: "Karte / Online"
  },
  pt: {
    title: "RAZÃO DO CLIENTE",
    customer: "Cliente",
    phone: "Telefone",
    period: "Período",
    allEntries: "Todos os lançamentos",
    printedAt: "Impresso",
    date: "Data",
    particulars: "Detalhes",
    debit: "Débito",
    credit: "Crédito",
    balance: "Saldo",
    balanceBroughtForward: "Saldo anterior",
    totals: "Totais",
    closingBalance: "Saldo final",
    poweredBy: fe.pt,
    sale: "Venda",
    payment: "Pagamento",
    adjustment: "Ajuste",
    opening: "Abertura",
    cash: "Dinheiro",
    card: "Cartão / Online"
  },
  es: {
    title: "LIBRO DEL CLIENTE",
    customer: "Cliente",
    phone: "Teléfono",
    period: "Período",
    allEntries: "Todos los asientos",
    printedAt: "Impreso",
    date: "Fecha",
    particulars: "Concepto",
    debit: "Débito",
    credit: "Crédito",
    balance: "Saldo",
    balanceBroughtForward: "Saldo anterior",
    totals: "Totales",
    closingBalance: "Saldo de cierre",
    poweredBy: fe.es,
    sale: "Venta",
    payment: "Pago",
    adjustment: "Ajuste",
    opening: "Apertura",
    cash: "Efectivo",
    card: "Tarjeta / En línea"
  },
  fr: {
    title: "GRAND LIVRE CLIENT",
    customer: "Client",
    phone: "Téléphone",
    period: "Période",
    allEntries: "Toutes les écritures",
    printedAt: "Imprimé",
    date: "Date",
    particulars: "Libellé",
    debit: "Débit",
    credit: "Crédit",
    balance: "Solde",
    balanceBroughtForward: "Solde reporté",
    totals: "Totaux",
    closingBalance: "Solde de clôture",
    poweredBy: fe.fr,
    sale: "Vente",
    payment: "Paiement",
    adjustment: "Ajustement",
    opening: "Ouverture",
    cash: "Espèces",
    card: "Carte / En ligne"
  },
  ar: {
    title: "دفتر العميل",
    customer: "العميل",
    phone: "الهاتف",
    period: "الفترة",
    allEntries: "كل القيود",
    printedAt: "طُبع",
    date: "التاريخ",
    particulars: "التفاصيل",
    debit: "مدين",
    credit: "دائن",
    balance: "الرصيد",
    balanceBroughtForward: "الرصيد المُرحَّل",
    totals: "الإجماليات",
    closingBalance: "الرصيد الختامي",
    poweredBy: fe.ar,
    sale: "بيع",
    payment: "دفعة",
    adjustment: "تعديل",
    opening: "افتتاحي",
    cash: "نقد",
    card: "بطاقة / أونلاين"
  }
};
function nu(e = Ke()) {
  return fh[e];
}
function _h(e = Ke()) {
  return hh[e];
}
function Eh(e = Ke()) {
  return ph[e];
}
const mh = {
  en: {
    print: "Print",
    close: "Close",
    previewHint: "Preview — print when ready"
  },
  ur: {
    print: "پرنٹ",
    close: "بند کریں",
    previewHint: "پیش منظر — تیار ہونے پر پرنٹ کریں"
  },
  de: {
    print: "Drucken",
    close: "Schließen",
    previewHint: "Vorschau — bei Bedarf drucken"
  },
  pt: {
    print: "Imprimir",
    close: "Fechar",
    previewHint: "Prévia — imprima quando estiver pronto"
  },
  es: {
    print: "Imprimir",
    close: "Cerrar",
    previewHint: "Vista previa — imprima cuando esté listo"
  },
  fr: {
    print: "Imprimer",
    close: "Fermer",
    previewHint: "Aperçu — imprimez quand vous êtes prêt"
  },
  ar: {
    print: "طباعة",
    close: "إغلاق",
    previewHint: "معاينة — اطبع عند الجاهزية"
  }
};
function Th(e = Ke()) {
  return mh[e];
}
function sa(e = Ke()) {
  const t = lh(e);
  return {
    lang: e,
    dir: t ? "rtl" : "ltr",
    fontFamily: t ? "'Noto Sans Arabic', 'Noto Naskh Arabic', ui-sans-serif, sans-serif" : "'Poppins', ui-sans-serif, sans-serif",
    fontLink: t ? "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap" : "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
  };
}
function Ki(e, t = Ke()) {
  try {
    return new Date(e).toLocaleString(dh(t));
  } catch {
    return e;
  }
}
const gh = '"Courier New", ui-monospace, monospace';
function Dt(e, t) {
  return `${e} ${t.toFixed(2)}`;
}
function Ei(e = "-") {
  return {
    type: "text",
    value: e.repeat(42),
    style: { fontFamily: gh, fontSize: "11px", textAlign: "center", margin: "2px 0" }
  };
}
function st(e, t = {}) {
  return {
    type: "text",
    value: e,
    style: {
      textAlign: "center",
      fontWeight: t.bold ? "700" : "400",
      fontSize: t.size ?? "12px",
      margin: "1px 0"
    }
  };
}
function Ge(e, t, r = {}) {
  return {
    type: "text",
    value: `<div style="display:flex;justify-content:space-between;gap:8px;">
      <span>${As(e)}</span><span>${As(t)}</span>
    </div>`,
    style: {
      fontSize: r.bold ? "14px" : "12px",
      fontWeight: r.bold ? "700" : "400",
      margin: "1px 0"
    }
  };
}
function As(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function bh(e, t) {
  const r = e.toLowerCase();
  return r === "cash" ? t.cash : r === "card" ? t.card : r === "credit" ? t.credit : e;
}
function vh(e, t = e.language ?? Ke()) {
  const r = nu(t), i = on(e.currency), s = Math.max(e.amountPaid - e.total, 0), n = [], a = e.logoPath ? Jr(e.logoPath) : null;
  a && M.existsSync(a) && n.push({
    type: "image",
    path: a,
    position: "center",
    width: "120px",
    style: { margin: "0 auto 4px" }
  }), n.push(st(e.businessName, { bold: !0, size: "16px" })), e.branchAddress && n.push(st(e.branchAddress, { size: "11px" })), e.branchPhone && n.push(st(`${r.tel} ${e.branchPhone}`, { size: "11px" })), e.receiptHeader && n.push(st(e.receiptHeader, { size: "11px" })), n.push(Ei("=")), n.push(Ge(r.invoice, e.invoiceNo, { bold: !0 })), n.push(Ge(r.date, Ki(e.createdAt, t))), e.customerName && n.push(Ge(r.customer, e.customerName)), e.cashierName && n.push(Ge(r.cashier, e.cashierName)), e.printedByName && e.printedByName !== e.cashierName && n.push(Ge(r.printedBy, e.printedByName)), n.push(Ei()), n.push({
    type: "table",
    style: { width: "100%", fontSize: "11px" },
    tableHeader: [r.description, r.price],
    tableHeaderStyle: {
      borderBottom: "1px solid #000",
      fontWeight: "700",
      textAlign: "left",
      fontSize: "11px"
    },
    tableBody: e.items.map((c) => [
      {
        type: "text",
        value: `${As(c.productName)}<br/><span style="font-size:10px">${c.qty} x ${Dt(i, c.unitPrice)}</span>`,
        style: { textAlign: "left", paddingRight: "6px" }
      },
      {
        type: "text",
        value: Dt(i, c.lineTotal),
        style: { textAlign: "right", whiteSpace: "nowrap" }
      }
    ]),
    tableBodyStyle: { fontSize: "11px", padding: "2px 0", verticalAlign: "top" }
  }), n.push(Ei()), e.discount > 0 && (n.push(Ge(r.subtotal, Dt(i, e.subtotal))), n.push(Ge(r.discount, `- ${Dt(i, e.discount)}`))), n.push(Ge(r.total, Dt(i, e.total), { bold: !0 }));
  for (const c of e.payments)
    n.push(Ge(bh(c.method, r), Dt(i, c.amount)));
  s > 0 && n.push(Ge(r.change, Dt(i, s))), n.push(Ei("=")), n.push({
    type: "barCode",
    value: e.invoiceNo.replace(/[^0-9A-Za-z]/g, "").slice(0, 20) || "0",
    height: "40",
    width: "2",
    displayValue: !0,
    fontsize: 10,
    position: "center"
  }), e.receiptFooter && n.push(st(e.receiptFooter, { size: "11px" })), n.push(st(r.thankYou, { bold: !0, size: "12px" }));
  const o = [
    e.socialWhatsapp,
    e.socialInstagram,
    e.socialFacebook,
    e.socialTiktok,
    e.socialWebsite
  ].filter((c) => !!c && c.trim().length > 0);
  if (o.length > 0) {
    n.push(st(r.followUs, { size: "10px" }));
    for (const c of o) n.push(st(c, { size: "10px" }));
  }
  return n.push(st(r.poweredBy + " Kaarobar", { size: "10px" })), n.push({ type: "text", value: " ", style: { margin: "0 0 18px" } }), n;
}
const yh = ["58mm", "76mm", "80mm"], Ui = {
  // Mirrors the store defaults — see electron/config/store.ts.
  posPrintEnabled: !0,
  posPrinterName: "",
  posPaperWidth: "80mm",
  posSilent: !0
};
function su(e) {
  return yh.includes(e) ? e : Ui.posPaperWidth;
}
function au(e) {
  const t = typeof e == "string" ? Number(e) : e;
  return typeof t != "number" || !Number.isFinite(t) ? 1 : Math.min(Math.max(Math.trunc(t), 1), 5);
}
function cn() {
  return {
    posPrintEnabled: j.get("posPrintEnabled") ?? Ui.posPrintEnabled,
    posPrinterName: j.get("posPrinterName") ?? Ui.posPrinterName,
    posPaperWidth: su(j.get("posPaperWidth")),
    posSilent: j.get("posSilent") ?? Ui.posSilent,
    posCopies: au(j.get("posCopies"))
  };
}
function wh(e) {
  return typeof e.posPrintEnabled == "boolean" && j.set("posPrintEnabled", e.posPrintEnabled), typeof e.posPrinterName == "string" && j.set("posPrinterName", e.posPrinterName.trim()), e.posPaperWidth !== void 0 && j.set("posPaperWidth", su(e.posPaperWidth)), typeof e.posSilent == "boolean" && j.set("posSilent", e.posSilent), e.posCopies !== void 0 && j.set("posCopies", au(e.posCopies)), cn();
}
const Sh = Js(import.meta.url), { PosPrinter: Rh } = Sh("electron-pos-printer");
async function Nh() {
  const e = Gr.getAllWindows()[0];
  return e ? (await e.webContents.getPrintersAsync()).map((r) => {
    var n, a;
    const i = r, s = i.isDefault === !0 || ((n = i.options) == null ? void 0 : n["printer-is-default"]) === !0 || ((a = i.options) == null ? void 0 : a["is-default"]) === "true";
    return {
      name: i.name,
      displayName: i.displayName || i.name,
      description: i.description || "",
      isDefault: s
    };
  }) : [];
}
async function Ih(e) {
  const t = cn(), r = vh(e);
  await Rh.print(r, {
    printerName: t.posPrinterName || void 0,
    // `silent` needs a printerName to be meaningful; without one the OS default
    // is used, which is still what a single-printer till wants.
    silent: t.posSilent,
    preview: !1,
    copies: t.posCopies,
    pageSize: t.posPaperWidth,
    margin: "0 0 0 0",
    // The library waits `data.length * timeOutPerLine` ms before resolving.
    // Receipts are short, so keep this small or every sale blocks the till.
    timeOutPerLine: 400
  });
}
const ve = [];
for (let e = 0; e < 256; ++e)
  ve.push((e + 256).toString(16).slice(1));
function Lh(e, t = 0) {
  return (ve[e[t + 0]] + ve[e[t + 1]] + ve[e[t + 2]] + ve[e[t + 3]] + "-" + ve[e[t + 4]] + ve[e[t + 5]] + "-" + ve[e[t + 6]] + ve[e[t + 7]] + "-" + ve[e[t + 8]] + ve[e[t + 9]] + "-" + ve[e[t + 10]] + ve[e[t + 11]] + ve[e[t + 12]] + ve[e[t + 13]] + ve[e[t + 14]] + ve[e[t + 15]]).toLowerCase();
}
const Ah = new Uint8Array(16);
function Ch() {
  return crypto.getRandomValues(Ah);
}
function ae(e, t, r) {
  return crypto.randomUUID ? crypto.randomUUID() : Oh(e);
}
function Oh(e, t, r) {
  var s;
  e = e || {};
  const i = e.random ?? ((s = e.rng) == null ? void 0 : s.call(e)) ?? Ch();
  if (i.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return i[6] = i[6] & 15 | 64, i[8] = i[8] & 63 | 128, Lh(i);
}
var br = {}, Un = {}, pe = {}, mi = { exports: {} }, Ti = { exports: {} }, Xa;
function un() {
  if (Xa) return Ti.exports;
  Xa = 1, typeof process > "u" || !process.version || process.version.indexOf("v0.") === 0 || process.version.indexOf("v1.") === 0 && process.version.indexOf("v1.8.") !== 0 ? Ti.exports = { nextTick: e } : Ti.exports = process;
  function e(t, r, i, s) {
    if (typeof t != "function")
      throw new TypeError('"callback" argument must be a function');
    var n = arguments.length, a, o;
    switch (n) {
      case 0:
      case 1:
        return process.nextTick(t);
      case 2:
        return process.nextTick(function() {
          t.call(null, r);
        });
      case 3:
        return process.nextTick(function() {
          t.call(null, r, i);
        });
      case 4:
        return process.nextTick(function() {
          t.call(null, r, i, s);
        });
      default:
        for (a = new Array(n - 1), o = 0; o < a.length; )
          a[o++] = arguments[o];
        return process.nextTick(function() {
          t.apply(null, a);
        });
    }
  }
  return Ti.exports;
}
var Pn, Wa;
function kh() {
  if (Wa) return Pn;
  Wa = 1;
  var e = {}.toString;
  return Pn = Array.isArray || function(t) {
    return e.call(t) == "[object Array]";
  }, Pn;
}
var Bn, za;
function ou() {
  return za || (za = 1, Bn = Vr), Bn;
}
var gi = { exports: {} }, qa;
function ln() {
  return qa || (qa = 1, function(e, t) {
    var r = zc, i = r.Buffer;
    function s(a, o) {
      for (var c in a)
        o[c] = a[c];
    }
    i.from && i.alloc && i.allocUnsafe && i.allocUnsafeSlow ? e.exports = r : (s(r, t), t.Buffer = n);
    function n(a, o, c) {
      return i(a, o, c);
    }
    s(i, n), n.from = function(a, o, c) {
      if (typeof a == "number")
        throw new TypeError("Argument must not be a number");
      return i(a, o, c);
    }, n.alloc = function(a, o, c) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      var u = i(a);
      return o !== void 0 ? typeof c == "string" ? u.fill(o, c) : u.fill(o) : u.fill(0), u;
    }, n.allocUnsafe = function(a) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      return i(a);
    }, n.allocUnsafeSlow = function(a) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      return r.SlowBuffer(a);
    };
  }(gi, gi.exports)), gi.exports;
}
var be = {}, Ka;
function Qr() {
  if (Ka) return be;
  Ka = 1;
  function e(E) {
    return Array.isArray ? Array.isArray(E) : _(E) === "[object Array]";
  }
  be.isArray = e;
  function t(E) {
    return typeof E == "boolean";
  }
  be.isBoolean = t;
  function r(E) {
    return E === null;
  }
  be.isNull = r;
  function i(E) {
    return E == null;
  }
  be.isNullOrUndefined = i;
  function s(E) {
    return typeof E == "number";
  }
  be.isNumber = s;
  function n(E) {
    return typeof E == "string";
  }
  be.isString = n;
  function a(E) {
    return typeof E == "symbol";
  }
  be.isSymbol = a;
  function o(E) {
    return E === void 0;
  }
  be.isUndefined = o;
  function c(E) {
    return _(E) === "[object RegExp]";
  }
  be.isRegExp = c;
  function u(E) {
    return typeof E == "object" && E !== null;
  }
  be.isObject = u;
  function l(E) {
    return _(E) === "[object Date]";
  }
  be.isDate = l;
  function p(E) {
    return _(E) === "[object Error]" || E instanceof Error;
  }
  be.isError = p;
  function d(E) {
    return typeof E == "function";
  }
  be.isFunction = d;
  function f(E) {
    return E === null || typeof E == "boolean" || typeof E == "number" || typeof E == "string" || typeof E == "symbol" || // ES6 symbol
    typeof E > "u";
  }
  be.isPrimitive = f, be.isBuffer = Buffer.isBuffer;
  function _(E) {
    return Object.prototype.toString.call(E);
  }
  return be;
}
var bi = { exports: {} }, vi = { exports: {} }, Ya;
function xh() {
  return Ya || (Ya = 1, typeof Object.create == "function" ? vi.exports = function(t, r) {
    r && (t.super_ = r, t.prototype = Object.create(r.prototype, {
      constructor: {
        value: t,
        enumerable: !1,
        writable: !0,
        configurable: !0
      }
    }));
  } : vi.exports = function(t, r) {
    if (r) {
      t.super_ = r;
      var i = function() {
      };
      i.prototype = r.prototype, t.prototype = new i(), t.prototype.constructor = t;
    }
  }), vi.exports;
}
var ja;
function ei() {
  if (ja) return bi.exports;
  ja = 1;
  try {
    var e = require("util");
    if (typeof e.inherits != "function") throw "";
    bi.exports = e.inherits;
  } catch {
    bi.exports = xh();
  }
  return bi.exports;
}
var Fn = { exports: {} }, Ga;
function Dh() {
  return Ga || (Ga = 1, function(e) {
    function t(n, a) {
      if (!(n instanceof a))
        throw new TypeError("Cannot call a class as a function");
    }
    var r = ln().Buffer, i = lt;
    function s(n, a, o) {
      n.copy(a, o);
    }
    e.exports = function() {
      function n() {
        t(this, n), this.head = null, this.tail = null, this.length = 0;
      }
      return n.prototype.push = function(o) {
        var c = { data: o, next: null };
        this.length > 0 ? this.tail.next = c : this.head = c, this.tail = c, ++this.length;
      }, n.prototype.unshift = function(o) {
        var c = { data: o, next: this.head };
        this.length === 0 && (this.tail = c), this.head = c, ++this.length;
      }, n.prototype.shift = function() {
        if (this.length !== 0) {
          var o = this.head.data;
          return this.length === 1 ? this.head = this.tail = null : this.head = this.head.next, --this.length, o;
        }
      }, n.prototype.clear = function() {
        this.head = this.tail = null, this.length = 0;
      }, n.prototype.join = function(o) {
        if (this.length === 0) return "";
        for (var c = this.head, u = "" + c.data; c = c.next; )
          u += o + c.data;
        return u;
      }, n.prototype.concat = function(o) {
        if (this.length === 0) return r.alloc(0);
        for (var c = r.allocUnsafe(o >>> 0), u = this.head, l = 0; u; )
          s(u.data, c, l), l += u.data.length, u = u.next;
        return c;
      }, n;
    }(), i && i.inspect && i.inspect.custom && (e.exports.prototype[i.inspect.custom] = function() {
      var n = i.inspect({ length: this.length });
      return this.constructor.name + " " + n;
    });
  }(Fn)), Fn.exports;
}
var Mn, Va;
function cu() {
  if (Va) return Mn;
  Va = 1;
  var e = un();
  function t(s, n) {
    var a = this, o = this._readableState && this._readableState.destroyed, c = this._writableState && this._writableState.destroyed;
    return o || c ? (n ? n(s) : s && (this._writableState ? this._writableState.errorEmitted || (this._writableState.errorEmitted = !0, e.nextTick(i, this, s)) : e.nextTick(i, this, s)), this) : (this._readableState && (this._readableState.destroyed = !0), this._writableState && (this._writableState.destroyed = !0), this._destroy(s || null, function(u) {
      !n && u ? a._writableState ? a._writableState.errorEmitted || (a._writableState.errorEmitted = !0, e.nextTick(i, a, u)) : e.nextTick(i, a, u) : n && n(u);
    }), this);
  }
  function r() {
    this._readableState && (this._readableState.destroyed = !1, this._readableState.reading = !1, this._readableState.ended = !1, this._readableState.endEmitted = !1), this._writableState && (this._writableState.destroyed = !1, this._writableState.ended = !1, this._writableState.ending = !1, this._writableState.finalCalled = !1, this._writableState.prefinished = !1, this._writableState.finished = !1, this._writableState.errorEmitted = !1);
  }
  function i(s, n) {
    s.emit("error", n);
  }
  return Mn = {
    destroy: t,
    undestroy: r
  }, Mn;
}
var $n, Za;
function Uh() {
  return Za || (Za = 1, $n = lt.deprecate), $n;
}
var Hn, Ja;
function uu() {
  if (Ja) return Hn;
  Ja = 1;
  var e = un();
  Hn = E;
  function t(R) {
    var N = this;
    this.next = null, this.entry = null, this.finish = function() {
      Jt(N, R);
    };
  }
  var r = !process.browser && ["v0.10", "v0.9."].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : e.nextTick, i;
  E.WritableState = f;
  var s = Object.create(Qr());
  s.inherits = ei();
  var n = {
    deprecate: Uh()
  }, a = ou(), o = ln().Buffer, c = (typeof ye < "u" ? ye : typeof window < "u" ? window : typeof self < "u" ? self : {}).Uint8Array || function() {
  };
  function u(R) {
    return o.from(R);
  }
  function l(R) {
    return o.isBuffer(R) || R instanceof c;
  }
  var p = cu();
  s.inherits(E, a);
  function d() {
  }
  function f(R, N) {
    i = i || fr(), R = R || {};
    var x = N instanceof i;
    this.objectMode = !!R.objectMode, x && (this.objectMode = this.objectMode || !!R.writableObjectMode);
    var W = R.highWaterMark, V = R.writableHighWaterMark, Q = this.objectMode ? 16 : 16 * 1024;
    W || W === 0 ? this.highWaterMark = W : x && (V || V === 0) ? this.highWaterMark = V : this.highWaterMark = Q, this.highWaterMark = Math.floor(this.highWaterMark), this.finalCalled = !1, this.needDrain = !1, this.ending = !1, this.ended = !1, this.finished = !1, this.destroyed = !1;
    var Me = R.decodeStrings === !1;
    this.decodeStrings = !Me, this.defaultEncoding = R.defaultEncoding || "utf8", this.length = 0, this.writing = !1, this.corked = 0, this.sync = !0, this.bufferProcessing = !1, this.onwrite = function($e) {
      I(N, $e);
    }, this.writecb = null, this.writelen = 0, this.bufferedRequest = null, this.lastBufferedRequest = null, this.pendingcb = 0, this.prefinished = !1, this.errorEmitted = !1, this.bufferedRequestCount = 0, this.corkedRequestsFree = new t(this);
  }
  f.prototype.getBuffer = function() {
    for (var N = this.bufferedRequest, x = []; N; )
      x.push(N), N = N.next;
    return x;
  }, function() {
    try {
      Object.defineProperty(f.prototype, "buffer", {
        get: n.deprecate(function() {
          return this.getBuffer();
        }, "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.", "DEP0003")
      });
    } catch {
    }
  }();
  var _;
  typeof Symbol == "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] == "function" ? (_ = Function.prototype[Symbol.hasInstance], Object.defineProperty(E, Symbol.hasInstance, {
    value: function(R) {
      return _.call(this, R) ? !0 : this !== E ? !1 : R && R._writableState instanceof f;
    }
  })) : _ = function(R) {
    return R instanceof this;
  };
  function E(R) {
    if (i = i || fr(), !_.call(E, this) && !(this instanceof i))
      return new E(R);
    this._writableState = new f(R, this), this.writable = !0, R && (typeof R.write == "function" && (this._write = R.write), typeof R.writev == "function" && (this._writev = R.writev), typeof R.destroy == "function" && (this._destroy = R.destroy), typeof R.final == "function" && (this._final = R.final)), a.call(this);
  }
  E.prototype.pipe = function() {
    this.emit("error", new Error("Cannot pipe, not readable"));
  };
  function w(R, N) {
    var x = new Error("write after end");
    R.emit("error", x), e.nextTick(N, x);
  }
  function h(R, N, x, W) {
    var V = !0, Q = !1;
    return x === null ? Q = new TypeError("May not write null values to stream") : typeof x != "string" && x !== void 0 && !N.objectMode && (Q = new TypeError("Invalid non-string/buffer chunk")), Q && (R.emit("error", Q), e.nextTick(W, Q), V = !1), V;
  }
  E.prototype.write = function(R, N, x) {
    var W = this._writableState, V = !1, Q = !W.objectMode && l(R);
    return Q && !o.isBuffer(R) && (R = u(R)), typeof N == "function" && (x = N, N = null), Q ? N = "buffer" : N || (N = W.defaultEncoding), typeof x != "function" && (x = d), W.ended ? w(this, x) : (Q || h(this, W, R, x)) && (W.pendingcb++, V = b(this, W, Q, R, N, x)), V;
  }, E.prototype.cork = function() {
    var R = this._writableState;
    R.corked++;
  }, E.prototype.uncork = function() {
    var R = this._writableState;
    R.corked && (R.corked--, !R.writing && !R.corked && !R.bufferProcessing && R.bufferedRequest && H(this, R));
  }, E.prototype.setDefaultEncoding = function(N) {
    if (typeof N == "string" && (N = N.toLowerCase()), !(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((N + "").toLowerCase()) > -1)) throw new TypeError("Unknown encoding: " + N);
    return this._writableState.defaultEncoding = N, this;
  };
  function m(R, N, x) {
    return !R.objectMode && R.decodeStrings !== !1 && typeof N == "string" && (N = o.from(N, x)), N;
  }
  Object.defineProperty(E.prototype, "writableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: !1,
    get: function() {
      return this._writableState.highWaterMark;
    }
  });
  function b(R, N, x, W, V, Q) {
    if (!x) {
      var Me = m(N, W, V);
      W !== Me && (x = !0, V = "buffer", W = Me);
    }
    var $e = N.objectMode ? 1 : W.length;
    N.length += $e;
    var kt = N.length < N.highWaterMark;
    if (kt || (N.needDrain = !0), N.writing || N.corked) {
      var xt = N.lastBufferedRequest;
      N.lastBufferedRequest = {
        chunk: W,
        encoding: V,
        isBuf: x,
        callback: Q,
        next: null
      }, xt ? xt.next = N.lastBufferedRequest : N.bufferedRequest = N.lastBufferedRequest, N.bufferedRequestCount += 1;
    } else
      v(R, N, !1, $e, W, V, Q);
    return kt;
  }
  function v(R, N, x, W, V, Q, Me) {
    N.writelen = W, N.writecb = Me, N.writing = !0, N.sync = !0, x ? R._writev(V, N.onwrite) : R._write(V, Q, N.onwrite), N.sync = !1;
  }
  function S(R, N, x, W, V) {
    --N.pendingcb, x ? (e.nextTick(V, W), e.nextTick(ge, R, N), R._writableState.errorEmitted = !0, R.emit("error", W)) : (V(W), R._writableState.errorEmitted = !0, R.emit("error", W), ge(R, N));
  }
  function L(R) {
    R.writing = !1, R.writecb = null, R.length -= R.writelen, R.writelen = 0;
  }
  function I(R, N) {
    var x = R._writableState, W = x.sync, V = x.writecb;
    if (L(x), N) S(R, x, W, N, V);
    else {
      var Q = D(x);
      !Q && !x.corked && !x.bufferProcessing && x.bufferedRequest && H(R, x), W ? r(O, R, x, Q, V) : O(R, x, Q, V);
    }
  }
  function O(R, N, x, W) {
    x || P(R, N), N.pendingcb--, W(), ge(R, N);
  }
  function P(R, N) {
    N.length === 0 && N.needDrain && (N.needDrain = !1, R.emit("drain"));
  }
  function H(R, N) {
    N.bufferProcessing = !0;
    var x = N.bufferedRequest;
    if (R._writev && x && x.next) {
      var W = N.bufferedRequestCount, V = new Array(W), Q = N.corkedRequestsFree;
      Q.entry = x;
      for (var Me = 0, $e = !0; x; )
        V[Me] = x, x.isBuf || ($e = !1), x = x.next, Me += 1;
      V.allBuffers = $e, v(R, N, !0, N.length, V, "", Q.finish), N.pendingcb++, N.lastBufferedRequest = null, Q.next ? (N.corkedRequestsFree = Q.next, Q.next = null) : N.corkedRequestsFree = new t(N), N.bufferedRequestCount = 0;
    } else {
      for (; x; ) {
        var kt = x.chunk, xt = x.encoding, T = x.callback, g = N.objectMode ? 1 : kt.length;
        if (v(R, N, !1, g, kt, xt, T), x = x.next, N.bufferedRequestCount--, N.writing)
          break;
      }
      x === null && (N.lastBufferedRequest = null);
    }
    N.bufferedRequest = x, N.bufferProcessing = !1;
  }
  E.prototype._write = function(R, N, x) {
    x(new Error("_write() is not implemented"));
  }, E.prototype._writev = null, E.prototype.end = function(R, N, x) {
    var W = this._writableState;
    typeof R == "function" ? (x = R, R = null, N = null) : typeof N == "function" && (x = N, N = null), R != null && this.write(R, N), W.corked && (W.corked = 1, this.uncork()), W.ending || _t(this, W, x);
  };
  function D(R) {
    return R.ending && R.length === 0 && R.bufferedRequest === null && !R.finished && !R.writing;
  }
  function B(R, N) {
    R._final(function(x) {
      N.pendingcb--, x && R.emit("error", x), N.prefinished = !0, R.emit("prefinish"), ge(R, N);
    });
  }
  function q(R, N) {
    !N.prefinished && !N.finalCalled && (typeof R._final == "function" ? (N.pendingcb++, N.finalCalled = !0, e.nextTick(B, R, N)) : (N.prefinished = !0, R.emit("prefinish")));
  }
  function ge(R, N) {
    var x = D(N);
    return x && (q(R, N), N.pendingcb === 0 && (N.finished = !0, R.emit("finish"))), x;
  }
  function _t(R, N, x) {
    N.ending = !0, ge(R, N), x && (N.finished ? e.nextTick(x) : R.once("finish", x)), N.ended = !0, R.writable = !1;
  }
  function Jt(R, N, x) {
    var W = R.entry;
    for (R.entry = null; W; ) {
      var V = W.callback;
      N.pendingcb--, V(x), W = W.next;
    }
    N.corkedRequestsFree.next = R;
  }
  return Object.defineProperty(E.prototype, "destroyed", {
    get: function() {
      return this._writableState === void 0 ? !1 : this._writableState.destroyed;
    },
    set: function(R) {
      this._writableState && (this._writableState.destroyed = R);
    }
  }), E.prototype.destroy = p.destroy, E.prototype._undestroy = p.undestroy, E.prototype._destroy = function(R, N) {
    this.end(), N(R);
  }, Hn;
}
var Xn, Qa;
function fr() {
  if (Qa) return Xn;
  Qa = 1;
  var e = un(), t = Object.keys || function(p) {
    var d = [];
    for (var f in p)
      d.push(f);
    return d;
  };
  Xn = c;
  var r = Object.create(Qr());
  r.inherits = ei();
  var i = lu(), s = uu();
  r.inherits(c, i);
  for (var n = t(s.prototype), a = 0; a < n.length; a++) {
    var o = n[a];
    c.prototype[o] || (c.prototype[o] = s.prototype[o]);
  }
  function c(p) {
    if (!(this instanceof c)) return new c(p);
    i.call(this, p), s.call(this, p), p && p.readable === !1 && (this.readable = !1), p && p.writable === !1 && (this.writable = !1), this.allowHalfOpen = !0, p && p.allowHalfOpen === !1 && (this.allowHalfOpen = !1), this.once("end", u);
  }
  Object.defineProperty(c.prototype, "writableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: !1,
    get: function() {
      return this._writableState.highWaterMark;
    }
  });
  function u() {
    this.allowHalfOpen || this._writableState.ended || e.nextTick(l, this);
  }
  function l(p) {
    p.end();
  }
  return Object.defineProperty(c.prototype, "destroyed", {
    get: function() {
      return this._readableState === void 0 || this._writableState === void 0 ? !1 : this._readableState.destroyed && this._writableState.destroyed;
    },
    set: function(p) {
      this._readableState === void 0 || this._writableState === void 0 || (this._readableState.destroyed = p, this._writableState.destroyed = p);
    }
  }), c.prototype._destroy = function(p, d) {
    this.push(null), this.end(), e.nextTick(d, p);
  }, Xn;
}
var Wn = {}, eo;
function to() {
  if (eo) return Wn;
  eo = 1;
  var e = ln().Buffer, t = e.isEncoding || function(h) {
    switch (h = "" + h, h && h.toLowerCase()) {
      case "hex":
      case "utf8":
      case "utf-8":
      case "ascii":
      case "binary":
      case "base64":
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
      case "raw":
        return !0;
      default:
        return !1;
    }
  };
  function r(h) {
    if (!h) return "utf8";
    for (var m; ; )
      switch (h) {
        case "utf8":
        case "utf-8":
          return "utf8";
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return "utf16le";
        case "latin1":
        case "binary":
          return "latin1";
        case "base64":
        case "ascii":
        case "hex":
          return h;
        default:
          if (m) return;
          h = ("" + h).toLowerCase(), m = !0;
      }
  }
  function i(h) {
    var m = r(h);
    if (typeof m != "string" && (e.isEncoding === t || !t(h))) throw new Error("Unknown encoding: " + h);
    return m || h;
  }
  Wn.StringDecoder = s;
  function s(h) {
    this.encoding = i(h);
    var m;
    switch (this.encoding) {
      case "utf16le":
        this.text = p, this.end = d, m = 4;
        break;
      case "utf8":
        this.fillLast = c, m = 4;
        break;
      case "base64":
        this.text = f, this.end = _, m = 3;
        break;
      default:
        this.write = E, this.end = w;
        return;
    }
    this.lastNeed = 0, this.lastTotal = 0, this.lastChar = e.allocUnsafe(m);
  }
  s.prototype.write = function(h) {
    if (h.length === 0) return "";
    var m, b;
    if (this.lastNeed) {
      if (m = this.fillLast(h), m === void 0) return "";
      b = this.lastNeed, this.lastNeed = 0;
    } else
      b = 0;
    return b < h.length ? m ? m + this.text(h, b) : this.text(h, b) : m || "";
  }, s.prototype.end = l, s.prototype.text = u, s.prototype.fillLast = function(h) {
    if (this.lastNeed <= h.length)
      return h.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
    h.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, h.length), this.lastNeed -= h.length;
  };
  function n(h) {
    return h <= 127 ? 0 : h >> 5 === 6 ? 2 : h >> 4 === 14 ? 3 : h >> 3 === 30 ? 4 : h >> 6 === 2 ? -1 : -2;
  }
  function a(h, m, b) {
    var v = m.length - 1;
    if (v < b) return 0;
    var S = n(m[v]);
    return S >= 0 ? (S > 0 && (h.lastNeed = S - 1), S) : --v < b || S === -2 ? 0 : (S = n(m[v]), S >= 0 ? (S > 0 && (h.lastNeed = S - 2), S) : --v < b || S === -2 ? 0 : (S = n(m[v]), S >= 0 ? (S > 0 && (S === 2 ? S = 0 : h.lastNeed = S - 3), S) : 0));
  }
  function o(h, m, b) {
    if ((m[0] & 192) !== 128)
      return h.lastNeed = 0, "�";
    if (h.lastNeed > 1 && m.length > 1) {
      if ((m[1] & 192) !== 128)
        return h.lastNeed = 1, "�";
      if (h.lastNeed > 2 && m.length > 2 && (m[2] & 192) !== 128)
        return h.lastNeed = 2, "�";
    }
  }
  function c(h) {
    var m = this.lastTotal - this.lastNeed, b = o(this, h);
    if (b !== void 0) return b;
    if (this.lastNeed <= h.length)
      return h.copy(this.lastChar, m, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
    h.copy(this.lastChar, m, 0, h.length), this.lastNeed -= h.length;
  }
  function u(h, m) {
    var b = a(this, h, m);
    if (!this.lastNeed) return h.toString("utf8", m);
    this.lastTotal = b;
    var v = h.length - (b - this.lastNeed);
    return h.copy(this.lastChar, 0, v), h.toString("utf8", m, v);
  }
  function l(h) {
    var m = h && h.length ? this.write(h) : "";
    return this.lastNeed ? m + "�" : m;
  }
  function p(h, m) {
    if ((h.length - m) % 2 === 0) {
      var b = h.toString("utf16le", m);
      if (b) {
        var v = b.charCodeAt(b.length - 1);
        if (v >= 55296 && v <= 56319)
          return this.lastNeed = 2, this.lastTotal = 4, this.lastChar[0] = h[h.length - 2], this.lastChar[1] = h[h.length - 1], b.slice(0, -1);
      }
      return b;
    }
    return this.lastNeed = 1, this.lastTotal = 2, this.lastChar[0] = h[h.length - 1], h.toString("utf16le", m, h.length - 1);
  }
  function d(h) {
    var m = h && h.length ? this.write(h) : "";
    if (this.lastNeed) {
      var b = this.lastTotal - this.lastNeed;
      return m + this.lastChar.toString("utf16le", 0, b);
    }
    return m;
  }
  function f(h, m) {
    var b = (h.length - m) % 3;
    return b === 0 ? h.toString("base64", m) : (this.lastNeed = 3 - b, this.lastTotal = 3, b === 1 ? this.lastChar[0] = h[h.length - 1] : (this.lastChar[0] = h[h.length - 2], this.lastChar[1] = h[h.length - 1]), h.toString("base64", m, h.length - b));
  }
  function _(h) {
    var m = h && h.length ? this.write(h) : "";
    return this.lastNeed ? m + this.lastChar.toString("base64", 0, 3 - this.lastNeed) : m;
  }
  function E(h) {
    return h.toString(this.encoding);
  }
  function w(h) {
    return h && h.length ? this.write(h) : "";
  }
  return Wn;
}
var zn, ro;
function lu() {
  if (ro) return zn;
  ro = 1;
  var e = un();
  zn = m;
  var t = kh(), r;
  m.ReadableState = h, nf.EventEmitter;
  var i = function(T, g) {
    return T.listeners(g).length;
  }, s = ou(), n = ln().Buffer, a = (typeof ye < "u" ? ye : typeof window < "u" ? window : typeof self < "u" ? self : {}).Uint8Array || function() {
  };
  function o(T) {
    return n.from(T);
  }
  function c(T) {
    return n.isBuffer(T) || T instanceof a;
  }
  var u = Object.create(Qr());
  u.inherits = ei();
  var l = lt, p = void 0;
  l && l.debuglog ? p = l.debuglog("stream") : p = function() {
  };
  var d = Dh(), f = cu(), _;
  u.inherits(m, s);
  var E = ["error", "close", "destroy", "pause", "resume"];
  function w(T, g, k) {
    if (typeof T.prependListener == "function") return T.prependListener(g, k);
    !T._events || !T._events[g] ? T.on(g, k) : t(T._events[g]) ? T._events[g].unshift(k) : T._events[g] = [k, T._events[g]];
  }
  function h(T, g) {
    r = r || fr(), T = T || {};
    var k = g instanceof r;
    this.objectMode = !!T.objectMode, k && (this.objectMode = this.objectMode || !!T.readableObjectMode);
    var U = T.highWaterMark, J = T.readableHighWaterMark, z = this.objectMode ? 16 : 16 * 1024;
    U || U === 0 ? this.highWaterMark = U : k && (J || J === 0) ? this.highWaterMark = J : this.highWaterMark = z, this.highWaterMark = Math.floor(this.highWaterMark), this.buffer = new d(), this.length = 0, this.pipes = null, this.pipesCount = 0, this.flowing = null, this.ended = !1, this.endEmitted = !1, this.reading = !1, this.sync = !0, this.needReadable = !1, this.emittedReadable = !1, this.readableListening = !1, this.resumeScheduled = !1, this.destroyed = !1, this.defaultEncoding = T.defaultEncoding || "utf8", this.awaitDrain = 0, this.readingMore = !1, this.decoder = null, this.encoding = null, T.encoding && (_ || (_ = to().StringDecoder), this.decoder = new _(T.encoding), this.encoding = T.encoding);
  }
  function m(T) {
    if (r = r || fr(), !(this instanceof m)) return new m(T);
    this._readableState = new h(T, this), this.readable = !0, T && (typeof T.read == "function" && (this._read = T.read), typeof T.destroy == "function" && (this._destroy = T.destroy)), s.call(this);
  }
  Object.defineProperty(m.prototype, "destroyed", {
    get: function() {
      return this._readableState === void 0 ? !1 : this._readableState.destroyed;
    },
    set: function(T) {
      this._readableState && (this._readableState.destroyed = T);
    }
  }), m.prototype.destroy = f.destroy, m.prototype._undestroy = f.undestroy, m.prototype._destroy = function(T, g) {
    this.push(null), g(T);
  }, m.prototype.push = function(T, g) {
    var k = this._readableState, U;
    return k.objectMode ? U = !0 : typeof T == "string" && (g = g || k.defaultEncoding, g !== k.encoding && (T = n.from(T, g), g = ""), U = !0), b(this, T, g, !1, U);
  }, m.prototype.unshift = function(T) {
    return b(this, T, null, !0, !1);
  };
  function b(T, g, k, U, J) {
    var z = T._readableState;
    if (g === null)
      z.reading = !1, H(T, z);
    else {
      var K;
      J || (K = S(z, g)), K ? T.emit("error", K) : z.objectMode || g && g.length > 0 ? (typeof g != "string" && !z.objectMode && Object.getPrototypeOf(g) !== n.prototype && (g = o(g)), U ? z.endEmitted ? T.emit("error", new Error("stream.unshift() after end event")) : v(T, z, g, !0) : z.ended ? T.emit("error", new Error("stream.push() after EOF")) : (z.reading = !1, z.decoder && !k ? (g = z.decoder.write(g), z.objectMode || g.length !== 0 ? v(T, z, g, !1) : q(T, z)) : v(T, z, g, !1))) : U || (z.reading = !1);
    }
    return L(z);
  }
  function v(T, g, k, U) {
    g.flowing && g.length === 0 && !g.sync ? (T.emit("data", k), T.read(0)) : (g.length += g.objectMode ? 1 : k.length, U ? g.buffer.unshift(k) : g.buffer.push(k), g.needReadable && D(T)), q(T, g);
  }
  function S(T, g) {
    var k;
    return !c(g) && typeof g != "string" && g !== void 0 && !T.objectMode && (k = new TypeError("Invalid non-string/buffer chunk")), k;
  }
  function L(T) {
    return !T.ended && (T.needReadable || T.length < T.highWaterMark || T.length === 0);
  }
  m.prototype.isPaused = function() {
    return this._readableState.flowing === !1;
  }, m.prototype.setEncoding = function(T) {
    return _ || (_ = to().StringDecoder), this._readableState.decoder = new _(T), this._readableState.encoding = T, this;
  };
  var I = 8388608;
  function O(T) {
    return T >= I ? T = I : (T--, T |= T >>> 1, T |= T >>> 2, T |= T >>> 4, T |= T >>> 8, T |= T >>> 16, T++), T;
  }
  function P(T, g) {
    return T <= 0 || g.length === 0 && g.ended ? 0 : g.objectMode ? 1 : T !== T ? g.flowing && g.length ? g.buffer.head.data.length : g.length : (T > g.highWaterMark && (g.highWaterMark = O(T)), T <= g.length ? T : g.ended ? g.length : (g.needReadable = !0, 0));
  }
  m.prototype.read = function(T) {
    p("read", T), T = parseInt(T, 10);
    var g = this._readableState, k = T;
    if (T !== 0 && (g.emittedReadable = !1), T === 0 && g.needReadable && (g.length >= g.highWaterMark || g.ended))
      return p("read: emitReadable", g.length, g.ended), g.length === 0 && g.ended ? $e(this) : D(this), null;
    if (T = P(T, g), T === 0 && g.ended)
      return g.length === 0 && $e(this), null;
    var U = g.needReadable;
    p("need readable", U), (g.length === 0 || g.length - T < g.highWaterMark) && (U = !0, p("length less than watermark", U)), g.ended || g.reading ? (U = !1, p("reading or ended", U)) : U && (p("do read"), g.reading = !0, g.sync = !0, g.length === 0 && (g.needReadable = !0), this._read(g.highWaterMark), g.sync = !1, g.reading || (T = P(k, g)));
    var J;
    return T > 0 ? J = W(T, g) : J = null, J === null ? (g.needReadable = !0, T = 0) : g.length -= T, g.length === 0 && (g.ended || (g.needReadable = !0), k !== T && g.ended && $e(this)), J !== null && this.emit("data", J), J;
  };
  function H(T, g) {
    if (!g.ended) {
      if (g.decoder) {
        var k = g.decoder.end();
        k && k.length && (g.buffer.push(k), g.length += g.objectMode ? 1 : k.length);
      }
      g.ended = !0, D(T);
    }
  }
  function D(T) {
    var g = T._readableState;
    g.needReadable = !1, g.emittedReadable || (p("emitReadable", g.flowing), g.emittedReadable = !0, g.sync ? e.nextTick(B, T) : B(T));
  }
  function B(T) {
    p("emit readable"), T.emit("readable"), x(T);
  }
  function q(T, g) {
    g.readingMore || (g.readingMore = !0, e.nextTick(ge, T, g));
  }
  function ge(T, g) {
    for (var k = g.length; !g.reading && !g.flowing && !g.ended && g.length < g.highWaterMark && (p("maybeReadMore read 0"), T.read(0), k !== g.length); )
      k = g.length;
    g.readingMore = !1;
  }
  m.prototype._read = function(T) {
    this.emit("error", new Error("_read() is not implemented"));
  }, m.prototype.pipe = function(T, g) {
    var k = this, U = this._readableState;
    switch (U.pipesCount) {
      case 0:
        U.pipes = T;
        break;
      case 1:
        U.pipes = [U.pipes, T];
        break;
      default:
        U.pipes.push(T);
        break;
    }
    U.pipesCount += 1, p("pipe count=%d opts=%j", U.pipesCount, g);
    var J = (!g || g.end !== !1) && T !== process.stdout && T !== process.stderr, z = J ? hi : Cr;
    U.endEmitted ? e.nextTick(z) : k.once("end", z), T.on("unpipe", K);
    function K(Qt, Or) {
      p("onunpipe"), Qt === k && Or && Or.hasUnpiped === !1 && (Or.hasUnpiped = !0, Vd());
    }
    function hi() {
      p("onend"), T.end();
    }
    var An = _t(k);
    T.on("drain", An);
    var Ba = !1;
    function Vd() {
      p("cleanup"), T.removeListener("close", kn), T.removeListener("finish", xn), T.removeListener("drain", An), T.removeListener("error", On), T.removeListener("unpipe", K), k.removeListener("end", hi), k.removeListener("end", Cr), k.removeListener("data", Fa), Ba = !0, U.awaitDrain && (!T._writableState || T._writableState.needDrain) && An();
    }
    var Cn = !1;
    k.on("data", Fa);
    function Fa(Qt) {
      p("ondata"), Cn = !1;
      var Or = T.write(Qt);
      Or === !1 && !Cn && ((U.pipesCount === 1 && U.pipes === T || U.pipesCount > 1 && xt(U.pipes, T) !== -1) && !Ba && (p("false write response, pause", U.awaitDrain), U.awaitDrain++, Cn = !0), k.pause());
    }
    function On(Qt) {
      p("onerror", Qt), Cr(), T.removeListener("error", On), i(T, "error") === 0 && T.emit("error", Qt);
    }
    w(T, "error", On);
    function kn() {
      T.removeListener("finish", xn), Cr();
    }
    T.once("close", kn);
    function xn() {
      p("onfinish"), T.removeListener("close", kn), Cr();
    }
    T.once("finish", xn);
    function Cr() {
      p("unpipe"), k.unpipe(T);
    }
    return T.emit("pipe", k), U.flowing || (p("pipe resume"), k.resume()), T;
  };
  function _t(T) {
    return function() {
      var g = T._readableState;
      p("pipeOnDrain", g.awaitDrain), g.awaitDrain && g.awaitDrain--, g.awaitDrain === 0 && i(T, "data") && (g.flowing = !0, x(T));
    };
  }
  m.prototype.unpipe = function(T) {
    var g = this._readableState, k = { hasUnpiped: !1 };
    if (g.pipesCount === 0) return this;
    if (g.pipesCount === 1)
      return T && T !== g.pipes ? this : (T || (T = g.pipes), g.pipes = null, g.pipesCount = 0, g.flowing = !1, T && T.emit("unpipe", this, k), this);
    if (!T) {
      var U = g.pipes, J = g.pipesCount;
      g.pipes = null, g.pipesCount = 0, g.flowing = !1;
      for (var z = 0; z < J; z++)
        U[z].emit("unpipe", this, { hasUnpiped: !1 });
      return this;
    }
    var K = xt(g.pipes, T);
    return K === -1 ? this : (g.pipes.splice(K, 1), g.pipesCount -= 1, g.pipesCount === 1 && (g.pipes = g.pipes[0]), T.emit("unpipe", this, k), this);
  }, m.prototype.on = function(T, g) {
    var k = s.prototype.on.call(this, T, g);
    if (T === "data")
      this._readableState.flowing !== !1 && this.resume();
    else if (T === "readable") {
      var U = this._readableState;
      !U.endEmitted && !U.readableListening && (U.readableListening = U.needReadable = !0, U.emittedReadable = !1, U.reading ? U.length && D(this) : e.nextTick(Jt, this));
    }
    return k;
  }, m.prototype.addListener = m.prototype.on;
  function Jt(T) {
    p("readable nexttick read 0"), T.read(0);
  }
  m.prototype.resume = function() {
    var T = this._readableState;
    return T.flowing || (p("resume"), T.flowing = !0, R(this, T)), this;
  };
  function R(T, g) {
    g.resumeScheduled || (g.resumeScheduled = !0, e.nextTick(N, T, g));
  }
  function N(T, g) {
    g.reading || (p("resume read 0"), T.read(0)), g.resumeScheduled = !1, g.awaitDrain = 0, T.emit("resume"), x(T), g.flowing && !g.reading && T.read(0);
  }
  m.prototype.pause = function() {
    return p("call pause flowing=%j", this._readableState.flowing), this._readableState.flowing !== !1 && (p("pause"), this._readableState.flowing = !1, this.emit("pause")), this;
  };
  function x(T) {
    var g = T._readableState;
    for (p("flow", g.flowing); g.flowing && T.read() !== null; )
      ;
  }
  m.prototype.wrap = function(T) {
    var g = this, k = this._readableState, U = !1;
    T.on("end", function() {
      if (p("wrapped end"), k.decoder && !k.ended) {
        var K = k.decoder.end();
        K && K.length && g.push(K);
      }
      g.push(null);
    }), T.on("data", function(K) {
      if (p("wrapped data"), k.decoder && (K = k.decoder.write(K)), !(k.objectMode && K == null) && !(!k.objectMode && (!K || !K.length))) {
        var hi = g.push(K);
        hi || (U = !0, T.pause());
      }
    });
    for (var J in T)
      this[J] === void 0 && typeof T[J] == "function" && (this[J] = /* @__PURE__ */ function(K) {
        return function() {
          return T[K].apply(T, arguments);
        };
      }(J));
    for (var z = 0; z < E.length; z++)
      T.on(E[z], this.emit.bind(this, E[z]));
    return this._read = function(K) {
      p("wrapped _read", K), U && (U = !1, T.resume());
    }, this;
  }, Object.defineProperty(m.prototype, "readableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: !1,
    get: function() {
      return this._readableState.highWaterMark;
    }
  }), m._fromList = W;
  function W(T, g) {
    if (g.length === 0) return null;
    var k;
    return g.objectMode ? k = g.buffer.shift() : !T || T >= g.length ? (g.decoder ? k = g.buffer.join("") : g.buffer.length === 1 ? k = g.buffer.head.data : k = g.buffer.concat(g.length), g.buffer.clear()) : k = V(T, g.buffer, g.decoder), k;
  }
  function V(T, g, k) {
    var U;
    return T < g.head.data.length ? (U = g.head.data.slice(0, T), g.head.data = g.head.data.slice(T)) : T === g.head.data.length ? U = g.shift() : U = k ? Q(T, g) : Me(T, g), U;
  }
  function Q(T, g) {
    var k = g.head, U = 1, J = k.data;
    for (T -= J.length; k = k.next; ) {
      var z = k.data, K = T > z.length ? z.length : T;
      if (K === z.length ? J += z : J += z.slice(0, T), T -= K, T === 0) {
        K === z.length ? (++U, k.next ? g.head = k.next : g.head = g.tail = null) : (g.head = k, k.data = z.slice(K));
        break;
      }
      ++U;
    }
    return g.length -= U, J;
  }
  function Me(T, g) {
    var k = n.allocUnsafe(T), U = g.head, J = 1;
    for (U.data.copy(k), T -= U.data.length; U = U.next; ) {
      var z = U.data, K = T > z.length ? z.length : T;
      if (z.copy(k, k.length - T, 0, K), T -= K, T === 0) {
        K === z.length ? (++J, U.next ? g.head = U.next : g.head = g.tail = null) : (g.head = U, U.data = z.slice(K));
        break;
      }
      ++J;
    }
    return g.length -= J, k;
  }
  function $e(T) {
    var g = T._readableState;
    if (g.length > 0) throw new Error('"endReadable()" called on non-empty stream');
    g.endEmitted || (g.ended = !0, e.nextTick(kt, g, T));
  }
  function kt(T, g) {
    !T.endEmitted && T.length === 0 && (T.endEmitted = !0, g.readable = !1, g.emit("end"));
  }
  function xt(T, g) {
    for (var k = 0, U = T.length; k < U; k++)
      if (T[k] === g) return k;
    return -1;
  }
  return zn;
}
var qn, io;
function du() {
  if (io) return qn;
  io = 1, qn = i;
  var e = fr(), t = Object.create(Qr());
  t.inherits = ei(), t.inherits(i, e);
  function r(a, o) {
    var c = this._transformState;
    c.transforming = !1;
    var u = c.writecb;
    if (!u)
      return this.emit("error", new Error("write callback called multiple times"));
    c.writechunk = null, c.writecb = null, o != null && this.push(o), u(a);
    var l = this._readableState;
    l.reading = !1, (l.needReadable || l.length < l.highWaterMark) && this._read(l.highWaterMark);
  }
  function i(a) {
    if (!(this instanceof i)) return new i(a);
    e.call(this, a), this._transformState = {
      afterTransform: r.bind(this),
      needTransform: !1,
      transforming: !1,
      writecb: null,
      writechunk: null,
      writeencoding: null
    }, this._readableState.needReadable = !0, this._readableState.sync = !1, a && (typeof a.transform == "function" && (this._transform = a.transform), typeof a.flush == "function" && (this._flush = a.flush)), this.on("prefinish", s);
  }
  function s() {
    var a = this;
    typeof this._flush == "function" ? this._flush(function(o, c) {
      n(a, o, c);
    }) : n(this, null, null);
  }
  i.prototype.push = function(a, o) {
    return this._transformState.needTransform = !1, e.prototype.push.call(this, a, o);
  }, i.prototype._transform = function(a, o, c) {
    throw new Error("_transform() is not implemented");
  }, i.prototype._write = function(a, o, c) {
    var u = this._transformState;
    if (u.writecb = c, u.writechunk = a, u.writeencoding = o, !u.transforming) {
      var l = this._readableState;
      (u.needTransform || l.needReadable || l.length < l.highWaterMark) && this._read(l.highWaterMark);
    }
  }, i.prototype._read = function(a) {
    var o = this._transformState;
    o.writechunk !== null && o.writecb && !o.transforming ? (o.transforming = !0, this._transform(o.writechunk, o.writeencoding, o.afterTransform)) : o.needTransform = !0;
  }, i.prototype._destroy = function(a, o) {
    var c = this;
    e.prototype._destroy.call(this, a, function(u) {
      o(u), c.emit("close");
    });
  };
  function n(a, o, c) {
    if (o) return a.emit("error", o);
    if (c != null && a.push(c), a._writableState.length) throw new Error("Calling transform done when ws.length != 0");
    if (a._transformState.transforming) throw new Error("Calling transform done when still transforming");
    return a.push(null);
  }
  return qn;
}
var Kn, no;
function Ph() {
  if (no) return Kn;
  no = 1, Kn = r;
  var e = du(), t = Object.create(Qr());
  t.inherits = ei(), t.inherits(r, e);
  function r(i) {
    if (!(this instanceof r)) return new r(i);
    e.call(this, i);
  }
  return r.prototype._transform = function(i, s, n) {
    n(null, i);
  }, Kn;
}
var so;
function fu() {
  return so || (so = 1, function(e, t) {
    var r = Vr;
    process.env.READABLE_STREAM === "disable" && r ? (e.exports = r, t = e.exports = r.Readable, t.Readable = r.Readable, t.Writable = r.Writable, t.Duplex = r.Duplex, t.Transform = r.Transform, t.PassThrough = r.PassThrough, t.Stream = r) : (t = e.exports = lu(), t.Stream = r || t, t.Readable = t, t.Writable = uu(), t.Duplex = fr(), t.Transform = du(), t.PassThrough = Ph());
  }(mi, mi.exports)), mi.exports;
}
var ao, yi;
pe.base64 = !0;
pe.array = !0;
pe.string = !0;
pe.arraybuffer = typeof ArrayBuffer < "u" && typeof Uint8Array < "u";
pe.nodebuffer = typeof Buffer < "u";
pe.uint8array = typeof Uint8Array < "u";
if (typeof ArrayBuffer > "u")
  yi = pe.blob = !1;
else {
  var oo = new ArrayBuffer(0);
  try {
    yi = pe.blob = new Blob([oo], {
      type: "application/zip"
    }).size === 0;
  } catch {
    try {
      var Bh = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder, co = new Bh();
      co.append(oo), yi = pe.blob = co.getBlob("application/zip").size === 0;
    } catch {
      yi = pe.blob = !1;
    }
  }
}
try {
  ao = pe.nodestream = !!fu().Readable;
} catch {
  ao = pe.nodestream = !1;
}
var wi = {}, uo;
function hu() {
  if (uo) return wi;
  uo = 1;
  var e = le(), t = pe, r = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  return wi.encode = function(i) {
    for (var s = [], n, a, o, c, u, l, p, d = 0, f = i.length, _ = f, E = e.getTypeOf(i) !== "string"; d < i.length; )
      _ = f - d, E ? (n = i[d++], a = d < f ? i[d++] : 0, o = d < f ? i[d++] : 0) : (n = i.charCodeAt(d++), a = d < f ? i.charCodeAt(d++) : 0, o = d < f ? i.charCodeAt(d++) : 0), c = n >> 2, u = (n & 3) << 4 | a >> 4, l = _ > 1 ? (a & 15) << 2 | o >> 6 : 64, p = _ > 2 ? o & 63 : 64, s.push(r.charAt(c) + r.charAt(u) + r.charAt(l) + r.charAt(p));
    return s.join("");
  }, wi.decode = function(i) {
    var s, n, a, o, c, u, l, p = 0, d = 0, f = "data:";
    if (i.substr(0, f.length) === f)
      throw new Error("Invalid base64 input, it looks like a data url.");
    i = i.replace(/[^A-Za-z0-9+/=]/g, "");
    var _ = i.length * 3 / 4;
    if (i.charAt(i.length - 1) === r.charAt(64) && _--, i.charAt(i.length - 2) === r.charAt(64) && _--, _ % 1 !== 0)
      throw new Error("Invalid base64 input, bad content length.");
    var E;
    for (t.uint8array ? E = new Uint8Array(_ | 0) : E = new Array(_ | 0); p < i.length; )
      o = r.indexOf(i.charAt(p++)), c = r.indexOf(i.charAt(p++)), u = r.indexOf(i.charAt(p++)), l = r.indexOf(i.charAt(p++)), s = o << 2 | c >> 4, n = (c & 15) << 4 | u >> 2, a = (u & 3) << 6 | l, E[d++] = s, u !== 64 && (E[d++] = n), l !== 64 && (E[d++] = a);
    return E;
  }, wi;
}
var dn = {
  /**
   * True if this is running in Nodejs, will be undefined in a browser.
   * In a browser, browserify won't include this file and the whole module
   * will be resolved an empty object.
   */
  isNode: typeof Buffer < "u",
  /**
   * Create a new nodejs Buffer from an existing content.
   * @param {Object} data the data to pass to the constructor.
   * @param {String} encoding the encoding to use.
   * @return {Buffer} a new Buffer.
   */
  newBufferFrom: function(e, t) {
    if (Buffer.from && Buffer.from !== Uint8Array.from)
      return Buffer.from(e, t);
    if (typeof e == "number")
      throw new Error('The "data" argument must not be a number');
    return new Buffer(e, t);
  },
  /**
   * Create a new nodejs Buffer with the specified size.
   * @param {Integer} size the size of the buffer.
   * @return {Buffer} a new Buffer.
   */
  allocBuffer: function(e) {
    if (Buffer.alloc)
      return Buffer.alloc(e);
    var t = new Buffer(e);
    return t.fill(0), t;
  },
  /**
   * Find out if an object is a Buffer.
   * @param {Object} b the object to test.
   * @return {Boolean} true if the object is a Buffer, false otherwise.
   */
  isBuffer: function(e) {
    return Buffer.isBuffer(e);
  },
  isStream: function(e) {
    return e && typeof e.on == "function" && typeof e.pause == "function" && typeof e.resume == "function";
  }
}, Yn, lo;
function Fh() {
  if (lo) return Yn;
  lo = 1;
  var e = ye.MutationObserver || ye.WebKitMutationObserver, t;
  if (process.browser)
    if (e) {
      var r = 0, i = new e(c), s = ye.document.createTextNode("");
      i.observe(s, {
        characterData: !0
      }), t = function() {
        s.data = r = ++r % 2;
      };
    } else if (!ye.setImmediate && typeof ye.MessageChannel < "u") {
      var n = new ye.MessageChannel();
      n.port1.onmessage = c, t = function() {
        n.port2.postMessage(0);
      };
    } else "document" in ye && "onreadystatechange" in ye.document.createElement("script") ? t = function() {
      var l = ye.document.createElement("script");
      l.onreadystatechange = function() {
        c(), l.onreadystatechange = null, l.parentNode.removeChild(l), l = null;
      }, ye.document.documentElement.appendChild(l);
    } : t = function() {
      setTimeout(c, 0);
    };
  else
    t = function() {
      process.nextTick(c);
    };
  var a, o = [];
  function c() {
    a = !0;
    for (var l, p, d = o.length; d; ) {
      for (p = o, o = [], l = -1; ++l < d; )
        p[l]();
      d = o.length;
    }
    a = !1;
  }
  Yn = u;
  function u(l) {
    o.push(l) === 1 && !a && t();
  }
  return Yn;
}
var jn, fo;
function Mh() {
  if (fo) return jn;
  fo = 1;
  var e = Fh();
  function t() {
  }
  var r = {}, i = ["REJECTED"], s = ["FULFILLED"], n = ["PENDING"];
  if (!process.browser)
    var a = ["UNHANDLED"];
  jn = o;
  function o(h) {
    if (typeof h != "function")
      throw new TypeError("resolver must be a function");
    this.state = n, this.queue = [], this.outcome = void 0, process.browser || (this.handled = a), h !== t && p(this, h);
  }
  o.prototype.finally = function(h) {
    if (typeof h != "function")
      return this;
    var m = this.constructor;
    return this.then(b, v);
    function b(S) {
      function L() {
        return S;
      }
      return m.resolve(h()).then(L);
    }
    function v(S) {
      function L() {
        throw S;
      }
      return m.resolve(h()).then(L);
    }
  }, o.prototype.catch = function(h) {
    return this.then(null, h);
  }, o.prototype.then = function(h, m) {
    if (typeof h != "function" && this.state === s || typeof m != "function" && this.state === i)
      return this;
    var b = new this.constructor(t);
    if (process.browser || this.handled === a && (this.handled = null), this.state !== n) {
      var v = this.state === s ? h : m;
      u(b, v, this.outcome);
    } else
      this.queue.push(new c(b, h, m));
    return b;
  };
  function c(h, m, b) {
    this.promise = h, typeof m == "function" && (this.onFulfilled = m, this.callFulfilled = this.otherCallFulfilled), typeof b == "function" && (this.onRejected = b, this.callRejected = this.otherCallRejected);
  }
  c.prototype.callFulfilled = function(h) {
    r.resolve(this.promise, h);
  }, c.prototype.otherCallFulfilled = function(h) {
    u(this.promise, this.onFulfilled, h);
  }, c.prototype.callRejected = function(h) {
    r.reject(this.promise, h);
  }, c.prototype.otherCallRejected = function(h) {
    u(this.promise, this.onRejected, h);
  };
  function u(h, m, b) {
    e(function() {
      var v;
      try {
        v = m(b);
      } catch (S) {
        return r.reject(h, S);
      }
      v === h ? r.reject(h, new TypeError("Cannot resolve promise with itself")) : r.resolve(h, v);
    });
  }
  r.resolve = function(h, m) {
    var b = d(l, m);
    if (b.status === "error")
      return r.reject(h, b.value);
    var v = b.value;
    if (v)
      p(h, v);
    else {
      h.state = s, h.outcome = m;
      for (var S = -1, L = h.queue.length; ++S < L; )
        h.queue[S].callFulfilled(m);
    }
    return h;
  }, r.reject = function(h, m) {
    h.state = i, h.outcome = m, process.browser || h.handled === a && e(function() {
      h.handled === a && process.emit("unhandledRejection", m, h);
    });
    for (var b = -1, v = h.queue.length; ++b < v; )
      h.queue[b].callRejected(m);
    return h;
  };
  function l(h) {
    var m = h && h.then;
    if (h && (typeof h == "object" || typeof h == "function") && typeof m == "function")
      return function() {
        m.apply(h, arguments);
      };
  }
  function p(h, m) {
    var b = !1;
    function v(O) {
      b || (b = !0, r.reject(h, O));
    }
    function S(O) {
      b || (b = !0, r.resolve(h, O));
    }
    function L() {
      m(S, v);
    }
    var I = d(L);
    I.status === "error" && v(I.value);
  }
  function d(h, m) {
    var b = {};
    try {
      b.value = h(m), b.status = "success";
    } catch (v) {
      b.status = "error", b.value = v;
    }
    return b;
  }
  o.resolve = f;
  function f(h) {
    return h instanceof this ? h : r.resolve(new this(t), h);
  }
  o.reject = _;
  function _(h) {
    var m = new this(t);
    return r.reject(m, h);
  }
  o.all = E;
  function E(h) {
    var m = this;
    if (Object.prototype.toString.call(h) !== "[object Array]")
      return this.reject(new TypeError("must be an array"));
    var b = h.length, v = !1;
    if (!b)
      return this.resolve([]);
    for (var S = new Array(b), L = 0, I = -1, O = new this(t); ++I < b; )
      P(h[I], I);
    return O;
    function P(H, D) {
      m.resolve(H).then(B, function(q) {
        v || (v = !0, r.reject(O, q));
      });
      function B(q) {
        S[D] = q, ++L === b && !v && (v = !0, r.resolve(O, S));
      }
    }
  }
  o.race = w;
  function w(h) {
    var m = this;
    if (Object.prototype.toString.call(h) !== "[object Array]")
      return this.reject(new TypeError("must be an array"));
    var b = h.length, v = !1;
    if (!b)
      return this.resolve([]);
    for (var S = -1, L = new this(t); ++S < b; )
      I(h[S]);
    return L;
    function I(O) {
      m.resolve(O).then(function(P) {
        v || (v = !0, r.resolve(L, P));
      }, function(P) {
        v || (v = !0, r.reject(L, P));
      });
    }
  }
  return jn;
}
var Cs = null;
typeof Promise < "u" ? Cs = Promise : Cs = Mh();
var ti = {
  Promise: Cs
};
(function(e, t) {
  if (e.setImmediate)
    return;
  var r = 1, i = {}, s = !1, n = e.document, a;
  function o(m) {
    typeof m != "function" && (m = new Function("" + m));
    for (var b = new Array(arguments.length - 1), v = 0; v < b.length; v++)
      b[v] = arguments[v + 1];
    var S = { callback: m, args: b };
    return i[r] = S, a(r), r++;
  }
  function c(m) {
    delete i[m];
  }
  function u(m) {
    var b = m.callback, v = m.args;
    switch (v.length) {
      case 0:
        b();
        break;
      case 1:
        b(v[0]);
        break;
      case 2:
        b(v[0], v[1]);
        break;
      case 3:
        b(v[0], v[1], v[2]);
        break;
      default:
        b.apply(t, v);
        break;
    }
  }
  function l(m) {
    if (s)
      setTimeout(l, 0, m);
    else {
      var b = i[m];
      if (b) {
        s = !0;
        try {
          u(b);
        } finally {
          c(m), s = !1;
        }
      }
    }
  }
  function p() {
    a = function(m) {
      process.nextTick(function() {
        l(m);
      });
    };
  }
  function d() {
    if (e.postMessage && !e.importScripts) {
      var m = !0, b = e.onmessage;
      return e.onmessage = function() {
        m = !1;
      }, e.postMessage("", "*"), e.onmessage = b, m;
    }
  }
  function f() {
    var m = "setImmediate$" + Math.random() + "$", b = function(v) {
      v.source === e && typeof v.data == "string" && v.data.indexOf(m) === 0 && l(+v.data.slice(m.length));
    };
    e.addEventListener ? e.addEventListener("message", b, !1) : e.attachEvent("onmessage", b), a = function(v) {
      e.postMessage(m + v, "*");
    };
  }
  function _() {
    var m = new MessageChannel();
    m.port1.onmessage = function(b) {
      var v = b.data;
      l(v);
    }, a = function(b) {
      m.port2.postMessage(b);
    };
  }
  function E() {
    var m = n.documentElement;
    a = function(b) {
      var v = n.createElement("script");
      v.onreadystatechange = function() {
        l(b), v.onreadystatechange = null, m.removeChild(v), v = null;
      }, m.appendChild(v);
    };
  }
  function w() {
    a = function(m) {
      setTimeout(l, 0, m);
    };
  }
  var h = Object.getPrototypeOf && Object.getPrototypeOf(e);
  h = h && h.setTimeout ? h : e, {}.toString.call(e.process) === "[object process]" ? p() : d() ? f() : e.MessageChannel ? _() : n && "onreadystatechange" in n.createElement("script") ? E() : w(), h.setImmediate = o, h.clearImmediate = c;
})(typeof self > "u" ? ye : self);
var ho;
function le() {
  return ho || (ho = 1, function(e) {
    var t = pe, r = hu(), i = dn, s = ti;
    function n(d) {
      var f = null;
      return t.uint8array ? f = new Uint8Array(d.length) : f = new Array(d.length), o(d, f);
    }
    e.newBlob = function(d, f) {
      e.checkSupport("blob");
      try {
        return new Blob([d], {
          type: f
        });
      } catch {
        try {
          var _ = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder, E = new _();
          return E.append(d), E.getBlob(f);
        } catch {
          throw new Error("Bug : can't construct the Blob.");
        }
      }
    };
    function a(d) {
      return d;
    }
    function o(d, f) {
      for (var _ = 0; _ < d.length; ++_)
        f[_] = d.charCodeAt(_) & 255;
      return f;
    }
    var c = {
      /**
       * Transform an array of int into a string, chunk by chunk.
       * See the performances notes on arrayLikeToString.
       * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
       * @param {String} type the type of the array.
       * @param {Integer} chunk the chunk size.
       * @return {String} the resulting string.
       * @throws Error if the chunk is too big for the stack.
       */
      stringifyByChunk: function(d, f, _) {
        var E = [], w = 0, h = d.length;
        if (h <= _)
          return String.fromCharCode.apply(null, d);
        for (; w < h; )
          f === "array" || f === "nodebuffer" ? E.push(String.fromCharCode.apply(null, d.slice(w, Math.min(w + _, h)))) : E.push(String.fromCharCode.apply(null, d.subarray(w, Math.min(w + _, h)))), w += _;
        return E.join("");
      },
      /**
       * Call String.fromCharCode on every item in the array.
       * This is the naive implementation, which generate A LOT of intermediate string.
       * This should be used when everything else fail.
       * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
       * @return {String} the result.
       */
      stringifyByChar: function(d) {
        for (var f = "", _ = 0; _ < d.length; _++)
          f += String.fromCharCode(d[_]);
        return f;
      },
      applyCanBeUsed: {
        /**
         * true if the browser accepts to use String.fromCharCode on Uint8Array
         */
        uint8array: function() {
          try {
            return t.uint8array && String.fromCharCode.apply(null, new Uint8Array(1)).length === 1;
          } catch {
            return !1;
          }
        }(),
        /**
         * true if the browser accepts to use String.fromCharCode on nodejs Buffer.
         */
        nodebuffer: function() {
          try {
            return t.nodebuffer && String.fromCharCode.apply(null, i.allocBuffer(1)).length === 1;
          } catch {
            return !1;
          }
        }()
      }
    };
    function u(d) {
      var f = 65536, _ = e.getTypeOf(d), E = !0;
      if (_ === "uint8array" ? E = c.applyCanBeUsed.uint8array : _ === "nodebuffer" && (E = c.applyCanBeUsed.nodebuffer), E)
        for (; f > 1; )
          try {
            return c.stringifyByChunk(d, _, f);
          } catch {
            f = Math.floor(f / 2);
          }
      return c.stringifyByChar(d);
    }
    e.applyFromCharCode = u;
    function l(d, f) {
      for (var _ = 0; _ < d.length; _++)
        f[_] = d[_];
      return f;
    }
    var p = {};
    p.string = {
      string: a,
      array: function(d) {
        return o(d, new Array(d.length));
      },
      arraybuffer: function(d) {
        return p.string.uint8array(d).buffer;
      },
      uint8array: function(d) {
        return o(d, new Uint8Array(d.length));
      },
      nodebuffer: function(d) {
        return o(d, i.allocBuffer(d.length));
      }
    }, p.array = {
      string: u,
      array: a,
      arraybuffer: function(d) {
        return new Uint8Array(d).buffer;
      },
      uint8array: function(d) {
        return new Uint8Array(d);
      },
      nodebuffer: function(d) {
        return i.newBufferFrom(d);
      }
    }, p.arraybuffer = {
      string: function(d) {
        return u(new Uint8Array(d));
      },
      array: function(d) {
        return l(new Uint8Array(d), new Array(d.byteLength));
      },
      arraybuffer: a,
      uint8array: function(d) {
        return new Uint8Array(d);
      },
      nodebuffer: function(d) {
        return i.newBufferFrom(new Uint8Array(d));
      }
    }, p.uint8array = {
      string: u,
      array: function(d) {
        return l(d, new Array(d.length));
      },
      arraybuffer: function(d) {
        return d.buffer;
      },
      uint8array: a,
      nodebuffer: function(d) {
        return i.newBufferFrom(d);
      }
    }, p.nodebuffer = {
      string: u,
      array: function(d) {
        return l(d, new Array(d.length));
      },
      arraybuffer: function(d) {
        return p.nodebuffer.uint8array(d).buffer;
      },
      uint8array: function(d) {
        return l(d, new Uint8Array(d.length));
      },
      nodebuffer: a
    }, e.transformTo = function(d, f) {
      if (f || (f = ""), !d)
        return f;
      e.checkSupport(d);
      var _ = e.getTypeOf(f), E = p[_][d](f);
      return E;
    }, e.resolve = function(d) {
      for (var f = d.split("/"), _ = [], E = 0; E < f.length; E++) {
        var w = f[E];
        w === "." || w === "" && E !== 0 && E !== f.length - 1 || (w === ".." ? _.pop() : _.push(w));
      }
      return _.join("/");
    }, e.getTypeOf = function(d) {
      if (typeof d == "string")
        return "string";
      if (Object.prototype.toString.call(d) === "[object Array]")
        return "array";
      if (t.nodebuffer && i.isBuffer(d))
        return "nodebuffer";
      if (t.uint8array && d instanceof Uint8Array)
        return "uint8array";
      if (t.arraybuffer && d instanceof ArrayBuffer)
        return "arraybuffer";
    }, e.checkSupport = function(d) {
      var f = t[d.toLowerCase()];
      if (!f)
        throw new Error(d + " is not supported by this platform");
    }, e.MAX_VALUE_16BITS = 65535, e.MAX_VALUE_32BITS = -1, e.pretty = function(d) {
      var f = "", _, E;
      for (E = 0; E < (d || "").length; E++)
        _ = d.charCodeAt(E), f += "\\x" + (_ < 16 ? "0" : "") + _.toString(16).toUpperCase();
      return f;
    }, e.delay = function(d, f, _) {
      setImmediate(function() {
        d.apply(_ || null, f || []);
      });
    }, e.inherits = function(d, f) {
      var _ = function() {
      };
      _.prototype = f.prototype, d.prototype = new _();
    }, e.extend = function() {
      var d = {}, f, _;
      for (f = 0; f < arguments.length; f++)
        for (_ in arguments[f])
          Object.prototype.hasOwnProperty.call(arguments[f], _) && typeof d[_] > "u" && (d[_] = arguments[f][_]);
      return d;
    }, e.prepareContent = function(d, f, _, E, w) {
      var h = s.Promise.resolve(f).then(function(m) {
        var b = t.blob && (m instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(m)) !== -1);
        return b && typeof FileReader < "u" ? new s.Promise(function(v, S) {
          var L = new FileReader();
          L.onload = function(I) {
            v(I.target.result);
          }, L.onerror = function(I) {
            S(I.target.error);
          }, L.readAsArrayBuffer(m);
        }) : m;
      });
      return h.then(function(m) {
        var b = e.getTypeOf(m);
        return b ? (b === "arraybuffer" ? m = e.transformTo("uint8array", m) : b === "string" && (w ? m = r.decode(m) : _ && E !== !0 && (m = n(m))), m) : s.Promise.reject(
          new Error("Can't read the data of '" + d + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?")
        );
      });
    };
  }(Un)), Un;
}
function pu(e) {
  this.name = e || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = !0, this.isFinished = !1, this.isLocked = !1, this._listeners = {
    data: [],
    end: [],
    error: []
  }, this.previous = null;
}
pu.prototype = {
  /**
   * Push a chunk to the next workers.
   * @param {Object} chunk the chunk to push
   */
  push: function(e) {
    this.emit("data", e);
  },
  /**
   * End the stream.
   * @return {Boolean} true if this call ended the worker, false otherwise.
   */
  end: function() {
    if (this.isFinished)
      return !1;
    this.flush();
    try {
      this.emit("end"), this.cleanUp(), this.isFinished = !0;
    } catch (e) {
      this.emit("error", e);
    }
    return !0;
  },
  /**
   * End the stream with an error.
   * @param {Error} e the error which caused the premature end.
   * @return {Boolean} true if this call ended the worker with an error, false otherwise.
   */
  error: function(e) {
    return this.isFinished ? !1 : (this.isPaused ? this.generatedError = e : (this.isFinished = !0, this.emit("error", e), this.previous && this.previous.error(e), this.cleanUp()), !0);
  },
  /**
   * Add a callback on an event.
   * @param {String} name the name of the event (data, end, error)
   * @param {Function} listener the function to call when the event is triggered
   * @return {GenericWorker} the current object for chainability
   */
  on: function(e, t) {
    return this._listeners[e].push(t), this;
  },
  /**
   * Clean any references when a worker is ending.
   */
  cleanUp: function() {
    this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
  },
  /**
   * Trigger an event. This will call registered callback with the provided arg.
   * @param {String} name the name of the event (data, end, error)
   * @param {Object} arg the argument to call the callback with.
   */
  emit: function(e, t) {
    if (this._listeners[e])
      for (var r = 0; r < this._listeners[e].length; r++)
        this._listeners[e][r].call(this, t);
  },
  /**
   * Chain a worker with an other.
   * @param {Worker} next the worker receiving events from the current one.
   * @return {worker} the next worker for chainability
   */
  pipe: function(e) {
    return e.registerPrevious(this);
  },
  /**
   * Same as `pipe` in the other direction.
   * Using an API with `pipe(next)` is very easy.
   * Implementing the API with the point of view of the next one registering
   * a source is easier, see the ZipFileWorker.
   * @param {Worker} previous the previous worker, sending events to this one
   * @return {Worker} the current worker for chainability
   */
  registerPrevious: function(e) {
    if (this.isLocked)
      throw new Error("The stream '" + this + "' has already been used.");
    this.streamInfo = e.streamInfo, this.mergeStreamInfo(), this.previous = e;
    var t = this;
    return e.on("data", function(r) {
      t.processChunk(r);
    }), e.on("end", function() {
      t.end();
    }), e.on("error", function(r) {
      t.error(r);
    }), this;
  },
  /**
   * Pause the stream so it doesn't send events anymore.
   * @return {Boolean} true if this call paused the worker, false otherwise.
   */
  pause: function() {
    return this.isPaused || this.isFinished ? !1 : (this.isPaused = !0, this.previous && this.previous.pause(), !0);
  },
  /**
   * Resume a paused stream.
   * @return {Boolean} true if this call resumed the worker, false otherwise.
   */
  resume: function() {
    if (!this.isPaused || this.isFinished)
      return !1;
    this.isPaused = !1;
    var e = !1;
    return this.generatedError && (this.error(this.generatedError), e = !0), this.previous && this.previous.resume(), !e;
  },
  /**
   * Flush any remaining bytes as the stream is ending.
   */
  flush: function() {
  },
  /**
   * Process a chunk. This is usually the method overridden.
   * @param {Object} chunk the chunk to process.
   */
  processChunk: function(e) {
    this.push(e);
  },
  /**
   * Add a key/value to be added in the workers chain streamInfo once activated.
   * @param {String} key the key to use
   * @param {Object} value the associated value
   * @return {Worker} the current worker for chainability
   */
  withStreamInfo: function(e, t) {
    return this.extraStreamInfo[e] = t, this.mergeStreamInfo(), this;
  },
  /**
   * Merge this worker's streamInfo into the chain's streamInfo.
   */
  mergeStreamInfo: function() {
    for (var e in this.extraStreamInfo)
      Object.prototype.hasOwnProperty.call(this.extraStreamInfo, e) && (this.streamInfo[e] = this.extraStreamInfo[e]);
  },
  /**
   * Lock the stream to prevent further updates on the workers chain.
   * After calling this method, all calls to pipe will fail.
   */
  lock: function() {
    if (this.isLocked)
      throw new Error("The stream '" + this + "' has already been used.");
    this.isLocked = !0, this.previous && this.previous.lock();
  },
  /**
   *
   * Pretty print the workers chain.
   */
  toString: function() {
    var e = "Worker " + this.name;
    return this.previous ? this.previous + " -> " + e : e;
  }
};
var Be = pu;
(function(e) {
  for (var t = le(), r = pe, i = dn, s = Be, n = new Array(256), a = 0; a < 256; a++)
    n[a] = a >= 252 ? 6 : a >= 248 ? 5 : a >= 240 ? 4 : a >= 224 ? 3 : a >= 192 ? 2 : 1;
  n[254] = n[254] = 1;
  var o = function(d) {
    var f, _, E, w, h, m = d.length, b = 0;
    for (w = 0; w < m; w++)
      _ = d.charCodeAt(w), (_ & 64512) === 55296 && w + 1 < m && (E = d.charCodeAt(w + 1), (E & 64512) === 56320 && (_ = 65536 + (_ - 55296 << 10) + (E - 56320), w++)), b += _ < 128 ? 1 : _ < 2048 ? 2 : _ < 65536 ? 3 : 4;
    for (r.uint8array ? f = new Uint8Array(b) : f = new Array(b), h = 0, w = 0; h < b; w++)
      _ = d.charCodeAt(w), (_ & 64512) === 55296 && w + 1 < m && (E = d.charCodeAt(w + 1), (E & 64512) === 56320 && (_ = 65536 + (_ - 55296 << 10) + (E - 56320), w++)), _ < 128 ? f[h++] = _ : _ < 2048 ? (f[h++] = 192 | _ >>> 6, f[h++] = 128 | _ & 63) : _ < 65536 ? (f[h++] = 224 | _ >>> 12, f[h++] = 128 | _ >>> 6 & 63, f[h++] = 128 | _ & 63) : (f[h++] = 240 | _ >>> 18, f[h++] = 128 | _ >>> 12 & 63, f[h++] = 128 | _ >>> 6 & 63, f[h++] = 128 | _ & 63);
    return f;
  }, c = function(d, f) {
    var _;
    for (f = f || d.length, f > d.length && (f = d.length), _ = f - 1; _ >= 0 && (d[_] & 192) === 128; )
      _--;
    return _ < 0 || _ === 0 ? f : _ + n[d[_]] > f ? _ : f;
  }, u = function(d) {
    var f, _, E, w, h = d.length, m = new Array(h * 2);
    for (_ = 0, f = 0; f < h; ) {
      if (E = d[f++], E < 128) {
        m[_++] = E;
        continue;
      }
      if (w = n[E], w > 4) {
        m[_++] = 65533, f += w - 1;
        continue;
      }
      for (E &= w === 2 ? 31 : w === 3 ? 15 : 7; w > 1 && f < h; )
        E = E << 6 | d[f++] & 63, w--;
      if (w > 1) {
        m[_++] = 65533;
        continue;
      }
      E < 65536 ? m[_++] = E : (E -= 65536, m[_++] = 55296 | E >> 10 & 1023, m[_++] = 56320 | E & 1023);
    }
    return m.length !== _ && (m.subarray ? m = m.subarray(0, _) : m.length = _), t.applyFromCharCode(m);
  };
  e.utf8encode = function(f) {
    return r.nodebuffer ? i.newBufferFrom(f, "utf-8") : o(f);
  }, e.utf8decode = function(f) {
    return r.nodebuffer ? t.transformTo("nodebuffer", f).toString("utf-8") : (f = t.transformTo(r.uint8array ? "uint8array" : "array", f), u(f));
  };
  function l() {
    s.call(this, "utf-8 decode"), this.leftOver = null;
  }
  t.inherits(l, s), l.prototype.processChunk = function(d) {
    var f = t.transformTo(r.uint8array ? "uint8array" : "array", d.data);
    if (this.leftOver && this.leftOver.length) {
      if (r.uint8array) {
        var _ = f;
        f = new Uint8Array(_.length + this.leftOver.length), f.set(this.leftOver, 0), f.set(_, this.leftOver.length);
      } else
        f = this.leftOver.concat(f);
      this.leftOver = null;
    }
    var E = c(f), w = f;
    E !== f.length && (r.uint8array ? (w = f.subarray(0, E), this.leftOver = f.subarray(E, f.length)) : (w = f.slice(0, E), this.leftOver = f.slice(E, f.length))), this.push({
      data: e.utf8decode(w),
      meta: d.meta
    });
  }, l.prototype.flush = function() {
    this.leftOver && this.leftOver.length && (this.push({
      data: e.utf8decode(this.leftOver),
      meta: {}
    }), this.leftOver = null);
  }, e.Utf8DecodeWorker = l;
  function p() {
    s.call(this, "utf-8 encode");
  }
  t.inherits(p, s), p.prototype.processChunk = function(d) {
    this.push({
      data: e.utf8encode(d.data),
      meta: d.meta
    });
  }, e.Utf8EncodeWorker = p;
})(br);
var _u = Be, Eu = le();
function aa(e) {
  _u.call(this, "ConvertWorker to " + e), this.destType = e;
}
Eu.inherits(aa, _u);
aa.prototype.processChunk = function(e) {
  this.push({
    data: Eu.transformTo(this.destType, e.data),
    meta: e.meta
  });
};
var $h = aa, Gn, po;
function Hh() {
  if (po) return Gn;
  po = 1;
  var e = fu().Readable, t = le();
  t.inherits(r, e);
  function r(i, s, n) {
    e.call(this, s), this._helper = i;
    var a = this;
    i.on("data", function(o, c) {
      a.push(o) || a._helper.pause(), n && n(c);
    }).on("error", function(o) {
      a.emit("error", o);
    }).on("end", function() {
      a.push(null);
    });
  }
  return r.prototype._read = function() {
    this._helper.resume();
  }, Gn = r, Gn;
}
var $t = le(), Xh = $h, Wh = Be, zh = hu(), qh = pe, Kh = ti, mu = null;
if (qh.nodestream)
  try {
    mu = Hh();
  } catch {
  }
function Yh(e, t, r) {
  switch (e) {
    case "blob":
      return $t.newBlob($t.transformTo("arraybuffer", t), r);
    case "base64":
      return zh.encode(t);
    default:
      return $t.transformTo(e, t);
  }
}
function jh(e, t) {
  var r, i = 0, s = null, n = 0;
  for (r = 0; r < t.length; r++)
    n += t[r].length;
  switch (e) {
    case "string":
      return t.join("");
    case "array":
      return Array.prototype.concat.apply([], t);
    case "uint8array":
      for (s = new Uint8Array(n), r = 0; r < t.length; r++)
        s.set(t[r], i), i += t[r].length;
      return s;
    case "nodebuffer":
      return Buffer.concat(t);
    default:
      throw new Error("concat : unsupported type '" + e + "'");
  }
}
function Gh(e, t) {
  return new Kh.Promise(function(r, i) {
    var s = [], n = e._internalType, a = e._outputType, o = e._mimeType;
    e.on("data", function(c, u) {
      s.push(c), t && t(u);
    }).on("error", function(c) {
      s = [], i(c);
    }).on("end", function() {
      try {
        var c = Yh(a, jh(n, s), o);
        r(c);
      } catch (u) {
        i(u);
      }
      s = [];
    }).resume();
  });
}
function Tu(e, t, r) {
  var i = t;
  switch (t) {
    case "blob":
    case "arraybuffer":
      i = "uint8array";
      break;
    case "base64":
      i = "string";
      break;
  }
  try {
    this._internalType = i, this._outputType = t, this._mimeType = r, $t.checkSupport(i), this._worker = e.pipe(new Xh(i)), e.lock();
  } catch (s) {
    this._worker = new Wh("error"), this._worker.error(s);
  }
}
Tu.prototype = {
  /**
   * Listen a StreamHelper, accumulate its content and concatenate it into a
   * complete block.
   * @param {Function} updateCb the update callback.
   * @return Promise the promise for the accumulation.
   */
  accumulate: function(e) {
    return Gh(this, e);
  },
  /**
   * Add a listener on an event triggered on a stream.
   * @param {String} evt the name of the event
   * @param {Function} fn the listener
   * @return {StreamHelper} the current helper.
   */
  on: function(e, t) {
    var r = this;
    return e === "data" ? this._worker.on(e, function(i) {
      t.call(r, i.data, i.meta);
    }) : this._worker.on(e, function() {
      $t.delay(t, arguments, r);
    }), this;
  },
  /**
   * Resume the flow of chunks.
   * @return {StreamHelper} the current helper.
   */
  resume: function() {
    return $t.delay(this._worker.resume, [], this._worker), this;
  },
  /**
   * Pause the flow of chunks.
   * @return {StreamHelper} the current helper.
   */
  pause: function() {
    return this._worker.pause(), this;
  },
  /**
   * Return a nodejs stream for this helper.
   * @param {Function} updateCb the update callback.
   * @return {NodejsStreamOutputAdapter} the nodejs stream.
   */
  toNodejsStream: function(e) {
    if ($t.checkSupport("nodestream"), this._outputType !== "nodebuffer")
      throw new Error(this._outputType + " is not supported by this method");
    return new mu(this, {
      objectMode: this._outputType !== "nodebuffer"
    }, e);
  }
};
var gu = Tu, Fe = {};
Fe.base64 = !1;
Fe.binary = !1;
Fe.dir = !1;
Fe.createFolders = !0;
Fe.date = null;
Fe.compression = null;
Fe.compressionOptions = null;
Fe.comment = null;
Fe.unixPermissions = null;
Fe.dosPermissions = null;
var fn = le(), hn = Be, Vh = 16 * 1024;
function vr(e) {
  hn.call(this, "DataWorker");
  var t = this;
  this.dataIsReady = !1, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = !1, e.then(function(r) {
    t.dataIsReady = !0, t.data = r, t.max = r && r.length || 0, t.type = fn.getTypeOf(r), t.isPaused || t._tickAndRepeat();
  }, function(r) {
    t.error(r);
  });
}
fn.inherits(vr, hn);
vr.prototype.cleanUp = function() {
  hn.prototype.cleanUp.call(this), this.data = null;
};
vr.prototype.resume = function() {
  return hn.prototype.resume.call(this) ? (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = !0, fn.delay(this._tickAndRepeat, [], this)), !0) : !1;
};
vr.prototype._tickAndRepeat = function() {
  this._tickScheduled = !1, !(this.isPaused || this.isFinished) && (this._tick(), this.isFinished || (fn.delay(this._tickAndRepeat, [], this), this._tickScheduled = !0));
};
vr.prototype._tick = function() {
  if (this.isPaused || this.isFinished)
    return !1;
  var e = Vh, t = null, r = Math.min(this.max, this.index + e);
  if (this.index >= this.max)
    return this.end();
  switch (this.type) {
    case "string":
      t = this.data.substring(this.index, r);
      break;
    case "uint8array":
      t = this.data.subarray(this.index, r);
      break;
    case "array":
    case "nodebuffer":
      t = this.data.slice(this.index, r);
      break;
  }
  return this.index = r, this.push({
    data: t,
    meta: {
      percent: this.max ? this.index / this.max * 100 : 0
    }
  });
};
var bu = vr, Zh = le();
function Jh() {
  for (var e, t = [], r = 0; r < 256; r++) {
    e = r;
    for (var i = 0; i < 8; i++)
      e = e & 1 ? 3988292384 ^ e >>> 1 : e >>> 1;
    t[r] = e;
  }
  return t;
}
var vu = Jh();
function Qh(e, t, r, i) {
  var s = vu, n = i + r;
  e = e ^ -1;
  for (var a = i; a < n; a++)
    e = e >>> 8 ^ s[(e ^ t[a]) & 255];
  return e ^ -1;
}
function ep(e, t, r, i) {
  var s = vu, n = i + r;
  e = e ^ -1;
  for (var a = i; a < n; a++)
    e = e >>> 8 ^ s[(e ^ t.charCodeAt(a)) & 255];
  return e ^ -1;
}
var oa = function(t, r) {
  if (typeof t > "u" || !t.length)
    return 0;
  var i = Zh.getTypeOf(t) !== "string";
  return i ? Qh(r | 0, t, t.length, 0) : ep(r | 0, t, t.length, 0);
}, yu = Be, tp = oa, rp = le();
function ca() {
  yu.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
}
rp.inherits(ca, yu);
ca.prototype.processChunk = function(e) {
  this.streamInfo.crc32 = tp(e.data, this.streamInfo.crc32 || 0), this.push(e);
};
var wu = ca, ip = le(), ua = Be;
function la(e) {
  ua.call(this, "DataLengthProbe for " + e), this.propName = e, this.withStreamInfo(e, 0);
}
ip.inherits(la, ua);
la.prototype.processChunk = function(e) {
  if (e) {
    var t = this.streamInfo[this.propName] || 0;
    this.streamInfo[this.propName] = t + e.data.length;
  }
  ua.prototype.processChunk.call(this, e);
};
var np = la, _o = ti, Eo = bu, sp = wu, Os = np;
function da(e, t, r, i, s) {
  this.compressedSize = e, this.uncompressedSize = t, this.crc32 = r, this.compression = i, this.compressedContent = s;
}
da.prototype = {
  /**
   * Create a worker to get the uncompressed content.
   * @return {GenericWorker} the worker.
   */
  getContentWorker: function() {
    var e = new Eo(_o.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new Os("data_length")), t = this;
    return e.on("end", function() {
      if (this.streamInfo.data_length !== t.uncompressedSize)
        throw new Error("Bug : uncompressed data size mismatch");
    }), e;
  },
  /**
   * Create a worker to get the compressed content.
   * @return {GenericWorker} the worker.
   */
  getCompressedWorker: function() {
    return new Eo(_o.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
  }
};
da.createWorkerFrom = function(e, t, r) {
  return e.pipe(new sp()).pipe(new Os("uncompressedSize")).pipe(t.compressWorker(r)).pipe(new Os("compressedSize")).withStreamInfo("compression", t);
};
var fa = da, ap = gu, op = bu, Vn = br, Zn = fa, mo = Be, ha = function(e, t, r) {
  this.name = e, this.dir = r.dir, this.date = r.date, this.comment = r.comment, this.unixPermissions = r.unixPermissions, this.dosPermissions = r.dosPermissions, this._data = t, this._dataBinary = r.binary, this.options = {
    compression: r.compression,
    compressionOptions: r.compressionOptions
  };
};
ha.prototype = {
  /**
   * Create an internal stream for the content of this object.
   * @param {String} type the type of each chunk.
   * @return StreamHelper the stream.
   */
  internalStream: function(e) {
    var t = null, r = "string";
    try {
      if (!e)
        throw new Error("No output type specified.");
      r = e.toLowerCase();
      var i = r === "string" || r === "text";
      (r === "binarystring" || r === "text") && (r = "string"), t = this._decompressWorker();
      var s = !this._dataBinary;
      s && !i && (t = t.pipe(new Vn.Utf8EncodeWorker())), !s && i && (t = t.pipe(new Vn.Utf8DecodeWorker()));
    } catch (n) {
      t = new mo("error"), t.error(n);
    }
    return new ap(t, r, "");
  },
  /**
   * Prepare the content in the asked type.
   * @param {String} type the type of the result.
   * @param {Function} onUpdate a function to call on each internal update.
   * @return Promise the promise of the result.
   */
  async: function(e, t) {
    return this.internalStream(e).accumulate(t);
  },
  /**
   * Prepare the content as a nodejs stream.
   * @param {String} type the type of each chunk.
   * @param {Function} onUpdate a function to call on each internal update.
   * @return Stream the stream.
   */
  nodeStream: function(e, t) {
    return this.internalStream(e || "nodebuffer").toNodejsStream(t);
  },
  /**
   * Return a worker for the compressed content.
   * @private
   * @param {Object} compression the compression object to use.
   * @param {Object} compressionOptions the options to use when compressing.
   * @return Worker the worker.
   */
  _compressWorker: function(e, t) {
    if (this._data instanceof Zn && this._data.compression.magic === e.magic)
      return this._data.getCompressedWorker();
    var r = this._decompressWorker();
    return this._dataBinary || (r = r.pipe(new Vn.Utf8EncodeWorker())), Zn.createWorkerFrom(r, e, t);
  },
  /**
   * Return a worker for the decompressed content.
   * @private
   * @return Worker the worker.
   */
  _decompressWorker: function() {
    return this._data instanceof Zn ? this._data.getContentWorker() : this._data instanceof mo ? this._data : new op(this._data);
  }
};
var To = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], cp = function() {
  throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
};
for (var Jn = 0; Jn < To.length; Jn++)
  ha.prototype[To[Jn]] = cp;
var up = ha, Su = {}, pn = {}, _n = {}, ht = {};
(function(e) {
  var t = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Int32Array < "u";
  function r(n, a) {
    return Object.prototype.hasOwnProperty.call(n, a);
  }
  e.assign = function(n) {
    for (var a = Array.prototype.slice.call(arguments, 1); a.length; ) {
      var o = a.shift();
      if (o) {
        if (typeof o != "object")
          throw new TypeError(o + "must be non-object");
        for (var c in o)
          r(o, c) && (n[c] = o[c]);
      }
    }
    return n;
  }, e.shrinkBuf = function(n, a) {
    return n.length === a ? n : n.subarray ? n.subarray(0, a) : (n.length = a, n);
  };
  var i = {
    arraySet: function(n, a, o, c, u) {
      if (a.subarray && n.subarray) {
        n.set(a.subarray(o, o + c), u);
        return;
      }
      for (var l = 0; l < c; l++)
        n[u + l] = a[o + l];
    },
    // Join array of chunks to single array.
    flattenChunks: function(n) {
      var a, o, c, u, l, p;
      for (c = 0, a = 0, o = n.length; a < o; a++)
        c += n[a].length;
      for (p = new Uint8Array(c), u = 0, a = 0, o = n.length; a < o; a++)
        l = n[a], p.set(l, u), u += l.length;
      return p;
    }
  }, s = {
    arraySet: function(n, a, o, c, u) {
      for (var l = 0; l < c; l++)
        n[u + l] = a[o + l];
    },
    // Join array of chunks to single array.
    flattenChunks: function(n) {
      return [].concat.apply([], n);
    }
  };
  e.setTyped = function(n) {
    n ? (e.Buf8 = Uint8Array, e.Buf16 = Uint16Array, e.Buf32 = Int32Array, e.assign(e, i)) : (e.Buf8 = Array, e.Buf16 = Array, e.Buf32 = Array, e.assign(e, s));
  }, e.setTyped(t);
})(ht);
var ri = {}, rt = {}, yr = {}, lp = ht, dp = 4, go = 0, bo = 1, fp = 2;
function wr(e) {
  for (var t = e.length; --t >= 0; )
    e[t] = 0;
}
var hp = 0, Ru = 1, pp = 2, _p = 3, Ep = 258, pa = 29, ii = 256, Xr = ii + 1 + pa, cr = 30, _a = 19, Nu = 2 * Xr + 1, Ft = 15, Qn = 16, mp = 7, Ea = 256, Iu = 16, Lu = 17, Au = 18, ks = (
  /* extra bits for each length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
), Pi = (
  /* extra bits for each distance code */
  [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
), Tp = (
  /* extra bits for each bit length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]
), Cu = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], gp = 512, ut = new Array((Xr + 2) * 2);
wr(ut);
var Ur = new Array(cr * 2);
wr(Ur);
var Wr = new Array(gp);
wr(Wr);
var zr = new Array(Ep - _p + 1);
wr(zr);
var ma = new Array(pa);
wr(ma);
var Yi = new Array(cr);
wr(Yi);
function es(e, t, r, i, s) {
  this.static_tree = e, this.extra_bits = t, this.extra_base = r, this.elems = i, this.max_length = s, this.has_stree = e && e.length;
}
var Ou, ku, xu;
function ts(e, t) {
  this.dyn_tree = e, this.max_code = 0, this.stat_desc = t;
}
function Du(e) {
  return e < 256 ? Wr[e] : Wr[256 + (e >>> 7)];
}
function qr(e, t) {
  e.pending_buf[e.pending++] = t & 255, e.pending_buf[e.pending++] = t >>> 8 & 255;
}
function Le(e, t, r) {
  e.bi_valid > Qn - r ? (e.bi_buf |= t << e.bi_valid & 65535, qr(e, e.bi_buf), e.bi_buf = t >> Qn - e.bi_valid, e.bi_valid += r - Qn) : (e.bi_buf |= t << e.bi_valid & 65535, e.bi_valid += r);
}
function Qe(e, t, r) {
  Le(
    e,
    r[t * 2],
    r[t * 2 + 1]
    /*.Len*/
  );
}
function Uu(e, t) {
  var r = 0;
  do
    r |= e & 1, e >>>= 1, r <<= 1;
  while (--t > 0);
  return r >>> 1;
}
function bp(e) {
  e.bi_valid === 16 ? (qr(e, e.bi_buf), e.bi_buf = 0, e.bi_valid = 0) : e.bi_valid >= 8 && (e.pending_buf[e.pending++] = e.bi_buf & 255, e.bi_buf >>= 8, e.bi_valid -= 8);
}
function vp(e, t) {
  var r = t.dyn_tree, i = t.max_code, s = t.stat_desc.static_tree, n = t.stat_desc.has_stree, a = t.stat_desc.extra_bits, o = t.stat_desc.extra_base, c = t.stat_desc.max_length, u, l, p, d, f, _, E = 0;
  for (d = 0; d <= Ft; d++)
    e.bl_count[d] = 0;
  for (r[e.heap[e.heap_max] * 2 + 1] = 0, u = e.heap_max + 1; u < Nu; u++)
    l = e.heap[u], d = r[r[l * 2 + 1] * 2 + 1] + 1, d > c && (d = c, E++), r[l * 2 + 1] = d, !(l > i) && (e.bl_count[d]++, f = 0, l >= o && (f = a[l - o]), _ = r[l * 2], e.opt_len += _ * (d + f), n && (e.static_len += _ * (s[l * 2 + 1] + f)));
  if (E !== 0) {
    do {
      for (d = c - 1; e.bl_count[d] === 0; )
        d--;
      e.bl_count[d]--, e.bl_count[d + 1] += 2, e.bl_count[c]--, E -= 2;
    } while (E > 0);
    for (d = c; d !== 0; d--)
      for (l = e.bl_count[d]; l !== 0; )
        p = e.heap[--u], !(p > i) && (r[p * 2 + 1] !== d && (e.opt_len += (d - r[p * 2 + 1]) * r[p * 2], r[p * 2 + 1] = d), l--);
  }
}
function Pu(e, t, r) {
  var i = new Array(Ft + 1), s = 0, n, a;
  for (n = 1; n <= Ft; n++)
    i[n] = s = s + r[n - 1] << 1;
  for (a = 0; a <= t; a++) {
    var o = e[a * 2 + 1];
    o !== 0 && (e[a * 2] = Uu(i[o]++, o));
  }
}
function yp() {
  var e, t, r, i, s, n = new Array(Ft + 1);
  for (r = 0, i = 0; i < pa - 1; i++)
    for (ma[i] = r, e = 0; e < 1 << ks[i]; e++)
      zr[r++] = i;
  for (zr[r - 1] = i, s = 0, i = 0; i < 16; i++)
    for (Yi[i] = s, e = 0; e < 1 << Pi[i]; e++)
      Wr[s++] = i;
  for (s >>= 7; i < cr; i++)
    for (Yi[i] = s << 7, e = 0; e < 1 << Pi[i] - 7; e++)
      Wr[256 + s++] = i;
  for (t = 0; t <= Ft; t++)
    n[t] = 0;
  for (e = 0; e <= 143; )
    ut[e * 2 + 1] = 8, e++, n[8]++;
  for (; e <= 255; )
    ut[e * 2 + 1] = 9, e++, n[9]++;
  for (; e <= 279; )
    ut[e * 2 + 1] = 7, e++, n[7]++;
  for (; e <= 287; )
    ut[e * 2 + 1] = 8, e++, n[8]++;
  for (Pu(ut, Xr + 1, n), e = 0; e < cr; e++)
    Ur[e * 2 + 1] = 5, Ur[e * 2] = Uu(e, 5);
  Ou = new es(ut, ks, ii + 1, Xr, Ft), ku = new es(Ur, Pi, 0, cr, Ft), xu = new es(new Array(0), Tp, 0, _a, mp);
}
function Bu(e) {
  var t;
  for (t = 0; t < Xr; t++)
    e.dyn_ltree[t * 2] = 0;
  for (t = 0; t < cr; t++)
    e.dyn_dtree[t * 2] = 0;
  for (t = 0; t < _a; t++)
    e.bl_tree[t * 2] = 0;
  e.dyn_ltree[Ea * 2] = 1, e.opt_len = e.static_len = 0, e.last_lit = e.matches = 0;
}
function Fu(e) {
  e.bi_valid > 8 ? qr(e, e.bi_buf) : e.bi_valid > 0 && (e.pending_buf[e.pending++] = e.bi_buf), e.bi_buf = 0, e.bi_valid = 0;
}
function wp(e, t, r, i) {
  Fu(e), qr(e, r), qr(e, ~r), lp.arraySet(e.pending_buf, e.window, t, r, e.pending), e.pending += r;
}
function vo(e, t, r, i) {
  var s = t * 2, n = r * 2;
  return e[s] < e[n] || e[s] === e[n] && i[t] <= i[r];
}
function rs(e, t, r) {
  for (var i = e.heap[r], s = r << 1; s <= e.heap_len && (s < e.heap_len && vo(t, e.heap[s + 1], e.heap[s], e.depth) && s++, !vo(t, i, e.heap[s], e.depth)); )
    e.heap[r] = e.heap[s], r = s, s <<= 1;
  e.heap[r] = i;
}
function yo(e, t, r) {
  var i, s, n = 0, a, o;
  if (e.last_lit !== 0)
    do
      i = e.pending_buf[e.d_buf + n * 2] << 8 | e.pending_buf[e.d_buf + n * 2 + 1], s = e.pending_buf[e.l_buf + n], n++, i === 0 ? Qe(e, s, t) : (a = zr[s], Qe(e, a + ii + 1, t), o = ks[a], o !== 0 && (s -= ma[a], Le(e, s, o)), i--, a = Du(i), Qe(e, a, r), o = Pi[a], o !== 0 && (i -= Yi[a], Le(e, i, o)));
    while (n < e.last_lit);
  Qe(e, Ea, t);
}
function xs(e, t) {
  var r = t.dyn_tree, i = t.stat_desc.static_tree, s = t.stat_desc.has_stree, n = t.stat_desc.elems, a, o, c = -1, u;
  for (e.heap_len = 0, e.heap_max = Nu, a = 0; a < n; a++)
    r[a * 2] !== 0 ? (e.heap[++e.heap_len] = c = a, e.depth[a] = 0) : r[a * 2 + 1] = 0;
  for (; e.heap_len < 2; )
    u = e.heap[++e.heap_len] = c < 2 ? ++c : 0, r[u * 2] = 1, e.depth[u] = 0, e.opt_len--, s && (e.static_len -= i[u * 2 + 1]);
  for (t.max_code = c, a = e.heap_len >> 1; a >= 1; a--)
    rs(e, r, a);
  u = n;
  do
    a = e.heap[
      1
      /*SMALLEST*/
    ], e.heap[
      1
      /*SMALLEST*/
    ] = e.heap[e.heap_len--], rs(
      e,
      r,
      1
      /*SMALLEST*/
    ), o = e.heap[
      1
      /*SMALLEST*/
    ], e.heap[--e.heap_max] = a, e.heap[--e.heap_max] = o, r[u * 2] = r[a * 2] + r[o * 2], e.depth[u] = (e.depth[a] >= e.depth[o] ? e.depth[a] : e.depth[o]) + 1, r[a * 2 + 1] = r[o * 2 + 1] = u, e.heap[
      1
      /*SMALLEST*/
    ] = u++, rs(
      e,
      r,
      1
      /*SMALLEST*/
    );
  while (e.heap_len >= 2);
  e.heap[--e.heap_max] = e.heap[
    1
    /*SMALLEST*/
  ], vp(e, t), Pu(r, c, e.bl_count);
}
function wo(e, t, r) {
  var i, s = -1, n, a = t[0 * 2 + 1], o = 0, c = 7, u = 4;
  for (a === 0 && (c = 138, u = 3), t[(r + 1) * 2 + 1] = 65535, i = 0; i <= r; i++)
    n = a, a = t[(i + 1) * 2 + 1], !(++o < c && n === a) && (o < u ? e.bl_tree[n * 2] += o : n !== 0 ? (n !== s && e.bl_tree[n * 2]++, e.bl_tree[Iu * 2]++) : o <= 10 ? e.bl_tree[Lu * 2]++ : e.bl_tree[Au * 2]++, o = 0, s = n, a === 0 ? (c = 138, u = 3) : n === a ? (c = 6, u = 3) : (c = 7, u = 4));
}
function So(e, t, r) {
  var i, s = -1, n, a = t[0 * 2 + 1], o = 0, c = 7, u = 4;
  for (a === 0 && (c = 138, u = 3), i = 0; i <= r; i++)
    if (n = a, a = t[(i + 1) * 2 + 1], !(++o < c && n === a)) {
      if (o < u)
        do
          Qe(e, n, e.bl_tree);
        while (--o !== 0);
      else n !== 0 ? (n !== s && (Qe(e, n, e.bl_tree), o--), Qe(e, Iu, e.bl_tree), Le(e, o - 3, 2)) : o <= 10 ? (Qe(e, Lu, e.bl_tree), Le(e, o - 3, 3)) : (Qe(e, Au, e.bl_tree), Le(e, o - 11, 7));
      o = 0, s = n, a === 0 ? (c = 138, u = 3) : n === a ? (c = 6, u = 3) : (c = 7, u = 4);
    }
}
function Sp(e) {
  var t;
  for (wo(e, e.dyn_ltree, e.l_desc.max_code), wo(e, e.dyn_dtree, e.d_desc.max_code), xs(e, e.bl_desc), t = _a - 1; t >= 3 && e.bl_tree[Cu[t] * 2 + 1] === 0; t--)
    ;
  return e.opt_len += 3 * (t + 1) + 5 + 5 + 4, t;
}
function Rp(e, t, r, i) {
  var s;
  for (Le(e, t - 257, 5), Le(e, r - 1, 5), Le(e, i - 4, 4), s = 0; s < i; s++)
    Le(e, e.bl_tree[Cu[s] * 2 + 1], 3);
  So(e, e.dyn_ltree, t - 1), So(e, e.dyn_dtree, r - 1);
}
function Np(e) {
  var t = 4093624447, r;
  for (r = 0; r <= 31; r++, t >>>= 1)
    if (t & 1 && e.dyn_ltree[r * 2] !== 0)
      return go;
  if (e.dyn_ltree[9 * 2] !== 0 || e.dyn_ltree[10 * 2] !== 0 || e.dyn_ltree[13 * 2] !== 0)
    return bo;
  for (r = 32; r < ii; r++)
    if (e.dyn_ltree[r * 2] !== 0)
      return bo;
  return go;
}
var Ro = !1;
function Ip(e) {
  Ro || (yp(), Ro = !0), e.l_desc = new ts(e.dyn_ltree, Ou), e.d_desc = new ts(e.dyn_dtree, ku), e.bl_desc = new ts(e.bl_tree, xu), e.bi_buf = 0, e.bi_valid = 0, Bu(e);
}
function Mu(e, t, r, i) {
  Le(e, (hp << 1) + (i ? 1 : 0), 3), wp(e, t, r);
}
function Lp(e) {
  Le(e, Ru << 1, 3), Qe(e, Ea, ut), bp(e);
}
function Ap(e, t, r, i) {
  var s, n, a = 0;
  e.level > 0 ? (e.strm.data_type === fp && (e.strm.data_type = Np(e)), xs(e, e.l_desc), xs(e, e.d_desc), a = Sp(e), s = e.opt_len + 3 + 7 >>> 3, n = e.static_len + 3 + 7 >>> 3, n <= s && (s = n)) : s = n = r + 5, r + 4 <= s && t !== -1 ? Mu(e, t, r, i) : e.strategy === dp || n === s ? (Le(e, (Ru << 1) + (i ? 1 : 0), 3), yo(e, ut, Ur)) : (Le(e, (pp << 1) + (i ? 1 : 0), 3), Rp(e, e.l_desc.max_code + 1, e.d_desc.max_code + 1, a + 1), yo(e, e.dyn_ltree, e.dyn_dtree)), Bu(e), i && Fu(e);
}
function Cp(e, t, r) {
  return e.pending_buf[e.d_buf + e.last_lit * 2] = t >>> 8 & 255, e.pending_buf[e.d_buf + e.last_lit * 2 + 1] = t & 255, e.pending_buf[e.l_buf + e.last_lit] = r & 255, e.last_lit++, t === 0 ? e.dyn_ltree[r * 2]++ : (e.matches++, t--, e.dyn_ltree[(zr[r] + ii + 1) * 2]++, e.dyn_dtree[Du(t) * 2]++), e.last_lit === e.lit_bufsize - 1;
}
yr._tr_init = Ip;
yr._tr_stored_block = Mu;
yr._tr_flush_block = Ap;
yr._tr_tally = Cp;
yr._tr_align = Lp;
function Op(e, t, r, i) {
  for (var s = e & 65535 | 0, n = e >>> 16 & 65535 | 0, a = 0; r !== 0; ) {
    a = r > 2e3 ? 2e3 : r, r -= a;
    do
      s = s + t[i++] | 0, n = n + s | 0;
    while (--a);
    s %= 65521, n %= 65521;
  }
  return s | n << 16 | 0;
}
var $u = Op;
function kp() {
  for (var e, t = [], r = 0; r < 256; r++) {
    e = r;
    for (var i = 0; i < 8; i++)
      e = e & 1 ? 3988292384 ^ e >>> 1 : e >>> 1;
    t[r] = e;
  }
  return t;
}
var xp = kp();
function Dp(e, t, r, i) {
  var s = xp, n = i + r;
  e ^= -1;
  for (var a = i; a < n; a++)
    e = e >>> 8 ^ s[(e ^ t[a]) & 255];
  return e ^ -1;
}
var Hu = Dp, Ta = {
  2: "need dictionary",
  /* Z_NEED_DICT       2  */
  1: "stream end",
  /* Z_STREAM_END      1  */
  0: "",
  /* Z_OK              0  */
  "-1": "file error",
  /* Z_ERRNO         (-1) */
  "-2": "stream error",
  /* Z_STREAM_ERROR  (-2) */
  "-3": "data error",
  /* Z_DATA_ERROR    (-3) */
  "-4": "insufficient memory",
  /* Z_MEM_ERROR     (-4) */
  "-5": "buffer error",
  /* Z_BUF_ERROR     (-5) */
  "-6": "incompatible version"
  /* Z_VERSION_ERROR (-6) */
}, Re = ht, xe = yr, Xu = $u, Tt = Hu, Up = Ta, jt = 0, Pp = 1, Bp = 3, Nt = 4, No = 5, et = 0, Io = 1, De = -2, Fp = -3, is = -5, Mp = -1, $p = 1, Si = 2, Hp = 3, Xp = 4, Wp = 0, zp = 2, En = 8, qp = 9, Kp = 15, Yp = 8, jp = 29, Gp = 256, Ds = Gp + 1 + jp, Vp = 30, Zp = 19, Jp = 2 * Ds + 1, Qp = 15, Y = 3, wt = 258, ze = wt + Y + 1, e_ = 32, mn = 42, Us = 69, Bi = 73, Fi = 91, Mi = 103, Mt = 113, xr = 666, Ee = 1, ni = 2, Wt = 3, Sr = 4, t_ = 3;
function St(e, t) {
  return e.msg = Up[t], t;
}
function Lo(e) {
  return (e << 1) - (e > 4 ? 9 : 0);
}
function yt(e) {
  for (var t = e.length; --t >= 0; )
    e[t] = 0;
}
function gt(e) {
  var t = e.state, r = t.pending;
  r > e.avail_out && (r = e.avail_out), r !== 0 && (Re.arraySet(e.output, t.pending_buf, t.pending_out, r, e.next_out), e.next_out += r, t.pending_out += r, e.total_out += r, e.avail_out -= r, t.pending -= r, t.pending === 0 && (t.pending_out = 0));
}
function we(e, t) {
  xe._tr_flush_block(e, e.block_start >= 0 ? e.block_start : -1, e.strstart - e.block_start, t), e.block_start = e.strstart, gt(e.strm);
}
function Z(e, t) {
  e.pending_buf[e.pending++] = t;
}
function kr(e, t) {
  e.pending_buf[e.pending++] = t >>> 8 & 255, e.pending_buf[e.pending++] = t & 255;
}
function r_(e, t, r, i) {
  var s = e.avail_in;
  return s > i && (s = i), s === 0 ? 0 : (e.avail_in -= s, Re.arraySet(t, e.input, e.next_in, s, r), e.state.wrap === 1 ? e.adler = Xu(e.adler, t, s, r) : e.state.wrap === 2 && (e.adler = Tt(e.adler, t, s, r)), e.next_in += s, e.total_in += s, s);
}
function Wu(e, t) {
  var r = e.max_chain_length, i = e.strstart, s, n, a = e.prev_length, o = e.nice_match, c = e.strstart > e.w_size - ze ? e.strstart - (e.w_size - ze) : 0, u = e.window, l = e.w_mask, p = e.prev, d = e.strstart + wt, f = u[i + a - 1], _ = u[i + a];
  e.prev_length >= e.good_match && (r >>= 2), o > e.lookahead && (o = e.lookahead);
  do
    if (s = t, !(u[s + a] !== _ || u[s + a - 1] !== f || u[s] !== u[i] || u[++s] !== u[i + 1])) {
      i += 2, s++;
      do
        ;
      while (u[++i] === u[++s] && u[++i] === u[++s] && u[++i] === u[++s] && u[++i] === u[++s] && u[++i] === u[++s] && u[++i] === u[++s] && u[++i] === u[++s] && u[++i] === u[++s] && i < d);
      if (n = wt - (d - i), i = d - wt, n > a) {
        if (e.match_start = t, a = n, n >= o)
          break;
        f = u[i + a - 1], _ = u[i + a];
      }
    }
  while ((t = p[t & l]) > c && --r !== 0);
  return a <= e.lookahead ? a : e.lookahead;
}
function zt(e) {
  var t = e.w_size, r, i, s, n, a;
  do {
    if (n = e.window_size - e.lookahead - e.strstart, e.strstart >= t + (t - ze)) {
      Re.arraySet(e.window, e.window, t, t, 0), e.match_start -= t, e.strstart -= t, e.block_start -= t, i = e.hash_size, r = i;
      do
        s = e.head[--r], e.head[r] = s >= t ? s - t : 0;
      while (--i);
      i = t, r = i;
      do
        s = e.prev[--r], e.prev[r] = s >= t ? s - t : 0;
      while (--i);
      n += t;
    }
    if (e.strm.avail_in === 0)
      break;
    if (i = r_(e.strm, e.window, e.strstart + e.lookahead, n), e.lookahead += i, e.lookahead + e.insert >= Y)
      for (a = e.strstart - e.insert, e.ins_h = e.window[a], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[a + 1]) & e.hash_mask; e.insert && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[a + Y - 1]) & e.hash_mask, e.prev[a & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = a, a++, e.insert--, !(e.lookahead + e.insert < Y)); )
        ;
  } while (e.lookahead < ze && e.strm.avail_in !== 0);
}
function i_(e, t) {
  var r = 65535;
  for (r > e.pending_buf_size - 5 && (r = e.pending_buf_size - 5); ; ) {
    if (e.lookahead <= 1) {
      if (zt(e), e.lookahead === 0 && t === jt)
        return Ee;
      if (e.lookahead === 0)
        break;
    }
    e.strstart += e.lookahead, e.lookahead = 0;
    var i = e.block_start + r;
    if ((e.strstart === 0 || e.strstart >= i) && (e.lookahead = e.strstart - i, e.strstart = i, we(e, !1), e.strm.avail_out === 0) || e.strstart - e.block_start >= e.w_size - ze && (we(e, !1), e.strm.avail_out === 0))
      return Ee;
  }
  return e.insert = 0, t === Nt ? (we(e, !0), e.strm.avail_out === 0 ? Wt : Sr) : (e.strstart > e.block_start && (we(e, !1), e.strm.avail_out === 0), Ee);
}
function ns(e, t) {
  for (var r, i; ; ) {
    if (e.lookahead < ze) {
      if (zt(e), e.lookahead < ze && t === jt)
        return Ee;
      if (e.lookahead === 0)
        break;
    }
    if (r = 0, e.lookahead >= Y && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + Y - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), r !== 0 && e.strstart - r <= e.w_size - ze && (e.match_length = Wu(e, r)), e.match_length >= Y)
      if (i = xe._tr_tally(e, e.strstart - e.match_start, e.match_length - Y), e.lookahead -= e.match_length, e.match_length <= e.max_lazy_match && e.lookahead >= Y) {
        e.match_length--;
        do
          e.strstart++, e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + Y - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart;
        while (--e.match_length !== 0);
        e.strstart++;
      } else
        e.strstart += e.match_length, e.match_length = 0, e.ins_h = e.window[e.strstart], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + 1]) & e.hash_mask;
    else
      i = xe._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++;
    if (i && (we(e, !1), e.strm.avail_out === 0))
      return Ee;
  }
  return e.insert = e.strstart < Y - 1 ? e.strstart : Y - 1, t === Nt ? (we(e, !0), e.strm.avail_out === 0 ? Wt : Sr) : e.last_lit && (we(e, !1), e.strm.avail_out === 0) ? Ee : ni;
}
function er(e, t) {
  for (var r, i, s; ; ) {
    if (e.lookahead < ze) {
      if (zt(e), e.lookahead < ze && t === jt)
        return Ee;
      if (e.lookahead === 0)
        break;
    }
    if (r = 0, e.lookahead >= Y && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + Y - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), e.prev_length = e.match_length, e.prev_match = e.match_start, e.match_length = Y - 1, r !== 0 && e.prev_length < e.max_lazy_match && e.strstart - r <= e.w_size - ze && (e.match_length = Wu(e, r), e.match_length <= 5 && (e.strategy === $p || e.match_length === Y && e.strstart - e.match_start > 4096) && (e.match_length = Y - 1)), e.prev_length >= Y && e.match_length <= e.prev_length) {
      s = e.strstart + e.lookahead - Y, i = xe._tr_tally(e, e.strstart - 1 - e.prev_match, e.prev_length - Y), e.lookahead -= e.prev_length - 1, e.prev_length -= 2;
      do
        ++e.strstart <= s && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + Y - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart);
      while (--e.prev_length !== 0);
      if (e.match_available = 0, e.match_length = Y - 1, e.strstart++, i && (we(e, !1), e.strm.avail_out === 0))
        return Ee;
    } else if (e.match_available) {
      if (i = xe._tr_tally(e, 0, e.window[e.strstart - 1]), i && we(e, !1), e.strstart++, e.lookahead--, e.strm.avail_out === 0)
        return Ee;
    } else
      e.match_available = 1, e.strstart++, e.lookahead--;
  }
  return e.match_available && (i = xe._tr_tally(e, 0, e.window[e.strstart - 1]), e.match_available = 0), e.insert = e.strstart < Y - 1 ? e.strstart : Y - 1, t === Nt ? (we(e, !0), e.strm.avail_out === 0 ? Wt : Sr) : e.last_lit && (we(e, !1), e.strm.avail_out === 0) ? Ee : ni;
}
function n_(e, t) {
  for (var r, i, s, n, a = e.window; ; ) {
    if (e.lookahead <= wt) {
      if (zt(e), e.lookahead <= wt && t === jt)
        return Ee;
      if (e.lookahead === 0)
        break;
    }
    if (e.match_length = 0, e.lookahead >= Y && e.strstart > 0 && (s = e.strstart - 1, i = a[s], i === a[++s] && i === a[++s] && i === a[++s])) {
      n = e.strstart + wt;
      do
        ;
      while (i === a[++s] && i === a[++s] && i === a[++s] && i === a[++s] && i === a[++s] && i === a[++s] && i === a[++s] && i === a[++s] && s < n);
      e.match_length = wt - (n - s), e.match_length > e.lookahead && (e.match_length = e.lookahead);
    }
    if (e.match_length >= Y ? (r = xe._tr_tally(e, 1, e.match_length - Y), e.lookahead -= e.match_length, e.strstart += e.match_length, e.match_length = 0) : (r = xe._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++), r && (we(e, !1), e.strm.avail_out === 0))
      return Ee;
  }
  return e.insert = 0, t === Nt ? (we(e, !0), e.strm.avail_out === 0 ? Wt : Sr) : e.last_lit && (we(e, !1), e.strm.avail_out === 0) ? Ee : ni;
}
function s_(e, t) {
  for (var r; ; ) {
    if (e.lookahead === 0 && (zt(e), e.lookahead === 0)) {
      if (t === jt)
        return Ee;
      break;
    }
    if (e.match_length = 0, r = xe._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++, r && (we(e, !1), e.strm.avail_out === 0))
      return Ee;
  }
  return e.insert = 0, t === Nt ? (we(e, !0), e.strm.avail_out === 0 ? Wt : Sr) : e.last_lit && (we(e, !1), e.strm.avail_out === 0) ? Ee : ni;
}
function Ve(e, t, r, i, s) {
  this.good_length = e, this.max_lazy = t, this.nice_length = r, this.max_chain = i, this.func = s;
}
var sr;
sr = [
  /*      good lazy nice chain */
  new Ve(0, 0, 0, 0, i_),
  /* 0 store only */
  new Ve(4, 4, 8, 4, ns),
  /* 1 max speed, no lazy matches */
  new Ve(4, 5, 16, 8, ns),
  /* 2 */
  new Ve(4, 6, 32, 32, ns),
  /* 3 */
  new Ve(4, 4, 16, 16, er),
  /* 4 lazy matches */
  new Ve(8, 16, 32, 32, er),
  /* 5 */
  new Ve(8, 16, 128, 128, er),
  /* 6 */
  new Ve(8, 32, 128, 256, er),
  /* 7 */
  new Ve(32, 128, 258, 1024, er),
  /* 8 */
  new Ve(32, 258, 258, 4096, er)
  /* 9 max compression */
];
function a_(e) {
  e.window_size = 2 * e.w_size, yt(e.head), e.max_lazy_match = sr[e.level].max_lazy, e.good_match = sr[e.level].good_length, e.nice_match = sr[e.level].nice_length, e.max_chain_length = sr[e.level].max_chain, e.strstart = 0, e.block_start = 0, e.lookahead = 0, e.insert = 0, e.match_length = e.prev_length = Y - 1, e.match_available = 0, e.ins_h = 0;
}
function o_() {
  this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = En, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new Re.Buf16(Jp * 2), this.dyn_dtree = new Re.Buf16((2 * Vp + 1) * 2), this.bl_tree = new Re.Buf16((2 * Zp + 1) * 2), yt(this.dyn_ltree), yt(this.dyn_dtree), yt(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new Re.Buf16(Qp + 1), this.heap = new Re.Buf16(2 * Ds + 1), yt(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new Re.Buf16(2 * Ds + 1), yt(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
}
function zu(e) {
  var t;
  return !e || !e.state ? St(e, De) : (e.total_in = e.total_out = 0, e.data_type = zp, t = e.state, t.pending = 0, t.pending_out = 0, t.wrap < 0 && (t.wrap = -t.wrap), t.status = t.wrap ? mn : Mt, e.adler = t.wrap === 2 ? 0 : 1, t.last_flush = jt, xe._tr_init(t), et);
}
function qu(e) {
  var t = zu(e);
  return t === et && a_(e.state), t;
}
function c_(e, t) {
  return !e || !e.state || e.state.wrap !== 2 ? De : (e.state.gzhead = t, et);
}
function Ku(e, t, r, i, s, n) {
  if (!e)
    return De;
  var a = 1;
  if (t === Mp && (t = 6), i < 0 ? (a = 0, i = -i) : i > 15 && (a = 2, i -= 16), s < 1 || s > qp || r !== En || i < 8 || i > 15 || t < 0 || t > 9 || n < 0 || n > Xp)
    return St(e, De);
  i === 8 && (i = 9);
  var o = new o_();
  return e.state = o, o.strm = e, o.wrap = a, o.gzhead = null, o.w_bits = i, o.w_size = 1 << o.w_bits, o.w_mask = o.w_size - 1, o.hash_bits = s + 7, o.hash_size = 1 << o.hash_bits, o.hash_mask = o.hash_size - 1, o.hash_shift = ~~((o.hash_bits + Y - 1) / Y), o.window = new Re.Buf8(o.w_size * 2), o.head = new Re.Buf16(o.hash_size), o.prev = new Re.Buf16(o.w_size), o.lit_bufsize = 1 << s + 6, o.pending_buf_size = o.lit_bufsize * 4, o.pending_buf = new Re.Buf8(o.pending_buf_size), o.d_buf = 1 * o.lit_bufsize, o.l_buf = 3 * o.lit_bufsize, o.level = t, o.strategy = n, o.method = r, qu(e);
}
function u_(e, t) {
  return Ku(e, t, En, Kp, Yp, Wp);
}
function l_(e, t) {
  var r, i, s, n;
  if (!e || !e.state || t > No || t < 0)
    return e ? St(e, De) : De;
  if (i = e.state, !e.output || !e.input && e.avail_in !== 0 || i.status === xr && t !== Nt)
    return St(e, e.avail_out === 0 ? is : De);
  if (i.strm = e, r = i.last_flush, i.last_flush = t, i.status === mn)
    if (i.wrap === 2)
      e.adler = 0, Z(i, 31), Z(i, 139), Z(i, 8), i.gzhead ? (Z(
        i,
        (i.gzhead.text ? 1 : 0) + (i.gzhead.hcrc ? 2 : 0) + (i.gzhead.extra ? 4 : 0) + (i.gzhead.name ? 8 : 0) + (i.gzhead.comment ? 16 : 0)
      ), Z(i, i.gzhead.time & 255), Z(i, i.gzhead.time >> 8 & 255), Z(i, i.gzhead.time >> 16 & 255), Z(i, i.gzhead.time >> 24 & 255), Z(i, i.level === 9 ? 2 : i.strategy >= Si || i.level < 2 ? 4 : 0), Z(i, i.gzhead.os & 255), i.gzhead.extra && i.gzhead.extra.length && (Z(i, i.gzhead.extra.length & 255), Z(i, i.gzhead.extra.length >> 8 & 255)), i.gzhead.hcrc && (e.adler = Tt(e.adler, i.pending_buf, i.pending, 0)), i.gzindex = 0, i.status = Us) : (Z(i, 0), Z(i, 0), Z(i, 0), Z(i, 0), Z(i, 0), Z(i, i.level === 9 ? 2 : i.strategy >= Si || i.level < 2 ? 4 : 0), Z(i, t_), i.status = Mt);
    else {
      var a = En + (i.w_bits - 8 << 4) << 8, o = -1;
      i.strategy >= Si || i.level < 2 ? o = 0 : i.level < 6 ? o = 1 : i.level === 6 ? o = 2 : o = 3, a |= o << 6, i.strstart !== 0 && (a |= e_), a += 31 - a % 31, i.status = Mt, kr(i, a), i.strstart !== 0 && (kr(i, e.adler >>> 16), kr(i, e.adler & 65535)), e.adler = 1;
    }
  if (i.status === Us)
    if (i.gzhead.extra) {
      for (s = i.pending; i.gzindex < (i.gzhead.extra.length & 65535) && !(i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > s && (e.adler = Tt(e.adler, i.pending_buf, i.pending - s, s)), gt(e), s = i.pending, i.pending === i.pending_buf_size)); )
        Z(i, i.gzhead.extra[i.gzindex] & 255), i.gzindex++;
      i.gzhead.hcrc && i.pending > s && (e.adler = Tt(e.adler, i.pending_buf, i.pending - s, s)), i.gzindex === i.gzhead.extra.length && (i.gzindex = 0, i.status = Bi);
    } else
      i.status = Bi;
  if (i.status === Bi)
    if (i.gzhead.name) {
      s = i.pending;
      do {
        if (i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > s && (e.adler = Tt(e.adler, i.pending_buf, i.pending - s, s)), gt(e), s = i.pending, i.pending === i.pending_buf_size)) {
          n = 1;
          break;
        }
        i.gzindex < i.gzhead.name.length ? n = i.gzhead.name.charCodeAt(i.gzindex++) & 255 : n = 0, Z(i, n);
      } while (n !== 0);
      i.gzhead.hcrc && i.pending > s && (e.adler = Tt(e.adler, i.pending_buf, i.pending - s, s)), n === 0 && (i.gzindex = 0, i.status = Fi);
    } else
      i.status = Fi;
  if (i.status === Fi)
    if (i.gzhead.comment) {
      s = i.pending;
      do {
        if (i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > s && (e.adler = Tt(e.adler, i.pending_buf, i.pending - s, s)), gt(e), s = i.pending, i.pending === i.pending_buf_size)) {
          n = 1;
          break;
        }
        i.gzindex < i.gzhead.comment.length ? n = i.gzhead.comment.charCodeAt(i.gzindex++) & 255 : n = 0, Z(i, n);
      } while (n !== 0);
      i.gzhead.hcrc && i.pending > s && (e.adler = Tt(e.adler, i.pending_buf, i.pending - s, s)), n === 0 && (i.status = Mi);
    } else
      i.status = Mi;
  if (i.status === Mi && (i.gzhead.hcrc ? (i.pending + 2 > i.pending_buf_size && gt(e), i.pending + 2 <= i.pending_buf_size && (Z(i, e.adler & 255), Z(i, e.adler >> 8 & 255), e.adler = 0, i.status = Mt)) : i.status = Mt), i.pending !== 0) {
    if (gt(e), e.avail_out === 0)
      return i.last_flush = -1, et;
  } else if (e.avail_in === 0 && Lo(t) <= Lo(r) && t !== Nt)
    return St(e, is);
  if (i.status === xr && e.avail_in !== 0)
    return St(e, is);
  if (e.avail_in !== 0 || i.lookahead !== 0 || t !== jt && i.status !== xr) {
    var c = i.strategy === Si ? s_(i, t) : i.strategy === Hp ? n_(i, t) : sr[i.level].func(i, t);
    if ((c === Wt || c === Sr) && (i.status = xr), c === Ee || c === Wt)
      return e.avail_out === 0 && (i.last_flush = -1), et;
    if (c === ni && (t === Pp ? xe._tr_align(i) : t !== No && (xe._tr_stored_block(i, 0, 0, !1), t === Bp && (yt(i.head), i.lookahead === 0 && (i.strstart = 0, i.block_start = 0, i.insert = 0))), gt(e), e.avail_out === 0))
      return i.last_flush = -1, et;
  }
  return t !== Nt ? et : i.wrap <= 0 ? Io : (i.wrap === 2 ? (Z(i, e.adler & 255), Z(i, e.adler >> 8 & 255), Z(i, e.adler >> 16 & 255), Z(i, e.adler >> 24 & 255), Z(i, e.total_in & 255), Z(i, e.total_in >> 8 & 255), Z(i, e.total_in >> 16 & 255), Z(i, e.total_in >> 24 & 255)) : (kr(i, e.adler >>> 16), kr(i, e.adler & 65535)), gt(e), i.wrap > 0 && (i.wrap = -i.wrap), i.pending !== 0 ? et : Io);
}
function d_(e) {
  var t;
  return !e || !e.state ? De : (t = e.state.status, t !== mn && t !== Us && t !== Bi && t !== Fi && t !== Mi && t !== Mt && t !== xr ? St(e, De) : (e.state = null, t === Mt ? St(e, Fp) : et));
}
function f_(e, t) {
  var r = t.length, i, s, n, a, o, c, u, l;
  if (!e || !e.state || (i = e.state, a = i.wrap, a === 2 || a === 1 && i.status !== mn || i.lookahead))
    return De;
  for (a === 1 && (e.adler = Xu(e.adler, t, r, 0)), i.wrap = 0, r >= i.w_size && (a === 0 && (yt(i.head), i.strstart = 0, i.block_start = 0, i.insert = 0), l = new Re.Buf8(i.w_size), Re.arraySet(l, t, r - i.w_size, i.w_size, 0), t = l, r = i.w_size), o = e.avail_in, c = e.next_in, u = e.input, e.avail_in = r, e.next_in = 0, e.input = t, zt(i); i.lookahead >= Y; ) {
    s = i.strstart, n = i.lookahead - (Y - 1);
    do
      i.ins_h = (i.ins_h << i.hash_shift ^ i.window[s + Y - 1]) & i.hash_mask, i.prev[s & i.w_mask] = i.head[i.ins_h], i.head[i.ins_h] = s, s++;
    while (--n);
    i.strstart = s, i.lookahead = Y - 1, zt(i);
  }
  return i.strstart += i.lookahead, i.block_start = i.strstart, i.insert = i.lookahead, i.lookahead = 0, i.match_length = i.prev_length = Y - 1, i.match_available = 0, e.next_in = c, e.input = u, e.avail_in = o, i.wrap = a, et;
}
rt.deflateInit = u_;
rt.deflateInit2 = Ku;
rt.deflateReset = qu;
rt.deflateResetKeep = zu;
rt.deflateSetHeader = c_;
rt.deflate = l_;
rt.deflateEnd = d_;
rt.deflateSetDictionary = f_;
rt.deflateInfo = "pako deflate (from Nodeca project)";
var Gt = {}, Tn = ht, Yu = !0, ju = !0;
try {
  String.fromCharCode.apply(null, [0]);
} catch {
  Yu = !1;
}
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch {
  ju = !1;
}
var Kr = new Tn.Buf8(256);
for (var Et = 0; Et < 256; Et++)
  Kr[Et] = Et >= 252 ? 6 : Et >= 248 ? 5 : Et >= 240 ? 4 : Et >= 224 ? 3 : Et >= 192 ? 2 : 1;
Kr[254] = Kr[254] = 1;
Gt.string2buf = function(e) {
  var t, r, i, s, n, a = e.length, o = 0;
  for (s = 0; s < a; s++)
    r = e.charCodeAt(s), (r & 64512) === 55296 && s + 1 < a && (i = e.charCodeAt(s + 1), (i & 64512) === 56320 && (r = 65536 + (r - 55296 << 10) + (i - 56320), s++)), o += r < 128 ? 1 : r < 2048 ? 2 : r < 65536 ? 3 : 4;
  for (t = new Tn.Buf8(o), n = 0, s = 0; n < o; s++)
    r = e.charCodeAt(s), (r & 64512) === 55296 && s + 1 < a && (i = e.charCodeAt(s + 1), (i & 64512) === 56320 && (r = 65536 + (r - 55296 << 10) + (i - 56320), s++)), r < 128 ? t[n++] = r : r < 2048 ? (t[n++] = 192 | r >>> 6, t[n++] = 128 | r & 63) : r < 65536 ? (t[n++] = 224 | r >>> 12, t[n++] = 128 | r >>> 6 & 63, t[n++] = 128 | r & 63) : (t[n++] = 240 | r >>> 18, t[n++] = 128 | r >>> 12 & 63, t[n++] = 128 | r >>> 6 & 63, t[n++] = 128 | r & 63);
  return t;
};
function Gu(e, t) {
  if (t < 65534 && (e.subarray && ju || !e.subarray && Yu))
    return String.fromCharCode.apply(null, Tn.shrinkBuf(e, t));
  for (var r = "", i = 0; i < t; i++)
    r += String.fromCharCode(e[i]);
  return r;
}
Gt.buf2binstring = function(e) {
  return Gu(e, e.length);
};
Gt.binstring2buf = function(e) {
  for (var t = new Tn.Buf8(e.length), r = 0, i = t.length; r < i; r++)
    t[r] = e.charCodeAt(r);
  return t;
};
Gt.buf2string = function(e, t) {
  var r, i, s, n, a = t || e.length, o = new Array(a * 2);
  for (i = 0, r = 0; r < a; ) {
    if (s = e[r++], s < 128) {
      o[i++] = s;
      continue;
    }
    if (n = Kr[s], n > 4) {
      o[i++] = 65533, r += n - 1;
      continue;
    }
    for (s &= n === 2 ? 31 : n === 3 ? 15 : 7; n > 1 && r < a; )
      s = s << 6 | e[r++] & 63, n--;
    if (n > 1) {
      o[i++] = 65533;
      continue;
    }
    s < 65536 ? o[i++] = s : (s -= 65536, o[i++] = 55296 | s >> 10 & 1023, o[i++] = 56320 | s & 1023);
  }
  return Gu(o, i);
};
Gt.utf8border = function(e, t) {
  var r;
  for (t = t || e.length, t > e.length && (t = e.length), r = t - 1; r >= 0 && (e[r] & 192) === 128; )
    r--;
  return r < 0 || r === 0 ? t : r + Kr[e[r]] > t ? r : t;
};
function h_() {
  this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
}
var Vu = h_, Pr = rt, Br = ht, Ps = Gt, Bs = Ta, p_ = Vu, Zu = Object.prototype.toString, __ = 0, ss = 4, ur = 0, Ao = 1, Co = 2, E_ = -1, m_ = 0, T_ = 8;
function qt(e) {
  if (!(this instanceof qt)) return new qt(e);
  this.options = Br.assign({
    level: E_,
    method: T_,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: m_,
    to: ""
  }, e || {});
  var t = this.options;
  t.raw && t.windowBits > 0 ? t.windowBits = -t.windowBits : t.gzip && t.windowBits > 0 && t.windowBits < 16 && (t.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new p_(), this.strm.avail_out = 0;
  var r = Pr.deflateInit2(
    this.strm,
    t.level,
    t.method,
    t.windowBits,
    t.memLevel,
    t.strategy
  );
  if (r !== ur)
    throw new Error(Bs[r]);
  if (t.header && Pr.deflateSetHeader(this.strm, t.header), t.dictionary) {
    var i;
    if (typeof t.dictionary == "string" ? i = Ps.string2buf(t.dictionary) : Zu.call(t.dictionary) === "[object ArrayBuffer]" ? i = new Uint8Array(t.dictionary) : i = t.dictionary, r = Pr.deflateSetDictionary(this.strm, i), r !== ur)
      throw new Error(Bs[r]);
    this._dict_set = !0;
  }
}
qt.prototype.push = function(e, t) {
  var r = this.strm, i = this.options.chunkSize, s, n;
  if (this.ended)
    return !1;
  n = t === ~~t ? t : t === !0 ? ss : __, typeof e == "string" ? r.input = Ps.string2buf(e) : Zu.call(e) === "[object ArrayBuffer]" ? r.input = new Uint8Array(e) : r.input = e, r.next_in = 0, r.avail_in = r.input.length;
  do {
    if (r.avail_out === 0 && (r.output = new Br.Buf8(i), r.next_out = 0, r.avail_out = i), s = Pr.deflate(r, n), s !== Ao && s !== ur)
      return this.onEnd(s), this.ended = !0, !1;
    (r.avail_out === 0 || r.avail_in === 0 && (n === ss || n === Co)) && (this.options.to === "string" ? this.onData(Ps.buf2binstring(Br.shrinkBuf(r.output, r.next_out))) : this.onData(Br.shrinkBuf(r.output, r.next_out)));
  } while ((r.avail_in > 0 || r.avail_out === 0) && s !== Ao);
  return n === ss ? (s = Pr.deflateEnd(this.strm), this.onEnd(s), this.ended = !0, s === ur) : (n === Co && (this.onEnd(ur), r.avail_out = 0), !0);
};
qt.prototype.onData = function(e) {
  this.chunks.push(e);
};
qt.prototype.onEnd = function(e) {
  e === ur && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = Br.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg;
};
function ga(e, t) {
  var r = new qt(t);
  if (r.push(e, !0), r.err)
    throw r.msg || Bs[r.err];
  return r.result;
}
function g_(e, t) {
  return t = t || {}, t.raw = !0, ga(e, t);
}
function b_(e, t) {
  return t = t || {}, t.gzip = !0, ga(e, t);
}
ri.Deflate = qt;
ri.deflate = ga;
ri.deflateRaw = g_;
ri.gzip = b_;
var si = {}, Ye = {}, Ri = 30, v_ = 12, y_ = function(t, r) {
  var i, s, n, a, o, c, u, l, p, d, f, _, E, w, h, m, b, v, S, L, I, O, P, H, D;
  i = t.state, s = t.next_in, H = t.input, n = s + (t.avail_in - 5), a = t.next_out, D = t.output, o = a - (r - t.avail_out), c = a + (t.avail_out - 257), u = i.dmax, l = i.wsize, p = i.whave, d = i.wnext, f = i.window, _ = i.hold, E = i.bits, w = i.lencode, h = i.distcode, m = (1 << i.lenbits) - 1, b = (1 << i.distbits) - 1;
  e:
    do {
      E < 15 && (_ += H[s++] << E, E += 8, _ += H[s++] << E, E += 8), v = w[_ & m];
      t:
        for (; ; ) {
          if (S = v >>> 24, _ >>>= S, E -= S, S = v >>> 16 & 255, S === 0)
            D[a++] = v & 65535;
          else if (S & 16) {
            L = v & 65535, S &= 15, S && (E < S && (_ += H[s++] << E, E += 8), L += _ & (1 << S) - 1, _ >>>= S, E -= S), E < 15 && (_ += H[s++] << E, E += 8, _ += H[s++] << E, E += 8), v = h[_ & b];
            r:
              for (; ; ) {
                if (S = v >>> 24, _ >>>= S, E -= S, S = v >>> 16 & 255, S & 16) {
                  if (I = v & 65535, S &= 15, E < S && (_ += H[s++] << E, E += 8, E < S && (_ += H[s++] << E, E += 8)), I += _ & (1 << S) - 1, I > u) {
                    t.msg = "invalid distance too far back", i.mode = Ri;
                    break e;
                  }
                  if (_ >>>= S, E -= S, S = a - o, I > S) {
                    if (S = I - S, S > p && i.sane) {
                      t.msg = "invalid distance too far back", i.mode = Ri;
                      break e;
                    }
                    if (O = 0, P = f, d === 0) {
                      if (O += l - S, S < L) {
                        L -= S;
                        do
                          D[a++] = f[O++];
                        while (--S);
                        O = a - I, P = D;
                      }
                    } else if (d < S) {
                      if (O += l + d - S, S -= d, S < L) {
                        L -= S;
                        do
                          D[a++] = f[O++];
                        while (--S);
                        if (O = 0, d < L) {
                          S = d, L -= S;
                          do
                            D[a++] = f[O++];
                          while (--S);
                          O = a - I, P = D;
                        }
                      }
                    } else if (O += d - S, S < L) {
                      L -= S;
                      do
                        D[a++] = f[O++];
                      while (--S);
                      O = a - I, P = D;
                    }
                    for (; L > 2; )
                      D[a++] = P[O++], D[a++] = P[O++], D[a++] = P[O++], L -= 3;
                    L && (D[a++] = P[O++], L > 1 && (D[a++] = P[O++]));
                  } else {
                    O = a - I;
                    do
                      D[a++] = D[O++], D[a++] = D[O++], D[a++] = D[O++], L -= 3;
                    while (L > 2);
                    L && (D[a++] = D[O++], L > 1 && (D[a++] = D[O++]));
                  }
                } else if (S & 64) {
                  t.msg = "invalid distance code", i.mode = Ri;
                  break e;
                } else {
                  v = h[(v & 65535) + (_ & (1 << S) - 1)];
                  continue r;
                }
                break;
              }
          } else if (S & 64)
            if (S & 32) {
              i.mode = v_;
              break e;
            } else {
              t.msg = "invalid literal/length code", i.mode = Ri;
              break e;
            }
          else {
            v = w[(v & 65535) + (_ & (1 << S) - 1)];
            continue t;
          }
          break;
        }
    } while (s < n && a < c);
  L = E >> 3, s -= L, E -= L << 3, _ &= (1 << E) - 1, t.next_in = s, t.next_out = a, t.avail_in = s < n ? 5 + (n - s) : 5 - (s - n), t.avail_out = a < c ? 257 + (c - a) : 257 - (a - c), i.hold = _, i.bits = E;
}, Oo = ht, tr = 15, ko = 852, xo = 592, Do = 0, as = 1, Uo = 2, w_ = [
  /* Length codes 257..285 base */
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
  0,
  0
], S_ = [
  /* Length codes 257..285 extra */
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
  19,
  19,
  19,
  19,
  20,
  20,
  20,
  20,
  21,
  21,
  21,
  21,
  16,
  72,
  78
], R_ = [
  /* Distance codes 0..29 base */
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
  0,
  0
], N_ = [
  /* Distance codes 0..29 extra */
  16,
  16,
  16,
  16,
  17,
  17,
  18,
  18,
  19,
  19,
  20,
  20,
  21,
  21,
  22,
  22,
  23,
  23,
  24,
  24,
  25,
  25,
  26,
  26,
  27,
  27,
  28,
  28,
  29,
  29,
  64,
  64
], I_ = function(t, r, i, s, n, a, o, c) {
  var u = c.bits, l = 0, p = 0, d = 0, f = 0, _ = 0, E = 0, w = 0, h = 0, m = 0, b = 0, v, S, L, I, O, P = null, H = 0, D, B = new Oo.Buf16(tr + 1), q = new Oo.Buf16(tr + 1), ge = null, _t = 0, Jt, R, N;
  for (l = 0; l <= tr; l++)
    B[l] = 0;
  for (p = 0; p < s; p++)
    B[r[i + p]]++;
  for (_ = u, f = tr; f >= 1 && B[f] === 0; f--)
    ;
  if (_ > f && (_ = f), f === 0)
    return n[a++] = 1 << 24 | 64 << 16 | 0, n[a++] = 1 << 24 | 64 << 16 | 0, c.bits = 1, 0;
  for (d = 1; d < f && B[d] === 0; d++)
    ;
  for (_ < d && (_ = d), h = 1, l = 1; l <= tr; l++)
    if (h <<= 1, h -= B[l], h < 0)
      return -1;
  if (h > 0 && (t === Do || f !== 1))
    return -1;
  for (q[1] = 0, l = 1; l < tr; l++)
    q[l + 1] = q[l] + B[l];
  for (p = 0; p < s; p++)
    r[i + p] !== 0 && (o[q[r[i + p]]++] = p);
  if (t === Do ? (P = ge = o, D = 19) : t === as ? (P = w_, H -= 257, ge = S_, _t -= 257, D = 256) : (P = R_, ge = N_, D = -1), b = 0, p = 0, l = d, O = a, E = _, w = 0, L = -1, m = 1 << _, I = m - 1, t === as && m > ko || t === Uo && m > xo)
    return 1;
  for (; ; ) {
    Jt = l - w, o[p] < D ? (R = 0, N = o[p]) : o[p] > D ? (R = ge[_t + o[p]], N = P[H + o[p]]) : (R = 96, N = 0), v = 1 << l - w, S = 1 << E, d = S;
    do
      S -= v, n[O + (b >> w) + S] = Jt << 24 | R << 16 | N | 0;
    while (S !== 0);
    for (v = 1 << l - 1; b & v; )
      v >>= 1;
    if (v !== 0 ? (b &= v - 1, b += v) : b = 0, p++, --B[l] === 0) {
      if (l === f)
        break;
      l = r[i + o[p]];
    }
    if (l > _ && (b & I) !== L) {
      for (w === 0 && (w = _), O += d, E = l - w, h = 1 << E; E + w < f && (h -= B[E + w], !(h <= 0)); )
        E++, h <<= 1;
      if (m += 1 << E, t === as && m > ko || t === Uo && m > xo)
        return 1;
      L = b & I, n[L] = _ << 24 | E << 16 | O - a | 0;
    }
  }
  return b !== 0 && (n[O + b] = l - w << 24 | 64 << 16 | 0), c.bits = _, 0;
}, Ae = ht, Fs = $u, Ze = Hu, L_ = y_, Fr = I_, A_ = 0, Ju = 1, Qu = 2, Po = 4, C_ = 5, Ni = 6, Kt = 0, O_ = 1, k_ = 2, Pe = -2, el = -3, tl = -4, x_ = -5, Bo = 8, rl = 1, Fo = 2, Mo = 3, $o = 4, Ho = 5, Xo = 6, Wo = 7, zo = 8, qo = 9, Ko = 10, ji = 11, at = 12, os = 13, Yo = 14, cs = 15, jo = 16, Go = 17, Vo = 18, Zo = 19, Ii = 20, Li = 21, Jo = 22, Qo = 23, ec = 24, tc = 25, rc = 26, us = 27, ic = 28, nc = 29, oe = 30, il = 31, D_ = 32, U_ = 852, P_ = 592, B_ = 15, F_ = B_;
function sc(e) {
  return (e >>> 24 & 255) + (e >>> 8 & 65280) + ((e & 65280) << 8) + ((e & 255) << 24);
}
function M_() {
  this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new Ae.Buf16(320), this.work = new Ae.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
}
function nl(e) {
  var t;
  return !e || !e.state ? Pe : (t = e.state, e.total_in = e.total_out = t.total = 0, e.msg = "", t.wrap && (e.adler = t.wrap & 1), t.mode = rl, t.last = 0, t.havedict = 0, t.dmax = 32768, t.head = null, t.hold = 0, t.bits = 0, t.lencode = t.lendyn = new Ae.Buf32(U_), t.distcode = t.distdyn = new Ae.Buf32(P_), t.sane = 1, t.back = -1, Kt);
}
function sl(e) {
  var t;
  return !e || !e.state ? Pe : (t = e.state, t.wsize = 0, t.whave = 0, t.wnext = 0, nl(e));
}
function al(e, t) {
  var r, i;
  return !e || !e.state || (i = e.state, t < 0 ? (r = 0, t = -t) : (r = (t >> 4) + 1, t < 48 && (t &= 15)), t && (t < 8 || t > 15)) ? Pe : (i.window !== null && i.wbits !== t && (i.window = null), i.wrap = r, i.wbits = t, sl(e));
}
function ol(e, t) {
  var r, i;
  return e ? (i = new M_(), e.state = i, i.window = null, r = al(e, t), r !== Kt && (e.state = null), r) : Pe;
}
function $_(e) {
  return ol(e, F_);
}
var ac = !0, ls, ds;
function H_(e) {
  if (ac) {
    var t;
    for (ls = new Ae.Buf32(512), ds = new Ae.Buf32(32), t = 0; t < 144; )
      e.lens[t++] = 8;
    for (; t < 256; )
      e.lens[t++] = 9;
    for (; t < 280; )
      e.lens[t++] = 7;
    for (; t < 288; )
      e.lens[t++] = 8;
    for (Fr(Ju, e.lens, 0, 288, ls, 0, e.work, { bits: 9 }), t = 0; t < 32; )
      e.lens[t++] = 5;
    Fr(Qu, e.lens, 0, 32, ds, 0, e.work, { bits: 5 }), ac = !1;
  }
  e.lencode = ls, e.lenbits = 9, e.distcode = ds, e.distbits = 5;
}
function cl(e, t, r, i) {
  var s, n = e.state;
  return n.window === null && (n.wsize = 1 << n.wbits, n.wnext = 0, n.whave = 0, n.window = new Ae.Buf8(n.wsize)), i >= n.wsize ? (Ae.arraySet(n.window, t, r - n.wsize, n.wsize, 0), n.wnext = 0, n.whave = n.wsize) : (s = n.wsize - n.wnext, s > i && (s = i), Ae.arraySet(n.window, t, r - i, s, n.wnext), i -= s, i ? (Ae.arraySet(n.window, t, r - i, i, 0), n.wnext = i, n.whave = n.wsize) : (n.wnext += s, n.wnext === n.wsize && (n.wnext = 0), n.whave < n.wsize && (n.whave += s))), 0;
}
function X_(e, t) {
  var r, i, s, n, a, o, c, u, l, p, d, f, _, E, w = 0, h, m, b, v, S, L, I, O, P = new Ae.Buf8(4), H, D, B = (
    /* permutation of code lengths */
    [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
  );
  if (!e || !e.state || !e.output || !e.input && e.avail_in !== 0)
    return Pe;
  r = e.state, r.mode === at && (r.mode = os), a = e.next_out, s = e.output, c = e.avail_out, n = e.next_in, i = e.input, o = e.avail_in, u = r.hold, l = r.bits, p = o, d = c, O = Kt;
  e:
    for (; ; )
      switch (r.mode) {
        case rl:
          if (r.wrap === 0) {
            r.mode = os;
            break;
          }
          for (; l < 16; ) {
            if (o === 0)
              break e;
            o--, u += i[n++] << l, l += 8;
          }
          if (r.wrap & 2 && u === 35615) {
            r.check = 0, P[0] = u & 255, P[1] = u >>> 8 & 255, r.check = Ze(r.check, P, 2, 0), u = 0, l = 0, r.mode = Fo;
            break;
          }
          if (r.flags = 0, r.head && (r.head.done = !1), !(r.wrap & 1) || /* check if zlib header allowed */
          (((u & 255) << 8) + (u >> 8)) % 31) {
            e.msg = "incorrect header check", r.mode = oe;
            break;
          }
          if ((u & 15) !== Bo) {
            e.msg = "unknown compression method", r.mode = oe;
            break;
          }
          if (u >>>= 4, l -= 4, I = (u & 15) + 8, r.wbits === 0)
            r.wbits = I;
          else if (I > r.wbits) {
            e.msg = "invalid window size", r.mode = oe;
            break;
          }
          r.dmax = 1 << I, e.adler = r.check = 1, r.mode = u & 512 ? Ko : at, u = 0, l = 0;
          break;
        case Fo:
          for (; l < 16; ) {
            if (o === 0)
              break e;
            o--, u += i[n++] << l, l += 8;
          }
          if (r.flags = u, (r.flags & 255) !== Bo) {
            e.msg = "unknown compression method", r.mode = oe;
            break;
          }
          if (r.flags & 57344) {
            e.msg = "unknown header flags set", r.mode = oe;
            break;
          }
          r.head && (r.head.text = u >> 8 & 1), r.flags & 512 && (P[0] = u & 255, P[1] = u >>> 8 & 255, r.check = Ze(r.check, P, 2, 0)), u = 0, l = 0, r.mode = Mo;
        case Mo:
          for (; l < 32; ) {
            if (o === 0)
              break e;
            o--, u += i[n++] << l, l += 8;
          }
          r.head && (r.head.time = u), r.flags & 512 && (P[0] = u & 255, P[1] = u >>> 8 & 255, P[2] = u >>> 16 & 255, P[3] = u >>> 24 & 255, r.check = Ze(r.check, P, 4, 0)), u = 0, l = 0, r.mode = $o;
        case $o:
          for (; l < 16; ) {
            if (o === 0)
              break e;
            o--, u += i[n++] << l, l += 8;
          }
          r.head && (r.head.xflags = u & 255, r.head.os = u >> 8), r.flags & 512 && (P[0] = u & 255, P[1] = u >>> 8 & 255, r.check = Ze(r.check, P, 2, 0)), u = 0, l = 0, r.mode = Ho;
        case Ho:
          if (r.flags & 1024) {
            for (; l < 16; ) {
              if (o === 0)
                break e;
              o--, u += i[n++] << l, l += 8;
            }
            r.length = u, r.head && (r.head.extra_len = u), r.flags & 512 && (P[0] = u & 255, P[1] = u >>> 8 & 255, r.check = Ze(r.check, P, 2, 0)), u = 0, l = 0;
          } else r.head && (r.head.extra = null);
          r.mode = Xo;
        case Xo:
          if (r.flags & 1024 && (f = r.length, f > o && (f = o), f && (r.head && (I = r.head.extra_len - r.length, r.head.extra || (r.head.extra = new Array(r.head.extra_len)), Ae.arraySet(
            r.head.extra,
            i,
            n,
            // extra field is limited to 65536 bytes
            // - no need for additional size check
            f,
            /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
            I
          )), r.flags & 512 && (r.check = Ze(r.check, i, f, n)), o -= f, n += f, r.length -= f), r.length))
            break e;
          r.length = 0, r.mode = Wo;
        case Wo:
          if (r.flags & 2048) {
            if (o === 0)
              break e;
            f = 0;
            do
              I = i[n + f++], r.head && I && r.length < 65536 && (r.head.name += String.fromCharCode(I));
            while (I && f < o);
            if (r.flags & 512 && (r.check = Ze(r.check, i, f, n)), o -= f, n += f, I)
              break e;
          } else r.head && (r.head.name = null);
          r.length = 0, r.mode = zo;
        case zo:
          if (r.flags & 4096) {
            if (o === 0)
              break e;
            f = 0;
            do
              I = i[n + f++], r.head && I && r.length < 65536 && (r.head.comment += String.fromCharCode(I));
            while (I && f < o);
            if (r.flags & 512 && (r.check = Ze(r.check, i, f, n)), o -= f, n += f, I)
              break e;
          } else r.head && (r.head.comment = null);
          r.mode = qo;
        case qo:
          if (r.flags & 512) {
            for (; l < 16; ) {
              if (o === 0)
                break e;
              o--, u += i[n++] << l, l += 8;
            }
            if (u !== (r.check & 65535)) {
              e.msg = "header crc mismatch", r.mode = oe;
              break;
            }
            u = 0, l = 0;
          }
          r.head && (r.head.hcrc = r.flags >> 9 & 1, r.head.done = !0), e.adler = r.check = 0, r.mode = at;
          break;
        case Ko:
          for (; l < 32; ) {
            if (o === 0)
              break e;
            o--, u += i[n++] << l, l += 8;
          }
          e.adler = r.check = sc(u), u = 0, l = 0, r.mode = ji;
        case ji:
          if (r.havedict === 0)
            return e.next_out = a, e.avail_out = c, e.next_in = n, e.avail_in = o, r.hold = u, r.bits = l, k_;
          e.adler = r.check = 1, r.mode = at;
        case at:
          if (t === C_ || t === Ni)
            break e;
        case os:
          if (r.last) {
            u >>>= l & 7, l -= l & 7, r.mode = us;
            break;
          }
          for (; l < 3; ) {
            if (o === 0)
              break e;
            o--, u += i[n++] << l, l += 8;
          }
          switch (r.last = u & 1, u >>>= 1, l -= 1, u & 3) {
            case 0:
              r.mode = Yo;
              break;
            case 1:
              if (H_(r), r.mode = Ii, t === Ni) {
                u >>>= 2, l -= 2;
                break e;
              }
              break;
            case 2:
              r.mode = Go;
              break;
            case 3:
              e.msg = "invalid block type", r.mode = oe;
          }
          u >>>= 2, l -= 2;
          break;
        case Yo:
          for (u >>>= l & 7, l -= l & 7; l < 32; ) {
            if (o === 0)
              break e;
            o--, u += i[n++] << l, l += 8;
          }
          if ((u & 65535) !== (u >>> 16 ^ 65535)) {
            e.msg = "invalid stored block lengths", r.mode = oe;
            break;
          }
          if (r.length = u & 65535, u = 0, l = 0, r.mode = cs, t === Ni)
            break e;
        case cs:
          r.mode = jo;
        case jo:
          if (f = r.length, f) {
            if (f > o && (f = o), f > c && (f = c), f === 0)
              break e;
            Ae.arraySet(s, i, n, f, a), o -= f, n += f, c -= f, a += f, r.length -= f;
            break;
          }
          r.mode = at;
          break;
        case Go:
          for (; l < 14; ) {
            if (o === 0)
              break e;
            o--, u += i[n++] << l, l += 8;
          }
          if (r.nlen = (u & 31) + 257, u >>>= 5, l -= 5, r.ndist = (u & 31) + 1, u >>>= 5, l -= 5, r.ncode = (u & 15) + 4, u >>>= 4, l -= 4, r.nlen > 286 || r.ndist > 30) {
            e.msg = "too many length or distance symbols", r.mode = oe;
            break;
          }
          r.have = 0, r.mode = Vo;
        case Vo:
          for (; r.have < r.ncode; ) {
            for (; l < 3; ) {
              if (o === 0)
                break e;
              o--, u += i[n++] << l, l += 8;
            }
            r.lens[B[r.have++]] = u & 7, u >>>= 3, l -= 3;
          }
          for (; r.have < 19; )
            r.lens[B[r.have++]] = 0;
          if (r.lencode = r.lendyn, r.lenbits = 7, H = { bits: r.lenbits }, O = Fr(A_, r.lens, 0, 19, r.lencode, 0, r.work, H), r.lenbits = H.bits, O) {
            e.msg = "invalid code lengths set", r.mode = oe;
            break;
          }
          r.have = 0, r.mode = Zo;
        case Zo:
          for (; r.have < r.nlen + r.ndist; ) {
            for (; w = r.lencode[u & (1 << r.lenbits) - 1], h = w >>> 24, m = w >>> 16 & 255, b = w & 65535, !(h <= l); ) {
              if (o === 0)
                break e;
              o--, u += i[n++] << l, l += 8;
            }
            if (b < 16)
              u >>>= h, l -= h, r.lens[r.have++] = b;
            else {
              if (b === 16) {
                for (D = h + 2; l < D; ) {
                  if (o === 0)
                    break e;
                  o--, u += i[n++] << l, l += 8;
                }
                if (u >>>= h, l -= h, r.have === 0) {
                  e.msg = "invalid bit length repeat", r.mode = oe;
                  break;
                }
                I = r.lens[r.have - 1], f = 3 + (u & 3), u >>>= 2, l -= 2;
              } else if (b === 17) {
                for (D = h + 3; l < D; ) {
                  if (o === 0)
                    break e;
                  o--, u += i[n++] << l, l += 8;
                }
                u >>>= h, l -= h, I = 0, f = 3 + (u & 7), u >>>= 3, l -= 3;
              } else {
                for (D = h + 7; l < D; ) {
                  if (o === 0)
                    break e;
                  o--, u += i[n++] << l, l += 8;
                }
                u >>>= h, l -= h, I = 0, f = 11 + (u & 127), u >>>= 7, l -= 7;
              }
              if (r.have + f > r.nlen + r.ndist) {
                e.msg = "invalid bit length repeat", r.mode = oe;
                break;
              }
              for (; f--; )
                r.lens[r.have++] = I;
            }
          }
          if (r.mode === oe)
            break;
          if (r.lens[256] === 0) {
            e.msg = "invalid code -- missing end-of-block", r.mode = oe;
            break;
          }
          if (r.lenbits = 9, H = { bits: r.lenbits }, O = Fr(Ju, r.lens, 0, r.nlen, r.lencode, 0, r.work, H), r.lenbits = H.bits, O) {
            e.msg = "invalid literal/lengths set", r.mode = oe;
            break;
          }
          if (r.distbits = 6, r.distcode = r.distdyn, H = { bits: r.distbits }, O = Fr(Qu, r.lens, r.nlen, r.ndist, r.distcode, 0, r.work, H), r.distbits = H.bits, O) {
            e.msg = "invalid distances set", r.mode = oe;
            break;
          }
          if (r.mode = Ii, t === Ni)
            break e;
        case Ii:
          r.mode = Li;
        case Li:
          if (o >= 6 && c >= 258) {
            e.next_out = a, e.avail_out = c, e.next_in = n, e.avail_in = o, r.hold = u, r.bits = l, L_(e, d), a = e.next_out, s = e.output, c = e.avail_out, n = e.next_in, i = e.input, o = e.avail_in, u = r.hold, l = r.bits, r.mode === at && (r.back = -1);
            break;
          }
          for (r.back = 0; w = r.lencode[u & (1 << r.lenbits) - 1], h = w >>> 24, m = w >>> 16 & 255, b = w & 65535, !(h <= l); ) {
            if (o === 0)
              break e;
            o--, u += i[n++] << l, l += 8;
          }
          if (m && !(m & 240)) {
            for (v = h, S = m, L = b; w = r.lencode[L + ((u & (1 << v + S) - 1) >> v)], h = w >>> 24, m = w >>> 16 & 255, b = w & 65535, !(v + h <= l); ) {
              if (o === 0)
                break e;
              o--, u += i[n++] << l, l += 8;
            }
            u >>>= v, l -= v, r.back += v;
          }
          if (u >>>= h, l -= h, r.back += h, r.length = b, m === 0) {
            r.mode = rc;
            break;
          }
          if (m & 32) {
            r.back = -1, r.mode = at;
            break;
          }
          if (m & 64) {
            e.msg = "invalid literal/length code", r.mode = oe;
            break;
          }
          r.extra = m & 15, r.mode = Jo;
        case Jo:
          if (r.extra) {
            for (D = r.extra; l < D; ) {
              if (o === 0)
                break e;
              o--, u += i[n++] << l, l += 8;
            }
            r.length += u & (1 << r.extra) - 1, u >>>= r.extra, l -= r.extra, r.back += r.extra;
          }
          r.was = r.length, r.mode = Qo;
        case Qo:
          for (; w = r.distcode[u & (1 << r.distbits) - 1], h = w >>> 24, m = w >>> 16 & 255, b = w & 65535, !(h <= l); ) {
            if (o === 0)
              break e;
            o--, u += i[n++] << l, l += 8;
          }
          if (!(m & 240)) {
            for (v = h, S = m, L = b; w = r.distcode[L + ((u & (1 << v + S) - 1) >> v)], h = w >>> 24, m = w >>> 16 & 255, b = w & 65535, !(v + h <= l); ) {
              if (o === 0)
                break e;
              o--, u += i[n++] << l, l += 8;
            }
            u >>>= v, l -= v, r.back += v;
          }
          if (u >>>= h, l -= h, r.back += h, m & 64) {
            e.msg = "invalid distance code", r.mode = oe;
            break;
          }
          r.offset = b, r.extra = m & 15, r.mode = ec;
        case ec:
          if (r.extra) {
            for (D = r.extra; l < D; ) {
              if (o === 0)
                break e;
              o--, u += i[n++] << l, l += 8;
            }
            r.offset += u & (1 << r.extra) - 1, u >>>= r.extra, l -= r.extra, r.back += r.extra;
          }
          if (r.offset > r.dmax) {
            e.msg = "invalid distance too far back", r.mode = oe;
            break;
          }
          r.mode = tc;
        case tc:
          if (c === 0)
            break e;
          if (f = d - c, r.offset > f) {
            if (f = r.offset - f, f > r.whave && r.sane) {
              e.msg = "invalid distance too far back", r.mode = oe;
              break;
            }
            f > r.wnext ? (f -= r.wnext, _ = r.wsize - f) : _ = r.wnext - f, f > r.length && (f = r.length), E = r.window;
          } else
            E = s, _ = a - r.offset, f = r.length;
          f > c && (f = c), c -= f, r.length -= f;
          do
            s[a++] = E[_++];
          while (--f);
          r.length === 0 && (r.mode = Li);
          break;
        case rc:
          if (c === 0)
            break e;
          s[a++] = r.length, c--, r.mode = Li;
          break;
        case us:
          if (r.wrap) {
            for (; l < 32; ) {
              if (o === 0)
                break e;
              o--, u |= i[n++] << l, l += 8;
            }
            if (d -= c, e.total_out += d, r.total += d, d && (e.adler = r.check = /*UPDATE(state.check, put - _out, _out);*/
            r.flags ? Ze(r.check, s, d, a - d) : Fs(r.check, s, d, a - d)), d = c, (r.flags ? u : sc(u)) !== r.check) {
              e.msg = "incorrect data check", r.mode = oe;
              break;
            }
            u = 0, l = 0;
          }
          r.mode = ic;
        case ic:
          if (r.wrap && r.flags) {
            for (; l < 32; ) {
              if (o === 0)
                break e;
              o--, u += i[n++] << l, l += 8;
            }
            if (u !== (r.total & 4294967295)) {
              e.msg = "incorrect length check", r.mode = oe;
              break;
            }
            u = 0, l = 0;
          }
          r.mode = nc;
        case nc:
          O = O_;
          break e;
        case oe:
          O = el;
          break e;
        case il:
          return tl;
        case D_:
        default:
          return Pe;
      }
  return e.next_out = a, e.avail_out = c, e.next_in = n, e.avail_in = o, r.hold = u, r.bits = l, (r.wsize || d !== e.avail_out && r.mode < oe && (r.mode < us || t !== Po)) && cl(e, e.output, e.next_out, d - e.avail_out), p -= e.avail_in, d -= e.avail_out, e.total_in += p, e.total_out += d, r.total += d, r.wrap && d && (e.adler = r.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
  r.flags ? Ze(r.check, s, d, e.next_out - d) : Fs(r.check, s, d, e.next_out - d)), e.data_type = r.bits + (r.last ? 64 : 0) + (r.mode === at ? 128 : 0) + (r.mode === Ii || r.mode === cs ? 256 : 0), (p === 0 && d === 0 || t === Po) && O === Kt && (O = x_), O;
}
function W_(e) {
  if (!e || !e.state)
    return Pe;
  var t = e.state;
  return t.window && (t.window = null), e.state = null, Kt;
}
function z_(e, t) {
  var r;
  return !e || !e.state || (r = e.state, !(r.wrap & 2)) ? Pe : (r.head = t, t.done = !1, Kt);
}
function q_(e, t) {
  var r = t.length, i, s, n;
  return !e || !e.state || (i = e.state, i.wrap !== 0 && i.mode !== ji) ? Pe : i.mode === ji && (s = 1, s = Fs(s, t, r, 0), s !== i.check) ? el : (n = cl(e, t, r, r), n ? (i.mode = il, tl) : (i.havedict = 1, Kt));
}
Ye.inflateReset = sl;
Ye.inflateReset2 = al;
Ye.inflateResetKeep = nl;
Ye.inflateInit = $_;
Ye.inflateInit2 = ol;
Ye.inflate = X_;
Ye.inflateEnd = W_;
Ye.inflateGetHeader = z_;
Ye.inflateSetDictionary = q_;
Ye.inflateInfo = "pako inflate (from Nodeca project)";
var ul = {
  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_TREES: 6,
  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  //Z_MEM_ERROR:     -4,
  Z_BUF_ERROR: -5,
  //Z_VERSION_ERROR: -6,
  /* compression levels */
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,
  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY: 0,
  Z_TEXT: 1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN: 2,
  /* The deflate compression method */
  Z_DEFLATED: 8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};
function K_() {
  this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1;
}
var Y_ = K_, lr = Ye, Mr = ht, $i = Gt, de = ul, Ms = Ta, j_ = Vu, G_ = Y_, ll = Object.prototype.toString;
function Yt(e) {
  if (!(this instanceof Yt)) return new Yt(e);
  this.options = Mr.assign({
    chunkSize: 16384,
    windowBits: 0,
    to: ""
  }, e || {});
  var t = this.options;
  t.raw && t.windowBits >= 0 && t.windowBits < 16 && (t.windowBits = -t.windowBits, t.windowBits === 0 && (t.windowBits = -15)), t.windowBits >= 0 && t.windowBits < 16 && !(e && e.windowBits) && (t.windowBits += 32), t.windowBits > 15 && t.windowBits < 48 && (t.windowBits & 15 || (t.windowBits |= 15)), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new j_(), this.strm.avail_out = 0;
  var r = lr.inflateInit2(
    this.strm,
    t.windowBits
  );
  if (r !== de.Z_OK)
    throw new Error(Ms[r]);
  if (this.header = new G_(), lr.inflateGetHeader(this.strm, this.header), t.dictionary && (typeof t.dictionary == "string" ? t.dictionary = $i.string2buf(t.dictionary) : ll.call(t.dictionary) === "[object ArrayBuffer]" && (t.dictionary = new Uint8Array(t.dictionary)), t.raw && (r = lr.inflateSetDictionary(this.strm, t.dictionary), r !== de.Z_OK)))
    throw new Error(Ms[r]);
}
Yt.prototype.push = function(e, t) {
  var r = this.strm, i = this.options.chunkSize, s = this.options.dictionary, n, a, o, c, u, l = !1;
  if (this.ended)
    return !1;
  a = t === ~~t ? t : t === !0 ? de.Z_FINISH : de.Z_NO_FLUSH, typeof e == "string" ? r.input = $i.binstring2buf(e) : ll.call(e) === "[object ArrayBuffer]" ? r.input = new Uint8Array(e) : r.input = e, r.next_in = 0, r.avail_in = r.input.length;
  do {
    if (r.avail_out === 0 && (r.output = new Mr.Buf8(i), r.next_out = 0, r.avail_out = i), n = lr.inflate(r, de.Z_NO_FLUSH), n === de.Z_NEED_DICT && s && (n = lr.inflateSetDictionary(this.strm, s)), n === de.Z_BUF_ERROR && l === !0 && (n = de.Z_OK, l = !1), n !== de.Z_STREAM_END && n !== de.Z_OK)
      return this.onEnd(n), this.ended = !0, !1;
    r.next_out && (r.avail_out === 0 || n === de.Z_STREAM_END || r.avail_in === 0 && (a === de.Z_FINISH || a === de.Z_SYNC_FLUSH)) && (this.options.to === "string" ? (o = $i.utf8border(r.output, r.next_out), c = r.next_out - o, u = $i.buf2string(r.output, o), r.next_out = c, r.avail_out = i - c, c && Mr.arraySet(r.output, r.output, o, c, 0), this.onData(u)) : this.onData(Mr.shrinkBuf(r.output, r.next_out))), r.avail_in === 0 && r.avail_out === 0 && (l = !0);
  } while ((r.avail_in > 0 || r.avail_out === 0) && n !== de.Z_STREAM_END);
  return n === de.Z_STREAM_END && (a = de.Z_FINISH), a === de.Z_FINISH ? (n = lr.inflateEnd(this.strm), this.onEnd(n), this.ended = !0, n === de.Z_OK) : (a === de.Z_SYNC_FLUSH && (this.onEnd(de.Z_OK), r.avail_out = 0), !0);
};
Yt.prototype.onData = function(e) {
  this.chunks.push(e);
};
Yt.prototype.onEnd = function(e) {
  e === de.Z_OK && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = Mr.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg;
};
function ba(e, t) {
  var r = new Yt(t);
  if (r.push(e, !0), r.err)
    throw r.msg || Ms[r.err];
  return r.result;
}
function V_(e, t) {
  return t = t || {}, t.raw = !0, ba(e, t);
}
si.Inflate = Yt;
si.inflate = ba;
si.inflateRaw = V_;
si.ungzip = ba;
var Z_ = ht.assign, J_ = ri, Q_ = si, eE = ul, dl = {};
Z_(dl, J_, Q_, eE);
var tE = dl, rE = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Uint32Array < "u", iE = tE, fl = le(), gn = Be, nE = rE ? "uint8array" : "array";
_n.magic = "\b\0";
function Vt(e, t) {
  gn.call(this, "FlateWorker/" + e), this._pako = null, this._pakoAction = e, this._pakoOptions = t, this.meta = {};
}
fl.inherits(Vt, gn);
Vt.prototype.processChunk = function(e) {
  this.meta = e.meta, this._pako === null && this._createPako(), this._pako.push(fl.transformTo(nE, e.data), !1);
};
Vt.prototype.flush = function() {
  gn.prototype.flush.call(this), this._pako === null && this._createPako(), this._pako.push([], !0);
};
Vt.prototype.cleanUp = function() {
  gn.prototype.cleanUp.call(this), this._pako = null;
};
Vt.prototype._createPako = function() {
  this._pako = new iE[this._pakoAction]({
    raw: !0,
    level: this._pakoOptions.level || -1
    // default compression
  });
  var e = this;
  this._pako.onData = function(t) {
    e.push({
      data: t,
      meta: e.meta
    });
  };
};
_n.compressWorker = function(e) {
  return new Vt("Deflate", e);
};
_n.uncompressWorker = function() {
  return new Vt("Inflate", {});
};
var oc = Be;
pn.STORE = {
  magic: "\0\0",
  compressWorker: function() {
    return new oc("STORE compression");
  },
  uncompressWorker: function() {
    return new oc("STORE decompression");
  }
};
pn.DEFLATE = _n;
var Lt = {};
Lt.LOCAL_FILE_HEADER = "PK";
Lt.CENTRAL_FILE_HEADER = "PK";
Lt.CENTRAL_DIRECTORY_END = "PK";
Lt.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07";
Lt.ZIP64_CENTRAL_DIRECTORY_END = "PK";
Lt.DATA_DESCRIPTOR = "PK\x07\b";
var ar = le(), Rr = Be, fs = br, cc = oa, Gi = Lt, se = function(e, t) {
  var r = "", i;
  for (i = 0; i < t; i++)
    r += String.fromCharCode(e & 255), e = e >>> 8;
  return r;
}, sE = function(e, t) {
  var r = e;
  return e || (r = t ? 16893 : 33204), (r & 65535) << 16;
}, aE = function(e) {
  return (e || 0) & 63;
}, hl = function(e, t, r, i, s, n) {
  var a = e.file, o = e.compression, c = n !== fs.utf8encode, u = ar.transformTo("string", n(a.name)), l = ar.transformTo("string", fs.utf8encode(a.name)), p = a.comment, d = ar.transformTo("string", n(p)), f = ar.transformTo("string", fs.utf8encode(p)), _ = l.length !== a.name.length, E = f.length !== p.length, w, h, m = "", b = "", v = "", S = a.dir, L = a.date, I = {
    crc32: 0,
    compressedSize: 0,
    uncompressedSize: 0
  };
  (!t || r) && (I.crc32 = e.crc32, I.compressedSize = e.compressedSize, I.uncompressedSize = e.uncompressedSize);
  var O = 0;
  t && (O |= 8), !c && (_ || E) && (O |= 2048);
  var P = 0, H = 0;
  S && (P |= 16), s === "UNIX" ? (H = 798, P |= sE(a.unixPermissions, S)) : (H = 20, P |= aE(a.dosPermissions)), w = L.getUTCHours(), w = w << 6, w = w | L.getUTCMinutes(), w = w << 5, w = w | L.getUTCSeconds() / 2, h = L.getUTCFullYear() - 1980, h = h << 4, h = h | L.getUTCMonth() + 1, h = h << 5, h = h | L.getUTCDate(), _ && (b = // Version
  se(1, 1) + // NameCRC32
  se(cc(u), 4) + // UnicodeName
  l, m += // Info-ZIP Unicode Path Extra Field
  "up" + // size
  se(b.length, 2) + // content
  b), E && (v = // Version
  se(1, 1) + // CommentCRC32
  se(cc(d), 4) + // UnicodeName
  f, m += // Info-ZIP Unicode Path Extra Field
  "uc" + // size
  se(v.length, 2) + // content
  v);
  var D = "";
  D += `
\0`, D += se(O, 2), D += o.magic, D += se(w, 2), D += se(h, 2), D += se(I.crc32, 4), D += se(I.compressedSize, 4), D += se(I.uncompressedSize, 4), D += se(u.length, 2), D += se(m.length, 2);
  var B = Gi.LOCAL_FILE_HEADER + D + u + m, q = Gi.CENTRAL_FILE_HEADER + // version made by (00: DOS)
  se(H, 2) + // file header (common to file and central directory)
  D + // file comment length
  se(d.length, 2) + // disk number start
  "\0\0\0\0" + // external file attributes
  se(P, 4) + // relative offset of local header
  se(i, 4) + // file name
  u + // extra field
  m + // file comment
  d;
  return {
    fileRecord: B,
    dirRecord: q
  };
}, oE = function(e, t, r, i, s) {
  var n = "", a = ar.transformTo("string", s(i));
  return n = Gi.CENTRAL_DIRECTORY_END + // number of this disk
  "\0\0\0\0" + // total number of entries in the central directory on this disk
  se(e, 2) + // total number of entries in the central directory
  se(e, 2) + // size of the central directory   4 bytes
  se(t, 4) + // offset of start of central directory with respect to the starting disk number
  se(r, 4) + // .ZIP file comment length
  se(a.length, 2) + // .ZIP file comment
  a, n;
}, cE = function(e) {
  var t = "";
  return t = Gi.DATA_DESCRIPTOR + // crc-32                          4 bytes
  se(e.crc32, 4) + // compressed size                 4 bytes
  se(e.compressedSize, 4) + // uncompressed size               4 bytes
  se(e.uncompressedSize, 4), t;
};
function je(e, t, r, i) {
  Rr.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t, this.zipPlatform = r, this.encodeFileName = i, this.streamFiles = e, this.accumulate = !1, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
}
ar.inherits(je, Rr);
je.prototype.push = function(e) {
  var t = e.meta.percent || 0, r = this.entriesCount, i = this._sources.length;
  this.accumulate ? this.contentBuffer.push(e) : (this.bytesWritten += e.data.length, Rr.prototype.push.call(this, {
    data: e.data,
    meta: {
      currentFile: this.currentFile,
      percent: r ? (t + 100 * (r - i - 1)) / r : 100
    }
  }));
};
je.prototype.openedSource = function(e) {
  this.currentSourceOffset = this.bytesWritten, this.currentFile = e.file.name;
  var t = this.streamFiles && !e.file.dir;
  if (t) {
    var r = hl(e, t, !1, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
    this.push({
      data: r.fileRecord,
      meta: { percent: 0 }
    });
  } else
    this.accumulate = !0;
};
je.prototype.closedSource = function(e) {
  this.accumulate = !1;
  var t = this.streamFiles && !e.file.dir, r = hl(e, t, !0, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
  if (this.dirRecords.push(r.dirRecord), t)
    this.push({
      data: cE(e),
      meta: { percent: 100 }
    });
  else
    for (this.push({
      data: r.fileRecord,
      meta: { percent: 0 }
    }); this.contentBuffer.length; )
      this.push(this.contentBuffer.shift());
  this.currentFile = null;
};
je.prototype.flush = function() {
  for (var e = this.bytesWritten, t = 0; t < this.dirRecords.length; t++)
    this.push({
      data: this.dirRecords[t],
      meta: { percent: 100 }
    });
  var r = this.bytesWritten - e, i = oE(this.dirRecords.length, r, e, this.zipComment, this.encodeFileName);
  this.push({
    data: i,
    meta: { percent: 100 }
  });
};
je.prototype.prepareNextSource = function() {
  this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
};
je.prototype.registerPrevious = function(e) {
  this._sources.push(e);
  var t = this;
  return e.on("data", function(r) {
    t.processChunk(r);
  }), e.on("end", function() {
    t.closedSource(t.previous.streamInfo), t._sources.length ? t.prepareNextSource() : t.end();
  }), e.on("error", function(r) {
    t.error(r);
  }), this;
};
je.prototype.resume = function() {
  if (!Rr.prototype.resume.call(this))
    return !1;
  if (!this.previous && this._sources.length)
    return this.prepareNextSource(), !0;
  if (!this.previous && !this._sources.length && !this.generatedError)
    return this.end(), !0;
};
je.prototype.error = function(e) {
  var t = this._sources;
  if (!Rr.prototype.error.call(this, e))
    return !1;
  for (var r = 0; r < t.length; r++)
    try {
      t[r].error(e);
    } catch {
    }
  return !0;
};
je.prototype.lock = function() {
  Rr.prototype.lock.call(this);
  for (var e = this._sources, t = 0; t < e.length; t++)
    e[t].lock();
};
var uE = je, lE = pn, dE = uE, fE = function(e, t) {
  var r = e || t, i = lE[r];
  if (!i)
    throw new Error(r + " is not a valid compression method !");
  return i;
};
Su.generateWorker = function(e, t, r) {
  var i = new dE(t.streamFiles, r, t.platform, t.encodeFileName), s = 0;
  try {
    e.forEach(function(n, a) {
      s++;
      var o = fE(a.options.compression, t.compression), c = a.options.compressionOptions || t.compressionOptions || {}, u = a.dir, l = a.date;
      a._compressWorker(o, c).withStreamInfo("file", {
        name: n,
        dir: u,
        date: l,
        comment: a.comment || "",
        unixPermissions: a.unixPermissions,
        dosPermissions: a.dosPermissions
      }).pipe(i);
    }), i.entriesCount = s;
  } catch (n) {
    i.error(n);
  }
  return i;
};
var hE = le(), bn = Be;
function ai(e, t) {
  bn.call(this, "Nodejs stream input adapter for " + e), this._upstreamEnded = !1, this._bindStream(t);
}
hE.inherits(ai, bn);
ai.prototype._bindStream = function(e) {
  var t = this;
  this._stream = e, e.pause(), e.on("data", function(r) {
    t.push({
      data: r,
      meta: {
        percent: 0
      }
    });
  }).on("error", function(r) {
    t.isPaused ? this.generatedError = r : t.error(r);
  }).on("end", function() {
    t.isPaused ? t._upstreamEnded = !0 : t.end();
  });
};
ai.prototype.pause = function() {
  return bn.prototype.pause.call(this) ? (this._stream.pause(), !0) : !1;
};
ai.prototype.resume = function() {
  return bn.prototype.resume.call(this) ? (this._upstreamEnded ? this.end() : this._stream.resume(), !0) : !1;
};
var pE = ai, _E = br, $r = le(), pl = Be, EE = gu, _l = Fe, uc = fa, mE = up, TE = Su, lc = dn, gE = pE, El = function(e, t, r) {
  var i = $r.getTypeOf(t), s, n = $r.extend(r || {}, _l);
  n.date = n.date || /* @__PURE__ */ new Date(), n.compression !== null && (n.compression = n.compression.toUpperCase()), typeof n.unixPermissions == "string" && (n.unixPermissions = parseInt(n.unixPermissions, 8)), n.unixPermissions && n.unixPermissions & 16384 && (n.dir = !0), n.dosPermissions && n.dosPermissions & 16 && (n.dir = !0), n.dir && (e = ml(e)), n.createFolders && (s = bE(e)) && Tl.call(this, s, !0);
  var a = i === "string" && n.binary === !1 && n.base64 === !1;
  (!r || typeof r.binary > "u") && (n.binary = !a);
  var o = t instanceof uc && t.uncompressedSize === 0;
  (o || n.dir || !t || t.length === 0) && (n.base64 = !1, n.binary = !0, t = "", n.compression = "STORE", i = "string");
  var c = null;
  t instanceof uc || t instanceof pl ? c = t : lc.isNode && lc.isStream(t) ? c = new gE(e, t) : c = $r.prepareContent(e, t, n.binary, n.optimizedBinaryString, n.base64);
  var u = new mE(e, c, n);
  this.files[e] = u;
}, bE = function(e) {
  e.slice(-1) === "/" && (e = e.substring(0, e.length - 1));
  var t = e.lastIndexOf("/");
  return t > 0 ? e.substring(0, t) : "";
}, ml = function(e) {
  return e.slice(-1) !== "/" && (e += "/"), e;
}, Tl = function(e, t) {
  return t = typeof t < "u" ? t : _l.createFolders, e = ml(e), this.files[e] || El.call(this, e, null, {
    dir: !0,
    createFolders: t
  }), this.files[e];
};
function dc(e) {
  return Object.prototype.toString.call(e) === "[object RegExp]";
}
var vE = {
  /**
   * @see loadAsync
   */
  load: function() {
    throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
  },
  /**
   * Call a callback function for each entry at this folder level.
   * @param {Function} cb the callback function:
   * function (relativePath, file) {...}
   * It takes 2 arguments : the relative path and the file.
   */
  forEach: function(e) {
    var t, r, i;
    for (t in this.files)
      i = this.files[t], r = t.slice(this.root.length, t.length), r && t.slice(0, this.root.length) === this.root && e(r, i);
  },
  /**
   * Filter nested files/folders with the specified function.
   * @param {Function} search the predicate to use :
   * function (relativePath, file) {...}
   * It takes 2 arguments : the relative path and the file.
   * @return {Array} An array of matching elements.
   */
  filter: function(e) {
    var t = [];
    return this.forEach(function(r, i) {
      e(r, i) && t.push(i);
    }), t;
  },
  /**
   * Add a file to the zip file, or search a file.
   * @param   {string|RegExp} name The name of the file to add (if data is defined),
   * the name of the file to find (if no data) or a regex to match files.
   * @param   {String|ArrayBuffer|Uint8Array|Buffer} data  The file data, either raw or base64 encoded
   * @param   {Object} o     File options
   * @return  {JSZip|Object|Array} this JSZip object (when adding a file),
   * a file (when searching by string) or an array of files (when searching by regex).
   */
  file: function(e, t, r) {
    if (arguments.length === 1)
      if (dc(e)) {
        var i = e;
        return this.filter(function(n, a) {
          return !a.dir && i.test(n);
        });
      } else {
        var s = this.files[this.root + e];
        return s && !s.dir ? s : null;
      }
    else
      e = this.root + e, El.call(this, e, t, r);
    return this;
  },
  /**
   * Add a directory to the zip file, or search.
   * @param   {String|RegExp} arg The name of the directory to add, or a regex to search folders.
   * @return  {JSZip} an object with the new directory as the root, or an array containing matching folders.
   */
  folder: function(e) {
    if (!e)
      return this;
    if (dc(e))
      return this.filter(function(s, n) {
        return n.dir && e.test(s);
      });
    var t = this.root + e, r = Tl.call(this, t), i = this.clone();
    return i.root = r.name, i;
  },
  /**
   * Delete a file, or a directory and all sub-files, from the zip
   * @param {string} name the name of the file to delete
   * @return {JSZip} this JSZip object
   */
  remove: function(e) {
    e = this.root + e;
    var t = this.files[e];
    if (t || (e.slice(-1) !== "/" && (e += "/"), t = this.files[e]), t && !t.dir)
      delete this.files[e];
    else
      for (var r = this.filter(function(s, n) {
        return n.name.slice(0, e.length) === e;
      }), i = 0; i < r.length; i++)
        delete this.files[r[i].name];
    return this;
  },
  /**
   * @deprecated This method has been removed in JSZip 3.0, please check the upgrade guide.
   */
  generate: function() {
    throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
  },
  /**
   * Generate the complete zip file as an internal stream.
   * @param {Object} options the options to generate the zip file :
   * - compression, "STORE" by default.
   * - type, "base64" by default. Values are : string, base64, uint8array, arraybuffer, blob.
   * @return {StreamHelper} the streamed zip file.
   */
  generateInternalStream: function(e) {
    var t, r = {};
    try {
      if (r = $r.extend(e || {}, {
        streamFiles: !1,
        compression: "STORE",
        compressionOptions: null,
        type: "",
        platform: "DOS",
        comment: null,
        mimeType: "application/zip",
        encodeFileName: _E.utf8encode
      }), r.type = r.type.toLowerCase(), r.compression = r.compression.toUpperCase(), r.type === "binarystring" && (r.type = "string"), !r.type)
        throw new Error("No output type specified.");
      $r.checkSupport(r.type), (r.platform === "darwin" || r.platform === "freebsd" || r.platform === "linux" || r.platform === "sunos") && (r.platform = "UNIX"), r.platform === "win32" && (r.platform = "DOS");
      var i = r.comment || this.comment || "";
      t = TE.generateWorker(this, r, i);
    } catch (s) {
      t = new pl("error"), t.error(s);
    }
    return new EE(t, r.type || "string", r.mimeType);
  },
  /**
   * Generate the complete zip file asynchronously.
   * @see generateInternalStream
   */
  generateAsync: function(e, t) {
    return this.generateInternalStream(e).accumulate(t);
  },
  /**
   * Generate the complete zip file asynchronously.
   * @see generateInternalStream
   */
  generateNodeStream: function(e, t) {
    return e = e || {}, e.type || (e.type = "nodebuffer"), this.generateInternalStream(e).toNodejsStream(t);
  }
}, yE = vE, wE = le();
function gl(e) {
  this.data = e, this.length = e.length, this.index = 0, this.zero = 0;
}
gl.prototype = {
  /**
   * Check that the offset will not go too far.
   * @param {string} offset the additional offset to check.
   * @throws {Error} an Error if the offset is out of bounds.
   */
  checkOffset: function(e) {
    this.checkIndex(this.index + e);
  },
  /**
   * Check that the specified index will not be too far.
   * @param {string} newIndex the index to check.
   * @throws {Error} an Error if the index is out of bounds.
   */
  checkIndex: function(e) {
    if (this.length < this.zero + e || e < 0)
      throw new Error("End of data reached (data length = " + this.length + ", asked index = " + e + "). Corrupted zip ?");
  },
  /**
   * Change the index.
   * @param {number} newIndex The new index.
   * @throws {Error} if the new index is out of the data.
   */
  setIndex: function(e) {
    this.checkIndex(e), this.index = e;
  },
  /**
   * Skip the next n bytes.
   * @param {number} n the number of bytes to skip.
   * @throws {Error} if the new index is out of the data.
   */
  skip: function(e) {
    this.setIndex(this.index + e);
  },
  /**
   * Get the byte at the specified index.
   * @param {number} i the index to use.
   * @return {number} a byte.
   */
  byteAt: function() {
  },
  /**
   * Get the next number with a given byte size.
   * @param {number} size the number of bytes to read.
   * @return {number} the corresponding number.
   */
  readInt: function(e) {
    var t = 0, r;
    for (this.checkOffset(e), r = this.index + e - 1; r >= this.index; r--)
      t = (t << 8) + this.byteAt(r);
    return this.index += e, t;
  },
  /**
   * Get the next string with a given byte size.
   * @param {number} size the number of bytes to read.
   * @return {string} the corresponding string.
   */
  readString: function(e) {
    return wE.transformTo("string", this.readData(e));
  },
  /**
   * Get raw data without conversion, <size> bytes.
   * @param {number} size the number of bytes to read.
   * @return {Object} the raw data, implementation specific.
   */
  readData: function() {
  },
  /**
   * Find the last occurrence of a zip signature (4 bytes).
   * @param {string} sig the signature to find.
   * @return {number} the index of the last occurrence, -1 if not found.
   */
  lastIndexOfSignature: function() {
  },
  /**
   * Read the signature (4 bytes) at the current position and compare it with sig.
   * @param {string} sig the expected signature
   * @return {boolean} true if the signature matches, false otherwise.
   */
  readAndCheckSignature: function() {
  },
  /**
   * Get the next date.
   * @return {Date} the date.
   */
  readDate: function() {
    var e = this.readInt(4);
    return new Date(Date.UTC(
      (e >> 25 & 127) + 1980,
      // year
      (e >> 21 & 15) - 1,
      // month
      e >> 16 & 31,
      // day
      e >> 11 & 31,
      // hour
      e >> 5 & 63,
      // minute
      (e & 31) << 1
    ));
  }
};
var bl = gl, vl = bl, SE = le();
function Nr(e) {
  vl.call(this, e);
  for (var t = 0; t < this.data.length; t++)
    e[t] = e[t] & 255;
}
SE.inherits(Nr, vl);
Nr.prototype.byteAt = function(e) {
  return this.data[this.zero + e];
};
Nr.prototype.lastIndexOfSignature = function(e) {
  for (var t = e.charCodeAt(0), r = e.charCodeAt(1), i = e.charCodeAt(2), s = e.charCodeAt(3), n = this.length - 4; n >= 0; --n)
    if (this.data[n] === t && this.data[n + 1] === r && this.data[n + 2] === i && this.data[n + 3] === s)
      return n - this.zero;
  return -1;
};
Nr.prototype.readAndCheckSignature = function(e) {
  var t = e.charCodeAt(0), r = e.charCodeAt(1), i = e.charCodeAt(2), s = e.charCodeAt(3), n = this.readData(4);
  return t === n[0] && r === n[1] && i === n[2] && s === n[3];
};
Nr.prototype.readData = function(e) {
  if (this.checkOffset(e), e === 0)
    return [];
  var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var yl = Nr, wl = bl, RE = le();
function Ir(e) {
  wl.call(this, e);
}
RE.inherits(Ir, wl);
Ir.prototype.byteAt = function(e) {
  return this.data.charCodeAt(this.zero + e);
};
Ir.prototype.lastIndexOfSignature = function(e) {
  return this.data.lastIndexOf(e) - this.zero;
};
Ir.prototype.readAndCheckSignature = function(e) {
  var t = this.readData(4);
  return e === t;
};
Ir.prototype.readData = function(e) {
  this.checkOffset(e);
  var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var NE = Ir, Sl = yl, IE = le();
function va(e) {
  Sl.call(this, e);
}
IE.inherits(va, Sl);
va.prototype.readData = function(e) {
  if (this.checkOffset(e), e === 0)
    return new Uint8Array(0);
  var t = this.data.subarray(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var Rl = va, Nl = Rl, LE = le();
function ya(e) {
  Nl.call(this, e);
}
LE.inherits(ya, Nl);
ya.prototype.readData = function(e) {
  this.checkOffset(e);
  var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var AE = ya, Ai = le(), fc = pe, CE = yl, OE = NE, kE = AE, xE = Rl, Il = function(e) {
  var t = Ai.getTypeOf(e);
  return Ai.checkSupport(t), t === "string" && !fc.uint8array ? new OE(e) : t === "nodebuffer" ? new kE(e) : fc.uint8array ? new xE(Ai.transformTo("uint8array", e)) : new CE(Ai.transformTo("array", e));
}, hs = Il, mt = le(), DE = fa, hc = oa, Ci = br, Oi = pn, UE = pe, PE = 0, BE = 3, FE = function(e) {
  for (var t in Oi)
    if (Object.prototype.hasOwnProperty.call(Oi, t) && Oi[t].magic === e)
      return Oi[t];
  return null;
};
function Ll(e, t) {
  this.options = e, this.loadOptions = t;
}
Ll.prototype = {
  /**
   * say if the file is encrypted.
   * @return {boolean} true if the file is encrypted, false otherwise.
   */
  isEncrypted: function() {
    return (this.bitFlag & 1) === 1;
  },
  /**
   * say if the file has utf-8 filename/comment.
   * @return {boolean} true if the filename/comment is in utf-8, false otherwise.
   */
  useUTF8: function() {
    return (this.bitFlag & 2048) === 2048;
  },
  /**
   * Read the local part of a zip file and add the info in this object.
   * @param {DataReader} reader the reader to use.
   */
  readLocalPart: function(e) {
    var t, r;
    if (e.skip(22), this.fileNameLength = e.readInt(2), r = e.readInt(2), this.fileName = e.readData(this.fileNameLength), e.skip(r), this.compressedSize === -1 || this.uncompressedSize === -1)
      throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
    if (t = FE(this.compressionMethod), t === null)
      throw new Error("Corrupted zip : compression " + mt.pretty(this.compressionMethod) + " unknown (inner file : " + mt.transformTo("string", this.fileName) + ")");
    this.decompressed = new DE(this.compressedSize, this.uncompressedSize, this.crc32, t, e.readData(this.compressedSize));
  },
  /**
   * Read the central part of a zip file and add the info in this object.
   * @param {DataReader} reader the reader to use.
   */
  readCentralPart: function(e) {
    this.versionMadeBy = e.readInt(2), e.skip(2), this.bitFlag = e.readInt(2), this.compressionMethod = e.readString(2), this.date = e.readDate(), this.crc32 = e.readInt(4), this.compressedSize = e.readInt(4), this.uncompressedSize = e.readInt(4);
    var t = e.readInt(2);
    if (this.extraFieldsLength = e.readInt(2), this.fileCommentLength = e.readInt(2), this.diskNumberStart = e.readInt(2), this.internalFileAttributes = e.readInt(2), this.externalFileAttributes = e.readInt(4), this.localHeaderOffset = e.readInt(4), this.isEncrypted())
      throw new Error("Encrypted zip are not supported");
    e.skip(t), this.readExtraFields(e), this.parseZIP64ExtraField(e), this.fileComment = e.readData(this.fileCommentLength);
  },
  /**
   * Parse the external file attributes and get the unix/dos permissions.
   */
  processAttributes: function() {
    this.unixPermissions = null, this.dosPermissions = null;
    var e = this.versionMadeBy >> 8;
    this.dir = !!(this.externalFileAttributes & 16), e === PE && (this.dosPermissions = this.externalFileAttributes & 63), e === BE && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), !this.dir && this.fileNameStr.slice(-1) === "/" && (this.dir = !0);
  },
  /**
   * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
   * @param {DataReader} reader the reader to use.
   */
  parseZIP64ExtraField: function() {
    if (this.extraFields[1]) {
      var e = hs(this.extraFields[1].value);
      this.uncompressedSize === mt.MAX_VALUE_32BITS && (this.uncompressedSize = e.readInt(8)), this.compressedSize === mt.MAX_VALUE_32BITS && (this.compressedSize = e.readInt(8)), this.localHeaderOffset === mt.MAX_VALUE_32BITS && (this.localHeaderOffset = e.readInt(8)), this.diskNumberStart === mt.MAX_VALUE_32BITS && (this.diskNumberStart = e.readInt(4));
    }
  },
  /**
   * Read the central part of a zip file and add the info in this object.
   * @param {DataReader} reader the reader to use.
   */
  readExtraFields: function(e) {
    var t = e.index + this.extraFieldsLength, r, i, s;
    for (this.extraFields || (this.extraFields = {}); e.index + 4 < t; )
      r = e.readInt(2), i = e.readInt(2), s = e.readData(i), this.extraFields[r] = {
        id: r,
        length: i,
        value: s
      };
    e.setIndex(t);
  },
  /**
   * Apply an UTF8 transformation if needed.
   */
  handleUTF8: function() {
    var e = UE.uint8array ? "uint8array" : "array";
    if (this.useUTF8())
      this.fileNameStr = Ci.utf8decode(this.fileName), this.fileCommentStr = Ci.utf8decode(this.fileComment);
    else {
      var t = this.findExtraFieldUnicodePath();
      if (t !== null)
        this.fileNameStr = t;
      else {
        var r = mt.transformTo(e, this.fileName);
        this.fileNameStr = this.loadOptions.decodeFileName(r);
      }
      var i = this.findExtraFieldUnicodeComment();
      if (i !== null)
        this.fileCommentStr = i;
      else {
        var s = mt.transformTo(e, this.fileComment);
        this.fileCommentStr = this.loadOptions.decodeFileName(s);
      }
    }
  },
  /**
   * Find the unicode path declared in the extra field, if any.
   * @return {String} the unicode path, null otherwise.
   */
  findExtraFieldUnicodePath: function() {
    var e = this.extraFields[28789];
    if (e) {
      var t = hs(e.value);
      return t.readInt(1) !== 1 || hc(this.fileName) !== t.readInt(4) ? null : Ci.utf8decode(t.readData(e.length - 5));
    }
    return null;
  },
  /**
   * Find the unicode comment declared in the extra field, if any.
   * @return {String} the unicode comment, null otherwise.
   */
  findExtraFieldUnicodeComment: function() {
    var e = this.extraFields[25461];
    if (e) {
      var t = hs(e.value);
      return t.readInt(1) !== 1 || hc(this.fileComment) !== t.readInt(4) ? null : Ci.utf8decode(t.readData(e.length - 5));
    }
    return null;
  }
};
var ME = Ll, $E = Il, ot = le(), He = Lt, HE = ME, XE = pe;
function Al(e) {
  this.files = [], this.loadOptions = e;
}
Al.prototype = {
  /**
   * Check that the reader is on the specified signature.
   * @param {string} expectedSignature the expected signature.
   * @throws {Error} if it is an other signature.
   */
  checkSignature: function(e) {
    if (!this.reader.readAndCheckSignature(e)) {
      this.reader.index -= 4;
      var t = this.reader.readString(4);
      throw new Error("Corrupted zip or bug: unexpected signature (" + ot.pretty(t) + ", expected " + ot.pretty(e) + ")");
    }
  },
  /**
   * Check if the given signature is at the given index.
   * @param {number} askedIndex the index to check.
   * @param {string} expectedSignature the signature to expect.
   * @return {boolean} true if the signature is here, false otherwise.
   */
  isSignature: function(e, t) {
    var r = this.reader.index;
    this.reader.setIndex(e);
    var i = this.reader.readString(4), s = i === t;
    return this.reader.setIndex(r), s;
  },
  /**
   * Read the end of the central directory.
   */
  readBlockEndOfCentral: function() {
    this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
    var e = this.reader.readData(this.zipCommentLength), t = XE.uint8array ? "uint8array" : "array", r = ot.transformTo(t, e);
    this.zipComment = this.loadOptions.decodeFileName(r);
  },
  /**
   * Read the end of the Zip 64 central directory.
   * Not merged with the method readEndOfCentral :
   * The end of central can coexist with its Zip64 brother,
   * I don't want to read the wrong number of bytes !
   */
  readBlockZip64EndOfCentral: function() {
    this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
    for (var e = this.zip64EndOfCentralSize - 44, t = 0, r, i, s; t < e; )
      r = this.reader.readInt(2), i = this.reader.readInt(4), s = this.reader.readData(i), this.zip64ExtensibleData[r] = {
        id: r,
        length: i,
        value: s
      };
  },
  /**
   * Read the end of the Zip 64 central directory locator.
   */
  readBlockZip64EndOfCentralLocator: function() {
    if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), this.disksCount > 1)
      throw new Error("Multi-volumes zip are not supported");
  },
  /**
   * Read the local files, based on the offset read in the central part.
   */
  readLocalFiles: function() {
    var e, t;
    for (e = 0; e < this.files.length; e++)
      t = this.files[e], this.reader.setIndex(t.localHeaderOffset), this.checkSignature(He.LOCAL_FILE_HEADER), t.readLocalPart(this.reader), t.handleUTF8(), t.processAttributes();
  },
  /**
   * Read the central directory.
   */
  readCentralDir: function() {
    var e;
    for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(He.CENTRAL_FILE_HEADER); )
      e = new HE({
        zip64: this.zip64
      }, this.loadOptions), e.readCentralPart(this.reader), this.files.push(e);
    if (this.centralDirRecords !== this.files.length && this.centralDirRecords !== 0 && this.files.length === 0)
      throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
  },
  /**
   * Read the end of central directory.
   */
  readEndOfCentral: function() {
    var e = this.reader.lastIndexOfSignature(He.CENTRAL_DIRECTORY_END);
    if (e < 0) {
      var t = !this.isSignature(0, He.LOCAL_FILE_HEADER);
      throw t ? new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html") : new Error("Corrupted zip: can't find end of central directory");
    }
    this.reader.setIndex(e);
    var r = e;
    if (this.checkSignature(He.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === ot.MAX_VALUE_16BITS || this.diskWithCentralDirStart === ot.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === ot.MAX_VALUE_16BITS || this.centralDirRecords === ot.MAX_VALUE_16BITS || this.centralDirSize === ot.MAX_VALUE_32BITS || this.centralDirOffset === ot.MAX_VALUE_32BITS) {
      if (this.zip64 = !0, e = this.reader.lastIndexOfSignature(He.ZIP64_CENTRAL_DIRECTORY_LOCATOR), e < 0)
        throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
      if (this.reader.setIndex(e), this.checkSignature(He.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, He.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(He.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0))
        throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
      this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(He.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
    }
    var i = this.centralDirOffset + this.centralDirSize;
    this.zip64 && (i += 20, i += 12 + this.zip64EndOfCentralSize);
    var s = r - i;
    if (s > 0)
      this.isSignature(r, He.CENTRAL_FILE_HEADER) || (this.reader.zero = s);
    else if (s < 0)
      throw new Error("Corrupted zip: missing " + Math.abs(s) + " bytes.");
  },
  prepareReader: function(e) {
    this.reader = $E(e);
  },
  /**
   * Read a zip file and create ZipEntries.
   * @param {String|ArrayBuffer|Uint8Array|Buffer} data the binary string representing a zip file.
   */
  load: function(e) {
    this.prepareReader(e), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
  }
};
var WE = Al, ps = le(), Hi = ti, zE = br, qE = WE, KE = wu, pc = dn;
function YE(e) {
  return new Hi.Promise(function(t, r) {
    var i = e.decompressed.getContentWorker().pipe(new KE());
    i.on("error", function(s) {
      r(s);
    }).on("end", function() {
      i.streamInfo.crc32 !== e.decompressed.crc32 ? r(new Error("Corrupted zip : CRC32 mismatch")) : t();
    }).resume();
  });
}
var jE = function(e, t) {
  var r = this;
  return t = ps.extend(t || {}, {
    base64: !1,
    checkCRC32: !1,
    optimizedBinaryString: !1,
    createFolders: !1,
    decodeFileName: zE.utf8decode
  }), pc.isNode && pc.isStream(e) ? Hi.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : ps.prepareContent("the loaded zip file", e, !0, t.optimizedBinaryString, t.base64).then(function(i) {
    var s = new qE(t);
    return s.load(i), s;
  }).then(function(s) {
    var n = [Hi.Promise.resolve(s)], a = s.files;
    if (t.checkCRC32)
      for (var o = 0; o < a.length; o++)
        n.push(YE(a[o]));
    return Hi.Promise.all(n);
  }).then(function(s) {
    for (var n = s.shift(), a = n.files, o = 0; o < a.length; o++) {
      var c = a[o], u = c.fileNameStr, l = ps.resolve(c.fileNameStr);
      r.file(l, c.decompressed, {
        binary: !0,
        optimizedBinaryString: !0,
        date: c.date,
        dir: c.dir,
        comment: c.fileCommentStr.length ? c.fileCommentStr : null,
        unixPermissions: c.unixPermissions,
        dosPermissions: c.dosPermissions,
        createFolders: t.createFolders
      }), c.dir || (r.file(l).unsafeOriginalName = u);
    }
    return n.zipComment.length && (r.comment = n.zipComment), r;
  });
};
function Ue() {
  if (!(this instanceof Ue))
    return new Ue();
  if (arguments.length)
    throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
  this.files = /* @__PURE__ */ Object.create(null), this.comment = null, this.root = "", this.clone = function() {
    var e = new Ue();
    for (var t in this)
      typeof this[t] != "function" && (e[t] = this[t]);
    return e;
  };
}
Ue.prototype = yE;
Ue.prototype.loadAsync = jE;
Ue.support = pe;
Ue.defaults = Fe;
Ue.version = "3.10.1";
Ue.loadAsync = function(e, t) {
  return new Ue().loadAsync(e, t);
};
Ue.external = ti;
var GE = Ue;
const Cl = /* @__PURE__ */ Qs(GE), ct = Buffer.from("KAAROBKB1", "utf8"), VE = "kaarobar-backup-salt-v1", Ol = "kaarobar-dev-backup-secret";
function ZE() {
  return process.env.KAAROBAR_BACKUP_SECRET || "" || Ol;
}
function JE() {
  const e = [
    process.env.KAAROBAR_BACKUP_SECRET,
    "",
    Ol
  ].filter((t) => !!(t && t.trim()));
  return [...new Set(e)];
}
function kl(e) {
  return Hc(e, VE, 32);
}
function QE(e) {
  const t = kl(ZE()), r = Bc(12), i = Fc("aes-256-gcm", t, r), s = Buffer.concat([i.update(e), i.final()]), n = i.getAuthTag();
  return Buffer.concat([ct, r, n, s]);
}
function em(e) {
  if (e.length < ct.length + 12 + 16 + 1)
    throw new Error("Invalid backup file: too short");
  if (!e.subarray(0, ct.length).equals(ct))
    throw new Error("Invalid backup file: not a Kaarobar encrypted backup");
  const r = e.subarray(ct.length, ct.length + 12), i = e.subarray(ct.length + 12, ct.length + 28), s = e.subarray(ct.length + 28);
  for (const n of JE())
    try {
      const a = kl(n), o = Xc("aes-256-gcm", a, r);
      return o.setAuthTag(i), Buffer.concat([o.update(s), o.final()]);
    } catch {
    }
  throw new Error("Invalid backup file: decrypt failed");
}
const tm = 2, rm = Buffer.from("SQLite format 3\0", "utf8"), im = Buffer.from([80, 75, 3, 4]);
function ne(e, t, r, i) {
  e && e({
    operation: t,
    phase: r,
    percent: Math.max(0, Math.min(100, Math.round(i)))
  });
}
function $s(e, t, r, i, s) {
  if (r <= t) return s;
  const n = Math.max(0, Math.min(1, (e - t) / (r - t)));
  return i + n * (s - i);
}
async function hr() {
  await new Promise((e) => setImmediate(e));
}
function xl() {
  const e = he().prepare("SELECT id FROM businesses WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1").get(), t = (e == null ? void 0 : e.id) ?? null;
  return j.set("lastBusinessId", t), t;
}
function nm() {
  const e = F.join(Xe.getPath("documents"), "KaarobarBackups");
  return M.mkdirSync(e, { recursive: !0 }), e;
}
const _c = "kaarobar-latest.kaarobar-backup";
function sm(e, t) {
  for (const r of M.readdirSync(e, { withFileTypes: !0 }))
    r.isFile() && r.name.endsWith(".kaarobar-backup") && r.name !== t && M.unlinkSync(F.join(e, r.name));
}
function am(e) {
  for (const t of ["-wal", "-shm"]) {
    const r = `${e}${t}`;
    M.existsSync(r) && M.unlinkSync(r);
  }
}
function om() {
  he().pragma("wal_checkpoint(TRUNCATE)");
  const t = rn();
  return ta(), M.readFileSync(t);
}
function Dl(e) {
  ta();
  const t = rn();
  M.mkdirSync(F.dirname(t), { recursive: !0 }), am(t), M.writeFileSync(t, e);
  const r = We();
  ft(r);
}
function cm(e) {
  return e.length >= 4 && e.subarray(0, 4).equals(im);
}
function Ul(e) {
  return e.length >= 16 && e.subarray(0, 16).equals(rm);
}
function um(e) {
  if (!M.existsSync(e)) return [];
  const t = [], r = (i) => {
    for (const s of M.readdirSync(i, { withFileTypes: !0 })) {
      const n = F.join(i, s.name);
      if (s.isDirectory()) {
        r(n);
        continue;
      }
      if (!s.isFile()) continue;
      const a = F.relative(e, n).split(F.sep).join("/");
      !a || a.includes("..") || t.push({ relativePosix: a, absolute: n });
    }
  };
  return r(e), t;
}
function lm(e) {
  if (M.existsSync(e))
    for (const t of M.readdirSync(e, { withFileTypes: !0 })) {
      const r = F.join(e, t.name);
      M.rmSync(r, { recursive: !0, force: !0 });
    }
}
function _s(e) {
  if (e == null) return null;
  const t = e.trim();
  if (!t) return null;
  const r = t.replace(/\\/g, "/"), i = "/assets/", s = r.toLowerCase().lastIndexOf(i);
  if (s >= 0)
    return r.slice(s + i.length).replace(/^\/+/, "") || null;
  if (!F.isAbsolute(t) && !/^[a-zA-Z]:[\\/]/.test(t) && !r.startsWith("/"))
    return r.replace(/^\/+/, "");
  const n = r.match(/\/((?:logos|products)\/[^/]+)$/i);
  return n != null && n[1] ? n[1] : null;
}
function Pl() {
  const e = he(), t = e.prepare("SELECT id, image_path FROM products WHERE image_path IS NOT NULL AND image_path != ''").all(), r = e.prepare("UPDATE products SET image_path = ? WHERE id = ?");
  for (const o of t) {
    const c = _s(o.image_path);
    c !== o.image_path && r.run(c, o.id);
  }
  const i = e.prepare("SELECT id, image_path FROM users WHERE image_path IS NOT NULL AND image_path != ''").all(), s = e.prepare("UPDATE users SET image_path = ? WHERE id = ?");
  for (const o of i) {
    const c = _s(o.image_path);
    c !== o.image_path && s.run(c, o.id);
  }
  const n = e.prepare("SELECT id, logo_path FROM businesses WHERE logo_path IS NOT NULL AND logo_path != ''").all(), a = e.prepare("UPDATE businesses SET logo_path = ? WHERE id = ?");
  for (const o of n) {
    const c = _s(o.logo_path);
    c !== o.logo_path && a.run(c, o.id);
  }
}
async function dm(e, t) {
  const r = new Cl(), i = {
    formatVersion: tm,
    app: "kaarobar",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    includes: ["db", "files"]
  };
  r.file("manifest.json", JSON.stringify(i, null, 2)), r.file("db/kaarobar.sqlite", e);
  const s = ea(), n = um(s), a = Math.max(n.length, 1);
  for (let c = 0; c < n.length; c++) {
    const u = n[c];
    r.file(`files/${u.relativePosix}`, M.readFileSync(u.absolute)), (c === 0 || c === n.length - 1 || c % 8 === 0) && (ne(t, "create", "packing_files", $s(c + 1, 0, a, 8, 50)), await hr());
  }
  n.length === 0 && ne(t, "create", "packing_files", 50), ne(t, "create", "compressing", 50);
  const o = await r.generateAsync(
    {
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    },
    (c) => {
      ne(t, "create", "compressing", $s(c.percent, 0, 100, 50, 75));
    }
  );
  return Buffer.from(o);
}
async function fm(e, t) {
  const r = ea(), i = `${r}.restore-tmp`;
  M.rmSync(i, { recursive: !0, force: !0 }), M.mkdirSync(i, { recursive: !0 });
  const s = Object.values(e.files).filter(
    (a) => !a.dir && (a.name.startsWith("files/") || a.name.startsWith("assets/"))
  ), n = Math.max(s.length, 1);
  for (let a = 0; a < s.length; a++) {
    const o = s[a], c = o.name.startsWith("files/") ? "files/" : "assets/", u = o.name.slice(c.length).replace(/^\/+/, "");
    if (!u || u.includes("..")) continue;
    const l = F.resolve(i, ...u.split("/")), p = F.resolve(i), d = p.endsWith(F.sep) ? p : p + F.sep;
    l !== p && !l.startsWith(d) || (M.mkdirSync(F.dirname(l), { recursive: !0 }), M.writeFileSync(l, Buffer.from(await o.async("nodebuffer"))), (a === 0 || a === s.length - 1 || a % 8 === 0) && (ne(t, "restore", "restoring_files", $s(a + 1, 0, n, 42, 88)), await hr()));
  }
  if (s.length === 0 && ne(t, "restore", "restoring_files", 88), M.mkdirSync(r, { recursive: !0 }), lm(r), M.existsSync(i))
    for (const a of M.readdirSync(i, { withFileTypes: !0 }))
      M.renameSync(F.join(i, a.name), F.join(r, a.name));
  M.rmSync(i, { recursive: !0, force: !0 });
}
async function hm(e, t) {
  ne(t, "restore", "extracting", 20);
  const r = await Cl.loadAsync(e);
  ne(t, "restore", "extracting", 28);
  const i = r.file("db/kaarobar.sqlite") ?? r.file("kaarobar.sqlite") ?? Object.values(r.files).find((n) => !n.dir && n.name.endsWith(".sqlite"));
  if (!i || i.dir)
    throw new Error("Invalid backup archive: database file missing");
  ne(t, "restore", "installing_db", 30);
  const s = Buffer.from(await i.async("nodebuffer"));
  if (!Ul(s))
    throw new Error("Invalid backup archive: database is not SQLite");
  Dl(s), ne(t, "restore", "installing_db", 42), await fm(r, t), ne(t, "restore", "finalizing", 90), Pl(), ne(t, "restore", "finalizing", 98);
}
let Ht = !1;
function pm() {
  return Ht;
}
async function Bl(e) {
  if (Ht) throw new Error("A backup operation is already in progress");
  Ht = !0, We();
  try {
    ne(e, "create", "prepare_db", 2);
    const t = om();
    ne(e, "create", "prepare_db", 8), await hr();
    const r = await dm(t, e);
    ne(e, "create", "encrypting", 76), await hr();
    const i = QE(r);
    ne(e, "create", "encrypting", 90), ne(e, "create", "writing", 92);
    const s = nm(), n = F.join(s, _c);
    return M.writeFileSync(n, i), sm(s, _c), We(), ft(he()), ne(e, "create", "writing", 100), { ok: !0, filePath: n };
  } catch (t) {
    throw We(), t;
  } finally {
    Ht = !1;
  }
}
async function _m(e) {
  return X("system:backup_create"), Bl(e);
}
async function Fl(e, t) {
  if (!e || !M.existsSync(e))
    throw new Error("Backup file not found");
  ne(t, "restore", "reading", 2);
  const r = M.readFileSync(e);
  ne(t, "restore", "reading", 6), await hr(), ne(t, "restore", "decrypting", 8);
  const i = em(r);
  if (ne(t, "restore", "decrypting", 18), await hr(), cm(i)) {
    await hm(i, t);
    return;
  }
  if (!Ul(i))
    throw new Error("Invalid backup file: decrypted data is not a Kaarobar backup");
  ne(t, "restore", "installing_db", 25), Dl(i), ne(t, "restore", "finalizing", 85), Pl(), ne(t, "restore", "finalizing", 98);
}
async function Em(e, t) {
  if (X("system:backup_restore"), Ht) throw new Error("A backup operation is already in progress");
  Ht = !0;
  try {
    await Fl(e, t), ne(t, "restore", "finalizing", 99);
    const r = xl();
    return ru(), ne(t, "restore", "finalizing", 100), { ok: !0, businessId: r };
  } finally {
    Ht = !1;
  }
}
async function mm() {
  const e = await Uc.showOpenDialog({
    title: "Choose Kaarobar backup",
    properties: ["openFile"],
    filters: [
      { name: "Kaarobar backup", extensions: ["kaarobar-backup"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  return e.canceled || !e.filePaths[0] ? null : e.filePaths[0];
}
const Tm = ["retail", "food", "salon", "services"];
function gm(e) {
  return typeof e == "string" && Tm.includes(e);
}
function oi(e) {
  return gm(e) ? e : "retail";
}
function bm(e) {
  switch (e) {
    case "retail":
      return ["item"];
    case "food":
      return ["item", "deal"];
    case "salon":
    case "services":
      return ["service", "package", "deal", "item"];
    default:
      return ["item"];
  }
}
function Ml(e) {
  return e === "item";
}
function Zt(e) {
  return e === "food";
}
function vm(e) {
  return e === "food";
}
function ym(e) {
  return e === "salon" || e === "services";
}
function $l(e, t) {
  return bm(e).includes(t);
}
function Hs() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function wm() {
  try {
    M.mkdirSync(tt(), { recursive: !0 });
    const e = j.get("setupComplete"), t = Xt(j.get("language"));
    if (!e || !nn())
      return { status: "needs_setup" };
    We(), ft(he()), zi();
    const r = Tr();
    return r.status === "none" ? { status: "needs_license" } : r.status === "expired" ? {
      status: "license_expired",
      expiresAt: r.record.expiresAt,
      issuedTo: r.record.issuedTo
    } : { status: "needs_login", language: t };
  } catch (e) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : "Failed to boot application"
    };
  }
}
const Es = "#2d6df6";
function Sm() {
  var e, t;
  try {
    if (!j.get("setupComplete") || !nn()) return Es;
    We(), ft(he());
    const r = j.get("lastBusinessId");
    if (r) {
      const s = he().prepare("SELECT brand_color FROM businesses WHERE id = ?").get(r);
      if ((e = s == null ? void 0 : s.brand_color) != null && e.trim()) return s.brand_color.trim();
    }
    const i = he().prepare("SELECT brand_color FROM businesses ORDER BY created_at ASC LIMIT 1").get();
    return ((t = i == null ? void 0 : i.brand_color) == null ? void 0 : t.trim()) || Es;
  } catch {
    return Es;
  }
}
async function Rm(e) {
  try {
    M.mkdirSync(tt(), { recursive: !0 });
    let t = qi();
    if (!t || t.licenseKey !== e.licenseKey.trim()) {
      const c = await an(e.licenseKey);
      if (!c.ok) return { ok: !1, error: c.error, message: c.message };
      t = qi();
    }
    if (!t)
      return { ok: !1, error: "license_missing", message: "License activation could not be saved locally." };
    if (nn() && j.get("setupComplete"))
      return { ok: !1, error: "already_setup", message: "Setup has already been completed on this device." };
    ta();
    const r = We();
    ft(r), zi();
    const i = ae(), s = ae(), n = ae(), a = Hs(), o = dr.hashSync(e.owner.password, 12);
    return r.transaction(() => {
      r.prepare(
        `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
         VALUES (?, NULL, NULL, ?, ?, ?, 'owner', 1, ?)`
      ).run(i, e.owner.name.trim(), e.owner.email.trim().toLowerCase(), o, a), r.prepare(
        `INSERT INTO businesses (
           id, owner_id, name, currency, brand_color, business_nature, logo_path,
           receipt_header, receipt_footer,
           is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)`
      ).run(
        s,
        i,
        e.business.name.trim(),
        e.business.currency.trim() || "PKR",
        e.business.brandColor,
        oi(e.business.businessNature),
        "Thank you for shopping with us",
        a,
        a
      ), r.prepare(
        `INSERT INTO branches (id, business_id, name, address, phone, is_main_branch, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, 1, ?)`
      ).run(
        n,
        s,
        e.branch.name.trim(),
        e.branch.address.trim() || null,
        e.branch.phone.trim() || null,
        a
      ), r.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        "",
        "language",
        Xt(e.language)
      ), r.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        s,
        "receipt_footer",
        "Thank you for shopping with us"
      ), r.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        s,
        "idle_lock_minutes",
        "10"
      );
    })(), zi(), j.set("setupComplete", !0), j.set("language", Xt(e.language)), j.set("lastBusinessId", s), M.writeFileSync(F.join(tt(), "setup.complete"), Hs(), "utf8"), { ok: !0 };
  } catch (t) {
    return {
      ok: !1,
      error: "setup_failed",
      message: t instanceof Error ? t.message : "Setup failed"
    };
  }
}
async function Nm(e, t) {
  try {
    if (M.mkdirSync(tt(), { recursive: !0 }), nn() && j.get("setupComplete"))
      return { ok: !1, error: "already_setup", message: "Setup has already been completed on this device." };
    let r = qi();
    if (!r || r.licenseKey !== e.licenseKey.trim()) {
      const a = await an(e.licenseKey);
      if (!a.ok) return { ok: !1, error: a.error, message: a.message };
      r = qi();
    }
    if (!r)
      return { ok: !1, error: "license_missing", message: "License activation could not be saved locally." };
    await Fl(e.filePath, t), t == null || t({ operation: "restore", phase: "finalizing", percent: 99 }), zi();
    const s = he().prepare("SELECT value FROM settings WHERE key = 'language' ORDER BY business_id ASC LIMIT 1").get(), n = Xt(s == null ? void 0 : s.value);
    return xl(), j.set("setupComplete", !0), j.set("language", n), M.writeFileSync(F.join(tt(), "setup.complete"), Hs(), "utf8"), t == null || t({ operation: "restore", phase: "finalizing", percent: 100 }), { ok: !0 };
  } catch (r) {
    return {
      ok: !1,
      error: "setup_failed",
      message: r instanceof Error ? r.message : "Failed to restore from backup"
    };
  }
}
const Ec = 7, Im = 3, Hl = /* @__PURE__ */ new Map();
function Lm(e) {
  const t = /* @__PURE__ */ new Date();
  return t.setUTCDate(t.getUTCDate() - (e - 1)), t.setUTCHours(0, 0, 0, 0), t.toISOString();
}
function Xl() {
  return We(), ft(he()), he();
}
function Am() {
  return Xl().prepare("SELECT id FROM businesses WHERE is_active = 1").all().map((r) => r.id);
}
function Wl(e) {
  const t = Xl(), r = Lm(Ec), i = t.prepare(
    `
      WITH recent_sales AS (
        SELECT
          si.product_id AS product_id,
          SUM(MAX(si.qty - COALESCE(si.refunded_qty, 0), 0)) AS qty_sold
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.business_id = ? AND s.created_at >= ? AND s.status != 'void'
        GROUP BY si.product_id
      )
      SELECT
        p.id,
        p.name,
        p.stock_qty,
        COALESCE(rs.qty_sold, 0) AS qty_sold
      FROM products p
      LEFT JOIN recent_sales rs ON rs.product_id = p.id
      WHERE p.business_id = ? AND p.is_active = 1 AND p.tracks_stock = 1
      ORDER BY p.name ASC
    `
  ).all(e, r, e), s = [];
  for (const n of i) {
    const a = n.qty_sold / Ec;
    if (a <= 0) continue;
    const o = n.stock_qty / a;
    if (o > Im) continue;
    const c = Math.max(0, Math.ceil(a * 7 - n.stock_qty));
    s.push({
      productId: n.id,
      productName: n.name,
      stockQty: n.stock_qty,
      avgDailyQty: Number(a.toFixed(2)),
      daysLeft: Number(o.toFixed(1)),
      recommendedQty: c
    });
  }
  return s.sort((n, a) => n.daysLeft - a.daysLeft || n.stockQty - a.stockQty), Hl.set(e, { atMs: Date.now(), alerts: s }), s;
}
function Cm(e) {
  const t = Hl.get(e);
  return t && Date.now() - t.atMs < 30 * 60 * 1e3 ? t.alerts : Wl(e);
}
const Om = 7;
let ms = !1;
function km(e = /* @__PURE__ */ new Date()) {
  const t = e.getFullYear(), r = String(e.getMonth() + 1).padStart(2, "0"), i = String(e.getDate()).padStart(2, "0");
  return `${t}-${r}-${i}`;
}
function xm(e, t = /* @__PURE__ */ new Date()) {
  const r = new Date(e).getTime();
  return Number.isFinite(r) ? (r - t.getTime()) / (24 * 60 * 60 * 1e3) : Number.POSITIVE_INFINITY;
}
function Dm(e = /* @__PURE__ */ new Date()) {
  const t = Tr();
  if (t.status === "none")
    return { kind: "missing", expiresAt: null, issuedTo: null, daysLeft: null };
  if (t.status === "expired")
    return {
      kind: "expired",
      expiresAt: t.record.expiresAt,
      issuedTo: t.record.issuedTo,
      daysLeft: 0
    };
  if (!t.record.expiresAt)
    return null;
  const r = xm(t.record.expiresAt, e);
  return r > Om ? null : {
    kind: "expiring",
    expiresAt: t.record.expiresAt,
    issuedTo: t.record.issuedTo,
    daysLeft: Math.max(0, Math.ceil(r))
  };
}
function Um() {
  const e = Am(), t = [];
  for (const r of e)
    try {
      t.push(...Wl(r));
    } catch (i) {
      console.error("[daily-reminders] restock failed", r, i);
    }
  return t.sort((r, i) => r.daysLeft - i.daysLeft || r.stockQty - i.stockQty), t;
}
function Pm(e) {
  for (const t of Gr.getAllWindows())
    t.isDestroyed() || t.webContents.send(A.REMINDERS_DAILY, e);
}
function Bm(e = /* @__PURE__ */ new Date()) {
  const t = Um(), r = Dm(e), i = {
    date: km(e),
    at: e.toISOString(),
    restock: t,
    license: r
  };
  return Pm(i), i;
}
function Fm() {
  if (ms) return { ran: !1 };
  ms = !0;
  try {
    return Bm(), { ran: !0 };
  } catch (e) {
    return console.error("[daily-reminders] failed", e), { ran: !1 };
  } finally {
    ms = !1;
  }
}
function Vi(e, t = 4) {
  const r = e.trim().split(/\s+/).map((i) => i.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean);
  return r.length === 0 ? "X" : r.length >= 2 ? r.map((s) => s[0] ?? "").join("").toUpperCase().slice(0, t) || "X" : r[0].toUpperCase().slice(0, Math.min(3, t)) || "X";
}
function Mm(e, t, r) {
  const i = Vi(e), s = Vi(t);
  return `KB-${i}-${s}-${r}`;
}
function $m(e, t) {
  return `KB-${Vi(e)}-${Vi(t)}-`;
}
function Hm(e, t) {
  if (!e.startsWith(t)) return null;
  const r = Number.parseInt(e.slice(t.length), 10);
  return Number.isFinite(r) && r > 0 ? r : null;
}
var At = {}, zl = function() {
  return typeof Promise == "function" && Promise.prototype && Promise.prototype.then;
}, wa = {}, Ce = {};
let Sa;
const Xm = [
  0,
  // Not used
  26,
  44,
  70,
  100,
  134,
  172,
  196,
  242,
  292,
  346,
  404,
  466,
  532,
  581,
  655,
  733,
  815,
  901,
  991,
  1085,
  1156,
  1258,
  1364,
  1474,
  1588,
  1706,
  1828,
  1921,
  2051,
  2185,
  2323,
  2465,
  2611,
  2761,
  2876,
  3034,
  3196,
  3362,
  3532,
  3706
];
Ce.getSymbolSize = function(t) {
  if (!t) throw new Error('"version" cannot be null or undefined');
  if (t < 1 || t > 40) throw new Error('"version" should be in range from 1 to 40');
  return t * 4 + 17;
};
Ce.getSymbolTotalCodewords = function(t) {
  return Xm[t];
};
Ce.getBCHDigit = function(e) {
  let t = 0;
  for (; e !== 0; )
    t++, e >>>= 1;
  return t;
};
Ce.setToSJISFunction = function(t) {
  if (typeof t != "function")
    throw new Error('"toSJISFunc" is not a valid function.');
  Sa = t;
};
Ce.isKanjiModeEnabled = function() {
  return typeof Sa < "u";
};
Ce.toSJIS = function(t) {
  return Sa(t);
};
var vn = {};
(function(e) {
  e.L = { bit: 1 }, e.M = { bit: 0 }, e.Q = { bit: 3 }, e.H = { bit: 2 };
  function t(r) {
    if (typeof r != "string")
      throw new Error("Param is not a string");
    switch (r.toLowerCase()) {
      case "l":
      case "low":
        return e.L;
      case "m":
      case "medium":
        return e.M;
      case "q":
      case "quartile":
        return e.Q;
      case "h":
      case "high":
        return e.H;
      default:
        throw new Error("Unknown EC Level: " + r);
    }
  }
  e.isValid = function(i) {
    return i && typeof i.bit < "u" && i.bit >= 0 && i.bit < 4;
  }, e.from = function(i, s) {
    if (e.isValid(i))
      return i;
    try {
      return t(i);
    } catch {
      return s;
    }
  };
})(vn);
function ql() {
  this.buffer = [], this.length = 0;
}
ql.prototype = {
  get: function(e) {
    const t = Math.floor(e / 8);
    return (this.buffer[t] >>> 7 - e % 8 & 1) === 1;
  },
  put: function(e, t) {
    for (let r = 0; r < t; r++)
      this.putBit((e >>> t - r - 1 & 1) === 1);
  },
  getLengthInBits: function() {
    return this.length;
  },
  putBit: function(e) {
    const t = Math.floor(this.length / 8);
    this.buffer.length <= t && this.buffer.push(0), e && (this.buffer[t] |= 128 >>> this.length % 8), this.length++;
  }
};
var Wm = ql;
function ci(e) {
  if (!e || e < 1)
    throw new Error("BitMatrix size must be defined and greater than 0");
  this.size = e, this.data = new Uint8Array(e * e), this.reservedBit = new Uint8Array(e * e);
}
ci.prototype.set = function(e, t, r, i) {
  const s = e * this.size + t;
  this.data[s] = r, i && (this.reservedBit[s] = !0);
};
ci.prototype.get = function(e, t) {
  return this.data[e * this.size + t];
};
ci.prototype.xor = function(e, t, r) {
  this.data[e * this.size + t] ^= r;
};
ci.prototype.isReserved = function(e, t) {
  return this.reservedBit[e * this.size + t];
};
var zm = ci, Kl = {};
(function(e) {
  const t = Ce.getSymbolSize;
  e.getRowColCoords = function(i) {
    if (i === 1) return [];
    const s = Math.floor(i / 7) + 2, n = t(i), a = n === 145 ? 26 : Math.ceil((n - 13) / (2 * s - 2)) * 2, o = [n - 7];
    for (let c = 1; c < s - 1; c++)
      o[c] = o[c - 1] - a;
    return o.push(6), o.reverse();
  }, e.getPositions = function(i) {
    const s = [], n = e.getRowColCoords(i), a = n.length;
    for (let o = 0; o < a; o++)
      for (let c = 0; c < a; c++)
        o === 0 && c === 0 || // top-left
        o === 0 && c === a - 1 || // bottom-left
        o === a - 1 && c === 0 || s.push([n[o], n[c]]);
    return s;
  };
})(Kl);
var Yl = {};
const qm = Ce.getSymbolSize, mc = 7;
Yl.getPositions = function(t) {
  const r = qm(t);
  return [
    // top-left
    [0, 0],
    // top-right
    [r - mc, 0],
    // bottom-left
    [0, r - mc]
  ];
};
var jl = {};
(function(e) {
  e.Patterns = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  };
  const t = {
    N1: 3,
    N2: 3,
    N3: 40,
    N4: 10
  };
  e.isValid = function(s) {
    return s != null && s !== "" && !isNaN(s) && s >= 0 && s <= 7;
  }, e.from = function(s) {
    return e.isValid(s) ? parseInt(s, 10) : void 0;
  }, e.getPenaltyN1 = function(s) {
    const n = s.size;
    let a = 0, o = 0, c = 0, u = null, l = null;
    for (let p = 0; p < n; p++) {
      o = c = 0, u = l = null;
      for (let d = 0; d < n; d++) {
        let f = s.get(p, d);
        f === u ? o++ : (o >= 5 && (a += t.N1 + (o - 5)), u = f, o = 1), f = s.get(d, p), f === l ? c++ : (c >= 5 && (a += t.N1 + (c - 5)), l = f, c = 1);
      }
      o >= 5 && (a += t.N1 + (o - 5)), c >= 5 && (a += t.N1 + (c - 5));
    }
    return a;
  }, e.getPenaltyN2 = function(s) {
    const n = s.size;
    let a = 0;
    for (let o = 0; o < n - 1; o++)
      for (let c = 0; c < n - 1; c++) {
        const u = s.get(o, c) + s.get(o, c + 1) + s.get(o + 1, c) + s.get(o + 1, c + 1);
        (u === 4 || u === 0) && a++;
      }
    return a * t.N2;
  }, e.getPenaltyN3 = function(s) {
    const n = s.size;
    let a = 0, o = 0, c = 0;
    for (let u = 0; u < n; u++) {
      o = c = 0;
      for (let l = 0; l < n; l++)
        o = o << 1 & 2047 | s.get(u, l), l >= 10 && (o === 1488 || o === 93) && a++, c = c << 1 & 2047 | s.get(l, u), l >= 10 && (c === 1488 || c === 93) && a++;
    }
    return a * t.N3;
  }, e.getPenaltyN4 = function(s) {
    let n = 0;
    const a = s.data.length;
    for (let c = 0; c < a; c++) n += s.data[c];
    return Math.abs(Math.ceil(n * 100 / a / 5) - 10) * t.N4;
  };
  function r(i, s, n) {
    switch (i) {
      case e.Patterns.PATTERN000:
        return (s + n) % 2 === 0;
      case e.Patterns.PATTERN001:
        return s % 2 === 0;
      case e.Patterns.PATTERN010:
        return n % 3 === 0;
      case e.Patterns.PATTERN011:
        return (s + n) % 3 === 0;
      case e.Patterns.PATTERN100:
        return (Math.floor(s / 2) + Math.floor(n / 3)) % 2 === 0;
      case e.Patterns.PATTERN101:
        return s * n % 2 + s * n % 3 === 0;
      case e.Patterns.PATTERN110:
        return (s * n % 2 + s * n % 3) % 2 === 0;
      case e.Patterns.PATTERN111:
        return (s * n % 3 + (s + n) % 2) % 2 === 0;
      default:
        throw new Error("bad maskPattern:" + i);
    }
  }
  e.applyMask = function(s, n) {
    const a = n.size;
    for (let o = 0; o < a; o++)
      for (let c = 0; c < a; c++)
        n.isReserved(c, o) || n.xor(c, o, r(s, c, o));
  }, e.getBestMask = function(s, n) {
    const a = Object.keys(e.Patterns).length;
    let o = 0, c = 1 / 0;
    for (let u = 0; u < a; u++) {
      n(u), e.applyMask(u, s);
      const l = e.getPenaltyN1(s) + e.getPenaltyN2(s) + e.getPenaltyN3(s) + e.getPenaltyN4(s);
      e.applyMask(u, s), l < c && (c = l, o = u);
    }
    return o;
  };
})(jl);
var yn = {};
const Rt = vn, ki = [
  // L  M  Q  H
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  2,
  2,
  1,
  2,
  2,
  4,
  1,
  2,
  4,
  4,
  2,
  4,
  4,
  4,
  2,
  4,
  6,
  5,
  2,
  4,
  6,
  6,
  2,
  5,
  8,
  8,
  4,
  5,
  8,
  8,
  4,
  5,
  8,
  11,
  4,
  8,
  10,
  11,
  4,
  9,
  12,
  16,
  4,
  9,
  16,
  16,
  6,
  10,
  12,
  18,
  6,
  10,
  17,
  16,
  6,
  11,
  16,
  19,
  6,
  13,
  18,
  21,
  7,
  14,
  21,
  25,
  8,
  16,
  20,
  25,
  8,
  17,
  23,
  25,
  9,
  17,
  23,
  34,
  9,
  18,
  25,
  30,
  10,
  20,
  27,
  32,
  12,
  21,
  29,
  35,
  12,
  23,
  34,
  37,
  12,
  25,
  34,
  40,
  13,
  26,
  35,
  42,
  14,
  28,
  38,
  45,
  15,
  29,
  40,
  48,
  16,
  31,
  43,
  51,
  17,
  33,
  45,
  54,
  18,
  35,
  48,
  57,
  19,
  37,
  51,
  60,
  19,
  38,
  53,
  63,
  20,
  40,
  56,
  66,
  21,
  43,
  59,
  70,
  22,
  45,
  62,
  74,
  24,
  47,
  65,
  77,
  25,
  49,
  68,
  81
], xi = [
  // L  M  Q  H
  7,
  10,
  13,
  17,
  10,
  16,
  22,
  28,
  15,
  26,
  36,
  44,
  20,
  36,
  52,
  64,
  26,
  48,
  72,
  88,
  36,
  64,
  96,
  112,
  40,
  72,
  108,
  130,
  48,
  88,
  132,
  156,
  60,
  110,
  160,
  192,
  72,
  130,
  192,
  224,
  80,
  150,
  224,
  264,
  96,
  176,
  260,
  308,
  104,
  198,
  288,
  352,
  120,
  216,
  320,
  384,
  132,
  240,
  360,
  432,
  144,
  280,
  408,
  480,
  168,
  308,
  448,
  532,
  180,
  338,
  504,
  588,
  196,
  364,
  546,
  650,
  224,
  416,
  600,
  700,
  224,
  442,
  644,
  750,
  252,
  476,
  690,
  816,
  270,
  504,
  750,
  900,
  300,
  560,
  810,
  960,
  312,
  588,
  870,
  1050,
  336,
  644,
  952,
  1110,
  360,
  700,
  1020,
  1200,
  390,
  728,
  1050,
  1260,
  420,
  784,
  1140,
  1350,
  450,
  812,
  1200,
  1440,
  480,
  868,
  1290,
  1530,
  510,
  924,
  1350,
  1620,
  540,
  980,
  1440,
  1710,
  570,
  1036,
  1530,
  1800,
  570,
  1064,
  1590,
  1890,
  600,
  1120,
  1680,
  1980,
  630,
  1204,
  1770,
  2100,
  660,
  1260,
  1860,
  2220,
  720,
  1316,
  1950,
  2310,
  750,
  1372,
  2040,
  2430
];
yn.getBlocksCount = function(t, r) {
  switch (r) {
    case Rt.L:
      return ki[(t - 1) * 4 + 0];
    case Rt.M:
      return ki[(t - 1) * 4 + 1];
    case Rt.Q:
      return ki[(t - 1) * 4 + 2];
    case Rt.H:
      return ki[(t - 1) * 4 + 3];
    default:
      return;
  }
};
yn.getTotalCodewordsCount = function(t, r) {
  switch (r) {
    case Rt.L:
      return xi[(t - 1) * 4 + 0];
    case Rt.M:
      return xi[(t - 1) * 4 + 1];
    case Rt.Q:
      return xi[(t - 1) * 4 + 2];
    case Rt.H:
      return xi[(t - 1) * 4 + 3];
    default:
      return;
  }
};
var Gl = {}, wn = {};
const Hr = new Uint8Array(512), Zi = new Uint8Array(256);
(function() {
  let t = 1;
  for (let r = 0; r < 255; r++)
    Hr[r] = t, Zi[t] = r, t <<= 1, t & 256 && (t ^= 285);
  for (let r = 255; r < 512; r++)
    Hr[r] = Hr[r - 255];
})();
wn.log = function(t) {
  if (t < 1) throw new Error("log(" + t + ")");
  return Zi[t];
};
wn.exp = function(t) {
  return Hr[t];
};
wn.mul = function(t, r) {
  return t === 0 || r === 0 ? 0 : Hr[Zi[t] + Zi[r]];
};
(function(e) {
  const t = wn;
  e.mul = function(i, s) {
    const n = new Uint8Array(i.length + s.length - 1);
    for (let a = 0; a < i.length; a++)
      for (let o = 0; o < s.length; o++)
        n[a + o] ^= t.mul(i[a], s[o]);
    return n;
  }, e.mod = function(i, s) {
    let n = new Uint8Array(i);
    for (; n.length - s.length >= 0; ) {
      const a = n[0];
      for (let c = 0; c < s.length; c++)
        n[c] ^= t.mul(s[c], a);
      let o = 0;
      for (; o < n.length && n[o] === 0; ) o++;
      n = n.slice(o);
    }
    return n;
  }, e.generateECPolynomial = function(i) {
    let s = new Uint8Array([1]);
    for (let n = 0; n < i; n++)
      s = e.mul(s, new Uint8Array([1, t.exp(n)]));
    return s;
  };
})(Gl);
const Vl = Gl;
function Ra(e) {
  this.genPoly = void 0, this.degree = e, this.degree && this.initialize(this.degree);
}
Ra.prototype.initialize = function(t) {
  this.degree = t, this.genPoly = Vl.generateECPolynomial(this.degree);
};
Ra.prototype.encode = function(t) {
  if (!this.genPoly)
    throw new Error("Encoder not initialized");
  const r = new Uint8Array(t.length + this.degree);
  r.set(t);
  const i = Vl.mod(r, this.genPoly), s = this.degree - i.length;
  if (s > 0) {
    const n = new Uint8Array(this.degree);
    return n.set(i, s), n;
  }
  return i;
};
var Km = Ra, Zl = {}, Ct = {}, Na = {};
Na.isValid = function(t) {
  return !isNaN(t) && t >= 1 && t <= 40;
};
var it = {};
const Jl = "[0-9]+", Ym = "[A-Z $%*+\\-./:]+";
let Yr = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
Yr = Yr.replace(/u/g, "\\u");
const jm = "(?:(?![A-Z0-9 $%*+\\-./:]|" + Yr + `)(?:.|[\r
]))+`;
it.KANJI = new RegExp(Yr, "g");
it.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
it.BYTE = new RegExp(jm, "g");
it.NUMERIC = new RegExp(Jl, "g");
it.ALPHANUMERIC = new RegExp(Ym, "g");
const Gm = new RegExp("^" + Yr + "$"), Vm = new RegExp("^" + Jl + "$"), Zm = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
it.testKanji = function(t) {
  return Gm.test(t);
};
it.testNumeric = function(t) {
  return Vm.test(t);
};
it.testAlphanumeric = function(t) {
  return Zm.test(t);
};
(function(e) {
  const t = Na, r = it;
  e.NUMERIC = {
    id: "Numeric",
    bit: 1,
    ccBits: [10, 12, 14]
  }, e.ALPHANUMERIC = {
    id: "Alphanumeric",
    bit: 2,
    ccBits: [9, 11, 13]
  }, e.BYTE = {
    id: "Byte",
    bit: 4,
    ccBits: [8, 16, 16]
  }, e.KANJI = {
    id: "Kanji",
    bit: 8,
    ccBits: [8, 10, 12]
  }, e.MIXED = {
    bit: -1
  }, e.getCharCountIndicator = function(n, a) {
    if (!n.ccBits) throw new Error("Invalid mode: " + n);
    if (!t.isValid(a))
      throw new Error("Invalid version: " + a);
    return a >= 1 && a < 10 ? n.ccBits[0] : a < 27 ? n.ccBits[1] : n.ccBits[2];
  }, e.getBestModeForData = function(n) {
    return r.testNumeric(n) ? e.NUMERIC : r.testAlphanumeric(n) ? e.ALPHANUMERIC : r.testKanji(n) ? e.KANJI : e.BYTE;
  }, e.toString = function(n) {
    if (n && n.id) return n.id;
    throw new Error("Invalid mode");
  }, e.isValid = function(n) {
    return n && n.bit && n.ccBits;
  };
  function i(s) {
    if (typeof s != "string")
      throw new Error("Param is not a string");
    switch (s.toLowerCase()) {
      case "numeric":
        return e.NUMERIC;
      case "alphanumeric":
        return e.ALPHANUMERIC;
      case "kanji":
        return e.KANJI;
      case "byte":
        return e.BYTE;
      default:
        throw new Error("Unknown mode: " + s);
    }
  }
  e.from = function(n, a) {
    if (e.isValid(n))
      return n;
    try {
      return i(n);
    } catch {
      return a;
    }
  };
})(Ct);
(function(e) {
  const t = Ce, r = yn, i = vn, s = Ct, n = Na, a = 7973, o = t.getBCHDigit(a);
  function c(d, f, _) {
    for (let E = 1; E <= 40; E++)
      if (f <= e.getCapacity(E, _, d))
        return E;
  }
  function u(d, f) {
    return s.getCharCountIndicator(d, f) + 4;
  }
  function l(d, f) {
    let _ = 0;
    return d.forEach(function(E) {
      const w = u(E.mode, f);
      _ += w + E.getBitsLength();
    }), _;
  }
  function p(d, f) {
    for (let _ = 1; _ <= 40; _++)
      if (l(d, _) <= e.getCapacity(_, f, s.MIXED))
        return _;
  }
  e.from = function(f, _) {
    return n.isValid(f) ? parseInt(f, 10) : _;
  }, e.getCapacity = function(f, _, E) {
    if (!n.isValid(f))
      throw new Error("Invalid QR Code version");
    typeof E > "u" && (E = s.BYTE);
    const w = t.getSymbolTotalCodewords(f), h = r.getTotalCodewordsCount(f, _), m = (w - h) * 8;
    if (E === s.MIXED) return m;
    const b = m - u(E, f);
    switch (E) {
      case s.NUMERIC:
        return Math.floor(b / 10 * 3);
      case s.ALPHANUMERIC:
        return Math.floor(b / 11 * 2);
      case s.KANJI:
        return Math.floor(b / 13);
      case s.BYTE:
      default:
        return Math.floor(b / 8);
    }
  }, e.getBestVersionForData = function(f, _) {
    let E;
    const w = i.from(_, i.M);
    if (Array.isArray(f)) {
      if (f.length > 1)
        return p(f, w);
      if (f.length === 0)
        return 1;
      E = f[0];
    } else
      E = f;
    return c(E.mode, E.getLength(), w);
  }, e.getEncodedBits = function(f) {
    if (!n.isValid(f) || f < 7)
      throw new Error("Invalid QR Code version");
    let _ = f << 12;
    for (; t.getBCHDigit(_) - o >= 0; )
      _ ^= a << t.getBCHDigit(_) - o;
    return f << 12 | _;
  };
})(Zl);
var Ql = {};
const Xs = Ce, ed = 1335, Jm = 21522, Tc = Xs.getBCHDigit(ed);
Ql.getEncodedBits = function(t, r) {
  const i = t.bit << 3 | r;
  let s = i << 10;
  for (; Xs.getBCHDigit(s) - Tc >= 0; )
    s ^= ed << Xs.getBCHDigit(s) - Tc;
  return (i << 10 | s) ^ Jm;
};
var td = {};
const Qm = Ct;
function pr(e) {
  this.mode = Qm.NUMERIC, this.data = e.toString();
}
pr.getBitsLength = function(t) {
  return 10 * Math.floor(t / 3) + (t % 3 ? t % 3 * 3 + 1 : 0);
};
pr.prototype.getLength = function() {
  return this.data.length;
};
pr.prototype.getBitsLength = function() {
  return pr.getBitsLength(this.data.length);
};
pr.prototype.write = function(t) {
  let r, i, s;
  for (r = 0; r + 3 <= this.data.length; r += 3)
    i = this.data.substr(r, 3), s = parseInt(i, 10), t.put(s, 10);
  const n = this.data.length - r;
  n > 0 && (i = this.data.substr(r), s = parseInt(i, 10), t.put(s, n * 3 + 1));
};
var eT = pr;
const tT = Ct, Ts = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  " ",
  "$",
  "%",
  "*",
  "+",
  "-",
  ".",
  "/",
  ":"
];
function _r(e) {
  this.mode = tT.ALPHANUMERIC, this.data = e;
}
_r.getBitsLength = function(t) {
  return 11 * Math.floor(t / 2) + 6 * (t % 2);
};
_r.prototype.getLength = function() {
  return this.data.length;
};
_r.prototype.getBitsLength = function() {
  return _r.getBitsLength(this.data.length);
};
_r.prototype.write = function(t) {
  let r;
  for (r = 0; r + 2 <= this.data.length; r += 2) {
    let i = Ts.indexOf(this.data[r]) * 45;
    i += Ts.indexOf(this.data[r + 1]), t.put(i, 11);
  }
  this.data.length % 2 && t.put(Ts.indexOf(this.data[r]), 6);
};
var rT = _r;
const iT = Ct;
function Er(e) {
  this.mode = iT.BYTE, typeof e == "string" ? this.data = new TextEncoder().encode(e) : this.data = new Uint8Array(e);
}
Er.getBitsLength = function(t) {
  return t * 8;
};
Er.prototype.getLength = function() {
  return this.data.length;
};
Er.prototype.getBitsLength = function() {
  return Er.getBitsLength(this.data.length);
};
Er.prototype.write = function(e) {
  for (let t = 0, r = this.data.length; t < r; t++)
    e.put(this.data[t], 8);
};
var nT = Er;
const sT = Ct, aT = Ce;
function mr(e) {
  this.mode = sT.KANJI, this.data = e;
}
mr.getBitsLength = function(t) {
  return t * 13;
};
mr.prototype.getLength = function() {
  return this.data.length;
};
mr.prototype.getBitsLength = function() {
  return mr.getBitsLength(this.data.length);
};
mr.prototype.write = function(e) {
  let t;
  for (t = 0; t < this.data.length; t++) {
    let r = aT.toSJIS(this.data[t]);
    if (r >= 33088 && r <= 40956)
      r -= 33088;
    else if (r >= 57408 && r <= 60351)
      r -= 49472;
    else
      throw new Error(
        "Invalid SJIS character: " + this.data[t] + `
Make sure your charset is UTF-8`
      );
    r = (r >>> 8 & 255) * 192 + (r & 255), e.put(r, 13);
  }
};
var oT = mr, rd = { exports: {} };
(function(e) {
  var t = {
    single_source_shortest_paths: function(r, i, s) {
      var n = {}, a = {};
      a[i] = 0;
      var o = t.PriorityQueue.make();
      o.push(i, 0);
      for (var c, u, l, p, d, f, _, E, w; !o.empty(); ) {
        c = o.pop(), u = c.value, p = c.cost, d = r[u] || {};
        for (l in d)
          d.hasOwnProperty(l) && (f = d[l], _ = p + f, E = a[l], w = typeof a[l] > "u", (w || E > _) && (a[l] = _, o.push(l, _), n[l] = u));
      }
      if (typeof s < "u" && typeof a[s] > "u") {
        var h = ["Could not find a path from ", i, " to ", s, "."].join("");
        throw new Error(h);
      }
      return n;
    },
    extract_shortest_path_from_predecessor_list: function(r, i) {
      for (var s = [], n = i; n; )
        s.push(n), r[n], n = r[n];
      return s.reverse(), s;
    },
    find_path: function(r, i, s) {
      var n = t.single_source_shortest_paths(r, i, s);
      return t.extract_shortest_path_from_predecessor_list(
        n,
        s
      );
    },
    /**
     * A very naive priority queue implementation.
     */
    PriorityQueue: {
      make: function(r) {
        var i = t.PriorityQueue, s = {}, n;
        r = r || {};
        for (n in i)
          i.hasOwnProperty(n) && (s[n] = i[n]);
        return s.queue = [], s.sorter = r.sorter || i.default_sorter, s;
      },
      default_sorter: function(r, i) {
        return r.cost - i.cost;
      },
      /**
       * Add a new item to the queue and ensure the highest priority element
       * is at the front of the queue.
       */
      push: function(r, i) {
        var s = { value: r, cost: i };
        this.queue.push(s), this.queue.sort(this.sorter);
      },
      /**
       * Return the highest priority element in the queue.
       */
      pop: function() {
        return this.queue.shift();
      },
      empty: function() {
        return this.queue.length === 0;
      }
    }
  };
  e.exports = t;
})(rd);
var cT = rd.exports;
(function(e) {
  const t = Ct, r = eT, i = rT, s = nT, n = oT, a = it, o = Ce, c = cT;
  function u(h) {
    return unescape(encodeURIComponent(h)).length;
  }
  function l(h, m, b) {
    const v = [];
    let S;
    for (; (S = h.exec(b)) !== null; )
      v.push({
        data: S[0],
        index: S.index,
        mode: m,
        length: S[0].length
      });
    return v;
  }
  function p(h) {
    const m = l(a.NUMERIC, t.NUMERIC, h), b = l(a.ALPHANUMERIC, t.ALPHANUMERIC, h);
    let v, S;
    return o.isKanjiModeEnabled() ? (v = l(a.BYTE, t.BYTE, h), S = l(a.KANJI, t.KANJI, h)) : (v = l(a.BYTE_KANJI, t.BYTE, h), S = []), m.concat(b, v, S).sort(function(I, O) {
      return I.index - O.index;
    }).map(function(I) {
      return {
        data: I.data,
        mode: I.mode,
        length: I.length
      };
    });
  }
  function d(h, m) {
    switch (m) {
      case t.NUMERIC:
        return r.getBitsLength(h);
      case t.ALPHANUMERIC:
        return i.getBitsLength(h);
      case t.KANJI:
        return n.getBitsLength(h);
      case t.BYTE:
        return s.getBitsLength(h);
    }
  }
  function f(h) {
    return h.reduce(function(m, b) {
      const v = m.length - 1 >= 0 ? m[m.length - 1] : null;
      return v && v.mode === b.mode ? (m[m.length - 1].data += b.data, m) : (m.push(b), m);
    }, []);
  }
  function _(h) {
    const m = [];
    for (let b = 0; b < h.length; b++) {
      const v = h[b];
      switch (v.mode) {
        case t.NUMERIC:
          m.push([
            v,
            { data: v.data, mode: t.ALPHANUMERIC, length: v.length },
            { data: v.data, mode: t.BYTE, length: v.length }
          ]);
          break;
        case t.ALPHANUMERIC:
          m.push([
            v,
            { data: v.data, mode: t.BYTE, length: v.length }
          ]);
          break;
        case t.KANJI:
          m.push([
            v,
            { data: v.data, mode: t.BYTE, length: u(v.data) }
          ]);
          break;
        case t.BYTE:
          m.push([
            { data: v.data, mode: t.BYTE, length: u(v.data) }
          ]);
      }
    }
    return m;
  }
  function E(h, m) {
    const b = {}, v = { start: {} };
    let S = ["start"];
    for (let L = 0; L < h.length; L++) {
      const I = h[L], O = [];
      for (let P = 0; P < I.length; P++) {
        const H = I[P], D = "" + L + P;
        O.push(D), b[D] = { node: H, lastCount: 0 }, v[D] = {};
        for (let B = 0; B < S.length; B++) {
          const q = S[B];
          b[q] && b[q].node.mode === H.mode ? (v[q][D] = d(b[q].lastCount + H.length, H.mode) - d(b[q].lastCount, H.mode), b[q].lastCount += H.length) : (b[q] && (b[q].lastCount = H.length), v[q][D] = d(H.length, H.mode) + 4 + t.getCharCountIndicator(H.mode, m));
        }
      }
      S = O;
    }
    for (let L = 0; L < S.length; L++)
      v[S[L]].end = 0;
    return { map: v, table: b };
  }
  function w(h, m) {
    let b;
    const v = t.getBestModeForData(h);
    if (b = t.from(m, v), b !== t.BYTE && b.bit < v.bit)
      throw new Error('"' + h + '" cannot be encoded with mode ' + t.toString(b) + `.
 Suggested mode is: ` + t.toString(v));
    switch (b === t.KANJI && !o.isKanjiModeEnabled() && (b = t.BYTE), b) {
      case t.NUMERIC:
        return new r(h);
      case t.ALPHANUMERIC:
        return new i(h);
      case t.KANJI:
        return new n(h);
      case t.BYTE:
        return new s(h);
    }
  }
  e.fromArray = function(m) {
    return m.reduce(function(b, v) {
      return typeof v == "string" ? b.push(w(v, null)) : v.data && b.push(w(v.data, v.mode)), b;
    }, []);
  }, e.fromString = function(m, b) {
    const v = p(m, o.isKanjiModeEnabled()), S = _(v), L = E(S, b), I = c.find_path(L.map, "start", "end"), O = [];
    for (let P = 1; P < I.length - 1; P++)
      O.push(L.table[I[P]].node);
    return e.fromArray(f(O));
  }, e.rawSplit = function(m) {
    return e.fromArray(
      p(m, o.isKanjiModeEnabled())
    );
  };
})(td);
const Sn = Ce, gs = vn, uT = Wm, lT = zm, dT = Kl, fT = Yl, Ws = jl, zs = yn, hT = Km, Ji = Zl, pT = Ql, _T = Ct, bs = td;
function ET(e, t) {
  const r = e.size, i = fT.getPositions(t);
  for (let s = 0; s < i.length; s++) {
    const n = i[s][0], a = i[s][1];
    for (let o = -1; o <= 7; o++)
      if (!(n + o <= -1 || r <= n + o))
        for (let c = -1; c <= 7; c++)
          a + c <= -1 || r <= a + c || (o >= 0 && o <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (o === 0 || o === 6) || o >= 2 && o <= 4 && c >= 2 && c <= 4 ? e.set(n + o, a + c, !0, !0) : e.set(n + o, a + c, !1, !0));
  }
}
function mT(e) {
  const t = e.size;
  for (let r = 8; r < t - 8; r++) {
    const i = r % 2 === 0;
    e.set(r, 6, i, !0), e.set(6, r, i, !0);
  }
}
function TT(e, t) {
  const r = dT.getPositions(t);
  for (let i = 0; i < r.length; i++) {
    const s = r[i][0], n = r[i][1];
    for (let a = -2; a <= 2; a++)
      for (let o = -2; o <= 2; o++)
        a === -2 || a === 2 || o === -2 || o === 2 || a === 0 && o === 0 ? e.set(s + a, n + o, !0, !0) : e.set(s + a, n + o, !1, !0);
  }
}
function gT(e, t) {
  const r = e.size, i = Ji.getEncodedBits(t);
  let s, n, a;
  for (let o = 0; o < 18; o++)
    s = Math.floor(o / 3), n = o % 3 + r - 8 - 3, a = (i >> o & 1) === 1, e.set(s, n, a, !0), e.set(n, s, a, !0);
}
function vs(e, t, r) {
  const i = e.size, s = pT.getEncodedBits(t, r);
  let n, a;
  for (n = 0; n < 15; n++)
    a = (s >> n & 1) === 1, n < 6 ? e.set(n, 8, a, !0) : n < 8 ? e.set(n + 1, 8, a, !0) : e.set(i - 15 + n, 8, a, !0), n < 8 ? e.set(8, i - n - 1, a, !0) : n < 9 ? e.set(8, 15 - n - 1 + 1, a, !0) : e.set(8, 15 - n - 1, a, !0);
  e.set(i - 8, 8, 1, !0);
}
function bT(e, t) {
  const r = e.size;
  let i = -1, s = r - 1, n = 7, a = 0;
  for (let o = r - 1; o > 0; o -= 2)
    for (o === 6 && o--; ; ) {
      for (let c = 0; c < 2; c++)
        if (!e.isReserved(s, o - c)) {
          let u = !1;
          a < t.length && (u = (t[a] >>> n & 1) === 1), e.set(s, o - c, u), n--, n === -1 && (a++, n = 7);
        }
      if (s += i, s < 0 || r <= s) {
        s -= i, i = -i;
        break;
      }
    }
}
function vT(e, t, r) {
  const i = new uT();
  r.forEach(function(c) {
    i.put(c.mode.bit, 4), i.put(c.getLength(), _T.getCharCountIndicator(c.mode, e)), c.write(i);
  });
  const s = Sn.getSymbolTotalCodewords(e), n = zs.getTotalCodewordsCount(e, t), a = (s - n) * 8;
  for (i.getLengthInBits() + 4 <= a && i.put(0, 4); i.getLengthInBits() % 8 !== 0; )
    i.putBit(0);
  const o = (a - i.getLengthInBits()) / 8;
  for (let c = 0; c < o; c++)
    i.put(c % 2 ? 17 : 236, 8);
  return yT(i, e, t);
}
function yT(e, t, r) {
  const i = Sn.getSymbolTotalCodewords(t), s = zs.getTotalCodewordsCount(t, r), n = i - s, a = zs.getBlocksCount(t, r), o = i % a, c = a - o, u = Math.floor(i / a), l = Math.floor(n / a), p = l + 1, d = u - l, f = new hT(d);
  let _ = 0;
  const E = new Array(a), w = new Array(a);
  let h = 0;
  const m = new Uint8Array(e.buffer);
  for (let I = 0; I < a; I++) {
    const O = I < c ? l : p;
    E[I] = m.slice(_, _ + O), w[I] = f.encode(E[I]), _ += O, h = Math.max(h, O);
  }
  const b = new Uint8Array(i);
  let v = 0, S, L;
  for (S = 0; S < h; S++)
    for (L = 0; L < a; L++)
      S < E[L].length && (b[v++] = E[L][S]);
  for (S = 0; S < d; S++)
    for (L = 0; L < a; L++)
      b[v++] = w[L][S];
  return b;
}
function wT(e, t, r, i) {
  let s;
  if (Array.isArray(e))
    s = bs.fromArray(e);
  else if (typeof e == "string") {
    let u = t;
    if (!u) {
      const l = bs.rawSplit(e);
      u = Ji.getBestVersionForData(l, r);
    }
    s = bs.fromString(e, u || 40);
  } else
    throw new Error("Invalid data");
  const n = Ji.getBestVersionForData(s, r);
  if (!n)
    throw new Error("The amount of data is too big to be stored in a QR Code");
  if (!t)
    t = n;
  else if (t < n)
    throw new Error(
      `
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: ` + n + `.
`
    );
  const a = vT(t, r, s), o = Sn.getSymbolSize(t), c = new lT(o);
  return ET(c, t), mT(c), TT(c, t), vs(c, r, 0), t >= 7 && gT(c, t), bT(c, a), isNaN(i) && (i = Ws.getBestMask(
    c,
    vs.bind(null, c, r)
  )), Ws.applyMask(i, c), vs(c, r, i), {
    modules: c,
    version: t,
    errorCorrectionLevel: r,
    maskPattern: i,
    segments: s
  };
}
wa.create = function(t, r) {
  if (typeof t > "u" || t === "")
    throw new Error("No input text");
  let i = gs.M, s, n;
  return typeof r < "u" && (i = gs.from(r.errorCorrectionLevel, gs.M), s = Ji.from(r.version), n = Ws.from(r.maskPattern), r.toSJISFunc && Sn.setToSJISFunction(r.toSJISFunc)), wT(t, s, i, n);
};
var id = {}, nd = {}, sd = { exports: {} }, ad = { exports: {} };
let ST = lt, od = Vr, qe = ad.exports = function() {
  od.call(this), this._buffers = [], this._buffered = 0, this._reads = [], this._paused = !1, this._encoding = "utf8", this.writable = !0;
};
ST.inherits(qe, od);
qe.prototype.read = function(e, t) {
  this._reads.push({
    length: Math.abs(e),
    // if length < 0 then at most this length
    allowLess: e < 0,
    func: t
  }), process.nextTick(
    (function() {
      this._process(), this._paused && this._reads && this._reads.length > 0 && (this._paused = !1, this.emit("drain"));
    }).bind(this)
  );
};
qe.prototype.write = function(e, t) {
  if (!this.writable)
    return this.emit("error", new Error("Stream not writable")), !1;
  let r;
  return Buffer.isBuffer(e) ? r = e : r = Buffer.from(e, t || this._encoding), this._buffers.push(r), this._buffered += r.length, this._process(), this._reads && this._reads.length === 0 && (this._paused = !0), this.writable && !this._paused;
};
qe.prototype.end = function(e, t) {
  e && this.write(e, t), this.writable = !1, this._buffers && (this._buffers.length === 0 ? this._end() : (this._buffers.push(null), this._process()));
};
qe.prototype.destroySoon = qe.prototype.end;
qe.prototype._end = function() {
  this._reads.length > 0 && this.emit("error", new Error("Unexpected end of input")), this.destroy();
};
qe.prototype.destroy = function() {
  this._buffers && (this.writable = !1, this._reads = null, this._buffers = null, this.emit("close"));
};
qe.prototype._processReadAllowingLess = function(e) {
  this._reads.shift();
  let t = this._buffers[0];
  t.length > e.length ? (this._buffered -= e.length, this._buffers[0] = t.slice(e.length), e.func.call(this, t.slice(0, e.length))) : (this._buffered -= t.length, this._buffers.shift(), e.func.call(this, t));
};
qe.prototype._processRead = function(e) {
  this._reads.shift();
  let t = 0, r = 0, i = Buffer.alloc(e.length);
  for (; t < e.length; ) {
    let s = this._buffers[r++], n = Math.min(s.length, e.length - t);
    s.copy(i, t, 0, n), t += n, n !== s.length && (this._buffers[--r] = s.slice(n));
  }
  r > 0 && this._buffers.splice(0, r), this._buffered -= e.length, e.func.call(this, i);
};
qe.prototype._process = function() {
  try {
    for (; this._buffered > 0 && this._reads && this._reads.length > 0; ) {
      let e = this._reads[0];
      if (e.allowLess)
        this._processReadAllowingLess(e);
      else if (this._buffered >= e.length)
        this._processRead(e);
      else
        break;
    }
    this._buffers && !this.writable && this._end();
  } catch (e) {
    this.emit("error", e);
  }
};
var cd = ad.exports, ud = { exports: {} }, ld = { exports: {} }, Rn = {};
let vt = [
  {
    // pass 1 - 1px
    x: [0],
    y: [0]
  },
  {
    // pass 2 - 1px
    x: [4],
    y: [0]
  },
  {
    // pass 3 - 2px
    x: [0, 4],
    y: [4]
  },
  {
    // pass 4 - 4px
    x: [2, 6],
    y: [0, 4]
  },
  {
    // pass 5 - 8px
    x: [0, 2, 4, 6],
    y: [2, 6]
  },
  {
    // pass 6 - 16px
    x: [1, 3, 5, 7],
    y: [0, 2, 4, 6]
  },
  {
    // pass 7 - 32px
    x: [0, 1, 2, 3, 4, 5, 6, 7],
    y: [1, 3, 5, 7]
  }
];
Rn.getImagePasses = function(e, t) {
  let r = [], i = e % 8, s = t % 8, n = (e - i) / 8, a = (t - s) / 8;
  for (let o = 0; o < vt.length; o++) {
    let c = vt[o], u = n * c.x.length, l = a * c.y.length;
    for (let p = 0; p < c.x.length && c.x[p] < i; p++)
      u++;
    for (let p = 0; p < c.y.length && c.y[p] < s; p++)
      l++;
    u > 0 && l > 0 && r.push({ width: u, height: l, index: o });
  }
  return r;
};
Rn.getInterlaceIterator = function(e) {
  return function(t, r, i) {
    let s = t % vt[i].x.length, n = (t - s) / vt[i].x.length * 8 + vt[i].x[s], a = r % vt[i].y.length, o = (r - a) / vt[i].y.length * 8 + vt[i].y[a];
    return n * 4 + o * e * 4;
  };
};
var dd = function(t, r, i) {
  let s = t + r - i, n = Math.abs(s - t), a = Math.abs(s - r), o = Math.abs(s - i);
  return n <= a && n <= o ? t : a <= o ? r : i;
};
let RT = Rn, NT = dd;
function gc(e, t, r) {
  let i = e * t;
  return r !== 8 && (i = Math.ceil(i / (8 / r))), i;
}
let Lr = ld.exports = function(e, t) {
  let r = e.width, i = e.height, s = e.interlace, n = e.bpp, a = e.depth;
  if (this.read = t.read, this.write = t.write, this.complete = t.complete, this._imageIndex = 0, this._images = [], s) {
    let o = RT.getImagePasses(r, i);
    for (let c = 0; c < o.length; c++)
      this._images.push({
        byteWidth: gc(o[c].width, n, a),
        height: o[c].height,
        lineIndex: 0
      });
  } else
    this._images.push({
      byteWidth: gc(r, n, a),
      height: i,
      lineIndex: 0
    });
  a === 8 ? this._xComparison = n : a === 16 ? this._xComparison = n * 2 : this._xComparison = 1;
};
Lr.prototype.start = function() {
  this.read(
    this._images[this._imageIndex].byteWidth + 1,
    this._reverseFilterLine.bind(this)
  );
};
Lr.prototype._unFilterType1 = function(e, t, r) {
  let i = this._xComparison, s = i - 1;
  for (let n = 0; n < r; n++) {
    let a = e[1 + n], o = n > s ? t[n - i] : 0;
    t[n] = a + o;
  }
};
Lr.prototype._unFilterType2 = function(e, t, r) {
  let i = this._lastLine;
  for (let s = 0; s < r; s++) {
    let n = e[1 + s], a = i ? i[s] : 0;
    t[s] = n + a;
  }
};
Lr.prototype._unFilterType3 = function(e, t, r) {
  let i = this._xComparison, s = i - 1, n = this._lastLine;
  for (let a = 0; a < r; a++) {
    let o = e[1 + a], c = n ? n[a] : 0, u = a > s ? t[a - i] : 0, l = Math.floor((u + c) / 2);
    t[a] = o + l;
  }
};
Lr.prototype._unFilterType4 = function(e, t, r) {
  let i = this._xComparison, s = i - 1, n = this._lastLine;
  for (let a = 0; a < r; a++) {
    let o = e[1 + a], c = n ? n[a] : 0, u = a > s ? t[a - i] : 0, l = a > s && n ? n[a - i] : 0, p = NT(u, c, l);
    t[a] = o + p;
  }
};
Lr.prototype._reverseFilterLine = function(e) {
  let t = e[0], r, i = this._images[this._imageIndex], s = i.byteWidth;
  if (t === 0)
    r = e.slice(1, s + 1);
  else
    switch (r = Buffer.alloc(s), t) {
      case 1:
        this._unFilterType1(e, r, s);
        break;
      case 2:
        this._unFilterType2(e, r, s);
        break;
      case 3:
        this._unFilterType3(e, r, s);
        break;
      case 4:
        this._unFilterType4(e, r, s);
        break;
      default:
        throw new Error("Unrecognised filter type - " + t);
    }
  this.write(r), i.lineIndex++, i.lineIndex >= i.height ? (this._lastLine = null, this._imageIndex++, i = this._images[this._imageIndex]) : this._lastLine = r, i ? this.read(i.byteWidth + 1, this._reverseFilterLine.bind(this)) : (this._lastLine = null, this.complete());
};
var fd = ld.exports;
let IT = lt, hd = cd, LT = fd, AT = ud.exports = function(e) {
  hd.call(this);
  let t = [], r = this;
  this._filter = new LT(e, {
    read: this.read.bind(this),
    write: function(i) {
      t.push(i);
    },
    complete: function() {
      r.emit("complete", Buffer.concat(t));
    }
  }), this._filter.start();
};
IT.inherits(AT, hd);
var CT = ud.exports, pd = { exports: {} }, ui = {
  PNG_SIGNATURE: [137, 80, 78, 71, 13, 10, 26, 10],
  TYPE_IHDR: 1229472850,
  TYPE_IEND: 1229278788,
  TYPE_IDAT: 1229209940,
  TYPE_PLTE: 1347179589,
  TYPE_tRNS: 1951551059,
  // eslint-disable-line camelcase
  TYPE_gAMA: 1732332865,
  // eslint-disable-line camelcase
  // color-type bits
  COLORTYPE_GRAYSCALE: 0,
  COLORTYPE_PALETTE: 1,
  COLORTYPE_COLOR: 2,
  COLORTYPE_ALPHA: 4,
  // e.g. grayscale and alpha
  // color-type combinations
  COLORTYPE_PALETTE_COLOR: 3,
  COLORTYPE_COLOR_ALPHA: 6,
  COLORTYPE_TO_BPP_MAP: {
    0: 1,
    2: 3,
    3: 1,
    4: 2,
    6: 4
  },
  GAMMA_DIVISION: 1e5
}, _d = { exports: {} };
let Ia = [];
(function() {
  for (let e = 0; e < 256; e++) {
    let t = e;
    for (let r = 0; r < 8; r++)
      t & 1 ? t = 3988292384 ^ t >>> 1 : t = t >>> 1;
    Ia[e] = t;
  }
})();
let La = _d.exports = function() {
  this._crc = -1;
};
La.prototype.write = function(e) {
  for (let t = 0; t < e.length; t++)
    this._crc = Ia[(this._crc ^ e[t]) & 255] ^ this._crc >>> 8;
  return !0;
};
La.prototype.crc32 = function() {
  return this._crc ^ -1;
};
La.crc32 = function(e) {
  let t = -1;
  for (let r = 0; r < e.length; r++)
    t = Ia[(t ^ e[r]) & 255] ^ t >>> 8;
  return t ^ -1;
};
var Ed = _d.exports;
let _e = ui, OT = Ed, Te = pd.exports = function(e, t) {
  this._options = e, e.checkCRC = e.checkCRC !== !1, this._hasIHDR = !1, this._hasIEND = !1, this._emittedHeadersFinished = !1, this._palette = [], this._colorType = 0, this._chunks = {}, this._chunks[_e.TYPE_IHDR] = this._handleIHDR.bind(this), this._chunks[_e.TYPE_IEND] = this._handleIEND.bind(this), this._chunks[_e.TYPE_IDAT] = this._handleIDAT.bind(this), this._chunks[_e.TYPE_PLTE] = this._handlePLTE.bind(this), this._chunks[_e.TYPE_tRNS] = this._handleTRNS.bind(this), this._chunks[_e.TYPE_gAMA] = this._handleGAMA.bind(this), this.read = t.read, this.error = t.error, this.metadata = t.metadata, this.gamma = t.gamma, this.transColor = t.transColor, this.palette = t.palette, this.parsed = t.parsed, this.inflateData = t.inflateData, this.finished = t.finished, this.simpleTransparency = t.simpleTransparency, this.headersFinished = t.headersFinished || function() {
  };
};
Te.prototype.start = function() {
  this.read(_e.PNG_SIGNATURE.length, this._parseSignature.bind(this));
};
Te.prototype._parseSignature = function(e) {
  let t = _e.PNG_SIGNATURE;
  for (let r = 0; r < t.length; r++)
    if (e[r] !== t[r]) {
      this.error(new Error("Invalid file signature"));
      return;
    }
  this.read(8, this._parseChunkBegin.bind(this));
};
Te.prototype._parseChunkBegin = function(e) {
  let t = e.readUInt32BE(0), r = e.readUInt32BE(4), i = "";
  for (let n = 4; n < 8; n++)
    i += String.fromCharCode(e[n]);
  let s = !!(e[4] & 32);
  if (!this._hasIHDR && r !== _e.TYPE_IHDR) {
    this.error(new Error("Expected IHDR on beggining"));
    return;
  }
  if (this._crc = new OT(), this._crc.write(Buffer.from(i)), this._chunks[r])
    return this._chunks[r](t);
  if (!s) {
    this.error(new Error("Unsupported critical chunk type " + i));
    return;
  }
  this.read(t + 4, this._skipChunk.bind(this));
};
Te.prototype._skipChunk = function() {
  this.read(8, this._parseChunkBegin.bind(this));
};
Te.prototype._handleChunkEnd = function() {
  this.read(4, this._parseChunkEnd.bind(this));
};
Te.prototype._parseChunkEnd = function(e) {
  let t = e.readInt32BE(0), r = this._crc.crc32();
  if (this._options.checkCRC && r !== t) {
    this.error(new Error("Crc error - " + t + " - " + r));
    return;
  }
  this._hasIEND || this.read(8, this._parseChunkBegin.bind(this));
};
Te.prototype._handleIHDR = function(e) {
  this.read(e, this._parseIHDR.bind(this));
};
Te.prototype._parseIHDR = function(e) {
  this._crc.write(e);
  let t = e.readUInt32BE(0), r = e.readUInt32BE(4), i = e[8], s = e[9], n = e[10], a = e[11], o = e[12];
  if (i !== 8 && i !== 4 && i !== 2 && i !== 1 && i !== 16) {
    this.error(new Error("Unsupported bit depth " + i));
    return;
  }
  if (!(s in _e.COLORTYPE_TO_BPP_MAP)) {
    this.error(new Error("Unsupported color type"));
    return;
  }
  if (n !== 0) {
    this.error(new Error("Unsupported compression method"));
    return;
  }
  if (a !== 0) {
    this.error(new Error("Unsupported filter method"));
    return;
  }
  if (o !== 0 && o !== 1) {
    this.error(new Error("Unsupported interlace method"));
    return;
  }
  this._colorType = s;
  let c = _e.COLORTYPE_TO_BPP_MAP[this._colorType];
  this._hasIHDR = !0, this.metadata({
    width: t,
    height: r,
    depth: i,
    interlace: !!o,
    palette: !!(s & _e.COLORTYPE_PALETTE),
    color: !!(s & _e.COLORTYPE_COLOR),
    alpha: !!(s & _e.COLORTYPE_ALPHA),
    bpp: c,
    colorType: s
  }), this._handleChunkEnd();
};
Te.prototype._handlePLTE = function(e) {
  this.read(e, this._parsePLTE.bind(this));
};
Te.prototype._parsePLTE = function(e) {
  this._crc.write(e);
  let t = Math.floor(e.length / 3);
  for (let r = 0; r < t; r++)
    this._palette.push([e[r * 3], e[r * 3 + 1], e[r * 3 + 2], 255]);
  this.palette(this._palette), this._handleChunkEnd();
};
Te.prototype._handleTRNS = function(e) {
  this.simpleTransparency(), this.read(e, this._parseTRNS.bind(this));
};
Te.prototype._parseTRNS = function(e) {
  if (this._crc.write(e), this._colorType === _e.COLORTYPE_PALETTE_COLOR) {
    if (this._palette.length === 0) {
      this.error(new Error("Transparency chunk must be after palette"));
      return;
    }
    if (e.length > this._palette.length) {
      this.error(new Error("More transparent colors than palette size"));
      return;
    }
    for (let t = 0; t < e.length; t++)
      this._palette[t][3] = e[t];
    this.palette(this._palette);
  }
  this._colorType === _e.COLORTYPE_GRAYSCALE && this.transColor([e.readUInt16BE(0)]), this._colorType === _e.COLORTYPE_COLOR && this.transColor([
    e.readUInt16BE(0),
    e.readUInt16BE(2),
    e.readUInt16BE(4)
  ]), this._handleChunkEnd();
};
Te.prototype._handleGAMA = function(e) {
  this.read(e, this._parseGAMA.bind(this));
};
Te.prototype._parseGAMA = function(e) {
  this._crc.write(e), this.gamma(e.readUInt32BE(0) / _e.GAMMA_DIVISION), this._handleChunkEnd();
};
Te.prototype._handleIDAT = function(e) {
  this._emittedHeadersFinished || (this._emittedHeadersFinished = !0, this.headersFinished()), this.read(-e, this._parseIDAT.bind(this, e));
};
Te.prototype._parseIDAT = function(e, t) {
  if (this._crc.write(t), this._colorType === _e.COLORTYPE_PALETTE_COLOR && this._palette.length === 0)
    throw new Error("Expected palette not found");
  this.inflateData(t);
  let r = e - t.length;
  r > 0 ? this._handleIDAT(r) : this._handleChunkEnd();
};
Te.prototype._handleIEND = function(e) {
  this.read(e, this._parseIEND.bind(this));
};
Te.prototype._parseIEND = function(e) {
  this._crc.write(e), this._hasIEND = !0, this._handleChunkEnd(), this.finished && this.finished();
};
var md = pd.exports, Aa = {};
let bc = Rn, kT = [
  // 0 - dummy entry
  function() {
  },
  // 1 - L
  // 0: 0, 1: 0, 2: 0, 3: 0xff
  function(e, t, r, i) {
    if (i === t.length)
      throw new Error("Ran out of data");
    let s = t[i];
    e[r] = s, e[r + 1] = s, e[r + 2] = s, e[r + 3] = 255;
  },
  // 2 - LA
  // 0: 0, 1: 0, 2: 0, 3: 1
  function(e, t, r, i) {
    if (i + 1 >= t.length)
      throw new Error("Ran out of data");
    let s = t[i];
    e[r] = s, e[r + 1] = s, e[r + 2] = s, e[r + 3] = t[i + 1];
  },
  // 3 - RGB
  // 0: 0, 1: 1, 2: 2, 3: 0xff
  function(e, t, r, i) {
    if (i + 2 >= t.length)
      throw new Error("Ran out of data");
    e[r] = t[i], e[r + 1] = t[i + 1], e[r + 2] = t[i + 2], e[r + 3] = 255;
  },
  // 4 - RGBA
  // 0: 0, 1: 1, 2: 2, 3: 3
  function(e, t, r, i) {
    if (i + 3 >= t.length)
      throw new Error("Ran out of data");
    e[r] = t[i], e[r + 1] = t[i + 1], e[r + 2] = t[i + 2], e[r + 3] = t[i + 3];
  }
], xT = [
  // 0 - dummy entry
  function() {
  },
  // 1 - L
  // 0: 0, 1: 0, 2: 0, 3: 0xff
  function(e, t, r, i) {
    let s = t[0];
    e[r] = s, e[r + 1] = s, e[r + 2] = s, e[r + 3] = i;
  },
  // 2 - LA
  // 0: 0, 1: 0, 2: 0, 3: 1
  function(e, t, r) {
    let i = t[0];
    e[r] = i, e[r + 1] = i, e[r + 2] = i, e[r + 3] = t[1];
  },
  // 3 - RGB
  // 0: 0, 1: 1, 2: 2, 3: 0xff
  function(e, t, r, i) {
    e[r] = t[0], e[r + 1] = t[1], e[r + 2] = t[2], e[r + 3] = i;
  },
  // 4 - RGBA
  // 0: 0, 1: 1, 2: 2, 3: 3
  function(e, t, r) {
    e[r] = t[0], e[r + 1] = t[1], e[r + 2] = t[2], e[r + 3] = t[3];
  }
];
function DT(e, t) {
  let r = [], i = 0;
  function s() {
    if (i === e.length)
      throw new Error("Ran out of data");
    let n = e[i];
    i++;
    let a, o, c, u, l, p, d, f;
    switch (t) {
      default:
        throw new Error("unrecognised depth");
      case 16:
        d = e[i], i++, r.push((n << 8) + d);
        break;
      case 4:
        d = n & 15, f = n >> 4, r.push(f, d);
        break;
      case 2:
        l = n & 3, p = n >> 2 & 3, d = n >> 4 & 3, f = n >> 6 & 3, r.push(f, d, p, l);
        break;
      case 1:
        a = n & 1, o = n >> 1 & 1, c = n >> 2 & 1, u = n >> 3 & 1, l = n >> 4 & 1, p = n >> 5 & 1, d = n >> 6 & 1, f = n >> 7 & 1, r.push(f, d, p, l, u, c, o, a);
        break;
    }
  }
  return {
    get: function(n) {
      for (; r.length < n; )
        s();
      let a = r.slice(0, n);
      return r = r.slice(n), a;
    },
    resetAfterLine: function() {
      r.length = 0;
    },
    end: function() {
      if (i !== e.length)
        throw new Error("extra data found");
    }
  };
}
function UT(e, t, r, i, s, n) {
  let a = e.width, o = e.height, c = e.index;
  for (let u = 0; u < o; u++)
    for (let l = 0; l < a; l++) {
      let p = r(l, u, c);
      kT[i](t, s, p, n), n += i;
    }
  return n;
}
function PT(e, t, r, i, s, n) {
  let a = e.width, o = e.height, c = e.index;
  for (let u = 0; u < o; u++) {
    for (let l = 0; l < a; l++) {
      let p = s.get(i), d = r(l, u, c);
      xT[i](t, p, d, n);
    }
    s.resetAfterLine();
  }
}
Aa.dataToBitMap = function(e, t) {
  let r = t.width, i = t.height, s = t.depth, n = t.bpp, a = t.interlace, o;
  s !== 8 && (o = DT(e, s));
  let c;
  s <= 8 ? c = Buffer.alloc(r * i * 4) : c = new Uint16Array(r * i * 4);
  let u = Math.pow(2, s) - 1, l = 0, p, d;
  if (a)
    p = bc.getImagePasses(r, i), d = bc.getInterlaceIterator(r, i);
  else {
    let f = 0;
    d = function() {
      let _ = f;
      return f += 4, _;
    }, p = [{ width: r, height: i }];
  }
  for (let f = 0; f < p.length; f++)
    s === 8 ? l = UT(
      p[f],
      c,
      d,
      n,
      e,
      l
    ) : PT(
      p[f],
      c,
      d,
      n,
      o,
      u
    );
  if (s === 8) {
    if (l !== e.length)
      throw new Error("extra data found");
  } else
    o.end();
  return c;
};
function BT(e, t, r, i, s) {
  let n = 0;
  for (let a = 0; a < i; a++)
    for (let o = 0; o < r; o++) {
      let c = s[e[n]];
      if (!c)
        throw new Error("index " + e[n] + " not in palette");
      for (let u = 0; u < 4; u++)
        t[n + u] = c[u];
      n += 4;
    }
}
function FT(e, t, r, i, s) {
  let n = 0;
  for (let a = 0; a < i; a++)
    for (let o = 0; o < r; o++) {
      let c = !1;
      if (s.length === 1 ? s[0] === e[n] && (c = !0) : s[0] === e[n] && s[1] === e[n + 1] && s[2] === e[n + 2] && (c = !0), c)
        for (let u = 0; u < 4; u++)
          t[n + u] = 0;
      n += 4;
    }
}
function MT(e, t, r, i, s) {
  let n = 255, a = Math.pow(2, s) - 1, o = 0;
  for (let c = 0; c < i; c++)
    for (let u = 0; u < r; u++) {
      for (let l = 0; l < 4; l++)
        t[o + l] = Math.floor(
          e[o + l] * n / a + 0.5
        );
      o += 4;
    }
}
var Td = function(e, t) {
  let r = t.depth, i = t.width, s = t.height, n = t.colorType, a = t.transColor, o = t.palette, c = e;
  return n === 3 ? BT(e, c, i, s, o) : (a && FT(e, c, i, s, a), r !== 8 && (r === 16 && (c = Buffer.alloc(i * s * 4)), MT(e, c, i, s, r))), c;
};
let $T = lt, ys = Zr, gd = cd, HT = CT, XT = md, WT = Aa, zT = Td, nt = sd.exports = function(e) {
  gd.call(this), this._parser = new XT(e, {
    read: this.read.bind(this),
    error: this._handleError.bind(this),
    metadata: this._handleMetaData.bind(this),
    gamma: this.emit.bind(this, "gamma"),
    palette: this._handlePalette.bind(this),
    transColor: this._handleTransColor.bind(this),
    finished: this._finished.bind(this),
    inflateData: this._inflateData.bind(this),
    simpleTransparency: this._simpleTransparency.bind(this),
    headersFinished: this._headersFinished.bind(this)
  }), this._options = e, this.writable = !0, this._parser.start();
};
$T.inherits(nt, gd);
nt.prototype._handleError = function(e) {
  this.emit("error", e), this.writable = !1, this.destroy(), this._inflate && this._inflate.destroy && this._inflate.destroy(), this._filter && (this._filter.destroy(), this._filter.on("error", function() {
  })), this.errord = !0;
};
nt.prototype._inflateData = function(e) {
  if (!this._inflate)
    if (this._bitmapInfo.interlace)
      this._inflate = ys.createInflate(), this._inflate.on("error", this.emit.bind(this, "error")), this._filter.on("complete", this._complete.bind(this)), this._inflate.pipe(this._filter);
    else {
      let r = ((this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1) * this._bitmapInfo.height, i = Math.max(r, ys.Z_MIN_CHUNK);
      this._inflate = ys.createInflate({ chunkSize: i });
      let s = r, n = this.emit.bind(this, "error");
      this._inflate.on("error", function(o) {
        s && n(o);
      }), this._filter.on("complete", this._complete.bind(this));
      let a = this._filter.write.bind(this._filter);
      this._inflate.on("data", function(o) {
        s && (o.length > s && (o = o.slice(0, s)), s -= o.length, a(o));
      }), this._inflate.on("end", this._filter.end.bind(this._filter));
    }
  this._inflate.write(e);
};
nt.prototype._handleMetaData = function(e) {
  this._metaData = e, this._bitmapInfo = Object.create(e), this._filter = new HT(this._bitmapInfo);
};
nt.prototype._handleTransColor = function(e) {
  this._bitmapInfo.transColor = e;
};
nt.prototype._handlePalette = function(e) {
  this._bitmapInfo.palette = e;
};
nt.prototype._simpleTransparency = function() {
  this._metaData.alpha = !0;
};
nt.prototype._headersFinished = function() {
  this.emit("metadata", this._metaData);
};
nt.prototype._finished = function() {
  this.errord || (this._inflate ? this._inflate.end() : this.emit("error", "No Inflate block"));
};
nt.prototype._complete = function(e) {
  if (this.errord)
    return;
  let t;
  try {
    let r = WT.dataToBitMap(e, this._bitmapInfo);
    t = zT(r, this._bitmapInfo), r = null;
  } catch (r) {
    this._handleError(r);
    return;
  }
  this.emit("parsed", t);
};
var qT = sd.exports, bd = { exports: {} }, vd = { exports: {} };
let Oe = ui;
var KT = function(e, t, r, i) {
  let s = [Oe.COLORTYPE_COLOR_ALPHA, Oe.COLORTYPE_ALPHA].indexOf(
    i.colorType
  ) !== -1;
  if (i.colorType === i.inputColorType) {
    let _ = function() {
      let E = new ArrayBuffer(2);
      return new DataView(E).setInt16(
        0,
        256,
        !0
        /* littleEndian */
      ), new Int16Array(E)[0] !== 256;
    }();
    if (i.bitDepth === 8 || i.bitDepth === 16 && _)
      return e;
  }
  let n = i.bitDepth !== 16 ? e : new Uint16Array(e.buffer), a = 255, o = Oe.COLORTYPE_TO_BPP_MAP[i.inputColorType];
  o === 4 && !i.inputHasAlpha && (o = 3);
  let c = Oe.COLORTYPE_TO_BPP_MAP[i.colorType];
  i.bitDepth === 16 && (a = 65535, c *= 2);
  let u = Buffer.alloc(t * r * c), l = 0, p = 0, d = i.bgColor || {};
  d.red === void 0 && (d.red = a), d.green === void 0 && (d.green = a), d.blue === void 0 && (d.blue = a);
  function f() {
    let _, E, w, h = a;
    switch (i.inputColorType) {
      case Oe.COLORTYPE_COLOR_ALPHA:
        h = n[l + 3], _ = n[l], E = n[l + 1], w = n[l + 2];
        break;
      case Oe.COLORTYPE_COLOR:
        _ = n[l], E = n[l + 1], w = n[l + 2];
        break;
      case Oe.COLORTYPE_ALPHA:
        h = n[l + 1], _ = n[l], E = _, w = _;
        break;
      case Oe.COLORTYPE_GRAYSCALE:
        _ = n[l], E = _, w = _;
        break;
      default:
        throw new Error(
          "input color type:" + i.inputColorType + " is not supported at present"
        );
    }
    return i.inputHasAlpha && (s || (h /= a, _ = Math.min(
      Math.max(Math.round((1 - h) * d.red + h * _), 0),
      a
    ), E = Math.min(
      Math.max(Math.round((1 - h) * d.green + h * E), 0),
      a
    ), w = Math.min(
      Math.max(Math.round((1 - h) * d.blue + h * w), 0),
      a
    ))), { red: _, green: E, blue: w, alpha: h };
  }
  for (let _ = 0; _ < r; _++)
    for (let E = 0; E < t; E++) {
      let w = f();
      switch (i.colorType) {
        case Oe.COLORTYPE_COLOR_ALPHA:
        case Oe.COLORTYPE_COLOR:
          i.bitDepth === 8 ? (u[p] = w.red, u[p + 1] = w.green, u[p + 2] = w.blue, s && (u[p + 3] = w.alpha)) : (u.writeUInt16BE(w.red, p), u.writeUInt16BE(w.green, p + 2), u.writeUInt16BE(w.blue, p + 4), s && u.writeUInt16BE(w.alpha, p + 6));
          break;
        case Oe.COLORTYPE_ALPHA:
        case Oe.COLORTYPE_GRAYSCALE: {
          let h = (w.red + w.green + w.blue) / 3;
          i.bitDepth === 8 ? (u[p] = h, s && (u[p + 1] = w.alpha)) : (u.writeUInt16BE(h, p), s && u.writeUInt16BE(w.alpha, p + 2));
          break;
        }
        default:
          throw new Error("unrecognised color Type " + i.colorType);
      }
      l += o, p += c;
    }
  return u;
};
let yd = dd;
function YT(e, t, r, i, s) {
  for (let n = 0; n < r; n++)
    i[s + n] = e[t + n];
}
function jT(e, t, r) {
  let i = 0, s = t + r;
  for (let n = t; n < s; n++)
    i += Math.abs(e[n]);
  return i;
}
function GT(e, t, r, i, s, n) {
  for (let a = 0; a < r; a++) {
    let o = a >= n ? e[t + a - n] : 0, c = e[t + a] - o;
    i[s + a] = c;
  }
}
function VT(e, t, r, i) {
  let s = 0;
  for (let n = 0; n < r; n++) {
    let a = n >= i ? e[t + n - i] : 0, o = e[t + n] - a;
    s += Math.abs(o);
  }
  return s;
}
function ZT(e, t, r, i, s) {
  for (let n = 0; n < r; n++) {
    let a = t > 0 ? e[t + n - r] : 0, o = e[t + n] - a;
    i[s + n] = o;
  }
}
function JT(e, t, r) {
  let i = 0, s = t + r;
  for (let n = t; n < s; n++) {
    let a = t > 0 ? e[n - r] : 0, o = e[n] - a;
    i += Math.abs(o);
  }
  return i;
}
function QT(e, t, r, i, s, n) {
  for (let a = 0; a < r; a++) {
    let o = a >= n ? e[t + a - n] : 0, c = t > 0 ? e[t + a - r] : 0, u = e[t + a] - (o + c >> 1);
    i[s + a] = u;
  }
}
function eg(e, t, r, i) {
  let s = 0;
  for (let n = 0; n < r; n++) {
    let a = n >= i ? e[t + n - i] : 0, o = t > 0 ? e[t + n - r] : 0, c = e[t + n] - (a + o >> 1);
    s += Math.abs(c);
  }
  return s;
}
function tg(e, t, r, i, s, n) {
  for (let a = 0; a < r; a++) {
    let o = a >= n ? e[t + a - n] : 0, c = t > 0 ? e[t + a - r] : 0, u = t > 0 && a >= n ? e[t + a - (r + n)] : 0, l = e[t + a] - yd(o, c, u);
    i[s + a] = l;
  }
}
function rg(e, t, r, i) {
  let s = 0;
  for (let n = 0; n < r; n++) {
    let a = n >= i ? e[t + n - i] : 0, o = t > 0 ? e[t + n - r] : 0, c = t > 0 && n >= i ? e[t + n - (r + i)] : 0, u = e[t + n] - yd(a, o, c);
    s += Math.abs(u);
  }
  return s;
}
let ig = {
  0: YT,
  1: GT,
  2: ZT,
  3: QT,
  4: tg
}, ng = {
  0: jT,
  1: VT,
  2: JT,
  3: eg,
  4: rg
};
var sg = function(e, t, r, i, s) {
  let n;
  if (!("filterType" in i) || i.filterType === -1)
    n = [0, 1, 2, 3, 4];
  else if (typeof i.filterType == "number")
    n = [i.filterType];
  else
    throw new Error("unrecognised filter types");
  i.bitDepth === 16 && (s *= 2);
  let a = t * s, o = 0, c = 0, u = Buffer.alloc((a + 1) * r), l = n[0];
  for (let p = 0; p < r; p++) {
    if (n.length > 1) {
      let d = 1 / 0;
      for (let f = 0; f < n.length; f++) {
        let _ = ng[n[f]](e, c, a, s);
        _ < d && (l = n[f], d = _);
      }
    }
    u[o] = l, o++, ig[l](e, c, a, u, o, s), o += a, c += a;
  }
  return u;
};
let Se = ui, ag = Ed, og = KT, cg = sg, ug = Zr, Ot = vd.exports = function(e) {
  if (this._options = e, e.deflateChunkSize = e.deflateChunkSize || 32 * 1024, e.deflateLevel = e.deflateLevel != null ? e.deflateLevel : 9, e.deflateStrategy = e.deflateStrategy != null ? e.deflateStrategy : 3, e.inputHasAlpha = e.inputHasAlpha != null ? e.inputHasAlpha : !0, e.deflateFactory = e.deflateFactory || ug.createDeflate, e.bitDepth = e.bitDepth || 8, e.colorType = typeof e.colorType == "number" ? e.colorType : Se.COLORTYPE_COLOR_ALPHA, e.inputColorType = typeof e.inputColorType == "number" ? e.inputColorType : Se.COLORTYPE_COLOR_ALPHA, [
    Se.COLORTYPE_GRAYSCALE,
    Se.COLORTYPE_COLOR,
    Se.COLORTYPE_COLOR_ALPHA,
    Se.COLORTYPE_ALPHA
  ].indexOf(e.colorType) === -1)
    throw new Error(
      "option color type:" + e.colorType + " is not supported at present"
    );
  if ([
    Se.COLORTYPE_GRAYSCALE,
    Se.COLORTYPE_COLOR,
    Se.COLORTYPE_COLOR_ALPHA,
    Se.COLORTYPE_ALPHA
  ].indexOf(e.inputColorType) === -1)
    throw new Error(
      "option input color type:" + e.inputColorType + " is not supported at present"
    );
  if (e.bitDepth !== 8 && e.bitDepth !== 16)
    throw new Error(
      "option bit depth:" + e.bitDepth + " is not supported at present"
    );
};
Ot.prototype.getDeflateOptions = function() {
  return {
    chunkSize: this._options.deflateChunkSize,
    level: this._options.deflateLevel,
    strategy: this._options.deflateStrategy
  };
};
Ot.prototype.createDeflate = function() {
  return this._options.deflateFactory(this.getDeflateOptions());
};
Ot.prototype.filterData = function(e, t, r) {
  let i = og(e, t, r, this._options), s = Se.COLORTYPE_TO_BPP_MAP[this._options.colorType];
  return cg(i, t, r, this._options, s);
};
Ot.prototype._packChunk = function(e, t) {
  let r = t ? t.length : 0, i = Buffer.alloc(r + 12);
  return i.writeUInt32BE(r, 0), i.writeUInt32BE(e, 4), t && t.copy(i, 8), i.writeInt32BE(
    ag.crc32(i.slice(4, i.length - 4)),
    i.length - 4
  ), i;
};
Ot.prototype.packGAMA = function(e) {
  let t = Buffer.alloc(4);
  return t.writeUInt32BE(Math.floor(e * Se.GAMMA_DIVISION), 0), this._packChunk(Se.TYPE_gAMA, t);
};
Ot.prototype.packIHDR = function(e, t) {
  let r = Buffer.alloc(13);
  return r.writeUInt32BE(e, 0), r.writeUInt32BE(t, 4), r[8] = this._options.bitDepth, r[9] = this._options.colorType, r[10] = 0, r[11] = 0, r[12] = 0, this._packChunk(Se.TYPE_IHDR, r);
};
Ot.prototype.packIDAT = function(e) {
  return this._packChunk(Se.TYPE_IDAT, e);
};
Ot.prototype.packIEND = function() {
  return this._packChunk(Se.TYPE_IEND, null);
};
var wd = vd.exports;
let lg = lt, Sd = Vr, dg = ui, fg = wd, Rd = bd.exports = function(e) {
  Sd.call(this);
  let t = e || {};
  this._packer = new fg(t), this._deflate = this._packer.createDeflate(), this.readable = !0;
};
lg.inherits(Rd, Sd);
Rd.prototype.pack = function(e, t, r, i) {
  this.emit("data", Buffer.from(dg.PNG_SIGNATURE)), this.emit("data", this._packer.packIHDR(t, r)), i && this.emit("data", this._packer.packGAMA(i));
  let s = this._packer.filterData(e, t, r);
  this._deflate.on("error", this.emit.bind(this, "error")), this._deflate.on(
    "data",
    (function(n) {
      this.emit("data", this._packer.packIDAT(n));
    }).bind(this)
  ), this._deflate.on(
    "end",
    (function() {
      this.emit("data", this._packer.packIEND()), this.emit("end");
    }).bind(this)
  ), this._deflate.end(s);
};
var hg = bd.exports, Ca = {}, qs = { exports: {} };
(function(e, t) {
  let r = sf.ok, i = Zr, s = lt, n = zc.kMaxLength;
  function a(p) {
    if (!(this instanceof a))
      return new a(p);
    p && p.chunkSize < i.Z_MIN_CHUNK && (p.chunkSize = i.Z_MIN_CHUNK), i.Inflate.call(this, p), this._offset = this._offset === void 0 ? this._outOffset : this._offset, this._buffer = this._buffer || this._outBuffer, p && p.maxLength != null && (this._maxLength = p.maxLength);
  }
  function o(p) {
    return new a(p);
  }
  function c(p, d) {
    p._handle && (p._handle.close(), p._handle = null);
  }
  a.prototype._processChunk = function(p, d, f) {
    if (typeof f == "function")
      return i.Inflate._processChunk.call(this, p, d, f);
    let _ = this, E = p && p.length, w = this._chunkSize - this._offset, h = this._maxLength, m = 0, b = [], v = 0, S;
    this.on("error", function(P) {
      S = P;
    });
    function L(P, H) {
      if (_._hadError)
        return;
      let D = w - H;
      if (r(D >= 0, "have should not go down"), D > 0) {
        let B = _._buffer.slice(_._offset, _._offset + D);
        if (_._offset += D, B.length > h && (B = B.slice(0, h)), b.push(B), v += B.length, h -= B.length, h === 0)
          return !1;
      }
      return (H === 0 || _._offset >= _._chunkSize) && (w = _._chunkSize, _._offset = 0, _._buffer = Buffer.allocUnsafe(_._chunkSize)), H === 0 ? (m += E - P, E = P, !0) : !1;
    }
    r(this._handle, "zlib binding closed");
    let I;
    do
      I = this._handle.writeSync(
        d,
        p,
        // in
        m,
        // in_off
        E,
        // in_len
        this._buffer,
        // out
        this._offset,
        //out_off
        w
      ), I = I || this._writeState;
    while (!this._hadError && L(I[0], I[1]));
    if (this._hadError)
      throw S;
    if (v >= n)
      throw c(this), new RangeError(
        "Cannot create final Buffer. It would be larger than 0x" + n.toString(16) + " bytes"
      );
    let O = Buffer.concat(b, v);
    return c(this), O;
  }, s.inherits(a, i.Inflate);
  function u(p, d) {
    if (typeof d == "string" && (d = Buffer.from(d)), !(d instanceof Buffer))
      throw new TypeError("Not a string or buffer");
    let f = p._finishFlushFlag;
    return f == null && (f = i.Z_FINISH), p._processChunk(d, f);
  }
  function l(p, d) {
    return u(new a(d), p);
  }
  e.exports = t = l, t.Inflate = a, t.createInflate = o, t.inflateSync = l;
})(qs, qs.exports);
var pg = qs.exports, Nd = { exports: {} };
let Id = Nd.exports = function(e) {
  this._buffer = e, this._reads = [];
};
Id.prototype.read = function(e, t) {
  this._reads.push({
    length: Math.abs(e),
    // if length < 0 then at most this length
    allowLess: e < 0,
    func: t
  });
};
Id.prototype.process = function() {
  for (; this._reads.length > 0 && this._buffer.length; ) {
    let e = this._reads[0];
    if (this._buffer.length && (this._buffer.length >= e.length || e.allowLess)) {
      this._reads.shift();
      let t = this._buffer;
      this._buffer = t.slice(e.length), e.func.call(this, t.slice(0, e.length));
    } else
      break;
  }
  if (this._reads.length > 0)
    return new Error("There are some read requests waitng on finished stream");
  if (this._buffer.length > 0)
    return new Error("unrecognised content at end of stream");
};
var Ld = Nd.exports, Ad = {};
let _g = Ld, Eg = fd;
Ad.process = function(e, t) {
  let r = [], i = new _g(e);
  return new Eg(t, {
    read: i.read.bind(i),
    write: function(n) {
      r.push(n);
    },
    complete: function() {
    }
  }).start(), i.process(), Buffer.concat(r);
};
let Cd = !0, Od = Zr, mg = pg;
Od.deflateSync || (Cd = !1);
let Tg = Ld, gg = Ad, bg = md, vg = Aa, yg = Td;
var wg = function(e, t) {
  if (!Cd)
    throw new Error(
      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
    );
  let r;
  function i(v) {
    r = v;
  }
  let s;
  function n(v) {
    s = v;
  }
  function a(v) {
    s.transColor = v;
  }
  function o(v) {
    s.palette = v;
  }
  function c() {
    s.alpha = !0;
  }
  let u;
  function l(v) {
    u = v;
  }
  let p = [];
  function d(v) {
    p.push(v);
  }
  let f = new Tg(e);
  if (new bg(t, {
    read: f.read.bind(f),
    error: i,
    metadata: n,
    gamma: l,
    palette: o,
    transColor: a,
    inflateData: d,
    simpleTransparency: c
  }).start(), f.process(), r)
    throw r;
  let E = Buffer.concat(p);
  p.length = 0;
  let w;
  if (s.interlace)
    w = Od.inflateSync(E);
  else {
    let S = ((s.width * s.bpp * s.depth + 7 >> 3) + 1) * s.height;
    w = mg(E, {
      chunkSize: S,
      maxLength: S
    });
  }
  if (E = null, !w || !w.length)
    throw new Error("bad png - invalid inflate data response");
  let h = gg.process(w, s);
  E = null;
  let m = vg.dataToBitMap(h, s);
  h = null;
  let b = yg(m, s);
  return s.data = b, s.gamma = u || 0, s;
};
let kd = !0, xd = Zr;
xd.deflateSync || (kd = !1);
let Sg = ui, Rg = wd;
var Ng = function(e, t) {
  if (!kd)
    throw new Error(
      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
    );
  let r = t || {}, i = new Rg(r), s = [];
  s.push(Buffer.from(Sg.PNG_SIGNATURE)), s.push(i.packIHDR(e.width, e.height)), e.gamma && s.push(i.packGAMA(e.gamma));
  let n = i.filterData(
    e.data,
    e.width,
    e.height
  ), a = xd.deflateSync(
    n,
    i.getDeflateOptions()
  );
  if (n = null, !a || !a.length)
    throw new Error("bad png - invalid compressed data response");
  return s.push(i.packIDAT(a)), s.push(i.packIEND()), Buffer.concat(s);
};
let Ig = wg, Lg = Ng;
Ca.read = function(e, t) {
  return Ig(e, t || {});
};
Ca.write = function(e, t) {
  return Lg(e, t);
};
let Ag = lt, Dd = Vr, Cg = qT, Og = hg, kg = Ca, Ne = nd.PNG = function(e) {
  Dd.call(this), e = e || {}, this.width = e.width | 0, this.height = e.height | 0, this.data = this.width > 0 && this.height > 0 ? Buffer.alloc(4 * this.width * this.height) : null, e.fill && this.data && this.data.fill(0), this.gamma = 0, this.readable = this.writable = !0, this._parser = new Cg(e), this._parser.on("error", this.emit.bind(this, "error")), this._parser.on("close", this._handleClose.bind(this)), this._parser.on("metadata", this._metadata.bind(this)), this._parser.on("gamma", this._gamma.bind(this)), this._parser.on(
    "parsed",
    (function(t) {
      this.data = t, this.emit("parsed", t);
    }).bind(this)
  ), this._packer = new Og(e), this._packer.on("data", this.emit.bind(this, "data")), this._packer.on("end", this.emit.bind(this, "end")), this._parser.on("close", this._handleClose.bind(this)), this._packer.on("error", this.emit.bind(this, "error"));
};
Ag.inherits(Ne, Dd);
Ne.sync = kg;
Ne.prototype.pack = function() {
  return !this.data || !this.data.length ? (this.emit("error", "No data provided"), this) : (process.nextTick(
    (function() {
      this._packer.pack(this.data, this.width, this.height, this.gamma);
    }).bind(this)
  ), this);
};
Ne.prototype.parse = function(e, t) {
  if (t) {
    let r, i;
    r = (function(s) {
      this.removeListener("error", i), this.data = s, t(null, this);
    }).bind(this), i = (function(s) {
      this.removeListener("parsed", r), t(s, null);
    }).bind(this), this.once("parsed", r), this.once("error", i);
  }
  return this.end(e), this;
};
Ne.prototype.write = function(e) {
  return this._parser.write(e), !0;
};
Ne.prototype.end = function(e) {
  this._parser.end(e);
};
Ne.prototype._metadata = function(e) {
  this.width = e.width, this.height = e.height, this.emit("metadata", e);
};
Ne.prototype._gamma = function(e) {
  this.gamma = e;
};
Ne.prototype._handleClose = function() {
  !this._parser.writable && !this._packer.readable && this.emit("close");
};
Ne.bitblt = function(e, t, r, i, s, n, a, o) {
  if (r |= 0, i |= 0, s |= 0, n |= 0, a |= 0, o |= 0, r > e.width || i > e.height || r + s > e.width || i + n > e.height)
    throw new Error("bitblt reading outside image");
  if (a > t.width || o > t.height || a + s > t.width || o + n > t.height)
    throw new Error("bitblt writing outside image");
  for (let c = 0; c < n; c++)
    e.data.copy(
      t.data,
      (o + c) * t.width + a << 2,
      (i + c) * e.width + r << 2,
      (i + c) * e.width + r + s << 2
    );
};
Ne.prototype.bitblt = function(e, t, r, i, s, n, a) {
  return Ne.bitblt(this, e, t, r, i, s, n, a), this;
};
Ne.adjustGamma = function(e) {
  if (e.gamma) {
    for (let t = 0; t < e.height; t++)
      for (let r = 0; r < e.width; r++) {
        let i = e.width * t + r << 2;
        for (let s = 0; s < 3; s++) {
          let n = e.data[i + s] / 255;
          n = Math.pow(n, 1 / 2.2 / e.gamma), e.data[i + s] = Math.round(n * 255);
        }
      }
    e.gamma = 0;
  }
};
Ne.prototype.adjustGamma = function() {
  Ne.adjustGamma(this);
};
var li = {};
(function(e) {
  function t(r) {
    if (typeof r == "number" && (r = r.toString()), typeof r != "string")
      throw new Error("Color should be defined as hex string");
    let i = r.slice().replace("#", "").split("");
    if (i.length < 3 || i.length === 5 || i.length > 8)
      throw new Error("Invalid hex color: " + r);
    (i.length === 3 || i.length === 4) && (i = Array.prototype.concat.apply([], i.map(function(n) {
      return [n, n];
    }))), i.length === 6 && i.push("F", "F");
    const s = parseInt(i.join(""), 16);
    return {
      r: s >> 24 & 255,
      g: s >> 16 & 255,
      b: s >> 8 & 255,
      a: s & 255,
      hex: "#" + i.slice(0, 6).join("")
    };
  }
  e.getOptions = function(i) {
    i || (i = {}), i.color || (i.color = {});
    const s = typeof i.margin > "u" || i.margin === null || i.margin < 0 ? 4 : i.margin, n = i.width && i.width >= 21 ? i.width : void 0, a = i.scale || 4;
    return {
      width: n,
      scale: n ? 4 : a,
      margin: s,
      color: {
        dark: t(i.color.dark || "#000000ff"),
        light: t(i.color.light || "#ffffffff")
      },
      type: i.type,
      rendererOpts: i.rendererOpts || {}
    };
  }, e.getScale = function(i, s) {
    return s.width && s.width >= i + s.margin * 2 ? s.width / (i + s.margin * 2) : s.scale;
  }, e.getImageWidth = function(i, s) {
    const n = e.getScale(i, s);
    return Math.floor((i + s.margin * 2) * n);
  }, e.qrToImageData = function(i, s, n) {
    const a = s.modules.size, o = s.modules.data, c = e.getScale(a, n), u = Math.floor((a + n.margin * 2) * c), l = n.margin * c, p = [n.color.light, n.color.dark];
    for (let d = 0; d < u; d++)
      for (let f = 0; f < u; f++) {
        let _ = (d * u + f) * 4, E = n.color.light;
        if (d >= l && f >= l && d < u - l && f < u - l) {
          const w = Math.floor((d - l) / c), h = Math.floor((f - l) / c);
          E = p[o[w * a + h] ? 1 : 0];
        }
        i[_++] = E.r, i[_++] = E.g, i[_++] = E.b, i[_] = E.a;
      }
  };
})(li);
(function(e) {
  const t = tn, r = nd.PNG, i = li;
  e.render = function(n, a) {
    const o = i.getOptions(a), c = o.rendererOpts, u = i.getImageWidth(n.modules.size, o);
    c.width = u, c.height = u;
    const l = new r(c);
    return i.qrToImageData(l.data, n, o), l;
  }, e.renderToDataURL = function(n, a, o) {
    typeof o > "u" && (o = a, a = void 0), e.renderToBuffer(n, a, function(c, u) {
      c && o(c);
      let l = "data:image/png;base64,";
      l += u.toString("base64"), o(null, l);
    });
  }, e.renderToBuffer = function(n, a, o) {
    typeof o > "u" && (o = a, a = void 0);
    const c = e.render(n, a), u = [];
    c.on("error", o), c.on("data", function(l) {
      u.push(l);
    }), c.on("end", function() {
      o(null, Buffer.concat(u));
    }), c.pack();
  }, e.renderToFile = function(n, a, o, c) {
    typeof c > "u" && (c = o, o = void 0);
    let u = !1;
    const l = (...d) => {
      u || (u = !0, c.apply(null, d));
    }, p = t.createWriteStream(n);
    p.on("error", l), p.on("close", l), e.renderToFileStream(p, a, o);
  }, e.renderToFileStream = function(n, a, o) {
    e.render(a, o).pack().pipe(n);
  };
})(id);
var Ud = {};
(function(e) {
  const t = li, r = {
    WW: " ",
    WB: "▄",
    BB: "█",
    BW: "▀"
  }, i = {
    BB: " ",
    BW: "▄",
    WW: "█",
    WB: "▀"
  };
  function s(n, a, o) {
    return n && a ? o.BB : n && !a ? o.BW : !n && a ? o.WB : o.WW;
  }
  e.render = function(n, a, o) {
    const c = t.getOptions(a);
    let u = r;
    (c.color.dark.hex === "#ffffff" || c.color.light.hex === "#000000") && (u = i);
    const l = n.modules.size, p = n.modules.data;
    let d = "", f = Array(l + c.margin * 2 + 1).join(u.WW);
    f = Array(c.margin / 2 + 1).join(f + `
`);
    const _ = Array(c.margin + 1).join(u.WW);
    d += f;
    for (let E = 0; E < l; E += 2) {
      d += _;
      for (let w = 0; w < l; w++) {
        const h = p[E * l + w], m = p[(E + 1) * l + w];
        d += s(h, m, u);
      }
      d += _ + `
`;
    }
    return d += f.slice(0, -1), typeof o == "function" && o(null, d), d;
  }, e.renderToFile = function(a, o, c, u) {
    typeof u > "u" && (u = c, c = void 0);
    const l = tn, p = e.render(o, c);
    l.writeFile(a, p, u);
  };
})(Ud);
var Pd = {}, Bd = {};
Bd.render = function(e, t, r) {
  const i = e.modules.size, s = e.modules.data, n = "\x1B[40m  \x1B[0m", a = "\x1B[47m  \x1B[0m";
  let o = "";
  const c = Array(i + 3).join(a), u = Array(2).join(a);
  o += c + `
`;
  for (let l = 0; l < i; ++l) {
    o += a;
    for (let p = 0; p < i; p++)
      o += s[l * i + p] ? n : a;
    o += u + `
`;
  }
  return o += c + `
`, typeof r == "function" && r(null, o), o;
};
var Fd = {};
const xg = "\x1B[47m", Dg = "\x1B[40m", Ks = "\x1B[37m", Ys = "\x1B[30m", Pt = "\x1B[0m", Ug = xg + Ys, Pg = Dg + Ks, Bg = function(e, t, r) {
  return {
    // 1 ... white, 2 ... black, 0 ... transparent (default)
    "00": Pt + " " + e,
    "01": Pt + t + "▄" + e,
    "02": Pt + r + "▄" + e,
    10: Pt + t + "▀" + e,
    11: " ",
    12: "▄",
    20: Pt + r + "▀" + e,
    21: "▀",
    22: "█"
  };
}, vc = function(e, t, r, i) {
  const s = t + 1;
  if (r >= s || i >= s || i < -1 || r < -1) return "0";
  if (r >= t || i >= t || i < 0 || r < 0) return "1";
  const n = i * t + r;
  return e[n] ? "2" : "1";
}, yc = function(e, t, r, i) {
  return vc(e, t, r, i) + vc(e, t, r, i + 1);
};
Fd.render = function(e, t, r) {
  const i = e.modules.size, s = e.modules.data, n = !!(t && t.inverse), a = t && t.inverse ? Pg : Ug, u = Bg(a, n ? Ys : Ks, n ? Ks : Ys), l = Pt + `
` + a;
  let p = a;
  for (let d = -1; d < i + 1; d += 2) {
    for (let f = -1; f < i; f++)
      p += u[yc(s, i, f, d)];
    p += u[yc(s, i, i, d)] + l;
  }
  return p += Pt, typeof r == "function" && r(null, p), p;
};
const Fg = Bd, Mg = Fd;
Pd.render = function(e, t, r) {
  return t && t.small ? Mg.render(e, t, r) : Fg.render(e, t, r);
};
var Md = {}, Oa = {};
const $g = li;
function wc(e, t) {
  const r = e.a / 255, i = t + '="' + e.hex + '"';
  return r < 1 ? i + " " + t + '-opacity="' + r.toFixed(2).slice(1) + '"' : i;
}
function ws(e, t, r) {
  let i = e + t;
  return typeof r < "u" && (i += " " + r), i;
}
function Hg(e, t, r) {
  let i = "", s = 0, n = !1, a = 0;
  for (let o = 0; o < e.length; o++) {
    const c = Math.floor(o % t), u = Math.floor(o / t);
    !c && !n && (n = !0), e[o] ? (a++, o > 0 && c > 0 && e[o - 1] || (i += n ? ws("M", c + r, 0.5 + u + r) : ws("m", s, 0), s = 0, n = !1), c + 1 < t && e[o + 1] || (i += ws("h", a), a = 0)) : s++;
  }
  return i;
}
Oa.render = function(t, r, i) {
  const s = $g.getOptions(r), n = t.modules.size, a = t.modules.data, o = n + s.margin * 2, c = s.color.light.a ? "<path " + wc(s.color.light, "fill") + ' d="M0 0h' + o + "v" + o + 'H0z"/>' : "", u = "<path " + wc(s.color.dark, "stroke") + ' d="' + Hg(a, n, s.margin) + '"/>', l = 'viewBox="0 0 ' + o + " " + o + '"', d = '<svg xmlns="http://www.w3.org/2000/svg" ' + (s.width ? 'width="' + s.width + '" height="' + s.width + '" ' : "") + l + ' shape-rendering="crispEdges">' + c + u + `</svg>
`;
  return typeof i == "function" && i(null, d), d;
};
(function(e) {
  const t = Oa;
  e.render = t.render, e.renderToFile = function(i, s, n, a) {
    typeof a > "u" && (a = n, n = void 0);
    const o = tn, u = '<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + e.render(s, n);
    o.writeFile(i, u, a);
  };
})(Md);
var rr = {}, Ss = {}, Sc;
function Xg() {
  return Sc || (Sc = 1, function(e) {
    const t = li;
    function r(s, n, a) {
      s.clearRect(0, 0, n.width, n.height), n.style || (n.style = {}), n.height = a, n.width = a, n.style.height = a + "px", n.style.width = a + "px";
    }
    function i() {
      try {
        return document.createElement("canvas");
      } catch {
        throw new Error("You need to specify a canvas element");
      }
    }
    e.render = function(n, a, o) {
      let c = o, u = a;
      typeof c > "u" && (!a || !a.getContext) && (c = a, a = void 0), a || (u = i()), c = t.getOptions(c);
      const l = t.getImageWidth(n.modules.size, c), p = u.getContext("2d"), d = p.createImageData(l, l);
      return t.qrToImageData(d.data, n, c), r(p, u, l), p.putImageData(d, 0, 0), u;
    }, e.renderToDataURL = function(n, a, o) {
      let c = o;
      typeof c > "u" && (!a || !a.getContext) && (c = a, a = void 0), c || (c = {});
      const u = e.render(n, a, c), l = c.type || "image/png", p = c.rendererOpts || {};
      return u.toDataURL(l, p.quality);
    };
  }(Ss)), Ss;
}
var Rc;
function Wg() {
  if (Rc) return rr;
  Rc = 1;
  const e = zl, t = wa, r = Xg(), i = Oa;
  function s(n, a, o, c, u) {
    const l = [].slice.call(arguments, 1), p = l.length, d = typeof l[p - 1] == "function";
    if (!d && !e())
      throw new Error("Callback required as last argument");
    if (d) {
      if (p < 2)
        throw new Error("Too few arguments provided");
      p === 2 ? (u = o, o = a, a = c = void 0) : p === 3 && (a.getContext && typeof u > "u" ? (u = c, c = void 0) : (u = c, c = o, o = a, a = void 0));
    } else {
      if (p < 1)
        throw new Error("Too few arguments provided");
      return p === 1 ? (o = a, a = c = void 0) : p === 2 && !a.getContext && (c = o, o = a, a = void 0), new Promise(function(f, _) {
        try {
          const E = t.create(o, c);
          f(n(E, a, c));
        } catch (E) {
          _(E);
        }
      });
    }
    try {
      const f = t.create(o, c);
      u(null, n(f, a, c));
    } catch (f) {
      u(f);
    }
  }
  return rr.create = t.create, rr.toCanvas = s.bind(null, r.render), rr.toDataURL = s.bind(null, r.renderToDataURL), rr.toString = s.bind(null, function(n, a, o) {
    return i.render(n, o);
  }), rr;
}
const $d = zl, js = wa, zg = id, Hd = Ud, qg = Pd, Xd = Md;
function di(e, t, r) {
  if (typeof e > "u")
    throw new Error("String required as first argument");
  if (typeof r > "u" && (r = t, t = {}), typeof r != "function")
    if ($d())
      t = r || {}, r = null;
    else
      throw new Error("Callback required as last argument");
  return {
    opts: t,
    cb: r
  };
}
function Kg(e) {
  return e.slice((e.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
}
function Nn(e) {
  switch (e) {
    case "svg":
      return Xd;
    case "txt":
    case "utf8":
      return Hd;
    case "png":
    case "image/png":
    default:
      return zg;
  }
}
function Yg(e) {
  switch (e) {
    case "svg":
      return Xd;
    case "terminal":
      return qg;
    case "utf8":
    default:
      return Hd;
  }
}
function fi(e, t, r) {
  if (!r.cb)
    return new Promise(function(i, s) {
      try {
        const n = js.create(t, r.opts);
        return e(n, r.opts, function(a, o) {
          return a ? s(a) : i(o);
        });
      } catch (n) {
        s(n);
      }
    });
  try {
    const i = js.create(t, r.opts);
    return e(i, r.opts, r.cb);
  } catch (i) {
    r.cb(i);
  }
}
At.create = js.create;
At.toCanvas = Wg().toCanvas;
At.toString = function(t, r, i) {
  const s = di(t, r, i), n = s.opts ? s.opts.type : void 0, a = Yg(n);
  return fi(a.render, t, s);
};
At.toDataURL = function(t, r, i) {
  const s = di(t, r, i), n = Nn(s.opts.type);
  return fi(n.renderToDataURL, t, s);
};
At.toBuffer = function(t, r, i) {
  const s = di(t, r, i), n = Nn(s.opts.type);
  return fi(n.renderToBuffer, t, s);
};
At.toFile = function(t, r, i, s) {
  if (typeof t != "string" || !(typeof r == "string" || typeof r == "object"))
    throw new Error("Invalid argument");
  if (arguments.length < 3 && !$d())
    throw new Error("Too few arguments provided");
  const n = di(r, i, s), a = n.opts.type || Kg(t), c = Nn(a).renderToFile.bind(null, t);
  return fi(c, r, n);
};
At.toFileStream = function(t, r, i) {
  if (arguments.length < 2)
    throw new Error("Too few arguments provided");
  const s = di(r, i, t.emit.bind(t, "error")), a = Nn("png").renderToFileStream.bind(null, t);
  fi(a, r, s);
};
var jg = At;
const Gg = /* @__PURE__ */ Qs(jg), Vg = {
  whatsapp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.99.52 3.93 1.51 5.64L2 22l4.6-1.51a9.86 9.86 0 0 0 5.44 1.52h.01c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.79 14.06c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.93-4.36-.14-.19-1.17-1.56-1.17-2.97 0-1.41.74-2.1 1-2.39.26-.29.57-.36.76-.36h.55c.18 0 .42-.07.65.5.24.58.82 2 .89 2.14.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.56.16.28.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.61-.13.25.09 1.6.75 1.87.89.27.14.45.21.52.33.07.12.07.69-.17 1.37z"/></svg>',
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zm5.25-3.75a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/></svg>',
  facebook: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z"/></svg>',
  tiktok: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M14.5 3c.4 1.7 1.5 3.2 3.1 4.1V9c-1.2-.05-2.3-.4-3.3-1v6.3A5.3 5.3 0 1 1 9 9.1v2.2a3.1 3.1 0 1 0 2.2 3V3h3.3z"/></svg>',
  website: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.9 9h-3.2a15 15 0 0 0-1.3-5 8.1 8.1 0 0 1 4.5 5zM12 4c.9 1.3 1.7 3.2 2.1 5H9.9C10.3 7.2 11.1 5.3 12 4zM4.1 13h3.2a15 15 0 0 0 1.3 5 8.1 8.1 0 0 1-4.5-5zm3.2-2H4.1a8.1 8.1 0 0 1 4.5-5 15 15 0 0 0-1.3 5zm2.6 0h4.2c-.4 1.9-1.2 3.8-2.1 5-.9-1.2-1.7-3.1-2.1-5zm4.2 2H9.9c.4 1.8 1.2 3.7 2.1 5 .9-1.3 1.7-3.2 2.1-5zm.7 5a15 15 0 0 0 1.3-5h3.2a8.1 8.1 0 0 1-4.5 5z"/></svg>'
};
function Zg(e) {
  const t = Vg[e];
  return `data:image/svg+xml;base64,${Buffer.from(t).toString("base64")}`;
}
const Nc = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  website: "Web"
}, Jg = "Kaarobar", Qg = "#2d6df6", e0 = /^#([0-9a-fA-F]{6})$/;
function In(e) {
  const t = (e ?? "").trim();
  return e0.test(t) ? t.toLowerCase() : Qg;
}
function ka(e) {
  const t = In(e), r = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="128" height="128" role="img" aria-label="${Jg}">
  <rect width="1024" height="1024" rx="180" fill="${t}"/>
  <g fill="none" stroke="#ffffff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 270 512 L 478 512"/>
    <path d="M 390 230 L 390 410 Q 390 512 478 512"/>
    <path d="M 390 794 L 390 614 Q 390 512 478 512"/>
  </g>
  <g fill="#ffffff">
    <circle cx="270" cy="512" r="75"/>
    <circle cx="390" cy="230" r="75"/>
    <circle cx="390" cy="794" r="75"/>
    <circle cx="478" cy="512" r="46"/>
  </g>
  <g fill="#ffffff">
    <g transform="translate(582, 408) rotate(-45)">
      <path d="M 0,-75 L 250,-75 A 35 35 0 0 1 285,-40 L 285,40 A 35 35 0 0 1 250,75 L 0,75 A 75 75 0 0 1 0,-75 Z"/>
    </g>
    <g transform="translate(582, 616) rotate(45)">
      <path d="M 0,-75 L 250,-75 A 35 35 0 0 1 285,-40 L 285,40 A 35 35 0 0 1 250,75 L 0,75 A 75 75 0 0 1 0,-75 Z"/>
    </g>
  </g>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(r).toString("base64")}`;
}
function re(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function ir() {
  return '<div class="stars">********************************</div>';
}
function t0(e) {
  try {
    const t = M.readFileSync(e), r = F.extname(e).toLowerCase().replace(".", "") || "png";
    return `data:${r === "jpg" || r === "jpeg" ? "image/jpeg" : r === "webp" ? "image/webp" : r === "gif" ? "image/gif" : r === "svg" ? "image/svg+xml" : "image/png"};base64,${t.toString("base64")}`;
  } catch {
    return null;
  }
}
async function r0(e, t) {
  const r = [
    { platform: "whatsapp", url: e.socialWhatsapp || "" },
    { platform: "instagram", url: e.socialInstagram || "" },
    { platform: "facebook", url: e.socialFacebook || "" },
    { platform: "tiktok", url: e.socialTiktok || "" },
    { platform: "website", url: e.socialWebsite || "" }
  ].filter((s) => s.url.trim());
  if (r.length === 0) return "";
  const i = [];
  for (const s of r) {
    const n = await Gg.toDataURL(s.url.trim(), {
      margin: 1,
      width: 72,
      color: { dark: "#000000", light: "#ffffff" }
    });
    i.push(`
      <div class="social-item">
        <img class="social-icon" src="${Zg(s.platform)}" alt="" />
        <img class="social-qr" src="${n}" alt="${Nc[s.platform]}" />
        <div class="social-label">${Nc[s.platform]}</div>
      </div>
    `);
  }
  return `
    ${ir()}
    <div class="social-title">${re(t)}</div>
    <div class="social-row">${i.join("")}</div>
  `;
}
async function i0(e) {
  var S, L;
  const t = e.language ?? Ke(), r = nu(t), i = sa(t), s = on(e.currency), n = e.payments.some((I) => I.method === "credit"), a = e.payments.some((I) => I.method === "cash"), o = e.payments.some((I) => I.method === "card"), c = n && !a ? r.creditReceipt : o && !a && !n ? r.cardReceipt : r.cashReceipt, u = (I) => I === "card" ? r.card : I === "cash" ? r.cash : I === "credit" ? r.credit : I;
  let l = "";
  if (e.logoPath)
    try {
      const I = t0(Jr(e.logoPath));
      I && (l = `<img class="logo" src="${I}" alt="" />`);
    } catch {
      l = "";
    }
  const p = [
    e.branchAddress ? re(e.branchAddress) : "",
    e.branchPhone ? `${re(r.tel)}: ${re(e.branchPhone)}` : ""
  ].filter(Boolean), d = e.items.map(
    (I) => `
      <tr>
        <td class="desc">${re(I.productName)} × ${I.qty}</td>
        <td class="price">${s} ${I.lineTotal.toFixed(2)}</td>
      </tr>`
  ).join(""), f = e.payments.map(
    (I) => `<div class="row"><span>${re(u(I.method))}</span><span>${s} ${I.amount.toFixed(2)}</span></div>`
  ).join(""), _ = Math.max(0, e.amountPaid - e.total), E = await r0(e, r.followUs), w = In(e.brandColor), h = ka(w), m = JSON.stringify(e.invoiceNo), b = e.jsBarcodeScript, v = Ki(e.createdAt, t);
  return `<!DOCTYPE html>
<html lang="${i.lang}" dir="${i.dir}">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${i.fontLink}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: ${i.fontFamily};
      color: #111;
      background: #fff;
      width: 300px;
    }
    .wrap { width: 100%; }
    .center { text-align: center; }
    .logo { max-height: 56px; max-width: 140px; display: block; margin: 0 auto 6px; }
    .shop { font-size: 16px; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
    .muted { font-size: 11px; margin: 2px 0; }
    .title { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin: 8px 0; }
    .stars { text-align: center; font-size: 11px; letter-spacing: 1px; margin: 8px 0; overflow: hidden; white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { font-weight: 700; padding: 2px 0 6px; }
    th.desc, td.desc { text-align: start; }
    th.price, td.price { text-align: end; white-space: nowrap; }
    td { padding: 3px 0; vertical-align: top; }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; margin: 2px 0; }
    .total { font-size: 14px; font-weight: 700; margin-top: 6px; }
    .thanks { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin: 10px 0 6px; }
    .social-title { text-align: center; font-size: 11px; margin-bottom: 6px; }
    .social-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
    .social-item { width: 72px; text-align: center; }
    .social-icon { width: 14px; height: 14px; display: block; margin: 0 auto 2px; }
    .social-qr { width: 64px; height: 64px; display: block; margin: 0 auto; }
    .social-label { font-size: 9px; margin-top: 2px; }
    #barcode { margin: 8px auto 4px; display: block; max-width: 100%; }
    .brand { margin-top: 10px; padding-top: 4px; }
    .brand img { width: 28px; height: 28px; display: block; margin: 0 auto 4px; }
    .brand-name { font-size: 11px; font-weight: 700; color: ${w}; }
    .brand-tag { font-size: 9px; color: #555; }
    .support-line { font-size: 9px; color: #444; margin-top: 6px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      ${l}
      <p class="shop">${re(e.businessName)}</p>
      ${p.map((I) => `<p class="muted">${I}</p>`).join("")}
      ${(S = e.receiptHeader) != null && S.trim() ? `<p class="muted" style="margin-top:6px;white-space:pre-wrap">${re(e.receiptHeader.trim())}</p>` : ""}
    </div>
    ${ir()}
    <div class="center title">${re(c)}</div>
    ${ir()}
    <div class="row"><span>${re(r.invoice)}</span><span>${re(e.invoiceNo)}</span></div>
    <div class="row"><span>${re(r.date)}</span><span>${re(v)}</span></div>
    ${e.customerName ? `<div class="row"><span>${re(r.customer)}</span><span>${re(e.customerName)}</span></div>` : ""}
    ${e.cashierName ? `<div class="row"><span>${re(r.cashier)}</span><span>${re(e.cashierName)}</span></div>` : ""}
    ${e.printedByName ? `<div class="row"><span>${re(r.printedBy)}</span><span>${re(e.printedByName)}</span></div>` : ""}
    ${ir()}
    <table>
      <thead>
        <tr>
          <th class="desc">${re(r.description)}</th>
          <th class="price">${re(r.price)}</th>
        </tr>
      </thead>
      <tbody>${d}</tbody>
    </table>
    ${ir()}
    ${e.discount > 0 ? `<div class="row"><span>${re(r.subtotal)}</span><span>${s} ${e.subtotal.toFixed(2)}</span></div>
    <div class="row"><span>${re(r.discount)}</span><span>- ${s} ${e.discount.toFixed(2)}</span></div>` : ""}
    <div class="row total"><span>${re(r.total)}</span><span>${s} ${e.total.toFixed(2)}</span></div>
    ${f}
    ${_ > 0 ? `<div class="row"><span>${re(r.change)}</span><span>${s} ${_.toFixed(2)}</span></div>` : ""}
    ${E}
    ${ir()}
    <div class="center thanks" style="white-space:pre-wrap">${re(
    ((L = e.receiptFooter) == null ? void 0 : L.trim()) || r.thankYou
  )}</div>
    <div class="center support-line">${re(r.customSoftwareSupport)}</div>
    <svg id="barcode"></svg>
    <div class="center brand">
      <img src="${h}" alt="Kaarobar" />
      <div class="brand-name">Kaarobar</div>
      <div class="brand-tag">${re(r.poweredBy)}</div>
    </div>
  </div>
  <script>${b}<\/script>
  <script>
    try {
      JsBarcode("#barcode", ${m}, {
        format: "CODE128",
        width: 1.4,
        height: 40,
        displayValue: true,
        fontSize: 11,
        margin: 0
      });
    } catch (e) {}
  <\/script>
</body>
</html>`;
}
function ue(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function n0(e) {
  try {
    const t = M.readFileSync(e), r = F.extname(e).toLowerCase().replace(".", "") || "png";
    return `data:${r === "jpg" || r === "jpeg" ? "image/jpeg" : r === "webp" ? "image/webp" : r === "svg" ? "image/svg+xml" : "image/png"};base64,${t.toString("base64")}`;
  } catch {
    return null;
  }
}
function s0(e) {
  const t = e.language ?? Ke(), r = _h(t), i = sa(t), s = on(e.currency), n = In(e.brandColor);
  let a = "";
  if (e.logoPath)
    try {
      const u = n0(Jr(e.logoPath));
      u && (a = `<img class="logo" src="${u}" alt="" />`);
    } catch {
      a = "";
    }
  const o = e.items.map(
    (u) => `
      <tr>
        <td>${ue(u.productName)}</td>
        <td class="num">${u.orderedQty}</td>
        <td class="num">${s} ${u.unitCost.toFixed(2)}</td>
        <td class="num">${s} ${u.lineTotal.toFixed(2)}</td>
      </tr>`
  ).join(""), c = ka(n);
  return `<!DOCTYPE html>
<html lang="${i.lang}" dir="${i.dir}">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${i.fontLink}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: ${i.fontFamily};
      color: #111;
      background: #fff;
      max-width: 720px;
    }
    .center { text-align: center; }
    .logo { max-height: 56px; max-width: 160px; display: block; margin: 0 auto 8px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 14px; letter-spacing: 0.5px; margin: 16px 0 8px; }
    .muted { font-size: 12px; color: #333; margin: 2px 0; }
    .meta { margin: 12px 0; font-size: 12px; }
    .meta div { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ccc; padding: 6px 4px; text-align: start; }
    th.num, td.num { text-align: end; white-space: nowrap; }
    .total { font-size: 14px; font-weight: 700; margin-top: 12px; display: flex; justify-content: space-between; gap: 8px; }
    .brand { margin-top: 28px; text-align: center; }
    .brand img { width: 28px; height: 28px; display: block; margin: 0 auto 4px; }
    .brand-name { font-size: 11px; font-weight: 700; color: ${n}; }
    .brand-tag { font-size: 9px; color: #555; }
  </style>
</head>
<body>
  <div class="center">
    ${a}
    <h1>${ue(e.businessName)}</h1>
    <p class="muted">${ue(e.branchName)}</p>
  </div>
  <h2 class="center">${ue(r.purchaseOrder)}</h2>
  <div class="meta">
    <div><span>${ue(r.poNumber)}</span><span>${ue(e.poNumber)}</span></div>
    <div><span>${ue(r.date)}</span><span>${ue(e.orderDate)}</span></div>
    <div><span>${ue(r.status)}</span><span>${ue(e.status)}</span></div>
  </div>
  <div class="meta">
    <div><span>${ue(r.supplier)}</span><span>${ue(e.supplierName)}</span></div>
    ${e.supplierPhone ? `<div><span>${ue(r.phone)}</span><span>${ue(e.supplierPhone)}</span></div>` : ""}
    ${e.supplierAddress ? `<div><span>${ue(r.address)}</span><span>${ue(e.supplierAddress)}</span></div>` : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th>${ue(r.product)}</th>
        <th class="num">${ue(r.qty)}</th>
        <th class="num">${ue(r.unitCost)}</th>
        <th class="num">${ue(r.total)}</th>
      </tr>
    </thead>
    <tbody>${o}</tbody>
  </table>
  <div class="total"><span>${ue(r.total)}</span><span>${s} ${e.total.toFixed(2)}</span></div>
  <div class="brand">
    <img src="${c}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
    <div class="brand-tag">${ue(r.poweredBy)}</div>
  </div>
</body>
</html>`;
}
function te(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function a0(e) {
  try {
    const t = M.readFileSync(e), r = F.extname(e).toLowerCase().replace(".", "") || "png";
    return `data:${r === "jpg" || r === "jpeg" ? "image/jpeg" : r === "webp" ? "image/webp" : r === "svg" ? "image/svg+xml" : "image/png"};base64,${t.toString("base64")}`;
  } catch {
    return null;
  }
}
function Ut(e, t) {
  return `${e} ${t.toFixed(2)}`;
}
function o0(e) {
  var r;
  if (!e) return "";
  const t = e.match(/^method:(cash|card)(?:\s*\|\s*(.*))?$/i);
  return t ? ((r = t[2]) == null ? void 0 : r.trim()) || "" : e.trim();
}
function c0(e, t) {
  const i = [e.type === "sale" ? t.sale : e.type === "payment" ? t.payment : e.type === "adjustment" ? t.adjustment : t.opening];
  e.invoiceNo && i.push(e.invoiceNo), e.method === "cash" && i.push(t.cash), e.method === "card" && i.push(t.card);
  const s = o0(e.note);
  return s && i.push(s), i.join(" · ");
}
function u0(e) {
  const t = e.language ?? Ke(), r = Eh(t), i = sa(t), s = on(e.currency), n = In(e.brandColor);
  let a = "";
  if (e.logoPath)
    try {
      const _ = a0(Jr(e.logoPath));
      _ && (a = `<img class="logo" src="${_}" alt="" />`);
    } catch {
      a = "";
    }
  const o = e.from || e.to ? `${e.from || "…"} → ${e.to || "…"}` : r.allEntries;
  let c = 0, u = 0;
  const l = e.entries.map((_) => {
    const E = _.amount > 0 ? _.amount : 0, w = _.amount < 0 ? Math.abs(_.amount) : 0;
    return c += E, u += w, `
      <tr>
        <td>${te(Ki(_.createdAt, t))}</td>
        <td>${te(c0(_, r))}</td>
        <td class="num">${E ? te(Ut(s, E)) : ""}</td>
        <td class="num">${w ? te(Ut(s, w)) : ""}</td>
        <td class="num">${te(Ut(s, _.balanceAfter))}</td>
      </tr>`;
  }).join(""), p = e.entries.length > 0 ? e.entries[e.entries.length - 1].balanceAfter : e.openingBalance, d = ka(n), f = !!(e.from || e.to) || e.openingBalance !== 0;
  return `<!DOCTYPE html>
<html lang="${i.lang}" dir="${i.dir}">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${i.fontLink}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: ${i.fontFamily};
      color: #111;
      background: #fff;
      max-width: 900px;
    }
    .center { text-align: center; }
    .logo { max-height: 56px; max-width: 160px; display: block; margin: 0 auto 8px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 15px; letter-spacing: 0.6px; margin: 14px 0 8px; }
    .muted { font-size: 12px; color: #333; margin: 2px 0; }
    .meta { margin: 12px 0; font-size: 12px; }
    .meta div { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
      margin-top: 8px;
      border: 1px solid #222;
    }
    th, td {
      border: 1px solid #999;
      padding: 7px 6px;
      text-align: start;
      vertical-align: top;
    }
    th {
      background: #f3f3f3;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-size: 10.5px;
    }
    th.num, td.num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; }
    tr.opening td { background: #fafafa; font-style: italic; }
    tr.totals td { font-weight: 700; background: #f7f7f7; }
    .closing {
      margin-top: 12px;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-top: 2px solid #222;
      padding-top: 8px;
    }
    .brand { margin-top: 28px; text-align: center; }
    .brand img { width: 28px; height: 28px; display: block; margin: 0 auto 4px; }
    .brand-name { font-size: 11px; font-weight: 700; color: ${n}; }
    .brand-tag { font-size: 9px; color: #555; }
  </style>
</head>
<body>
  <div class="center">
    ${a}
    <h1>${te(e.businessName)}</h1>
  </div>
  <h2 class="center">${te(r.title)}</h2>
  <div class="meta">
    <div><span>${te(r.customer)}</span><span>${te(e.customerName)}</span></div>
    ${e.customerPhone ? `<div><span>${te(r.phone)}</span><span>${te(e.customerPhone)}</span></div>` : ""}
    <div><span>${te(r.period)}</span><span>${te(o)}</span></div>
    <div><span>${te(r.printedAt)}</span><span>${te(Ki((/* @__PURE__ */ new Date()).toISOString(), t))}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${te(r.date)}</th>
        <th>${te(r.particulars)}</th>
        <th class="num">${te(r.debit)}</th>
        <th class="num">${te(r.credit)}</th>
        <th class="num">${te(r.balance)}</th>
      </tr>
    </thead>
    <tbody>
      ${f ? `<tr class="opening">
        <td></td>
        <td>${te(r.balanceBroughtForward)}</td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num">${te(Ut(s, e.openingBalance))}</td>
      </tr>` : ""}
      ${l}
      <tr class="totals">
        <td colspan="2">${te(r.totals)}</td>
        <td class="num">${te(Ut(s, c))}</td>
        <td class="num">${te(Ut(s, u))}</td>
        <td class="num"></td>
      </tr>
    </tbody>
  </table>
  <div class="closing">
    <span>${te(r.closingBalance)}</span>
    <span>${te(Ut(s, p))}</span>
  </div>
  <div class="brand">
    <img src="${d}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
    <div class="brand-tag">${te(r.poweredBy)}</div>
  </div>
</body>
</html>`;
}
function Di(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function l0(e, t) {
  const r = F.join(tt(), "preview");
  M.mkdirSync(r, { recursive: !0 });
  const i = F.join(r, `${e}-${Date.now()}.html`);
  return M.writeFileSync(i, t, "utf8"), i;
}
function d0(e) {
  const t = Th(Ke()), r = `
<style id="kaarobar-print-preview-style">
  #kaarobar-print-toolbar {
    position: fixed;
    inset-inline: 0;
    top: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(15, 23, 42, 0.94);
    color: #f8fafc;
    font-family: ui-sans-serif, system-ui, sans-serif;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
  }
  #kaarobar-print-toolbar .hint {
    font-size: 12px;
    opacity: 0.85;
    min-width: 0;
  }
  #kaarobar-print-toolbar .actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  #kaarobar-print-toolbar button {
    appearance: none;
    border: 0;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  #kaarobar-print-toolbar button.print {
    background: #2d6df6;
    color: #fff;
  }
  #kaarobar-print-toolbar button.close {
    background: #e2e8f0;
    color: #0f172a;
  }
  body {
    padding-top: 58px !important;
  }
  @media print {
    #kaarobar-print-toolbar,
    #kaarobar-print-preview-style {
      display: none !important;
    }
    body {
      padding-top: 0 !important;
    }
  }
</style>
<div id="kaarobar-print-toolbar" role="toolbar" aria-label="${Di(t.previewHint)}">
  <div class="hint">${Di(t.previewHint)}</div>
  <div class="actions">
    <button type="button" class="close" onclick="window.close()">${Di(t.close)}</button>
    <button type="button" class="print" onclick="window.print()">${Di(t.print)}</button>
  </div>
</div>`;
  return /<\/body>/i.test(e) ? e.replace(/<\/body>/i, `${r}</body>`) : `${e}${r}`;
}
function xa(e) {
  const t = d0(e.html), r = l0(e.filePrefix, t);
  return new Gr({
    show: !0,
    width: e.width ?? 720,
    height: e.height ?? 900,
    autoHideMenuBar: !0,
    title: e.title ?? "Preview",
    webPreferences: { sandbox: !0, contextIsolation: !0 }
  }).loadFile(r), { ok: !0 };
}
const f0 = Js(import.meta.url);
function y() {
  return We(), ft(he()), he();
}
function ce() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function ee(e) {
  y().prepare(
    `INSERT INTO activity_log (id, business_id, actor_user_id, entity_type, entity_id, action, summary, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    ae(),
    e.businessId,
    e.actorUserId,
    e.entityType,
    e.entityId,
    e.action,
    e.summary,
    e.payload ? JSON.stringify(e.payload) : null,
    ce()
  );
}
function Wd(e, t) {
  if (!Number.isFinite(e) || e < 0)
    throw new Error("Sale price must be >= 0");
  if (t != null && (!Number.isFinite(t) || t < 0))
    throw new Error("Cost price must be >= 0");
  if (t != null && e < t)
    throw new Error("Sale price must be greater than or equal to cost price");
}
function Da(e) {
  var r;
  const t = e.kind || "item";
  return {
    id: e.id,
    businessId: e.business_id,
    branchId: e.branch_id,
    name: e.name,
    barcode: e.barcode,
    price: e.price,
    costPrice: e.cost_price,
    stockQty: e.stock_qty,
    kind: t,
    tracksStock: e.tracks_stock == null ? Ml(t) : !!e.tracks_stock,
    kitchenStation: ((r = e.kitchen_station) == null ? void 0 : r.trim()) || "main",
    imagePath: e.image_path,
    isActive: !!e.is_active
  };
}
function pt(e) {
  const t = y().prepare("SELECT business_nature FROM businesses WHERE id = ?").get(e);
  return oi(t == null ? void 0 : t.business_nature);
}
function h0(e) {
  return {
    linkId: e.link_id,
    supplierId: e.supplier_id,
    productId: e.product_id,
    unitCost: e.unit_cost,
    product: Da(e)
  };
}
function p0(e) {
  return {
    id: e.id,
    businessId: e.business_id,
    actorUserId: e.actor_user_id,
    actorName: e.actor_name,
    entityType: e.entity_type,
    entityId: e.entity_id,
    action: e.action,
    summary: e.summary,
    payloadJson: e.payload_json,
    createdAt: e.created_at
  };
}
function Gs(e, t) {
  return ie(), y().prepare(
    `SELECT a.id, a.business_id, a.actor_user_id, u.name as actor_name, a.entity_type, a.entity_id,
              a.action, a.summary, a.payload_json, a.created_at
       FROM activity_log a
       JOIN users u ON u.id = a.actor_user_id
       WHERE a.entity_type = ? AND a.entity_id = ?
       ORDER BY a.created_at DESC`
  ).all(e, t).map(p0);
}
function _0() {
  const e = ie();
  return (e.role === "owner" ? y().prepare(
    `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
                  social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
                  receipt_header, receipt_footer
           FROM businesses ORDER BY created_at DESC`
  ).all() : y().prepare(
    `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
                  social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
                  receipt_header, receipt_footer
           FROM businesses WHERE id = ?`
  ).all(e.businessId)).map(zd);
}
function zd(e) {
  return {
    id: e.id,
    name: e.name,
    currency: e.currency,
    brandColor: e.brand_color,
    businessNature: oi(e.business_nature),
    logoPath: e.logo_path,
    socialWhatsapp: e.social_whatsapp,
    socialInstagram: e.social_instagram,
    socialFacebook: e.social_facebook,
    socialTiktok: e.social_tiktok,
    socialWebsite: e.social_website,
    receiptHeader: e.receipt_header ?? null,
    receiptFooter: e.receipt_footer ?? null,
    isActive: !!e.is_active
  };
}
function Ie(e) {
  return (e == null ? void 0 : e.trim()) || "" || null;
}
function E0(e) {
  var l;
  const t = X("business:edit");
  if (y().prepare("SELECT id FROM businesses LIMIT 1").get())
    throw new Error(
      "This installation already has a business. Only one business is supported."
    );
  const i = ae(), s = ce(), n = ((l = e.logoPath) == null ? void 0 : l.trim()) || null, a = oi(e.businessNature), o = {
    socialWhatsapp: Ie(e.socialWhatsapp),
    socialInstagram: Ie(e.socialInstagram),
    socialFacebook: Ie(e.socialFacebook),
    socialTiktok: Ie(e.socialTiktok),
    socialWebsite: Ie(e.socialWebsite)
  }, c = Ie(e.receiptHeader), u = Ie(e.receiptFooter) ?? "Thank you for shopping with us";
  return y().prepare(
    `INSERT INTO businesses (
         id, owner_id, name, currency, brand_color, business_nature, logo_path,
         social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
         receipt_header, receipt_footer,
         is_active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    i,
    t.id,
    e.name.trim(),
    e.currency.trim() || "PKR",
    e.brandColor,
    a,
    n,
    o.socialWhatsapp,
    o.socialInstagram,
    o.socialFacebook,
    o.socialTiktok,
    o.socialWebsite,
    c,
    u,
    s,
    s
  ), ee({
    businessId: i,
    actorUserId: t.id,
    entityType: "business",
    entityId: i,
    action: "created",
    summary: `Created business ${e.name.trim()}`
  }), {
    id: i,
    name: e.name.trim(),
    currency: e.currency.trim() || "PKR",
    brandColor: e.brandColor,
    businessNature: a,
    logoPath: n,
    ...o,
    receiptHeader: c,
    receiptFooter: u,
    isActive: !0
  };
}
function m0(e) {
  var a;
  const t = X("business:edit");
  $(e.id);
  const r = e.logoPath === void 0 ? void 0 : ((a = e.logoPath) == null ? void 0 : a.trim()) || null, i = e.businessNature === void 0 ? void 0 : oi(e.businessNature), s = {
    socialWhatsapp: Ie(e.socialWhatsapp),
    socialInstagram: Ie(e.socialInstagram),
    socialFacebook: Ie(e.socialFacebook),
    socialTiktok: Ie(e.socialTiktok),
    socialWebsite: Ie(e.socialWebsite)
  };
  if (r === void 0 ? i === void 0 ? y().prepare(
    `UPDATE businesses SET name = ?, currency = ?, brand_color = ?,
           social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
           WHERE id = ?`
  ).run(
    e.name.trim(),
    e.currency.trim() || "PKR",
    e.brandColor,
    s.socialWhatsapp,
    s.socialInstagram,
    s.socialFacebook,
    s.socialTiktok,
    s.socialWebsite,
    e.id
  ) : y().prepare(
    `UPDATE businesses SET name = ?, currency = ?, brand_color = ?, business_nature = ?,
           social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
           WHERE id = ?`
  ).run(
    e.name.trim(),
    e.currency.trim() || "PKR",
    e.brandColor,
    i,
    s.socialWhatsapp,
    s.socialInstagram,
    s.socialFacebook,
    s.socialTiktok,
    s.socialWebsite,
    e.id
  ) : i === void 0 ? y().prepare(
    `UPDATE businesses SET name = ?, currency = ?, brand_color = ?, logo_path = ?,
         social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
         WHERE id = ?`
  ).run(
    e.name.trim(),
    e.currency.trim() || "PKR",
    e.brandColor,
    r,
    s.socialWhatsapp,
    s.socialInstagram,
    s.socialFacebook,
    s.socialTiktok,
    s.socialWebsite,
    e.id
  ) : y().prepare(
    `UPDATE businesses SET name = ?, currency = ?, brand_color = ?, business_nature = ?, logo_path = ?,
         social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
         WHERE id = ?`
  ).run(
    e.name.trim(),
    e.currency.trim() || "PKR",
    e.brandColor,
    i,
    r,
    s.socialWhatsapp,
    s.socialInstagram,
    s.socialFacebook,
    s.socialTiktok,
    s.socialWebsite,
    e.id
  ), e.receiptHeader !== void 0 || e.receiptFooter !== void 0) {
    const o = y().prepare(
      "SELECT receipt_header, receipt_footer FROM businesses WHERE id = ?"
    ).get(e.id);
    y().prepare(
      "UPDATE businesses SET receipt_header = ?, receipt_footer = ? WHERE id = ?"
    ).run(
      e.receiptHeader !== void 0 ? Ie(e.receiptHeader) : o.receipt_header,
      e.receiptFooter !== void 0 ? Ie(e.receiptFooter) : o.receipt_footer,
      e.id
    );
  }
  const n = y().prepare(
    `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
              social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
              receipt_header, receipt_footer
       FROM businesses WHERE id = ?`
  ).get(e.id);
  return ee({
    businessId: e.id,
    actorUserId: t.id,
    entityType: "business",
    entityId: e.id,
    action: "updated",
    summary: `Updated business ${e.name.trim()}`
  }), zd(n);
}
function T0(e) {
  return $(e), j.set("lastBusinessId", e), { ok: !0 };
}
function g0(e) {
  return $(e), y().prepare(
    "SELECT id, business_id, name, address, phone, is_main_branch, is_active FROM branches WHERE business_id = ? ORDER BY created_at DESC"
  ).all(e).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    address: r.address,
    phone: r.phone,
    isMainBranch: !!r.is_main_branch,
    isActive: !!r.is_active
  }));
}
function b0(e) {
  var s, n, a, o;
  if (X("branch:edit"), $(e.businessId), y().prepare("SELECT id FROM branches WHERE business_id = ? LIMIT 1").get(e.businessId))
    throw new Error(
      "This business already has a branch. Only one branch is supported."
    );
  const r = ie(), i = ae();
  return y().prepare(
    `INSERT INTO branches (id, business_id, name, address, phone, is_main_branch, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?)`
  ).run(
    i,
    e.businessId,
    e.name.trim(),
    ((s = e.address) == null ? void 0 : s.trim()) || null,
    ((n = e.phone) == null ? void 0 : n.trim()) || null,
    ce()
  ), ee({
    businessId: e.businessId,
    actorUserId: r.id,
    entityType: "branch",
    entityId: i,
    action: "created",
    summary: `Created branch ${e.name.trim()}`
  }), {
    id: i,
    businessId: e.businessId,
    name: e.name.trim(),
    address: ((a = e.address) == null ? void 0 : a.trim()) || null,
    phone: ((o = e.phone) == null ? void 0 : o.trim()) || null,
    isMainBranch: !0,
    isActive: !0
  };
}
function v0(e) {
  var s, n, a, o;
  const t = X("branch:edit"), r = y().prepare(
    "SELECT business_id, is_main_branch, is_active FROM branches WHERE id = ?"
  ).get(e.id);
  if (!r) throw new Error("Branch not found");
  $(r.business_id);
  const i = e.isActive === void 0 ? r.is_active : e.isActive ? 1 : 0;
  return y().prepare(
    "UPDATE branches SET name = ?, address = ?, phone = ?, is_active = ? WHERE id = ?"
  ).run(
    e.name.trim(),
    ((s = e.address) == null ? void 0 : s.trim()) || null,
    ((n = e.phone) == null ? void 0 : n.trim()) || null,
    i,
    e.id
  ), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "branch",
    entityId: e.id,
    action: "updated",
    summary: `Updated branch ${e.name.trim()}`
  }), {
    id: e.id,
    businessId: r.business_id,
    name: e.name.trim(),
    address: ((a = e.address) == null ? void 0 : a.trim()) || null,
    phone: ((o = e.phone) == null ? void 0 : o.trim()) || null,
    isMainBranch: !!r.is_main_branch,
    isActive: !!i
  };
}
function y0(e) {
  return ie(), $(e), y().prepare(
    `SELECT id, name, email, role, business_id, branch_id, is_active FROM users
       WHERE business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?)
       ORDER BY created_at DESC`
  ).all(e, e).map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    businessId: r.business_id,
    branchId: r.branch_id,
    isActive: !!r.is_active
  }));
}
function w0(e) {
  const t = X("users:manage");
  if ($(e.businessId), t.role !== "owner" && e.role === "admin")
    throw new Error("Only owner can create admins");
  e.branchId && gr(e.branchId);
  const r = ae(), i = dr.hashSync(e.password, 12);
  return y().prepare(
    `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    r,
    e.businessId,
    e.branchId,
    e.name.trim(),
    e.email.trim().toLowerCase(),
    i,
    e.role,
    ce()
  ), {
    id: r,
    name: e.name.trim(),
    email: e.email.trim().toLowerCase(),
    role: e.role,
    businessId: e.businessId,
    branchId: e.branchId,
    isActive: !0
  };
}
function S0(e) {
  X("users:manage");
  const t = y().prepare("SELECT business_id FROM users WHERE id = ?").get(e.userId);
  if (!t) throw new Error("User not found");
  return $(t.business_id), y().prepare("UPDATE users SET is_active = ? WHERE id = ?").run(e.isActive ? 1 : 0, e.userId), { ok: !0 };
}
function R0(e) {
  var c, u, l, p;
  const t = ie(), r = y().prepare(
    "SELECT id, name, email, role, business_id, branch_id, password_hash, image_path FROM users WHERE id = ?"
  ).get(t.id);
  if (!r) throw new Error("User not found");
  const i = ((c = e.name) == null ? void 0 : c.trim()) || r.name;
  if (!i) throw new Error("Name is required");
  const s = e.imagePath === void 0 ? r.image_path : ((u = e.imagePath) == null ? void 0 : u.trim()) || null;
  let n = r.password_hash;
  const a = ((l = e.newPassword) == null ? void 0 : l.trim()) || "";
  if (!!a) {
    if (t.role !== "owner")
      throw new Error("Only owner can change password from settings");
    if (!((p = e.currentPassword) != null && p.trim()))
      throw new Error("Current password is required");
    if (!dr.compareSync(e.currentPassword, r.password_hash))
      throw new Error("Current password is incorrect");
    if (a.length < 8)
      throw new Error("Password must be at least 8 characters");
    n = dr.hashSync(a, 12);
  }
  return y().prepare(
    "UPDATE users SET name = ?, image_path = ?, password_hash = ? WHERE id = ?"
  ).run(i, s, n, t.id), t.name = i, t.imagePath = s, {
    id: r.id,
    name: i,
    email: r.email,
    role: r.role,
    businessId: r.business_id,
    branchId: r.branch_id,
    imagePath: s
  };
}
function N0(e) {
  return G(), $(e), y().prepare(
    `SELECT id, business_id, branch_id, name, barcode, price, cost_price, stock_qty, kind, tracks_stock,
              kitchen_station, image_path, is_active
       FROM products WHERE business_id = ? ORDER BY created_at DESC`
  ).all(e).map(Da);
}
function I0(e) {
  var u, l, p;
  G(), X("products:edit"), $(e.businessId), e.branchId && gr(e.branchId), Wd(e.price, e.costPrice ?? null);
  const t = pt(e.businessId), r = e.kind ?? "item";
  if (!$l(t, r))
    throw new Error(
      `Product kind "${r}" is not allowed for this business type`
    );
  const i = e.tracksStock === void 0 ? Ml(r) : !!e.tracksStock;
  if (i && r !== "item")
    throw new Error("Only item products can track stock");
  const s = ie(), n = ae(), a = ce(), o = ((u = e.imagePath) == null ? void 0 : u.trim()) || null, c = i ? e.stockQty ?? 0 : 0;
  return y().prepare(
    `INSERT INTO products (id, business_id, branch_id, category_id, name, sku, barcode, price, cost_price, stock_qty, kind, tracks_stock, unit, image_path, is_active, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, 'pcs', ?, ?, ?, ?)`
  ).run(
    n,
    e.businessId,
    e.branchId,
    e.name.trim(),
    ((l = e.barcode) == null ? void 0 : l.trim()) || null,
    e.price,
    e.costPrice ?? null,
    c,
    r,
    i ? 1 : 0,
    o,
    e.isActive === !1 ? 0 : 1,
    a,
    a
  ), ee({
    businessId: e.businessId,
    actorUserId: s.id,
    entityType: "product",
    entityId: n,
    action: "created",
    summary: `Created product ${e.name.trim()}`
  }), {
    id: n,
    businessId: e.businessId,
    branchId: e.branchId,
    name: e.name.trim(),
    barcode: ((p = e.barcode) == null ? void 0 : p.trim()) || null,
    price: e.price,
    costPrice: e.costPrice ?? null,
    stockQty: c,
    kind: r,
    tracksStock: i,
    kitchenStation: "main",
    imagePath: o,
    isActive: e.isActive !== !1
  };
}
function L0(e) {
  var u, l, p;
  G();
  const t = X("products:edit"), r = y().prepare(
    "SELECT business_id, branch_id, stock_qty, kind, tracks_stock, image_path FROM products WHERE id = ?"
  ).get(e.id);
  if (!r) throw new Error("Product not found");
  $(r.business_id), Wd(e.price, e.costPrice ?? null);
  const i = pt(r.business_id), s = e.kind ?? (r.kind || "item");
  if (!$l(i, s))
    throw new Error(
      `Product kind "${s}" is not allowed for this business type`
    );
  const n = e.tracksStock === void 0 ? !!r.tracks_stock : !!e.tracksStock;
  if (n && s !== "item")
    throw new Error("Only item products can track stock");
  const a = e.isActive === !1 ? 0 : 1, o = e.imagePath === void 0 ? r.image_path : ((u = e.imagePath) == null ? void 0 : u.trim()) || null, c = n ? e.stockQty ?? r.stock_qty : 0;
  return y().prepare(
    `UPDATE products SET name = ?, barcode = ?, price = ?, cost_price = ?, stock_qty = ?, kind = ?, tracks_stock = ?, image_path = ?, is_active = ?
       WHERE id = ?`
  ).run(
    e.name.trim(),
    ((l = e.barcode) == null ? void 0 : l.trim()) || null,
    e.price,
    e.costPrice ?? null,
    c,
    s,
    n ? 1 : 0,
    o,
    a,
    e.id
  ), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "product",
    entityId: e.id,
    action: "updated",
    summary: `Updated product ${e.name.trim()}`
  }), {
    id: e.id,
    businessId: r.business_id,
    branchId: r.branch_id,
    name: e.name.trim(),
    barcode: ((p = e.barcode) == null ? void 0 : p.trim()) || null,
    price: e.price,
    costPrice: e.costPrice ?? null,
    stockQty: c,
    kind: s,
    tracksStock: n,
    kitchenStation: "main",
    imagePath: o,
    isActive: !!a
  };
}
function A0(e) {
  G();
  const t = X("products:edit"), r = y().prepare("SELECT business_id, name FROM products WHERE id = ?").get(e.id);
  if (!r) throw new Error("Product not found");
  return $(r.business_id), y().prepare("UPDATE products SET is_active = ? WHERE id = ?").run(e.isActive ? 1 : 0, e.id), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "product",
    entityId: e.id,
    action: e.isActive ? "activated" : "deactivated",
    summary: `${e.isActive ? "Activated" : "Deactivated"} product ${r.name}`
  }), { ok: !0 };
}
function C0(e) {
  G();
  const t = X("products:edit"), r = y().prepare("SELECT business_id, name, is_active FROM products WHERE id = ?").get(e);
  if (!r) throw new Error("Product not found");
  $(r.business_id);
  const i = y().prepare("SELECT id FROM sale_items WHERE product_id = ? LIMIT 1").get(e), s = y().prepare("SELECT id FROM purchase_order_items WHERE product_id = ? LIMIT 1").get(e);
  return i || s ? (r.is_active && (y().prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(e), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "product",
    entityId: e,
    action: "deactivated",
    summary: `Deactivated product ${r.name} (used in history)`
  })), { ok: !0, mode: "deactivated" }) : (y().transaction(() => {
    y().prepare("DELETE FROM supplier_products WHERE product_id = ?").run(e), y().prepare("DELETE FROM products WHERE id = ?").run(e);
  })(), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "product",
    entityId: e,
    action: "deleted",
    summary: `Deleted product ${r.name}`
  }), { ok: !0, mode: "deleted" });
}
function O0(e) {
  const t = y().prepare("SELECT business_id FROM products WHERE id = ?").get(e);
  if (!t) throw new Error("Product not found");
  return $(t.business_id), y().prepare(
    `SELECT sp.id as link_id, sp.supplier_id, sp.unit_cost, s.name as supplier_name
       FROM supplier_products sp
       JOIN suppliers s ON s.id = sp.supplier_id
       WHERE sp.product_id = ?
       ORDER BY s.name ASC`
  ).all(e).map((i) => ({
    linkId: i.link_id,
    supplierId: i.supplier_id,
    supplierName: i.supplier_name,
    unitCost: i.unit_cost
  }));
}
function k0(e) {
  G(), X("products:edit"), $(e);
  for (let t = 0; t < 20; t += 1) {
    const r = `KB${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
    if (!y().prepare("SELECT id FROM products WHERE business_id = ? AND barcode = ?").get(e, r)) return { barcode: r };
  }
  throw new Error("Could not generate unique barcode");
}
function x0(e) {
  return $(e), y().prepare(
    "SELECT id, business_id, name, phone, address, notes, is_active FROM suppliers WHERE business_id = ? ORDER BY created_at DESC"
  ).all(e).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    notes: r.notes,
    isActive: !!r.is_active
  }));
}
function D0(e) {
  var i, s, n, a, o, c;
  X("suppliers:edit"), $(e.businessId);
  const t = ie(), r = ae();
  return y().prepare(
    `INSERT INTO suppliers (id, business_id, name, phone, address, notes, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    r,
    e.businessId,
    e.name.trim(),
    ((i = e.phone) == null ? void 0 : i.trim()) || null,
    ((s = e.address) == null ? void 0 : s.trim()) || null,
    ((n = e.notes) == null ? void 0 : n.trim()) || null,
    ce()
  ), ee({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "supplier",
    entityId: r,
    action: "created",
    summary: `Created supplier ${e.name.trim()}`
  }), {
    id: r,
    businessId: e.businessId,
    name: e.name.trim(),
    phone: ((a = e.phone) == null ? void 0 : a.trim()) || null,
    address: ((o = e.address) == null ? void 0 : o.trim()) || null,
    notes: ((c = e.notes) == null ? void 0 : c.trim()) || null,
    isActive: !0
  };
}
function U0(e) {
  var s, n, a, o, c, u;
  const t = X("suppliers:edit"), r = y().prepare("SELECT business_id FROM suppliers WHERE id = ?").get(e.id);
  if (!r) throw new Error("Supplier not found");
  $(r.business_id);
  const i = e.isActive === !1 ? 0 : 1;
  return y().prepare(
    "UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ?, is_active = ? WHERE id = ?"
  ).run(
    e.name.trim(),
    ((s = e.phone) == null ? void 0 : s.trim()) || null,
    ((n = e.address) == null ? void 0 : n.trim()) || null,
    ((a = e.notes) == null ? void 0 : a.trim()) || null,
    i,
    e.id
  ), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "supplier",
    entityId: e.id,
    action: "updated",
    summary: `Updated supplier ${e.name.trim()}`
  }), {
    id: e.id,
    businessId: r.business_id,
    name: e.name.trim(),
    phone: ((o = e.phone) == null ? void 0 : o.trim()) || null,
    address: ((c = e.address) == null ? void 0 : c.trim()) || null,
    notes: ((u = e.notes) == null ? void 0 : u.trim()) || null,
    isActive: !!i
  };
}
function Ar(e) {
  const t = y().prepare(
    "SELECT id, business_id, name, phone, address, notes, is_active FROM suppliers WHERE id = ?"
  ).get(e);
  if (!t) throw new Error("Supplier not found");
  return $(t.business_id), t;
}
function Ua(e) {
  return Ar(e), y().prepare(
    `SELECT sp.id as link_id, sp.supplier_id, sp.product_id, sp.unit_cost,
              p.id, p.business_id, p.branch_id, p.name, p.barcode, p.price, p.cost_price,
              p.stock_qty, p.kind, p.tracks_stock, p.image_path, p.is_active
       FROM supplier_products sp
       JOIN products p ON p.id = sp.product_id
       WHERE sp.supplier_id = ?
       ORDER BY p.name ASC`
  ).all(e).map(h0);
}
function P0(e) {
  const t = Ar(e);
  return {
    supplier: {
      id: t.id,
      businessId: t.business_id,
      name: t.name,
      phone: t.phone,
      address: t.address,
      notes: t.notes,
      isActive: !!t.is_active
    },
    products: Ua(e)
  };
}
function B0(e) {
  X("suppliers:edit");
  const t = Ar(e.supplierId);
  if (!Number.isFinite(e.unitCost) || e.unitCost < 0)
    throw new Error("Unit cost must be >= 0");
  const r = y().prepare(
    `SELECT id, business_id, branch_id, name, barcode, price, cost_price, stock_qty, kind, tracks_stock, image_path, is_active
       FROM products WHERE id = ?`
  ).get(e.productId);
  if (!r) throw new Error("Product not found");
  if (r.business_id !== t.business_id)
    throw new Error("Product and supplier must belong to the same business");
  if ($(r.business_id), y().prepare(
    "SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ?"
  ).get(e.supplierId, e.productId)) throw new Error("Product is already attached to this supplier");
  const s = ae();
  return y().prepare(
    `INSERT INTO supplier_products (id, supplier_id, product_id, unit_cost, created_at)
       VALUES (?, ?, ?, ?, ?)`
  ).run(
    s,
    e.supplierId,
    e.productId,
    e.unitCost,
    ce()
  ), {
    linkId: s,
    supplierId: e.supplierId,
    productId: e.productId,
    unitCost: e.unitCost,
    product: Da(r)
  };
}
function F0(e) {
  if (X("suppliers:edit"), Ar(e.supplierId), y().prepare(
    "DELETE FROM supplier_products WHERE supplier_id = ? AND product_id = ?"
  ).run(e.supplierId, e.productId).changes === 0)
    throw new Error("Product is not attached to this supplier");
  return { ok: !0 };
}
function M0(e) {
  if (X("suppliers:edit"), Ar(e.supplierId), !Number.isFinite(e.unitCost) || e.unitCost < 0)
    throw new Error("Unit cost must be >= 0");
  if (y().prepare(
    "UPDATE supplier_products SET unit_cost = ? WHERE supplier_id = ? AND product_id = ?"
  ).run(e.unitCost, e.supplierId, e.productId).changes === 0)
    throw new Error("Product is not attached to this supplier");
  const r = Ua(e.supplierId).find(
    (i) => i.productId === e.productId
  );
  if (!r) throw new Error("Product is not attached to this supplier");
  return r;
}
function $0(e) {
  return $(e), y().prepare(
    "SELECT id, business_id, branch_id, supplier_id, po_number, status, order_date FROM purchase_orders WHERE business_id = ? ORDER BY created_at DESC"
  ).all(e).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    branchId: r.branch_id,
    supplierId: r.supplier_id,
    poNumber: r.po_number,
    status: r.status,
    orderDate: r.order_date
  }));
}
function H0(e) {
  var a;
  if (X("purchaseOrders:edit"), $(e.businessId), gr(e.branchId), Ar(e.supplierId).business_id !== e.businessId)
    throw new Error("Supplier does not belong to this business");
  if (!((a = e.items) != null && a.length)) throw new Error("Add at least one product line");
  const r = ae(), i = ie(), s = y().prepare(
    `INSERT INTO purchase_order_items (id, po_id, product_id, ordered_qty, received_qty, unit_cost, line_total)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  );
  return y().transaction(() => {
    y().prepare(
      `INSERT INTO purchase_orders (id, business_id, branch_id, supplier_id, po_number, status, order_date, expected_date, notes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'draft', ?, NULL, NULL, ?, ?)`
    ).run(
      r,
      e.businessId,
      e.branchId,
      e.supplierId,
      e.poNumber.trim(),
      e.orderDate,
      i.id,
      ce()
    );
    for (const o of e.items) {
      if (!Number.isFinite(o.orderedQty) || o.orderedQty <= 0)
        throw new Error("Ordered quantity must be greater than 0");
      if (!Number.isFinite(o.unitCost) || o.unitCost < 0)
        throw new Error("Unit cost must be >= 0");
      if (!y().prepare(
        "SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ?"
      ).get(e.supplierId, o.productId))
        throw new Error(
          "All products must be attached to the selected supplier"
        );
      const u = o.orderedQty * o.unitCost;
      s.run(
        ae(),
        r,
        o.productId,
        o.orderedQty,
        o.unitCost,
        u
      );
    }
  })(), ee({
    businessId: e.businessId,
    actorUserId: i.id,
    entityType: "purchase_order",
    entityId: r,
    action: "created",
    summary: `Created PO ${e.poNumber.trim()}`
  }), {
    id: r,
    businessId: e.businessId,
    branchId: e.branchId,
    supplierId: e.supplierId,
    poNumber: e.poNumber.trim(),
    status: "draft",
    orderDate: e.orderDate
  };
}
function qd(e) {
  const t = y().prepare(
    `SELECT po.id, po.business_id, po.branch_id, po.supplier_id, po.po_number, po.status, po.order_date,
              s.name as supplier_name, br.name as branch_name, b.name as business_name
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN branches br ON br.id = po.branch_id
       JOIN businesses b ON b.id = po.business_id
       WHERE po.id = ?`
  ).get(e);
  if (!t) throw new Error("Purchase order not found");
  $(t.business_id);
  const i = y().prepare(
    `SELECT poi.id, poi.product_id, p.name as product_name, poi.ordered_qty, poi.received_qty, poi.unit_cost, poi.line_total
       FROM purchase_order_items poi
       JOIN products p ON p.id = poi.product_id
       WHERE poi.po_id = ?
       ORDER BY p.name ASC`
  ).all(e).map((s) => ({
    id: s.id,
    productId: s.product_id,
    productName: s.product_name,
    orderedQty: s.ordered_qty,
    receivedQty: s.received_qty,
    unitCost: s.unit_cost,
    lineTotal: s.line_total
  }));
  return {
    po: {
      id: t.id,
      businessId: t.business_id,
      branchId: t.branch_id,
      supplierId: t.supplier_id,
      poNumber: t.po_number,
      status: t.status,
      orderDate: t.order_date
    },
    supplierName: t.supplier_name,
    branchName: t.branch_name,
    businessName: t.business_name,
    items: i,
    total: i.reduce((s, n) => s + n.lineTotal, 0)
  };
}
async function X0(e) {
  X("purchaseOrders:edit");
  const t = qd(e), r = y().prepare(
    "SELECT currency, logo_path, brand_color FROM businesses WHERE id = ?"
  ).get(t.po.businessId), i = y().prepare("SELECT phone, address FROM suppliers WHERE id = ?").get(t.po.supplierId), s = s0({
    businessName: t.businessName,
    currency: (r == null ? void 0 : r.currency) || "Rs",
    brandColor: (r == null ? void 0 : r.brand_color) ?? null,
    logoPath: (r == null ? void 0 : r.logo_path) ?? null,
    supplierName: t.supplierName,
    supplierPhone: (i == null ? void 0 : i.phone) ?? null,
    supplierAddress: (i == null ? void 0 : i.address) ?? null,
    branchName: t.branchName,
    poNumber: t.po.poNumber,
    orderDate: t.po.orderDate,
    status: t.po.status,
    items: t.items.map((n) => ({
      productName: n.productName,
      orderedQty: n.orderedQty,
      unitCost: n.unitCost,
      lineTotal: n.lineTotal
    })),
    total: t.total
  });
  return xa({
    html: s,
    filePrefix: "purchase-order",
    title: t.po.poNumber,
    width: 780,
    height: 920
  });
}
function W0(e) {
  return $(e), y().prepare(
    "SELECT id, business_id, name, phone, address, current_balance, is_active FROM customers WHERE business_id = ? ORDER BY created_at DESC"
  ).all(e).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    currentBalance: r.current_balance,
    isActive: !!r.is_active
  }));
}
function z0(e) {
  var a, o, c;
  const t = X("customers:edit");
  $(e.businessId);
  const r = ae(), i = ce(), s = Math.max(0, Number(e.amount ?? 0) || 0), n = ((a = e.address) == null ? void 0 : a.trim()) || null;
  if (y().prepare(
    `INSERT INTO customers (id, business_id, name, phone, address, opening_balance, current_balance, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    r,
    e.businessId,
    e.name.trim(),
    ((o = e.phone) == null ? void 0 : o.trim()) || null,
    n,
    s,
    s,
    i,
    i
  ), s > 0) {
    const u = ae();
    y().prepare(
      `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
         VALUES (?, ?, ?, NULL, 'opening', ?, ?, NULL, ?, ?, ?)`
    ).run(
      u,
      r,
      e.businessId,
      s,
      s,
      "Starting khata / opening balance",
      t.id,
      i
    );
  }
  return ee({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "customer",
    entityId: r,
    action: "created",
    summary: `Created customer ${e.name.trim()}`
  }), {
    id: r,
    businessId: e.businessId,
    name: e.name.trim(),
    phone: ((c = e.phone) == null ? void 0 : c.trim()) || null,
    address: n,
    currentBalance: s,
    isActive: !0
  };
}
function q0(e) {
  var s, n, a, o;
  const t = X("customers:edit"), r = y().prepare("SELECT business_id, current_balance FROM customers WHERE id = ?").get(e.id);
  if (!r) throw new Error("Customer not found");
  $(r.business_id);
  const i = e.isActive === !1 ? 0 : 1;
  return y().prepare(
    "UPDATE customers SET name = ?, phone = ?, address = ?, is_active = ? WHERE id = ?"
  ).run(
    e.name.trim(),
    ((s = e.phone) == null ? void 0 : s.trim()) || null,
    ((n = e.address) == null ? void 0 : n.trim()) || null,
    i,
    e.id
  ), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "customer",
    entityId: e.id,
    action: "updated",
    summary: `Updated customer ${e.name.trim()}`
  }), {
    id: e.id,
    businessId: r.business_id,
    name: e.name.trim(),
    phone: ((a = e.phone) == null ? void 0 : a.trim()) || null,
    address: ((o = e.address) == null ? void 0 : o.trim()) || null,
    currentBalance: r.current_balance,
    isActive: !!i
  };
}
function Kd(e) {
  ie();
  const t = y().prepare(
    "SELECT id, business_id, name, phone, address, current_balance, is_active FROM customers WHERE id = ?"
  ).get(e);
  if (!t) throw new Error("Customer not found");
  $(t.business_id);
  const r = y().prepare(
    `SELECT id, invoice_no, total, status, created_at
       FROM sales WHERE customer_id = ? ORDER BY created_at DESC`
  ).all(e), i = y().prepare(
    "SELECT method FROM payments WHERE sale_id = ?"
  ), s = y().prepare(
    `SELECT l.id, l.customer_id, l.business_id, l.branch_id, l.type, l.amount, l.balance_after,
              l.reference_sale_id, l.note, l.created_by, l.created_at, u.name as created_by_name
       FROM ledger_entries l
       LEFT JOIN users u ON u.id = l.created_by
       WHERE l.customer_id = ?
       ORDER BY l.created_at DESC, l.id DESC`
  ).all(e);
  return {
    customer: {
      id: t.id,
      businessId: t.business_id,
      name: t.name,
      phone: t.phone,
      address: t.address,
      currentBalance: t.current_balance,
      isActive: !!t.is_active
    },
    remainingBalance: t.current_balance,
    sales: r.map((n) => {
      const a = i.all(n.id);
      return {
        id: n.id,
        invoiceNo: n.invoice_no,
        total: n.total,
        status: n.status,
        createdAt: n.created_at,
        paymentMethods: [...new Set(a.map((o) => o.method))]
      };
    }),
    ledger: s.map((n) => {
      let a = null;
      if (n.type === "payment" && n.note) {
        const o = n.note.match(
          /^method:(cash|card)(?:\s*\|\s*(.*))?$/i
        );
        o && (a = o[1].toLowerCase());
      }
      return {
        id: n.id,
        customerId: n.customer_id,
        businessId: n.business_id,
        branchId: n.branch_id,
        type: n.type,
        amount: n.amount,
        balanceAfter: n.balance_after,
        referenceSaleId: n.reference_sale_id,
        note: n.note,
        createdBy: n.created_by,
        createdByName: n.created_by_name,
        createdAt: n.created_at,
        method: a
      };
    })
  };
}
function Ic(e) {
  const t = new Date(e);
  if (!Number.isFinite(t.getTime())) return e.slice(0, 10);
  const r = t.getFullYear(), i = String(t.getMonth() + 1).padStart(2, "0"), s = String(t.getDate()).padStart(2, "0");
  return `${r}-${i}-${s}`;
}
async function K0(e) {
  var l, p;
  G(), X("sales:print");
  const t = Kd(e.customerId), r = y().prepare(
    "SELECT name, currency, logo_path, brand_color FROM businesses WHERE id = ?"
  ).get(t.customer.businessId);
  if (!r) throw new Error("Business not found");
  const i = ((l = e.from) == null ? void 0 : l.trim()) || null, s = ((p = e.to) == null ? void 0 : p.trim()) || null;
  if (i && s && i > s) throw new Error("Invalid date range");
  const n = [...t.ledger].sort((d, f) => {
    const _ = d.createdAt.localeCompare(f.createdAt);
    return _ !== 0 ? _ : d.id.localeCompare(f.id);
  }), a = n.filter((d) => {
    const f = Ic(d.createdAt);
    return !(i && f < i || s && f > s);
  });
  let o = 0;
  if (i) {
    const d = n.filter((f) => Ic(f.createdAt) < i);
    d.length > 0 && (o = d[d.length - 1].balanceAfter);
  }
  const c = new Map(
    t.sales.map((d) => [d.id, d.invoiceNo])
  ), u = u0({
    businessName: r.name,
    currency: r.currency || "Rs",
    brandColor: r.brand_color,
    logoPath: r.logo_path,
    customerName: t.customer.name,
    customerPhone: t.customer.phone,
    from: i,
    to: s,
    openingBalance: o,
    entries: a.map((d) => ({
      createdAt: d.createdAt,
      type: d.type,
      amount: d.amount,
      balanceAfter: d.balanceAfter,
      note: d.note,
      method: d.method,
      invoiceNo: d.referenceSaleId ? c.get(d.referenceSaleId) ?? null : null
    }))
  });
  return xa({
    html: u,
    filePrefix: "customer-ledger",
    title: t.customer.name,
    width: 900,
    height: 960
  });
}
function Y0(e) {
  var l, p;
  const t = X("customers:edit"), r = Number(e.amount);
  if (!Number.isFinite(r) || r <= 0)
    throw new Error("Payment amount must be greater than 0");
  if (e.method !== "cash" && e.method !== "card")
    throw new Error("Payment method must be cash or card");
  const i = y().prepare(
    "SELECT id, business_id, name, current_balance FROM customers WHERE id = ?"
  ).get(e.customerId);
  if (!i) throw new Error("Customer not found");
  if ($(i.business_id), r > i.current_balance)
    throw new Error("Payment cannot exceed remaining credit balance");
  let s = ((l = e.branchId) == null ? void 0 : l.trim()) || null;
  s ? gr(s) : t.branchId && (s = t.branchId);
  const n = ae(), a = ce(), o = i.current_balance - r, c = ((p = e.note) == null ? void 0 : p.trim()) || "", u = c ? `method:${e.method} | ${c}` : `method:${e.method}`;
  return y().transaction(() => {
    y().prepare(
      "UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?"
    ).run(o, a, i.id), y().prepare(
      `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
         VALUES (?, ?, ?, ?, 'payment', ?, ?, NULL, ?, ?, ?)`
    ).run(
      n,
      i.id,
      i.business_id,
      s,
      -r,
      o,
      u,
      t.id,
      a
    );
  })(), ee({
    businessId: i.business_id,
    actorUserId: t.id,
    entityType: "customer",
    entityId: i.id,
    action: "payment_recorded",
    summary: `Recorded ${e.method} payment of ${r} for ${i.name}`
  }), {
    id: n,
    customerId: i.id,
    businessId: i.business_id,
    branchId: s,
    type: "payment",
    amount: -r,
    balanceAfter: o,
    referenceSaleId: null,
    note: u,
    createdBy: t.id,
    createdByName: t.name,
    createdAt: a,
    method: e.method
  };
}
function j0(e, t) {
  const r = y().prepare("SELECT name FROM businesses WHERE id = ?").get(e), i = y().prepare("SELECT name FROM branches WHERE id = ?").get(t);
  if (!r || !i) throw new Error("Business or branch not found");
  const s = $m(r.name, i.name), n = y().prepare(
    "SELECT invoice_no FROM sales WHERE business_id = ? AND invoice_no LIKE ?"
  ).all(e, `${s}%`);
  let a = 0;
  for (const o of n) {
    const c = Hm(o.invoice_no, s);
    c != null && c > a && (a = c);
  }
  return Mm(r.name, i.name, a + 1);
}
function G0(e) {
  var m, b, v, S, L;
  G(), X("sales:checkout"), $(e.businessId), gr(e.branchId);
  const t = ie();
  if (!e.items.length)
    throw new Error("Add at least one item to the sale");
  const r = pt(e.businessId), i = ((m = e.servedByUserId) == null ? void 0 : m.trim()) || null;
  let s = e.serviceMode ?? null, n = ((b = e.tableId) == null ? void 0 : b.trim()) || null;
  const a = ((v = e.ticketId) == null ? void 0 : v.trim()) || null;
  let o = ((S = e.riderUserId) == null ? void 0 : S.trim()) || null, c = e.deliveryStatus ?? null;
  const u = ((L = e.deliveryNotes) == null ? void 0 : L.trim()) || null, l = !!e.partialTicketBill;
  if (ym(r)) {
    if (!i) throw new Error("Served by staff is required");
    if (!y().prepare(
      `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
    ).get(i, e.businessId, e.businessId)) throw new Error("Selected staff member was not found");
  } else if (i)
    throw new Error("Served by is not used for this business type");
  if (vm(r)) {
    if (!s || !["dine_in", "takeaway", "delivery"].includes(s))
      throw new Error("Service mode is required");
    if (s === "dine_in") {
      if (!n) throw new Error("Table is required for dine-in");
      if (!y().prepare(
        "SELECT id FROM dining_tables WHERE id = ? AND business_id = ? AND is_active = 1"
      ).get(n, e.businessId)) throw new Error("Table not found");
    } else
      n = null;
  } else {
    if (s || n)
      throw new Error(
        "Tables and service modes are not used for this business type"
      );
    s = null, n = null;
  }
  if (a) {
    if (!Zt(r))
      throw new Error("Tickets are only available for food businesses");
    const I = y().prepare(
      `SELECT id, status, table_id, service_mode, rider_user_id, delivery_status, delivery_notes
         FROM pos_tickets WHERE id = ? AND business_id = ?`
    ).get(a, e.businessId);
    if (!I) throw new Error("Ticket not found");
    if (I.status !== "open") throw new Error("Ticket is no longer open");
    s = I.service_mode, n = I.table_id, o || (o = I.rider_user_id), c || (c = I.delivery_status);
  }
  if (s === "takeaway" || s === "delivery")
    if (o) {
      if (!y().prepare(
        `SELECT id FROM users
           WHERE id = ? AND is_active = 1
             AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
      ).get(o, e.businessId, e.businessId)) throw new Error("Rider not found");
      c || (c = "assigned");
    } else !c && s === "delivery" && (c = "pending");
  else
    o = null, c = null;
  const p = ae(), d = ce(), f = j0(e.businessId, e.branchId), _ = e.items.reduce(
    (I, O) => I + O.qty * O.unitPrice,
    0
  ), E = Math.max(0, Number(e.discount ?? 0));
  if (!Number.isFinite(E))
    throw new Error("Discount must be a valid number");
  if (E > _) throw new Error("Discount cannot exceed subtotal");
  const w = _ - E, h = e.payments.reduce((I, O) => I + O.amount, 0);
  return y().transaction(() => {
    for (const B of e.items) {
      if (!Number.isFinite(B.qty) || B.qty <= 0)
        throw new Error("Item quantity must be greater than 0");
      const q = y().prepare(
        "SELECT id, name, stock_qty, tracks_stock, is_active FROM products WHERE id = ? AND business_id = ?"
      ).get(B.productId, e.businessId);
      if (!q || !q.is_active)
        throw new Error("Product not found or inactive");
      if (q.tracks_stock && B.qty > q.stock_qty)
        throw new Error(`Insufficient stock for ${q.name}`);
      if (a && B.ticketItemId) {
        const ge = y().prepare(
          "SELECT id, product_id, qty, billed_qty FROM pos_ticket_items WHERE id = ? AND ticket_id = ?"
        ).get(B.ticketItemId, a);
        if (!ge) throw new Error("Ticket line not found");
        if (ge.product_id !== B.productId)
          throw new Error("Ticket line product mismatch");
        const _t = ge.qty - (ge.billed_qty || 0);
        if (B.qty > _t + 1e-9)
          throw new Error(
            `Cannot bill more than remaining qty for ${q.name}`
          );
      }
    }
    y().prepare(
      `INSERT INTO sales (
           id, business_id, branch_id, invoice_no, customer_id, cashier_id,
           subtotal, discount, tax, total, amount_paid, change_due, status,
           served_by_user_id, service_mode, table_id, rider_user_id, delivery_status, delivery_notes, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 'completed', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      p,
      e.businessId,
      e.branchId,
      f,
      e.customerId,
      t.id,
      _,
      E,
      w,
      h,
      i,
      s,
      n,
      o,
      c,
      u,
      d
    );
    const I = y().prepare(
      `INSERT INTO sale_items (id, sale_id, product_id, product_name_snapshot, qty, unit_price, discount, line_total, refunded_qty, price_rule_id)
       SELECT ?, ?, p.id, p.name, ?, ?, 0, ?, 0, ?
       FROM products p WHERE p.id = ?`
    ), O = y().prepare(
      "UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND tracks_stock = 1"
    ), P = y().prepare(
      "UPDATE pos_ticket_items SET billed_qty = billed_qty + ? WHERE id = ? AND ticket_id = ?"
    );
    for (const B of e.items)
      I.run(
        ae(),
        p,
        B.qty,
        B.unitPrice,
        B.qty * B.unitPrice,
        B.priceRuleId ?? null,
        B.productId
      ), O.run(B.qty, B.productId), a && B.ticketItemId && P.run(B.qty, B.ticketItemId, a);
    const H = y().prepare(
      "INSERT INTO payments (id, sale_id, method, amount, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    for (const B of e.payments)
      H.run(ae(), p, B.method, B.amount, d);
    const D = e.payments.filter((B) => B.method === "credit").reduce((B, q) => B + q.amount, 0);
    if (e.customerId && D > 0) {
      const q = y().prepare("SELECT current_balance FROM customers WHERE id = ?").get(e.customerId).current_balance + D;
      y().prepare("UPDATE customers SET current_balance = ? WHERE id = ?").run(q, e.customerId), y().prepare(
        `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
           VALUES (?, ?, ?, ?, 'sale', ?, ?, ?, 'Sale on credit', ?, ?)`
      ).run(
        ae(),
        e.customerId,
        e.businessId,
        e.branchId,
        D,
        q,
        p,
        t.id,
        d
      );
    }
    a && (l ? y().prepare(
      `SELECT COUNT(*) as c FROM pos_ticket_items
             WHERE ticket_id = ? AND billed_qty + 0.000001 < qty`
    ).get(a).c === 0 ? y().prepare(
      "UPDATE pos_tickets SET status = 'billed', updated_at = ? WHERE id = ? AND status = 'open'"
    ).run(d, a) : y().prepare("UPDATE pos_tickets SET updated_at = ? WHERE id = ?").run(d, a) : (y().prepare(
      "UPDATE pos_ticket_items SET billed_qty = qty WHERE ticket_id = ?"
    ).run(a), y().prepare(
      "UPDATE pos_tickets SET status = 'billed', updated_at = ? WHERE id = ? AND status = 'open'"
    ).run(d, a)));
  })(), ee({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "sale",
    entityId: p,
    action: "created",
    summary: `Sale ${f} completed`,
    payload: { total: w, itemCount: e.items.length }
  }), jr(p);
}
function Yd(e) {
  return {
    id: e.id,
    businessId: e.business_id,
    branchId: e.branch_id,
    invoiceNo: e.invoice_no,
    customerId: e.customer_id,
    cashierId: e.cashier_id,
    subtotal: e.subtotal,
    discount: e.discount,
    total: e.total,
    amountPaid: e.amount_paid,
    status: e.status,
    createdAt: e.created_at,
    servedByUserId: e.served_by_user_id,
    servedByName: e.served_by_name,
    serviceMode: e.service_mode,
    tableId: e.table_id,
    tableName: e.table_name,
    riderUserId: e.rider_user_id ?? null,
    riderName: e.rider_name ?? null,
    deliveryStatus: e.delivery_status ?? null,
    deliveryNotes: e.delivery_notes ?? null
  };
}
function jr(e) {
  const t = y().prepare(
    `SELECT s.id, s.business_id, s.branch_id, s.invoice_no, s.customer_id, s.cashier_id,
              s.subtotal, s.discount, s.total, s.amount_paid, s.status, s.created_at,
              s.served_by_user_id, u.name as served_by_name, s.service_mode, s.table_id, t.name as table_name,
              s.rider_user_id, r.name as rider_name, s.delivery_status, s.delivery_notes
       FROM sales s
       LEFT JOIN users u ON u.id = s.served_by_user_id
       LEFT JOIN users r ON r.id = s.rider_user_id
       LEFT JOIN dining_tables t ON t.id = s.table_id
       WHERE s.id = ?`
  ).get(e);
  if (!t) throw new Error("Sale not found");
  return Yd(t);
}
function V0(e) {
  return G(), $(e), y().prepare(
    `SELECT s.id, s.business_id, s.branch_id, s.invoice_no, s.customer_id, s.cashier_id,
              s.subtotal, s.discount, s.total, s.amount_paid, s.status, s.created_at,
              s.served_by_user_id, u.name as served_by_name, s.service_mode, s.table_id, t.name as table_name,
              s.rider_user_id, r.name as rider_name, s.delivery_status, s.delivery_notes
       FROM sales s
       LEFT JOIN users u ON u.id = s.served_by_user_id
       LEFT JOIN users r ON r.id = s.rider_user_id
       LEFT JOIN dining_tables t ON t.id = s.table_id
       WHERE s.business_id = ?
       ORDER BY s.created_at DESC`
  ).all(e).map(Yd);
}
function Qi(e) {
  const t = y().prepare(
    `SELECT r.id, r.sale_id, r.business_id, r.requested_by, ru.name as requested_by_name, r.reason, r.status,
              r.reviewed_by, rv.name as reviewed_by_name, r.reviewed_at, r.review_note, r.created_at
       FROM refund_requests r
       JOIN users ru ON ru.id = r.requested_by
       LEFT JOIN users rv ON rv.id = r.reviewed_by
       WHERE r.id = ?`
  ).get(e);
  if (!t) throw new Error("Refund request not found");
  const r = y().prepare(
    `SELECT i.id, i.sale_item_id, i.product_id, COALESCE(si.product_name_snapshot, p.name) as product_name, i.qty
       FROM refund_request_items i
       LEFT JOIN sale_items si ON si.id = i.sale_item_id
       LEFT JOIN products p ON p.id = i.product_id
       WHERE i.refund_request_id = ?`
  ).all(e);
  return {
    id: t.id,
    saleId: t.sale_id,
    businessId: t.business_id,
    requestedBy: t.requested_by,
    requestedByName: t.requested_by_name,
    reason: t.reason,
    status: t.status,
    reviewedBy: t.reviewed_by,
    reviewedByName: t.reviewed_by_name,
    reviewedAt: t.reviewed_at,
    reviewNote: t.review_note,
    createdAt: t.created_at,
    items: r.map((i) => ({
      id: i.id,
      saleItemId: i.sale_item_id,
      productId: i.product_id,
      productName: i.product_name,
      qty: i.qty
    }))
  };
}
function Z0(e) {
  G();
  const t = X("sales:refund_request");
  if (!e.reason.trim()) throw new Error("Refund reason is required");
  if (!e.items.length)
    throw new Error("Select at least one item to refund");
  const r = y().prepare("SELECT id, business_id, status FROM sales WHERE id = ?").get(e.saleId);
  if (!r) throw new Error("Sale not found");
  if ($(r.business_id), r.status === "void" || r.status === "refunded")
    throw new Error("Sale cannot be refunded");
  if (y().prepare(
    "SELECT id FROM refund_requests WHERE sale_id = ? AND status = 'pending'"
  ).get(e.saleId))
    throw new Error("A pending refund request already exists for this sale");
  const s = ae(), n = ce();
  return y().transaction(() => {
    y().prepare(
      `INSERT INTO refund_requests (id, sale_id, business_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)`
    ).run(
      s,
      e.saleId,
      r.business_id,
      t.id,
      e.reason.trim(),
      n
    );
    const a = y().prepare(
      `INSERT INTO refund_request_items (id, refund_request_id, sale_item_id, product_id, qty)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const o of e.items) {
      if (o.qty <= 0) throw new Error("Refund qty must be positive");
      const c = y().prepare(
        "SELECT id, product_id, qty, refunded_qty FROM sale_items WHERE id = ? AND sale_id = ?"
      ).get(o.saleItemId, e.saleId);
      if (!c) throw new Error("Sale item not found");
      const u = c.qty - (c.refunded_qty || 0);
      if (o.qty > u)
        throw new Error("Refund qty exceeds remaining quantity");
      a.run(
        ae(),
        s,
        c.id,
        c.product_id,
        o.qty
      );
    }
    ee({
      businessId: r.business_id,
      actorUserId: t.id,
      entityType: "sale",
      entityId: e.saleId,
      action: "refund_requested",
      summary: `Refund requested: ${e.reason.trim()}`,
      payload: { requestId: s, items: e.items }
    });
  })(), Qi(s);
}
function J0(e) {
  var a;
  G();
  const t = X("sales:refund_approve"), r = y().prepare(
    "SELECT id, sale_id, business_id, status, reason FROM refund_requests WHERE id = ?"
  ).get(e.id);
  if (!r) throw new Error("Refund request not found");
  if ($(r.business_id), r.status !== "pending")
    throw new Error("Refund request already reviewed");
  const i = ce();
  if (e.decision === "reject")
    return y().prepare(
      "UPDATE refund_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?"
    ).run(t.id, i, ((a = e.note) == null ? void 0 : a.trim()) || null, e.id), ee({
      businessId: r.business_id,
      actorUserId: t.id,
      entityType: "sale",
      entityId: r.sale_id,
      action: "refund_rejected",
      summary: `Refund rejected${e.note ? `: ${e.note}` : ""}`,
      payload: { requestId: e.id }
    }), Qi(e.id);
  const s = y().prepare("SELECT id, customer_id, status, total FROM sales WHERE id = ?").get(r.sale_id);
  if (!s) throw new Error("Sale not found");
  const n = y().prepare(
    "SELECT sale_item_id, product_id, qty FROM refund_request_items WHERE refund_request_id = ?"
  ).all(e.id);
  return y().transaction(() => {
    var f;
    const o = y().prepare(
      "UPDATE products SET stock_qty = stock_qty + ? WHERE id = ? AND tracks_stock = 1"
    ), c = y().prepare(
      "UPDATE sale_items SET refunded_qty = refunded_qty + ? WHERE id = ?"
    );
    let u = 0;
    for (const _ of n) {
      const E = y().prepare(
        "SELECT qty, refunded_qty, unit_price FROM sale_items WHERE id = ?"
      ).get(_.sale_item_id), w = E.qty - (E.refunded_qty || 0);
      if (_.qty > w)
        throw new Error("Refund qty no longer available");
      c.run(_.qty, _.sale_item_id), o.run(_.qty, _.product_id), u += _.qty * E.unit_price;
    }
    const d = y().prepare("SELECT qty, refunded_qty FROM sale_items WHERE sale_id = ?").all(r.sale_id).every((_) => _.refunded_qty >= _.qty) ? "refunded" : "partially_refunded";
    if (y().prepare("UPDATE sales SET status = ? WHERE id = ?").run(d, r.sale_id), s.customer_id && u > 0) {
      const E = y().prepare(
        "SELECT SUM(amount) as total FROM payments WHERE sale_id = ? AND method = 'credit'"
      ).get(r.sale_id).total ?? 0;
      if (E > 0) {
        const w = Math.min(u, E), m = y().prepare("SELECT current_balance FROM customers WHERE id = ?").get(s.customer_id).current_balance - w;
        y().prepare("UPDATE customers SET current_balance = ? WHERE id = ?").run(m, s.customer_id), y().prepare(
          `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
             VALUES (?, ?, ?, NULL, 'adjustment', ?, ?, ?, ?, ?, ?)`
        ).run(
          ae(),
          s.customer_id,
          r.business_id,
          -w,
          m,
          r.sale_id,
          `Refund approved: ${r.reason}`,
          t.id,
          i
        );
      }
    }
    y().prepare(
      "UPDATE refund_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?"
    ).run(t.id, i, ((f = e.note) == null ? void 0 : f.trim()) || null, e.id), ee({
      businessId: r.business_id,
      actorUserId: t.id,
      entityType: "sale",
      entityId: r.sale_id,
      action: "refund_approved",
      summary: `Refund approved (${d})`,
      payload: { requestId: e.id, refundAmount: u, items: n }
    });
  })(), Qi(e.id);
}
function Q0(e) {
  G(), ie();
  const t = jr(e);
  $(t.businessId);
  const r = y().prepare(
    `SELECT si.id, si.sale_id, si.product_id, si.product_name_snapshot, si.qty, si.unit_price, si.line_total,
              si.refunded_qty, si.price_rule_id, r.name as price_rule_name
       FROM sale_items si
       LEFT JOIN happy_hour_price_rules r ON r.id = si.price_rule_id
       WHERE si.sale_id = ?`
  ).all(e), i = y().prepare(
    "SELECT id, method, amount, created_at FROM payments WHERE sale_id = ?"
  ).all(e), s = y().prepare(
    "SELECT id FROM refund_requests WHERE sale_id = ? ORDER BY created_at DESC"
  ).all(e);
  return {
    sale: t,
    items: r.map(
      (n) => ({
        id: n.id,
        saleId: n.sale_id,
        productId: n.product_id,
        productName: n.product_name_snapshot,
        qty: n.qty,
        unitPrice: n.unit_price,
        lineTotal: n.line_total,
        refundedQty: n.refunded_qty || 0,
        refundableQty: n.qty - (n.refunded_qty || 0),
        priceRuleId: n.price_rule_id,
        priceRuleName: n.price_rule_name
      })
    ),
    payments: i.map((n) => ({
      id: n.id,
      method: n.method,
      amount: n.amount,
      createdAt: n.created_at
    })),
    refundRequests: s.map((n) => Qi(n.id)),
    activity: Gs("sale", e)
  };
}
function eb(e, t) {
  G(), $(e);
  const r = t.trim();
  if (!r) return null;
  const i = y().prepare(
    "SELECT id FROM sales WHERE business_id = ? AND invoice_no = ? LIMIT 1"
  ).get(e, r);
  return i ? jr(i.id) : null;
}
function tb(e) {
  var a, o;
  G(), X("sales:checkout");
  const t = ie(), r = jr(e.saleId);
  if ($(r.businessId), r.serviceMode !== "takeaway" && r.serviceMode !== "delivery")
    throw new Error("Delivery tracking is only for takeaway or delivery sales");
  const i = e.riderUserId === void 0 ? r.riderUserId : ((a = e.riderUserId) == null ? void 0 : a.trim()) || null;
  let s = e.deliveryStatus === void 0 ? r.deliveryStatus : e.deliveryStatus;
  const n = e.deliveryNotes === void 0 ? r.deliveryNotes : ((o = e.deliveryNotes) == null ? void 0 : o.trim()) || null;
  if (i) {
    if (!y().prepare(
      `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
    ).get(i, r.businessId, r.businessId)) throw new Error("Rider not found");
    (!s || s === "pending") && (s = "assigned");
  }
  return y().prepare(
    "UPDATE sales SET rider_user_id = ?, delivery_status = ?, delivery_notes = ? WHERE id = ?"
  ).run(i, s, n, e.saleId), ee({
    businessId: r.businessId,
    actorUserId: t.id,
    entityType: "sale",
    entityId: e.saleId,
    action: "delivery_updated",
    summary: `Delivery status ${s ?? "cleared"}`
  }), jr(e.saleId);
}
async function rb(e) {
  G(), X("sales:print");
  const t = ie(), r = y().prepare(
    `SELECT s.invoice_no, s.subtotal, s.discount, s.total, s.amount_paid, s.created_at, s.business_id, s.customer_id,
              b.name as business_name, b.currency, b.logo_path, b.brand_color,
              b.social_whatsapp, b.social_instagram, b.social_facebook, b.social_tiktok, b.social_website,
              b.receipt_header, b.receipt_footer,
              c.name as customer_name,
              cashier.name as cashier_name
       FROM sales s
       JOIN businesses b ON b.id = s.business_id
       LEFT JOIN customers c ON c.id = s.customer_id
       LEFT JOIN users cashier ON cashier.id = s.cashier_id
       WHERE s.id = ?`
  ).get(e);
  if (!r) throw new Error("Sale not found");
  $(r.business_id);
  const i = y().prepare(
    `SELECT address, phone FROM branches
       WHERE business_id = ? AND is_main_branch = 1
       ORDER BY created_at ASC LIMIT 1`
  ).get(r.business_id), s = y().prepare(
    "SELECT address, phone FROM branches WHERE business_id = ? ORDER BY created_at ASC LIMIT 1"
  ).get(r.business_id), n = i ?? s, a = y().prepare(
    "SELECT product_name_snapshot as product_name, qty, unit_price, line_total FROM sale_items WHERE sale_id = ? ORDER BY id"
  ).all(e), o = y().prepare("SELECT method, amount FROM payments WHERE sale_id = ?").all(e);
  let c = "";
  try {
    const d = f0.resolve("jsbarcode/dist/JsBarcode.all.min.js");
    c = M.readFileSync(d, "utf8");
  } catch {
    c = "";
  }
  const u = {
    invoiceNo: r.invoice_no,
    subtotal: r.subtotal,
    discount: r.discount,
    total: r.total,
    amountPaid: r.amount_paid,
    createdAt: r.created_at,
    businessName: r.business_name,
    currency: r.currency,
    brandColor: r.brand_color,
    logoPath: r.logo_path,
    customerName: r.customer_name,
    cashierName: r.cashier_name,
    printedByName: t.name,
    receiptHeader: r.receipt_header,
    receiptFooter: r.receipt_footer,
    branchAddress: (n == null ? void 0 : n.address) ?? null,
    branchPhone: (n == null ? void 0 : n.phone) ?? null,
    socialWhatsapp: r.social_whatsapp,
    socialInstagram: r.social_instagram,
    socialFacebook: r.social_facebook,
    socialTiktok: r.social_tiktok,
    socialWebsite: r.social_website,
    items: a.map((d) => ({
      productName: d.product_name,
      qty: d.qty,
      unitPrice: d.unit_price,
      lineTotal: d.line_total
    })),
    payments: o,
    jsBarcodeScript: c
  }, l = cn();
  if (l.posPrintEnabled)
    try {
      return await Ih(u), { ok: !0 };
    } catch (d) {
      console.error(
        `[receipt] POS print failed for ${r.invoice_no} (printer=${l.posPrinterName || "system default"}, paper=${l.posPaperWidth}); falling back to the HTML preview.`,
        d
      );
    }
  else
    console.info(
      "[receipt] POS printing is disabled — opening the HTML preview. Enable it in Settings → Receipt printer."
    );
  const p = await i0(u);
  return xa({
    html: p,
    filePrefix: "sale-receipt",
    title: r.invoice_no,
    width: 420,
    height: 760
  });
}
function ib(e) {
  const t = typeof e == "string" ? Number(e) : e;
  return t === 7 || t === 30 || t === 90 ? t : 30;
}
function or(e) {
  const t = e.getUTCFullYear(), r = String(e.getUTCMonth() + 1).padStart(2, "0"), i = String(e.getUTCDate()).padStart(2, "0");
  return `${t}-${r}-${i}`;
}
function Lc(e = /* @__PURE__ */ new Date()) {
  return new Date(
    Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate())
  );
}
const Ac = /^(\d{4})-(\d{2})-(\d{2})$/, Rs = 366;
function en(e) {
  if (!e || !Ac.test(e)) return null;
  const [, t, r, i] = e.match(Ac), s = Number(t), n = Number(r), a = Number(i), o = new Date(Date.UTC(s, n - 1, a));
  return or(o) !== e ? null : o;
}
function nb(e) {
  const t = typeof e.from == "string" ? e.from.trim() : "", r = typeof e.to == "string" ? e.to.trim() : "";
  if (!!(t || r)) {
    let o = en(t), c = en(r);
    if (!o && !c)
      throw new Error("Invalid analytics date range");
    if (c || (c = Lc()), o || (o = new Date(c.getTime())), o.getTime() > c.getTime()) {
      const p = o;
      o = c, c = p;
    }
    const u = 24 * 60 * 60 * 1e3;
    let l = Math.floor((c.getTime() - o.getTime()) / u) + 1;
    return l > Rs && (o = new Date(c.getTime()), o.setUTCDate(o.getUTCDate() - (Rs - 1)), l = Rs), {
      from: or(o),
      to: or(c),
      days: l,
      sinceIso: o.toISOString()
    };
  }
  const s = ib(e.days), n = Lc(), a = new Date(n.getTime());
  return a.setUTCDate(a.getUTCDate() - (s - 1)), {
    from: or(a),
    to: or(n),
    days: s,
    sinceIso: a.toISOString()
  };
}
function Cc(e) {
  const t = typeof e == "object" && e && "businessId" in e ? String(e.businessId) : "", r = nb(
    typeof e == "object" && e ? {
      days: e.days,
      from: e.from,
      to: e.to
    } : {}
  );
  X("business:view"), $(t);
  const { from: i, to: s, days: n, sinceIso: a } = r, o = en(s);
  o.setUTCDate(o.getUTCDate() + 1);
  const c = o.toISOString(), u = y().prepare(
    `SELECT date(created_at) as day, SUM(total) as total, COUNT(*) as count
       FROM sales
       WHERE business_id = ? AND created_at >= ? AND created_at < ? AND status != 'void'
       GROUP BY date(created_at)
       ORDER BY day ASC`
  ).all(t, a, c), l = new Map(u.map((S) => [S.day, S])), p = [];
  let d = 0, f = 0;
  const _ = en(i);
  for (let S = 0; S < n; S += 1) {
    const L = or(_), I = l.get(L), O = (I == null ? void 0 : I.total) ?? 0, P = (I == null ? void 0 : I.count) ?? 0;
    d += O, f += P, p.push({ date: L, total: O, count: P }), _.setUTCDate(_.getUTCDate() + 1);
  }
  const E = y().prepare(
    `SELECT p.method, SUM(p.amount) as total
       FROM payments p
       JOIN sales s ON s.id = p.sale_id
       WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at < ? AND s.status != 'void'
       GROUP BY p.method`
  ).all(t, a, c), w = new Map(E.map((S) => [S.method, S.total])), h = ["cash", "card", "credit"].map((S) => ({ method: S, total: w.get(S) ?? 0 })), m = y().prepare(
    `SELECT si.product_name_snapshot as product_name,
              SUM(si.qty - COALESCE(si.refunded_qty, 0)) as qty,
              SUM((si.qty - COALESCE(si.refunded_qty, 0)) * si.unit_price) as revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at < ? AND s.status != 'void'
       GROUP BY si.product_name_snapshot
       HAVING SUM(si.qty - COALESCE(si.refunded_qty, 0)) > 0
       ORDER BY revenue DESC
       LIMIT 8`
  ).all(t, a, c), b = y().prepare(
    `SELECT COALESCE(SUM(current_balance), 0) as total,
              COUNT(*) as customers
       FROM customers
       WHERE business_id = ? AND current_balance > 0 AND is_active = 1`
  ).get(t), v = y().prepare(
    `SELECT COUNT(*) as c FROM products
       WHERE business_id = ? AND is_active = 1 AND tracks_stock = 1 AND stock_qty <= 5`
  ).get(t);
  return {
    days: n,
    from: i,
    to: s,
    salesByDay: p,
    paymentsByMethod: h,
    topProducts: m.map((S) => ({
      productName: S.product_name,
      qty: S.qty,
      revenue: S.revenue
    })),
    creditOutstanding: b.total,
    customersWithBalance: b.customers,
    lowStockCount: v.c,
    salesTotal: d,
    salesCount: f
  };
}
function sb(e) {
  return {
    id: e.id,
    productId: e.product_id,
    productName: e.product_name_snapshot,
    qty: e.qty,
    unitPrice: e.unit_price,
    lineTotal: e.line_total,
    seatNo: e.seat_no ?? null,
    kitchenStatus: e.kitchen_status || "held",
    firedAt: e.fired_at ?? null,
    bumpedAt: e.bumped_at ?? null,
    billedQty: e.billed_qty || 0,
    priceRuleId: e.price_rule_id ?? null
  };
}
function It(e) {
  const t = y().prepare(
    `SELECT t.id, t.business_id, t.branch_id, t.table_id, t.service_mode, t.status, t.opened_by, t.notes,
              t.rider_user_id, u.name as rider_name, t.delivery_status, t.delivery_notes,
              t.created_at, t.updated_at
       FROM pos_tickets t
       LEFT JOIN users u ON u.id = t.rider_user_id
       WHERE t.id = ?`
  ).get(e);
  if (!t) throw new Error("Ticket not found");
  const i = y().prepare(
    `SELECT id, product_id, product_name_snapshot, qty, unit_price, line_total,
              seat_no, kitchen_status, fired_at, bumped_at, billed_qty, price_rule_id
       FROM pos_ticket_items WHERE ticket_id = ? ORDER BY rowid ASC`
  ).all(e).map(sb), s = i.reduce((n, a) => {
    const o = Math.max(0, a.qty - a.billedQty);
    return n + o * a.unitPrice;
  }, 0);
  return {
    id: t.id,
    businessId: t.business_id,
    branchId: t.branch_id,
    tableId: t.table_id,
    serviceMode: t.service_mode,
    status: t.status,
    openedBy: t.opened_by,
    notes: t.notes,
    riderUserId: t.rider_user_id,
    riderName: t.rider_name,
    deliveryStatus: t.delivery_status,
    deliveryNotes: t.delivery_notes,
    items: i,
    total: i.reduce((n, a) => n + a.lineTotal, 0),
    unbilledTotal: s,
    createdAt: t.created_at,
    updatedAt: t.updated_at
  };
}
function Pa(e) {
  if (G(), $(e), !Zt(pt(e)))
    throw new Error("Tables are only available for food businesses");
  return y().prepare(
    `SELECT t.id, t.business_id, t.name, t.seats, t.sort_order, t.is_active,
              ot.id as open_ticket_id,
              COALESCE((
                SELECT SUM(ti.line_total) FROM pos_ticket_items ti WHERE ti.ticket_id = ot.id
              ), 0) as open_ticket_total
       FROM dining_tables t
       LEFT JOIN pos_tickets ot ON ot.table_id = t.id AND ot.status = 'open'
       WHERE t.business_id = ?
       ORDER BY t.sort_order ASC, t.name ASC`
  ).all(e).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    seats: r.seats,
    sortOrder: r.sort_order,
    isActive: !!r.is_active,
    occupied: !!r.open_ticket_id,
    openTicketId: r.open_ticket_id,
    openTicketTotal: r.open_ticket_total || 0
  }));
}
function ab(e) {
  if (G(), X("tables:edit"), $(e.businessId), !Zt(pt(e.businessId)))
    throw new Error("Tables are only available for food businesses");
  const t = ie(), r = ae(), i = e.name.trim();
  if (!i) throw new Error("Table name is required");
  return y().prepare(
    `INSERT INTO dining_tables (id, business_id, name, seats, sort_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
  ).run(
    r,
    e.businessId,
    i,
    e.seats ?? null,
    e.sortOrder ?? 0,
    ce()
  ), ee({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "dining_table",
    entityId: r,
    action: "created",
    summary: `Created table ${i}`
  }), Pa(e.businessId).find((s) => s.id === r);
}
function ob(e) {
  G();
  const t = X("tables:edit"), r = y().prepare("SELECT business_id FROM dining_tables WHERE id = ?").get(e.id);
  if (!r) throw new Error("Table not found");
  if ($(r.business_id), !Zt(pt(r.business_id)))
    throw new Error("Tables are only available for food businesses");
  const i = e.name.trim();
  if (!i) throw new Error("Table name is required");
  return y().prepare(
    `UPDATE dining_tables SET name = ?, seats = ?, sort_order = ?, is_active = ?
       WHERE id = ?`
  ).run(
    i,
    e.seats ?? null,
    e.sortOrder ?? 0,
    e.isActive === !1 ? 0 : 1,
    e.id
  ), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "dining_table",
    entityId: e.id,
    action: "updated",
    summary: `Updated table ${i}`
  }), Pa(r.business_id).find(
    (s) => s.id === e.id
  );
}
function cb(e) {
  if (G(), $(e), !Zt(pt(e)))
    throw new Error("Tickets are only available for food businesses");
  return y().prepare(
    "SELECT id FROM pos_tickets WHERE business_id = ? AND status = 'open' ORDER BY updated_at DESC"
  ).all(e).map((r) => It(r.id));
}
function ub(e) {
  G(), ie();
  const t = It(e);
  return $(t.businessId), t;
}
function lb(e) {
  var a, o;
  if (G(), X("sales:checkout"), $(e.businessId), gr(e.branchId), !Zt(pt(e.businessId)))
    throw new Error("Tickets are only available for food businesses");
  if (!["dine_in", "takeaway", "delivery"].includes(e.serviceMode))
    throw new Error("Invalid service mode");
  const t = ie();
  let r = ((a = e.tableId) == null ? void 0 : a.trim()) || null;
  if (e.serviceMode === "dine_in") {
    if (!r) throw new Error("Table is required for dine-in");
    if (!y().prepare(
      "SELECT id FROM dining_tables WHERE id = ? AND business_id = ? AND is_active = 1"
    ).get(r, e.businessId)) throw new Error("Table not found");
    if (y().prepare(
      "SELECT id FROM pos_tickets WHERE table_id = ? AND status = 'open'"
    ).get(r)) throw new Error("Table already has an open ticket");
  } else
    r = null;
  const i = ae(), s = ce(), n = e.serviceMode === "takeaway" || e.serviceMode === "delivery" ? "pending" : null;
  return y().prepare(
    `INSERT INTO pos_tickets (
         id, business_id, branch_id, table_id, service_mode, status, opened_by, notes,
         rider_user_id, delivery_status, delivery_notes, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, NULL, ?, NULL, ?, ?)`
  ).run(
    i,
    e.businessId,
    e.branchId,
    r,
    e.serviceMode,
    t.id,
    ((o = e.notes) == null ? void 0 : o.trim()) || null,
    n,
    s,
    s
  ), ee({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "pos_ticket",
    entityId: i,
    action: "opened",
    summary: `Opened ${e.serviceMode} ticket`
  }), It(i);
}
function db(e) {
  G(), X("sales:checkout");
  const t = y().prepare("SELECT id, business_id, status FROM pos_tickets WHERE id = ?").get(e.ticketId);
  if (!t) throw new Error("Ticket not found");
  if ($(t.business_id), t.status !== "open") throw new Error("Ticket is no longer open");
  const r = ce();
  return y().transaction(() => {
    const i = y().prepare(
      "SELECT id, kitchen_status, fired_at, bumped_at, billed_qty FROM pos_ticket_items WHERE ticket_id = ?"
    ).all(e.ticketId), s = new Map(i.map((a) => [a.id, a]));
    y().prepare("DELETE FROM pos_ticket_items WHERE ticket_id = ?").run(e.ticketId);
    const n = y().prepare(
      `INSERT INTO pos_ticket_items (
         id, ticket_id, product_id, product_name_snapshot, qty, unit_price, line_total,
         seat_no, kitchen_status, fired_at, bumped_at, billed_qty, price_rule_id
       )
       SELECT ?, ?, p.id, p.name, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM products p WHERE p.id = ? AND p.business_id = ? AND p.is_active = 1`
    );
    for (const a of e.items) {
      if (!Number.isFinite(a.qty) || a.qty <= 0)
        throw new Error("Item quantity must be greater than 0");
      const o = y().prepare(
        "SELECT id, name, stock_qty, tracks_stock FROM products WHERE id = ? AND business_id = ? AND is_active = 1"
      ).get(a.productId, t.business_id);
      if (!o) throw new Error("Product not found or inactive");
      if (o.tracks_stock && a.qty > o.stock_qty)
        throw new Error(`Insufficient stock for ${o.name}`);
      const c = a.id && s.has(a.id) ? a.id : ae(), u = a.id ? s.get(a.id) : void 0, l = Math.min((u == null ? void 0 : u.billed_qty) || 0, a.qty);
      if (n.run(
        c,
        e.ticketId,
        a.qty,
        a.unitPrice,
        a.qty * a.unitPrice,
        a.seatNo ?? null,
        (u == null ? void 0 : u.kitchen_status) || "held",
        (u == null ? void 0 : u.fired_at) ?? null,
        (u == null ? void 0 : u.bumped_at) ?? null,
        l,
        a.priceRuleId ?? null,
        a.productId,
        t.business_id
      ).changes !== 1) throw new Error("Failed to add ticket item");
    }
    y().prepare("UPDATE pos_tickets SET updated_at = ? WHERE id = ?").run(r, e.ticketId);
  })(), It(e.ticketId);
}
function fb(e) {
  G(), X("sales:checkout");
  const t = ie(), r = y().prepare("SELECT id, business_id, status FROM pos_tickets WHERE id = ?").get(e);
  if (!r) throw new Error("Ticket not found");
  if ($(r.business_id), r.status !== "open") throw new Error("Ticket is no longer open");
  return y().prepare(
    "UPDATE pos_tickets SET status = 'cancelled', updated_at = ? WHERE id = ?"
  ).run(ce(), e), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "pos_ticket",
    entityId: e,
    action: "cancelled",
    summary: "Cancelled open ticket"
  }), { ok: !0 };
}
function hb(e) {
  G(), X("sales:checkout");
  const t = ie(), r = It(e.ticketId);
  if ($(r.businessId), r.status !== "open") throw new Error("Ticket is no longer open");
  if (!e.itemIds.length)
    throw new Error("Select items to send to kitchen");
  const i = ce(), s = y().prepare(
    `UPDATE pos_ticket_items
     SET kitchen_status = 'fired', fired_at = COALESCE(fired_at, ?)
     WHERE id = ? AND ticket_id = ? AND kitchen_status = 'held'`
  );
  return y().transaction(() => {
    for (const n of e.itemIds)
      s.run(i, n, e.ticketId);
    y().prepare("UPDATE pos_tickets SET updated_at = ? WHERE id = ?").run(i, e.ticketId);
  })(), ee({
    businessId: r.businessId,
    actorUserId: t.id,
    entityType: "pos_ticket",
    entityId: e.ticketId,
    action: "kitchen_fired",
    summary: `Fired ${e.itemIds.length} item(s) to kitchen`
  }), It(e.ticketId);
}
function pb(e) {
  var a, o;
  G(), X("sales:checkout");
  const t = ie(), r = It(e.ticketId);
  if ($(r.businessId), r.status !== "open") throw new Error("Ticket is no longer open");
  if (r.serviceMode !== "takeaway" && r.serviceMode !== "delivery")
    throw new Error("Rider assignment is only for takeaway or delivery");
  const i = ((a = e.riderUserId) == null ? void 0 : a.trim()) || null;
  let s = e.deliveryStatus ?? r.deliveryStatus;
  const n = e.deliveryNotes === void 0 ? r.deliveryNotes : ((o = e.deliveryNotes) == null ? void 0 : o.trim()) || null;
  if (i) {
    if (!y().prepare(
      `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
    ).get(i, r.businessId, r.businessId)) throw new Error("Rider not found");
    (!s || s === "pending") && (s = "assigned");
  }
  return y().prepare(
    `UPDATE pos_tickets
       SET rider_user_id = ?, delivery_status = ?, delivery_notes = ?, updated_at = ?
       WHERE id = ?`
  ).run(
    i,
    s,
    n,
    ce(),
    e.ticketId
  ), ee({
    businessId: r.businessId,
    actorUserId: t.id,
    entityType: "pos_ticket",
    entityId: e.ticketId,
    action: "rider_assigned",
    summary: i ? "Rider assigned" : "Rider cleared"
  }), It(e.ticketId);
}
function _b(e) {
  if (G(), X("sales:checkout"), $(e), !Zt(pt(e)))
    throw new Error("Kitchen display is only available for food businesses");
  return y().prepare(
    `SELECT ti.id as item_id, ti.ticket_id, dt.name as table_name, t.service_mode,
              ti.product_name_snapshot, ti.qty, ti.seat_no, ti.kitchen_status,
              COALESCE(p.kitchen_station, 'main') as kitchen_station,
              ti.fired_at, ti.bumped_at, t.created_at
       FROM pos_ticket_items ti
       JOIN pos_tickets t ON t.id = ti.ticket_id
       LEFT JOIN dining_tables dt ON dt.id = t.table_id
       LEFT JOIN products p ON p.id = ti.product_id
       WHERE t.business_id = ?
         AND t.status = 'open'
         AND ti.kitchen_status IN ('fired', 'ready')
         AND ti.billed_qty + 0.000001 < ti.qty
       ORDER BY ti.fired_at ASC, t.created_at ASC`
  ).all(e).map((r) => ({
    itemId: r.item_id,
    ticketId: r.ticket_id,
    tableName: r.table_name,
    serviceMode: r.service_mode,
    productName: r.product_name_snapshot,
    qty: r.qty,
    seatNo: r.seat_no,
    kitchenStatus: r.kitchen_status,
    kitchenStation: r.kitchen_station,
    firedAt: r.fired_at,
    bumpedAt: r.bumped_at,
    createdAt: r.created_at
  }));
}
function Eb(e) {
  if (G(), X("sales:checkout"), ie(), !e.itemIds.length) throw new Error("Select items to bump");
  const t = ce(), r = y().prepare(
    `UPDATE pos_ticket_items
     SET kitchen_status = 'bumped', bumped_at = ?
     WHERE id = ? AND kitchen_status IN ('fired', 'ready')`
  );
  return y().transaction(() => {
    for (const i of e.itemIds) r.run(t, i);
  })(), { ok: !0 };
}
function mb(e) {
  if (G(), X("sales:checkout"), ie(), !e.itemIds.length) throw new Error("Select items to recall");
  const t = y().prepare(
    `UPDATE pos_ticket_items
     SET kitchen_status = 'fired', bumped_at = NULL
     WHERE id = ? AND kitchen_status = 'bumped'`
  );
  return y().transaction(() => {
    for (const r of e.itemIds) t.run(r);
  })(), { ok: !0 };
}
function Tb(e) {
  return {
    id: e.id,
    businessId: e.business_id,
    name: e.name,
    productId: e.product_id,
    categoryId: e.category_id,
    overridePrice: e.override_price,
    percentOff: e.percent_off,
    weekdaysMask: e.weekdays_mask,
    startTime: e.start_time,
    endTime: e.end_time,
    priority: e.priority,
    isActive: !!e.is_active,
    validFrom: e.valid_from,
    validTo: e.valid_to,
    createdAt: e.created_at,
    updatedAt: e.updated_at
  };
}
function jd(e) {
  var c, u;
  const t = e.overridePrice == null || e.overridePrice === "" ? null : Number(e.overridePrice), r = e.percentOff == null || e.percentOff === "" ? null : Number(e.percentOff), i = t != null && Number.isFinite(t), s = r != null && Number.isFinite(r);
  if (i === s)
    throw new Error("Set either an override price or a percent off, not both");
  if (i && t < 0)
    throw new Error("Override price must be >= 0");
  if (s && (r < 0 || r > 100))
    throw new Error("Percent off must be between 0 and 100");
  const n = ((c = e.productId) == null ? void 0 : c.trim()) || null, a = ((u = e.categoryId) == null ? void 0 : u.trim()) || null;
  if (n && a)
    throw new Error("Rule cannot target both a product and a category");
  if (!Number.isInteger(e.weekdaysMask) || e.weekdaysMask < 0 || e.weekdaysMask > 127)
    throw new Error("Invalid weekdays mask");
  const o = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!o.test(e.startTime) || !o.test(e.endTime))
    throw new Error("Start and end time must be HH:MM");
  return {
    overridePrice: i ? t : null,
    percentOff: s ? r : null,
    productId: n,
    categoryId: a
  };
}
function gb(e) {
  const t = e ? new Date(e) : /* @__PURE__ */ new Date(), r = t.getFullYear(), i = String(t.getMonth() + 1).padStart(2, "0"), s = String(t.getDate()).padStart(2, "0"), n = String(t.getHours()).padStart(2, "0"), a = String(t.getMinutes()).padStart(2, "0"), o = t.getDay(), c = o === 0 ? 64 : 1 << o - 1;
  return { date: `${r}-${i}-${s}`, weekdayBit: c, hm: `${n}:${a}` };
}
function bb(e, t, r) {
  return t === r ? !0 : t < r ? e >= t && e < r : e >= t || e < r;
}
function vb(e) {
  G(), $(e.businessId);
  const t = y().prepare(
    "SELECT id, price, category_id FROM products WHERE id = ? AND business_id = ? AND is_active = 1"
  ).get(e.productId, e.businessId);
  if (!t) throw new Error("Product not found");
  const { date: r, weekdayBit: i, hm: s } = gb(e.at), n = y().prepare(
    `SELECT id, name, product_id, category_id, override_price, percent_off, weekdays_mask,
              start_time, end_time, priority, valid_from, valid_to
       FROM happy_hour_price_rules
       WHERE business_id = ? AND is_active = 1
       ORDER BY priority DESC, created_at DESC`
  ).all(e.businessId), a = [];
  for (const c of n) {
    if (!(c.weekdays_mask & i) || !bb(s, c.start_time, c.end_time) || c.valid_from && r < c.valid_from.slice(0, 10) || c.valid_to && r > c.valid_to.slice(0, 10)) continue;
    let u = 0;
    if (c.product_id) {
      if (c.product_id !== t.id) continue;
      u = 2;
    } else if (c.category_id) {
      if (!t.category_id || c.category_id !== t.category_id)
        continue;
      u = 1;
    } else
      u = 0;
    const l = c.override_price != null ? c.override_price : Math.max(0, t.price * (1 - (c.percent_off || 0) / 100));
    a.push({ id: c.id, name: c.name, unitPrice: l, scope: u });
  }
  a.sort((c, u) => u.scope - c.scope);
  const o = a[0];
  return o ? {
    unitPrice: o.unitPrice,
    listPrice: t.price,
    priceRuleId: o.id,
    priceRuleName: o.name
  } : {
    unitPrice: t.price,
    listPrice: t.price,
    priceRuleId: null,
    priceRuleName: null
  };
}
function Ln(e) {
  return G(), X("products:view"), $(e), y().prepare(
    `SELECT id, business_id, name, product_id, category_id, override_price, percent_off,
              weekdays_mask, start_time, end_time, priority, is_active, valid_from, valid_to,
              created_at, updated_at
       FROM happy_hour_price_rules WHERE business_id = ?
       ORDER BY priority DESC, name ASC`
  ).all(e).map(Tb);
}
function yb(e) {
  var a, o;
  G(), X("products:edit"), $(e.businessId);
  const t = ie(), r = e.name.trim();
  if (!r) throw new Error("Rule name is required");
  const i = jd(e), s = ae(), n = ce();
  return y().prepare(
    `INSERT INTO happy_hour_price_rules (
         id, business_id, name, product_id, category_id, override_price, percent_off,
         weekdays_mask, start_time, end_time, priority, is_active, valid_from, valid_to,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    s,
    e.businessId,
    r,
    i.productId,
    i.categoryId,
    i.overridePrice,
    i.percentOff,
    e.weekdaysMask,
    e.startTime,
    e.endTime,
    e.priority ?? 0,
    e.isActive === !1 ? 0 : 1,
    ((a = e.validFrom) == null ? void 0 : a.trim()) || null,
    ((o = e.validTo) == null ? void 0 : o.trim()) || null,
    n,
    n
  ), ee({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "happy_hour_rule",
    entityId: s,
    action: "created",
    summary: `Created happy hour rule ${r}`
  }), Ln(e.businessId).find((c) => c.id === s);
}
function wb(e) {
  var a, o;
  G(), X("products:edit");
  const t = ie(), r = y().prepare("SELECT business_id FROM happy_hour_price_rules WHERE id = ?").get(e.id);
  if (!r) throw new Error("Rule not found");
  $(r.business_id);
  const i = e.name.trim();
  if (!i) throw new Error("Rule name is required");
  const s = jd(e), n = ce();
  return y().prepare(
    `UPDATE happy_hour_price_rules SET
         name = ?, product_id = ?, category_id = ?, override_price = ?, percent_off = ?,
         weekdays_mask = ?, start_time = ?, end_time = ?, priority = ?, is_active = ?,
         valid_from = ?, valid_to = ?, updated_at = ?
       WHERE id = ?`
  ).run(
    i,
    s.productId,
    s.categoryId,
    s.overridePrice,
    s.percentOff,
    e.weekdaysMask,
    e.startTime,
    e.endTime,
    e.priority ?? 0,
    e.isActive === !1 ? 0 : 1,
    ((a = e.validFrom) == null ? void 0 : a.trim()) || null,
    ((o = e.validTo) == null ? void 0 : o.trim()) || null,
    n,
    e.id
  ), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "happy_hour_rule",
    entityId: e.id,
    action: "updated",
    summary: `Updated happy hour rule ${i}`
  }), Ln(r.business_id).find(
    (c) => c.id === e.id
  );
}
function Sb(e) {
  G(), X("products:edit");
  const t = ie(), r = y().prepare(
    "SELECT business_id, name FROM happy_hour_price_rules WHERE id = ?"
  ).get(e.id);
  if (!r) throw new Error("Rule not found");
  return $(r.business_id), y().prepare(
    "UPDATE happy_hour_price_rules SET is_active = ?, updated_at = ? WHERE id = ?"
  ).run(e.isActive ? 1 : 0, ce(), e.id), ee({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "happy_hour_rule",
    entityId: e.id,
    action: e.isActive ? "activated" : "deactivated",
    summary: `${e.isActive ? "Activated" : "Deactivated"} happy hour rule ${r.name}`
  }), Ln(r.business_id).find(
    (i) => i.id === e.id
  );
}
function Rb() {
  C.handle(A.APP_PING, async () => ({
    ok: !0,
    at: (/* @__PURE__ */ new Date()).toISOString()
  })), C.handle(A.APP_GET_INFO, async () => ({
    name: Xe.getName(),
    version: Xe.getVersion(),
    platform: process.platform,
    userDataPath: Xe.getPath("userData")
  })), C.handle(A.APP_GET_BOOT_STATE, async () => wm()), C.handle(A.APP_GET_BRAND_COLOR, async () => Sm()), C.handle(A.APP_GET_LANGUAGE, async () => Xt(j.get("language"))), C.handle(A.APP_SET_LANGUAGE, async (e, t) => {
    const r = Xt(t);
    return j.set("language", r), { ok: !0 };
  }), C.handle(A.APP_GET_LICENSE_STATUS, async () => {
    const e = Tr();
    return e.status === "none" ? { state: "missing", expiresAt: null, issuedTo: null } : e.status === "expired" ? {
      state: "expired",
      expiresAt: e.record.expiresAt,
      issuedTo: e.record.issuedTo
    } : {
      state: e.record.expiresAt ? "valid" : "lifetime",
      expiresAt: e.record.expiresAt,
      issuedTo: e.record.issuedTo
    };
  }), C.handle(A.APP_GET_RESTOCK_ALERTS, async (e, t) => {
    X("business:view");
    const r = t == null ? void 0 : t.trim();
    return r ? ($(r), Cm(r)) : [];
  }), C.handle(A.REMINDERS_MAYBE_RUN, async () => (ie(), Fm())), C.handle(A.LICENSE_ACTIVATE, async (e, t) => an(t)), C.handle(A.SETUP_COMPLETE, async (e, t) => Rm(t)), C.handle(
    A.SETUP_RESTORE_FROM_BACKUP,
    async (e, t) => Nm(t, (r) => {
      e.sender.send(A.BACKUP_PROGRESS, r);
    })
  ), C.handle(A.AUTH_LOGIN, async (e, t) => Vf(t)), C.handle(
    A.AUTH_RESET_OWNER_PASSWORD_OFFLINE,
    async (e, t) => Zf(t)
  ), C.handle(A.AUTH_LOGOUT, async () => ru()), C.handle(A.AUTH_SESSION, async () => tu()), C.handle(A.BUSINESS_LIST, async () => _0()), C.handle(A.BUSINESS_CREATE, async (e, t) => E0(t)), C.handle(A.BUSINESS_UPDATE, async (e, t) => m0(t)), C.handle(A.BUSINESS_SET_ACTIVE, async (e, t) => T0(t)), C.handle(A.BRANCH_LIST, async (e, t) => g0(t)), C.handle(A.BRANCH_CREATE, async (e, t) => b0(t)), C.handle(A.BRANCH_UPDATE, async (e, t) => v0(t)), C.handle(A.USER_LIST, async (e, t) => y0(t)), C.handle(A.USER_CREATE, async (e, t) => w0(t)), C.handle(A.USER_UPDATE_SELF, async (e, t) => R0(t)), C.handle(A.USER_SET_ACTIVE, async (e, t) => S0(t)), C.handle(A.PRODUCT_LIST, async (e, t) => N0(t)), C.handle(A.PRODUCT_CREATE, async (e, t) => I0(t)), C.handle(A.PRODUCT_UPDATE, async (e, t) => L0(t)), C.handle(A.PRODUCT_SET_ACTIVE, async (e, t) => A0(t)), C.handle(A.PRODUCT_DELETE, async (e, t) => C0(t)), C.handle(
    A.PRODUCT_GENERATE_BARCODE,
    async (e, t) => k0(t)
  ), C.handle(
    A.PRODUCT_ACTIVITY,
    async (e, t) => Gs("product", t)
  ), C.handle(
    A.PRODUCT_LIST_SUPPLIERS,
    async (e, t) => O0(t)
  ), C.handle(A.SUPPLIER_LIST, async (e, t) => x0(t)), C.handle(
    A.SUPPLIER_GET_DETAIL,
    async (e, t) => P0(t)
  ), C.handle(A.SUPPLIER_CREATE, async (e, t) => D0(t)), C.handle(A.SUPPLIER_UPDATE, async (e, t) => U0(t)), C.handle(
    A.SUPPLIER_LIST_PRODUCTS,
    async (e, t) => Ua(t)
  ), C.handle(A.SUPPLIER_LINK_PRODUCT, async (e, t) => B0(t)), C.handle(
    A.SUPPLIER_UNLINK_PRODUCT,
    async (e, t) => F0(t)
  ), C.handle(
    A.SUPPLIER_UPDATE_LINKED_PRODUCT,
    async (e, t) => M0(t)
  ), C.handle(A.PO_LIST, async (e, t) => $0(t)), C.handle(A.PO_GET_DETAIL, async (e, t) => qd(t)), C.handle(A.PO_CREATE, async (e, t) => H0(t)), C.handle(A.PO_PRINT, async (e, t) => X0(t)), C.handle(A.CUSTOMER_LIST, async (e, t) => W0(t)), C.handle(A.CUSTOMER_GET_DETAIL, async (e, t) => Kd(t)), C.handle(A.CUSTOMER_CREATE, async (e, t) => z0(t)), C.handle(A.CUSTOMER_UPDATE, async (e, t) => q0(t)), C.handle(
    A.CUSTOMER_RECORD_PAYMENT,
    async (e, t) => Y0(t)
  ), C.handle(
    A.CUSTOMER_PRINT_LEDGER,
    async (e, t) => K0(t)
  ), C.handle(A.SALES_LIST, async (e, t) => V0(t)), C.handle(A.SALES_GET_DETAIL, async (e, t) => Q0(t)), C.handle(
    A.SALES_FIND_BY_INVOICE,
    async (e, t) => eb(t.businessId, t.invoiceNo)
  ), C.handle(A.SALES_CREATE, async (e, t) => G0(t)), C.handle(A.SALES_REFUND_REQUEST, async (e, t) => Z0(t)), C.handle(A.SALES_REFUND_REVIEW, async (e, t) => J0(t)), C.handle(A.SALES_PRINT, async (e, t) => rb(t)), C.handle(A.PRINTER_LIST, async () => Nh()), C.handle(A.PRINTER_GET_SETTINGS, async () => cn()), C.handle(
    A.PRINTER_SET_SETTINGS,
    async (e, t) => wh(t)
  ), C.handle(A.TABLE_LIST, async (e, t) => Pa(t)), C.handle(A.TABLE_CREATE, async (e, t) => ab(t)), C.handle(A.TABLE_UPDATE, async (e, t) => ob(t)), C.handle(A.TICKET_LIST_OPEN, async (e, t) => cb(t)), C.handle(A.TICKET_GET, async (e, t) => ub(t)), C.handle(A.TICKET_OPEN, async (e, t) => lb(t)), C.handle(A.TICKET_SET_ITEMS, async (e, t) => db(t)), C.handle(A.TICKET_CANCEL, async (e, t) => fb(t)), C.handle(A.TICKET_FIRE_ITEMS, async (e, t) => hb(t)), C.handle(A.TICKET_ASSIGN_RIDER, async (e, t) => pb(t)), C.handle(
    A.KITCHEN_LIST_ACTIVE,
    async (e, t) => _b(t)
  ), C.handle(A.KITCHEN_BUMP, async (e, t) => Eb(t)), C.handle(A.KITCHEN_RECALL, async (e, t) => mb(t)), C.handle(
    A.HAPPY_HOUR_LIST,
    async (e, t) => Ln(t)
  ), C.handle(A.HAPPY_HOUR_CREATE, async (e, t) => yb(t)), C.handle(A.HAPPY_HOUR_UPDATE, async (e, t) => wb(t)), C.handle(
    A.HAPPY_HOUR_SET_ACTIVE,
    async (e, t) => Sb(t)
  ), C.handle(A.HAPPY_HOUR_RESOLVE_PRICE, async (e, t) => vb(t)), C.handle(A.SALES_UPDATE_DELIVERY, async (e, t) => tb(t)), C.handle(
    A.ACTIVITY_LIST,
    async (e, t) => Gs(t.entityType, t.entityId)
  ), C.handle(
    A.ANALYTICS_SUMMARY,
    async (e, t) => Cc(typeof t == "string" ? { businessId: t, days: 30 } : {
      businessId: (t == null ? void 0 : t.businessId) ?? "",
      days: t == null ? void 0 : t.days,
      from: t == null ? void 0 : t.from,
      to: t == null ? void 0 : t.to
    })
  ), C.handle(
    A.ASSETS_PICK_AND_SAVE,
    async (e, t) => nh(t.kind)
  ), C.handle(
    A.BACKUP_CREATE,
    async (e) => _m((t) => {
      e.sender.send(A.BACKUP_PROGRESS, t);
    })
  ), C.handle(
    A.BACKUP_RESTORE,
    async (e, t) => Em(t, (r) => {
      e.sender.send(A.BACKUP_PROGRESS, r);
    })
  ), C.handle(A.BACKUP_PICK_FILE, async () => mm()), C.handle(A.BACKUP_GET_AUTO_SETTINGS, async () => (X("business:view"), ia())), C.handle(
    A.BACKUP_SET_AUTO_SETTINGS,
    async (e, t) => (X("business:view"), Af(t))
  );
}
const Nb = 45e3;
let Oc = null, Ns = !1;
function kc(e = /* @__PURE__ */ new Date()) {
  const t = e.getFullYear(), r = String(e.getMonth() + 1).padStart(2, "0"), i = String(e.getDate()).padStart(2, "0");
  return `${t}-${r}-${i}`;
}
function Ib(e) {
  if (!e) return !1;
  const t = new Date(e);
  return Number.isNaN(t.getTime()) ? !1 : kc(t) === kc();
}
function Lb(e, t = /* @__PURE__ */ new Date()) {
  const r = ra(e), [i, s] = r.split(":").map(Number);
  return t.getHours() === i && t.getMinutes() === s;
}
async function xc() {
  if (Ns || pm()) return;
  const e = ia();
  if (e.autoBackupEnabled && Lb(e.autoBackupTime) && !Ib(e.lastAutoBackupAt)) {
    Ns = !0;
    try {
      await Bl(), Cf();
    } catch (t) {
      console.error("[auto-backup] failed", t);
    } finally {
      Ns = !1;
    }
  }
}
function Ab() {
  Oc || (xc(), Oc = setInterval(() => {
    xc();
  }, Nb));
}
Pc.registerSchemesAsPrivileged([
  {
    scheme: "kaarobar-asset",
    privileges: {
      standard: !0,
      secure: !0,
      supportFetchAPI: !0,
      bypassCSP: !0,
      stream: !0
    }
  }
]);
const Gd = F.dirname(Zd(import.meta.url));
process.env.APP_ROOT = F.join(Gd, "..");
yf.config({ path: F.join(process.env.APP_ROOT, ".env") });
const Vs = process.env.VITE_DEV_SERVER_URL, Zb = F.join(process.env.APP_ROOT, "dist-electron"), Zs = F.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Vs ? F.join(process.env.APP_ROOT, "public") : Zs;
let bt = null;
function Dc() {
  const e = F.join(
    process.env.VITE_PUBLIC ?? Zs,
    "kaarobar-icon.png"
  );
  bt = new Gr({
    title: "Kaarobar",
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: !1,
    backgroundColor: "#f6f8fb",
    icon: e,
    webPreferences: {
      preload: F.join(Gd, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !0
    }
  }), bt.once("ready-to-show", () => {
    bt == null || bt.show();
  }), Vs ? bt.loadURL(Vs) : bt.loadFile(F.join(Zs, "index.html"));
}
Xe.whenReady().then(() => {
  Xe.setPath("userData", tt()), Pc.handle(
    "kaarobar-asset",
    (e) => ih(e.url)
  ), Rb(), Dc(), Ab(), Xe.on("activate", () => {
    Gr.getAllWindows().length === 0 && Dc();
  });
});
Xe.on("window-all-closed", () => {
  process.platform !== "darwin" && (Xe.quit(), bt = null);
});
export {
  Zb as MAIN_DIST,
  Zs as RENDERER_DIST,
  Vs as VITE_DEV_SERVER_URL
};
