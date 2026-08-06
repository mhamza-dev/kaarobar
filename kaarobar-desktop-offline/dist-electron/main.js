import { app as Xe, dialog as Sc, BrowserWindow as qi, ipcMain as x, protocol as Rc } from "electron";
import { fileURLToPath as Bd } from "node:url";
import P from "node:path";
import Ki from "fs";
import Pd from "path";
import Fd from "os";
import Md from "crypto";
import $d from "electron-store";
import F from "node:fs";
import { createRequire as Nc } from "node:module";
import Hd from "better-sqlite3";
import { randomBytes as Ic, createCipheriv as Lc, createHash as Cc, randomUUID as Ac, scryptSync as Oc, createDecipheriv as kc } from "node:crypto";
import { execFileSync as xc } from "node:child_process";
import Ve from "node:os";
import ar from "bcryptjs";
import Wr from "stream";
import Xd from "events";
import Dc from "buffer";
import ct from "util";
import qr from "zlib";
import zd from "assert";
var be = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function Hs(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var ut = { exports: {} };
const ms = Ki, xi = Pd, Wd = Fd, qd = Md, La = [
  "◈ encrypted .env [www.dotenvx.com]",
  "◈ secrets for agents [www.dotenvx.com]",
  "⌁ auth for agents [www.vestauth.com]",
  "⌘ custom filepath { path: '/custom/path/.env' }",
  "⌘ enable debugging { debug: true }",
  "⌘ override existing { override: true }",
  "⌘ suppress logs { quiet: true }",
  "⌘ multiple files { path: ['.env.local', '.env'] }"
];
function Kd() {
  return La[Math.floor(Math.random() * La.length)];
}
function Qt(e) {
  return typeof e == "string" ? !["false", "0", "no", "off", ""].includes(e.toLowerCase()) : !!e;
}
function Yd() {
  return process.stdout.isTTY;
}
function jd(e) {
  return Yd() ? `\x1B[2m${e}\x1B[0m` : e;
}
const Gd = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
function Vd(e) {
  const t = {};
  let r = e.toString();
  r = r.replace(/\r\n?/mg, `
`);
  let i;
  for (; (i = Gd.exec(r)) != null; ) {
    const n = i[1];
    let s = i[2] || "";
    s = s.trim();
    const a = s[0];
    s = s.replace(/^(['"`])([\s\S]*)\1$/mg, "$2"), a === '"' && (s = s.replace(/\\n/g, `
`), s = s.replace(/\\r/g, "\r")), t[n] = s;
  }
  return t;
}
function Zd(e) {
  e = e || {};
  const t = Pc(e);
  e.path = t;
  const r = Ee.configDotenv(e);
  if (!r.parsed) {
    const a = new Error(`MISSING_DATA: Cannot parse ${t} for an unknown reason`);
    throw a.code = "MISSING_DATA", a;
  }
  const i = Bc(e).split(","), n = i.length;
  let s;
  for (let a = 0; a < n; a++)
    try {
      const o = i[a].trim(), c = Qd(r, o);
      s = Ee.decrypt(c.ciphertext, c.key);
      break;
    } catch (o) {
      if (a + 1 >= n)
        throw o;
    }
  return Ee.parse(s);
}
function Jd(e) {
  console.error(`⚠ ${e}`);
}
function Ar(e) {
  console.log(`┆ ${e}`);
}
function Uc(e) {
  console.log(`◇ ${e}`);
}
function Bc(e) {
  return e && e.DOTENV_KEY && e.DOTENV_KEY.length > 0 ? e.DOTENV_KEY : process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0 ? process.env.DOTENV_KEY : "";
}
function Qd(e, t) {
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
function Pc(e) {
  let t = null;
  if (e && e.path && e.path.length > 0)
    if (Array.isArray(e.path))
      for (const r of e.path)
        ms.existsSync(r) && (t = r.endsWith(".vault") ? r : `${r}.vault`);
    else
      t = e.path.endsWith(".vault") ? e.path : `${e.path}.vault`;
  else
    t = xi.resolve(process.cwd(), ".env.vault");
  return ms.existsSync(t) ? t : null;
}
function Ca(e) {
  return e[0] === "~" ? xi.join(Wd.homedir(), e.slice(1)) : e;
}
function ef(e) {
  const t = Qt(process.env.DOTENV_CONFIG_DEBUG || e && e.debug), r = Qt(process.env.DOTENV_CONFIG_QUIET || e && e.quiet);
  (t || !r) && Uc("loading env from encrypted .env.vault");
  const i = Ee._parseVault(e);
  let n = process.env;
  return e && e.processEnv != null && (n = e.processEnv), Ee.populate(n, i, e), { parsed: i };
}
function tf(e) {
  const t = xi.resolve(process.cwd(), ".env");
  let r = "utf8", i = process.env;
  e && e.processEnv != null && (i = e.processEnv);
  let n = Qt(i.DOTENV_CONFIG_DEBUG || e && e.debug), s = Qt(i.DOTENV_CONFIG_QUIET || e && e.quiet);
  e && e.encoding ? r = e.encoding : n && Ar("no encoding is specified (UTF-8 is used by default)");
  let a = [t];
  if (e && e.path)
    if (!Array.isArray(e.path))
      a = [Ca(e.path)];
    else {
      a = [];
      for (const l of e.path)
        a.push(Ca(l));
    }
  let o;
  const c = {};
  for (const l of a)
    try {
      const p = Ee.parse(ms.readFileSync(l, { encoding: r }));
      Ee.populate(c, p, e);
    } catch (p) {
      n && Ar(`failed to load ${l} ${p.message}`), o = p;
    }
  const u = Ee.populate(i, c, e);
  if (n = Qt(i.DOTENV_CONFIG_DEBUG || n), s = Qt(i.DOTENV_CONFIG_QUIET || s), n || !s) {
    const l = Object.keys(u).length, p = [];
    for (const d of a)
      try {
        const h = xi.relative(process.cwd(), d);
        p.push(h);
      } catch (h) {
        n && Ar(`failed to load ${d} ${h.message}`), o = h;
      }
    Uc(`injected env (${l}) from ${p.join(",")} ${jd(`// tip: ${Kd()}`)}`);
  }
  return o ? { parsed: c, error: o } : { parsed: c };
}
function rf(e) {
  if (Bc(e).length === 0)
    return Ee.configDotenv(e);
  const t = Pc(e);
  return t ? Ee._configVault(e) : (Jd(`you set DOTENV_KEY but you are missing a .env.vault file at ${t}`), Ee.configDotenv(e));
}
function nf(e, t) {
  const r = Buffer.from(t.slice(-64), "hex");
  let i = Buffer.from(e, "base64");
  const n = i.subarray(0, 12), s = i.subarray(-16);
  i = i.subarray(12, -16);
  try {
    const a = qd.createDecipheriv("aes-256-gcm", r, n);
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
function sf(e, t, r = {}) {
  const i = !!(r && r.debug), n = !!(r && r.override), s = {};
  if (typeof t != "object") {
    const a = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
    throw a.code = "OBJECT_REQUIRED", a;
  }
  for (const a of Object.keys(t))
    Object.prototype.hasOwnProperty.call(e, a) ? (n === !0 && (e[a] = t[a], s[a] = t[a]), i && Ar(n === !0 ? `"${a}" is already defined and WAS overwritten` : `"${a}" is already defined and was NOT overwritten`)) : (e[a] = t[a], s[a] = t[a]);
  return s;
}
const Ee = {
  configDotenv: tf,
  _configVault: ef,
  _parseVault: Zd,
  config: rf,
  decrypt: nf,
  parse: Vd,
  populate: sf
};
ut.exports.configDotenv = Ee.configDotenv;
ut.exports._configVault = Ee._configVault;
ut.exports._parseVault = Ee._parseVault;
ut.exports.config = Ee.config;
ut.exports.decrypt = Ee.decrypt;
ut.exports.parse = Ee.parse;
ut.exports.populate = Ee.populate;
ut.exports = Ee;
var af = ut.exports;
const of = /* @__PURE__ */ Hs(af), O = {
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
  return P.join(Xe.getPath("appData"), "Kaarobar");
}
function Xs() {
  return P.join(Qe(), "assets");
}
const re = new $d({
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
}), cf = /^([01]\d|2[0-3]):([0-5]\d)$/;
function zs(e) {
  return e && cf.test(e) ? e : "22:00";
}
function Ws() {
  return {
    autoBackupEnabled: !!re.get("autoBackupEnabled"),
    autoBackupTime: zs(re.get("autoBackupTime")),
    lastAutoBackupAt: re.get("lastAutoBackupAt") ?? null
  };
}
function uf(e) {
  return typeof e.autoBackupEnabled == "boolean" && re.set("autoBackupEnabled", e.autoBackupEnabled), e.autoBackupTime !== void 0 && re.set("autoBackupTime", zs(e.autoBackupTime)), Ws();
}
function lf(e = (/* @__PURE__ */ new Date()).toISOString()) {
  re.set("lastAutoBackupAt", e);
}
let ke = null;
const df = Nc(import.meta.url);
function ff() {
  var e, t, r;
  if (process.platform !== "linux") return !1;
  try {
    const i = (t = (e = process.report) == null ? void 0 : e.getReport) == null ? void 0 : t.call(e);
    return !((r = i == null ? void 0 : i.header) != null && r.glibcVersionRuntime);
  } catch {
    return !1;
  }
}
function hf() {
  try {
    const e = df.resolve("better-sqlite3/package.json"), t = P.dirname(e), r = `${ff() ? "linuxmusl" : process.platform}-${process.arch}`, i = P.join(t, "prebuilds", `${r}.node`);
    if (F.existsSync(i)) return i;
    const n = P.join(t, "build", "Release", "better_sqlite3.node");
    if (F.existsSync(n)) return n;
    const s = P.join(t, "build", "Debug", "better_sqlite3.node");
    if (F.existsSync(s)) return s;
  } catch {
  }
}
function Yi() {
  return P.join(Qe(), "kaarobar.sqlite");
}
function ji() {
  return F.existsSync(Yi());
}
function ze() {
  if (ke) return ke;
  const e = Yi();
  F.mkdirSync(P.dirname(e), { recursive: !0 });
  const t = hf();
  if (!t)
    throw new Error(
      "better-sqlite3 native build is missing (prebuilds/*.node or build/Release/better_sqlite3.node). Run: npm run rebuild:native"
    );
  return ke = new Hd(e, { nativeBinding: t }), ke.pragma("journal_mode = WAL"), ke.pragma("foreign_keys = ON"), ke;
}
function de() {
  if (!ke) throw new Error("Database is not open. Call openDatabase() first.");
  return ke;
}
function qs() {
  ke && (ke.close(), ke = null);
}
function Gi() {
  return ke != null;
}
const pf = "oHvA/EZ5gUAvewdoNUYXsP+PNLfYJab//4/WQT6k0yqDmWsSq8itpco3G2QAALKP", _f = "kaarobar-license-salt";
let oi = null, ci = null;
function Ef() {
  if (ci) return ci;
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
  return ci = Cc("sha256").update(t).digest("hex"), ci;
}
function mf(e) {
  return Cc("sha256").update(`kaarobar::${e}`).digest("hex");
}
function gf() {
  var e;
  try {
    const r = xc("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
      encoding: "utf8",
      timeout: 5e3,
      windowsHide: !0
    }).match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    return ((e = r == null ? void 0 : r[1]) == null ? void 0 : e.trim()) || null;
  } catch {
    return null;
  }
}
function Tf() {
  var e;
  try {
    const r = xc(
      "reg",
      ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      { encoding: "utf8", timeout: 5e3, windowsHide: !0 }
    ).match(/MachineGuid\s+REG_SZ\s+([0-9A-Fa-f-]+)/);
    return ((e = r == null ? void 0 : r[1]) == null ? void 0 : e.trim()) || null;
  } catch {
    return null;
  }
}
function bf() {
  for (const e of ["/etc/machine-id", "/var/lib/dbus/machine-id"])
    try {
      const t = F.readFileSync(e, "utf8").trim();
      if (t) return t;
    } catch {
    }
  return null;
}
function vf() {
  switch (Ve.platform()) {
    case "darwin":
      return gf();
    case "win32":
      return Tf();
    default:
      return bf();
  }
}
function Fc() {
  const e = Ve.homedir();
  switch (Ve.platform()) {
    case "darwin":
      return P.join(e, "Library", "Application Support", "2ndHub", "Kaarobar", "device.id");
    case "win32": {
      const t = process.env.PROGRAMDATA || "C:\\ProgramData";
      return P.join(t, "2ndHub", "Kaarobar", "device.id");
    }
    default:
      return P.join(e, ".local", "share", "2ndHub", "Kaarobar", "device.id");
  }
}
function wf() {
  try {
    return F.readFileSync(Fc(), "utf8").trim() || null;
  } catch {
    return null;
  }
}
function yf(e) {
  const t = Fc();
  F.mkdirSync(P.dirname(t), { recursive: !0 }), F.writeFileSync(t, e, { encoding: "utf8", mode: 384 });
}
function Sf() {
  const e = vf();
  if (e) return e;
  const t = wf();
  if (t) return t;
  const r = Ac();
  try {
    return yf(r), r;
  } catch {
    if (Ve.platform() === "win32") {
      const i = P.join(
        process.env.LOCALAPPDATA || P.join(Ve.homedir(), "AppData", "Local"),
        "2ndHub",
        "Kaarobar",
        "device.id"
      );
      try {
        const n = F.readFileSync(i, "utf8").trim();
        return n || (F.mkdirSync(P.dirname(i), { recursive: !0 }), F.writeFileSync(i, r, { encoding: "utf8", mode: 384 }), r);
      } catch {
        return r;
      }
    }
    return r;
  }
}
function Mc() {
  return oi || (oi = mf(Sf()), oi);
}
function $c(e) {
  return Oc(`${pf}:${e}`, _f, 32);
}
function Hc(e) {
  const t = $c(e.fingerprint), r = Ic(12), i = Lc("aes-256-gcm", t, r), n = Buffer.from(JSON.stringify(e), "utf8"), s = Buffer.concat([i.update(n), i.final()]), a = i.getAuthTag();
  return Buffer.concat([r, a, s]).toString("base64");
}
function Aa(e, t) {
  try {
    const r = Buffer.from(e, "base64"), i = r.subarray(0, 12), n = r.subarray(12, 28), s = r.subarray(28), a = $c(t), o = kc("aes-256-gcm", a, i);
    o.setAuthTag(n);
    const c = Buffer.concat([o.update(s), o.final()]).toString("utf8"), u = JSON.parse(c);
    return u.fingerprint === t ? u : null;
  } catch {
    return null;
  }
}
function Xc(e) {
  const t = Mc(), r = Aa(e, t);
  if (r) return { record: r, migratedFromLegacy: !1 };
  const i = Ef();
  if (i === t) return null;
  const n = Aa(e, i);
  return n ? {
    record: {
      ...n,
      fingerprint: t
    },
    migratedFromLegacy: !0
  } : null;
}
function Rf(e, t = /* @__PURE__ */ new Date()) {
  return e.expiresAt ? new Date(e.expiresAt).getTime() < t.getTime() : !1;
}
let Sn = null;
const gs = /* @__PURE__ */ new Set();
function Nf() {
  return { url: "https://kzrldrpvrdypfvkuvtbv.supabase.co", anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cmxkcnB2cmR5cGZ2a3V2dGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjYxNDIsImV4cCI6MjEwMDgwMjE0Mn0.nmnbGa8GZpYi24CuLq90KOiBGoedLMuRg54pWKLSz74" };
}
function If(e) {
  const t = Hc(e);
  return re.set("licenseBlob", t), t;
}
function zc(e, t) {
  if (!Gi()) return;
  const r = (/* @__PURE__ */ new Date()).toISOString();
  de().prepare(
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
function Di(e) {
  const t = If(e);
  zc(e, t);
}
function Lf(e) {
  e.mode !== "dev" && (!e.licenseKey || gs.has(e.licenseKey) || Sn || (Sn = Vi(e.licenseKey).then((t) => {
    if (t.ok) {
      gs.add(e.licenseKey);
      return;
    }
    t.error === "device_limit_reached" || t.error === "offline" || t.error;
  }).catch(() => {
  }).finally(() => {
    Sn = null;
  })));
}
function Wc(e) {
  return e ? (e.migratedFromLegacy && (Di(e.record), Lf(e.record)), e.record) : null;
}
function Ui() {
  if (!Gi()) return;
  const e = Ks();
  if (!e) return;
  const t = re.get("licenseBlob") || Hc(e);
  zc(e, t);
}
function Cf() {
  if (!Gi()) return null;
  try {
    return de().prepare(
      `SELECT license_key, expires_at, issued_to, fingerprint, activated_at, blob
         FROM app_license WHERE id = 'local'`
    ).get() ?? null;
  } catch {
    return null;
  }
}
function Af() {
  const e = re.get("licenseBlob");
  return e ? Wc(Xc(e)) : null;
}
function Of(e) {
  const t = Wc(Xc(e.blob));
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
function Ks() {
  const e = Cf();
  if (e) return Of(e);
  const t = Af();
  return t && Gi() && Di(t), t;
}
function Bi() {
  const e = hr();
  return e.status === "valid" ? e.record : null;
}
function hr() {
  const e = Ks();
  return e != null && e.licenseKey ? Rf(e) ? { status: "expired", record: e } : { status: "valid", record: e } : { status: "none" };
}
function kf(e) {
  const r = ["invalid_key", "revoked", "expired", "device_limit_reached"].find((n) => n === e);
  return r ? { ok: !1, error: r, message: {
    invalid_key: "This license key is not valid.",
    revoked: "This license has been revoked. Contact support.",
    expired: "This license has expired.",
    device_limit_reached: "This license has reached its device limit."
  }[r] } : { ok: !1, error: "unknown", message: `Activation failed: ${e}` };
}
async function Vi(e) {
  const t = e.trim(), r = Mc(), i = Nf();
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
      return Di(s), { ok: !0, issuedTo: s.issuedTo, expiresAt: null, maxDevices: 1, mode: "dev" };
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
    if (!(a != null && a.ok)) return kf((a == null ? void 0 : a.error) ?? "unknown");
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
    return Di(c), gs.add(t), {
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
const Te = [];
for (let e = 0; e < 256; ++e)
  Te.push((e + 256).toString(16).slice(1));
function xf(e, t = 0) {
  return (Te[e[t + 0]] + Te[e[t + 1]] + Te[e[t + 2]] + Te[e[t + 3]] + "-" + Te[e[t + 4]] + Te[e[t + 5]] + "-" + Te[e[t + 6]] + Te[e[t + 7]] + "-" + Te[e[t + 8]] + Te[e[t + 9]] + "-" + Te[e[t + 10]] + Te[e[t + 11]] + Te[e[t + 12]] + Te[e[t + 13]] + Te[e[t + 14]] + Te[e[t + 15]]).toLowerCase();
}
const Df = new Uint8Array(16);
function Uf() {
  return crypto.getRandomValues(Df);
}
function ne(e, t, r) {
  return crypto.randomUUID ? crypto.randomUUID() : Bf(e);
}
function Bf(e, t, r) {
  var n;
  e = e || {};
  const i = e.random ?? ((n = e.rng) == null ? void 0 : n.call(e)) ?? Uf();
  if (i.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return i[6] = i[6] & 15 | 64, i[8] = i[8] & 63 | 128, xf(i);
}
const Pf = ["en", "ur", "de", "pt", "es", "fr", "ar"], Ff = /* @__PURE__ */ new Set(["ur", "ar"]), Mf = {
  en: "en-US",
  ur: "ur-PK",
  de: "de-DE",
  pt: "pt-BR",
  es: "es-ES",
  fr: "fr-FR",
  ar: "ar-SA"
};
function $f(e) {
  return Pf.includes(e);
}
function Pt(e) {
  const t = e == null ? void 0 : e.trim().toLowerCase().split(/[-_]/)[0];
  return t && $f(t) ? t : "en";
}
function Hf(e) {
  return Ff.has(e);
}
function Xf(e) {
  return Mf[e];
}
const zf = `
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

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL,
  qty REAL NOT NULL CHECK (qty > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  line_total REAL NOT NULL CHECK (line_total >= 0),
  refunded_qty REAL NOT NULL DEFAULT 0 CHECK (refunded_qty >= 0)
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
`, Wf = [
  {
    name: "001_initial_schema",
    up: (e) => {
      e.exec(zf);
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
  for (const i of Wf) {
    if (t.get(i.name)) continue;
    e.transaction(() => {
      i.up(e), r.run(i.name, (/* @__PURE__ */ new Date()).toISOString());
    })();
  }
}
var pr = {}, Rn = {}, fe = {}, ui = { exports: {} }, li = { exports: {} }, Oa;
function Zi() {
  if (Oa) return li.exports;
  Oa = 1, typeof process > "u" || !process.version || process.version.indexOf("v0.") === 0 || process.version.indexOf("v1.") === 0 && process.version.indexOf("v1.8.") !== 0 ? li.exports = { nextTick: e } : li.exports = process;
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
  return li.exports;
}
var Nn, ka;
function qf() {
  if (ka) return Nn;
  ka = 1;
  var e = {}.toString;
  return Nn = Array.isArray || function(t) {
    return e.call(t) == "[object Array]";
  }, Nn;
}
var In, xa;
function qc() {
  return xa || (xa = 1, In = Wr), In;
}
var di = { exports: {} }, Da;
function Ji() {
  return Da || (Da = 1, function(e, t) {
    var r = Dc, i = r.Buffer;
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
  }(di, di.exports)), di.exports;
}
var ge = {}, Ua;
function Kr() {
  if (Ua) return ge;
  Ua = 1;
  function e(E) {
    return Array.isArray ? Array.isArray(E) : _(E) === "[object Array]";
  }
  ge.isArray = e;
  function t(E) {
    return typeof E == "boolean";
  }
  ge.isBoolean = t;
  function r(E) {
    return E === null;
  }
  ge.isNull = r;
  function i(E) {
    return E == null;
  }
  ge.isNullOrUndefined = i;
  function n(E) {
    return typeof E == "number";
  }
  ge.isNumber = n;
  function s(E) {
    return typeof E == "string";
  }
  ge.isString = s;
  function a(E) {
    return typeof E == "symbol";
  }
  ge.isSymbol = a;
  function o(E) {
    return E === void 0;
  }
  ge.isUndefined = o;
  function c(E) {
    return _(E) === "[object RegExp]";
  }
  ge.isRegExp = c;
  function u(E) {
    return typeof E == "object" && E !== null;
  }
  ge.isObject = u;
  function l(E) {
    return _(E) === "[object Date]";
  }
  ge.isDate = l;
  function p(E) {
    return _(E) === "[object Error]" || E instanceof Error;
  }
  ge.isError = p;
  function d(E) {
    return typeof E == "function";
  }
  ge.isFunction = d;
  function h(E) {
    return E === null || typeof E == "boolean" || typeof E == "number" || typeof E == "string" || typeof E == "symbol" || // ES6 symbol
    typeof E > "u";
  }
  ge.isPrimitive = h, ge.isBuffer = Buffer.isBuffer;
  function _(E) {
    return Object.prototype.toString.call(E);
  }
  return ge;
}
var fi = { exports: {} }, hi = { exports: {} }, Ba;
function Kf() {
  return Ba || (Ba = 1, typeof Object.create == "function" ? hi.exports = function(t, r) {
    r && (t.super_ = r, t.prototype = Object.create(r.prototype, {
      constructor: {
        value: t,
        enumerable: !1,
        writable: !0,
        configurable: !0
      }
    }));
  } : hi.exports = function(t, r) {
    if (r) {
      t.super_ = r;
      var i = function() {
      };
      i.prototype = r.prototype, t.prototype = new i(), t.prototype.constructor = t;
    }
  }), hi.exports;
}
var Pa;
function Yr() {
  if (Pa) return fi.exports;
  Pa = 1;
  try {
    var e = require("util");
    if (typeof e.inherits != "function") throw "";
    fi.exports = e.inherits;
  } catch {
    fi.exports = Kf();
  }
  return fi.exports;
}
var Ln = { exports: {} }, Fa;
function Yf() {
  return Fa || (Fa = 1, function(e) {
    function t(s, a) {
      if (!(s instanceof a))
        throw new TypeError("Cannot call a class as a function");
    }
    var r = Ji().Buffer, i = ct;
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
  }(Ln)), Ln.exports;
}
var Cn, Ma;
function Kc() {
  if (Ma) return Cn;
  Ma = 1;
  var e = Zi();
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
  return Cn = {
    destroy: t,
    undestroy: r
  }, Cn;
}
var An, $a;
function jf() {
  return $a || ($a = 1, An = ct.deprecate), An;
}
var On, Ha;
function Yc() {
  if (Ha) return On;
  Ha = 1;
  var e = Zi();
  On = E;
  function t(R) {
    var N = this;
    this.next = null, this.entry = null, this.finish = function() {
      Yt(N, R);
    };
  }
  var r = !process.browser && ["v0.10", "v0.9."].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : e.nextTick, i;
  E.WritableState = h;
  var n = Object.create(Kr());
  n.inherits = Yr();
  var s = {
    deprecate: jf()
  }, a = qc(), o = Ji().Buffer, c = (typeof be < "u" ? be : typeof window < "u" ? window : typeof self < "u" ? self : {}).Uint8Array || function() {
  };
  function u(R) {
    return o.from(R);
  }
  function l(R) {
    return o.isBuffer(R) || R instanceof c;
  }
  var p = Kc();
  n.inherits(E, a);
  function d() {
  }
  function h(R, N) {
    i = i || or(), R = R || {};
    var A = N instanceof i;
    this.objectMode = !!R.objectMode, A && (this.objectMode = this.objectMode || !!R.writableObjectMode);
    var $ = R.highWaterMark, K = R.writableHighWaterMark, V = this.objectMode ? 16 : 16 * 1024;
    $ || $ === 0 ? this.highWaterMark = $ : A && (K || K === 0) ? this.highWaterMark = K : this.highWaterMark = V, this.highWaterMark = Math.floor(this.highWaterMark), this.finalCalled = !1, this.needDrain = !1, this.ending = !1, this.ended = !1, this.finished = !1, this.destroyed = !1;
    var Me = R.decodeStrings === !1;
    this.decodeStrings = !Me, this.defaultEncoding = R.defaultEncoding || "utf8", this.length = 0, this.writing = !1, this.corked = 0, this.sync = !0, this.bufferProcessing = !1, this.onwrite = function($e) {
      I(N, $e);
    }, this.writecb = null, this.writelen = 0, this.bufferedRequest = null, this.lastBufferedRequest = null, this.pendingcb = 0, this.prefinished = !1, this.errorEmitted = !1, this.bufferedRequestCount = 0, this.corkedRequestsFree = new t(this);
  }
  h.prototype.getBuffer = function() {
    for (var N = this.bufferedRequest, A = []; N; )
      A.push(N), N = N.next;
    return A;
  }, function() {
    try {
      Object.defineProperty(h.prototype, "buffer", {
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
      return _.call(this, R) ? !0 : this !== E ? !1 : R && R._writableState instanceof h;
    }
  })) : _ = function(R) {
    return R instanceof this;
  };
  function E(R) {
    if (i = i || or(), !_.call(E, this) && !(this instanceof i))
      return new E(R);
    this._writableState = new h(R, this), this.writable = !0, R && (typeof R.write == "function" && (this._write = R.write), typeof R.writev == "function" && (this._writev = R.writev), typeof R.destroy == "function" && (this._destroy = R.destroy), typeof R.final == "function" && (this._final = R.final)), a.call(this);
  }
  E.prototype.pipe = function() {
    this.emit("error", new Error("Cannot pipe, not readable"));
  };
  function y(R, N) {
    var A = new Error("write after end");
    R.emit("error", A), e.nextTick(N, A);
  }
  function f(R, N, A, $) {
    var K = !0, V = !1;
    return A === null ? V = new TypeError("May not write null values to stream") : typeof A != "string" && A !== void 0 && !N.objectMode && (V = new TypeError("Invalid non-string/buffer chunk")), V && (R.emit("error", V), e.nextTick($, V), K = !1), K;
  }
  E.prototype.write = function(R, N, A) {
    var $ = this._writableState, K = !1, V = !$.objectMode && l(R);
    return V && !o.isBuffer(R) && (R = u(R)), typeof N == "function" && (A = N, N = null), V ? N = "buffer" : N || (N = $.defaultEncoding), typeof A != "function" && (A = d), $.ended ? y(this, A) : (V || f(this, $, R, A)) && ($.pendingcb++, K = b(this, $, V, R, N, A)), K;
  }, E.prototype.cork = function() {
    var R = this._writableState;
    R.corked++;
  }, E.prototype.uncork = function() {
    var R = this._writableState;
    R.corked && (R.corked--, !R.writing && !R.corked && !R.bufferProcessing && R.bufferedRequest && M(this, R));
  }, E.prototype.setDefaultEncoding = function(N) {
    if (typeof N == "string" && (N = N.toLowerCase()), !(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((N + "").toLowerCase()) > -1)) throw new TypeError("Unknown encoding: " + N);
    return this._writableState.defaultEncoding = N, this;
  };
  function m(R, N, A) {
    return !R.objectMode && R.decodeStrings !== !1 && typeof N == "string" && (N = o.from(N, A)), N;
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
  function b(R, N, A, $, K, V) {
    if (!A) {
      var Me = m(N, $, K);
      $ !== Me && (A = !0, K = "buffer", $ = Me);
    }
    var $e = N.objectMode ? 1 : $.length;
    N.length += $e;
    var Lt = N.length < N.highWaterMark;
    if (Lt || (N.needDrain = !0), N.writing || N.corked) {
      var Ct = N.lastBufferedRequest;
      N.lastBufferedRequest = {
        chunk: $,
        encoding: K,
        isBuf: A,
        callback: V,
        next: null
      }, Ct ? Ct.next = N.lastBufferedRequest : N.bufferedRequest = N.lastBufferedRequest, N.bufferedRequestCount += 1;
    } else
      v(R, N, !1, $e, $, K, V);
    return Lt;
  }
  function v(R, N, A, $, K, V, Me) {
    N.writelen = $, N.writecb = Me, N.writing = !0, N.sync = !0, A ? R._writev(K, N.onwrite) : R._write(K, V, N.onwrite), N.sync = !1;
  }
  function w(R, N, A, $, K) {
    --N.pendingcb, A ? (e.nextTick(K, $), e.nextTick(Ae, R, N), R._writableState.errorEmitted = !0, R.emit("error", $)) : (K($), R._writableState.errorEmitted = !0, R.emit("error", $), Ae(R, N));
  }
  function L(R) {
    R.writing = !1, R.writecb = null, R.length -= R.writelen, R.writelen = 0;
  }
  function I(R, N) {
    var A = R._writableState, $ = A.sync, K = A.writecb;
    if (L(A), N) w(R, A, $, N, K);
    else {
      var V = D(A);
      !V && !A.corked && !A.bufferProcessing && A.bufferedRequest && M(R, A), $ ? r(k, R, A, V, K) : k(R, A, V, K);
    }
  }
  function k(R, N, A, $) {
    A || B(R, N), N.pendingcb--, $(), Ae(R, N);
  }
  function B(R, N) {
    N.length === 0 && N.needDrain && (N.needDrain = !1, R.emit("drain"));
  }
  function M(R, N) {
    N.bufferProcessing = !0;
    var A = N.bufferedRequest;
    if (R._writev && A && A.next) {
      var $ = N.bufferedRequestCount, K = new Array($), V = N.corkedRequestsFree;
      V.entry = A;
      for (var Me = 0, $e = !0; A; )
        K[Me] = A, A.isBuf || ($e = !1), A = A.next, Me += 1;
      K.allBuffers = $e, v(R, N, !0, N.length, K, "", V.finish), N.pendingcb++, N.lastBufferedRequest = null, V.next ? (N.corkedRequestsFree = V.next, V.next = null) : N.corkedRequestsFree = new t(N), N.bufferedRequestCount = 0;
    } else {
      for (; A; ) {
        var Lt = A.chunk, Ct = A.encoding, g = A.callback, T = N.objectMode ? 1 : Lt.length;
        if (v(R, N, !1, T, Lt, Ct, g), A = A.next, N.bufferedRequestCount--, N.writing)
          break;
      }
      A === null && (N.lastBufferedRequest = null);
    }
    N.bufferedRequest = A, N.bufferProcessing = !1;
  }
  E.prototype._write = function(R, N, A) {
    A(new Error("_write() is not implemented"));
  }, E.prototype._writev = null, E.prototype.end = function(R, N, A) {
    var $ = this._writableState;
    typeof R == "function" ? (A = R, R = null, N = null) : typeof N == "function" && (A = N, N = null), R != null && this.write(R, N), $.corked && ($.corked = 1, this.uncork()), $.ending || Kt(this, $, A);
  };
  function D(R) {
    return R.ending && R.length === 0 && R.bufferedRequest === null && !R.finished && !R.writing;
  }
  function j(R, N) {
    R._final(function(A) {
      N.pendingcb--, A && R.emit("error", A), N.prefinished = !0, R.emit("prefinish"), Ae(R, N);
    });
  }
  function te(R, N) {
    !N.prefinished && !N.finalCalled && (typeof R._final == "function" ? (N.pendingcb++, N.finalCalled = !0, e.nextTick(j, R, N)) : (N.prefinished = !0, R.emit("prefinish")));
  }
  function Ae(R, N) {
    var A = D(N);
    return A && (te(R, N), N.pendingcb === 0 && (N.finished = !0, R.emit("finish"))), A;
  }
  function Kt(R, N, A) {
    N.ending = !0, Ae(R, N), A && (N.finished ? e.nextTick(A) : R.once("finish", A)), N.ended = !0, R.writable = !1;
  }
  function Yt(R, N, A) {
    var $ = R.entry;
    for (R.entry = null; $; ) {
      var K = $.callback;
      N.pendingcb--, K(A), $ = $.next;
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
  }, On;
}
var kn, Xa;
function or() {
  if (Xa) return kn;
  Xa = 1;
  var e = Zi(), t = Object.keys || function(p) {
    var d = [];
    for (var h in p)
      d.push(h);
    return d;
  };
  kn = c;
  var r = Object.create(Kr());
  r.inherits = Yr();
  var i = jc(), n = Yc();
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
  }, kn;
}
var xn = {}, za;
function Wa() {
  if (za) return xn;
  za = 1;
  var e = Ji().Buffer, t = e.isEncoding || function(f) {
    switch (f = "" + f, f && f.toLowerCase()) {
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
  function r(f) {
    if (!f) return "utf8";
    for (var m; ; )
      switch (f) {
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
          return f;
        default:
          if (m) return;
          f = ("" + f).toLowerCase(), m = !0;
      }
  }
  function i(f) {
    var m = r(f);
    if (typeof m != "string" && (e.isEncoding === t || !t(f))) throw new Error("Unknown encoding: " + f);
    return m || f;
  }
  xn.StringDecoder = n;
  function n(f) {
    this.encoding = i(f);
    var m;
    switch (this.encoding) {
      case "utf16le":
        this.text = p, this.end = d, m = 4;
        break;
      case "utf8":
        this.fillLast = c, m = 4;
        break;
      case "base64":
        this.text = h, this.end = _, m = 3;
        break;
      default:
        this.write = E, this.end = y;
        return;
    }
    this.lastNeed = 0, this.lastTotal = 0, this.lastChar = e.allocUnsafe(m);
  }
  n.prototype.write = function(f) {
    if (f.length === 0) return "";
    var m, b;
    if (this.lastNeed) {
      if (m = this.fillLast(f), m === void 0) return "";
      b = this.lastNeed, this.lastNeed = 0;
    } else
      b = 0;
    return b < f.length ? m ? m + this.text(f, b) : this.text(f, b) : m || "";
  }, n.prototype.end = l, n.prototype.text = u, n.prototype.fillLast = function(f) {
    if (this.lastNeed <= f.length)
      return f.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
    f.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, f.length), this.lastNeed -= f.length;
  };
  function s(f) {
    return f <= 127 ? 0 : f >> 5 === 6 ? 2 : f >> 4 === 14 ? 3 : f >> 3 === 30 ? 4 : f >> 6 === 2 ? -1 : -2;
  }
  function a(f, m, b) {
    var v = m.length - 1;
    if (v < b) return 0;
    var w = s(m[v]);
    return w >= 0 ? (w > 0 && (f.lastNeed = w - 1), w) : --v < b || w === -2 ? 0 : (w = s(m[v]), w >= 0 ? (w > 0 && (f.lastNeed = w - 2), w) : --v < b || w === -2 ? 0 : (w = s(m[v]), w >= 0 ? (w > 0 && (w === 2 ? w = 0 : f.lastNeed = w - 3), w) : 0));
  }
  function o(f, m, b) {
    if ((m[0] & 192) !== 128)
      return f.lastNeed = 0, "�";
    if (f.lastNeed > 1 && m.length > 1) {
      if ((m[1] & 192) !== 128)
        return f.lastNeed = 1, "�";
      if (f.lastNeed > 2 && m.length > 2 && (m[2] & 192) !== 128)
        return f.lastNeed = 2, "�";
    }
  }
  function c(f) {
    var m = this.lastTotal - this.lastNeed, b = o(this, f);
    if (b !== void 0) return b;
    if (this.lastNeed <= f.length)
      return f.copy(this.lastChar, m, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
    f.copy(this.lastChar, m, 0, f.length), this.lastNeed -= f.length;
  }
  function u(f, m) {
    var b = a(this, f, m);
    if (!this.lastNeed) return f.toString("utf8", m);
    this.lastTotal = b;
    var v = f.length - (b - this.lastNeed);
    return f.copy(this.lastChar, 0, v), f.toString("utf8", m, v);
  }
  function l(f) {
    var m = f && f.length ? this.write(f) : "";
    return this.lastNeed ? m + "�" : m;
  }
  function p(f, m) {
    if ((f.length - m) % 2 === 0) {
      var b = f.toString("utf16le", m);
      if (b) {
        var v = b.charCodeAt(b.length - 1);
        if (v >= 55296 && v <= 56319)
          return this.lastNeed = 2, this.lastTotal = 4, this.lastChar[0] = f[f.length - 2], this.lastChar[1] = f[f.length - 1], b.slice(0, -1);
      }
      return b;
    }
    return this.lastNeed = 1, this.lastTotal = 2, this.lastChar[0] = f[f.length - 1], f.toString("utf16le", m, f.length - 1);
  }
  function d(f) {
    var m = f && f.length ? this.write(f) : "";
    if (this.lastNeed) {
      var b = this.lastTotal - this.lastNeed;
      return m + this.lastChar.toString("utf16le", 0, b);
    }
    return m;
  }
  function h(f, m) {
    var b = (f.length - m) % 3;
    return b === 0 ? f.toString("base64", m) : (this.lastNeed = 3 - b, this.lastTotal = 3, b === 1 ? this.lastChar[0] = f[f.length - 1] : (this.lastChar[0] = f[f.length - 2], this.lastChar[1] = f[f.length - 1]), f.toString("base64", m, f.length - b));
  }
  function _(f) {
    var m = f && f.length ? this.write(f) : "";
    return this.lastNeed ? m + this.lastChar.toString("base64", 0, 3 - this.lastNeed) : m;
  }
  function E(f) {
    return f.toString(this.encoding);
  }
  function y(f) {
    return f && f.length ? this.write(f) : "";
  }
  return xn;
}
var Dn, qa;
function jc() {
  if (qa) return Dn;
  qa = 1;
  var e = Zi();
  Dn = m;
  var t = qf(), r;
  m.ReadableState = f, Xd.EventEmitter;
  var i = function(g, T) {
    return g.listeners(T).length;
  }, n = qc(), s = Ji().Buffer, a = (typeof be < "u" ? be : typeof window < "u" ? window : typeof self < "u" ? self : {}).Uint8Array || function() {
  };
  function o(g) {
    return s.from(g);
  }
  function c(g) {
    return s.isBuffer(g) || g instanceof a;
  }
  var u = Object.create(Kr());
  u.inherits = Yr();
  var l = ct, p = void 0;
  l && l.debuglog ? p = l.debuglog("stream") : p = function() {
  };
  var d = Yf(), h = Kc(), _;
  u.inherits(m, n);
  var E = ["error", "close", "destroy", "pause", "resume"];
  function y(g, T, C) {
    if (typeof g.prependListener == "function") return g.prependListener(T, C);
    !g._events || !g._events[T] ? g.on(T, C) : t(g._events[T]) ? g._events[T].unshift(C) : g._events[T] = [C, g._events[T]];
  }
  function f(g, T) {
    r = r || or(), g = g || {};
    var C = T instanceof r;
    this.objectMode = !!g.objectMode, C && (this.objectMode = this.objectMode || !!g.readableObjectMode);
    var U = g.highWaterMark, G = g.readableHighWaterMark, H = this.objectMode ? 16 : 16 * 1024;
    U || U === 0 ? this.highWaterMark = U : C && (G || G === 0) ? this.highWaterMark = G : this.highWaterMark = H, this.highWaterMark = Math.floor(this.highWaterMark), this.buffer = new d(), this.length = 0, this.pipes = null, this.pipesCount = 0, this.flowing = null, this.ended = !1, this.endEmitted = !1, this.reading = !1, this.sync = !0, this.needReadable = !1, this.emittedReadable = !1, this.readableListening = !1, this.resumeScheduled = !1, this.destroyed = !1, this.defaultEncoding = g.defaultEncoding || "utf8", this.awaitDrain = 0, this.readingMore = !1, this.decoder = null, this.encoding = null, g.encoding && (_ || (_ = Wa().StringDecoder), this.decoder = new _(g.encoding), this.encoding = g.encoding);
  }
  function m(g) {
    if (r = r || or(), !(this instanceof m)) return new m(g);
    this._readableState = new f(g, this), this.readable = !0, g && (typeof g.read == "function" && (this._read = g.read), typeof g.destroy == "function" && (this._destroy = g.destroy)), n.call(this);
  }
  Object.defineProperty(m.prototype, "destroyed", {
    get: function() {
      return this._readableState === void 0 ? !1 : this._readableState.destroyed;
    },
    set: function(g) {
      this._readableState && (this._readableState.destroyed = g);
    }
  }), m.prototype.destroy = h.destroy, m.prototype._undestroy = h.undestroy, m.prototype._destroy = function(g, T) {
    this.push(null), T(g);
  }, m.prototype.push = function(g, T) {
    var C = this._readableState, U;
    return C.objectMode ? U = !0 : typeof g == "string" && (T = T || C.defaultEncoding, T !== C.encoding && (g = s.from(g, T), T = ""), U = !0), b(this, g, T, !1, U);
  }, m.prototype.unshift = function(g) {
    return b(this, g, null, !0, !1);
  };
  function b(g, T, C, U, G) {
    var H = g._readableState;
    if (T === null)
      H.reading = !1, M(g, H);
    else {
      var W;
      G || (W = w(H, T)), W ? g.emit("error", W) : H.objectMode || T && T.length > 0 ? (typeof T != "string" && !H.objectMode && Object.getPrototypeOf(T) !== s.prototype && (T = o(T)), U ? H.endEmitted ? g.emit("error", new Error("stream.unshift() after end event")) : v(g, H, T, !0) : H.ended ? g.emit("error", new Error("stream.push() after EOF")) : (H.reading = !1, H.decoder && !C ? (T = H.decoder.write(T), H.objectMode || T.length !== 0 ? v(g, H, T, !1) : te(g, H)) : v(g, H, T, !1))) : U || (H.reading = !1);
    }
    return L(H);
  }
  function v(g, T, C, U) {
    T.flowing && T.length === 0 && !T.sync ? (g.emit("data", C), g.read(0)) : (T.length += T.objectMode ? 1 : C.length, U ? T.buffer.unshift(C) : T.buffer.push(C), T.needReadable && D(g)), te(g, T);
  }
  function w(g, T) {
    var C;
    return !c(T) && typeof T != "string" && T !== void 0 && !g.objectMode && (C = new TypeError("Invalid non-string/buffer chunk")), C;
  }
  function L(g) {
    return !g.ended && (g.needReadable || g.length < g.highWaterMark || g.length === 0);
  }
  m.prototype.isPaused = function() {
    return this._readableState.flowing === !1;
  }, m.prototype.setEncoding = function(g) {
    return _ || (_ = Wa().StringDecoder), this._readableState.decoder = new _(g), this._readableState.encoding = g, this;
  };
  var I = 8388608;
  function k(g) {
    return g >= I ? g = I : (g--, g |= g >>> 1, g |= g >>> 2, g |= g >>> 4, g |= g >>> 8, g |= g >>> 16, g++), g;
  }
  function B(g, T) {
    return g <= 0 || T.length === 0 && T.ended ? 0 : T.objectMode ? 1 : g !== g ? T.flowing && T.length ? T.buffer.head.data.length : T.length : (g > T.highWaterMark && (T.highWaterMark = k(g)), g <= T.length ? g : T.ended ? T.length : (T.needReadable = !0, 0));
  }
  m.prototype.read = function(g) {
    p("read", g), g = parseInt(g, 10);
    var T = this._readableState, C = g;
    if (g !== 0 && (T.emittedReadable = !1), g === 0 && T.needReadable && (T.length >= T.highWaterMark || T.ended))
      return p("read: emitReadable", T.length, T.ended), T.length === 0 && T.ended ? $e(this) : D(this), null;
    if (g = B(g, T), g === 0 && T.ended)
      return T.length === 0 && $e(this), null;
    var U = T.needReadable;
    p("need readable", U), (T.length === 0 || T.length - g < T.highWaterMark) && (U = !0, p("length less than watermark", U)), T.ended || T.reading ? (U = !1, p("reading or ended", U)) : U && (p("do read"), T.reading = !0, T.sync = !0, T.length === 0 && (T.needReadable = !0), this._read(T.highWaterMark), T.sync = !1, T.reading || (g = B(C, T)));
    var G;
    return g > 0 ? G = $(g, T) : G = null, G === null ? (T.needReadable = !0, g = 0) : T.length -= g, T.length === 0 && (T.ended || (T.needReadable = !0), C !== g && T.ended && $e(this)), G !== null && this.emit("data", G), G;
  };
  function M(g, T) {
    if (!T.ended) {
      if (T.decoder) {
        var C = T.decoder.end();
        C && C.length && (T.buffer.push(C), T.length += T.objectMode ? 1 : C.length);
      }
      T.ended = !0, D(g);
    }
  }
  function D(g) {
    var T = g._readableState;
    T.needReadable = !1, T.emittedReadable || (p("emitReadable", T.flowing), T.emittedReadable = !0, T.sync ? e.nextTick(j, g) : j(g));
  }
  function j(g) {
    p("emit readable"), g.emit("readable"), A(g);
  }
  function te(g, T) {
    T.readingMore || (T.readingMore = !0, e.nextTick(Ae, g, T));
  }
  function Ae(g, T) {
    for (var C = T.length; !T.reading && !T.flowing && !T.ended && T.length < T.highWaterMark && (p("maybeReadMore read 0"), g.read(0), C !== T.length); )
      C = T.length;
    T.readingMore = !1;
  }
  m.prototype._read = function(g) {
    this.emit("error", new Error("_read() is not implemented"));
  }, m.prototype.pipe = function(g, T) {
    var C = this, U = this._readableState;
    switch (U.pipesCount) {
      case 0:
        U.pipes = g;
        break;
      case 1:
        U.pipes = [U.pipes, g];
        break;
      default:
        U.pipes.push(g);
        break;
    }
    U.pipesCount += 1, p("pipe count=%d opts=%j", U.pipesCount, T);
    var G = (!T || T.end !== !1) && g !== process.stdout && g !== process.stderr, H = G ? ai : Nr;
    U.endEmitted ? e.nextTick(H) : C.once("end", H), g.on("unpipe", W);
    function W(jt, Ir) {
      p("onunpipe"), jt === C && Ir && Ir.hasUnpiped === !1 && (Ir.hasUnpiped = !0, Ud());
    }
    function ai() {
      p("onend"), g.end();
    }
    var Tn = Kt(C);
    g.on("drain", Tn);
    var Na = !1;
    function Ud() {
      p("cleanup"), g.removeListener("close", wn), g.removeListener("finish", yn), g.removeListener("drain", Tn), g.removeListener("error", vn), g.removeListener("unpipe", W), C.removeListener("end", ai), C.removeListener("end", Nr), C.removeListener("data", Ia), Na = !0, U.awaitDrain && (!g._writableState || g._writableState.needDrain) && Tn();
    }
    var bn = !1;
    C.on("data", Ia);
    function Ia(jt) {
      p("ondata"), bn = !1;
      var Ir = g.write(jt);
      Ir === !1 && !bn && ((U.pipesCount === 1 && U.pipes === g || U.pipesCount > 1 && Ct(U.pipes, g) !== -1) && !Na && (p("false write response, pause", U.awaitDrain), U.awaitDrain++, bn = !0), C.pause());
    }
    function vn(jt) {
      p("onerror", jt), Nr(), g.removeListener("error", vn), i(g, "error") === 0 && g.emit("error", jt);
    }
    y(g, "error", vn);
    function wn() {
      g.removeListener("finish", yn), Nr();
    }
    g.once("close", wn);
    function yn() {
      p("onfinish"), g.removeListener("close", wn), Nr();
    }
    g.once("finish", yn);
    function Nr() {
      p("unpipe"), C.unpipe(g);
    }
    return g.emit("pipe", C), U.flowing || (p("pipe resume"), C.resume()), g;
  };
  function Kt(g) {
    return function() {
      var T = g._readableState;
      p("pipeOnDrain", T.awaitDrain), T.awaitDrain && T.awaitDrain--, T.awaitDrain === 0 && i(g, "data") && (T.flowing = !0, A(g));
    };
  }
  m.prototype.unpipe = function(g) {
    var T = this._readableState, C = { hasUnpiped: !1 };
    if (T.pipesCount === 0) return this;
    if (T.pipesCount === 1)
      return g && g !== T.pipes ? this : (g || (g = T.pipes), T.pipes = null, T.pipesCount = 0, T.flowing = !1, g && g.emit("unpipe", this, C), this);
    if (!g) {
      var U = T.pipes, G = T.pipesCount;
      T.pipes = null, T.pipesCount = 0, T.flowing = !1;
      for (var H = 0; H < G; H++)
        U[H].emit("unpipe", this, { hasUnpiped: !1 });
      return this;
    }
    var W = Ct(T.pipes, g);
    return W === -1 ? this : (T.pipes.splice(W, 1), T.pipesCount -= 1, T.pipesCount === 1 && (T.pipes = T.pipes[0]), g.emit("unpipe", this, C), this);
  }, m.prototype.on = function(g, T) {
    var C = n.prototype.on.call(this, g, T);
    if (g === "data")
      this._readableState.flowing !== !1 && this.resume();
    else if (g === "readable") {
      var U = this._readableState;
      !U.endEmitted && !U.readableListening && (U.readableListening = U.needReadable = !0, U.emittedReadable = !1, U.reading ? U.length && D(this) : e.nextTick(Yt, this));
    }
    return C;
  }, m.prototype.addListener = m.prototype.on;
  function Yt(g) {
    p("readable nexttick read 0"), g.read(0);
  }
  m.prototype.resume = function() {
    var g = this._readableState;
    return g.flowing || (p("resume"), g.flowing = !0, R(this, g)), this;
  };
  function R(g, T) {
    T.resumeScheduled || (T.resumeScheduled = !0, e.nextTick(N, g, T));
  }
  function N(g, T) {
    T.reading || (p("resume read 0"), g.read(0)), T.resumeScheduled = !1, T.awaitDrain = 0, g.emit("resume"), A(g), T.flowing && !T.reading && g.read(0);
  }
  m.prototype.pause = function() {
    return p("call pause flowing=%j", this._readableState.flowing), this._readableState.flowing !== !1 && (p("pause"), this._readableState.flowing = !1, this.emit("pause")), this;
  };
  function A(g) {
    var T = g._readableState;
    for (p("flow", T.flowing); T.flowing && g.read() !== null; )
      ;
  }
  m.prototype.wrap = function(g) {
    var T = this, C = this._readableState, U = !1;
    g.on("end", function() {
      if (p("wrapped end"), C.decoder && !C.ended) {
        var W = C.decoder.end();
        W && W.length && T.push(W);
      }
      T.push(null);
    }), g.on("data", function(W) {
      if (p("wrapped data"), C.decoder && (W = C.decoder.write(W)), !(C.objectMode && W == null) && !(!C.objectMode && (!W || !W.length))) {
        var ai = T.push(W);
        ai || (U = !0, g.pause());
      }
    });
    for (var G in g)
      this[G] === void 0 && typeof g[G] == "function" && (this[G] = /* @__PURE__ */ function(W) {
        return function() {
          return g[W].apply(g, arguments);
        };
      }(G));
    for (var H = 0; H < E.length; H++)
      g.on(E[H], this.emit.bind(this, E[H]));
    return this._read = function(W) {
      p("wrapped _read", W), U && (U = !1, g.resume());
    }, this;
  }, Object.defineProperty(m.prototype, "readableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: !1,
    get: function() {
      return this._readableState.highWaterMark;
    }
  }), m._fromList = $;
  function $(g, T) {
    if (T.length === 0) return null;
    var C;
    return T.objectMode ? C = T.buffer.shift() : !g || g >= T.length ? (T.decoder ? C = T.buffer.join("") : T.buffer.length === 1 ? C = T.buffer.head.data : C = T.buffer.concat(T.length), T.buffer.clear()) : C = K(g, T.buffer, T.decoder), C;
  }
  function K(g, T, C) {
    var U;
    return g < T.head.data.length ? (U = T.head.data.slice(0, g), T.head.data = T.head.data.slice(g)) : g === T.head.data.length ? U = T.shift() : U = C ? V(g, T) : Me(g, T), U;
  }
  function V(g, T) {
    var C = T.head, U = 1, G = C.data;
    for (g -= G.length; C = C.next; ) {
      var H = C.data, W = g > H.length ? H.length : g;
      if (W === H.length ? G += H : G += H.slice(0, g), g -= W, g === 0) {
        W === H.length ? (++U, C.next ? T.head = C.next : T.head = T.tail = null) : (T.head = C, C.data = H.slice(W));
        break;
      }
      ++U;
    }
    return T.length -= U, G;
  }
  function Me(g, T) {
    var C = s.allocUnsafe(g), U = T.head, G = 1;
    for (U.data.copy(C), g -= U.data.length; U = U.next; ) {
      var H = U.data, W = g > H.length ? H.length : g;
      if (H.copy(C, C.length - g, 0, W), g -= W, g === 0) {
        W === H.length ? (++G, U.next ? T.head = U.next : T.head = T.tail = null) : (T.head = U, U.data = H.slice(W));
        break;
      }
      ++G;
    }
    return T.length -= G, C;
  }
  function $e(g) {
    var T = g._readableState;
    if (T.length > 0) throw new Error('"endReadable()" called on non-empty stream');
    T.endEmitted || (T.ended = !0, e.nextTick(Lt, T, g));
  }
  function Lt(g, T) {
    !g.endEmitted && g.length === 0 && (g.endEmitted = !0, T.readable = !1, T.emit("end"));
  }
  function Ct(g, T) {
    for (var C = 0, U = g.length; C < U; C++)
      if (g[C] === T) return C;
    return -1;
  }
  return Dn;
}
var Un, Ka;
function Gc() {
  if (Ka) return Un;
  Ka = 1, Un = i;
  var e = or(), t = Object.create(Kr());
  t.inherits = Yr(), t.inherits(i, e);
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
  return Un;
}
var Bn, Ya;
function Gf() {
  if (Ya) return Bn;
  Ya = 1, Bn = r;
  var e = Gc(), t = Object.create(Kr());
  t.inherits = Yr(), t.inherits(r, e);
  function r(i) {
    if (!(this instanceof r)) return new r(i);
    e.call(this, i);
  }
  return r.prototype._transform = function(i, n, s) {
    s(null, i);
  }, Bn;
}
var ja;
function Vc() {
  return ja || (ja = 1, function(e, t) {
    var r = Wr;
    process.env.READABLE_STREAM === "disable" && r ? (e.exports = r, t = e.exports = r.Readable, t.Readable = r.Readable, t.Writable = r.Writable, t.Duplex = r.Duplex, t.Transform = r.Transform, t.PassThrough = r.PassThrough, t.Stream = r) : (t = e.exports = jc(), t.Stream = r || t, t.Readable = t, t.Writable = Yc(), t.Duplex = or(), t.Transform = Gc(), t.PassThrough = Gf());
  }(ui, ui.exports)), ui.exports;
}
var Ga, pi;
fe.base64 = !0;
fe.array = !0;
fe.string = !0;
fe.arraybuffer = typeof ArrayBuffer < "u" && typeof Uint8Array < "u";
fe.nodebuffer = typeof Buffer < "u";
fe.uint8array = typeof Uint8Array < "u";
if (typeof ArrayBuffer > "u")
  pi = fe.blob = !1;
else {
  var Va = new ArrayBuffer(0);
  try {
    pi = fe.blob = new Blob([Va], {
      type: "application/zip"
    }).size === 0;
  } catch {
    try {
      var Vf = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder, Za = new Vf();
      Za.append(Va), pi = fe.blob = Za.getBlob("application/zip").size === 0;
    } catch {
      pi = fe.blob = !1;
    }
  }
}
try {
  Ga = fe.nodestream = !!Vc().Readable;
} catch {
  Ga = fe.nodestream = !1;
}
var _i = {}, Ja;
function Zc() {
  if (Ja) return _i;
  Ja = 1;
  var e = oe(), t = fe, r = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  return _i.encode = function(i) {
    for (var n = [], s, a, o, c, u, l, p, d = 0, h = i.length, _ = h, E = e.getTypeOf(i) !== "string"; d < i.length; )
      _ = h - d, E ? (s = i[d++], a = d < h ? i[d++] : 0, o = d < h ? i[d++] : 0) : (s = i.charCodeAt(d++), a = d < h ? i.charCodeAt(d++) : 0, o = d < h ? i.charCodeAt(d++) : 0), c = s >> 2, u = (s & 3) << 4 | a >> 4, l = _ > 1 ? (a & 15) << 2 | o >> 6 : 64, p = _ > 2 ? o & 63 : 64, n.push(r.charAt(c) + r.charAt(u) + r.charAt(l) + r.charAt(p));
    return n.join("");
  }, _i.decode = function(i) {
    var n, s, a, o, c, u, l, p = 0, d = 0, h = "data:";
    if (i.substr(0, h.length) === h)
      throw new Error("Invalid base64 input, it looks like a data url.");
    i = i.replace(/[^A-Za-z0-9+/=]/g, "");
    var _ = i.length * 3 / 4;
    if (i.charAt(i.length - 1) === r.charAt(64) && _--, i.charAt(i.length - 2) === r.charAt(64) && _--, _ % 1 !== 0)
      throw new Error("Invalid base64 input, bad content length.");
    var E;
    for (t.uint8array ? E = new Uint8Array(_ | 0) : E = new Array(_ | 0); p < i.length; )
      o = r.indexOf(i.charAt(p++)), c = r.indexOf(i.charAt(p++)), u = r.indexOf(i.charAt(p++)), l = r.indexOf(i.charAt(p++)), n = o << 2 | c >> 4, s = (c & 15) << 4 | u >> 2, a = (u & 3) << 6 | l, E[d++] = n, u !== 64 && (E[d++] = s), l !== 64 && (E[d++] = a);
    return E;
  }, _i;
}
var Qi = {
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
}, Pn, Qa;
function Zf() {
  if (Qa) return Pn;
  Qa = 1;
  var e = be.MutationObserver || be.WebKitMutationObserver, t;
  if (process.browser)
    if (e) {
      var r = 0, i = new e(c), n = be.document.createTextNode("");
      i.observe(n, {
        characterData: !0
      }), t = function() {
        n.data = r = ++r % 2;
      };
    } else if (!be.setImmediate && typeof be.MessageChannel < "u") {
      var s = new be.MessageChannel();
      s.port1.onmessage = c, t = function() {
        s.port2.postMessage(0);
      };
    } else "document" in be && "onreadystatechange" in be.document.createElement("script") ? t = function() {
      var l = be.document.createElement("script");
      l.onreadystatechange = function() {
        c(), l.onreadystatechange = null, l.parentNode.removeChild(l), l = null;
      }, be.document.documentElement.appendChild(l);
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
  Pn = u;
  function u(l) {
    o.push(l) === 1 && !a && t();
  }
  return Pn;
}
var Fn, eo;
function Jf() {
  if (eo) return Fn;
  eo = 1;
  var e = Zf();
  function t() {
  }
  var r = {}, i = ["REJECTED"], n = ["FULFILLED"], s = ["PENDING"];
  if (!process.browser)
    var a = ["UNHANDLED"];
  Fn = o;
  function o(f) {
    if (typeof f != "function")
      throw new TypeError("resolver must be a function");
    this.state = s, this.queue = [], this.outcome = void 0, process.browser || (this.handled = a), f !== t && p(this, f);
  }
  o.prototype.finally = function(f) {
    if (typeof f != "function")
      return this;
    var m = this.constructor;
    return this.then(b, v);
    function b(w) {
      function L() {
        return w;
      }
      return m.resolve(f()).then(L);
    }
    function v(w) {
      function L() {
        throw w;
      }
      return m.resolve(f()).then(L);
    }
  }, o.prototype.catch = function(f) {
    return this.then(null, f);
  }, o.prototype.then = function(f, m) {
    if (typeof f != "function" && this.state === n || typeof m != "function" && this.state === i)
      return this;
    var b = new this.constructor(t);
    if (process.browser || this.handled === a && (this.handled = null), this.state !== s) {
      var v = this.state === n ? f : m;
      u(b, v, this.outcome);
    } else
      this.queue.push(new c(b, f, m));
    return b;
  };
  function c(f, m, b) {
    this.promise = f, typeof m == "function" && (this.onFulfilled = m, this.callFulfilled = this.otherCallFulfilled), typeof b == "function" && (this.onRejected = b, this.callRejected = this.otherCallRejected);
  }
  c.prototype.callFulfilled = function(f) {
    r.resolve(this.promise, f);
  }, c.prototype.otherCallFulfilled = function(f) {
    u(this.promise, this.onFulfilled, f);
  }, c.prototype.callRejected = function(f) {
    r.reject(this.promise, f);
  }, c.prototype.otherCallRejected = function(f) {
    u(this.promise, this.onRejected, f);
  };
  function u(f, m, b) {
    e(function() {
      var v;
      try {
        v = m(b);
      } catch (w) {
        return r.reject(f, w);
      }
      v === f ? r.reject(f, new TypeError("Cannot resolve promise with itself")) : r.resolve(f, v);
    });
  }
  r.resolve = function(f, m) {
    var b = d(l, m);
    if (b.status === "error")
      return r.reject(f, b.value);
    var v = b.value;
    if (v)
      p(f, v);
    else {
      f.state = n, f.outcome = m;
      for (var w = -1, L = f.queue.length; ++w < L; )
        f.queue[w].callFulfilled(m);
    }
    return f;
  }, r.reject = function(f, m) {
    f.state = i, f.outcome = m, process.browser || f.handled === a && e(function() {
      f.handled === a && process.emit("unhandledRejection", m, f);
    });
    for (var b = -1, v = f.queue.length; ++b < v; )
      f.queue[b].callRejected(m);
    return f;
  };
  function l(f) {
    var m = f && f.then;
    if (f && (typeof f == "object" || typeof f == "function") && typeof m == "function")
      return function() {
        m.apply(f, arguments);
      };
  }
  function p(f, m) {
    var b = !1;
    function v(k) {
      b || (b = !0, r.reject(f, k));
    }
    function w(k) {
      b || (b = !0, r.resolve(f, k));
    }
    function L() {
      m(w, v);
    }
    var I = d(L);
    I.status === "error" && v(I.value);
  }
  function d(f, m) {
    var b = {};
    try {
      b.value = f(m), b.status = "success";
    } catch (v) {
      b.status = "error", b.value = v;
    }
    return b;
  }
  o.resolve = h;
  function h(f) {
    return f instanceof this ? f : r.resolve(new this(t), f);
  }
  o.reject = _;
  function _(f) {
    var m = new this(t);
    return r.reject(m, f);
  }
  o.all = E;
  function E(f) {
    var m = this;
    if (Object.prototype.toString.call(f) !== "[object Array]")
      return this.reject(new TypeError("must be an array"));
    var b = f.length, v = !1;
    if (!b)
      return this.resolve([]);
    for (var w = new Array(b), L = 0, I = -1, k = new this(t); ++I < b; )
      B(f[I], I);
    return k;
    function B(M, D) {
      m.resolve(M).then(j, function(te) {
        v || (v = !0, r.reject(k, te));
      });
      function j(te) {
        w[D] = te, ++L === b && !v && (v = !0, r.resolve(k, w));
      }
    }
  }
  o.race = y;
  function y(f) {
    var m = this;
    if (Object.prototype.toString.call(f) !== "[object Array]")
      return this.reject(new TypeError("must be an array"));
    var b = f.length, v = !1;
    if (!b)
      return this.resolve([]);
    for (var w = -1, L = new this(t); ++w < b; )
      I(f[w]);
    return L;
    function I(k) {
      m.resolve(k).then(function(B) {
        v || (v = !0, r.resolve(L, B));
      }, function(B) {
        v || (v = !0, r.reject(L, B));
      });
    }
  }
  return Fn;
}
var Ts = null;
typeof Promise < "u" ? Ts = Promise : Ts = Jf();
var jr = {
  Promise: Ts
};
(function(e, t) {
  if (e.setImmediate)
    return;
  var r = 1, i = {}, n = !1, s = e.document, a;
  function o(m) {
    typeof m != "function" && (m = new Function("" + m));
    for (var b = new Array(arguments.length - 1), v = 0; v < b.length; v++)
      b[v] = arguments[v + 1];
    var w = { callback: m, args: b };
    return i[r] = w, a(r), r++;
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
  function h() {
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
  function y() {
    a = function(m) {
      setTimeout(l, 0, m);
    };
  }
  var f = Object.getPrototypeOf && Object.getPrototypeOf(e);
  f = f && f.setTimeout ? f : e, {}.toString.call(e.process) === "[object process]" ? p() : d() ? h() : e.MessageChannel ? _() : s && "onreadystatechange" in s.createElement("script") ? E() : y(), f.setImmediate = o, f.clearImmediate = c;
})(typeof self > "u" ? be : self);
var to;
function oe() {
  return to || (to = 1, function(e) {
    var t = fe, r = Zc(), i = Qi, n = jr;
    function s(d) {
      var h = null;
      return t.uint8array ? h = new Uint8Array(d.length) : h = new Array(d.length), o(d, h);
    }
    e.newBlob = function(d, h) {
      e.checkSupport("blob");
      try {
        return new Blob([d], {
          type: h
        });
      } catch {
        try {
          var _ = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder, E = new _();
          return E.append(d), E.getBlob(h);
        } catch {
          throw new Error("Bug : can't construct the Blob.");
        }
      }
    };
    function a(d) {
      return d;
    }
    function o(d, h) {
      for (var _ = 0; _ < d.length; ++_)
        h[_] = d.charCodeAt(_) & 255;
      return h;
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
      stringifyByChunk: function(d, h, _) {
        var E = [], y = 0, f = d.length;
        if (f <= _)
          return String.fromCharCode.apply(null, d);
        for (; y < f; )
          h === "array" || h === "nodebuffer" ? E.push(String.fromCharCode.apply(null, d.slice(y, Math.min(y + _, f)))) : E.push(String.fromCharCode.apply(null, d.subarray(y, Math.min(y + _, f)))), y += _;
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
        for (var h = "", _ = 0; _ < d.length; _++)
          h += String.fromCharCode(d[_]);
        return h;
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
      var h = 65536, _ = e.getTypeOf(d), E = !0;
      if (_ === "uint8array" ? E = c.applyCanBeUsed.uint8array : _ === "nodebuffer" && (E = c.applyCanBeUsed.nodebuffer), E)
        for (; h > 1; )
          try {
            return c.stringifyByChunk(d, _, h);
          } catch {
            h = Math.floor(h / 2);
          }
      return c.stringifyByChar(d);
    }
    e.applyFromCharCode = u;
    function l(d, h) {
      for (var _ = 0; _ < d.length; _++)
        h[_] = d[_];
      return h;
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
    }, e.transformTo = function(d, h) {
      if (h || (h = ""), !d)
        return h;
      e.checkSupport(d);
      var _ = e.getTypeOf(h), E = p[_][d](h);
      return E;
    }, e.resolve = function(d) {
      for (var h = d.split("/"), _ = [], E = 0; E < h.length; E++) {
        var y = h[E];
        y === "." || y === "" && E !== 0 && E !== h.length - 1 || (y === ".." ? _.pop() : _.push(y));
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
      var h = t[d.toLowerCase()];
      if (!h)
        throw new Error(d + " is not supported by this platform");
    }, e.MAX_VALUE_16BITS = 65535, e.MAX_VALUE_32BITS = -1, e.pretty = function(d) {
      var h = "", _, E;
      for (E = 0; E < (d || "").length; E++)
        _ = d.charCodeAt(E), h += "\\x" + (_ < 16 ? "0" : "") + _.toString(16).toUpperCase();
      return h;
    }, e.delay = function(d, h, _) {
      setImmediate(function() {
        d.apply(_ || null, h || []);
      });
    }, e.inherits = function(d, h) {
      var _ = function() {
      };
      _.prototype = h.prototype, d.prototype = new _();
    }, e.extend = function() {
      var d = {}, h, _;
      for (h = 0; h < arguments.length; h++)
        for (_ in arguments[h])
          Object.prototype.hasOwnProperty.call(arguments[h], _) && typeof d[_] > "u" && (d[_] = arguments[h][_]);
      return d;
    }, e.prepareContent = function(d, h, _, E, y) {
      var f = n.Promise.resolve(h).then(function(m) {
        var b = t.blob && (m instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(m)) !== -1);
        return b && typeof FileReader < "u" ? new n.Promise(function(v, w) {
          var L = new FileReader();
          L.onload = function(I) {
            v(I.target.result);
          }, L.onerror = function(I) {
            w(I.target.error);
          }, L.readAsArrayBuffer(m);
        }) : m;
      });
      return f.then(function(m) {
        var b = e.getTypeOf(m);
        return b ? (b === "arraybuffer" ? m = e.transformTo("uint8array", m) : b === "string" && (y ? m = r.decode(m) : _ && E !== !0 && (m = s(m))), m) : n.Promise.reject(
          new Error("Can't read the data of '" + d + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?")
        );
      });
    };
  }(Rn)), Rn;
}
function Jc(e) {
  this.name = e || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = !0, this.isFinished = !1, this.isLocked = !1, this._listeners = {
    data: [],
    end: [],
    error: []
  }, this.previous = null;
}
Jc.prototype = {
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
var Pe = Jc;
(function(e) {
  for (var t = oe(), r = fe, i = Qi, n = Pe, s = new Array(256), a = 0; a < 256; a++)
    s[a] = a >= 252 ? 6 : a >= 248 ? 5 : a >= 240 ? 4 : a >= 224 ? 3 : a >= 192 ? 2 : 1;
  s[254] = s[254] = 1;
  var o = function(d) {
    var h, _, E, y, f, m = d.length, b = 0;
    for (y = 0; y < m; y++)
      _ = d.charCodeAt(y), (_ & 64512) === 55296 && y + 1 < m && (E = d.charCodeAt(y + 1), (E & 64512) === 56320 && (_ = 65536 + (_ - 55296 << 10) + (E - 56320), y++)), b += _ < 128 ? 1 : _ < 2048 ? 2 : _ < 65536 ? 3 : 4;
    for (r.uint8array ? h = new Uint8Array(b) : h = new Array(b), f = 0, y = 0; f < b; y++)
      _ = d.charCodeAt(y), (_ & 64512) === 55296 && y + 1 < m && (E = d.charCodeAt(y + 1), (E & 64512) === 56320 && (_ = 65536 + (_ - 55296 << 10) + (E - 56320), y++)), _ < 128 ? h[f++] = _ : _ < 2048 ? (h[f++] = 192 | _ >>> 6, h[f++] = 128 | _ & 63) : _ < 65536 ? (h[f++] = 224 | _ >>> 12, h[f++] = 128 | _ >>> 6 & 63, h[f++] = 128 | _ & 63) : (h[f++] = 240 | _ >>> 18, h[f++] = 128 | _ >>> 12 & 63, h[f++] = 128 | _ >>> 6 & 63, h[f++] = 128 | _ & 63);
    return h;
  }, c = function(d, h) {
    var _;
    for (h = h || d.length, h > d.length && (h = d.length), _ = h - 1; _ >= 0 && (d[_] & 192) === 128; )
      _--;
    return _ < 0 || _ === 0 ? h : _ + s[d[_]] > h ? _ : h;
  }, u = function(d) {
    var h, _, E, y, f = d.length, m = new Array(f * 2);
    for (_ = 0, h = 0; h < f; ) {
      if (E = d[h++], E < 128) {
        m[_++] = E;
        continue;
      }
      if (y = s[E], y > 4) {
        m[_++] = 65533, h += y - 1;
        continue;
      }
      for (E &= y === 2 ? 31 : y === 3 ? 15 : 7; y > 1 && h < f; )
        E = E << 6 | d[h++] & 63, y--;
      if (y > 1) {
        m[_++] = 65533;
        continue;
      }
      E < 65536 ? m[_++] = E : (E -= 65536, m[_++] = 55296 | E >> 10 & 1023, m[_++] = 56320 | E & 1023);
    }
    return m.length !== _ && (m.subarray ? m = m.subarray(0, _) : m.length = _), t.applyFromCharCode(m);
  };
  e.utf8encode = function(h) {
    return r.nodebuffer ? i.newBufferFrom(h, "utf-8") : o(h);
  }, e.utf8decode = function(h) {
    return r.nodebuffer ? t.transformTo("nodebuffer", h).toString("utf-8") : (h = t.transformTo(r.uint8array ? "uint8array" : "array", h), u(h));
  };
  function l() {
    n.call(this, "utf-8 decode"), this.leftOver = null;
  }
  t.inherits(l, n), l.prototype.processChunk = function(d) {
    var h = t.transformTo(r.uint8array ? "uint8array" : "array", d.data);
    if (this.leftOver && this.leftOver.length) {
      if (r.uint8array) {
        var _ = h;
        h = new Uint8Array(_.length + this.leftOver.length), h.set(this.leftOver, 0), h.set(_, this.leftOver.length);
      } else
        h = this.leftOver.concat(h);
      this.leftOver = null;
    }
    var E = c(h), y = h;
    E !== h.length && (r.uint8array ? (y = h.subarray(0, E), this.leftOver = h.subarray(E, h.length)) : (y = h.slice(0, E), this.leftOver = h.slice(E, h.length))), this.push({
      data: e.utf8decode(y),
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
})(pr);
var Qc = Pe, eu = oe();
function Ys(e) {
  Qc.call(this, "ConvertWorker to " + e), this.destType = e;
}
eu.inherits(Ys, Qc);
Ys.prototype.processChunk = function(e) {
  this.push({
    data: eu.transformTo(this.destType, e.data),
    meta: e.meta
  });
};
var Qf = Ys, Mn, ro;
function eh() {
  if (ro) return Mn;
  ro = 1;
  var e = Vc().Readable, t = oe();
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
  }, Mn = r, Mn;
}
var Ut = oe(), th = Qf, rh = Pe, ih = Zc(), nh = fe, sh = jr, tu = null;
if (nh.nodestream)
  try {
    tu = eh();
  } catch {
  }
function ah(e, t, r) {
  switch (e) {
    case "blob":
      return Ut.newBlob(Ut.transformTo("arraybuffer", t), r);
    case "base64":
      return ih.encode(t);
    default:
      return Ut.transformTo(e, t);
  }
}
function oh(e, t) {
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
function ch(e, t) {
  return new sh.Promise(function(r, i) {
    var n = [], s = e._internalType, a = e._outputType, o = e._mimeType;
    e.on("data", function(c, u) {
      n.push(c), t && t(u);
    }).on("error", function(c) {
      n = [], i(c);
    }).on("end", function() {
      try {
        var c = ah(a, oh(s, n), o);
        r(c);
      } catch (u) {
        i(u);
      }
      n = [];
    }).resume();
  });
}
function ru(e, t, r) {
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
    this._internalType = i, this._outputType = t, this._mimeType = r, Ut.checkSupport(i), this._worker = e.pipe(new th(i)), e.lock();
  } catch (n) {
    this._worker = new rh("error"), this._worker.error(n);
  }
}
ru.prototype = {
  /**
   * Listen a StreamHelper, accumulate its content and concatenate it into a
   * complete block.
   * @param {Function} updateCb the update callback.
   * @return Promise the promise for the accumulation.
   */
  accumulate: function(e) {
    return ch(this, e);
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
      Ut.delay(t, arguments, r);
    }), this;
  },
  /**
   * Resume the flow of chunks.
   * @return {StreamHelper} the current helper.
   */
  resume: function() {
    return Ut.delay(this._worker.resume, [], this._worker), this;
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
    if (Ut.checkSupport("nodestream"), this._outputType !== "nodebuffer")
      throw new Error(this._outputType + " is not supported by this method");
    return new tu(this, {
      objectMode: this._outputType !== "nodebuffer"
    }, e);
  }
};
var iu = ru, Fe = {};
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
var en = oe(), tn = Pe, uh = 16 * 1024;
function _r(e) {
  tn.call(this, "DataWorker");
  var t = this;
  this.dataIsReady = !1, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = !1, e.then(function(r) {
    t.dataIsReady = !0, t.data = r, t.max = r && r.length || 0, t.type = en.getTypeOf(r), t.isPaused || t._tickAndRepeat();
  }, function(r) {
    t.error(r);
  });
}
en.inherits(_r, tn);
_r.prototype.cleanUp = function() {
  tn.prototype.cleanUp.call(this), this.data = null;
};
_r.prototype.resume = function() {
  return tn.prototype.resume.call(this) ? (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = !0, en.delay(this._tickAndRepeat, [], this)), !0) : !1;
};
_r.prototype._tickAndRepeat = function() {
  this._tickScheduled = !1, !(this.isPaused || this.isFinished) && (this._tick(), this.isFinished || (en.delay(this._tickAndRepeat, [], this), this._tickScheduled = !0));
};
_r.prototype._tick = function() {
  if (this.isPaused || this.isFinished)
    return !1;
  var e = uh, t = null, r = Math.min(this.max, this.index + e);
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
var nu = _r, lh = oe();
function dh() {
  for (var e, t = [], r = 0; r < 256; r++) {
    e = r;
    for (var i = 0; i < 8; i++)
      e = e & 1 ? 3988292384 ^ e >>> 1 : e >>> 1;
    t[r] = e;
  }
  return t;
}
var su = dh();
function fh(e, t, r, i) {
  var n = su, s = i + r;
  e = e ^ -1;
  for (var a = i; a < s; a++)
    e = e >>> 8 ^ n[(e ^ t[a]) & 255];
  return e ^ -1;
}
function hh(e, t, r, i) {
  var n = su, s = i + r;
  e = e ^ -1;
  for (var a = i; a < s; a++)
    e = e >>> 8 ^ n[(e ^ t.charCodeAt(a)) & 255];
  return e ^ -1;
}
var js = function(t, r) {
  if (typeof t > "u" || !t.length)
    return 0;
  var i = lh.getTypeOf(t) !== "string";
  return i ? fh(r | 0, t, t.length, 0) : hh(r | 0, t, t.length, 0);
}, au = Pe, ph = js, _h = oe();
function Gs() {
  au.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
}
_h.inherits(Gs, au);
Gs.prototype.processChunk = function(e) {
  this.streamInfo.crc32 = ph(e.data, this.streamInfo.crc32 || 0), this.push(e);
};
var ou = Gs, Eh = oe(), Vs = Pe;
function Zs(e) {
  Vs.call(this, "DataLengthProbe for " + e), this.propName = e, this.withStreamInfo(e, 0);
}
Eh.inherits(Zs, Vs);
Zs.prototype.processChunk = function(e) {
  if (e) {
    var t = this.streamInfo[this.propName] || 0;
    this.streamInfo[this.propName] = t + e.data.length;
  }
  Vs.prototype.processChunk.call(this, e);
};
var mh = Zs, io = jr, no = nu, gh = ou, bs = mh;
function Js(e, t, r, i, n) {
  this.compressedSize = e, this.uncompressedSize = t, this.crc32 = r, this.compression = i, this.compressedContent = n;
}
Js.prototype = {
  /**
   * Create a worker to get the uncompressed content.
   * @return {GenericWorker} the worker.
   */
  getContentWorker: function() {
    var e = new no(io.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new bs("data_length")), t = this;
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
    return new no(io.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
  }
};
Js.createWorkerFrom = function(e, t, r) {
  return e.pipe(new gh()).pipe(new bs("uncompressedSize")).pipe(t.compressWorker(r)).pipe(new bs("compressedSize")).withStreamInfo("compression", t);
};
var Qs = Js, Th = iu, bh = nu, $n = pr, Hn = Qs, so = Pe, ea = function(e, t, r) {
  this.name = e, this.dir = r.dir, this.date = r.date, this.comment = r.comment, this.unixPermissions = r.unixPermissions, this.dosPermissions = r.dosPermissions, this._data = t, this._dataBinary = r.binary, this.options = {
    compression: r.compression,
    compressionOptions: r.compressionOptions
  };
};
ea.prototype = {
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
      n && !i && (t = t.pipe(new $n.Utf8EncodeWorker())), !n && i && (t = t.pipe(new $n.Utf8DecodeWorker()));
    } catch (s) {
      t = new so("error"), t.error(s);
    }
    return new Th(t, r, "");
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
    if (this._data instanceof Hn && this._data.compression.magic === e.magic)
      return this._data.getCompressedWorker();
    var r = this._decompressWorker();
    return this._dataBinary || (r = r.pipe(new $n.Utf8EncodeWorker())), Hn.createWorkerFrom(r, e, t);
  },
  /**
   * Return a worker for the decompressed content.
   * @private
   * @return Worker the worker.
   */
  _decompressWorker: function() {
    return this._data instanceof Hn ? this._data.getContentWorker() : this._data instanceof so ? this._data : new bh(this._data);
  }
};
var ao = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], vh = function() {
  throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
};
for (var Xn = 0; Xn < ao.length; Xn++)
  ea.prototype[ao[Xn]] = vh;
var wh = ea, cu = {}, rn = {}, nn = {}, dt = {};
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
var Gr = {}, et = {}, Er = {}, yh = dt, Sh = 4, oo = 0, co = 1, Rh = 2;
function mr(e) {
  for (var t = e.length; --t >= 0; )
    e[t] = 0;
}
var Nh = 0, uu = 1, Ih = 2, Lh = 3, Ch = 258, ta = 29, Vr = 256, Fr = Vr + 1 + ta, ir = 30, ra = 19, lu = 2 * Fr + 1, kt = 15, zn = 16, Ah = 7, ia = 256, du = 16, fu = 17, hu = 18, vs = (
  /* extra bits for each length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
), Ii = (
  /* extra bits for each distance code */
  [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
), Oh = (
  /* extra bits for each bit length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]
), pu = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], kh = 512, ot = new Array((Fr + 2) * 2);
mr(ot);
var Or = new Array(ir * 2);
mr(Or);
var Mr = new Array(kh);
mr(Mr);
var $r = new Array(Ch - Lh + 1);
mr($r);
var na = new Array(ta);
mr(na);
var Pi = new Array(ir);
mr(Pi);
function Wn(e, t, r, i, n) {
  this.static_tree = e, this.extra_bits = t, this.extra_base = r, this.elems = i, this.max_length = n, this.has_stree = e && e.length;
}
var _u, Eu, mu;
function qn(e, t) {
  this.dyn_tree = e, this.max_code = 0, this.stat_desc = t;
}
function gu(e) {
  return e < 256 ? Mr[e] : Mr[256 + (e >>> 7)];
}
function Hr(e, t) {
  e.pending_buf[e.pending++] = t & 255, e.pending_buf[e.pending++] = t >>> 8 & 255;
}
function Ie(e, t, r) {
  e.bi_valid > zn - r ? (e.bi_buf |= t << e.bi_valid & 65535, Hr(e, e.bi_buf), e.bi_buf = t >> zn - e.bi_valid, e.bi_valid += r - zn) : (e.bi_buf |= t << e.bi_valid & 65535, e.bi_valid += r);
}
function Ze(e, t, r) {
  Ie(
    e,
    r[t * 2],
    r[t * 2 + 1]
    /*.Len*/
  );
}
function Tu(e, t) {
  var r = 0;
  do
    r |= e & 1, e >>>= 1, r <<= 1;
  while (--t > 0);
  return r >>> 1;
}
function xh(e) {
  e.bi_valid === 16 ? (Hr(e, e.bi_buf), e.bi_buf = 0, e.bi_valid = 0) : e.bi_valid >= 8 && (e.pending_buf[e.pending++] = e.bi_buf & 255, e.bi_buf >>= 8, e.bi_valid -= 8);
}
function Dh(e, t) {
  var r = t.dyn_tree, i = t.max_code, n = t.stat_desc.static_tree, s = t.stat_desc.has_stree, a = t.stat_desc.extra_bits, o = t.stat_desc.extra_base, c = t.stat_desc.max_length, u, l, p, d, h, _, E = 0;
  for (d = 0; d <= kt; d++)
    e.bl_count[d] = 0;
  for (r[e.heap[e.heap_max] * 2 + 1] = 0, u = e.heap_max + 1; u < lu; u++)
    l = e.heap[u], d = r[r[l * 2 + 1] * 2 + 1] + 1, d > c && (d = c, E++), r[l * 2 + 1] = d, !(l > i) && (e.bl_count[d]++, h = 0, l >= o && (h = a[l - o]), _ = r[l * 2], e.opt_len += _ * (d + h), s && (e.static_len += _ * (n[l * 2 + 1] + h)));
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
function bu(e, t, r) {
  var i = new Array(kt + 1), n = 0, s, a;
  for (s = 1; s <= kt; s++)
    i[s] = n = n + r[s - 1] << 1;
  for (a = 0; a <= t; a++) {
    var o = e[a * 2 + 1];
    o !== 0 && (e[a * 2] = Tu(i[o]++, o));
  }
}
function Uh() {
  var e, t, r, i, n, s = new Array(kt + 1);
  for (r = 0, i = 0; i < ta - 1; i++)
    for (na[i] = r, e = 0; e < 1 << vs[i]; e++)
      $r[r++] = i;
  for ($r[r - 1] = i, n = 0, i = 0; i < 16; i++)
    for (Pi[i] = n, e = 0; e < 1 << Ii[i]; e++)
      Mr[n++] = i;
  for (n >>= 7; i < ir; i++)
    for (Pi[i] = n << 7, e = 0; e < 1 << Ii[i] - 7; e++)
      Mr[256 + n++] = i;
  for (t = 0; t <= kt; t++)
    s[t] = 0;
  for (e = 0; e <= 143; )
    ot[e * 2 + 1] = 8, e++, s[8]++;
  for (; e <= 255; )
    ot[e * 2 + 1] = 9, e++, s[9]++;
  for (; e <= 279; )
    ot[e * 2 + 1] = 7, e++, s[7]++;
  for (; e <= 287; )
    ot[e * 2 + 1] = 8, e++, s[8]++;
  for (bu(ot, Fr + 1, s), e = 0; e < ir; e++)
    Or[e * 2 + 1] = 5, Or[e * 2] = Tu(e, 5);
  _u = new Wn(ot, vs, Vr + 1, Fr, kt), Eu = new Wn(Or, Ii, 0, ir, kt), mu = new Wn(new Array(0), Oh, 0, ra, Ah);
}
function vu(e) {
  var t;
  for (t = 0; t < Fr; t++)
    e.dyn_ltree[t * 2] = 0;
  for (t = 0; t < ir; t++)
    e.dyn_dtree[t * 2] = 0;
  for (t = 0; t < ra; t++)
    e.bl_tree[t * 2] = 0;
  e.dyn_ltree[ia * 2] = 1, e.opt_len = e.static_len = 0, e.last_lit = e.matches = 0;
}
function wu(e) {
  e.bi_valid > 8 ? Hr(e, e.bi_buf) : e.bi_valid > 0 && (e.pending_buf[e.pending++] = e.bi_buf), e.bi_buf = 0, e.bi_valid = 0;
}
function Bh(e, t, r, i) {
  wu(e), Hr(e, r), Hr(e, ~r), yh.arraySet(e.pending_buf, e.window, t, r, e.pending), e.pending += r;
}
function uo(e, t, r, i) {
  var n = t * 2, s = r * 2;
  return e[n] < e[s] || e[n] === e[s] && i[t] <= i[r];
}
function Kn(e, t, r) {
  for (var i = e.heap[r], n = r << 1; n <= e.heap_len && (n < e.heap_len && uo(t, e.heap[n + 1], e.heap[n], e.depth) && n++, !uo(t, i, e.heap[n], e.depth)); )
    e.heap[r] = e.heap[n], r = n, n <<= 1;
  e.heap[r] = i;
}
function lo(e, t, r) {
  var i, n, s = 0, a, o;
  if (e.last_lit !== 0)
    do
      i = e.pending_buf[e.d_buf + s * 2] << 8 | e.pending_buf[e.d_buf + s * 2 + 1], n = e.pending_buf[e.l_buf + s], s++, i === 0 ? Ze(e, n, t) : (a = $r[n], Ze(e, a + Vr + 1, t), o = vs[a], o !== 0 && (n -= na[a], Ie(e, n, o)), i--, a = gu(i), Ze(e, a, r), o = Ii[a], o !== 0 && (i -= Pi[a], Ie(e, i, o)));
    while (s < e.last_lit);
  Ze(e, ia, t);
}
function ws(e, t) {
  var r = t.dyn_tree, i = t.stat_desc.static_tree, n = t.stat_desc.has_stree, s = t.stat_desc.elems, a, o, c = -1, u;
  for (e.heap_len = 0, e.heap_max = lu, a = 0; a < s; a++)
    r[a * 2] !== 0 ? (e.heap[++e.heap_len] = c = a, e.depth[a] = 0) : r[a * 2 + 1] = 0;
  for (; e.heap_len < 2; )
    u = e.heap[++e.heap_len] = c < 2 ? ++c : 0, r[u * 2] = 1, e.depth[u] = 0, e.opt_len--, n && (e.static_len -= i[u * 2 + 1]);
  for (t.max_code = c, a = e.heap_len >> 1; a >= 1; a--)
    Kn(e, r, a);
  u = s;
  do
    a = e.heap[
      1
      /*SMALLEST*/
    ], e.heap[
      1
      /*SMALLEST*/
    ] = e.heap[e.heap_len--], Kn(
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
    ] = u++, Kn(
      e,
      r,
      1
      /*SMALLEST*/
    );
  while (e.heap_len >= 2);
  e.heap[--e.heap_max] = e.heap[
    1
    /*SMALLEST*/
  ], Dh(e, t), bu(r, c, e.bl_count);
}
function fo(e, t, r) {
  var i, n = -1, s, a = t[0 * 2 + 1], o = 0, c = 7, u = 4;
  for (a === 0 && (c = 138, u = 3), t[(r + 1) * 2 + 1] = 65535, i = 0; i <= r; i++)
    s = a, a = t[(i + 1) * 2 + 1], !(++o < c && s === a) && (o < u ? e.bl_tree[s * 2] += o : s !== 0 ? (s !== n && e.bl_tree[s * 2]++, e.bl_tree[du * 2]++) : o <= 10 ? e.bl_tree[fu * 2]++ : e.bl_tree[hu * 2]++, o = 0, n = s, a === 0 ? (c = 138, u = 3) : s === a ? (c = 6, u = 3) : (c = 7, u = 4));
}
function ho(e, t, r) {
  var i, n = -1, s, a = t[0 * 2 + 1], o = 0, c = 7, u = 4;
  for (a === 0 && (c = 138, u = 3), i = 0; i <= r; i++)
    if (s = a, a = t[(i + 1) * 2 + 1], !(++o < c && s === a)) {
      if (o < u)
        do
          Ze(e, s, e.bl_tree);
        while (--o !== 0);
      else s !== 0 ? (s !== n && (Ze(e, s, e.bl_tree), o--), Ze(e, du, e.bl_tree), Ie(e, o - 3, 2)) : o <= 10 ? (Ze(e, fu, e.bl_tree), Ie(e, o - 3, 3)) : (Ze(e, hu, e.bl_tree), Ie(e, o - 11, 7));
      o = 0, n = s, a === 0 ? (c = 138, u = 3) : s === a ? (c = 6, u = 3) : (c = 7, u = 4);
    }
}
function Ph(e) {
  var t;
  for (fo(e, e.dyn_ltree, e.l_desc.max_code), fo(e, e.dyn_dtree, e.d_desc.max_code), ws(e, e.bl_desc), t = ra - 1; t >= 3 && e.bl_tree[pu[t] * 2 + 1] === 0; t--)
    ;
  return e.opt_len += 3 * (t + 1) + 5 + 5 + 4, t;
}
function Fh(e, t, r, i) {
  var n;
  for (Ie(e, t - 257, 5), Ie(e, r - 1, 5), Ie(e, i - 4, 4), n = 0; n < i; n++)
    Ie(e, e.bl_tree[pu[n] * 2 + 1], 3);
  ho(e, e.dyn_ltree, t - 1), ho(e, e.dyn_dtree, r - 1);
}
function Mh(e) {
  var t = 4093624447, r;
  for (r = 0; r <= 31; r++, t >>>= 1)
    if (t & 1 && e.dyn_ltree[r * 2] !== 0)
      return oo;
  if (e.dyn_ltree[9 * 2] !== 0 || e.dyn_ltree[10 * 2] !== 0 || e.dyn_ltree[13 * 2] !== 0)
    return co;
  for (r = 32; r < Vr; r++)
    if (e.dyn_ltree[r * 2] !== 0)
      return co;
  return oo;
}
var po = !1;
function $h(e) {
  po || (Uh(), po = !0), e.l_desc = new qn(e.dyn_ltree, _u), e.d_desc = new qn(e.dyn_dtree, Eu), e.bl_desc = new qn(e.bl_tree, mu), e.bi_buf = 0, e.bi_valid = 0, vu(e);
}
function yu(e, t, r, i) {
  Ie(e, (Nh << 1) + (i ? 1 : 0), 3), Bh(e, t, r);
}
function Hh(e) {
  Ie(e, uu << 1, 3), Ze(e, ia, ot), xh(e);
}
function Xh(e, t, r, i) {
  var n, s, a = 0;
  e.level > 0 ? (e.strm.data_type === Rh && (e.strm.data_type = Mh(e)), ws(e, e.l_desc), ws(e, e.d_desc), a = Ph(e), n = e.opt_len + 3 + 7 >>> 3, s = e.static_len + 3 + 7 >>> 3, s <= n && (n = s)) : n = s = r + 5, r + 4 <= n && t !== -1 ? yu(e, t, r, i) : e.strategy === Sh || s === n ? (Ie(e, (uu << 1) + (i ? 1 : 0), 3), lo(e, ot, Or)) : (Ie(e, (Ih << 1) + (i ? 1 : 0), 3), Fh(e, e.l_desc.max_code + 1, e.d_desc.max_code + 1, a + 1), lo(e, e.dyn_ltree, e.dyn_dtree)), vu(e), i && wu(e);
}
function zh(e, t, r) {
  return e.pending_buf[e.d_buf + e.last_lit * 2] = t >>> 8 & 255, e.pending_buf[e.d_buf + e.last_lit * 2 + 1] = t & 255, e.pending_buf[e.l_buf + e.last_lit] = r & 255, e.last_lit++, t === 0 ? e.dyn_ltree[r * 2]++ : (e.matches++, t--, e.dyn_ltree[($r[r] + Vr + 1) * 2]++, e.dyn_dtree[gu(t) * 2]++), e.last_lit === e.lit_bufsize - 1;
}
Er._tr_init = $h;
Er._tr_stored_block = yu;
Er._tr_flush_block = Xh;
Er._tr_tally = zh;
Er._tr_align = Hh;
function Wh(e, t, r, i) {
  for (var n = e & 65535 | 0, s = e >>> 16 & 65535 | 0, a = 0; r !== 0; ) {
    a = r > 2e3 ? 2e3 : r, r -= a;
    do
      n = n + t[i++] | 0, s = s + n | 0;
    while (--a);
    n %= 65521, s %= 65521;
  }
  return n | s << 16 | 0;
}
var Su = Wh;
function qh() {
  for (var e, t = [], r = 0; r < 256; r++) {
    e = r;
    for (var i = 0; i < 8; i++)
      e = e & 1 ? 3988292384 ^ e >>> 1 : e >>> 1;
    t[r] = e;
  }
  return t;
}
var Kh = qh();
function Yh(e, t, r, i) {
  var n = Kh, s = i + r;
  e ^= -1;
  for (var a = i; a < s; a++)
    e = e >>> 8 ^ n[(e ^ t[a]) & 255];
  return e ^ -1;
}
var Ru = Yh, sa = {
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
}, Se = dt, xe = Er, Nu = Su, pt = Ru, jh = sa, zt = 0, Gh = 1, Vh = 3, wt = 4, _o = 5, Je = 0, Eo = 1, De = -2, Zh = -3, Yn = -5, Jh = -1, Qh = 1, Ei = 2, ep = 3, tp = 4, rp = 0, ip = 2, sn = 8, np = 9, sp = 15, ap = 8, op = 29, cp = 256, ys = cp + 1 + op, up = 30, lp = 19, dp = 2 * ys + 1, fp = 15, q = 3, Tt = 258, We = Tt + q + 1, hp = 32, an = 42, Ss = 69, Li = 73, Ci = 91, Ai = 103, xt = 113, Cr = 666, _e = 1, Zr = 2, Ft = 3, gr = 4, pp = 3;
function bt(e, t) {
  return e.msg = jh[t], t;
}
function mo(e) {
  return (e << 1) - (e > 4 ? 9 : 0);
}
function gt(e) {
  for (var t = e.length; --t >= 0; )
    e[t] = 0;
}
function _t(e) {
  var t = e.state, r = t.pending;
  r > e.avail_out && (r = e.avail_out), r !== 0 && (Se.arraySet(e.output, t.pending_buf, t.pending_out, r, e.next_out), e.next_out += r, t.pending_out += r, e.total_out += r, e.avail_out -= r, t.pending -= r, t.pending === 0 && (t.pending_out = 0));
}
function ve(e, t) {
  xe._tr_flush_block(e, e.block_start >= 0 ? e.block_start : -1, e.strstart - e.block_start, t), e.block_start = e.strstart, _t(e.strm);
}
function Y(e, t) {
  e.pending_buf[e.pending++] = t;
}
function Lr(e, t) {
  e.pending_buf[e.pending++] = t >>> 8 & 255, e.pending_buf[e.pending++] = t & 255;
}
function _p(e, t, r, i) {
  var n = e.avail_in;
  return n > i && (n = i), n === 0 ? 0 : (e.avail_in -= n, Se.arraySet(t, e.input, e.next_in, n, r), e.state.wrap === 1 ? e.adler = Nu(e.adler, t, n, r) : e.state.wrap === 2 && (e.adler = pt(e.adler, t, n, r)), e.next_in += n, e.total_in += n, n);
}
function Iu(e, t) {
  var r = e.max_chain_length, i = e.strstart, n, s, a = e.prev_length, o = e.nice_match, c = e.strstart > e.w_size - We ? e.strstart - (e.w_size - We) : 0, u = e.window, l = e.w_mask, p = e.prev, d = e.strstart + Tt, h = u[i + a - 1], _ = u[i + a];
  e.prev_length >= e.good_match && (r >>= 2), o > e.lookahead && (o = e.lookahead);
  do
    if (n = t, !(u[n + a] !== _ || u[n + a - 1] !== h || u[n] !== u[i] || u[++n] !== u[i + 1])) {
      i += 2, n++;
      do
        ;
      while (u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && u[++i] === u[++n] && i < d);
      if (s = Tt - (d - i), i = d - Tt, s > a) {
        if (e.match_start = t, a = s, s >= o)
          break;
        h = u[i + a - 1], _ = u[i + a];
      }
    }
  while ((t = p[t & l]) > c && --r !== 0);
  return a <= e.lookahead ? a : e.lookahead;
}
function Mt(e) {
  var t = e.w_size, r, i, n, s, a;
  do {
    if (s = e.window_size - e.lookahead - e.strstart, e.strstart >= t + (t - We)) {
      Se.arraySet(e.window, e.window, t, t, 0), e.match_start -= t, e.strstart -= t, e.block_start -= t, i = e.hash_size, r = i;
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
    if (i = _p(e.strm, e.window, e.strstart + e.lookahead, s), e.lookahead += i, e.lookahead + e.insert >= q)
      for (a = e.strstart - e.insert, e.ins_h = e.window[a], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[a + 1]) & e.hash_mask; e.insert && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[a + q - 1]) & e.hash_mask, e.prev[a & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = a, a++, e.insert--, !(e.lookahead + e.insert < q)); )
        ;
  } while (e.lookahead < We && e.strm.avail_in !== 0);
}
function Ep(e, t) {
  var r = 65535;
  for (r > e.pending_buf_size - 5 && (r = e.pending_buf_size - 5); ; ) {
    if (e.lookahead <= 1) {
      if (Mt(e), e.lookahead === 0 && t === zt)
        return _e;
      if (e.lookahead === 0)
        break;
    }
    e.strstart += e.lookahead, e.lookahead = 0;
    var i = e.block_start + r;
    if ((e.strstart === 0 || e.strstart >= i) && (e.lookahead = e.strstart - i, e.strstart = i, ve(e, !1), e.strm.avail_out === 0) || e.strstart - e.block_start >= e.w_size - We && (ve(e, !1), e.strm.avail_out === 0))
      return _e;
  }
  return e.insert = 0, t === wt ? (ve(e, !0), e.strm.avail_out === 0 ? Ft : gr) : (e.strstart > e.block_start && (ve(e, !1), e.strm.avail_out === 0), _e);
}
function jn(e, t) {
  for (var r, i; ; ) {
    if (e.lookahead < We) {
      if (Mt(e), e.lookahead < We && t === zt)
        return _e;
      if (e.lookahead === 0)
        break;
    }
    if (r = 0, e.lookahead >= q && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + q - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), r !== 0 && e.strstart - r <= e.w_size - We && (e.match_length = Iu(e, r)), e.match_length >= q)
      if (i = xe._tr_tally(e, e.strstart - e.match_start, e.match_length - q), e.lookahead -= e.match_length, e.match_length <= e.max_lazy_match && e.lookahead >= q) {
        e.match_length--;
        do
          e.strstart++, e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + q - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart;
        while (--e.match_length !== 0);
        e.strstart++;
      } else
        e.strstart += e.match_length, e.match_length = 0, e.ins_h = e.window[e.strstart], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + 1]) & e.hash_mask;
    else
      i = xe._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++;
    if (i && (ve(e, !1), e.strm.avail_out === 0))
      return _e;
  }
  return e.insert = e.strstart < q - 1 ? e.strstart : q - 1, t === wt ? (ve(e, !0), e.strm.avail_out === 0 ? Ft : gr) : e.last_lit && (ve(e, !1), e.strm.avail_out === 0) ? _e : Zr;
}
function Gt(e, t) {
  for (var r, i, n; ; ) {
    if (e.lookahead < We) {
      if (Mt(e), e.lookahead < We && t === zt)
        return _e;
      if (e.lookahead === 0)
        break;
    }
    if (r = 0, e.lookahead >= q && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + q - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), e.prev_length = e.match_length, e.prev_match = e.match_start, e.match_length = q - 1, r !== 0 && e.prev_length < e.max_lazy_match && e.strstart - r <= e.w_size - We && (e.match_length = Iu(e, r), e.match_length <= 5 && (e.strategy === Qh || e.match_length === q && e.strstart - e.match_start > 4096) && (e.match_length = q - 1)), e.prev_length >= q && e.match_length <= e.prev_length) {
      n = e.strstart + e.lookahead - q, i = xe._tr_tally(e, e.strstart - 1 - e.prev_match, e.prev_length - q), e.lookahead -= e.prev_length - 1, e.prev_length -= 2;
      do
        ++e.strstart <= n && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + q - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart);
      while (--e.prev_length !== 0);
      if (e.match_available = 0, e.match_length = q - 1, e.strstart++, i && (ve(e, !1), e.strm.avail_out === 0))
        return _e;
    } else if (e.match_available) {
      if (i = xe._tr_tally(e, 0, e.window[e.strstart - 1]), i && ve(e, !1), e.strstart++, e.lookahead--, e.strm.avail_out === 0)
        return _e;
    } else
      e.match_available = 1, e.strstart++, e.lookahead--;
  }
  return e.match_available && (i = xe._tr_tally(e, 0, e.window[e.strstart - 1]), e.match_available = 0), e.insert = e.strstart < q - 1 ? e.strstart : q - 1, t === wt ? (ve(e, !0), e.strm.avail_out === 0 ? Ft : gr) : e.last_lit && (ve(e, !1), e.strm.avail_out === 0) ? _e : Zr;
}
function mp(e, t) {
  for (var r, i, n, s, a = e.window; ; ) {
    if (e.lookahead <= Tt) {
      if (Mt(e), e.lookahead <= Tt && t === zt)
        return _e;
      if (e.lookahead === 0)
        break;
    }
    if (e.match_length = 0, e.lookahead >= q && e.strstart > 0 && (n = e.strstart - 1, i = a[n], i === a[++n] && i === a[++n] && i === a[++n])) {
      s = e.strstart + Tt;
      do
        ;
      while (i === a[++n] && i === a[++n] && i === a[++n] && i === a[++n] && i === a[++n] && i === a[++n] && i === a[++n] && i === a[++n] && n < s);
      e.match_length = Tt - (s - n), e.match_length > e.lookahead && (e.match_length = e.lookahead);
    }
    if (e.match_length >= q ? (r = xe._tr_tally(e, 1, e.match_length - q), e.lookahead -= e.match_length, e.strstart += e.match_length, e.match_length = 0) : (r = xe._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++), r && (ve(e, !1), e.strm.avail_out === 0))
      return _e;
  }
  return e.insert = 0, t === wt ? (ve(e, !0), e.strm.avail_out === 0 ? Ft : gr) : e.last_lit && (ve(e, !1), e.strm.avail_out === 0) ? _e : Zr;
}
function gp(e, t) {
  for (var r; ; ) {
    if (e.lookahead === 0 && (Mt(e), e.lookahead === 0)) {
      if (t === zt)
        return _e;
      break;
    }
    if (e.match_length = 0, r = xe._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++, r && (ve(e, !1), e.strm.avail_out === 0))
      return _e;
  }
  return e.insert = 0, t === wt ? (ve(e, !0), e.strm.avail_out === 0 ? Ft : gr) : e.last_lit && (ve(e, !1), e.strm.avail_out === 0) ? _e : Zr;
}
function je(e, t, r, i, n) {
  this.good_length = e, this.max_lazy = t, this.nice_length = r, this.max_chain = i, this.func = n;
}
var er;
er = [
  /*      good lazy nice chain */
  new je(0, 0, 0, 0, Ep),
  /* 0 store only */
  new je(4, 4, 8, 4, jn),
  /* 1 max speed, no lazy matches */
  new je(4, 5, 16, 8, jn),
  /* 2 */
  new je(4, 6, 32, 32, jn),
  /* 3 */
  new je(4, 4, 16, 16, Gt),
  /* 4 lazy matches */
  new je(8, 16, 32, 32, Gt),
  /* 5 */
  new je(8, 16, 128, 128, Gt),
  /* 6 */
  new je(8, 32, 128, 256, Gt),
  /* 7 */
  new je(32, 128, 258, 1024, Gt),
  /* 8 */
  new je(32, 258, 258, 4096, Gt)
  /* 9 max compression */
];
function Tp(e) {
  e.window_size = 2 * e.w_size, gt(e.head), e.max_lazy_match = er[e.level].max_lazy, e.good_match = er[e.level].good_length, e.nice_match = er[e.level].nice_length, e.max_chain_length = er[e.level].max_chain, e.strstart = 0, e.block_start = 0, e.lookahead = 0, e.insert = 0, e.match_length = e.prev_length = q - 1, e.match_available = 0, e.ins_h = 0;
}
function bp() {
  this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = sn, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new Se.Buf16(dp * 2), this.dyn_dtree = new Se.Buf16((2 * up + 1) * 2), this.bl_tree = new Se.Buf16((2 * lp + 1) * 2), gt(this.dyn_ltree), gt(this.dyn_dtree), gt(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new Se.Buf16(fp + 1), this.heap = new Se.Buf16(2 * ys + 1), gt(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new Se.Buf16(2 * ys + 1), gt(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
}
function Lu(e) {
  var t;
  return !e || !e.state ? bt(e, De) : (e.total_in = e.total_out = 0, e.data_type = ip, t = e.state, t.pending = 0, t.pending_out = 0, t.wrap < 0 && (t.wrap = -t.wrap), t.status = t.wrap ? an : xt, e.adler = t.wrap === 2 ? 0 : 1, t.last_flush = zt, xe._tr_init(t), Je);
}
function Cu(e) {
  var t = Lu(e);
  return t === Je && Tp(e.state), t;
}
function vp(e, t) {
  return !e || !e.state || e.state.wrap !== 2 ? De : (e.state.gzhead = t, Je);
}
function Au(e, t, r, i, n, s) {
  if (!e)
    return De;
  var a = 1;
  if (t === Jh && (t = 6), i < 0 ? (a = 0, i = -i) : i > 15 && (a = 2, i -= 16), n < 1 || n > np || r !== sn || i < 8 || i > 15 || t < 0 || t > 9 || s < 0 || s > tp)
    return bt(e, De);
  i === 8 && (i = 9);
  var o = new bp();
  return e.state = o, o.strm = e, o.wrap = a, o.gzhead = null, o.w_bits = i, o.w_size = 1 << o.w_bits, o.w_mask = o.w_size - 1, o.hash_bits = n + 7, o.hash_size = 1 << o.hash_bits, o.hash_mask = o.hash_size - 1, o.hash_shift = ~~((o.hash_bits + q - 1) / q), o.window = new Se.Buf8(o.w_size * 2), o.head = new Se.Buf16(o.hash_size), o.prev = new Se.Buf16(o.w_size), o.lit_bufsize = 1 << n + 6, o.pending_buf_size = o.lit_bufsize * 4, o.pending_buf = new Se.Buf8(o.pending_buf_size), o.d_buf = 1 * o.lit_bufsize, o.l_buf = 3 * o.lit_bufsize, o.level = t, o.strategy = s, o.method = r, Cu(e);
}
function wp(e, t) {
  return Au(e, t, sn, sp, ap, rp);
}
function yp(e, t) {
  var r, i, n, s;
  if (!e || !e.state || t > _o || t < 0)
    return e ? bt(e, De) : De;
  if (i = e.state, !e.output || !e.input && e.avail_in !== 0 || i.status === Cr && t !== wt)
    return bt(e, e.avail_out === 0 ? Yn : De);
  if (i.strm = e, r = i.last_flush, i.last_flush = t, i.status === an)
    if (i.wrap === 2)
      e.adler = 0, Y(i, 31), Y(i, 139), Y(i, 8), i.gzhead ? (Y(
        i,
        (i.gzhead.text ? 1 : 0) + (i.gzhead.hcrc ? 2 : 0) + (i.gzhead.extra ? 4 : 0) + (i.gzhead.name ? 8 : 0) + (i.gzhead.comment ? 16 : 0)
      ), Y(i, i.gzhead.time & 255), Y(i, i.gzhead.time >> 8 & 255), Y(i, i.gzhead.time >> 16 & 255), Y(i, i.gzhead.time >> 24 & 255), Y(i, i.level === 9 ? 2 : i.strategy >= Ei || i.level < 2 ? 4 : 0), Y(i, i.gzhead.os & 255), i.gzhead.extra && i.gzhead.extra.length && (Y(i, i.gzhead.extra.length & 255), Y(i, i.gzhead.extra.length >> 8 & 255)), i.gzhead.hcrc && (e.adler = pt(e.adler, i.pending_buf, i.pending, 0)), i.gzindex = 0, i.status = Ss) : (Y(i, 0), Y(i, 0), Y(i, 0), Y(i, 0), Y(i, 0), Y(i, i.level === 9 ? 2 : i.strategy >= Ei || i.level < 2 ? 4 : 0), Y(i, pp), i.status = xt);
    else {
      var a = sn + (i.w_bits - 8 << 4) << 8, o = -1;
      i.strategy >= Ei || i.level < 2 ? o = 0 : i.level < 6 ? o = 1 : i.level === 6 ? o = 2 : o = 3, a |= o << 6, i.strstart !== 0 && (a |= hp), a += 31 - a % 31, i.status = xt, Lr(i, a), i.strstart !== 0 && (Lr(i, e.adler >>> 16), Lr(i, e.adler & 65535)), e.adler = 1;
    }
  if (i.status === Ss)
    if (i.gzhead.extra) {
      for (n = i.pending; i.gzindex < (i.gzhead.extra.length & 65535) && !(i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > n && (e.adler = pt(e.adler, i.pending_buf, i.pending - n, n)), _t(e), n = i.pending, i.pending === i.pending_buf_size)); )
        Y(i, i.gzhead.extra[i.gzindex] & 255), i.gzindex++;
      i.gzhead.hcrc && i.pending > n && (e.adler = pt(e.adler, i.pending_buf, i.pending - n, n)), i.gzindex === i.gzhead.extra.length && (i.gzindex = 0, i.status = Li);
    } else
      i.status = Li;
  if (i.status === Li)
    if (i.gzhead.name) {
      n = i.pending;
      do {
        if (i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > n && (e.adler = pt(e.adler, i.pending_buf, i.pending - n, n)), _t(e), n = i.pending, i.pending === i.pending_buf_size)) {
          s = 1;
          break;
        }
        i.gzindex < i.gzhead.name.length ? s = i.gzhead.name.charCodeAt(i.gzindex++) & 255 : s = 0, Y(i, s);
      } while (s !== 0);
      i.gzhead.hcrc && i.pending > n && (e.adler = pt(e.adler, i.pending_buf, i.pending - n, n)), s === 0 && (i.gzindex = 0, i.status = Ci);
    } else
      i.status = Ci;
  if (i.status === Ci)
    if (i.gzhead.comment) {
      n = i.pending;
      do {
        if (i.pending === i.pending_buf_size && (i.gzhead.hcrc && i.pending > n && (e.adler = pt(e.adler, i.pending_buf, i.pending - n, n)), _t(e), n = i.pending, i.pending === i.pending_buf_size)) {
          s = 1;
          break;
        }
        i.gzindex < i.gzhead.comment.length ? s = i.gzhead.comment.charCodeAt(i.gzindex++) & 255 : s = 0, Y(i, s);
      } while (s !== 0);
      i.gzhead.hcrc && i.pending > n && (e.adler = pt(e.adler, i.pending_buf, i.pending - n, n)), s === 0 && (i.status = Ai);
    } else
      i.status = Ai;
  if (i.status === Ai && (i.gzhead.hcrc ? (i.pending + 2 > i.pending_buf_size && _t(e), i.pending + 2 <= i.pending_buf_size && (Y(i, e.adler & 255), Y(i, e.adler >> 8 & 255), e.adler = 0, i.status = xt)) : i.status = xt), i.pending !== 0) {
    if (_t(e), e.avail_out === 0)
      return i.last_flush = -1, Je;
  } else if (e.avail_in === 0 && mo(t) <= mo(r) && t !== wt)
    return bt(e, Yn);
  if (i.status === Cr && e.avail_in !== 0)
    return bt(e, Yn);
  if (e.avail_in !== 0 || i.lookahead !== 0 || t !== zt && i.status !== Cr) {
    var c = i.strategy === Ei ? gp(i, t) : i.strategy === ep ? mp(i, t) : er[i.level].func(i, t);
    if ((c === Ft || c === gr) && (i.status = Cr), c === _e || c === Ft)
      return e.avail_out === 0 && (i.last_flush = -1), Je;
    if (c === Zr && (t === Gh ? xe._tr_align(i) : t !== _o && (xe._tr_stored_block(i, 0, 0, !1), t === Vh && (gt(i.head), i.lookahead === 0 && (i.strstart = 0, i.block_start = 0, i.insert = 0))), _t(e), e.avail_out === 0))
      return i.last_flush = -1, Je;
  }
  return t !== wt ? Je : i.wrap <= 0 ? Eo : (i.wrap === 2 ? (Y(i, e.adler & 255), Y(i, e.adler >> 8 & 255), Y(i, e.adler >> 16 & 255), Y(i, e.adler >> 24 & 255), Y(i, e.total_in & 255), Y(i, e.total_in >> 8 & 255), Y(i, e.total_in >> 16 & 255), Y(i, e.total_in >> 24 & 255)) : (Lr(i, e.adler >>> 16), Lr(i, e.adler & 65535)), _t(e), i.wrap > 0 && (i.wrap = -i.wrap), i.pending !== 0 ? Je : Eo);
}
function Sp(e) {
  var t;
  return !e || !e.state ? De : (t = e.state.status, t !== an && t !== Ss && t !== Li && t !== Ci && t !== Ai && t !== xt && t !== Cr ? bt(e, De) : (e.state = null, t === xt ? bt(e, Zh) : Je));
}
function Rp(e, t) {
  var r = t.length, i, n, s, a, o, c, u, l;
  if (!e || !e.state || (i = e.state, a = i.wrap, a === 2 || a === 1 && i.status !== an || i.lookahead))
    return De;
  for (a === 1 && (e.adler = Nu(e.adler, t, r, 0)), i.wrap = 0, r >= i.w_size && (a === 0 && (gt(i.head), i.strstart = 0, i.block_start = 0, i.insert = 0), l = new Se.Buf8(i.w_size), Se.arraySet(l, t, r - i.w_size, i.w_size, 0), t = l, r = i.w_size), o = e.avail_in, c = e.next_in, u = e.input, e.avail_in = r, e.next_in = 0, e.input = t, Mt(i); i.lookahead >= q; ) {
    n = i.strstart, s = i.lookahead - (q - 1);
    do
      i.ins_h = (i.ins_h << i.hash_shift ^ i.window[n + q - 1]) & i.hash_mask, i.prev[n & i.w_mask] = i.head[i.ins_h], i.head[i.ins_h] = n, n++;
    while (--s);
    i.strstart = n, i.lookahead = q - 1, Mt(i);
  }
  return i.strstart += i.lookahead, i.block_start = i.strstart, i.insert = i.lookahead, i.lookahead = 0, i.match_length = i.prev_length = q - 1, i.match_available = 0, e.next_in = c, e.input = u, e.avail_in = o, i.wrap = a, Je;
}
et.deflateInit = wp;
et.deflateInit2 = Au;
et.deflateReset = Cu;
et.deflateResetKeep = Lu;
et.deflateSetHeader = vp;
et.deflate = yp;
et.deflateEnd = Sp;
et.deflateSetDictionary = Rp;
et.deflateInfo = "pako deflate (from Nodeca project)";
var Wt = {}, on = dt, Ou = !0, ku = !0;
try {
  String.fromCharCode.apply(null, [0]);
} catch {
  Ou = !1;
}
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch {
  ku = !1;
}
var Xr = new on.Buf8(256);
for (var ft = 0; ft < 256; ft++)
  Xr[ft] = ft >= 252 ? 6 : ft >= 248 ? 5 : ft >= 240 ? 4 : ft >= 224 ? 3 : ft >= 192 ? 2 : 1;
Xr[254] = Xr[254] = 1;
Wt.string2buf = function(e) {
  var t, r, i, n, s, a = e.length, o = 0;
  for (n = 0; n < a; n++)
    r = e.charCodeAt(n), (r & 64512) === 55296 && n + 1 < a && (i = e.charCodeAt(n + 1), (i & 64512) === 56320 && (r = 65536 + (r - 55296 << 10) + (i - 56320), n++)), o += r < 128 ? 1 : r < 2048 ? 2 : r < 65536 ? 3 : 4;
  for (t = new on.Buf8(o), s = 0, n = 0; s < o; n++)
    r = e.charCodeAt(n), (r & 64512) === 55296 && n + 1 < a && (i = e.charCodeAt(n + 1), (i & 64512) === 56320 && (r = 65536 + (r - 55296 << 10) + (i - 56320), n++)), r < 128 ? t[s++] = r : r < 2048 ? (t[s++] = 192 | r >>> 6, t[s++] = 128 | r & 63) : r < 65536 ? (t[s++] = 224 | r >>> 12, t[s++] = 128 | r >>> 6 & 63, t[s++] = 128 | r & 63) : (t[s++] = 240 | r >>> 18, t[s++] = 128 | r >>> 12 & 63, t[s++] = 128 | r >>> 6 & 63, t[s++] = 128 | r & 63);
  return t;
};
function xu(e, t) {
  if (t < 65534 && (e.subarray && ku || !e.subarray && Ou))
    return String.fromCharCode.apply(null, on.shrinkBuf(e, t));
  for (var r = "", i = 0; i < t; i++)
    r += String.fromCharCode(e[i]);
  return r;
}
Wt.buf2binstring = function(e) {
  return xu(e, e.length);
};
Wt.binstring2buf = function(e) {
  for (var t = new on.Buf8(e.length), r = 0, i = t.length; r < i; r++)
    t[r] = e.charCodeAt(r);
  return t;
};
Wt.buf2string = function(e, t) {
  var r, i, n, s, a = t || e.length, o = new Array(a * 2);
  for (i = 0, r = 0; r < a; ) {
    if (n = e[r++], n < 128) {
      o[i++] = n;
      continue;
    }
    if (s = Xr[n], s > 4) {
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
  return xu(o, i);
};
Wt.utf8border = function(e, t) {
  var r;
  for (t = t || e.length, t > e.length && (t = e.length), r = t - 1; r >= 0 && (e[r] & 192) === 128; )
    r--;
  return r < 0 || r === 0 ? t : r + Xr[e[r]] > t ? r : t;
};
function Np() {
  this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
}
var Du = Np, kr = et, xr = dt, Rs = Wt, Ns = sa, Ip = Du, Uu = Object.prototype.toString, Lp = 0, Gn = 4, nr = 0, go = 1, To = 2, Cp = -1, Ap = 0, Op = 8;
function $t(e) {
  if (!(this instanceof $t)) return new $t(e);
  this.options = xr.assign({
    level: Cp,
    method: Op,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Ap,
    to: ""
  }, e || {});
  var t = this.options;
  t.raw && t.windowBits > 0 ? t.windowBits = -t.windowBits : t.gzip && t.windowBits > 0 && t.windowBits < 16 && (t.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new Ip(), this.strm.avail_out = 0;
  var r = kr.deflateInit2(
    this.strm,
    t.level,
    t.method,
    t.windowBits,
    t.memLevel,
    t.strategy
  );
  if (r !== nr)
    throw new Error(Ns[r]);
  if (t.header && kr.deflateSetHeader(this.strm, t.header), t.dictionary) {
    var i;
    if (typeof t.dictionary == "string" ? i = Rs.string2buf(t.dictionary) : Uu.call(t.dictionary) === "[object ArrayBuffer]" ? i = new Uint8Array(t.dictionary) : i = t.dictionary, r = kr.deflateSetDictionary(this.strm, i), r !== nr)
      throw new Error(Ns[r]);
    this._dict_set = !0;
  }
}
$t.prototype.push = function(e, t) {
  var r = this.strm, i = this.options.chunkSize, n, s;
  if (this.ended)
    return !1;
  s = t === ~~t ? t : t === !0 ? Gn : Lp, typeof e == "string" ? r.input = Rs.string2buf(e) : Uu.call(e) === "[object ArrayBuffer]" ? r.input = new Uint8Array(e) : r.input = e, r.next_in = 0, r.avail_in = r.input.length;
  do {
    if (r.avail_out === 0 && (r.output = new xr.Buf8(i), r.next_out = 0, r.avail_out = i), n = kr.deflate(r, s), n !== go && n !== nr)
      return this.onEnd(n), this.ended = !0, !1;
    (r.avail_out === 0 || r.avail_in === 0 && (s === Gn || s === To)) && (this.options.to === "string" ? this.onData(Rs.buf2binstring(xr.shrinkBuf(r.output, r.next_out))) : this.onData(xr.shrinkBuf(r.output, r.next_out)));
  } while ((r.avail_in > 0 || r.avail_out === 0) && n !== go);
  return s === Gn ? (n = kr.deflateEnd(this.strm), this.onEnd(n), this.ended = !0, n === nr) : (s === To && (this.onEnd(nr), r.avail_out = 0), !0);
};
$t.prototype.onData = function(e) {
  this.chunks.push(e);
};
$t.prototype.onEnd = function(e) {
  e === nr && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = xr.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg;
};
function aa(e, t) {
  var r = new $t(t);
  if (r.push(e, !0), r.err)
    throw r.msg || Ns[r.err];
  return r.result;
}
function kp(e, t) {
  return t = t || {}, t.raw = !0, aa(e, t);
}
function xp(e, t) {
  return t = t || {}, t.gzip = !0, aa(e, t);
}
Gr.Deflate = $t;
Gr.deflate = aa;
Gr.deflateRaw = kp;
Gr.gzip = xp;
var Jr = {}, Ke = {}, mi = 30, Dp = 12, Up = function(t, r) {
  var i, n, s, a, o, c, u, l, p, d, h, _, E, y, f, m, b, v, w, L, I, k, B, M, D;
  i = t.state, n = t.next_in, M = t.input, s = n + (t.avail_in - 5), a = t.next_out, D = t.output, o = a - (r - t.avail_out), c = a + (t.avail_out - 257), u = i.dmax, l = i.wsize, p = i.whave, d = i.wnext, h = i.window, _ = i.hold, E = i.bits, y = i.lencode, f = i.distcode, m = (1 << i.lenbits) - 1, b = (1 << i.distbits) - 1;
  e:
    do {
      E < 15 && (_ += M[n++] << E, E += 8, _ += M[n++] << E, E += 8), v = y[_ & m];
      t:
        for (; ; ) {
          if (w = v >>> 24, _ >>>= w, E -= w, w = v >>> 16 & 255, w === 0)
            D[a++] = v & 65535;
          else if (w & 16) {
            L = v & 65535, w &= 15, w && (E < w && (_ += M[n++] << E, E += 8), L += _ & (1 << w) - 1, _ >>>= w, E -= w), E < 15 && (_ += M[n++] << E, E += 8, _ += M[n++] << E, E += 8), v = f[_ & b];
            r:
              for (; ; ) {
                if (w = v >>> 24, _ >>>= w, E -= w, w = v >>> 16 & 255, w & 16) {
                  if (I = v & 65535, w &= 15, E < w && (_ += M[n++] << E, E += 8, E < w && (_ += M[n++] << E, E += 8)), I += _ & (1 << w) - 1, I > u) {
                    t.msg = "invalid distance too far back", i.mode = mi;
                    break e;
                  }
                  if (_ >>>= w, E -= w, w = a - o, I > w) {
                    if (w = I - w, w > p && i.sane) {
                      t.msg = "invalid distance too far back", i.mode = mi;
                      break e;
                    }
                    if (k = 0, B = h, d === 0) {
                      if (k += l - w, w < L) {
                        L -= w;
                        do
                          D[a++] = h[k++];
                        while (--w);
                        k = a - I, B = D;
                      }
                    } else if (d < w) {
                      if (k += l + d - w, w -= d, w < L) {
                        L -= w;
                        do
                          D[a++] = h[k++];
                        while (--w);
                        if (k = 0, d < L) {
                          w = d, L -= w;
                          do
                            D[a++] = h[k++];
                          while (--w);
                          k = a - I, B = D;
                        }
                      }
                    } else if (k += d - w, w < L) {
                      L -= w;
                      do
                        D[a++] = h[k++];
                      while (--w);
                      k = a - I, B = D;
                    }
                    for (; L > 2; )
                      D[a++] = B[k++], D[a++] = B[k++], D[a++] = B[k++], L -= 3;
                    L && (D[a++] = B[k++], L > 1 && (D[a++] = B[k++]));
                  } else {
                    k = a - I;
                    do
                      D[a++] = D[k++], D[a++] = D[k++], D[a++] = D[k++], L -= 3;
                    while (L > 2);
                    L && (D[a++] = D[k++], L > 1 && (D[a++] = D[k++]));
                  }
                } else if (w & 64) {
                  t.msg = "invalid distance code", i.mode = mi;
                  break e;
                } else {
                  v = f[(v & 65535) + (_ & (1 << w) - 1)];
                  continue r;
                }
                break;
              }
          } else if (w & 64)
            if (w & 32) {
              i.mode = Dp;
              break e;
            } else {
              t.msg = "invalid literal/length code", i.mode = mi;
              break e;
            }
          else {
            v = y[(v & 65535) + (_ & (1 << w) - 1)];
            continue t;
          }
          break;
        }
    } while (n < s && a < c);
  L = E >> 3, n -= L, E -= L << 3, _ &= (1 << E) - 1, t.next_in = n, t.next_out = a, t.avail_in = n < s ? 5 + (s - n) : 5 - (n - s), t.avail_out = a < c ? 257 + (c - a) : 257 - (a - c), i.hold = _, i.bits = E;
}, bo = dt, Vt = 15, vo = 852, wo = 592, yo = 0, Vn = 1, So = 2, Bp = [
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
], Pp = [
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
], Fp = [
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
], Mp = [
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
], $p = function(t, r, i, n, s, a, o, c) {
  var u = c.bits, l = 0, p = 0, d = 0, h = 0, _ = 0, E = 0, y = 0, f = 0, m = 0, b = 0, v, w, L, I, k, B = null, M = 0, D, j = new bo.Buf16(Vt + 1), te = new bo.Buf16(Vt + 1), Ae = null, Kt = 0, Yt, R, N;
  for (l = 0; l <= Vt; l++)
    j[l] = 0;
  for (p = 0; p < n; p++)
    j[r[i + p]]++;
  for (_ = u, h = Vt; h >= 1 && j[h] === 0; h--)
    ;
  if (_ > h && (_ = h), h === 0)
    return s[a++] = 1 << 24 | 64 << 16 | 0, s[a++] = 1 << 24 | 64 << 16 | 0, c.bits = 1, 0;
  for (d = 1; d < h && j[d] === 0; d++)
    ;
  for (_ < d && (_ = d), f = 1, l = 1; l <= Vt; l++)
    if (f <<= 1, f -= j[l], f < 0)
      return -1;
  if (f > 0 && (t === yo || h !== 1))
    return -1;
  for (te[1] = 0, l = 1; l < Vt; l++)
    te[l + 1] = te[l] + j[l];
  for (p = 0; p < n; p++)
    r[i + p] !== 0 && (o[te[r[i + p]]++] = p);
  if (t === yo ? (B = Ae = o, D = 19) : t === Vn ? (B = Bp, M -= 257, Ae = Pp, Kt -= 257, D = 256) : (B = Fp, Ae = Mp, D = -1), b = 0, p = 0, l = d, k = a, E = _, y = 0, L = -1, m = 1 << _, I = m - 1, t === Vn && m > vo || t === So && m > wo)
    return 1;
  for (; ; ) {
    Yt = l - y, o[p] < D ? (R = 0, N = o[p]) : o[p] > D ? (R = Ae[Kt + o[p]], N = B[M + o[p]]) : (R = 96, N = 0), v = 1 << l - y, w = 1 << E, d = w;
    do
      w -= v, s[k + (b >> y) + w] = Yt << 24 | R << 16 | N | 0;
    while (w !== 0);
    for (v = 1 << l - 1; b & v; )
      v >>= 1;
    if (v !== 0 ? (b &= v - 1, b += v) : b = 0, p++, --j[l] === 0) {
      if (l === h)
        break;
      l = r[i + o[p]];
    }
    if (l > _ && (b & I) !== L) {
      for (y === 0 && (y = _), k += d, E = l - y, f = 1 << E; E + y < h && (f -= j[E + y], !(f <= 0)); )
        E++, f <<= 1;
      if (m += 1 << E, t === Vn && m > vo || t === So && m > wo)
        return 1;
      L = b & I, s[L] = _ << 24 | E << 16 | k - a | 0;
    }
  }
  return b !== 0 && (s[k + b] = l - y << 24 | 64 << 16 | 0), c.bits = _, 0;
}, Le = dt, Is = Su, Ge = Ru, Hp = Up, Dr = $p, Xp = 0, Bu = 1, Pu = 2, Ro = 4, zp = 5, gi = 6, Ht = 0, Wp = 1, qp = 2, Be = -2, Fu = -3, Mu = -4, Kp = -5, No = 8, $u = 1, Io = 2, Lo = 3, Co = 4, Ao = 5, Oo = 6, ko = 7, xo = 8, Do = 9, Uo = 10, Fi = 11, nt = 12, Zn = 13, Bo = 14, Jn = 15, Po = 16, Fo = 17, Mo = 18, $o = 19, Ti = 20, bi = 21, Ho = 22, Xo = 23, zo = 24, Wo = 25, qo = 26, Qn = 27, Ko = 28, Yo = 29, ie = 30, Hu = 31, Yp = 32, jp = 852, Gp = 592, Vp = 15, Zp = Vp;
function jo(e) {
  return (e >>> 24 & 255) + (e >>> 8 & 65280) + ((e & 65280) << 8) + ((e & 255) << 24);
}
function Jp() {
  this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new Le.Buf16(320), this.work = new Le.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
}
function Xu(e) {
  var t;
  return !e || !e.state ? Be : (t = e.state, e.total_in = e.total_out = t.total = 0, e.msg = "", t.wrap && (e.adler = t.wrap & 1), t.mode = $u, t.last = 0, t.havedict = 0, t.dmax = 32768, t.head = null, t.hold = 0, t.bits = 0, t.lencode = t.lendyn = new Le.Buf32(jp), t.distcode = t.distdyn = new Le.Buf32(Gp), t.sane = 1, t.back = -1, Ht);
}
function zu(e) {
  var t;
  return !e || !e.state ? Be : (t = e.state, t.wsize = 0, t.whave = 0, t.wnext = 0, Xu(e));
}
function Wu(e, t) {
  var r, i;
  return !e || !e.state || (i = e.state, t < 0 ? (r = 0, t = -t) : (r = (t >> 4) + 1, t < 48 && (t &= 15)), t && (t < 8 || t > 15)) ? Be : (i.window !== null && i.wbits !== t && (i.window = null), i.wrap = r, i.wbits = t, zu(e));
}
function qu(e, t) {
  var r, i;
  return e ? (i = new Jp(), e.state = i, i.window = null, r = Wu(e, t), r !== Ht && (e.state = null), r) : Be;
}
function Qp(e) {
  return qu(e, Zp);
}
var Go = !0, es, ts;
function e_(e) {
  if (Go) {
    var t;
    for (es = new Le.Buf32(512), ts = new Le.Buf32(32), t = 0; t < 144; )
      e.lens[t++] = 8;
    for (; t < 256; )
      e.lens[t++] = 9;
    for (; t < 280; )
      e.lens[t++] = 7;
    for (; t < 288; )
      e.lens[t++] = 8;
    for (Dr(Bu, e.lens, 0, 288, es, 0, e.work, { bits: 9 }), t = 0; t < 32; )
      e.lens[t++] = 5;
    Dr(Pu, e.lens, 0, 32, ts, 0, e.work, { bits: 5 }), Go = !1;
  }
  e.lencode = es, e.lenbits = 9, e.distcode = ts, e.distbits = 5;
}
function Ku(e, t, r, i) {
  var n, s = e.state;
  return s.window === null && (s.wsize = 1 << s.wbits, s.wnext = 0, s.whave = 0, s.window = new Le.Buf8(s.wsize)), i >= s.wsize ? (Le.arraySet(s.window, t, r - s.wsize, s.wsize, 0), s.wnext = 0, s.whave = s.wsize) : (n = s.wsize - s.wnext, n > i && (n = i), Le.arraySet(s.window, t, r - i, n, s.wnext), i -= n, i ? (Le.arraySet(s.window, t, r - i, i, 0), s.wnext = i, s.whave = s.wsize) : (s.wnext += n, s.wnext === s.wsize && (s.wnext = 0), s.whave < s.wsize && (s.whave += n))), 0;
}
function t_(e, t) {
  var r, i, n, s, a, o, c, u, l, p, d, h, _, E, y = 0, f, m, b, v, w, L, I, k, B = new Le.Buf8(4), M, D, j = (
    /* permutation of code lengths */
    [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
  );
  if (!e || !e.state || !e.output || !e.input && e.avail_in !== 0)
    return Be;
  r = e.state, r.mode === nt && (r.mode = Zn), a = e.next_out, n = e.output, c = e.avail_out, s = e.next_in, i = e.input, o = e.avail_in, u = r.hold, l = r.bits, p = o, d = c, k = Ht;
  e:
    for (; ; )
      switch (r.mode) {
        case $u:
          if (r.wrap === 0) {
            r.mode = Zn;
            break;
          }
          for (; l < 16; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if (r.wrap & 2 && u === 35615) {
            r.check = 0, B[0] = u & 255, B[1] = u >>> 8 & 255, r.check = Ge(r.check, B, 2, 0), u = 0, l = 0, r.mode = Io;
            break;
          }
          if (r.flags = 0, r.head && (r.head.done = !1), !(r.wrap & 1) || /* check if zlib header allowed */
          (((u & 255) << 8) + (u >> 8)) % 31) {
            e.msg = "incorrect header check", r.mode = ie;
            break;
          }
          if ((u & 15) !== No) {
            e.msg = "unknown compression method", r.mode = ie;
            break;
          }
          if (u >>>= 4, l -= 4, I = (u & 15) + 8, r.wbits === 0)
            r.wbits = I;
          else if (I > r.wbits) {
            e.msg = "invalid window size", r.mode = ie;
            break;
          }
          r.dmax = 1 << I, e.adler = r.check = 1, r.mode = u & 512 ? Uo : nt, u = 0, l = 0;
          break;
        case Io:
          for (; l < 16; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if (r.flags = u, (r.flags & 255) !== No) {
            e.msg = "unknown compression method", r.mode = ie;
            break;
          }
          if (r.flags & 57344) {
            e.msg = "unknown header flags set", r.mode = ie;
            break;
          }
          r.head && (r.head.text = u >> 8 & 1), r.flags & 512 && (B[0] = u & 255, B[1] = u >>> 8 & 255, r.check = Ge(r.check, B, 2, 0)), u = 0, l = 0, r.mode = Lo;
        case Lo:
          for (; l < 32; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          r.head && (r.head.time = u), r.flags & 512 && (B[0] = u & 255, B[1] = u >>> 8 & 255, B[2] = u >>> 16 & 255, B[3] = u >>> 24 & 255, r.check = Ge(r.check, B, 4, 0)), u = 0, l = 0, r.mode = Co;
        case Co:
          for (; l < 16; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          r.head && (r.head.xflags = u & 255, r.head.os = u >> 8), r.flags & 512 && (B[0] = u & 255, B[1] = u >>> 8 & 255, r.check = Ge(r.check, B, 2, 0)), u = 0, l = 0, r.mode = Ao;
        case Ao:
          if (r.flags & 1024) {
            for (; l < 16; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            r.length = u, r.head && (r.head.extra_len = u), r.flags & 512 && (B[0] = u & 255, B[1] = u >>> 8 & 255, r.check = Ge(r.check, B, 2, 0)), u = 0, l = 0;
          } else r.head && (r.head.extra = null);
          r.mode = Oo;
        case Oo:
          if (r.flags & 1024 && (h = r.length, h > o && (h = o), h && (r.head && (I = r.head.extra_len - r.length, r.head.extra || (r.head.extra = new Array(r.head.extra_len)), Le.arraySet(
            r.head.extra,
            i,
            s,
            // extra field is limited to 65536 bytes
            // - no need for additional size check
            h,
            /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
            I
          )), r.flags & 512 && (r.check = Ge(r.check, i, h, s)), o -= h, s += h, r.length -= h), r.length))
            break e;
          r.length = 0, r.mode = ko;
        case ko:
          if (r.flags & 2048) {
            if (o === 0)
              break e;
            h = 0;
            do
              I = i[s + h++], r.head && I && r.length < 65536 && (r.head.name += String.fromCharCode(I));
            while (I && h < o);
            if (r.flags & 512 && (r.check = Ge(r.check, i, h, s)), o -= h, s += h, I)
              break e;
          } else r.head && (r.head.name = null);
          r.length = 0, r.mode = xo;
        case xo:
          if (r.flags & 4096) {
            if (o === 0)
              break e;
            h = 0;
            do
              I = i[s + h++], r.head && I && r.length < 65536 && (r.head.comment += String.fromCharCode(I));
            while (I && h < o);
            if (r.flags & 512 && (r.check = Ge(r.check, i, h, s)), o -= h, s += h, I)
              break e;
          } else r.head && (r.head.comment = null);
          r.mode = Do;
        case Do:
          if (r.flags & 512) {
            for (; l < 16; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            if (u !== (r.check & 65535)) {
              e.msg = "header crc mismatch", r.mode = ie;
              break;
            }
            u = 0, l = 0;
          }
          r.head && (r.head.hcrc = r.flags >> 9 & 1, r.head.done = !0), e.adler = r.check = 0, r.mode = nt;
          break;
        case Uo:
          for (; l < 32; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          e.adler = r.check = jo(u), u = 0, l = 0, r.mode = Fi;
        case Fi:
          if (r.havedict === 0)
            return e.next_out = a, e.avail_out = c, e.next_in = s, e.avail_in = o, r.hold = u, r.bits = l, qp;
          e.adler = r.check = 1, r.mode = nt;
        case nt:
          if (t === zp || t === gi)
            break e;
        case Zn:
          if (r.last) {
            u >>>= l & 7, l -= l & 7, r.mode = Qn;
            break;
          }
          for (; l < 3; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          switch (r.last = u & 1, u >>>= 1, l -= 1, u & 3) {
            case 0:
              r.mode = Bo;
              break;
            case 1:
              if (e_(r), r.mode = Ti, t === gi) {
                u >>>= 2, l -= 2;
                break e;
              }
              break;
            case 2:
              r.mode = Fo;
              break;
            case 3:
              e.msg = "invalid block type", r.mode = ie;
          }
          u >>>= 2, l -= 2;
          break;
        case Bo:
          for (u >>>= l & 7, l -= l & 7; l < 32; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if ((u & 65535) !== (u >>> 16 ^ 65535)) {
            e.msg = "invalid stored block lengths", r.mode = ie;
            break;
          }
          if (r.length = u & 65535, u = 0, l = 0, r.mode = Jn, t === gi)
            break e;
        case Jn:
          r.mode = Po;
        case Po:
          if (h = r.length, h) {
            if (h > o && (h = o), h > c && (h = c), h === 0)
              break e;
            Le.arraySet(n, i, s, h, a), o -= h, s += h, c -= h, a += h, r.length -= h;
            break;
          }
          r.mode = nt;
          break;
        case Fo:
          for (; l < 14; ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if (r.nlen = (u & 31) + 257, u >>>= 5, l -= 5, r.ndist = (u & 31) + 1, u >>>= 5, l -= 5, r.ncode = (u & 15) + 4, u >>>= 4, l -= 4, r.nlen > 286 || r.ndist > 30) {
            e.msg = "too many length or distance symbols", r.mode = ie;
            break;
          }
          r.have = 0, r.mode = Mo;
        case Mo:
          for (; r.have < r.ncode; ) {
            for (; l < 3; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            r.lens[j[r.have++]] = u & 7, u >>>= 3, l -= 3;
          }
          for (; r.have < 19; )
            r.lens[j[r.have++]] = 0;
          if (r.lencode = r.lendyn, r.lenbits = 7, M = { bits: r.lenbits }, k = Dr(Xp, r.lens, 0, 19, r.lencode, 0, r.work, M), r.lenbits = M.bits, k) {
            e.msg = "invalid code lengths set", r.mode = ie;
            break;
          }
          r.have = 0, r.mode = $o;
        case $o:
          for (; r.have < r.nlen + r.ndist; ) {
            for (; y = r.lencode[u & (1 << r.lenbits) - 1], f = y >>> 24, m = y >>> 16 & 255, b = y & 65535, !(f <= l); ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            if (b < 16)
              u >>>= f, l -= f, r.lens[r.have++] = b;
            else {
              if (b === 16) {
                for (D = f + 2; l < D; ) {
                  if (o === 0)
                    break e;
                  o--, u += i[s++] << l, l += 8;
                }
                if (u >>>= f, l -= f, r.have === 0) {
                  e.msg = "invalid bit length repeat", r.mode = ie;
                  break;
                }
                I = r.lens[r.have - 1], h = 3 + (u & 3), u >>>= 2, l -= 2;
              } else if (b === 17) {
                for (D = f + 3; l < D; ) {
                  if (o === 0)
                    break e;
                  o--, u += i[s++] << l, l += 8;
                }
                u >>>= f, l -= f, I = 0, h = 3 + (u & 7), u >>>= 3, l -= 3;
              } else {
                for (D = f + 7; l < D; ) {
                  if (o === 0)
                    break e;
                  o--, u += i[s++] << l, l += 8;
                }
                u >>>= f, l -= f, I = 0, h = 11 + (u & 127), u >>>= 7, l -= 7;
              }
              if (r.have + h > r.nlen + r.ndist) {
                e.msg = "invalid bit length repeat", r.mode = ie;
                break;
              }
              for (; h--; )
                r.lens[r.have++] = I;
            }
          }
          if (r.mode === ie)
            break;
          if (r.lens[256] === 0) {
            e.msg = "invalid code -- missing end-of-block", r.mode = ie;
            break;
          }
          if (r.lenbits = 9, M = { bits: r.lenbits }, k = Dr(Bu, r.lens, 0, r.nlen, r.lencode, 0, r.work, M), r.lenbits = M.bits, k) {
            e.msg = "invalid literal/lengths set", r.mode = ie;
            break;
          }
          if (r.distbits = 6, r.distcode = r.distdyn, M = { bits: r.distbits }, k = Dr(Pu, r.lens, r.nlen, r.ndist, r.distcode, 0, r.work, M), r.distbits = M.bits, k) {
            e.msg = "invalid distances set", r.mode = ie;
            break;
          }
          if (r.mode = Ti, t === gi)
            break e;
        case Ti:
          r.mode = bi;
        case bi:
          if (o >= 6 && c >= 258) {
            e.next_out = a, e.avail_out = c, e.next_in = s, e.avail_in = o, r.hold = u, r.bits = l, Hp(e, d), a = e.next_out, n = e.output, c = e.avail_out, s = e.next_in, i = e.input, o = e.avail_in, u = r.hold, l = r.bits, r.mode === nt && (r.back = -1);
            break;
          }
          for (r.back = 0; y = r.lencode[u & (1 << r.lenbits) - 1], f = y >>> 24, m = y >>> 16 & 255, b = y & 65535, !(f <= l); ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if (m && !(m & 240)) {
            for (v = f, w = m, L = b; y = r.lencode[L + ((u & (1 << v + w) - 1) >> v)], f = y >>> 24, m = y >>> 16 & 255, b = y & 65535, !(v + f <= l); ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            u >>>= v, l -= v, r.back += v;
          }
          if (u >>>= f, l -= f, r.back += f, r.length = b, m === 0) {
            r.mode = qo;
            break;
          }
          if (m & 32) {
            r.back = -1, r.mode = nt;
            break;
          }
          if (m & 64) {
            e.msg = "invalid literal/length code", r.mode = ie;
            break;
          }
          r.extra = m & 15, r.mode = Ho;
        case Ho:
          if (r.extra) {
            for (D = r.extra; l < D; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            r.length += u & (1 << r.extra) - 1, u >>>= r.extra, l -= r.extra, r.back += r.extra;
          }
          r.was = r.length, r.mode = Xo;
        case Xo:
          for (; y = r.distcode[u & (1 << r.distbits) - 1], f = y >>> 24, m = y >>> 16 & 255, b = y & 65535, !(f <= l); ) {
            if (o === 0)
              break e;
            o--, u += i[s++] << l, l += 8;
          }
          if (!(m & 240)) {
            for (v = f, w = m, L = b; y = r.distcode[L + ((u & (1 << v + w) - 1) >> v)], f = y >>> 24, m = y >>> 16 & 255, b = y & 65535, !(v + f <= l); ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            u >>>= v, l -= v, r.back += v;
          }
          if (u >>>= f, l -= f, r.back += f, m & 64) {
            e.msg = "invalid distance code", r.mode = ie;
            break;
          }
          r.offset = b, r.extra = m & 15, r.mode = zo;
        case zo:
          if (r.extra) {
            for (D = r.extra; l < D; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            r.offset += u & (1 << r.extra) - 1, u >>>= r.extra, l -= r.extra, r.back += r.extra;
          }
          if (r.offset > r.dmax) {
            e.msg = "invalid distance too far back", r.mode = ie;
            break;
          }
          r.mode = Wo;
        case Wo:
          if (c === 0)
            break e;
          if (h = d - c, r.offset > h) {
            if (h = r.offset - h, h > r.whave && r.sane) {
              e.msg = "invalid distance too far back", r.mode = ie;
              break;
            }
            h > r.wnext ? (h -= r.wnext, _ = r.wsize - h) : _ = r.wnext - h, h > r.length && (h = r.length), E = r.window;
          } else
            E = n, _ = a - r.offset, h = r.length;
          h > c && (h = c), c -= h, r.length -= h;
          do
            n[a++] = E[_++];
          while (--h);
          r.length === 0 && (r.mode = bi);
          break;
        case qo:
          if (c === 0)
            break e;
          n[a++] = r.length, c--, r.mode = bi;
          break;
        case Qn:
          if (r.wrap) {
            for (; l < 32; ) {
              if (o === 0)
                break e;
              o--, u |= i[s++] << l, l += 8;
            }
            if (d -= c, e.total_out += d, r.total += d, d && (e.adler = r.check = /*UPDATE(state.check, put - _out, _out);*/
            r.flags ? Ge(r.check, n, d, a - d) : Is(r.check, n, d, a - d)), d = c, (r.flags ? u : jo(u)) !== r.check) {
              e.msg = "incorrect data check", r.mode = ie;
              break;
            }
            u = 0, l = 0;
          }
          r.mode = Ko;
        case Ko:
          if (r.wrap && r.flags) {
            for (; l < 32; ) {
              if (o === 0)
                break e;
              o--, u += i[s++] << l, l += 8;
            }
            if (u !== (r.total & 4294967295)) {
              e.msg = "incorrect length check", r.mode = ie;
              break;
            }
            u = 0, l = 0;
          }
          r.mode = Yo;
        case Yo:
          k = Wp;
          break e;
        case ie:
          k = Fu;
          break e;
        case Hu:
          return Mu;
        case Yp:
        default:
          return Be;
      }
  return e.next_out = a, e.avail_out = c, e.next_in = s, e.avail_in = o, r.hold = u, r.bits = l, (r.wsize || d !== e.avail_out && r.mode < ie && (r.mode < Qn || t !== Ro)) && Ku(e, e.output, e.next_out, d - e.avail_out), p -= e.avail_in, d -= e.avail_out, e.total_in += p, e.total_out += d, r.total += d, r.wrap && d && (e.adler = r.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
  r.flags ? Ge(r.check, n, d, e.next_out - d) : Is(r.check, n, d, e.next_out - d)), e.data_type = r.bits + (r.last ? 64 : 0) + (r.mode === nt ? 128 : 0) + (r.mode === Ti || r.mode === Jn ? 256 : 0), (p === 0 && d === 0 || t === Ro) && k === Ht && (k = Kp), k;
}
function r_(e) {
  if (!e || !e.state)
    return Be;
  var t = e.state;
  return t.window && (t.window = null), e.state = null, Ht;
}
function i_(e, t) {
  var r;
  return !e || !e.state || (r = e.state, !(r.wrap & 2)) ? Be : (r.head = t, t.done = !1, Ht);
}
function n_(e, t) {
  var r = t.length, i, n, s;
  return !e || !e.state || (i = e.state, i.wrap !== 0 && i.mode !== Fi) ? Be : i.mode === Fi && (n = 1, n = Is(n, t, r, 0), n !== i.check) ? Fu : (s = Ku(e, t, r, r), s ? (i.mode = Hu, Mu) : (i.havedict = 1, Ht));
}
Ke.inflateReset = zu;
Ke.inflateReset2 = Wu;
Ke.inflateResetKeep = Xu;
Ke.inflateInit = Qp;
Ke.inflateInit2 = qu;
Ke.inflate = t_;
Ke.inflateEnd = r_;
Ke.inflateGetHeader = i_;
Ke.inflateSetDictionary = n_;
Ke.inflateInfo = "pako inflate (from Nodeca project)";
var Yu = {
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
function s_() {
  this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1;
}
var a_ = s_, sr = Ke, Ur = dt, Oi = Wt, ue = Yu, Ls = sa, o_ = Du, c_ = a_, ju = Object.prototype.toString;
function Xt(e) {
  if (!(this instanceof Xt)) return new Xt(e);
  this.options = Ur.assign({
    chunkSize: 16384,
    windowBits: 0,
    to: ""
  }, e || {});
  var t = this.options;
  t.raw && t.windowBits >= 0 && t.windowBits < 16 && (t.windowBits = -t.windowBits, t.windowBits === 0 && (t.windowBits = -15)), t.windowBits >= 0 && t.windowBits < 16 && !(e && e.windowBits) && (t.windowBits += 32), t.windowBits > 15 && t.windowBits < 48 && (t.windowBits & 15 || (t.windowBits |= 15)), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new o_(), this.strm.avail_out = 0;
  var r = sr.inflateInit2(
    this.strm,
    t.windowBits
  );
  if (r !== ue.Z_OK)
    throw new Error(Ls[r]);
  if (this.header = new c_(), sr.inflateGetHeader(this.strm, this.header), t.dictionary && (typeof t.dictionary == "string" ? t.dictionary = Oi.string2buf(t.dictionary) : ju.call(t.dictionary) === "[object ArrayBuffer]" && (t.dictionary = new Uint8Array(t.dictionary)), t.raw && (r = sr.inflateSetDictionary(this.strm, t.dictionary), r !== ue.Z_OK)))
    throw new Error(Ls[r]);
}
Xt.prototype.push = function(e, t) {
  var r = this.strm, i = this.options.chunkSize, n = this.options.dictionary, s, a, o, c, u, l = !1;
  if (this.ended)
    return !1;
  a = t === ~~t ? t : t === !0 ? ue.Z_FINISH : ue.Z_NO_FLUSH, typeof e == "string" ? r.input = Oi.binstring2buf(e) : ju.call(e) === "[object ArrayBuffer]" ? r.input = new Uint8Array(e) : r.input = e, r.next_in = 0, r.avail_in = r.input.length;
  do {
    if (r.avail_out === 0 && (r.output = new Ur.Buf8(i), r.next_out = 0, r.avail_out = i), s = sr.inflate(r, ue.Z_NO_FLUSH), s === ue.Z_NEED_DICT && n && (s = sr.inflateSetDictionary(this.strm, n)), s === ue.Z_BUF_ERROR && l === !0 && (s = ue.Z_OK, l = !1), s !== ue.Z_STREAM_END && s !== ue.Z_OK)
      return this.onEnd(s), this.ended = !0, !1;
    r.next_out && (r.avail_out === 0 || s === ue.Z_STREAM_END || r.avail_in === 0 && (a === ue.Z_FINISH || a === ue.Z_SYNC_FLUSH)) && (this.options.to === "string" ? (o = Oi.utf8border(r.output, r.next_out), c = r.next_out - o, u = Oi.buf2string(r.output, o), r.next_out = c, r.avail_out = i - c, c && Ur.arraySet(r.output, r.output, o, c, 0), this.onData(u)) : this.onData(Ur.shrinkBuf(r.output, r.next_out))), r.avail_in === 0 && r.avail_out === 0 && (l = !0);
  } while ((r.avail_in > 0 || r.avail_out === 0) && s !== ue.Z_STREAM_END);
  return s === ue.Z_STREAM_END && (a = ue.Z_FINISH), a === ue.Z_FINISH ? (s = sr.inflateEnd(this.strm), this.onEnd(s), this.ended = !0, s === ue.Z_OK) : (a === ue.Z_SYNC_FLUSH && (this.onEnd(ue.Z_OK), r.avail_out = 0), !0);
};
Xt.prototype.onData = function(e) {
  this.chunks.push(e);
};
Xt.prototype.onEnd = function(e) {
  e === ue.Z_OK && (this.options.to === "string" ? this.result = this.chunks.join("") : this.result = Ur.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg;
};
function oa(e, t) {
  var r = new Xt(t);
  if (r.push(e, !0), r.err)
    throw r.msg || Ls[r.err];
  return r.result;
}
function u_(e, t) {
  return t = t || {}, t.raw = !0, oa(e, t);
}
Jr.Inflate = Xt;
Jr.inflate = oa;
Jr.inflateRaw = u_;
Jr.ungzip = oa;
var l_ = dt.assign, d_ = Gr, f_ = Jr, h_ = Yu, Gu = {};
l_(Gu, d_, f_, h_);
var p_ = Gu, __ = typeof Uint8Array < "u" && typeof Uint16Array < "u" && typeof Uint32Array < "u", E_ = p_, Vu = oe(), cn = Pe, m_ = __ ? "uint8array" : "array";
nn.magic = "\b\0";
function qt(e, t) {
  cn.call(this, "FlateWorker/" + e), this._pako = null, this._pakoAction = e, this._pakoOptions = t, this.meta = {};
}
Vu.inherits(qt, cn);
qt.prototype.processChunk = function(e) {
  this.meta = e.meta, this._pako === null && this._createPako(), this._pako.push(Vu.transformTo(m_, e.data), !1);
};
qt.prototype.flush = function() {
  cn.prototype.flush.call(this), this._pako === null && this._createPako(), this._pako.push([], !0);
};
qt.prototype.cleanUp = function() {
  cn.prototype.cleanUp.call(this), this._pako = null;
};
qt.prototype._createPako = function() {
  this._pako = new E_[this._pakoAction]({
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
nn.compressWorker = function(e) {
  return new qt("Deflate", e);
};
nn.uncompressWorker = function() {
  return new qt("Inflate", {});
};
var Vo = Pe;
rn.STORE = {
  magic: "\0\0",
  compressWorker: function() {
    return new Vo("STORE compression");
  },
  uncompressWorker: function() {
    return new Vo("STORE decompression");
  }
};
rn.DEFLATE = nn;
var yt = {};
yt.LOCAL_FILE_HEADER = "PK";
yt.CENTRAL_FILE_HEADER = "PK";
yt.CENTRAL_DIRECTORY_END = "PK";
yt.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07";
yt.ZIP64_CENTRAL_DIRECTORY_END = "PK";
yt.DATA_DESCRIPTOR = "PK\x07\b";
var tr = oe(), Tr = Pe, rs = pr, Zo = js, Mi = yt, ee = function(e, t) {
  var r = "", i;
  for (i = 0; i < t; i++)
    r += String.fromCharCode(e & 255), e = e >>> 8;
  return r;
}, g_ = function(e, t) {
  var r = e;
  return e || (r = t ? 16893 : 33204), (r & 65535) << 16;
}, T_ = function(e) {
  return (e || 0) & 63;
}, Zu = function(e, t, r, i, n, s) {
  var a = e.file, o = e.compression, c = s !== rs.utf8encode, u = tr.transformTo("string", s(a.name)), l = tr.transformTo("string", rs.utf8encode(a.name)), p = a.comment, d = tr.transformTo("string", s(p)), h = tr.transformTo("string", rs.utf8encode(p)), _ = l.length !== a.name.length, E = h.length !== p.length, y, f, m = "", b = "", v = "", w = a.dir, L = a.date, I = {
    crc32: 0,
    compressedSize: 0,
    uncompressedSize: 0
  };
  (!t || r) && (I.crc32 = e.crc32, I.compressedSize = e.compressedSize, I.uncompressedSize = e.uncompressedSize);
  var k = 0;
  t && (k |= 8), !c && (_ || E) && (k |= 2048);
  var B = 0, M = 0;
  w && (B |= 16), n === "UNIX" ? (M = 798, B |= g_(a.unixPermissions, w)) : (M = 20, B |= T_(a.dosPermissions)), y = L.getUTCHours(), y = y << 6, y = y | L.getUTCMinutes(), y = y << 5, y = y | L.getUTCSeconds() / 2, f = L.getUTCFullYear() - 1980, f = f << 4, f = f | L.getUTCMonth() + 1, f = f << 5, f = f | L.getUTCDate(), _ && (b = // Version
  ee(1, 1) + // NameCRC32
  ee(Zo(u), 4) + // UnicodeName
  l, m += // Info-ZIP Unicode Path Extra Field
  "up" + // size
  ee(b.length, 2) + // content
  b), E && (v = // Version
  ee(1, 1) + // CommentCRC32
  ee(Zo(d), 4) + // UnicodeName
  h, m += // Info-ZIP Unicode Path Extra Field
  "uc" + // size
  ee(v.length, 2) + // content
  v);
  var D = "";
  D += `
\0`, D += ee(k, 2), D += o.magic, D += ee(y, 2), D += ee(f, 2), D += ee(I.crc32, 4), D += ee(I.compressedSize, 4), D += ee(I.uncompressedSize, 4), D += ee(u.length, 2), D += ee(m.length, 2);
  var j = Mi.LOCAL_FILE_HEADER + D + u + m, te = Mi.CENTRAL_FILE_HEADER + // version made by (00: DOS)
  ee(M, 2) + // file header (common to file and central directory)
  D + // file comment length
  ee(d.length, 2) + // disk number start
  "\0\0\0\0" + // external file attributes
  ee(B, 4) + // relative offset of local header
  ee(i, 4) + // file name
  u + // extra field
  m + // file comment
  d;
  return {
    fileRecord: j,
    dirRecord: te
  };
}, b_ = function(e, t, r, i, n) {
  var s = "", a = tr.transformTo("string", n(i));
  return s = Mi.CENTRAL_DIRECTORY_END + // number of this disk
  "\0\0\0\0" + // total number of entries in the central directory on this disk
  ee(e, 2) + // total number of entries in the central directory
  ee(e, 2) + // size of the central directory   4 bytes
  ee(t, 4) + // offset of start of central directory with respect to the starting disk number
  ee(r, 4) + // .ZIP file comment length
  ee(a.length, 2) + // .ZIP file comment
  a, s;
}, v_ = function(e) {
  var t = "";
  return t = Mi.DATA_DESCRIPTOR + // crc-32                          4 bytes
  ee(e.crc32, 4) + // compressed size                 4 bytes
  ee(e.compressedSize, 4) + // uncompressed size               4 bytes
  ee(e.uncompressedSize, 4), t;
};
function Ye(e, t, r, i) {
  Tr.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t, this.zipPlatform = r, this.encodeFileName = i, this.streamFiles = e, this.accumulate = !1, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
}
tr.inherits(Ye, Tr);
Ye.prototype.push = function(e) {
  var t = e.meta.percent || 0, r = this.entriesCount, i = this._sources.length;
  this.accumulate ? this.contentBuffer.push(e) : (this.bytesWritten += e.data.length, Tr.prototype.push.call(this, {
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
    var r = Zu(e, t, !1, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
    this.push({
      data: r.fileRecord,
      meta: { percent: 0 }
    });
  } else
    this.accumulate = !0;
};
Ye.prototype.closedSource = function(e) {
  this.accumulate = !1;
  var t = this.streamFiles && !e.file.dir, r = Zu(e, t, !0, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
  if (this.dirRecords.push(r.dirRecord), t)
    this.push({
      data: v_(e),
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
  var r = this.bytesWritten - e, i = b_(this.dirRecords.length, r, e, this.zipComment, this.encodeFileName);
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
  if (!Tr.prototype.resume.call(this))
    return !1;
  if (!this.previous && this._sources.length)
    return this.prepareNextSource(), !0;
  if (!this.previous && !this._sources.length && !this.generatedError)
    return this.end(), !0;
};
Ye.prototype.error = function(e) {
  var t = this._sources;
  if (!Tr.prototype.error.call(this, e))
    return !1;
  for (var r = 0; r < t.length; r++)
    try {
      t[r].error(e);
    } catch {
    }
  return !0;
};
Ye.prototype.lock = function() {
  Tr.prototype.lock.call(this);
  for (var e = this._sources, t = 0; t < e.length; t++)
    e[t].lock();
};
var w_ = Ye, y_ = rn, S_ = w_, R_ = function(e, t) {
  var r = e || t, i = y_[r];
  if (!i)
    throw new Error(r + " is not a valid compression method !");
  return i;
};
cu.generateWorker = function(e, t, r) {
  var i = new S_(t.streamFiles, r, t.platform, t.encodeFileName), n = 0;
  try {
    e.forEach(function(s, a) {
      n++;
      var o = R_(a.options.compression, t.compression), c = a.options.compressionOptions || t.compressionOptions || {}, u = a.dir, l = a.date;
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
var N_ = oe(), un = Pe;
function Qr(e, t) {
  un.call(this, "Nodejs stream input adapter for " + e), this._upstreamEnded = !1, this._bindStream(t);
}
N_.inherits(Qr, un);
Qr.prototype._bindStream = function(e) {
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
Qr.prototype.pause = function() {
  return un.prototype.pause.call(this) ? (this._stream.pause(), !0) : !1;
};
Qr.prototype.resume = function() {
  return un.prototype.resume.call(this) ? (this._upstreamEnded ? this.end() : this._stream.resume(), !0) : !1;
};
var I_ = Qr, L_ = pr, Br = oe(), Ju = Pe, C_ = iu, Qu = Fe, Jo = Qs, A_ = wh, O_ = cu, Qo = Qi, k_ = I_, el = function(e, t, r) {
  var i = Br.getTypeOf(t), n, s = Br.extend(r || {}, Qu);
  s.date = s.date || /* @__PURE__ */ new Date(), s.compression !== null && (s.compression = s.compression.toUpperCase()), typeof s.unixPermissions == "string" && (s.unixPermissions = parseInt(s.unixPermissions, 8)), s.unixPermissions && s.unixPermissions & 16384 && (s.dir = !0), s.dosPermissions && s.dosPermissions & 16 && (s.dir = !0), s.dir && (e = tl(e)), s.createFolders && (n = x_(e)) && rl.call(this, n, !0);
  var a = i === "string" && s.binary === !1 && s.base64 === !1;
  (!r || typeof r.binary > "u") && (s.binary = !a);
  var o = t instanceof Jo && t.uncompressedSize === 0;
  (o || s.dir || !t || t.length === 0) && (s.base64 = !1, s.binary = !0, t = "", s.compression = "STORE", i = "string");
  var c = null;
  t instanceof Jo || t instanceof Ju ? c = t : Qo.isNode && Qo.isStream(t) ? c = new k_(e, t) : c = Br.prepareContent(e, t, s.binary, s.optimizedBinaryString, s.base64);
  var u = new A_(e, c, s);
  this.files[e] = u;
}, x_ = function(e) {
  e.slice(-1) === "/" && (e = e.substring(0, e.length - 1));
  var t = e.lastIndexOf("/");
  return t > 0 ? e.substring(0, t) : "";
}, tl = function(e) {
  return e.slice(-1) !== "/" && (e += "/"), e;
}, rl = function(e, t) {
  return t = typeof t < "u" ? t : Qu.createFolders, e = tl(e), this.files[e] || el.call(this, e, null, {
    dir: !0,
    createFolders: t
  }), this.files[e];
};
function ec(e) {
  return Object.prototype.toString.call(e) === "[object RegExp]";
}
var D_ = {
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
      if (ec(e)) {
        var i = e;
        return this.filter(function(s, a) {
          return !a.dir && i.test(s);
        });
      } else {
        var n = this.files[this.root + e];
        return n && !n.dir ? n : null;
      }
    else
      e = this.root + e, el.call(this, e, t, r);
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
    if (ec(e))
      return this.filter(function(n, s) {
        return s.dir && e.test(n);
      });
    var t = this.root + e, r = rl.call(this, t), i = this.clone();
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
        encodeFileName: L_.utf8encode
      }), r.type = r.type.toLowerCase(), r.compression = r.compression.toUpperCase(), r.type === "binarystring" && (r.type = "string"), !r.type)
        throw new Error("No output type specified.");
      Br.checkSupport(r.type), (r.platform === "darwin" || r.platform === "freebsd" || r.platform === "linux" || r.platform === "sunos") && (r.platform = "UNIX"), r.platform === "win32" && (r.platform = "DOS");
      var i = r.comment || this.comment || "";
      t = O_.generateWorker(this, r, i);
    } catch (n) {
      t = new Ju("error"), t.error(n);
    }
    return new C_(t, r.type || "string", r.mimeType);
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
}, U_ = D_, B_ = oe();
function il(e) {
  this.data = e, this.length = e.length, this.index = 0, this.zero = 0;
}
il.prototype = {
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
    return B_.transformTo("string", this.readData(e));
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
var nl = il, sl = nl, P_ = oe();
function br(e) {
  sl.call(this, e);
  for (var t = 0; t < this.data.length; t++)
    e[t] = e[t] & 255;
}
P_.inherits(br, sl);
br.prototype.byteAt = function(e) {
  return this.data[this.zero + e];
};
br.prototype.lastIndexOfSignature = function(e) {
  for (var t = e.charCodeAt(0), r = e.charCodeAt(1), i = e.charCodeAt(2), n = e.charCodeAt(3), s = this.length - 4; s >= 0; --s)
    if (this.data[s] === t && this.data[s + 1] === r && this.data[s + 2] === i && this.data[s + 3] === n)
      return s - this.zero;
  return -1;
};
br.prototype.readAndCheckSignature = function(e) {
  var t = e.charCodeAt(0), r = e.charCodeAt(1), i = e.charCodeAt(2), n = e.charCodeAt(3), s = this.readData(4);
  return t === s[0] && r === s[1] && i === s[2] && n === s[3];
};
br.prototype.readData = function(e) {
  if (this.checkOffset(e), e === 0)
    return [];
  var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var al = br, ol = nl, F_ = oe();
function vr(e) {
  ol.call(this, e);
}
F_.inherits(vr, ol);
vr.prototype.byteAt = function(e) {
  return this.data.charCodeAt(this.zero + e);
};
vr.prototype.lastIndexOfSignature = function(e) {
  return this.data.lastIndexOf(e) - this.zero;
};
vr.prototype.readAndCheckSignature = function(e) {
  var t = this.readData(4);
  return e === t;
};
vr.prototype.readData = function(e) {
  this.checkOffset(e);
  var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var M_ = vr, cl = al, $_ = oe();
function ca(e) {
  cl.call(this, e);
}
$_.inherits(ca, cl);
ca.prototype.readData = function(e) {
  if (this.checkOffset(e), e === 0)
    return new Uint8Array(0);
  var t = this.data.subarray(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var ul = ca, ll = ul, H_ = oe();
function ua(e) {
  ll.call(this, e);
}
H_.inherits(ua, ll);
ua.prototype.readData = function(e) {
  this.checkOffset(e);
  var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
  return this.index += e, t;
};
var X_ = ua, vi = oe(), tc = fe, z_ = al, W_ = M_, q_ = X_, K_ = ul, dl = function(e) {
  var t = vi.getTypeOf(e);
  return vi.checkSupport(t), t === "string" && !tc.uint8array ? new W_(e) : t === "nodebuffer" ? new q_(e) : tc.uint8array ? new K_(vi.transformTo("uint8array", e)) : new z_(vi.transformTo("array", e));
}, is = dl, ht = oe(), Y_ = Qs, rc = js, wi = pr, yi = rn, j_ = fe, G_ = 0, V_ = 3, Z_ = function(e) {
  for (var t in yi)
    if (Object.prototype.hasOwnProperty.call(yi, t) && yi[t].magic === e)
      return yi[t];
  return null;
};
function fl(e, t) {
  this.options = e, this.loadOptions = t;
}
fl.prototype = {
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
    if (t = Z_(this.compressionMethod), t === null)
      throw new Error("Corrupted zip : compression " + ht.pretty(this.compressionMethod) + " unknown (inner file : " + ht.transformTo("string", this.fileName) + ")");
    this.decompressed = new Y_(this.compressedSize, this.uncompressedSize, this.crc32, t, e.readData(this.compressedSize));
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
    this.dir = !!(this.externalFileAttributes & 16), e === G_ && (this.dosPermissions = this.externalFileAttributes & 63), e === V_ && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), !this.dir && this.fileNameStr.slice(-1) === "/" && (this.dir = !0);
  },
  /**
   * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
   * @param {DataReader} reader the reader to use.
   */
  parseZIP64ExtraField: function() {
    if (this.extraFields[1]) {
      var e = is(this.extraFields[1].value);
      this.uncompressedSize === ht.MAX_VALUE_32BITS && (this.uncompressedSize = e.readInt(8)), this.compressedSize === ht.MAX_VALUE_32BITS && (this.compressedSize = e.readInt(8)), this.localHeaderOffset === ht.MAX_VALUE_32BITS && (this.localHeaderOffset = e.readInt(8)), this.diskNumberStart === ht.MAX_VALUE_32BITS && (this.diskNumberStart = e.readInt(4));
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
    var e = j_.uint8array ? "uint8array" : "array";
    if (this.useUTF8())
      this.fileNameStr = wi.utf8decode(this.fileName), this.fileCommentStr = wi.utf8decode(this.fileComment);
    else {
      var t = this.findExtraFieldUnicodePath();
      if (t !== null)
        this.fileNameStr = t;
      else {
        var r = ht.transformTo(e, this.fileName);
        this.fileNameStr = this.loadOptions.decodeFileName(r);
      }
      var i = this.findExtraFieldUnicodeComment();
      if (i !== null)
        this.fileCommentStr = i;
      else {
        var n = ht.transformTo(e, this.fileComment);
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
      var t = is(e.value);
      return t.readInt(1) !== 1 || rc(this.fileName) !== t.readInt(4) ? null : wi.utf8decode(t.readData(e.length - 5));
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
      var t = is(e.value);
      return t.readInt(1) !== 1 || rc(this.fileComment) !== t.readInt(4) ? null : wi.utf8decode(t.readData(e.length - 5));
    }
    return null;
  }
};
var J_ = fl, Q_ = dl, st = oe(), He = yt, eE = J_, tE = fe;
function hl(e) {
  this.files = [], this.loadOptions = e;
}
hl.prototype = {
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
    var e = this.reader.readData(this.zipCommentLength), t = tE.uint8array ? "uint8array" : "array", r = st.transformTo(t, e);
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
      e = new eE({
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
    this.reader = Q_(e);
  },
  /**
   * Read a zip file and create ZipEntries.
   * @param {String|ArrayBuffer|Uint8Array|Buffer} data the binary string representing a zip file.
   */
  load: function(e) {
    this.prepareReader(e), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
  }
};
var rE = hl, ns = oe(), ki = jr, iE = pr, nE = rE, sE = ou, ic = Qi;
function aE(e) {
  return new ki.Promise(function(t, r) {
    var i = e.decompressed.getContentWorker().pipe(new sE());
    i.on("error", function(n) {
      r(n);
    }).on("end", function() {
      i.streamInfo.crc32 !== e.decompressed.crc32 ? r(new Error("Corrupted zip : CRC32 mismatch")) : t();
    }).resume();
  });
}
var oE = function(e, t) {
  var r = this;
  return t = ns.extend(t || {}, {
    base64: !1,
    checkCRC32: !1,
    optimizedBinaryString: !1,
    createFolders: !1,
    decodeFileName: iE.utf8decode
  }), ic.isNode && ic.isStream(e) ? ki.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : ns.prepareContent("the loaded zip file", e, !0, t.optimizedBinaryString, t.base64).then(function(i) {
    var n = new nE(t);
    return n.load(i), n;
  }).then(function(n) {
    var s = [ki.Promise.resolve(n)], a = n.files;
    if (t.checkCRC32)
      for (var o = 0; o < a.length; o++)
        s.push(aE(a[o]));
    return ki.Promise.all(s);
  }).then(function(n) {
    for (var s = n.shift(), a = s.files, o = 0; o < a.length; o++) {
      var c = a[o], u = c.fileNameStr, l = ns.resolve(c.fileNameStr);
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
Ue.prototype = U_;
Ue.prototype.loadAsync = oE;
Ue.support = fe;
Ue.defaults = Fe;
Ue.version = "3.10.1";
Ue.loadAsync = function(e, t) {
  return new Ue().loadAsync(e, t);
};
Ue.external = jr;
var cE = Ue;
const pl = /* @__PURE__ */ Hs(cE);
let Dt = null;
function _l() {
  return Dt;
}
function El() {
  return Dt = null, { ok: !0 };
}
function uE(e) {
  try {
    ze(), lt(de());
    const t = de().prepare(
      `SELECT id, business_id, branch_id, name, image_path, email, password_hash, role, is_active
         FROM users
         WHERE email = ?`
    ).get(e.email.trim().toLowerCase());
    if (!t)
      return { ok: !1, error: "invalid_credentials", message: "Email or password is incorrect." };
    if (!t.is_active)
      return { ok: !1, error: "inactive", message: "This account is inactive." };
    if (!ar.compareSync(e.password, t.password_hash))
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
    return de().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), t.id), Dt = i, { ok: !0, user: i };
  } catch (t) {
    return {
      ok: !1,
      error: "unknown",
      message: t instanceof Error ? t.message : "Login failed"
    };
  }
}
function lE(e) {
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
    ze(), lt(de());
    const s = hr();
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
    const a = Ks();
    if (!a || a.licenseKey !== i)
      return { ok: !1, error: "invalid_license", message: "License key is invalid for this device." };
    const o = de().prepare(
      `SELECT id
         FROM users
         WHERE role = 'owner' AND is_active = 1 AND email = ?`
    ).get(r);
    if (!o) return t;
    const c = ar.hashSync(n, 12);
    return de().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(c, o.id), (Dt == null ? void 0 : Dt.id) === o.id && (Dt = null), { ok: !0 };
  } catch (r) {
    return {
      ok: !1,
      error: "unknown",
      message: r instanceof Error ? r.message : "Password reset failed."
    };
  }
}
const dE = {
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
function fE(e, t) {
  return e ? dE[e.role].includes(t) : !1;
}
function he() {
  const e = _l();
  if (!e) throw new Error("Not authenticated");
  return e;
}
function ce() {
  if (hr().status !== "valid")
    throw new Error("License expired");
}
function z(e) {
  const t = he();
  if (!fE(t, e)) throw new Error("Forbidden");
  return t;
}
function X(e) {
  const t = he();
  if (t.role !== "owner" && t.businessId !== e)
    throw new Error("Forbidden business scope");
}
function wr(e) {
  const t = he();
  if (!(t.role === "owner" || t.role === "admin") && t.branchId !== e)
    throw new Error("Forbidden branch scope");
}
const at = Buffer.from("KAAROBKB1", "utf8"), hE = "kaarobar-backup-salt-v1", pE = "kaarobar-dev-backup-secret";
function _E() {
  return process.env.KAAROBAR_BACKUP_SECRET || "oHvA/EZ5gUAvewdoNUYXsP+PNLfYJab//4/WQT6k0yqDmWsSq8itpco3G2QAALKP";
}
function EE() {
  const e = [
    process.env.KAAROBAR_BACKUP_SECRET,
    "oHvA/EZ5gUAvewdoNUYXsP+PNLfYJab//4/WQT6k0yqDmWsSq8itpco3G2QAALKP",
    pE
  ].filter((t) => !!(t && t.trim()));
  return [...new Set(e)];
}
function ml(e) {
  return Oc(e, hE, 32);
}
function mE(e) {
  const t = ml(_E()), r = Ic(12), i = Lc("aes-256-gcm", t, r), n = Buffer.concat([i.update(e), i.final()]), s = i.getAuthTag();
  return Buffer.concat([at, r, s, n]);
}
function gE(e) {
  if (e.length < at.length + 12 + 16 + 1)
    throw new Error("Invalid backup file: too short");
  if (!e.subarray(0, at.length).equals(at))
    throw new Error("Invalid backup file: not a Kaarobar encrypted backup");
  const r = e.subarray(at.length, at.length + 12), i = e.subarray(at.length + 12, at.length + 28), n = e.subarray(at.length + 28);
  for (const s of EE())
    try {
      const a = ml(s), o = kc("aes-256-gcm", a, r);
      return o.setAuthTag(i), Buffer.concat([o.update(n), o.final()]);
    } catch {
    }
  throw new Error("Invalid backup file: decrypt failed");
}
const TE = 2, bE = Buffer.from("SQLite format 3\0", "utf8"), vE = Buffer.from([80, 75, 3, 4]);
function Q(e, t, r, i) {
  e && e({
    operation: t,
    phase: r,
    percent: Math.max(0, Math.min(100, Math.round(i)))
  });
}
function Cs(e, t, r, i, n) {
  if (r <= t) return n;
  const s = Math.max(0, Math.min(1, (e - t) / (r - t)));
  return i + s * (n - i);
}
async function cr() {
  await new Promise((e) => setImmediate(e));
}
function gl() {
  const e = de().prepare("SELECT id FROM businesses WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1").get(), t = (e == null ? void 0 : e.id) ?? null;
  return re.set("lastBusinessId", t), t;
}
function wE() {
  const e = P.join(Xe.getPath("documents"), "KaarobarBackups");
  return F.mkdirSync(e, { recursive: !0 }), e;
}
const nc = "kaarobar-latest.kaarobar-backup";
function yE(e, t) {
  for (const r of F.readdirSync(e, { withFileTypes: !0 }))
    r.isFile() && r.name.endsWith(".kaarobar-backup") && r.name !== t && F.unlinkSync(P.join(e, r.name));
}
function SE(e) {
  for (const t of ["-wal", "-shm"]) {
    const r = `${e}${t}`;
    F.existsSync(r) && F.unlinkSync(r);
  }
}
function RE() {
  de().pragma("wal_checkpoint(TRUNCATE)");
  const t = Yi();
  return qs(), F.readFileSync(t);
}
function Tl(e) {
  qs();
  const t = Yi();
  F.mkdirSync(P.dirname(t), { recursive: !0 }), SE(t), F.writeFileSync(t, e);
  const r = ze();
  lt(r);
}
function NE(e) {
  return e.length >= 4 && e.subarray(0, 4).equals(vE);
}
function bl(e) {
  return e.length >= 16 && e.subarray(0, 16).equals(bE);
}
function IE(e) {
  if (!F.existsSync(e)) return [];
  const t = [], r = (i) => {
    for (const n of F.readdirSync(i, { withFileTypes: !0 })) {
      const s = P.join(i, n.name);
      if (n.isDirectory()) {
        r(s);
        continue;
      }
      if (!n.isFile()) continue;
      const a = P.relative(e, s).split(P.sep).join("/");
      !a || a.includes("..") || t.push({ relativePosix: a, absolute: s });
    }
  };
  return r(e), t;
}
function LE(e) {
  if (F.existsSync(e))
    for (const t of F.readdirSync(e, { withFileTypes: !0 })) {
      const r = P.join(e, t.name);
      F.rmSync(r, { recursive: !0, force: !0 });
    }
}
function ss(e) {
  if (e == null) return null;
  const t = e.trim();
  if (!t) return null;
  const r = t.replace(/\\/g, "/"), i = "/assets/", n = r.toLowerCase().lastIndexOf(i);
  if (n >= 0)
    return r.slice(n + i.length).replace(/^\/+/, "") || null;
  if (!P.isAbsolute(t) && !/^[a-zA-Z]:[\\/]/.test(t) && !r.startsWith("/"))
    return r.replace(/^\/+/, "");
  const s = r.match(/\/((?:logos|products)\/[^/]+)$/i);
  return s != null && s[1] ? s[1] : null;
}
function vl() {
  const e = de(), t = e.prepare("SELECT id, image_path FROM products WHERE image_path IS NOT NULL AND image_path != ''").all(), r = e.prepare("UPDATE products SET image_path = ? WHERE id = ?");
  for (const o of t) {
    const c = ss(o.image_path);
    c !== o.image_path && r.run(c, o.id);
  }
  const i = e.prepare("SELECT id, image_path FROM users WHERE image_path IS NOT NULL AND image_path != ''").all(), n = e.prepare("UPDATE users SET image_path = ? WHERE id = ?");
  for (const o of i) {
    const c = ss(o.image_path);
    c !== o.image_path && n.run(c, o.id);
  }
  const s = e.prepare("SELECT id, logo_path FROM businesses WHERE logo_path IS NOT NULL AND logo_path != ''").all(), a = e.prepare("UPDATE businesses SET logo_path = ? WHERE id = ?");
  for (const o of s) {
    const c = ss(o.logo_path);
    c !== o.logo_path && a.run(c, o.id);
  }
}
async function CE(e, t) {
  const r = new pl(), i = {
    formatVersion: TE,
    app: "kaarobar",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    includes: ["db", "files"]
  };
  r.file("manifest.json", JSON.stringify(i, null, 2)), r.file("db/kaarobar.sqlite", e);
  const n = Xs(), s = IE(n), a = Math.max(s.length, 1);
  for (let c = 0; c < s.length; c++) {
    const u = s[c];
    r.file(`files/${u.relativePosix}`, F.readFileSync(u.absolute)), (c === 0 || c === s.length - 1 || c % 8 === 0) && (Q(t, "create", "packing_files", Cs(c + 1, 0, a, 8, 50)), await cr());
  }
  s.length === 0 && Q(t, "create", "packing_files", 50), Q(t, "create", "compressing", 50);
  const o = await r.generateAsync(
    {
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    },
    (c) => {
      Q(t, "create", "compressing", Cs(c.percent, 0, 100, 50, 75));
    }
  );
  return Buffer.from(o);
}
async function AE(e, t) {
  const r = Xs(), i = `${r}.restore-tmp`;
  F.rmSync(i, { recursive: !0, force: !0 }), F.mkdirSync(i, { recursive: !0 });
  const n = Object.values(e.files).filter(
    (a) => !a.dir && (a.name.startsWith("files/") || a.name.startsWith("assets/"))
  ), s = Math.max(n.length, 1);
  for (let a = 0; a < n.length; a++) {
    const o = n[a], c = o.name.startsWith("files/") ? "files/" : "assets/", u = o.name.slice(c.length).replace(/^\/+/, "");
    if (!u || u.includes("..")) continue;
    const l = P.resolve(i, ...u.split("/")), p = P.resolve(i), d = p.endsWith(P.sep) ? p : p + P.sep;
    l !== p && !l.startsWith(d) || (F.mkdirSync(P.dirname(l), { recursive: !0 }), F.writeFileSync(l, Buffer.from(await o.async("nodebuffer"))), (a === 0 || a === n.length - 1 || a % 8 === 0) && (Q(t, "restore", "restoring_files", Cs(a + 1, 0, s, 42, 88)), await cr()));
  }
  if (n.length === 0 && Q(t, "restore", "restoring_files", 88), F.mkdirSync(r, { recursive: !0 }), LE(r), F.existsSync(i))
    for (const a of F.readdirSync(i, { withFileTypes: !0 }))
      F.renameSync(P.join(i, a.name), P.join(r, a.name));
  F.rmSync(i, { recursive: !0, force: !0 });
}
async function OE(e, t) {
  Q(t, "restore", "extracting", 20);
  const r = await pl.loadAsync(e);
  Q(t, "restore", "extracting", 28);
  const i = r.file("db/kaarobar.sqlite") ?? r.file("kaarobar.sqlite") ?? Object.values(r.files).find((s) => !s.dir && s.name.endsWith(".sqlite"));
  if (!i || i.dir)
    throw new Error("Invalid backup archive: database file missing");
  Q(t, "restore", "installing_db", 30);
  const n = Buffer.from(await i.async("nodebuffer"));
  if (!bl(n))
    throw new Error("Invalid backup archive: database is not SQLite");
  Tl(n), Q(t, "restore", "installing_db", 42), await AE(r, t), Q(t, "restore", "finalizing", 90), vl(), Q(t, "restore", "finalizing", 98);
}
let Bt = !1;
function kE() {
  return Bt;
}
async function wl(e) {
  if (Bt) throw new Error("A backup operation is already in progress");
  Bt = !0, ze();
  try {
    Q(e, "create", "prepare_db", 2);
    const t = RE();
    Q(e, "create", "prepare_db", 8), await cr();
    const r = await CE(t, e);
    Q(e, "create", "encrypting", 76), await cr();
    const i = mE(r);
    Q(e, "create", "encrypting", 90), Q(e, "create", "writing", 92);
    const n = wE(), s = P.join(n, nc);
    return F.writeFileSync(s, i), yE(n, nc), ze(), lt(de()), Q(e, "create", "writing", 100), { ok: !0, filePath: s };
  } catch (t) {
    throw ze(), t;
  } finally {
    Bt = !1;
  }
}
async function xE(e) {
  return z("system:backup_create"), wl(e);
}
async function yl(e, t) {
  if (!e || !F.existsSync(e))
    throw new Error("Backup file not found");
  Q(t, "restore", "reading", 2);
  const r = F.readFileSync(e);
  Q(t, "restore", "reading", 6), await cr(), Q(t, "restore", "decrypting", 8);
  const i = gE(r);
  if (Q(t, "restore", "decrypting", 18), await cr(), NE(i)) {
    await OE(i, t);
    return;
  }
  if (!bl(i))
    throw new Error("Invalid backup file: decrypted data is not a Kaarobar backup");
  Q(t, "restore", "installing_db", 25), Tl(i), Q(t, "restore", "finalizing", 85), vl(), Q(t, "restore", "finalizing", 98);
}
async function DE(e, t) {
  if (z("system:backup_restore"), Bt) throw new Error("A backup operation is already in progress");
  Bt = !0;
  try {
    await yl(e, t), Q(t, "restore", "finalizing", 99);
    const r = gl();
    return El(), Q(t, "restore", "finalizing", 100), { ok: !0, businessId: r };
  } finally {
    Bt = !1;
  }
}
async function UE() {
  const e = await Sc.showOpenDialog({
    title: "Choose Kaarobar backup",
    properties: ["openFile"],
    filters: [
      { name: "Kaarobar backup", extensions: ["kaarobar-backup"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  return e.canceled || !e.filePaths[0] ? null : e.filePaths[0];
}
const BE = ["retail", "food", "salon", "services"];
function PE(e) {
  return typeof e == "string" && BE.includes(e);
}
function ei(e) {
  return PE(e) ? e : "retail";
}
function FE(e) {
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
function Sl(e) {
  return e === "item";
}
function yr(e) {
  return e === "food";
}
function ME(e) {
  return e === "food";
}
function $E(e) {
  return e === "salon" || e === "services";
}
function Rl(e, t) {
  return FE(e).includes(t);
}
function As() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function HE() {
  try {
    F.mkdirSync(Qe(), { recursive: !0 });
    const e = re.get("setupComplete"), t = Pt(re.get("language"));
    if (!e || !ji())
      return { status: "needs_setup" };
    ze(), lt(de()), Ui();
    const r = hr();
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
const as = "#2d6df6";
function XE() {
  var e, t;
  try {
    if (!re.get("setupComplete") || !ji()) return as;
    ze(), lt(de());
    const r = re.get("lastBusinessId");
    if (r) {
      const n = de().prepare("SELECT brand_color FROM businesses WHERE id = ?").get(r);
      if ((e = n == null ? void 0 : n.brand_color) != null && e.trim()) return n.brand_color.trim();
    }
    const i = de().prepare("SELECT brand_color FROM businesses ORDER BY created_at ASC LIMIT 1").get();
    return ((t = i == null ? void 0 : i.brand_color) == null ? void 0 : t.trim()) || as;
  } catch {
    return as;
  }
}
async function zE(e) {
  try {
    F.mkdirSync(Qe(), { recursive: !0 });
    let t = Bi();
    if (!t || t.licenseKey !== e.licenseKey.trim()) {
      const c = await Vi(e.licenseKey);
      if (!c.ok) return { ok: !1, error: c.error, message: c.message };
      t = Bi();
    }
    if (!t)
      return { ok: !1, error: "license_missing", message: "License activation could not be saved locally." };
    if (ji() && re.get("setupComplete"))
      return { ok: !1, error: "already_setup", message: "Setup has already been completed on this device." };
    qs();
    const r = ze();
    lt(r), Ui();
    const i = ne(), n = ne(), s = ne(), a = As(), o = ar.hashSync(e.owner.password, 12);
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
        ei(e.business.businessNature),
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
        Pt(e.language)
      ), r.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        n,
        "receipt_footer",
        "Thank you for shopping with us"
      ), r.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        n,
        "idle_lock_minutes",
        "10"
      );
    })(), Ui(), re.set("setupComplete", !0), re.set("language", Pt(e.language)), re.set("lastBusinessId", n), F.writeFileSync(P.join(Qe(), "setup.complete"), As(), "utf8"), { ok: !0 };
  } catch (t) {
    return {
      ok: !1,
      error: "setup_failed",
      message: t instanceof Error ? t.message : "Setup failed"
    };
  }
}
async function WE(e, t) {
  try {
    if (F.mkdirSync(Qe(), { recursive: !0 }), ji() && re.get("setupComplete"))
      return { ok: !1, error: "already_setup", message: "Setup has already been completed on this device." };
    let r = Bi();
    if (!r || r.licenseKey !== e.licenseKey.trim()) {
      const a = await Vi(e.licenseKey);
      if (!a.ok) return { ok: !1, error: a.error, message: a.message };
      r = Bi();
    }
    if (!r)
      return { ok: !1, error: "license_missing", message: "License activation could not be saved locally." };
    await yl(e.filePath, t), t == null || t({ operation: "restore", phase: "finalizing", percent: 99 }), Ui();
    const n = de().prepare("SELECT value FROM settings WHERE key = 'language' ORDER BY business_id ASC LIMIT 1").get(), s = Pt(n == null ? void 0 : n.value);
    return gl(), re.set("setupComplete", !0), re.set("language", s), F.writeFileSync(P.join(Qe(), "setup.complete"), As(), "utf8"), t == null || t({ operation: "restore", phase: "finalizing", percent: 100 }), { ok: !0 };
  } catch (r) {
    return {
      ok: !1,
      error: "setup_failed",
      message: r instanceof Error ? r.message : "Failed to restore from backup"
    };
  }
}
const sc = 7, qE = 3, Nl = /* @__PURE__ */ new Map();
function KE(e) {
  const t = /* @__PURE__ */ new Date();
  return t.setUTCDate(t.getUTCDate() - (e - 1)), t.setUTCHours(0, 0, 0, 0), t.toISOString();
}
function Il() {
  return ze(), lt(de()), de();
}
function YE() {
  return Il().prepare("SELECT id FROM businesses WHERE is_active = 1").all().map((r) => r.id);
}
function Ll(e) {
  const t = Il(), r = KE(sc), i = t.prepare(
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
    const a = s.qty_sold / sc;
    if (a <= 0) continue;
    const o = s.stock_qty / a;
    if (o > qE) continue;
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
  return n.sort((s, a) => s.daysLeft - a.daysLeft || s.stockQty - a.stockQty), Nl.set(e, { atMs: Date.now(), alerts: n }), n;
}
function jE(e) {
  const t = Nl.get(e);
  return t && Date.now() - t.atMs < 30 * 60 * 1e3 ? t.alerts : Ll(e);
}
const GE = 7;
let os = !1;
function VE(e = /* @__PURE__ */ new Date()) {
  const t = e.getFullYear(), r = String(e.getMonth() + 1).padStart(2, "0"), i = String(e.getDate()).padStart(2, "0");
  return `${t}-${r}-${i}`;
}
function ZE(e, t = /* @__PURE__ */ new Date()) {
  const r = new Date(e).getTime();
  return Number.isFinite(r) ? (r - t.getTime()) / (24 * 60 * 60 * 1e3) : Number.POSITIVE_INFINITY;
}
function JE(e = /* @__PURE__ */ new Date()) {
  const t = hr();
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
  const r = ZE(t.record.expiresAt, e);
  return r > GE ? null : {
    kind: "expiring",
    expiresAt: t.record.expiresAt,
    issuedTo: t.record.issuedTo,
    daysLeft: Math.max(0, Math.ceil(r))
  };
}
function QE() {
  const e = YE(), t = [];
  for (const r of e)
    try {
      t.push(...Ll(r));
    } catch (i) {
      console.error("[daily-reminders] restock failed", r, i);
    }
  return t.sort((r, i) => r.daysLeft - i.daysLeft || r.stockQty - i.stockQty), t;
}
function em(e) {
  for (const t of qi.getAllWindows())
    t.isDestroyed() || t.webContents.send(O.REMINDERS_DAILY, e);
}
function tm(e = /* @__PURE__ */ new Date()) {
  const t = QE(), r = JE(e), i = {
    date: VE(e),
    at: e.toISOString(),
    restock: t,
    license: r
  };
  return em(i), i;
}
function rm() {
  if (os) return { ran: !1 };
  os = !0;
  try {
    return tm(), { ran: !0 };
  } catch (e) {
    return console.error("[daily-reminders] failed", e), { ran: !1 };
  } finally {
    os = !1;
  }
}
function $i(e, t = 4) {
  const r = e.trim().split(/\s+/).map((i) => i.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean);
  return r.length === 0 ? "X" : r.length >= 2 ? r.map((n) => n[0] ?? "").join("").toUpperCase().slice(0, t) || "X" : r[0].toUpperCase().slice(0, Math.min(3, t)) || "X";
}
function im(e, t, r) {
  const i = $i(e), n = $i(t);
  return `KB-${i}-${n}-${r}`;
}
function nm(e, t) {
  return `KB-${$i(e)}-${$i(t)}-`;
}
function sm(e, t) {
  if (!e.startsWith(t)) return null;
  const r = Number.parseInt(e.slice(t.length), 10);
  return Number.isFinite(r) && r > 0 ? r : null;
}
var St = {}, Cl = function() {
  return typeof Promise == "function" && Promise.prototype && Promise.prototype.then;
}, la = {}, Ce = {};
let da;
const am = [
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
  return am[t];
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
  da = t;
};
Ce.isKanjiModeEnabled = function() {
  return typeof da < "u";
};
Ce.toSJIS = function(t) {
  return da(t);
};
var ln = {};
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
})(ln);
function Al() {
  this.buffer = [], this.length = 0;
}
Al.prototype = {
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
var om = Al;
function ti(e) {
  if (!e || e < 1)
    throw new Error("BitMatrix size must be defined and greater than 0");
  this.size = e, this.data = new Uint8Array(e * e), this.reservedBit = new Uint8Array(e * e);
}
ti.prototype.set = function(e, t, r, i) {
  const n = e * this.size + t;
  this.data[n] = r, i && (this.reservedBit[n] = !0);
};
ti.prototype.get = function(e, t) {
  return this.data[e * this.size + t];
};
ti.prototype.xor = function(e, t, r) {
  this.data[e * this.size + t] ^= r;
};
ti.prototype.isReserved = function(e, t) {
  return this.reservedBit[e * this.size + t];
};
var cm = ti, Ol = {};
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
})(Ol);
var kl = {};
const um = Ce.getSymbolSize, ac = 7;
kl.getPositions = function(t) {
  const r = um(t);
  return [
    // top-left
    [0, 0],
    // top-right
    [r - ac, 0],
    // bottom-left
    [0, r - ac]
  ];
};
var xl = {};
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
        let h = n.get(p, d);
        h === u ? o++ : (o >= 5 && (a += t.N1 + (o - 5)), u = h, o = 1), h = n.get(d, p), h === l ? c++ : (c >= 5 && (a += t.N1 + (c - 5)), l = h, c = 1);
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
})(xl);
var dn = {};
const vt = ln, Si = [
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
], Ri = [
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
dn.getBlocksCount = function(t, r) {
  switch (r) {
    case vt.L:
      return Si[(t - 1) * 4 + 0];
    case vt.M:
      return Si[(t - 1) * 4 + 1];
    case vt.Q:
      return Si[(t - 1) * 4 + 2];
    case vt.H:
      return Si[(t - 1) * 4 + 3];
    default:
      return;
  }
};
dn.getTotalCodewordsCount = function(t, r) {
  switch (r) {
    case vt.L:
      return Ri[(t - 1) * 4 + 0];
    case vt.M:
      return Ri[(t - 1) * 4 + 1];
    case vt.Q:
      return Ri[(t - 1) * 4 + 2];
    case vt.H:
      return Ri[(t - 1) * 4 + 3];
    default:
      return;
  }
};
var Dl = {}, fn = {};
const Pr = new Uint8Array(512), Hi = new Uint8Array(256);
(function() {
  let t = 1;
  for (let r = 0; r < 255; r++)
    Pr[r] = t, Hi[t] = r, t <<= 1, t & 256 && (t ^= 285);
  for (let r = 255; r < 512; r++)
    Pr[r] = Pr[r - 255];
})();
fn.log = function(t) {
  if (t < 1) throw new Error("log(" + t + ")");
  return Hi[t];
};
fn.exp = function(t) {
  return Pr[t];
};
fn.mul = function(t, r) {
  return t === 0 || r === 0 ? 0 : Pr[Hi[t] + Hi[r]];
};
(function(e) {
  const t = fn;
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
})(Dl);
const Ul = Dl;
function fa(e) {
  this.genPoly = void 0, this.degree = e, this.degree && this.initialize(this.degree);
}
fa.prototype.initialize = function(t) {
  this.degree = t, this.genPoly = Ul.generateECPolynomial(this.degree);
};
fa.prototype.encode = function(t) {
  if (!this.genPoly)
    throw new Error("Encoder not initialized");
  const r = new Uint8Array(t.length + this.degree);
  r.set(t);
  const i = Ul.mod(r, this.genPoly), n = this.degree - i.length;
  if (n > 0) {
    const s = new Uint8Array(this.degree);
    return s.set(i, n), s;
  }
  return i;
};
var lm = fa, Bl = {}, Rt = {}, ha = {};
ha.isValid = function(t) {
  return !isNaN(t) && t >= 1 && t <= 40;
};
var tt = {};
const Pl = "[0-9]+", dm = "[A-Z $%*+\\-./:]+";
let zr = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
zr = zr.replace(/u/g, "\\u");
const fm = "(?:(?![A-Z0-9 $%*+\\-./:]|" + zr + `)(?:.|[\r
]))+`;
tt.KANJI = new RegExp(zr, "g");
tt.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
tt.BYTE = new RegExp(fm, "g");
tt.NUMERIC = new RegExp(Pl, "g");
tt.ALPHANUMERIC = new RegExp(dm, "g");
const hm = new RegExp("^" + zr + "$"), pm = new RegExp("^" + Pl + "$"), _m = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
tt.testKanji = function(t) {
  return hm.test(t);
};
tt.testNumeric = function(t) {
  return pm.test(t);
};
tt.testAlphanumeric = function(t) {
  return _m.test(t);
};
(function(e) {
  const t = ha, r = tt;
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
})(Rt);
(function(e) {
  const t = Ce, r = dn, i = ln, n = Rt, s = ha, a = 7973, o = t.getBCHDigit(a);
  function c(d, h, _) {
    for (let E = 1; E <= 40; E++)
      if (h <= e.getCapacity(E, _, d))
        return E;
  }
  function u(d, h) {
    return n.getCharCountIndicator(d, h) + 4;
  }
  function l(d, h) {
    let _ = 0;
    return d.forEach(function(E) {
      const y = u(E.mode, h);
      _ += y + E.getBitsLength();
    }), _;
  }
  function p(d, h) {
    for (let _ = 1; _ <= 40; _++)
      if (l(d, _) <= e.getCapacity(_, h, n.MIXED))
        return _;
  }
  e.from = function(h, _) {
    return s.isValid(h) ? parseInt(h, 10) : _;
  }, e.getCapacity = function(h, _, E) {
    if (!s.isValid(h))
      throw new Error("Invalid QR Code version");
    typeof E > "u" && (E = n.BYTE);
    const y = t.getSymbolTotalCodewords(h), f = r.getTotalCodewordsCount(h, _), m = (y - f) * 8;
    if (E === n.MIXED) return m;
    const b = m - u(E, h);
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
  }, e.getBestVersionForData = function(h, _) {
    let E;
    const y = i.from(_, i.M);
    if (Array.isArray(h)) {
      if (h.length > 1)
        return p(h, y);
      if (h.length === 0)
        return 1;
      E = h[0];
    } else
      E = h;
    return c(E.mode, E.getLength(), y);
  }, e.getEncodedBits = function(h) {
    if (!s.isValid(h) || h < 7)
      throw new Error("Invalid QR Code version");
    let _ = h << 12;
    for (; t.getBCHDigit(_) - o >= 0; )
      _ ^= a << t.getBCHDigit(_) - o;
    return h << 12 | _;
  };
})(Bl);
var Fl = {};
const Os = Ce, Ml = 1335, Em = 21522, oc = Os.getBCHDigit(Ml);
Fl.getEncodedBits = function(t, r) {
  const i = t.bit << 3 | r;
  let n = i << 10;
  for (; Os.getBCHDigit(n) - oc >= 0; )
    n ^= Ml << Os.getBCHDigit(n) - oc;
  return (i << 10 | n) ^ Em;
};
var $l = {};
const mm = Rt;
function ur(e) {
  this.mode = mm.NUMERIC, this.data = e.toString();
}
ur.getBitsLength = function(t) {
  return 10 * Math.floor(t / 3) + (t % 3 ? t % 3 * 3 + 1 : 0);
};
ur.prototype.getLength = function() {
  return this.data.length;
};
ur.prototype.getBitsLength = function() {
  return ur.getBitsLength(this.data.length);
};
ur.prototype.write = function(t) {
  let r, i, n;
  for (r = 0; r + 3 <= this.data.length; r += 3)
    i = this.data.substr(r, 3), n = parseInt(i, 10), t.put(n, 10);
  const s = this.data.length - r;
  s > 0 && (i = this.data.substr(r), n = parseInt(i, 10), t.put(n, s * 3 + 1));
};
var gm = ur;
const Tm = Rt, cs = [
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
function lr(e) {
  this.mode = Tm.ALPHANUMERIC, this.data = e;
}
lr.getBitsLength = function(t) {
  return 11 * Math.floor(t / 2) + 6 * (t % 2);
};
lr.prototype.getLength = function() {
  return this.data.length;
};
lr.prototype.getBitsLength = function() {
  return lr.getBitsLength(this.data.length);
};
lr.prototype.write = function(t) {
  let r;
  for (r = 0; r + 2 <= this.data.length; r += 2) {
    let i = cs.indexOf(this.data[r]) * 45;
    i += cs.indexOf(this.data[r + 1]), t.put(i, 11);
  }
  this.data.length % 2 && t.put(cs.indexOf(this.data[r]), 6);
};
var bm = lr;
const vm = Rt;
function dr(e) {
  this.mode = vm.BYTE, typeof e == "string" ? this.data = new TextEncoder().encode(e) : this.data = new Uint8Array(e);
}
dr.getBitsLength = function(t) {
  return t * 8;
};
dr.prototype.getLength = function() {
  return this.data.length;
};
dr.prototype.getBitsLength = function() {
  return dr.getBitsLength(this.data.length);
};
dr.prototype.write = function(e) {
  for (let t = 0, r = this.data.length; t < r; t++)
    e.put(this.data[t], 8);
};
var wm = dr;
const ym = Rt, Sm = Ce;
function fr(e) {
  this.mode = ym.KANJI, this.data = e;
}
fr.getBitsLength = function(t) {
  return t * 13;
};
fr.prototype.getLength = function() {
  return this.data.length;
};
fr.prototype.getBitsLength = function() {
  return fr.getBitsLength(this.data.length);
};
fr.prototype.write = function(e) {
  let t;
  for (t = 0; t < this.data.length; t++) {
    let r = Sm.toSJIS(this.data[t]);
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
var Rm = fr, Hl = { exports: {} };
(function(e) {
  var t = {
    single_source_shortest_paths: function(r, i, n) {
      var s = {}, a = {};
      a[i] = 0;
      var o = t.PriorityQueue.make();
      o.push(i, 0);
      for (var c, u, l, p, d, h, _, E, y; !o.empty(); ) {
        c = o.pop(), u = c.value, p = c.cost, d = r[u] || {};
        for (l in d)
          d.hasOwnProperty(l) && (h = d[l], _ = p + h, E = a[l], y = typeof a[l] > "u", (y || E > _) && (a[l] = _, o.push(l, _), s[l] = u));
      }
      if (typeof n < "u" && typeof a[n] > "u") {
        var f = ["Could not find a path from ", i, " to ", n, "."].join("");
        throw new Error(f);
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
})(Hl);
var Nm = Hl.exports;
(function(e) {
  const t = Rt, r = gm, i = bm, n = wm, s = Rm, a = tt, o = Ce, c = Nm;
  function u(f) {
    return unescape(encodeURIComponent(f)).length;
  }
  function l(f, m, b) {
    const v = [];
    let w;
    for (; (w = f.exec(b)) !== null; )
      v.push({
        data: w[0],
        index: w.index,
        mode: m,
        length: w[0].length
      });
    return v;
  }
  function p(f) {
    const m = l(a.NUMERIC, t.NUMERIC, f), b = l(a.ALPHANUMERIC, t.ALPHANUMERIC, f);
    let v, w;
    return o.isKanjiModeEnabled() ? (v = l(a.BYTE, t.BYTE, f), w = l(a.KANJI, t.KANJI, f)) : (v = l(a.BYTE_KANJI, t.BYTE, f), w = []), m.concat(b, v, w).sort(function(I, k) {
      return I.index - k.index;
    }).map(function(I) {
      return {
        data: I.data,
        mode: I.mode,
        length: I.length
      };
    });
  }
  function d(f, m) {
    switch (m) {
      case t.NUMERIC:
        return r.getBitsLength(f);
      case t.ALPHANUMERIC:
        return i.getBitsLength(f);
      case t.KANJI:
        return s.getBitsLength(f);
      case t.BYTE:
        return n.getBitsLength(f);
    }
  }
  function h(f) {
    return f.reduce(function(m, b) {
      const v = m.length - 1 >= 0 ? m[m.length - 1] : null;
      return v && v.mode === b.mode ? (m[m.length - 1].data += b.data, m) : (m.push(b), m);
    }, []);
  }
  function _(f) {
    const m = [];
    for (let b = 0; b < f.length; b++) {
      const v = f[b];
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
  function E(f, m) {
    const b = {}, v = { start: {} };
    let w = ["start"];
    for (let L = 0; L < f.length; L++) {
      const I = f[L], k = [];
      for (let B = 0; B < I.length; B++) {
        const M = I[B], D = "" + L + B;
        k.push(D), b[D] = { node: M, lastCount: 0 }, v[D] = {};
        for (let j = 0; j < w.length; j++) {
          const te = w[j];
          b[te] && b[te].node.mode === M.mode ? (v[te][D] = d(b[te].lastCount + M.length, M.mode) - d(b[te].lastCount, M.mode), b[te].lastCount += M.length) : (b[te] && (b[te].lastCount = M.length), v[te][D] = d(M.length, M.mode) + 4 + t.getCharCountIndicator(M.mode, m));
        }
      }
      w = k;
    }
    for (let L = 0; L < w.length; L++)
      v[w[L]].end = 0;
    return { map: v, table: b };
  }
  function y(f, m) {
    let b;
    const v = t.getBestModeForData(f);
    if (b = t.from(m, v), b !== t.BYTE && b.bit < v.bit)
      throw new Error('"' + f + '" cannot be encoded with mode ' + t.toString(b) + `.
 Suggested mode is: ` + t.toString(v));
    switch (b === t.KANJI && !o.isKanjiModeEnabled() && (b = t.BYTE), b) {
      case t.NUMERIC:
        return new r(f);
      case t.ALPHANUMERIC:
        return new i(f);
      case t.KANJI:
        return new s(f);
      case t.BYTE:
        return new n(f);
    }
  }
  e.fromArray = function(m) {
    return m.reduce(function(b, v) {
      return typeof v == "string" ? b.push(y(v, null)) : v.data && b.push(y(v.data, v.mode)), b;
    }, []);
  }, e.fromString = function(m, b) {
    const v = p(m, o.isKanjiModeEnabled()), w = _(v), L = E(w, b), I = c.find_path(L.map, "start", "end"), k = [];
    for (let B = 1; B < I.length - 1; B++)
      k.push(L.table[I[B]].node);
    return e.fromArray(h(k));
  }, e.rawSplit = function(m) {
    return e.fromArray(
      p(m, o.isKanjiModeEnabled())
    );
  };
})($l);
const hn = Ce, us = ln, Im = om, Lm = cm, Cm = Ol, Am = kl, ks = xl, xs = dn, Om = lm, Xi = Bl, km = Fl, xm = Rt, ls = $l;
function Dm(e, t) {
  const r = e.size, i = Am.getPositions(t);
  for (let n = 0; n < i.length; n++) {
    const s = i[n][0], a = i[n][1];
    for (let o = -1; o <= 7; o++)
      if (!(s + o <= -1 || r <= s + o))
        for (let c = -1; c <= 7; c++)
          a + c <= -1 || r <= a + c || (o >= 0 && o <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (o === 0 || o === 6) || o >= 2 && o <= 4 && c >= 2 && c <= 4 ? e.set(s + o, a + c, !0, !0) : e.set(s + o, a + c, !1, !0));
  }
}
function Um(e) {
  const t = e.size;
  for (let r = 8; r < t - 8; r++) {
    const i = r % 2 === 0;
    e.set(r, 6, i, !0), e.set(6, r, i, !0);
  }
}
function Bm(e, t) {
  const r = Cm.getPositions(t);
  for (let i = 0; i < r.length; i++) {
    const n = r[i][0], s = r[i][1];
    for (let a = -2; a <= 2; a++)
      for (let o = -2; o <= 2; o++)
        a === -2 || a === 2 || o === -2 || o === 2 || a === 0 && o === 0 ? e.set(n + a, s + o, !0, !0) : e.set(n + a, s + o, !1, !0);
  }
}
function Pm(e, t) {
  const r = e.size, i = Xi.getEncodedBits(t);
  let n, s, a;
  for (let o = 0; o < 18; o++)
    n = Math.floor(o / 3), s = o % 3 + r - 8 - 3, a = (i >> o & 1) === 1, e.set(n, s, a, !0), e.set(s, n, a, !0);
}
function ds(e, t, r) {
  const i = e.size, n = km.getEncodedBits(t, r);
  let s, a;
  for (s = 0; s < 15; s++)
    a = (n >> s & 1) === 1, s < 6 ? e.set(s, 8, a, !0) : s < 8 ? e.set(s + 1, 8, a, !0) : e.set(i - 15 + s, 8, a, !0), s < 8 ? e.set(8, i - s - 1, a, !0) : s < 9 ? e.set(8, 15 - s - 1 + 1, a, !0) : e.set(8, 15 - s - 1, a, !0);
  e.set(i - 8, 8, 1, !0);
}
function Fm(e, t) {
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
function Mm(e, t, r) {
  const i = new Im();
  r.forEach(function(c) {
    i.put(c.mode.bit, 4), i.put(c.getLength(), xm.getCharCountIndicator(c.mode, e)), c.write(i);
  });
  const n = hn.getSymbolTotalCodewords(e), s = xs.getTotalCodewordsCount(e, t), a = (n - s) * 8;
  for (i.getLengthInBits() + 4 <= a && i.put(0, 4); i.getLengthInBits() % 8 !== 0; )
    i.putBit(0);
  const o = (a - i.getLengthInBits()) / 8;
  for (let c = 0; c < o; c++)
    i.put(c % 2 ? 17 : 236, 8);
  return $m(i, e, t);
}
function $m(e, t, r) {
  const i = hn.getSymbolTotalCodewords(t), n = xs.getTotalCodewordsCount(t, r), s = i - n, a = xs.getBlocksCount(t, r), o = i % a, c = a - o, u = Math.floor(i / a), l = Math.floor(s / a), p = l + 1, d = u - l, h = new Om(d);
  let _ = 0;
  const E = new Array(a), y = new Array(a);
  let f = 0;
  const m = new Uint8Array(e.buffer);
  for (let I = 0; I < a; I++) {
    const k = I < c ? l : p;
    E[I] = m.slice(_, _ + k), y[I] = h.encode(E[I]), _ += k, f = Math.max(f, k);
  }
  const b = new Uint8Array(i);
  let v = 0, w, L;
  for (w = 0; w < f; w++)
    for (L = 0; L < a; L++)
      w < E[L].length && (b[v++] = E[L][w]);
  for (w = 0; w < d; w++)
    for (L = 0; L < a; L++)
      b[v++] = y[L][w];
  return b;
}
function Hm(e, t, r, i) {
  let n;
  if (Array.isArray(e))
    n = ls.fromArray(e);
  else if (typeof e == "string") {
    let u = t;
    if (!u) {
      const l = ls.rawSplit(e);
      u = Xi.getBestVersionForData(l, r);
    }
    n = ls.fromString(e, u || 40);
  } else
    throw new Error("Invalid data");
  const s = Xi.getBestVersionForData(n, r);
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
  const a = Mm(t, r, n), o = hn.getSymbolSize(t), c = new Lm(o);
  return Dm(c, t), Um(c), Bm(c, t), ds(c, r, 0), t >= 7 && Pm(c, t), Fm(c, a), isNaN(i) && (i = ks.getBestMask(
    c,
    ds.bind(null, c, r)
  )), ks.applyMask(i, c), ds(c, r, i), {
    modules: c,
    version: t,
    errorCorrectionLevel: r,
    maskPattern: i,
    segments: n
  };
}
la.create = function(t, r) {
  if (typeof t > "u" || t === "")
    throw new Error("No input text");
  let i = us.M, n, s;
  return typeof r < "u" && (i = us.from(r.errorCorrectionLevel, us.M), n = Xi.from(r.version), s = ks.from(r.maskPattern), r.toSJISFunc && hn.setToSJISFunction(r.toSJISFunc)), Hm(t, n, i, s);
};
var Xl = {}, zl = {}, Wl = { exports: {} }, ql = { exports: {} };
let Xm = ct, Kl = Wr, qe = ql.exports = function() {
  Kl.call(this), this._buffers = [], this._buffered = 0, this._reads = [], this._paused = !1, this._encoding = "utf8", this.writable = !0;
};
Xm.inherits(qe, Kl);
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
var Yl = ql.exports, jl = { exports: {} }, Gl = { exports: {} }, pn = {};
let mt = [
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
pn.getImagePasses = function(e, t) {
  let r = [], i = e % 8, n = t % 8, s = (e - i) / 8, a = (t - n) / 8;
  for (let o = 0; o < mt.length; o++) {
    let c = mt[o], u = s * c.x.length, l = a * c.y.length;
    for (let p = 0; p < c.x.length && c.x[p] < i; p++)
      u++;
    for (let p = 0; p < c.y.length && c.y[p] < n; p++)
      l++;
    u > 0 && l > 0 && r.push({ width: u, height: l, index: o });
  }
  return r;
};
pn.getInterlaceIterator = function(e) {
  return function(t, r, i) {
    let n = t % mt[i].x.length, s = (t - n) / mt[i].x.length * 8 + mt[i].x[n], a = r % mt[i].y.length, o = (r - a) / mt[i].y.length * 8 + mt[i].y[a];
    return s * 4 + o * e * 4;
  };
};
var Vl = function(t, r, i) {
  let n = t + r - i, s = Math.abs(n - t), a = Math.abs(n - r), o = Math.abs(n - i);
  return s <= a && s <= o ? t : a <= o ? r : i;
};
let zm = pn, Wm = Vl;
function cc(e, t, r) {
  let i = e * t;
  return r !== 8 && (i = Math.ceil(i / (8 / r))), i;
}
let Sr = Gl.exports = function(e, t) {
  let r = e.width, i = e.height, n = e.interlace, s = e.bpp, a = e.depth;
  if (this.read = t.read, this.write = t.write, this.complete = t.complete, this._imageIndex = 0, this._images = [], n) {
    let o = zm.getImagePasses(r, i);
    for (let c = 0; c < o.length; c++)
      this._images.push({
        byteWidth: cc(o[c].width, s, a),
        height: o[c].height,
        lineIndex: 0
      });
  } else
    this._images.push({
      byteWidth: cc(r, s, a),
      height: i,
      lineIndex: 0
    });
  a === 8 ? this._xComparison = s : a === 16 ? this._xComparison = s * 2 : this._xComparison = 1;
};
Sr.prototype.start = function() {
  this.read(
    this._images[this._imageIndex].byteWidth + 1,
    this._reverseFilterLine.bind(this)
  );
};
Sr.prototype._unFilterType1 = function(e, t, r) {
  let i = this._xComparison, n = i - 1;
  for (let s = 0; s < r; s++) {
    let a = e[1 + s], o = s > n ? t[s - i] : 0;
    t[s] = a + o;
  }
};
Sr.prototype._unFilterType2 = function(e, t, r) {
  let i = this._lastLine;
  for (let n = 0; n < r; n++) {
    let s = e[1 + n], a = i ? i[n] : 0;
    t[n] = s + a;
  }
};
Sr.prototype._unFilterType3 = function(e, t, r) {
  let i = this._xComparison, n = i - 1, s = this._lastLine;
  for (let a = 0; a < r; a++) {
    let o = e[1 + a], c = s ? s[a] : 0, u = a > n ? t[a - i] : 0, l = Math.floor((u + c) / 2);
    t[a] = o + l;
  }
};
Sr.prototype._unFilterType4 = function(e, t, r) {
  let i = this._xComparison, n = i - 1, s = this._lastLine;
  for (let a = 0; a < r; a++) {
    let o = e[1 + a], c = s ? s[a] : 0, u = a > n ? t[a - i] : 0, l = a > n && s ? s[a - i] : 0, p = Wm(u, c, l);
    t[a] = o + p;
  }
};
Sr.prototype._reverseFilterLine = function(e) {
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
var Zl = Gl.exports;
let qm = ct, Jl = Yl, Km = Zl, Ym = jl.exports = function(e) {
  Jl.call(this);
  let t = [], r = this;
  this._filter = new Km(e, {
    read: this.read.bind(this),
    write: function(i) {
      t.push(i);
    },
    complete: function() {
      r.emit("complete", Buffer.concat(t));
    }
  }), this._filter.start();
};
qm.inherits(Ym, Jl);
var jm = jl.exports, Ql = { exports: {} }, ri = {
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
}, ed = { exports: {} };
let pa = [];
(function() {
  for (let e = 0; e < 256; e++) {
    let t = e;
    for (let r = 0; r < 8; r++)
      t & 1 ? t = 3988292384 ^ t >>> 1 : t = t >>> 1;
    pa[e] = t;
  }
})();
let _a = ed.exports = function() {
  this._crc = -1;
};
_a.prototype.write = function(e) {
  for (let t = 0; t < e.length; t++)
    this._crc = pa[(this._crc ^ e[t]) & 255] ^ this._crc >>> 8;
  return !0;
};
_a.prototype.crc32 = function() {
  return this._crc ^ -1;
};
_a.crc32 = function(e) {
  let t = -1;
  for (let r = 0; r < e.length; r++)
    t = pa[(t ^ e[r]) & 255] ^ t >>> 8;
  return t ^ -1;
};
var td = ed.exports;
let pe = ri, Gm = td, me = Ql.exports = function(e, t) {
  this._options = e, e.checkCRC = e.checkCRC !== !1, this._hasIHDR = !1, this._hasIEND = !1, this._emittedHeadersFinished = !1, this._palette = [], this._colorType = 0, this._chunks = {}, this._chunks[pe.TYPE_IHDR] = this._handleIHDR.bind(this), this._chunks[pe.TYPE_IEND] = this._handleIEND.bind(this), this._chunks[pe.TYPE_IDAT] = this._handleIDAT.bind(this), this._chunks[pe.TYPE_PLTE] = this._handlePLTE.bind(this), this._chunks[pe.TYPE_tRNS] = this._handleTRNS.bind(this), this._chunks[pe.TYPE_gAMA] = this._handleGAMA.bind(this), this.read = t.read, this.error = t.error, this.metadata = t.metadata, this.gamma = t.gamma, this.transColor = t.transColor, this.palette = t.palette, this.parsed = t.parsed, this.inflateData = t.inflateData, this.finished = t.finished, this.simpleTransparency = t.simpleTransparency, this.headersFinished = t.headersFinished || function() {
  };
};
me.prototype.start = function() {
  this.read(pe.PNG_SIGNATURE.length, this._parseSignature.bind(this));
};
me.prototype._parseSignature = function(e) {
  let t = pe.PNG_SIGNATURE;
  for (let r = 0; r < t.length; r++)
    if (e[r] !== t[r]) {
      this.error(new Error("Invalid file signature"));
      return;
    }
  this.read(8, this._parseChunkBegin.bind(this));
};
me.prototype._parseChunkBegin = function(e) {
  let t = e.readUInt32BE(0), r = e.readUInt32BE(4), i = "";
  for (let s = 4; s < 8; s++)
    i += String.fromCharCode(e[s]);
  let n = !!(e[4] & 32);
  if (!this._hasIHDR && r !== pe.TYPE_IHDR) {
    this.error(new Error("Expected IHDR on beggining"));
    return;
  }
  if (this._crc = new Gm(), this._crc.write(Buffer.from(i)), this._chunks[r])
    return this._chunks[r](t);
  if (!n) {
    this.error(new Error("Unsupported critical chunk type " + i));
    return;
  }
  this.read(t + 4, this._skipChunk.bind(this));
};
me.prototype._skipChunk = function() {
  this.read(8, this._parseChunkBegin.bind(this));
};
me.prototype._handleChunkEnd = function() {
  this.read(4, this._parseChunkEnd.bind(this));
};
me.prototype._parseChunkEnd = function(e) {
  let t = e.readInt32BE(0), r = this._crc.crc32();
  if (this._options.checkCRC && r !== t) {
    this.error(new Error("Crc error - " + t + " - " + r));
    return;
  }
  this._hasIEND || this.read(8, this._parseChunkBegin.bind(this));
};
me.prototype._handleIHDR = function(e) {
  this.read(e, this._parseIHDR.bind(this));
};
me.prototype._parseIHDR = function(e) {
  this._crc.write(e);
  let t = e.readUInt32BE(0), r = e.readUInt32BE(4), i = e[8], n = e[9], s = e[10], a = e[11], o = e[12];
  if (i !== 8 && i !== 4 && i !== 2 && i !== 1 && i !== 16) {
    this.error(new Error("Unsupported bit depth " + i));
    return;
  }
  if (!(n in pe.COLORTYPE_TO_BPP_MAP)) {
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
  let c = pe.COLORTYPE_TO_BPP_MAP[this._colorType];
  this._hasIHDR = !0, this.metadata({
    width: t,
    height: r,
    depth: i,
    interlace: !!o,
    palette: !!(n & pe.COLORTYPE_PALETTE),
    color: !!(n & pe.COLORTYPE_COLOR),
    alpha: !!(n & pe.COLORTYPE_ALPHA),
    bpp: c,
    colorType: n
  }), this._handleChunkEnd();
};
me.prototype._handlePLTE = function(e) {
  this.read(e, this._parsePLTE.bind(this));
};
me.prototype._parsePLTE = function(e) {
  this._crc.write(e);
  let t = Math.floor(e.length / 3);
  for (let r = 0; r < t; r++)
    this._palette.push([e[r * 3], e[r * 3 + 1], e[r * 3 + 2], 255]);
  this.palette(this._palette), this._handleChunkEnd();
};
me.prototype._handleTRNS = function(e) {
  this.simpleTransparency(), this.read(e, this._parseTRNS.bind(this));
};
me.prototype._parseTRNS = function(e) {
  if (this._crc.write(e), this._colorType === pe.COLORTYPE_PALETTE_COLOR) {
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
  this._colorType === pe.COLORTYPE_GRAYSCALE && this.transColor([e.readUInt16BE(0)]), this._colorType === pe.COLORTYPE_COLOR && this.transColor([
    e.readUInt16BE(0),
    e.readUInt16BE(2),
    e.readUInt16BE(4)
  ]), this._handleChunkEnd();
};
me.prototype._handleGAMA = function(e) {
  this.read(e, this._parseGAMA.bind(this));
};
me.prototype._parseGAMA = function(e) {
  this._crc.write(e), this.gamma(e.readUInt32BE(0) / pe.GAMMA_DIVISION), this._handleChunkEnd();
};
me.prototype._handleIDAT = function(e) {
  this._emittedHeadersFinished || (this._emittedHeadersFinished = !0, this.headersFinished()), this.read(-e, this._parseIDAT.bind(this, e));
};
me.prototype._parseIDAT = function(e, t) {
  if (this._crc.write(t), this._colorType === pe.COLORTYPE_PALETTE_COLOR && this._palette.length === 0)
    throw new Error("Expected palette not found");
  this.inflateData(t);
  let r = e - t.length;
  r > 0 ? this._handleIDAT(r) : this._handleChunkEnd();
};
me.prototype._handleIEND = function(e) {
  this.read(e, this._parseIEND.bind(this));
};
me.prototype._parseIEND = function(e) {
  this._crc.write(e), this._hasIEND = !0, this._handleChunkEnd(), this.finished && this.finished();
};
var rd = Ql.exports, Ea = {};
let uc = pn, Vm = [
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
], Zm = [
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
function Jm(e, t) {
  let r = [], i = 0;
  function n() {
    if (i === e.length)
      throw new Error("Ran out of data");
    let s = e[i];
    i++;
    let a, o, c, u, l, p, d, h;
    switch (t) {
      default:
        throw new Error("unrecognised depth");
      case 16:
        d = e[i], i++, r.push((s << 8) + d);
        break;
      case 4:
        d = s & 15, h = s >> 4, r.push(h, d);
        break;
      case 2:
        l = s & 3, p = s >> 2 & 3, d = s >> 4 & 3, h = s >> 6 & 3, r.push(h, d, p, l);
        break;
      case 1:
        a = s & 1, o = s >> 1 & 1, c = s >> 2 & 1, u = s >> 3 & 1, l = s >> 4 & 1, p = s >> 5 & 1, d = s >> 6 & 1, h = s >> 7 & 1, r.push(h, d, p, l, u, c, o, a);
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
function Qm(e, t, r, i, n, s) {
  let a = e.width, o = e.height, c = e.index;
  for (let u = 0; u < o; u++)
    for (let l = 0; l < a; l++) {
      let p = r(l, u, c);
      Vm[i](t, n, p, s), s += i;
    }
  return s;
}
function eg(e, t, r, i, n, s) {
  let a = e.width, o = e.height, c = e.index;
  for (let u = 0; u < o; u++) {
    for (let l = 0; l < a; l++) {
      let p = n.get(i), d = r(l, u, c);
      Zm[i](t, p, d, s);
    }
    n.resetAfterLine();
  }
}
Ea.dataToBitMap = function(e, t) {
  let r = t.width, i = t.height, n = t.depth, s = t.bpp, a = t.interlace, o;
  n !== 8 && (o = Jm(e, n));
  let c;
  n <= 8 ? c = Buffer.alloc(r * i * 4) : c = new Uint16Array(r * i * 4);
  let u = Math.pow(2, n) - 1, l = 0, p, d;
  if (a)
    p = uc.getImagePasses(r, i), d = uc.getInterlaceIterator(r, i);
  else {
    let h = 0;
    d = function() {
      let _ = h;
      return h += 4, _;
    }, p = [{ width: r, height: i }];
  }
  for (let h = 0; h < p.length; h++)
    n === 8 ? l = Qm(
      p[h],
      c,
      d,
      s,
      e,
      l
    ) : eg(
      p[h],
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
function tg(e, t, r, i, n) {
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
function rg(e, t, r, i, n) {
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
function ig(e, t, r, i, n) {
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
var id = function(e, t) {
  let r = t.depth, i = t.width, n = t.height, s = t.colorType, a = t.transColor, o = t.palette, c = e;
  return s === 3 ? tg(e, c, i, n, o) : (a && rg(e, c, i, n, a), r !== 8 && (r === 16 && (c = Buffer.alloc(i * n * 4)), ig(e, c, i, n, r))), c;
};
let ng = ct, fs = qr, nd = Yl, sg = jm, ag = rd, og = Ea, cg = id, rt = Wl.exports = function(e) {
  nd.call(this), this._parser = new ag(e, {
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
ng.inherits(rt, nd);
rt.prototype._handleError = function(e) {
  this.emit("error", e), this.writable = !1, this.destroy(), this._inflate && this._inflate.destroy && this._inflate.destroy(), this._filter && (this._filter.destroy(), this._filter.on("error", function() {
  })), this.errord = !0;
};
rt.prototype._inflateData = function(e) {
  if (!this._inflate)
    if (this._bitmapInfo.interlace)
      this._inflate = fs.createInflate(), this._inflate.on("error", this.emit.bind(this, "error")), this._filter.on("complete", this._complete.bind(this)), this._inflate.pipe(this._filter);
    else {
      let r = ((this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1) * this._bitmapInfo.height, i = Math.max(r, fs.Z_MIN_CHUNK);
      this._inflate = fs.createInflate({ chunkSize: i });
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
  this._metaData = e, this._bitmapInfo = Object.create(e), this._filter = new sg(this._bitmapInfo);
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
    let r = og.dataToBitMap(e, this._bitmapInfo);
    t = cg(r, this._bitmapInfo), r = null;
  } catch (r) {
    this._handleError(r);
    return;
  }
  this.emit("parsed", t);
};
var ug = Wl.exports, sd = { exports: {} }, ad = { exports: {} };
let Oe = ri;
var lg = function(e, t, r, i) {
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
  function h() {
    let _, E, y, f = a;
    switch (i.inputColorType) {
      case Oe.COLORTYPE_COLOR_ALPHA:
        f = s[l + 3], _ = s[l], E = s[l + 1], y = s[l + 2];
        break;
      case Oe.COLORTYPE_COLOR:
        _ = s[l], E = s[l + 1], y = s[l + 2];
        break;
      case Oe.COLORTYPE_ALPHA:
        f = s[l + 1], _ = s[l], E = _, y = _;
        break;
      case Oe.COLORTYPE_GRAYSCALE:
        _ = s[l], E = _, y = _;
        break;
      default:
        throw new Error(
          "input color type:" + i.inputColorType + " is not supported at present"
        );
    }
    return i.inputHasAlpha && (n || (f /= a, _ = Math.min(
      Math.max(Math.round((1 - f) * d.red + f * _), 0),
      a
    ), E = Math.min(
      Math.max(Math.round((1 - f) * d.green + f * E), 0),
      a
    ), y = Math.min(
      Math.max(Math.round((1 - f) * d.blue + f * y), 0),
      a
    ))), { red: _, green: E, blue: y, alpha: f };
  }
  for (let _ = 0; _ < r; _++)
    for (let E = 0; E < t; E++) {
      let y = h();
      switch (i.colorType) {
        case Oe.COLORTYPE_COLOR_ALPHA:
        case Oe.COLORTYPE_COLOR:
          i.bitDepth === 8 ? (u[p] = y.red, u[p + 1] = y.green, u[p + 2] = y.blue, n && (u[p + 3] = y.alpha)) : (u.writeUInt16BE(y.red, p), u.writeUInt16BE(y.green, p + 2), u.writeUInt16BE(y.blue, p + 4), n && u.writeUInt16BE(y.alpha, p + 6));
          break;
        case Oe.COLORTYPE_ALPHA:
        case Oe.COLORTYPE_GRAYSCALE: {
          let f = (y.red + y.green + y.blue) / 3;
          i.bitDepth === 8 ? (u[p] = f, n && (u[p + 1] = y.alpha)) : (u.writeUInt16BE(f, p), n && u.writeUInt16BE(y.alpha, p + 2));
          break;
        }
        default:
          throw new Error("unrecognised color Type " + i.colorType);
      }
      l += o, p += c;
    }
  return u;
};
let od = Vl;
function dg(e, t, r, i, n) {
  for (let s = 0; s < r; s++)
    i[n + s] = e[t + s];
}
function fg(e, t, r) {
  let i = 0, n = t + r;
  for (let s = t; s < n; s++)
    i += Math.abs(e[s]);
  return i;
}
function hg(e, t, r, i, n, s) {
  for (let a = 0; a < r; a++) {
    let o = a >= s ? e[t + a - s] : 0, c = e[t + a] - o;
    i[n + a] = c;
  }
}
function pg(e, t, r, i) {
  let n = 0;
  for (let s = 0; s < r; s++) {
    let a = s >= i ? e[t + s - i] : 0, o = e[t + s] - a;
    n += Math.abs(o);
  }
  return n;
}
function _g(e, t, r, i, n) {
  for (let s = 0; s < r; s++) {
    let a = t > 0 ? e[t + s - r] : 0, o = e[t + s] - a;
    i[n + s] = o;
  }
}
function Eg(e, t, r) {
  let i = 0, n = t + r;
  for (let s = t; s < n; s++) {
    let a = t > 0 ? e[s - r] : 0, o = e[s] - a;
    i += Math.abs(o);
  }
  return i;
}
function mg(e, t, r, i, n, s) {
  for (let a = 0; a < r; a++) {
    let o = a >= s ? e[t + a - s] : 0, c = t > 0 ? e[t + a - r] : 0, u = e[t + a] - (o + c >> 1);
    i[n + a] = u;
  }
}
function gg(e, t, r, i) {
  let n = 0;
  for (let s = 0; s < r; s++) {
    let a = s >= i ? e[t + s - i] : 0, o = t > 0 ? e[t + s - r] : 0, c = e[t + s] - (a + o >> 1);
    n += Math.abs(c);
  }
  return n;
}
function Tg(e, t, r, i, n, s) {
  for (let a = 0; a < r; a++) {
    let o = a >= s ? e[t + a - s] : 0, c = t > 0 ? e[t + a - r] : 0, u = t > 0 && a >= s ? e[t + a - (r + s)] : 0, l = e[t + a] - od(o, c, u);
    i[n + a] = l;
  }
}
function bg(e, t, r, i) {
  let n = 0;
  for (let s = 0; s < r; s++) {
    let a = s >= i ? e[t + s - i] : 0, o = t > 0 ? e[t + s - r] : 0, c = t > 0 && s >= i ? e[t + s - (r + i)] : 0, u = e[t + s] - od(a, o, c);
    n += Math.abs(u);
  }
  return n;
}
let vg = {
  0: dg,
  1: hg,
  2: _g,
  3: mg,
  4: Tg
}, wg = {
  0: fg,
  1: pg,
  2: Eg,
  3: gg,
  4: bg
};
var yg = function(e, t, r, i, n) {
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
      for (let h = 0; h < s.length; h++) {
        let _ = wg[s[h]](e, c, a, n);
        _ < d && (l = s[h], d = _);
      }
    }
    u[o] = l, o++, vg[l](e, c, a, u, o, n), o += a, c += a;
  }
  return u;
};
let ye = ri, Sg = td, Rg = lg, Ng = yg, Ig = qr, Nt = ad.exports = function(e) {
  if (this._options = e, e.deflateChunkSize = e.deflateChunkSize || 32 * 1024, e.deflateLevel = e.deflateLevel != null ? e.deflateLevel : 9, e.deflateStrategy = e.deflateStrategy != null ? e.deflateStrategy : 3, e.inputHasAlpha = e.inputHasAlpha != null ? e.inputHasAlpha : !0, e.deflateFactory = e.deflateFactory || Ig.createDeflate, e.bitDepth = e.bitDepth || 8, e.colorType = typeof e.colorType == "number" ? e.colorType : ye.COLORTYPE_COLOR_ALPHA, e.inputColorType = typeof e.inputColorType == "number" ? e.inputColorType : ye.COLORTYPE_COLOR_ALPHA, [
    ye.COLORTYPE_GRAYSCALE,
    ye.COLORTYPE_COLOR,
    ye.COLORTYPE_COLOR_ALPHA,
    ye.COLORTYPE_ALPHA
  ].indexOf(e.colorType) === -1)
    throw new Error(
      "option color type:" + e.colorType + " is not supported at present"
    );
  if ([
    ye.COLORTYPE_GRAYSCALE,
    ye.COLORTYPE_COLOR,
    ye.COLORTYPE_COLOR_ALPHA,
    ye.COLORTYPE_ALPHA
  ].indexOf(e.inputColorType) === -1)
    throw new Error(
      "option input color type:" + e.inputColorType + " is not supported at present"
    );
  if (e.bitDepth !== 8 && e.bitDepth !== 16)
    throw new Error(
      "option bit depth:" + e.bitDepth + " is not supported at present"
    );
};
Nt.prototype.getDeflateOptions = function() {
  return {
    chunkSize: this._options.deflateChunkSize,
    level: this._options.deflateLevel,
    strategy: this._options.deflateStrategy
  };
};
Nt.prototype.createDeflate = function() {
  return this._options.deflateFactory(this.getDeflateOptions());
};
Nt.prototype.filterData = function(e, t, r) {
  let i = Rg(e, t, r, this._options), n = ye.COLORTYPE_TO_BPP_MAP[this._options.colorType];
  return Ng(i, t, r, this._options, n);
};
Nt.prototype._packChunk = function(e, t) {
  let r = t ? t.length : 0, i = Buffer.alloc(r + 12);
  return i.writeUInt32BE(r, 0), i.writeUInt32BE(e, 4), t && t.copy(i, 8), i.writeInt32BE(
    Sg.crc32(i.slice(4, i.length - 4)),
    i.length - 4
  ), i;
};
Nt.prototype.packGAMA = function(e) {
  let t = Buffer.alloc(4);
  return t.writeUInt32BE(Math.floor(e * ye.GAMMA_DIVISION), 0), this._packChunk(ye.TYPE_gAMA, t);
};
Nt.prototype.packIHDR = function(e, t) {
  let r = Buffer.alloc(13);
  return r.writeUInt32BE(e, 0), r.writeUInt32BE(t, 4), r[8] = this._options.bitDepth, r[9] = this._options.colorType, r[10] = 0, r[11] = 0, r[12] = 0, this._packChunk(ye.TYPE_IHDR, r);
};
Nt.prototype.packIDAT = function(e) {
  return this._packChunk(ye.TYPE_IDAT, e);
};
Nt.prototype.packIEND = function() {
  return this._packChunk(ye.TYPE_IEND, null);
};
var cd = ad.exports;
let Lg = ct, ud = Wr, Cg = ri, Ag = cd, ld = sd.exports = function(e) {
  ud.call(this);
  let t = e || {};
  this._packer = new Ag(t), this._deflate = this._packer.createDeflate(), this.readable = !0;
};
Lg.inherits(ld, ud);
ld.prototype.pack = function(e, t, r, i) {
  this.emit("data", Buffer.from(Cg.PNG_SIGNATURE)), this.emit("data", this._packer.packIHDR(t, r)), i && this.emit("data", this._packer.packGAMA(i));
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
var Og = sd.exports, ma = {}, Ds = { exports: {} };
(function(e, t) {
  let r = zd.ok, i = qr, n = ct, s = Dc.kMaxLength;
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
  a.prototype._processChunk = function(p, d, h) {
    if (typeof h == "function")
      return i.Inflate._processChunk.call(this, p, d, h);
    let _ = this, E = p && p.length, y = this._chunkSize - this._offset, f = this._maxLength, m = 0, b = [], v = 0, w;
    this.on("error", function(B) {
      w = B;
    });
    function L(B, M) {
      if (_._hadError)
        return;
      let D = y - M;
      if (r(D >= 0, "have should not go down"), D > 0) {
        let j = _._buffer.slice(_._offset, _._offset + D);
        if (_._offset += D, j.length > f && (j = j.slice(0, f)), b.push(j), v += j.length, f -= j.length, f === 0)
          return !1;
      }
      return (M === 0 || _._offset >= _._chunkSize) && (y = _._chunkSize, _._offset = 0, _._buffer = Buffer.allocUnsafe(_._chunkSize)), M === 0 ? (m += E - B, E = B, !0) : !1;
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
        y
      ), I = I || this._writeState;
    while (!this._hadError && L(I[0], I[1]));
    if (this._hadError)
      throw w;
    if (v >= s)
      throw c(this), new RangeError(
        "Cannot create final Buffer. It would be larger than 0x" + s.toString(16) + " bytes"
      );
    let k = Buffer.concat(b, v);
    return c(this), k;
  }, n.inherits(a, i.Inflate);
  function u(p, d) {
    if (typeof d == "string" && (d = Buffer.from(d)), !(d instanceof Buffer))
      throw new TypeError("Not a string or buffer");
    let h = p._finishFlushFlag;
    return h == null && (h = i.Z_FINISH), p._processChunk(d, h);
  }
  function l(p, d) {
    return u(new a(d), p);
  }
  e.exports = t = l, t.Inflate = a, t.createInflate = o, t.inflateSync = l;
})(Ds, Ds.exports);
var kg = Ds.exports, dd = { exports: {} };
let fd = dd.exports = function(e) {
  this._buffer = e, this._reads = [];
};
fd.prototype.read = function(e, t) {
  this._reads.push({
    length: Math.abs(e),
    // if length < 0 then at most this length
    allowLess: e < 0,
    func: t
  });
};
fd.prototype.process = function() {
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
var hd = dd.exports, pd = {};
let xg = hd, Dg = Zl;
pd.process = function(e, t) {
  let r = [], i = new xg(e);
  return new Dg(t, {
    read: i.read.bind(i),
    write: function(s) {
      r.push(s);
    },
    complete: function() {
    }
  }).start(), i.process(), Buffer.concat(r);
};
let _d = !0, Ed = qr, Ug = kg;
Ed.deflateSync || (_d = !1);
let Bg = hd, Pg = pd, Fg = rd, Mg = Ea, $g = id;
var Hg = function(e, t) {
  if (!_d)
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
  let h = new Bg(e);
  if (new Fg(t, {
    read: h.read.bind(h),
    error: i,
    metadata: s,
    gamma: l,
    palette: o,
    transColor: a,
    inflateData: d,
    simpleTransparency: c
  }).start(), h.process(), r)
    throw r;
  let E = Buffer.concat(p);
  p.length = 0;
  let y;
  if (n.interlace)
    y = Ed.inflateSync(E);
  else {
    let w = ((n.width * n.bpp * n.depth + 7 >> 3) + 1) * n.height;
    y = Ug(E, {
      chunkSize: w,
      maxLength: w
    });
  }
  if (E = null, !y || !y.length)
    throw new Error("bad png - invalid inflate data response");
  let f = Pg.process(y, n);
  E = null;
  let m = Mg.dataToBitMap(f, n);
  f = null;
  let b = $g(m, n);
  return n.data = b, n.gamma = u || 0, n;
};
let md = !0, gd = qr;
gd.deflateSync || (md = !1);
let Xg = ri, zg = cd;
var Wg = function(e, t) {
  if (!md)
    throw new Error(
      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
    );
  let r = t || {}, i = new zg(r), n = [];
  n.push(Buffer.from(Xg.PNG_SIGNATURE)), n.push(i.packIHDR(e.width, e.height)), e.gamma && n.push(i.packGAMA(e.gamma));
  let s = i.filterData(
    e.data,
    e.width,
    e.height
  ), a = gd.deflateSync(
    s,
    i.getDeflateOptions()
  );
  if (s = null, !a || !a.length)
    throw new Error("bad png - invalid compressed data response");
  return n.push(i.packIDAT(a)), n.push(i.packIEND()), Buffer.concat(n);
};
let qg = Hg, Kg = Wg;
ma.read = function(e, t) {
  return qg(e, t || {});
};
ma.write = function(e, t) {
  return Kg(e, t);
};
let Yg = ct, Td = Wr, jg = ug, Gg = Og, Vg = ma, Re = zl.PNG = function(e) {
  Td.call(this), e = e || {}, this.width = e.width | 0, this.height = e.height | 0, this.data = this.width > 0 && this.height > 0 ? Buffer.alloc(4 * this.width * this.height) : null, e.fill && this.data && this.data.fill(0), this.gamma = 0, this.readable = this.writable = !0, this._parser = new jg(e), this._parser.on("error", this.emit.bind(this, "error")), this._parser.on("close", this._handleClose.bind(this)), this._parser.on("metadata", this._metadata.bind(this)), this._parser.on("gamma", this._gamma.bind(this)), this._parser.on(
    "parsed",
    (function(t) {
      this.data = t, this.emit("parsed", t);
    }).bind(this)
  ), this._packer = new Gg(e), this._packer.on("data", this.emit.bind(this, "data")), this._packer.on("end", this.emit.bind(this, "end")), this._parser.on("close", this._handleClose.bind(this)), this._packer.on("error", this.emit.bind(this, "error"));
};
Yg.inherits(Re, Td);
Re.sync = Vg;
Re.prototype.pack = function() {
  return !this.data || !this.data.length ? (this.emit("error", "No data provided"), this) : (process.nextTick(
    (function() {
      this._packer.pack(this.data, this.width, this.height, this.gamma);
    }).bind(this)
  ), this);
};
Re.prototype.parse = function(e, t) {
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
Re.prototype.write = function(e) {
  return this._parser.write(e), !0;
};
Re.prototype.end = function(e) {
  this._parser.end(e);
};
Re.prototype._metadata = function(e) {
  this.width = e.width, this.height = e.height, this.emit("metadata", e);
};
Re.prototype._gamma = function(e) {
  this.gamma = e;
};
Re.prototype._handleClose = function() {
  !this._parser.writable && !this._packer.readable && this.emit("close");
};
Re.bitblt = function(e, t, r, i, n, s, a, o) {
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
Re.prototype.bitblt = function(e, t, r, i, n, s, a) {
  return Re.bitblt(this, e, t, r, i, n, s, a), this;
};
Re.adjustGamma = function(e) {
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
Re.prototype.adjustGamma = function() {
  Re.adjustGamma(this);
};
var ii = {};
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
      for (let h = 0; h < u; h++) {
        let _ = (d * u + h) * 4, E = s.color.light;
        if (d >= l && h >= l && d < u - l && h < u - l) {
          const y = Math.floor((d - l) / c), f = Math.floor((h - l) / c);
          E = p[o[y * a + f] ? 1 : 0];
        }
        i[_++] = E.r, i[_++] = E.g, i[_++] = E.b, i[_] = E.a;
      }
  };
})(ii);
(function(e) {
  const t = Ki, r = zl.PNG, i = ii;
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
})(Xl);
var bd = {};
(function(e) {
  const t = ii, r = {
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
    let d = "", h = Array(l + c.margin * 2 + 1).join(u.WW);
    h = Array(c.margin / 2 + 1).join(h + `
`);
    const _ = Array(c.margin + 1).join(u.WW);
    d += h;
    for (let E = 0; E < l; E += 2) {
      d += _;
      for (let y = 0; y < l; y++) {
        const f = p[E * l + y], m = p[(E + 1) * l + y];
        d += n(f, m, u);
      }
      d += _ + `
`;
    }
    return d += h.slice(0, -1), typeof o == "function" && o(null, d), d;
  }, e.renderToFile = function(a, o, c, u) {
    typeof u > "u" && (u = c, c = void 0);
    const l = Ki, p = e.render(o, c);
    l.writeFile(a, p, u);
  };
})(bd);
var vd = {}, wd = {};
wd.render = function(e, t, r) {
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
var yd = {};
const Zg = "\x1B[47m", Jg = "\x1B[40m", Us = "\x1B[37m", Bs = "\x1B[30m", Ot = "\x1B[0m", Qg = Zg + Bs, eT = Jg + Us, tT = function(e, t, r) {
  return {
    // 1 ... white, 2 ... black, 0 ... transparent (default)
    "00": Ot + " " + e,
    "01": Ot + t + "▄" + e,
    "02": Ot + r + "▄" + e,
    10: Ot + t + "▀" + e,
    11: " ",
    12: "▄",
    20: Ot + r + "▀" + e,
    21: "▀",
    22: "█"
  };
}, lc = function(e, t, r, i) {
  const n = t + 1;
  if (r >= n || i >= n || i < -1 || r < -1) return "0";
  if (r >= t || i >= t || i < 0 || r < 0) return "1";
  const s = i * t + r;
  return e[s] ? "2" : "1";
}, dc = function(e, t, r, i) {
  return lc(e, t, r, i) + lc(e, t, r, i + 1);
};
yd.render = function(e, t, r) {
  const i = e.modules.size, n = e.modules.data, s = !!(t && t.inverse), a = t && t.inverse ? eT : Qg, u = tT(a, s ? Bs : Us, s ? Us : Bs), l = Ot + `
` + a;
  let p = a;
  for (let d = -1; d < i + 1; d += 2) {
    for (let h = -1; h < i; h++)
      p += u[dc(n, i, h, d)];
    p += u[dc(n, i, i, d)] + l;
  }
  return p += Ot, typeof r == "function" && r(null, p), p;
};
const rT = wd, iT = yd;
vd.render = function(e, t, r) {
  return t && t.small ? iT.render(e, t, r) : rT.render(e, t, r);
};
var Sd = {}, ga = {};
const nT = ii;
function fc(e, t) {
  const r = e.a / 255, i = t + '="' + e.hex + '"';
  return r < 1 ? i + " " + t + '-opacity="' + r.toFixed(2).slice(1) + '"' : i;
}
function hs(e, t, r) {
  let i = e + t;
  return typeof r < "u" && (i += " " + r), i;
}
function sT(e, t, r) {
  let i = "", n = 0, s = !1, a = 0;
  for (let o = 0; o < e.length; o++) {
    const c = Math.floor(o % t), u = Math.floor(o / t);
    !c && !s && (s = !0), e[o] ? (a++, o > 0 && c > 0 && e[o - 1] || (i += s ? hs("M", c + r, 0.5 + u + r) : hs("m", n, 0), n = 0, s = !1), c + 1 < t && e[o + 1] || (i += hs("h", a), a = 0)) : n++;
  }
  return i;
}
ga.render = function(t, r, i) {
  const n = nT.getOptions(r), s = t.modules.size, a = t.modules.data, o = s + n.margin * 2, c = n.color.light.a ? "<path " + fc(n.color.light, "fill") + ' d="M0 0h' + o + "v" + o + 'H0z"/>' : "", u = "<path " + fc(n.color.dark, "stroke") + ' d="' + sT(a, s, n.margin) + '"/>', l = 'viewBox="0 0 ' + o + " " + o + '"', d = '<svg xmlns="http://www.w3.org/2000/svg" ' + (n.width ? 'width="' + n.width + '" height="' + n.width + '" ' : "") + l + ' shape-rendering="crispEdges">' + c + u + `</svg>
`;
  return typeof i == "function" && i(null, d), d;
};
(function(e) {
  const t = ga;
  e.render = t.render, e.renderToFile = function(i, n, s, a) {
    typeof a > "u" && (a = s, s = void 0);
    const o = Ki, u = '<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + e.render(n, s);
    o.writeFile(i, u, a);
  };
})(Sd);
var Zt = {}, ps = {}, hc;
function aT() {
  return hc || (hc = 1, function(e) {
    const t = ii;
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
  }(ps)), ps;
}
var pc;
function oT() {
  if (pc) return Zt;
  pc = 1;
  const e = Cl, t = la, r = aT(), i = ga;
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
      return p === 1 ? (o = a, a = c = void 0) : p === 2 && !a.getContext && (c = o, o = a, a = void 0), new Promise(function(h, _) {
        try {
          const E = t.create(o, c);
          h(s(E, a, c));
        } catch (E) {
          _(E);
        }
      });
    }
    try {
      const h = t.create(o, c);
      u(null, s(h, a, c));
    } catch (h) {
      u(h);
    }
  }
  return Zt.create = t.create, Zt.toCanvas = n.bind(null, r.render), Zt.toDataURL = n.bind(null, r.renderToDataURL), Zt.toString = n.bind(null, function(s, a, o) {
    return i.render(s, o);
  }), Zt;
}
const Rd = Cl, Ps = la, cT = Xl, Nd = bd, uT = vd, Id = Sd;
function ni(e, t, r) {
  if (typeof e > "u")
    throw new Error("String required as first argument");
  if (typeof r > "u" && (r = t, t = {}), typeof r != "function")
    if (Rd())
      t = r || {}, r = null;
    else
      throw new Error("Callback required as last argument");
  return {
    opts: t,
    cb: r
  };
}
function lT(e) {
  return e.slice((e.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
}
function _n(e) {
  switch (e) {
    case "svg":
      return Id;
    case "txt":
    case "utf8":
      return Nd;
    case "png":
    case "image/png":
    default:
      return cT;
  }
}
function dT(e) {
  switch (e) {
    case "svg":
      return Id;
    case "terminal":
      return uT;
    case "utf8":
    default:
      return Nd;
  }
}
function si(e, t, r) {
  if (!r.cb)
    return new Promise(function(i, n) {
      try {
        const s = Ps.create(t, r.opts);
        return e(s, r.opts, function(a, o) {
          return a ? n(a) : i(o);
        });
      } catch (s) {
        n(s);
      }
    });
  try {
    const i = Ps.create(t, r.opts);
    return e(i, r.opts, r.cb);
  } catch (i) {
    r.cb(i);
  }
}
St.create = Ps.create;
St.toCanvas = oT().toCanvas;
St.toString = function(t, r, i) {
  const n = ni(t, r, i), s = n.opts ? n.opts.type : void 0, a = dT(s);
  return si(a.render, t, n);
};
St.toDataURL = function(t, r, i) {
  const n = ni(t, r, i), s = _n(n.opts.type);
  return si(s.renderToDataURL, t, n);
};
St.toBuffer = function(t, r, i) {
  const n = ni(t, r, i), s = _n(n.opts.type);
  return si(s.renderToBuffer, t, n);
};
St.toFile = function(t, r, i, n) {
  if (typeof t != "string" || !(typeof r == "string" || typeof r == "object"))
    throw new Error("Invalid argument");
  if (arguments.length < 3 && !Rd())
    throw new Error("Too few arguments provided");
  const s = ni(r, i, n), a = s.opts.type || lT(t), c = _n(a).renderToFile.bind(null, t);
  return si(c, r, s);
};
St.toFileStream = function(t, r, i) {
  if (arguments.length < 2)
    throw new Error("Too few arguments provided");
  const n = ni(r, i, t.emit.bind(t, "error")), a = _n("png").renderToFileStream.bind(null, t);
  si(a, r, n);
};
var fT = St;
const hT = /* @__PURE__ */ Hs(fT);
function Ld() {
  return Xs();
}
function pT(e) {
  const t = P.join(Ld(), e === "logo" ? "logos" : "products");
  return F.mkdirSync(t, { recursive: !0 }), t;
}
function En(e) {
  const t = e.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!t || t.includes(".."))
    throw new Error("Invalid asset path");
  const r = P.resolve(Ld()), i = P.resolve(r, t), n = r.endsWith(P.sep) ? r : r + P.sep;
  if (i !== r && !i.startsWith(n))
    throw new Error("Invalid asset path");
  return i;
}
function _T(e) {
  return e ? `kaarobar-asset:///${e.replace(/\\/g, "/").replace(/^\/+/, "")}` : null;
}
function ET(e) {
  switch (P.extname(e).toLowerCase()) {
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
function mT(e) {
  try {
    const t = new URL(e), r = decodeURIComponent(
      t.hostname ? `${t.hostname}${t.pathname}` : t.pathname
    ).replace(/^\/+/, ""), i = En(r);
    if (!F.existsSync(i))
      return new Response("Not found", { status: 404 });
    const n = F.readFileSync(i);
    return new Response(n, {
      status: 200,
      headers: {
        "Content-Type": ET(i),
        "Content-Length": String(n.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
async function gT(e) {
  z(e === "logo" ? "business:edit" : "products:edit");
  const t = await Sc.showOpenDialog({
    title: e === "logo" ? "Choose business logo" : "Choose product image",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
  });
  if (t.canceled || !t.filePaths[0]) return null;
  const r = t.filePaths[0], i = P.extname(r).toLowerCase() || ".png", n = `${Ac()}${i}`, s = e === "logo" ? "logos" : "products", a = pT(e), o = P.join(a, n);
  F.copyFileSync(r, o);
  const c = `${s}/${n}`;
  return { relativePath: c, url: _T(c) };
}
const TT = {
  whatsapp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.99.52 3.93 1.51 5.64L2 22l4.6-1.51a9.86 9.86 0 0 0 5.44 1.52h.01c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.79 14.06c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.93-4.36-.14-.19-1.17-1.56-1.17-2.97 0-1.41.74-2.1 1-2.39.26-.29.57-.36.76-.36h.55c.18 0 .42-.07.65.5.24.58.82 2 .89 2.14.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.56.16.28.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.61-.13.25.09 1.6.75 1.87.89.27.14.45.21.52.33.07.12.07.69-.17 1.37z"/></svg>',
  instagram: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zm5.25-3.75a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/></svg>',
  facebook: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z"/></svg>',
  tiktok: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M14.5 3c.4 1.7 1.5 3.2 3.1 4.1V9c-1.2-.05-2.3-.4-3.3-1v6.3A5.3 5.3 0 1 1 9 9.1v2.2a3.1 3.1 0 1 0 2.2 3V3h3.3z"/></svg>',
  website: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.9 9h-3.2a15 15 0 0 0-1.3-5 8.1 8.1 0 0 1 4.5 5zM12 4c.9 1.3 1.7 3.2 2.1 5H9.9C10.3 7.2 11.1 5.3 12 4zM4.1 13h3.2a15 15 0 0 0 1.3 5 8.1 8.1 0 0 1-4.5-5zm3.2-2H4.1a8.1 8.1 0 0 1 4.5-5 15 15 0 0 0-1.3 5zm2.6 0h4.2c-.4 1.9-1.2 3.8-2.1 5-.9-1.2-1.7-3.1-2.1-5zm4.2 2H9.9c.4 1.8 1.2 3.7 2.1 5 .9-1.3 1.7-3.2 2.1-5zm.7 5a15 15 0 0 0 1.3-5h3.2a8.1 8.1 0 0 1-4.5 5z"/></svg>'
};
function bT(e) {
  const t = TT[e];
  return `data:image/svg+xml;base64,${Buffer.from(t).toString("base64")}`;
}
const _c = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  website: "Web"
}, vT = "Kaarobar", wT = "#2d6df6", yT = /^#([0-9a-fA-F]{6})$/;
function mn(e) {
  const t = (e ?? "").trim();
  return yT.test(t) ? t.toLowerCase() : wT;
}
function Ta(e) {
  const t = mn(e), r = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="128" height="128" role="img" aria-label="${vT}">
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
  return Pt(re.get("language"));
}
const le = {
  en: "Powered by Kaarobar POS · 2ndHub Solutions",
  ur: "کاروبار POS · 2ndHub Solutions سے تقویت یافتہ",
  de: "Bereitgestellt von Kaarobar POS · 2ndHub Solutions",
  pt: "Desenvolvido por Kaarobar POS · 2ndHub Solutions",
  es: "Desarrollado por Kaarobar POS · 2ndHub Solutions",
  fr: "Propulsé par Kaarobar POS · 2ndHub Solutions",
  ar: "مدعوم من Kaarobar POS · 2ndHub Solutions"
}, ST = {
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
    poweredBy: le.en,
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
    poweredBy: le.ur,
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
    poweredBy: le.de,
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
    poweredBy: le.pt,
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
    poweredBy: le.es,
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
    poweredBy: le.fr,
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
    poweredBy: le.ar,
    cash: "نقد",
    card: "بطاقة / أونلاين",
    credit: "ائتمان"
  }
}, RT = {
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
    poweredBy: le.en
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
    poweredBy: le.ur
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
    poweredBy: le.de
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
    poweredBy: le.pt
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
    poweredBy: le.es
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
    poweredBy: le.fr
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
    poweredBy: le.ar
  }
}, NT = {
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
    poweredBy: le.en,
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
    poweredBy: le.ur,
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
    poweredBy: le.de,
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
    poweredBy: le.pt,
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
    poweredBy: le.es,
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
    poweredBy: le.fr,
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
    poweredBy: le.ar,
    sale: "بيع",
    payment: "دفعة",
    adjustment: "تعديل",
    opening: "افتتاحي",
    cash: "نقد",
    card: "بطاقة / أونلاين"
  }
};
function IT(e = it()) {
  return ST[e];
}
function LT(e = it()) {
  return RT[e];
}
function CT(e = it()) {
  return NT[e];
}
const AT = {
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
function OT(e = it()) {
  return AT[e];
}
function ba(e = it()) {
  const t = Hf(e);
  return {
    lang: e,
    dir: t ? "rtl" : "ltr",
    fontFamily: t ? "'Noto Sans Arabic', 'Noto Naskh Arabic', ui-sans-serif, sans-serif" : "'Poppins', ui-sans-serif, sans-serif",
    fontLink: t ? "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap" : "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
  };
}
function Fs(e, t = it()) {
  try {
    return new Date(e).toLocaleString(Xf(t));
  } catch {
    return e;
  }
}
const kT = {
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
function va(e) {
  const t = (e || "PKR").trim().toUpperCase();
  return kT[t] ?? t;
}
function J(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function Jt() {
  return '<div class="stars">********************************</div>';
}
function xT(e) {
  try {
    const t = F.readFileSync(e), r = P.extname(e).toLowerCase().replace(".", "") || "png";
    return `data:${r === "jpg" || r === "jpeg" ? "image/jpeg" : r === "webp" ? "image/webp" : r === "gif" ? "image/gif" : r === "svg" ? "image/svg+xml" : "image/png"};base64,${t.toString("base64")}`;
  } catch {
    return null;
  }
}
async function DT(e, t) {
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
    const s = await hT.toDataURL(n.url.trim(), {
      margin: 1,
      width: 72,
      color: { dark: "#000000", light: "#ffffff" }
    });
    i.push(`
      <div class="social-item">
        <img class="social-icon" src="${bT(n.platform)}" alt="" />
        <img class="social-qr" src="${s}" alt="${_c[n.platform]}" />
        <div class="social-label">${_c[n.platform]}</div>
      </div>
    `);
  }
  return `
    ${Jt()}
    <div class="social-title">${J(t)}</div>
    <div class="social-row">${i.join("")}</div>
  `;
}
async function UT(e) {
  var w, L;
  const t = e.language ?? it(), r = IT(t), i = ba(t), n = va(e.currency), s = e.payments.some((I) => I.method === "credit"), a = e.payments.some((I) => I.method === "cash"), o = e.payments.some((I) => I.method === "card"), c = s && !a ? r.creditReceipt : o && !a && !s ? r.cardReceipt : r.cashReceipt, u = (I) => I === "card" ? r.card : I === "cash" ? r.cash : I === "credit" ? r.credit : I;
  let l = "";
  if (e.logoPath)
    try {
      const I = xT(En(e.logoPath));
      I && (l = `<img class="logo" src="${I}" alt="" />`);
    } catch {
      l = "";
    }
  const p = [
    e.branchAddress ? J(e.branchAddress) : "",
    e.branchPhone ? `${J(r.tel)}: ${J(e.branchPhone)}` : ""
  ].filter(Boolean), d = e.items.map(
    (I) => `
      <tr>
        <td class="desc">${J(I.productName)} × ${I.qty}</td>
        <td class="price">${n} ${I.lineTotal.toFixed(2)}</td>
      </tr>`
  ).join(""), h = e.payments.map(
    (I) => `<div class="row"><span>${J(u(I.method))}</span><span>${n} ${I.amount.toFixed(2)}</span></div>`
  ).join(""), _ = Math.max(0, e.amountPaid - e.total), E = await DT(e, r.followUs), y = mn(e.brandColor), f = Ta(y), m = JSON.stringify(e.invoiceNo), b = e.jsBarcodeScript, v = Fs(e.createdAt, t);
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
    .brand-name { font-size: 11px; font-weight: 700; color: ${y}; }
    .brand-tag { font-size: 9px; color: #555; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      ${l}
      <p class="shop">${J(e.businessName)}</p>
      ${p.map((I) => `<p class="muted">${I}</p>`).join("")}
      ${(w = e.receiptHeader) != null && w.trim() ? `<p class="muted" style="margin-top:6px;white-space:pre-wrap">${J(e.receiptHeader.trim())}</p>` : ""}
    </div>
    ${Jt()}
    <div class="center title">${J(c)}</div>
    ${Jt()}
    <div class="row"><span>${J(r.invoice)}</span><span>${J(e.invoiceNo)}</span></div>
    <div class="row"><span>${J(r.date)}</span><span>${J(v)}</span></div>
    ${e.customerName ? `<div class="row"><span>${J(r.customer)}</span><span>${J(e.customerName)}</span></div>` : ""}
    ${e.cashierName ? `<div class="row"><span>${J(r.cashier)}</span><span>${J(e.cashierName)}</span></div>` : ""}
    ${e.printedByName ? `<div class="row"><span>${J(r.printedBy)}</span><span>${J(e.printedByName)}</span></div>` : ""}
    ${Jt()}
    <table>
      <thead>
        <tr>
          <th class="desc">${J(r.description)}</th>
          <th class="price">${J(r.price)}</th>
        </tr>
      </thead>
      <tbody>${d}</tbody>
    </table>
    ${Jt()}
    ${e.discount > 0 ? `<div class="row"><span>${J(r.subtotal)}</span><span>${n} ${e.subtotal.toFixed(2)}</span></div>
    <div class="row"><span>${J(r.discount)}</span><span>- ${n} ${e.discount.toFixed(2)}</span></div>` : ""}
    <div class="row total"><span>${J(r.total)}</span><span>${n} ${e.total.toFixed(2)}</span></div>
    ${h}
    ${_ > 0 ? `<div class="row"><span>${J(r.change)}</span><span>${n} ${_.toFixed(2)}</span></div>` : ""}
    ${E}
    ${Jt()}
    <div class="center thanks" style="white-space:pre-wrap">${J(
    ((L = e.receiptFooter) == null ? void 0 : L.trim()) || r.thankYou
  )}</div>
    <svg id="barcode"></svg>
    <div class="center brand">
      <img src="${f}" alt="Kaarobar" />
      <div class="brand-name">Kaarobar</div>
      <div class="brand-tag">${J(r.poweredBy)}</div>
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
function ae(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function BT(e) {
  try {
    const t = F.readFileSync(e), r = P.extname(e).toLowerCase().replace(".", "") || "png";
    return `data:${r === "jpg" || r === "jpeg" ? "image/jpeg" : r === "webp" ? "image/webp" : r === "svg" ? "image/svg+xml" : "image/png"};base64,${t.toString("base64")}`;
  } catch {
    return null;
  }
}
function PT(e) {
  const t = e.language ?? it(), r = LT(t), i = ba(t), n = va(e.currency), s = mn(e.brandColor);
  let a = "";
  if (e.logoPath)
    try {
      const u = BT(En(e.logoPath));
      u && (a = `<img class="logo" src="${u}" alt="" />`);
    } catch {
      a = "";
    }
  const o = e.items.map(
    (u) => `
      <tr>
        <td>${ae(u.productName)}</td>
        <td class="num">${u.orderedQty}</td>
        <td class="num">${n} ${u.unitCost.toFixed(2)}</td>
        <td class="num">${n} ${u.lineTotal.toFixed(2)}</td>
      </tr>`
  ).join(""), c = Ta(s);
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
    <h1>${ae(e.businessName)}</h1>
    <p class="muted">${ae(e.branchName)}</p>
  </div>
  <h2 class="center">${ae(r.purchaseOrder)}</h2>
  <div class="meta">
    <div><span>${ae(r.poNumber)}</span><span>${ae(e.poNumber)}</span></div>
    <div><span>${ae(r.date)}</span><span>${ae(e.orderDate)}</span></div>
    <div><span>${ae(r.status)}</span><span>${ae(e.status)}</span></div>
  </div>
  <div class="meta">
    <div><span>${ae(r.supplier)}</span><span>${ae(e.supplierName)}</span></div>
    ${e.supplierPhone ? `<div><span>${ae(r.phone)}</span><span>${ae(e.supplierPhone)}</span></div>` : ""}
    ${e.supplierAddress ? `<div><span>${ae(r.address)}</span><span>${ae(e.supplierAddress)}</span></div>` : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th>${ae(r.product)}</th>
        <th class="num">${ae(r.qty)}</th>
        <th class="num">${ae(r.unitCost)}</th>
        <th class="num">${ae(r.total)}</th>
      </tr>
    </thead>
    <tbody>${o}</tbody>
  </table>
  <div class="total"><span>${ae(r.total)}</span><span>${n} ${e.total.toFixed(2)}</span></div>
  <div class="brand">
    <img src="${c}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
    <div class="brand-tag">${ae(r.poweredBy)}</div>
  </div>
</body>
</html>`;
}
function Z(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function FT(e) {
  try {
    const t = F.readFileSync(e), r = P.extname(e).toLowerCase().replace(".", "") || "png";
    return `data:${r === "jpg" || r === "jpeg" ? "image/jpeg" : r === "webp" ? "image/webp" : r === "svg" ? "image/svg+xml" : "image/png"};base64,${t.toString("base64")}`;
  } catch {
    return null;
  }
}
function At(e, t) {
  return `${e} ${t.toFixed(2)}`;
}
function MT(e) {
  var r;
  if (!e) return "";
  const t = e.match(/^method:(cash|card)(?:\s*\|\s*(.*))?$/i);
  return t ? ((r = t[2]) == null ? void 0 : r.trim()) || "" : e.trim();
}
function $T(e, t) {
  const i = [e.type === "sale" ? t.sale : e.type === "payment" ? t.payment : e.type === "adjustment" ? t.adjustment : t.opening];
  e.invoiceNo && i.push(e.invoiceNo), e.method === "cash" && i.push(t.cash), e.method === "card" && i.push(t.card);
  const n = MT(e.note);
  return n && i.push(n), i.join(" · ");
}
function HT(e) {
  const t = e.language ?? it(), r = CT(t), i = ba(t), n = va(e.currency), s = mn(e.brandColor);
  let a = "";
  if (e.logoPath)
    try {
      const _ = FT(En(e.logoPath));
      _ && (a = `<img class="logo" src="${_}" alt="" />`);
    } catch {
      a = "";
    }
  const o = e.from || e.to ? `${e.from || "…"} → ${e.to || "…"}` : r.allEntries;
  let c = 0, u = 0;
  const l = e.entries.map((_) => {
    const E = _.amount > 0 ? _.amount : 0, y = _.amount < 0 ? Math.abs(_.amount) : 0;
    return c += E, u += y, `
      <tr>
        <td>${Z(Fs(_.createdAt, t))}</td>
        <td>${Z($T(_, r))}</td>
        <td class="num">${E ? Z(At(n, E)) : ""}</td>
        <td class="num">${y ? Z(At(n, y)) : ""}</td>
        <td class="num">${Z(At(n, _.balanceAfter))}</td>
      </tr>`;
  }).join(""), p = e.entries.length > 0 ? e.entries[e.entries.length - 1].balanceAfter : e.openingBalance, d = Ta(s), h = !!(e.from || e.to) || e.openingBalance !== 0;
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
    <h1>${Z(e.businessName)}</h1>
  </div>
  <h2 class="center">${Z(r.title)}</h2>
  <div class="meta">
    <div><span>${Z(r.customer)}</span><span>${Z(e.customerName)}</span></div>
    ${e.customerPhone ? `<div><span>${Z(r.phone)}</span><span>${Z(e.customerPhone)}</span></div>` : ""}
    <div><span>${Z(r.period)}</span><span>${Z(o)}</span></div>
    <div><span>${Z(r.printedAt)}</span><span>${Z(Fs((/* @__PURE__ */ new Date()).toISOString(), t))}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${Z(r.date)}</th>
        <th>${Z(r.particulars)}</th>
        <th class="num">${Z(r.debit)}</th>
        <th class="num">${Z(r.credit)}</th>
        <th class="num">${Z(r.balance)}</th>
      </tr>
    </thead>
    <tbody>
      ${h ? `<tr class="opening">
        <td></td>
        <td>${Z(r.balanceBroughtForward)}</td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num">${Z(At(n, e.openingBalance))}</td>
      </tr>` : ""}
      ${l}
      <tr class="totals">
        <td colspan="2">${Z(r.totals)}</td>
        <td class="num">${Z(At(n, c))}</td>
        <td class="num">${Z(At(n, u))}</td>
        <td class="num"></td>
      </tr>
    </tbody>
  </table>
  <div class="closing">
    <span>${Z(r.closingBalance)}</span>
    <span>${Z(At(n, p))}</span>
  </div>
  <div class="brand">
    <img src="${d}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
    <div class="brand-tag">${Z(r.poweredBy)}</div>
  </div>
</body>
</html>`;
}
function Ni(e) {
  return e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function XT(e, t) {
  const r = P.join(Qe(), "preview");
  F.mkdirSync(r, { recursive: !0 });
  const i = P.join(r, `${e}-${Date.now()}.html`);
  return F.writeFileSync(i, t, "utf8"), i;
}
function zT(e) {
  const t = OT(it()), r = `
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
<div id="kaarobar-print-toolbar" role="toolbar" aria-label="${Ni(t.previewHint)}">
  <div class="hint">${Ni(t.previewHint)}</div>
  <div class="actions">
    <button type="button" class="close" onclick="window.close()">${Ni(t.close)}</button>
    <button type="button" class="print" onclick="window.print()">${Ni(t.print)}</button>
  </div>
</div>`;
  return /<\/body>/i.test(e) ? e.replace(/<\/body>/i, `${r}</body>`) : `${e}${r}`;
}
function wa(e) {
  const t = zT(e.html), r = XT(e.filePrefix, t);
  return new qi({
    show: !0,
    width: e.width ?? 720,
    height: e.height ?? 900,
    autoHideMenuBar: !0,
    title: e.title ?? "Preview",
    webPreferences: { sandbox: !0, contextIsolation: !0 }
  }).loadFile(r), { ok: !0 };
}
const WT = Nc(import.meta.url);
function S() {
  return ze(), lt(de()), de();
}
function we() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function se(e) {
  S().prepare(
    `INSERT INTO activity_log (id, business_id, actor_user_id, entity_type, entity_id, action, summary, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    ne(),
    e.businessId,
    e.actorUserId,
    e.entityType,
    e.entityId,
    e.action,
    e.summary,
    e.payload ? JSON.stringify(e.payload) : null,
    we()
  );
}
function Cd(e, t) {
  if (!Number.isFinite(e) || e < 0) throw new Error("Sale price must be >= 0");
  if (t != null && (!Number.isFinite(t) || t < 0))
    throw new Error("Cost price must be >= 0");
  if (t != null && e < t)
    throw new Error("Sale price must be greater than or equal to cost price");
}
function ya(e) {
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
    tracksStock: e.tracks_stock == null ? Sl(t) : !!e.tracks_stock,
    imagePath: e.image_path,
    isActive: !!e.is_active
  };
}
function It(e) {
  const t = S().prepare("SELECT business_nature FROM businesses WHERE id = ?").get(e);
  return ei(t == null ? void 0 : t.business_nature);
}
function qT(e) {
  return {
    linkId: e.link_id,
    supplierId: e.supplier_id,
    productId: e.product_id,
    unitCost: e.unit_cost,
    product: ya(e)
  };
}
function KT(e) {
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
function Ms(e, t) {
  return he(), S().prepare(
    `SELECT a.id, a.business_id, a.actor_user_id, u.name as actor_name, a.entity_type, a.entity_id,
              a.action, a.summary, a.payload_json, a.created_at
       FROM activity_log a
       JOIN users u ON u.id = a.actor_user_id
       WHERE a.entity_type = ? AND a.entity_id = ?
       ORDER BY a.created_at DESC`
  ).all(e, t).map(KT);
}
function YT() {
  const e = he();
  return (e.role === "owner" ? S().prepare(
    `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
                  social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
                  receipt_header, receipt_footer
           FROM businesses ORDER BY created_at DESC`
  ).all() : S().prepare(
    `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
                  social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
                  receipt_header, receipt_footer
           FROM businesses WHERE id = ?`
  ).all(e.businessId)).map(Ad);
}
function Ad(e) {
  return {
    id: e.id,
    name: e.name,
    currency: e.currency,
    brandColor: e.brand_color,
    businessNature: ei(e.business_nature),
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
function Ne(e) {
  return (e == null ? void 0 : e.trim()) || "" || null;
}
function jT(e) {
  var l;
  const t = z("business:edit");
  if (S().prepare("SELECT id FROM businesses LIMIT 1").get())
    throw new Error("This installation already has a business. Only one business is supported.");
  const i = ne(), n = we(), s = ((l = e.logoPath) == null ? void 0 : l.trim()) || null, a = ei(e.businessNature), o = {
    socialWhatsapp: Ne(e.socialWhatsapp),
    socialInstagram: Ne(e.socialInstagram),
    socialFacebook: Ne(e.socialFacebook),
    socialTiktok: Ne(e.socialTiktok),
    socialWebsite: Ne(e.socialWebsite)
  }, c = Ne(e.receiptHeader), u = Ne(e.receiptFooter) ?? "Thank you for shopping with us";
  return S().prepare(
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
  ), se({
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
function GT(e) {
  var a;
  const t = z("business:edit");
  X(e.id);
  const r = e.logoPath === void 0 ? void 0 : ((a = e.logoPath) == null ? void 0 : a.trim()) || null, i = e.businessNature === void 0 ? void 0 : ei(e.businessNature), n = {
    socialWhatsapp: Ne(e.socialWhatsapp),
    socialInstagram: Ne(e.socialInstagram),
    socialFacebook: Ne(e.socialFacebook),
    socialTiktok: Ne(e.socialTiktok),
    socialWebsite: Ne(e.socialWebsite)
  };
  if (r === void 0 ? i === void 0 ? S().prepare(
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
  ) : S().prepare(
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
  ) : i === void 0 ? S().prepare(
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
  ) : S().prepare(
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
    const o = S().prepare("SELECT receipt_header, receipt_footer FROM businesses WHERE id = ?").get(e.id);
    S().prepare("UPDATE businesses SET receipt_header = ?, receipt_footer = ? WHERE id = ?").run(
      e.receiptHeader !== void 0 ? Ne(e.receiptHeader) : o.receipt_header,
      e.receiptFooter !== void 0 ? Ne(e.receiptFooter) : o.receipt_footer,
      e.id
    );
  }
  const s = S().prepare(
    `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
              social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
              receipt_header, receipt_footer
       FROM businesses WHERE id = ?`
  ).get(e.id);
  return se({
    businessId: e.id,
    actorUserId: t.id,
    entityType: "business",
    entityId: e.id,
    action: "updated",
    summary: `Updated business ${e.name.trim()}`
  }), Ad(s);
}
function VT(e) {
  return X(e), re.set("lastBusinessId", e), { ok: !0 };
}
function ZT(e) {
  return X(e), S().prepare(
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
function JT(e) {
  var n, s, a, o;
  if (z("branch:edit"), X(e.businessId), S().prepare("SELECT id FROM branches WHERE business_id = ? LIMIT 1").get(e.businessId))
    throw new Error("This business already has a branch. Only one branch is supported.");
  const r = he(), i = ne();
  return S().prepare(
    `INSERT INTO branches (id, business_id, name, address, phone, is_main_branch, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?)`
  ).run(i, e.businessId, e.name.trim(), ((n = e.address) == null ? void 0 : n.trim()) || null, ((s = e.phone) == null ? void 0 : s.trim()) || null, we()), se({
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
function QT(e) {
  var n, s, a, o;
  const t = z("branch:edit"), r = S().prepare("SELECT business_id, is_main_branch, is_active FROM branches WHERE id = ?").get(e.id);
  if (!r) throw new Error("Branch not found");
  X(r.business_id);
  const i = e.isActive === void 0 ? r.is_active : e.isActive ? 1 : 0;
  return S().prepare("UPDATE branches SET name = ?, address = ?, phone = ?, is_active = ? WHERE id = ?").run(
    e.name.trim(),
    ((n = e.address) == null ? void 0 : n.trim()) || null,
    ((s = e.phone) == null ? void 0 : s.trim()) || null,
    i,
    e.id
  ), se({
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
function e0(e) {
  return he(), X(e), S().prepare(
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
function t0(e) {
  const t = z("users:manage");
  if (X(e.businessId), t.role !== "owner" && e.role === "admin") throw new Error("Only owner can create admins");
  e.branchId && wr(e.branchId);
  const r = ne(), i = ar.hashSync(e.password, 12);
  return S().prepare(
    `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(r, e.businessId, e.branchId, e.name.trim(), e.email.trim().toLowerCase(), i, e.role, we()), {
    id: r,
    name: e.name.trim(),
    email: e.email.trim().toLowerCase(),
    role: e.role,
    businessId: e.businessId,
    branchId: e.branchId,
    isActive: !0
  };
}
function r0(e) {
  z("users:manage");
  const t = S().prepare("SELECT business_id FROM users WHERE id = ?").get(e.userId);
  if (!t) throw new Error("User not found");
  return X(t.business_id), S().prepare("UPDATE users SET is_active = ? WHERE id = ?").run(e.isActive ? 1 : 0, e.userId), { ok: !0 };
}
function i0(e) {
  var c, u, l, p;
  const t = he(), r = S().prepare("SELECT id, name, email, role, business_id, branch_id, password_hash, image_path FROM users WHERE id = ?").get(t.id);
  if (!r) throw new Error("User not found");
  const i = ((c = e.name) == null ? void 0 : c.trim()) || r.name;
  if (!i) throw new Error("Name is required");
  const n = e.imagePath === void 0 ? r.image_path : ((u = e.imagePath) == null ? void 0 : u.trim()) || null;
  let s = r.password_hash;
  const a = ((l = e.newPassword) == null ? void 0 : l.trim()) || "";
  if (!!a) {
    if (t.role !== "owner") throw new Error("Only owner can change password from settings");
    if (!((p = e.currentPassword) != null && p.trim())) throw new Error("Current password is required");
    if (!ar.compareSync(e.currentPassword, r.password_hash))
      throw new Error("Current password is incorrect");
    if (a.length < 8)
      throw new Error("Password must be at least 8 characters");
    s = ar.hashSync(a, 12);
  }
  return S().prepare("UPDATE users SET name = ?, image_path = ?, password_hash = ? WHERE id = ?").run(i, n, s, t.id), t.name = i, t.imagePath = n, {
    id: r.id,
    name: i,
    email: r.email,
    role: r.role,
    businessId: r.business_id,
    branchId: r.branch_id,
    imagePath: n
  };
}
function n0(e) {
  return ce(), X(e), S().prepare(
    `SELECT id, business_id, branch_id, name, barcode, price, cost_price, stock_qty, kind, tracks_stock, image_path, is_active
       FROM products WHERE business_id = ? ORDER BY created_at DESC`
  ).all(e).map(ya);
}
function s0(e) {
  var u, l, p;
  ce(), z("products:edit"), X(e.businessId), e.branchId && wr(e.branchId), Cd(e.price, e.costPrice ?? null);
  const t = It(e.businessId), r = e.kind ?? "item";
  if (!Rl(t, r))
    throw new Error(`Product kind "${r}" is not allowed for this business type`);
  const i = e.tracksStock === void 0 ? Sl(r) : !!e.tracksStock;
  if (i && r !== "item")
    throw new Error("Only item products can track stock");
  const n = he(), s = ne(), a = we(), o = ((u = e.imagePath) == null ? void 0 : u.trim()) || null, c = i ? e.stockQty ?? 0 : 0;
  return S().prepare(
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
  ), se({
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
    imagePath: o,
    isActive: e.isActive !== !1
  };
}
function a0(e) {
  var u, l, p;
  ce();
  const t = z("products:edit"), r = S().prepare(
    "SELECT business_id, branch_id, stock_qty, kind, tracks_stock, image_path FROM products WHERE id = ?"
  ).get(e.id);
  if (!r) throw new Error("Product not found");
  X(r.business_id), Cd(e.price, e.costPrice ?? null);
  const i = It(r.business_id), n = e.kind ?? (r.kind || "item");
  if (!Rl(i, n))
    throw new Error(`Product kind "${n}" is not allowed for this business type`);
  const s = e.tracksStock === void 0 ? !!r.tracks_stock : !!e.tracksStock;
  if (s && n !== "item")
    throw new Error("Only item products can track stock");
  const a = e.isActive === !1 ? 0 : 1, o = e.imagePath === void 0 ? r.image_path : ((u = e.imagePath) == null ? void 0 : u.trim()) || null, c = s ? e.stockQty ?? r.stock_qty : 0;
  return S().prepare(
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
  ), se({
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
    imagePath: o,
    isActive: !!a
  };
}
function o0(e) {
  ce();
  const t = z("products:edit"), r = S().prepare("SELECT business_id, name FROM products WHERE id = ?").get(e.id);
  if (!r) throw new Error("Product not found");
  return X(r.business_id), S().prepare("UPDATE products SET is_active = ? WHERE id = ?").run(e.isActive ? 1 : 0, e.id), se({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "product",
    entityId: e.id,
    action: e.isActive ? "activated" : "deactivated",
    summary: `${e.isActive ? "Activated" : "Deactivated"} product ${r.name}`
  }), { ok: !0 };
}
function c0(e) {
  ce();
  const t = z("products:edit"), r = S().prepare("SELECT business_id, name, is_active FROM products WHERE id = ?").get(e);
  if (!r) throw new Error("Product not found");
  X(r.business_id);
  const i = S().prepare("SELECT id FROM sale_items WHERE product_id = ? LIMIT 1").get(e), n = S().prepare("SELECT id FROM purchase_order_items WHERE product_id = ? LIMIT 1").get(e);
  return i || n ? (r.is_active && (S().prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(e), se({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "product",
    entityId: e,
    action: "deactivated",
    summary: `Deactivated product ${r.name} (used in history)`
  })), { ok: !0, mode: "deactivated" }) : (S().transaction(() => {
    S().prepare("DELETE FROM supplier_products WHERE product_id = ?").run(e), S().prepare("DELETE FROM products WHERE id = ?").run(e);
  })(), se({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "product",
    entityId: e,
    action: "deleted",
    summary: `Deleted product ${r.name}`
  }), { ok: !0, mode: "deleted" });
}
function u0(e) {
  const t = S().prepare("SELECT business_id FROM products WHERE id = ?").get(e);
  if (!t) throw new Error("Product not found");
  return X(t.business_id), S().prepare(
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
function l0(e) {
  ce(), z("products:edit"), X(e);
  for (let t = 0; t < 20; t += 1) {
    const r = `KB${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
    if (!S().prepare("SELECT id FROM products WHERE business_id = ? AND barcode = ?").get(e, r)) return { barcode: r };
  }
  throw new Error("Could not generate unique barcode");
}
function d0(e) {
  return X(e), S().prepare("SELECT id, business_id, name, phone, address, notes, is_active FROM suppliers WHERE business_id = ? ORDER BY created_at DESC").all(e).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    notes: r.notes,
    isActive: !!r.is_active
  }));
}
function f0(e) {
  var i, n, s, a, o, c;
  z("suppliers:edit"), X(e.businessId);
  const t = he(), r = ne();
  return S().prepare(
    `INSERT INTO suppliers (id, business_id, name, phone, address, notes, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(r, e.businessId, e.name.trim(), ((i = e.phone) == null ? void 0 : i.trim()) || null, ((n = e.address) == null ? void 0 : n.trim()) || null, ((s = e.notes) == null ? void 0 : s.trim()) || null, we()), se({
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
function h0(e) {
  var n, s, a, o, c, u;
  const t = z("suppliers:edit"), r = S().prepare("SELECT business_id FROM suppliers WHERE id = ?").get(e.id);
  if (!r) throw new Error("Supplier not found");
  X(r.business_id);
  const i = e.isActive === !1 ? 0 : 1;
  return S().prepare("UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ?, is_active = ? WHERE id = ?").run(
    e.name.trim(),
    ((n = e.phone) == null ? void 0 : n.trim()) || null,
    ((s = e.address) == null ? void 0 : s.trim()) || null,
    ((a = e.notes) == null ? void 0 : a.trim()) || null,
    i,
    e.id
  ), se({
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
function Rr(e) {
  const t = S().prepare("SELECT id, business_id, name, phone, address, notes, is_active FROM suppliers WHERE id = ?").get(e);
  if (!t) throw new Error("Supplier not found");
  return X(t.business_id), t;
}
function Sa(e) {
  return Rr(e), S().prepare(
    `SELECT sp.id as link_id, sp.supplier_id, sp.product_id, sp.unit_cost,
              p.id, p.business_id, p.branch_id, p.name, p.barcode, p.price, p.cost_price,
              p.stock_qty, p.kind, p.tracks_stock, p.image_path, p.is_active
       FROM supplier_products sp
       JOIN products p ON p.id = sp.product_id
       WHERE sp.supplier_id = ?
       ORDER BY p.name ASC`
  ).all(e).map(qT);
}
function p0(e) {
  const t = Rr(e);
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
    products: Sa(e)
  };
}
function _0(e) {
  z("suppliers:edit");
  const t = Rr(e.supplierId);
  if (!Number.isFinite(e.unitCost) || e.unitCost < 0)
    throw new Error("Unit cost must be >= 0");
  const r = S().prepare(
    `SELECT id, business_id, branch_id, name, barcode, price, cost_price, stock_qty, kind, tracks_stock, image_path, is_active
       FROM products WHERE id = ?`
  ).get(e.productId);
  if (!r) throw new Error("Product not found");
  if (r.business_id !== t.business_id)
    throw new Error("Product and supplier must belong to the same business");
  if (X(r.business_id), S().prepare("SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ?").get(e.supplierId, e.productId)) throw new Error("Product is already attached to this supplier");
  const n = ne();
  return S().prepare(
    `INSERT INTO supplier_products (id, supplier_id, product_id, unit_cost, created_at)
       VALUES (?, ?, ?, ?, ?)`
  ).run(n, e.supplierId, e.productId, e.unitCost, we()), {
    linkId: n,
    supplierId: e.supplierId,
    productId: e.productId,
    unitCost: e.unitCost,
    product: ya(r)
  };
}
function E0(e) {
  if (z("suppliers:edit"), Rr(e.supplierId), S().prepare("DELETE FROM supplier_products WHERE supplier_id = ? AND product_id = ?").run(e.supplierId, e.productId).changes === 0) throw new Error("Product is not attached to this supplier");
  return { ok: !0 };
}
function m0(e) {
  if (z("suppliers:edit"), Rr(e.supplierId), !Number.isFinite(e.unitCost) || e.unitCost < 0)
    throw new Error("Unit cost must be >= 0");
  if (S().prepare("UPDATE supplier_products SET unit_cost = ? WHERE supplier_id = ? AND product_id = ?").run(e.unitCost, e.supplierId, e.productId).changes === 0) throw new Error("Product is not attached to this supplier");
  const r = Sa(e.supplierId).find((i) => i.productId === e.productId);
  if (!r) throw new Error("Product is not attached to this supplier");
  return r;
}
function g0(e) {
  return X(e), S().prepare(
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
function T0(e) {
  var a;
  if (z("purchaseOrders:edit"), X(e.businessId), wr(e.branchId), Rr(e.supplierId).business_id !== e.businessId)
    throw new Error("Supplier does not belong to this business");
  if (!((a = e.items) != null && a.length)) throw new Error("Add at least one product line");
  const r = ne(), i = he(), n = S().prepare(
    `INSERT INTO purchase_order_items (id, po_id, product_id, ordered_qty, received_qty, unit_cost, line_total)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  );
  return S().transaction(() => {
    S().prepare(
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
      we()
    );
    for (const o of e.items) {
      if (!Number.isFinite(o.orderedQty) || o.orderedQty <= 0)
        throw new Error("Ordered quantity must be greater than 0");
      if (!Number.isFinite(o.unitCost) || o.unitCost < 0)
        throw new Error("Unit cost must be >= 0");
      if (!S().prepare("SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ?").get(e.supplierId, o.productId)) throw new Error("All products must be attached to the selected supplier");
      const u = o.orderedQty * o.unitCost;
      n.run(ne(), r, o.productId, o.orderedQty, o.unitCost, u);
    }
  })(), se({
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
function Od(e) {
  const t = S().prepare(
    `SELECT po.id, po.business_id, po.branch_id, po.supplier_id, po.po_number, po.status, po.order_date,
              s.name as supplier_name, br.name as branch_name, b.name as business_name
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN branches br ON br.id = po.branch_id
       JOIN businesses b ON b.id = po.business_id
       WHERE po.id = ?`
  ).get(e);
  if (!t) throw new Error("Purchase order not found");
  X(t.business_id);
  const i = S().prepare(
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
async function b0(e) {
  z("purchaseOrders:edit");
  const t = Od(e), r = S().prepare("SELECT currency, logo_path, brand_color FROM businesses WHERE id = ?").get(t.po.businessId), i = S().prepare("SELECT phone, address FROM suppliers WHERE id = ?").get(t.po.supplierId), n = PT({
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
  return wa({
    html: n,
    filePrefix: "purchase-order",
    title: t.po.poNumber,
    width: 780,
    height: 920
  });
}
function v0(e) {
  return X(e), S().prepare("SELECT id, business_id, name, phone, current_balance, is_active FROM customers WHERE business_id = ? ORDER BY created_at DESC").all(e).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    phone: r.phone,
    currentBalance: r.current_balance,
    isActive: !!r.is_active
  }));
}
function w0(e) {
  var n, s;
  const t = z("customers:edit");
  X(e.businessId);
  const r = ne(), i = we();
  return S().prepare(
    `INSERT INTO customers (id, business_id, name, phone, address, opening_balance, current_balance, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 0, 0, 1, ?, ?)`
  ).run(r, e.businessId, e.name.trim(), ((n = e.phone) == null ? void 0 : n.trim()) || null, i, i), se({
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
function y0(e) {
  var n, s;
  const t = z("customers:edit"), r = S().prepare("SELECT business_id, current_balance FROM customers WHERE id = ?").get(e.id);
  if (!r) throw new Error("Customer not found");
  X(r.business_id);
  const i = e.isActive === !1 ? 0 : 1;
  return S().prepare("UPDATE customers SET name = ?, phone = ?, is_active = ? WHERE id = ?").run(e.name.trim(), ((n = e.phone) == null ? void 0 : n.trim()) || null, i, e.id), se({
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
function kd(e) {
  he();
  const t = S().prepare("SELECT id, business_id, name, phone, current_balance, is_active FROM customers WHERE id = ?").get(e);
  if (!t) throw new Error("Customer not found");
  X(t.business_id);
  const r = S().prepare(
    `SELECT id, invoice_no, total, status, created_at
       FROM sales WHERE customer_id = ? ORDER BY created_at DESC`
  ).all(e), i = S().prepare("SELECT method FROM payments WHERE sale_id = ?"), n = S().prepare(
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
function Ec(e) {
  const t = new Date(e);
  if (!Number.isFinite(t.getTime())) return e.slice(0, 10);
  const r = t.getFullYear(), i = String(t.getMonth() + 1).padStart(2, "0"), n = String(t.getDate()).padStart(2, "0");
  return `${r}-${i}-${n}`;
}
async function S0(e) {
  var l, p;
  ce(), z("sales:print");
  const t = kd(e.customerId), r = S().prepare("SELECT name, currency, logo_path, brand_color FROM businesses WHERE id = ?").get(t.customer.businessId);
  if (!r) throw new Error("Business not found");
  const i = ((l = e.from) == null ? void 0 : l.trim()) || null, n = ((p = e.to) == null ? void 0 : p.trim()) || null;
  if (i && n && i > n) throw new Error("Invalid date range");
  const s = [...t.ledger].sort((d, h) => {
    const _ = d.createdAt.localeCompare(h.createdAt);
    return _ !== 0 ? _ : d.id.localeCompare(h.id);
  }), a = s.filter((d) => {
    const h = Ec(d.createdAt);
    return !(i && h < i || n && h > n);
  });
  let o = 0;
  if (i) {
    const d = s.filter((h) => Ec(h.createdAt) < i);
    d.length > 0 && (o = d[d.length - 1].balanceAfter);
  }
  const c = new Map(
    t.sales.map((d) => [d.id, d.invoiceNo])
  ), u = HT({
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
  return wa({
    html: u,
    filePrefix: "customer-ledger",
    title: t.customer.name,
    width: 900,
    height: 960
  });
}
function R0(e) {
  var l, p;
  const t = z("customers:edit"), r = Number(e.amount);
  if (!Number.isFinite(r) || r <= 0) throw new Error("Payment amount must be greater than 0");
  if (e.method !== "cash" && e.method !== "card")
    throw new Error("Payment method must be cash or card");
  const i = S().prepare("SELECT id, business_id, name, current_balance FROM customers WHERE id = ?").get(e.customerId);
  if (!i) throw new Error("Customer not found");
  if (X(i.business_id), r > i.current_balance)
    throw new Error("Payment cannot exceed remaining credit balance");
  let n = ((l = e.branchId) == null ? void 0 : l.trim()) || null;
  n ? wr(n) : t.branchId && (n = t.branchId);
  const s = ne(), a = we(), o = i.current_balance - r, c = ((p = e.note) == null ? void 0 : p.trim()) || "", u = c ? `method:${e.method} | ${c}` : `method:${e.method}`;
  return S().transaction(() => {
    S().prepare("UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?").run(
      o,
      a,
      i.id
    ), S().prepare(
      `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
         VALUES (?, ?, ?, ?, 'payment', ?, ?, NULL, ?, ?, ?)`
    ).run(s, i.id, i.business_id, n, -r, o, u, t.id, a);
  })(), se({
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
function N0(e, t) {
  const r = S().prepare("SELECT name FROM businesses WHERE id = ?").get(e), i = S().prepare("SELECT name FROM branches WHERE id = ?").get(t);
  if (!r || !i) throw new Error("Business or branch not found");
  const n = nm(r.name, i.name), s = S().prepare("SELECT invoice_no FROM sales WHERE business_id = ? AND invoice_no LIKE ?").all(e, `${n}%`);
  let a = 0;
  for (const o of s) {
    const c = sm(o.invoice_no, n);
    c != null && c > a && (a = c);
  }
  return im(r.name, i.name, a + 1);
}
function I0(e) {
  var _, E, y;
  ce(), z("sales:checkout"), X(e.businessId), wr(e.branchId);
  const t = he();
  if (!e.items.length) throw new Error("Add at least one item to the sale");
  const r = It(e.businessId);
  let i = ((_ = e.servedByUserId) == null ? void 0 : _.trim()) || null, n = e.serviceMode ?? null, s = ((E = e.tableId) == null ? void 0 : E.trim()) || null;
  const a = ((y = e.ticketId) == null ? void 0 : y.trim()) || null;
  if ($E(r)) {
    if (!i) throw new Error("Served by staff is required");
    if (!S().prepare(
      `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
    ).get(i, e.businessId, e.businessId)) throw new Error("Selected staff member was not found");
  } else if (i)
    throw new Error("Served by is not used for this business type");
  if (ME(r)) {
    if (!n || !["dine_in", "takeaway", "delivery"].includes(n))
      throw new Error("Service mode is required");
    if (n === "dine_in") {
      if (!s) throw new Error("Table is required for dine-in");
      if (!S().prepare("SELECT id FROM dining_tables WHERE id = ? AND business_id = ? AND is_active = 1").get(s, e.businessId)) throw new Error("Table not found");
    } else
      s = null;
  } else {
    if (n || s)
      throw new Error("Tables and service modes are not used for this business type");
    n = null, s = null;
  }
  if (a) {
    if (!yr(r)) throw new Error("Tickets are only available for food businesses");
    const f = S().prepare(
      `SELECT id, status, table_id, service_mode FROM pos_tickets
         WHERE id = ? AND business_id = ?`
    ).get(a, e.businessId);
    if (!f) throw new Error("Ticket not found");
    if (f.status !== "open") throw new Error("Ticket is no longer open");
    n = f.service_mode, s = f.table_id;
  }
  const o = ne(), c = we(), u = N0(e.businessId, e.branchId), l = e.items.reduce((f, m) => f + m.qty * m.unitPrice, 0), p = Math.max(0, Number(e.discount ?? 0));
  if (!Number.isFinite(p)) throw new Error("Discount must be a valid number");
  if (p > l) throw new Error("Discount cannot exceed subtotal");
  const d = l - p, h = e.payments.reduce((f, m) => f + m.amount, 0);
  return S().transaction(() => {
    for (const w of e.items) {
      if (!Number.isFinite(w.qty) || w.qty <= 0) throw new Error("Item quantity must be greater than 0");
      const L = S().prepare(
        "SELECT id, name, stock_qty, tracks_stock, is_active FROM products WHERE id = ? AND business_id = ?"
      ).get(w.productId, e.businessId);
      if (!L || !L.is_active) throw new Error("Product not found or inactive");
      if (L.tracks_stock && w.qty > L.stock_qty)
        throw new Error(`Insufficient stock for ${L.name}`);
    }
    S().prepare(
      `INSERT INTO sales (
           id, business_id, branch_id, invoice_no, customer_id, cashier_id,
           subtotal, discount, tax, total, amount_paid, change_due, status,
           served_by_user_id, service_mode, table_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 'completed', ?, ?, ?, ?)`
    ).run(
      o,
      e.businessId,
      e.branchId,
      u,
      e.customerId,
      t.id,
      l,
      p,
      d,
      h,
      i,
      n,
      s,
      c
    );
    const f = S().prepare(
      `INSERT INTO sale_items (id, sale_id, product_id, product_name_snapshot, qty, unit_price, discount, line_total, refunded_qty)
       SELECT ?, ?, p.id, p.name, ?, ?, 0, ?, 0
       FROM products p WHERE p.id = ?`
    ), m = S().prepare(
      "UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND tracks_stock = 1"
    );
    for (const w of e.items)
      f.run(ne(), o, w.qty, w.unitPrice, w.qty * w.unitPrice, w.productId), m.run(w.qty, w.productId);
    const b = S().prepare("INSERT INTO payments (id, sale_id, method, amount, created_at) VALUES (?, ?, ?, ?, ?)");
    for (const w of e.payments)
      b.run(ne(), o, w.method, w.amount, c);
    const v = e.payments.filter((w) => w.method === "credit").reduce((w, L) => w + L.amount, 0);
    if (e.customerId && v > 0) {
      const L = S().prepare("SELECT current_balance FROM customers WHERE id = ?").get(e.customerId).current_balance + v;
      S().prepare("UPDATE customers SET current_balance = ? WHERE id = ?").run(L, e.customerId), S().prepare(
        `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
           VALUES (?, ?, ?, ?, 'sale', ?, ?, ?, 'Sale on credit', ?, ?)`
      ).run(ne(), e.customerId, e.businessId, e.branchId, v, L, o, t.id, c);
    }
    a && S().prepare("UPDATE pos_tickets SET status = 'billed', updated_at = ? WHERE id = ? AND status = 'open'").run(c, a);
  })(), se({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "sale",
    entityId: o,
    action: "created",
    summary: `Sale ${u} completed`,
    payload: { total: d, itemCount: e.items.length }
  }), {
    id: o,
    businessId: e.businessId,
    branchId: e.branchId,
    invoiceNo: u,
    customerId: e.customerId,
    cashierId: t.id,
    subtotal: l,
    discount: p,
    total: d,
    amountPaid: h,
    status: "completed",
    createdAt: c,
    servedByUserId: i,
    servedByName: null,
    serviceMode: n,
    tableId: s,
    tableName: null
  };
}
function L0(e) {
  return ce(), X(e), S().prepare(
    `SELECT s.id, s.business_id, s.branch_id, s.invoice_no, s.customer_id, s.cashier_id,
              s.subtotal, s.discount, s.total, s.amount_paid, s.status, s.created_at,
              s.served_by_user_id, u.name as served_by_name, s.service_mode, s.table_id, t.name as table_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.served_by_user_id
       LEFT JOIN dining_tables t ON t.id = s.table_id
       WHERE s.business_id = ?
       ORDER BY s.created_at DESC`
  ).all(e).map((r) => ({
    id: r.id,
    businessId: r.business_id,
    branchId: r.branch_id,
    invoiceNo: r.invoice_no,
    customerId: r.customer_id,
    cashierId: r.cashier_id,
    subtotal: r.subtotal,
    discount: r.discount,
    total: r.total,
    amountPaid: r.amount_paid,
    status: r.status,
    createdAt: r.created_at,
    servedByUserId: r.served_by_user_id,
    servedByName: r.served_by_name,
    serviceMode: r.service_mode,
    tableId: r.table_id,
    tableName: r.table_name
  }));
}
function zi(e) {
  const t = S().prepare(
    `SELECT r.id, r.sale_id, r.business_id, r.requested_by, ru.name as requested_by_name, r.reason, r.status,
              r.reviewed_by, rv.name as reviewed_by_name, r.reviewed_at, r.review_note, r.created_at
       FROM refund_requests r
       JOIN users ru ON ru.id = r.requested_by
       LEFT JOIN users rv ON rv.id = r.reviewed_by
       WHERE r.id = ?`
  ).get(e);
  if (!t) throw new Error("Refund request not found");
  const r = S().prepare(
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
function C0(e) {
  ce();
  const t = z("sales:refund_request");
  if (!e.reason.trim()) throw new Error("Refund reason is required");
  if (!e.items.length) throw new Error("Select at least one item to refund");
  const r = S().prepare("SELECT id, business_id, status FROM sales WHERE id = ?").get(e.saleId);
  if (!r) throw new Error("Sale not found");
  if (X(r.business_id), r.status === "void" || r.status === "refunded")
    throw new Error("Sale cannot be refunded");
  if (S().prepare("SELECT id FROM refund_requests WHERE sale_id = ? AND status = 'pending'").get(e.saleId)) throw new Error("A pending refund request already exists for this sale");
  const n = ne(), s = we();
  return S().transaction(() => {
    S().prepare(
      `INSERT INTO refund_requests (id, sale_id, business_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)`
    ).run(n, e.saleId, r.business_id, t.id, e.reason.trim(), s);
    const a = S().prepare(
      `INSERT INTO refund_request_items (id, refund_request_id, sale_item_id, product_id, qty)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const o of e.items) {
      if (o.qty <= 0) throw new Error("Refund qty must be positive");
      const c = S().prepare("SELECT id, product_id, qty, refunded_qty FROM sale_items WHERE id = ? AND sale_id = ?").get(o.saleItemId, e.saleId);
      if (!c) throw new Error("Sale item not found");
      const u = c.qty - (c.refunded_qty || 0);
      if (o.qty > u) throw new Error("Refund qty exceeds remaining quantity");
      a.run(ne(), n, c.id, c.product_id, o.qty);
    }
    se({
      businessId: r.business_id,
      actorUserId: t.id,
      entityType: "sale",
      entityId: e.saleId,
      action: "refund_requested",
      summary: `Refund requested: ${e.reason.trim()}`,
      payload: { requestId: n, items: e.items }
    });
  })(), zi(n);
}
function A0(e) {
  var a;
  ce();
  const t = z("sales:refund_approve"), r = S().prepare("SELECT id, sale_id, business_id, status, reason FROM refund_requests WHERE id = ?").get(e.id);
  if (!r) throw new Error("Refund request not found");
  if (X(r.business_id), r.status !== "pending") throw new Error("Refund request already reviewed");
  const i = we();
  if (e.decision === "reject")
    return S().prepare(
      "UPDATE refund_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?"
    ).run(t.id, i, ((a = e.note) == null ? void 0 : a.trim()) || null, e.id), se({
      businessId: r.business_id,
      actorUserId: t.id,
      entityType: "sale",
      entityId: r.sale_id,
      action: "refund_rejected",
      summary: `Refund rejected${e.note ? `: ${e.note}` : ""}`,
      payload: { requestId: e.id }
    }), zi(e.id);
  const n = S().prepare("SELECT id, customer_id, status, total FROM sales WHERE id = ?").get(r.sale_id);
  if (!n) throw new Error("Sale not found");
  const s = S().prepare("SELECT sale_item_id, product_id, qty FROM refund_request_items WHERE refund_request_id = ?").all(e.id);
  return S().transaction(() => {
    var h;
    const o = S().prepare(
      "UPDATE products SET stock_qty = stock_qty + ? WHERE id = ? AND tracks_stock = 1"
    ), c = S().prepare(
      "UPDATE sale_items SET refunded_qty = refunded_qty + ? WHERE id = ?"
    );
    let u = 0;
    for (const _ of s) {
      const E = S().prepare("SELECT qty, refunded_qty, unit_price FROM sale_items WHERE id = ?").get(_.sale_item_id), y = E.qty - (E.refunded_qty || 0);
      if (_.qty > y) throw new Error("Refund qty no longer available");
      c.run(_.qty, _.sale_item_id), o.run(_.qty, _.product_id), u += _.qty * E.unit_price;
    }
    const d = S().prepare("SELECT qty, refunded_qty FROM sale_items WHERE sale_id = ?").all(r.sale_id).every((_) => _.refunded_qty >= _.qty) ? "refunded" : "partially_refunded";
    if (S().prepare("UPDATE sales SET status = ? WHERE id = ?").run(d, r.sale_id), n.customer_id && u > 0) {
      const E = S().prepare("SELECT SUM(amount) as total FROM payments WHERE sale_id = ? AND method = 'credit'").get(r.sale_id).total ?? 0;
      if (E > 0) {
        const y = Math.min(u, E), m = S().prepare("SELECT current_balance FROM customers WHERE id = ?").get(n.customer_id).current_balance - y;
        S().prepare("UPDATE customers SET current_balance = ? WHERE id = ?").run(m, n.customer_id), S().prepare(
          `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
             VALUES (?, ?, ?, NULL, 'adjustment', ?, ?, ?, ?, ?, ?)`
        ).run(
          ne(),
          n.customer_id,
          r.business_id,
          -y,
          m,
          r.sale_id,
          `Refund approved: ${r.reason}`,
          t.id,
          i
        );
      }
    }
    S().prepare(
      "UPDATE refund_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?"
    ).run(t.id, i, ((h = e.note) == null ? void 0 : h.trim()) || null, e.id), se({
      businessId: r.business_id,
      actorUserId: t.id,
      entityType: "sale",
      entityId: r.sale_id,
      action: "refund_approved",
      summary: `Refund approved (${d})`,
      payload: { requestId: e.id, refundAmount: u, items: s }
    });
  })(), zi(e.id);
}
function O0(e) {
  ce(), he();
  const t = S().prepare(
    `SELECT s.id, s.business_id, s.branch_id, s.invoice_no, s.customer_id, s.cashier_id,
              s.subtotal, s.discount, s.total, s.amount_paid, s.status, s.created_at,
              s.served_by_user_id, u.name as served_by_name, s.service_mode, s.table_id, t.name as table_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.served_by_user_id
       LEFT JOIN dining_tables t ON t.id = s.table_id
       WHERE s.id = ?`
  ).get(e);
  if (!t) throw new Error("Sale not found");
  X(t.business_id);
  const r = S().prepare(
    `SELECT id, sale_id, product_id, product_name_snapshot, qty, unit_price, line_total, refunded_qty
       FROM sale_items WHERE sale_id = ?`
  ).all(e), i = S().prepare("SELECT id, method, amount, created_at FROM payments WHERE sale_id = ?").all(e), n = S().prepare("SELECT id FROM refund_requests WHERE sale_id = ? ORDER BY created_at DESC").all(e);
  return {
    sale: {
      id: t.id,
      businessId: t.business_id,
      branchId: t.branch_id,
      invoiceNo: t.invoice_no,
      customerId: t.customer_id,
      cashierId: t.cashier_id,
      subtotal: t.subtotal,
      discount: t.discount,
      total: t.total,
      amountPaid: t.amount_paid,
      status: t.status,
      createdAt: t.created_at,
      servedByUserId: t.served_by_user_id,
      servedByName: t.served_by_name,
      serviceMode: t.service_mode,
      tableId: t.table_id,
      tableName: t.table_name
    },
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
        refundableQty: s.qty - (s.refunded_qty || 0)
      })
    ),
    payments: i.map((s) => ({
      id: s.id,
      method: s.method,
      amount: s.amount,
      createdAt: s.created_at
    })),
    refundRequests: n.map((s) => zi(s.id)),
    activity: Ms("sale", e)
  };
}
function k0(e, t) {
  ce(), X(e);
  const r = t.trim();
  if (!r) return null;
  const i = S().prepare(
    `SELECT s.id, s.business_id, s.branch_id, s.invoice_no, s.customer_id, s.cashier_id,
              s.subtotal, s.discount, s.total, s.amount_paid, s.status, s.created_at,
              s.served_by_user_id, u.name as served_by_name, s.service_mode, s.table_id, t.name as table_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.served_by_user_id
       LEFT JOIN dining_tables t ON t.id = s.table_id
       WHERE s.business_id = ? AND s.invoice_no = ?
       LIMIT 1`
  ).get(e, r);
  return i ? {
    id: i.id,
    businessId: i.business_id,
    branchId: i.branch_id,
    invoiceNo: i.invoice_no,
    customerId: i.customer_id,
    cashierId: i.cashier_id,
    subtotal: i.subtotal,
    discount: i.discount,
    total: i.total,
    amountPaid: i.amount_paid,
    status: i.status,
    createdAt: i.created_at,
    servedByUserId: i.served_by_user_id,
    servedByName: i.served_by_name,
    serviceMode: i.service_mode,
    tableId: i.table_id,
    tableName: i.table_name
  } : null;
}
async function x0(e) {
  ce(), z("sales:print");
  const t = he(), r = S().prepare(
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
  X(r.business_id);
  const i = S().prepare(
    `SELECT address, phone FROM branches
       WHERE business_id = ? AND is_main_branch = 1
       ORDER BY created_at ASC LIMIT 1`
  ).get(r.business_id), n = S().prepare(
    "SELECT address, phone FROM branches WHERE business_id = ? ORDER BY created_at ASC LIMIT 1"
  ).get(r.business_id), s = i ?? n, a = S().prepare(
    "SELECT product_name_snapshot as product_name, qty, unit_price, line_total FROM sale_items WHERE sale_id = ? ORDER BY id"
  ).all(e), o = S().prepare("SELECT method, amount FROM payments WHERE sale_id = ?").all(e);
  let c = "";
  try {
    const l = WT.resolve("jsbarcode/dist/JsBarcode.all.min.js");
    c = F.readFileSync(l, "utf8");
  } catch {
    c = "";
  }
  const u = await UT({
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
  return wa({
    html: u,
    filePrefix: "sale-receipt",
    title: r.invoice_no,
    width: 420,
    height: 760
  });
}
function D0(e) {
  const t = typeof e == "string" ? Number(e) : e;
  return t === 7 || t === 30 || t === 90 ? t : 30;
}
function rr(e) {
  const t = e.getUTCFullYear(), r = String(e.getUTCMonth() + 1).padStart(2, "0"), i = String(e.getUTCDate()).padStart(2, "0");
  return `${t}-${r}-${i}`;
}
function mc(e = /* @__PURE__ */ new Date()) {
  return new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
}
const gc = /^(\d{4})-(\d{2})-(\d{2})$/, _s = 366;
function Wi(e) {
  if (!e || !gc.test(e)) return null;
  const [, t, r, i] = e.match(gc), n = Number(t), s = Number(r), a = Number(i), o = new Date(Date.UTC(n, s - 1, a));
  return rr(o) !== e ? null : o;
}
function U0(e) {
  const t = typeof e.from == "string" ? e.from.trim() : "", r = typeof e.to == "string" ? e.to.trim() : "";
  if (!!(t || r)) {
    let o = Wi(t), c = Wi(r);
    if (!o && !c)
      throw new Error("Invalid analytics date range");
    if (c || (c = mc()), o || (o = new Date(c.getTime())), o.getTime() > c.getTime()) {
      const p = o;
      o = c, c = p;
    }
    const u = 24 * 60 * 60 * 1e3;
    let l = Math.floor((c.getTime() - o.getTime()) / u) + 1;
    return l > _s && (o = new Date(c.getTime()), o.setUTCDate(o.getUTCDate() - (_s - 1)), l = _s), {
      from: rr(o),
      to: rr(c),
      days: l,
      sinceIso: o.toISOString()
    };
  }
  const n = D0(e.days), s = mc(), a = new Date(s.getTime());
  return a.setUTCDate(a.getUTCDate() - (n - 1)), {
    from: rr(a),
    to: rr(s),
    days: n,
    sinceIso: a.toISOString()
  };
}
function Tc(e) {
  const t = typeof e == "object" && e && "businessId" in e ? String(e.businessId) : "", r = U0(
    typeof e == "object" && e ? {
      days: e.days,
      from: e.from,
      to: e.to
    } : {}
  );
  z("business:view"), X(t);
  const { from: i, to: n, days: s, sinceIso: a } = r, o = Wi(n);
  o.setUTCDate(o.getUTCDate() + 1);
  const c = o.toISOString(), u = S().prepare(
    `SELECT date(created_at) as day, SUM(total) as total, COUNT(*) as count
       FROM sales
       WHERE business_id = ? AND created_at >= ? AND created_at < ? AND status != 'void'
       GROUP BY date(created_at)
       ORDER BY day ASC`
  ).all(t, a, c), l = new Map(u.map((w) => [w.day, w])), p = [];
  let d = 0, h = 0;
  const _ = Wi(i);
  for (let w = 0; w < s; w += 1) {
    const L = rr(_), I = l.get(L), k = (I == null ? void 0 : I.total) ?? 0, B = (I == null ? void 0 : I.count) ?? 0;
    d += k, h += B, p.push({ date: L, total: k, count: B }), _.setUTCDate(_.getUTCDate() + 1);
  }
  const E = S().prepare(
    `SELECT p.method, SUM(p.amount) as total
       FROM payments p
       JOIN sales s ON s.id = p.sale_id
       WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at < ? AND s.status != 'void'
       GROUP BY p.method`
  ).all(t, a, c), y = new Map(E.map((w) => [w.method, w.total])), f = ["cash", "card", "credit"].map((w) => ({ method: w, total: y.get(w) ?? 0 })), m = S().prepare(
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
  ).all(t, a, c), b = S().prepare(
    `SELECT COALESCE(SUM(current_balance), 0) as total,
              COUNT(*) as customers
       FROM customers
       WHERE business_id = ? AND current_balance > 0 AND is_active = 1`
  ).get(t), v = S().prepare(
    `SELECT COUNT(*) as c FROM products
       WHERE business_id = ? AND is_active = 1 AND tracks_stock = 1 AND stock_qty <= 5`
  ).get(t);
  return {
    days: s,
    from: i,
    to: n,
    salesByDay: p,
    paymentsByMethod: f,
    topProducts: m.map((w) => ({
      productName: w.product_name,
      qty: w.qty,
      revenue: w.revenue
    })),
    creditOutstanding: b.total,
    customersWithBalance: b.customers,
    lowStockCount: v.c,
    salesTotal: d,
    salesCount: h
  };
}
function B0(e) {
  return {
    id: e.id,
    productId: e.product_id,
    productName: e.product_name_snapshot,
    qty: e.qty,
    unitPrice: e.unit_price,
    lineTotal: e.line_total
  };
}
function gn(e) {
  const t = S().prepare(
    `SELECT id, business_id, branch_id, table_id, service_mode, status, opened_by, notes, created_at, updated_at
       FROM pos_tickets WHERE id = ?`
  ).get(e);
  if (!t) throw new Error("Ticket not found");
  const i = S().prepare(
    `SELECT id, product_id, product_name_snapshot, qty, unit_price, line_total
       FROM pos_ticket_items WHERE ticket_id = ? ORDER BY rowid ASC`
  ).all(e).map(B0);
  return {
    id: t.id,
    businessId: t.business_id,
    branchId: t.branch_id,
    tableId: t.table_id,
    serviceMode: t.service_mode,
    status: t.status,
    openedBy: t.opened_by,
    notes: t.notes,
    items: i,
    total: i.reduce((n, s) => n + s.lineTotal, 0),
    createdAt: t.created_at,
    updatedAt: t.updated_at
  };
}
function Ra(e) {
  if (ce(), X(e), !yr(It(e)))
    throw new Error("Tables are only available for food businesses");
  return S().prepare(
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
function P0(e) {
  if (ce(), z("tables:edit"), X(e.businessId), !yr(It(e.businessId)))
    throw new Error("Tables are only available for food businesses");
  const t = he(), r = ne(), i = e.name.trim();
  if (!i) throw new Error("Table name is required");
  return S().prepare(
    `INSERT INTO dining_tables (id, business_id, name, seats, sort_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
  ).run(
    r,
    e.businessId,
    i,
    e.seats ?? null,
    e.sortOrder ?? 0,
    we()
  ), se({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "dining_table",
    entityId: r,
    action: "created",
    summary: `Created table ${i}`
  }), Ra(e.businessId).find((n) => n.id === r);
}
function F0(e) {
  ce();
  const t = z("tables:edit"), r = S().prepare("SELECT business_id FROM dining_tables WHERE id = ?").get(e.id);
  if (!r) throw new Error("Table not found");
  if (X(r.business_id), !yr(It(r.business_id)))
    throw new Error("Tables are only available for food businesses");
  const i = e.name.trim();
  if (!i) throw new Error("Table name is required");
  return S().prepare(
    `UPDATE dining_tables SET name = ?, seats = ?, sort_order = ?, is_active = ?
       WHERE id = ?`
  ).run(
    i,
    e.seats ?? null,
    e.sortOrder ?? 0,
    e.isActive === !1 ? 0 : 1,
    e.id
  ), se({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "dining_table",
    entityId: e.id,
    action: "updated",
    summary: `Updated table ${i}`
  }), Ra(r.business_id).find((n) => n.id === e.id);
}
function M0(e) {
  if (ce(), X(e), !yr(It(e)))
    throw new Error("Tickets are only available for food businesses");
  return S().prepare("SELECT id FROM pos_tickets WHERE business_id = ? AND status = 'open' ORDER BY updated_at DESC").all(e).map((r) => gn(r.id));
}
function $0(e) {
  ce(), he();
  const t = gn(e);
  return X(t.businessId), t;
}
function H0(e) {
  var s, a;
  if (ce(), z("sales:checkout"), X(e.businessId), wr(e.branchId), !yr(It(e.businessId)))
    throw new Error("Tickets are only available for food businesses");
  if (!["dine_in", "takeaway", "delivery"].includes(e.serviceMode))
    throw new Error("Invalid service mode");
  const t = he();
  let r = ((s = e.tableId) == null ? void 0 : s.trim()) || null;
  if (e.serviceMode === "dine_in") {
    if (!r) throw new Error("Table is required for dine-in");
    if (!S().prepare("SELECT id FROM dining_tables WHERE id = ? AND business_id = ? AND is_active = 1").get(r, e.businessId)) throw new Error("Table not found");
    if (S().prepare("SELECT id FROM pos_tickets WHERE table_id = ? AND status = 'open'").get(r)) throw new Error("Table already has an open ticket");
  } else
    r = null;
  const i = ne(), n = we();
  return S().prepare(
    `INSERT INTO pos_tickets (id, business_id, branch_id, table_id, service_mode, status, opened_by, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`
  ).run(
    i,
    e.businessId,
    e.branchId,
    r,
    e.serviceMode,
    t.id,
    ((a = e.notes) == null ? void 0 : a.trim()) || null,
    n,
    n
  ), se({
    businessId: e.businessId,
    actorUserId: t.id,
    entityType: "pos_ticket",
    entityId: i,
    action: "opened",
    summary: `Opened ${e.serviceMode} ticket`
  }), gn(i);
}
function X0(e) {
  ce(), z("sales:checkout");
  const t = S().prepare("SELECT id, business_id, status FROM pos_tickets WHERE id = ?").get(e.ticketId);
  if (!t) throw new Error("Ticket not found");
  if (X(t.business_id), t.status !== "open") throw new Error("Ticket is no longer open");
  const r = we();
  return S().transaction(() => {
    S().prepare("DELETE FROM pos_ticket_items WHERE ticket_id = ?").run(e.ticketId);
    const i = S().prepare(
      `INSERT INTO pos_ticket_items (id, ticket_id, product_id, product_name_snapshot, qty, unit_price, line_total)
       SELECT ?, ?, p.id, p.name, ?, ?, ?
       FROM products p WHERE p.id = ? AND p.business_id = ? AND p.is_active = 1`
    );
    for (const n of e.items) {
      if (!Number.isFinite(n.qty) || n.qty <= 0) throw new Error("Item quantity must be greater than 0");
      const s = S().prepare(
        "SELECT id, name, stock_qty, tracks_stock FROM products WHERE id = ? AND business_id = ? AND is_active = 1"
      ).get(n.productId, t.business_id);
      if (!s) throw new Error("Product not found or inactive");
      if (s.tracks_stock && n.qty > s.stock_qty)
        throw new Error(`Insufficient stock for ${s.name}`);
      if (i.run(
        ne(),
        e.ticketId,
        n.qty,
        n.unitPrice,
        n.qty * n.unitPrice,
        n.productId,
        t.business_id
      ).changes !== 1) throw new Error("Failed to add ticket item");
    }
    S().prepare("UPDATE pos_tickets SET updated_at = ? WHERE id = ?").run(r, e.ticketId);
  })(), gn(e.ticketId);
}
function z0(e) {
  ce(), z("sales:checkout");
  const t = he(), r = S().prepare("SELECT id, business_id, status FROM pos_tickets WHERE id = ?").get(e);
  if (!r) throw new Error("Ticket not found");
  if (X(r.business_id), r.status !== "open") throw new Error("Ticket is no longer open");
  return S().prepare("UPDATE pos_tickets SET status = 'cancelled', updated_at = ? WHERE id = ?").run(we(), e), se({
    businessId: r.business_id,
    actorUserId: t.id,
    entityType: "pos_ticket",
    entityId: e,
    action: "cancelled",
    summary: "Cancelled open ticket"
  }), { ok: !0 };
}
function W0() {
  x.handle(O.APP_PING, async () => ({
    ok: !0,
    at: (/* @__PURE__ */ new Date()).toISOString()
  })), x.handle(O.APP_GET_INFO, async () => ({
    name: Xe.getName(),
    version: Xe.getVersion(),
    platform: process.platform,
    userDataPath: Xe.getPath("userData")
  })), x.handle(O.APP_GET_BOOT_STATE, async () => HE()), x.handle(O.APP_GET_BRAND_COLOR, async () => XE()), x.handle(O.APP_GET_LANGUAGE, async () => Pt(re.get("language"))), x.handle(O.APP_SET_LANGUAGE, async (e, t) => {
    const r = Pt(t);
    return re.set("language", r), { ok: !0 };
  }), x.handle(O.APP_GET_LICENSE_STATUS, async () => {
    const e = hr();
    return e.status === "none" ? { state: "missing", expiresAt: null, issuedTo: null } : e.status === "expired" ? {
      state: "expired",
      expiresAt: e.record.expiresAt,
      issuedTo: e.record.issuedTo
    } : {
      state: e.record.expiresAt ? "valid" : "lifetime",
      expiresAt: e.record.expiresAt,
      issuedTo: e.record.issuedTo
    };
  }), x.handle(O.APP_GET_RESTOCK_ALERTS, async (e, t) => {
    z("business:view");
    const r = t == null ? void 0 : t.trim();
    return r ? (X(r), jE(r)) : [];
  }), x.handle(O.REMINDERS_MAYBE_RUN, async () => (he(), rm())), x.handle(O.LICENSE_ACTIVATE, async (e, t) => Vi(t)), x.handle(O.SETUP_COMPLETE, async (e, t) => zE(t)), x.handle(
    O.SETUP_RESTORE_FROM_BACKUP,
    async (e, t) => WE(t, (r) => {
      e.sender.send(O.BACKUP_PROGRESS, r);
    })
  ), x.handle(O.AUTH_LOGIN, async (e, t) => uE(t)), x.handle(
    O.AUTH_RESET_OWNER_PASSWORD_OFFLINE,
    async (e, t) => lE(t)
  ), x.handle(O.AUTH_LOGOUT, async () => El()), x.handle(O.AUTH_SESSION, async () => _l()), x.handle(O.BUSINESS_LIST, async () => YT()), x.handle(O.BUSINESS_CREATE, async (e, t) => jT(t)), x.handle(O.BUSINESS_UPDATE, async (e, t) => GT(t)), x.handle(O.BUSINESS_SET_ACTIVE, async (e, t) => VT(t)), x.handle(O.BRANCH_LIST, async (e, t) => ZT(t)), x.handle(O.BRANCH_CREATE, async (e, t) => JT(t)), x.handle(O.BRANCH_UPDATE, async (e, t) => QT(t)), x.handle(O.USER_LIST, async (e, t) => e0(t)), x.handle(O.USER_CREATE, async (e, t) => t0(t)), x.handle(O.USER_UPDATE_SELF, async (e, t) => i0(t)), x.handle(O.USER_SET_ACTIVE, async (e, t) => r0(t)), x.handle(O.PRODUCT_LIST, async (e, t) => n0(t)), x.handle(O.PRODUCT_CREATE, async (e, t) => s0(t)), x.handle(O.PRODUCT_UPDATE, async (e, t) => a0(t)), x.handle(O.PRODUCT_SET_ACTIVE, async (e, t) => o0(t)), x.handle(O.PRODUCT_DELETE, async (e, t) => c0(t)), x.handle(
    O.PRODUCT_GENERATE_BARCODE,
    async (e, t) => l0(t)
  ), x.handle(
    O.PRODUCT_ACTIVITY,
    async (e, t) => Ms("product", t)
  ), x.handle(
    O.PRODUCT_LIST_SUPPLIERS,
    async (e, t) => u0(t)
  ), x.handle(O.SUPPLIER_LIST, async (e, t) => d0(t)), x.handle(
    O.SUPPLIER_GET_DETAIL,
    async (e, t) => p0(t)
  ), x.handle(O.SUPPLIER_CREATE, async (e, t) => f0(t)), x.handle(O.SUPPLIER_UPDATE, async (e, t) => h0(t)), x.handle(
    O.SUPPLIER_LIST_PRODUCTS,
    async (e, t) => Sa(t)
  ), x.handle(O.SUPPLIER_LINK_PRODUCT, async (e, t) => _0(t)), x.handle(
    O.SUPPLIER_UNLINK_PRODUCT,
    async (e, t) => E0(t)
  ), x.handle(
    O.SUPPLIER_UPDATE_LINKED_PRODUCT,
    async (e, t) => m0(t)
  ), x.handle(O.PO_LIST, async (e, t) => g0(t)), x.handle(O.PO_GET_DETAIL, async (e, t) => Od(t)), x.handle(O.PO_CREATE, async (e, t) => T0(t)), x.handle(O.PO_PRINT, async (e, t) => b0(t)), x.handle(O.CUSTOMER_LIST, async (e, t) => v0(t)), x.handle(O.CUSTOMER_GET_DETAIL, async (e, t) => kd(t)), x.handle(O.CUSTOMER_CREATE, async (e, t) => w0(t)), x.handle(O.CUSTOMER_UPDATE, async (e, t) => y0(t)), x.handle(
    O.CUSTOMER_RECORD_PAYMENT,
    async (e, t) => R0(t)
  ), x.handle(
    O.CUSTOMER_PRINT_LEDGER,
    async (e, t) => S0(t)
  ), x.handle(O.SALES_LIST, async (e, t) => L0(t)), x.handle(O.SALES_GET_DETAIL, async (e, t) => O0(t)), x.handle(
    O.SALES_FIND_BY_INVOICE,
    async (e, t) => k0(t.businessId, t.invoiceNo)
  ), x.handle(O.SALES_CREATE, async (e, t) => I0(t)), x.handle(O.SALES_REFUND_REQUEST, async (e, t) => C0(t)), x.handle(O.SALES_REFUND_REVIEW, async (e, t) => A0(t)), x.handle(O.SALES_PRINT, async (e, t) => x0(t)), x.handle(O.TABLE_LIST, async (e, t) => Ra(t)), x.handle(O.TABLE_CREATE, async (e, t) => P0(t)), x.handle(O.TABLE_UPDATE, async (e, t) => F0(t)), x.handle(O.TICKET_LIST_OPEN, async (e, t) => M0(t)), x.handle(O.TICKET_GET, async (e, t) => $0(t)), x.handle(O.TICKET_OPEN, async (e, t) => H0(t)), x.handle(O.TICKET_SET_ITEMS, async (e, t) => X0(t)), x.handle(O.TICKET_CANCEL, async (e, t) => z0(t)), x.handle(
    O.ACTIVITY_LIST,
    async (e, t) => Ms(t.entityType, t.entityId)
  ), x.handle(
    O.ANALYTICS_SUMMARY,
    async (e, t) => Tc(typeof t == "string" ? { businessId: t, days: 30 } : {
      businessId: (t == null ? void 0 : t.businessId) ?? "",
      days: t == null ? void 0 : t.days,
      from: t == null ? void 0 : t.from,
      to: t == null ? void 0 : t.to
    })
  ), x.handle(
    O.ASSETS_PICK_AND_SAVE,
    async (e, t) => gT(t.kind)
  ), x.handle(
    O.BACKUP_CREATE,
    async (e) => xE((t) => {
      e.sender.send(O.BACKUP_PROGRESS, t);
    })
  ), x.handle(
    O.BACKUP_RESTORE,
    async (e, t) => DE(t, (r) => {
      e.sender.send(O.BACKUP_PROGRESS, r);
    })
  ), x.handle(O.BACKUP_PICK_FILE, async () => UE()), x.handle(O.BACKUP_GET_AUTO_SETTINGS, async () => (z("business:view"), Ws())), x.handle(
    O.BACKUP_SET_AUTO_SETTINGS,
    async (e, t) => (z("business:view"), uf(t))
  );
}
const q0 = 45e3;
let bc = null, Es = !1;
function vc(e = /* @__PURE__ */ new Date()) {
  const t = e.getFullYear(), r = String(e.getMonth() + 1).padStart(2, "0"), i = String(e.getDate()).padStart(2, "0");
  return `${t}-${r}-${i}`;
}
function K0(e) {
  if (!e) return !1;
  const t = new Date(e);
  return Number.isNaN(t.getTime()) ? !1 : vc(t) === vc();
}
function Y0(e, t = /* @__PURE__ */ new Date()) {
  const r = zs(e), [i, n] = r.split(":").map(Number);
  return t.getHours() === i && t.getMinutes() === n;
}
async function wc() {
  if (Es || kE()) return;
  const e = Ws();
  if (e.autoBackupEnabled && Y0(e.autoBackupTime) && !K0(e.lastAutoBackupAt)) {
    Es = !0;
    try {
      await wl(), lf();
    } catch (t) {
      console.error("[auto-backup] failed", t);
    } finally {
      Es = !1;
    }
  }
}
function j0() {
  bc || (wc(), bc = setInterval(() => {
    wc();
  }, q0));
}
Rc.registerSchemesAsPrivileged([
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
const xd = P.dirname(Bd(import.meta.url));
process.env.APP_ROOT = P.join(xd, "..");
of.config({ path: P.join(process.env.APP_ROOT, ".env") });
const $s = process.env.VITE_DEV_SERVER_URL, Eb = P.join(process.env.APP_ROOT, "dist-electron"), Dd = P.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = $s ? P.join(process.env.APP_ROOT, "public") : Dd;
let Et = null;
function yc() {
  Et = new qi({
    title: "Kaarobar",
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: !1,
    backgroundColor: "#f6f8fb",
    icon: P.join(process.env.VITE_PUBLIC, "kaarobar-logo.svg"),
    webPreferences: {
      preload: P.join(xd, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !0
    }
  }), Et.once("ready-to-show", () => {
    Et == null || Et.show();
  }), $s ? Et.loadURL($s) : Et.loadFile(P.join(Dd, "index.html"));
}
Xe.whenReady().then(() => {
  Xe.setPath("userData", Qe()), Rc.handle("kaarobar-asset", (e) => mT(e.url)), W0(), yc(), j0(), Xe.on("activate", () => {
    qi.getAllWindows().length === 0 && yc();
  });
});
Xe.on("window-all-closed", () => {
  process.platform !== "darwin" && (Xe.quit(), Et = null);
});
export {
  Eb as MAIN_DIST,
  Dd as RENDERER_DIST,
  $s as VITE_DEV_SERVER_URL
};
