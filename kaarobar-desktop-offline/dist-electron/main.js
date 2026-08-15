import { app as Xe, dialog as Ic, BrowserWindow as Yi, ipcMain as C, protocol as Lc } from "electron";
import { fileURLToPath as $d } from "node:url";
import F from "node:path";
import ji from "fs";
import Hd from "path";
import Xd from "os";
import Wd from "crypto";
import zd from "electron-store";
import $ from "node:fs";
import { createRequire as Ac } from "node:module";
import qd from "better-sqlite3";
import { randomBytes as Cc, createCipheriv as Oc, createHash as kc, randomUUID as xc, scryptSync as Dc, createDecipheriv as Uc } from "node:crypto";
import { execFileSync as Pc } from "node:child_process";
import Ve from "node:os";
import cr from "bcryptjs";
import Kr from "stream";
import Kd from "events";
import Bc from "buffer";
import ct from "util";
import Yr from "zlib";
import Yd from "assert";
var ye = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function zs(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var ut = { exports: {} };
const gs = ji, Ui = Hd, jd = Xd, Gd = Wd, Oa = [
  "◈ encrypted .env [www.dotenvx.com]",
  "◈ secrets for agents [www.dotenvx.com]",
  "⌁ auth for agents [www.vestauth.com]",
  "⌘ custom filepath { path: '/custom/path/.env' }",
  "⌘ enable debugging { debug: true }",
  "⌘ override existing { override: true }",
  "⌘ suppress logs { quiet: true }",
  "⌘ multiple files { path: ['.env.local', '.env'] }"
];
function Vd() {
  return Oa[Math.floor(Math.random() * Oa.length)];
}
function tr(e) {
  return typeof e == "string" ? !["false", "0", "no", "off", ""].includes(e.toLowerCase()) : !!e;
}
function Zd() {
  return process.stdout.isTTY;
}
function Jd(e) {
  return Zd() ? `\x1B[2m${e}\x1B[0m` : e;
}
const Qd = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
function ef(e) {
  const t = {};
  let r = e.toString();
  r = r.replace(/\r\n?/mg, `
`);
  let i;
  for (; (i = Qd.exec(r)) != null; ) {
    const n = i[1];
    let s = i[2] || "";
    s = s.trim();
    const a = s[0];
    s = s.replace(/^(['"`])([\s\S]*)\1$/mg, "$2"), a === '"' && (s = s.replace(/\\n/g, `
`), s = s.replace(/\\r/g, "\r")), t[n] = s;
  }
  return t;
}
function tf(e) {
  e = e || {};
  const t = $c(e);
  e.path = t;
  const r = me.configDotenv(e);
  if (!r.parsed) {
    const a = new Error(`MISSING_DATA: Cannot parse ${t} for an unknown reason`);
    throw a.code = "MISSING_DATA", a;
  }
  const i = Mc(e).split(","), n = i.length;
  let s;
  for (let a = 0; a < n; a++)
    try {
      const o = i[a].trim(), c = nf(r, o);
      s = me.decrypt(c.ciphertext, c.key);
      break;
    } catch (o) {
      if (a + 1 >= n)
        throw o;
    }
  return me.parse(s);
}
function rf(e) {
  console.error(`⚠ ${e}`);
}
function Or(e) {
  console.log(`┆ ${e}`);
}
function Fc(e) {
  console.log(`◇ ${e}`);
}
function Mc(e) {
  return e && e.DOTENV_KEY && e.DOTENV_KEY.length > 0 ? e.DOTENV_KEY : process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0 ? process.env.DOTENV_KEY : "";
}
function nf(e, t) {
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
  const n = r.searchParams.get("environment");
  if (!n) {
    const o = new Error("INVALID_DOTENV_KEY: Missing environment part");
    throw o.code = "INVALID_DOTENV_KEY", o;
  }
  const s = `DOTENV_VAULT_${n.toUpperCase()}`, a = e.parsed[s];
  if (!a) {
    const o = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${s} in your .env.vault file.`);
    throw o.code = "NOT_FOUND_DOTENV_ENVIRONMENT", o;
  }
  return { ciphertext: a, key: i };
}
function $c(e) {
  let t = null;
  if (e && e.path && e.path.length > 0)
    if (Array.isArray(e.path))
      for (const r of e.path)
        gs.existsSync(r) && (t = r.endsWith(".vault") ? r : `${r}.vault`);
    else
      t = e.path.endsWith(".vault") ? e.path : `${e.path}.vault`;
  else
    t = Ui.resolve(process.cwd(), ".env.vault");
  return gs.existsSync(t) ? t : null;
}
function ka(e) {
  return e[0] === "~" ? Ui.join(jd.homedir(), e.slice(1)) : e;
}
function sf(e) {
  const t = tr(process.env.DOTENV_CONFIG_DEBUG || e && e.debug), r = tr(process.env.DOTENV_CONFIG_QUIET || e && e.quiet);
  (t || !r) && Fc("loading env from encrypted .env.vault");
  const i = me._parseVault(e);
  let n = process.env;
  return e && e.processEnv != null && (n = e.processEnv), me.populate(n, i, e), { parsed: i };
}
function af(e) {
  const t = Ui.resolve(process.cwd(), ".env");
  let r = "utf8", i = process.env;
  e && e.processEnv != null && (i = e.processEnv);
  let n = tr(i.DOTENV_CONFIG_DEBUG || e && e.debug), s = tr(i.DOTENV_CONFIG_QUIET || e && e.quiet);
  e && e.encoding ? r = e.encoding : n && Or("no encoding is specified (UTF-8 is used by default)");
  let a = [t];
  if (e && e.path)
    if (!Array.isArray(e.path))
      a = [ka(e.path)];
    else {
      a = [];
      for (const l of e.path)
        a.push(ka(l));
    }
  let o;
  const c = {};
  for (const l of a)
    try {
      const p = me.parse(gs.readFileSync(l, { encoding: r }));
      me.populate(c, p, e);
    } catch (p) {
      n && Or(`failed to load ${l} ${p.message}`), o = p;
    }
  const u = me.populate(i, c, e);
  if (n = tr(i.DOTENV_CONFIG_DEBUG || n), s = tr(i.DOTENV_CONFIG_QUIET || s), n || !s) {
    const l = Object.keys(u).length, p = [];
    for (const d of a)
      try {
        const f = Ui.relative(process.cwd(), d);
        p.push(f);
      } catch (f) {
        n && Or(`failed to load ${d} ${f.message}`), o = f;
      }
    Fc(`injected env (${l}) from ${p.join(",")} ${Jd(`// tip: ${Vd()}`)}`);
  }
  return o ? { parsed: c, error: o } : { parsed: c };
}
function of(e) {
  if (Mc(e).length === 0)
    return me.configDotenv(e);
  const t = $c(e);
  return t ? me._configVault(e) : (rf(`you set DOTENV_KEY but you are missing a .env.vault file at ${t}`), me.configDotenv(e));
}
function cf(e, t) {
  const r = Buffer.from(t.slice(-64), "hex");
  let i = Buffer.from(e, "base64");
  const n = i.subarray(0, 12), s = i.subarray(-16);
  i = i.subarray(12, -16);
  try {
    const a = Gd.createDecipheriv("aes-256-gcm", r, n);
    return a.setAuthTag(s), `${a.update(i)}${a.final()}`;
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
function uf(e, t, r = {}) {
  const i = !!(r && r.debug), n = !!(r && r.override), s = {};
  if (typeof t != "object") {
    const a = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
    throw a.code = "OBJECT_REQUIRED", a;
  }
  for (const a of Object.keys(t))
    Object.prototype.hasOwnProperty.call(e, a) ? (n === !0 && (e[a] = t[a], s[a] = t[a]), i && Or(n === !0 ? `"${a}" is already defined and WAS overwritten` : `"${a}" is already defined and was NOT overwritten`)) : (e[a] = t[a], s[a] = t[a]);
  return s;
}
const me = {
  configDotenv: af,
  _configVault: sf,
  _parseVault: tf,
  config: of,
  decrypt: cf,
  parse: ef,
  populate: uf
};
ut.exports.configDotenv = me.configDotenv;
ut.exports._configVault = me._configVault;
ut.exports._parseVault = me._parseVault;
ut.exports.config = me.config;
ut.exports.decrypt = me.decrypt;
ut.exports.parse = me.parse;
ut.exports.populate = me.populate;
ut.exports = me;
var lf = ut.exports;
const df = /* @__PURE__ */ zs(lf), A = {
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
function Qe() {
  return F.join(Xe.getPath("appData"), "Kaarobar");
}
function qs() {
  return F.join(Qe(), "assets");
}
const se = new zd({
  name: "kaarobar-config",
  cwd: Qe(),
  defaults: {
    language: "en",
    lastBusinessId: null,
    licenseBlob: null,
    setupComplete: !1,
    autoBackupEnabled: !1,
    autoBackupTime: "22:00",
    lastAutoBackupAt: null
  }
}), ff = /^([01]\d|2[0-3]):([0-5]\d)$/;
function Ks(e) {
  return e && ff.test(e) ? e : "22:00";
}
function Ys() {
  return {
    autoBackupEnabled: !!se.get("autoBackupEnabled"),
    autoBackupTime: Ks(se.get("autoBackupTime")),
    lastAutoBackupAt: se.get("lastAutoBackupAt") ?? null
  };
}
function hf(e) {
  return typeof e.autoBackupEnabled == "boolean" && se.set("autoBackupEnabled", e.autoBackupEnabled), e.autoBackupTime !== void 0 && se.set("autoBackupTime", Ks(e.autoBackupTime)), Ys();
}
function pf(e = (/* @__PURE__ */ new Date()).toISOString()) {
  se.set("lastAutoBackupAt", e);
}
let ke = null;
const _f = Ac(import.meta.url);
function Ef() {
  var e, t, r;
  if (process.platform !== "linux") return !1;
  try {
    const i = (t = (e = process.report) == null ? void 0 : e.getReport) == null ? void 0 : t.call(e);
    return !((r = i == null ? void 0 : i.header) != null && r.glibcVersionRuntime);
  } catch {
    return !1;
  }
}
function mf() {
  try {
    const e = _f.resolve("better-sqlite3/package.json"), t = F.dirname(e), r = `${Ef() ? "linuxmusl" : process.platform}-${process.arch}`, i = F.join(t, "prebuilds", `${r}.node`);
    if ($.existsSync(i)) return i;
    const n = F.join(t, "build", "Release", "better_sqlite3.node");
    if ($.existsSync(n)) return n;
    const s = F.join(t, "build", "Debug", "better_sqlite3.node");
    if ($.existsSync(s)) return s;
  } catch {
  }
}
function Gi() {
  return F.join(Qe(), "kaarobar.sqlite");
}
function Vi() {
  return $.existsSync(Gi());
}
function We() {
  if (ke) return ke;
  const e = Gi();
  $.mkdirSync(F.dirname(e), { recursive: !0 });
  const t = mf();
  if (!t)
    throw new Error(
      "better-sqlite3 native build is missing (prebuilds/*.node or build/Release/better_sqlite3.node). Run: npm run rebuild:native"
    );
  return ke = new qd(e, { nativeBinding: t }), ke.pragma("journal_mode = WAL"), ke.pragma("foreign_keys = ON"), ke;
}
function he() {
  if (!ke) throw new Error("Database is not open. Call openDatabase() first.");
  return ke;
}
function js() {
  ke && (ke.close(), ke = null);
}
function Zi() {
  return ke != null;
}
const Tf = "Gna3LYmV74oluMsJxJxU4UpWaDbM5YOZFW+", gf = "kaarobar-license-salt";
let ui = null, li = null;
function bf() {
  if (li) return li;
  let e = "";
  try {
    const r = Ve.networkInterfaces();
    e = Object.values(r).flatMap((i) => i ?? []).filter((i) => i && !i.internal && i.mac && i.mac !== "00:00:00:00:00:00").map((i) => i.mac).sort().join("|");
  } catch {
    e = "";
  }
  const t = [
    "kaarobar",
    Ve.hostname(),
    Ve.platform(),
    Ve.arch(),
    Ve.userInfo().username,
    e
  ].join("::");
  return li = kc("sha256").update(t).digest("hex"), li;
}
function vf(e) {
  return kc("sha256").update(`kaarobar::${e}`).digest("hex");
}
function yf() {
  var e;
  try {
    const r = Pc("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
      encoding: "utf8",
      timeout: 5e3,
      windowsHide: !0
    }).match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    return ((e = r == null ? void 0 : r[1]) == null ? void 0 : e.trim()) || null;
  } catch {
    return null;
  }
}
function wf() {
  var e;
  try {
    const r = Pc(
      "reg",
      ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      { encoding: "utf8", timeout: 5e3, windowsHide: !0 }
    ).match(/MachineGuid\s+REG_SZ\s+([0-9A-Fa-f-]+)/);
    return ((e = r == null ? void 0 : r[1]) == null ? void 0 : e.trim()) || null;
  } catch {
    return null;
  }
}
function Sf() {
  for (const e of ["/etc/machine-id", "/var/lib/dbus/machine-id"])
    try {
      const t = $.readFileSync(e, "utf8").trim();
      if (t) return t;
    } catch {
    }
  return null;
}
function Rf() {
  switch (Ve.platform()) {
    case "darwin":
      return yf();
    case "win32":
      return wf();
    default:
      return Sf();
  }
}
function Hc() {
  const e = Ve.homedir();
  switch (Ve.platform()) {
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
function Nf() {
  try {
    return $.readFileSync(Hc(), "utf8").trim() || null;
  } catch {
    return null;
  }
}
function If(e) {
  const t = Hc();
  $.mkdirSync(F.dirname(t), { recursive: !0 }), $.writeFileSync(t, e, { encoding: "utf8", mode: 384 });
}
function Lf() {
  const e = Rf();
  if (e) return e;
  const t = Nf();
  if (t) return t;
  const r = xc();
  try {
    return If(r), r;
  } catch {
    if (Ve.platform() === "win32") {
      const i = F.join(
        process.env.LOCALAPPDATA || F.join(Ve.homedir(), "AppData", "Local"),
        "2ndHub",
        "Kaarobar",
        "device.id"
      );
      try {
        const n = $.readFileSync(i, "utf8").trim();
        return n || ($.mkdirSync(F.dirname(i), { recursive: !0 }), $.writeFileSync(i, r, { encoding: "utf8", mode: 384 }), r);
      } catch {
        return r;
      }
    }
    return r;
  }
}
function Xc() {
  return ui || (ui = vf(Lf()), ui);
}
function Wc(e) {
  return Dc(`${Tf}:${e}`, gf, 32);
}
function zc(e) {
  const t = Wc(e.fingerprint), r = Cc(12), i = Oc("aes-256-gcm", t, r), n = Buffer.from(JSON.stringify(e), "utf8"), s = Buffer.concat([i.update(n), i.final()]), a = i.getAuthTag();
  return Buffer.concat([r, a, s]).toString("base64");
}
function xa(e, t) {
  try {
    const r = Buffer.from(e, "base64"), i = r.subarray(0, 12), n = r.subarray(12, 28), s = r.subarray(28), a = Wc(t), o = Uc("aes-256-gcm", a, i);
    o.setAuthTag(n);
    const c = Buffer.concat([o.update(s), o.final()]).toString("utf8"), u = JSON.parse(c);
    return u.fingerprint === t ? u : null;
  } catch {
    return null;
  }
}
function qc(e) {
  const t = Xc(), r = xa(e, t);
  if (r) return { record: r, migratedFromLegacy: !1 };
  const i = bf();
  if (i === t) return null;
  const n = xa(e, i);
  return n ? {
    record: {
      ...n,
      fingerprint: t
    },
    migratedFromLegacy: !0
  } : null;
}
function Af(e, t = /* @__PURE__ */ new Date()) {
  return e.expiresAt ? new Date(e.expiresAt).getTime() < t.getTime() : !1;
}
let Nn = null;
const bs = /* @__PURE__ */ new Set();
function Cf() {
  return { url: "https://kzrldrpvrdypfvkuvtbv.supabase.co", anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cmxkcnB2cmR5cGZ2a3V2dGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjYxNDIsImV4cCI6MjEwMDgwMjE0Mn0.nmnbGa8GZpYi24CuLq90KOiBGoedLMuRg54pWKLSz74" };
}
function Of(e) {
  const t = zc(e);
  return se.set("licenseBlob", t), t;
}
function Kc(e, t) {
  if (!Zi()) return;
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
function Pi(e) {
  const t = Of(e);
  Kc(e, t);
}
function kf(e) {
  e.mode !== "dev" && (!e.licenseKey || bs.has(e.licenseKey) || Nn || (Nn = Ji(e.licenseKey).then((t) => {
    if (t.ok) {
      bs.add(e.licenseKey);
      return;
    }
    t.error === "device_limit_reached" || t.error === "offline" || t.error;
  }).catch(() => {
  }).finally(() => {
    Nn = null;
  })));
}
function Yc(e) {
  return e ? (e.migratedFromLegacy && (Pi(e.record), kf(e.record)), e.record) : null;
}
function Bi() {
  if (!Zi()) return;
  const e = Gs();
  if (!e) return;
  const t = se.get("licenseBlob") || zc(e);
  Kc(e, t);
}
function xf() {
  if (!Zi()) return null;
  try {
    return he().prepare(
      `SELECT license_key, expires_at, issued_to, fingerprint, activated_at, blob
         FROM app_license WHERE id = 'local'`
    ).get() ?? null;
  } catch {
    return null;
  }
}
function Df() {
  const e = se.get("licenseBlob");
  return e ? Yc(qc(e)) : null;
}
function Uf(e) {
  const t = Yc(qc(e.blob));
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
function Gs() {
  const e = xf();
  if (e) return Uf(e);
  const t = Df();
  return t && Zi() && Pi(t), t;
}
function Fi() {
  const e = _r();
  return e.status === "valid" ? e.record : null;
}
function _r() {
  const e = Gs();
  return e != null && e.licenseKey ? Af(e) ? { status: "expired", record: e } : { status: "valid", record: e } : { status: "none" };
}
function Pf(e) {
  const r = ["invalid_key", "revoked", "expired", "device_limit_reached"].find((n) => n === e);
  return r ? { ok: !1, error: r, message: {
    invalid_key: "This license key is not valid.",
    revoked: "This license has been revoked. Contact support.",
    expired: "This license has expired.",
    device_limit_reached: "This license has reached its device limit."
  }[r] } : { ok: !1, error: "unknown", message: `Activation failed: ${e}` };
}
async function Ji(e) {
  const t = e.trim(), r = Xc(), i = Cf();
  if (!i) {
    if (!Xe.isPackaged && t === "KAAROBAR-DEV-LOCAL") {
      const n = (/* @__PURE__ */ new Date()).toISOString(), s = {
        licenseKey: t,
        fingerprint: r,
        issuedTo: "Local Development",
        expiresAt: null,
        maxDevices: 1,
        activatedAt: n,
        lastVerifiedAt: n,
        mode: "dev"
      };
      return Pi(s), { ok: !0, issuedTo: s.issuedTo, expiresAt: null, maxDevices: 1, mode: "dev" };
    }
    return {
      ok: !1,
      error: "network_error",
      message: "License server is not configured. Set KAAROBAR_SUPABASE_URL and KAAROBAR_SUPABASE_ANON_KEY, or use KAAROBAR-DEV-LOCAL in development."
    };
  }
  try {
    const n = `${i.url.replace(/\/$/, "")}/rest/v1/rpc/validate_and_activate_license`, s = await fetch(n, {
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
    if (!s.ok)
      return {
        ok: !1,
        error: "network_error",
        message: await s.text() || `License server request failed (${s.status})`
      };
    const a = await s.json();
    if (!(a != null && a.ok)) return Pf((a == null ? void 0 : a.error) ?? "unknown");
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
    return Pi(c), bs.add(t), {
      ok: !0,
      issuedTo: c.issuedTo,
      expiresAt: c.expiresAt,
      maxDevices: c.maxDevices,
      mode: "supabase"
    };
  } catch (n) {
    const s = n instanceof Error ? n.message : "Network request failed", a = /fetch|network|ENOTFOUND|ECONNREFUSED/i.test(s);
    return {
      ok: !1,
      error: a ? "offline" : "network_error",
      message: a ? "No internet connection. License activation requires internet once." : s
    };
  }
}
const ve = [];
for (let e = 0; e < 256; ++e)
  ve.push((e + 256).toString(16).slice(1));
function Bf(e, t = 0) {
  return (ve[e[t + 0]] + ve[e[t + 1]] + ve[e[t + 2]] + ve[e[t + 3]] + "-" + ve[e[t + 4]] + ve[e[t + 5]] + "-" + ve[e[t + 6]] + ve[e[t + 7]] + "-" + ve[e[t + 8]] + ve[e[t + 9]] + "-" + ve[e[t + 10]] + ve[e[t + 11]] + ve[e[t + 12]] + ve[e[t + 13]] + ve[e[t + 14]] + ve[e[t + 15]]).toLowerCase();
}
const Ff = new Uint8Array(16);
function Mf() {
  return crypto.getRandomValues(Ff);
}
function ae(e, t, r) {
  return crypto.randomUUID ? crypto.randomUUID() : $f(e);
}
function $f(e, t, r) {
  var n;
  e = e || {};
  const i = e.random ?? ((n = e.rng) == null ? void 0 : n.call(e)) ?? Mf();
  if (i.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return i[6] = i[6] & 15 | 64, i[8] = i[8] & 63 | 128, Bf(i);
}
const Hf = ["en", "ur", "de", "pt", "es", "fr", "ar"], Xf = /* @__PURE__ */ new Set(["ur", "ar"]), Wf = {
  en: "en-US",
  ur: "ur-PK",
  de: "de-DE",
  pt: "pt-BR",
  es: "es-ES",
  fr: "fr-FR",
  ar: "ar-SA"
};
function zf(e) {
  return Hf.includes(e);
}
function Mt(e) {
  const t = e == null ? void 0 : e.trim().toLowerCase().split(/[-_]/)[0];
  return t && zf(t) ? t : "en";
}
function qf(e) {
  return Xf.has(e);
}
function Kf(e) {
  return Wf[e];
}
const Yf = `
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
`, jf = [
  {
    name: "001_initial_schema",
    up: (e) => {
      e.exec(Yf);
    }
  },
  {
    name: "002_refunds_audit_updates",
    up: (e) => {
      e.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'activity_log'").get() || (e.pragma("foreign_keys = OFF"), e.exec(`
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
        `)), e.prepare("PRAGMA table_info(sale_items)").all().some((i) => i.name === "refunded_qty") || e.exec("ALTER TABLE sale_items ADD COLUMN refunded_qty REAL NOT NULL DEFAULT 0");
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
      e.prepare("PRAGMA table_info(businesses)").all().some((n) => n.name === "business_nature") || e.exec(
        "ALTER TABLE businesses ADD COLUMN business_nature TEXT NOT NULL DEFAULT 'retail'"
      );
      const r = e.prepare("PRAGMA table_info(products)").all();
      r.some((n) => n.name === "kind") || e.exec("ALTER TABLE products ADD COLUMN kind TEXT NOT NULL DEFAULT 'item'"), r.some((n) => n.name === "tracks_stock") || e.exec("ALTER TABLE products ADD COLUMN tracks_stock INTEGER NOT NULL DEFAULT 1");
      const i = e.prepare("PRAGMA table_info(sales)").all();
      i.some((n) => n.name === "served_by_user_id") || e.exec("ALTER TABLE sales ADD COLUMN served_by_user_id TEXT"), i.some((n) => n.name === "service_mode") || e.exec("ALTER TABLE sales ADD COLUMN service_mode TEXT"), i.some((n) => n.name === "table_id") || e.exec("ALTER TABLE sales ADD COLUMN table_id TEXT"), e.exec(`
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
      e.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'payments'").get() && (e.pragma("foreign_keys = OFF"), e.exec(`
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
      e.prepare("PRAGMA table_info(products)").all().some((u) => u.name === "kitchen_station") || e.exec("ALTER TABLE products ADD COLUMN kitchen_station TEXT NOT NULL DEFAULT 'main'");
      const r = e.prepare("PRAGMA table_info(sales)").all(), i = new Set(r.map((u) => u.name));
      i.has("rider_user_id") || e.exec("ALTER TABLE sales ADD COLUMN rider_user_id TEXT"), i.has("delivery_status") || e.exec("ALTER TABLE sales ADD COLUMN delivery_status TEXT"), i.has("delivery_notes") || e.exec("ALTER TABLE sales ADD COLUMN delivery_notes TEXT");
      const n = e.prepare("PRAGMA table_info(pos_tickets)").all(), s = new Set(n.map((u) => u.name));
      s.has("rider_user_id") || e.exec("ALTER TABLE pos_tickets ADD COLUMN rider_user_id TEXT"), s.has("delivery_status") || e.exec("ALTER TABLE pos_tickets ADD COLUMN delivery_status TEXT"), s.has("delivery_notes") || e.exec("ALTER TABLE pos_tickets ADD COLUMN delivery_notes TEXT");
      const a = e.prepare("PRAGMA table_info(pos_ticket_items)").all(), o = new Set(a.map((u) => u.name));
      o.has("seat_no") || e.exec("ALTER TABLE pos_ticket_items ADD COLUMN seat_no INTEGER"), o.has("kitchen_status") || e.exec(
        "ALTER TABLE pos_ticket_items ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'held'"
      ), o.has("fired_at") || e.exec("ALTER TABLE pos_ticket_items ADD COLUMN fired_at TEXT"), o.has("bumped_at") || e.exec("ALTER TABLE pos_ticket_items ADD COLUMN bumped_at TEXT"), o.has("billed_qty") || e.exec("ALTER TABLE pos_ticket_items ADD COLUMN billed_qty REAL NOT NULL DEFAULT 0"), o.has("price_rule_id") || e.exec("ALTER TABLE pos_ticket_items ADD COLUMN price_rule_id TEXT"), e.prepare("PRAGMA table_info(sale_items)").all().some((u) => u.name === "price_rule_id") || e.exec("ALTER TABLE sale_items ADD COLUMN price_rule_id TEXT"), e.exec(`
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
  }
];
function lt(e) {
  e.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
  const t = e.prepare("SELECT name FROM schema_migrations WHERE name = ?"), r = e.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  for (const i of jf) {
    if (t.get(i.name)) continue;
    e.transaction(() => {
      i.up(e), r.run(i.name, (/* @__PURE__ */ new Date()).toISOString());
    })();
  }
}
var Er = {}, In = {}, pe = {}, di = { exports: {} }, fi = { exports: {} }, Da;
function Qi() {
  if (Da) return fi.exports;
  Da = 1, typeof process > "u" || !process.version || process.version.indexOf("v0.") === 0 || process.version.indexOf("v1.") === 0 && process.version.indexOf("v1.8.") !== 0 ? fi.exports = { nextTick: e } : fi.exports = process;
  function e(t, r, i, n) {
    if (typeof t != "function")
      throw new TypeError('"callback" argument must be a function');
    var s = arguments.length, a, o;
    switch (s) {
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
          t.call(null, r, i, n);
        });
      default:
        for (a = new Array(s - 1), o = 0; o < a.length; )
          a[o++] = arguments[o];
        return process.nextTick(function() {
          t.apply(null, a);
        });
    }
  }
  return fi.exports;
}
var Ln, Ua;
function Gf() {
  if (Ua) return Ln;
  Ua = 1;
  var e = {}.toString;
  return Ln = Array.isArray || function(t) {
    return e.call(t) == "[object Array]";
  }, Ln;
}
var An, Pa;
function jc() {
  return Pa || (Pa = 1, An = Kr), An;
}
var hi = { exports: {} }, Ba;
function en() {
  return Ba || (Ba = 1, function(e, t) {
    var r = Bc, i = r.Buffer;
    function n(a, o) {
      for (var c in a)
        o[c] = a[c];
    }
    i.from && i.alloc && i.allocUnsafe && i.allocUnsafeSlow ? e.exports = r : (n(r, t), t.Buffer = s);
    function s(a, o, c) {
      return i(a, o, c);
    }
    n(i, s), s.from = function(a, o, c) {
      if (typeof a == "number")
        throw new TypeError("Argument must not be a number");
      return i(a, o, c);
    }, s.alloc = function(a, o, c) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      var u = i(a);
      return o !== void 0 ? typeof c == "string" ? u.fill(o, c) : u.fill(o) : u.fill(0), u;
    }, s.allocUnsafe = function(a) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      return i(a);
    }, s.allocUnsafeSlow = function(a) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      return r.SlowBuffer(a);
    };
  }(hi, hi.exports)), hi.exports;
}
var be = {}, Fa;
function jr() {
  if (Fa) return be;
  Fa = 1;
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
  function n(E) {
    return typeof E == "number";
  }
  be.isNumber = n;
  function s(E) {
    return typeof E == "string";
  }
  be.isString = s;
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
var pi = { exports: {} }, _i = { exports: {} }, Ma;
function Vf() {
  return Ma || (Ma = 1, typeof Object.create == "function" ? _i.exports = function(t, r) {
    r && (t.super_ = r, t.prototype = Object.create(r.prototype, {
      constructor: {
        value: t,
        enumerable: !1,
        writable: !0,
        configurable: !0
      }
    }));
  } : _i.exports = function(t, r) {
    if (r) {
      t.super_ = r;
      var i = function() {
      };
      i.prototype = r.prototype, t.prototype = new i(), t.prototype.constructor = t;
    }
  }), _i.exports;
}
var $a;
function Gr() {
  if ($a) return pi.exports;
  $a = 1;
  try {
    var e = require("util");
    if (typeof e.inherits != "function") throw "";
    pi.exports = e.inherits;
  } catch {
    pi.exports = Vf();
  }
  return pi.exports;
}
var Cn = { exports: {} }, Ha;
function Zf() {
  return Ha || (Ha = 1, function(e) {
    function t(s, a) {
      if (!(s instanceof a))
        throw new TypeError("Cannot call a class as a function");
    }
    var r = en().Buffer, i = ct;
    function n(s, a, o) {
      s.copy(a, o);
    }
    e.exports = function() {
      function s() {
        t(this, s), this.head = null, this.tail = null, this.length = 0;
      }
      return s.prototype.push = function(o) {
        var c = { data: o, next: null };
        this.length > 0 ? this.tail.next = c : this.head = c, this.tail = c, ++this.length;
      }, s.prototype.unshift = function(o) {
        var c = { data: o, next: this.head };
        this.length === 0 && (this.tail = c), this.head = c, ++this.length;
      }, s.prototype.shift = function() {
        if (this.length !== 0) {
          var o = this.head.data;
          return this.length === 1 ? this.head = this.tail = null : this.head = this.head.next, --this.length, o;
        }
      }, s.prototype.clear = function() {
        this.head = this.tail = null, this.length = 0;
      }, s.prototype.join = function(o) {
        if (this.length === 0) return "";
        for (var c = this.head, u = "" + c.data; c = c.next; )
          u += o + c.data;
        return u;
      }, s.prototype.concat = function(o) {
        if (this.length === 0) return r.alloc(0);
        for (var c = r.allocUnsafe(o >>> 0), u = this.head, l = 0; u; )
          n(u.data, c, l), l += u.data.length, u = u.next;
        return c;
      }, s;
    }(), i && i.inspect && i.inspect.custom && (e.exports.prototype[i.inspect.custom] = function() {
      var s = i.inspect({ length: this.length });
      return this.constructor.name + " " + s;
    });
  }(Cn)), Cn.exports;
}
var On, Xa;
function Gc() {
  if (Xa) return On;
  Xa = 1;
  var e = Qi();
  function t(n, s) {
    var a = this, o = this._readableState && this._readableState.destroyed, c = this._writableState && this._writableState.destroyed;
    return o || c ? (s ? s(n) : n && (this._writableState ? this._writableState.errorEmitted || (this._writableState.errorEmitted = !0, e.nextTick(i, this, n)) : e.nextTick(i, this, n)), this) : (this._readableState && (this._readableState.destroyed = !0), this._writableState && (this._writableState.destroyed = !0), this._destroy(n || null, function(u) {
      !s && u ? a._writableState ? a._writableState.errorEmitted || (a._writableState.errorEmitted = !0, e.nextTick(i, a, u)) : e.nextTick(i, a, u) : s && s(u);
    }), this);
  }
  function r() {
    this._readableState && (this._readableState.destroyed = !1, this._readableState.reading = !1, this._readableState.ended = !1, this._readableState.endEmitted = !1), this._writableState && (this._writableState.destroyed = !1, this._writableState.ended = !1, this._writableState.ending = !1, this._writableState.finalCalled = !1, this._writableState.prefinished = !1, this._writableState.finished = !1, this._writableState.errorEmitted = !1);
  }
  function i(n, s) {
    n.emit("error", s);
  }
  return On = {
    destroy: t,
    undestroy: r
  }, On;
}
var kn, Wa;
function Jf() {
  return Wa || (Wa = 1, kn = ct.deprecate), kn;
}
var xn, za;
function Vc() {
  if (za) return xn;
  za = 1;
  var e = Qi();
  xn = E;
  function t(R) {
    var N = this;
    this.next = null, this.entry = null, this.finish = function() {
      Gt(N, R);
    };
  }
  var r = !process.browser && ["v0.10", "v0.9."].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : e.nextTick, i;
  E.WritableState = f;
  var n = Object.create(jr());
  n.inherits = Gr();
  var s = {
    deprecate: Jf()
  }, a = jc(), o = en().Buffer, c = (typeof ye < "u" ? ye : typeof window < "u" ? window : typeof self < "u" ? self : {}).Uint8Array || function() {
  };
  function u(R) {
    return o.from(R);
  }
  function l(R) {
    return o.isBuffer(R) || R instanceof c;
  }
  var p = Gc();
  n.inherits(E, a);
  function d() {
  }
  function f(R, N) {
    i = i || ur(), R = R || {};
    var x = N instanceof i;
    this.objectMode = !!R.objectMode, x && (this.objectMode = this.objectMode || !!R.writableObjectMode);
    var W = R.highWaterMark, G = R.writableHighWaterMark, J = this.objectMode ? 16 : 16 * 1024;
    W || W === 0 ? this.highWaterMark = W : x && (G || G === 0) ? this.highWaterMark = G : this.highWaterMark = J, this.highWaterMark = Math.floor(this.highWaterMark), this.finalCalled = !1, this.needDrain = !1, this.ending = !1, this.ended = !1, this.finished = !1, this.destroyed = !1;
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
        get: s.deprecate(function() {
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
    if (i = i || ur(), !_.call(E, this) && !(this instanceof i))
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
    var G = !0, J = !1;
    return x === null ? J = new TypeError("May not write null values to stream") : typeof x != "string" && x !== void 0 && !N.objectMode && (J = new TypeError("Invalid non-string/buffer chunk")), J && (R.emit("error", J), e.nextTick(W, J), G = !1), G;
  }
  E.prototype.write = function(R, N, x) {
    var W = this._writableState, G = !1, J = !W.objectMode && l(R);
    return J && !o.isBuffer(R) && (R = u(R)), typeof N == "function" && (x = N, N = null), J ? N = "buffer" : N || (N = W.defaultEncoding), typeof x != "function" && (x = d), W.ended ? w(this, x) : (J || h(this, W, R, x)) && (W.pendingcb++, G = b(this, W, J, R, N, x)), G;
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
  function b(R, N, x, W, G, J) {
    if (!x) {
      var Me = m(N, W, G);
      W !== Me && (x = !0, G = "buffer", W = Me);
    }
    var $e = N.objectMode ? 1 : W.length;
    N.length += $e;
    var Ct = N.length < N.highWaterMark;
    if (Ct || (N.needDrain = !0), N.writing || N.corked) {
      var Ot = N.lastBufferedRequest;
      N.lastBufferedRequest = {
        chunk: W,
        encoding: G,
        isBuf: x,
        callback: J,
        next: null
      }, Ot ? Ot.next = N.lastBufferedRequest : N.bufferedRequest = N.lastBufferedRequest, N.bufferedRequestCount += 1;
    } else
      v(R, N, !1, $e, W, G, J);
    return Ct;
  }
  function v(R, N, x, W, G, J, Me) {
    N.writelen = W, N.writecb = Me, N.writing = !0, N.sync = !0, x ? R._writev(G, N.onwrite) : R._write(G, J, N.onwrite), N.sync = !1;
  }
  function S(R, N, x, W, G) {
    --N.pendingcb, x ? (e.nextTick(G, W), e.nextTick(ge, R, N), R._writableState.errorEmitted = !0, R.emit("error", W)) : (G(W), R._writableState.errorEmitted = !0, R.emit("error", W), ge(R, N));
  }
  function L(R) {
    R.writing = !1, R.writecb = null, R.length -= R.writelen, R.writelen = 0;
  }
  function I(R, N) {
    var x = R._writableState, W = x.sync, G = x.writecb;
    if (L(x), N) S(R, x, W, N, G);
    else {
      var J = D(x);
      !J && !x.corked && !x.bufferProcessing && x.bufferedRequest && H(R, x), W ? r(O, R, x, J, G) : O(R, x, J, G);
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
      var W = N.bufferedRequestCount, G = new Array(W), J = N.corkedRequestsFree;
      J.entry = x;
      for (var Me = 0, $e = !0; x; )
        G[Me] = x, x.isBuf || ($e = !1), x = x.next, Me += 1;
      G.allBuffers = $e, v(R, N, !0, N.length, G, "", J.finish), N.pendingcb++, N.lastBufferedRequest = null, J.next ? (N.corkedRequestsFree = J.next, J.next = null) : N.corkedRequestsFree = new t(N), N.bufferedRequestCount = 0;
    } else {
      for (; x; ) {
        var Ct = x.chunk, Ot = x.encoding, T = x.callback, g = N.objectMode ? 1 : Ct.length;
        if (v(R, N, !1, g, Ct, Ot, T), x = x.next, N.bufferedRequestCount--, N.writing)
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
    typeof R == "function" ? (x = R, R = null, N = null) : typeof N == "function" && (x = N, N = null), R != null && this.write(R, N), W.corked && (W.corked = 1, this.uncork()), W.ending || ht(this, W, x);
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
  function ht(R, N, x) {
    N.ending = !0, ge(R, N), x && (N.finished ? e.nextTick(x) : R.once("finish", x)), N.ended = !0, R.writable = !1;
  }
  function Gt(R, N, x) {
    var W = R.entry;
    for (R.entry = null; W; ) {
      var G = W.callback;
      N.pendingcb--, G(x), W = W.next;
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
  }, xn;
}
var Dn, qa;
function ur() {
  if (qa) return Dn;
  qa = 1;
  var e = Qi(), t = Object.keys || function(p) {
    var d = [];
    for (var f in p)
      d.push(f);
    return d;
  };
  Dn = c;
  var r = Object.create(jr());
  r.inherits = Gr();
  var i = Zc(), n = Vc();
  r.inherits(c, i);
  for (var s = t(n.prototype), a = 0; a < s.length; a++) {
    var o = s[a];
    c.prototype[o] || (c.prototype[o] = n.prototype[o]);
  }
  function c(p) {
    if (!(this instanceof c)) return new c(p);
    i.call(this, p), n.call(this, p), p && p.readable === !1 && (this.readable = !1), p && p.writable === !1 && (this.writable = !1), this.allowHalfOpen = !0, p && p.allowHalfOpen === !1 && (this.allowHalfOpen = !1), this.once("end", u);
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
  }, Dn;
}
var Un = {}, Ka;
function Ya() {
  if (Ka) return Un;
  Ka = 1;
  var e = en().Buffer, t = e.isEncoding || function(h) {
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
  Un.StringDecoder = n;
  function n(h) {
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
  n.prototype.write = function(h) {
    if (h.length === 0) return "";
    var m, b;
    if (this.lastNeed) {
      if (m = this.fillLast(h), m === void 0) return "";
      b = this.lastNeed, this.lastNeed = 0;
    } else
      b = 0;
    return b < h.length ? m ? m + this.text(h, b) : this.text(h, b) : m || "";
  }, n.prototype.end = l, n.prototype.text = u, n.prototype.fillLast = function(h) {
    if (this.lastNeed <= h.length)
      return h.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
    h.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, h.length), this.lastNeed -= h.length;
  };
  function s(h) {
    return h <= 127 ? 0 : h >> 5 === 6 ? 2 : h >> 4 === 14 ? 3 : h >> 3 === 30 ? 4 : h >> 6 === 2 ? -1 : -2;
  }
  function a(h, m, b) {
    var v = m.length - 1;
    if (v < b) return 0;
    var S = s(m[v]);
    return S >= 0 ? (S > 0 && (h.lastNeed = S - 1), S) : --v < b || S === -2 ? 0 : (S = s(m[v]), S >= 0 ? (S > 0 && (h.lastNeed = S - 2), S) : --v < b || S === -2 ? 0 : (S = s(m[v]), S >= 0 ? (S > 0 && (S === 2 ? S = 0 : h.lastNeed = S - 3), S) : 0));
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
  return Un;
}
var Pn, ja;
function Zc() {
  if (ja) return Pn;
  ja = 1;
  var e = Qi();
  Pn = m;
  var t = Gf(), r;
  m.ReadableState = h, Kd.EventEmitter;
  var i = function(T, g) {
    return T.listeners(g).length;
  }, n = jc(), s = en().Buffer, a = (typeof ye < "u" ? ye : typeof window < "u" ? window : typeof self < "u" ? self : {}).Uint8Array || function() {
  };
  function o(T) {
    return s.from(T);
  }
  function c(T) {
    return s.isBuffer(T) || T instanceof a;
  }
  var u = Object.create(jr());
  u.inherits = Gr();
  var l = ct, p = void 0;
  l && l.debuglog ? p = l.debuglog("stream") : p = function() {
  };
  var d = Zf(), f = Gc(), _;
  u.inherits(m, n);
  var E = ["error", "close", "destroy", "pause", "resume"];
  function w(T, g, k) {
    if (typeof T.prependListener == "function") return T.prependListener(g, k);
    !T._events || !T._events[g] ? T.on(g, k) : t(T._events[g]) ? T._events[g].unshift(k) : T._events[g] = [k, T._events[g]];
  }
  function h(T, g) {
    r = r || ur(), T = T || {};
    var k = g instanceof r;
    this.objectMode = !!T.objectMode, k && (this.objectMode = this.objectMode || !!T.readableObjectMode);
    var U = T.highWaterMark, Z = T.readableHighWaterMark, z = this.objectMode ? 16 : 16 * 1024;
    U || U === 0 ? this.highWaterMark = U : k && (Z || Z === 0) ? this.highWaterMark = Z : this.highWaterMark = z, this.highWaterMark = Math.floor(this.highWaterMark), this.buffer = new d(), this.length = 0, this.pipes = null, this.pipesCount = 0, this.flowing = null, this.ended = !1, this.endEmitted = !1, this.reading = !1, this.sync = !0, this.needReadable = !1, this.emittedReadable = !1, this.readableListening = !1, this.resumeScheduled = !1, this.destroyed = !1, this.defaultEncoding = T.defaultEncoding || "utf8", this.awaitDrain = 0, this.readingMore = !1, this.decoder = null, this.encoding = null, T.encoding && (_ || (_ = Ya().StringDecoder), this.decoder = new _(T.encoding), this.encoding = T.encoding);
  }
  function m(T) {
    if (r = r || ur(), !(this instanceof m)) return new m(T);
    this._readableState = new h(T, this), this.readable = !0, T && (typeof T.read == "function" && (this._read = T.read), typeof T.destroy == "function" && (this._destroy = T.destroy)), n.call(this);
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
    return k.objectMode ? U = !0 : typeof T == "string" && (g = g || k.defaultEncoding, g !== k.encoding && (T = s.from(T, g), g = ""), U = !0), b(this, T, g, !1, U);
  }, m.prototype.unshift = function(T) {
    return b(this, T, null, !0, !1);
  };
  function b(T, g, k, U, Z) {
    var z = T._readableState;
    if (g === null)
      z.reading = !1, H(T, z);
    else {
      var K;
      Z || (K = S(z, g)), K ? T.emit("error", K) : z.objectMode || g && g.length > 0 ? (typeof g != "string" && !z.objectMode && Object.getPrototypeOf(g) !== s.prototype && (g = o(g)), U ? z.endEmitted ? T.emit("error", new Error("stream.unshift() after end event")) : v(T, z, g, !0) : z.ended ? T.emit("error", new Error("stream.push() after EOF")) : (z.reading = !1, z.decoder && !k ? (g = z.decoder.write(g), z.objectMode || g.length !== 0 ? v(T, z, g, !1) : q(T, z)) : v(T, z, g, !1))) : U || (z.reading = !1);
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
    return _ || (_ = Ya().StringDecoder), this._readableState.decoder = new _(T), this._readableState.encoding = T, this;
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
    var Z;
    return T > 0 ? Z = W(T, g) : Z = null, Z === null ? (g.needReadable = !0, T = 0) : g.length -= T, g.length === 0 && (g.ended || (g.needReadable = !0), k !== T && g.ended && $e(this)), Z !== null && this.emit("data", Z), Z;
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
    var Z = (!g || g.end !== !1) && T !== process.stdout && T !== process.stderr, z = Z ? ci : Ir;
    U.endEmitted ? e.nextTick(z) : k.once("end", z), T.on("unpipe", K);
    function K(Vt, Lr) {
      p("onunpipe"), Vt === k && Lr && Lr.hasUnpiped === !1 && (Lr.hasUnpiped = !0, Md());
    }
    function ci() {
      p("onend"), T.end();
    }
    var vn = ht(k);
    T.on("drain", vn);
    var Aa = !1;
    function Md() {
      p("cleanup"), T.removeListener("close", Sn), T.removeListener("finish", Rn), T.removeListener("drain", vn), T.removeListener("error", wn), T.removeListener("unpipe", K), k.removeListener("end", ci), k.removeListener("end", Ir), k.removeListener("data", Ca), Aa = !0, U.awaitDrain && (!T._writableState || T._writableState.needDrain) && vn();
    }
    var yn = !1;
    k.on("data", Ca);
    function Ca(Vt) {
      p("ondata"), yn = !1;
      var Lr = T.write(Vt);
      Lr === !1 && !yn && ((U.pipesCount === 1 && U.pipes === T || U.pipesCount > 1 && Ot(U.pipes, T) !== -1) && !Aa && (p("false write response, pause", U.awaitDrain), U.awaitDrain++, yn = !0), k.pause());
    }
    function wn(Vt) {
      p("onerror", Vt), Ir(), T.removeListener("error", wn), i(T, "error") === 0 && T.emit("error", Vt);
    }
    w(T, "error", wn);
    function Sn() {
      T.removeListener("finish", Rn), Ir();
    }
    T.once("close", Sn);
    function Rn() {
      p("onfinish"), T.removeListener("close", Sn), Ir();
    }
    T.once("finish", Rn);
    function Ir() {
      p("unpipe"), k.unpipe(T);
    }
    return T.emit("pipe", k), U.flowing || (p("pipe resume"), k.resume()), T;
  };
  function ht(T) {
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
      var U = g.pipes, Z = g.pipesCount;
      g.pipes = null, g.pipesCount = 0, g.flowing = !1;
      for (var z = 0; z < Z; z++)
        U[z].emit("unpipe", this, { hasUnpiped: !1 });
      return this;
    }
    var K = Ot(g.pipes, T);
    return K === -1 ? this : (g.pipes.splice(K, 1), g.pipesCount -= 1, g.pipesCount === 1 && (g.pipes = g.pipes[0]), T.emit("unpipe", this, k), this);
  }, m.prototype.on = function(T, g) {
    var k = n.prototype.on.call(this, T, g);
    if (T === "data")
      this._readableState.flowing !== !1 && this.resume();
    else if (T === "readable") {
      var U = this._readableState;
      !U.endEmitted && !U.readableListening && (U.readableListening = U.needReadable = !0, U.emittedReadable = !1, U.reading ? U.length && D(this) : e.nextTick(Gt, this));
    }
    return k;
  }, m.prototype.addListener = m.prototype.on;
  function Gt(T) {
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
        var ci = g.push(K);
        ci || (U = !0, T.pause());
      }
    });
    for (var Z in T)
      this[Z] === void 0 && typeof T[Z] == "function" && (this[Z] = /* @__PURE__ */ function(K) {
        return function() {
          return T[K].apply(T, arguments);
        };
      }(Z));
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
    return g.objectMode ? k = g.buffer.shift() : !T || T >= g.length ? (g.decoder ? k = g.buffer.join("") : g.buffer.length === 1 ? k = g.buffer.head.data : k = g.buffer.concat(g.length), g.buffer.clear()) : k = G(T, g.buffer, g.decoder), k;
  }
  function G(T, g, k) {
    var U;
    return T < g.head.data.length ? (U = g.head.data.slice(0, T), g.head.data = g.head.data.slice(T)) : T === g.head.data.length ? U = g.shift() : U = k ? J(T, g) : Me(T, g), U;
  }
  function J(T, g) {
    var k = g.head, U = 1, Z = k.data;
    for (T -= Z.length; k = k.next; ) {
      var z = k.data, K = T > z.length ? z.length : T;
      if (K === z.length ? Z += z : Z += z.slice(0, T), T -= K, T === 0) {
        K === z.length ? (++U, k.next ? g.head = k.next : g.head = g.tail = null) : (g.head = k, k.data = z.slice(K));
        break;
      }
      ++U;
    }
    return g.length -= U, Z;
  }
  function Me(T, g) {
    var k = s.allocUnsafe(T), U = g.head, Z = 1;
    for (U.data.copy(k), T -= U.data.length; U = U.next; ) {
      var z = U.data, K = T > z.length ? z.length : T;
      if (z.copy(k, k.length - T, 0, K), T -= K, T === 0) {
        K === z.length ? (++Z, U.next ? g.head = U.next : g.head = g.tail = null) : (g.head = U, U.data = z.slice(K));
        break;
      }
      ++Z;
    }
    return g.length -= Z, k;
  }
  function $e(T) {
    var g = T._readableState;
    if (g.length > 0) throw new Error('"endReadable()" called on non-empty stream');
    g.endEmitted || (g.ended = !0, e.nextTick(Ct, g, T));
  }
  function Ct(T, g) {
    !T.endEmitted && T.length === 0 && (T.endEmitted = !0, g.readable = !1, g.emit("end"));
  }
  function Ot(T, g) {
    for (var k = 0, U = T.length; k < U; k++)
      if (T[k] === g) return k;
    return -1;
  }
  return Pn;
}
var Bn, Ga;
function Jc() {
  if (Ga) return Bn;
  Ga = 1, Bn = i;
  var e = ur(), t = Object.create(jr());
  t.inherits = Gr(), t.inherits(i, e);
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
    }, this._readableState.needReadable = !0, this._readableState.sync = !1, a && (typeof a.transform == "function" && (this._transform = a.transform), typeof a.flush == "function" && (this._flush = a.flush)), this.on("prefinish", n);
  }
  function n() {
    var a = this;
    typeof this._flush == "function" ? this._flush(function(o, c) {
      s(a, o, c);
    }) : s(this, null, null);
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
  function s(a, o, c) {
    if (o) return a.emit("error", o);
    if (c != null && a.push(c), a._writableState.length) throw new Error("Calling transform done when ws.length != 0");
    if (a._transformState.transforming) throw new Error("Calling transform done when still transforming");
    return a.push(null);
  }
  return Bn;
}
var Fn, Va;
function Qf() {
  if (Va) return Fn;
  Va = 1, Fn = r;
  var e = Jc(), t = Object.create(jr());
  t.inherits = Gr(), t.inherits(r, e);
  function r(i) {
    if (!(this instanceof r)) return new r(i);
    e.call(this, i);
  }
  return r.prototype._transform = function(i, n, s) {
    s(null, i);
  }, Fn;
}
var Za;
function Qc() {
  return Za || (Za = 1, function(e, t) {
    var r = Kr;
    process.env.READABLE_STREAM === "disable" && r ? (e.exports = r, t = e.exports = r.Readable, t.Readable = r.Readable, t.Writable = r.Writable, t.Duplex = r.Duplex, t.Transform = r.Transform, t.PassThrough = r.PassThrough, t.Stream = r) : (t = e.exports = Zc(), t.Stream = r || t, t.Readable = t, t.Writable = Vc(), t.Duplex = ur(), t.Transform = Jc(), t.PassThrough = Qf());
  }(di, di.exports)), di.exports;
}
var Ja, Ei;
pe.base64 = !0;
pe.array = !0;
pe.string = !0;
pe.arraybuffer = typeof ArrayBuffer < "u" && typeof Uint8Array < "u";
pe.nodebuffer = typeof Buffer < "u";
pe.uint8array = typeof Uint8Array < "u";
if (typeof ArrayBuffer > "u")
  Ei = pe.blob = !1;
else {
  var Qa = new ArrayBuffer(0);
  try {
    Ei = pe.blob = new Blob([Qa], {
      type: "application/zip"
    }).size === 0;
  } catch {
    try {
      var eh = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder, eo = new eh();
      eo.append(Qa), Ei = pe.blob = eo.getBlob("application/zip").size === 0;
    } catch {
      Ei = pe.blob = !1;
    }
  }
}
try {
  Ja = pe.nodestream = !!Qc().Readable;
} catch {
  Ja = pe.nodestream = !1;
}
var mi = {}, to;
function eu() {
  if (to) return mi;
  to = 1;
  var e = le(), t = pe, r = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  return mi.encode = function(i) {
    for (var n = [], s, a, o, c, u, l, p, d = 0, f = i.length, _ = f, E = e.getTypeOf(i) !== "string"; d < i.length; )
      _ = f - d, E ? (s = i[d++], a = d < f ? i[d++] : 0, o = d < f ? i[d++] : 0) : (s = i.charCodeAt(d++), a = d < f ? i.charCodeAt(d++) : 0, o = d < f ? i.charCodeAt(d++) : 0), c = s >> 2, u = (s & 3) << 4 | a >> 4, l = _ > 1 ? (a & 15) << 2 | o >> 6 : 64, p = _ > 2 ? o & 63 : 64, n.push(r.charAt(c) + r.charAt(u) + r.charAt(l) + r.charAt(p));
    return n.join("");
  }, mi.decode = function(i) {
    var n, s, a, o, c, u, l, p = 0, d = 0, f = "data:";
    if (i.substr(0, f.length) === f)
      throw new Error("Invalid base64 input, it looks like a data url.");
    i = i.replace(/[^A-Za-z0-9+/=]/g, "");
    var _ = i.length * 3 / 4;
    if (i.charAt(i.length - 1) === r.charAt(64) && _--, i.charAt(i.length - 2) === r.charAt(64) && _--, _ % 1 !== 0)
      throw new Error("Invalid base64 input, bad content length.");
    var E;
    for (t.uint8array ? E = new Uint8Array(_ | 0) : E = new Array(_ | 0); p < i.length; )
      o = r.indexOf(i.charAt(p++)), c = r.indexOf(i.charAt(p++)), u = r.indexOf(i.charAt(p++)), l = r.indexOf(i.charAt(p++)), n = o << 2 | c >> 4, s = (c & 15) << 4 | u >> 2, a = (u & 3) << 6 | l, E[d++] = n, u !== 64 && (E[d++] = s), l !== 64 && (E[d++] = a);
    return E;
  }, mi;
}
var tn = {
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
}, Mn, ro;
function th() {
  if (ro) return Mn;
  ro = 1;
  var e = ye.MutationObserver || ye.WebKitMutationObserver, t;
  if (process.browser)
    if (e) {
      var r = 0, i = new e(c), n = ye.document.createTextNode("");
      i.observe(n, {
        characterData: !0
      }), t = function() {
        n.data = r = ++r % 2;
      };
    } else if (!ye.setImmediate && typeof ye.MessageChannel < "u") {
      var s = new ye.MessageChannel();
      s.port1.onmessage = c, t = function() {
        s.port2.postMessage(0);
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
  Mn = u;
  function u(l) {
    o.push(l) === 1 && !a && t();
  }
  return Mn;
}
var $n, io;
function rh() {
  if (io) return $n;
  io = 1;
  var e = th();
  function t() {
  }
  var r = {}, i = ["REJECTED"], n = ["FULFILLED"], s = ["PENDING"];
  if (!process.browser)
    var a = ["UNHANDLED"];
  $n = o;
  function o(h) {
    if (typeof h != "function")
      throw new TypeError("resolver must be a function");
    this.state = s, this.queue = [], this.outcome = void 0, process.browser || (this.handled = a), h !== t && p(this, h);
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
    if (typeof h != "function" && this.state === n || typeof m != "function" && this.state === i)
      return this;
    var b = new this.constructor(t);
    if (process.browser || this.handled === a && (this.handled = null), this.state !== s) {
      var v = this.state === n ? h : m;
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
      h.state = n, h.outcome = m;
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
  return $n;
}
var vs = null;
typeof Promise < "u" ? vs = Promise : vs = rh();
var Vr = {
  Promise: vs
};
(function(e, t) {
  if (e.setImmediate)
    return;
  var r = 1, i = {}, n = !1, s = e.document, a;
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
    if (n)
      setTimeout(l, 0, m);
    else {
      var b = i[m];
      if (b) {
        n = !0;
        try {
          u(b);
        } finally {
          c(m), n = !1;
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
    var m = s.documentElement;
    a = function(b) {
      var v = s.createElement("script");
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
  h = h && h.setTimeout ? h : e, {}.toString.call(e.process) === "[object process]" ? p() : d() ? f() : e.MessageChannel ? _() : s && "onreadystatechange" in s.createElement("script") ? E() : w(), h.setImmediate = o, h.clearImmediate = c;
})(typeof self > "u" ? ye : self);
var no;
function le() {
  return no || (no = 1, function(e) {
    var t = pe, r = eu(), i = tn, n = Vr;
    function s(d) {
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
      var h = n.Promise.resolve(f).then(function(m) {
        var b = t.blob && (m instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(m)) !== -1);
        return b && typeof FileReader < "u" ? new n.Promise(function(v, S) {
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
        return b ? (b === "arraybuffer" ? m = e.transformTo("uint8array", m) : b === "string" && (w ? m = r.decode(m) : _ && E !== !0 && (m = s(m))), m) : n.Promise.reject(
          new Error("Can't read the data of '" + d + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?")
        );
      });
    };
  }(In)), In;
}
function tu(e) {
  this.name = e || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = !0, this.isFinished = !1, this.isLocked = !1, this._listeners = {
    data: [],
    end: [],
    error: []
  }, this.previous = null;
}
tu.prototype = {
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
var Be = tu;
(function(e) {
  for (var t = le(), r = pe, i = tn, n = Be, s = new Array(256), a = 0; a < 256; a++)
    s[a] = a >= 252 ? 6 : a >= 248 ? 5 : a >= 240 ? 4 : a >= 224 ? 3 : a >= 192 ? 2 : 1;
  s[254] = s[254] = 1;
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
    return _ < 0 || _ === 0 ? f : _ + s[d[_]] > f ? _ : f;
  }, u = function(d) {
    var f, _, E, w, h = d.length, m = new Array(h * 2);
    for (_ = 0, f = 0; f < h; ) {
      if (E = d[f++], E < 128) {
        m[_++] = E;
        continue;
      }
      if (w = s[E], w > 4) {
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
    n.call(this, "utf-8 decode"), this.leftOver = null;
  }
  t.inherits(l, n), l.prototype.processChunk = function(d) {
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
    n.call(this, "utf-8 encode");
  }
  t.inherits(p, n), p.prototype.processChunk = function(d) {
    this.push({
      data: e.utf8encode(d.data),
      meta: d.meta
    });
  }, e.Utf8EncodeWorker = p;
})(Er);
var ru = Be, iu = le();
function Vs(e) {
  ru.call(this, "ConvertWorker to " + e), this.destType = e;
}
iu.inherits(Vs, ru);
Vs.prototype.processChunk = function(e) {
  this.push({
    data: iu.transformTo(this.destType, e.data),
    meta: e.meta
  });
};
var ih = Vs, Hn, so;
function nh() {
  if (so) return Hn;
  so = 1;
  var e = Qc().Readable, t = le();
  t.inherits(r, e);
  function r(i, n, s) {
    e.call(this, n), this._helper = i;
    var a = this;
    i.on("data", function(o, c) {
      a.push(o) || a._helper.pause(), s && s(c);
    }).on("error", function(o) {
      a.emit("error", o);
    }).on("end", function() {
      a.push(null);
    });
  }
  return r.prototype._read = function() {
    this._helper.resume();
  }, Hn = r, Hn;
}
var Bt = le(), sh = ih, ah = Be, oh = eu(), ch = pe, uh = Vr, nu = null;
if (ch.nodestream)
  try {
    nu = nh();
  } catch {
  }
function lh(e, t, r) {
  switch (e) {
    case "blob":
      return Bt.newBlob(Bt.transformTo("arraybuffer", t), r);
    case "base64":
      return oh.encode(t);
    default:
      return Bt.transformTo(e, t);
  }
}
function dh(e, t) {
  var r, i = 0, n = null, s = 0;
  for (r = 0; r < t.length; r++)
    s += t[r].length;
  switch (e) {
    case "string":
      return t.join("");
    case "array":
      return Array.prototype.concat.apply([], t);
    case "uint8array":
      for (n = new Uint8Array(s), r = 0; r < t.length; r++)
        n.set(t[r], i), i += t[r].length;
      return n;
    case "nodebuffer":
      return Buffer.concat(t);
    default:
      throw new Error("concat : unsupported type '" + e + "'");
  }
}
function fh(e, t) {
  return new uh.Promise(function(r, i) {
    var n = [], s = e._internalType, a = e._outputType, o = e._mimeType;
    e.on("data", function(c, u) {
      n.push(c), t && t(u);
    }).on("error", function(c) {
      n = [], i(c);
    }).on("end", function() {
      try {
        var c = lh(a, dh(s, n), o);
        r(c);
      } catch (u) {
        i(u);
      }
      n = [];
    }).resume();
  });
}
function su(e, t, r) {
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
    this._internalType = i, this._outputType = t, this._mimeType = r, Bt.checkSupport(i), this._worker = e.pipe(new sh(i)), e.lock();
  } catch (n) {
    this._worker = new ah("error"), this._worker.error(n);
  }
}
su.prototype = {
  /**
   * Listen a StreamHelper, accumulate its content and concatenate it into a
   * complete block.
   * @param {Function} updateCb the update callback.
   * @return Promise the promise for the accumulation.
   */
  accumulate: function(e) {
    return fh(this, e);
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
      Bt.delay(t, arguments, r);
    }), this;
  },
  /**
   * Resume the flow of chunks.
   * @return {StreamHelper} the current helper.
   */
  resume: function() {
    return Bt.delay(this._worker.resume, [], this._worker), this;
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
    if (Bt.checkSupport("nodestream"), this._outputType !== "nodebuffer")
      throw new Error(this._outputType + " is not supported by this method");
    return new nu(this, {
      objectMode: this._outputType !== "nodebuffer"
    }, e);
  }
};
var au = su, Fe = {};
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
var rn = le(), nn = Be, hh = 16 * 1024;
function mr(e) {
  nn.call(this, "DataWorker");
  var t = this;
  this.dataIsReady = !1, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = !1, e.then(function(r) {
    t.dataIsReady = !0, t.data = r, t.max = r && r.length || 0, t.type = rn.getTypeOf(r), t.isPaused || t._tickAndRepeat();
  }, function(r) {
    t.error(r);
  });
}
rn.inherits(mr, nn);
mr.prototype.cleanUp = function() {
  nn.prototype.cleanUp.call(this), this.data = null;
};
mr.prototype.resume = function() {
  return nn.prototype.resume.call(this) ? (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = !0, rn.delay(this._tickAndRepeat, [], this)), !0) : !1;
};
mr.prototype._tickAndRepeat = function() {
  this._tickScheduled = !1, !(this.isPaused || this.isFinished) && (this._tick(), this.isFinished || (rn.delay(this._tickAndRepeat, [], this), this._tickScheduled = !0));
};
mr.prototype._tick = function() {
  if (this.isPaused || this.isFinished)
    return !1;
  var e = hh, t = null, r = Math.min(this.max, this.index + e);
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
var ou = mr, ph = le();
function _h() {
  for (var e, t = [], r = 0; r < 256; r++) {
    e = r;
    for (var i = 0; i < 8; i++)
      e = e & 1 ? 3988292384 ^ e >>> 1 : e >>> 1;
    t[r] = e;
  }
  return t;
}
var cu = _h();
function Eh(e, t, r, i) {
  var n = cu, s = i + r;
  e = e ^ -1;
  for (var a = i; a < s; a++)
    e = e >>> 8 ^ n[(e ^ t[a]) & 255];
  return e ^ -1;
}
function mh(e, t, r, i) {
  var n = cu, s = i + r;
  e = e ^ -1;
  for (var a = i; a < s; a++)
    e = e >>> 8 ^ n[(e ^ t.charCodeAt(a)) & 255];
  return e ^ -1;
}
var Zs = function(t, r) {
  if (typeof t > "u" || !t.length)
    return 0;
  var i = ph.getTypeOf(t) !== "string";
  return i ? Eh(r | 0, t, t.length, 0) : mh(r | 0, t, t.length, 0);
}, uu = Be, Th = Zs, gh = le();
function Js() {
  uu.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
}
gh.inherits(Js, uu);
Js.prototype.processChunk = function(e) {
  this.streamInfo.crc32 = Th(e.data, this.streamInfo.crc32 || 0), this.push(e);
};
var lu = Js, bh = le(), Qs = Be;
function ea(e) {
  Qs.call(this, "DataLengthProbe for " + e), this.propName = e, this.withStreamInfo(e, 0);
}
bh.inherits(ea, Qs);
ea.prototype.processChunk = function(e) {
  if (e) {
    var t = this.streamInfo[this.propName] || 0;
    this.streamInfo[this.propName] = t + e.data.length;
  }
  Qs.prototype.processChunk.call(this, e);
};
var vh = ea, ao = Vr, oo = ou, yh = lu, ys = vh;
function ta(e, t, r, i, n) {
  this.compressedSize = e, this.uncompressedSize = t, this.crc32 = r, this.compression = i, this.compressedContent = n;
}
ta.prototype = {
  /**
   * Create a worker to get the uncompressed content.
   * @return {GenericWorker} the worker.
   */
  getContentWorker: function() {
    var e = new oo(ao.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new ys("data_length")), t = this;
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
    return new oo(ao.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
  }
};
ta.createWorkerFrom = function(e, t, r) {
  return e.pipe(new yh()).pipe(new ys("uncompressedSize")).pipe(t.compressWorker(r)).pipe(new ys("compressedSize")).withStreamInfo("compression", t);
};
var ra = ta, wh = au, Sh = ou, Xn = Er, Wn = ra, co = Be, ia = function(e, t, r) {
  this.name = e, this.dir = r.dir, this.date = r.date, this.comment = r.comment, this.unixPermissions = r.unixPermissions, this.dosPermissions = r.dosPermissions, this._data = t, this._dataBinary = r.binary, this.options = {
    compression: r.compression,
    compressionOptions: r.compressionOptions
  };
};
ia.prototype = {
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
      var n = !this._dataBinary;
      n && !i && (t = t.pipe(new Xn.Utf8EncodeWorker())), !n && i && (t = t.pipe(new Xn.Utf8DecodeWorker()));
    } catch (s) {
      t = new co("error"), t.error(s);
    }
    return new wh(t, r, "");
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
    if (this._data instanceof Wn && this._data.compression.magic === e.magic)
      return this._data.getCompressedWorker();
    var r = this._decompressWorker();
    return this._dataBinary || (r = r.pipe(new Xn.Utf8EncodeWorker())), Wn.createWorkerFrom(r, e, t);
  },
  /**
   * Return a worker for the decompressed content.
   * @private
   * @return Worker the worker.
   */
  _decompressWorker: function() {
    return this._data instanceof Wn ? this._data.getContentWorker() : this._data instanceof co ? this._data : new Sh(this._data);
  }
};
var uo = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], Rh = function() {
  throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
};
for (var zn = 0; zn < uo.length; zn++)
  ia.prototype[uo[zn]] = Rh;
var Nh = ia, du = {}, sn = {}, an = {}, dt = {};
(function(e) {
  var t = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Int32Array < "u";
  function r(s, a) {
    return Object.prototype.hasOwnProperty.call(s, a);
  }
  e.assign = function(s) {
    for (var a = Array.prototype.slice.call(arguments, 1); a.length; ) {
      var o = a.shift();
      if (o) {
        if (typeof o != "object")
          throw new TypeError(o + "must be non-object");
        for (var c in o)
          r(o, c) && (s[c] = o[c]);
      }
    }
    return s;
  }, e.shrinkBuf = function(s, a) {
    return s.length === a ? s : s.subarray ? s.subarray(0, a) : (s.length = a, s);
  };
  var i = {
    arraySet: function(s, a, o, c, u) {
      if (a.subarray && s.subarray) {
        s.set(a.subarray(o, o + c), u);
        return;
      }
      for (var l = 0; l < c; l++)
        s[u + l] = a[o + l];
    },
    // Join array of chunks to single array.
    flattenChunks: function(s) {
      var a, o, c, u, l, p;
      for (c = 0, a = 0, o = s.length; a < o; a++)
        c += s[a].length;
      for (p = new Uint8Array(c), u = 0, a = 0, o = s.length; a < o; a++)
        l = s[a], p.set(l, u), u += l.length;
      return p;
    }
  }, n = {
    arraySet: function(s, a, o, c, u) {
      for (var l = 0; l < c; l++)
        s[u + l] = a[o + l];
    },
    // Join array of chunks to single array.
    flattenChunks: function(s) {
      return [].concat.apply([], s);
    }
  };
  e.setTyped = function(s) {
    s ? (e.Buf8 = Uint8Array, e.Buf16 = Uint16Array, e.Buf32 = Int32Array, e.assign(e, i)) : (e.Buf8 = Array, e.Buf16 = Array, e.Buf32 = Array, e.assign(e, n));
  }, e.setTyped(t);
})(dt);
var Zr = {}, et = {}, Tr = {}, Ih = dt, Lh = 4, lo = 0, fo = 1, Ah = 2;
function gr(e) {
  for (var t = e.length; --t >= 0; )
    e[t] = 0;
}
var Ch = 0, fu = 1, Oh = 2, kh = 3, xh = 258, na = 29, Jr = 256, Mr = Jr + 1 + na, sr = 30, sa = 19, hu = 2 * Mr + 1, Dt = 15, qn = 16, Dh = 7, aa = 256, pu = 16, _u = 17, Eu = 18, ws = (
  /* extra bits for each length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
), Ai = (
  /* extra bits for each distance code */
  [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
), Uh = (
  /* extra bits for each bit length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]
), mu = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], Ph = 512, ot = new Array((Mr + 2) * 2);
gr(ot);
var kr = new Array(sr * 2);
gr(kr);
var $r = new Array(Ph);
gr($r);
var Hr = new Array(xh - kh + 1);
gr(Hr);
var oa = new Array(na);
gr(oa);
var Mi = new Array(sr);
gr(Mi);
function Kn(e, t, r, i, n) {
  this.static_tree = e, this.extra_bits = t, this.extra_base = r, this.elems = i, this.max_length = n, this.has_stree = e && e.length;
}
var Tu, gu, bu;
function Yn(e, t) {
  this.dyn_tree = e, this.max_code = 0, this.stat_desc = t;
}
function vu(e) {
  return e < 256 ? $r[e] : $r[256 + (e >>> 7)];
}
function Xr(e, t) {
  e.pending_buf[e.pending++] = t & 255, e.pending_buf[e.pending++] = t >>> 8 & 255;
}
function Le(e, t, r) {
  e.bi_valid > qn - r ? (e.bi_buf |= t << e.bi_valid & 65535, Xr(e, e.bi_buf), e.bi_buf = t >> qn - e.bi_valid, e.bi_valid += r - qn) : (e.bi_buf |= t << e.bi_valid & 65535, e.bi_valid += r);
}
function Ze(e, t, r) {
  Le(
    e,
    r[t * 2],
    r[t * 2 + 1]
    /*.Len*/
  );
}
function yu(e, t) {
  var r = 0;
  do
    r |= e & 1, e >>>= 1, r <<= 1;
  while (--t > 0);
  return r >>> 1;
}
function Bh(e) {
  e.bi_valid === 16 ? (Xr(e, e.bi_buf), e.bi_buf = 0, e.bi_valid = 0) : e.bi_valid >= 8 && (e.pending_buf[e.pending++] = e.bi_buf & 255, e.bi_buf >>= 8, e.bi_valid -= 8);
}
function Fh(e, t) {
  var r = t.dyn_tree, i = t.max_code, n = t.stat_desc.static_tree, s = t.stat_desc.has_stree, a = t.stat_desc.extra_bits, o = t.stat_desc.extra_base, c = t.stat_desc.max_length, u, l, p, d, f, _, E = 0;
  for (d = 0; d <= Dt; d++)
    e.bl_count[d] = 0;
  for (r[e.heap[e.heap_max] * 2 + 1] = 0, u = e.heap_max + 1; u < hu; u++)
    l = e.heap[u], d = r[r[l * 2 + 1] * 2 + 1] + 1, d > c && (d = c, E++), r[l * 2 + 1] = d, !(l > i) && (e.bl_count[d]++, f = 0, l >= o && (f = a[l - o]), _ = r[l * 2], e.opt_len += _ * (d + f), s && (e.static_len += _ * (n[l * 2 + 1] + f)));
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
function wu(e, t, r) {
  var i = new Array(Dt + 1), n = 0, s, a;
  for (s = 1; s <= Dt; s++)
    i[s] = n = n + r[s - 1] << 1;
  for (a = 0; a <= t; a++) {
    var o = e[a * 2 + 1];
    o !== 0 && (e[a * 2] = yu(i[o]++, o));
  }
}
function Mh() {
  var e, t, r, i, n, s = new Array(Dt + 1);
  for (r = 0, i = 0; i < na - 1; i++)
    for (oa[i] = r, e = 0; e < 1 << ws[i]; e++)
      Hr[r++] = i;
  for (Hr[r - 1] = i, n = 0, i = 0; i < 16; i++)
    for (Mi[i] = n, e = 0; e < 1 << Ai[i]; e++)
      $r[n++] = i;
  for (n >>= 7; i < sr; i++)
    for (Mi[i] = n << 7, e = 0; e < 1 << Ai[i] - 7; e++)
      $r[256 + n++] = i;
  for (t = 0; t <= Dt; t++)
    s[t] = 0;
  for (e = 0; e <= 143; )
    ot[e * 2 + 1] = 8, e++, s[8]++;
  for (; e <= 255; )
    ot[e * 2 + 1] = 9, e++, s[9]++;
  for (; e <= 279; )
    ot[e * 2 + 1] = 7, e++, s[7]++;
  for (; e <= 287; )
    ot[e * 2 + 1] = 8, e++, s[8]++;
  for (wu(ot, Mr + 1, s), e = 0; e < sr; e++)
    kr[e * 2 + 1] = 5, kr[e * 2] = yu(e, 5);
  Tu = new Kn(ot, ws, Jr + 1, Mr, Dt), gu = new Kn(kr, Ai, 0, sr, Dt), bu = new Kn(new Array(0), Uh, 0, sa, Dh);
}
function Su(e) {
  var t;
  for (t = 0; t < Mr; t++)
    e.dyn_ltree[t * 2] = 0;
  for (t = 0; t < sr; t++)
    e.dyn_dtree[t * 2] = 0;
  for (t = 0; t < sa; t++)
    e.bl_tree[t * 2] = 0;
  e.dyn_ltree[aa * 2] = 1, e.opt_len = e.static_len = 0, e.last_lit = e.matches = 0;
}
function Ru(e) {
  e.bi_valid > 8 ? Xr(e, e.bi_buf) : e.bi_valid > 0 && (e.pending_buf[e.pending++] = e.bi_buf), e.bi_buf = 0, e.bi_valid = 0;
}
function $h(e, t, r, i) {
  Ru(e), Xr(e, r), Xr(e, ~r), Ih.arraySet(e.pending_buf, e.window, t, r, e.pending), e.pending += r;
}
function ho(e, t, r, i) {
  var n = t * 2, s = r * 2;
  return e[n] < e[s] || e[n] === e[s] && i[t] <= i[r];
}
function jn(e, t, r) {
  for (var i = e.heap[r], n = r << 1; n <= e.heap_len && (n < e.heap_len && ho(t, e.heap[n + 1], e.heap[n], e.depth) && n++, !ho(t, i, e.heap[n], e.depth)); )
    e.heap[r] = e.heap[n], r = n, n <<= 1;
  e.heap[r] = i;
}
function po(e, t, r) {
  var i, n, s = 0, a, o;
  if (e.last_lit !== 0)
    do
      i = e.pending_buf[e.d_buf + s * 2] << 8 | e.pending_buf[e.d_buf + s * 2 + 1], n = e.pending_buf[e.l_buf + s], s++, i === 0 ? Ze(e, n, t) : (a = Hr[n], Ze(e, a + Jr + 1, t), o = ws[a], o !== 0 && (n -= oa[a], Le(e, n, o)), i--, a = vu(i), Ze(e, a, r), o = Ai[a], o !== 0 && (i -= Mi[a], Le(e, i, o)));
    while (s < e.last_lit);
  Ze(e, aa, t);
}
function Ss(e, t) {
  var r = t.dyn_tree, i = t.stat_desc.static_tree, n = t.stat_desc.has_stree, s = t.stat_desc.elems, a, o, c = -1, u;
  for (e.heap_len = 0, e.heap_max = hu, a = 0; a < s; a++)
    r[a * 2] !== 0 ? (e.heap[++e.heap_len] = c = a, e.depth[a] = 0) : r[a * 2 + 1] = 0;
  for (; e.heap_len < 2; )
    u = e.heap[++e.heap_len] = c < 2 ? ++c : 0, r[u * 2] = 1, e.depth[u] = 0, e.opt_len--, n && (e.static_len -= i[u * 2 + 1]);
  for (t.max_code = c, a = e.heap_len >> 1; a >= 1; a--)
    jn(e, r, a);
  u = s;
  do
    a = e.heap[
      1
      /*SMALLEST*/
    ], e.heap[
      1
      /*SMALLEST*/
    ] = e.heap[e.heap_len--], jn(
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
    ] = u++, jn(
      e,
      r,
      1
      /*SMALLEST*/
    );
  while (e.heap_len >= 2);
  e.heap[--e.heap_max] = e.heap[
    1
    /*SMALLEST*/
  ], Fh(e, t), wu(r, c, e.bl_count);
}
function _o(e, t, r) {
  var i, n = -1, s, a = t[0 * 2 + 1], o = 0, c = 7, u = 4;
  for (a === 0 && (c = 138, u = 3), t[(r + 1) * 2 + 1] = 65535, i = 0; i <= r; i++)
    s = a, a = t[(i + 1) * 2 + 1], !(++o < c && s === a) && (o < u ? e.bl_tree[s * 2] += o : s !== 0 ? (s !== n && e.bl_tree[s * 2]++, e.bl_tree[pu * 2]++) : o <= 10 ? e.bl_tree[_u * 2]++ : e.bl_tree[Eu * 2]++, o = 0, n = s, a === 0 ? (c = 138, u = 3) : s === a ? (c = 6, u = 3) : (c = 7, u = 4));
}
function Eo(e, t, r) {
  var i, n = -1, s, a = t[0 * 2 + 1], o = 0, c = 7, u = 4;
  for (a === 0 && (c = 138, u = 3), i = 0; i <= r; i++)
    if (s = a, a = t[(i + 1) * 2 + 1], !(++o < c && s === a)) {
      if (o < u)
        do
          Ze(e, s, e.bl_tree);
        while (--o !== 0);
      else s !== 0 ? (s !== n && (Ze(e, s, e.bl_tree), o--), Ze(e, pu, e.bl_tree), Le(e, o - 3, 2)) : o <= 10 ? (Ze(e, _u, e.bl_tree), Le(e, o - 3, 3)) : (Ze(e, Eu, e.bl_tree), Le(e, o - 11, 7));
      o = 0, n = s, a === 0 ? (c = 138, u = 3) : s === a ? (c = 6, u = 3) : (c = 7, u = 4);
    }
}
function Hh(e) {
  var t;
  for (_o(e, e.dyn_ltree, e.l_desc.max_code), _o(e, e.dyn_dtree, e.d_desc.max_code), Ss(e, e.bl_desc), t = sa - 1; t >= 3 && e.bl_tree[mu[t] * 2 + 1] === 0; t--)
    ;
  return e.opt_len += 3 * (t + 1) + 5 + 5 + 4, t;
}
function Xh(e, t, r, i) {
  var n;
  for (Le(e, t - 257, 5), Le(e, r - 1, 5), Le(e, i - 4, 4), n = 0; n < i; n++)
    Le(e, e.bl_tree[mu[n] * 2 + 1], 3);
  Eo(e, e.dyn_ltree, t - 1), Eo(e, e.dyn_dtree, r - 1);
}
function Wh(e) {
  var t = 4093624447, r;
  for (r = 0; r <= 31; r++, t >>>= 1)
    if (t & 1 && e.dyn_ltree[r * 2] !== 0)
      return lo;
  if (e.dyn_ltree[9 * 2] !== 0 || e.dyn_ltree[10 * 2] !== 0 || e.dyn_ltree[13 * 2] !== 0)
    return fo;
  for (r = 32; r < Jr; r++)
    if (e.dyn_ltree[r * 2] !== 0)
      return fo;
  return lo;
}
var mo = !1;
function zh(e) {
  mo || (Mh(), mo = !0), e.l_desc = new Yn(e.dyn_ltree, Tu), e.d_desc = new Yn(e.dyn_dtree, gu), e.bl_desc = new Yn(e.bl_tree, bu), e.bi_buf = 0, e.bi_valid = 0, Su(e);
}
function Nu(e, t, r, i) {
  Le(e, (Ch << 1) + (i ? 1 : 0), 3), $h(e, t, r);
}
function qh(e) {
  Le(e, fu << 1, 3), Ze(e, aa, ot), Bh(e);
}
function Kh(e, t, r, i) {
  var n, s, a = 0;
  e.level > 0 ? (e.strm.data_type === Ah && (e.strm.data_type = Wh(e)), Ss(e, e.l_desc), Ss(e, e.d_desc), a = Hh(e), n = e.opt_len + 3 + 7 >>> 3, s = e.static_len + 3 + 7 >>> 3, s <= n && (n = s)) : n = s = r + 5, r + 4 <= n && t !== -1 ? Nu(e, t, r, i) : e.strategy === Lh || s === n ? (Le(e, (fu << 1) + (i ? 1 : 0), 3), po(e, ot, kr)) : (Le(e, (Oh << 1) + (i ? 1 : 0), 3), Xh(e, e.l_desc.max_code + 1, e.d_desc.max_code + 1, a + 1), po(e, e.dyn_ltree, e.dyn_dtree)), Su(e), i && Ru(e);
}
function Yh(e, t, r) {
  return e.pending_buf[e.d_buf + e.last_lit * 2] = t >>> 8 & 255, e.pending_buf[e.d_buf + e.last_lit * 2 + 1] = t & 255, e.pending_buf[e.l_buf + e.last_lit] = r & 255, e.last_lit++, t === 0 ? e.dyn_ltree[r * 2]++ : (e.matches++, t--, e.dyn_ltree[(Hr[r] + Jr + 1) * 2]++, e.dyn_dtree[vu(t) * 2]++), e.last_lit === e.lit_bufsize - 1;
}
Tr._tr_init = zh;
Tr._tr_stored_block = Nu;
Tr._tr_flush_block = Kh;
Tr._tr_tally = Yh;
Tr._tr_align = qh;
function jh(e, t, r, i) {
  for (var n = e & 65535 | 0, s = e >>> 16 & 65535 | 0, a = 0; r !== 0; ) {
    a = r > 2e3 ? 2e3 : r, r -= a;
    do
      n = n + t[i++] | 0, s = s + n | 0;
    while (--a);
    n %= 65521, s %= 65521;
  }
  return n | s << 16 | 0;
}
var Iu = jh;
function Gh() {
  for (var e, t = [], r = 0; r < 256; r++) {
    e = r;
    for (var i = 0; i < 8; i++)
      e = e & 1 ? 3988292384 ^ e >>> 1 : e >>> 1;
    t[r] = e;
  }
  return t;
}
var Vh = Gh();
function Zh(e, t, r, i) {
  var n = Vh, s = i + r;
  e ^= -1;
  for (var a = i; a < s; a++)
    e = e >>> 8 ^ n[(e ^ t[a]) & 255];
  return e ^ -1;
}
var Lu = Zh, ca = {
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
}, Re = dt, xe = Tr, Au = Iu, Et = Lu, Jh = ca, qt = 0, Qh = 1, ep = 3, St = 4, To = 5, Je = 0, go = 1, De = -2, tp = -3, Gn = -5, rp = -1, ip = 1, Ti = 2, np = 3, sp = 4, ap = 0, op = 2, on = 8, cp = 9, up = 15, lp = 8, dp = 29, fp = 256, Rs = fp + 1 + dp, hp = 30, pp = 19, _p = 2 * Rs + 1, Ep = 15, Y = 3, vt = 258, ze = vt + Y + 1, mp = 32, cn = 42, Ns = 69, Ci = 73, Oi = 91, ki = 103, Ut = 113, Cr = 666, Ee = 1, Qr = 2, $t = 3, br = 4, Tp = 3;
function yt(e, t) {
  return e.msg = Jh[t], t;
}
function bo(e) {
  return (e << 1) - (e > 4 ? 9 : 0);
}
function bt(e) {
  for (var t = e.length; --t >= 0; )
    e[t] = 0;
}
function mt(e) {
  var t = e.state, r = t.pending;
  r > e.avail_out && (r = e.avail_out), r !== 0 && (Re.arraySet(e.output, t.pending_buf, t.pending_out, r, e.next_out), e.next_out += r, t.pending_out += r, e.total_out += r, e.avail_out -= r, t.pending -= r, t.pending === 0 && (t.pending_out = 0));
}
function we(e, t) {
  xe._tr_flush_block(e, e.block_start >= 0 ? e.block_start : -1, e.strstart - e.block_start, t), e.block_start = e.strstart, mt(e.strm);
}
function V(e, t) {
  e.pending_buf[e.pending++] = t;
}
function Ar(e, t) {
  e.pending_buf[e.pending++] = t >>> 8 & 255, e.pending_buf[e.pending++] = t & 255;
}
function gp(e, t, r, i) {
  var n = e.avail_in;
  return n > i && (n = i), n === 0 ? 0 : (e.avail_in -= n, Re.arraySet(t, e.input, e.next_in, n, r), e.state.wrap === 1 ? e.adler = Au(e.adler, t, n, r) : e.state.wrap === 2 && (e.adler = Et(e.adler, t, n, r)), e.next_in += n, e.total_in += n, n);
}
function Cu(e, t) {
  var r = e.max_chain_length, i = e.strstart, n, s, a = e.prev_length, o = e.nice_match, c = e.strstart > e.w_size - ze ? e.strstart - (e.w_size - ze) : 0, u = e.window, l = e.w_mask, p = e.prev, d = e.strstart + vt, f = u[i + a - 1], _ = u[i + a];
  e.prev_length >= e.good_match && (r >>= 2), o > e.lookahead && (o = e.lookahead);
  do
    if (n = t, !(u[n + a] !== _ || u[n + a - 1] !== f || u[n] !== u[i] || u[++n] !== u[i + 1])) {
      i += 2, n++;
      do
        ;
      while (u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && i < d);
      if (s = vt - (d - i), i = d - vt, s > a) {
        if (e.match_start = t, a = s, s >= o)
          break;
        f = u[i + a - 1], _ = u[i + a];
      }
    }
  while ((t = p[t & l]) > c && --r !== 0);
  return a <= e.lookahead ? a : e.lookahead;
}
function Ht(e) {
  var t = e.w_size, r, i, n, s, a;
  do {
    if (s = e.window_size - e.lookahead - e.strstart, e.strstart >= t + (t - ze)) {
      Re.arraySet(e.window, e.window, t, t, 0), e.match_start -= t, e.strstart -= t, e.block_start -= t, i = e.hash_size, r = i;
      do
        n = e.head[--r], e.head[r] = n >= t ? n - t : 0;
      while (--i);
      i = t, r = i;
      do
        n = e.prev[--r], e.prev[r] = n >= t ? n - t : 0;
      while (--i);
      s += t;
    }
    if (e.strm.avail_in === 0)
      break;
    if (i = gp(e.strm, e.window, e.strstart + e.lookahead, s), e.lookahead += i, e.lookahead + e.insert >= Y)
      for (a = e.strstart - e.insert, e.ins_h = e.window[a], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[a + 1]) & e.hash_mask; e.insert && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[a + Y - 1]) & e.hash_mask, e.prev[a & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = a, a++, e.insert--, !(e.lookahead + e.insert < Y)); )
        ;
  } while (e.lookahead < ze && e.strm.avail_in !== 0);
}
function bp(e, t) {
  var r = 65535;
  for (r > e.pending_buf_size - 5 && (r = e.pending_buf_size - 5); ; ) {
    if (e.lookahead <= 1) {
      if (Ht(e), e.lookahead === 0 && t === qt)
        return Ee;
      if (e.lookahead === 0)
        break;
    }
    e.strstart += e.lookahead, e.lookahead = 0;
    var i = e.block_start + r;
    if ((e.strstart === 0 || e.strstart >= i) && (e.lookahead = e.strstart - i, e.strstart = i, we(e, !1), e.strm.avail_out === 0) || e.strstart - e.block_start >= e.w_size - ze && (we(e, !1), e.strm.avail_out === 0))
      return Ee;
  }
  return e.insert = 0, t === St ? (we(e, !0), e.strm.avail_out === 0 ? $t : br) : (e.strstart > e.block_start && (we(e, !1), e.strm.avail_out === 0), Ee);
}
function Vn(e, t) {
  for (var r, i; ; ) {
    if (e.lookahead < ze) {
      if (Ht(e), e.lookahead < ze && t === qt)
        return Ee;
      if (e.lookahead === 0)
        break;
    }
    if (r = 0, e.lookahead >= Y && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + Y - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), r !== 0 && e.strstart - r <= e.w_size - ze && (e.match_length = Cu(e, r)), e.match_length >= Y)
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
  return e.insert = e.strstart < Y - 1 ? e.strstart : Y - 1, t === St ? (we(e, !0), e.strm.avail_out === 0 ? $t : br) : e.last_lit && (we(e, !1), e.strm.avail_out === 0) ? Ee : Qr;
}
function Zt(e, t) {
  for (var r, i, n; ; ) {
    if (e.lookahead < ze) {
      if (Ht(e), e.lookahead < ze && t === qt)
        return Ee;
      if (e.lookahead === 0)
        break;
    }
    if (r = 0, e.lookahead >= Y && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + Y - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), e.prev_length = e.match_length, e.prev_match = e.match_start, e.match_length = Y - 1, r !== 0 && e.prev_length < e.max_lazy_match && e.strstart - r <= e.w_size - ze && (e.match_length = Cu(e, r), e.match_length <= 5 && (e.strategy === ip || e.match_length === Y && e.strstart - e.match_start > 4096) && (e.match_length = Y - 1)), e.prev_length >= Y && e.match_length <= e.prev_length) {
      n = e.strstart + e.lookahead - Y, i = xe._tr_tally(e, e.strstart - 1 - e.prev_match, e.prev_length - Y), e.lookahead -= e.prev_length - 1, e.prev_length -= 2;
      do
        ++e.strstart <= n && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + Y - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart);
      while (--e.prev_length !== 0);
      if (e.match_available = 0, e.match_length = Y - 1, e.strstart++, i && (we(e, !1), e.strm.avail_out === 0))
        return Ee;
    } else if (e.match_available) {
      if (i = xe._tr_tally(e, 0, e.window[e.strstart - 1]), i && we(e, !1), e.strstart++, e.lookahead--, e.strm.avail_out === 0)
        return Ee;
    } else
      e.match_available = 1, e.strstart++, e.lookahead--;
  }
  return e.match_available && (i = xe._tr_tally(e, 0, e.window[e.strstart - 1]), e.match_available = 0), e.insert = e.strstart < Y - 1 ? e.strstart : Y - 1, t === St ? (we(e, !0), e.strm.avail_out === 0 ? $t : br) : e.last_lit && (we(e, !1), e.strm.avail_out === 0) ? Ee : Qr;
}
function vp(e, t) {
  for (var r, i, n, s, a = e.window; ; ) {
    if (e.lookahead <= vt) {
      if (Ht(e), e.lookahead <= vt && t === qt)
        return Ee;
      if (e.lookahead === 0)
        break;
    }
    if (e.match_length = 0, e.lookahead >= Y && e.strstart > 0 && (n = e.strstart - 1, i = a[n], i === a[++n] && i === a[++n] && i === a[++n])) {
      s = e.strstart + vt;
      do
        ;
      while (i === a[++n] && i === a[++n] && i === a[++n] && i === a[++n] && i === a[++n] && i === a[++n] && i === a[++n] && i === a[++n] && n < s);
      e.match_length = vt - (s - n), e.match_length > e.lookahead && (e.match_length = e.lookahead);
    }
    if (e.match_length >= Y ? (r = xe._tr_tally(e, 1, e.match_length - Y), e.lookahead -= e.match_length, e.strstart += e.match_length, e.match_length = 0) : (r = xe._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++), r && (we(e, !1), e.strm.avail_out === 0))
      return Ee;
  }
  return e.insert = 0, t === St ? (we(e, !0), e.strm.avail_out === 0 ? $t : br) : e.last_lit && (we(e, !1), e.strm.avail_out === 0) ? Ee : Qr;
}
function yp(e, t) {
  for (var r; ; ) {
    if (e.lookahead === 0 && (Ht(e), e.lookahead === 0)) {
      if (t === qt)
        return Ee;
      break;
    }
    if (e.match_length = 0, r = xe._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++, r && (we(e, !1), e.strm.avail_out === 0))
      return Ee;
  }
  return e.insert = 0, t === St ? (we(e, !0), e.strm.avail_out === 0 ? $t : br) : e.last_lit && (we(e, !1), e.strm.avail_out === 0) ? Ee : Qr;
}
function je(e, t, r, i, n) {
  this.good_length = e, this.max_lazy = t, this.nice_length = r, this.max_chain = i, this.func = n;
}
var rr;
rr = [
  /*      good lazy nice chain */
  new je(0, 0, 0, 0, bp),
  /* 0 store only */
  new je(4, 4, 8, 4, Vn),
  /* 1 max speed, no lazy matches */
  new je(4, 5, 16, 8, Vn),
  /* 2 */
  new je(4, 6, 32, 32, Vn),
  /* 3 */
  new je(4, 4, 16, 16, Zt),
  /* 4 lazy matches */
  new je(8, 16, 32, 32, Zt),
  /* 5 */
  new je(8, 16, 128, 128, Zt),
  /* 6 */
  new je(8, 32, 128, 256, Zt),
  /* 7 */
  new je(32, 128, 258, 1024, Zt),
  /* 8 */
  new je(32, 258, 258, 4096, Zt)
  /* 9 max compression */
];
function wp(e) {
  e.window_size = 2 * e.w_size, bt(e.head), e.max_lazy_match = rr[e.level].max_lazy, e.good_match = rr[e.level].good_length, e.nice_match = rr[e.level].nice_length, e.max_chain_length = rr[e.level].max_chain, e.strstart = 0, e.block_start = 0, e.lookahead = 0, e.insert = 0, e.match_length = e.prev_length = Y - 1, e.match_available = 0, e.ins_h = 0;
}
function Sp() {
  this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = on, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new Re.Buf16(_p * 2), this.dyn_dtree = new Re.Buf16((2 * hp + 1) * 2), this.bl_tree = new Re.Buf16((2 * pp + 1) * 2), bt(this.dyn_ltree), bt(this.dyn_dtree), bt(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new Re.Buf16(Ep + 1), this.heap = new Re.Buf16(2 * Rs + 1), bt(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new Re.Buf16(2 * Rs + 1), bt(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
}
function Ou(e) {
  var t;
  return !e || !e.state ? yt(e, De) : (e.total_in = e.total_out = 0, e.data_type = op, t = e.state, t.pending = 0, t.pending_out = 0, t.wrap < 0 && (t.wrap = -t.wrap), t.status = t.wrap ? cn : Ut, e.adler = t.wrap === 2 ? 0 : 1, t.last_flush = qt, xe._tr_init(t), Je);
}
function ku(e) {
  var t = Ou(e);
  return t === Je && wp(e.state), t;
}
function Rp(e, t) {
  return !e || !e.state || e.state.wrap !== 2 ? De : (e.state.gzhead = t, Je);
}
function xu(e, t, r, i, n, s) {
  if (!e)
    return De;
  var a = 1;
  if (t === rp && (t = 6), i < 0 ? (a = 0, i = -i) : i > 15 && (a = 2, i -= 16), n < 1 || n > cp || r !== on || i < 8 || i > 15 || t < 0 || t > 9 || s < 0 || s > sp)
    return yt(e, De);
  i === 8 && (i = 9);
  var o = new Sp();
  return e.state = o, o.strm = e, o.wrap = a, o.gzhead = null, o.w_bits = i, o.w_size = 1 << o.w_bits, o.w_mask = o.w_size - 1, o.hash_bits = n + 7, o.hash_size = 1 << o.hash_bits, o.hash_mask = o.hash_size - 1, o.hash_shift = ~~((o.hash_bits + Y - 1) / Y), o.window = new Re.Buf8(o.w_size * 2), o.head = new Re.Buf16(o.hash_size), o.prev = new Re.Buf16(o.w_size), o.lit_bufsize = 1 << n + 6, o.pending_buf_size = o.lit_bufsize * 4, o.pending_buf = new Re.Buf8(o.pending_buf_size), o.d_buf = 1 * o.lit_bufsize, o.l_buf = 3 * o.lit_bufsize, o.level = t, o.strategy = s, o.method = r, ku(e);
}
function Np(e, t) {
  return xu(e, t, on, up, lp, ap);
}
function Ip(e, t) {
  var r, i, n, s;
  if (!e || !e.state || t > To || t < 0)
    return e ? yt(e, De) : De;
  if (i = e.state, !e.output || !e.input && e.avail_in !== 0 || i.status === Cr && t !== St)
    return yt(e, e.avail_out === 0 ? Gn : De);
  if (i.strm = e, r = i.last_flush, i.last_flush = t, i.status === cn)
    if (i.wrap === 2)
      e.adler = 0, V(i, 31), V(i, 139), V(i, 8), i.gzhead ? (V(
        i,
        (i.gzhead.text ? 1 : 0) + (i.gzhead.hcrc ? 2 : 0) + (i.gzhead.extra ? 4 : 0) + (i.gzhead.name ? 8 : 0) + (i.gzhead.comment ? 16 : 0)
      ), V(i, i.gzhead.time & 255), V(i, i.gzhead.time >> 8 & 255), V(i, i.gzhead.time >> 16 & 255), V(i, i.gzhead.time >> 24 & 255), V(i, i.level === 9 ? 2 : i.strategy >= Ti || i.level < 2 ? 4 : 0), V(i, i.gzhead.os & 255), i.gzhead.extra && i.gzhead.extra.length && (V(i, i.gzhead.extra.length & 255), V(i, i.gzhead.extra.length >> 8 & 255)), i.gzhead.hcrc && (e.adler = Et(e.adler, i.pending_buf, i.pending, 0)), i.gzindex = 0, i.status = Ns) : (V(i, 0), V(i, 0), V(i, 0), V(i, 0), V(i, 0), V(i, i.level === 9 ? 2 : i.strategy >= Ti || i.level < 2 ? 4 : 0), V(i, Tp), i.status = Ut);
    else {
      var a = on + (i.w_bits - 8 << 4) << 8, o = -1;
      i.strategy >= Ti || i.level < 2 ? o = 0 : i.level < 6 ? o = 1 : i.level === 6 ? o = 2 : o = 3, a |= o << 6, i.strstart !== 0 && (a |= mp), a += 31 - a % 31, i.status = Ut, Ar(i, a), i.strstart !== 0 && (Ar(i, e.adler >>> 16), Ar(i, e.adler & 65535)), e.adler = 1;
    }
  if (i.status === Ns)
    if (i.gzhead.extra) {
      for (n = i.pending; i.gzindex < (i.gzhead.extra.length & 65535) && !(i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > n && (e.adler = Et(e.adler, i.pending_buf, i.pending - n, n)), mt(e), n = i.pending, i.pending === i.pending_buf_size)); )
        V(i, i.gzhead.extra[i.gzindex] & 255), i.gzindex++;
      i.gzhead.hcrc && i.pending > n && (e.adler = Et(e.adler, i.pending_buf, i.pending - n, n)), i.gzindex === i.gzhead.extra.length && (i.gzindex = 0, i.status = Ci);
    } else
      i.status = Ci;
  if (i.status === Ci)
    if (i.gzhead.name) {
      n = i.pending;
      do {
        if (i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > n && (e.adler = Et(e.adler, i.pending_buf, i.pending - n, n)), mt(e), n = i.pending, i.pending === i.pending_buf_size)) {
          s = 1;
          break;
        }
        i.gzindex < i.gzhead.name.length ? s = i.gzhead.name.charCodeAt(i.gzindex++) & 255 : s = 0, V(i, s);
      } while (s !== 0);
      i.gzhead.hcrc && i.pending > n && (e.adler = Et(e.adler, i.pending_buf, i.pending - n, n)), s === 0 && (i.gzindex = 0, i.status = Oi);
    } else
      i.status = Oi;
  if (i.status === Oi)
    if (i.gzhead.comment) {
      n = i.pending;
      do {
        if (i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > n && (e.adler = Et(e.adler, i.pending_buf, i.pending - n, n)), mt(e), n = i.pending, i.pending === i.pending_buf_size)) {
          s = 1;
          break;
        }
        i.gzindex < i.gzhead.comment.length ? s = i.gzhead.comment.charCodeAt(i.gzindex++) & 255 : s = 0, V(i, s);
      } while (s !== 0);
      i.gzhead.hcrc && i.pending > n && (e.adler = Et(e.adler, i.pending_buf, i.pending - n, n)), s === 0 && (i.status = ki);
    } else
      i.status = ki;
  if (i.status === ki && (i.gzhead.hcrc ? (i.pending + 2 > i.pending_buf_size && mt(e), i.pending + 2 <= i.pending_buf_size && (V(i, e.adler & 255), V(i, e.adler >> 8 & 255), e.adler = 0, i.status = Ut)) : i.status = Ut), i.pending !== 0) {
    if (mt(e), e.avail_out === 0)
      return i.last_flush = -1, Je;
  } else if (e.avail_in === 0 && bo(t) <= bo(r) && t !== St)
    return yt(e, Gn);
  if (i.status === Cr && e.avail_in !== 0)
    return yt(e, Gn);
  if (e.avail_in !== 0 || i.lookahead !== 0 || t !== qt && i.status !== Cr) {
    var c = i.strategy === Ti ? yp(i, t) : i.strategy === np ? vp(i, t) : rr[i.level].func(i, t);
    if ((c === $t || c === br) && (i.status = Cr), c === Ee || c === $t)
      return e.avail_out === 0 && (i.last_flush = -1), Je;
    if (c === Qr && (t === Qh ? xe._tr_align(i) : t !== To && (xe._tr_stored_block(i, 0, 0, !1), t === ep && (bt(i.head), i.lookahead === 0 && (i.strstart = 0, i.block_start = 0, i.insert = 0))), mt(e), e.avail_out === 0))
      return i.last_flush = -1, Je;
  }
  return t !== St ? Je : i.wrap <= 0 ? go : (i.wrap === 2 ? (V(i, e.adler & 255), V(i, e.adler >> 8 & 255), V(i, e.adler >> 16 & 255), V(i, e.adler >> 24 & 255), V(i, e.total_in & 255), V(i, e.total_in >> 8 & 255), V(i, e.total_in >> 16 & 255), V(i, e.total_in >> 24 & 255)) : (Ar(i, e.adler >>> 16), Ar(i, e.adler & 65535)), mt(e), i.wrap > 0 && (i.wrap = -i.wrap), i.pending !== 0 ? Je : go);
}
function Lp(e) {
  var t;
  return !e || !e.state ? De : (t = e.state.status, t !== cn && t !== Ns && t !== Ci && t !== Oi && t !== ki && t !== Ut && t !== Cr ? yt(e, De) : (e.state = null, t === Ut ? yt(e, tp) : Je));
}
function Ap(e, t) {
  var r = t.length, i, n, s, a, o, c, u, l;
  if (!e || !e.state || (i = e.state, a = i.wrap, a === 2 || a === 1 && i.status !== cn || i.lookahead))
    return De;
  for (a === 1 && (e.adler = Au(e.adler, t, r, 0)), i.wrap = 0, r >= i.w_size && (a === 0 && (bt(i.head), i.strstart = 0, i.block_start = 0, i.insert = 0), l = new Re.Buf8(i.w_size), Re.arraySet(l, t, r - i.w_size, i.w_size, 0), t = l, r = i.w_size), o = e.avail_in, c = e.next_in, u = e.input, e.avail_in = r, e.next_in = 0, e.input = t, Ht(i); i.lookahead >= Y; ) {
    n = i.strstart, s = i.lookahead - (Y - 1);
    do
      i.ins_h = (i.ins_h << i.hash_shift ^ i.window[n + Y - 1]) & i.hash_mask, i.prev[n & i.w_mask] = i.head[i.ins_h], i.head[i.ins_h] = n, n++;
    while (--s);
    i.strstart = n, i.lookahead = Y - 1, Ht(i);
  }
  return i.strstart += i.lookahead, i.block_start = i.strstart, i.insert = i.lookahead, i.lookahead = 0, i.match_length = i.prev_length = Y - 1, i.match_available = 0, e.next_in = c, e.input = u, e.avail_in = o, i.wrap = a, Je;
}
et.deflateInit = Np;
et.deflateInit2 = xu;
et.deflateReset = ku;
et.deflateResetKeep = Ou;
et.deflateSetHeader = Rp;
et.deflate = Ip;
et.deflateEnd = Lp;
et.deflateSetDictionary = Ap;
et.deflateInfo = "pako deflate (from Nodeca project)";
var Kt = {}, un = dt, Du = !0, Uu = !0;
try {
  String.fromCharCode.apply(null, [0]);
} catch {
  Du = !1;
}
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch {
  Uu = !1;
}
var Wr = new un.Buf8(256);
for (var pt = 0; pt < 256; pt++)
  Wr[pt] = pt >= 252 ? 6 : pt >= 248 ? 5 : pt >= 240 ? 4 : pt >= 224 ? 3 : pt >= 192 ? 2 : 1;
Wr[254] = Wr[254] = 1;
Kt.string2buf = function(e) {
  var t, r, i, n, s, a = e.length, o = 0;
  for (n = 0; n < a; n++)
    r = e.charCodeAt(n), (r & 64512) === 55296 && n + 1 < a && (i = e.charCodeAt(n + 1), (i & 64512) === 56320 && (r = 65536 + (r - 55296 << 10) + (i - 56320), n++)), o += r < 128 ? 1 : r < 2048 ? 2 : r < 65536 ? 3 : 4;
  for (t = new un.Buf8(o), s = 0, n = 0; s < o; n++)
    r = e.charCodeAt(n), (r & 64512) === 55296 && n + 1 < a && (i = e.charCodeAt(n + 1), (i & 64512) === 56320 && (r = 65536 + (r - 55296 << 10) + (i - 56320), n++)), r < 128 ? t[s++] = r : r < 2048 ? (t[s++] = 192 | r >>> 6, t[s++] = 128 | r & 63) : r < 65536 ? (t[s++] = 224 | r >>> 12, t[s++] = 128 | r >>> 6 & 63, t[s++] = 128 | r & 63) : (t[s++] = 240 | r >>> 18, t[s++] = 128 | r >>> 12 & 63, t[s++] = 128 | r >>> 6 & 63, t[s++] = 128 | r & 63);
  return t;
};
function Pu(e, t) {
  if (t < 65534 && (e.subarray && Uu || !e.subarray && Du))
    return String.fromCharCode.apply(null, un.shrinkBuf(e, t));
  for (var r = "", i = 0; i < t; i++)
    r += String.fromCharCode(e[i]);
  return r;
}
Kt.buf2binstring = function(e) {
  return Pu(e, e.length);
};
Kt.binstring2buf = function(e) {
  for (var t = new un.Buf8(e.length), r = 0, i = t.length; r < i; r++)
    t[r] = e.charCodeAt(r);
  return t;
};
Kt.buf2string = function(e, t) {
  var r, i, n, s, a = t || e.length, o = new Array(a * 2);
  for (i = 0, r = 0; r < a; ) {
    if (n = e[r++], n < 128) {
      o[i++] = n;
      continue;
    }
    if (s = Wr[n], s > 4) {
      o[i++] = 65533, r += s - 1;
      continue;
    }
    for (n &= s === 2 ? 31 : s === 3 ? 15 : 7; s > 1 && r < a; )
      n = n << 6 | e[r++] & 63, s--;
    if (s > 1) {
      o[i++] = 65533;
      continue;
    }
    n < 65536 ? o[i++] = n : (n -= 65536, o[i++] = 55296 | n >> 10 & 1023, o[i++] = 56320 | n & 1023);
  }
  return Pu(o, i);
};
Kt.utf8border = function(e, t) {
  var r;
  for (t = t || e.length, t > e.length && (t = e.length), r = t - 1; r >= 0 && (e[r] & 192) === 128; )
    r--;
  return r < 0 || r === 0 ? t : r + Wr[e[r]] > t ? r : t;
};
function Cp() {
  this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
}
var Bu = Cp, xr = et, Dr = dt, Is = Kt, Ls = ca, Op = Bu, Fu = Object.prototype.toString, kp = 0, Zn = 4, ar = 0, vo = 1, yo = 2, xp = -1, Dp = 0, Up = 8;
function Xt(e) {
  if (!(this instanceof Xt)) return new Xt(e);
  this.options = Dr.assign({
    level: xp,
    method: Up,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Dp,
    to: ""
  }, e || {});
  var t = this.options;
  t.raw && t.windowBits > 0 ? t.windowBits = -t.windowBits : t.gzip && t.windowBits > 0 && t.windowBits < 16 && (t.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new Op(), this.strm.avail_out = 0;
  var r = xr.deflateInit2(
    this.strm,
    t.level,
    t.method,
    t.windowBits,
    t.memLevel,
    t.strategy
  );
  if (r !== ar)
    throw new Error(Ls[r]);
  if (t.header && xr.deflateSetHeader(this.strm, t.header), t.dictionary) {
    var i;
    if (typeof t.dictionary == "string" ? i = Is.string2buf(t.dictionary) : Fu.call(t.dictionary) === "[object ArrayBuffer]" ? i = new Uint8Array(t.dictionary) : i = t.dictionary, r = xr.deflateSetDictionary(this.strm, i), r !== ar)
      throw new Error(Ls[r]);
    this._dict_set = !0;
  }
}
Xt.prototype.push = function(e, t) {
  var r = this.strm, i = this.options.chunkSize, n, s;
  if (this.ended)
    return !1;
  s = t === ~~t ? t : t === !0 ? Zn : kp, typeof e == "string" ? r.input = Is.string2buf(e) : Fu.call(e) === "[object ArrayBuffer]" ? r.input = new Uint8Array(e) : r.input = e, r.next_in = 0, r.avail_in = r.input.length;
  do {
    if (r.avail_out === 0 && (r.output = new Dr.Buf8(i), r.next_out = 0, r.avail_out = i), n = xr.deflate(r, s), n !== vo && n !== ar)
      return this.onEnd(n), this.ended = !0, !1;
    (r.avail_out === 0 || r.avail_in === 0 && (s === Zn || s === yo)) && (this.options.to === "string" ? this.onData(Is.buf2binstring(Dr.shrinkBuf(r.output, r.next_out))) : this.onData(Dr.shrinkBuf(r.output, r.next_out)));
  } while ((r.avail_in > 0 || r.avail_out === 0) && n !== vo);
  return s === Zn ? (n = xr.deflateEnd(this.strm), this.onEnd(n), this.ended = !0, n === ar) : (s === yo && (this.onEnd(ar), r.avail_out = 0), !0);
};
Xt.prototype.onData = function(e) {
  this.chunks.push(e);
};
Xt.prototype.onEnd = function(e) {
  e === ar && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = Dr.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg;
};
function ua(e, t) {
  var r = new Xt(t);
  if (r.push(e, !0), r.err)
    throw r.msg || Ls[r.err];
  return r.result;
}
function Pp(e, t) {
  return t = t || {}, t.raw = !0, ua(e, t);
}
function Bp(e, t) {
  return t = t || {}, t.gzip = !0, ua(e, t);
}
Zr.Deflate = Xt;
Zr.deflate = ua;
Zr.deflateRaw = Pp;
Zr.gzip = Bp;
var ei = {}, Ke = {}, gi = 30, Fp = 12, Mp = function(t, r) {
  var i, n, s, a, o, c, u, l, p, d, f, _, E, w, h, m, b, v, S, L, I, O, P, H, D;
  i = t.state, n = t.next_in, H = t.input, s = n + (t.avail_in - 5), a = t.next_out, D = t.output, o = a - (r - t.avail_out), c = a + (t.avail_out - 257), u = i.dmax, l = i.wsize, p = i.whave, d = i.wnext, f = i.window, _ = i.hold, E = i.bits, w = i.lencode, h = i.distcode, m = (1 << i.lenbits) - 1, b = (1 << i.distbits) - 1;
  e:
    do {
      E < 15 && (_ += H[n++] << E, E += 8, _ += H[n++] << E, E += 8), v = w[_ & m];
      t:
        for (; ; ) {
          if (S = v >>> 24, _ >>>= S, E -= S, S = v >>> 16 & 255, S === 0)
            D[a++] = v & 65535;
          else if (S & 16) {
            L = v & 65535, S &= 15, S && (E < S && (_ += H[n++] << E, E += 8), L += _ & (1 << S) - 1, _ >>>= S, E -= S), E < 15 && (_ += H[n++] << E, E += 8, _ += H[n++] << E, E += 8), v = h[_ & b];
            r:
              for (; ; ) {
                if (S = v >>> 24, _ >>>= S, E -= S, S = v >>> 16 & 255, S & 16) {
                  if (I = v & 65535, S &= 15, E < S && (_ += H[n++] << E, E += 8, E < S && (_ += H[n++] << E, E += 8)), I += _ & (1 << S) - 1, I > u) {
                    t.msg = "invalid distance too far back", i.mode = gi;
                    break e;
                  }
                  if (_ >>>= S, E -= S, S = a - o, I > S) {
                    if (S = I - S, S > p && i.sane) {
                      t.msg = "invalid distance too far back", i.mode = gi;
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
                  t.msg = "invalid distance code", i.mode = gi;
                  break e;
                } else {
                  v = h[(v & 65535) + (_ & (1 << S) - 1)];
                  continue r;
                }
                break;
              }
          } else if (S & 64)
            if (S & 32) {
              i.mode = Fp;
              break e;
            } else {
              t.msg = "invalid literal/length code", i.mode = gi;
              break e;
            }
          else {
            v = w[(v & 65535) + (_ & (1 << S) - 1)];
            continue t;
          }
          break;
        }
    } while (n < s && a < c);
  L = E >> 3, n -= L, E -= L << 3, _ &= (1 << E) - 1, t.next_in = n, t.next_out = a, t.avail_in = n < s ? 5 + (s - n) : 5 - (n - s), t.avail_out = a < c ? 257 + (c - a) : 257 - (a - c), i.hold = _, i.bits = E;
}, wo = dt, Jt = 15, So = 852, Ro = 592, No = 0, Jn = 1, Io = 2, $p = [
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
], Hp = [
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
], Xp = [
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
], Wp = [
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
], zp = function(t, r, i, n, s, a, o, c) {
  var u = c.bits, l = 0, p = 0, d = 0, f = 0, _ = 0, E = 0, w = 0, h = 0, m = 0, b = 0, v, S, L, I, O, P = null, H = 0, D, B = new wo.Buf16(Jt + 1), q = new wo.Buf16(Jt + 1), ge = null, ht = 0, Gt, R, N;
  for (l = 0; l <= Jt; l++)
    B[l] = 0;
  for (p = 0; p < n; p++)
    B[r[i + p]]++;
  for (_ = u, f = Jt; f >= 1 && B[f] === 0; f--)
    ;
  if (_ > f && (_ = f), f === 0)
    return s[a++] = 1 << 24 | 64 << 16 | 0, s[a++] = 1 << 24 | 64 << 16 | 0, c.bits = 1, 0;
  for (d = 1; d < f && B[d] === 0; d++)
    ;
  for (_ < d && (_ = d), h = 1, l = 1; l <= Jt; l++)
    if (h <<= 1, h -= B[l], h < 0)
      return -1;
  if (h > 0 && (t === No || f !== 1))
    return -1;
  for (q[1] = 0, l = 1; l < Jt; l++)
    q[l + 1] = q[l] + B[l];
  for (p = 0; p < n; p++)
    r[i + p] !== 0 && (o[q[r[i + p]]++] = p);
  if (t === No ? (P = ge = o, D = 19) : t === Jn ? (P = $p, H -= 257, ge = Hp, ht -= 257, D = 256) : (P = Xp, ge = Wp, D = -1), b = 0, p = 0, l = d, O = a, E = _, w = 0, L = -1, m = 1 << _, I = m - 1, t === Jn && m > So || t === Io && m > Ro)
    return 1;
  for (; ; ) {
    Gt = l - w, o[p] < D ? (R = 0, N = o[p]) : o[p] > D ? (R = ge[ht + o[p]], N = P[H + o[p]]) : (R = 96, N = 0), v = 1 << l - w, S = 1 << E, d = S;
    do
      S -= v, s[O + (b >> w) + S] = Gt << 24 | R << 16 | N | 0;
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
      if (m += 1 << E, t === Jn && m > So || t === Io && m > Ro)
        return 1;
      L = b & I, s[L] = _ << 24 | E << 16 | O - a | 0;
    }
  }
  return b !== 0 && (s[O + b] = l - w << 24 | 64 << 16 | 0), c.bits = _, 0;
}, Ae = dt, As = Iu, Ge = Lu, qp = Mp, Ur = zp, Kp = 0, Mu = 1, $u = 2, Lo = 4, Yp = 5, bi = 6, Wt = 0, jp = 1, Gp = 2, Pe = -2, Hu = -3, Xu = -4, Vp = -5, Ao = 8, Wu = 1, Co = 2, Oo = 3, ko = 4, xo = 5, Do = 6, Uo = 7, Po = 8, Bo = 9, Fo = 10, $i = 11, nt = 12, Qn = 13, Mo = 14, es = 15, $o = 16, Ho = 17, Xo = 18, Wo = 19, vi = 20, yi = 21, zo = 22, qo = 23, Ko = 24, Yo = 25, jo = 26, ts = 27, Go = 28, Vo = 29, oe = 30, zu = 31, Zp = 32, Jp = 852, Qp = 592, e_ = 15, t_ = e_;
function Zo(e) {
  return (e >>> 24 & 255) + (e >>> 8 & 65280) + ((e & 65280) << 8) + ((e & 255) << 24);
}
function r_() {
  this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new Ae.Buf16(320), this.work = new Ae.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
}
function qu(e) {
  var t;
  return !e || !e.state ? Pe : (t = e.state, e.total_in = e.total_out = t.total = 0, e.msg = "", t.wrap && (e.adler = t.wrap & 1), t.mode = Wu, t.last = 0, t.havedict = 0, t.dmax = 32768, t.head = null, t.hold = 0, t.bits = 0, t.lencode = t.lendyn = new Ae.Buf32(Jp), t.distcode = t.distdyn = new Ae.Buf32(Qp), t.sane = 1, t.back = -1, Wt);
}
function Ku(e) {
  var t;
  return !e || !e.state ? Pe : (t = e.state, t.wsize = 0, t.whave = 0, t.wnext = 0, qu(e));
}
function Yu(e, t) {
  var r, i;
  return !e || !e.state || (i = e.state, t < 0 ? (r = 0, t = -t) : (r = (t >> 4) + 1, t < 48 && (t &= 15)), t && (t < 8 || t > 15)) ? Pe : (i.window !== null && i.wbits !== t && (i.window = null), i.wrap = r, i.wbits = t, Ku(e));
}
function ju(e, t) {
  var r, i;
  return e ? (i = new r_(), e.state = i, i.window = null, r = Yu(e, t), r !== Wt && (e.state = null), r) : Pe;
}
function i_(e) {
  return ju(e, t_);
}
var Jo = !0, rs, is;
function n_(e) {
  if (Jo) {
    var t;
    for (rs = new Ae.Buf32(512), is = new Ae.Buf32(32), t = 0; t < 144; )
      e.lens[t++] = 8;
    for (; t < 256; )
      e.lens[t++] = 9;
    for (; t < 280; )
      e.lens[t++] = 7;
    for (; t < 288; )
      e.lens[t++] = 8;
    for (Ur(Mu, e.lens, 0, 288, rs, 0, e.work, { bits: 9 }), t = 0; t < 32; )
      e.lens[t++] = 5;
    Ur($u, e.lens, 0, 32, is, 0, e.work, { bits: 5 }), Jo = !1;
  }
  e.lencode = rs, e.lenbits = 9, e.distcode = is, e.distbits = 5;
}
function Gu(e, t, r, i) {
  var n, s = e.state;
  return s.window === null && (s.wsize = 1 << s.wbits, s.wnext = 0, s.whave = 0, s.window = new Ae.Buf8(s.wsize)), i >= s.wsize ? (Ae.arraySet(s.window, t, r - s.wsize, s.wsize, 0), s.wnext = 0, s.whave = s.wsize) : (n = s.wsize - s.wnext, n > i && (n = i), Ae.arraySet(s.window, t, r - i, n, s.wnext), i -= n, i ? (Ae.arraySet(s.window, t, r - i, i, 0), s.wnext = i, s.whave = s.wsize) : (s.wnext += n, s.wnext === s.wsize && (s.wnext = 0), s.whave < s.wsize && (s.whave += n))), 0;
}
function s_(e, t) {
  var r, i, n, s, a, o, c, u, l, p, d, f, _, E, w = 0, h, m, b, v, S, L, I, O, P = new Ae.Buf8(4), H, D, B = (
    /* permutation of code lengths */
    [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
  );
  if (!e || !e.state || !e.output || !e.input && e.avail_in !== 0)
    return Pe;
  r = e.state, r.mode === nt && (r.mode = Qn), a = e.next_out, n = e.output, c = e.avail_out, s = e.next_in, i = e.input, o = e.avail_in, u = r.hold, l = r.bits, p = o, d = c, O = Wt;
  e:
    for (; ; )
      switch (r.mode) {
        case Wu:
          if (r.wrap === 0) {
            r.mode = Qn;
            break;
          }
          for (; l < 16; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if (r.wrap & 2 && u === 35615) {
            r.check = 0, P[0] = u & 255, P[1] = u >>> 8 & 255, r.check = Ge(r.check, P, 2, 0), u = 0, l = 0, r.mode = Co;
            break;
          }
          if (r.flags = 0, r.head && (r.head.done = !1), !(r.wrap & 1) || /* check if zlib header allowed */
          (((u & 255) << 8) + (u >> 8)) % 31) {
            e.msg = "incorrect header check", r.mode = oe;
            break;
          }
          if ((u & 15) !== Ao) {
            e.msg = "unknown compression method", r.mode = oe;
            break;
          }
          if (u >>>= 4, l -= 4, I = (u & 15) + 8, r.wbits === 0)
            r.wbits = I;
          else if (I > r.wbits) {
            e.msg = "invalid window size", r.mode = oe;
            break;
          }
          r.dmax = 1 << I, e.adler = r.check = 1, r.mode = u & 512 ? Fo : nt, u = 0, l = 0;
          break;
        case Co:
          for (; l < 16; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if (r.flags = u, (r.flags & 255) !== Ao) {
            e.msg = "unknown compression method", r.mode = oe;
            break;
          }
          if (r.flags & 57344) {
            e.msg = "unknown header flags set", r.mode = oe;
            break;
          }
          r.head && (r.head.text = u >> 8 & 1), r.flags & 512 && (P[0] = u & 255, P[1] = u >>> 8 & 255, r.check = Ge(r.check, P, 2, 0)), u = 0, l = 0, r.mode = Oo;
        case Oo:
          for (; l < 32; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          r.head && (r.head.time = u), r.flags & 512 && (P[0] = u & 255, P[1] = u >>> 8 & 255, P[2] = u >>> 16 & 255, P[3] = u >>> 24 & 255, r.check = Ge(r.check, P, 4, 0)), u = 0, l = 0, r.mode = ko;
        case ko:
          for (; l < 16; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          r.head && (r.head.xflags = u & 255, r.head.os = u >> 8), r.flags & 512 && (P[0] = u & 255, P[1] = u >>> 8 & 255, r.check = Ge(r.check, P, 2, 0)), u = 0, l = 0, r.mode = xo;
        case xo:
          if (r.flags & 1024) {
            for (; l < 16; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            r.length = u, r.head && (r.head.extra_len = u), r.flags & 512 && (P[0] = u & 255, P[1] = u >>> 8 & 255, r.check = Ge(r.check, P, 2, 0)), u = 0, l = 0;
          } else r.head && (r.head.extra = null);
          r.mode = Do;
        case Do:
          if (r.flags & 1024 && (f = r.length, f > o && (f = o), f && (r.head && (I = r.head.extra_len - r.length, r.head.extra || (r.head.extra = new Array(r.head.extra_len)), Ae.arraySet(
            r.head.extra,
            i,
            s,
            // extra field is limited to 65536 bytes
            // - no need for additional size check
            f,
            /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
            I
          )), r.flags & 512 && (r.check = Ge(r.check, i, f, s)), o -= f, s += f, r.length -= f), r.length))
            break e;
          r.length = 0, r.mode = Uo;
        case Uo:
          if (r.flags & 2048) {
            if (o === 0)
              break e;
            f = 0;
            do
              I = i[s + f++], r.head && I && r.length < 65536 && (r.head.name += String.fromCharCode(I));
            while (I && f < o);
            if (r.flags & 512 && (r.check = Ge(r.check, i, f, s)), o -= f, s += f, I)
              break e;
          } else r.head && (r.head.name = null);
          r.length = 0, r.mode = Po;
        case Po:
          if (r.flags & 4096) {
            if (o === 0)
              break e;
            f = 0;
            do
              I = i[s + f++], r.head && I && r.length < 65536 && (r.head.comment += String.fromCharCode(I));
            while (I && f < o);
            if (r.flags & 512 && (r.check = Ge(r.check, i, f, s)), o -= f, s += f, I)
              break e;
          } else r.head && (r.head.comment = null);
          r.mode = Bo;
        case Bo:
          if (r.flags & 512) {
            for (; l < 16; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            if (u !== (r.check & 65535)) {
              e.msg = "header crc mismatch", r.mode = oe;
              break;
            }
            u = 0, l = 0;
          }
          r.head && (r.head.hcrc = r.flags >> 9 & 1, r.head.done = !0), e.adler = r.check = 0, r.mode = nt;
          break;
        case Fo:
          for (; l < 32; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          e.adler = r.check = Zo(u), u = 0, l = 0, r.mode = $i;
        case $i:
          if (r.havedict === 0)
            return e.next_out = a, e.avail_out = c, e.next_in = s, e.avail_in = o, r.hold = u, r.bits = l, Gp;
          e.adler = r.check = 1, r.mode = nt;
        case nt:
          if (t === Yp || t === bi)
            break e;
        case Qn:
          if (r.last) {
            u >>>= l & 7, l -= l & 7, r.mode = ts;
            break;
          }
          for (; l < 3; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          switch (r.last = u & 1, u >>>= 1, l -= 1, u & 3) {
            case 0:
              r.mode = Mo;
              break;
            case 1:
              if (n_(r), r.mode = vi, t === bi) {
                u >>>= 2, l -= 2;
                break e;
              }
              break;
            case 2:
              r.mode = Ho;
              break;
            case 3:
              e.msg = "invalid block type", r.mode = oe;
          }
          u >>>= 2, l -= 2;
          break;
        case Mo:
          for (u >>>= l & 7, l -= l & 7; l < 32; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if ((u & 65535) !== (u >>> 16 ^ 65535)) {
            e.msg = "invalid stored block lengths", r.mode = oe;
            break;
          }
          if (r.length = u & 65535, u = 0, l = 0, r.mode = es, t === bi)
            break e;
        case es:
          r.mode = $o;
        case $o:
          if (f = r.length, f) {
            if (f > o && (f = o), f > c && (f = c), f === 0)
              break e;
            Ae.arraySet(n, i, s, f, a), o -= f, s += f, c -= f, a += f, r.length -= f;
            break;
          }
          r.mode = nt;
          break;
        case Ho:
          for (; l < 14; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if (r.nlen = (u & 31) + 257, u >>>= 5, l -= 5, r.ndist = (u & 31) + 1, u >>>= 5, l -= 5, r.ncode = (u & 15) + 4, u >>>= 4, l -= 4, r.nlen > 286 || r.ndist > 30) {
            e.msg = "too many length or distance symbols", r.mode = oe;
            break;
          }
          r.have = 0, r.mode = Xo;
        case Xo:
          for (; r.have < r.ncode; ) {
            for (; l < 3; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            r.lens[B[r.have++]] = u & 7, u >>>= 3, l -= 3;
          }
          for (; r.have < 19; )
            r.lens[B[r.have++]] = 0;
          if (r.lencode = r.lendyn, r.lenbits = 7, H = { bits: r.lenbits }, O = Ur(Kp, r.lens, 0, 19, r.lencode, 0, r.work, H), r.lenbits = H.bits, O) {
            e.msg = "invalid code lengths set", r.mode = oe;
            break;
          }
          r.have = 0, r.mode = Wo;
        case Wo:
          for (; r.have < r.nlen + r.ndist; ) {
            for (; w = r.lencode[u & (1 << r.lenbits) - 1], h = w >>> 24, m = w >>> 16 & 255, b = w & 65535, !(h <= l); ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            if (b < 16)
              u >>>= h, l -= h, r.lens[r.have++] = b;
            else {
              if (b === 16) {
                for (D = h + 2; l < D; ) {
                  if (o === 0)
                    break e;
                  o--, u += i[s++] << l, l += 8;
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
                  o--, u += i[s++] << l, l += 8;
                }
                u >>>= h, l -= h, I = 0, f = 3 + (u & 7), u >>>= 3, l -= 3;
              } else {
                for (D = h + 7; l < D; ) {
                  if (o === 0)
                    break e;
                  o--, u += i[s++] << l, l += 8;
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
          if (r.lenbits = 9, H = { bits: r.lenbits }, O = Ur(Mu, r.lens, 0, r.nlen, r.lencode, 0, r.work, H), r.lenbits = H.bits, O) {
            e.msg = "invalid literal/lengths set", r.mode = oe;
            break;
          }
          if (r.distbits = 6, r.distcode = r.distdyn, H = { bits: r.distbits }, O = Ur($u, r.lens, r.nlen, r.ndist, r.distcode, 0, r.work, H), r.distbits = H.bits, O) {
            e.msg = "invalid distances set", r.mode = oe;
            break;
          }
          if (r.mode = vi, t === bi)
            break e;
        case vi:
          r.mode = yi;
        case yi:
          if (o >= 6 && c >= 258) {
            e.next_out = a, e.avail_out = c, e.next_in = s, e.avail_in = o, r.hold = u, r.bits = l, qp(e, d), a = e.next_out, n = e.output, c = e.avail_out, s = e.next_in, i = e.input, o = e.avail_in, u = r.hold, l = r.bits, r.mode === nt && (r.back = -1);
            break;
          }
          for (r.back = 0; w = r.lencode[u & (1 << r.lenbits) - 1], h = w >>> 24, m = w >>> 16 & 255, b = w & 65535, !(h <= l); ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if (m && !(m & 240)) {
            for (v = h, S = m, L = b; w = r.lencode[L + ((u & (1 << v + S) - 1) >> v)], h = w >>> 24, m = w >>> 16 & 255, b = w & 65535, !(v + h <= l); ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            u >>>= v, l -= v, r.back += v;
          }
          if (u >>>= h, l -= h, r.back += h, r.length = b, m === 0) {
            r.mode = jo;
            break;
          }
          if (m & 32) {
            r.back = -1, r.mode = nt;
            break;
          }
          if (m & 64) {
            e.msg = "invalid literal/length code", r.mode = oe;
            break;
          }
          r.extra = m & 15, r.mode = zo;
        case zo:
          if (r.extra) {
            for (D = r.extra; l < D; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            r.length += u & (1 << r.extra) - 1, u >>>= r.extra, l -= r.extra, r.back += r.extra;
          }
          r.was = r.length, r.mode = qo;
        case qo:
          for (; w = r.distcode[u & (1 << r.distbits) - 1], h = w >>> 24, m = w >>> 16 & 255, b = w & 65535, !(h <= l); ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if (!(m & 240)) {
            for (v = h, S = m, L = b; w = r.distcode[L + ((u & (1 << v + S) - 1) >> v)], h = w >>> 24, m = w >>> 16 & 255, b = w & 65535, !(v + h <= l); ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            u >>>= v, l -= v, r.back += v;
          }
          if (u >>>= h, l -= h, r.back += h, m & 64) {
            e.msg = "invalid distance code", r.mode = oe;
            break;
          }
          r.offset = b, r.extra = m & 15, r.mode = Ko;
        case Ko:
          if (r.extra) {
            for (D = r.extra; l < D; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            r.offset += u & (1 << r.extra) - 1, u >>>= r.extra, l -= r.extra, r.back += r.extra;
          }
          if (r.offset > r.dmax) {
            e.msg = "invalid distance too far back", r.mode = oe;
            break;
          }
          r.mode = Yo;
        case Yo:
          if (c === 0)
            break e;
          if (f = d - c, r.offset > f) {
            if (f = r.offset - f, f > r.whave && r.sane) {
              e.msg = "invalid distance too far back", r.mode = oe;
              break;
            }
            f > r.wnext ? (f -= r.wnext, _ = r.wsize - f) : _ = r.wnext - f, f > r.length && (f = r.length), E = r.window;
          } else
            E = n, _ = a - r.offset, f = r.length;
          f > c && (f = c), c -= f, r.length -= f;
          do
            n[a++] = E[_++];
          while (--f);
          r.length === 0 && (r.mode = yi);
          break;
        case jo:
          if (c === 0)
            break e;
          n[a++] = r.length, c--, r.mode = yi;
          break;
        case ts:
          if (r.wrap) {
            for (; l < 32; ) {
              if (o === 0)
                break e;
              o--, u |= i[s++] << l, l += 8;
            }
            if (d -= c, e.total_out += d, r.total += d, d && (e.adler = r.check = /*UPDATE(state.check, put - _out, _out);*/
            r.flags ? Ge(r.check, n, d, a - d) : As(r.check, n, d, a - d)), d = c, (r.flags ? u : Zo(u)) !== r.check) {
              e.msg = "incorrect data check", r.mode = oe;
              break;
            }
            u = 0, l = 0;
          }
          r.mode = Go;
        case Go:
          if (r.wrap && r.flags) {
            for (; l < 32; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            if (u !== (r.total & 4294967295)) {
              e.msg = "incorrect length check", r.mode = oe;
              break;
            }
            u = 0, l = 0;
          }
          r.mode = Vo;
        case Vo:
          O = jp;
          break e;
        case oe:
          O = Hu;
          break e;
        case zu:
          return Xu;
        case Zp:
        default:
          return Pe;
      }
  return e.next_out = a, e.avail_out = c, e.next_in = s, e.avail_in = o, r.hold = u, r.bits = l, (r.wsize || d !== e.avail_out && r.mode < oe && (r.mode < ts || t !== Lo)) && Gu(e, e.output, e.next_out, d - e.avail_out), p -= e.avail_in, d -= e.avail_out, e.total_in += p, e.total_out += d, r.total += d, r.wrap && d && (e.adler = r.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
  r.flags ? Ge(r.check, n, d, e.next_out - d) : As(r.check, n, d, e.next_out - d)), e.data_type = r.bits + (r.last ? 64 : 0) + (r.mode === nt ? 128 : 0) + (r.mode === vi || r.mode === es ? 256 : 0), (p === 0 && d === 0 || t === Lo) && O === Wt && (O = Vp), O;
}
function a_(e) {
  if (!e || !e.state)
    return Pe;
  var t = e.state;
  return t.window && (t.window = null), e.state = null, Wt;
}
function o_(e, t) {
  var r;
  return !e || !e.state || (r = e.state, !(r.wrap & 2)) ? Pe : (r.head = t, t.done = !1, Wt);
}
function c_(e, t) {
  var r = t.length, i, n, s;
  return !e || !e.state || (i = e.state, i.wrap !== 0 && i.mode !== $i) ? Pe : i.mode === $i && (n = 1, n = As(n, t, r, 0), n !== i.check) ? Hu : (s = Gu(e, t, r, r), s ? (i.mode = zu, Xu) : (i.havedict = 1, Wt));
}
Ke.inflateReset = Ku;
Ke.inflateReset2 = Yu;
Ke.inflateResetKeep = qu;
Ke.inflateInit = i_;
Ke.inflateInit2 = ju;
Ke.inflate = s_;
Ke.inflateEnd = a_;
Ke.inflateGetHeader = o_;
Ke.inflateSetDictionary = c_;
Ke.inflateInfo = "pako inflate (from Nodeca project)";
var Vu = {
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
function u_() {
  this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1;
}
var l_ = u_, or = Ke, Pr = dt, xi = Kt, de = Vu, Cs = ca, d_ = Bu, f_ = l_, Zu = Object.prototype.toString;
function zt(e) {
  if (!(this instanceof zt)) return new zt(e);
  this.options = Pr.assign({
    chunkSize: 16384,
    windowBits: 0,
    to: ""
  }, e || {});
  var t = this.options;
  t.raw && t.windowBits >= 0 && t.windowBits < 16 && (t.windowBits = -t.windowBits, t.windowBits === 0 && (t.windowBits = -15)), t.windowBits >= 0 && t.windowBits < 16 && !(e && e.windowBits) && (t.windowBits += 32), t.windowBits > 15 && t.windowBits < 48 && (t.windowBits & 15 || (t.windowBits |= 15)), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new d_(), this.strm.avail_out = 0;
  var r = or.inflateInit2(
    this.strm,
    t.windowBits
  );
  if (r !== de.Z_OK)
    throw new Error(Cs[r]);
  if (this.header = new f_(), or.inflateGetHeader(this.strm, this.header), t.dictionary && (typeof t.dictionary == "string" ? t.dictionary = xi.string2buf(t.dictionary) : Zu.call(t.dictionary) === "[object ArrayBuffer]" && (t.dictionary = new Uint8Array(t.dictionary)), t.raw && (r = or.inflateSetDictionary(this.strm, t.dictionary), r !== de.Z_OK)))
    throw new Error(Cs[r]);
}
zt.prototype.push = function(e, t) {
  var r = this.strm, i = this.options.chunkSize, n = this.options.dictionary, s, a, o, c, u, l = !1;
  if (this.ended)
    return !1;
  a = t === ~~t ? t : t === !0 ? de.Z_FINISH : de.Z_NO_FLUSH, typeof e == "string" ? r.input = xi.binstring2buf(e) : Zu.call(e) === "[object ArrayBuffer]" ? r.input = new Uint8Array(e) : r.input = e, r.next_in = 0, r.avail_in = r.input.length;
  do {
    if (r.avail_out === 0 && (r.output = new Pr.Buf8(i), r.next_out = 0, r.avail_out = i), s = or.inflate(r, de.Z_NO_FLUSH), s === de.Z_NEED_DICT && n && (s = or.inflateSetDictionary(this.strm, n)), s === de.Z_BUF_ERROR && l === !0 && (s = de.Z_OK, l = !1), s !== de.Z_STREAM_END && s !== de.Z_OK)
      return this.onEnd(s), this.ended = !0, !1;
    r.next_out && (r.avail_out === 0 || s === de.Z_STREAM_END || r.avail_in === 0 && (a === de.Z_FINISH || a === de.Z_SYNC_FLUSH)) && (this.options.to === "string" ? (o = xi.utf8border(r.output, r.next_out), c = r.next_out - o, u = xi.buf2string(r.output, o), r.next_out = c, r.avail_out = i - c, c && Pr.arraySet(r.output, r.output, o, c, 0), this.onData(u)) : this.onData(Pr.shrinkBuf(r.output, r.next_out))), r.avail_in === 0 && r.avail_out === 0 && (l = !0);
  } while ((r.avail_in > 0 || r.avail_out === 0) && s !== de.Z_STREAM_END);
  return s === de.Z_STREAM_END && (a = de.Z_FINISH), a === de.Z_FINISH ? (s = or.inflateEnd(this.strm), this.onEnd(s), this.ended = !0, s === de.Z_OK) : (a === de.Z_SYNC_FLUSH && (this.onEnd(de.Z_OK), r.avail_out = 0), !0);
};
zt.prototype.onData = function(e) {
  this.chunks.push(e);
};
zt.prototype.onEnd = function(e) {
  e === de.Z_OK && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = Pr.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg;
};
function la(e, t) {
  var r = new zt(t);
  if (r.push(e, !0), r.err)
    throw r.msg || Cs[r.err];
  return r.result;
}
function h_(e, t) {
  return t = t || {}, t.raw = !0, la(e, t);
}
ei.Inflate = zt;
ei.inflate = la;
ei.inflateRaw = h_;
ei.ungzip = la;
var p_ = dt.assign, __ = Zr, E_ = ei, m_ = Vu, Ju = {};
p_(Ju, __, E_, m_);
var T_ = Ju, g_ = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Uint32Array < "u", b_ = T_, Qu = le(), ln = Be, v_ = g_ ? "uint8array" : "array";
an.magic = "\b\0";
function Yt(e, t) {
  ln.call(this, "FlateWorker/" + e), this._pako = null, this._pakoAction = e, this._pakoOptions = t, this.meta = {};
}
Qu.inherits(Yt, ln);
Yt.prototype.processChunk = function(e) {
  this.meta = e.meta, this._pako === null && this._createPako(), this._pako.push(Qu.transformTo(v_, e.data), !1);
};
Yt.prototype.flush = function() {
  ln.prototype.flush.call(this), this._pako === null && this._createPako(), this._pako.push([], !0);
};
Yt.prototype.cleanUp = function() {
  ln.prototype.cleanUp.call(this), this._pako = null;
};
Yt.prototype._createPako = function() {
  this._pako = new b_[this._pakoAction]({
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
an.compressWorker = function(e) {
  return new Yt("Deflate", e);
};
an.uncompressWorker = function() {
  return new Yt("Inflate", {});
};
var Qo = Be;
sn.STORE = {
  magic: "\0\0",
  compressWorker: function() {
    return new Qo("STORE compression");
  },
  uncompressWorker: function() {
    return new Qo("STORE decompression");
  }
};
sn.DEFLATE = an;
var Nt = {};
Nt.LOCAL_FILE_HEADER = "PK";
Nt.CENTRAL_FILE_HEADER = "PK";
Nt.CENTRAL_DIRECTORY_END = "PK";
Nt.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07";
Nt.ZIP64_CENTRAL_DIRECTORY_END = "PK";
Nt.DATA_DESCRIPTOR = "PK\x07\b";
var ir = le(), vr = Be, ns = Er, ec = Zs, Hi = Nt, ne = function(e, t) {
  var r = "", i;
  for (i = 0; i < t; i++)
    r += String.fromCharCode(e & 255), e = e >>> 8;
  return r;
}, y_ = function(e, t) {
  var r = e;
  return e || (r = t ? 16893 : 33204), (r & 65535) << 16;
}, w_ = function(e) {
  return (e || 0) & 63;
}, el = function(e, t, r, i, n, s) {
  var a = e.file, o = e.compression, c = s !== ns.utf8encode, u = ir.transformTo("string", s(a.name)), l = ir.transformTo("string", ns.utf8encode(a.name)), p = a.comment, d = ir.transformTo("string", s(p)), f = ir.transformTo("string", ns.utf8encode(p)), _ = l.length !== a.name.length, E = f.length !== p.length, w, h, m = "", b = "", v = "", S = a.dir, L = a.date, I = {
    crc32: 0,
    compressedSize: 0,
    uncompressedSize: 0
  };
  (!t || r) && (I.crc32 = e.crc32, I.compressedSize = e.compressedSize, I.uncompressedSize = e.uncompressedSize);
  var O = 0;
  t && (O |= 8), !c && (_ || E) && (O |= 2048);
  var P = 0, H = 0;
  S && (P |= 16), n === "UNIX" ? (H = 798, P |= y_(a.unixPermissions, S)) : (H = 20, P |= w_(a.dosPermissions)), w = L.getUTCHours(), w = w << 6, w = w | L.getUTCMinutes(), w = w << 5, w = w | L.getUTCSeconds() / 2, h = L.getUTCFullYear() - 1980, h = h << 4, h = h | L.getUTCMonth() + 1, h = h << 5, h = h | L.getUTCDate(), _ && (b = // Version
  ne(1, 1) + // NameCRC32
  ne(ec(u), 4) + // UnicodeName
  l, m += // Info-ZIP Unicode Path Extra Field
  "up" + // size
  ne(b.length, 2) + // content
  b), E && (v = // Version
  ne(1, 1) + // CommentCRC32
  ne(ec(d), 4) + // UnicodeName
  f, m += // Info-ZIP Unicode Path Extra Field
  "uc" + // size
  ne(v.length, 2) + // content
  v);
  var D = "";
  D += `
\0`, D += ne(O, 2), D += o.magic, D += ne(w, 2), D += ne(h, 2), D += ne(I.crc32, 4), D += ne(I.compressedSize, 4), D += ne(I.uncompressedSize, 4), D += ne(u.length, 2), D += ne(m.length, 2);
  var B = Hi.LOCAL_FILE_HEADER + D + u + m, q = Hi.CENTRAL_FILE_HEADER + // version made by (00: DOS)
  ne(H, 2) + // file header (common to file and central directory)
  D + // file comment length
  ne(d.length, 2) + // disk number start
  "\0\0\0\0" + // external file attributes
  ne(P, 4) + // relative offset of local header
  ne(i, 4) + // file name
  u + // extra field
  m + // file comment
  d;
  return {
    fileRecord: B,
    dirRecord: q
  };
}, S_ = function(e, t, r, i, n) {
  var s = "", a = ir.transformTo("string", n(i));
  return s = Hi.CENTRAL_DIRECTORY_END + // number of this disk
  "\0\0\0\0" + // total number of entries in the central directory on this disk
  ne(e, 2) + // total number of entries in the central directory
  ne(e, 2) + // size of the central directory   4 bytes
  ne(t, 4) + // offset of start of central directory with respect to the starting disk number
  ne(r, 4) + // .ZIP file comment length
  ne(a.length, 2) + // .ZIP file comment
  a, s;
}, R_ = function(e) {
  var t = "";
  return t = Hi.DATA_DESCRIPTOR + // crc-32                          4 bytes
  ne(e.crc32, 4) + // compressed size                 4 bytes
  ne(e.compressedSize, 4) + // uncompressed size               4 bytes
  ne(e.uncompressedSize, 4), t;
};
function Ye(e, t, r, i) {
  vr.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t, this.zipPlatform = r, this.encodeFileName = i, this.streamFiles = e, this.accumulate = !1, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
}
ir.inherits(Ye, vr);
Ye.prototype.push = function(e) {
  var t = e.meta.percent || 0, r = this.entriesCount, i = this._sources.length;
  this.accumulate ? this.contentBuffer.push(e) : (this.bytesWritten += e.data.length, vr.prototype.push.call(this, {
    data: e.data,
    meta: {
      currentFile: this.currentFile,
      percent: r ? (t + 100 * (r - i - 1)) / r : 100
    }
  }));
};
Ye.prototype.openedSource = function(e) {
  this.currentSourceOffset = this.bytesWritten, this.currentFile = e.file.name;
  var t = this.streamFiles && !e.file.dir;
  if (t) {
    var r = el(e, t, !1, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
    this.push({
      data: r.fileRecord,
      meta: { percent: 0 }
    });
  } else
    this.accumulate = !0;
};
Ye.prototype.closedSource = function(e) {
  this.accumulate = !1;
  var t = this.streamFiles && !e.file.dir, r = el(e, t, !0, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
  if (this.dirRecords.push(r.dirRecord), t)
    this.push({
      data: R_(e),
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
Ye.prototype.flush = function() {
  for (var e = this.bytesWritten, t = 0; t < this.dirRecords.length; t++)
    this.push({
      data: this.dirRecords[t],
      meta: { percent: 100 }
    });
  var r = this.bytesWritten - e, i = S_(this.dirRecords.length, r, e, this.zipComment, this.encodeFileName);
  this.push({
    data: i,
    meta: { percent: 100 }
  });
};
Ye.prototype.prepareNextSource = function() {
  this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
};
Ye.prototype.registerPrevious = function(e) {
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
Ye.prototype.resume = function() {
  if (!vr.prototype.resume.call(this))
    return !1;
  if (!this.previous && this._sources.length)
    return this.prepareNextSource(), !0;
  if (!this.previous && !this._sources.length && !this.generatedError)
    return this.end(), !0;
};
Ye.prototype.error = function(e) {
  var t = this._sources;
  if (!vr.prototype.error.call(this, e))
    return !1;
  for (var r = 0; r < t.length; r++)
    try {
      t[r].error(e);
    } catch {
    }
  return !0;
};
Ye.prototype.lock = function() {
  vr.prototype.lock.call(this);
  for (var e = this._sources, t = 0; t < e.length; t++)
    e[t].lock();
};
var N_ = Ye, I_ = sn, L_ = N_, A_ = function(e, t) {
  var r = e || t, i = I_[r];
  if (!i)
    throw new Error(r + " is not a valid compression method !");
  return i;
};
du.generateWorker = function(e, t, r) {
  var i = new L_(t.streamFiles, r, t.platform, t.encodeFileName), n = 0;
  try {
    e.forEach(function(s, a) {
      n++;
      var o = A_(a.options.compression, t.compression), c = a.options.compressionOptions || t.compressionOptions || {}, u = a.dir, l = a.date;
      a._compressWorker(o, c).withStreamInfo("file", {
        name: s,
        dir: u,
        date: l,
        comment: a.comment || "",
        unixPermissions: a.unixPermissions,
        dosPermissions: a.dosPermissions
      }).pipe(i);
    }), i.entriesCount = n;
  } catch (s) {
    i.error(s);
  }
  return i;
};
var C_ = le(), dn = Be;
function ti(e, t) {
  dn.call(this, "Nodejs stream input adapter for " + e), this._upstreamEnded = !1, this._bindStream(t);
}
C_.inherits(ti, dn);
ti.prototype._bindStream = function(e) {
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
ti.prototype.pause = function() {
  return dn.prototype.pause.call(this) ? (this._stream.pause(), !0) : !1;
};
ti.prototype.resume = function() {
  return dn.prototype.resume.call(this) ? (this._upstreamEnded ? this.end() : this._stream.resume(), !0) : !1;
};
var O_ = ti, k_ = Er, Br = le(), tl = Be, x_ = au, rl = Fe, tc = ra, D_ = Nh, U_ = du, rc = tn, P_ = O_, il = function(e, t, r) {
  var i = Br.getTypeOf(t), n, s = Br.extend(r || {}, rl);
  s.date = s.date || /* @__PURE__ */ new Date(), s.compression !== null && (s.compression = s.compression.toUpperCase()), typeof s.unixPermissions == "string" && (s.unixPermissions = parseInt(s.unixPermissions, 8)), s.unixPermissions && s.unixPermissions & 16384 && (s.dir = !0), s.dosPermissions && s.dosPermissions & 16 && (s.dir = !0), s.dir && (e = nl(e)), s.createFolders && (n = B_(e)) && sl.call(this, n, !0);
  var a = i === "string" && s.binary === !1 && s.base64 === !1;
  (!r || typeof r.binary > "u") && (s.binary = !a);
  var o = t instanceof tc && t.uncompressedSize === 0;
  (o || s.dir || !t || t.length === 0) && (s.base64 = !1, s.binary = !0, t = "", s.compression = "STORE", i = "string");
  var c = null;
  t instanceof tc || t instanceof tl ? c = t : rc.isNode && rc.isStream(t) ? c = new P_(e, t) : c = Br.prepareContent(e, t, s.binary, s.optimizedBinaryString, s.base64);
  var u = new D_(e, c, s);
  this.files[e] = u;
}, B_ = function(e) {
  e.slice(-1) === "/" && (e = e.substring(0, e.length - 1));
  var t = e.lastIndexOf("/");
  return t > 0 ? e.substring(0, t) : "";
}, nl = function(e) {
  return e.slice(-1) !== "/" && (e += "/"), e;
}, sl = function(e, t) {
  return t = typeof t < "u" ? t : rl.createFolders, e = nl(e), this.files[e] || il.call(this, e, null, {
    dir: !0,
    createFolders: t
  }), this.files[e];
};
function ic(e) {
  return Object.prototype.toString.call(e) === "[object RegExp]";
}
var F_ = {
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
      if (ic(e)) {
        var i = e;
        return this.filter(function(s, a) {
          return !a.dir && i.test(s);
        });
      } else {
        var n = this.files[this.root + e];
        return n && !n.dir ? n : null;
      }
    else
      e = this.root + e, il.call(this, e, t, r);
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
    if (ic(e))
      return this.filter(function(n, s) {
        return s.dir && e.test(n);
      });
    var t = this.root + e, r = sl.call(this, t), i = this.clone();
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
      for (var r = this.filter(function(n, s) {
        return s.name.slice(0, e.length) === e;
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
      if (r = Br.extend(e || {}, {
        streamFiles: !1,
        compression: "STORE",
        compressionOptions: null,
        type: "",
        platform: "DOS",
        comment: null,
        mimeType: "application/zip",
        encodeFileName: k_.utf8encode
      }), r.type = r.type.toLowerCase(), r.compression = r.compression.toUpperCase(), r.type === "binarystring" && (r.type = "string"), !r.type)
        throw new Error("No output type specified.");
      Br.checkSupport(r.type), (r.platform === "darwin" || r.platform === "freebsd" || r.platform === "linux" || r.platform === "sunos") && (r.platform = "UNIX"), r.platform === "win32" && (r.platform = "DOS");
      var i = r.comment || this.comment || "";
      t = U_.generateWorker(this, r, i);
    } catch (n) {
      t = new tl("error"), t.error(n);
    }
    return new x_(t, r.type || "string", r.mimeType);
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
}, M_ = F_, $_ = le();
function al(e) {
  this.data = e, this.length = e.length, this.index = 0, this.zero = 0;
}
al.prototype = {
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
    return $_.transformTo("string", this.readData(e));
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
var ol = al, cl = ol, H_ = le();
function yr(e) {
  cl.call(this, e);
  for (var t = 0; t < this.data.length; t++)
    e[t] = e[t] & 255;
}
H_.inherits(yr, cl);
yr.prototype.byteAt = function(e) {
  return this.data[this.zero + e];
};
yr.prototype.lastIndexOfSignature = function(e) {
  for (var t = e.charCodeAt(0), r = e.charCodeAt(1), i = e.charCodeAt(2), n = e.charCodeAt(3), s = this.length - 4; s >= 0; --s)
    if (this.data[s] === t && this.data[s + 1] === r && this.data[s + 2] === i && this.data[s + 3] === n)
      return s - this.zero;
  return -1;
};
yr.prototype.readAndCheckSignature = function(e) {
  var t = e.charCodeAt(0), r = e.charCodeAt(1), i = e.charCodeAt(2), n = e.charCodeAt(3), s = this.readData(4);
  return t === s[0] && r === s[1] && i === s[2] && n === s[3];
};
yr.prototype.readData = function(e) {
  if (this.checkOffset(e), e === 0)
    return [];
  var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var ul = yr, ll = ol, X_ = le();
function wr(e) {
  ll.call(this, e);
}
X_.inherits(wr, ll);
wr.prototype.byteAt = function(e) {
  return this.data.charCodeAt(this.zero + e);
};
wr.prototype.lastIndexOfSignature = function(e) {
  return this.data.lastIndexOf(e) - this.zero;
};
wr.prototype.readAndCheckSignature = function(e) {
  var t = this.readData(4);
  return e === t;
};
wr.prototype.readData = function(e) {
  this.checkOffset(e);
  var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var W_ = wr, dl = ul, z_ = le();
function da(e) {
  dl.call(this, e);
}
z_.inherits(da, dl);
da.prototype.readData = function(e) {
  if (this.checkOffset(e), e === 0)
    return new Uint8Array(0);
  var t = this.data.subarray(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var fl = da, hl = fl, q_ = le();
function fa(e) {
  hl.call(this, e);
}
q_.inherits(fa, hl);
fa.prototype.readData = function(e) {
  this.checkOffset(e);
  var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var K_ = fa, wi = le(), nc = pe, Y_ = ul, j_ = W_, G_ = K_, V_ = fl, pl = function(e) {
  var t = wi.getTypeOf(e);
  return wi.checkSupport(t), t === "string" && !nc.uint8array ? new j_(e) : t === "nodebuffer" ? new G_(e) : nc.uint8array ? new V_(wi.transformTo("uint8array", e)) : new Y_(wi.transformTo("array", e));
}, ss = pl, _t = le(), Z_ = ra, sc = Zs, Si = Er, Ri = sn, J_ = pe, Q_ = 0, eE = 3, tE = function(e) {
  for (var t in Ri)
    if (Object.prototype.hasOwnProperty.call(Ri, t) && Ri[t].magic === e)
      return Ri[t];
  return null;
};
function _l(e, t) {
  this.options = e, this.loadOptions = t;
}
_l.prototype = {
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
    if (t = tE(this.compressionMethod), t === null)
      throw new Error("Corrupted zip : compression " + _t.pretty(this.compressionMethod) + " unknown (inner file : " + _t.transformTo("string", this.fileName) + ")");
    this.decompressed = new Z_(this.compressedSize, this.uncompressedSize, this.crc32, t, e.readData(this.compressedSize));
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
    this.dir = !!(this.externalFileAttributes & 16), e === Q_ && (this.dosPermissions = this.externalFileAttributes & 63), e === eE && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), !this.dir && this.fileNameStr.slice(-1) === "/" && (this.dir = !0);
  },
  /**
   * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
   * @param {DataReader} reader the reader to use.
   */
  parseZIP64ExtraField: function() {
    if (this.extraFields[1]) {
      var e = ss(this.extraFields[1].value);
      this.uncompressedSize === _t.MAX_VALUE_32BITS && (this.uncompressedSize = e.readInt(8)), this.compressedSize === _t.MAX_VALUE_32BITS && (this.compressedSize = e.readInt(8)), this.localHeaderOffset === _t.MAX_VALUE_32BITS && (this.localHeaderOffset = e.readInt(8)), this.diskNumberStart === _t.MAX_VALUE_32BITS && (this.diskNumberStart = e.readInt(4));
    }
  },
  /**
   * Read the central part of a zip file and add the info in this object.
   * @param {DataReader} reader the reader to use.
   */
  readExtraFields: function(e) {
    var t = e.index + this.extraFieldsLength, r, i, n;
    for (this.extraFields || (this.extraFields = {}); e.index + 4 < t; )
      r = e.readInt(2), i = e.readInt(2), n = e.readData(i), this.extraFields[r] = {
        id: r,
        length: i,
        value: n
      };
    e.setIndex(t);
  },
  /**
   * Apply an UTF8 transformation if needed.
   */
  handleUTF8: function() {
    var e = J_.uint8array ? "uint8array" : "array";
    if (this.useUTF8())
      this.fileNameStr = Si.utf8decode(this.fileName), this.fileCommentStr = Si.utf8decode(this.fileComment);
    else {
      var t = this.findExtraFieldUnicodePath();
      if (t !== null)
        this.fileNameStr = t;
      else {
        var r = _t.transformTo(e, this.fileName);
        this.fileNameStr = this.loadOptions.decodeFileName(r);
      }
      var i = this.findExtraFieldUnicodeComment();
      if (i !== null)
        this.fileCommentStr = i;
      else {
        var n = _t.transformTo(e, this.fileComment);
        this.fileCommentStr = this.loadOptions.decodeFileName(n);
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
      var t = ss(e.value);
      return t.readInt(1) !== 1 || sc(this.fileName) !== t.readInt(4) ? null : Si.utf8decode(t.readData(e.length - 5));
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
      var t = ss(e.value);
      return t.readInt(1) !== 1 || sc(this.fileComment) !== t.readInt(4) ? null : Si.utf8decode(t.readData(e.length - 5));
    }
    return null;
  }
};
var rE = _l, iE = pl, st = le(), He = Nt, nE = rE, sE = pe;
function El(e) {
  this.files = [], this.loadOptions = e;
}
El.prototype = {
  /**
   * Check that the reader is on the specified signature.
   * @param {string} expectedSignature the expected signature.
   * @throws {Error} if it is an other signature.
   */
  checkSignature: function(e) {
    if (!this.reader.readAndCheckSignature(e)) {
      this.reader.index -= 4;
      var t = this.reader.readString(4);
      throw new Error("Corrupted zip or bug: unexpected signature (" + st.pretty(t) + ", expected " + st.pretty(e) + ")");
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
    var i = this.reader.readString(4), n = i === t;
    return this.reader.setIndex(r), n;
  },
  /**
   * Read the end of the central directory.
   */
  readBlockEndOfCentral: function() {
    this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
    var e = this.reader.readData(this.zipCommentLength), t = sE.uint8array ? "uint8array" : "array", r = st.transformTo(t, e);
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
    for (var e = this.zip64EndOfCentralSize - 44, t = 0, r, i, n; t < e; )
      r = this.reader.readInt(2), i = this.reader.readInt(4), n = this.reader.readData(i), this.zip64ExtensibleData[r] = {
        id: r,
        length: i,
        value: n
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
      e = new nE({
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
    if (this.checkSignature(He.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === st.MAX_VALUE_16BITS || this.diskWithCentralDirStart === st.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === st.MAX_VALUE_16BITS || this.centralDirRecords === st.MAX_VALUE_16BITS || this.centralDirSize === st.MAX_VALUE_32BITS || this.centralDirOffset === st.MAX_VALUE_32BITS) {
      if (this.zip64 = !0, e = this.reader.lastIndexOfSignature(He.ZIP64_CENTRAL_DIRECTORY_LOCATOR), e < 0)
        throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
      if (this.reader.setIndex(e), this.checkSignature(He.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, He.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(He.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0))
        throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
      this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(He.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
    }
    var i = this.centralDirOffset + this.centralDirSize;
    this.zip64 && (i += 20, i += 12 + this.zip64EndOfCentralSize);
    var n = r - i;
    if (n > 0)
      this.isSignature(r, He.CENTRAL_FILE_HEADER) || (this.reader.zero = n);
    else if (n < 0)
      throw new Error("Corrupted zip: missing " + Math.abs(n) + " bytes.");
  },
  prepareReader: function(e) {
    this.reader = iE(e);
  },
  /**
   * Read a zip file and create ZipEntries.
   * @param {String|ArrayBuffer|Uint8Array|Buffer} data the binary string representing a zip file.
   */
  load: function(e) {
    this.prepareReader(e), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
  }
};
var aE = El, as = le(), Di = Vr, oE = Er, cE = aE, uE = lu, ac = tn;
function lE(e) {
  return new Di.Promise(function(t, r) {
    var i = e.decompressed.getContentWorker().pipe(new uE());
    i.on("error", function(n) {
      r(n);
    }).on("end", function() {
      i.streamInfo.crc32 !== e.decompressed.crc32 ? r(new Error("Corrupted zip : CRC32 mismatch")) : t();
    }).resume();
  });
}
var dE = function(e, t) {
  var r = this;
  return t = as.extend(t || {}, {
    base64: !1,
    checkCRC32: !1,
    optimizedBinaryString: !1,
    createFolders: !1,
    decodeFileName: oE.utf8decode
  }), ac.isNode && ac.isStream(e) ? Di.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : as.prepareContent("the loaded zip file", e, !0, t.optimizedBinaryString, t.base64).then(function(i) {
    var n = new cE(t);
    return n.load(i), n;
  }).then(function(n) {
    var s = [Di.Promise.resolve(n)], a = n.files;
    if (t.checkCRC32)
      for (var o = 0; o < a.length; o++)
        s.push(lE(a[o]));
    return Di.Promise.all(s);
  }).then(function(n) {
    for (var s = n.shift(), a = s.files, o = 0; o < a.length; o++) {
      var c = a[o], u = c.fileNameStr, l = as.resolve(c.fileNameStr);
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
    return s.zipComment.length && (r.comment = s.zipComment), r;
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
Ue.prototype = M_;
Ue.prototype.loadAsync = dE;
Ue.support = pe;
Ue.defaults = Fe;
Ue.version = "3.10.1";
Ue.loadAsync = function(e, t) {
  return new Ue().loadAsync(e, t);
};
Ue.external = Vr;
var fE = Ue;
const ml = /* @__PURE__ */ zs(fE);
let Pt = null;
function Tl() {
  return Pt;
}
function gl() {
  return Pt = null, { ok: !0 };
}
function hE(e) {
  try {
    We(), lt(he());
    const t = he().prepare(
      `SELECT id, business_id, branch_id, name, image_path, email, password_hash, role, is_active
         FROM users
         WHERE email = ?`
    ).get(e.email.trim().toLowerCase());
    if (!t)
      return { ok: !1, error: "invalid_credentials", message: "Email or password is incorrect." };
    if (!t.is_active)
      return { ok: !1, error: "inactive", message: "This account is inactive." };
    if (!cr.compareSync(e.password, t.password_hash))
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
    return he().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), t.id), Pt = i, { ok: !0, user: i };
  } catch (t) {
    return {
      ok: !1,
      error: "unknown",
      message: t instanceof Error ? t.message : "Login failed"
    };
  }
}
function pE(e) {
  const t = {
    ok: !1,
    error: "invalid_credentials",
    message: "Could not verify owner account details."
  };
  try {
    const r = e.email.trim().toLowerCase(), i = e.licenseKey.trim(), n = e.newPassword.trim();
    if (!r || !i || !n)
      return { ok: !1, error: "validation_failed", message: "All fields are required." };
    if (n.length < 8)
      return {
        ok: !1,
        error: "validation_failed",
        message: "Password must be at least 8 characters."
      };
    We(), lt(he());
    const s = _r();
    if (s.status === "none")
      return {
        ok: !1,
        error: "not_configured",
        message: "License is not configured on this device."
      };
    if (s.status === "expired")
      return {
        ok: !1,
        error: "license_expired",
        message: "License has expired. Renew license before resetting password."
      };
    const a = Gs();
    if (!a || a.licenseKey !== i)
      return { ok: !1, error: "invalid_license", message: "License key is invalid for this device." };
    const o = he().prepare(
      `SELECT id
         FROM users
         WHERE role = 'owner' AND is_active = 1 AND email = ?`
    ).get(r);
    if (!o) return t;
    const c = cr.hashSync(n, 12);
    return he().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(c, o.id), (Pt == null ? void 0 : Pt.id) === o.id && (Pt = null), { ok: !0 };
  } catch (r) {
    return {
      ok: !1,
      error: "unknown",
      message: r instanceof Error ? r.message : "Password reset failed."
    };
  }
}
const _E = {
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
function EE(e, t) {
  return e ? _E[e.role].includes(t) : !1;
}
function re() {
  const e = Tl();
  if (!e) throw new Error("Not authenticated");
  return e;
}
function j() {
  if (_r().status !== "valid")
    throw new Error("License expired");
}
function X(e) {
  const t = re();
  if (!EE(t, e)) throw new Error("Forbidden");
  return t;
}
function M(e) {
  const t = re();
  if (t.role !== "owner" && t.businessId !== e)
    throw new Error("Forbidden business scope");
}
function Sr(e) {
  const t = re();
  if (!(t.role === "owner" || t.role === "admin") && t.branchId !== e)
    throw new Error("Forbidden branch scope");
}
const at = Buffer.from("KAAROBKB1", "utf8"), mE = "kaarobar-backup-salt-v1", TE = "kaarobar-dev-backup-secret";
function gE() {
  return process.env.KAAROBAR_BACKUP_SECRET || "Gna3LYmV74oluMsJxJxU4UpWaDbM5YOZFW+";
}
function bE() {
  const e = [
    process.env.KAAROBAR_BACKUP_SECRET,
    "Gna3LYmV74oluMsJxJxU4UpWaDbM5YOZFW+",
    TE
  ].filter((t) => !!(t && t.trim()));
  return [...new Set(e)];
}
function bl(e) {
  return Dc(e, mE, 32);
}
function vE(e) {
  const t = bl(gE()), r = Cc(12), i = Oc("aes-256-gcm", t, r), n = Buffer.concat([i.update(e), i.final()]), s = i.getAuthTag();
  return Buffer.concat([at, r, s, n]);
}
function yE(e) {
  if (e.length < at.length + 12 + 16 + 1)
    throw new Error("Invalid backup file: too short");
  if (!e.subarray(0, at.length).equals(at))
    throw new Error("Invalid backup file: not a Kaarobar encrypted backup");
  const r = e.subarray(at.length, at.length + 12), i = e.subarray(at.length + 12, at.length + 28), n = e.subarray(at.length + 28);
  for (const s of bE())
    try {
      const a = bl(s), o = Uc("aes-256-gcm", a, r);
      return o.setAuthTag(i), Buffer.concat([o.update(n), o.final()]);
    } catch {
    }
  throw new Error("Invalid backup file: decrypt failed");
}
const wE = 2, SE = Buffer.from("SQLite format 3\0", "utf8"), RE = Buffer.from([80, 75, 3, 4]);
function ie(e, t, r, i) {
  e && e({
    operation: t,
    phase: r,
    percent: Math.max(0, Math.min(100, Math.round(i)))
  });
}
function Os(e, t, r, i, n) {
  if (r <= t) return n;
  const s = Math.max(0, Math.min(1, (e - t) / (r - t)));
  return i + s * (n - i);
}
async function lr() {
  await new Promise((e) => setImmediate(e));
}
function vl() {
  const e = he().prepare("SELECT id FROM businesses WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1").get(), t = (e == null ? void 0 : e.id) ?? null;
  return se.set("lastBusinessId", t), t;
}
function NE() {
  const e = F.join(Xe.getPath("documents"), "KaarobarBackups");
  return $.mkdirSync(e, { recursive: !0 }), e;
}
const oc = "kaarobar-latest.kaarobar-backup";
function IE(e, t) {
  for (const r of $.readdirSync(e, { withFileTypes: !0 }))
    r.isFile() && r.name.endsWith(".kaarobar-backup") && r.name !== t && $.unlinkSync(F.join(e, r.name));
}
function LE(e) {
  for (const t of ["-wal", "-shm"]) {
    const r = `${e}${t}`;
    $.existsSync(r) && $.unlinkSync(r);
  }
}
function AE() {
  he().pragma("wal_checkpoint(TRUNCATE)");
  const t = Gi();
  return js(), $.readFileSync(t);
}
function yl(e) {
  js();
  const t = Gi();
  $.mkdirSync(F.dirname(t), { recursive: !0 }), LE(t), $.writeFileSync(t, e);
  const r = We();
  lt(r);
}
function CE(e) {
  return e.length >= 4 && e.subarray(0, 4).equals(RE);
}
function wl(e) {
  return e.length >= 16 && e.subarray(0, 16).equals(SE);
}
function OE(e) {
  if (!$.existsSync(e)) return [];
  const t = [], r = (i) => {
    for (const n of $.readdirSync(i, { withFileTypes: !0 })) {
      const s = F.join(i, n.name);
      if (n.isDirectory()) {
        r(s);
        continue;
      }
      if (!n.isFile()) continue;
      const a = F.relative(e, s).split(F.sep).join("/");
      !a || a.includes("..") || t.push({ relativePosix: a, absolute: s });
    }
  };
  return r(e), t;
}
function kE(e) {
  if ($.existsSync(e))
    for (const t of $.readdirSync(e, { withFileTypes: !0 })) {
      const r = F.join(e, t.name);
      $.rmSync(r, { recursive: !0, force: !0 });
    }
}
function os(e) {
  if (e == null) return null;
  const t = e.trim();
  if (!t) return null;
  const r = t.replace(/\\/g, "/"), i = "/assets/", n = r.toLowerCase().lastIndexOf(i);
  if (n >= 0)
    return r.slice(n + i.length).replace(/^\/+/, "") || null;
  if (!F.isAbsolute(t) && !/^[a-zA-Z]:[\\/]/.test(t) && !r.startsWith("/"))
    return r.replace(/^\/+/, "");
  const s = r.match(/\/((?:logos|products)\/[^/]+)$/i);
  return s != null && s[1] ? s[1] : null;
}
function Sl() {
  const e = he(), t = e.prepare("SELECT id, image_path FROM products WHERE image_path IS NOT NULL AND image_path != ''").all(), r = e.prepare("UPDATE products SET image_path = ? WHERE id = ?");
  for (const o of t) {
    const c = os(o.image_path);
    c !== o.image_path && r.run(c, o.id);
  }
  const i = e.prepare("SELECT id, image_path FROM users WHERE image_path IS NOT NULL AND image_path != ''").all(), n = e.prepare("UPDATE users SET image_path = ? WHERE id = ?");
  for (const o of i) {
    const c = os(o.image_path);
    c !== o.image_path && n.run(c, o.id);
  }
  const s = e.prepare("SELECT id, logo_path FROM businesses WHERE logo_path IS NOT NULL AND logo_path != ''").all(), a = e.prepare("UPDATE businesses SET logo_path = ? WHERE id = ?");
  for (const o of s) {
    const c = os(o.logo_path);
    c !== o.logo_path && a.run(c, o.id);
  }
}
async function xE(e, t) {
  const r = new ml(), i = {
    formatVersion: wE,
    app: "kaarobar",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    includes: ["db", "files"]
  };
  r.file("manifest.json", JSON.stringify(i, null, 2)), r.file("db/kaarobar.sqlite", e);
  const n = qs(), s = OE(n), a = Math.max(s.length, 1);
  for (let c = 0; c < s.length; c++) {
    const u = s[c];
    r.file(`files/${u.relativePosix}`, $.readFileSync(u.absolute)), (c === 0 || c === s.length - 1 || c % 8 === 0) && (ie(t, "create", "packing_files", Os(c + 1, 0, a, 8, 50)), await lr());
  }
  s.length === 0 && ie(t, "create", "packing_files", 50), ie(t, "create", "compressing", 50);
  const o = await r.generateAsync(
    {
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    },
    (c) => {
      ie(t, "create", "compressing", Os(c.percent, 0, 100, 50, 75));
    }
  );
  return Buffer.from(o);
}
async function DE(e, t) {
  const r = qs(), i = `${r}.restore-tmp`;
  $.rmSync(i, { recursive: !0, force: !0 }), $.mkdirSync(i, { recursive: !0 });
  const n = Object.values(e.files).filter(
    (a) => !a.dir && (a.name.startsWith("files/") || a.name.startsWith("assets/"))
  ), s = Math.max(n.length, 1);
  for (let a = 0; a < n.length; a++) {
    const o = n[a], c = o.name.startsWith("files/") ? "files/" : "assets/", u = o.name.slice(c.length).replace(/^\/+/, "");
    if (!u || u.includes("..")) continue;
    const l = F.resolve(i, ...u.split("/")), p = F.resolve(i), d = p.endsWith(F.sep) ? p : p + F.sep;
    l !== p && !l.startsWith(d) || ($.mkdirSync(F.dirname(l), { recursive: !0 }), $.writeFileSync(l, Buffer.from(await o.async("nodebuffer"))), (a === 0 || a === n.length - 1 || a % 8 === 0) && (ie(t, "restore", "restoring_files", Os(a + 1, 0, s, 42, 88)), await lr()));
  }
  if (n.length === 0 && ie(t, "restore", "restoring_files", 88), $.mkdirSync(r, { recursive: !0 }), kE(r), $.existsSync(i))
    for (const a of $.readdirSync(i, { withFileTypes: !0 }))
      $.renameSync(F.join(i, a.name), F.join(r, a.name));
  $.rmSync(i, { recursive: !0, force: !0 });
}
async function UE(e, t) {
  ie(t, "restore", "extracting", 20);
  const r = await ml.loadAsync(e);
  ie(t, "restore", "extracting", 28);
  const i = r.file("db/kaarobar.sqlite") ?? r.file("kaarobar.sqlite") ?? Object.values(r.files).find((s) => !s.dir && s.name.endsWith(".sqlite"));
  if (!i || i.dir)
    throw new Error("Invalid backup archive: database file missing");
  ie(t, "restore", "installing_db", 30);
  const n = Buffer.from(await i.async("nodebuffer"));
  if (!wl(n))
    throw new Error("Invalid backup archive: database is not SQLite");
  yl(n), ie(t, "restore", "installing_db", 42), await DE(r, t), ie(t, "restore", "finalizing", 90), Sl(), ie(t, "restore", "finalizing", 98);
}
let Ft = !1;
function PE() {
  return Ft;
}
async function Rl(e) {
  if (Ft) throw new Error("A backup operation is already in progress");
  Ft = !0, We();
  try {
    ie(e, "create", "prepare_db", 2);
    const t = AE();
    ie(e, "create", "prepare_db", 8), await lr();
    const r = await xE(t, e);
    ie(e, "create", "encrypting", 76), await lr();
    const i = vE(r);
    ie(e, "create", "encrypting", 90), ie(e, "create", "writing", 92);
    const n = NE(), s = F.join(n, oc);
    return $.writeFileSync(s, i), IE(n, oc), We(), lt(he()), ie(e, "create", "writing", 100), { ok: !0, filePath: s };
  } catch (t) {
    throw We(), t;
  } finally {
    Ft = !1;
  }
}
async function BE(e) {
  return X("system:backup_create"), Rl(e);
}
async function Nl(e, t) {
  if (!e || !$.existsSync(e))
    throw new Error("Backup file not found");
  ie(t, "restore", "reading", 2);
  const r = $.readFileSync(e);
  ie(t, "restore", "reading", 6), await lr(), ie(t, "restore", "decrypting", 8);
  const i = yE(r);
  if (ie(t, "restore", "decrypting", 18), await lr(), CE(i)) {
    await UE(i, t);
    return;
  }
  if (!wl(i))
    throw new Error("Invalid backup file: decrypted data is not a Kaarobar backup");
  ie(t, "restore", "installing_db", 25), yl(i), ie(t, "restore", "finalizing", 85), Sl(), ie(t, "restore", "finalizing", 98);
}
async function FE(e, t) {
  if (X("system:backup_restore"), Ft) throw new Error("A backup operation is already in progress");
  Ft = !0;
  try {
    await Nl(e, t), ie(t, "restore", "finalizing", 99);
    const r = vl();
    return gl(), ie(t, "restore", "finalizing", 100), { ok: !0, businessId: r };
  } finally {
    Ft = !1;
  }
}
async function ME() {
  const e = await Ic.showOpenDialog({
    title: "Choose Kaarobar backup",
    properties: ["openFile"],
    filters: [
      { name: "Kaarobar backup", extensions: ["kaarobar-backup"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  return e.canceled || !e.filePaths[0] ? null : e.filePaths[0];
}
const $E = ["retail", "food", "salon", "services"];
function HE(e) {
  return typeof e == "string" && $E.includes(e);
}
function ri(e) {
  return HE(e) ? e : "retail";
}
function XE(e) {
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
function Il(e) {
  return e === "item";
}
function jt(e) {
  return e === "food";
}
function WE(e) {
  return e === "food";
}
function zE(e) {
  return e === "salon" || e === "services";
}
function Ll(e, t) {
  return XE(e).includes(t);
}
function ks() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function qE() {
  try {
    $.mkdirSync(Qe(), { recursive: !0 });
    const e = se.get("setupComplete"), t = Mt(se.get("language"));
    if (!e || !Vi())
      return { status: "needs_setup" };
    We(), lt(he()), Bi();
    const r = _r();
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
const cs = "#2d6df6";
function KE() {
  var e, t;
  try {
    if (!se.get("setupComplete") || !Vi()) return cs;
    We(), lt(he());
    const r = se.get("lastBusinessId");
    if (r) {
      const n = he().prepare("SELECT brand_color FROM businesses WHERE id = ?").get(r);
      if ((e = n == null ? void 0 : n.brand_color) != null && e.trim()) return n.brand_color.trim();
    }
    const i = he().prepare("SELECT brand_color FROM businesses ORDER BY created_at ASC LIMIT 1").get();
    return ((t = i == null ? void 0 : i.brand_color) == null ? void 0 : t.trim()) || cs;
  } catch {
    return cs;
  }
}
async function YE(e) {
  try {
    $.mkdirSync(Qe(), { recursive: !0 });
    let t = Fi();
    if (!t || t.licenseKey !== e.licenseKey.trim()) {
      const c = await Ji(e.licenseKey);
      if (!c.ok) return { ok: !1, error: c.error, message: c.message };
      t = Fi();
    }
    if (!t)
      return { ok: !1, error: "license_missing", message: "License activation could not be saved locally." };
    if (Vi() && se.get("setupComplete"))
      return { ok: !1, error: "already_setup", message: "Setup has already been completed on this device." };
    js();
    const r = We();
    lt(r), Bi();
    const i = ae(), n = ae(), s = ae(), a = ks(), o = cr.hashSync(e.owner.password, 12);
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
        n,
        i,
        e.business.name.trim(),
        e.business.currency.trim() || "PKR",
        e.business.brandColor,
        ri(e.business.businessNature),
        "Thank you for shopping with us",
        a,
        a
      ), r.prepare(
        `INSERT INTO branches (id, business_id, name, address, phone, is_main_branch, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, 1, ?)`
      ).run(
        s,
        n,
        e.branch.name.trim(),
        e.branch.address.trim() || null,
        e.branch.phone.trim() || null,
        a
      ), r.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        "",
        "language",
        Mt(e.language)
      ), r.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        n,
        "receipt_footer",
        "Thank you for shopping with us"
      ), r.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        n,
        "idle_lock_minutes",
        "10"
      );
    })(), Bi(), se.set("setupComplete", !0), se.set("language", Mt(e.language)), se.set("lastBusinessId", n), $.writeFileSync(F.join(Qe(), "setup.complete"), ks(), "utf8"), { ok: !0 };
  } catch (t) {
    return {
      ok: !1,
      error: "setup_failed",
      message: t instanceof Error ? t.message : "Setup failed"
    };
  }
}
async function jE(e, t) {
  try {
    if ($.mkdirSync(Qe(), { recursive: !0 }), Vi() && se.get("setupComplete"))
      return { ok: !1, error: "already_setup", message: "Setup has already been completed on this device." };
    let r = Fi();
    if (!r || r.licenseKey !== e.licenseKey.trim()) {
      const a = await Ji(e.licenseKey);
      if (!a.ok) return { ok: !1, error: a.error, message: a.message };
      r = Fi();
    }
    if (!r)
      return { ok: !1, error: "license_missing", message: "License activation could not be saved locally." };
    await Nl(e.filePath, t), t == null || t({ operation: "restore", phase: "finalizing", percent: 99 }), Bi();
    const n = he().prepare("SELECT value FROM settings WHERE key = 'language' ORDER BY business_id ASC LIMIT 1").get(), s = Mt(n == null ? void 0 : n.value);
    return vl(), se.set("setupComplete", !0), se.set("language", s), $.writeFileSync(F.join(Qe(), "setup.complete"), ks(), "utf8"), t == null || t({ operation: "restore", phase: "finalizing", percent: 100 }), { ok: !0 };
  } catch (r) {
    return {
      ok: !1,
      error: "setup_failed",
      message: r instanceof Error ? r.message : "Failed to restore from backup"
    };
  }
}
const cc = 7, GE = 3, Al = /* @__PURE__ */ new Map();
function VE(e) {
  const t = /* @__PURE__ */ new Date();
  return t.setUTCDate(t.getUTCDate() - (e - 1)), t.setUTCHours(0, 0, 0, 0), t.toISOString();
}
function Cl() {
  return We(), lt(he()), he();
}
function ZE() {
  return Cl().prepare("SELECT id FROM businesses WHERE is_active = 1").all().map((r) => r.id);
}
function Ol(e) {
  const t = Cl(), r = VE(cc), i = t.prepare(
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
  ).all(e, r, e), n = [];
  for (const s of i) {
    const a = s.qty_sold / cc;
    if (a <= 0) continue;
    const o = s.stock_qty / a;
    if (o > GE) continue;
    const c = Math.max(0, Math.ceil(a * 7 - s.stock_qty));
    n.push({
      productId: s.id,
      productName: s.name,
      stockQty: s.stock_qty,
      avgDailyQty: Number(a.toFixed(2)),
      daysLeft: Number(o.toFixed(1)),
      recommendedQty: c
    });
  }
  return n.sort((s, a) => s.daysLeft - a.daysLeft || s.stockQty - a.stockQty), Al.set(e, { atMs: Date.now(), alerts: n }), n;
}
function JE(e) {
  const t = Al.get(e);
  return t && Date.now() - t.atMs < 30 * 60 * 1e3 ? t.alerts : Ol(e);
}
const QE = 7;
let us = !1;
function em(e = /* @__PURE__ */ new Date()) {
  const t = e.getFullYear(), r = String(e.getMonth() + 1).padStart(2, "0"), i = String(e.getDate()).padStart(2, "0");
  return `${t}-${r}-${i}`;
}
function tm(e, t = /* @__PURE__ */ new Date()) {
  const r = new Date(e).getTime();
  return Number.isFinite(r) ? (r - t.getTime()) / (24 * 60 * 60 * 1e3) : Number.POSITIVE_INFINITY;
}
function rm(e = /* @__PURE__ */ new Date()) {
  const t = _r();
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
  const r = tm(t.record.expiresAt, e);
  return r > QE ? null : {
    kind: "expiring",
    expiresAt: t.record.expiresAt,
    issuedTo: t.record.issuedTo,
    daysLeft: Math.max(0, Math.ceil(r))
  };
}
function im() {
  const e = ZE(), t = [];
  for (const r of e)
    try {
      t.push(...Ol(r));
    } catch (i) {
      console.error("[daily-reminders] restock failed", r, i);
    }
  return t.sort((r, i) => r.daysLeft - i.daysLeft || r.stockQty - i.stockQty), t;
}
function nm(e) {
  for (const t of Yi.getAllWindows())
    t.isDestroyed() || t.webContents.send(A.REMINDERS_DAILY, e);
}
function sm(e = /* @__PURE__ */ new Date()) {
  const t = im(), r = rm(e), i = {
    date: em(e),
    at: e.toISOString(),
    restock: t,
    license: r
  };
  return nm(i), i;
}
function am() {
  if (us) return { ran: !1 };
  us = !0;
  try {
    return sm(), { ran: !0 };
  } catch (e) {
    return console.error("[daily-reminders] failed", e), { ran: !1 };
  } finally {
    us = !1;
  }
}
function Xi(e, t = 4) {
  const r = e.trim().split(/\s+/).map((i) => i.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean);
  return r.length === 0 ? "X" : r.length >= 2 ? r.map((n) => n[0] ?? "").join("").toUpperCase().slice(0, t) || "X" : r[0].toUpperCase().slice(0, Math.min(3, t)) || "X";
}
function om(e, t, r) {
  const i = Xi(e), n = Xi(t);
  return `KB-${i}-${n}-${r}`;
}
function cm(e, t) {
  return `KB-${Xi(e)}-${Xi(t)}-`;
}
function um(e, t) {
  if (!e.startsWith(t)) return null;
  const r = Number.parseInt(e.slice(t.length), 10);
  return Number.isFinite(r) && r > 0 ? r : null;
}
var It = {}, kl = function() {
  return typeof Promise == "function" && Promise.prototype && Promise.prototype.then;
}, ha = {}, Ce = {};
let pa;
const lm = [
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
  return lm[t];
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
  pa = t;
};
Ce.isKanjiModeEnabled = function() {
  return typeof pa < "u";
};
Ce.toSJIS = function(t) {
  return pa(t);
};
var fn = {};
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
  }, e.from = function(i, n) {
    if (e.isValid(i))
      return i;
    try {
      return t(i);
    } catch {
      return n;
    }
  };
})(fn);
function xl() {
  this.buffer = [], this.length = 0;
}
xl.prototype = {
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
var dm = xl;
function ii(e) {
  if (!e || e < 1)
    throw new Error("BitMatrix size must be defined and greater than 0");
  this.size = e, this.data = new Uint8Array(e * e), this.reservedBit = new Uint8Array(e * e);
}
ii.prototype.set = function(e, t, r, i) {
  const n = e * this.size + t;
  this.data[n] = r, i && (this.reservedBit[n] = !0);
};
ii.prototype.get = function(e, t) {
  return this.data[e * this.size + t];
};
ii.prototype.xor = function(e, t, r) {
  this.data[e * this.size + t] ^= r;
};
ii.prototype.isReserved = function(e, t) {
  return this.reservedBit[e * this.size + t];
};
var fm = ii, Dl = {};
(function(e) {
  const t = Ce.getSymbolSize;
  e.getRowColCoords = function(i) {
    if (i === 1) return [];
    const n = Math.floor(i / 7) + 2, s = t(i), a = s === 145 ? 26 : Math.ceil((s - 13) / (2 * n - 2)) * 2, o = [s - 7];
    for (let c = 1; c < n - 1; c++)
      o[c] = o[c - 1] - a;
    return o.push(6), o.reverse();
  }, e.getPositions = function(i) {
    const n = [], s = e.getRowColCoords(i), a = s.length;
    for (let o = 0; o < a; o++)
      for (let c = 0; c < a; c++)
        o === 0 && c === 0 || // top-left
        o === 0 && c === a - 1 || // bottom-left
        o === a - 1 && c === 0 || n.push([s[o], s[c]]);
    return n;
  };
})(Dl);
var Ul = {};
const hm = Ce.getSymbolSize, uc = 7;
Ul.getPositions = function(t) {
  const r = hm(t);
  return [
    // top-left
    [0, 0],
    // top-right
    [r - uc, 0],
    // bottom-left
    [0, r - uc]
  ];
};
var Pl = {};
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
  e.isValid = function(n) {
    return n != null && n !== "" && !isNaN(n) && n >= 0 && n <= 7;
  }, e.from = function(n) {
    return e.isValid(n) ? parseInt(n, 10) : void 0;
  }, e.getPenaltyN1 = function(n) {
    const s = n.size;
    let a = 0, o = 0, c = 0, u = null, l = null;
    for (let p = 0; p < s; p++) {
      o = c = 0, u = l = null;
      for (let d = 0; d < s; d++) {
        let f = n.get(p, d);
        f === u ? o++ : (o >= 5 && (a += t.N1 + (o - 5)), u = f, o = 1), f = n.get(d, p), f === l ? c++ : (c >= 5 && (a += t.N1 + (c - 5)), l = f, c = 1);
      }
      o >= 5 && (a += t.N1 + (o - 5)), c >= 5 && (a += t.N1 + (c - 5));
    }
    return a;
  }, e.getPenaltyN2 = function(n) {
    const s = n.size;
    let a = 0;
    for (let o = 0; o < s - 1; o++)
      for (let c = 0; c < s - 1; c++) {
        const u = n.get(o, c) + n.get(o, c + 1) + n.get(o + 1, c) + n.get(o + 1, c + 1);
        (u === 4 || u === 0) && a++;
      }
    return a * t.N2;
  }, e.getPenaltyN3 = function(n) {
    const s = n.size;
    let a = 0, o = 0, c = 0;
    for (let u = 0; u < s; u++) {
      o = c = 0;
      for (let l = 0; l < s; l++)
        o = o << 1 & 2047 | n.get(u, l), l >= 10 && (o === 1488 || o === 93) && a++, c = c << 1 & 2047 | n.get(l, u), l >= 10 && (c === 1488 || c === 93) && a++;
    }
    return a * t.N3;
  }, e.getPenaltyN4 = function(n) {
    let s = 0;
    const a = n.data.length;
    for (let c = 0; c < a; c++) s += n.data[c];
    return Math.abs(Math.ceil(s * 100 / a / 5) - 10) * t.N4;
  };
  function r(i, n, s) {
    switch (i) {
      case e.Patterns.PATTERN000:
        return (n + s) % 2 === 0;
      case e.Patterns.PATTERN001:
        return n % 2 === 0;
      case e.Patterns.PATTERN010:
        return s % 3 === 0;
      case e.Patterns.PATTERN011:
        return (n + s) % 3 === 0;
      case e.Patterns.PATTERN100:
        return (Math.floor(n / 2) + Math.floor(s / 3)) % 2 === 0;
      case e.Patterns.PATTERN101:
        return n * s % 2 + n * s % 3 === 0;
      case e.Patterns.PATTERN110:
        return (n * s % 2 + n * s % 3) % 2 === 0;
      case e.Patterns.PATTERN111:
        return (n * s % 3 + (n + s) % 2) % 2 === 0;
      default:
        throw new Error("bad maskPattern:" + i);
    }
  }
  e.applyMask = function(n, s) {
    const a = s.size;
    for (let o = 0; o < a; o++)
      for (let c = 0; c < a; c++)
        s.isReserved(c, o) || s.xor(c, o, r(n, c, o));
  }, e.getBestMask = function(n, s) {
    const a = Object.keys(e.Patterns).length;
    let o = 0, c = 1 / 0;
    for (let u = 0; u < a; u++) {
      s(u), e.applyMask(u, n);
      const l = e.getPenaltyN1(n) + e.getPenaltyN2(n) + e.getPenaltyN3(n) + e.getPenaltyN4(n);
      e.applyMask(u, n), l < c && (c = l, o = u);
    }
    return o;
  };
})(Pl);
var hn = {};
const wt = fn, Ni = [
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
], Ii = [
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
hn.getBlocksCount = function(t, r) {
  switch (r) {
    case wt.L:
      return Ni[(t - 1) * 4 + 0];
    case wt.M:
      return Ni[(t - 1) * 4 + 1];
    case wt.Q:
      return Ni[(t - 1) * 4 + 2];
    case wt.H:
      return Ni[(t - 1) * 4 + 3];
    default:
      return;
  }
};
hn.getTotalCodewordsCount = function(t, r) {
  switch (r) {
    case wt.L:
      return Ii[(t - 1) * 4 + 0];
    case wt.M:
      return Ii[(t - 1) * 4 + 1];
    case wt.Q:
      return Ii[(t - 1) * 4 + 2];
    case wt.H:
      return Ii[(t - 1) * 4 + 3];
    default:
      return;
  }
};
var Bl = {}, pn = {};
const Fr = new Uint8Array(512), Wi = new Uint8Array(256);
(function() {
  let t = 1;
  for (let r = 0; r < 255; r++)
    Fr[r] = t, Wi[t] = r, t <<= 1, t & 256 && (t ^= 285);
  for (let r = 255; r < 512; r++)
    Fr[r] = Fr[r - 255];
})();
pn.log = function(t) {
  if (t < 1) throw new Error("log(" + t + ")");
  return Wi[t];
};
pn.exp = function(t) {
  return Fr[t];
};
pn.mul = function(t, r) {
  return t === 0 || r === 0 ? 0 : Fr[Wi[t] + Wi[r]];
};
(function(e) {
  const t = pn;
  e.mul = function(i, n) {
    const s = new Uint8Array(i.length + n.length - 1);
    for (let a = 0; a < i.length; a++)
      for (let o = 0; o < n.length; o++)
        s[a + o] ^= t.mul(i[a], n[o]);
    return s;
  }, e.mod = function(i, n) {
    let s = new Uint8Array(i);
    for (; s.length - n.length >= 0; ) {
      const a = s[0];
      for (let c = 0; c < n.length; c++)
        s[c] ^= t.mul(n[c], a);
      let o = 0;
      for (; o < s.length && s[o] === 0; ) o++;
      s = s.slice(o);
    }
    return s;
  }, e.generateECPolynomial = function(i) {
    let n = new Uint8Array([1]);
    for (let s = 0; s < i; s++)
      n = e.mul(n, new Uint8Array([1, t.exp(s)]));
    return n;
  };
})(Bl);
const Fl = Bl;
function _a(e) {
  this.genPoly = void 0, this.degree = e, this.degree && this.initialize(this.degree);
}
_a.prototype.initialize = function(t) {
  this.degree = t, this.genPoly = Fl.generateECPolynomial(this.degree);
};
_a.prototype.encode = function(t) {
  if (!this.genPoly)
    throw new Error("Encoder not initialized");
  const r = new Uint8Array(t.length + this.degree);
  r.set(t);
  const i = Fl.mod(r, this.genPoly), n = this.degree - i.length;
  if (n > 0) {
    const s = new Uint8Array(this.degree);
    return s.set(i, n), s;
  }
  return i;
};
var pm = _a, Ml = {}, Lt = {}, Ea = {};
Ea.isValid = function(t) {
  return !isNaN(t) && t >= 1 && t <= 40;
};
var tt = {};
const $l = "[0-9]+", _m = "[A-Z $%*+\\-./:]+";
let zr = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
zr = zr.replace(/u/g, "\\u");
const Em = "(?:(?![A-Z0-9 $%*+\\-./:]|" + zr + `)(?:.|[\r
]))+`;
tt.KANJI = new RegExp(zr, "g");
tt.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
tt.BYTE = new RegExp(Em, "g");
tt.NUMERIC = new RegExp($l, "g");
tt.ALPHANUMERIC = new RegExp(_m, "g");
const mm = new RegExp("^" + zr + "$"), Tm = new RegExp("^" + $l + "$"), gm = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
tt.testKanji = function(t) {
  return mm.test(t);
};
tt.testNumeric = function(t) {
  return Tm.test(t);
};
tt.testAlphanumeric = function(t) {
  return gm.test(t);
};
(function(e) {
  const t = Ea, r = tt;
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
  }, e.getCharCountIndicator = function(s, a) {
    if (!s.ccBits) throw new Error("Invalid mode: " + s);
    if (!t.isValid(a))
      throw new Error("Invalid version: " + a);
    return a >= 1 && a < 10 ? s.ccBits[0] : a < 27 ? s.ccBits[1] : s.ccBits[2];
  }, e.getBestModeForData = function(s) {
    return r.testNumeric(s) ? e.NUMERIC : r.testAlphanumeric(s) ? e.ALPHANUMERIC : r.testKanji(s) ? e.KANJI : e.BYTE;
  }, e.toString = function(s) {
    if (s && s.id) return s.id;
    throw new Error("Invalid mode");
  }, e.isValid = function(s) {
    return s && s.bit && s.ccBits;
  };
  function i(n) {
    if (typeof n != "string")
      throw new Error("Param is not a string");
    switch (n.toLowerCase()) {
      case "numeric":
        return e.NUMERIC;
      case "alphanumeric":
        return e.ALPHANUMERIC;
      case "kanji":
        return e.KANJI;
      case "byte":
        return e.BYTE;
      default:
        throw new Error("Unknown mode: " + n);
    }
  }
  e.from = function(s, a) {
    if (e.isValid(s))
      return s;
    try {
      return i(s);
    } catch {
      return a;
    }
  };
})(Lt);
(function(e) {
  const t = Ce, r = hn, i = fn, n = Lt, s = Ea, a = 7973, o = t.getBCHDigit(a);
  function c(d, f, _) {
    for (let E = 1; E <= 40; E++)
      if (f <= e.getCapacity(E, _, d))
        return E;
  }
  function u(d, f) {
    return n.getCharCountIndicator(d, f) + 4;
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
      if (l(d, _) <= e.getCapacity(_, f, n.MIXED))
        return _;
  }
  e.from = function(f, _) {
    return s.isValid(f) ? parseInt(f, 10) : _;
  }, e.getCapacity = function(f, _, E) {
    if (!s.isValid(f))
      throw new Error("Invalid QR Code version");
    typeof E > "u" && (E = n.BYTE);
    const w = t.getSymbolTotalCodewords(f), h = r.getTotalCodewordsCount(f, _), m = (w - h) * 8;
    if (E === n.MIXED) return m;
    const b = m - u(E, f);
    switch (E) {
      case n.NUMERIC:
        return Math.floor(b / 10 * 3);
      case n.ALPHANUMERIC:
        return Math.floor(b / 11 * 2);
      case n.KANJI:
        return Math.floor(b / 13);
      case n.BYTE:
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
    if (!s.isValid(f) || f < 7)
      throw new Error("Invalid QR Code version");
    let _ = f << 12;
    for (; t.getBCHDigit(_) - o >= 0; )
      _ ^= a << t.getBCHDigit(_) - o;
    return f << 12 | _;
  };
})(Ml);
var Hl = {};
const xs = Ce, Xl = 1335, bm = 21522, lc = xs.getBCHDigit(Xl);
Hl.getEncodedBits = function(t, r) {
  const i = t.bit << 3 | r;
  let n = i << 10;
  for (; xs.getBCHDigit(n) - lc >= 0; )
    n ^= Xl << xs.getBCHDigit(n) - lc;
  return (i << 10 | n) ^ bm;
};
var Wl = {};
const vm = Lt;
function dr(e) {
  this.mode = vm.NUMERIC, this.data = e.toString();
}
dr.getBitsLength = function(t) {
  return 10 * Math.floor(t / 3) + (t % 3 ? t % 3 * 3 + 1 : 0);
};
dr.prototype.getLength = function() {
  return this.data.length;
};
dr.prototype.getBitsLength = function() {
  return dr.getBitsLength(this.data.length);
};
dr.prototype.write = function(t) {
  let r, i, n;
  for (r = 0; r + 3 <= this.data.length; r += 3)
    i = this.data.substr(r, 3), n = parseInt(i, 10), t.put(n, 10);
  const s = this.data.length - r;
  s > 0 && (i = this.data.substr(r), n = parseInt(i, 10), t.put(n, s * 3 + 1));
};
var ym = dr;
const wm = Lt, ls = [
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
function fr(e) {
  this.mode = wm.ALPHANUMERIC, this.data = e;
}
fr.getBitsLength = function(t) {
  return 11 * Math.floor(t / 2) + 6 * (t % 2);
};
fr.prototype.getLength = function() {
  return this.data.length;
};
fr.prototype.getBitsLength = function() {
  return fr.getBitsLength(this.data.length);
};
fr.prototype.write = function(t) {
  let r;
  for (r = 0; r + 2 <= this.data.length; r += 2) {
    let i = ls.indexOf(this.data[r]) * 45;
    i += ls.indexOf(this.data[r + 1]), t.put(i, 11);
  }
  this.data.length % 2 && t.put(ls.indexOf(this.data[r]), 6);
};
var Sm = fr;
const Rm = Lt;
function hr(e) {
  this.mode = Rm.BYTE, typeof e == "string" ? this.data = new TextEncoder().encode(e) : this.data = new Uint8Array(e);
}
hr.getBitsLength = function(t) {
  return t * 8;
};
hr.prototype.getLength = function() {
  return this.data.length;
};
hr.prototype.getBitsLength = function() {
  return hr.getBitsLength(this.data.length);
};
hr.prototype.write = function(e) {
  for (let t = 0, r = this.data.length; t < r; t++)
    e.put(this.data[t], 8);
};
var Nm = hr;
const Im = Lt, Lm = Ce;
function pr(e) {
  this.mode = Im.KANJI, this.data = e;
}
pr.getBitsLength = function(t) {
  return t * 13;
};
pr.prototype.getLength = function() {
  return this.data.length;
};
pr.prototype.getBitsLength = function() {
  return pr.getBitsLength(this.data.length);
};
pr.prototype.write = function(e) {
  let t;
  for (t = 0; t < this.data.length; t++) {
    let r = Lm.toSJIS(this.data[t]);
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
var Am = pr, zl = { exports: {} };
(function(e) {
  var t = {
    single_source_shortest_paths: function(r, i, n) {
      var s = {}, a = {};
      a[i] = 0;
      var o = t.PriorityQueue.make();
      o.push(i, 0);
      for (var c, u, l, p, d, f, _, E, w; !o.empty(); ) {
        c = o.pop(), u = c.value, p = c.cost, d = r[u] || {};
        for (l in d)
          d.hasOwnProperty(l) && (f = d[l], _ = p + f, E = a[l], w = typeof a[l] > "u", (w || E > _) && (a[l] = _, o.push(l, _), s[l] = u));
      }
      if (typeof n < "u" && typeof a[n] > "u") {
        var h = ["Could not find a path from ", i, " to ", n, "."].join("");
        throw new Error(h);
      }
      return s;
    },
    extract_shortest_path_from_predecessor_list: function(r, i) {
      for (var n = [], s = i; s; )
        n.push(s), r[s], s = r[s];
      return n.reverse(), n;
    },
    find_path: function(r, i, n) {
      var s = t.single_source_shortest_paths(r, i, n);
      return t.extract_shortest_path_from_predecessor_list(
        s,
        n
      );
    },
    /**
     * A very naive priority queue implementation.
     */
    PriorityQueue: {
      make: function(r) {
        var i = t.PriorityQueue, n = {}, s;
        r = r || {};
        for (s in i)
          i.hasOwnProperty(s) && (n[s] = i[s]);
        return n.queue = [], n.sorter = r.sorter || i.default_sorter, n;
      },
      default_sorter: function(r, i) {
        return r.cost - i.cost;
      },
      /**
       * Add a new item to the queue and ensure the highest priority element
       * is at the front of the queue.
       */
      push: function(r, i) {
        var n = { value: r, cost: i };
        this.queue.push(n), this.queue.sort(this.sorter);
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
})(zl);
var Cm = zl.exports;
(function(e) {
  const t = Lt, r = ym, i = Sm, n = Nm, s = Am, a = tt, o = Ce, c = Cm;
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
        return s.getBitsLength(h);
      case t.BYTE:
        return n.getBitsLength(h);
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
        return new s(h);
      case t.BYTE:
        return new n(h);
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
})(Wl);
const _n = Ce, ds = fn, Om = dm, km = fm, xm = Dl, Dm = Ul, Ds = Pl, Us = hn, Um = pm, zi = Ml, Pm = Hl, Bm = Lt, fs = Wl;
function Fm(e, t) {
  const r = e.size, i = Dm.getPositions(t);
  for (let n = 0; n < i.length; n++) {
    const s = i[n][0], a = i[n][1];
    for (let o = -1; o <= 7; o++)
      if (!(s + o <= -1 || r <= s + o))
        for (let c = -1; c <= 7; c++)
          a + c <= -1 || r <= a + c || (o >= 0 && o <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (o === 0 || o === 6) || o >= 2 && o <= 4 && c >= 2 && c <= 4 ? e.set(s + o, a + c, !0, !0) : e.set(s + o, a + c, !1, !0));
  }
}
function Mm(e) {
  const t = e.size;
  for (let r = 8; r < t - 8; r++) {
    const i = r % 2 === 0;
    e.set(r, 6, i, !0), e.set(6, r, i, !0);
  }
}
function $m(e, t) {
  const r = xm.getPositions(t);
  for (let i = 0; i < r.length; i++) {
    const n = r[i][0], s = r[i][1];
    for (let a = -2; a <= 2; a++)
      for (let o = -2; o <= 2; o++)
        a === -2 || a === 2 || o === -2 || o === 2 || a === 0 && o === 0 ? e.set(n + a, s + o, !0, !0) : e.set(n + a, s + o, !1, !0);
  }
}
function Hm(e, t) {
  const r = e.size, i = zi.getEncodedBits(t);
  let n, s, a;
  for (let o = 0; o < 18; o++)
    n = Math.floor(o / 3), s = o % 3 + r - 8 - 3, a = (i >> o & 1) === 1, e.set(n, s, a, !0), e.set(s, n, a, !0);
}
function hs(e, t, r) {
  const i = e.size, n = Pm.getEncodedBits(t, r);
  let s, a;
  for (s = 0; s < 15; s++)
    a = (n >> s & 1) === 1, s < 6 ? e.set(s, 8, a, !0) : s < 8 ? e.set(s + 1, 8, a, !0) : e.set(i - 15 + s, 8, a, !0), s < 8 ? e.set(8, i - s - 1, a, !0) : s < 9 ? e.set(8, 15 - s - 1 + 1, a, !0) : e.set(8, 15 - s - 1, a, !0);
  e.set(i - 8, 8, 1, !0);
}
function Xm(e, t) {
  const r = e.size;
  let i = -1, n = r - 1, s = 7, a = 0;
  for (let o = r - 1; o > 0; o -= 2)
    for (o === 6 && o--; ; ) {
      for (let c = 0; c < 2; c++)
        if (!e.isReserved(n, o - c)) {
          let u = !1;
          a < t.length && (u = (t[a] >>> s & 1) === 1), e.set(n, o - c, u), s--, s === -1 && (a++, s = 7);
        }
      if (n += i, n < 0 || r <= n) {
        n -= i, i = -i;
        break;
      }
    }
}
function Wm(e, t, r) {
  const i = new Om();
  r.forEach(function(c) {
    i.put(c.mode.bit, 4), i.put(c.getLength(), Bm.getCharCountIndicator(c.mode, e)), c.write(i);
  });
  const n = _n.getSymbolTotalCodewords(e), s = Us.getTotalCodewordsCount(e, t), a = (n - s) * 8;
  for (i.getLengthInBits() + 4 <= a && i.put(0, 4); i.getLengthInBits() % 8 !== 0; )
    i.putBit(0);
  const o = (a - i.getLengthInBits()) / 8;
  for (let c = 0; c < o; c++)
    i.put(c % 2 ? 17 : 236, 8);
  return zm(i, e, t);
}
function zm(e, t, r) {
  const i = _n.getSymbolTotalCodewords(t), n = Us.getTotalCodewordsCount(t, r), s = i - n, a = Us.getBlocksCount(t, r), o = i % a, c = a - o, u = Math.floor(i / a), l = Math.floor(s / a), p = l + 1, d = u - l, f = new Um(d);
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
function qm(e, t, r, i) {
  let n;
  if (Array.isArray(e))
    n = fs.fromArray(e);
  else if (typeof e == "string") {
    let u = t;
    if (!u) {
      const l = fs.rawSplit(e);
      u = zi.getBestVersionForData(l, r);
    }
    n = fs.fromString(e, u || 40);
  } else
    throw new Error("Invalid data");
  const s = zi.getBestVersionForData(n, r);
  if (!s)
    throw new Error("The amount of data is too big to be stored in a QR Code");
  if (!t)
    t = s;
  else if (t < s)
    throw new Error(
      `
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: ` + s + `.
`
    );
  const a = Wm(t, r, n), o = _n.getSymbolSize(t), c = new km(o);
  return Fm(c, t), Mm(c), $m(c, t), hs(c, r, 0), t >= 7 && Hm(c, t), Xm(c, a), isNaN(i) && (i = Ds.getBestMask(
    c,
    hs.bind(null, c, r)
  )), Ds.applyMask(i, c), hs(c, r, i), {
    modules: c,
    version: t,
    errorCorrectionLevel: r,
    maskPattern: i,
    segments: n
  };
}
ha.create = function(t, r) {
  if (typeof t > "u" || t === "")
    throw new Error("No input text");
  let i = ds.M, n, s;
  return typeof r < "u" && (i = ds.from(r.errorCorrectionLevel, ds.M), n = zi.from(r.version), s = Ds.from(r.maskPattern), r.toSJISFunc && _n.setToSJISFunction(r.toSJISFunc)), qm(t, n, i, s);
};
var ql = {}, Kl = {}, Yl = { exports: {} }, jl = { exports: {} };
let Km = ct, Gl = Kr, qe = jl.exports = function() {
  Gl.call(this), this._buffers = [], this._buffered = 0, this._reads = [], this._paused = !1, this._encoding = "utf8", this.writable = !0;
};
Km.inherits(qe, Gl);
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
    let n = this._buffers[r++], s = Math.min(n.length, e.length - t);
    n.copy(i, t, 0, s), t += s, s !== n.length && (this._buffers[--r] = n.slice(s));
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
var Vl = jl.exports, Zl = { exports: {} }, Jl = { exports: {} }, En = {};
let gt = [
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
En.getImagePasses = function(e, t) {
  let r = [], i = e % 8, n = t % 8, s = (e - i) / 8, a = (t - n) / 8;
  for (let o = 0; o < gt.length; o++) {
    let c = gt[o], u = s * c.x.length, l = a * c.y.length;
    for (let p = 0; p < c.x.length && c.x[p] < i; p++)
      u++;
    for (let p = 0; p < c.y.length && c.y[p] < n; p++)
      l++;
    u > 0 && l > 0 && r.push({ width: u, height: l, index: o });
  }
  return r;
};
En.getInterlaceIterator = function(e) {
  return function(t, r, i) {
    let n = t % gt[i].x.length, s = (t - n) / gt[i].x.length * 8 + gt[i].x[n], a = r % gt[i].y.length, o = (r - a) / gt[i].y.length * 8 + gt[i].y[a];
    return s * 4 + o * e * 4;
  };
};
var Ql = function(t, r, i) {
  let n = t + r - i, s = Math.abs(n - t), a = Math.abs(n - r), o = Math.abs(n - i);
  return s <= a && s <= o ? t : a <= o ? r : i;
};
let Ym = En, jm = Ql;
function dc(e, t, r) {
  let i = e * t;
  return r !== 8 && (i = Math.ceil(i / (8 / r))), i;
}
let Rr = Jl.exports = function(e, t) {
  let r = e.width, i = e.height, n = e.interlace, s = e.bpp, a = e.depth;
  if (this.read = t.read, this.write = t.write, this.complete = t.complete, this._imageIndex = 0, this._images = [], n) {
    let o = Ym.getImagePasses(r, i);
    for (let c = 0; c < o.length; c++)
      this._images.push({
        byteWidth: dc(o[c].width, s, a),
        height: o[c].height,
        lineIndex: 0
      });
  } else
    this._images.push({
      byteWidth: dc(r, s, a),
      height: i,
      lineIndex: 0
    });
  a === 8 ? this._xComparison = s : a === 16 ? this._xComparison = s * 2 : this._xComparison = 1;
};
Rr.prototype.start = function() {
  this.read(
    this._images[this._imageIndex].byteWidth + 1,
    this._reverseFilterLine.bind(this)
  );
};
Rr.prototype._unFilterType1 = function(e, t, r) {
  let i = this._xComparison, n = i - 1;
  for (let s = 0; s < r; s++) {
    let a = e[1 + s], o = s > n ? t[s - i] : 0;
    t[s] = a + o;
  }
};
Rr.prototype._unFilterType2 = function(e, t, r) {
  let i = this._lastLine;
  for (let n = 0; n < r; n++) {
    let s = e[1 + n], a = i ? i[n] : 0;
    t[n] = s + a;
  }
};
Rr.prototype._unFilterType3 = function(e, t, r) {
  let i = this._xComparison, n = i - 1, s = this._lastLine;
  for (let a = 0; a < r; a++) {
    let o = e[1 + a], c = s ? s[a] : 0, u = a > n ? t[a - i] : 0, l = Math.floor((u + c) / 2);
    t[a] = o + l;
  }
};
Rr.prototype._unFilterType4 = function(e, t, r) {
  let i = this._xComparison, n = i - 1, s = this._lastLine;
  for (let a = 0; a < r; a++) {
    let o = e[1 + a], c = s ? s[a] : 0, u = a > n ? t[a - i] : 0, l = a > n && s ? s[a - i] : 0, p = jm(u, c, l);
    t[a] = o + p;
  }
};
Rr.prototype._reverseFilterLine = function(e) {
  let t = e[0], r, i = this._images[this._imageIndex], n = i.byteWidth;
  if (t === 0)
    r = e.slice(1, n + 1);
  else
    switch (r = Buffer.alloc(n), t) {
      case 1:
        this._unFilterType1(e, r, n);
        break;
      case 2:
        this._unFilterType2(e, r, n);
        break;
      case 3:
        this._unFilterType3(e, r, n);
        break;
      case 4:
        this._unFilterType4(e, r, n);
        break;
      default:
        throw new Error("Unrecognised filter type - " + t);
    }
  this.write(r), i.lineIndex++, i.lineIndex >= i.height ? (this._lastLine = null, this._imageIndex++, i = this._images[this._imageIndex]) : this._lastLine = r, i ? this.read(i.byteWidth + 1, this._reverseFilterLine.bind(this)) : (this._lastLine = null, this.complete());
};
var ed = Jl.exports;
let Gm = ct, td = Vl, Vm = ed, Zm = Zl.exports = function(e) {
  td.call(this);
  let t = [], r = this;
  this._filter = new Vm(e, {
    read: this.read.bind(this),
    write: function(i) {
      t.push(i);
    },
    complete: function() {
      r.emit("complete", Buffer.concat(t));
    }
  }), this._filter.start();
};
Gm.inherits(Zm, td);
var Jm = Zl.exports, rd = { exports: {} }, ni = {
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
}, id = { exports: {} };
let ma = [];
(function() {
  for (let e = 0; e < 256; e++) {
    let t = e;
    for (let r = 0; r < 8; r++)
      t & 1 ? t = 3988292384 ^ t >>> 1 : t = t >>> 1;
    ma[e] = t;
  }
})();
let Ta = id.exports = function() {
  this._crc = -1;
};
Ta.prototype.write = function(e) {
  for (let t = 0; t < e.length; t++)
    this._crc = ma[(this._crc ^ e[t]) & 255] ^ this._crc >>> 8;
  return !0;
};
Ta.prototype.crc32 = function() {
  return this._crc ^ -1;
};
Ta.crc32 = function(e) {
  let t = -1;
  for (let r = 0; r < e.length; r++)
    t = ma[(t ^ e[r]) & 255] ^ t >>> 8;
  return t ^ -1;
};
var nd = id.exports;
let _e = ni, Qm = nd, Te = rd.exports = function(e, t) {
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
  for (let s = 4; s < 8; s++)
    i += String.fromCharCode(e[s]);
  let n = !!(e[4] & 32);
  if (!this._hasIHDR && r !== _e.TYPE_IHDR) {
    this.error(new Error("Expected IHDR on beggining"));
    return;
  }
  if (this._crc = new Qm(), this._crc.write(Buffer.from(i)), this._chunks[r])
    return this._chunks[r](t);
  if (!n) {
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
  let t = e.readUInt32BE(0), r = e.readUInt32BE(4), i = e[8], n = e[9], s = e[10], a = e[11], o = e[12];
  if (i !== 8 && i !== 4 && i !== 2 && i !== 1 && i !== 16) {
    this.error(new Error("Unsupported bit depth " + i));
    return;
  }
  if (!(n in _e.COLORTYPE_TO_BPP_MAP)) {
    this.error(new Error("Unsupported color type"));
    return;
  }
  if (s !== 0) {
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
  this._colorType = n;
  let c = _e.COLORTYPE_TO_BPP_MAP[this._colorType];
  this._hasIHDR = !0, this.metadata({
    width: t,
    height: r,
    depth: i,
    interlace: !!o,
    palette: !!(n & _e.COLORTYPE_PALETTE),
    color: !!(n & _e.COLORTYPE_COLOR),
    alpha: !!(n & _e.COLORTYPE_ALPHA),
    bpp: c,
    colorType: n
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
var sd = rd.exports, ga = {};
let fc = En, eT = [
  // 0 - dummy entry
  function() {
  },
  // 1 - L
  // 0: 0, 1: 0, 2: 0, 3: 0xff
  function(e, t, r, i) {
    if (i === t.length)
      throw new Error("Ran out of data");
    let n = t[i];
    e[r] = n, e[r + 1] = n, e[r + 2] = n, e[r + 3] = 255;
  },
  // 2 - LA
  // 0: 0, 1: 0, 2: 0, 3: 1
  function(e, t, r, i) {
    if (i + 1 >= t.length)
      throw new Error("Ran out of data");
    let n = t[i];
    e[r] = n, e[r + 1] = n, e[r + 2] = n, e[r + 3] = t[i + 1];
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
], tT = [
  // 0 - dummy entry
  function() {
  },
  // 1 - L
  // 0: 0, 1: 0, 2: 0, 3: 0xff
  function(e, t, r, i) {
    let n = t[0];
    e[r] = n, e[r + 1] = n, e[r + 2] = n, e[r + 3] = i;
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
function rT(e, t) {
  let r = [], i = 0;
  function n() {
    if (i === e.length)
      throw new Error("Ran out of data");
    let s = e[i];
    i++;
    let a, o, c, u, l, p, d, f;
    switch (t) {
      default:
        throw new Error("unrecognised depth");
      case 16:
        d = e[i], i++, r.push((s << 8) + d);
        break;
      case 4:
        d = s & 15, f = s >> 4, r.push(f, d);
        break;
      case 2:
        l = s & 3, p = s >> 2 & 3, d = s >> 4 & 3, f = s >> 6 & 3, r.push(f, d, p, l);
        break;
      case 1:
        a = s & 1, o = s >> 1 & 1, c = s >> 2 & 1, u = s >> 3 & 1, l = s >> 4 & 1, p = s >> 5 & 1, d = s >> 6 & 1, f = s >> 7 & 1, r.push(f, d, p, l, u, c, o, a);
        break;
    }
  }
  return {
    get: function(s) {
      for (; r.length < s; )
        n();
      let a = r.slice(0, s);
      return r = r.slice(s), a;
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
function iT(e, t, r, i, n, s) {
  let a = e.width, o = e.height, c = e.index;
  for (let u = 0; u < o; u++)
    for (let l = 0; l < a; l++) {
      let p = r(l, u, c);
      eT[i](t, n, p, s), s += i;
    }
  return s;
}
function nT(e, t, r, i, n, s) {
  let a = e.width, o = e.height, c = e.index;
  for (let u = 0; u < o; u++) {
    for (let l = 0; l < a; l++) {
      let p = n.get(i), d = r(l, u, c);
      tT[i](t, p, d, s);
    }
    n.resetAfterLine();
  }
}
ga.dataToBitMap = function(e, t) {
  let r = t.width, i = t.height, n = t.depth, s = t.bpp, a = t.interlace, o;
  n !== 8 && (o = rT(e, n));
  let c;
  n <= 8 ? c = Buffer.alloc(r * i * 4) : c = new Uint16Array(r * i * 4);
  let u = Math.pow(2, n) - 1, l = 0, p, d;
  if (a)
    p = fc.getImagePasses(r, i), d = fc.getInterlaceIterator(r, i);
  else {
    let f = 0;
    d = function() {
      let _ = f;
      return f += 4, _;
    }, p = [{ width: r, height: i }];
  }
  for (let f = 0; f < p.length; f++)
    n === 8 ? l = iT(
      p[f],
      c,
      d,
      s,
      e,
      l
    ) : nT(
      p[f],
      c,
      d,
      s,
      o,
      u
    );
  if (n === 8) {
    if (l !== e.length)
      throw new Error("extra data found");
  } else
    o.end();
  return c;
};
function sT(e, t, r, i, n) {
  let s = 0;
  for (let a = 0; a < i; a++)
    for (let o = 0; o < r; o++) {
      let c = n[e[s]];
      if (!c)
        throw new Error("index " + e[s] + " not in palette");
      for (let u = 0; u < 4; u++)
        t[s + u] = c[u];
      s += 4;
    }
}
function aT(e, t, r, i, n) {
  let s = 0;
  for (let a = 0; a < i; a++)
    for (let o = 0; o < r; o++) {
      let c = !1;
      if (n.length === 1 ? n[0] === e[s] && (c = !0) : n[0] === e[s] && n[1] === e[s + 1] && n[2] === e[s + 2] && (c = !0), c)
        for (let u = 0; u < 4; u++)
          t[s + u] = 0;
      s += 4;
    }
}
function oT(e, t, r, i, n) {
  let s = 255, a = Math.pow(2, n) - 1, o = 0;
  for (let c = 0; c < i; c++)
    for (let u = 0; u < r; u++) {
      for (let l = 0; l < 4; l++)
        t[o + l] = Math.floor(
          e[o + l] * s / a + 0.5
        );
      o += 4;
    }
}
var ad = function(e, t) {
  let r = t.depth, i = t.width, n = t.height, s = t.colorType, a = t.transColor, o = t.palette, c = e;
  return s === 3 ? sT(e, c, i, n, o) : (a && aT(e, c, i, n, a), r !== 8 && (r === 16 && (c = Buffer.alloc(i * n * 4)), oT(e, c, i, n, r))), c;
};
let cT = ct, ps = Yr, od = Vl, uT = Jm, lT = sd, dT = ga, fT = ad, rt = Yl.exports = function(e) {
  od.call(this), this._parser = new lT(e, {
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
cT.inherits(rt, od);
rt.prototype._handleError = function(e) {
  this.emit("error", e), this.writable = !1, this.destroy(), this._inflate && this._inflate.destroy && this._inflate.destroy(), this._filter && (this._filter.destroy(), this._filter.on("error", function() {
  })), this.errord = !0;
};
rt.prototype._inflateData = function(e) {
  if (!this._inflate)
    if (this._bitmapInfo.interlace)
      this._inflate = ps.createInflate(), this._inflate.on("error", this.emit.bind(this, "error")), this._filter.on("complete", this._complete.bind(this)), this._inflate.pipe(this._filter);
    else {
      let r = ((this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1) * this._bitmapInfo.height, i = Math.max(r, ps.Z_MIN_CHUNK);
      this._inflate = ps.createInflate({ chunkSize: i });
      let n = r, s = this.emit.bind(this, "error");
      this._inflate.on("error", function(o) {
        n && s(o);
      }), this._filter.on("complete", this._complete.bind(this));
      let a = this._filter.write.bind(this._filter);
      this._inflate.on("data", function(o) {
        n && (o.length > n && (o = o.slice(0, n)), n -= o.length, a(o));
      }), this._inflate.on("end", this._filter.end.bind(this._filter));
    }
  this._inflate.write(e);
};
rt.prototype._handleMetaData = function(e) {
  this._metaData = e, this._bitmapInfo = Object.create(e), this._filter = new uT(this._bitmapInfo);
};
rt.prototype._handleTransColor = function(e) {
  this._bitmapInfo.transColor = e;
};
rt.prototype._handlePalette = function(e) {
  this._bitmapInfo.palette = e;
};
rt.prototype._simpleTransparency = function() {
  this._metaData.alpha = !0;
};
rt.prototype._headersFinished = function() {
  this.emit("metadata", this._metaData);
};
rt.prototype._finished = function() {
  this.errord || (this._inflate ? this._inflate.end() : this.emit("error", "No Inflate block"));
};
rt.prototype._complete = function(e) {
  if (this.errord)
    return;
  let t;
  try {
    let r = dT.dataToBitMap(e, this._bitmapInfo);
    t = fT(r, this._bitmapInfo), r = null;
  } catch (r) {
    this._handleError(r);
    return;
  }
  this.emit("parsed", t);
};
var hT = Yl.exports, cd = { exports: {} }, ud = { exports: {} };
let Oe = ni;
var pT = function(e, t, r, i) {
  let n = [Oe.COLORTYPE_COLOR_ALPHA, Oe.COLORTYPE_ALPHA].indexOf(
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
  let s = i.bitDepth !== 16 ? e : new Uint16Array(e.buffer), a = 255, o = Oe.COLORTYPE_TO_BPP_MAP[i.inputColorType];
  o === 4 && !i.inputHasAlpha && (o = 3);
  let c = Oe.COLORTYPE_TO_BPP_MAP[i.colorType];
  i.bitDepth === 16 && (a = 65535, c *= 2);
  let u = Buffer.alloc(t * r * c), l = 0, p = 0, d = i.bgColor || {};
  d.red === void 0 && (d.red = a), d.green === void 0 && (d.green = a), d.blue === void 0 && (d.blue = a);
  function f() {
    let _, E, w, h = a;
    switch (i.inputColorType) {
      case Oe.COLORTYPE_COLOR_ALPHA:
        h = s[l + 3], _ = s[l], E = s[l + 1], w = s[l + 2];
        break;
      case Oe.COLORTYPE_COLOR:
        _ = s[l], E = s[l + 1], w = s[l + 2];
        break;
      case Oe.COLORTYPE_ALPHA:
        h = s[l + 1], _ = s[l], E = _, w = _;
        break;
      case Oe.COLORTYPE_GRAYSCALE:
        _ = s[l], E = _, w = _;
        break;
      default:
        throw new Error(
          "input color type:" + i.inputColorType + " is not supported at present"
        );
    }
    return i.inputHasAlpha && (n || (h /= a, _ = Math.min(
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
          i.bitDepth === 8 ? (u[p] = w.red, u[p + 1] = w.green, u[p + 2] = w.blue, n && (u[p + 3] = w.alpha)) : (u.writeUInt16BE(w.red, p), u.writeUInt16BE(w.green, p + 2), u.writeUInt16BE(w.blue, p + 4), n && u.writeUInt16BE(w.alpha, p + 6));
          break;
        case Oe.COLORTYPE_ALPHA:
        case Oe.COLORTYPE_GRAYSCALE: {
          let h = (w.red + w.green + w.blue) / 3;
          i.bitDepth === 8 ? (u[p] = h, n && (u[p + 1] = w.alpha)) : (u.writeUInt16BE(h, p), n && u.writeUInt16BE(w.alpha, p + 2));
          break;
        }
        default:
          throw new Error("unrecognised color Type " + i.colorType);
      }
      l += o, p += c;
    }
  return u;
};
let ld = Ql;
function _T(e, t, r, i, n) {
  for (let s = 0; s < r; s++)
    i[n + s] = e[t + s];
}
function ET(e, t, r) {
  let i = 0, n = t + r;
  for (let s = t; s < n; s++)
    i += Math.abs(e[s]);
  return i;
}
function mT(e, t, r, i, n, s) {
  for (let a = 0; a < r; a++) {
    let o = a >= s ? e[t + a - s] : 0, c = e[t + a] - o;
    i[n + a] = c;
  }
}
function TT(e, t, r, i) {
  let n = 0;
  for (let s = 0; s < r; s++) {
    let a = s >= i ? e[t + s - i] : 0, o = e[t + s] - a;
    n += Math.abs(o);
  }
  return n;
}
function gT(e, t, r, i, n) {
  for (let s = 0; s < r; s++) {
    let a = t > 0 ? e[t + s - r] : 0, o = e[t + s] - a;
    i[n + s] = o;
  }
}
function bT(e, t, r) {
  let i = 0, n = t + r;
  for (let s = t; s < n; s++) {
    let a = t > 0 ? e[s - r] : 0, o = e[s] - a;
    i += Math.abs(o);
  }
  return i;
}
function vT(e, t, r, i, n, s) {
  for (let a = 0; a < r; a++) {
    let o = a >= s ? e[t + a - s] : 0, c = t > 0 ? e[t + a - r] : 0, u = e[t + a] - (o + c >> 1);
    i[n + a] = u;
  }
}
function yT(e, t, r, i) {
  let n = 0;
  for (let s = 0; s < r; s++) {
    let a = s >= i ? e[t + s - i] : 0, o = t > 0 ? e[t + s - r] : 0, c = e[t + s] - (a + o >> 1);
    n += Math.abs(c);
  }
  return n;
}
function wT(e, t, r, i, n, s) {
  for (let a = 0; a < r; a++) {
    let o = a >= s ? e[t + a - s] : 0, c = t > 0 ? e[t + a - r] : 0, u = t > 0 && a >= s ? e[t + a - (r + s)] : 0, l = e[t + a] - ld(o, c, u);
    i[n + a] = l;
  }
}
function ST(e, t, r, i) {
  let n = 0;
  for (let s = 0; s < r; s++) {
    let a = s >= i ? e[t + s - i] : 0, o = t > 0 ? e[t + s - r] : 0, c = t > 0 && s >= i ? e[t + s - (r + i)] : 0, u = e[t + s] - ld(a, o, c);
    n += Math.abs(u);
  }
  return n;
}
let RT = {
  0: _T,
  1: mT,
  2: gT,
  3: vT,
  4: wT
}, NT = {
  0: ET,
  1: TT,
  2: bT,
  3: yT,
  4: ST
};
var IT = function(e, t, r, i, n) {
  let s;
  if (!("filterType" in i) || i.filterType === -1)
    s = [0, 1, 2, 3, 4];
  else if (typeof i.filterType == "number")
    s = [i.filterType];
  else
    throw new Error("unrecognised filter types");
  i.bitDepth === 16 && (n *= 2);
  let a = t * n, o = 0, c = 0, u = Buffer.alloc((a + 1) * r), l = s[0];
  for (let p = 0; p < r; p++) {
    if (s.length > 1) {
      let d = 1 / 0;
      for (let f = 0; f < s.length; f++) {
        let _ = NT[s[f]](e, c, a, n);
        _ < d && (l = s[f], d = _);
      }
    }
    u[o] = l, o++, RT[l](e, c, a, u, o, n), o += a, c += a;
  }
  return u;
};
let Se = ni, LT = nd, AT = pT, CT = IT, OT = Yr, At = ud.exports = function(e) {
  if (this._options = e, e.deflateChunkSize = e.deflateChunkSize || 32 * 1024, e.deflateLevel = e.deflateLevel != null ? e.deflateLevel : 9, e.deflateStrategy = e.deflateStrategy != null ? e.deflateStrategy : 3, e.inputHasAlpha = e.inputHasAlpha != null ? e.inputHasAlpha : !0, e.deflateFactory = e.deflateFactory || OT.createDeflate, e.bitDepth = e.bitDepth || 8, e.colorType = typeof e.colorType == "number" ? e.colorType : Se.COLORTYPE_COLOR_ALPHA, e.inputColorType = typeof e.inputColorType == "number" ? e.inputColorType : Se.COLORTYPE_COLOR_ALPHA, [
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
At.prototype.getDeflateOptions = function() {
  return {
    chunkSize: this._options.deflateChunkSize,
    level: this._options.deflateLevel,
    strategy: this._options.deflateStrategy
  };
};
At.prototype.createDeflate = function() {
  return this._options.deflateFactory(this.getDeflateOptions());
};
At.prototype.filterData = function(e, t, r) {
  let i = AT(e, t, r, this._options), n = Se.COLORTYPE_TO_BPP_MAP[this._options.colorType];
  return CT(i, t, r, this._options, n);
};
At.prototype._packChunk = function(e, t) {
  let r = t ? t.length : 0, i = Buffer.alloc(r + 12);
  return i.writeUInt32BE(r, 0), i.writeUInt32BE(e, 4), t && t.copy(i, 8), i.writeInt32BE(
    LT.crc32(i.slice(4, i.length - 4)),
    i.length - 4
  ), i;
};
At.prototype.packGAMA = function(e) {
  let t = Buffer.alloc(4);
  return t.writeUInt32BE(Math.floor(e * Se.GAMMA_DIVISION), 0), this._packChunk(Se.TYPE_gAMA, t);
};
At.prototype.packIHDR = function(e, t) {
  let r = Buffer.alloc(13);
  return r.writeUInt32BE(e, 0), r.writeUInt32BE(t, 4), r[8] = this._options.bitDepth, r[9] = this._options.colorType, r[10] = 0, r[11] = 0, r[12] = 0, this._packChunk(Se.TYPE_IHDR, r);
};
At.prototype.packIDAT = function(e) {
  return this._packChunk(Se.TYPE_IDAT, e);
};
At.prototype.packIEND = function() {
  return this._packChunk(Se.TYPE_IEND, null);
};
var dd = ud.exports;
let kT = ct, fd = Kr, xT = ni, DT = dd, hd = cd.exports = function(e) {
  fd.call(this);
  let t = e || {};
  this._packer = new DT(t), this._deflate = this._packer.createDeflate(), this.readable = !0;
};
kT.inherits(hd, fd);
hd.prototype.pack = function(e, t, r, i) {
  this.emit("data", Buffer.from(xT.PNG_SIGNATURE)), this.emit("data", this._packer.packIHDR(t, r)), i && this.emit("data", this._packer.packGAMA(i));
  let n = this._packer.filterData(e, t, r);
  this._deflate.on("error", this.emit.bind(this, "error")), this._deflate.on(
    "data",
    (function(s) {
      this.emit("data", this._packer.packIDAT(s));
    }).bind(this)
  ), this._deflate.on(
    "end",
    (function() {
      this.emit("data", this._packer.packIEND()), this.emit("end");
    }).bind(this)
  ), this._deflate.end(n);
};
var UT = cd.exports, ba = {}, Ps = { exports: {} };
(function(e, t) {
  let r = Yd.ok, i = Yr, n = ct, s = Bc.kMaxLength;
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
    if (v >= s)
      throw c(this), new RangeError(
        "Cannot create final Buffer. It would be larger than 0x" + s.toString(16) + " bytes"
      );
    let O = Buffer.concat(b, v);
    return c(this), O;
  }, n.inherits(a, i.Inflate);
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
})(Ps, Ps.exports);
var PT = Ps.exports, pd = { exports: {} };
let _d = pd.exports = function(e) {
  this._buffer = e, this._reads = [];
};
_d.prototype.read = function(e, t) {
  this._reads.push({
    length: Math.abs(e),
    // if length < 0 then at most this length
    allowLess: e < 0,
    func: t
  });
};
_d.prototype.process = function() {
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
var Ed = pd.exports, md = {};
let BT = Ed, FT = ed;
md.process = function(e, t) {
  let r = [], i = new BT(e);
  return new FT(t, {
    read: i.read.bind(i),
    write: function(s) {
      r.push(s);
    },
    complete: function() {
    }
  }).start(), i.process(), Buffer.concat(r);
};
let Td = !0, gd = Yr, MT = PT;
gd.deflateSync || (Td = !1);
let $T = Ed, HT = md, XT = sd, WT = ga, zT = ad;
var qT = function(e, t) {
  if (!Td)
    throw new Error(
      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
    );
  let r;
  function i(v) {
    r = v;
  }
  let n;
  function s(v) {
    n = v;
  }
  function a(v) {
    n.transColor = v;
  }
  function o(v) {
    n.palette = v;
  }
  function c() {
    n.alpha = !0;
  }
  let u;
  function l(v) {
    u = v;
  }
  let p = [];
  function d(v) {
    p.push(v);
  }
  let f = new $T(e);
  if (new XT(t, {
    read: f.read.bind(f),
    error: i,
    metadata: s,
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
  if (n.interlace)
    w = gd.inflateSync(E);
  else {
    let S = ((n.width * n.bpp * n.depth + 7 >> 3) + 1) * n.height;
    w = MT(E, {
      chunkSize: S,
      maxLength: S
    });
  }
  if (E = null, !w || !w.length)
    throw new Error("bad png - invalid inflate data response");
  let h = HT.process(w, n);
  E = null;
  let m = WT.dataToBitMap(h, n);
  h = null;
  let b = zT(m, n);
  return n.data = b, n.gamma = u || 0, n;
};
let bd = !0, vd = Yr;
vd.deflateSync || (bd = !1);
let KT = ni, YT = dd;
var jT = function(e, t) {
  if (!bd)
    throw new Error(
      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
    );
  let r = t || {}, i = new YT(r), n = [];
  n.push(Buffer.from(KT.PNG_SIGNATURE)), n.push(i.packIHDR(e.width, e.height)), e.gamma && n.push(i.packGAMA(e.gamma));
  let s = i.filterData(
    e.data,
    e.width,
    e.height
  ), a = vd.deflateSync(
    s,
    i.getDeflateOptions()
  );
  if (s = null, !a || !a.length)
    throw new Error("bad png - invalid compressed data response");
  return n.push(i.packIDAT(a)), n.push(i.packIEND()), Buffer.concat(n);
};
let GT = qT, VT = jT;
ba.read = function(e, t) {
  return GT(e, t || {});
};
ba.write = function(e, t) {
  return VT(e, t);
};
let ZT = ct, yd = Kr, JT = hT, QT = UT, eg = ba, Ne = Kl.PNG = function(e) {
  yd.call(this), e = e || {}, this.width = e.width | 0, this.height = e.height | 0, this.data = this.width > 0 && this.height > 0 ? Buffer.alloc(4 * this.width * this.height) : null, e.fill && this.data && this.data.fill(0), this.gamma = 0, this.readable = this.writable = !0, this._parser = new JT(e), this._parser.on("error", this.emit.bind(this, "error")), this._parser.on("close", this._handleClose.bind(this)), this._parser.on("metadata", this._metadata.bind(this)), this._parser.on("gamma", this._gamma.bind(this)), this._parser.on(
    "parsed",
    (function(t) {
      this.data = t, this.emit("parsed", t);
    }).bind(this)
  ), this._packer = new QT(e), this._packer.on("data", this.emit.bind(this, "data")), this._packer.on("end", this.emit.bind(this, "end")), this._parser.on("close", this._handleClose.bind(this)), this._packer.on("error", this.emit.bind(this, "error"));
};
ZT.inherits(Ne, yd);
Ne.sync = eg;
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
    r = (function(n) {
      this.removeListener("error", i), this.data = n, t(null, this);
    }).bind(this), i = (function(n) {
      this.removeListener("parsed", r), t(n, null);
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
Ne.bitblt = function(e, t, r, i, n, s, a, o) {
  if (r |= 0, i |= 0, n |= 0, s |= 0, a |= 0, o |= 0, r > e.width || i > e.height || r + n > e.width || i + s > e.height)
    throw new Error("bitblt reading outside image");
  if (a > t.width || o > t.height || a + n > t.width || o + s > t.height)
    throw new Error("bitblt writing outside image");
  for (let c = 0; c < s; c++)
    e.data.copy(
      t.data,
      (o + c) * t.width + a << 2,
      (i + c) * e.width + r << 2,
      (i + c) * e.width + r + n << 2
    );
};
Ne.prototype.bitblt = function(e, t, r, i, n, s, a) {
  return Ne.bitblt(this, e, t, r, i, n, s, a), this;
};
Ne.adjustGamma = function(e) {
  if (e.gamma) {
    for (let t = 0; t < e.height; t++)
      for (let r = 0; r < e.width; r++) {
        let i = e.width * t + r << 2;
        for (let n = 0; n < 3; n++) {
          let s = e.data[i + n] / 255;
          s = Math.pow(s, 1 / 2.2 / e.gamma), e.data[i + n] = Math.round(s * 255);
        }
      }
    e.gamma = 0;
  }
};
Ne.prototype.adjustGamma = function() {
  Ne.adjustGamma(this);
};
var si = {};
(function(e) {
  function t(r) {
    if (typeof r == "number" && (r = r.toString()), typeof r != "string")
      throw new Error("Color should be defined as hex string");
    let i = r.slice().replace("#", "").split("");
    if (i.length < 3 || i.length === 5 || i.length > 8)
      throw new Error("Invalid hex color: " + r);
    (i.length === 3 || i.length === 4) && (i = Array.prototype.concat.apply([], i.map(function(s) {
      return [s, s];
    }))), i.length === 6 && i.push("F", "F");
    const n = parseInt(i.join(""), 16);
    return {
      r: n >> 24 & 255,
      g: n >> 16 & 255,
      b: n >> 8 & 255,
      a: n & 255,
      hex: "#" + i.slice(0, 6).join("")
    };
  }
  e.getOptions = function(i) {
    i || (i = {}), i.color || (i.color = {});
    const n = typeof i.margin > "u" || i.margin === null || i.margin < 0 ? 4 : i.margin, s = i.width && i.width >= 21 ? i.width : void 0, a = i.scale || 4;
    return {
      width: s,
      scale: s ? 4 : a,
      margin: n,
      color: {
        dark: t(i.color.dark || "#000000ff"),
        light: t(i.color.light || "#ffffffff")
      },
      type: i.type,
      rendererOpts: i.rendererOpts || {}
    };
  }, e.getScale = function(i, n) {
    return n.width && n.width >= i + n.margin * 2 ? n.width / (i + n.margin * 2) : n.scale;
  }, e.getImageWidth = function(i, n) {
    const s = e.getScale(i, n);
    return Math.floor((i + n.margin * 2) * s);
  }, e.qrToImageData = function(i, n, s) {
    const a = n.modules.size, o = n.modules.data, c = e.getScale(a, s), u = Math.floor((a + s.margin * 2) * c), l = s.margin * c, p = [s.color.light, s.color.dark];
    for (let d = 0; d < u; d++)
      for (let f = 0; f < u; f++) {
        let _ = (d * u + f) * 4, E = s.color.light;
        if (d >= l && f >= l && d < u - l && f < u - l) {
          const w = Math.floor((d - l) / c), h = Math.floor((f - l) / c);
          E = p[o[w * a + h] ? 1 : 0];
        }
        i[_++] = E.r, i[_++] = E.g, i[_++] = E.b, i[_] = E.a;
      }
  };
})(si);
(function(e) {
  const t = ji, r = Kl.PNG, i = si;
  e.render = function(s, a) {
    const o = i.getOptions(a), c = o.rendererOpts, u = i.getImageWidth(s.modules.size, o);
    c.width = u, c.height = u;
    const l = new r(c);
    return i.qrToImageData(l.data, s, o), l;
  }, e.renderToDataURL = function(s, a, o) {
    typeof o > "u" && (o = a, a = void 0), e.renderToBuffer(s, a, function(c, u) {
      c && o(c);
      let l = "data:image/png;base64,";
      l += u.toString("base64"), o(null, l);
    });
  }, e.renderToBuffer = function(s, a, o) {
    typeof o > "u" && (o = a, a = void 0);
    const c = e.render(s, a), u = [];
    c.on("error", o), c.on("data", function(l) {
      u.push(l);
    }), c.on("end", function() {
      o(null, Buffer.concat(u));
    }), c.pack();
  }, e.renderToFile = function(s, a, o, c) {
    typeof c > "u" && (c = o, o = void 0);
    let u = !1;
    const l = (...d) => {
      u || (u = !0, c.apply(null, d));
    }, p = t.createWriteStream(s);
    p.on("error", l), p.on("close", l), e.renderToFileStream(p, a, o);
  }, e.renderToFileStream = function(s, a, o) {
    e.render(a, o).pack().pipe(s);
  };
})(ql);
var wd = {};
(function(e) {
  const t = si, r = {
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
  function n(s, a, o) {
    return s && a ? o.BB : s && !a ? o.BW : !s && a ? o.WB : o.WW;
  }
  e.render = function(s, a, o) {
    const c = t.getOptions(a);
    let u = r;
    (c.color.dark.hex === "#ffffff" || c.color.light.hex === "#000000") && (u = i);
    const l = s.modules.size, p = s.modules.data;
    let d = "", f = Array(l + c.margin * 2 + 1).join(u.WW);
    f = Array(c.margin / 2 + 1).join(f + `
`);
    const _ = Array(c.margin + 1).join(u.WW);
    d += f;
    for (let E = 0; E < l; E += 2) {
      d += _;
      for (let w = 0; w < l; w++) {
        const h = p[E * l + w], m = p[(E + 1) * l + w];
        d += n(h, m, u);
      }
      d += _ + `
`;
    }
    return d += f.slice(0, -1), typeof o == "function" && o(null, d), d;
  }, e.renderToFile = function(a, o, c, u) {
    typeof u > "u" && (u = c, c = void 0);
    const l = ji, p = e.render(o, c);
    l.writeFile(a, p, u);
  };
})(wd);
var Sd = {}, Rd = {};
Rd.render = function(e, t, r) {
  const i = e.modules.size, n = e.modules.data, s = "\x1B[40m  \x1B[0m", a = "\x1B[47m  \x1B[0m";
  let o = "";
  const c = Array(i + 3).join(a), u = Array(2).join(a);
  o += c + `
`;
  for (let l = 0; l < i; ++l) {
    o += a;
    for (let p = 0; p < i; p++)
      o += n[l * i + p] ? s : a;
    o += u + `
`;
  }
  return o += c + `
`, typeof r == "function" && r(null, o), o;
};
var Nd = {};
const tg = "\x1B[47m", rg = "\x1B[40m", Bs = "\x1B[37m", Fs = "\x1B[30m", xt = "\x1B[0m", ig = tg + Fs, ng = rg + Bs, sg = function(e, t, r) {
  return {
    // 1 ... white, 2 ... black, 0 ... transparent (default)
    "00": xt + " " + e,
    "01": xt + t + "▄" + e,
    "02": xt + r + "▄" + e,
    10: xt + t + "▀" + e,
    11: " ",
    12: "▄",
    20: xt + r + "▀" + e,
    21: "▀",
    22: "█"
  };
}, hc = function(e, t, r, i) {
  const n = t + 1;
  if (r >= n || i >= n || i < -1 || r < -1) return "0";
  if (r >= t || i >= t || i < 0 || r < 0) return "1";
  const s = i * t + r;
  return e[s] ? "2" : "1";
}, pc = function(e, t, r, i) {
  return hc(e, t, r, i) + hc(e, t, r, i + 1);
};
Nd.render = function(e, t, r) {
  const i = e.modules.size, n = e.modules.data, s = !!(t && t.inverse), a = t && t.inverse ? ng : ig, u = sg(a, s ? Fs : Bs, s ? Bs : Fs), l = xt + `
` + a;
  let p = a;
  for (let d = -1; d < i + 1; d += 2) {
    for (let f = -1; f < i; f++)
      p += u[pc(n, i, f, d)];
    p += u[pc(n, i, i, d)] + l;
  }
  return p += xt, typeof r == "function" && r(null, p), p;
};
const ag = Rd, og = Nd;
Sd.render = function(e, t, r) {
  return t && t.small ? og.render(e, t, r) : ag.render(e, t, r);
};
var Id = {}, va = {};
const cg = si;
function _c(e, t) {
  const r = e.a / 255, i = t + '="' + e.hex + '"';
  return r < 1 ? i + " " + t + '-opacity="' + r.toFixed(2).slice(1) + '"' : i;
}
function _s(e, t, r) {
  let i = e + t;
  return typeof r < "u" && (i += " " + r), i;
}
function ug(e, t, r) {
  let i = "", n = 0, s = !1, a = 0;
  for (let o = 0; o < e.length; o++) {
    const c = Math.floor(o % t), u = Math.floor(o / t);
    !c && !s && (s = !0), e[o] ? (a++, o > 0 && c > 0 && e[o - 1] || (i += s ? _s("M", c + r, 0.5 + u + r) : _s("m", n, 0), n = 0, s = !1), c + 1 < t && e[o + 1] || (i += _s("h", a), a = 0)) : n++;
  }
  return i;
}
va.render = function(t, r, i) {
  const n = cg.getOptions(r), s = t.modules.size, a = t.modules.data, o = s + n.margin * 2, c = n.color.light.a ? "<path " + _c(n.color.light, "fill") + ' d="M0 0h' + o + "v" + o + 'H0z"/>' : "", u = "<path " + _c(n.color.dark, "stroke") + ' d="' + ug(a, s, n.margin) + '"/>', l = 'viewBox="0 0 ' + o + " " + o + '"', d = '<svg xmlns="http://www.w3.org/2000/svg" ' + (n.width ? 'width="' + n.width + '" height="' + n.width + '" ' : "") + l + ' shape-rendering="crispEdges">' + c + u + `</svg>
`;
  return typeof i == "function" && i(null, d), d;
};
(function(e) {
  const t = va;
  e.render = t.render, e.renderToFile = function(i, n, s, a) {
    typeof a > "u" && (a = s, s = void 0);
    const o = ji, u = '<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + e.render(n, s);
    o.writeFile(i, u, a);
  };
})(Id);
var Qt = {}, Es = {}, Ec;
function lg() {
  return Ec || (Ec = 1, function(e) {
    const t = si;
    function r(n, s, a) {
      n.clearRect(0, 0, s.width, s.height), s.style || (s.style = {}), s.height = a, s.width = a, s.style.height = a + "px", s.style.width = a + "px";
    }
    function i() {
      try {
        return document.createElement("canvas");
      } catch {
        throw new Error("You need to specify a canvas element");
      }
    }
    e.render = function(s, a, o) {
      let c = o, u = a;
      typeof c > "u" && (!a || !a.getContext) && (c = a, a = void 0), a || (u = i()), c = t.getOptions(c);
      const l = t.getImageWidth(s.modules.size, c), p = u.getContext("2d"), d = p.createImageData(l, l);
      return t.qrToImageData(d.data, s, c), r(p, u, l), p.putImageData(d, 0, 0), u;
    }, e.renderToDataURL = function(s, a, o) {
      let c = o;
      typeof c > "u" && (!a || !a.getContext) && (c = a, a = void 0), c || (c = {});
      const u = e.render(s, a, c), l = c.type || "image/png", p = c.rendererOpts || {};
      return u.toDataURL(l, p.quality);
    };
  }(Es)), Es;
}
var mc;
function dg() {
  if (mc) return Qt;
  mc = 1;
  const e = kl, t = ha, r = lg(), i = va;
  function n(s, a, o, c, u) {
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
          f(s(E, a, c));
        } catch (E) {
          _(E);
        }
      });
    }
    try {
      const f = t.create(o, c);
      u(null, s(f, a, c));
    } catch (f) {
      u(f);
    }
  }
  return Qt.create = t.create, Qt.toCanvas = n.bind(null, r.render), Qt.toDataURL = n.bind(null, r.renderToDataURL), Qt.toString = n.bind(null, function(s, a, o) {
    return i.render(s, o);
  }), Qt;
}
const Ld = kl, Ms = ha, fg = ql, Ad = wd, hg = Sd, Cd = Id;
function ai(e, t, r) {
  if (typeof e > "u")
    throw new Error("String required as first argument");
  if (typeof r > "u" && (r = t, t = {}), typeof r != "function")
    if (Ld())
      t = r || {}, r = null;
    else
      throw new Error("Callback required as last argument");
  return {
    opts: t,
    cb: r
  };
}
function pg(e) {
  return e.slice((e.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
}
function mn(e) {
  switch (e) {
    case "svg":
      return Cd;
    case "txt":
    case "utf8":
      return Ad;
    case "png":
    case "image/png":
    default:
      return fg;
  }
}
function _g(e) {
  switch (e) {
    case "svg":
      return Cd;
    case "terminal":
      return hg;
    case "utf8":
    default:
      return Ad;
  }
}
function oi(e, t, r) {
  if (!r.cb)
    return new Promise(function(i, n) {
      try {
        const s = Ms.create(t, r.opts);
        return e(s, r.opts, function(a, o) {
          return a ? n(a) : i(o);
        });
      } catch (s) {
        n(s);
      }
    });
  try {
    const i = Ms.create(t, r.opts);
    return e(i, r.opts, r.cb);
  } catch (i) {
    r.cb(i);
  }
}
It.create = Ms.create;
It.toCanvas = dg().toCanvas;
It.toString = function(t, r, i) {
  const n = ai(t, r, i), s = n.opts ? n.opts.type : void 0, a = _g(s);
  return oi(a.render, t, n);
};
It.toDataURL = function(t, r, i) {
  const n = ai(t, r, i), s = mn(n.opts.type);
  return oi(s.renderToDataURL, t, n);
};
It.toBuffer = function(t, r, i) {
  const n = ai(t, r, i), s = mn(n.opts.type);
  return oi(s.renderToBuffer, t, n);
};
It.toFile = function(t, r, i, n) {
  if (typeof t != "string" || !(typeof r == "string" || typeof r == "object"))
    throw new Error("Invalid argument");
  if (arguments.length < 3 && !Ld())
    throw new Error("Too few arguments provided");
  const s = ai(r, i, n), a = s.opts.type || pg(t), c = mn(a).renderToFile.bind(null, t);
  return oi(c, r, s);
};
It.toFileStream = function(t, r, i) {
  if (arguments.length < 2)
    throw new Error("Too few arguments provided");
  const n = ai(r, i, t.emit.bind(t, "error")), a = mn("png").renderToFileStream.bind(null, t);
  oi(a, r, n);
};
var Eg = It;
const mg = /* @__PURE__ */ zs(Eg);
function Od() {
  return qs();
}
function Tg(e) {
  const t = F.join(Od(), e === "logo" ? "logos" : "products");
  return $.mkdirSync(t, { recursive: !0 }), t;
}
function Tn(e) {
  const t = e.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!t || t.includes(".."))
    throw new Error("Invalid asset path");
  const r = F.resolve(Od()), i = F.resolve(r, t), n = r.endsWith(F.sep) ? r : r + F.sep;
  if (i !== r && !i.startsWith(n))
    throw new Error("Invalid asset path");
  return i;
}
function gg(e) {
  return e ? `kaarobar-asset:///${e.replace(/\\/g, "/").replace(/^\/+/, "")}` : null;
}
function bg(e) {
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
function vg(e) {
  try {
    const t = new URL(e), r = decodeURIComponent(
      t.hostname ? `${t.hostname}${t.pathname}` : t.pathname
    ).replace(/^\/+/, ""), i = Tn(r);
    if (!$.existsSync(i))
      return new Response("Not found", { status: 404 });
    const n = $.readFileSync(i);
    return new Response(n, {
      status: 200,
      headers: {
        "Content-Type": bg(i),
        "Content-Length": String(n.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
async function yg(e) {
  X(e === "logo" ? "business:edit" : "products:edit");
  const t = await Ic.showOpenDialog({
    title: e === "logo" ? "Choose business logo" : "Choose product image",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
  });
  if (t.canceled || !t.filePaths[0]) return null;
  const r = t.filePaths[0], i = F.extname(r).toLowerCase() || ".png", n = `${xc()}${i}`, s = e === "logo" ? "logos" : "products", a = Tg(e), o = F.join(a, n);
  $.copyFileSync(r, o);
  const c = `${s}/${n}`;
  return { relativePath: c, url: gg(c) };
}
const wg = {
  whatsapp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.99.52 3.93 1.51 5.64L2 22l4.6-1.51a9.86 9.86 0 0 0 5.44 1.52h.01c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.79 14.06c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.93-4.36-.14-.19-1.17-1.56-1.17-2.97 0-1.41.74-2.1 1-2.39.26-.29.57-.36.76-.36h.55c.18 0 .42-.07.65.5.24.58.82 2 .89 2.14.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.56.16.28.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.61-.13.25.09 1.6.75 1.87.89.27.14.45.21.52.33.07.12.07.69-.17 1.37z"/></svg>',
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zm5.25-3.75a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/></svg>',
  facebook: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z"/></svg>',
  tiktok: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M14.5 3c.4 1.7 1.5 3.2 3.1 4.1V9c-1.2-.05-2.3-.4-3.3-1v6.3A5.3 5.3 0 1 1 9 9.1v2.2a3.1 3.1 0 1 0 2.2 3V3h3.3z"/></svg>',
  website: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.9 9h-3.2a15 15 0 0 0-1.3-5 8.1 8.1 0 0 1 4.5 5zM12 4c.9 1.3 1.7 3.2 2.1 5H9.9C10.3 7.2 11.1 5.3 12 4zM4.1 13h3.2a15 15 0 0 0 1.3 5 8.1 8.1 0 0 1-4.5-5zm3.2-2H4.1a8.1 8.1 0 0 1 4.5-5 15 15 0 0 0-1.3 5zm2.6 0h4.2c-.4 1.9-1.2 3.8-2.1 5-.9-1.2-1.7-3.1-2.1-5zm4.2 2H9.9c.4 1.8 1.2 3.7 2.1 5 .9-1.3 1.7-3.2 2.1-5zm.7 5a15 15 0 0 0 1.3-5h3.2a8.1 8.1 0 0 1-4.5 5z"/></svg>'
};
function Sg(e) {
  const t = wg[e];
  return `data:image/svg+xml;base64,${Buffer.from(t).toString("base64")}`;
}
const Tc = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  website: "Web"
}, Rg = "Kaarobar", Ng = "#2d6df6", Ig = /^#([0-9a-fA-F]{6})$/;
function gn(e) {
  const t = (e ?? "").trim();
  return Ig.test(t) ? t.toLowerCase() : Ng;
}
function ya(e) {
  const t = gn(e), r = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="128" height="128" role="img" aria-label="${Rg}">
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
function it() {
  return Mt(se.get("language"));
}
const fe = {
  en: "Powered by Kaarobar POS · 2ndHub Solutions",
  ur: "کاروبار POS · 2ndHub Solutions سے تقویت یافتہ",
  de: "Bereitgestellt von Kaarobar POS · 2ndHub Solutions",
  pt: "Desenvolvido por Kaarobar POS · 2ndHub Solutions",
  es: "Desarrollado por Kaarobar POS · 2ndHub Solutions",
  fr: "Propulsé par Kaarobar POS · 2ndHub Solutions",
  ar: "مدعوم من Kaarobar POS · 2ndHub Solutions"
}, Lg = {
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
}, Ag = {
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
}, Cg = {
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
function Og(e = it()) {
  return Lg[e];
}
function kg(e = it()) {
  return Ag[e];
}
function xg(e = it()) {
  return Cg[e];
}
const Dg = {
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
function Ug(e = it()) {
  return Dg[e];
}
function wa(e = it()) {
  const t = qf(e);
  return {
    lang: e,
    dir: t ? "rtl" : "ltr",
    fontFamily: t ? "'Noto Sans Arabic', 'Noto Naskh Arabic', ui-sans-serif, sans-serif" : "'Poppins', ui-sans-serif, sans-serif",
    fontLink: t ? "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap" : "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
  };
}
function $s(e, t = it()) {
  try {
    return new Date(e).toLocaleString(Kf(t));
  } catch {
    return e;
  }
}
const Pg = {
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
function Sa(e) {
  const t = (e || "PKR").trim().toUpperCase();
  return Pg[t] ?? t;
}
function te(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function er() {
  return '<div class="stars">********************************</div>';
}
function Bg(e) {
  try {
    const t = $.readFileSync(e), r = F.extname(e).toLowerCase().replace(".", "") || "png";
    return `data:${r === "jpg" || r === "jpeg" ? "image/jpeg" : r === "webp" ? "image/webp" : r === "gif" ? "image/gif" : r === "svg" ? "image/svg+xml" : "image/png"};base64,${t.toString("base64")}`;
  } catch {
    return null;
  }
}
async function Fg(e, t) {
  const r = [
    { platform: "whatsapp", url: e.socialWhatsapp || "" },
    { platform: "instagram", url: e.socialInstagram || "" },
    { platform: "facebook", url: e.socialFacebook || "" },
    { platform: "tiktok", url: e.socialTiktok || "" },
    { platform: "website", url: e.socialWebsite || "" }
  ].filter((n) => n.url.trim());
  if (r.length === 0) return "";
  const i = [];
  for (const n of r) {
    const s = await mg.toDataURL(n.url.trim(), {
      margin: 1,
      width: 72,
      color: { dark: "#000000", light: "#ffffff" }
    });
    i.push(`
      <div class="social-item">
        <img class="social-icon" src="${Sg(n.platform)}" alt="" />
        <img class="social-qr" src="${s}" alt="${Tc[n.platform]}" />
        <div class="social-label">${Tc[n.platform]}</div>
      </div>
    `);
  }
  return `
    ${er()}
    <div class="social-title">${te(t)}</div>
    <div class="social-row">${i.join("")}</div>
  `;
}
async function Mg(e) {
  var S, L;
  const t = e.language ?? it(), r = Og(t), i = wa(t), n = Sa(e.currency), s = e.payments.some((I) => I.method === "credit"), a = e.payments.some((I) => I.method === "cash"), o = e.payments.some((I) => I.method === "card"), c = s && !a ? r.creditReceipt : o && !a && !s ? r.cardReceipt : r.cashReceipt, u = (I) => I === "card" ? r.card : I === "cash" ? r.cash : I === "credit" ? r.credit : I;
  let l = "";
  if (e.logoPath)
    try {
      const I = Bg(Tn(e.logoPath));
      I && (l = `<img class="logo" src="${I}" alt="" />`);
    } catch {
      l = "";
    }
  const p = [
    e.branchAddress ? te(e.branchAddress) : "",
    e.branchPhone ? `${te(r.tel)}: ${te(e.branchPhone)}` : ""
  ].filter(Boolean), d = e.items.map(
    (I) => `
      <tr>
        <td class="desc">${te(I.productName)} × ${I.qty}</td>
        <td class="price">${n} ${I.lineTotal.toFixed(2)}</td>
      </tr>`
  ).join(""), f = e.payments.map(
    (I) => `<div class="row"><span>${te(u(I.method))}</span><span>${n} ${I.amount.toFixed(2)}</span></div>`
  ).join(""), _ = Math.max(0, e.amountPaid - e.total), E = await Fg(e, r.followUs), w = gn(e.brandColor), h = ya(w), m = JSON.stringify(e.invoiceNo), b = e.jsBarcodeScript, v = $s(e.createdAt, t);
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
      <p class="shop">${te(e.businessName)}</p>
      ${p.map((I) => `<p class="muted">${I}</p>`).join("")}
      ${(S = e.receiptHeader) != null && S.trim() ? `<p class="muted" style="margin-top:6px;white-space:pre-wrap">${te(e.receiptHeader.trim())}</p>` : ""}
    </div>
    ${er()}
    <div class="center title">${te(c)}</div>
    ${er()}
    <div class="row"><span>${te(r.invoice)}</span><span>${te(e.invoiceNo)}</span></div>
    <div class="row"><span>${te(r.date)}</span><span>${te(v)}</span></div>
    ${e.customerName ? `<div class="row"><span>${te(r.customer)}</span><span>${te(e.customerName)}</span></div>` : ""}
    ${e.cashierName ? `<div class="row"><span>${te(r.cashier)}</span><span>${te(e.cashierName)}</span></div>` : ""}
    ${e.printedByName ? `<div class="row"><span>${te(r.printedBy)}</span><span>${te(e.printedByName)}</span></div>` : ""}
    ${er()}
    <table>
      <thead>
        <tr>
          <th class="desc">${te(r.description)}</th>
          <th class="price">${te(r.price)}</th>
        </tr>
      </thead>
      <tbody>${d}</tbody>
    </table>
    ${er()}
    ${e.discount > 0 ? `<div class="row"><span>${te(r.subtotal)}</span><span>${n} ${e.subtotal.toFixed(2)}</span></div>
    <div class="row"><span>${te(r.discount)}</span><span>- ${n} ${e.discount.toFixed(2)}</span></div>` : ""}
    <div class="row total"><span>${te(r.total)}</span><span>${n} ${e.total.toFixed(2)}</span></div>
    ${f}
    ${_ > 0 ? `<div class="row"><span>${te(r.change)}</span><span>${n} ${_.toFixed(2)}</span></div>` : ""}
    ${E}
    ${er()}
    <div class="center thanks" style="white-space:pre-wrap">${te(
    ((L = e.receiptFooter) == null ? void 0 : L.trim()) || r.thankYou
  )}</div>
    <div class="center support-line">${te(r.customSoftwareSupport)}</div>
    <svg id="barcode"></svg>
    <div class="center brand">
      <img src="${h}" alt="Kaarobar" />
      <div class="brand-name">Kaarobar</div>
      <div class="brand-tag">${te(r.poweredBy)}</div>
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
function $g(e) {
  try {
    const t = $.readFileSync(e), r = F.extname(e).toLowerCase().replace(".", "") || "png";
    return `data:${r === "jpg" || r === "jpeg" ? "image/jpeg" : r === "webp" ? "image/webp" : r === "svg" ? "image/svg+xml" : "image/png"};base64,${t.toString("base64")}`;
  } catch {
    return null;
  }
}
function Hg(e) {
  const t = e.language ?? it(), r = kg(t), i = wa(t), n = Sa(e.currency), s = gn(e.brandColor);
  let a = "";
  if (e.logoPath)
    try {
      const u = $g(Tn(e.logoPath));
      u && (a = `<img class="logo" src="${u}" alt="" />`);
    } catch {
      a = "";
    }
  const o = e.items.map(
    (u) => `
      <tr>
        <td>${ue(u.productName)}</td>
        <td class="num">${u.orderedQty}</td>
        <td class="num">${n} ${u.unitCost.toFixed(2)}</td>
        <td class="num">${n} ${u.lineTotal.toFixed(2)}</td>
      </tr>`
  ).join(""), c = ya(s);
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
    .brand-name { font-size: 11px; font-weight: 700; color: ${s}; }
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
  <div class="total"><span>${ue(r.total)}</span><span>${n} ${e.total.toFixed(2)}</span></div>
  <div class="brand">
    <img src="${c}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
    <div class="brand-tag">${ue(r.poweredBy)}</div>
  </div>
</body>
</html>`;
}
function ee(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function Xg(e) {
  try {
    const t = $.readFileSync(e), r = F.extname(e).toLowerCase().replace(".", "") || "png";
    return `data:${r === "jpg" || r === "jpeg" ? "image/jpeg" : r === "webp" ? "image/webp" : r === "svg" ? "image/svg+xml" : "image/png"};base64,${t.toString("base64")}`;
  } catch {
    return null;
  }
}
function kt(e, t) {
  return `${e} ${t.toFixed(2)}`;
}
function Wg(e) {
  var r;
  if (!e) return "";
  const t = e.match(/^method:(cash|card)(?:\s*\|\s*(.*))?$/i);
  return t ? ((r = t[2]) == null ? void 0 : r.trim()) || "" : e.trim();
}
function zg(e, t) {
  const i = [e.type === "sale" ? t.sale : e.type === "payment" ? t.payment : e.type === "adjustment" ? t.adjustment : t.opening];
  e.invoiceNo && i.push(e.invoiceNo), e.method === "cash" && i.push(t.cash), e.method === "card" && i.push(t.card);
  const n = Wg(e.note);
  return n && i.push(n), i.join(" · ");
}
function qg(e) {
  const t = e.language ?? it(), r = xg(t), i = wa(t), n = Sa(e.currency), s = gn(e.brandColor);
  let a = "";
  if (e.logoPath)
    try {
      const _ = Xg(Tn(e.logoPath));
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
        <td>${ee($s(_.createdAt, t))}</td>
        <td>${ee(zg(_, r))}</td>
        <td class="num">${E ? ee(kt(n, E)) : ""}</td>
        <td class="num">${w ? ee(kt(n, w)) : ""}</td>
        <td class="num">${ee(kt(n, _.balanceAfter))}</td>
      </tr>`;
  }).join(""), p = e.entries.length > 0 ? e.entries[e.entries.length - 1].balanceAfter : e.openingBalance, d = ya(s), f = !!(e.from || e.to) || e.openingBalance !== 0;
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
    .brand-name { font-size: 11px; font-weight: 700; color: ${s}; }
    .brand-tag { font-size: 9px; color: #555; }
  </style>
</head>
<body>
  <div class="center">
    ${a}
    <h1>${ee(e.businessName)}</h1>
  </div>
  <h2 class="center">${ee(r.title)}</h2>
  <div class="meta">
    <div><span>${ee(r.customer)}</span><span>${ee(e.customerName)}</span></div>
    ${e.customerPhone ? `<div><span>${ee(r.phone)}</span><span>${ee(e.customerPhone)}</span></div>` : ""}
    <div><span>${ee(r.period)}</span><span>${ee(o)}</span></div>
    <div><span>${ee(r.printedAt)}</span><span>${ee($s((/* @__PURE__ */ new Date()).toISOString(), t))}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${ee(r.date)}</th>
        <th>${ee(r.particulars)}</th>
        <th class="num">${ee(r.debit)}</th>
        <th class="num">${ee(r.credit)}</th>
        <th class="num">${ee(r.balance)}</th>
      </tr>
    </thead>
    <tbody>
      ${f ? `<tr class="opening">
        <td></td>
        <td>${ee(r.balanceBroughtForward)}</td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num">${ee(kt(n, e.openingBalance))}</td>
      </tr>` : ""}
      ${l}
      <tr class="totals">
        <td colspan="2">${ee(r.totals)}</td>
        <td class="num">${ee(kt(n, c))}</td>
        <td class="num">${ee(kt(n, u))}</td>
        <td class="num"></td>
      </tr>
    </tbody>
  </table>
  <div class="closing">
    <span>${ee(r.closingBalance)}</span>
    <span>${ee(kt(n, p))}</span>
  </div>
  <div class="brand">
    <img src="${d}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
    <div class="brand-tag">${ee(r.poweredBy)}</div>
  </div>
</body>
</html>`;
}
function Li(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function Kg(e, t) {
  const r = F.join(Qe(), "preview");
  $.mkdirSync(r, { recursive: !0 });
  const i = F.join(r, `${e}-${Date.now()}.html`);
  return $.writeFileSync(i, t, "utf8"), i;
}
function Yg(e) {
  const t = Ug(it()), r = `
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
<div id="kaarobar-print-toolbar" role="toolbar" aria-label="${Li(t.previewHint)}">
  <div class="hint">${Li(t.previewHint)}</div>
  <div class="actions">
    <button type="button" class="close" onclick="window.close()">${Li(t.close)}</button>
    <button type="button" class="print" onclick="window.print()">${Li(t.print)}</button>
  </div>
</div>`;
  return /<\/body>/i.test(e) ? e.replace(/<\/body>/i, `${r}</body>`) : `${e}${r}`;
}
function Ra(e) {
  const t = Yg(e.html), r = Kg(e.filePrefix, t);
  return new Yi({
    show: !0,
    width: e.width ?? 720,
    height: e.height ?? 900,
    autoHideMenuBar: !0,
    title: e.title ?? "Preview",
    webPreferences: { sandbox: !0, contextIsolation: !0 }
  }).loadFile(r), { ok: !0 };
}
const jg = Ac(import.meta.url);
function y() {
  return We(), lt(he()), he();
}
function ce() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function Q(e) {
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
function kd(e, t) {
  if (!Number.isFinite(e) || e < 0) throw new Error("Sale price must be >= 0");
  if (t != null && (!Number.isFinite(t) || t < 0))
    throw new Error("Cost price must be >= 0");
  if (t != null && e < t)
    throw new Error("Sale price must be greater than or equal to cost price");
}
function Na(e) {
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
    tracksStock: e.tracks_stock == null ? Il(t) : !!e.tracks_stock,
    kitchenStation: ((r = e.kitchen_station) == null ? void 0 : r.trim()) || "main",
    imagePath: e.image_path,
    isActive: !!e.is_active
  };
}
function ft(e) {
  const t = y().prepare("SELECT business_nature FROM businesses WHERE id = ?").get(e);
  return ri(t == null ? void 0 : t.business_nature);
}
function Gg(e) {
  return {
    linkId: e.link_id,
    supplierId: e.supplier_id,
    productId: e.product_id,
    unitCost: e.unit_cost,
    product: Na(e)
  };
}
function Vg(e) {
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
function Hs(e, t) {
  return re(), y().prepare(
    `SELECT a.id, a.business_id, a.actor_user_id, u.name as actor_name, a.entity_type, a.entity_id,
              a.action, a.summary, a.payload_json, a.created_at
       FROM activity_log a
       JOIN users u ON u.id = a.actor_user_id
       WHERE a.entity_type = ? AND a.entity_id = ?
       ORDER BY a.created_at DESC`
  ).all(e, t).map(Vg);
}
function Zg() {
  const e = re();
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
  ).all(e.businessId)).map(xd);
}
function xd(e) {
  return {
    id: e.id,
    name: e.name,
    currency: e.currency,
    brandColor: e.brand_color,
    businessNature: ri(e.business_nature),
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
function Jg(e) {
  var l;
  const t = X("business:edit");
  if (y().prepare("SELECT id FROM businesses LIMIT 1").get())
    throw new Error("This installation already has a business. Only one business is supported.");
  const i = ae(), n = ce(), s = ((l = e.logoPath) == null ? void 0 : l.trim()) || null, a = ri(e.businessNature), o = {
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
    s,
    o.socialWhatsapp,
    o.socialInstagram,
    o.socialFacebook,
    o.socialTiktok,
    o.socialWebsite,
    c,
    u,
    n,
    n
  ), Q({
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
    logoPath: s,
    ...o,
    receiptHeader: c,
    receiptFooter: u,
    isActive: !0
  };
}
function Qg(e) {
  var a;
  const t = X("business:edit");
  M(e.id);
  const r = e.logoPath === void 0 ? void 0 : ((a = e.logoPath) == null ? void 0 : a.trim()) || null, i = e.businessNature === void 0 ? void 0 : ri(e.businessNature), n = {
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
    n.socialWhatsapp,
    n.socialInstagram,
    n.socialFacebook,
    n.socialTiktok,
    n.socialWebsite,
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
    n.socialWhatsapp,
    n.socialInstagram,
    n.socialFacebook,
    n.socialTiktok,
    n.socialWebsite,
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
    n.socialWhatsapp,
    n.socialInstagram,
    n.socialFacebook,
    n.socialTiktok,
    n.socialWebsite,
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
    n.socialWhatsapp,
    n.socialInstagram,
    n.socialFacebook,
    n.socialTiktok,
    n.socialWebsite,
    e.id
  ), e.receiptHeader !== void 0 || e.receiptFooter !== void 0) {
    const o = y().prepare("SELECT receipt_header, receipt_footer FROM businesses WHERE id = ?").get(e.id);
    y().prepare("UPDATE businesses SET receipt_header = ?, receipt_footer = ? WHERE id = ?").run(
      e.receiptHeader !== void 0 ? Ie(e.receiptHeader) : o.receipt_header,
      e.receiptFooter !== void 0 ? Ie(e.receiptFooter) : o.receipt_footer,
      e.id
    );
  }
  const s = y().prepare(
    `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
              social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
              receipt_header, receipt_footer
       FROM businesses WHERE id = ?`
  ).get(e.id);
  return Q({
    businessId: e.id,
    actorUserId: t.id,
    entityType: "business",
    entityId: e.id,
    action: "updated",
    summary: `Updated business ${e.name.trim()}`
  }), xd(s);
}
function e0(e) {
  return M(e), se.set("lastBusinessId", e), { ok: !0 };
}
function t0(e) {
  return M(e), y().prepare(
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
function r0(e) {
  var n, s, a, o;
  if (X("branch:edit"), M(e.businessId), y().prepare("SELECT id FROM branches WHERE business_id = ? LIMIT 1").get(e.businessId))
    throw new Error("This business already has a branch. Only one branch is supported.");
  const r = re(), i = ae();
  return y().prepare(
    `INSERT INTO branches (id, business_id, name, address, phone, is_main_branch, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?)`
  ).run(i, e.businessId, e.name.trim(), ((n = e.address) == null ? void 0 : n.trim()) || null, ((s = e.phone) == null ? void 0 : s.trim()) || null, ce()), Q({
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
function i0(e) {
  var n, s, a, o;
  const t = X("branch:edit"), r = y().prepare("SELECT business_id, is_main_branch, is_active FROM branches WHERE id = ?").get(e.id);
  if (!r) throw new Error("Branch not found");
  M(r.business_id);
  const i = e.isActive === void 0 ? r.is_active : e.isActive ? 1 : 0;
  return y().prepare("UPDATE branches SET name = ?, address = ?, phone = ?, is_active = ? WHERE id = ?").run(
    e.name.trim(),
    ((n = e.address) == null ? void 0 : n.trim()) || null,
    ((s = e.phone) == null ? void 0 : s.trim()) || null,
    i,
    e.id
  ), Q({
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
function n0(e) {
  return re(), M(e), y().prepare(
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
function s0(e) {
  const t = X("users:manage");
  if (M(e.businessId), t.role !== "owner" && e.role === "admin") throw new Error("Only owner can create admins");
  e.branchId && Sr(e.branchId);
  const r = ae(), i = cr.hashSync(e.password, 12);
  return y().prepare(
    `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(r, e.businessId, e.branchId, e.name.trim(), e.email.trim().toLowerCase(), i, e.role, ce()), {
    id: r,
    name: e.name.trim(),
    email: e.email.trim().toLowerCase(),
    role: e.role,
    businessId: e.businessId,
    branchId: e.branchId,
    isActive: !0
  };
}
function a0(e) {
  X("users:manage");
  const t = y().prepare("SELECT business_id FROM users WHERE id = ?").get(e.userId);
  if (!t) throw new Error("User not found");
  return M(t.business_id), y().prepare("UPDATE users SET is_active = ? WHERE id = ?").run(e.isActive ? 1 : 0, e.userId), { ok: !0 };
}
function o0(e) {
  var c, u, l, p;
  const t = re(), r = y().prepare("SELECT id, name, email, role, business_id, branch_id, password_hash, image_path FROM users WHERE id = ?").get(t.id);
  if (!r) throw new Error("User not found");
  const i = ((c = e.name) == null ? void 0 : c.trim()) || r.name;
  if (!i) throw new Error("Name is required");
  const n = e.imagePath === void 0 ? r.image_path : ((u = e.imagePath) == null ? void 0 : u.trim()) || null;
  let s = r.password_hash;
  const a = ((l = e.newPassword) == null ? void 0 : l.trim()) || "";
  if (!!a) {
    if (t.role !== "owner") throw new Error("Only owner can change password from settings");
    if (!((p = e.currentPassword) != null && p.trim())) throw new Error("Current password is required");
    if (!cr.compareSync(e.currentPassword, r.password_hash))
      throw new Error("Current password is incorrect");
    if (a.length < 8)
      throw new Error("Password must be at least 8 characters");
    s = cr.hashSync(a, 12);
  }
  return y().prepare("UPDATE users SET name = ?, image_path = ?, password_hash = ? WHERE id = ?").run(i, n, s, t.id), t.name = i, t.imagePath = n, {
    id: r.id,
    name: i,
    email: r.email,
    role: r.role,
    businessId: r.business_id,
    branchId: r.branch_id,
    imagePath: n
  };
}
function c0(e) {
  return j(), M(e), y().prepare(
    `SELECT id, business_id, branch_id, name, barcode, price, cost_price, stock_qty, kind, tracks_stock,
              kitchen_station, image_path, is_active
       FROM products WHERE business_id = ? ORDER BY created_at DESC`
  ).all(e).map(Na);
}
function u0(e) {
  var u, l, p;
  j(), X("products:edit"), M(e.businessId), e.branchId && Sr(e.branchId), kd(e.price, e.costPrice ?? null);
  const t = ft(e.businessId), r = e.kind ?? "item";
  if (!Ll(t, r))
    throw new Error(`Product kind "${r}" is not allowed for this business type`);
  const i = e.tracksStock === void 0 ? Il(r) : !!e.tracksStock;
  if (i && r !== "item")
    throw new Error("Only item products can track stock");
  const n = re(), s = ae(), a = ce(), o = ((u = e.imagePath) == null ? void 0 : u.trim()) || null, c = i ? e.stockQty ?? 0 : 0;
  return y().prepare(
    `INSERT INTO products (id, business_id, branch_id, category_id, name, sku, barcode, price, cost_price, stock_qty, kind, tracks_stock, unit, image_path, is_active, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, 'pcs', ?, ?, ?, ?)`
  ).run(
    s,
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
  ), Q({
    businessId: e.businessId,
    actorUserId: n.id,
    entityType: "product",
    entityId: s,
    action: "created",
    summary: `Created product ${e.name.trim()}`
  }), {
    id: s,
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
function l0(e) {
  var u, l, p;
  j();
  const t = X("products:edit"), r = y().prepare(
    "SELECT business_id, branch_id, stock_qty, kind, tracks_stock, image_path FROM products WHERE id = ?"
  ).get(e.id);
  if (!r) throw new Error("Product not found");
  M(r.business_id), kd(e.price, e.costPrice ?? null);
  const i = ft(r.business_id), n = e.kind ?? (r.kind || "item");
  if (!Ll(i, n))
    throw new Error(`Product kind "${n}" is not allowed for this business type`);
  const s = e.tracksStock === void 0 ? !!r.tracks_stock : !!e.tracksStock;
  if (s && n !== "item")
    throw new Error("Only item products can track stock");
  const a = e.isActive === !1 ? 0 : 1, o = e.imagePath === void 0 ? r.image_path : ((u = e.imagePath) == null ? void 0 : u.trim()) || null, c = s ? e.stockQty ?? r.stock_qty : 0;
  return y().prepare(
    `UPDATE products SET name = ?, barcode = ?, price = ?, cost_price = ?, stock_qty = ?, kind = ?, tracks_stock = ?, image_path = ?, is_active = ?
       WHERE id = ?`
  ).run(
    e.name.trim(),
    ((l = e.barcode) == null ? void 0 : l.trim()) || null,
    e.price,
    e.costPrice ?? null,
    c,
    n,
    s ? 1 : 0,
    o,
    a,
    e.id
  ), Q({
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
    kind: n,
    tracksStock: s,
    kitchenStation: "main",
    imagePath: o,
    isActive: !!a
  };
}
function d0(e) {
  j();
  const t = X("products:edit"), r = y().prepare("SELECT business_id, name FROM products WHERE id = ?").get(e.id);
  if (!r) throw new Error("Product not found");
  return M(r.business_id), y().prepare("UPDATE products SET is_active = ? WHERE id = ?").run(e.isActive ? 1 : 0, e.id), Q({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "product",
    entityId: e.id,
    action: e.isActive ? "activated" : "deactivated",
    summary: `${e.isActive ? "Activated" : "Deactivated"} product ${r.name}`
  }), { ok: !0 };
}
function f0(e) {
  j();
  const t = X("products:edit"), r = y().prepare("SELECT business_id, name, is_active FROM products WHERE id = ?").get(e);
  if (!r) throw new Error("Product not found");
  M(r.business_id);
  const i = y().prepare("SELECT id FROM sale_items WHERE product_id = ? LIMIT 1").get(e), n = y().prepare("SELECT id FROM purchase_order_items WHERE product_id = ? LIMIT 1").get(e);
  return i || n ? (r.is_active && (y().prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(e), Q({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "product",
    entityId: e,
    action: "deactivated",
    summary: `Deactivated product ${r.name} (used in history)`
  })), { ok: !0, mode: "deactivated" }) : (y().transaction(() => {
    y().prepare("DELETE FROM supplier_products WHERE product_id = ?").run(e), y().prepare("DELETE FROM products WHERE id = ?").run(e);
  })(), Q({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "product",
    entityId: e,
    action: "deleted",
    summary: `Deleted product ${r.name}`
  }), { ok: !0, mode: "deleted" });
}
function h0(e) {
  const t = y().prepare("SELECT business_id FROM products WHERE id = ?").get(e);
  if (!t) throw new Error("Product not found");
  return M(t.business_id), y().prepare(
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
function p0(e) {
  j(), X("products:edit"), M(e);
  for (let t = 0; t < 20; t += 1) {
    const r = `KB${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
    if (!y().prepare("SELECT id FROM products WHERE business_id = ? AND barcode = ?").get(e, r)) return { barcode: r };
  }
  throw new Error("Could not generate unique barcode");
}
function _0(e) {
  return M(e), y().prepare("SELECT id, business_id, name, phone, address, notes, is_active FROM suppliers WHERE business_id = ? ORDER BY created_at DESC").all(e).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    notes: r.notes,
    isActive: !!r.is_active
  }));
}
function E0(e) {
  var i, n, s, a, o, c;
  X("suppliers:edit"), M(e.businessId);
  const t = re(), r = ae();
  return y().prepare(
    `INSERT INTO suppliers (id, business_id, name, phone, address, notes, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(r, e.businessId, e.name.trim(), ((i = e.phone) == null ? void 0 : i.trim()) || null, ((n = e.address) == null ? void 0 : n.trim()) || null, ((s = e.notes) == null ? void 0 : s.trim()) || null, ce()), Q({
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
function m0(e) {
  var n, s, a, o, c, u;
  const t = X("suppliers:edit"), r = y().prepare("SELECT business_id FROM suppliers WHERE id = ?").get(e.id);
  if (!r) throw new Error("Supplier not found");
  M(r.business_id);
  const i = e.isActive === !1 ? 0 : 1;
  return y().prepare("UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ?, is_active = ? WHERE id = ?").run(
    e.name.trim(),
    ((n = e.phone) == null ? void 0 : n.trim()) || null,
    ((s = e.address) == null ? void 0 : s.trim()) || null,
    ((a = e.notes) == null ? void 0 : a.trim()) || null,
    i,
    e.id
  ), Q({
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
function Nr(e) {
  const t = y().prepare("SELECT id, business_id, name, phone, address, notes, is_active FROM suppliers WHERE id = ?").get(e);
  if (!t) throw new Error("Supplier not found");
  return M(t.business_id), t;
}
function Ia(e) {
  return Nr(e), y().prepare(
    `SELECT sp.id as link_id, sp.supplier_id, sp.product_id, sp.unit_cost,
              p.id, p.business_id, p.branch_id, p.name, p.barcode, p.price, p.cost_price,
              p.stock_qty, p.kind, p.tracks_stock, p.image_path, p.is_active
       FROM supplier_products sp
       JOIN products p ON p.id = sp.product_id
       WHERE sp.supplier_id = ?
       ORDER BY p.name ASC`
  ).all(e).map(Gg);
}
function T0(e) {
  const t = Nr(e);
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
    products: Ia(e)
  };
}
function g0(e) {
  X("suppliers:edit");
  const t = Nr(e.supplierId);
  if (!Number.isFinite(e.unitCost) || e.unitCost < 0)
    throw new Error("Unit cost must be >= 0");
  const r = y().prepare(
    `SELECT id, business_id, branch_id, name, barcode, price, cost_price, stock_qty, kind, tracks_stock, image_path, is_active
       FROM products WHERE id = ?`
  ).get(e.productId);
  if (!r) throw new Error("Product not found");
  if (r.business_id !== t.business_id)
    throw new Error("Product and supplier must belong to the same business");
  if (M(r.business_id), y().prepare("SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ?").get(e.supplierId, e.productId)) throw new Error("Product is already attached to this supplier");
  const n = ae();
  return y().prepare(
    `INSERT INTO supplier_products (id, supplier_id, product_id, unit_cost, created_at)
       VALUES (?, ?, ?, ?, ?)`
  ).run(n, e.supplierId, e.productId, e.unitCost, ce()), {
    linkId: n,
    supplierId: e.supplierId,
    productId: e.productId,
    unitCost: e.unitCost,
    product: Na(r)
  };
}
function b0(e) {
  if (X("suppliers:edit"), Nr(e.supplierId), y().prepare("DELETE FROM supplier_products WHERE supplier_id = ? AND product_id = ?").run(e.supplierId, e.productId).changes === 0) throw new Error("Product is not attached to this supplier");
  return { ok: !0 };
}
function v0(e) {
  if (X("suppliers:edit"), Nr(e.supplierId), !Number.isFinite(e.unitCost) || e.unitCost < 0)
    throw new Error("Unit cost must be >= 0");
  if (y().prepare("UPDATE supplier_products SET unit_cost = ? WHERE supplier_id = ? AND product_id = ?").run(e.unitCost, e.supplierId, e.productId).changes === 0) throw new Error("Product is not attached to this supplier");
  const r = Ia(e.supplierId).find((i) => i.productId === e.productId);
  if (!r) throw new Error("Product is not attached to this supplier");
  return r;
}
function y0(e) {
  return M(e), y().prepare(
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
function w0(e) {
  var a;
  if (X("purchaseOrders:edit"), M(e.businessId), Sr(e.branchId), Nr(e.supplierId).business_id !== e.businessId)
    throw new Error("Supplier does not belong to this business");
  if (!((a = e.items) != null && a.length)) throw new Error("Add at least one product line");
  const r = ae(), i = re(), n = y().prepare(
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
      if (!y().prepare("SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ?").get(e.supplierId, o.productId)) throw new Error("All products must be attached to the selected supplier");
      const u = o.orderedQty * o.unitCost;
      n.run(ae(), r, o.productId, o.orderedQty, o.unitCost, u);
    }
  })(), Q({
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
function Dd(e) {
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
  M(t.business_id);
  const i = y().prepare(
    `SELECT poi.id, poi.product_id, p.name as product_name, poi.ordered_qty, poi.received_qty, poi.unit_cost, poi.line_total
       FROM purchase_order_items poi
       JOIN products p ON p.id = poi.product_id
       WHERE poi.po_id = ?
       ORDER BY p.name ASC`
  ).all(e).map((n) => ({
    id: n.id,
    productId: n.product_id,
    productName: n.product_name,
    orderedQty: n.ordered_qty,
    receivedQty: n.received_qty,
    unitCost: n.unit_cost,
    lineTotal: n.line_total
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
    total: i.reduce((n, s) => n + s.lineTotal, 0)
  };
}
async function S0(e) {
  X("purchaseOrders:edit");
  const t = Dd(e), r = y().prepare("SELECT currency, logo_path, brand_color FROM businesses WHERE id = ?").get(t.po.businessId), i = y().prepare("SELECT phone, address FROM suppliers WHERE id = ?").get(t.po.supplierId), n = Hg({
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
    items: t.items.map((s) => ({
      productName: s.productName,
      orderedQty: s.orderedQty,
      unitCost: s.unitCost,
      lineTotal: s.lineTotal
    })),
    total: t.total
  });
  return Ra({
    html: n,
    filePrefix: "purchase-order",
    title: t.po.poNumber,
    width: 780,
    height: 920
  });
}
function R0(e) {
  return M(e), y().prepare("SELECT id, business_id, name, phone, current_balance, is_active FROM customers WHERE business_id = ? ORDER BY created_at DESC").all(e).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    phone: r.phone,
    currentBalance: r.current_balance,
    isActive: !!r.is_active
  }));
}
function N0(e) {
  var n, s;
  const t = X("customers:edit");
  M(e.businessId);
  const r = ae(), i = ce();
  return y().prepare(
    `INSERT INTO customers (id, business_id, name, phone, address, opening_balance, current_balance, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 0, 0, 1, ?, ?)`
  ).run(r, e.businessId, e.name.trim(), ((n = e.phone) == null ? void 0 : n.trim()) || null, i, i), Q({
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
    phone: ((s = e.phone) == null ? void 0 : s.trim()) || null,
    currentBalance: 0,
    isActive: !0
  };
}
function I0(e) {
  var n, s;
  const t = X("customers:edit"), r = y().prepare("SELECT business_id, current_balance FROM customers WHERE id = ?").get(e.id);
  if (!r) throw new Error("Customer not found");
  M(r.business_id);
  const i = e.isActive === !1 ? 0 : 1;
  return y().prepare("UPDATE customers SET name = ?, phone = ?, is_active = ? WHERE id = ?").run(e.name.trim(), ((n = e.phone) == null ? void 0 : n.trim()) || null, i, e.id), Q({
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
    phone: ((s = e.phone) == null ? void 0 : s.trim()) || null,
    currentBalance: r.current_balance,
    isActive: !!i
  };
}
function Ud(e) {
  re();
  const t = y().prepare("SELECT id, business_id, name, phone, current_balance, is_active FROM customers WHERE id = ?").get(e);
  if (!t) throw new Error("Customer not found");
  M(t.business_id);
  const r = y().prepare(
    `SELECT id, invoice_no, total, status, created_at
       FROM sales WHERE customer_id = ? ORDER BY created_at DESC`
  ).all(e), i = y().prepare("SELECT method FROM payments WHERE sale_id = ?"), n = y().prepare(
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
      currentBalance: t.current_balance,
      isActive: !!t.is_active
    },
    remainingBalance: t.current_balance,
    sales: r.map((s) => {
      const a = i.all(s.id);
      return {
        id: s.id,
        invoiceNo: s.invoice_no,
        total: s.total,
        status: s.status,
        createdAt: s.created_at,
        paymentMethods: [...new Set(a.map((o) => o.method))]
      };
    }),
    ledger: n.map((s) => {
      let a = null;
      if (s.type === "payment" && s.note) {
        const o = s.note.match(/^method:(cash|card)(?:\s*\|\s*(.*))?$/i);
        o && (a = o[1].toLowerCase());
      }
      return {
        id: s.id,
        customerId: s.customer_id,
        businessId: s.business_id,
        branchId: s.branch_id,
        type: s.type,
        amount: s.amount,
        balanceAfter: s.balance_after,
        referenceSaleId: s.reference_sale_id,
        note: s.note,
        createdBy: s.created_by,
        createdByName: s.created_by_name,
        createdAt: s.created_at,
        method: a
      };
    })
  };
}
function gc(e) {
  const t = new Date(e);
  if (!Number.isFinite(t.getTime())) return e.slice(0, 10);
  const r = t.getFullYear(), i = String(t.getMonth() + 1).padStart(2, "0"), n = String(t.getDate()).padStart(2, "0");
  return `${r}-${i}-${n}`;
}
async function L0(e) {
  var l, p;
  j(), X("sales:print");
  const t = Ud(e.customerId), r = y().prepare("SELECT name, currency, logo_path, brand_color FROM businesses WHERE id = ?").get(t.customer.businessId);
  if (!r) throw new Error("Business not found");
  const i = ((l = e.from) == null ? void 0 : l.trim()) || null, n = ((p = e.to) == null ? void 0 : p.trim()) || null;
  if (i && n && i > n) throw new Error("Invalid date range");
  const s = [...t.ledger].sort((d, f) => {
    const _ = d.createdAt.localeCompare(f.createdAt);
    return _ !== 0 ? _ : d.id.localeCompare(f.id);
  }), a = s.filter((d) => {
    const f = gc(d.createdAt);
    return !(i && f < i || n && f > n);
  });
  let o = 0;
  if (i) {
    const d = s.filter((f) => gc(f.createdAt) < i);
    d.length > 0 && (o = d[d.length - 1].balanceAfter);
  }
  const c = new Map(
    t.sales.map((d) => [d.id, d.invoiceNo])
  ), u = qg({
    businessName: r.name,
    currency: r.currency || "Rs",
    brandColor: r.brand_color,
    logoPath: r.logo_path,
    customerName: t.customer.name,
    customerPhone: t.customer.phone,
    from: i,
    to: n,
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
  return Ra({
    html: u,
    filePrefix: "customer-ledger",
    title: t.customer.name,
    width: 900,
    height: 960
  });
}
function A0(e) {
  var l, p;
  const t = X("customers:edit"), r = Number(e.amount);
  if (!Number.isFinite(r) || r <= 0) throw new Error("Payment amount must be greater than 0");
  if (e.method !== "cash" && e.method !== "card")
    throw new Error("Payment method must be cash or card");
  const i = y().prepare("SELECT id, business_id, name, current_balance FROM customers WHERE id = ?").get(e.customerId);
  if (!i) throw new Error("Customer not found");
  if (M(i.business_id), r > i.current_balance)
    throw new Error("Payment cannot exceed remaining credit balance");
  let n = ((l = e.branchId) == null ? void 0 : l.trim()) || null;
  n ? Sr(n) : t.branchId && (n = t.branchId);
  const s = ae(), a = ce(), o = i.current_balance - r, c = ((p = e.note) == null ? void 0 : p.trim()) || "", u = c ? `method:${e.method} | ${c}` : `method:${e.method}`;
  return y().transaction(() => {
    y().prepare("UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?").run(
      o,
      a,
      i.id
    ), y().prepare(
      `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
         VALUES (?, ?, ?, ?, 'payment', ?, ?, NULL, ?, ?, ?)`
    ).run(s, i.id, i.business_id, n, -r, o, u, t.id, a);
  })(), Q({
    businessId: i.business_id,
    actorUserId: t.id,
    entityType: "customer",
    entityId: i.id,
    action: "payment_recorded",
    summary: `Recorded ${e.method} payment of ${r} for ${i.name}`
  }), {
    id: s,
    customerId: i.id,
    businessId: i.business_id,
    branchId: n,
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
function C0(e, t) {
  const r = y().prepare("SELECT name FROM businesses WHERE id = ?").get(e), i = y().prepare("SELECT name FROM branches WHERE id = ?").get(t);
  if (!r || !i) throw new Error("Business or branch not found");
  const n = cm(r.name, i.name), s = y().prepare("SELECT invoice_no FROM sales WHERE business_id = ? AND invoice_no LIKE ?").all(e, `${n}%`);
  let a = 0;
  for (const o of s) {
    const c = um(o.invoice_no, n);
    c != null && c > a && (a = c);
  }
  return om(r.name, i.name, a + 1);
}
function O0(e) {
  var m, b, v, S, L;
  j(), X("sales:checkout"), M(e.businessId), Sr(e.branchId);
  const t = re();
  if (!e.items.length) throw new Error("Add at least one item to the sale");
  const r = ft(e.businessId);
  let i = ((m = e.servedByUserId) == null ? void 0 : m.trim()) || null, n = e.serviceMode ?? null, s = ((b = e.tableId) == null ? void 0 : b.trim()) || null;
  const a = ((v = e.ticketId) == null ? void 0 : v.trim()) || null;
  let o = ((S = e.riderUserId) == null ? void 0 : S.trim()) || null, c = e.deliveryStatus ?? null;
  const u = ((L = e.deliveryNotes) == null ? void 0 : L.trim()) || null, l = !!e.partialTicketBill;
  if (zE(r)) {
    if (!i) throw new Error("Served by staff is required");
    if (!y().prepare(
      `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
    ).get(i, e.businessId, e.businessId)) throw new Error("Selected staff member was not found");
  } else if (i)
    throw new Error("Served by is not used for this business type");
  if (WE(r)) {
    if (!n || !["dine_in", "takeaway", "delivery"].includes(n))
      throw new Error("Service mode is required");
    if (n === "dine_in") {
      if (!s) throw new Error("Table is required for dine-in");
      if (!y().prepare("SELECT id FROM dining_tables WHERE id = ? AND business_id = ? AND is_active = 1").get(s, e.businessId)) throw new Error("Table not found");
    } else
      s = null;
  } else {
    if (n || s)
      throw new Error("Tables and service modes are not used for this business type");
    n = null, s = null;
  }
  if (a) {
    if (!jt(r)) throw new Error("Tickets are only available for food businesses");
    const I = y().prepare(
      `SELECT id, status, table_id, service_mode, rider_user_id, delivery_status, delivery_notes
         FROM pos_tickets WHERE id = ? AND business_id = ?`
    ).get(a, e.businessId);
    if (!I) throw new Error("Ticket not found");
    if (I.status !== "open") throw new Error("Ticket is no longer open");
    n = I.service_mode, s = I.table_id, o || (o = I.rider_user_id), c || (c = I.delivery_status);
  }
  if (n === "takeaway" || n === "delivery")
    if (o) {
      if (!y().prepare(
        `SELECT id FROM users
           WHERE id = ? AND is_active = 1
             AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
      ).get(o, e.businessId, e.businessId)) throw new Error("Rider not found");
      c || (c = "assigned");
    } else !c && n === "delivery" && (c = "pending");
  else
    o = null, c = null;
  const p = ae(), d = ce(), f = C0(e.businessId, e.branchId), _ = e.items.reduce((I, O) => I + O.qty * O.unitPrice, 0), E = Math.max(0, Number(e.discount ?? 0));
  if (!Number.isFinite(E)) throw new Error("Discount must be a valid number");
  if (E > _) throw new Error("Discount cannot exceed subtotal");
  const w = _ - E, h = e.payments.reduce((I, O) => I + O.amount, 0);
  return y().transaction(() => {
    for (const B of e.items) {
      if (!Number.isFinite(B.qty) || B.qty <= 0) throw new Error("Item quantity must be greater than 0");
      const q = y().prepare(
        "SELECT id, name, stock_qty, tracks_stock, is_active FROM products WHERE id = ? AND business_id = ?"
      ).get(B.productId, e.businessId);
      if (!q || !q.is_active) throw new Error("Product not found or inactive");
      if (q.tracks_stock && B.qty > q.stock_qty)
        throw new Error(`Insufficient stock for ${q.name}`);
      if (a && B.ticketItemId) {
        const ge = y().prepare(
          "SELECT id, product_id, qty, billed_qty FROM pos_ticket_items WHERE id = ? AND ticket_id = ?"
        ).get(B.ticketItemId, a);
        if (!ge) throw new Error("Ticket line not found");
        if (ge.product_id !== B.productId) throw new Error("Ticket line product mismatch");
        const ht = ge.qty - (ge.billed_qty || 0);
        if (B.qty > ht + 1e-9)
          throw new Error(`Cannot bill more than remaining qty for ${q.name}`);
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
      n,
      s,
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
    ).get(a).c === 0 ? y().prepare("UPDATE pos_tickets SET status = 'billed', updated_at = ? WHERE id = ? AND status = 'open'").run(d, a) : y().prepare("UPDATE pos_tickets SET updated_at = ? WHERE id = ?").run(d, a) : (y().prepare(
      "UPDATE pos_ticket_items SET billed_qty = qty WHERE ticket_id = ?"
    ).run(a), y().prepare("UPDATE pos_tickets SET status = 'billed', updated_at = ? WHERE id = ? AND status = 'open'").run(d, a)));
  })(), Q({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "sale",
    entityId: p,
    action: "created",
    summary: `Sale ${f} completed`,
    payload: { total: w, itemCount: e.items.length }
  }), qr(p);
}
function Pd(e) {
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
function qr(e) {
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
  return Pd(t);
}
function k0(e) {
  return j(), M(e), y().prepare(
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
  ).all(e).map(Pd);
}
function qi(e) {
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
function x0(e) {
  j();
  const t = X("sales:refund_request");
  if (!e.reason.trim()) throw new Error("Refund reason is required");
  if (!e.items.length) throw new Error("Select at least one item to refund");
  const r = y().prepare("SELECT id, business_id, status FROM sales WHERE id = ?").get(e.saleId);
  if (!r) throw new Error("Sale not found");
  if (M(r.business_id), r.status === "void" || r.status === "refunded")
    throw new Error("Sale cannot be refunded");
  if (y().prepare("SELECT id FROM refund_requests WHERE sale_id = ? AND status = 'pending'").get(e.saleId)) throw new Error("A pending refund request already exists for this sale");
  const n = ae(), s = ce();
  return y().transaction(() => {
    y().prepare(
      `INSERT INTO refund_requests (id, sale_id, business_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)`
    ).run(n, e.saleId, r.business_id, t.id, e.reason.trim(), s);
    const a = y().prepare(
      `INSERT INTO refund_request_items (id, refund_request_id, sale_item_id, product_id, qty)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const o of e.items) {
      if (o.qty <= 0) throw new Error("Refund qty must be positive");
      const c = y().prepare("SELECT id, product_id, qty, refunded_qty FROM sale_items WHERE id = ? AND sale_id = ?").get(o.saleItemId, e.saleId);
      if (!c) throw new Error("Sale item not found");
      const u = c.qty - (c.refunded_qty || 0);
      if (o.qty > u) throw new Error("Refund qty exceeds remaining quantity");
      a.run(ae(), n, c.id, c.product_id, o.qty);
    }
    Q({
      businessId: r.business_id,
      actorUserId: t.id,
      entityType: "sale",
      entityId: e.saleId,
      action: "refund_requested",
      summary: `Refund requested: ${e.reason.trim()}`,
      payload: { requestId: n, items: e.items }
    });
  })(), qi(n);
}
function D0(e) {
  var a;
  j();
  const t = X("sales:refund_approve"), r = y().prepare("SELECT id, sale_id, business_id, status, reason FROM refund_requests WHERE id = ?").get(e.id);
  if (!r) throw new Error("Refund request not found");
  if (M(r.business_id), r.status !== "pending") throw new Error("Refund request already reviewed");
  const i = ce();
  if (e.decision === "reject")
    return y().prepare(
      "UPDATE refund_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?"
    ).run(t.id, i, ((a = e.note) == null ? void 0 : a.trim()) || null, e.id), Q({
      businessId: r.business_id,
      actorUserId: t.id,
      entityType: "sale",
      entityId: r.sale_id,
      action: "refund_rejected",
      summary: `Refund rejected${e.note ? `: ${e.note}` : ""}`,
      payload: { requestId: e.id }
    }), qi(e.id);
  const n = y().prepare("SELECT id, customer_id, status, total FROM sales WHERE id = ?").get(r.sale_id);
  if (!n) throw new Error("Sale not found");
  const s = y().prepare("SELECT sale_item_id, product_id, qty FROM refund_request_items WHERE refund_request_id = ?").all(e.id);
  return y().transaction(() => {
    var f;
    const o = y().prepare(
      "UPDATE products SET stock_qty = stock_qty + ? WHERE id = ? AND tracks_stock = 1"
    ), c = y().prepare(
      "UPDATE sale_items SET refunded_qty = refunded_qty + ? WHERE id = ?"
    );
    let u = 0;
    for (const _ of s) {
      const E = y().prepare("SELECT qty, refunded_qty, unit_price FROM sale_items WHERE id = ?").get(_.sale_item_id), w = E.qty - (E.refunded_qty || 0);
      if (_.qty > w) throw new Error("Refund qty no longer available");
      c.run(_.qty, _.sale_item_id), o.run(_.qty, _.product_id), u += _.qty * E.unit_price;
    }
    const d = y().prepare("SELECT qty, refunded_qty FROM sale_items WHERE sale_id = ?").all(r.sale_id).every((_) => _.refunded_qty >= _.qty) ? "refunded" : "partially_refunded";
    if (y().prepare("UPDATE sales SET status = ? WHERE id = ?").run(d, r.sale_id), n.customer_id && u > 0) {
      const E = y().prepare("SELECT SUM(amount) as total FROM payments WHERE sale_id = ? AND method = 'credit'").get(r.sale_id).total ?? 0;
      if (E > 0) {
        const w = Math.min(u, E), m = y().prepare("SELECT current_balance FROM customers WHERE id = ?").get(n.customer_id).current_balance - w;
        y().prepare("UPDATE customers SET current_balance = ? WHERE id = ?").run(m, n.customer_id), y().prepare(
          `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
             VALUES (?, ?, ?, NULL, 'adjustment', ?, ?, ?, ?, ?, ?)`
        ).run(
          ae(),
          n.customer_id,
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
    ).run(t.id, i, ((f = e.note) == null ? void 0 : f.trim()) || null, e.id), Q({
      businessId: r.business_id,
      actorUserId: t.id,
      entityType: "sale",
      entityId: r.sale_id,
      action: "refund_approved",
      summary: `Refund approved (${d})`,
      payload: { requestId: e.id, refundAmount: u, items: s }
    });
  })(), qi(e.id);
}
function U0(e) {
  j(), re();
  const t = qr(e);
  M(t.businessId);
  const r = y().prepare(
    `SELECT si.id, si.sale_id, si.product_id, si.product_name_snapshot, si.qty, si.unit_price, si.line_total,
              si.refunded_qty, si.price_rule_id, r.name as price_rule_name
       FROM sale_items si
       LEFT JOIN happy_hour_price_rules r ON r.id = si.price_rule_id
       WHERE si.sale_id = ?`
  ).all(e), i = y().prepare("SELECT id, method, amount, created_at FROM payments WHERE sale_id = ?").all(e), n = y().prepare("SELECT id FROM refund_requests WHERE sale_id = ? ORDER BY created_at DESC").all(e);
  return {
    sale: t,
    items: r.map(
      (s) => ({
        id: s.id,
        saleId: s.sale_id,
        productId: s.product_id,
        productName: s.product_name_snapshot,
        qty: s.qty,
        unitPrice: s.unit_price,
        lineTotal: s.line_total,
        refundedQty: s.refunded_qty || 0,
        refundableQty: s.qty - (s.refunded_qty || 0),
        priceRuleId: s.price_rule_id,
        priceRuleName: s.price_rule_name
      })
    ),
    payments: i.map((s) => ({
      id: s.id,
      method: s.method,
      amount: s.amount,
      createdAt: s.created_at
    })),
    refundRequests: n.map((s) => qi(s.id)),
    activity: Hs("sale", e)
  };
}
function P0(e, t) {
  j(), M(e);
  const r = t.trim();
  if (!r) return null;
  const i = y().prepare("SELECT id FROM sales WHERE business_id = ? AND invoice_no = ? LIMIT 1").get(e, r);
  return i ? qr(i.id) : null;
}
function B0(e) {
  var a, o;
  j(), X("sales:checkout");
  const t = re(), r = qr(e.saleId);
  if (M(r.businessId), r.serviceMode !== "takeaway" && r.serviceMode !== "delivery")
    throw new Error("Delivery tracking is only for takeaway or delivery sales");
  let i = e.riderUserId === void 0 ? r.riderUserId : ((a = e.riderUserId) == null ? void 0 : a.trim()) || null, n = e.deliveryStatus === void 0 ? r.deliveryStatus : e.deliveryStatus;
  const s = e.deliveryNotes === void 0 ? r.deliveryNotes : ((o = e.deliveryNotes) == null ? void 0 : o.trim()) || null;
  if (i) {
    if (!y().prepare(
      `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
    ).get(i, r.businessId, r.businessId)) throw new Error("Rider not found");
    (!n || n === "pending") && (n = "assigned");
  }
  return y().prepare(
    "UPDATE sales SET rider_user_id = ?, delivery_status = ?, delivery_notes = ? WHERE id = ?"
  ).run(i, n, s, e.saleId), Q({
    businessId: r.businessId,
    actorUserId: t.id,
    entityType: "sale",
    entityId: e.saleId,
    action: "delivery_updated",
    summary: `Delivery status ${n ?? "cleared"}`
  }), qr(e.saleId);
}
async function F0(e) {
  j(), X("sales:print");
  const t = re(), r = y().prepare(
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
  M(r.business_id);
  const i = y().prepare(
    `SELECT address, phone FROM branches
       WHERE business_id = ? AND is_main_branch = 1
       ORDER BY created_at ASC LIMIT 1`
  ).get(r.business_id), n = y().prepare(
    "SELECT address, phone FROM branches WHERE business_id = ? ORDER BY created_at ASC LIMIT 1"
  ).get(r.business_id), s = i ?? n, a = y().prepare(
    "SELECT product_name_snapshot as product_name, qty, unit_price, line_total FROM sale_items WHERE sale_id = ? ORDER BY id"
  ).all(e), o = y().prepare("SELECT method, amount FROM payments WHERE sale_id = ?").all(e);
  let c = "";
  try {
    const l = jg.resolve("jsbarcode/dist/JsBarcode.all.min.js");
    c = $.readFileSync(l, "utf8");
  } catch {
    c = "";
  }
  const u = await Mg({
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
    branchAddress: (s == null ? void 0 : s.address) ?? null,
    branchPhone: (s == null ? void 0 : s.phone) ?? null,
    socialWhatsapp: r.social_whatsapp,
    socialInstagram: r.social_instagram,
    socialFacebook: r.social_facebook,
    socialTiktok: r.social_tiktok,
    socialWebsite: r.social_website,
    items: a.map((l) => ({
      productName: l.product_name,
      qty: l.qty,
      unitPrice: l.unit_price,
      lineTotal: l.line_total
    })),
    payments: o,
    jsBarcodeScript: c
  });
  return Ra({
    html: u,
    filePrefix: "sale-receipt",
    title: r.invoice_no,
    width: 420,
    height: 760
  });
}
function M0(e) {
  const t = typeof e == "string" ? Number(e) : e;
  return t === 7 || t === 30 || t === 90 ? t : 30;
}
function nr(e) {
  const t = e.getUTCFullYear(), r = String(e.getUTCMonth() + 1).padStart(2, "0"), i = String(e.getUTCDate()).padStart(2, "0");
  return `${t}-${r}-${i}`;
}
function bc(e = /* @__PURE__ */ new Date()) {
  return new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
}
const vc = /^(\d{4})-(\d{2})-(\d{2})$/, ms = 366;
function Ki(e) {
  if (!e || !vc.test(e)) return null;
  const [, t, r, i] = e.match(vc), n = Number(t), s = Number(r), a = Number(i), o = new Date(Date.UTC(n, s - 1, a));
  return nr(o) !== e ? null : o;
}
function $0(e) {
  const t = typeof e.from == "string" ? e.from.trim() : "", r = typeof e.to == "string" ? e.to.trim() : "";
  if (!!(t || r)) {
    let o = Ki(t), c = Ki(r);
    if (!o && !c)
      throw new Error("Invalid analytics date range");
    if (c || (c = bc()), o || (o = new Date(c.getTime())), o.getTime() > c.getTime()) {
      const p = o;
      o = c, c = p;
    }
    const u = 24 * 60 * 60 * 1e3;
    let l = Math.floor((c.getTime() - o.getTime()) / u) + 1;
    return l > ms && (o = new Date(c.getTime()), o.setUTCDate(o.getUTCDate() - (ms - 1)), l = ms), {
      from: nr(o),
      to: nr(c),
      days: l,
      sinceIso: o.toISOString()
    };
  }
  const n = M0(e.days), s = bc(), a = new Date(s.getTime());
  return a.setUTCDate(a.getUTCDate() - (n - 1)), {
    from: nr(a),
    to: nr(s),
    days: n,
    sinceIso: a.toISOString()
  };
}
function yc(e) {
  const t = typeof e == "object" && e && "businessId" in e ? String(e.businessId) : "", r = $0(
    typeof e == "object" && e ? {
      days: e.days,
      from: e.from,
      to: e.to
    } : {}
  );
  X("business:view"), M(t);
  const { from: i, to: n, days: s, sinceIso: a } = r, o = Ki(n);
  o.setUTCDate(o.getUTCDate() + 1);
  const c = o.toISOString(), u = y().prepare(
    `SELECT date(created_at) as day, SUM(total) as total, COUNT(*) as count
       FROM sales
       WHERE business_id = ? AND created_at >= ? AND created_at < ? AND status != 'void'
       GROUP BY date(created_at)
       ORDER BY day ASC`
  ).all(t, a, c), l = new Map(u.map((S) => [S.day, S])), p = [];
  let d = 0, f = 0;
  const _ = Ki(i);
  for (let S = 0; S < s; S += 1) {
    const L = nr(_), I = l.get(L), O = (I == null ? void 0 : I.total) ?? 0, P = (I == null ? void 0 : I.count) ?? 0;
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
    days: s,
    from: i,
    to: n,
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
function H0(e) {
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
function Rt(e) {
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
  ).all(e).map(H0), n = i.reduce((s, a) => {
    const o = Math.max(0, a.qty - a.billedQty);
    return s + o * a.unitPrice;
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
    total: i.reduce((s, a) => s + a.lineTotal, 0),
    unbilledTotal: n,
    createdAt: t.created_at,
    updatedAt: t.updated_at
  };
}
function La(e) {
  if (j(), M(e), !jt(ft(e)))
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
function X0(e) {
  if (j(), X("tables:edit"), M(e.businessId), !jt(ft(e.businessId)))
    throw new Error("Tables are only available for food businesses");
  const t = re(), r = ae(), i = e.name.trim();
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
  ), Q({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "dining_table",
    entityId: r,
    action: "created",
    summary: `Created table ${i}`
  }), La(e.businessId).find((n) => n.id === r);
}
function W0(e) {
  j();
  const t = X("tables:edit"), r = y().prepare("SELECT business_id FROM dining_tables WHERE id = ?").get(e.id);
  if (!r) throw new Error("Table not found");
  if (M(r.business_id), !jt(ft(r.business_id)))
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
  ), Q({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "dining_table",
    entityId: e.id,
    action: "updated",
    summary: `Updated table ${i}`
  }), La(r.business_id).find((n) => n.id === e.id);
}
function z0(e) {
  if (j(), M(e), !jt(ft(e)))
    throw new Error("Tickets are only available for food businesses");
  return y().prepare("SELECT id FROM pos_tickets WHERE business_id = ? AND status = 'open' ORDER BY updated_at DESC").all(e).map((r) => Rt(r.id));
}
function q0(e) {
  j(), re();
  const t = Rt(e);
  return M(t.businessId), t;
}
function K0(e) {
  var a, o;
  if (j(), X("sales:checkout"), M(e.businessId), Sr(e.branchId), !jt(ft(e.businessId)))
    throw new Error("Tickets are only available for food businesses");
  if (!["dine_in", "takeaway", "delivery"].includes(e.serviceMode))
    throw new Error("Invalid service mode");
  const t = re();
  let r = ((a = e.tableId) == null ? void 0 : a.trim()) || null;
  if (e.serviceMode === "dine_in") {
    if (!r) throw new Error("Table is required for dine-in");
    if (!y().prepare("SELECT id FROM dining_tables WHERE id = ? AND business_id = ? AND is_active = 1").get(r, e.businessId)) throw new Error("Table not found");
    if (y().prepare("SELECT id FROM pos_tickets WHERE table_id = ? AND status = 'open'").get(r)) throw new Error("Table already has an open ticket");
  } else
    r = null;
  const i = ae(), n = ce(), s = e.serviceMode === "takeaway" || e.serviceMode === "delivery" ? "pending" : null;
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
    s,
    n,
    n
  ), Q({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "pos_ticket",
    entityId: i,
    action: "opened",
    summary: `Opened ${e.serviceMode} ticket`
  }), Rt(i);
}
function Y0(e) {
  j(), X("sales:checkout");
  const t = y().prepare("SELECT id, business_id, status FROM pos_tickets WHERE id = ?").get(e.ticketId);
  if (!t) throw new Error("Ticket not found");
  if (M(t.business_id), t.status !== "open") throw new Error("Ticket is no longer open");
  const r = ce();
  return y().transaction(() => {
    const i = y().prepare(
      "SELECT id, kitchen_status, fired_at, bumped_at, billed_qty FROM pos_ticket_items WHERE ticket_id = ?"
    ).all(e.ticketId), n = new Map(i.map((a) => [a.id, a]));
    y().prepare("DELETE FROM pos_ticket_items WHERE ticket_id = ?").run(e.ticketId);
    const s = y().prepare(
      `INSERT INTO pos_ticket_items (
         id, ticket_id, product_id, product_name_snapshot, qty, unit_price, line_total,
         seat_no, kitchen_status, fired_at, bumped_at, billed_qty, price_rule_id
       )
       SELECT ?, ?, p.id, p.name, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM products p WHERE p.id = ? AND p.business_id = ? AND p.is_active = 1`
    );
    for (const a of e.items) {
      if (!Number.isFinite(a.qty) || a.qty <= 0) throw new Error("Item quantity must be greater than 0");
      const o = y().prepare(
        "SELECT id, name, stock_qty, tracks_stock FROM products WHERE id = ? AND business_id = ? AND is_active = 1"
      ).get(a.productId, t.business_id);
      if (!o) throw new Error("Product not found or inactive");
      if (o.tracks_stock && a.qty > o.stock_qty)
        throw new Error(`Insufficient stock for ${o.name}`);
      const c = a.id && n.has(a.id) ? a.id : ae(), u = a.id ? n.get(a.id) : void 0, l = Math.min((u == null ? void 0 : u.billed_qty) || 0, a.qty);
      if (s.run(
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
  })(), Rt(e.ticketId);
}
function j0(e) {
  j(), X("sales:checkout");
  const t = re(), r = y().prepare("SELECT id, business_id, status FROM pos_tickets WHERE id = ?").get(e);
  if (!r) throw new Error("Ticket not found");
  if (M(r.business_id), r.status !== "open") throw new Error("Ticket is no longer open");
  return y().prepare("UPDATE pos_tickets SET status = 'cancelled', updated_at = ? WHERE id = ?").run(ce(), e), Q({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "pos_ticket",
    entityId: e,
    action: "cancelled",
    summary: "Cancelled open ticket"
  }), { ok: !0 };
}
function G0(e) {
  j(), X("sales:checkout");
  const t = re(), r = Rt(e.ticketId);
  if (M(r.businessId), r.status !== "open") throw new Error("Ticket is no longer open");
  if (!e.itemIds.length) throw new Error("Select items to send to kitchen");
  const i = ce(), n = y().prepare(
    `UPDATE pos_ticket_items
     SET kitchen_status = 'fired', fired_at = COALESCE(fired_at, ?)
     WHERE id = ? AND ticket_id = ? AND kitchen_status = 'held'`
  );
  return y().transaction(() => {
    for (const s of e.itemIds)
      n.run(i, s, e.ticketId);
    y().prepare("UPDATE pos_tickets SET updated_at = ? WHERE id = ?").run(i, e.ticketId);
  })(), Q({
    businessId: r.businessId,
    actorUserId: t.id,
    entityType: "pos_ticket",
    entityId: e.ticketId,
    action: "kitchen_fired",
    summary: `Fired ${e.itemIds.length} item(s) to kitchen`
  }), Rt(e.ticketId);
}
function V0(e) {
  var a, o;
  j(), X("sales:checkout");
  const t = re(), r = Rt(e.ticketId);
  if (M(r.businessId), r.status !== "open") throw new Error("Ticket is no longer open");
  if (r.serviceMode !== "takeaway" && r.serviceMode !== "delivery")
    throw new Error("Rider assignment is only for takeaway or delivery");
  const i = ((a = e.riderUserId) == null ? void 0 : a.trim()) || null;
  let n = e.deliveryStatus ?? r.deliveryStatus;
  const s = e.deliveryNotes === void 0 ? r.deliveryNotes : ((o = e.deliveryNotes) == null ? void 0 : o.trim()) || null;
  if (i) {
    if (!y().prepare(
      `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
    ).get(i, r.businessId, r.businessId)) throw new Error("Rider not found");
    (!n || n === "pending") && (n = "assigned");
  }
  return y().prepare(
    `UPDATE pos_tickets
       SET rider_user_id = ?, delivery_status = ?, delivery_notes = ?, updated_at = ?
       WHERE id = ?`
  ).run(i, n, s, ce(), e.ticketId), Q({
    businessId: r.businessId,
    actorUserId: t.id,
    entityType: "pos_ticket",
    entityId: e.ticketId,
    action: "rider_assigned",
    summary: i ? "Rider assigned" : "Rider cleared"
  }), Rt(e.ticketId);
}
function Z0(e) {
  if (j(), X("sales:checkout"), M(e), !jt(ft(e)))
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
function J0(e) {
  if (j(), X("sales:checkout"), re(), !e.itemIds.length) throw new Error("Select items to bump");
  const t = ce(), r = y().prepare(
    `UPDATE pos_ticket_items
     SET kitchen_status = 'bumped', bumped_at = ?
     WHERE id = ? AND kitchen_status IN ('fired', 'ready')`
  );
  return y().transaction(() => {
    for (const i of e.itemIds) r.run(t, i);
  })(), { ok: !0 };
}
function Q0(e) {
  if (j(), X("sales:checkout"), re(), !e.itemIds.length) throw new Error("Select items to recall");
  const t = y().prepare(
    `UPDATE pos_ticket_items
     SET kitchen_status = 'fired', bumped_at = NULL
     WHERE id = ? AND kitchen_status = 'bumped'`
  );
  return y().transaction(() => {
    for (const r of e.itemIds) t.run(r);
  })(), { ok: !0 };
}
function eb(e) {
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
function Bd(e) {
  var c, u;
  const t = e.overridePrice == null || e.overridePrice === "" ? null : Number(e.overridePrice), r = e.percentOff == null || e.percentOff === "" ? null : Number(e.percentOff), i = t != null && Number.isFinite(t), n = r != null && Number.isFinite(r);
  if (i === n)
    throw new Error("Set either an override price or a percent off, not both");
  if (i && t < 0) throw new Error("Override price must be >= 0");
  if (n && (r < 0 || r > 100))
    throw new Error("Percent off must be between 0 and 100");
  const s = ((c = e.productId) == null ? void 0 : c.trim()) || null, a = ((u = e.categoryId) == null ? void 0 : u.trim()) || null;
  if (s && a) throw new Error("Rule cannot target both a product and a category");
  if (!Number.isInteger(e.weekdaysMask) || e.weekdaysMask < 0 || e.weekdaysMask > 127)
    throw new Error("Invalid weekdays mask");
  const o = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!o.test(e.startTime) || !o.test(e.endTime))
    throw new Error("Start and end time must be HH:MM");
  return {
    overridePrice: i ? t : null,
    percentOff: n ? r : null,
    productId: s,
    categoryId: a
  };
}
function tb(e) {
  const t = e ? new Date(e) : /* @__PURE__ */ new Date(), r = t.getFullYear(), i = String(t.getMonth() + 1).padStart(2, "0"), n = String(t.getDate()).padStart(2, "0"), s = String(t.getHours()).padStart(2, "0"), a = String(t.getMinutes()).padStart(2, "0"), o = t.getDay(), c = o === 0 ? 64 : 1 << o - 1;
  return { date: `${r}-${i}-${n}`, weekdayBit: c, hm: `${s}:${a}` };
}
function rb(e, t, r) {
  return t === r ? !0 : t < r ? e >= t && e < r : e >= t || e < r;
}
function ib(e) {
  j(), M(e.businessId);
  const t = y().prepare(
    "SELECT id, price, category_id FROM products WHERE id = ? AND business_id = ? AND is_active = 1"
  ).get(e.productId, e.businessId);
  if (!t) throw new Error("Product not found");
  const { date: r, weekdayBit: i, hm: n } = tb(e.at), s = y().prepare(
    `SELECT id, name, product_id, category_id, override_price, percent_off, weekdays_mask,
              start_time, end_time, priority, valid_from, valid_to
       FROM happy_hour_price_rules
       WHERE business_id = ? AND is_active = 1
       ORDER BY priority DESC, created_at DESC`
  ).all(e.businessId), a = [];
  for (const c of s) {
    if (!(c.weekdays_mask & i) || !rb(n, c.start_time, c.end_time) || c.valid_from && r < c.valid_from.slice(0, 10) || c.valid_to && r > c.valid_to.slice(0, 10)) continue;
    let u = 0;
    if (c.product_id) {
      if (c.product_id !== t.id) continue;
      u = 2;
    } else if (c.category_id) {
      if (!t.category_id || c.category_id !== t.category_id) continue;
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
  } : { unitPrice: t.price, listPrice: t.price, priceRuleId: null, priceRuleName: null };
}
function bn(e) {
  return j(), X("products:view"), M(e), y().prepare(
    `SELECT id, business_id, name, product_id, category_id, override_price, percent_off,
              weekdays_mask, start_time, end_time, priority, is_active, valid_from, valid_to,
              created_at, updated_at
       FROM happy_hour_price_rules WHERE business_id = ?
       ORDER BY priority DESC, name ASC`
  ).all(e).map(eb);
}
function nb(e) {
  var a, o;
  j(), X("products:edit"), M(e.businessId);
  const t = re(), r = e.name.trim();
  if (!r) throw new Error("Rule name is required");
  const i = Bd(e), n = ae(), s = ce();
  return y().prepare(
    `INSERT INTO happy_hour_price_rules (
         id, business_id, name, product_id, category_id, override_price, percent_off,
         weekdays_mask, start_time, end_time, priority, is_active, valid_from, valid_to,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    n,
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
    s,
    s
  ), Q({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "happy_hour_rule",
    entityId: n,
    action: "created",
    summary: `Created happy hour rule ${r}`
  }), bn(e.businessId).find((c) => c.id === n);
}
function sb(e) {
  var a, o;
  j(), X("products:edit");
  const t = re(), r = y().prepare("SELECT business_id FROM happy_hour_price_rules WHERE id = ?").get(e.id);
  if (!r) throw new Error("Rule not found");
  M(r.business_id);
  const i = e.name.trim();
  if (!i) throw new Error("Rule name is required");
  const n = Bd(e), s = ce();
  return y().prepare(
    `UPDATE happy_hour_price_rules SET
         name = ?, product_id = ?, category_id = ?, override_price = ?, percent_off = ?,
         weekdays_mask = ?, start_time = ?, end_time = ?, priority = ?, is_active = ?,
         valid_from = ?, valid_to = ?, updated_at = ?
       WHERE id = ?`
  ).run(
    i,
    n.productId,
    n.categoryId,
    n.overridePrice,
    n.percentOff,
    e.weekdaysMask,
    e.startTime,
    e.endTime,
    e.priority ?? 0,
    e.isActive === !1 ? 0 : 1,
    ((a = e.validFrom) == null ? void 0 : a.trim()) || null,
    ((o = e.validTo) == null ? void 0 : o.trim()) || null,
    s,
    e.id
  ), Q({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "happy_hour_rule",
    entityId: e.id,
    action: "updated",
    summary: `Updated happy hour rule ${i}`
  }), bn(r.business_id).find((c) => c.id === e.id);
}
function ab(e) {
  j(), X("products:edit");
  const t = re(), r = y().prepare("SELECT business_id, name FROM happy_hour_price_rules WHERE id = ?").get(e.id);
  if (!r) throw new Error("Rule not found");
  return M(r.business_id), y().prepare("UPDATE happy_hour_price_rules SET is_active = ?, updated_at = ? WHERE id = ?").run(e.isActive ? 1 : 0, ce(), e.id), Q({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "happy_hour_rule",
    entityId: e.id,
    action: e.isActive ? "activated" : "deactivated",
    summary: `${e.isActive ? "Activated" : "Deactivated"} happy hour rule ${r.name}`
  }), bn(r.business_id).find((i) => i.id === e.id);
}
function ob() {
  C.handle(A.APP_PING, async () => ({
    ok: !0,
    at: (/* @__PURE__ */ new Date()).toISOString()
  })), C.handle(A.APP_GET_INFO, async () => ({
    name: Xe.getName(),
    version: Xe.getVersion(),
    platform: process.platform,
    userDataPath: Xe.getPath("userData")
  })), C.handle(A.APP_GET_BOOT_STATE, async () => qE()), C.handle(A.APP_GET_BRAND_COLOR, async () => KE()), C.handle(A.APP_GET_LANGUAGE, async () => Mt(se.get("language"))), C.handle(A.APP_SET_LANGUAGE, async (e, t) => {
    const r = Mt(t);
    return se.set("language", r), { ok: !0 };
  }), C.handle(A.APP_GET_LICENSE_STATUS, async () => {
    const e = _r();
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
    return r ? (M(r), JE(r)) : [];
  }), C.handle(A.REMINDERS_MAYBE_RUN, async () => (re(), am())), C.handle(A.LICENSE_ACTIVATE, async (e, t) => Ji(t)), C.handle(A.SETUP_COMPLETE, async (e, t) => YE(t)), C.handle(
    A.SETUP_RESTORE_FROM_BACKUP,
    async (e, t) => jE(t, (r) => {
      e.sender.send(A.BACKUP_PROGRESS, r);
    })
  ), C.handle(A.AUTH_LOGIN, async (e, t) => hE(t)), C.handle(
    A.AUTH_RESET_OWNER_PASSWORD_OFFLINE,
    async (e, t) => pE(t)
  ), C.handle(A.AUTH_LOGOUT, async () => gl()), C.handle(A.AUTH_SESSION, async () => Tl()), C.handle(A.BUSINESS_LIST, async () => Zg()), C.handle(A.BUSINESS_CREATE, async (e, t) => Jg(t)), C.handle(A.BUSINESS_UPDATE, async (e, t) => Qg(t)), C.handle(A.BUSINESS_SET_ACTIVE, async (e, t) => e0(t)), C.handle(A.BRANCH_LIST, async (e, t) => t0(t)), C.handle(A.BRANCH_CREATE, async (e, t) => r0(t)), C.handle(A.BRANCH_UPDATE, async (e, t) => i0(t)), C.handle(A.USER_LIST, async (e, t) => n0(t)), C.handle(A.USER_CREATE, async (e, t) => s0(t)), C.handle(A.USER_UPDATE_SELF, async (e, t) => o0(t)), C.handle(A.USER_SET_ACTIVE, async (e, t) => a0(t)), C.handle(A.PRODUCT_LIST, async (e, t) => c0(t)), C.handle(A.PRODUCT_CREATE, async (e, t) => u0(t)), C.handle(A.PRODUCT_UPDATE, async (e, t) => l0(t)), C.handle(A.PRODUCT_SET_ACTIVE, async (e, t) => d0(t)), C.handle(A.PRODUCT_DELETE, async (e, t) => f0(t)), C.handle(
    A.PRODUCT_GENERATE_BARCODE,
    async (e, t) => p0(t)
  ), C.handle(
    A.PRODUCT_ACTIVITY,
    async (e, t) => Hs("product", t)
  ), C.handle(
    A.PRODUCT_LIST_SUPPLIERS,
    async (e, t) => h0(t)
  ), C.handle(A.SUPPLIER_LIST, async (e, t) => _0(t)), C.handle(
    A.SUPPLIER_GET_DETAIL,
    async (e, t) => T0(t)
  ), C.handle(A.SUPPLIER_CREATE, async (e, t) => E0(t)), C.handle(A.SUPPLIER_UPDATE, async (e, t) => m0(t)), C.handle(
    A.SUPPLIER_LIST_PRODUCTS,
    async (e, t) => Ia(t)
  ), C.handle(A.SUPPLIER_LINK_PRODUCT, async (e, t) => g0(t)), C.handle(
    A.SUPPLIER_UNLINK_PRODUCT,
    async (e, t) => b0(t)
  ), C.handle(
    A.SUPPLIER_UPDATE_LINKED_PRODUCT,
    async (e, t) => v0(t)
  ), C.handle(A.PO_LIST, async (e, t) => y0(t)), C.handle(A.PO_GET_DETAIL, async (e, t) => Dd(t)), C.handle(A.PO_CREATE, async (e, t) => w0(t)), C.handle(A.PO_PRINT, async (e, t) => S0(t)), C.handle(A.CUSTOMER_LIST, async (e, t) => R0(t)), C.handle(A.CUSTOMER_GET_DETAIL, async (e, t) => Ud(t)), C.handle(A.CUSTOMER_CREATE, async (e, t) => N0(t)), C.handle(A.CUSTOMER_UPDATE, async (e, t) => I0(t)), C.handle(
    A.CUSTOMER_RECORD_PAYMENT,
    async (e, t) => A0(t)
  ), C.handle(
    A.CUSTOMER_PRINT_LEDGER,
    async (e, t) => L0(t)
  ), C.handle(A.SALES_LIST, async (e, t) => k0(t)), C.handle(A.SALES_GET_DETAIL, async (e, t) => U0(t)), C.handle(
    A.SALES_FIND_BY_INVOICE,
    async (e, t) => P0(t.businessId, t.invoiceNo)
  ), C.handle(A.SALES_CREATE, async (e, t) => O0(t)), C.handle(A.SALES_REFUND_REQUEST, async (e, t) => x0(t)), C.handle(A.SALES_REFUND_REVIEW, async (e, t) => D0(t)), C.handle(A.SALES_PRINT, async (e, t) => F0(t)), C.handle(A.TABLE_LIST, async (e, t) => La(t)), C.handle(A.TABLE_CREATE, async (e, t) => X0(t)), C.handle(A.TABLE_UPDATE, async (e, t) => W0(t)), C.handle(A.TICKET_LIST_OPEN, async (e, t) => z0(t)), C.handle(A.TICKET_GET, async (e, t) => q0(t)), C.handle(A.TICKET_OPEN, async (e, t) => K0(t)), C.handle(A.TICKET_SET_ITEMS, async (e, t) => Y0(t)), C.handle(A.TICKET_CANCEL, async (e, t) => j0(t)), C.handle(A.TICKET_FIRE_ITEMS, async (e, t) => G0(t)), C.handle(A.TICKET_ASSIGN_RIDER, async (e, t) => V0(t)), C.handle(
    A.KITCHEN_LIST_ACTIVE,
    async (e, t) => Z0(t)
  ), C.handle(A.KITCHEN_BUMP, async (e, t) => J0(t)), C.handle(A.KITCHEN_RECALL, async (e, t) => Q0(t)), C.handle(
    A.HAPPY_HOUR_LIST,
    async (e, t) => bn(t)
  ), C.handle(A.HAPPY_HOUR_CREATE, async (e, t) => nb(t)), C.handle(A.HAPPY_HOUR_UPDATE, async (e, t) => sb(t)), C.handle(
    A.HAPPY_HOUR_SET_ACTIVE,
    async (e, t) => ab(t)
  ), C.handle(A.HAPPY_HOUR_RESOLVE_PRICE, async (e, t) => ib(t)), C.handle(A.SALES_UPDATE_DELIVERY, async (e, t) => B0(t)), C.handle(
    A.ACTIVITY_LIST,
    async (e, t) => Hs(t.entityType, t.entityId)
  ), C.handle(
    A.ANALYTICS_SUMMARY,
    async (e, t) => yc(typeof t == "string" ? { businessId: t, days: 30 } : {
      businessId: (t == null ? void 0 : t.businessId) ?? "",
      days: t == null ? void 0 : t.days,
      from: t == null ? void 0 : t.from,
      to: t == null ? void 0 : t.to
    })
  ), C.handle(
    A.ASSETS_PICK_AND_SAVE,
    async (e, t) => yg(t.kind)
  ), C.handle(
    A.BACKUP_CREATE,
    async (e) => BE((t) => {
      e.sender.send(A.BACKUP_PROGRESS, t);
    })
  ), C.handle(
    A.BACKUP_RESTORE,
    async (e, t) => FE(t, (r) => {
      e.sender.send(A.BACKUP_PROGRESS, r);
    })
  ), C.handle(A.BACKUP_PICK_FILE, async () => ME()), C.handle(A.BACKUP_GET_AUTO_SETTINGS, async () => (X("business:view"), Ys())), C.handle(
    A.BACKUP_SET_AUTO_SETTINGS,
    async (e, t) => (X("business:view"), hf(t))
  );
}
const cb = 45e3;
let wc = null, Ts = !1;
function Sc(e = /* @__PURE__ */ new Date()) {
  const t = e.getFullYear(), r = String(e.getMonth() + 1).padStart(2, "0"), i = String(e.getDate()).padStart(2, "0");
  return `${t}-${r}-${i}`;
}
function ub(e) {
  if (!e) return !1;
  const t = new Date(e);
  return Number.isNaN(t.getTime()) ? !1 : Sc(t) === Sc();
}
function lb(e, t = /* @__PURE__ */ new Date()) {
  const r = Ks(e), [i, n] = r.split(":").map(Number);
  return t.getHours() === i && t.getMinutes() === n;
}
async function Rc() {
  if (Ts || PE()) return;
  const e = Ys();
  if (e.autoBackupEnabled && lb(e.autoBackupTime) && !ub(e.lastAutoBackupAt)) {
    Ts = !0;
    try {
      await Rl(), pf();
    } catch (t) {
      console.error("[auto-backup] failed", t);
    } finally {
      Ts = !1;
    }
  }
}
function db() {
  wc || (Rc(), wc = setInterval(() => {
    Rc();
  }, cb));
}
Lc.registerSchemesAsPrivileged([
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
const Fd = F.dirname($d(import.meta.url));
process.env.APP_ROOT = F.join(Fd, "..");
df.config({ path: F.join(process.env.APP_ROOT, ".env") });
const Xs = process.env.VITE_DEV_SERVER_URL, xb = F.join(process.env.APP_ROOT, "dist-electron"), Ws = F.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = Xs ? F.join(process.env.APP_ROOT, "public") : Ws;
let Tt = null;
function Nc() {
  const e = F.join(
    process.env.VITE_PUBLIC ?? Ws,
    "kaarobar-icon.png"
  );
  Tt = new Yi({
    title: "Kaarobar",
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: !1,
    backgroundColor: "#f6f8fb",
    icon: e,
    webPreferences: {
      preload: F.join(Fd, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !0
    }
  }), Tt.once("ready-to-show", () => {
    Tt == null || Tt.show();
  }), Xs ? Tt.loadURL(Xs) : Tt.loadFile(F.join(Ws, "index.html"));
}
Xe.whenReady().then(() => {
  Xe.setPath("userData", Qe()), Lc.handle(
    "kaarobar-asset",
    (e) => vg(e.url)
  ), ob(), Nc(), db(), Xe.on("activate", () => {
    Yi.getAllWindows().length === 0 && Nc();
  });
});
Xe.on("window-all-closed", () => {
  process.platform !== "darwin" && (Xe.quit(), Tt = null);
});
export {
  xb as MAIN_DIST,
  Ws as RENDERER_DIST,
  Xs as VITE_DEV_SERVER_URL
};
