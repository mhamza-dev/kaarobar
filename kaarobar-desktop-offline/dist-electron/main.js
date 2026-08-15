import { app, dialog, BrowserWindow, ipcMain, protocol } from "electron";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import require$$0 from "fs";
import require$$1 from "path";
import require$$2 from "os";
import require$$3 from "crypto";
import Store from "electron-store";
import fs$1 from "node:fs";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { randomBytes, createCipheriv, createHash, randomUUID, scryptSync, createDecipheriv } from "node:crypto";
import { execFileSync } from "node:child_process";
import os$1 from "node:os";
import bcrypt from "bcryptjs";
import require$$1$1 from "stream";
import require$$2$1 from "events";
import require$$0$1 from "buffer";
import require$$0$2 from "util";
import require$$1$2 from "zlib";
import require$$0$3 from "assert";
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var main = { exports: {} };
const fs = require$$0;
const path = require$$1;
const os = require$$2;
const crypto$1 = require$$3;
const TIPS = [
  "◈ encrypted .env [www.dotenvx.com]",
  "◈ secrets for agents [www.dotenvx.com]",
  "⌁ auth for agents [www.vestauth.com]",
  "⌘ custom filepath { path: '/custom/path/.env' }",
  "⌘ enable debugging { debug: true }",
  "⌘ override existing { override: true }",
  "⌘ suppress logs { quiet: true }",
  "⌘ multiple files { path: ['.env.local', '.env'] }"
];
function _getRandomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}
function parseBoolean(value) {
  if (typeof value === "string") {
    return !["false", "0", "no", "off", ""].includes(value.toLowerCase());
  }
  return Boolean(value);
}
function supportsAnsi() {
  return process.stdout.isTTY;
}
function dim(text) {
  return supportsAnsi() ? `\x1B[2m${text}\x1B[0m` : text;
}
const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
function parse$1(src) {
  const obj = {};
  let lines = src.toString();
  lines = lines.replace(/\r\n?/mg, "\n");
  let match;
  while ((match = LINE.exec(lines)) != null) {
    const key = match[1];
    let value = match[2] || "";
    value = value.trim();
    const maybeQuote = value[0];
    value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
    if (maybeQuote === '"') {
      value = value.replace(/\\n/g, "\n");
      value = value.replace(/\\r/g, "\r");
    }
    obj[key] = value;
  }
  return obj;
}
function _parseVault(options) {
  options = options || {};
  const vaultPath = _vaultPath(options);
  options.path = vaultPath;
  const result = DotenvModule.configDotenv(options);
  if (!result.parsed) {
    const err2 = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
    err2.code = "MISSING_DATA";
    throw err2;
  }
  const keys = _dotenvKey(options).split(",");
  const length = keys.length;
  let decrypted;
  for (let i = 0; i < length; i++) {
    try {
      const key = keys[i].trim();
      const attrs = _instructions(result, key);
      decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
      break;
    } catch (error) {
      if (i + 1 >= length) {
        throw error;
      }
    }
  }
  return DotenvModule.parse(decrypted);
}
function _warn(message) {
  console.error(`⚠ ${message}`);
}
function _debug(message) {
  console.log(`┆ ${message}`);
}
function _log(message) {
  console.log(`◇ ${message}`);
}
function _dotenvKey(options) {
  if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
    return options.DOTENV_KEY;
  }
  if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
    return process.env.DOTENV_KEY;
  }
  return "";
}
function _instructions(result, dotenvKey) {
  let uri;
  try {
    uri = new URL(dotenvKey);
  } catch (error) {
    if (error.code === "ERR_INVALID_URL") {
      const err2 = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
      err2.code = "INVALID_DOTENV_KEY";
      throw err2;
    }
    throw error;
  }
  const key = uri.password;
  if (!key) {
    const err2 = new Error("INVALID_DOTENV_KEY: Missing key part");
    err2.code = "INVALID_DOTENV_KEY";
    throw err2;
  }
  const environment = uri.searchParams.get("environment");
  if (!environment) {
    const err2 = new Error("INVALID_DOTENV_KEY: Missing environment part");
    err2.code = "INVALID_DOTENV_KEY";
    throw err2;
  }
  const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
  const ciphertext = result.parsed[environmentKey];
  if (!ciphertext) {
    const err2 = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
    err2.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
    throw err2;
  }
  return { ciphertext, key };
}
function _vaultPath(options) {
  let possibleVaultPath = null;
  if (options && options.path && options.path.length > 0) {
    if (Array.isArray(options.path)) {
      for (const filepath of options.path) {
        if (fs.existsSync(filepath)) {
          possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
        }
      }
    } else {
      possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
    }
  } else {
    possibleVaultPath = path.resolve(process.cwd(), ".env.vault");
  }
  if (fs.existsSync(possibleVaultPath)) {
    return possibleVaultPath;
  }
  return null;
}
function _resolveHome(envPath) {
  return envPath[0] === "~" ? path.join(os.homedir(), envPath.slice(1)) : envPath;
}
function _configVault(options) {
  const debug = parseBoolean(process.env.DOTENV_CONFIG_DEBUG || options && options.debug);
  const quiet = parseBoolean(process.env.DOTENV_CONFIG_QUIET || options && options.quiet);
  if (debug || !quiet) {
    _log("loading env from encrypted .env.vault");
  }
  const parsed = DotenvModule._parseVault(options);
  let processEnv = process.env;
  if (options && options.processEnv != null) {
    processEnv = options.processEnv;
  }
  DotenvModule.populate(processEnv, parsed, options);
  return { parsed };
}
function configDotenv(options) {
  const dotenvPath = path.resolve(process.cwd(), ".env");
  let encoding = "utf8";
  let processEnv = process.env;
  if (options && options.processEnv != null) {
    processEnv = options.processEnv;
  }
  let debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || options && options.debug);
  let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || options && options.quiet);
  if (options && options.encoding) {
    encoding = options.encoding;
  } else {
    if (debug) {
      _debug("no encoding is specified (UTF-8 is used by default)");
    }
  }
  let optionPaths = [dotenvPath];
  if (options && options.path) {
    if (!Array.isArray(options.path)) {
      optionPaths = [_resolveHome(options.path)];
    } else {
      optionPaths = [];
      for (const filepath of options.path) {
        optionPaths.push(_resolveHome(filepath));
      }
    }
  }
  let lastError;
  const parsedAll = {};
  for (const path2 of optionPaths) {
    try {
      const parsed = DotenvModule.parse(fs.readFileSync(path2, { encoding }));
      DotenvModule.populate(parsedAll, parsed, options);
    } catch (e) {
      if (debug) {
        _debug(`failed to load ${path2} ${e.message}`);
      }
      lastError = e;
    }
  }
  const populated = DotenvModule.populate(processEnv, parsedAll, options);
  debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug);
  quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet);
  if (debug || !quiet) {
    const keysCount = Object.keys(populated).length;
    const shortPaths = [];
    for (const filePath of optionPaths) {
      try {
        const relative = path.relative(process.cwd(), filePath);
        shortPaths.push(relative);
      } catch (e) {
        if (debug) {
          _debug(`failed to load ${filePath} ${e.message}`);
        }
        lastError = e;
      }
    }
    _log(`injected env (${keysCount}) from ${shortPaths.join(",")} ${dim(`// tip: ${_getRandomTip()}`)}`);
  }
  if (lastError) {
    return { parsed: parsedAll, error: lastError };
  } else {
    return { parsed: parsedAll };
  }
}
function config(options) {
  if (_dotenvKey(options).length === 0) {
    return DotenvModule.configDotenv(options);
  }
  const vaultPath = _vaultPath(options);
  if (!vaultPath) {
    _warn(`you set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}`);
    return DotenvModule.configDotenv(options);
  }
  return DotenvModule._configVault(options);
}
function decrypt(encrypted, keyStr) {
  const key = Buffer.from(keyStr.slice(-64), "hex");
  let ciphertext = Buffer.from(encrypted, "base64");
  const nonce = ciphertext.subarray(0, 12);
  const authTag = ciphertext.subarray(-16);
  ciphertext = ciphertext.subarray(12, -16);
  try {
    const aesgcm = crypto$1.createDecipheriv("aes-256-gcm", key, nonce);
    aesgcm.setAuthTag(authTag);
    return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
  } catch (error) {
    const isRange = error instanceof RangeError;
    const invalidKeyLength = error.message === "Invalid key length";
    const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
    if (isRange || invalidKeyLength) {
      const err2 = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
      err2.code = "INVALID_DOTENV_KEY";
      throw err2;
    } else if (decryptionFailed) {
      const err2 = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
      err2.code = "DECRYPTION_FAILED";
      throw err2;
    } else {
      throw error;
    }
  }
}
function populate(processEnv, parsed, options = {}) {
  const debug = Boolean(options && options.debug);
  const override = Boolean(options && options.override);
  const populated = {};
  if (typeof parsed !== "object") {
    const err2 = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
    err2.code = "OBJECT_REQUIRED";
    throw err2;
  }
  for (const key of Object.keys(parsed)) {
    if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
      if (override === true) {
        processEnv[key] = parsed[key];
        populated[key] = parsed[key];
      }
      if (debug) {
        if (override === true) {
          _debug(`"${key}" is already defined and WAS overwritten`);
        } else {
          _debug(`"${key}" is already defined and was NOT overwritten`);
        }
      }
    } else {
      processEnv[key] = parsed[key];
      populated[key] = parsed[key];
    }
  }
  return populated;
}
const DotenvModule = {
  configDotenv,
  _configVault,
  _parseVault,
  config,
  decrypt,
  parse: parse$1,
  populate
};
main.exports.configDotenv = DotenvModule.configDotenv;
main.exports._configVault = DotenvModule._configVault;
main.exports._parseVault = DotenvModule._parseVault;
main.exports.config = DotenvModule.config;
main.exports.decrypt = DotenvModule.decrypt;
main.exports.parse = DotenvModule.parse;
main.exports.populate = DotenvModule.populate;
main.exports = DotenvModule;
var mainExports = main.exports;
const dotenv = /* @__PURE__ */ getDefaultExportFromCjs(mainExports);
const IPC_CHANNELS = {
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
function getKaarobarDataDir() {
  return path$1.join(app.getPath("appData"), "Kaarobar");
}
function getAssetsDir() {
  return path$1.join(getKaarobarDataDir(), "assets");
}
const appStore = new Store({
  name: "kaarobar-config",
  cwd: getKaarobarDataDir(),
  defaults: {
    language: "en",
    lastBusinessId: null,
    licenseBlob: null,
    setupComplete: false,
    autoBackupEnabled: false,
    autoBackupTime: "22:00",
    lastAutoBackupAt: null
  }
});
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
function normalizeAutoBackupTime(value) {
  if (value && TIME_RE.test(value)) return value;
  return "22:00";
}
function getAutoBackupSettings() {
  return {
    autoBackupEnabled: Boolean(appStore.get("autoBackupEnabled")),
    autoBackupTime: normalizeAutoBackupTime(appStore.get("autoBackupTime")),
    lastAutoBackupAt: appStore.get("lastAutoBackupAt") ?? null
  };
}
function setAutoBackupSettings(payload) {
  if (typeof payload.autoBackupEnabled === "boolean") {
    appStore.set("autoBackupEnabled", payload.autoBackupEnabled);
  }
  if (payload.autoBackupTime !== void 0) {
    appStore.set("autoBackupTime", normalizeAutoBackupTime(payload.autoBackupTime));
  }
  return getAutoBackupSettings();
}
function markAutoBackupCompleted(at = (/* @__PURE__ */ new Date()).toISOString()) {
  appStore.set("lastAutoBackupAt", at);
}
let db$1 = null;
const requireFromHere = createRequire(import.meta.url);
function isLinuxMusl() {
  var _a, _b, _c;
  if (process.platform !== "linux") return false;
  try {
    const report = (_b = (_a = process.report) == null ? void 0 : _a.getReport) == null ? void 0 : _b.call(_a);
    return !((_c = report == null ? void 0 : report.header) == null ? void 0 : _c.glibcVersionRuntime);
  } catch {
    return false;
  }
}
function resolveNativeBindingPath() {
  try {
    const packageJsonPath = requireFromHere.resolve("better-sqlite3/package.json");
    const packageDir = path$1.dirname(packageJsonPath);
    const prebuildTarget = `${isLinuxMusl() ? "linuxmusl" : process.platform}-${process.arch}`;
    const prebuildPath = path$1.join(packageDir, "prebuilds", `${prebuildTarget}.node`);
    if (fs$1.existsSync(prebuildPath)) return prebuildPath;
    const releaseBinding = path$1.join(packageDir, "build", "Release", "better_sqlite3.node");
    if (fs$1.existsSync(releaseBinding)) return releaseBinding;
    const debugBinding = path$1.join(packageDir, "build", "Debug", "better_sqlite3.node");
    if (fs$1.existsSync(debugBinding)) return debugBinding;
  } catch {
  }
  return void 0;
}
function getDbPath() {
  return path$1.join(getKaarobarDataDir(), "kaarobar.sqlite");
}
function dbExists() {
  return fs$1.existsSync(getDbPath());
}
function openDatabase() {
  if (db$1) return db$1;
  const filePath = getDbPath();
  fs$1.mkdirSync(path$1.dirname(filePath), { recursive: true });
  const nativeBinding = resolveNativeBindingPath();
  if (!nativeBinding) {
    throw new Error(
      "better-sqlite3 native build is missing (prebuilds/*.node or build/Release/better_sqlite3.node). Run: npm run rebuild:native"
    );
  }
  db$1 = new Database(filePath, { nativeBinding });
  db$1.pragma("journal_mode = WAL");
  db$1.pragma("foreign_keys = ON");
  return db$1;
}
function getDb() {
  if (!db$1) throw new Error("Database is not open. Call openDatabase() first.");
  return db$1;
}
function closeDatabase() {
  if (!db$1) return;
  db$1.close();
  db$1 = null;
}
function isDatabaseOpen() {
  return db$1 != null;
}
const APP_SECRET = "";
const LICENSE_SALT = "kaarobar-license-salt";
let cachedStableFingerprint = null;
let cachedLegacyFingerprint = null;
function getLegacyDeviceFingerprint() {
  if (cachedLegacyFingerprint) return cachedLegacyFingerprint;
  let macs = "";
  try {
    const nets = os$1.networkInterfaces();
    macs = Object.values(nets).flatMap((entries) => entries ?? []).filter((entry) => entry && !entry.internal && entry.mac && entry.mac !== "00:00:00:00:00:00").map((entry) => entry.mac).sort().join("|");
  } catch {
    macs = "";
  }
  const seed = [
    "kaarobar",
    os$1.hostname(),
    os$1.platform(),
    os$1.arch(),
    os$1.userInfo().username,
    macs
  ].join("::");
  cachedLegacyFingerprint = createHash("sha256").update(seed).digest("hex");
  return cachedLegacyFingerprint;
}
function hashStableId(stableId) {
  return createHash("sha256").update(`kaarobar::${stableId}`).digest("hex");
}
function readMacPlatformUuid() {
  var _a;
  try {
    const out2 = execFileSync("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], {
      encoding: "utf8",
      timeout: 5e3,
      windowsHide: true
    });
    const match = out2.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
    const id = (_a = match == null ? void 0 : match[1]) == null ? void 0 : _a.trim();
    return id || null;
  } catch {
    return null;
  }
}
function readWindowsMachineGuid() {
  var _a;
  try {
    const out2 = execFileSync(
      "reg",
      ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      { encoding: "utf8", timeout: 5e3, windowsHide: true }
    );
    const match = out2.match(/MachineGuid\s+REG_SZ\s+([0-9A-Fa-f-]+)/);
    const id = (_a = match == null ? void 0 : match[1]) == null ? void 0 : _a.trim();
    return id || null;
  } catch {
    return null;
  }
}
function readLinuxMachineId() {
  for (const file of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
    try {
      const id = fs$1.readFileSync(file, "utf8").trim();
      if (id) return id;
    } catch {
    }
  }
  return null;
}
function readOsMachineId() {
  switch (os$1.platform()) {
    case "darwin":
      return readMacPlatformUuid();
    case "win32":
      return readWindowsMachineGuid();
    default:
      return readLinuxMachineId();
  }
}
function getDurableDeviceIdPath() {
  const home = os$1.homedir();
  switch (os$1.platform()) {
    case "darwin":
      return path$1.join(home, "Library", "Application Support", "2ndHub", "Kaarobar", "device.id");
    case "win32": {
      const programData = process.env.PROGRAMDATA || "C:\\ProgramData";
      return path$1.join(programData, "2ndHub", "Kaarobar", "device.id");
    }
    default:
      return path$1.join(home, ".local", "share", "2ndHub", "Kaarobar", "device.id");
  }
}
function readDurableDeviceId() {
  try {
    const id = fs$1.readFileSync(getDurableDeviceIdPath(), "utf8").trim();
    return id || null;
  } catch {
    return null;
  }
}
function writeDurableDeviceId(id) {
  const filePath = getDurableDeviceIdPath();
  fs$1.mkdirSync(path$1.dirname(filePath), { recursive: true });
  fs$1.writeFileSync(filePath, id, { encoding: "utf8", mode: 384 });
}
function resolveStableDeviceId() {
  const fromOs = readOsMachineId();
  if (fromOs) return fromOs;
  const existing = readDurableDeviceId();
  if (existing) return existing;
  const created = randomUUID();
  try {
    writeDurableDeviceId(created);
    return created;
  } catch {
    if (os$1.platform() === "win32") {
      const fallback = path$1.join(
        process.env.LOCALAPPDATA || path$1.join(os$1.homedir(), "AppData", "Local"),
        "2ndHub",
        "Kaarobar",
        "device.id"
      );
      try {
        const existingLocal = fs$1.readFileSync(fallback, "utf8").trim();
        if (existingLocal) return existingLocal;
        fs$1.mkdirSync(path$1.dirname(fallback), { recursive: true });
        fs$1.writeFileSync(fallback, created, { encoding: "utf8", mode: 384 });
        return created;
      } catch {
        return created;
      }
    }
    return created;
  }
}
function getDeviceFingerprint() {
  if (cachedStableFingerprint) return cachedStableFingerprint;
  cachedStableFingerprint = hashStableId(resolveStableDeviceId());
  return cachedStableFingerprint;
}
function deriveKey$1(fingerprint) {
  return scryptSync(`${APP_SECRET}:${fingerprint}`, LICENSE_SALT, 32);
}
function encryptLicenseRecord(record) {
  const key = deriveKey$1(record.fingerprint);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(record), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
function decryptLicenseRecord(blob2, expectedFingerprint) {
  try {
    const payload = Buffer.from(blob2, "base64");
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const data = payload.subarray(28);
    const key = deriveKey$1(expectedFingerprint);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    const record = JSON.parse(decrypted);
    return record.fingerprint === expectedFingerprint ? record : null;
  } catch {
    return null;
  }
}
function decryptLicenseRecordFlexible(blob2) {
  const stable = getDeviceFingerprint();
  const withStable = decryptLicenseRecord(blob2, stable);
  if (withStable) return { record: withStable, migratedFromLegacy: false };
  const legacy = getLegacyDeviceFingerprint();
  if (legacy === stable) return null;
  const withLegacy = decryptLicenseRecord(blob2, legacy);
  if (!withLegacy) return null;
  return {
    record: {
      ...withLegacy,
      fingerprint: stable
    },
    migratedFromLegacy: true
  };
}
function isLicenseExpired(record, now = /* @__PURE__ */ new Date()) {
  if (!record.expiresAt) return false;
  return new Date(record.expiresAt).getTime() < now.getTime();
}
let fingerprintRebindInFlight = null;
const reboundLicenseKeys = /* @__PURE__ */ new Set();
function getSupabaseConfig() {
  return null;
}
function writeLicenseToStore(record) {
  const blob2 = encryptLicenseRecord(record);
  appStore.set("licenseBlob", blob2);
  return blob2;
}
function writeLicenseToDb(record, blob2) {
  if (!isDatabaseOpen()) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  getDb().prepare(
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
    record.licenseKey,
    record.expiresAt,
    record.issuedTo,
    record.fingerprint,
    record.activatedAt,
    now,
    blob2
  );
}
function persistLocalLicense(record) {
  const blob2 = writeLicenseToStore(record);
  writeLicenseToDb(record, blob2);
}
function scheduleFingerprintServerRebind(record) {
  if (record.mode === "dev") return;
  if (!record.licenseKey || reboundLicenseKeys.has(record.licenseKey)) return;
  if (fingerprintRebindInFlight) return;
  fingerprintRebindInFlight = activateLicense(record.licenseKey).then((result) => {
    if (result.ok) {
      reboundLicenseKeys.add(record.licenseKey);
      return;
    }
    if (result.error === "device_limit_reached" || result.error === "offline" || result.error === "network_error") {
      return;
    }
  }).catch(() => {
  }).finally(() => {
    fingerprintRebindInFlight = null;
  });
}
function adoptDecryptedLicense(result) {
  if (!result) return null;
  if (result.migratedFromLegacy) {
    persistLocalLicense(result.record);
    scheduleFingerprintServerRebind(result.record);
  }
  return result.record;
}
function flushLicenseToDatabase() {
  if (!isDatabaseOpen()) return;
  const record = readLocalLicense();
  if (!record) return;
  const blob2 = appStore.get("licenseBlob") || encryptLicenseRecord(record);
  writeLicenseToDb(record, blob2);
}
function readLicenseRow() {
  if (!isDatabaseOpen()) return null;
  try {
    const row = getDb().prepare(
      `SELECT license_key, expires_at, issued_to, fingerprint, activated_at, blob
         FROM app_license WHERE id = 'local'`
    ).get();
    return row ?? null;
  } catch {
    return null;
  }
}
function recordFromStoreBlob() {
  const blob2 = appStore.get("licenseBlob");
  if (!blob2) return null;
  return adoptDecryptedLicense(decryptLicenseRecordFlexible(blob2));
}
function recordFromRow(row) {
  const decrypted = adoptDecryptedLicense(decryptLicenseRecordFlexible(row.blob));
  if (decrypted) return decrypted;
  return {
    licenseKey: row.license_key,
    fingerprint: row.fingerprint,
    issuedTo: row.issued_to || "Licensed Customer",
    expiresAt: row.expires_at,
    maxDevices: 1,
    activatedAt: row.activated_at,
    lastVerifiedAt: row.activated_at,
    mode: "supabase"
  };
}
function readLocalLicense() {
  const row = readLicenseRow();
  if (row) return recordFromRow(row);
  const fromStore = recordFromStoreBlob();
  if (fromStore && isDatabaseOpen()) {
    persistLocalLicense(fromStore);
  }
  return fromStore;
}
function readValidLocalLicense() {
  const status = getLicenseStatus();
  return status.status === "valid" ? status.record : null;
}
function getLicenseStatus() {
  const record = readLocalLicense();
  if (!(record == null ? void 0 : record.licenseKey)) return { status: "none" };
  if (isLicenseExpired(record)) return { status: "expired", record };
  return { status: "valid", record };
}
function mapRpcError(error) {
  const known = ["invalid_key", "revoked", "expired", "device_limit_reached"];
  const matched = known.find((code) => code === error);
  if (!matched) return { ok: false, error: "unknown", message: `Activation failed: ${error}` };
  const messageMap = {
    invalid_key: "This license key is not valid.",
    revoked: "This license has been revoked. Contact support.",
    expired: "This license has expired.",
    device_limit_reached: "This license has reached its device limit."
  };
  return { ok: false, error: matched, message: messageMap[matched] };
}
async function activateLicense(licenseKey) {
  const key = licenseKey.trim();
  const fingerprint = getDeviceFingerprint();
  const supabase = getSupabaseConfig();
  if (!supabase) {
    if (!app.isPackaged && key === "KAAROBAR-DEV-LOCAL") {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const record = {
        licenseKey: key,
        fingerprint,
        issuedTo: "Local Development",
        expiresAt: null,
        maxDevices: 1,
        activatedAt: now,
        lastVerifiedAt: now,
        mode: "dev"
      };
      persistLocalLicense(record);
      return { ok: true, issuedTo: record.issuedTo, expiresAt: null, maxDevices: 1, mode: "dev" };
    }
    return {
      ok: false,
      error: "network_error",
      message: "License server is not configured. Set KAAROBAR_SUPABASE_URL and KAAROBAR_SUPABASE_ANON_KEY, or use KAAROBAR-DEV-LOCAL in development."
    };
  }
  try {
    const rpcUrl = `${supabase.url.replace(/\/$/, "")}/rest/v1/rpc/validate_and_activate_license`;
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        apikey: supabase.anonKey,
        Authorization: `Bearer ${supabase.anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_key: key,
        p_fingerprint: fingerprint
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: "network_error",
        message: errorText || `License server request failed (${response.status})`
      };
    }
    const result = await response.json();
    if (!(result == null ? void 0 : result.ok)) return mapRpcError((result == null ? void 0 : result.error) ?? "unknown");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const record = {
      licenseKey: key,
      fingerprint,
      issuedTo: result.issuedTo ?? "Licensed Customer",
      expiresAt: result.expiresAt ?? null,
      maxDevices: result.maxDevices ?? 1,
      activatedAt: now,
      lastVerifiedAt: now,
      mode: "supabase"
    };
    persistLocalLicense(record);
    reboundLicenseKeys.add(key);
    return {
      ok: true,
      issuedTo: record.issuedTo,
      expiresAt: record.expiresAt,
      maxDevices: record.maxDevices,
      mode: "supabase"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    const offline = /fetch|network|ENOTFOUND|ECONNREFUSED/i.test(message);
    return {
      ok: false,
      error: offline ? "offline" : "network_error",
      message: offline ? "No internet connection. License activation requires internet once." : message
    };
  }
}
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
const rnds8 = new Uint8Array(16);
function rng() {
  return crypto.getRandomValues(rnds8);
}
function v4(options, buf, offset) {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return _v4(options);
}
function _v4(options, buf, offset) {
  var _a;
  options = options || {};
  const rnds = options.random ?? ((_a = options.rng) == null ? void 0 : _a.call(options)) ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  return unsafeStringify(rnds);
}
const APP_LANGUAGES = ["en", "ur", "de", "pt", "es", "fr", "ar"];
const RTL = /* @__PURE__ */ new Set(["ur", "ar"]);
const BCP47 = {
  en: "en-US",
  ur: "ur-PK",
  de: "de-DE",
  pt: "pt-BR",
  es: "es-ES",
  fr: "fr-FR",
  ar: "ar-SA"
};
function isAppLanguage(value) {
  return APP_LANGUAGES.includes(value);
}
function normalizeAppLanguage(value) {
  const language = value == null ? void 0 : value.trim().toLowerCase().split(/[-_]/)[0];
  return language && isAppLanguage(language) ? language : "en";
}
function isRtlLanguage(lang) {
  return RTL.has(lang);
}
function toBcp47(lang) {
  return BCP47[lang];
}
const SCHEMA_SQL = `
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
`;
const MIGRATIONS = [
  {
    name: "001_initial_schema",
    up: (db2) => {
      db2.exec(SCHEMA_SQL);
    }
  },
  {
    name: "002_refunds_audit_updates",
    up: (db2) => {
      const hasActivity = db2.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'activity_log'`).get();
      if (!hasActivity) {
        db2.pragma("foreign_keys = OFF");
        db2.exec(`
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
        `);
        db2.pragma("foreign_keys = ON");
        db2.exec(`
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
        `);
      }
      const saleItemCols = db2.prepare(`PRAGMA table_info(sale_items)`).all();
      if (!saleItemCols.some((c2) => c2.name === "refunded_qty")) {
        db2.exec(`ALTER TABLE sale_items ADD COLUMN refunded_qty REAL NOT NULL DEFAULT 0`);
      }
    }
  },
  {
    name: "003_product_image",
    up: (db2) => {
      const cols = db2.prepare(`PRAGMA table_info(products)`).all();
      if (!cols.some((c2) => c2.name === "image_path")) {
        db2.exec(`ALTER TABLE products ADD COLUMN image_path TEXT`);
      }
    }
  },
  {
    name: "004_business_socials",
    up: (db2) => {
      const cols = db2.prepare(`PRAGMA table_info(businesses)`).all();
      const names = new Set(cols.map((c2) => c2.name));
      for (const col of [
        "social_whatsapp",
        "social_instagram",
        "social_facebook",
        "social_tiktok",
        "social_website"
      ]) {
        if (!names.has(col)) db2.exec(`ALTER TABLE businesses ADD COLUMN ${col} TEXT`);
      }
    }
  },
  {
    name: "005_supplier_products",
    up: (db2) => {
      db2.exec(`
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
    up: (db2) => {
      db2.exec(`
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
    up: (db2) => {
      const cols = db2.prepare(`PRAGMA table_info(users)`).all();
      if (!cols.some((c2) => c2.name === "image_path")) {
        db2.exec(`ALTER TABLE users ADD COLUMN image_path TEXT`);
      }
    }
  },
  {
    name: "008_analytics_indexes",
    up: (db2) => {
      db2.exec(`
        CREATE INDEX IF NOT EXISTS idx_sales_business_created_status ON sales(business_id, created_at, status);
        CREATE INDEX IF NOT EXISTS idx_customers_business_balance ON customers(business_id, is_active, current_balance);
        CREATE INDEX IF NOT EXISTS idx_products_business_active_stock ON products(business_id, is_active, stock_qty);
        ANALYZE;
      `);
    }
  },
  {
    name: "009_business_nature_pos",
    up: (db2) => {
      const bizCols = db2.prepare(`PRAGMA table_info(businesses)`).all();
      if (!bizCols.some((c2) => c2.name === "business_nature")) {
        db2.exec(
          `ALTER TABLE businesses ADD COLUMN business_nature TEXT NOT NULL DEFAULT 'retail'`
        );
      }
      const productCols = db2.prepare(`PRAGMA table_info(products)`).all();
      if (!productCols.some((c2) => c2.name === "kind")) {
        db2.exec(`ALTER TABLE products ADD COLUMN kind TEXT NOT NULL DEFAULT 'item'`);
      }
      if (!productCols.some((c2) => c2.name === "tracks_stock")) {
        db2.exec(`ALTER TABLE products ADD COLUMN tracks_stock INTEGER NOT NULL DEFAULT 1`);
      }
      const saleCols = db2.prepare(`PRAGMA table_info(sales)`).all();
      if (!saleCols.some((c2) => c2.name === "served_by_user_id")) {
        db2.exec(`ALTER TABLE sales ADD COLUMN served_by_user_id TEXT`);
      }
      if (!saleCols.some((c2) => c2.name === "service_mode")) {
        db2.exec(`ALTER TABLE sales ADD COLUMN service_mode TEXT`);
      }
      if (!saleCols.some((c2) => c2.name === "table_id")) {
        db2.exec(`ALTER TABLE sales ADD COLUMN table_id TEXT`);
      }
      db2.exec(`
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
    up: (db2) => {
      const hasPayments = db2.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'payments'`).get();
      if (!hasPayments) return;
      db2.pragma("foreign_keys = OFF");
      db2.exec(`
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
      `);
      db2.pragma("foreign_keys = ON");
    }
  },
  {
    name: "011_receipt_messages",
    up: (db2) => {
      const cols = db2.prepare(`PRAGMA table_info(businesses)`).all();
      const names = new Set(cols.map((c2) => c2.name));
      if (!names.has("receipt_header")) {
        db2.exec(`ALTER TABLE businesses ADD COLUMN receipt_header TEXT`);
      }
      if (!names.has("receipt_footer")) {
        db2.exec(`ALTER TABLE businesses ADD COLUMN receipt_footer TEXT`);
      }
      db2.exec(`
        UPDATE businesses
        SET receipt_footer = (
          SELECT value FROM settings
          WHERE settings.business_id = businesses.id AND settings.key = 'receipt_footer'
          LIMIT 1
        )
        WHERE receipt_footer IS NULL OR trim(receipt_footer) = ''
      `);
      db2.exec(`
        UPDATE businesses
        SET receipt_footer = 'Thank you for shopping with us'
        WHERE receipt_footer IS NULL OR trim(receipt_footer) = ''
      `);
    }
  },
  {
    name: "012_kot_split_rider_happy_hour",
    up: (db2) => {
      const productCols = db2.prepare(`PRAGMA table_info(products)`).all();
      if (!productCols.some((c2) => c2.name === "kitchen_station")) {
        db2.exec(`ALTER TABLE products ADD COLUMN kitchen_station TEXT NOT NULL DEFAULT 'main'`);
      }
      const saleCols = db2.prepare(`PRAGMA table_info(sales)`).all();
      const saleNames = new Set(saleCols.map((c2) => c2.name));
      if (!saleNames.has("rider_user_id")) {
        db2.exec(`ALTER TABLE sales ADD COLUMN rider_user_id TEXT`);
      }
      if (!saleNames.has("delivery_status")) {
        db2.exec(`ALTER TABLE sales ADD COLUMN delivery_status TEXT`);
      }
      if (!saleNames.has("delivery_notes")) {
        db2.exec(`ALTER TABLE sales ADD COLUMN delivery_notes TEXT`);
      }
      const ticketCols = db2.prepare(`PRAGMA table_info(pos_tickets)`).all();
      const ticketNames = new Set(ticketCols.map((c2) => c2.name));
      if (!ticketNames.has("rider_user_id")) {
        db2.exec(`ALTER TABLE pos_tickets ADD COLUMN rider_user_id TEXT`);
      }
      if (!ticketNames.has("delivery_status")) {
        db2.exec(`ALTER TABLE pos_tickets ADD COLUMN delivery_status TEXT`);
      }
      if (!ticketNames.has("delivery_notes")) {
        db2.exec(`ALTER TABLE pos_tickets ADD COLUMN delivery_notes TEXT`);
      }
      const itemCols = db2.prepare(`PRAGMA table_info(pos_ticket_items)`).all();
      const itemNames = new Set(itemCols.map((c2) => c2.name));
      if (!itemNames.has("seat_no")) {
        db2.exec(`ALTER TABLE pos_ticket_items ADD COLUMN seat_no INTEGER`);
      }
      if (!itemNames.has("kitchen_status")) {
        db2.exec(
          `ALTER TABLE pos_ticket_items ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'held'`
        );
      }
      if (!itemNames.has("fired_at")) {
        db2.exec(`ALTER TABLE pos_ticket_items ADD COLUMN fired_at TEXT`);
      }
      if (!itemNames.has("bumped_at")) {
        db2.exec(`ALTER TABLE pos_ticket_items ADD COLUMN bumped_at TEXT`);
      }
      if (!itemNames.has("billed_qty")) {
        db2.exec(`ALTER TABLE pos_ticket_items ADD COLUMN billed_qty REAL NOT NULL DEFAULT 0`);
      }
      if (!itemNames.has("price_rule_id")) {
        db2.exec(`ALTER TABLE pos_ticket_items ADD COLUMN price_rule_id TEXT`);
      }
      const saleItemCols = db2.prepare(`PRAGMA table_info(sale_items)`).all();
      if (!saleItemCols.some((c2) => c2.name === "price_rule_id")) {
        db2.exec(`ALTER TABLE sale_items ADD COLUMN price_rule_id TEXT`);
      }
      db2.exec(`
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
function runMigrations(db2) {
  db2.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);
  const hasMigration = db2.prepare("SELECT name FROM schema_migrations WHERE name = ?");
  const insertMigration = db2.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  for (const migration of MIGRATIONS) {
    const applied = hasMigration.get(migration.name);
    if (applied) continue;
    const run = db2.transaction(() => {
      migration.up(db2);
      insertMigration.run(migration.name, (/* @__PURE__ */ new Date()).toISOString());
    });
    run();
  }
}
var utf8$6 = {};
var utils$s = {};
var support$4 = {};
var readable = { exports: {} };
var processNextickArgs = { exports: {} };
var hasRequiredProcessNextickArgs;
function requireProcessNextickArgs() {
  if (hasRequiredProcessNextickArgs) return processNextickArgs.exports;
  hasRequiredProcessNextickArgs = 1;
  if (typeof process === "undefined" || !process.version || process.version.indexOf("v0.") === 0 || process.version.indexOf("v1.") === 0 && process.version.indexOf("v1.8.") !== 0) {
    processNextickArgs.exports = { nextTick };
  } else {
    processNextickArgs.exports = process;
  }
  function nextTick(fn, arg1, arg2, arg3) {
    if (typeof fn !== "function") {
      throw new TypeError('"callback" argument must be a function');
    }
    var len = arguments.length;
    var args, i;
    switch (len) {
      case 0:
      case 1:
        return process.nextTick(fn);
      case 2:
        return process.nextTick(function afterTickOne() {
          fn.call(null, arg1);
        });
      case 3:
        return process.nextTick(function afterTickTwo() {
          fn.call(null, arg1, arg2);
        });
      case 4:
        return process.nextTick(function afterTickThree() {
          fn.call(null, arg1, arg2, arg3);
        });
      default:
        args = new Array(len - 1);
        i = 0;
        while (i < args.length) {
          args[i++] = arguments[i];
        }
        return process.nextTick(function afterTick() {
          fn.apply(null, args);
        });
    }
  }
  return processNextickArgs.exports;
}
var isarray;
var hasRequiredIsarray;
function requireIsarray() {
  if (hasRequiredIsarray) return isarray;
  hasRequiredIsarray = 1;
  var toString3 = {}.toString;
  isarray = Array.isArray || function(arr) {
    return toString3.call(arr) == "[object Array]";
  };
  return isarray;
}
var stream;
var hasRequiredStream;
function requireStream() {
  if (hasRequiredStream) return stream;
  hasRequiredStream = 1;
  stream = require$$1$1;
  return stream;
}
var safeBuffer = { exports: {} };
var hasRequiredSafeBuffer;
function requireSafeBuffer() {
  if (hasRequiredSafeBuffer) return safeBuffer.exports;
  hasRequiredSafeBuffer = 1;
  (function(module, exports) {
    var buffer = require$$0$1;
    var Buffer2 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer2.from && Buffer2.alloc && Buffer2.allocUnsafe && Buffer2.allocUnsafeSlow) {
      module.exports = buffer;
    } else {
      copyProps(buffer, exports);
      exports.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer2(arg, encodingOrOffset, length);
    }
    copyProps(Buffer2, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer2(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer2(size);
      if (fill !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer2(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  })(safeBuffer, safeBuffer.exports);
  return safeBuffer.exports;
}
var util$5 = {};
var hasRequiredUtil;
function requireUtil() {
  if (hasRequiredUtil) return util$5;
  hasRequiredUtil = 1;
  function isArray(arg) {
    if (Array.isArray) {
      return Array.isArray(arg);
    }
    return objectToString(arg) === "[object Array]";
  }
  util$5.isArray = isArray;
  function isBoolean(arg) {
    return typeof arg === "boolean";
  }
  util$5.isBoolean = isBoolean;
  function isNull(arg) {
    return arg === null;
  }
  util$5.isNull = isNull;
  function isNullOrUndefined(arg) {
    return arg == null;
  }
  util$5.isNullOrUndefined = isNullOrUndefined;
  function isNumber(arg) {
    return typeof arg === "number";
  }
  util$5.isNumber = isNumber;
  function isString(arg) {
    return typeof arg === "string";
  }
  util$5.isString = isString;
  function isSymbol(arg) {
    return typeof arg === "symbol";
  }
  util$5.isSymbol = isSymbol;
  function isUndefined(arg) {
    return arg === void 0;
  }
  util$5.isUndefined = isUndefined;
  function isRegExp2(re) {
    return objectToString(re) === "[object RegExp]";
  }
  util$5.isRegExp = isRegExp2;
  function isObject(arg) {
    return typeof arg === "object" && arg !== null;
  }
  util$5.isObject = isObject;
  function isDate(d) {
    return objectToString(d) === "[object Date]";
  }
  util$5.isDate = isDate;
  function isError(e) {
    return objectToString(e) === "[object Error]" || e instanceof Error;
  }
  util$5.isError = isError;
  function isFunction(arg) {
    return typeof arg === "function";
  }
  util$5.isFunction = isFunction;
  function isPrimitive(arg) {
    return arg === null || typeof arg === "boolean" || typeof arg === "number" || typeof arg === "string" || typeof arg === "symbol" || // ES6 symbol
    typeof arg === "undefined";
  }
  util$5.isPrimitive = isPrimitive;
  util$5.isBuffer = Buffer.isBuffer;
  function objectToString(o) {
    return Object.prototype.toString.call(o);
  }
  return util$5;
}
var inherits = { exports: {} };
var inherits_browser = { exports: {} };
var hasRequiredInherits_browser;
function requireInherits_browser() {
  if (hasRequiredInherits_browser) return inherits_browser.exports;
  hasRequiredInherits_browser = 1;
  if (typeof Object.create === "function") {
    inherits_browser.exports = function inherits2(ctor, superCtor) {
      if (superCtor) {
        ctor.super_ = superCtor;
        ctor.prototype = Object.create(superCtor.prototype, {
          constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
          }
        });
      }
    };
  } else {
    inherits_browser.exports = function inherits2(ctor, superCtor) {
      if (superCtor) {
        ctor.super_ = superCtor;
        var TempCtor = function() {
        };
        TempCtor.prototype = superCtor.prototype;
        ctor.prototype = new TempCtor();
        ctor.prototype.constructor = ctor;
      }
    };
  }
  return inherits_browser.exports;
}
var hasRequiredInherits;
function requireInherits() {
  if (hasRequiredInherits) return inherits.exports;
  hasRequiredInherits = 1;
  try {
    var util2 = require("util");
    if (typeof util2.inherits !== "function") throw "";
    inherits.exports = util2.inherits;
  } catch (e) {
    inherits.exports = requireInherits_browser();
  }
  return inherits.exports;
}
var BufferList = { exports: {} };
var hasRequiredBufferList;
function requireBufferList() {
  if (hasRequiredBufferList) return BufferList.exports;
  hasRequiredBufferList = 1;
  (function(module) {
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var Buffer2 = requireSafeBuffer().Buffer;
    var util2 = require$$0$2;
    function copyBuffer(src, target, offset) {
      src.copy(target, offset);
    }
    module.exports = function() {
      function BufferList2() {
        _classCallCheck(this, BufferList2);
        this.head = null;
        this.tail = null;
        this.length = 0;
      }
      BufferList2.prototype.push = function push(v) {
        var entry = { data: v, next: null };
        if (this.length > 0) this.tail.next = entry;
        else this.head = entry;
        this.tail = entry;
        ++this.length;
      };
      BufferList2.prototype.unshift = function unshift(v) {
        var entry = { data: v, next: this.head };
        if (this.length === 0) this.tail = entry;
        this.head = entry;
        ++this.length;
      };
      BufferList2.prototype.shift = function shift() {
        if (this.length === 0) return;
        var ret = this.head.data;
        if (this.length === 1) this.head = this.tail = null;
        else this.head = this.head.next;
        --this.length;
        return ret;
      };
      BufferList2.prototype.clear = function clear() {
        this.head = this.tail = null;
        this.length = 0;
      };
      BufferList2.prototype.join = function join(s) {
        if (this.length === 0) return "";
        var p = this.head;
        var ret = "" + p.data;
        while (p = p.next) {
          ret += s + p.data;
        }
        return ret;
      };
      BufferList2.prototype.concat = function concat2(n) {
        if (this.length === 0) return Buffer2.alloc(0);
        var ret = Buffer2.allocUnsafe(n >>> 0);
        var p = this.head;
        var i = 0;
        while (p) {
          copyBuffer(p.data, ret, i);
          i += p.data.length;
          p = p.next;
        }
        return ret;
      };
      return BufferList2;
    }();
    if (util2 && util2.inspect && util2.inspect.custom) {
      module.exports.prototype[util2.inspect.custom] = function() {
        var obj = util2.inspect({ length: this.length });
        return this.constructor.name + " " + obj;
      };
    }
  })(BufferList);
  return BufferList.exports;
}
var destroy_1;
var hasRequiredDestroy;
function requireDestroy() {
  if (hasRequiredDestroy) return destroy_1;
  hasRequiredDestroy = 1;
  var pna = requireProcessNextickArgs();
  function destroy(err2, cb) {
    var _this = this;
    var readableDestroyed = this._readableState && this._readableState.destroyed;
    var writableDestroyed = this._writableState && this._writableState.destroyed;
    if (readableDestroyed || writableDestroyed) {
      if (cb) {
        cb(err2);
      } else if (err2) {
        if (!this._writableState) {
          pna.nextTick(emitErrorNT, this, err2);
        } else if (!this._writableState.errorEmitted) {
          this._writableState.errorEmitted = true;
          pna.nextTick(emitErrorNT, this, err2);
        }
      }
      return this;
    }
    if (this._readableState) {
      this._readableState.destroyed = true;
    }
    if (this._writableState) {
      this._writableState.destroyed = true;
    }
    this._destroy(err2 || null, function(err3) {
      if (!cb && err3) {
        if (!_this._writableState) {
          pna.nextTick(emitErrorNT, _this, err3);
        } else if (!_this._writableState.errorEmitted) {
          _this._writableState.errorEmitted = true;
          pna.nextTick(emitErrorNT, _this, err3);
        }
      } else if (cb) {
        cb(err3);
      }
    });
    return this;
  }
  function undestroy() {
    if (this._readableState) {
      this._readableState.destroyed = false;
      this._readableState.reading = false;
      this._readableState.ended = false;
      this._readableState.endEmitted = false;
    }
    if (this._writableState) {
      this._writableState.destroyed = false;
      this._writableState.ended = false;
      this._writableState.ending = false;
      this._writableState.finalCalled = false;
      this._writableState.prefinished = false;
      this._writableState.finished = false;
      this._writableState.errorEmitted = false;
    }
  }
  function emitErrorNT(self2, err2) {
    self2.emit("error", err2);
  }
  destroy_1 = {
    destroy,
    undestroy
  };
  return destroy_1;
}
var node;
var hasRequiredNode;
function requireNode() {
  if (hasRequiredNode) return node;
  hasRequiredNode = 1;
  node = require$$0$2.deprecate;
  return node;
}
var _stream_writable;
var hasRequired_stream_writable;
function require_stream_writable() {
  if (hasRequired_stream_writable) return _stream_writable;
  hasRequired_stream_writable = 1;
  var pna = requireProcessNextickArgs();
  _stream_writable = Writable;
  function CorkedRequest(state) {
    var _this = this;
    this.next = null;
    this.entry = null;
    this.finish = function() {
      onCorkedFinish(_this, state);
    };
  }
  var asyncWrite = !process.browser && ["v0.10", "v0.9."].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
  var Duplex;
  Writable.WritableState = WritableState;
  var util2 = Object.create(requireUtil());
  util2.inherits = requireInherits();
  var internalUtil = {
    deprecate: requireNode()
  };
  var Stream2 = requireStream();
  var Buffer2 = requireSafeBuffer().Buffer;
  var OurUint8Array = (typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
  };
  function _uint8ArrayToBuffer(chunk) {
    return Buffer2.from(chunk);
  }
  function _isUint8Array(obj) {
    return Buffer2.isBuffer(obj) || obj instanceof OurUint8Array;
  }
  var destroyImpl = requireDestroy();
  util2.inherits(Writable, Stream2);
  function nop() {
  }
  function WritableState(options, stream2) {
    Duplex = Duplex || require_stream_duplex();
    options = options || {};
    var isDuplex = stream2 instanceof Duplex;
    this.objectMode = !!options.objectMode;
    if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;
    var hwm = options.highWaterMark;
    var writableHwm = options.writableHighWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16 * 1024;
    if (hwm || hwm === 0) this.highWaterMark = hwm;
    else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;
    else this.highWaterMark = defaultHwm;
    this.highWaterMark = Math.floor(this.highWaterMark);
    this.finalCalled = false;
    this.needDrain = false;
    this.ending = false;
    this.ended = false;
    this.finished = false;
    this.destroyed = false;
    var noDecode = options.decodeStrings === false;
    this.decodeStrings = !noDecode;
    this.defaultEncoding = options.defaultEncoding || "utf8";
    this.length = 0;
    this.writing = false;
    this.corked = 0;
    this.sync = true;
    this.bufferProcessing = false;
    this.onwrite = function(er) {
      onwrite(stream2, er);
    };
    this.writecb = null;
    this.writelen = 0;
    this.bufferedRequest = null;
    this.lastBufferedRequest = null;
    this.pendingcb = 0;
    this.prefinished = false;
    this.errorEmitted = false;
    this.bufferedRequestCount = 0;
    this.corkedRequestsFree = new CorkedRequest(this);
  }
  WritableState.prototype.getBuffer = function getBuffer() {
    var current = this.bufferedRequest;
    var out2 = [];
    while (current) {
      out2.push(current);
      current = current.next;
    }
    return out2;
  };
  (function() {
    try {
      Object.defineProperty(WritableState.prototype, "buffer", {
        get: internalUtil.deprecate(function() {
          return this.getBuffer();
        }, "_writableState.buffer is deprecated. Use _writableState.getBuffer instead.", "DEP0003")
      });
    } catch (_) {
    }
  })();
  var realHasInstance;
  if (typeof Symbol === "function" && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === "function") {
    realHasInstance = Function.prototype[Symbol.hasInstance];
    Object.defineProperty(Writable, Symbol.hasInstance, {
      value: function(object2) {
        if (realHasInstance.call(this, object2)) return true;
        if (this !== Writable) return false;
        return object2 && object2._writableState instanceof WritableState;
      }
    });
  } else {
    realHasInstance = function(object2) {
      return object2 instanceof this;
    };
  }
  function Writable(options) {
    Duplex = Duplex || require_stream_duplex();
    if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
      return new Writable(options);
    }
    this._writableState = new WritableState(options, this);
    this.writable = true;
    if (options) {
      if (typeof options.write === "function") this._write = options.write;
      if (typeof options.writev === "function") this._writev = options.writev;
      if (typeof options.destroy === "function") this._destroy = options.destroy;
      if (typeof options.final === "function") this._final = options.final;
    }
    Stream2.call(this);
  }
  Writable.prototype.pipe = function() {
    this.emit("error", new Error("Cannot pipe, not readable"));
  };
  function writeAfterEnd(stream2, cb) {
    var er = new Error("write after end");
    stream2.emit("error", er);
    pna.nextTick(cb, er);
  }
  function validChunk(stream2, state, chunk, cb) {
    var valid = true;
    var er = false;
    if (chunk === null) {
      er = new TypeError("May not write null values to stream");
    } else if (typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) {
      er = new TypeError("Invalid non-string/buffer chunk");
    }
    if (er) {
      stream2.emit("error", er);
      pna.nextTick(cb, er);
      valid = false;
    }
    return valid;
  }
  Writable.prototype.write = function(chunk, encoding, cb) {
    var state = this._writableState;
    var ret = false;
    var isBuf = !state.objectMode && _isUint8Array(chunk);
    if (isBuf && !Buffer2.isBuffer(chunk)) {
      chunk = _uint8ArrayToBuffer(chunk);
    }
    if (typeof encoding === "function") {
      cb = encoding;
      encoding = null;
    }
    if (isBuf) encoding = "buffer";
    else if (!encoding) encoding = state.defaultEncoding;
    if (typeof cb !== "function") cb = nop;
    if (state.ended) writeAfterEnd(this, cb);
    else if (isBuf || validChunk(this, state, chunk, cb)) {
      state.pendingcb++;
      ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
    }
    return ret;
  };
  Writable.prototype.cork = function() {
    var state = this._writableState;
    state.corked++;
  };
  Writable.prototype.uncork = function() {
    var state = this._writableState;
    if (state.corked) {
      state.corked--;
      if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
    }
  };
  Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
    if (typeof encoding === "string") encoding = encoding.toLowerCase();
    if (!(["hex", "utf8", "utf-8", "ascii", "binary", "base64", "ucs2", "ucs-2", "utf16le", "utf-16le", "raw"].indexOf((encoding + "").toLowerCase()) > -1)) throw new TypeError("Unknown encoding: " + encoding);
    this._writableState.defaultEncoding = encoding;
    return this;
  };
  function decodeChunk(state, chunk, encoding) {
    if (!state.objectMode && state.decodeStrings !== false && typeof chunk === "string") {
      chunk = Buffer2.from(chunk, encoding);
    }
    return chunk;
  }
  Object.defineProperty(Writable.prototype, "writableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function() {
      return this._writableState.highWaterMark;
    }
  });
  function writeOrBuffer(stream2, state, isBuf, chunk, encoding, cb) {
    if (!isBuf) {
      var newChunk = decodeChunk(state, chunk, encoding);
      if (chunk !== newChunk) {
        isBuf = true;
        encoding = "buffer";
        chunk = newChunk;
      }
    }
    var len = state.objectMode ? 1 : chunk.length;
    state.length += len;
    var ret = state.length < state.highWaterMark;
    if (!ret) state.needDrain = true;
    if (state.writing || state.corked) {
      var last = state.lastBufferedRequest;
      state.lastBufferedRequest = {
        chunk,
        encoding,
        isBuf,
        callback: cb,
        next: null
      };
      if (last) {
        last.next = state.lastBufferedRequest;
      } else {
        state.bufferedRequest = state.lastBufferedRequest;
      }
      state.bufferedRequestCount += 1;
    } else {
      doWrite(stream2, state, false, len, chunk, encoding, cb);
    }
    return ret;
  }
  function doWrite(stream2, state, writev, len, chunk, encoding, cb) {
    state.writelen = len;
    state.writecb = cb;
    state.writing = true;
    state.sync = true;
    if (writev) stream2._writev(chunk, state.onwrite);
    else stream2._write(chunk, encoding, state.onwrite);
    state.sync = false;
  }
  function onwriteError(stream2, state, sync, er, cb) {
    --state.pendingcb;
    if (sync) {
      pna.nextTick(cb, er);
      pna.nextTick(finishMaybe, stream2, state);
      stream2._writableState.errorEmitted = true;
      stream2.emit("error", er);
    } else {
      cb(er);
      stream2._writableState.errorEmitted = true;
      stream2.emit("error", er);
      finishMaybe(stream2, state);
    }
  }
  function onwriteStateUpdate(state) {
    state.writing = false;
    state.writecb = null;
    state.length -= state.writelen;
    state.writelen = 0;
  }
  function onwrite(stream2, er) {
    var state = stream2._writableState;
    var sync = state.sync;
    var cb = state.writecb;
    onwriteStateUpdate(state);
    if (er) onwriteError(stream2, state, sync, er, cb);
    else {
      var finished = needFinish(state);
      if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
        clearBuffer(stream2, state);
      }
      if (sync) {
        asyncWrite(afterWrite, stream2, state, finished, cb);
      } else {
        afterWrite(stream2, state, finished, cb);
      }
    }
  }
  function afterWrite(stream2, state, finished, cb) {
    if (!finished) onwriteDrain(stream2, state);
    state.pendingcb--;
    cb();
    finishMaybe(stream2, state);
  }
  function onwriteDrain(stream2, state) {
    if (state.length === 0 && state.needDrain) {
      state.needDrain = false;
      stream2.emit("drain");
    }
  }
  function clearBuffer(stream2, state) {
    state.bufferProcessing = true;
    var entry = state.bufferedRequest;
    if (stream2._writev && entry && entry.next) {
      var l = state.bufferedRequestCount;
      var buffer = new Array(l);
      var holder = state.corkedRequestsFree;
      holder.entry = entry;
      var count = 0;
      var allBuffers = true;
      while (entry) {
        buffer[count] = entry;
        if (!entry.isBuf) allBuffers = false;
        entry = entry.next;
        count += 1;
      }
      buffer.allBuffers = allBuffers;
      doWrite(stream2, state, true, state.length, buffer, "", holder.finish);
      state.pendingcb++;
      state.lastBufferedRequest = null;
      if (holder.next) {
        state.corkedRequestsFree = holder.next;
        holder.next = null;
      } else {
        state.corkedRequestsFree = new CorkedRequest(state);
      }
      state.bufferedRequestCount = 0;
    } else {
      while (entry) {
        var chunk = entry.chunk;
        var encoding = entry.encoding;
        var cb = entry.callback;
        var len = state.objectMode ? 1 : chunk.length;
        doWrite(stream2, state, false, len, chunk, encoding, cb);
        entry = entry.next;
        state.bufferedRequestCount--;
        if (state.writing) {
          break;
        }
      }
      if (entry === null) state.lastBufferedRequest = null;
    }
    state.bufferedRequest = entry;
    state.bufferProcessing = false;
  }
  Writable.prototype._write = function(chunk, encoding, cb) {
    cb(new Error("_write() is not implemented"));
  };
  Writable.prototype._writev = null;
  Writable.prototype.end = function(chunk, encoding, cb) {
    var state = this._writableState;
    if (typeof chunk === "function") {
      cb = chunk;
      chunk = null;
      encoding = null;
    } else if (typeof encoding === "function") {
      cb = encoding;
      encoding = null;
    }
    if (chunk !== null && chunk !== void 0) this.write(chunk, encoding);
    if (state.corked) {
      state.corked = 1;
      this.uncork();
    }
    if (!state.ending) endWritable(this, state, cb);
  };
  function needFinish(state) {
    return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
  }
  function callFinal(stream2, state) {
    stream2._final(function(err2) {
      state.pendingcb--;
      if (err2) {
        stream2.emit("error", err2);
      }
      state.prefinished = true;
      stream2.emit("prefinish");
      finishMaybe(stream2, state);
    });
  }
  function prefinish(stream2, state) {
    if (!state.prefinished && !state.finalCalled) {
      if (typeof stream2._final === "function") {
        state.pendingcb++;
        state.finalCalled = true;
        pna.nextTick(callFinal, stream2, state);
      } else {
        state.prefinished = true;
        stream2.emit("prefinish");
      }
    }
  }
  function finishMaybe(stream2, state) {
    var need = needFinish(state);
    if (need) {
      prefinish(stream2, state);
      if (state.pendingcb === 0) {
        state.finished = true;
        stream2.emit("finish");
      }
    }
    return need;
  }
  function endWritable(stream2, state, cb) {
    state.ending = true;
    finishMaybe(stream2, state);
    if (cb) {
      if (state.finished) pna.nextTick(cb);
      else stream2.once("finish", cb);
    }
    state.ended = true;
    stream2.writable = false;
  }
  function onCorkedFinish(corkReq, state, err2) {
    var entry = corkReq.entry;
    corkReq.entry = null;
    while (entry) {
      var cb = entry.callback;
      state.pendingcb--;
      cb(err2);
      entry = entry.next;
    }
    state.corkedRequestsFree.next = corkReq;
  }
  Object.defineProperty(Writable.prototype, "destroyed", {
    get: function() {
      if (this._writableState === void 0) {
        return false;
      }
      return this._writableState.destroyed;
    },
    set: function(value) {
      if (!this._writableState) {
        return;
      }
      this._writableState.destroyed = value;
    }
  });
  Writable.prototype.destroy = destroyImpl.destroy;
  Writable.prototype._undestroy = destroyImpl.undestroy;
  Writable.prototype._destroy = function(err2, cb) {
    this.end();
    cb(err2);
  };
  return _stream_writable;
}
var _stream_duplex;
var hasRequired_stream_duplex;
function require_stream_duplex() {
  if (hasRequired_stream_duplex) return _stream_duplex;
  hasRequired_stream_duplex = 1;
  var pna = requireProcessNextickArgs();
  var objectKeys = Object.keys || function(obj) {
    var keys2 = [];
    for (var key in obj) {
      keys2.push(key);
    }
    return keys2;
  };
  _stream_duplex = Duplex;
  var util2 = Object.create(requireUtil());
  util2.inherits = requireInherits();
  var Readable = require_stream_readable();
  var Writable = require_stream_writable();
  util2.inherits(Duplex, Readable);
  {
    var keys = objectKeys(Writable.prototype);
    for (var v = 0; v < keys.length; v++) {
      var method = keys[v];
      if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
    }
  }
  function Duplex(options) {
    if (!(this instanceof Duplex)) return new Duplex(options);
    Readable.call(this, options);
    Writable.call(this, options);
    if (options && options.readable === false) this.readable = false;
    if (options && options.writable === false) this.writable = false;
    this.allowHalfOpen = true;
    if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;
    this.once("end", onend);
  }
  Object.defineProperty(Duplex.prototype, "writableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function() {
      return this._writableState.highWaterMark;
    }
  });
  function onend() {
    if (this.allowHalfOpen || this._writableState.ended) return;
    pna.nextTick(onEndNT, this);
  }
  function onEndNT(self2) {
    self2.end();
  }
  Object.defineProperty(Duplex.prototype, "destroyed", {
    get: function() {
      if (this._readableState === void 0 || this._writableState === void 0) {
        return false;
      }
      return this._readableState.destroyed && this._writableState.destroyed;
    },
    set: function(value) {
      if (this._readableState === void 0 || this._writableState === void 0) {
        return;
      }
      this._readableState.destroyed = value;
      this._writableState.destroyed = value;
    }
  });
  Duplex.prototype._destroy = function(err2, cb) {
    this.push(null);
    this.end();
    pna.nextTick(cb, err2);
  };
  return _stream_duplex;
}
var string_decoder = {};
var hasRequiredString_decoder;
function requireString_decoder() {
  if (hasRequiredString_decoder) return string_decoder;
  hasRequiredString_decoder = 1;
  var Buffer2 = requireSafeBuffer().Buffer;
  var isEncoding = Buffer2.isEncoding || function(encoding) {
    encoding = "" + encoding;
    switch (encoding && encoding.toLowerCase()) {
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
        return true;
      default:
        return false;
    }
  };
  function _normalizeEncoding(enc) {
    if (!enc) return "utf8";
    var retried;
    while (true) {
      switch (enc) {
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
          return enc;
        default:
          if (retried) return;
          enc = ("" + enc).toLowerCase();
          retried = true;
      }
    }
  }
  function normalizeEncoding(enc) {
    var nenc = _normalizeEncoding(enc);
    if (typeof nenc !== "string" && (Buffer2.isEncoding === isEncoding || !isEncoding(enc))) throw new Error("Unknown encoding: " + enc);
    return nenc || enc;
  }
  string_decoder.StringDecoder = StringDecoder;
  function StringDecoder(encoding) {
    this.encoding = normalizeEncoding(encoding);
    var nb;
    switch (this.encoding) {
      case "utf16le":
        this.text = utf16Text;
        this.end = utf16End;
        nb = 4;
        break;
      case "utf8":
        this.fillLast = utf8FillLast;
        nb = 4;
        break;
      case "base64":
        this.text = base64Text;
        this.end = base64End;
        nb = 3;
        break;
      default:
        this.write = simpleWrite;
        this.end = simpleEnd;
        return;
    }
    this.lastNeed = 0;
    this.lastTotal = 0;
    this.lastChar = Buffer2.allocUnsafe(nb);
  }
  StringDecoder.prototype.write = function(buf) {
    if (buf.length === 0) return "";
    var r;
    var i;
    if (this.lastNeed) {
      r = this.fillLast(buf);
      if (r === void 0) return "";
      i = this.lastNeed;
      this.lastNeed = 0;
    } else {
      i = 0;
    }
    if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
    return r || "";
  };
  StringDecoder.prototype.end = utf8End;
  StringDecoder.prototype.text = utf8Text;
  StringDecoder.prototype.fillLast = function(buf) {
    if (this.lastNeed <= buf.length) {
      buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
      return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
    this.lastNeed -= buf.length;
  };
  function utf8CheckByte(byte2) {
    if (byte2 <= 127) return 0;
    else if (byte2 >> 5 === 6) return 2;
    else if (byte2 >> 4 === 14) return 3;
    else if (byte2 >> 3 === 30) return 4;
    return byte2 >> 6 === 2 ? -1 : -2;
  }
  function utf8CheckIncomplete(self2, buf, i) {
    var j = buf.length - 1;
    if (j < i) return 0;
    var nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) self2.lastNeed = nb - 1;
      return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) self2.lastNeed = nb - 2;
      return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) {
        if (nb === 2) nb = 0;
        else self2.lastNeed = nb - 3;
      }
      return nb;
    }
    return 0;
  }
  function utf8CheckExtraBytes(self2, buf, p) {
    if ((buf[0] & 192) !== 128) {
      self2.lastNeed = 0;
      return "�";
    }
    if (self2.lastNeed > 1 && buf.length > 1) {
      if ((buf[1] & 192) !== 128) {
        self2.lastNeed = 1;
        return "�";
      }
      if (self2.lastNeed > 2 && buf.length > 2) {
        if ((buf[2] & 192) !== 128) {
          self2.lastNeed = 2;
          return "�";
        }
      }
    }
  }
  function utf8FillLast(buf) {
    var p = this.lastTotal - this.lastNeed;
    var r = utf8CheckExtraBytes(this, buf);
    if (r !== void 0) return r;
    if (this.lastNeed <= buf.length) {
      buf.copy(this.lastChar, p, 0, this.lastNeed);
      return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, p, 0, buf.length);
    this.lastNeed -= buf.length;
  }
  function utf8Text(buf, i) {
    var total = utf8CheckIncomplete(this, buf, i);
    if (!this.lastNeed) return buf.toString("utf8", i);
    this.lastTotal = total;
    var end = buf.length - (total - this.lastNeed);
    buf.copy(this.lastChar, 0, end);
    return buf.toString("utf8", i, end);
  }
  function utf8End(buf) {
    var r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) return r + "�";
    return r;
  }
  function utf16Text(buf, i) {
    if ((buf.length - i) % 2 === 0) {
      var r = buf.toString("utf16le", i);
      if (r) {
        var c2 = r.charCodeAt(r.length - 1);
        if (c2 >= 55296 && c2 <= 56319) {
          this.lastNeed = 2;
          this.lastTotal = 4;
          this.lastChar[0] = buf[buf.length - 2];
          this.lastChar[1] = buf[buf.length - 1];
          return r.slice(0, -1);
        }
      }
      return r;
    }
    this.lastNeed = 1;
    this.lastTotal = 2;
    this.lastChar[0] = buf[buf.length - 1];
    return buf.toString("utf16le", i, buf.length - 1);
  }
  function utf16End(buf) {
    var r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) {
      var end = this.lastTotal - this.lastNeed;
      return r + this.lastChar.toString("utf16le", 0, end);
    }
    return r;
  }
  function base64Text(buf, i) {
    var n = (buf.length - i) % 3;
    if (n === 0) return buf.toString("base64", i);
    this.lastNeed = 3 - n;
    this.lastTotal = 3;
    if (n === 1) {
      this.lastChar[0] = buf[buf.length - 1];
    } else {
      this.lastChar[0] = buf[buf.length - 2];
      this.lastChar[1] = buf[buf.length - 1];
    }
    return buf.toString("base64", i, buf.length - n);
  }
  function base64End(buf) {
    var r = buf && buf.length ? this.write(buf) : "";
    if (this.lastNeed) return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
    return r;
  }
  function simpleWrite(buf) {
    return buf.toString(this.encoding);
  }
  function simpleEnd(buf) {
    return buf && buf.length ? this.write(buf) : "";
  }
  return string_decoder;
}
var _stream_readable;
var hasRequired_stream_readable;
function require_stream_readable() {
  if (hasRequired_stream_readable) return _stream_readable;
  hasRequired_stream_readable = 1;
  var pna = requireProcessNextickArgs();
  _stream_readable = Readable;
  var isArray = requireIsarray();
  var Duplex;
  Readable.ReadableState = ReadableState;
  require$$2$1.EventEmitter;
  var EElistenerCount = function(emitter, type) {
    return emitter.listeners(type).length;
  };
  var Stream2 = requireStream();
  var Buffer2 = requireSafeBuffer().Buffer;
  var OurUint8Array = (typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : {}).Uint8Array || function() {
  };
  function _uint8ArrayToBuffer(chunk) {
    return Buffer2.from(chunk);
  }
  function _isUint8Array(obj) {
    return Buffer2.isBuffer(obj) || obj instanceof OurUint8Array;
  }
  var util2 = Object.create(requireUtil());
  util2.inherits = requireInherits();
  var debugUtil = require$$0$2;
  var debug = void 0;
  if (debugUtil && debugUtil.debuglog) {
    debug = debugUtil.debuglog("stream");
  } else {
    debug = function() {
    };
  }
  var BufferList2 = requireBufferList();
  var destroyImpl = requireDestroy();
  var StringDecoder;
  util2.inherits(Readable, Stream2);
  var kProxyEvents = ["error", "close", "destroy", "pause", "resume"];
  function prependListener(emitter, event, fn) {
    if (typeof emitter.prependListener === "function") return emitter.prependListener(event, fn);
    if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);
    else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);
    else emitter._events[event] = [fn, emitter._events[event]];
  }
  function ReadableState(options, stream2) {
    Duplex = Duplex || require_stream_duplex();
    options = options || {};
    var isDuplex = stream2 instanceof Duplex;
    this.objectMode = !!options.objectMode;
    if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;
    var hwm = options.highWaterMark;
    var readableHwm = options.readableHighWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16 * 1024;
    if (hwm || hwm === 0) this.highWaterMark = hwm;
    else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;
    else this.highWaterMark = defaultHwm;
    this.highWaterMark = Math.floor(this.highWaterMark);
    this.buffer = new BufferList2();
    this.length = 0;
    this.pipes = null;
    this.pipesCount = 0;
    this.flowing = null;
    this.ended = false;
    this.endEmitted = false;
    this.reading = false;
    this.sync = true;
    this.needReadable = false;
    this.emittedReadable = false;
    this.readableListening = false;
    this.resumeScheduled = false;
    this.destroyed = false;
    this.defaultEncoding = options.defaultEncoding || "utf8";
    this.awaitDrain = 0;
    this.readingMore = false;
    this.decoder = null;
    this.encoding = null;
    if (options.encoding) {
      if (!StringDecoder) StringDecoder = requireString_decoder().StringDecoder;
      this.decoder = new StringDecoder(options.encoding);
      this.encoding = options.encoding;
    }
  }
  function Readable(options) {
    Duplex = Duplex || require_stream_duplex();
    if (!(this instanceof Readable)) return new Readable(options);
    this._readableState = new ReadableState(options, this);
    this.readable = true;
    if (options) {
      if (typeof options.read === "function") this._read = options.read;
      if (typeof options.destroy === "function") this._destroy = options.destroy;
    }
    Stream2.call(this);
  }
  Object.defineProperty(Readable.prototype, "destroyed", {
    get: function() {
      if (this._readableState === void 0) {
        return false;
      }
      return this._readableState.destroyed;
    },
    set: function(value) {
      if (!this._readableState) {
        return;
      }
      this._readableState.destroyed = value;
    }
  });
  Readable.prototype.destroy = destroyImpl.destroy;
  Readable.prototype._undestroy = destroyImpl.undestroy;
  Readable.prototype._destroy = function(err2, cb) {
    this.push(null);
    cb(err2);
  };
  Readable.prototype.push = function(chunk, encoding) {
    var state = this._readableState;
    var skipChunkCheck;
    if (!state.objectMode) {
      if (typeof chunk === "string") {
        encoding = encoding || state.defaultEncoding;
        if (encoding !== state.encoding) {
          chunk = Buffer2.from(chunk, encoding);
          encoding = "";
        }
        skipChunkCheck = true;
      }
    } else {
      skipChunkCheck = true;
    }
    return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
  };
  Readable.prototype.unshift = function(chunk) {
    return readableAddChunk(this, chunk, null, true, false);
  };
  function readableAddChunk(stream2, chunk, encoding, addToFront, skipChunkCheck) {
    var state = stream2._readableState;
    if (chunk === null) {
      state.reading = false;
      onEofChunk(stream2, state);
    } else {
      var er;
      if (!skipChunkCheck) er = chunkInvalid(state, chunk);
      if (er) {
        stream2.emit("error", er);
      } else if (state.objectMode || chunk && chunk.length > 0) {
        if (typeof chunk !== "string" && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer2.prototype) {
          chunk = _uint8ArrayToBuffer(chunk);
        }
        if (addToFront) {
          if (state.endEmitted) stream2.emit("error", new Error("stream.unshift() after end event"));
          else addChunk(stream2, state, chunk, true);
        } else if (state.ended) {
          stream2.emit("error", new Error("stream.push() after EOF"));
        } else {
          state.reading = false;
          if (state.decoder && !encoding) {
            chunk = state.decoder.write(chunk);
            if (state.objectMode || chunk.length !== 0) addChunk(stream2, state, chunk, false);
            else maybeReadMore(stream2, state);
          } else {
            addChunk(stream2, state, chunk, false);
          }
        }
      } else if (!addToFront) {
        state.reading = false;
      }
    }
    return needMoreData(state);
  }
  function addChunk(stream2, state, chunk, addToFront) {
    if (state.flowing && state.length === 0 && !state.sync) {
      stream2.emit("data", chunk);
      stream2.read(0);
    } else {
      state.length += state.objectMode ? 1 : chunk.length;
      if (addToFront) state.buffer.unshift(chunk);
      else state.buffer.push(chunk);
      if (state.needReadable) emitReadable(stream2);
    }
    maybeReadMore(stream2, state);
  }
  function chunkInvalid(state, chunk) {
    var er;
    if (!_isUint8Array(chunk) && typeof chunk !== "string" && chunk !== void 0 && !state.objectMode) {
      er = new TypeError("Invalid non-string/buffer chunk");
    }
    return er;
  }
  function needMoreData(state) {
    return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
  }
  Readable.prototype.isPaused = function() {
    return this._readableState.flowing === false;
  };
  Readable.prototype.setEncoding = function(enc) {
    if (!StringDecoder) StringDecoder = requireString_decoder().StringDecoder;
    this._readableState.decoder = new StringDecoder(enc);
    this._readableState.encoding = enc;
    return this;
  };
  var MAX_HWM = 8388608;
  function computeNewHighWaterMark(n) {
    if (n >= MAX_HWM) {
      n = MAX_HWM;
    } else {
      n--;
      n |= n >>> 1;
      n |= n >>> 2;
      n |= n >>> 4;
      n |= n >>> 8;
      n |= n >>> 16;
      n++;
    }
    return n;
  }
  function howMuchToRead(n, state) {
    if (n <= 0 || state.length === 0 && state.ended) return 0;
    if (state.objectMode) return 1;
    if (n !== n) {
      if (state.flowing && state.length) return state.buffer.head.data.length;
      else return state.length;
    }
    if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
    if (n <= state.length) return n;
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    }
    return state.length;
  }
  Readable.prototype.read = function(n) {
    debug("read", n);
    n = parseInt(n, 10);
    var state = this._readableState;
    var nOrig = n;
    if (n !== 0) state.emittedReadable = false;
    if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
      debug("read: emitReadable", state.length, state.ended);
      if (state.length === 0 && state.ended) endReadable(this);
      else emitReadable(this);
      return null;
    }
    n = howMuchToRead(n, state);
    if (n === 0 && state.ended) {
      if (state.length === 0) endReadable(this);
      return null;
    }
    var doRead = state.needReadable;
    debug("need readable", doRead);
    if (state.length === 0 || state.length - n < state.highWaterMark) {
      doRead = true;
      debug("length less than watermark", doRead);
    }
    if (state.ended || state.reading) {
      doRead = false;
      debug("reading or ended", doRead);
    } else if (doRead) {
      debug("do read");
      state.reading = true;
      state.sync = true;
      if (state.length === 0) state.needReadable = true;
      this._read(state.highWaterMark);
      state.sync = false;
      if (!state.reading) n = howMuchToRead(nOrig, state);
    }
    var ret;
    if (n > 0) ret = fromList(n, state);
    else ret = null;
    if (ret === null) {
      state.needReadable = true;
      n = 0;
    } else {
      state.length -= n;
    }
    if (state.length === 0) {
      if (!state.ended) state.needReadable = true;
      if (nOrig !== n && state.ended) endReadable(this);
    }
    if (ret !== null) this.emit("data", ret);
    return ret;
  };
  function onEofChunk(stream2, state) {
    if (state.ended) return;
    if (state.decoder) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) {
        state.buffer.push(chunk);
        state.length += state.objectMode ? 1 : chunk.length;
      }
    }
    state.ended = true;
    emitReadable(stream2);
  }
  function emitReadable(stream2) {
    var state = stream2._readableState;
    state.needReadable = false;
    if (!state.emittedReadable) {
      debug("emitReadable", state.flowing);
      state.emittedReadable = true;
      if (state.sync) pna.nextTick(emitReadable_, stream2);
      else emitReadable_(stream2);
    }
  }
  function emitReadable_(stream2) {
    debug("emit readable");
    stream2.emit("readable");
    flow(stream2);
  }
  function maybeReadMore(stream2, state) {
    if (!state.readingMore) {
      state.readingMore = true;
      pna.nextTick(maybeReadMore_, stream2, state);
    }
  }
  function maybeReadMore_(stream2, state) {
    var len = state.length;
    while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
      debug("maybeReadMore read 0");
      stream2.read(0);
      if (len === state.length)
        break;
      else len = state.length;
    }
    state.readingMore = false;
  }
  Readable.prototype._read = function(n) {
    this.emit("error", new Error("_read() is not implemented"));
  };
  Readable.prototype.pipe = function(dest, pipeOpts) {
    var src = this;
    var state = this._readableState;
    switch (state.pipesCount) {
      case 0:
        state.pipes = dest;
        break;
      case 1:
        state.pipes = [state.pipes, dest];
        break;
      default:
        state.pipes.push(dest);
        break;
    }
    state.pipesCount += 1;
    debug("pipe count=%d opts=%j", state.pipesCount, pipeOpts);
    var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
    var endFn = doEnd ? onend : unpipe;
    if (state.endEmitted) pna.nextTick(endFn);
    else src.once("end", endFn);
    dest.on("unpipe", onunpipe);
    function onunpipe(readable2, unpipeInfo) {
      debug("onunpipe");
      if (readable2 === src) {
        if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
          unpipeInfo.hasUnpiped = true;
          cleanup();
        }
      }
    }
    function onend() {
      debug("onend");
      dest.end();
    }
    var ondrain = pipeOnDrain(src);
    dest.on("drain", ondrain);
    var cleanedUp = false;
    function cleanup() {
      debug("cleanup");
      dest.removeListener("close", onclose);
      dest.removeListener("finish", onfinish);
      dest.removeListener("drain", ondrain);
      dest.removeListener("error", onerror);
      dest.removeListener("unpipe", onunpipe);
      src.removeListener("end", onend);
      src.removeListener("end", unpipe);
      src.removeListener("data", ondata);
      cleanedUp = true;
      if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
    }
    var increasedAwaitDrain = false;
    src.on("data", ondata);
    function ondata(chunk) {
      debug("ondata");
      increasedAwaitDrain = false;
      var ret = dest.write(chunk);
      if (false === ret && !increasedAwaitDrain) {
        if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
          debug("false write response, pause", state.awaitDrain);
          state.awaitDrain++;
          increasedAwaitDrain = true;
        }
        src.pause();
      }
    }
    function onerror(er) {
      debug("onerror", er);
      unpipe();
      dest.removeListener("error", onerror);
      if (EElistenerCount(dest, "error") === 0) dest.emit("error", er);
    }
    prependListener(dest, "error", onerror);
    function onclose() {
      dest.removeListener("finish", onfinish);
      unpipe();
    }
    dest.once("close", onclose);
    function onfinish() {
      debug("onfinish");
      dest.removeListener("close", onclose);
      unpipe();
    }
    dest.once("finish", onfinish);
    function unpipe() {
      debug("unpipe");
      src.unpipe(dest);
    }
    dest.emit("pipe", src);
    if (!state.flowing) {
      debug("pipe resume");
      src.resume();
    }
    return dest;
  };
  function pipeOnDrain(src) {
    return function() {
      var state = src._readableState;
      debug("pipeOnDrain", state.awaitDrain);
      if (state.awaitDrain) state.awaitDrain--;
      if (state.awaitDrain === 0 && EElistenerCount(src, "data")) {
        state.flowing = true;
        flow(src);
      }
    };
  }
  Readable.prototype.unpipe = function(dest) {
    var state = this._readableState;
    var unpipeInfo = { hasUnpiped: false };
    if (state.pipesCount === 0) return this;
    if (state.pipesCount === 1) {
      if (dest && dest !== state.pipes) return this;
      if (!dest) dest = state.pipes;
      state.pipes = null;
      state.pipesCount = 0;
      state.flowing = false;
      if (dest) dest.emit("unpipe", this, unpipeInfo);
      return this;
    }
    if (!dest) {
      var dests = state.pipes;
      var len = state.pipesCount;
      state.pipes = null;
      state.pipesCount = 0;
      state.flowing = false;
      for (var i = 0; i < len; i++) {
        dests[i].emit("unpipe", this, { hasUnpiped: false });
      }
      return this;
    }
    var index = indexOf(state.pipes, dest);
    if (index === -1) return this;
    state.pipes.splice(index, 1);
    state.pipesCount -= 1;
    if (state.pipesCount === 1) state.pipes = state.pipes[0];
    dest.emit("unpipe", this, unpipeInfo);
    return this;
  };
  Readable.prototype.on = function(ev, fn) {
    var res = Stream2.prototype.on.call(this, ev, fn);
    if (ev === "data") {
      if (this._readableState.flowing !== false) this.resume();
    } else if (ev === "readable") {
      var state = this._readableState;
      if (!state.endEmitted && !state.readableListening) {
        state.readableListening = state.needReadable = true;
        state.emittedReadable = false;
        if (!state.reading) {
          pna.nextTick(nReadingNextTick, this);
        } else if (state.length) {
          emitReadable(this);
        }
      }
    }
    return res;
  };
  Readable.prototype.addListener = Readable.prototype.on;
  function nReadingNextTick(self2) {
    debug("readable nexttick read 0");
    self2.read(0);
  }
  Readable.prototype.resume = function() {
    var state = this._readableState;
    if (!state.flowing) {
      debug("resume");
      state.flowing = true;
      resume(this, state);
    }
    return this;
  };
  function resume(stream2, state) {
    if (!state.resumeScheduled) {
      state.resumeScheduled = true;
      pna.nextTick(resume_, stream2, state);
    }
  }
  function resume_(stream2, state) {
    if (!state.reading) {
      debug("resume read 0");
      stream2.read(0);
    }
    state.resumeScheduled = false;
    state.awaitDrain = 0;
    stream2.emit("resume");
    flow(stream2);
    if (state.flowing && !state.reading) stream2.read(0);
  }
  Readable.prototype.pause = function() {
    debug("call pause flowing=%j", this._readableState.flowing);
    if (false !== this._readableState.flowing) {
      debug("pause");
      this._readableState.flowing = false;
      this.emit("pause");
    }
    return this;
  };
  function flow(stream2) {
    var state = stream2._readableState;
    debug("flow", state.flowing);
    while (state.flowing && stream2.read() !== null) {
    }
  }
  Readable.prototype.wrap = function(stream2) {
    var _this = this;
    var state = this._readableState;
    var paused = false;
    stream2.on("end", function() {
      debug("wrapped end");
      if (state.decoder && !state.ended) {
        var chunk = state.decoder.end();
        if (chunk && chunk.length) _this.push(chunk);
      }
      _this.push(null);
    });
    stream2.on("data", function(chunk) {
      debug("wrapped data");
      if (state.decoder) chunk = state.decoder.write(chunk);
      if (state.objectMode && (chunk === null || chunk === void 0)) return;
      else if (!state.objectMode && (!chunk || !chunk.length)) return;
      var ret = _this.push(chunk);
      if (!ret) {
        paused = true;
        stream2.pause();
      }
    });
    for (var i in stream2) {
      if (this[i] === void 0 && typeof stream2[i] === "function") {
        this[i] = /* @__PURE__ */ function(method) {
          return function() {
            return stream2[method].apply(stream2, arguments);
          };
        }(i);
      }
    }
    for (var n = 0; n < kProxyEvents.length; n++) {
      stream2.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
    }
    this._read = function(n2) {
      debug("wrapped _read", n2);
      if (paused) {
        paused = false;
        stream2.resume();
      }
    };
    return this;
  };
  Object.defineProperty(Readable.prototype, "readableHighWaterMark", {
    // making it explicit this property is not enumerable
    // because otherwise some prototype manipulation in
    // userland will fail
    enumerable: false,
    get: function() {
      return this._readableState.highWaterMark;
    }
  });
  Readable._fromList = fromList;
  function fromList(n, state) {
    if (state.length === 0) return null;
    var ret;
    if (state.objectMode) ret = state.buffer.shift();
    else if (!n || n >= state.length) {
      if (state.decoder) ret = state.buffer.join("");
      else if (state.buffer.length === 1) ret = state.buffer.head.data;
      else ret = state.buffer.concat(state.length);
      state.buffer.clear();
    } else {
      ret = fromListPartial(n, state.buffer, state.decoder);
    }
    return ret;
  }
  function fromListPartial(n, list, hasStrings) {
    var ret;
    if (n < list.head.data.length) {
      ret = list.head.data.slice(0, n);
      list.head.data = list.head.data.slice(n);
    } else if (n === list.head.data.length) {
      ret = list.shift();
    } else {
      ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
    }
    return ret;
  }
  function copyFromBufferString(n, list) {
    var p = list.head;
    var c2 = 1;
    var ret = p.data;
    n -= ret.length;
    while (p = p.next) {
      var str = p.data;
      var nb = n > str.length ? str.length : n;
      if (nb === str.length) ret += str;
      else ret += str.slice(0, n);
      n -= nb;
      if (n === 0) {
        if (nb === str.length) {
          ++c2;
          if (p.next) list.head = p.next;
          else list.head = list.tail = null;
        } else {
          list.head = p;
          p.data = str.slice(nb);
        }
        break;
      }
      ++c2;
    }
    list.length -= c2;
    return ret;
  }
  function copyFromBuffer(n, list) {
    var ret = Buffer2.allocUnsafe(n);
    var p = list.head;
    var c2 = 1;
    p.data.copy(ret);
    n -= p.data.length;
    while (p = p.next) {
      var buf = p.data;
      var nb = n > buf.length ? buf.length : n;
      buf.copy(ret, ret.length - n, 0, nb);
      n -= nb;
      if (n === 0) {
        if (nb === buf.length) {
          ++c2;
          if (p.next) list.head = p.next;
          else list.head = list.tail = null;
        } else {
          list.head = p;
          p.data = buf.slice(nb);
        }
        break;
      }
      ++c2;
    }
    list.length -= c2;
    return ret;
  }
  function endReadable(stream2) {
    var state = stream2._readableState;
    if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');
    if (!state.endEmitted) {
      state.ended = true;
      pna.nextTick(endReadableNT, state, stream2);
    }
  }
  function endReadableNT(state, stream2) {
    if (!state.endEmitted && state.length === 0) {
      state.endEmitted = true;
      stream2.readable = false;
      stream2.emit("end");
    }
  }
  function indexOf(xs, x) {
    for (var i = 0, l = xs.length; i < l; i++) {
      if (xs[i] === x) return i;
    }
    return -1;
  }
  return _stream_readable;
}
var _stream_transform;
var hasRequired_stream_transform;
function require_stream_transform() {
  if (hasRequired_stream_transform) return _stream_transform;
  hasRequired_stream_transform = 1;
  _stream_transform = Transform;
  var Duplex = require_stream_duplex();
  var util2 = Object.create(requireUtil());
  util2.inherits = requireInherits();
  util2.inherits(Transform, Duplex);
  function afterTransform(er, data) {
    var ts = this._transformState;
    ts.transforming = false;
    var cb = ts.writecb;
    if (!cb) {
      return this.emit("error", new Error("write callback called multiple times"));
    }
    ts.writechunk = null;
    ts.writecb = null;
    if (data != null)
      this.push(data);
    cb(er);
    var rs = this._readableState;
    rs.reading = false;
    if (rs.needReadable || rs.length < rs.highWaterMark) {
      this._read(rs.highWaterMark);
    }
  }
  function Transform(options) {
    if (!(this instanceof Transform)) return new Transform(options);
    Duplex.call(this, options);
    this._transformState = {
      afterTransform: afterTransform.bind(this),
      needTransform: false,
      transforming: false,
      writecb: null,
      writechunk: null,
      writeencoding: null
    };
    this._readableState.needReadable = true;
    this._readableState.sync = false;
    if (options) {
      if (typeof options.transform === "function") this._transform = options.transform;
      if (typeof options.flush === "function") this._flush = options.flush;
    }
    this.on("prefinish", prefinish);
  }
  function prefinish() {
    var _this = this;
    if (typeof this._flush === "function") {
      this._flush(function(er, data) {
        done(_this, er, data);
      });
    } else {
      done(this, null, null);
    }
  }
  Transform.prototype.push = function(chunk, encoding) {
    this._transformState.needTransform = false;
    return Duplex.prototype.push.call(this, chunk, encoding);
  };
  Transform.prototype._transform = function(chunk, encoding, cb) {
    throw new Error("_transform() is not implemented");
  };
  Transform.prototype._write = function(chunk, encoding, cb) {
    var ts = this._transformState;
    ts.writecb = cb;
    ts.writechunk = chunk;
    ts.writeencoding = encoding;
    if (!ts.transforming) {
      var rs = this._readableState;
      if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
    }
  };
  Transform.prototype._read = function(n) {
    var ts = this._transformState;
    if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
      ts.transforming = true;
      this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
    } else {
      ts.needTransform = true;
    }
  };
  Transform.prototype._destroy = function(err2, cb) {
    var _this2 = this;
    Duplex.prototype._destroy.call(this, err2, function(err22) {
      cb(err22);
      _this2.emit("close");
    });
  };
  function done(stream2, er, data) {
    if (er) return stream2.emit("error", er);
    if (data != null)
      stream2.push(data);
    if (stream2._writableState.length) throw new Error("Calling transform done when ws.length != 0");
    if (stream2._transformState.transforming) throw new Error("Calling transform done when still transforming");
    return stream2.push(null);
  }
  return _stream_transform;
}
var _stream_passthrough;
var hasRequired_stream_passthrough;
function require_stream_passthrough() {
  if (hasRequired_stream_passthrough) return _stream_passthrough;
  hasRequired_stream_passthrough = 1;
  _stream_passthrough = PassThrough;
  var Transform = require_stream_transform();
  var util2 = Object.create(requireUtil());
  util2.inherits = requireInherits();
  util2.inherits(PassThrough, Transform);
  function PassThrough(options) {
    if (!(this instanceof PassThrough)) return new PassThrough(options);
    Transform.call(this, options);
  }
  PassThrough.prototype._transform = function(chunk, encoding, cb) {
    cb(null, chunk);
  };
  return _stream_passthrough;
}
var hasRequiredReadable;
function requireReadable() {
  if (hasRequiredReadable) return readable.exports;
  hasRequiredReadable = 1;
  (function(module, exports) {
    var Stream2 = require$$1$1;
    if (process.env.READABLE_STREAM === "disable" && Stream2) {
      module.exports = Stream2;
      exports = module.exports = Stream2.Readable;
      exports.Readable = Stream2.Readable;
      exports.Writable = Stream2.Writable;
      exports.Duplex = Stream2.Duplex;
      exports.Transform = Stream2.Transform;
      exports.PassThrough = Stream2.PassThrough;
      exports.Stream = Stream2;
    } else {
      exports = module.exports = require_stream_readable();
      exports.Stream = Stream2 || exports;
      exports.Readable = exports;
      exports.Writable = require_stream_writable();
      exports.Duplex = require_stream_duplex();
      exports.Transform = require_stream_transform();
      exports.PassThrough = require_stream_passthrough();
    }
  })(readable, readable.exports);
  return readable.exports;
}
var nodestream;
var blob;
support$4.base64 = true;
support$4.array = true;
support$4.string = true;
support$4.arraybuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
support$4.nodebuffer = typeof Buffer !== "undefined";
support$4.uint8array = typeof Uint8Array !== "undefined";
if (typeof ArrayBuffer === "undefined") {
  blob = support$4.blob = false;
} else {
  var buffer = new ArrayBuffer(0);
  try {
    blob = support$4.blob = new Blob([buffer], {
      type: "application/zip"
    }).size === 0;
  } catch (e) {
    try {
      var Builder = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder;
      var builder = new Builder();
      builder.append(buffer);
      blob = support$4.blob = builder.getBlob("application/zip").size === 0;
    } catch (e2) {
      blob = support$4.blob = false;
    }
  }
}
try {
  nodestream = support$4.nodestream = !!requireReadable().Readable;
} catch (e) {
  nodestream = support$4.nodestream = false;
}
var base64$1 = {};
var hasRequiredBase64;
function requireBase64() {
  if (hasRequiredBase64) return base64$1;
  hasRequiredBase64 = 1;
  var utils2 = requireUtils();
  var support2 = support$4;
  var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  base64$1.encode = function(input) {
    var output = [];
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0, len = input.length, remainingBytes = len;
    var isArray = utils2.getTypeOf(input) !== "string";
    while (i < input.length) {
      remainingBytes = len - i;
      if (!isArray) {
        chr1 = input.charCodeAt(i++);
        chr2 = i < len ? input.charCodeAt(i++) : 0;
        chr3 = i < len ? input.charCodeAt(i++) : 0;
      } else {
        chr1 = input[i++];
        chr2 = i < len ? input[i++] : 0;
        chr3 = i < len ? input[i++] : 0;
      }
      enc1 = chr1 >> 2;
      enc2 = (chr1 & 3) << 4 | chr2 >> 4;
      enc3 = remainingBytes > 1 ? (chr2 & 15) << 2 | chr3 >> 6 : 64;
      enc4 = remainingBytes > 2 ? chr3 & 63 : 64;
      output.push(_keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4));
    }
    return output.join("");
  };
  base64$1.decode = function(input) {
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0, resultIndex = 0;
    var dataUrlPrefix = "data:";
    if (input.substr(0, dataUrlPrefix.length) === dataUrlPrefix) {
      throw new Error("Invalid base64 input, it looks like a data url.");
    }
    input = input.replace(/[^A-Za-z0-9+/=]/g, "");
    var totalLength = input.length * 3 / 4;
    if (input.charAt(input.length - 1) === _keyStr.charAt(64)) {
      totalLength--;
    }
    if (input.charAt(input.length - 2) === _keyStr.charAt(64)) {
      totalLength--;
    }
    if (totalLength % 1 !== 0) {
      throw new Error("Invalid base64 input, bad content length.");
    }
    var output;
    if (support2.uint8array) {
      output = new Uint8Array(totalLength | 0);
    } else {
      output = new Array(totalLength | 0);
    }
    while (i < input.length) {
      enc1 = _keyStr.indexOf(input.charAt(i++));
      enc2 = _keyStr.indexOf(input.charAt(i++));
      enc3 = _keyStr.indexOf(input.charAt(i++));
      enc4 = _keyStr.indexOf(input.charAt(i++));
      chr1 = enc1 << 2 | enc2 >> 4;
      chr2 = (enc2 & 15) << 4 | enc3 >> 2;
      chr3 = (enc3 & 3) << 6 | enc4;
      output[resultIndex++] = chr1;
      if (enc3 !== 64) {
        output[resultIndex++] = chr2;
      }
      if (enc4 !== 64) {
        output[resultIndex++] = chr3;
      }
    }
    return output;
  };
  return base64$1;
}
var nodejsUtils$2 = {
  /**
   * True if this is running in Nodejs, will be undefined in a browser.
   * In a browser, browserify won't include this file and the whole module
   * will be resolved an empty object.
   */
  isNode: typeof Buffer !== "undefined",
  /**
   * Create a new nodejs Buffer from an existing content.
   * @param {Object} data the data to pass to the constructor.
   * @param {String} encoding the encoding to use.
   * @return {Buffer} a new Buffer.
   */
  newBufferFrom: function(data, encoding) {
    if (Buffer.from && Buffer.from !== Uint8Array.from) {
      return Buffer.from(data, encoding);
    } else {
      if (typeof data === "number") {
        throw new Error('The "data" argument must not be a number');
      }
      return new Buffer(data, encoding);
    }
  },
  /**
   * Create a new nodejs Buffer with the specified size.
   * @param {Integer} size the size of the buffer.
   * @return {Buffer} a new Buffer.
   */
  allocBuffer: function(size) {
    if (Buffer.alloc) {
      return Buffer.alloc(size);
    } else {
      var buf = new Buffer(size);
      buf.fill(0);
      return buf;
    }
  },
  /**
   * Find out if an object is a Buffer.
   * @param {Object} b the object to test.
   * @return {Boolean} true if the object is a Buffer, false otherwise.
   */
  isBuffer: function(b) {
    return Buffer.isBuffer(b);
  },
  isStream: function(obj) {
    return obj && typeof obj.on === "function" && typeof obj.pause === "function" && typeof obj.resume === "function";
  }
};
var lib$3;
var hasRequiredLib$1;
function requireLib$1() {
  if (hasRequiredLib$1) return lib$3;
  hasRequiredLib$1 = 1;
  var Mutation = commonjsGlobal.MutationObserver || commonjsGlobal.WebKitMutationObserver;
  var scheduleDrain;
  if (process.browser) {
    if (Mutation) {
      var called = 0;
      var observer = new Mutation(nextTick);
      var element = commonjsGlobal.document.createTextNode("");
      observer.observe(element, {
        characterData: true
      });
      scheduleDrain = function() {
        element.data = called = ++called % 2;
      };
    } else if (!commonjsGlobal.setImmediate && typeof commonjsGlobal.MessageChannel !== "undefined") {
      var channel = new commonjsGlobal.MessageChannel();
      channel.port1.onmessage = nextTick;
      scheduleDrain = function() {
        channel.port2.postMessage(0);
      };
    } else if ("document" in commonjsGlobal && "onreadystatechange" in commonjsGlobal.document.createElement("script")) {
      scheduleDrain = function() {
        var scriptEl = commonjsGlobal.document.createElement("script");
        scriptEl.onreadystatechange = function() {
          nextTick();
          scriptEl.onreadystatechange = null;
          scriptEl.parentNode.removeChild(scriptEl);
          scriptEl = null;
        };
        commonjsGlobal.document.documentElement.appendChild(scriptEl);
      };
    } else {
      scheduleDrain = function() {
        setTimeout(nextTick, 0);
      };
    }
  } else {
    scheduleDrain = function() {
      process.nextTick(nextTick);
    };
  }
  var draining;
  var queue = [];
  function nextTick() {
    draining = true;
    var i, oldQueue;
    var len = queue.length;
    while (len) {
      oldQueue = queue;
      queue = [];
      i = -1;
      while (++i < len) {
        oldQueue[i]();
      }
      len = queue.length;
    }
    draining = false;
  }
  lib$3 = immediate;
  function immediate(task) {
    if (queue.push(task) === 1 && !draining) {
      scheduleDrain();
    }
  }
  return lib$3;
}
var lib$2;
var hasRequiredLib;
function requireLib() {
  if (hasRequiredLib) return lib$2;
  hasRequiredLib = 1;
  var immediate = requireLib$1();
  function INTERNAL() {
  }
  var handlers = {};
  var REJECTED = ["REJECTED"];
  var FULFILLED = ["FULFILLED"];
  var PENDING = ["PENDING"];
  if (!process.browser) {
    var UNHANDLED = ["UNHANDLED"];
  }
  lib$2 = Promise2;
  function Promise2(resolver) {
    if (typeof resolver !== "function") {
      throw new TypeError("resolver must be a function");
    }
    this.state = PENDING;
    this.queue = [];
    this.outcome = void 0;
    if (!process.browser) {
      this.handled = UNHANDLED;
    }
    if (resolver !== INTERNAL) {
      safelyResolveThenable(this, resolver);
    }
  }
  Promise2.prototype.finally = function(callback) {
    if (typeof callback !== "function") {
      return this;
    }
    var p = this.constructor;
    return this.then(resolve2, reject2);
    function resolve2(value) {
      function yes() {
        return value;
      }
      return p.resolve(callback()).then(yes);
    }
    function reject2(reason) {
      function no() {
        throw reason;
      }
      return p.resolve(callback()).then(no);
    }
  };
  Promise2.prototype.catch = function(onRejected) {
    return this.then(null, onRejected);
  };
  Promise2.prototype.then = function(onFulfilled, onRejected) {
    if (typeof onFulfilled !== "function" && this.state === FULFILLED || typeof onRejected !== "function" && this.state === REJECTED) {
      return this;
    }
    var promise = new this.constructor(INTERNAL);
    if (!process.browser) {
      if (this.handled === UNHANDLED) {
        this.handled = null;
      }
    }
    if (this.state !== PENDING) {
      var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
      unwrap(promise, resolver, this.outcome);
    } else {
      this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
    }
    return promise;
  };
  function QueueItem(promise, onFulfilled, onRejected) {
    this.promise = promise;
    if (typeof onFulfilled === "function") {
      this.onFulfilled = onFulfilled;
      this.callFulfilled = this.otherCallFulfilled;
    }
    if (typeof onRejected === "function") {
      this.onRejected = onRejected;
      this.callRejected = this.otherCallRejected;
    }
  }
  QueueItem.prototype.callFulfilled = function(value) {
    handlers.resolve(this.promise, value);
  };
  QueueItem.prototype.otherCallFulfilled = function(value) {
    unwrap(this.promise, this.onFulfilled, value);
  };
  QueueItem.prototype.callRejected = function(value) {
    handlers.reject(this.promise, value);
  };
  QueueItem.prototype.otherCallRejected = function(value) {
    unwrap(this.promise, this.onRejected, value);
  };
  function unwrap(promise, func, value) {
    immediate(function() {
      var returnValue;
      try {
        returnValue = func(value);
      } catch (e) {
        return handlers.reject(promise, e);
      }
      if (returnValue === promise) {
        handlers.reject(promise, new TypeError("Cannot resolve promise with itself"));
      } else {
        handlers.resolve(promise, returnValue);
      }
    });
  }
  handlers.resolve = function(self2, value) {
    var result = tryCatch(getThen, value);
    if (result.status === "error") {
      return handlers.reject(self2, result.value);
    }
    var thenable = result.value;
    if (thenable) {
      safelyResolveThenable(self2, thenable);
    } else {
      self2.state = FULFILLED;
      self2.outcome = value;
      var i = -1;
      var len = self2.queue.length;
      while (++i < len) {
        self2.queue[i].callFulfilled(value);
      }
    }
    return self2;
  };
  handlers.reject = function(self2, error) {
    self2.state = REJECTED;
    self2.outcome = error;
    if (!process.browser) {
      if (self2.handled === UNHANDLED) {
        immediate(function() {
          if (self2.handled === UNHANDLED) {
            process.emit("unhandledRejection", error, self2);
          }
        });
      }
    }
    var i = -1;
    var len = self2.queue.length;
    while (++i < len) {
      self2.queue[i].callRejected(error);
    }
    return self2;
  };
  function getThen(obj) {
    var then = obj && obj.then;
    if (obj && (typeof obj === "object" || typeof obj === "function") && typeof then === "function") {
      return function appyThen() {
        then.apply(obj, arguments);
      };
    }
  }
  function safelyResolveThenable(self2, thenable) {
    var called = false;
    function onError(value) {
      if (called) {
        return;
      }
      called = true;
      handlers.reject(self2, value);
    }
    function onSuccess(value) {
      if (called) {
        return;
      }
      called = true;
      handlers.resolve(self2, value);
    }
    function tryToUnwrap() {
      thenable(onSuccess, onError);
    }
    var result = tryCatch(tryToUnwrap);
    if (result.status === "error") {
      onError(result.value);
    }
  }
  function tryCatch(func, value) {
    var out2 = {};
    try {
      out2.value = func(value);
      out2.status = "success";
    } catch (e) {
      out2.status = "error";
      out2.value = e;
    }
    return out2;
  }
  Promise2.resolve = resolve;
  function resolve(value) {
    if (value instanceof this) {
      return value;
    }
    return handlers.resolve(new this(INTERNAL), value);
  }
  Promise2.reject = reject;
  function reject(reason) {
    var promise = new this(INTERNAL);
    return handlers.reject(promise, reason);
  }
  Promise2.all = all;
  function all(iterable) {
    var self2 = this;
    if (Object.prototype.toString.call(iterable) !== "[object Array]") {
      return this.reject(new TypeError("must be an array"));
    }
    var len = iterable.length;
    var called = false;
    if (!len) {
      return this.resolve([]);
    }
    var values = new Array(len);
    var resolved = 0;
    var i = -1;
    var promise = new this(INTERNAL);
    while (++i < len) {
      allResolver(iterable[i], i);
    }
    return promise;
    function allResolver(value, i2) {
      self2.resolve(value).then(resolveFromAll, function(error) {
        if (!called) {
          called = true;
          handlers.reject(promise, error);
        }
      });
      function resolveFromAll(outValue) {
        values[i2] = outValue;
        if (++resolved === len && !called) {
          called = true;
          handlers.resolve(promise, values);
        }
      }
    }
  }
  Promise2.race = race;
  function race(iterable) {
    var self2 = this;
    if (Object.prototype.toString.call(iterable) !== "[object Array]") {
      return this.reject(new TypeError("must be an array"));
    }
    var len = iterable.length;
    var called = false;
    if (!len) {
      return this.resolve([]);
    }
    var i = -1;
    var promise = new this(INTERNAL);
    while (++i < len) {
      resolver(iterable[i]);
    }
    return promise;
    function resolver(value) {
      self2.resolve(value).then(function(response) {
        if (!called) {
          called = true;
          handlers.resolve(promise, response);
        }
      }, function(error) {
        if (!called) {
          called = true;
          handlers.reject(promise, error);
        }
      });
    }
  }
  return lib$2;
}
var ES6Promise = null;
if (typeof Promise !== "undefined") {
  ES6Promise = Promise;
} else {
  ES6Promise = requireLib();
}
var external$3 = {
  Promise: ES6Promise
};
(function(global2, undefined$1) {
  if (global2.setImmediate) {
    return;
  }
  var nextHandle = 1;
  var tasksByHandle = {};
  var currentlyRunningATask = false;
  var doc = global2.document;
  var registerImmediate;
  function setImmediate2(callback) {
    if (typeof callback !== "function") {
      callback = new Function("" + callback);
    }
    var args = new Array(arguments.length - 1);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i + 1];
    }
    var task = { callback, args };
    tasksByHandle[nextHandle] = task;
    registerImmediate(nextHandle);
    return nextHandle++;
  }
  function clearImmediate(handle) {
    delete tasksByHandle[handle];
  }
  function run(task) {
    var callback = task.callback;
    var args = task.args;
    switch (args.length) {
      case 0:
        callback();
        break;
      case 1:
        callback(args[0]);
        break;
      case 2:
        callback(args[0], args[1]);
        break;
      case 3:
        callback(args[0], args[1], args[2]);
        break;
      default:
        callback.apply(undefined$1, args);
        break;
    }
  }
  function runIfPresent(handle) {
    if (currentlyRunningATask) {
      setTimeout(runIfPresent, 0, handle);
    } else {
      var task = tasksByHandle[handle];
      if (task) {
        currentlyRunningATask = true;
        try {
          run(task);
        } finally {
          clearImmediate(handle);
          currentlyRunningATask = false;
        }
      }
    }
  }
  function installNextTickImplementation() {
    registerImmediate = function(handle) {
      process.nextTick(function() {
        runIfPresent(handle);
      });
    };
  }
  function canUsePostMessage() {
    if (global2.postMessage && !global2.importScripts) {
      var postMessageIsAsynchronous = true;
      var oldOnMessage = global2.onmessage;
      global2.onmessage = function() {
        postMessageIsAsynchronous = false;
      };
      global2.postMessage("", "*");
      global2.onmessage = oldOnMessage;
      return postMessageIsAsynchronous;
    }
  }
  function installPostMessageImplementation() {
    var messagePrefix = "setImmediate$" + Math.random() + "$";
    var onGlobalMessage = function(event) {
      if (event.source === global2 && typeof event.data === "string" && event.data.indexOf(messagePrefix) === 0) {
        runIfPresent(+event.data.slice(messagePrefix.length));
      }
    };
    if (global2.addEventListener) {
      global2.addEventListener("message", onGlobalMessage, false);
    } else {
      global2.attachEvent("onmessage", onGlobalMessage);
    }
    registerImmediate = function(handle) {
      global2.postMessage(messagePrefix + handle, "*");
    };
  }
  function installMessageChannelImplementation() {
    var channel = new MessageChannel();
    channel.port1.onmessage = function(event) {
      var handle = event.data;
      runIfPresent(handle);
    };
    registerImmediate = function(handle) {
      channel.port2.postMessage(handle);
    };
  }
  function installReadyStateChangeImplementation() {
    var html = doc.documentElement;
    registerImmediate = function(handle) {
      var script = doc.createElement("script");
      script.onreadystatechange = function() {
        runIfPresent(handle);
        script.onreadystatechange = null;
        html.removeChild(script);
        script = null;
      };
      html.appendChild(script);
    };
  }
  function installSetTimeoutImplementation() {
    registerImmediate = function(handle) {
      setTimeout(runIfPresent, 0, handle);
    };
  }
  var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global2);
  attachTo = attachTo && attachTo.setTimeout ? attachTo : global2;
  if ({}.toString.call(global2.process) === "[object process]") {
    installNextTickImplementation();
  } else if (canUsePostMessage()) {
    installPostMessageImplementation();
  } else if (global2.MessageChannel) {
    installMessageChannelImplementation();
  } else if (doc && "onreadystatechange" in doc.createElement("script")) {
    installReadyStateChangeImplementation();
  } else {
    installSetTimeoutImplementation();
  }
  attachTo.setImmediate = setImmediate2;
  attachTo.clearImmediate = clearImmediate;
})(typeof self === "undefined" ? typeof commonjsGlobal === "undefined" ? commonjsGlobal : commonjsGlobal : self);
var hasRequiredUtils;
function requireUtils() {
  if (hasRequiredUtils) return utils$s;
  hasRequiredUtils = 1;
  (function(exports) {
    var support2 = support$4;
    var base642 = requireBase64();
    var nodejsUtils2 = nodejsUtils$2;
    var external2 = external$3;
    function string2binary(str) {
      var result = null;
      if (support2.uint8array) {
        result = new Uint8Array(str.length);
      } else {
        result = new Array(str.length);
      }
      return stringToArrayLike(str, result);
    }
    exports.newBlob = function(part, type) {
      exports.checkSupport("blob");
      try {
        return new Blob([part], {
          type
        });
      } catch (e) {
        try {
          var Builder = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder;
          var builder = new Builder();
          builder.append(part);
          return builder.getBlob(type);
        } catch (e2) {
          throw new Error("Bug : can't construct the Blob.");
        }
      }
    };
    function identity(input) {
      return input;
    }
    function stringToArrayLike(str, array) {
      for (var i = 0; i < str.length; ++i) {
        array[i] = str.charCodeAt(i) & 255;
      }
      return array;
    }
    var arrayToStringHelper = {
      /**
       * Transform an array of int into a string, chunk by chunk.
       * See the performances notes on arrayLikeToString.
       * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
       * @param {String} type the type of the array.
       * @param {Integer} chunk the chunk size.
       * @return {String} the resulting string.
       * @throws Error if the chunk is too big for the stack.
       */
      stringifyByChunk: function(array, type, chunk) {
        var result = [], k = 0, len = array.length;
        if (len <= chunk) {
          return String.fromCharCode.apply(null, array);
        }
        while (k < len) {
          if (type === "array" || type === "nodebuffer") {
            result.push(String.fromCharCode.apply(null, array.slice(k, Math.min(k + chunk, len))));
          } else {
            result.push(String.fromCharCode.apply(null, array.subarray(k, Math.min(k + chunk, len))));
          }
          k += chunk;
        }
        return result.join("");
      },
      /**
       * Call String.fromCharCode on every item in the array.
       * This is the naive implementation, which generate A LOT of intermediate string.
       * This should be used when everything else fail.
       * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
       * @return {String} the result.
       */
      stringifyByChar: function(array) {
        var resultStr = "";
        for (var i = 0; i < array.length; i++) {
          resultStr += String.fromCharCode(array[i]);
        }
        return resultStr;
      },
      applyCanBeUsed: {
        /**
         * true if the browser accepts to use String.fromCharCode on Uint8Array
         */
        uint8array: function() {
          try {
            return support2.uint8array && String.fromCharCode.apply(null, new Uint8Array(1)).length === 1;
          } catch (e) {
            return false;
          }
        }(),
        /**
         * true if the browser accepts to use String.fromCharCode on nodejs Buffer.
         */
        nodebuffer: function() {
          try {
            return support2.nodebuffer && String.fromCharCode.apply(null, nodejsUtils2.allocBuffer(1)).length === 1;
          } catch (e) {
            return false;
          }
        }()
      }
    };
    function arrayLikeToString(array) {
      var chunk = 65536, type = exports.getTypeOf(array), canUseApply = true;
      if (type === "uint8array") {
        canUseApply = arrayToStringHelper.applyCanBeUsed.uint8array;
      } else if (type === "nodebuffer") {
        canUseApply = arrayToStringHelper.applyCanBeUsed.nodebuffer;
      }
      if (canUseApply) {
        while (chunk > 1) {
          try {
            return arrayToStringHelper.stringifyByChunk(array, type, chunk);
          } catch (e) {
            chunk = Math.floor(chunk / 2);
          }
        }
      }
      return arrayToStringHelper.stringifyByChar(array);
    }
    exports.applyFromCharCode = arrayLikeToString;
    function arrayLikeToArrayLike(arrayFrom, arrayTo) {
      for (var i = 0; i < arrayFrom.length; i++) {
        arrayTo[i] = arrayFrom[i];
      }
      return arrayTo;
    }
    var transform = {};
    transform["string"] = {
      "string": identity,
      "array": function(input) {
        return stringToArrayLike(input, new Array(input.length));
      },
      "arraybuffer": function(input) {
        return transform["string"]["uint8array"](input).buffer;
      },
      "uint8array": function(input) {
        return stringToArrayLike(input, new Uint8Array(input.length));
      },
      "nodebuffer": function(input) {
        return stringToArrayLike(input, nodejsUtils2.allocBuffer(input.length));
      }
    };
    transform["array"] = {
      "string": arrayLikeToString,
      "array": identity,
      "arraybuffer": function(input) {
        return new Uint8Array(input).buffer;
      },
      "uint8array": function(input) {
        return new Uint8Array(input);
      },
      "nodebuffer": function(input) {
        return nodejsUtils2.newBufferFrom(input);
      }
    };
    transform["arraybuffer"] = {
      "string": function(input) {
        return arrayLikeToString(new Uint8Array(input));
      },
      "array": function(input) {
        return arrayLikeToArrayLike(new Uint8Array(input), new Array(input.byteLength));
      },
      "arraybuffer": identity,
      "uint8array": function(input) {
        return new Uint8Array(input);
      },
      "nodebuffer": function(input) {
        return nodejsUtils2.newBufferFrom(new Uint8Array(input));
      }
    };
    transform["uint8array"] = {
      "string": arrayLikeToString,
      "array": function(input) {
        return arrayLikeToArrayLike(input, new Array(input.length));
      },
      "arraybuffer": function(input) {
        return input.buffer;
      },
      "uint8array": identity,
      "nodebuffer": function(input) {
        return nodejsUtils2.newBufferFrom(input);
      }
    };
    transform["nodebuffer"] = {
      "string": arrayLikeToString,
      "array": function(input) {
        return arrayLikeToArrayLike(input, new Array(input.length));
      },
      "arraybuffer": function(input) {
        return transform["nodebuffer"]["uint8array"](input).buffer;
      },
      "uint8array": function(input) {
        return arrayLikeToArrayLike(input, new Uint8Array(input.length));
      },
      "nodebuffer": identity
    };
    exports.transformTo = function(outputType, input) {
      if (!input) {
        input = "";
      }
      if (!outputType) {
        return input;
      }
      exports.checkSupport(outputType);
      var inputType = exports.getTypeOf(input);
      var result = transform[inputType][outputType](input);
      return result;
    };
    exports.resolve = function(path2) {
      var parts = path2.split("/");
      var result = [];
      for (var index = 0; index < parts.length; index++) {
        var part = parts[index];
        if (part === "." || part === "" && index !== 0 && index !== parts.length - 1) {
          continue;
        } else if (part === "..") {
          result.pop();
        } else {
          result.push(part);
        }
      }
      return result.join("/");
    };
    exports.getTypeOf = function(input) {
      if (typeof input === "string") {
        return "string";
      }
      if (Object.prototype.toString.call(input) === "[object Array]") {
        return "array";
      }
      if (support2.nodebuffer && nodejsUtils2.isBuffer(input)) {
        return "nodebuffer";
      }
      if (support2.uint8array && input instanceof Uint8Array) {
        return "uint8array";
      }
      if (support2.arraybuffer && input instanceof ArrayBuffer) {
        return "arraybuffer";
      }
    };
    exports.checkSupport = function(type) {
      var supported = support2[type.toLowerCase()];
      if (!supported) {
        throw new Error(type + " is not supported by this platform");
      }
    };
    exports.MAX_VALUE_16BITS = 65535;
    exports.MAX_VALUE_32BITS = -1;
    exports.pretty = function(str) {
      var res = "", code, i;
      for (i = 0; i < (str || "").length; i++) {
        code = str.charCodeAt(i);
        res += "\\x" + (code < 16 ? "0" : "") + code.toString(16).toUpperCase();
      }
      return res;
    };
    exports.delay = function(callback, args, self2) {
      setImmediate(function() {
        callback.apply(self2 || null, args || []);
      });
    };
    exports.inherits = function(ctor, superCtor) {
      var Obj = function() {
      };
      Obj.prototype = superCtor.prototype;
      ctor.prototype = new Obj();
    };
    exports.extend = function() {
      var result = {}, i, attr;
      for (i = 0; i < arguments.length; i++) {
        for (attr in arguments[i]) {
          if (Object.prototype.hasOwnProperty.call(arguments[i], attr) && typeof result[attr] === "undefined") {
            result[attr] = arguments[i][attr];
          }
        }
      }
      return result;
    };
    exports.prepareContent = function(name, inputData, isBinary, isOptimizedBinaryString, isBase64) {
      var promise = external2.Promise.resolve(inputData).then(function(data) {
        var isBlob = support2.blob && (data instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(data)) !== -1);
        if (isBlob && typeof FileReader !== "undefined") {
          return new external2.Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(e) {
              resolve(e.target.result);
            };
            reader.onerror = function(e) {
              reject(e.target.error);
            };
            reader.readAsArrayBuffer(data);
          });
        } else {
          return data;
        }
      });
      return promise.then(function(data) {
        var dataType = exports.getTypeOf(data);
        if (!dataType) {
          return external2.Promise.reject(
            new Error("Can't read the data of '" + name + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?")
          );
        }
        if (dataType === "arraybuffer") {
          data = exports.transformTo("uint8array", data);
        } else if (dataType === "string") {
          if (isBase64) {
            data = base642.decode(data);
          } else if (isBinary) {
            if (isOptimizedBinaryString !== true) {
              data = string2binary(data);
            }
          }
        }
        return data;
      });
    };
  })(utils$s);
  return utils$s;
}
function GenericWorker$b(name) {
  this.name = name || "default";
  this.streamInfo = {};
  this.generatedError = null;
  this.extraStreamInfo = {};
  this.isPaused = true;
  this.isFinished = false;
  this.isLocked = false;
  this._listeners = {
    "data": [],
    "end": [],
    "error": []
  };
  this.previous = null;
}
GenericWorker$b.prototype = {
  /**
   * Push a chunk to the next workers.
   * @param {Object} chunk the chunk to push
   */
  push: function(chunk) {
    this.emit("data", chunk);
  },
  /**
   * End the stream.
   * @return {Boolean} true if this call ended the worker, false otherwise.
   */
  end: function() {
    if (this.isFinished) {
      return false;
    }
    this.flush();
    try {
      this.emit("end");
      this.cleanUp();
      this.isFinished = true;
    } catch (e) {
      this.emit("error", e);
    }
    return true;
  },
  /**
   * End the stream with an error.
   * @param {Error} e the error which caused the premature end.
   * @return {Boolean} true if this call ended the worker with an error, false otherwise.
   */
  error: function(e) {
    if (this.isFinished) {
      return false;
    }
    if (this.isPaused) {
      this.generatedError = e;
    } else {
      this.isFinished = true;
      this.emit("error", e);
      if (this.previous) {
        this.previous.error(e);
      }
      this.cleanUp();
    }
    return true;
  },
  /**
   * Add a callback on an event.
   * @param {String} name the name of the event (data, end, error)
   * @param {Function} listener the function to call when the event is triggered
   * @return {GenericWorker} the current object for chainability
   */
  on: function(name, listener) {
    this._listeners[name].push(listener);
    return this;
  },
  /**
   * Clean any references when a worker is ending.
   */
  cleanUp: function() {
    this.streamInfo = this.generatedError = this.extraStreamInfo = null;
    this._listeners = [];
  },
  /**
   * Trigger an event. This will call registered callback with the provided arg.
   * @param {String} name the name of the event (data, end, error)
   * @param {Object} arg the argument to call the callback with.
   */
  emit: function(name, arg) {
    if (this._listeners[name]) {
      for (var i = 0; i < this._listeners[name].length; i++) {
        this._listeners[name][i].call(this, arg);
      }
    }
  },
  /**
   * Chain a worker with an other.
   * @param {Worker} next the worker receiving events from the current one.
   * @return {worker} the next worker for chainability
   */
  pipe: function(next) {
    return next.registerPrevious(this);
  },
  /**
   * Same as `pipe` in the other direction.
   * Using an API with `pipe(next)` is very easy.
   * Implementing the API with the point of view of the next one registering
   * a source is easier, see the ZipFileWorker.
   * @param {Worker} previous the previous worker, sending events to this one
   * @return {Worker} the current worker for chainability
   */
  registerPrevious: function(previous) {
    if (this.isLocked) {
      throw new Error("The stream '" + this + "' has already been used.");
    }
    this.streamInfo = previous.streamInfo;
    this.mergeStreamInfo();
    this.previous = previous;
    var self2 = this;
    previous.on("data", function(chunk) {
      self2.processChunk(chunk);
    });
    previous.on("end", function() {
      self2.end();
    });
    previous.on("error", function(e) {
      self2.error(e);
    });
    return this;
  },
  /**
   * Pause the stream so it doesn't send events anymore.
   * @return {Boolean} true if this call paused the worker, false otherwise.
   */
  pause: function() {
    if (this.isPaused || this.isFinished) {
      return false;
    }
    this.isPaused = true;
    if (this.previous) {
      this.previous.pause();
    }
    return true;
  },
  /**
   * Resume a paused stream.
   * @return {Boolean} true if this call resumed the worker, false otherwise.
   */
  resume: function() {
    if (!this.isPaused || this.isFinished) {
      return false;
    }
    this.isPaused = false;
    var withError = false;
    if (this.generatedError) {
      this.error(this.generatedError);
      withError = true;
    }
    if (this.previous) {
      this.previous.resume();
    }
    return !withError;
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
  processChunk: function(chunk) {
    this.push(chunk);
  },
  /**
   * Add a key/value to be added in the workers chain streamInfo once activated.
   * @param {String} key the key to use
   * @param {Object} value the associated value
   * @return {Worker} the current worker for chainability
   */
  withStreamInfo: function(key, value) {
    this.extraStreamInfo[key] = value;
    this.mergeStreamInfo();
    return this;
  },
  /**
   * Merge this worker's streamInfo into the chain's streamInfo.
   */
  mergeStreamInfo: function() {
    for (var key in this.extraStreamInfo) {
      if (!Object.prototype.hasOwnProperty.call(this.extraStreamInfo, key)) {
        continue;
      }
      this.streamInfo[key] = this.extraStreamInfo[key];
    }
  },
  /**
   * Lock the stream to prevent further updates on the workers chain.
   * After calling this method, all calls to pipe will fail.
   */
  lock: function() {
    if (this.isLocked) {
      throw new Error("The stream '" + this + "' has already been used.");
    }
    this.isLocked = true;
    if (this.previous) {
      this.previous.lock();
    }
  },
  /**
   *
   * Pretty print the workers chain.
   */
  toString: function() {
    var me = "Worker " + this.name;
    if (this.previous) {
      return this.previous + " -> " + me;
    } else {
      return me;
    }
  }
};
var GenericWorker_1 = GenericWorker$b;
(function(exports) {
  var utils2 = requireUtils();
  var support2 = support$4;
  var nodejsUtils2 = nodejsUtils$2;
  var GenericWorker2 = GenericWorker_1;
  var _utf8len2 = new Array(256);
  for (var i = 0; i < 256; i++) {
    _utf8len2[i] = i >= 252 ? 6 : i >= 248 ? 5 : i >= 240 ? 4 : i >= 224 ? 3 : i >= 192 ? 2 : 1;
  }
  _utf8len2[254] = _utf8len2[254] = 1;
  var string2buf = function(str) {
    var buf, c2, c22, m_pos, i2, str_len = str.length, buf_len = 0;
    for (m_pos = 0; m_pos < str_len; m_pos++) {
      c2 = str.charCodeAt(m_pos);
      if ((c2 & 64512) === 55296 && m_pos + 1 < str_len) {
        c22 = str.charCodeAt(m_pos + 1);
        if ((c22 & 64512) === 56320) {
          c2 = 65536 + (c2 - 55296 << 10) + (c22 - 56320);
          m_pos++;
        }
      }
      buf_len += c2 < 128 ? 1 : c2 < 2048 ? 2 : c2 < 65536 ? 3 : 4;
    }
    if (support2.uint8array) {
      buf = new Uint8Array(buf_len);
    } else {
      buf = new Array(buf_len);
    }
    for (i2 = 0, m_pos = 0; i2 < buf_len; m_pos++) {
      c2 = str.charCodeAt(m_pos);
      if ((c2 & 64512) === 55296 && m_pos + 1 < str_len) {
        c22 = str.charCodeAt(m_pos + 1);
        if ((c22 & 64512) === 56320) {
          c2 = 65536 + (c2 - 55296 << 10) + (c22 - 56320);
          m_pos++;
        }
      }
      if (c2 < 128) {
        buf[i2++] = c2;
      } else if (c2 < 2048) {
        buf[i2++] = 192 | c2 >>> 6;
        buf[i2++] = 128 | c2 & 63;
      } else if (c2 < 65536) {
        buf[i2++] = 224 | c2 >>> 12;
        buf[i2++] = 128 | c2 >>> 6 & 63;
        buf[i2++] = 128 | c2 & 63;
      } else {
        buf[i2++] = 240 | c2 >>> 18;
        buf[i2++] = 128 | c2 >>> 12 & 63;
        buf[i2++] = 128 | c2 >>> 6 & 63;
        buf[i2++] = 128 | c2 & 63;
      }
    }
    return buf;
  };
  var utf8border = function(buf, max) {
    var pos;
    max = max || buf.length;
    if (max > buf.length) {
      max = buf.length;
    }
    pos = max - 1;
    while (pos >= 0 && (buf[pos] & 192) === 128) {
      pos--;
    }
    if (pos < 0) {
      return max;
    }
    if (pos === 0) {
      return max;
    }
    return pos + _utf8len2[buf[pos]] > max ? pos : max;
  };
  var buf2string = function(buf) {
    var i2, out2, c2, c_len;
    var len = buf.length;
    var utf16buf = new Array(len * 2);
    for (out2 = 0, i2 = 0; i2 < len; ) {
      c2 = buf[i2++];
      if (c2 < 128) {
        utf16buf[out2++] = c2;
        continue;
      }
      c_len = _utf8len2[c2];
      if (c_len > 4) {
        utf16buf[out2++] = 65533;
        i2 += c_len - 1;
        continue;
      }
      c2 &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
      while (c_len > 1 && i2 < len) {
        c2 = c2 << 6 | buf[i2++] & 63;
        c_len--;
      }
      if (c_len > 1) {
        utf16buf[out2++] = 65533;
        continue;
      }
      if (c2 < 65536) {
        utf16buf[out2++] = c2;
      } else {
        c2 -= 65536;
        utf16buf[out2++] = 55296 | c2 >> 10 & 1023;
        utf16buf[out2++] = 56320 | c2 & 1023;
      }
    }
    if (utf16buf.length !== out2) {
      if (utf16buf.subarray) {
        utf16buf = utf16buf.subarray(0, out2);
      } else {
        utf16buf.length = out2;
      }
    }
    return utils2.applyFromCharCode(utf16buf);
  };
  exports.utf8encode = function utf8encode(str) {
    if (support2.nodebuffer) {
      return nodejsUtils2.newBufferFrom(str, "utf-8");
    }
    return string2buf(str);
  };
  exports.utf8decode = function utf8decode(buf) {
    if (support2.nodebuffer) {
      return utils2.transformTo("nodebuffer", buf).toString("utf-8");
    }
    buf = utils2.transformTo(support2.uint8array ? "uint8array" : "array", buf);
    return buf2string(buf);
  };
  function Utf8DecodeWorker() {
    GenericWorker2.call(this, "utf-8 decode");
    this.leftOver = null;
  }
  utils2.inherits(Utf8DecodeWorker, GenericWorker2);
  Utf8DecodeWorker.prototype.processChunk = function(chunk) {
    var data = utils2.transformTo(support2.uint8array ? "uint8array" : "array", chunk.data);
    if (this.leftOver && this.leftOver.length) {
      if (support2.uint8array) {
        var previousData = data;
        data = new Uint8Array(previousData.length + this.leftOver.length);
        data.set(this.leftOver, 0);
        data.set(previousData, this.leftOver.length);
      } else {
        data = this.leftOver.concat(data);
      }
      this.leftOver = null;
    }
    var nextBoundary = utf8border(data);
    var usableData = data;
    if (nextBoundary !== data.length) {
      if (support2.uint8array) {
        usableData = data.subarray(0, nextBoundary);
        this.leftOver = data.subarray(nextBoundary, data.length);
      } else {
        usableData = data.slice(0, nextBoundary);
        this.leftOver = data.slice(nextBoundary, data.length);
      }
    }
    this.push({
      data: exports.utf8decode(usableData),
      meta: chunk.meta
    });
  };
  Utf8DecodeWorker.prototype.flush = function() {
    if (this.leftOver && this.leftOver.length) {
      this.push({
        data: exports.utf8decode(this.leftOver),
        meta: {}
      });
      this.leftOver = null;
    }
  };
  exports.Utf8DecodeWorker = Utf8DecodeWorker;
  function Utf8EncodeWorker() {
    GenericWorker2.call(this, "utf-8 encode");
  }
  utils2.inherits(Utf8EncodeWorker, GenericWorker2);
  Utf8EncodeWorker.prototype.processChunk = function(chunk) {
    this.push({
      data: exports.utf8encode(chunk.data),
      meta: chunk.meta
    });
  };
  exports.Utf8EncodeWorker = Utf8EncodeWorker;
})(utf8$6);
var GenericWorker$a = GenericWorker_1;
var utils$r = requireUtils();
function ConvertWorker$1(destType) {
  GenericWorker$a.call(this, "ConvertWorker to " + destType);
  this.destType = destType;
}
utils$r.inherits(ConvertWorker$1, GenericWorker$a);
ConvertWorker$1.prototype.processChunk = function(chunk) {
  this.push({
    data: utils$r.transformTo(this.destType, chunk.data),
    meta: chunk.meta
  });
};
var ConvertWorker_1 = ConvertWorker$1;
var NodejsStreamOutputAdapter_1;
var hasRequiredNodejsStreamOutputAdapter;
function requireNodejsStreamOutputAdapter() {
  if (hasRequiredNodejsStreamOutputAdapter) return NodejsStreamOutputAdapter_1;
  hasRequiredNodejsStreamOutputAdapter = 1;
  var Readable = requireReadable().Readable;
  var utils2 = requireUtils();
  utils2.inherits(NodejsStreamOutputAdapter2, Readable);
  function NodejsStreamOutputAdapter2(helper, options, updateCb) {
    Readable.call(this, options);
    this._helper = helper;
    var self2 = this;
    helper.on("data", function(data, meta) {
      if (!self2.push(data)) {
        self2._helper.pause();
      }
      if (updateCb) {
        updateCb(meta);
      }
    }).on("error", function(e) {
      self2.emit("error", e);
    }).on("end", function() {
      self2.push(null);
    });
  }
  NodejsStreamOutputAdapter2.prototype._read = function() {
    this._helper.resume();
  };
  NodejsStreamOutputAdapter_1 = NodejsStreamOutputAdapter2;
  return NodejsStreamOutputAdapter_1;
}
var utils$q = requireUtils();
var ConvertWorker = ConvertWorker_1;
var GenericWorker$9 = GenericWorker_1;
var base64 = requireBase64();
var support$3 = support$4;
var external$2 = external$3;
var NodejsStreamOutputAdapter = null;
if (support$3.nodestream) {
  try {
    NodejsStreamOutputAdapter = requireNodejsStreamOutputAdapter();
  } catch (e) {
  }
}
function transformZipOutput(type, content, mimeType) {
  switch (type) {
    case "blob":
      return utils$q.newBlob(utils$q.transformTo("arraybuffer", content), mimeType);
    case "base64":
      return base64.encode(content);
    default:
      return utils$q.transformTo(type, content);
  }
}
function concat(type, dataArray) {
  var i, index = 0, res = null, totalLength = 0;
  for (i = 0; i < dataArray.length; i++) {
    totalLength += dataArray[i].length;
  }
  switch (type) {
    case "string":
      return dataArray.join("");
    case "array":
      return Array.prototype.concat.apply([], dataArray);
    case "uint8array":
      res = new Uint8Array(totalLength);
      for (i = 0; i < dataArray.length; i++) {
        res.set(dataArray[i], index);
        index += dataArray[i].length;
      }
      return res;
    case "nodebuffer":
      return Buffer.concat(dataArray);
    default:
      throw new Error("concat : unsupported type '" + type + "'");
  }
}
function accumulate(helper, updateCallback) {
  return new external$2.Promise(function(resolve, reject) {
    var dataArray = [];
    var chunkType = helper._internalType, resultType = helper._outputType, mimeType = helper._mimeType;
    helper.on("data", function(data, meta) {
      dataArray.push(data);
      if (updateCallback) {
        updateCallback(meta);
      }
    }).on("error", function(err2) {
      dataArray = [];
      reject(err2);
    }).on("end", function() {
      try {
        var result = transformZipOutput(resultType, concat(chunkType, dataArray), mimeType);
        resolve(result);
      } catch (e) {
        reject(e);
      }
      dataArray = [];
    }).resume();
  });
}
function StreamHelper$2(worker, outputType, mimeType) {
  var internalType = outputType;
  switch (outputType) {
    case "blob":
    case "arraybuffer":
      internalType = "uint8array";
      break;
    case "base64":
      internalType = "string";
      break;
  }
  try {
    this._internalType = internalType;
    this._outputType = outputType;
    this._mimeType = mimeType;
    utils$q.checkSupport(internalType);
    this._worker = worker.pipe(new ConvertWorker(internalType));
    worker.lock();
  } catch (e) {
    this._worker = new GenericWorker$9("error");
    this._worker.error(e);
  }
}
StreamHelper$2.prototype = {
  /**
   * Listen a StreamHelper, accumulate its content and concatenate it into a
   * complete block.
   * @param {Function} updateCb the update callback.
   * @return Promise the promise for the accumulation.
   */
  accumulate: function(updateCb) {
    return accumulate(this, updateCb);
  },
  /**
   * Add a listener on an event triggered on a stream.
   * @param {String} evt the name of the event
   * @param {Function} fn the listener
   * @return {StreamHelper} the current helper.
   */
  on: function(evt, fn) {
    var self2 = this;
    if (evt === "data") {
      this._worker.on(evt, function(chunk) {
        fn.call(self2, chunk.data, chunk.meta);
      });
    } else {
      this._worker.on(evt, function() {
        utils$q.delay(fn, arguments, self2);
      });
    }
    return this;
  },
  /**
   * Resume the flow of chunks.
   * @return {StreamHelper} the current helper.
   */
  resume: function() {
    utils$q.delay(this._worker.resume, [], this._worker);
    return this;
  },
  /**
   * Pause the flow of chunks.
   * @return {StreamHelper} the current helper.
   */
  pause: function() {
    this._worker.pause();
    return this;
  },
  /**
   * Return a nodejs stream for this helper.
   * @param {Function} updateCb the update callback.
   * @return {NodejsStreamOutputAdapter} the nodejs stream.
   */
  toNodejsStream: function(updateCb) {
    utils$q.checkSupport("nodestream");
    if (this._outputType !== "nodebuffer") {
      throw new Error(this._outputType + " is not supported by this method");
    }
    return new NodejsStreamOutputAdapter(this, {
      objectMode: this._outputType !== "nodebuffer"
    }, updateCb);
  }
};
var StreamHelper_1 = StreamHelper$2;
var defaults$1 = {};
defaults$1.base64 = false;
defaults$1.binary = false;
defaults$1.dir = false;
defaults$1.createFolders = true;
defaults$1.date = null;
defaults$1.compression = null;
defaults$1.compressionOptions = null;
defaults$1.comment = null;
defaults$1.unixPermissions = null;
defaults$1.dosPermissions = null;
var utils$p = requireUtils();
var GenericWorker$8 = GenericWorker_1;
var DEFAULT_BLOCK_SIZE = 16 * 1024;
function DataWorker$2(dataP) {
  GenericWorker$8.call(this, "DataWorker");
  var self2 = this;
  this.dataIsReady = false;
  this.index = 0;
  this.max = 0;
  this.data = null;
  this.type = "";
  this._tickScheduled = false;
  dataP.then(function(data) {
    self2.dataIsReady = true;
    self2.data = data;
    self2.max = data && data.length || 0;
    self2.type = utils$p.getTypeOf(data);
    if (!self2.isPaused) {
      self2._tickAndRepeat();
    }
  }, function(e) {
    self2.error(e);
  });
}
utils$p.inherits(DataWorker$2, GenericWorker$8);
DataWorker$2.prototype.cleanUp = function() {
  GenericWorker$8.prototype.cleanUp.call(this);
  this.data = null;
};
DataWorker$2.prototype.resume = function() {
  if (!GenericWorker$8.prototype.resume.call(this)) {
    return false;
  }
  if (!this._tickScheduled && this.dataIsReady) {
    this._tickScheduled = true;
    utils$p.delay(this._tickAndRepeat, [], this);
  }
  return true;
};
DataWorker$2.prototype._tickAndRepeat = function() {
  this._tickScheduled = false;
  if (this.isPaused || this.isFinished) {
    return;
  }
  this._tick();
  if (!this.isFinished) {
    utils$p.delay(this._tickAndRepeat, [], this);
    this._tickScheduled = true;
  }
};
DataWorker$2.prototype._tick = function() {
  if (this.isPaused || this.isFinished) {
    return false;
  }
  var size = DEFAULT_BLOCK_SIZE;
  var data = null, nextIndex = Math.min(this.max, this.index + size);
  if (this.index >= this.max) {
    return this.end();
  } else {
    switch (this.type) {
      case "string":
        data = this.data.substring(this.index, nextIndex);
        break;
      case "uint8array":
        data = this.data.subarray(this.index, nextIndex);
        break;
      case "array":
      case "nodebuffer":
        data = this.data.slice(this.index, nextIndex);
        break;
    }
    this.index = nextIndex;
    return this.push({
      data,
      meta: {
        percent: this.max ? this.index / this.max * 100 : 0
      }
    });
  }
};
var DataWorker_1 = DataWorker$2;
var utils$o = requireUtils();
function makeTable$1() {
  var c2, table = [];
  for (var n = 0; n < 256; n++) {
    c2 = n;
    for (var k = 0; k < 8; k++) {
      c2 = c2 & 1 ? 3988292384 ^ c2 >>> 1 : c2 >>> 1;
    }
    table[n] = c2;
  }
  return table;
}
var crcTable$2 = makeTable$1();
function crc32$5(crc2, buf, len, pos) {
  var t = crcTable$2, end = pos + len;
  crc2 = crc2 ^ -1;
  for (var i = pos; i < end; i++) {
    crc2 = crc2 >>> 8 ^ t[(crc2 ^ buf[i]) & 255];
  }
  return crc2 ^ -1;
}
function crc32str(crc2, str, len, pos) {
  var t = crcTable$2, end = pos + len;
  crc2 = crc2 ^ -1;
  for (var i = pos; i < end; i++) {
    crc2 = crc2 >>> 8 ^ t[(crc2 ^ str.charCodeAt(i)) & 255];
  }
  return crc2 ^ -1;
}
var crc32_1$1 = function crc32wrapper(input, crc2) {
  if (typeof input === "undefined" || !input.length) {
    return 0;
  }
  var isArray = utils$o.getTypeOf(input) !== "string";
  if (isArray) {
    return crc32$5(crc2 | 0, input, input.length, 0);
  } else {
    return crc32str(crc2 | 0, input, input.length, 0);
  }
};
var GenericWorker$7 = GenericWorker_1;
var crc32$4 = crc32_1$1;
var utils$n = requireUtils();
function Crc32Probe$2() {
  GenericWorker$7.call(this, "Crc32Probe");
  this.withStreamInfo("crc32", 0);
}
utils$n.inherits(Crc32Probe$2, GenericWorker$7);
Crc32Probe$2.prototype.processChunk = function(chunk) {
  this.streamInfo.crc32 = crc32$4(chunk.data, this.streamInfo.crc32 || 0);
  this.push(chunk);
};
var Crc32Probe_1 = Crc32Probe$2;
var utils$m = requireUtils();
var GenericWorker$6 = GenericWorker_1;
function DataLengthProbe$1(propName) {
  GenericWorker$6.call(this, "DataLengthProbe for " + propName);
  this.propName = propName;
  this.withStreamInfo(propName, 0);
}
utils$m.inherits(DataLengthProbe$1, GenericWorker$6);
DataLengthProbe$1.prototype.processChunk = function(chunk) {
  if (chunk) {
    var length = this.streamInfo[this.propName] || 0;
    this.streamInfo[this.propName] = length + chunk.data.length;
  }
  GenericWorker$6.prototype.processChunk.call(this, chunk);
};
var DataLengthProbe_1 = DataLengthProbe$1;
var external$1 = external$3;
var DataWorker$1 = DataWorker_1;
var Crc32Probe$1 = Crc32Probe_1;
var DataLengthProbe = DataLengthProbe_1;
function CompressedObject$3(compressedSize, uncompressedSize, crc322, compression, data) {
  this.compressedSize = compressedSize;
  this.uncompressedSize = uncompressedSize;
  this.crc32 = crc322;
  this.compression = compression;
  this.compressedContent = data;
}
CompressedObject$3.prototype = {
  /**
   * Create a worker to get the uncompressed content.
   * @return {GenericWorker} the worker.
   */
  getContentWorker: function() {
    var worker = new DataWorker$1(external$1.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new DataLengthProbe("data_length"));
    var that = this;
    worker.on("end", function() {
      if (this.streamInfo["data_length"] !== that.uncompressedSize) {
        throw new Error("Bug : uncompressed data size mismatch");
      }
    });
    return worker;
  },
  /**
   * Create a worker to get the compressed content.
   * @return {GenericWorker} the worker.
   */
  getCompressedWorker: function() {
    return new DataWorker$1(external$1.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
  }
};
CompressedObject$3.createWorkerFrom = function(uncompressedWorker, compression, compressionOptions) {
  return uncompressedWorker.pipe(new Crc32Probe$1()).pipe(new DataLengthProbe("uncompressedSize")).pipe(compression.compressWorker(compressionOptions)).pipe(new DataLengthProbe("compressedSize")).withStreamInfo("compression", compression);
};
var compressedObject = CompressedObject$3;
var StreamHelper$1 = StreamHelper_1;
var DataWorker = DataWorker_1;
var utf8$5 = utf8$6;
var CompressedObject$2 = compressedObject;
var GenericWorker$5 = GenericWorker_1;
var ZipObject$1 = function(name, data, options) {
  this.name = name;
  this.dir = options.dir;
  this.date = options.date;
  this.comment = options.comment;
  this.unixPermissions = options.unixPermissions;
  this.dosPermissions = options.dosPermissions;
  this._data = data;
  this._dataBinary = options.binary;
  this.options = {
    compression: options.compression,
    compressionOptions: options.compressionOptions
  };
};
ZipObject$1.prototype = {
  /**
   * Create an internal stream for the content of this object.
   * @param {String} type the type of each chunk.
   * @return StreamHelper the stream.
   */
  internalStream: function(type) {
    var result = null, outputType = "string";
    try {
      if (!type) {
        throw new Error("No output type specified.");
      }
      outputType = type.toLowerCase();
      var askUnicodeString = outputType === "string" || outputType === "text";
      if (outputType === "binarystring" || outputType === "text") {
        outputType = "string";
      }
      result = this._decompressWorker();
      var isUnicodeString = !this._dataBinary;
      if (isUnicodeString && !askUnicodeString) {
        result = result.pipe(new utf8$5.Utf8EncodeWorker());
      }
      if (!isUnicodeString && askUnicodeString) {
        result = result.pipe(new utf8$5.Utf8DecodeWorker());
      }
    } catch (e) {
      result = new GenericWorker$5("error");
      result.error(e);
    }
    return new StreamHelper$1(result, outputType, "");
  },
  /**
   * Prepare the content in the asked type.
   * @param {String} type the type of the result.
   * @param {Function} onUpdate a function to call on each internal update.
   * @return Promise the promise of the result.
   */
  async: function(type, onUpdate) {
    return this.internalStream(type).accumulate(onUpdate);
  },
  /**
   * Prepare the content as a nodejs stream.
   * @param {String} type the type of each chunk.
   * @param {Function} onUpdate a function to call on each internal update.
   * @return Stream the stream.
   */
  nodeStream: function(type, onUpdate) {
    return this.internalStream(type || "nodebuffer").toNodejsStream(onUpdate);
  },
  /**
   * Return a worker for the compressed content.
   * @private
   * @param {Object} compression the compression object to use.
   * @param {Object} compressionOptions the options to use when compressing.
   * @return Worker the worker.
   */
  _compressWorker: function(compression, compressionOptions) {
    if (this._data instanceof CompressedObject$2 && this._data.compression.magic === compression.magic) {
      return this._data.getCompressedWorker();
    } else {
      var result = this._decompressWorker();
      if (!this._dataBinary) {
        result = result.pipe(new utf8$5.Utf8EncodeWorker());
      }
      return CompressedObject$2.createWorkerFrom(result, compression, compressionOptions);
    }
  },
  /**
   * Return a worker for the decompressed content.
   * @private
   * @return Worker the worker.
   */
  _decompressWorker: function() {
    if (this._data instanceof CompressedObject$2) {
      return this._data.getContentWorker();
    } else if (this._data instanceof GenericWorker$5) {
      return this._data;
    } else {
      return new DataWorker(this._data);
    }
  }
};
var removedMethods = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"];
var removedFn = function() {
  throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
};
for (var i = 0; i < removedMethods.length; i++) {
  ZipObject$1.prototype[removedMethods[i]] = removedFn;
}
var zipObject = ZipObject$1;
var generate$1 = {};
var compressions$2 = {};
var flate = {};
var common = {};
(function(exports) {
  var TYPED_OK = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Int32Array !== "undefined";
  function _has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
  exports.assign = function(obj) {
    var sources = Array.prototype.slice.call(arguments, 1);
    while (sources.length) {
      var source = sources.shift();
      if (!source) {
        continue;
      }
      if (typeof source !== "object") {
        throw new TypeError(source + "must be non-object");
      }
      for (var p in source) {
        if (_has(source, p)) {
          obj[p] = source[p];
        }
      }
    }
    return obj;
  };
  exports.shrinkBuf = function(buf, size) {
    if (buf.length === size) {
      return buf;
    }
    if (buf.subarray) {
      return buf.subarray(0, size);
    }
    buf.length = size;
    return buf;
  };
  var fnTyped = {
    arraySet: function(dest, src, src_offs, len, dest_offs) {
      if (src.subarray && dest.subarray) {
        dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
        return;
      }
      for (var i = 0; i < len; i++) {
        dest[dest_offs + i] = src[src_offs + i];
      }
    },
    // Join array of chunks to single array.
    flattenChunks: function(chunks) {
      var i, l, len, pos, chunk, result;
      len = 0;
      for (i = 0, l = chunks.length; i < l; i++) {
        len += chunks[i].length;
      }
      result = new Uint8Array(len);
      pos = 0;
      for (i = 0, l = chunks.length; i < l; i++) {
        chunk = chunks[i];
        result.set(chunk, pos);
        pos += chunk.length;
      }
      return result;
    }
  };
  var fnUntyped = {
    arraySet: function(dest, src, src_offs, len, dest_offs) {
      for (var i = 0; i < len; i++) {
        dest[dest_offs + i] = src[src_offs + i];
      }
    },
    // Join array of chunks to single array.
    flattenChunks: function(chunks) {
      return [].concat.apply([], chunks);
    }
  };
  exports.setTyped = function(on) {
    if (on) {
      exports.Buf8 = Uint8Array;
      exports.Buf16 = Uint16Array;
      exports.Buf32 = Int32Array;
      exports.assign(exports, fnTyped);
    } else {
      exports.Buf8 = Array;
      exports.Buf16 = Array;
      exports.Buf32 = Array;
      exports.assign(exports, fnUntyped);
    }
  };
  exports.setTyped(TYPED_OK);
})(common);
var deflate$4 = {};
var deflate$3 = {};
var trees$1 = {};
var utils$l = common;
var Z_FIXED$1 = 4;
var Z_BINARY = 0;
var Z_TEXT = 1;
var Z_UNKNOWN$1 = 2;
function zero$1(buf) {
  var len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
}
var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES = 2;
var MIN_MATCH$1 = 3;
var MAX_MATCH$1 = 258;
var LENGTH_CODES$1 = 29;
var LITERALS$1 = 256;
var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
var D_CODES$1 = 30;
var BL_CODES$1 = 19;
var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
var MAX_BITS$1 = 15;
var Buf_size = 16;
var MAX_BL_BITS = 7;
var END_BLOCK = 256;
var REP_3_6 = 16;
var REPZ_3_10 = 17;
var REPZ_11_138 = 18;
var extra_lbits = (
  /* extra bits for each length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
);
var extra_dbits = (
  /* extra bits for each distance code */
  [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
);
var extra_blbits = (
  /* extra bits for each bit length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]
);
var bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
var DIST_CODE_LEN = 512;
var static_ltree = new Array((L_CODES$1 + 2) * 2);
zero$1(static_ltree);
var static_dtree = new Array(D_CODES$1 * 2);
zero$1(static_dtree);
var _dist_code = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
var _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
zero$1(_length_code);
var base_length = new Array(LENGTH_CODES$1);
zero$1(base_length);
var base_dist = new Array(D_CODES$1);
zero$1(base_dist);
function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
  this.static_tree = static_tree;
  this.extra_bits = extra_bits;
  this.extra_base = extra_base;
  this.elems = elems;
  this.max_length = max_length;
  this.has_stree = static_tree && static_tree.length;
}
var static_l_desc;
var static_d_desc;
var static_bl_desc;
function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;
  this.max_code = 0;
  this.stat_desc = stat_desc;
}
function d_code(dist) {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
}
function put_short(s, w) {
  s.pending_buf[s.pending++] = w & 255;
  s.pending_buf[s.pending++] = w >>> 8 & 255;
}
function send_bits(s, value, length) {
  if (s.bi_valid > Buf_size - length) {
    s.bi_buf |= value << s.bi_valid & 65535;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> Buf_size - s.bi_valid;
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= value << s.bi_valid & 65535;
    s.bi_valid += length;
  }
}
function send_code(s, c2, tree) {
  send_bits(
    s,
    tree[c2 * 2],
    tree[c2 * 2 + 1]
    /*.Len*/
  );
}
function bi_reverse(code, len) {
  var res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
}
function bi_flush(s) {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 255;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
}
function gen_bitlen(s, desc) {
  var tree = desc.dyn_tree;
  var max_code = desc.max_code;
  var stree = desc.stat_desc.static_tree;
  var has_stree = desc.stat_desc.has_stree;
  var extra = desc.stat_desc.extra_bits;
  var base = desc.stat_desc.extra_base;
  var max_length = desc.stat_desc.max_length;
  var h;
  var n, m;
  var bits;
  var xbits;
  var f;
  var overflow = 0;
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    s.bl_count[bits] = 0;
  }
  tree[s.heap[s.heap_max] * 2 + 1] = 0;
  for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1] = bits;
    if (n > max_code) {
      continue;
    }
    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2];
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1] + xbits);
    }
  }
  if (overflow === 0) {
    return;
  }
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) {
      bits--;
    }
    s.bl_count[bits]--;
    s.bl_count[bits + 1] += 2;
    s.bl_count[max_length]--;
    overflow -= 2;
  } while (overflow > 0);
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) {
        continue;
      }
      if (tree[m * 2 + 1] !== bits) {
        s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
        tree[m * 2 + 1] = bits;
      }
      n--;
    }
  }
}
function gen_codes(tree, max_code, bl_count) {
  var next_code = new Array(MAX_BITS$1 + 1);
  var code = 0;
  var bits;
  var n;
  for (bits = 1; bits <= MAX_BITS$1; bits++) {
    next_code[bits] = code = code + bl_count[bits - 1] << 1;
  }
  for (n = 0; n <= max_code; n++) {
    var len = tree[n * 2 + 1];
    if (len === 0) {
      continue;
    }
    tree[n * 2] = bi_reverse(next_code[len]++, len);
  }
}
function tr_static_init() {
  var n;
  var bits;
  var length;
  var code;
  var dist;
  var bl_count = new Array(MAX_BITS$1 + 1);
  length = 0;
  for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < 1 << extra_lbits[code]; n++) {
      _length_code[length++] = code;
    }
  }
  _length_code[length - 1] = code;
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < 1 << extra_dbits[code]; n++) {
      _dist_code[dist++] = code;
    }
  }
  dist >>= 7;
  for (; code < D_CODES$1; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < 1 << extra_dbits[code] - 7; n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    bl_count[bits] = 0;
  }
  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1] = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1] = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  gen_codes(static_ltree, L_CODES$1 + 1, bl_count);
  for (n = 0; n < D_CODES$1; n++) {
    static_dtree[n * 2 + 1] = 5;
    static_dtree[n * 2] = bi_reverse(n, 5);
  }
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);
}
function init_block(s) {
  var n;
  for (n = 0; n < L_CODES$1; n++) {
    s.dyn_ltree[n * 2] = 0;
  }
  for (n = 0; n < D_CODES$1; n++) {
    s.dyn_dtree[n * 2] = 0;
  }
  for (n = 0; n < BL_CODES$1; n++) {
    s.bl_tree[n * 2] = 0;
  }
  s.dyn_ltree[END_BLOCK * 2] = 1;
  s.opt_len = s.static_len = 0;
  s.last_lit = s.matches = 0;
}
function bi_windup(s) {
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
}
function copy_block(s, buf, len, header) {
  bi_windup(s);
  {
    put_short(s, len);
    put_short(s, ~len);
  }
  utils$l.arraySet(s.pending_buf, s.window, buf, len, s.pending);
  s.pending += len;
}
function smaller(tree, n, m, depth) {
  var _n2 = n * 2;
  var _m2 = m * 2;
  return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
}
function pqdownheap(s, tree, k) {
  var v = s.heap[k];
  var j = k << 1;
  while (j <= s.heap_len) {
    if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    if (smaller(tree, v, s.heap[j], s.depth)) {
      break;
    }
    s.heap[k] = s.heap[j];
    k = j;
    j <<= 1;
  }
  s.heap[k] = v;
}
function compress_block(s, ltree, dtree) {
  var dist;
  var lc;
  var lx = 0;
  var code;
  var extra;
  if (s.last_lit !== 0) {
    do {
      dist = s.pending_buf[s.d_buf + lx * 2] << 8 | s.pending_buf[s.d_buf + lx * 2 + 1];
      lc = s.pending_buf[s.l_buf + lx];
      lx++;
      if (dist === 0) {
        send_code(s, lc, ltree);
      } else {
        code = _length_code[lc];
        send_code(s, code + LITERALS$1 + 1, ltree);
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);
        }
        dist--;
        code = d_code(dist);
        send_code(s, code, dtree);
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);
        }
      }
    } while (lx < s.last_lit);
  }
  send_code(s, END_BLOCK, ltree);
}
function build_tree(s, desc) {
  var tree = desc.dyn_tree;
  var stree = desc.stat_desc.static_tree;
  var has_stree = desc.stat_desc.has_stree;
  var elems = desc.stat_desc.elems;
  var n, m;
  var max_code = -1;
  var node2;
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$1;
  for (n = 0; n < elems; n++) {
    if (tree[n * 2] !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;
    } else {
      tree[n * 2 + 1] = 0;
    }
  }
  while (s.heap_len < 2) {
    node2 = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
    tree[node2 * 2] = 1;
    s.depth[node2] = 0;
    s.opt_len--;
    if (has_stree) {
      s.static_len -= stree[node2 * 2 + 1];
    }
  }
  desc.max_code = max_code;
  for (n = s.heap_len >> 1; n >= 1; n--) {
    pqdownheap(s, tree, n);
  }
  node2 = elems;
  do {
    n = s.heap[
      1
      /*SMALLEST*/
    ];
    s.heap[
      1
      /*SMALLEST*/
    ] = s.heap[s.heap_len--];
    pqdownheap(
      s,
      tree,
      1
      /*SMALLEST*/
    );
    m = s.heap[
      1
      /*SMALLEST*/
    ];
    s.heap[--s.heap_max] = n;
    s.heap[--s.heap_max] = m;
    tree[node2 * 2] = tree[n * 2] + tree[m * 2];
    s.depth[node2] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1] = tree[m * 2 + 1] = node2;
    s.heap[
      1
      /*SMALLEST*/
    ] = node2++;
    pqdownheap(
      s,
      tree,
      1
      /*SMALLEST*/
    );
  } while (s.heap_len >= 2);
  s.heap[--s.heap_max] = s.heap[
    1
    /*SMALLEST*/
  ];
  gen_bitlen(s, desc);
  gen_codes(tree, max_code, s.bl_count);
}
function scan_tree(s, tree, max_code) {
  var n;
  var prevlen = -1;
  var curlen;
  var nextlen = tree[0 * 2 + 1];
  var count = 0;
  var max_count = 7;
  var min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1] = 65535;
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      s.bl_tree[curlen * 2] += count;
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        s.bl_tree[curlen * 2]++;
      }
      s.bl_tree[REP_3_6 * 2]++;
    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2]++;
    } else {
      s.bl_tree[REPZ_11_138 * 2]++;
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}
function send_tree(s, tree, max_code) {
  var n;
  var prevlen = -1;
  var curlen;
  var nextlen = tree[0 * 2 + 1];
  var count = 0;
  var max_count = 7;
  var min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      do {
        send_code(s, curlen, s.bl_tree);
      } while (--count !== 0);
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);
    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);
    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}
function build_bl_tree(s) {
  var max_blindex;
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
  build_tree(s, s.bl_desc);
  for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
      break;
    }
  }
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
}
function send_all_trees(s, lcodes, dcodes, blcodes) {
  var rank2;
  send_bits(s, lcodes - 257, 5);
  send_bits(s, dcodes - 1, 5);
  send_bits(s, blcodes - 4, 4);
  for (rank2 = 0; rank2 < blcodes; rank2++) {
    send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
  }
  send_tree(s, s.dyn_ltree, lcodes - 1);
  send_tree(s, s.dyn_dtree, dcodes - 1);
}
function detect_data_type(s) {
  var black_mask = 4093624447;
  var n;
  for (n = 0; n <= 31; n++, black_mask >>>= 1) {
    if (black_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
      return Z_BINARY;
    }
  }
  if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS$1; n++) {
    if (s.dyn_ltree[n * 2] !== 0) {
      return Z_TEXT;
    }
  }
  return Z_BINARY;
}
var static_init_done = false;
function _tr_init(s) {
  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }
  s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
  s.bi_buf = 0;
  s.bi_valid = 0;
  init_block(s);
}
function _tr_stored_block(s, buf, stored_len, last) {
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  copy_block(s, buf, stored_len);
}
function _tr_align(s) {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
}
function _tr_flush_block(s, buf, stored_len, last) {
  var opt_lenb, static_lenb;
  var max_blindex = 0;
  if (s.level > 0) {
    if (s.strm.data_type === Z_UNKNOWN$1) {
      s.strm.data_type = detect_data_type(s);
    }
    build_tree(s, s.l_desc);
    build_tree(s, s.d_desc);
    max_blindex = build_bl_tree(s);
    opt_lenb = s.opt_len + 3 + 7 >>> 3;
    static_lenb = s.static_len + 3 + 7 >>> 3;
    if (static_lenb <= opt_lenb) {
      opt_lenb = static_lenb;
    }
  } else {
    opt_lenb = static_lenb = stored_len + 5;
  }
  if (stored_len + 4 <= opt_lenb && buf !== -1) {
    _tr_stored_block(s, buf, stored_len, last);
  } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);
  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  init_block(s);
  if (last) {
    bi_windup(s);
  }
}
function _tr_tally(s, dist, lc) {
  s.pending_buf[s.d_buf + s.last_lit * 2] = dist >>> 8 & 255;
  s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 255;
  s.pending_buf[s.l_buf + s.last_lit] = lc & 255;
  s.last_lit++;
  if (dist === 0) {
    s.dyn_ltree[lc * 2]++;
  } else {
    s.matches++;
    dist--;
    s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]++;
    s.dyn_dtree[d_code(dist) * 2]++;
  }
  return s.last_lit === s.lit_bufsize - 1;
}
trees$1._tr_init = _tr_init;
trees$1._tr_stored_block = _tr_stored_block;
trees$1._tr_flush_block = _tr_flush_block;
trees$1._tr_tally = _tr_tally;
trees$1._tr_align = _tr_align;
function adler32$2(adler, buf, len, pos) {
  var s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
  while (len !== 0) {
    n = len > 2e3 ? 2e3 : len;
    len -= n;
    do {
      s1 = s1 + buf[pos++] | 0;
      s2 = s2 + s1 | 0;
    } while (--n);
    s1 %= 65521;
    s2 %= 65521;
  }
  return s1 | s2 << 16 | 0;
}
var adler32_1 = adler32$2;
function makeTable() {
  var c2, table = [];
  for (var n = 0; n < 256; n++) {
    c2 = n;
    for (var k = 0; k < 8; k++) {
      c2 = c2 & 1 ? 3988292384 ^ c2 >>> 1 : c2 >>> 1;
    }
    table[n] = c2;
  }
  return table;
}
var crcTable$1 = makeTable();
function crc32$3(crc2, buf, len, pos) {
  var t = crcTable$1, end = pos + len;
  crc2 ^= -1;
  for (var i = pos; i < end; i++) {
    crc2 = crc2 >>> 8 ^ t[(crc2 ^ buf[i]) & 255];
  }
  return crc2 ^ -1;
}
var crc32_1 = crc32$3;
var messages = {
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
};
var utils$k = common;
var trees = trees$1;
var adler32$1 = adler32_1;
var crc32$2 = crc32_1;
var msg$2 = messages;
var Z_NO_FLUSH$1 = 0;
var Z_PARTIAL_FLUSH = 1;
var Z_FULL_FLUSH = 3;
var Z_FINISH$2 = 4;
var Z_BLOCK$1 = 5;
var Z_OK$2 = 0;
var Z_STREAM_END$2 = 1;
var Z_STREAM_ERROR$1 = -2;
var Z_DATA_ERROR$1 = -3;
var Z_BUF_ERROR$1 = -5;
var Z_DEFAULT_COMPRESSION$1 = -1;
var Z_FILTERED = 1;
var Z_HUFFMAN_ONLY = 2;
var Z_RLE = 3;
var Z_FIXED = 4;
var Z_DEFAULT_STRATEGY$1 = 0;
var Z_UNKNOWN = 2;
var Z_DEFLATED$2 = 8;
var MAX_MEM_LEVEL = 9;
var MAX_WBITS$1 = 15;
var DEF_MEM_LEVEL = 8;
var LENGTH_CODES = 29;
var LITERALS = 256;
var L_CODES = LITERALS + 1 + LENGTH_CODES;
var D_CODES = 30;
var BL_CODES = 19;
var HEAP_SIZE = 2 * L_CODES + 1;
var MAX_BITS = 15;
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
var PRESET_DICT = 32;
var INIT_STATE = 42;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;
var BS_NEED_MORE = 1;
var BS_BLOCK_DONE = 2;
var BS_FINISH_STARTED = 3;
var BS_FINISH_DONE = 4;
var OS_CODE = 3;
function err(strm, errorCode) {
  strm.msg = msg$2[errorCode];
  return errorCode;
}
function rank(f) {
  return (f << 1) - (f > 4 ? 9 : 0);
}
function zero(buf) {
  var len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
}
function flush_pending(strm) {
  var s = strm.state;
  var len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) {
    return;
  }
  utils$k.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
}
function flush_block_only(s, last) {
  trees._tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
}
function put_byte(s, b) {
  s.pending_buf[s.pending++] = b;
}
function putShortMSB(s, b) {
  s.pending_buf[s.pending++] = b >>> 8 & 255;
  s.pending_buf[s.pending++] = b & 255;
}
function read_buf(strm, buf, start, size) {
  var len = strm.avail_in;
  if (len > size) {
    len = size;
  }
  if (len === 0) {
    return 0;
  }
  strm.avail_in -= len;
  utils$k.arraySet(buf, strm.input, strm.next_in, len, start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32$1(strm.adler, buf, len, start);
  } else if (strm.state.wrap === 2) {
    strm.adler = crc32$2(strm.adler, buf, len, start);
  }
  strm.next_in += len;
  strm.total_in += len;
  return len;
}
function longest_match(s, cur_match) {
  var chain_length = s.max_chain_length;
  var scan = s.strstart;
  var match;
  var len;
  var best_len = s.prev_length;
  var nice_match = s.nice_match;
  var limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
  var _win = s.window;
  var wmask = s.w_mask;
  var prev = s.prev;
  var strend = s.strstart + MAX_MATCH;
  var scan_end1 = _win[scan + best_len - 1];
  var scan_end = _win[scan + best_len];
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  if (nice_match > s.lookahead) {
    nice_match = s.lookahead;
  }
  do {
    match = cur_match;
    if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
      continue;
    }
    scan += 2;
    match++;
    do {
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;
    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1 = _win[scan + best_len - 1];
      scan_end = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
}
function fill_window(s) {
  var _w_size = s.w_size;
  var p, n, m, more, str;
  do {
    more = s.window_size - s.lookahead - s.strstart;
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
      utils$k.arraySet(s.window, s.window, _w_size, _w_size, 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      s.block_start -= _w_size;
      n = s.hash_size;
      p = n;
      do {
        m = s.head[--p];
        s.head[p] = m >= _w_size ? m - _w_size : 0;
      } while (--n);
      n = _w_size;
      p = n;
      do {
        m = s.prev[--p];
        s.prev[p] = m >= _w_size ? m - _w_size : 0;
      } while (--n);
      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + 1]) & s.hash_mask;
      while (s.insert) {
        s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
}
function deflate_stored(s, flush) {
  var max_block_size = 65535;
  if (max_block_size > s.pending_buf_size - 5) {
    max_block_size = s.pending_buf_size - 5;
  }
  for (; ; ) {
    if (s.lookahead <= 1) {
      fill_window(s);
      if (s.lookahead === 0 && flush === Z_NO_FLUSH$1) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    s.strstart += s.lookahead;
    s.lookahead = 0;
    var max_start = s.block_start + max_block_size;
    if (s.strstart === 0 || s.strstart >= max_start) {
      s.lookahead = s.strstart - max_start;
      s.strstart = max_start;
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    if (s.strstart - s.block_start >= s.w_size - MIN_LOOKAHEAD) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$2) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.strstart > s.block_start) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_NEED_MORE;
}
function deflate_fast(s, flush) {
  var hash_head;
  var bflush;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$1) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
    }
    if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
        s.match_length--;
        do {
          s.strstart++;
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        } while (--s.match_length !== 0);
        s.strstart++;
      } else {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + 1]) & s.hash_mask;
      }
    } else {
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$2) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
}
function deflate_slow(s, flush) {
  var hash_head;
  var bflush;
  var max_insert;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$1) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
    }
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;
    if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
      if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
        s.match_length = MIN_MATCH - 1;
      }
    }
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    } else if (s.match_available) {
      bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
      if (bflush) {
        flush_block_only(s, false);
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  if (s.match_available) {
    bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$2) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
}
function deflate_rle(s, flush) {
  var bflush;
  var prev;
  var scan, strend;
  var _win = s.window;
  for (; ; ) {
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$1) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
        } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$2) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
}
function deflate_huff(s, flush) {
  var bflush;
  for (; ; ) {
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH$1) {
          return BS_NEED_MORE;
        }
        break;
      }
    }
    s.match_length = 0;
    bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$2) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
}
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}
var configuration_table;
configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),
  /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),
  /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),
  /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),
  /* 3 */
  new Config(4, 4, 16, 16, deflate_slow),
  /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),
  /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),
  /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),
  /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),
  /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)
  /* 9 max compression */
];
function lm_init(s) {
  s.window_size = 2 * s.w_size;
  zero(s.head);
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;
  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
}
function DeflateState() {
  this.strm = null;
  this.status = 0;
  this.pending_buf = null;
  this.pending_buf_size = 0;
  this.pending_out = 0;
  this.pending = 0;
  this.wrap = 0;
  this.gzhead = null;
  this.gzindex = 0;
  this.method = Z_DEFLATED$2;
  this.last_flush = -1;
  this.w_size = 0;
  this.w_bits = 0;
  this.w_mask = 0;
  this.window = null;
  this.window_size = 0;
  this.prev = null;
  this.head = null;
  this.ins_h = 0;
  this.hash_size = 0;
  this.hash_bits = 0;
  this.hash_mask = 0;
  this.hash_shift = 0;
  this.block_start = 0;
  this.match_length = 0;
  this.prev_match = 0;
  this.match_available = 0;
  this.strstart = 0;
  this.match_start = 0;
  this.lookahead = 0;
  this.prev_length = 0;
  this.max_chain_length = 0;
  this.max_lazy_match = 0;
  this.level = 0;
  this.strategy = 0;
  this.good_match = 0;
  this.nice_match = 0;
  this.dyn_ltree = new utils$k.Buf16(HEAP_SIZE * 2);
  this.dyn_dtree = new utils$k.Buf16((2 * D_CODES + 1) * 2);
  this.bl_tree = new utils$k.Buf16((2 * BL_CODES + 1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);
  this.l_desc = null;
  this.d_desc = null;
  this.bl_desc = null;
  this.bl_count = new utils$k.Buf16(MAX_BITS + 1);
  this.heap = new utils$k.Buf16(2 * L_CODES + 1);
  zero(this.heap);
  this.heap_len = 0;
  this.heap_max = 0;
  this.depth = new utils$k.Buf16(2 * L_CODES + 1);
  zero(this.depth);
  this.l_buf = 0;
  this.lit_bufsize = 0;
  this.last_lit = 0;
  this.d_buf = 0;
  this.opt_len = 0;
  this.static_len = 0;
  this.matches = 0;
  this.insert = 0;
  this.bi_buf = 0;
  this.bi_valid = 0;
}
function deflateResetKeep(strm) {
  var s;
  if (!strm || !strm.state) {
    return err(strm, Z_STREAM_ERROR$1);
  }
  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;
  s = strm.state;
  s.pending = 0;
  s.pending_out = 0;
  if (s.wrap < 0) {
    s.wrap = -s.wrap;
  }
  s.status = s.wrap ? INIT_STATE : BUSY_STATE;
  strm.adler = s.wrap === 2 ? 0 : 1;
  s.last_flush = Z_NO_FLUSH$1;
  trees._tr_init(s);
  return Z_OK$2;
}
function deflateReset(strm) {
  var ret = deflateResetKeep(strm);
  if (ret === Z_OK$2) {
    lm_init(strm.state);
  }
  return ret;
}
function deflateSetHeader(strm, head) {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  if (strm.state.wrap !== 2) {
    return Z_STREAM_ERROR$1;
  }
  strm.state.gzhead = head;
  return Z_OK$2;
}
function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
  if (!strm) {
    return Z_STREAM_ERROR$1;
  }
  var wrap = 1;
  if (level === Z_DEFAULT_COMPRESSION$1) {
    level = 6;
  }
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else if (windowBits > 15) {
    wrap = 2;
    windowBits -= 16;
  }
  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED) {
    return err(strm, Z_STREAM_ERROR$1);
  }
  if (windowBits === 8) {
    windowBits = 9;
  }
  var s = new DeflateState();
  strm.state = s;
  s.strm = strm;
  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;
  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
  s.window = new utils$k.Buf8(s.w_size * 2);
  s.head = new utils$k.Buf16(s.hash_size);
  s.prev = new utils$k.Buf16(s.w_size);
  s.lit_bufsize = 1 << memLevel + 6;
  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new utils$k.Buf8(s.pending_buf_size);
  s.d_buf = 1 * s.lit_bufsize;
  s.l_buf = (1 + 2) * s.lit_bufsize;
  s.level = level;
  s.strategy = strategy;
  s.method = method;
  return deflateReset(strm);
}
function deflateInit(strm, level) {
  return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
}
function deflate$2(strm, flush) {
  var old_flush, s;
  var beg, val;
  if (!strm || !strm.state || flush > Z_BLOCK$1 || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR$1) : Z_STREAM_ERROR$1;
  }
  s = strm.state;
  if (!strm.output || !strm.input && strm.avail_in !== 0 || s.status === FINISH_STATE && flush !== Z_FINISH$2) {
    return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$1);
  }
  s.strm = strm;
  old_flush = s.last_flush;
  s.last_flush = flush;
  if (s.status === INIT_STATE) {
    if (s.wrap === 2) {
      strm.adler = 0;
      put_byte(s, 31);
      put_byte(s, 139);
      put_byte(s, 8);
      if (!s.gzhead) {
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
        put_byte(s, OS_CODE);
        s.status = BUSY_STATE;
      } else {
        put_byte(
          s,
          (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16)
        );
        put_byte(s, s.gzhead.time & 255);
        put_byte(s, s.gzhead.time >> 8 & 255);
        put_byte(s, s.gzhead.time >> 16 & 255);
        put_byte(s, s.gzhead.time >> 24 & 255);
        put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
        put_byte(s, s.gzhead.os & 255);
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 255);
          put_byte(s, s.gzhead.extra.length >> 8 & 255);
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending, 0);
        }
        s.gzindex = 0;
        s.status = EXTRA_STATE;
      }
    } else {
      var header = Z_DEFLATED$2 + (s.w_bits - 8 << 4) << 8;
      var level_flags = -1;
      if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
        level_flags = 0;
      } else if (s.level < 6) {
        level_flags = 1;
      } else if (s.level === 6) {
        level_flags = 2;
      } else {
        level_flags = 3;
      }
      header |= level_flags << 6;
      if (s.strstart !== 0) {
        header |= PRESET_DICT;
      }
      header += 31 - header % 31;
      s.status = BUSY_STATE;
      putShortMSB(s, header);
      if (s.strstart !== 0) {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 65535);
      }
      strm.adler = 1;
    }
  }
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra) {
      beg = s.pending;
      while (s.gzindex < (s.gzhead.extra.length & 65535)) {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            break;
          }
        }
        put_byte(s, s.gzhead.extra[s.gzindex] & 255);
        s.gzindex++;
      }
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (s.gzindex === s.gzhead.extra.length) {
        s.gzindex = 0;
        s.status = NAME_STATE;
      }
    } else {
      s.status = NAME_STATE;
    }
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name) {
      beg = s.pending;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.gzindex = 0;
        s.status = COMMENT_STATE;
      }
    } else {
      s.status = COMMENT_STATE;
    }
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment) {
      beg = s.pending;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.status = HCRC_STATE;
      }
    } else {
      s.status = HCRC_STATE;
    }
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
      }
      if (s.pending + 2 <= s.pending_buf_size) {
        put_byte(s, strm.adler & 255);
        put_byte(s, strm.adler >> 8 & 255);
        strm.adler = 0;
        s.status = BUSY_STATE;
      }
    } else {
      s.status = BUSY_STATE;
    }
  }
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      s.last_flush = -1;
      return Z_OK$2;
    }
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH$2) {
    return err(strm, Z_BUF_ERROR$1);
  }
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR$1);
  }
  if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH$1 && s.status !== FINISH_STATE) {
    var bstate = s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
      }
      return Z_OK$2;
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        trees._tr_align(s);
      } else if (flush !== Z_BLOCK$1) {
        trees._tr_stored_block(s, 0, 0, false);
        if (flush === Z_FULL_FLUSH) {
          zero(s.head);
          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK$2;
      }
    }
  }
  if (flush !== Z_FINISH$2) {
    return Z_OK$2;
  }
  if (s.wrap <= 0) {
    return Z_STREAM_END$2;
  }
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 255);
    put_byte(s, strm.adler >> 8 & 255);
    put_byte(s, strm.adler >> 16 & 255);
    put_byte(s, strm.adler >> 24 & 255);
    put_byte(s, strm.total_in & 255);
    put_byte(s, strm.total_in >> 8 & 255);
    put_byte(s, strm.total_in >> 16 & 255);
    put_byte(s, strm.total_in >> 24 & 255);
  } else {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 65535);
  }
  flush_pending(strm);
  if (s.wrap > 0) {
    s.wrap = -s.wrap;
  }
  return s.pending !== 0 ? Z_OK$2 : Z_STREAM_END$2;
}
function deflateEnd(strm) {
  var status;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  status = strm.state.status;
  if (status !== INIT_STATE && status !== EXTRA_STATE && status !== NAME_STATE && status !== COMMENT_STATE && status !== HCRC_STATE && status !== BUSY_STATE && status !== FINISH_STATE) {
    return err(strm, Z_STREAM_ERROR$1);
  }
  strm.state = null;
  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$1) : Z_OK$2;
}
function deflateSetDictionary(strm, dictionary) {
  var dictLength = dictionary.length;
  var s;
  var str, n;
  var wrap;
  var avail;
  var next;
  var input;
  var tmpDict;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  s = strm.state;
  wrap = s.wrap;
  if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
    return Z_STREAM_ERROR$1;
  }
  if (wrap === 1) {
    strm.adler = adler32$1(strm.adler, dictionary, dictLength, 0);
  }
  s.wrap = 0;
  if (dictLength >= s.w_size) {
    if (wrap === 0) {
      zero(s.head);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    tmpDict = new utils$k.Buf8(s.w_size);
    utils$k.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  avail = strm.avail_in;
  next = strm.next_in;
  input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    str = s.strstart;
    n = s.lookahead - (MIN_MATCH - 1);
    do {
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
      s.prev[str & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = str;
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK$2;
}
deflate$3.deflateInit = deflateInit;
deflate$3.deflateInit2 = deflateInit2;
deflate$3.deflateReset = deflateReset;
deflate$3.deflateResetKeep = deflateResetKeep;
deflate$3.deflateSetHeader = deflateSetHeader;
deflate$3.deflate = deflate$2;
deflate$3.deflateEnd = deflateEnd;
deflate$3.deflateSetDictionary = deflateSetDictionary;
deflate$3.deflateInfo = "pako deflate (from Nodeca project)";
var strings$2 = {};
var utils$j = common;
var STR_APPLY_OK = true;
var STR_APPLY_UIA_OK = true;
try {
  String.fromCharCode.apply(null, [0]);
} catch (__) {
  STR_APPLY_OK = false;
}
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch (__) {
  STR_APPLY_UIA_OK = false;
}
var _utf8len = new utils$j.Buf8(256);
for (var q = 0; q < 256; q++) {
  _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
}
_utf8len[254] = _utf8len[254] = 1;
strings$2.string2buf = function(str) {
  var buf, c2, c22, m_pos, i, str_len = str.length, buf_len = 0;
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c2 = str.charCodeAt(m_pos);
    if ((c2 & 64512) === 55296 && m_pos + 1 < str_len) {
      c22 = str.charCodeAt(m_pos + 1);
      if ((c22 & 64512) === 56320) {
        c2 = 65536 + (c2 - 55296 << 10) + (c22 - 56320);
        m_pos++;
      }
    }
    buf_len += c2 < 128 ? 1 : c2 < 2048 ? 2 : c2 < 65536 ? 3 : 4;
  }
  buf = new utils$j.Buf8(buf_len);
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c2 = str.charCodeAt(m_pos);
    if ((c2 & 64512) === 55296 && m_pos + 1 < str_len) {
      c22 = str.charCodeAt(m_pos + 1);
      if ((c22 & 64512) === 56320) {
        c2 = 65536 + (c2 - 55296 << 10) + (c22 - 56320);
        m_pos++;
      }
    }
    if (c2 < 128) {
      buf[i++] = c2;
    } else if (c2 < 2048) {
      buf[i++] = 192 | c2 >>> 6;
      buf[i++] = 128 | c2 & 63;
    } else if (c2 < 65536) {
      buf[i++] = 224 | c2 >>> 12;
      buf[i++] = 128 | c2 >>> 6 & 63;
      buf[i++] = 128 | c2 & 63;
    } else {
      buf[i++] = 240 | c2 >>> 18;
      buf[i++] = 128 | c2 >>> 12 & 63;
      buf[i++] = 128 | c2 >>> 6 & 63;
      buf[i++] = 128 | c2 & 63;
    }
  }
  return buf;
};
function buf2binstring(buf, len) {
  if (len < 65534) {
    if (buf.subarray && STR_APPLY_UIA_OK || !buf.subarray && STR_APPLY_OK) {
      return String.fromCharCode.apply(null, utils$j.shrinkBuf(buf, len));
    }
  }
  var result = "";
  for (var i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
}
strings$2.buf2binstring = function(buf) {
  return buf2binstring(buf, buf.length);
};
strings$2.binstring2buf = function(str) {
  var buf = new utils$j.Buf8(str.length);
  for (var i = 0, len = buf.length; i < len; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf;
};
strings$2.buf2string = function(buf, max) {
  var i, out2, c2, c_len;
  var len = max || buf.length;
  var utf16buf = new Array(len * 2);
  for (out2 = 0, i = 0; i < len; ) {
    c2 = buf[i++];
    if (c2 < 128) {
      utf16buf[out2++] = c2;
      continue;
    }
    c_len = _utf8len[c2];
    if (c_len > 4) {
      utf16buf[out2++] = 65533;
      i += c_len - 1;
      continue;
    }
    c2 &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
    while (c_len > 1 && i < len) {
      c2 = c2 << 6 | buf[i++] & 63;
      c_len--;
    }
    if (c_len > 1) {
      utf16buf[out2++] = 65533;
      continue;
    }
    if (c2 < 65536) {
      utf16buf[out2++] = c2;
    } else {
      c2 -= 65536;
      utf16buf[out2++] = 55296 | c2 >> 10 & 1023;
      utf16buf[out2++] = 56320 | c2 & 1023;
    }
  }
  return buf2binstring(utf16buf, out2);
};
strings$2.utf8border = function(buf, max) {
  var pos;
  max = max || buf.length;
  if (max > buf.length) {
    max = buf.length;
  }
  pos = max - 1;
  while (pos >= 0 && (buf[pos] & 192) === 128) {
    pos--;
  }
  if (pos < 0) {
    return max;
  }
  if (pos === 0) {
    return max;
  }
  return pos + _utf8len[buf[pos]] > max ? pos : max;
};
function ZStream$2() {
  this.input = null;
  this.next_in = 0;
  this.avail_in = 0;
  this.total_in = 0;
  this.output = null;
  this.next_out = 0;
  this.avail_out = 0;
  this.total_out = 0;
  this.msg = "";
  this.state = null;
  this.data_type = 2;
  this.adler = 0;
}
var zstream = ZStream$2;
var zlib_deflate = deflate$3;
var utils$i = common;
var strings$1 = strings$2;
var msg$1 = messages;
var ZStream$1 = zstream;
var toString$1 = Object.prototype.toString;
var Z_NO_FLUSH = 0;
var Z_FINISH$1 = 4;
var Z_OK$1 = 0;
var Z_STREAM_END$1 = 1;
var Z_SYNC_FLUSH = 2;
var Z_DEFAULT_COMPRESSION = -1;
var Z_DEFAULT_STRATEGY = 0;
var Z_DEFLATED$1 = 8;
function Deflate(options) {
  if (!(this instanceof Deflate)) return new Deflate(options);
  this.options = utils$i.assign({
    level: Z_DEFAULT_COMPRESSION,
    method: Z_DEFLATED$1,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Z_DEFAULT_STRATEGY,
    to: ""
  }, options || {});
  var opt = this.options;
  if (opt.raw && opt.windowBits > 0) {
    opt.windowBits = -opt.windowBits;
  } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
    opt.windowBits += 16;
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new ZStream$1();
  this.strm.avail_out = 0;
  var status = zlib_deflate.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy
  );
  if (status !== Z_OK$1) {
    throw new Error(msg$1[status]);
  }
  if (opt.header) {
    zlib_deflate.deflateSetHeader(this.strm, opt.header);
  }
  if (opt.dictionary) {
    var dict;
    if (typeof opt.dictionary === "string") {
      dict = strings$1.string2buf(opt.dictionary);
    } else if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }
    status = zlib_deflate.deflateSetDictionary(this.strm, dict);
    if (status !== Z_OK$1) {
      throw new Error(msg$1[status]);
    }
    this._dict_set = true;
  }
}
Deflate.prototype.push = function(data, mode2) {
  var strm = this.strm;
  var chunkSize = this.options.chunkSize;
  var status, _mode;
  if (this.ended) {
    return false;
  }
  _mode = mode2 === ~~mode2 ? mode2 : mode2 === true ? Z_FINISH$1 : Z_NO_FLUSH;
  if (typeof data === "string") {
    strm.input = strings$1.string2buf(data);
  } else if (toString$1.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  do {
    if (strm.avail_out === 0) {
      strm.output = new utils$i.Buf8(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status = zlib_deflate.deflate(strm, _mode);
    if (status !== Z_STREAM_END$1 && status !== Z_OK$1) {
      this.onEnd(status);
      this.ended = true;
      return false;
    }
    if (strm.avail_out === 0 || strm.avail_in === 0 && (_mode === Z_FINISH$1 || _mode === Z_SYNC_FLUSH)) {
      if (this.options.to === "string") {
        this.onData(strings$1.buf2binstring(utils$i.shrinkBuf(strm.output, strm.next_out)));
      } else {
        this.onData(utils$i.shrinkBuf(strm.output, strm.next_out));
      }
    }
  } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== Z_STREAM_END$1);
  if (_mode === Z_FINISH$1) {
    status = zlib_deflate.deflateEnd(this.strm);
    this.onEnd(status);
    this.ended = true;
    return status === Z_OK$1;
  }
  if (_mode === Z_SYNC_FLUSH) {
    this.onEnd(Z_OK$1);
    strm.avail_out = 0;
    return true;
  }
  return true;
};
Deflate.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Deflate.prototype.onEnd = function(status) {
  if (status === Z_OK$1) {
    if (this.options.to === "string") {
      this.result = this.chunks.join("");
    } else {
      this.result = utils$i.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
function deflate$1(input, options) {
  var deflator = new Deflate(options);
  deflator.push(input, true);
  if (deflator.err) {
    throw deflator.msg || msg$1[deflator.err];
  }
  return deflator.result;
}
function deflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return deflate$1(input, options);
}
function gzip(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate$1(input, options);
}
deflate$4.Deflate = Deflate;
deflate$4.deflate = deflate$1;
deflate$4.deflateRaw = deflateRaw;
deflate$4.gzip = gzip;
var inflate$4 = {};
var inflate$3 = {};
var BAD$1 = 30;
var TYPE$1 = 12;
var inffast = function inflate_fast(strm, start) {
  var state;
  var _in;
  var last;
  var _out;
  var beg;
  var end;
  var dmax;
  var wsize;
  var whave;
  var wnext;
  var s_window;
  var hold;
  var bits;
  var lcode;
  var dcode;
  var lmask;
  var dmask;
  var here;
  var op;
  var len;
  var dist;
  var from;
  var from_source;
  var input, output;
  state = strm.state;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  dmax = state.dmax;
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;
  top:
    do {
      if (bits < 15) {
        hold += input[_in++] << bits;
        bits += 8;
        hold += input[_in++] << bits;
        bits += 8;
      }
      here = lcode[hold & lmask];
      dolen:
        for (; ; ) {
          op = here >>> 24;
          hold >>>= op;
          bits -= op;
          op = here >>> 16 & 255;
          if (op === 0) {
            output[_out++] = here & 65535;
          } else if (op & 16) {
            len = here & 65535;
            op &= 15;
            if (op) {
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
              len += hold & (1 << op) - 1;
              hold >>>= op;
              bits -= op;
            }
            if (bits < 15) {
              hold += input[_in++] << bits;
              bits += 8;
              hold += input[_in++] << bits;
              bits += 8;
            }
            here = dcode[hold & dmask];
            dodist:
              for (; ; ) {
                op = here >>> 24;
                hold >>>= op;
                bits -= op;
                op = here >>> 16 & 255;
                if (op & 16) {
                  dist = here & 65535;
                  op &= 15;
                  if (bits < op) {
                    hold += input[_in++] << bits;
                    bits += 8;
                    if (bits < op) {
                      hold += input[_in++] << bits;
                      bits += 8;
                    }
                  }
                  dist += hold & (1 << op) - 1;
                  if (dist > dmax) {
                    strm.msg = "invalid distance too far back";
                    state.mode = BAD$1;
                    break top;
                  }
                  hold >>>= op;
                  bits -= op;
                  op = _out - beg;
                  if (dist > op) {
                    op = dist - op;
                    if (op > whave) {
                      if (state.sane) {
                        strm.msg = "invalid distance too far back";
                        state.mode = BAD$1;
                        break top;
                      }
                    }
                    from = 0;
                    from_source = s_window;
                    if (wnext === 0) {
                      from += wsize - op;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = _out - dist;
                        from_source = output;
                      }
                    } else if (wnext < op) {
                      from += wsize + wnext - op;
                      op -= wnext;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = 0;
                        if (wnext < len) {
                          op = wnext;
                          len -= op;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op);
                          from = _out - dist;
                          from_source = output;
                        }
                      }
                    } else {
                      from += wnext - op;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = _out - dist;
                        from_source = output;
                      }
                    }
                    while (len > 2) {
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      len -= 3;
                    }
                    if (len) {
                      output[_out++] = from_source[from++];
                      if (len > 1) {
                        output[_out++] = from_source[from++];
                      }
                    }
                  } else {
                    from = _out - dist;
                    do {
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      len -= 3;
                    } while (len > 2);
                    if (len) {
                      output[_out++] = output[from++];
                      if (len > 1) {
                        output[_out++] = output[from++];
                      }
                    }
                  }
                } else if ((op & 64) === 0) {
                  here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                  continue dodist;
                } else {
                  strm.msg = "invalid distance code";
                  state.mode = BAD$1;
                  break top;
                }
                break;
              }
          } else if ((op & 64) === 0) {
            here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
            continue dolen;
          } else if (op & 32) {
            state.mode = TYPE$1;
            break top;
          } else {
            strm.msg = "invalid literal/length code";
            state.mode = BAD$1;
            break top;
          }
          break;
        }
    } while (_in < last && _out < end);
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state.hold = hold;
  state.bits = bits;
  return;
};
var utils$h = common;
var MAXBITS = 15;
var ENOUGH_LENS$1 = 852;
var ENOUGH_DISTS$1 = 592;
var CODES$1 = 0;
var LENS$1 = 1;
var DISTS$1 = 2;
var lbase = [
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
];
var lext = [
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
];
var dbase = [
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
];
var dext = [
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
];
var inftrees = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts) {
  var bits = opts.bits;
  var len = 0;
  var sym = 0;
  var min = 0, max = 0;
  var root = 0;
  var curr = 0;
  var drop = 0;
  var left = 0;
  var used = 0;
  var huff = 0;
  var incr;
  var fill;
  var low;
  var mask;
  var next;
  var base = null;
  var base_index = 0;
  var end;
  var count = new utils$h.Buf16(MAXBITS + 1);
  var offs = new utils$h.Buf16(MAXBITS + 1);
  var extra = null;
  var extra_index = 0;
  var here_bits, here_op, here_val;
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) {
      break;
    }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    opts.bits = 1;
    return 0;
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) {
      break;
    }
  }
  if (root < min) {
    root = min;
  }
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }
  }
  if (left > 0 && (type === CODES$1 || max !== 1)) {
    return -1;
  }
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }
  if (type === CODES$1) {
    base = extra = work;
    end = 19;
  } else if (type === LENS$1) {
    base = lbase;
    base_index -= 257;
    extra = lext;
    extra_index -= 257;
    end = 256;
  } else {
    base = dbase;
    extra = dext;
    end = -1;
  }
  huff = 0;
  sym = 0;
  len = min;
  next = table_index;
  curr = root;
  drop = 0;
  low = -1;
  used = 1 << root;
  mask = used - 1;
  if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
    return 1;
  }
  for (; ; ) {
    here_bits = len - drop;
    if (work[sym] < end) {
      here_op = 0;
      here_val = work[sym];
    } else if (work[sym] > end) {
      here_op = extra[extra_index + work[sym]];
      here_val = base[base_index + work[sym]];
    } else {
      here_op = 32 + 64;
      here_val = 0;
    }
    incr = 1 << len - drop;
    fill = 1 << curr;
    min = fill;
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
    } while (fill !== 0);
    incr = 1 << len - 1;
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }
    sym++;
    if (--count[len] === 0) {
      if (len === max) {
        break;
      }
      len = lens[lens_index + work[sym]];
    }
    if (len > root && (huff & mask) !== low) {
      if (drop === 0) {
        drop = root;
      }
      next += min;
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) {
          break;
        }
        curr++;
        left <<= 1;
      }
      used += 1 << curr;
      if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
        return 1;
      }
      low = huff & mask;
      table[low] = root << 24 | curr << 16 | next - table_index | 0;
    }
  }
  if (huff !== 0) {
    table[next + huff] = len - drop << 24 | 64 << 16 | 0;
  }
  opts.bits = root;
  return 0;
};
var utils$g = common;
var adler32 = adler32_1;
var crc32$1 = crc32_1;
var inflate_fast2 = inffast;
var inflate_table2 = inftrees;
var CODES = 0;
var LENS = 1;
var DISTS = 2;
var Z_FINISH = 4;
var Z_BLOCK = 5;
var Z_TREES = 6;
var Z_OK = 0;
var Z_STREAM_END = 1;
var Z_NEED_DICT = 2;
var Z_STREAM_ERROR = -2;
var Z_DATA_ERROR = -3;
var Z_MEM_ERROR = -4;
var Z_BUF_ERROR = -5;
var Z_DEFLATED = 8;
var HEAD = 1;
var FLAGS = 2;
var TIME = 3;
var OS = 4;
var EXLEN = 5;
var EXTRA = 6;
var NAME = 7;
var COMMENT = 8;
var HCRC = 9;
var DICTID = 10;
var DICT = 11;
var TYPE = 12;
var TYPEDO = 13;
var STORED = 14;
var COPY_ = 15;
var COPY = 16;
var TABLE = 17;
var LENLENS = 18;
var CODELENS = 19;
var LEN_ = 20;
var LEN = 21;
var LENEXT = 22;
var DIST = 23;
var DISTEXT = 24;
var MATCH = 25;
var LIT = 26;
var CHECK = 27;
var LENGTH = 28;
var DONE = 29;
var BAD = 30;
var MEM = 31;
var SYNC = 32;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
var MAX_WBITS = 15;
var DEF_WBITS = MAX_WBITS;
function zswap32(q) {
  return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
}
function InflateState() {
  this.mode = 0;
  this.last = false;
  this.wrap = 0;
  this.havedict = false;
  this.flags = 0;
  this.dmax = 0;
  this.check = 0;
  this.total = 0;
  this.head = null;
  this.wbits = 0;
  this.wsize = 0;
  this.whave = 0;
  this.wnext = 0;
  this.window = null;
  this.hold = 0;
  this.bits = 0;
  this.length = 0;
  this.offset = 0;
  this.extra = 0;
  this.lencode = null;
  this.distcode = null;
  this.lenbits = 0;
  this.distbits = 0;
  this.ncode = 0;
  this.nlen = 0;
  this.ndist = 0;
  this.have = 0;
  this.next = null;
  this.lens = new utils$g.Buf16(320);
  this.work = new utils$g.Buf16(288);
  this.lendyn = null;
  this.distdyn = null;
  this.sane = 0;
  this.back = 0;
  this.was = 0;
}
function inflateResetKeep(strm) {
  var state;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = "";
  if (state.wrap) {
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.dmax = 32768;
  state.head = null;
  state.hold = 0;
  state.bits = 0;
  state.lencode = state.lendyn = new utils$g.Buf32(ENOUGH_LENS);
  state.distcode = state.distdyn = new utils$g.Buf32(ENOUGH_DISTS);
  state.sane = 1;
  state.back = -1;
  return Z_OK;
}
function inflateReset(strm) {
  var state;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);
}
function inflateReset2(strm, windowBits) {
  var wrap;
  var state;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else {
    wrap = (windowBits >> 4) + 1;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
}
function inflateInit2(strm, windowBits) {
  var ret;
  var state;
  if (!strm) {
    return Z_STREAM_ERROR;
  }
  state = new InflateState();
  strm.state = state;
  state.window = null;
  ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK) {
    strm.state = null;
  }
  return ret;
}
function inflateInit(strm) {
  return inflateInit2(strm, DEF_WBITS);
}
var virgin = true;
var lenfix, distfix;
function fixedtables(state) {
  if (virgin) {
    var sym;
    lenfix = new utils$g.Buf32(512);
    distfix = new utils$g.Buf32(32);
    sym = 0;
    while (sym < 144) {
      state.lens[sym++] = 8;
    }
    while (sym < 256) {
      state.lens[sym++] = 9;
    }
    while (sym < 280) {
      state.lens[sym++] = 7;
    }
    while (sym < 288) {
      state.lens[sym++] = 8;
    }
    inflate_table2(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
    sym = 0;
    while (sym < 32) {
      state.lens[sym++] = 5;
    }
    inflate_table2(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
    virgin = false;
  }
  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
}
function updatewindow(strm, src, end, copy) {
  var dist;
  var state = strm.state;
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;
    state.window = new utils$g.Buf8(state.wsize);
  }
  if (copy >= state.wsize) {
    utils$g.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
    state.wnext = 0;
    state.whave = state.wsize;
  } else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    utils$g.arraySet(state.window, src, end - copy, dist, state.wnext);
    copy -= dist;
    if (copy) {
      utils$g.arraySet(state.window, src, end - copy, copy, 0);
      state.wnext = copy;
      state.whave = state.wsize;
    } else {
      state.wnext += dist;
      if (state.wnext === state.wsize) {
        state.wnext = 0;
      }
      if (state.whave < state.wsize) {
        state.whave += dist;
      }
    }
  }
  return 0;
}
function inflate$2(strm, flush) {
  var state;
  var input, output;
  var next;
  var put;
  var have, left;
  var hold;
  var bits;
  var _in, _out;
  var copy;
  var from;
  var from_source;
  var here = 0;
  var here_bits, here_op, here_val;
  var last_bits, last_op, last_val;
  var len;
  var ret;
  var hbuf = new utils$g.Buf8(4);
  var opts;
  var n;
  var order = (
    /* permutation of code lengths */
    [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
  );
  if (!strm || !strm.state || !strm.output || !strm.input && strm.avail_in !== 0) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  if (state.mode === TYPE) {
    state.mode = TYPEDO;
  }
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  _in = have;
  _out = left;
  ret = Z_OK;
  inf_leave:
    for (; ; ) {
      switch (state.mode) {
        case HEAD:
          if (state.wrap === 0) {
            state.mode = TYPEDO;
            break;
          }
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.wrap & 2 && hold === 35615) {
            state.check = 0;
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32$1(state.check, hbuf, 2, 0);
            hold = 0;
            bits = 0;
            state.mode = FLAGS;
            break;
          }
          state.flags = 0;
          if (state.head) {
            state.head.done = false;
          }
          if (!(state.wrap & 1) || /* check if zlib header allowed */
          (((hold & 255) << 8) + (hold >> 8)) % 31) {
            strm.msg = "incorrect header check";
            state.mode = BAD;
            break;
          }
          if ((hold & 15) !== Z_DEFLATED) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          hold >>>= 4;
          bits -= 4;
          len = (hold & 15) + 8;
          if (state.wbits === 0) {
            state.wbits = len;
          } else if (len > state.wbits) {
            strm.msg = "invalid window size";
            state.mode = BAD;
            break;
          }
          state.dmax = 1 << len;
          strm.adler = state.check = 1;
          state.mode = hold & 512 ? DICTID : TYPE;
          hold = 0;
          bits = 0;
          break;
        case FLAGS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.flags = hold;
          if ((state.flags & 255) !== Z_DEFLATED) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          if (state.flags & 57344) {
            strm.msg = "unknown header flags set";
            state.mode = BAD;
            break;
          }
          if (state.head) {
            state.head.text = hold >> 8 & 1;
          }
          if (state.flags & 512) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32$1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = TIME;
        case TIME:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.time = hold;
          }
          if (state.flags & 512) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            hbuf[2] = hold >>> 16 & 255;
            hbuf[3] = hold >>> 24 & 255;
            state.check = crc32$1(state.check, hbuf, 4, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = OS;
        case OS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.xflags = hold & 255;
            state.head.os = hold >> 8;
          }
          if (state.flags & 512) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32$1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = EXLEN;
        case EXLEN:
          if (state.flags & 1024) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length = hold;
            if (state.head) {
              state.head.extra_len = hold;
            }
            if (state.flags & 512) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32$1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
          } else if (state.head) {
            state.head.extra = null;
          }
          state.mode = EXTRA;
        case EXTRA:
          if (state.flags & 1024) {
            copy = state.length;
            if (copy > have) {
              copy = have;
            }
            if (copy) {
              if (state.head) {
                len = state.head.extra_len - state.length;
                if (!state.head.extra) {
                  state.head.extra = new Array(state.head.extra_len);
                }
                utils$g.arraySet(
                  state.head.extra,
                  input,
                  next,
                  // extra field is limited to 65536 bytes
                  // - no need for additional size check
                  copy,
                  /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                  len
                );
              }
              if (state.flags & 512) {
                state.check = crc32$1(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              state.length -= copy;
            }
            if (state.length) {
              break inf_leave;
            }
          }
          state.length = 0;
          state.mode = NAME;
        case NAME:
          if (state.flags & 2048) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) {
                state.head.name += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 512) {
              state.check = crc32$1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.name = null;
          }
          state.length = 0;
          state.mode = COMMENT;
        case COMMENT:
          if (state.flags & 4096) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) {
                state.head.comment += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 512) {
              state.check = crc32$1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.comment = null;
          }
          state.mode = HCRC;
        case HCRC:
          if (state.flags & 512) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (hold !== (state.check & 65535)) {
              strm.msg = "header crc mismatch";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          if (state.head) {
            state.head.hcrc = state.flags >> 9 & 1;
            state.head.done = true;
          }
          strm.adler = state.check = 0;
          state.mode = TYPE;
          break;
        case DICTID:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          strm.adler = state.check = zswap32(hold);
          hold = 0;
          bits = 0;
          state.mode = DICT;
        case DICT:
          if (state.havedict === 0) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            return Z_NEED_DICT;
          }
          strm.adler = state.check = 1;
          state.mode = TYPE;
        case TYPE:
          if (flush === Z_BLOCK || flush === Z_TREES) {
            break inf_leave;
          }
        case TYPEDO:
          if (state.last) {
            hold >>>= bits & 7;
            bits -= bits & 7;
            state.mode = CHECK;
            break;
          }
          while (bits < 3) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.last = hold & 1;
          hold >>>= 1;
          bits -= 1;
          switch (hold & 3) {
            case 0:
              state.mode = STORED;
              break;
            case 1:
              fixedtables(state);
              state.mode = LEN_;
              if (flush === Z_TREES) {
                hold >>>= 2;
                bits -= 2;
                break inf_leave;
              }
              break;
            case 2:
              state.mode = TABLE;
              break;
            case 3:
              strm.msg = "invalid block type";
              state.mode = BAD;
          }
          hold >>>= 2;
          bits -= 2;
          break;
        case STORED:
          hold >>>= bits & 7;
          bits -= bits & 7;
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
            strm.msg = "invalid stored block lengths";
            state.mode = BAD;
            break;
          }
          state.length = hold & 65535;
          hold = 0;
          bits = 0;
          state.mode = COPY_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        case COPY_:
          state.mode = COPY;
        case COPY:
          copy = state.length;
          if (copy) {
            if (copy > have) {
              copy = have;
            }
            if (copy > left) {
              copy = left;
            }
            if (copy === 0) {
              break inf_leave;
            }
            utils$g.arraySet(output, input, next, copy, put);
            have -= copy;
            next += copy;
            left -= copy;
            put += copy;
            state.length -= copy;
            break;
          }
          state.mode = TYPE;
          break;
        case TABLE:
          while (bits < 14) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.nlen = (hold & 31) + 257;
          hold >>>= 5;
          bits -= 5;
          state.ndist = (hold & 31) + 1;
          hold >>>= 5;
          bits -= 5;
          state.ncode = (hold & 15) + 4;
          hold >>>= 4;
          bits -= 4;
          if (state.nlen > 286 || state.ndist > 30) {
            strm.msg = "too many length or distance symbols";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = LENLENS;
        case LENLENS:
          while (state.have < state.ncode) {
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.lens[order[state.have++]] = hold & 7;
            hold >>>= 3;
            bits -= 3;
          }
          while (state.have < 19) {
            state.lens[order[state.have++]] = 0;
          }
          state.lencode = state.lendyn;
          state.lenbits = 7;
          opts = { bits: state.lenbits };
          ret = inflate_table2(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid code lengths set";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = CODELENS;
        case CODELENS:
          while (state.have < state.nlen + state.ndist) {
            for (; ; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_val < 16) {
              hold >>>= here_bits;
              bits -= here_bits;
              state.lens[state.have++] = here_val;
            } else {
              if (here_val === 16) {
                n = here_bits + 2;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                if (state.have === 0) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD;
                  break;
                }
                len = state.lens[state.have - 1];
                copy = 3 + (hold & 3);
                hold >>>= 2;
                bits -= 2;
              } else if (here_val === 17) {
                n = here_bits + 3;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 3 + (hold & 7);
                hold >>>= 3;
                bits -= 3;
              } else {
                n = here_bits + 7;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 11 + (hold & 127);
                hold >>>= 7;
                bits -= 7;
              }
              if (state.have + copy > state.nlen + state.ndist) {
                strm.msg = "invalid bit length repeat";
                state.mode = BAD;
                break;
              }
              while (copy--) {
                state.lens[state.have++] = len;
              }
            }
          }
          if (state.mode === BAD) {
            break;
          }
          if (state.lens[256] === 0) {
            strm.msg = "invalid code -- missing end-of-block";
            state.mode = BAD;
            break;
          }
          state.lenbits = 9;
          opts = { bits: state.lenbits };
          ret = inflate_table2(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid literal/lengths set";
            state.mode = BAD;
            break;
          }
          state.distbits = 6;
          state.distcode = state.distdyn;
          opts = { bits: state.distbits };
          ret = inflate_table2(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
          state.distbits = opts.bits;
          if (ret) {
            strm.msg = "invalid distances set";
            state.mode = BAD;
            break;
          }
          state.mode = LEN_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        case LEN_:
          state.mode = LEN;
        case LEN:
          if (have >= 6 && left >= 258) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            inflate_fast2(strm, _out);
            put = strm.next_out;
            output = strm.output;
            left = strm.avail_out;
            next = strm.next_in;
            input = strm.input;
            have = strm.avail_in;
            hold = state.hold;
            bits = state.bits;
            if (state.mode === TYPE) {
              state.back = -1;
            }
            break;
          }
          state.back = 0;
          for (; ; ) {
            here = state.lencode[hold & (1 << state.lenbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (here_op && (here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          state.length = here_val;
          if (here_op === 0) {
            state.mode = LIT;
            break;
          }
          if (here_op & 32) {
            state.back = -1;
            state.mode = TYPE;
            break;
          }
          if (here_op & 64) {
            strm.msg = "invalid literal/length code";
            state.mode = BAD;
            break;
          }
          state.extra = here_op & 15;
          state.mode = LENEXT;
        case LENEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          state.was = state.length;
          state.mode = DIST;
        case DIST:
          for (; ; ) {
            here = state.distcode[hold & (1 << state.distbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          if (here_op & 64) {
            strm.msg = "invalid distance code";
            state.mode = BAD;
            break;
          }
          state.offset = here_val;
          state.extra = here_op & 15;
          state.mode = DISTEXT;
        case DISTEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.offset += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          if (state.offset > state.dmax) {
            strm.msg = "invalid distance too far back";
            state.mode = BAD;
            break;
          }
          state.mode = MATCH;
        case MATCH:
          if (left === 0) {
            break inf_leave;
          }
          copy = _out - left;
          if (state.offset > copy) {
            copy = state.offset - copy;
            if (copy > state.whave) {
              if (state.sane) {
                strm.msg = "invalid distance too far back";
                state.mode = BAD;
                break;
              }
            }
            if (copy > state.wnext) {
              copy -= state.wnext;
              from = state.wsize - copy;
            } else {
              from = state.wnext - copy;
            }
            if (copy > state.length) {
              copy = state.length;
            }
            from_source = state.window;
          } else {
            from_source = output;
            from = put - state.offset;
            copy = state.length;
          }
          if (copy > left) {
            copy = left;
          }
          left -= copy;
          state.length -= copy;
          do {
            output[put++] = from_source[from++];
          } while (--copy);
          if (state.length === 0) {
            state.mode = LEN;
          }
          break;
        case LIT:
          if (left === 0) {
            break inf_leave;
          }
          output[put++] = state.length;
          left--;
          state.mode = LEN;
          break;
        case CHECK:
          if (state.wrap) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold |= input[next++] << bits;
              bits += 8;
            }
            _out -= left;
            strm.total_out += _out;
            state.total += _out;
            if (_out) {
              strm.adler = state.check = /*UPDATE(state.check, put - _out, _out);*/
              state.flags ? crc32$1(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
            }
            _out = left;
            if ((state.flags ? hold : zswap32(hold)) !== state.check) {
              strm.msg = "incorrect data check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = LENGTH;
        case LENGTH:
          if (state.wrap && state.flags) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (hold !== (state.total & 4294967295)) {
              strm.msg = "incorrect length check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = DONE;
        case DONE:
          ret = Z_STREAM_END;
          break inf_leave;
        case BAD:
          ret = Z_DATA_ERROR;
          break inf_leave;
        case MEM:
          return Z_MEM_ERROR;
        case SYNC:
        default:
          return Z_STREAM_ERROR;
      }
    }
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH)) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap && _out) {
    strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
    state.flags ? crc32$1(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if ((_in === 0 && _out === 0 || flush === Z_FINISH) && ret === Z_OK) {
    ret = Z_BUF_ERROR;
  }
  return ret;
}
function inflateEnd(strm) {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  var state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK;
}
function inflateGetHeader(strm, head) {
  var state;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  if ((state.wrap & 2) === 0) {
    return Z_STREAM_ERROR;
  }
  state.head = head;
  head.done = false;
  return Z_OK;
}
function inflateSetDictionary(strm, dictionary) {
  var dictLength = dictionary.length;
  var state;
  var dictid;
  var ret;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR;
  }
  if (state.mode === DICT) {
    dictid = 1;
    dictid = adler32(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR;
    }
  }
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR;
  }
  state.havedict = 1;
  return Z_OK;
}
inflate$3.inflateReset = inflateReset;
inflate$3.inflateReset2 = inflateReset2;
inflate$3.inflateResetKeep = inflateResetKeep;
inflate$3.inflateInit = inflateInit;
inflate$3.inflateInit2 = inflateInit2;
inflate$3.inflate = inflate$2;
inflate$3.inflateEnd = inflateEnd;
inflate$3.inflateGetHeader = inflateGetHeader;
inflate$3.inflateSetDictionary = inflateSetDictionary;
inflate$3.inflateInfo = "pako inflate (from Nodeca project)";
var constants$7 = {
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
function GZheader$1() {
  this.text = 0;
  this.time = 0;
  this.xflags = 0;
  this.os = 0;
  this.extra = null;
  this.extra_len = 0;
  this.name = "";
  this.comment = "";
  this.hcrc = 0;
  this.done = false;
}
var gzheader = GZheader$1;
var zlib_inflate = inflate$3;
var utils$f = common;
var strings = strings$2;
var c = constants$7;
var msg = messages;
var ZStream = zstream;
var GZheader = gzheader;
var toString = Object.prototype.toString;
function Inflate(options) {
  if (!(this instanceof Inflate)) return new Inflate(options);
  this.options = utils$f.assign({
    chunkSize: 16384,
    windowBits: 0,
    to: ""
  }, options || {});
  var opt = this.options;
  if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) {
      opt.windowBits = -15;
    }
  }
  if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
    opt.windowBits += 32;
  }
  if (opt.windowBits > 15 && opt.windowBits < 48) {
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new ZStream();
  this.strm.avail_out = 0;
  var status = zlib_inflate.inflateInit2(
    this.strm,
    opt.windowBits
  );
  if (status !== c.Z_OK) {
    throw new Error(msg[status]);
  }
  this.header = new GZheader();
  zlib_inflate.inflateGetHeader(this.strm, this.header);
  if (opt.dictionary) {
    if (typeof opt.dictionary === "string") {
      opt.dictionary = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
      opt.dictionary = new Uint8Array(opt.dictionary);
    }
    if (opt.raw) {
      status = zlib_inflate.inflateSetDictionary(this.strm, opt.dictionary);
      if (status !== c.Z_OK) {
        throw new Error(msg[status]);
      }
    }
  }
}
Inflate.prototype.push = function(data, mode2) {
  var strm = this.strm;
  var chunkSize = this.options.chunkSize;
  var dictionary = this.options.dictionary;
  var status, _mode;
  var next_out_utf8, tail, utf8str;
  var allowBufError = false;
  if (this.ended) {
    return false;
  }
  _mode = mode2 === ~~mode2 ? mode2 : mode2 === true ? c.Z_FINISH : c.Z_NO_FLUSH;
  if (typeof data === "string") {
    strm.input = strings.binstring2buf(data);
  } else if (toString.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  do {
    if (strm.avail_out === 0) {
      strm.output = new utils$f.Buf8(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status = zlib_inflate.inflate(strm, c.Z_NO_FLUSH);
    if (status === c.Z_NEED_DICT && dictionary) {
      status = zlib_inflate.inflateSetDictionary(this.strm, dictionary);
    }
    if (status === c.Z_BUF_ERROR && allowBufError === true) {
      status = c.Z_OK;
      allowBufError = false;
    }
    if (status !== c.Z_STREAM_END && status !== c.Z_OK) {
      this.onEnd(status);
      this.ended = true;
      return false;
    }
    if (strm.next_out) {
      if (strm.avail_out === 0 || status === c.Z_STREAM_END || strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH)) {
        if (this.options.to === "string") {
          next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
          tail = strm.next_out - next_out_utf8;
          utf8str = strings.buf2string(strm.output, next_out_utf8);
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) {
            utils$f.arraySet(strm.output, strm.output, next_out_utf8, tail, 0);
          }
          this.onData(utf8str);
        } else {
          this.onData(utils$f.shrinkBuf(strm.output, strm.next_out));
        }
      }
    }
    if (strm.avail_in === 0 && strm.avail_out === 0) {
      allowBufError = true;
    }
  } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== c.Z_STREAM_END);
  if (status === c.Z_STREAM_END) {
    _mode = c.Z_FINISH;
  }
  if (_mode === c.Z_FINISH) {
    status = zlib_inflate.inflateEnd(this.strm);
    this.onEnd(status);
    this.ended = true;
    return status === c.Z_OK;
  }
  if (_mode === c.Z_SYNC_FLUSH) {
    this.onEnd(c.Z_OK);
    strm.avail_out = 0;
    return true;
  }
  return true;
};
Inflate.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Inflate.prototype.onEnd = function(status) {
  if (status === c.Z_OK) {
    if (this.options.to === "string") {
      this.result = this.chunks.join("");
    } else {
      this.result = utils$f.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};
function inflate$1(input, options) {
  var inflator = new Inflate(options);
  inflator.push(input, true);
  if (inflator.err) {
    throw inflator.msg || msg[inflator.err];
  }
  return inflator.result;
}
function inflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return inflate$1(input, options);
}
inflate$4.Inflate = Inflate;
inflate$4.inflate = inflate$1;
inflate$4.inflateRaw = inflateRaw;
inflate$4.ungzip = inflate$1;
var assign = common.assign;
var deflate = deflate$4;
var inflate = inflate$4;
var constants$6 = constants$7;
var pako$1 = {};
assign(pako$1, deflate, inflate, constants$6);
var pako_1 = pako$1;
var USE_TYPEDARRAY = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Uint32Array !== "undefined";
var pako = pako_1;
var utils$e = requireUtils();
var GenericWorker$4 = GenericWorker_1;
var ARRAY_TYPE = USE_TYPEDARRAY ? "uint8array" : "array";
flate.magic = "\b\0";
function FlateWorker(action, options) {
  GenericWorker$4.call(this, "FlateWorker/" + action);
  this._pako = null;
  this._pakoAction = action;
  this._pakoOptions = options;
  this.meta = {};
}
utils$e.inherits(FlateWorker, GenericWorker$4);
FlateWorker.prototype.processChunk = function(chunk) {
  this.meta = chunk.meta;
  if (this._pako === null) {
    this._createPako();
  }
  this._pako.push(utils$e.transformTo(ARRAY_TYPE, chunk.data), false);
};
FlateWorker.prototype.flush = function() {
  GenericWorker$4.prototype.flush.call(this);
  if (this._pako === null) {
    this._createPako();
  }
  this._pako.push([], true);
};
FlateWorker.prototype.cleanUp = function() {
  GenericWorker$4.prototype.cleanUp.call(this);
  this._pako = null;
};
FlateWorker.prototype._createPako = function() {
  this._pako = new pako[this._pakoAction]({
    raw: true,
    level: this._pakoOptions.level || -1
    // default compression
  });
  var self2 = this;
  this._pako.onData = function(data) {
    self2.push({
      data,
      meta: self2.meta
    });
  };
};
flate.compressWorker = function(compressionOptions) {
  return new FlateWorker("Deflate", compressionOptions);
};
flate.uncompressWorker = function() {
  return new FlateWorker("Inflate", {});
};
var GenericWorker$3 = GenericWorker_1;
compressions$2.STORE = {
  magic: "\0\0",
  compressWorker: function() {
    return new GenericWorker$3("STORE compression");
  },
  uncompressWorker: function() {
    return new GenericWorker$3("STORE decompression");
  }
};
compressions$2.DEFLATE = flate;
var signature$1 = {};
signature$1.LOCAL_FILE_HEADER = "PK";
signature$1.CENTRAL_FILE_HEADER = "PK";
signature$1.CENTRAL_DIRECTORY_END = "PK";
signature$1.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07";
signature$1.ZIP64_CENTRAL_DIRECTORY_END = "PK";
signature$1.DATA_DESCRIPTOR = "PK\x07\b";
var utils$d = requireUtils();
var GenericWorker$2 = GenericWorker_1;
var utf8$4 = utf8$6;
var crc32 = crc32_1$1;
var signature = signature$1;
var decToHex = function(dec, bytes) {
  var hex = "", i;
  for (i = 0; i < bytes; i++) {
    hex += String.fromCharCode(dec & 255);
    dec = dec >>> 8;
  }
  return hex;
};
var generateUnixExternalFileAttr = function(unixPermissions, isDir) {
  var result = unixPermissions;
  if (!unixPermissions) {
    result = isDir ? 16893 : 33204;
  }
  return (result & 65535) << 16;
};
var generateDosExternalFileAttr = function(dosPermissions) {
  return (dosPermissions || 0) & 63;
};
var generateZipParts = function(streamInfo, streamedContent, streamingEnded, offset, platform, encodeFileName) {
  var file = streamInfo["file"], compression = streamInfo["compression"], useCustomEncoding = encodeFileName !== utf8$4.utf8encode, encodedFileName = utils$d.transformTo("string", encodeFileName(file.name)), utfEncodedFileName = utils$d.transformTo("string", utf8$4.utf8encode(file.name)), comment = file.comment, encodedComment = utils$d.transformTo("string", encodeFileName(comment)), utfEncodedComment = utils$d.transformTo("string", utf8$4.utf8encode(comment)), useUTF8ForFileName = utfEncodedFileName.length !== file.name.length, useUTF8ForComment = utfEncodedComment.length !== comment.length, dosTime, dosDate, extraFields = "", unicodePathExtraField = "", unicodeCommentExtraField = "", dir = file.dir, date = file.date;
  var dataInfo = {
    crc32: 0,
    compressedSize: 0,
    uncompressedSize: 0
  };
  if (!streamedContent || streamingEnded) {
    dataInfo.crc32 = streamInfo["crc32"];
    dataInfo.compressedSize = streamInfo["compressedSize"];
    dataInfo.uncompressedSize = streamInfo["uncompressedSize"];
  }
  var bitflag = 0;
  if (streamedContent) {
    bitflag |= 8;
  }
  if (!useCustomEncoding && (useUTF8ForFileName || useUTF8ForComment)) {
    bitflag |= 2048;
  }
  var extFileAttr = 0;
  var versionMadeBy = 0;
  if (dir) {
    extFileAttr |= 16;
  }
  if (platform === "UNIX") {
    versionMadeBy = 798;
    extFileAttr |= generateUnixExternalFileAttr(file.unixPermissions, dir);
  } else {
    versionMadeBy = 20;
    extFileAttr |= generateDosExternalFileAttr(file.dosPermissions);
  }
  dosTime = date.getUTCHours();
  dosTime = dosTime << 6;
  dosTime = dosTime | date.getUTCMinutes();
  dosTime = dosTime << 5;
  dosTime = dosTime | date.getUTCSeconds() / 2;
  dosDate = date.getUTCFullYear() - 1980;
  dosDate = dosDate << 4;
  dosDate = dosDate | date.getUTCMonth() + 1;
  dosDate = dosDate << 5;
  dosDate = dosDate | date.getUTCDate();
  if (useUTF8ForFileName) {
    unicodePathExtraField = // Version
    decToHex(1, 1) + // NameCRC32
    decToHex(crc32(encodedFileName), 4) + // UnicodeName
    utfEncodedFileName;
    extraFields += // Info-ZIP Unicode Path Extra Field
    "up" + // size
    decToHex(unicodePathExtraField.length, 2) + // content
    unicodePathExtraField;
  }
  if (useUTF8ForComment) {
    unicodeCommentExtraField = // Version
    decToHex(1, 1) + // CommentCRC32
    decToHex(crc32(encodedComment), 4) + // UnicodeName
    utfEncodedComment;
    extraFields += // Info-ZIP Unicode Path Extra Field
    "uc" + // size
    decToHex(unicodeCommentExtraField.length, 2) + // content
    unicodeCommentExtraField;
  }
  var header = "";
  header += "\n\0";
  header += decToHex(bitflag, 2);
  header += compression.magic;
  header += decToHex(dosTime, 2);
  header += decToHex(dosDate, 2);
  header += decToHex(dataInfo.crc32, 4);
  header += decToHex(dataInfo.compressedSize, 4);
  header += decToHex(dataInfo.uncompressedSize, 4);
  header += decToHex(encodedFileName.length, 2);
  header += decToHex(extraFields.length, 2);
  var fileRecord = signature.LOCAL_FILE_HEADER + header + encodedFileName + extraFields;
  var dirRecord = signature.CENTRAL_FILE_HEADER + // version made by (00: DOS)
  decToHex(versionMadeBy, 2) + // file header (common to file and central directory)
  header + // file comment length
  decToHex(encodedComment.length, 2) + // disk number start
  "\0\0\0\0" + // external file attributes
  decToHex(extFileAttr, 4) + // relative offset of local header
  decToHex(offset, 4) + // file name
  encodedFileName + // extra field
  extraFields + // file comment
  encodedComment;
  return {
    fileRecord,
    dirRecord
  };
};
var generateCentralDirectoryEnd = function(entriesCount, centralDirLength, localDirLength, comment, encodeFileName) {
  var dirEnd = "";
  var encodedComment = utils$d.transformTo("string", encodeFileName(comment));
  dirEnd = signature.CENTRAL_DIRECTORY_END + // number of this disk
  "\0\0\0\0" + // total number of entries in the central directory on this disk
  decToHex(entriesCount, 2) + // total number of entries in the central directory
  decToHex(entriesCount, 2) + // size of the central directory   4 bytes
  decToHex(centralDirLength, 4) + // offset of start of central directory with respect to the starting disk number
  decToHex(localDirLength, 4) + // .ZIP file comment length
  decToHex(encodedComment.length, 2) + // .ZIP file comment
  encodedComment;
  return dirEnd;
};
var generateDataDescriptors = function(streamInfo) {
  var descriptor = "";
  descriptor = signature.DATA_DESCRIPTOR + // crc-32                          4 bytes
  decToHex(streamInfo["crc32"], 4) + // compressed size                 4 bytes
  decToHex(streamInfo["compressedSize"], 4) + // uncompressed size               4 bytes
  decToHex(streamInfo["uncompressedSize"], 4);
  return descriptor;
};
function ZipFileWorker$1(streamFiles, comment, platform, encodeFileName) {
  GenericWorker$2.call(this, "ZipFileWorker");
  this.bytesWritten = 0;
  this.zipComment = comment;
  this.zipPlatform = platform;
  this.encodeFileName = encodeFileName;
  this.streamFiles = streamFiles;
  this.accumulate = false;
  this.contentBuffer = [];
  this.dirRecords = [];
  this.currentSourceOffset = 0;
  this.entriesCount = 0;
  this.currentFile = null;
  this._sources = [];
}
utils$d.inherits(ZipFileWorker$1, GenericWorker$2);
ZipFileWorker$1.prototype.push = function(chunk) {
  var currentFilePercent = chunk.meta.percent || 0;
  var entriesCount = this.entriesCount;
  var remainingFiles = this._sources.length;
  if (this.accumulate) {
    this.contentBuffer.push(chunk);
  } else {
    this.bytesWritten += chunk.data.length;
    GenericWorker$2.prototype.push.call(this, {
      data: chunk.data,
      meta: {
        currentFile: this.currentFile,
        percent: entriesCount ? (currentFilePercent + 100 * (entriesCount - remainingFiles - 1)) / entriesCount : 100
      }
    });
  }
};
ZipFileWorker$1.prototype.openedSource = function(streamInfo) {
  this.currentSourceOffset = this.bytesWritten;
  this.currentFile = streamInfo["file"].name;
  var streamedContent = this.streamFiles && !streamInfo["file"].dir;
  if (streamedContent) {
    var record = generateZipParts(streamInfo, streamedContent, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
    this.push({
      data: record.fileRecord,
      meta: { percent: 0 }
    });
  } else {
    this.accumulate = true;
  }
};
ZipFileWorker$1.prototype.closedSource = function(streamInfo) {
  this.accumulate = false;
  var streamedContent = this.streamFiles && !streamInfo["file"].dir;
  var record = generateZipParts(streamInfo, streamedContent, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
  this.dirRecords.push(record.dirRecord);
  if (streamedContent) {
    this.push({
      data: generateDataDescriptors(streamInfo),
      meta: { percent: 100 }
    });
  } else {
    this.push({
      data: record.fileRecord,
      meta: { percent: 0 }
    });
    while (this.contentBuffer.length) {
      this.push(this.contentBuffer.shift());
    }
  }
  this.currentFile = null;
};
ZipFileWorker$1.prototype.flush = function() {
  var localDirLength = this.bytesWritten;
  for (var i = 0; i < this.dirRecords.length; i++) {
    this.push({
      data: this.dirRecords[i],
      meta: { percent: 100 }
    });
  }
  var centralDirLength = this.bytesWritten - localDirLength;
  var dirEnd = generateCentralDirectoryEnd(this.dirRecords.length, centralDirLength, localDirLength, this.zipComment, this.encodeFileName);
  this.push({
    data: dirEnd,
    meta: { percent: 100 }
  });
};
ZipFileWorker$1.prototype.prepareNextSource = function() {
  this.previous = this._sources.shift();
  this.openedSource(this.previous.streamInfo);
  if (this.isPaused) {
    this.previous.pause();
  } else {
    this.previous.resume();
  }
};
ZipFileWorker$1.prototype.registerPrevious = function(previous) {
  this._sources.push(previous);
  var self2 = this;
  previous.on("data", function(chunk) {
    self2.processChunk(chunk);
  });
  previous.on("end", function() {
    self2.closedSource(self2.previous.streamInfo);
    if (self2._sources.length) {
      self2.prepareNextSource();
    } else {
      self2.end();
    }
  });
  previous.on("error", function(e) {
    self2.error(e);
  });
  return this;
};
ZipFileWorker$1.prototype.resume = function() {
  if (!GenericWorker$2.prototype.resume.call(this)) {
    return false;
  }
  if (!this.previous && this._sources.length) {
    this.prepareNextSource();
    return true;
  }
  if (!this.previous && !this._sources.length && !this.generatedError) {
    this.end();
    return true;
  }
};
ZipFileWorker$1.prototype.error = function(e) {
  var sources = this._sources;
  if (!GenericWorker$2.prototype.error.call(this, e)) {
    return false;
  }
  for (var i = 0; i < sources.length; i++) {
    try {
      sources[i].error(e);
    } catch (e2) {
    }
  }
  return true;
};
ZipFileWorker$1.prototype.lock = function() {
  GenericWorker$2.prototype.lock.call(this);
  var sources = this._sources;
  for (var i = 0; i < sources.length; i++) {
    sources[i].lock();
  }
};
var ZipFileWorker_1 = ZipFileWorker$1;
var compressions$1 = compressions$2;
var ZipFileWorker = ZipFileWorker_1;
var getCompression = function(fileCompression, zipCompression) {
  var compressionName = fileCompression || zipCompression;
  var compression = compressions$1[compressionName];
  if (!compression) {
    throw new Error(compressionName + " is not a valid compression method !");
  }
  return compression;
};
generate$1.generateWorker = function(zip, options, comment) {
  var zipFileWorker = new ZipFileWorker(options.streamFiles, comment, options.platform, options.encodeFileName);
  var entriesCount = 0;
  try {
    zip.forEach(function(relativePath, file) {
      entriesCount++;
      var compression = getCompression(file.options.compression, options.compression);
      var compressionOptions = file.options.compressionOptions || options.compressionOptions || {};
      var dir = file.dir, date = file.date;
      file._compressWorker(compression, compressionOptions).withStreamInfo("file", {
        name: relativePath,
        dir,
        date,
        comment: file.comment || "",
        unixPermissions: file.unixPermissions,
        dosPermissions: file.dosPermissions
      }).pipe(zipFileWorker);
    });
    zipFileWorker.entriesCount = entriesCount;
  } catch (e) {
    zipFileWorker.error(e);
  }
  return zipFileWorker;
};
var utils$c = requireUtils();
var GenericWorker$1 = GenericWorker_1;
function NodejsStreamInputAdapter$1(filename, stream2) {
  GenericWorker$1.call(this, "Nodejs stream input adapter for " + filename);
  this._upstreamEnded = false;
  this._bindStream(stream2);
}
utils$c.inherits(NodejsStreamInputAdapter$1, GenericWorker$1);
NodejsStreamInputAdapter$1.prototype._bindStream = function(stream2) {
  var self2 = this;
  this._stream = stream2;
  stream2.pause();
  stream2.on("data", function(chunk) {
    self2.push({
      data: chunk,
      meta: {
        percent: 0
      }
    });
  }).on("error", function(e) {
    if (self2.isPaused) {
      this.generatedError = e;
    } else {
      self2.error(e);
    }
  }).on("end", function() {
    if (self2.isPaused) {
      self2._upstreamEnded = true;
    } else {
      self2.end();
    }
  });
};
NodejsStreamInputAdapter$1.prototype.pause = function() {
  if (!GenericWorker$1.prototype.pause.call(this)) {
    return false;
  }
  this._stream.pause();
  return true;
};
NodejsStreamInputAdapter$1.prototype.resume = function() {
  if (!GenericWorker$1.prototype.resume.call(this)) {
    return false;
  }
  if (this._upstreamEnded) {
    this.end();
  } else {
    this._stream.resume();
  }
  return true;
};
var NodejsStreamInputAdapter_1 = NodejsStreamInputAdapter$1;
var utf8$3 = utf8$6;
var utils$b = requireUtils();
var GenericWorker = GenericWorker_1;
var StreamHelper = StreamHelper_1;
var defaults = defaults$1;
var CompressedObject$1 = compressedObject;
var ZipObject = zipObject;
var generate = generate$1;
var nodejsUtils$1 = nodejsUtils$2;
var NodejsStreamInputAdapter = NodejsStreamInputAdapter_1;
var fileAdd = function(name, data, originalOptions) {
  var dataType = utils$b.getTypeOf(data), parent;
  var o = utils$b.extend(originalOptions || {}, defaults);
  o.date = o.date || /* @__PURE__ */ new Date();
  if (o.compression !== null) {
    o.compression = o.compression.toUpperCase();
  }
  if (typeof o.unixPermissions === "string") {
    o.unixPermissions = parseInt(o.unixPermissions, 8);
  }
  if (o.unixPermissions && o.unixPermissions & 16384) {
    o.dir = true;
  }
  if (o.dosPermissions && o.dosPermissions & 16) {
    o.dir = true;
  }
  if (o.dir) {
    name = forceTrailingSlash(name);
  }
  if (o.createFolders && (parent = parentFolder(name))) {
    folderAdd.call(this, parent, true);
  }
  var isUnicodeString = dataType === "string" && o.binary === false && o.base64 === false;
  if (!originalOptions || typeof originalOptions.binary === "undefined") {
    o.binary = !isUnicodeString;
  }
  var isCompressedEmpty = data instanceof CompressedObject$1 && data.uncompressedSize === 0;
  if (isCompressedEmpty || o.dir || !data || data.length === 0) {
    o.base64 = false;
    o.binary = true;
    data = "";
    o.compression = "STORE";
    dataType = "string";
  }
  var zipObjectContent = null;
  if (data instanceof CompressedObject$1 || data instanceof GenericWorker) {
    zipObjectContent = data;
  } else if (nodejsUtils$1.isNode && nodejsUtils$1.isStream(data)) {
    zipObjectContent = new NodejsStreamInputAdapter(name, data);
  } else {
    zipObjectContent = utils$b.prepareContent(name, data, o.binary, o.optimizedBinaryString, o.base64);
  }
  var object2 = new ZipObject(name, zipObjectContent, o);
  this.files[name] = object2;
};
var parentFolder = function(path2) {
  if (path2.slice(-1) === "/") {
    path2 = path2.substring(0, path2.length - 1);
  }
  var lastSlash = path2.lastIndexOf("/");
  return lastSlash > 0 ? path2.substring(0, lastSlash) : "";
};
var forceTrailingSlash = function(path2) {
  if (path2.slice(-1) !== "/") {
    path2 += "/";
  }
  return path2;
};
var folderAdd = function(name, createFolders) {
  createFolders = typeof createFolders !== "undefined" ? createFolders : defaults.createFolders;
  name = forceTrailingSlash(name);
  if (!this.files[name]) {
    fileAdd.call(this, name, null, {
      dir: true,
      createFolders
    });
  }
  return this.files[name];
};
function isRegExp(object2) {
  return Object.prototype.toString.call(object2) === "[object RegExp]";
}
var out = {
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
  forEach: function(cb) {
    var filename, relativePath, file;
    for (filename in this.files) {
      file = this.files[filename];
      relativePath = filename.slice(this.root.length, filename.length);
      if (relativePath && filename.slice(0, this.root.length) === this.root) {
        cb(relativePath, file);
      }
    }
  },
  /**
   * Filter nested files/folders with the specified function.
   * @param {Function} search the predicate to use :
   * function (relativePath, file) {...}
   * It takes 2 arguments : the relative path and the file.
   * @return {Array} An array of matching elements.
   */
  filter: function(search) {
    var result = [];
    this.forEach(function(relativePath, entry) {
      if (search(relativePath, entry)) {
        result.push(entry);
      }
    });
    return result;
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
  file: function(name, data, o) {
    if (arguments.length === 1) {
      if (isRegExp(name)) {
        var regexp = name;
        return this.filter(function(relativePath, file) {
          return !file.dir && regexp.test(relativePath);
        });
      } else {
        var obj = this.files[this.root + name];
        if (obj && !obj.dir) {
          return obj;
        } else {
          return null;
        }
      }
    } else {
      name = this.root + name;
      fileAdd.call(this, name, data, o);
    }
    return this;
  },
  /**
   * Add a directory to the zip file, or search.
   * @param   {String|RegExp} arg The name of the directory to add, or a regex to search folders.
   * @return  {JSZip} an object with the new directory as the root, or an array containing matching folders.
   */
  folder: function(arg) {
    if (!arg) {
      return this;
    }
    if (isRegExp(arg)) {
      return this.filter(function(relativePath, file) {
        return file.dir && arg.test(relativePath);
      });
    }
    var name = this.root + arg;
    var newFolder = folderAdd.call(this, name);
    var ret = this.clone();
    ret.root = newFolder.name;
    return ret;
  },
  /**
   * Delete a file, or a directory and all sub-files, from the zip
   * @param {string} name the name of the file to delete
   * @return {JSZip} this JSZip object
   */
  remove: function(name) {
    name = this.root + name;
    var file = this.files[name];
    if (!file) {
      if (name.slice(-1) !== "/") {
        name += "/";
      }
      file = this.files[name];
    }
    if (file && !file.dir) {
      delete this.files[name];
    } else {
      var kids = this.filter(function(relativePath, file2) {
        return file2.name.slice(0, name.length) === name;
      });
      for (var i = 0; i < kids.length; i++) {
        delete this.files[kids[i].name];
      }
    }
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
  generateInternalStream: function(options) {
    var worker, opts = {};
    try {
      opts = utils$b.extend(options || {}, {
        streamFiles: false,
        compression: "STORE",
        compressionOptions: null,
        type: "",
        platform: "DOS",
        comment: null,
        mimeType: "application/zip",
        encodeFileName: utf8$3.utf8encode
      });
      opts.type = opts.type.toLowerCase();
      opts.compression = opts.compression.toUpperCase();
      if (opts.type === "binarystring") {
        opts.type = "string";
      }
      if (!opts.type) {
        throw new Error("No output type specified.");
      }
      utils$b.checkSupport(opts.type);
      if (opts.platform === "darwin" || opts.platform === "freebsd" || opts.platform === "linux" || opts.platform === "sunos") {
        opts.platform = "UNIX";
      }
      if (opts.platform === "win32") {
        opts.platform = "DOS";
      }
      var comment = opts.comment || this.comment || "";
      worker = generate.generateWorker(this, opts, comment);
    } catch (e) {
      worker = new GenericWorker("error");
      worker.error(e);
    }
    return new StreamHelper(worker, opts.type || "string", opts.mimeType);
  },
  /**
   * Generate the complete zip file asynchronously.
   * @see generateInternalStream
   */
  generateAsync: function(options, onUpdate) {
    return this.generateInternalStream(options).accumulate(onUpdate);
  },
  /**
   * Generate the complete zip file asynchronously.
   * @see generateInternalStream
   */
  generateNodeStream: function(options, onUpdate) {
    options = options || {};
    if (!options.type) {
      options.type = "nodebuffer";
    }
    return this.generateInternalStream(options).toNodejsStream(onUpdate);
  }
};
var object = out;
var utils$a = requireUtils();
function DataReader$2(data) {
  this.data = data;
  this.length = data.length;
  this.index = 0;
  this.zero = 0;
}
DataReader$2.prototype = {
  /**
   * Check that the offset will not go too far.
   * @param {string} offset the additional offset to check.
   * @throws {Error} an Error if the offset is out of bounds.
   */
  checkOffset: function(offset) {
    this.checkIndex(this.index + offset);
  },
  /**
   * Check that the specified index will not be too far.
   * @param {string} newIndex the index to check.
   * @throws {Error} an Error if the index is out of bounds.
   */
  checkIndex: function(newIndex) {
    if (this.length < this.zero + newIndex || newIndex < 0) {
      throw new Error("End of data reached (data length = " + this.length + ", asked index = " + newIndex + "). Corrupted zip ?");
    }
  },
  /**
   * Change the index.
   * @param {number} newIndex The new index.
   * @throws {Error} if the new index is out of the data.
   */
  setIndex: function(newIndex) {
    this.checkIndex(newIndex);
    this.index = newIndex;
  },
  /**
   * Skip the next n bytes.
   * @param {number} n the number of bytes to skip.
   * @throws {Error} if the new index is out of the data.
   */
  skip: function(n) {
    this.setIndex(this.index + n);
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
  readInt: function(size) {
    var result = 0, i;
    this.checkOffset(size);
    for (i = this.index + size - 1; i >= this.index; i--) {
      result = (result << 8) + this.byteAt(i);
    }
    this.index += size;
    return result;
  },
  /**
   * Get the next string with a given byte size.
   * @param {number} size the number of bytes to read.
   * @return {string} the corresponding string.
   */
  readString: function(size) {
    return utils$a.transformTo("string", this.readData(size));
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
    var dostime = this.readInt(4);
    return new Date(Date.UTC(
      (dostime >> 25 & 127) + 1980,
      // year
      (dostime >> 21 & 15) - 1,
      // month
      dostime >> 16 & 31,
      // day
      dostime >> 11 & 31,
      // hour
      dostime >> 5 & 63,
      // minute
      (dostime & 31) << 1
    ));
  }
};
var DataReader_1 = DataReader$2;
var DataReader$1 = DataReader_1;
var utils$9 = requireUtils();
function ArrayReader$2(data) {
  DataReader$1.call(this, data);
  for (var i = 0; i < this.data.length; i++) {
    data[i] = data[i] & 255;
  }
}
utils$9.inherits(ArrayReader$2, DataReader$1);
ArrayReader$2.prototype.byteAt = function(i) {
  return this.data[this.zero + i];
};
ArrayReader$2.prototype.lastIndexOfSignature = function(sig2) {
  var sig0 = sig2.charCodeAt(0), sig1 = sig2.charCodeAt(1), sig22 = sig2.charCodeAt(2), sig3 = sig2.charCodeAt(3);
  for (var i = this.length - 4; i >= 0; --i) {
    if (this.data[i] === sig0 && this.data[i + 1] === sig1 && this.data[i + 2] === sig22 && this.data[i + 3] === sig3) {
      return i - this.zero;
    }
  }
  return -1;
};
ArrayReader$2.prototype.readAndCheckSignature = function(sig2) {
  var sig0 = sig2.charCodeAt(0), sig1 = sig2.charCodeAt(1), sig22 = sig2.charCodeAt(2), sig3 = sig2.charCodeAt(3), data = this.readData(4);
  return sig0 === data[0] && sig1 === data[1] && sig22 === data[2] && sig3 === data[3];
};
ArrayReader$2.prototype.readData = function(size) {
  this.checkOffset(size);
  if (size === 0) {
    return [];
  }
  var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
  this.index += size;
  return result;
};
var ArrayReader_1 = ArrayReader$2;
var DataReader = DataReader_1;
var utils$8 = requireUtils();
function StringReader$1(data) {
  DataReader.call(this, data);
}
utils$8.inherits(StringReader$1, DataReader);
StringReader$1.prototype.byteAt = function(i) {
  return this.data.charCodeAt(this.zero + i);
};
StringReader$1.prototype.lastIndexOfSignature = function(sig2) {
  return this.data.lastIndexOf(sig2) - this.zero;
};
StringReader$1.prototype.readAndCheckSignature = function(sig2) {
  var data = this.readData(4);
  return sig2 === data;
};
StringReader$1.prototype.readData = function(size) {
  this.checkOffset(size);
  var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
  this.index += size;
  return result;
};
var StringReader_1 = StringReader$1;
var ArrayReader$1 = ArrayReader_1;
var utils$7 = requireUtils();
function Uint8ArrayReader$2(data) {
  ArrayReader$1.call(this, data);
}
utils$7.inherits(Uint8ArrayReader$2, ArrayReader$1);
Uint8ArrayReader$2.prototype.readData = function(size) {
  this.checkOffset(size);
  if (size === 0) {
    return new Uint8Array(0);
  }
  var result = this.data.subarray(this.zero + this.index, this.zero + this.index + size);
  this.index += size;
  return result;
};
var Uint8ArrayReader_1 = Uint8ArrayReader$2;
var Uint8ArrayReader$1 = Uint8ArrayReader_1;
var utils$6 = requireUtils();
function NodeBufferReader$1(data) {
  Uint8ArrayReader$1.call(this, data);
}
utils$6.inherits(NodeBufferReader$1, Uint8ArrayReader$1);
NodeBufferReader$1.prototype.readData = function(size) {
  this.checkOffset(size);
  var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
  this.index += size;
  return result;
};
var NodeBufferReader_1 = NodeBufferReader$1;
var utils$5 = requireUtils();
var support$2 = support$4;
var ArrayReader = ArrayReader_1;
var StringReader = StringReader_1;
var NodeBufferReader = NodeBufferReader_1;
var Uint8ArrayReader = Uint8ArrayReader_1;
var readerFor$2 = function(data) {
  var type = utils$5.getTypeOf(data);
  utils$5.checkSupport(type);
  if (type === "string" && !support$2.uint8array) {
    return new StringReader(data);
  }
  if (type === "nodebuffer") {
    return new NodeBufferReader(data);
  }
  if (support$2.uint8array) {
    return new Uint8ArrayReader(utils$5.transformTo("uint8array", data));
  }
  return new ArrayReader(utils$5.transformTo("array", data));
};
var readerFor$1 = readerFor$2;
var utils$4 = requireUtils();
var CompressedObject = compressedObject;
var crc32fn = crc32_1$1;
var utf8$2 = utf8$6;
var compressions = compressions$2;
var support$1 = support$4;
var MADE_BY_DOS = 0;
var MADE_BY_UNIX = 3;
var findCompression = function(compressionMethod) {
  for (var method in compressions) {
    if (!Object.prototype.hasOwnProperty.call(compressions, method)) {
      continue;
    }
    if (compressions[method].magic === compressionMethod) {
      return compressions[method];
    }
  }
  return null;
};
function ZipEntry$1(options, loadOptions) {
  this.options = options;
  this.loadOptions = loadOptions;
}
ZipEntry$1.prototype = {
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
  readLocalPart: function(reader) {
    var compression, localExtraFieldsLength;
    reader.skip(22);
    this.fileNameLength = reader.readInt(2);
    localExtraFieldsLength = reader.readInt(2);
    this.fileName = reader.readData(this.fileNameLength);
    reader.skip(localExtraFieldsLength);
    if (this.compressedSize === -1 || this.uncompressedSize === -1) {
      throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
    }
    compression = findCompression(this.compressionMethod);
    if (compression === null) {
      throw new Error("Corrupted zip : compression " + utils$4.pretty(this.compressionMethod) + " unknown (inner file : " + utils$4.transformTo("string", this.fileName) + ")");
    }
    this.decompressed = new CompressedObject(this.compressedSize, this.uncompressedSize, this.crc32, compression, reader.readData(this.compressedSize));
  },
  /**
   * Read the central part of a zip file and add the info in this object.
   * @param {DataReader} reader the reader to use.
   */
  readCentralPart: function(reader) {
    this.versionMadeBy = reader.readInt(2);
    reader.skip(2);
    this.bitFlag = reader.readInt(2);
    this.compressionMethod = reader.readString(2);
    this.date = reader.readDate();
    this.crc32 = reader.readInt(4);
    this.compressedSize = reader.readInt(4);
    this.uncompressedSize = reader.readInt(4);
    var fileNameLength = reader.readInt(2);
    this.extraFieldsLength = reader.readInt(2);
    this.fileCommentLength = reader.readInt(2);
    this.diskNumberStart = reader.readInt(2);
    this.internalFileAttributes = reader.readInt(2);
    this.externalFileAttributes = reader.readInt(4);
    this.localHeaderOffset = reader.readInt(4);
    if (this.isEncrypted()) {
      throw new Error("Encrypted zip are not supported");
    }
    reader.skip(fileNameLength);
    this.readExtraFields(reader);
    this.parseZIP64ExtraField(reader);
    this.fileComment = reader.readData(this.fileCommentLength);
  },
  /**
   * Parse the external file attributes and get the unix/dos permissions.
   */
  processAttributes: function() {
    this.unixPermissions = null;
    this.dosPermissions = null;
    var madeBy = this.versionMadeBy >> 8;
    this.dir = this.externalFileAttributes & 16 ? true : false;
    if (madeBy === MADE_BY_DOS) {
      this.dosPermissions = this.externalFileAttributes & 63;
    }
    if (madeBy === MADE_BY_UNIX) {
      this.unixPermissions = this.externalFileAttributes >> 16 & 65535;
    }
    if (!this.dir && this.fileNameStr.slice(-1) === "/") {
      this.dir = true;
    }
  },
  /**
   * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
   * @param {DataReader} reader the reader to use.
   */
  parseZIP64ExtraField: function() {
    if (!this.extraFields[1]) {
      return;
    }
    var extraReader = readerFor$1(this.extraFields[1].value);
    if (this.uncompressedSize === utils$4.MAX_VALUE_32BITS) {
      this.uncompressedSize = extraReader.readInt(8);
    }
    if (this.compressedSize === utils$4.MAX_VALUE_32BITS) {
      this.compressedSize = extraReader.readInt(8);
    }
    if (this.localHeaderOffset === utils$4.MAX_VALUE_32BITS) {
      this.localHeaderOffset = extraReader.readInt(8);
    }
    if (this.diskNumberStart === utils$4.MAX_VALUE_32BITS) {
      this.diskNumberStart = extraReader.readInt(4);
    }
  },
  /**
   * Read the central part of a zip file and add the info in this object.
   * @param {DataReader} reader the reader to use.
   */
  readExtraFields: function(reader) {
    var end = reader.index + this.extraFieldsLength, extraFieldId, extraFieldLength, extraFieldValue;
    if (!this.extraFields) {
      this.extraFields = {};
    }
    while (reader.index + 4 < end) {
      extraFieldId = reader.readInt(2);
      extraFieldLength = reader.readInt(2);
      extraFieldValue = reader.readData(extraFieldLength);
      this.extraFields[extraFieldId] = {
        id: extraFieldId,
        length: extraFieldLength,
        value: extraFieldValue
      };
    }
    reader.setIndex(end);
  },
  /**
   * Apply an UTF8 transformation if needed.
   */
  handleUTF8: function() {
    var decodeParamType = support$1.uint8array ? "uint8array" : "array";
    if (this.useUTF8()) {
      this.fileNameStr = utf8$2.utf8decode(this.fileName);
      this.fileCommentStr = utf8$2.utf8decode(this.fileComment);
    } else {
      var upath = this.findExtraFieldUnicodePath();
      if (upath !== null) {
        this.fileNameStr = upath;
      } else {
        var fileNameByteArray = utils$4.transformTo(decodeParamType, this.fileName);
        this.fileNameStr = this.loadOptions.decodeFileName(fileNameByteArray);
      }
      var ucomment = this.findExtraFieldUnicodeComment();
      if (ucomment !== null) {
        this.fileCommentStr = ucomment;
      } else {
        var commentByteArray = utils$4.transformTo(decodeParamType, this.fileComment);
        this.fileCommentStr = this.loadOptions.decodeFileName(commentByteArray);
      }
    }
  },
  /**
   * Find the unicode path declared in the extra field, if any.
   * @return {String} the unicode path, null otherwise.
   */
  findExtraFieldUnicodePath: function() {
    var upathField = this.extraFields[28789];
    if (upathField) {
      var extraReader = readerFor$1(upathField.value);
      if (extraReader.readInt(1) !== 1) {
        return null;
      }
      if (crc32fn(this.fileName) !== extraReader.readInt(4)) {
        return null;
      }
      return utf8$2.utf8decode(extraReader.readData(upathField.length - 5));
    }
    return null;
  },
  /**
   * Find the unicode comment declared in the extra field, if any.
   * @return {String} the unicode comment, null otherwise.
   */
  findExtraFieldUnicodeComment: function() {
    var ucommentField = this.extraFields[25461];
    if (ucommentField) {
      var extraReader = readerFor$1(ucommentField.value);
      if (extraReader.readInt(1) !== 1) {
        return null;
      }
      if (crc32fn(this.fileComment) !== extraReader.readInt(4)) {
        return null;
      }
      return utf8$2.utf8decode(extraReader.readData(ucommentField.length - 5));
    }
    return null;
  }
};
var zipEntry = ZipEntry$1;
var readerFor = readerFor$2;
var utils$3 = requireUtils();
var sig = signature$1;
var ZipEntry = zipEntry;
var support = support$4;
function ZipEntries$1(loadOptions) {
  this.files = [];
  this.loadOptions = loadOptions;
}
ZipEntries$1.prototype = {
  /**
   * Check that the reader is on the specified signature.
   * @param {string} expectedSignature the expected signature.
   * @throws {Error} if it is an other signature.
   */
  checkSignature: function(expectedSignature) {
    if (!this.reader.readAndCheckSignature(expectedSignature)) {
      this.reader.index -= 4;
      var signature2 = this.reader.readString(4);
      throw new Error("Corrupted zip or bug: unexpected signature (" + utils$3.pretty(signature2) + ", expected " + utils$3.pretty(expectedSignature) + ")");
    }
  },
  /**
   * Check if the given signature is at the given index.
   * @param {number} askedIndex the index to check.
   * @param {string} expectedSignature the signature to expect.
   * @return {boolean} true if the signature is here, false otherwise.
   */
  isSignature: function(askedIndex, expectedSignature) {
    var currentIndex = this.reader.index;
    this.reader.setIndex(askedIndex);
    var signature2 = this.reader.readString(4);
    var result = signature2 === expectedSignature;
    this.reader.setIndex(currentIndex);
    return result;
  },
  /**
   * Read the end of the central directory.
   */
  readBlockEndOfCentral: function() {
    this.diskNumber = this.reader.readInt(2);
    this.diskWithCentralDirStart = this.reader.readInt(2);
    this.centralDirRecordsOnThisDisk = this.reader.readInt(2);
    this.centralDirRecords = this.reader.readInt(2);
    this.centralDirSize = this.reader.readInt(4);
    this.centralDirOffset = this.reader.readInt(4);
    this.zipCommentLength = this.reader.readInt(2);
    var zipComment = this.reader.readData(this.zipCommentLength);
    var decodeParamType = support.uint8array ? "uint8array" : "array";
    var decodeContent = utils$3.transformTo(decodeParamType, zipComment);
    this.zipComment = this.loadOptions.decodeFileName(decodeContent);
  },
  /**
   * Read the end of the Zip 64 central directory.
   * Not merged with the method readEndOfCentral :
   * The end of central can coexist with its Zip64 brother,
   * I don't want to read the wrong number of bytes !
   */
  readBlockZip64EndOfCentral: function() {
    this.zip64EndOfCentralSize = this.reader.readInt(8);
    this.reader.skip(4);
    this.diskNumber = this.reader.readInt(4);
    this.diskWithCentralDirStart = this.reader.readInt(4);
    this.centralDirRecordsOnThisDisk = this.reader.readInt(8);
    this.centralDirRecords = this.reader.readInt(8);
    this.centralDirSize = this.reader.readInt(8);
    this.centralDirOffset = this.reader.readInt(8);
    this.zip64ExtensibleData = {};
    var extraDataSize = this.zip64EndOfCentralSize - 44, index = 0, extraFieldId, extraFieldLength, extraFieldValue;
    while (index < extraDataSize) {
      extraFieldId = this.reader.readInt(2);
      extraFieldLength = this.reader.readInt(4);
      extraFieldValue = this.reader.readData(extraFieldLength);
      this.zip64ExtensibleData[extraFieldId] = {
        id: extraFieldId,
        length: extraFieldLength,
        value: extraFieldValue
      };
    }
  },
  /**
   * Read the end of the Zip 64 central directory locator.
   */
  readBlockZip64EndOfCentralLocator: function() {
    this.diskWithZip64CentralDirStart = this.reader.readInt(4);
    this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8);
    this.disksCount = this.reader.readInt(4);
    if (this.disksCount > 1) {
      throw new Error("Multi-volumes zip are not supported");
    }
  },
  /**
   * Read the local files, based on the offset read in the central part.
   */
  readLocalFiles: function() {
    var i, file;
    for (i = 0; i < this.files.length; i++) {
      file = this.files[i];
      this.reader.setIndex(file.localHeaderOffset);
      this.checkSignature(sig.LOCAL_FILE_HEADER);
      file.readLocalPart(this.reader);
      file.handleUTF8();
      file.processAttributes();
    }
  },
  /**
   * Read the central directory.
   */
  readCentralDir: function() {
    var file;
    this.reader.setIndex(this.centralDirOffset);
    while (this.reader.readAndCheckSignature(sig.CENTRAL_FILE_HEADER)) {
      file = new ZipEntry({
        zip64: this.zip64
      }, this.loadOptions);
      file.readCentralPart(this.reader);
      this.files.push(file);
    }
    if (this.centralDirRecords !== this.files.length) {
      if (this.centralDirRecords !== 0 && this.files.length === 0) {
        throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
      }
    }
  },
  /**
   * Read the end of central directory.
   */
  readEndOfCentral: function() {
    var offset = this.reader.lastIndexOfSignature(sig.CENTRAL_DIRECTORY_END);
    if (offset < 0) {
      var isGarbage = !this.isSignature(0, sig.LOCAL_FILE_HEADER);
      if (isGarbage) {
        throw new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html");
      } else {
        throw new Error("Corrupted zip: can't find end of central directory");
      }
    }
    this.reader.setIndex(offset);
    var endOfCentralDirOffset = offset;
    this.checkSignature(sig.CENTRAL_DIRECTORY_END);
    this.readBlockEndOfCentral();
    if (this.diskNumber === utils$3.MAX_VALUE_16BITS || this.diskWithCentralDirStart === utils$3.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === utils$3.MAX_VALUE_16BITS || this.centralDirRecords === utils$3.MAX_VALUE_16BITS || this.centralDirSize === utils$3.MAX_VALUE_32BITS || this.centralDirOffset === utils$3.MAX_VALUE_32BITS) {
      this.zip64 = true;
      offset = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
      if (offset < 0) {
        throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
      }
      this.reader.setIndex(offset);
      this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
      this.readBlockZip64EndOfCentralLocator();
      if (!this.isSignature(this.relativeOffsetEndOfZip64CentralDir, sig.ZIP64_CENTRAL_DIRECTORY_END)) {
        this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
        if (this.relativeOffsetEndOfZip64CentralDir < 0) {
          throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
        }
      }
      this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir);
      this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
      this.readBlockZip64EndOfCentral();
    }
    var expectedEndOfCentralDirOffset = this.centralDirOffset + this.centralDirSize;
    if (this.zip64) {
      expectedEndOfCentralDirOffset += 20;
      expectedEndOfCentralDirOffset += 12 + this.zip64EndOfCentralSize;
    }
    var extraBytes = endOfCentralDirOffset - expectedEndOfCentralDirOffset;
    if (extraBytes > 0) {
      if (this.isSignature(endOfCentralDirOffset, sig.CENTRAL_FILE_HEADER)) ;
      else {
        this.reader.zero = extraBytes;
      }
    } else if (extraBytes < 0) {
      throw new Error("Corrupted zip: missing " + Math.abs(extraBytes) + " bytes.");
    }
  },
  prepareReader: function(data) {
    this.reader = readerFor(data);
  },
  /**
   * Read a zip file and create ZipEntries.
   * @param {String|ArrayBuffer|Uint8Array|Buffer} data the binary string representing a zip file.
   */
  load: function(data) {
    this.prepareReader(data);
    this.readEndOfCentral();
    this.readCentralDir();
    this.readLocalFiles();
  }
};
var zipEntries = ZipEntries$1;
var utils$2 = requireUtils();
var external = external$3;
var utf8$1 = utf8$6;
var ZipEntries = zipEntries;
var Crc32Probe = Crc32Probe_1;
var nodejsUtils = nodejsUtils$2;
function checkEntryCRC32(zipEntry2) {
  return new external.Promise(function(resolve, reject) {
    var worker = zipEntry2.decompressed.getContentWorker().pipe(new Crc32Probe());
    worker.on("error", function(e) {
      reject(e);
    }).on("end", function() {
      if (worker.streamInfo.crc32 !== zipEntry2.decompressed.crc32) {
        reject(new Error("Corrupted zip : CRC32 mismatch"));
      } else {
        resolve();
      }
    }).resume();
  });
}
var load = function(data, options) {
  var zip = this;
  options = utils$2.extend(options || {}, {
    base64: false,
    checkCRC32: false,
    optimizedBinaryString: false,
    createFolders: false,
    decodeFileName: utf8$1.utf8decode
  });
  if (nodejsUtils.isNode && nodejsUtils.isStream(data)) {
    return external.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file."));
  }
  return utils$2.prepareContent("the loaded zip file", data, true, options.optimizedBinaryString, options.base64).then(function(data2) {
    var zipEntries2 = new ZipEntries(options);
    zipEntries2.load(data2);
    return zipEntries2;
  }).then(function checkCRC32(zipEntries2) {
    var promises = [external.Promise.resolve(zipEntries2)];
    var files = zipEntries2.files;
    if (options.checkCRC32) {
      for (var i = 0; i < files.length; i++) {
        promises.push(checkEntryCRC32(files[i]));
      }
    }
    return external.Promise.all(promises);
  }).then(function addFiles(results) {
    var zipEntries2 = results.shift();
    var files = zipEntries2.files;
    for (var i = 0; i < files.length; i++) {
      var input = files[i];
      var unsafeName = input.fileNameStr;
      var safeName = utils$2.resolve(input.fileNameStr);
      zip.file(safeName, input.decompressed, {
        binary: true,
        optimizedBinaryString: true,
        date: input.date,
        dir: input.dir,
        comment: input.fileCommentStr.length ? input.fileCommentStr : null,
        unixPermissions: input.unixPermissions,
        dosPermissions: input.dosPermissions,
        createFolders: options.createFolders
      });
      if (!input.dir) {
        zip.file(safeName).unsafeOriginalName = unsafeName;
      }
    }
    if (zipEntries2.zipComment.length) {
      zip.comment = zipEntries2.zipComment;
    }
    return zip;
  });
};
function JSZip() {
  if (!(this instanceof JSZip)) {
    return new JSZip();
  }
  if (arguments.length) {
    throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
  }
  this.files = /* @__PURE__ */ Object.create(null);
  this.comment = null;
  this.root = "";
  this.clone = function() {
    var newObj = new JSZip();
    for (var i in this) {
      if (typeof this[i] !== "function") {
        newObj[i] = this[i];
      }
    }
    return newObj;
  };
}
JSZip.prototype = object;
JSZip.prototype.loadAsync = load;
JSZip.support = support$4;
JSZip.defaults = defaults$1;
JSZip.version = "3.10.1";
JSZip.loadAsync = function(content, options) {
  return new JSZip().loadAsync(content, options);
};
JSZip.external = external$3;
var lib$1 = JSZip;
const JSZip$1 = /* @__PURE__ */ getDefaultExportFromCjs(lib$1);
let currentSession = null;
function getSession() {
  return currentSession;
}
function logout() {
  currentSession = null;
  return { ok: true };
}
function login(payload) {
  try {
    openDatabase();
    runMigrations(getDb());
    const user = getDb().prepare(
      `SELECT id, business_id, branch_id, name, image_path, email, password_hash, role, is_active
         FROM users
         WHERE email = ?`
    ).get(payload.email.trim().toLowerCase());
    if (!user) {
      return { ok: false, error: "invalid_credentials", message: "Email or password is incorrect." };
    }
    if (!user.is_active) {
      return { ok: false, error: "inactive", message: "This account is inactive." };
    }
    const passwordOk = bcrypt.compareSync(payload.password, user.password_hash);
    if (!passwordOk) {
      return { ok: false, error: "invalid_credentials", message: "Email or password is incorrect." };
    }
    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      businessId: user.business_id,
      branchId: user.branch_id,
      imagePath: user.image_path
    };
    getDb().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), user.id);
    currentSession = session;
    return { ok: true, user: session };
  } catch (error) {
    return {
      ok: false,
      error: "unknown",
      message: error instanceof Error ? error.message : "Login failed"
    };
  }
}
function resetOwnerPasswordOffline(payload) {
  const genericFailure = {
    ok: false,
    error: "invalid_credentials",
    message: "Could not verify owner account details."
  };
  try {
    const email = payload.email.trim().toLowerCase();
    const licenseKey = payload.licenseKey.trim();
    const newPassword = payload.newPassword.trim();
    if (!email || !licenseKey || !newPassword) {
      return { ok: false, error: "validation_failed", message: "All fields are required." };
    }
    if (newPassword.length < 8) {
      return {
        ok: false,
        error: "validation_failed",
        message: "Password must be at least 8 characters."
      };
    }
    openDatabase();
    runMigrations(getDb());
    const licenseStatus = getLicenseStatus();
    if (licenseStatus.status === "none") {
      return {
        ok: false,
        error: "not_configured",
        message: "License is not configured on this device."
      };
    }
    if (licenseStatus.status === "expired") {
      return {
        ok: false,
        error: "license_expired",
        message: "License has expired. Renew license before resetting password."
      };
    }
    const localLicense = readLocalLicense();
    if (!localLicense || localLicense.licenseKey !== licenseKey) {
      return { ok: false, error: "invalid_license", message: "License key is invalid for this device." };
    }
    const owner = getDb().prepare(
      `SELECT id
         FROM users
         WHERE role = 'owner' AND is_active = 1 AND email = ?`
    ).get(email);
    if (!owner) return genericFailure;
    const passwordHash = bcrypt.hashSync(newPassword, 12);
    getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, owner.id);
    if ((currentSession == null ? void 0 : currentSession.id) === owner.id) currentSession = null;
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: "unknown",
      message: error instanceof Error ? error.message : "Password reset failed."
    };
  }
}
const ROLE_PERMISSIONS = {
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
function can(user, action) {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(action);
}
function requireSession() {
  const session = getSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}
function requireValidLicense() {
  const status = getLicenseStatus();
  if (status.status === "valid") return;
  throw new Error("License expired");
}
function requirePermission(action) {
  const session = requireSession();
  if (!can(session, action)) throw new Error("Forbidden");
  return session;
}
function assertBusinessAccess(businessId) {
  const session = requireSession();
  if (session.role === "owner") return;
  if (session.businessId !== businessId) throw new Error("Forbidden business scope");
}
function assertBranchAccess(branchId) {
  const session = requireSession();
  if (session.role === "owner" || session.role === "admin") return;
  if (session.branchId !== branchId) throw new Error("Forbidden branch scope");
}
const MAGIC = Buffer.from("KAAROBKB1", "utf8");
const SALT = "kaarobar-backup-salt-v1";
const DEV_BACKUP_SECRET = "kaarobar-dev-backup-secret";
function getBackupSecret() {
  return process.env.KAAROBAR_BACKUP_SECRET || "" || DEV_BACKUP_SECRET;
}
function candidateSecrets() {
  const secrets = [
    process.env.KAAROBAR_BACKUP_SECRET,
    "",
    DEV_BACKUP_SECRET
  ].filter((value) => Boolean(value && value.trim()));
  return [...new Set(secrets)];
}
function deriveKey(secret) {
  return scryptSync(secret, SALT, 32);
}
function encryptBackupPayload(plainBytes) {
  const key = deriveKey(getBackupSecret());
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBytes), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, encrypted]);
}
function decryptBackupPayload(payload) {
  if (payload.length < MAGIC.length + 12 + 16 + 1) {
    throw new Error("Invalid backup file: too short");
  }
  const magic = payload.subarray(0, MAGIC.length);
  if (!magic.equals(MAGIC)) {
    throw new Error("Invalid backup file: not a Kaarobar encrypted backup");
  }
  const iv = payload.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = payload.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const data = payload.subarray(MAGIC.length + 28);
  for (const secret of candidateSecrets()) {
    try {
      const key = deriveKey(secret);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]);
    } catch {
    }
  }
  throw new Error("Invalid backup file: decrypt failed");
}
const BACKUP_FORMAT_VERSION = 2;
const SQLITE_HEADER = Buffer.from("SQLite format 3\0", "utf8");
const ZIP_LOCAL_HEADER = Buffer.from([80, 75, 3, 4]);
function reportProgress(onProgress, operation, phase, percent) {
  if (!onProgress) return;
  onProgress({
    operation,
    phase,
    percent: Math.max(0, Math.min(100, Math.round(percent)))
  });
}
function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax <= inMin) return outMax;
  const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}
async function yieldToEventLoop() {
  await new Promise((resolve) => setImmediate(resolve));
}
function syncActiveBusinessAfterRestore() {
  const business = getDb().prepare(`SELECT id FROM businesses WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1`).get();
  const businessId = (business == null ? void 0 : business.id) ?? null;
  appStore.set("lastBusinessId", businessId);
  return businessId;
}
function ensureBackupDir() {
  const backupDir = path$1.join(app.getPath("documents"), "KaarobarBackups");
  fs$1.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}
const LATEST_BACKUP_FILENAME = "kaarobar-latest.kaarobar-backup";
function pruneOlderBackups(backupDir, keepFileName) {
  for (const entry of fs$1.readdirSync(backupDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".kaarobar-backup")) continue;
    if (entry.name === keepFileName) continue;
    fs$1.unlinkSync(path$1.join(backupDir, entry.name));
  }
}
function removeSidecarFiles(dbPath) {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${dbPath}${suffix}`;
    if (fs$1.existsSync(sidecar)) fs$1.unlinkSync(sidecar);
  }
}
function checkpointAndReadDb() {
  const database = getDb();
  database.pragma("wal_checkpoint(TRUNCATE)");
  const source = getDbPath();
  closeDatabase();
  return fs$1.readFileSync(source);
}
function writeDecryptedDb(sqliteBytes) {
  closeDatabase();
  const target = getDbPath();
  fs$1.mkdirSync(path$1.dirname(target), { recursive: true });
  removeSidecarFiles(target);
  fs$1.writeFileSync(target, sqliteBytes);
  const db2 = openDatabase();
  runMigrations(db2);
}
function isZipPayload(bytes) {
  return bytes.length >= 4 && bytes.subarray(0, 4).equals(ZIP_LOCAL_HEADER);
}
function isSqlitePayload(bytes) {
  return bytes.length >= 16 && bytes.subarray(0, 16).equals(SQLITE_HEADER);
}
function listAssetFiles(root) {
  if (!fs$1.existsSync(root)) return [];
  const out2 = [];
  const walk = (dir) => {
    for (const entry of fs$1.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path$1.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePosix = path$1.relative(root, absolute).split(path$1.sep).join("/");
      if (!relativePosix || relativePosix.includes("..")) continue;
      out2.push({ relativePosix, absolute });
    }
  };
  walk(root);
  return out2;
}
function removeDirContents(dir) {
  if (!fs$1.existsSync(dir)) return;
  for (const entry of fs$1.readdirSync(dir, { withFileTypes: true })) {
    const target = path$1.join(dir, entry.name);
    fs$1.rmSync(target, { recursive: true, force: true });
  }
}
function normalizeStoredAssetPath(stored) {
  if (stored == null) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\\/g, "/");
  const assetsMarker = "/assets/";
  const markerIdx = normalized.toLowerCase().lastIndexOf(assetsMarker);
  if (markerIdx >= 0) {
    const relative = normalized.slice(markerIdx + assetsMarker.length).replace(/^\/+/, "");
    return relative || null;
  }
  if (!path$1.isAbsolute(trimmed) && !/^[a-zA-Z]:[\\/]/.test(trimmed) && !normalized.startsWith("/")) {
    return normalized.replace(/^\/+/, "");
  }
  const match = normalized.match(/\/((?:logos|products)\/[^/]+)$/i);
  if (match == null ? void 0 : match[1]) return match[1];
  return null;
}
function rewriteAbsoluteAssetPathsInDb() {
  const db2 = getDb();
  const productRows = db2.prepare(`SELECT id, image_path FROM products WHERE image_path IS NOT NULL AND image_path != ''`).all();
  const updateProduct2 = db2.prepare(`UPDATE products SET image_path = ? WHERE id = ?`);
  for (const row of productRows) {
    const next = normalizeStoredAssetPath(row.image_path);
    if (next !== row.image_path) updateProduct2.run(next, row.id);
  }
  const userRows = db2.prepare(`SELECT id, image_path FROM users WHERE image_path IS NOT NULL AND image_path != ''`).all();
  const updateUser = db2.prepare(`UPDATE users SET image_path = ? WHERE id = ?`);
  for (const row of userRows) {
    const next = normalizeStoredAssetPath(row.image_path);
    if (next !== row.image_path) updateUser.run(next, row.id);
  }
  const businessRows = db2.prepare(`SELECT id, logo_path FROM businesses WHERE logo_path IS NOT NULL AND logo_path != ''`).all();
  const updateBusiness2 = db2.prepare(`UPDATE businesses SET logo_path = ? WHERE id = ?`);
  for (const row of businessRows) {
    const next = normalizeStoredAssetPath(row.logo_path);
    if (next !== row.logo_path) updateBusiness2.run(next, row.id);
  }
}
async function buildBackupArchive(sqliteBytes, onProgress) {
  const zip = new JSZip$1();
  const manifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    app: "kaarobar",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    includes: ["db", "files"]
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("db/kaarobar.sqlite", sqliteBytes);
  const assetsRoot = getAssetsDir();
  const assetFiles = listAssetFiles(assetsRoot);
  const total = Math.max(assetFiles.length, 1);
  for (let i = 0; i < assetFiles.length; i++) {
    const file = assetFiles[i];
    zip.file(`files/${file.relativePosix}`, fs$1.readFileSync(file.absolute));
    if (i === 0 || i === assetFiles.length - 1 || i % 8 === 0) {
      reportProgress(onProgress, "create", "packing_files", mapRange(i + 1, 0, total, 8, 50));
      await yieldToEventLoop();
    }
  }
  if (assetFiles.length === 0) {
    reportProgress(onProgress, "create", "packing_files", 50);
  }
  reportProgress(onProgress, "create", "compressing", 50);
  const archived = await zip.generateAsync(
    {
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    },
    (metadata) => {
      reportProgress(onProgress, "create", "compressing", mapRange(metadata.percent, 0, 100, 50, 75));
    }
  );
  return Buffer.from(archived);
}
async function restoreAssetsFromArchive(zip, onProgress) {
  const assetsRoot = getAssetsDir();
  const stagingRoot = `${assetsRoot}.restore-tmp`;
  fs$1.rmSync(stagingRoot, { recursive: true, force: true });
  fs$1.mkdirSync(stagingRoot, { recursive: true });
  const fileEntries = Object.values(zip.files).filter(
    (f) => !f.dir && (f.name.startsWith("files/") || f.name.startsWith("assets/"))
  );
  const total = Math.max(fileEntries.length, 1);
  for (let i = 0; i < fileEntries.length; i++) {
    const entry = fileEntries[i];
    const prefix = entry.name.startsWith("files/") ? "files/" : "assets/";
    const relativePosix = entry.name.slice(prefix.length).replace(/^\/+/, "");
    if (!relativePosix || relativePosix.includes("..")) continue;
    const absolute = path$1.resolve(stagingRoot, ...relativePosix.split("/"));
    const stagingResolved = path$1.resolve(stagingRoot);
    const stagingWithSep = stagingResolved.endsWith(path$1.sep) ? stagingResolved : stagingResolved + path$1.sep;
    if (absolute !== stagingResolved && !absolute.startsWith(stagingWithSep)) {
      continue;
    }
    fs$1.mkdirSync(path$1.dirname(absolute), { recursive: true });
    fs$1.writeFileSync(absolute, Buffer.from(await entry.async("nodebuffer")));
    if (i === 0 || i === fileEntries.length - 1 || i % 8 === 0) {
      reportProgress(onProgress, "restore", "restoring_files", mapRange(i + 1, 0, total, 42, 88));
      await yieldToEventLoop();
    }
  }
  if (fileEntries.length === 0) {
    reportProgress(onProgress, "restore", "restoring_files", 88);
  }
  fs$1.mkdirSync(assetsRoot, { recursive: true });
  removeDirContents(assetsRoot);
  if (fs$1.existsSync(stagingRoot)) {
    for (const entry of fs$1.readdirSync(stagingRoot, { withFileTypes: true })) {
      fs$1.renameSync(path$1.join(stagingRoot, entry.name), path$1.join(assetsRoot, entry.name));
    }
  }
  fs$1.rmSync(stagingRoot, { recursive: true, force: true });
}
async function restoreFromArchive(archiveBytes, onProgress) {
  reportProgress(onProgress, "restore", "extracting", 20);
  const zip = await JSZip$1.loadAsync(archiveBytes);
  reportProgress(onProgress, "restore", "extracting", 28);
  const dbEntry = zip.file("db/kaarobar.sqlite") ?? zip.file("kaarobar.sqlite") ?? Object.values(zip.files).find((f) => !f.dir && f.name.endsWith(".sqlite"));
  if (!dbEntry || dbEntry.dir) {
    throw new Error("Invalid backup archive: database file missing");
  }
  reportProgress(onProgress, "restore", "installing_db", 30);
  const sqliteBytes = Buffer.from(await dbEntry.async("nodebuffer"));
  if (!isSqlitePayload(sqliteBytes)) {
    throw new Error("Invalid backup archive: database is not SQLite");
  }
  writeDecryptedDb(sqliteBytes);
  reportProgress(onProgress, "restore", "installing_db", 42);
  await restoreAssetsFromArchive(zip, onProgress);
  reportProgress(onProgress, "restore", "finalizing", 90);
  rewriteAbsoluteAssetPathsInDb();
  reportProgress(onProgress, "restore", "finalizing", 98);
}
let backupBusy = false;
function isBackupBusy() {
  return backupBusy;
}
async function createBackupInternal(onProgress) {
  if (backupBusy) throw new Error("A backup operation is already in progress");
  backupBusy = true;
  openDatabase();
  try {
    reportProgress(onProgress, "create", "prepare_db", 2);
    const sqliteBytes = checkpointAndReadDb();
    reportProgress(onProgress, "create", "prepare_db", 8);
    await yieldToEventLoop();
    const archiveBytes = await buildBackupArchive(sqliteBytes, onProgress);
    reportProgress(onProgress, "create", "encrypting", 76);
    await yieldToEventLoop();
    const encrypted = encryptBackupPayload(archiveBytes);
    reportProgress(onProgress, "create", "encrypting", 90);
    reportProgress(onProgress, "create", "writing", 92);
    const backupDir = ensureBackupDir();
    const target = path$1.join(backupDir, LATEST_BACKUP_FILENAME);
    fs$1.writeFileSync(target, encrypted);
    pruneOlderBackups(backupDir, LATEST_BACKUP_FILENAME);
    openDatabase();
    runMigrations(getDb());
    reportProgress(onProgress, "create", "writing", 100);
    return { ok: true, filePath: target };
  } catch (error) {
    openDatabase();
    throw error;
  } finally {
    backupBusy = false;
  }
}
async function createBackup(onProgress) {
  requirePermission("system:backup_create");
  return createBackupInternal(onProgress);
}
async function installEncryptedBackup(filePath, onProgress) {
  if (!filePath || !fs$1.existsSync(filePath)) {
    throw new Error("Backup file not found");
  }
  reportProgress(onProgress, "restore", "reading", 2);
  const payload = fs$1.readFileSync(filePath);
  reportProgress(onProgress, "restore", "reading", 6);
  await yieldToEventLoop();
  reportProgress(onProgress, "restore", "decrypting", 8);
  const decrypted = decryptBackupPayload(payload);
  reportProgress(onProgress, "restore", "decrypting", 18);
  await yieldToEventLoop();
  if (isZipPayload(decrypted)) {
    await restoreFromArchive(decrypted, onProgress);
    return;
  }
  if (!isSqlitePayload(decrypted)) {
    throw new Error("Invalid backup file: decrypted data is not a Kaarobar backup");
  }
  reportProgress(onProgress, "restore", "installing_db", 25);
  writeDecryptedDb(decrypted);
  reportProgress(onProgress, "restore", "finalizing", 85);
  rewriteAbsoluteAssetPathsInDb();
  reportProgress(onProgress, "restore", "finalizing", 98);
}
async function restoreBackup(filePath, onProgress) {
  requirePermission("system:backup_restore");
  if (backupBusy) throw new Error("A backup operation is already in progress");
  backupBusy = true;
  try {
    await installEncryptedBackup(filePath, onProgress);
    reportProgress(onProgress, "restore", "finalizing", 99);
    const businessId = syncActiveBusinessAfterRestore();
    logout();
    reportProgress(onProgress, "restore", "finalizing", 100);
    return { ok: true, businessId };
  } finally {
    backupBusy = false;
  }
}
async function pickBackupFile() {
  const result = await dialog.showOpenDialog({
    title: "Choose Kaarobar backup",
    properties: ["openFile"],
    filters: [
      { name: "Kaarobar backup", extensions: ["kaarobar-backup"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
}
const BUSINESS_NATURES = ["retail", "food", "salon", "services"];
function isBusinessNature(value) {
  return typeof value === "string" && BUSINESS_NATURES.includes(value);
}
function normalizeBusinessNature(value) {
  return isBusinessNature(value) ? value : "retail";
}
function kindsForNature(nature) {
  switch (nature) {
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
function defaultTracksStock(kind) {
  return kind === "item";
}
function showsTables(nature) {
  return nature === "food";
}
function showsServiceMode(nature) {
  return nature === "food";
}
function showsServedBy(nature) {
  return nature === "salon" || nature === "services";
}
function isValidProductKind(nature, kind) {
  return kindsForNature(nature).includes(kind);
}
function nowIso$1() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function getBootState() {
  try {
    fs$1.mkdirSync(getKaarobarDataDir(), { recursive: true });
    const setupComplete = appStore.get("setupComplete");
    const language = normalizeAppLanguage(appStore.get("language"));
    if (!setupComplete || !dbExists()) {
      return { status: "needs_setup" };
    }
    openDatabase();
    runMigrations(getDb());
    flushLicenseToDatabase();
    const licenseStatus = getLicenseStatus();
    if (licenseStatus.status === "none") {
      return { status: "needs_license" };
    }
    if (licenseStatus.status === "expired") {
      return {
        status: "license_expired",
        expiresAt: licenseStatus.record.expiresAt,
        issuedTo: licenseStatus.record.issuedTo
      };
    }
    return { status: "needs_login", language };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to boot application"
    };
  }
}
const DEFAULT_BOOT_BRAND_COLOR = "#2d6df6";
function getBootBrandColor() {
  var _a, _b;
  try {
    if (!appStore.get("setupComplete") || !dbExists()) return DEFAULT_BOOT_BRAND_COLOR;
    openDatabase();
    runMigrations(getDb());
    const lastId = appStore.get("lastBusinessId");
    if (lastId) {
      const row = getDb().prepare("SELECT brand_color FROM businesses WHERE id = ?").get(lastId);
      if ((_a = row == null ? void 0 : row.brand_color) == null ? void 0 : _a.trim()) return row.brand_color.trim();
    }
    const first = getDb().prepare("SELECT brand_color FROM businesses ORDER BY created_at ASC LIMIT 1").get();
    return ((_b = first == null ? void 0 : first.brand_color) == null ? void 0 : _b.trim()) || DEFAULT_BOOT_BRAND_COLOR;
  } catch {
    return DEFAULT_BOOT_BRAND_COLOR;
  }
}
async function completeSetup(payload) {
  try {
    fs$1.mkdirSync(getKaarobarDataDir(), { recursive: true });
    let license = readValidLocalLicense();
    if (!license || license.licenseKey !== payload.licenseKey.trim()) {
      const activation = await activateLicense(payload.licenseKey);
      if (!activation.ok) return { ok: false, error: activation.error, message: activation.message };
      license = readValidLocalLicense();
    }
    if (!license) {
      return { ok: false, error: "license_missing", message: "License activation could not be saved locally." };
    }
    if (dbExists() && appStore.get("setupComplete")) {
      return { ok: false, error: "already_setup", message: "Setup has already been completed on this device." };
    }
    closeDatabase();
    const db2 = openDatabase();
    runMigrations(db2);
    flushLicenseToDatabase();
    const ownerId = v4();
    const businessId = v4();
    const branchId = v4();
    const createdAt = nowIso$1();
    const passwordHash = bcrypt.hashSync(payload.owner.password, 12);
    db2.transaction(() => {
      db2.prepare(
        `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
         VALUES (?, NULL, NULL, ?, ?, ?, 'owner', 1, ?)`
      ).run(ownerId, payload.owner.name.trim(), payload.owner.email.trim().toLowerCase(), passwordHash, createdAt);
      db2.prepare(
        `INSERT INTO businesses (
           id, owner_id, name, currency, brand_color, business_nature, logo_path,
           receipt_header, receipt_footer,
           is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)`
      ).run(
        businessId,
        ownerId,
        payload.business.name.trim(),
        payload.business.currency.trim() || "PKR",
        payload.business.brandColor,
        normalizeBusinessNature(payload.business.businessNature),
        "Thank you for shopping with us",
        createdAt,
        createdAt
      );
      db2.prepare(
        `INSERT INTO branches (id, business_id, name, address, phone, is_main_branch, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, 1, ?)`
      ).run(
        branchId,
        businessId,
        payload.branch.name.trim(),
        payload.branch.address.trim() || null,
        payload.branch.phone.trim() || null,
        createdAt
      );
      db2.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        "",
        "language",
        normalizeAppLanguage(payload.language)
      );
      db2.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        businessId,
        "receipt_footer",
        "Thank you for shopping with us"
      );
      db2.prepare("INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)").run(
        businessId,
        "idle_lock_minutes",
        "10"
      );
    })();
    flushLicenseToDatabase();
    appStore.set("setupComplete", true);
    appStore.set("language", normalizeAppLanguage(payload.language));
    appStore.set("lastBusinessId", businessId);
    fs$1.writeFileSync(path$1.join(getKaarobarDataDir(), "setup.complete"), nowIso$1(), "utf8");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: "setup_failed",
      message: error instanceof Error ? error.message : "Setup failed"
    };
  }
}
async function restoreSetupFromBackup(payload, onProgress) {
  try {
    fs$1.mkdirSync(getKaarobarDataDir(), { recursive: true });
    if (dbExists() && appStore.get("setupComplete")) {
      return { ok: false, error: "already_setup", message: "Setup has already been completed on this device." };
    }
    let license = readValidLocalLicense();
    if (!license || license.licenseKey !== payload.licenseKey.trim()) {
      const activation = await activateLicense(payload.licenseKey);
      if (!activation.ok) return { ok: false, error: activation.error, message: activation.message };
      license = readValidLocalLicense();
    }
    if (!license) {
      return { ok: false, error: "license_missing", message: "License activation could not be saved locally." };
    }
    await installEncryptedBackup(payload.filePath, onProgress);
    onProgress == null ? void 0 : onProgress({ operation: "restore", phase: "finalizing", percent: 99 });
    flushLicenseToDatabase();
    const db2 = getDb();
    const languageRow = db2.prepare(`SELECT value FROM settings WHERE key = 'language' ORDER BY business_id ASC LIMIT 1`).get();
    const language = normalizeAppLanguage(languageRow == null ? void 0 : languageRow.value);
    syncActiveBusinessAfterRestore();
    appStore.set("setupComplete", true);
    appStore.set("language", language);
    fs$1.writeFileSync(path$1.join(getKaarobarDataDir(), "setup.complete"), nowIso$1(), "utf8");
    onProgress == null ? void 0 : onProgress({ operation: "restore", phase: "finalizing", percent: 100 });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: "setup_failed",
      message: error instanceof Error ? error.message : "Failed to restore from backup"
    };
  }
}
const WINDOW_DAYS = 7;
const ALERT_DAYS_THRESHOLD = 3;
const cache = /* @__PURE__ */ new Map();
function sinceIso(days) {
  const d = /* @__PURE__ */ new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function ensureDb() {
  openDatabase();
  runMigrations(getDb());
  return getDb();
}
function listActiveBusinessIds() {
  const db2 = ensureDb();
  const rows = db2.prepare("SELECT id FROM businesses WHERE is_active = 1").all();
  return rows.map((r) => r.id);
}
function computeRestockAlertsForBusiness(businessId) {
  const db2 = ensureDb();
  const since = sinceIso(WINDOW_DAYS);
  const rows = db2.prepare(
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
  ).all(businessId, since, businessId);
  const alerts = [];
  for (const row of rows) {
    const avgDailyQty = row.qty_sold / WINDOW_DAYS;
    if (avgDailyQty <= 0) continue;
    const daysLeft = row.stock_qty / avgDailyQty;
    if (daysLeft > ALERT_DAYS_THRESHOLD) continue;
    const recommendedQty = Math.max(0, Math.ceil(avgDailyQty * 7 - row.stock_qty));
    alerts.push({
      productId: row.id,
      productName: row.name,
      stockQty: row.stock_qty,
      avgDailyQty: Number(avgDailyQty.toFixed(2)),
      daysLeft: Number(daysLeft.toFixed(1)),
      recommendedQty
    });
  }
  alerts.sort((a, b) => a.daysLeft - b.daysLeft || a.stockQty - b.stockQty);
  cache.set(businessId, { atMs: Date.now(), alerts });
  return alerts;
}
function getRestockAlertsForBusiness(businessId) {
  const cached = cache.get(businessId);
  if (cached && Date.now() - cached.atMs < 30 * 60 * 1e3) {
    return cached.alerts;
  }
  return computeRestockAlertsForBusiness(businessId);
}
const LICENSE_WARN_DAYS = 7;
let running$1 = false;
function localDateKey$1(d = /* @__PURE__ */ new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function daysUntil(iso, now = /* @__PURE__ */ new Date()) {
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return Number.POSITIVE_INFINITY;
  return (target - now.getTime()) / (24 * 60 * 60 * 1e3);
}
function buildLicenseReminder(now = /* @__PURE__ */ new Date()) {
  const status = getLicenseStatus();
  if (status.status === "none") {
    return { kind: "missing", expiresAt: null, issuedTo: null, daysLeft: null };
  }
  if (status.status === "expired") {
    return {
      kind: "expired",
      expiresAt: status.record.expiresAt,
      issuedTo: status.record.issuedTo,
      daysLeft: 0
    };
  }
  if (!status.record.expiresAt) {
    return null;
  }
  const left = daysUntil(status.record.expiresAt, now);
  if (left > LICENSE_WARN_DAYS) return null;
  return {
    kind: "expiring",
    expiresAt: status.record.expiresAt,
    issuedTo: status.record.issuedTo,
    daysLeft: Math.max(0, Math.ceil(left))
  };
}
function collectRestockAlerts() {
  const businessIds = listActiveBusinessIds();
  const merged = [];
  for (const businessId of businessIds) {
    try {
      merged.push(...computeRestockAlertsForBusiness(businessId));
    } catch (error) {
      console.error("[daily-reminders] restock failed", businessId, error);
    }
  }
  merged.sort((a, b) => a.daysLeft - b.daysLeft || a.stockQty - b.stockQty);
  return merged;
}
function broadcast(event) {
  for (const win2 of BrowserWindow.getAllWindows()) {
    if (win2.isDestroyed()) continue;
    win2.webContents.send(IPC_CHANNELS.REMINDERS_DAILY, event);
  }
}
function runDailyReminderJob(now = /* @__PURE__ */ new Date()) {
  const restock = collectRestockAlerts();
  const license = buildLicenseReminder(now);
  const event = {
    date: localDateKey$1(now),
    at: now.toISOString(),
    restock,
    license
  };
  broadcast(event);
  return event;
}
function maybeRunDailyReminders() {
  if (running$1) return { ran: false };
  running$1 = true;
  try {
    runDailyReminderJob();
    return { ran: true };
  } catch (error) {
    console.error("[daily-reminders] failed", error);
    return { ran: false };
  } finally {
    running$1 = false;
  }
}
function abbreviateName(name, maxLen = 4) {
  const words = name.trim().split(/\s+/).map((w) => w.replace(/[^a-zA-Z0-9]/g, "")).filter(Boolean);
  if (words.length === 0) return "X";
  if (words.length >= 2) {
    const initials = words.map((w) => w[0] ?? "").join("").toUpperCase();
    return initials.slice(0, maxLen) || "X";
  }
  return words[0].toUpperCase().slice(0, Math.min(3, maxLen)) || "X";
}
function formatInvoiceNumber(businessName, branchName, sequence) {
  const biz = abbreviateName(businessName);
  const branch = abbreviateName(branchName);
  return `KB-${biz}-${branch}-${sequence}`;
}
function invoicePrefix(businessName, branchName) {
  return `KB-${abbreviateName(businessName)}-${abbreviateName(branchName)}-`;
}
function parseInvoiceSequence(invoiceNo, prefix) {
  if (!invoiceNo.startsWith(prefix)) return null;
  const n = Number.parseInt(invoiceNo.slice(prefix.length), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
var server = {};
var canPromise$1 = function() {
  return typeof Promise === "function" && Promise.prototype && Promise.prototype.then;
};
var qrcode = {};
var utils$1 = {};
let toSJISFunction;
const CODEWORDS_COUNT = [
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
utils$1.getSymbolSize = function getSymbolSize(version2) {
  if (!version2) throw new Error('"version" cannot be null or undefined');
  if (version2 < 1 || version2 > 40) throw new Error('"version" should be in range from 1 to 40');
  return version2 * 4 + 17;
};
utils$1.getSymbolTotalCodewords = function getSymbolTotalCodewords(version2) {
  return CODEWORDS_COUNT[version2];
};
utils$1.getBCHDigit = function(data) {
  let digit = 0;
  while (data !== 0) {
    digit++;
    data >>>= 1;
  }
  return digit;
};
utils$1.setToSJISFunction = function setToSJISFunction(f) {
  if (typeof f !== "function") {
    throw new Error('"toSJISFunc" is not a valid function.');
  }
  toSJISFunction = f;
};
utils$1.isKanjiModeEnabled = function() {
  return typeof toSJISFunction !== "undefined";
};
utils$1.toSJIS = function toSJIS(kanji2) {
  return toSJISFunction(kanji2);
};
var errorCorrectionLevel = {};
(function(exports) {
  exports.L = { bit: 1 };
  exports.M = { bit: 0 };
  exports.Q = { bit: 3 };
  exports.H = { bit: 2 };
  function fromString(string) {
    if (typeof string !== "string") {
      throw new Error("Param is not a string");
    }
    const lcStr = string.toLowerCase();
    switch (lcStr) {
      case "l":
      case "low":
        return exports.L;
      case "m":
      case "medium":
        return exports.M;
      case "q":
      case "quartile":
        return exports.Q;
      case "h":
      case "high":
        return exports.H;
      default:
        throw new Error("Unknown EC Level: " + string);
    }
  }
  exports.isValid = function isValid2(level) {
    return level && typeof level.bit !== "undefined" && level.bit >= 0 && level.bit < 4;
  };
  exports.from = function from(value, defaultValue) {
    if (exports.isValid(value)) {
      return value;
    }
    try {
      return fromString(value);
    } catch (e) {
      return defaultValue;
    }
  };
})(errorCorrectionLevel);
function BitBuffer$1() {
  this.buffer = [];
  this.length = 0;
}
BitBuffer$1.prototype = {
  get: function(index) {
    const bufIndex = Math.floor(index / 8);
    return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
  },
  put: function(num, length) {
    for (let i = 0; i < length; i++) {
      this.putBit((num >>> length - i - 1 & 1) === 1);
    }
  },
  getLengthInBits: function() {
    return this.length;
  },
  putBit: function(bit) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 128 >>> this.length % 8;
    }
    this.length++;
  }
};
var bitBuffer = BitBuffer$1;
function BitMatrix$1(size) {
  if (!size || size < 1) {
    throw new Error("BitMatrix size must be defined and greater than 0");
  }
  this.size = size;
  this.data = new Uint8Array(size * size);
  this.reservedBit = new Uint8Array(size * size);
}
BitMatrix$1.prototype.set = function(row, col, value, reserved) {
  const index = row * this.size + col;
  this.data[index] = value;
  if (reserved) this.reservedBit[index] = true;
};
BitMatrix$1.prototype.get = function(row, col) {
  return this.data[row * this.size + col];
};
BitMatrix$1.prototype.xor = function(row, col, value) {
  this.data[row * this.size + col] ^= value;
};
BitMatrix$1.prototype.isReserved = function(row, col) {
  return this.reservedBit[row * this.size + col];
};
var bitMatrix = BitMatrix$1;
var alignmentPattern = {};
(function(exports) {
  const getSymbolSize3 = utils$1.getSymbolSize;
  exports.getRowColCoords = function getRowColCoords(version2) {
    if (version2 === 1) return [];
    const posCount = Math.floor(version2 / 7) + 2;
    const size = getSymbolSize3(version2);
    const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
    const positions = [size - 7];
    for (let i = 1; i < posCount - 1; i++) {
      positions[i] = positions[i - 1] - intervals;
    }
    positions.push(6);
    return positions.reverse();
  };
  exports.getPositions = function getPositions2(version2) {
    const coords = [];
    const pos = exports.getRowColCoords(version2);
    const posLength = pos.length;
    for (let i = 0; i < posLength; i++) {
      for (let j = 0; j < posLength; j++) {
        if (i === 0 && j === 0 || // top-left
        i === 0 && j === posLength - 1 || // bottom-left
        i === posLength - 1 && j === 0) {
          continue;
        }
        coords.push([pos[i], pos[j]]);
      }
    }
    return coords;
  };
})(alignmentPattern);
var finderPattern = {};
const getSymbolSize2 = utils$1.getSymbolSize;
const FINDER_PATTERN_SIZE = 7;
finderPattern.getPositions = function getPositions(version2) {
  const size = getSymbolSize2(version2);
  return [
    // top-left
    [0, 0],
    // top-right
    [size - FINDER_PATTERN_SIZE, 0],
    // bottom-left
    [0, size - FINDER_PATTERN_SIZE]
  ];
};
var maskPattern = {};
(function(exports) {
  exports.Patterns = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  };
  const PenaltyScores = {
    N1: 3,
    N2: 3,
    N3: 40,
    N4: 10
  };
  exports.isValid = function isValid2(mask) {
    return mask != null && mask !== "" && !isNaN(mask) && mask >= 0 && mask <= 7;
  };
  exports.from = function from(value) {
    return exports.isValid(value) ? parseInt(value, 10) : void 0;
  };
  exports.getPenaltyN1 = function getPenaltyN1(data) {
    const size = data.size;
    let points = 0;
    let sameCountCol = 0;
    let sameCountRow = 0;
    let lastCol = null;
    let lastRow = null;
    for (let row = 0; row < size; row++) {
      sameCountCol = sameCountRow = 0;
      lastCol = lastRow = null;
      for (let col = 0; col < size; col++) {
        let module = data.get(row, col);
        if (module === lastCol) {
          sameCountCol++;
        } else {
          if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
          lastCol = module;
          sameCountCol = 1;
        }
        module = data.get(col, row);
        if (module === lastRow) {
          sameCountRow++;
        } else {
          if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
          lastRow = module;
          sameCountRow = 1;
        }
      }
      if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
      if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
    }
    return points;
  };
  exports.getPenaltyN2 = function getPenaltyN2(data) {
    const size = data.size;
    let points = 0;
    for (let row = 0; row < size - 1; row++) {
      for (let col = 0; col < size - 1; col++) {
        const last = data.get(row, col) + data.get(row, col + 1) + data.get(row + 1, col) + data.get(row + 1, col + 1);
        if (last === 4 || last === 0) points++;
      }
    }
    return points * PenaltyScores.N2;
  };
  exports.getPenaltyN3 = function getPenaltyN3(data) {
    const size = data.size;
    let points = 0;
    let bitsCol = 0;
    let bitsRow = 0;
    for (let row = 0; row < size; row++) {
      bitsCol = bitsRow = 0;
      for (let col = 0; col < size; col++) {
        bitsCol = bitsCol << 1 & 2047 | data.get(row, col);
        if (col >= 10 && (bitsCol === 1488 || bitsCol === 93)) points++;
        bitsRow = bitsRow << 1 & 2047 | data.get(col, row);
        if (col >= 10 && (bitsRow === 1488 || bitsRow === 93)) points++;
      }
    }
    return points * PenaltyScores.N3;
  };
  exports.getPenaltyN4 = function getPenaltyN4(data) {
    let darkCount = 0;
    const modulesCount = data.data.length;
    for (let i = 0; i < modulesCount; i++) darkCount += data.data[i];
    const k = Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10);
    return k * PenaltyScores.N4;
  };
  function getMaskAt(maskPattern2, i, j) {
    switch (maskPattern2) {
      case exports.Patterns.PATTERN000:
        return (i + j) % 2 === 0;
      case exports.Patterns.PATTERN001:
        return i % 2 === 0;
      case exports.Patterns.PATTERN010:
        return j % 3 === 0;
      case exports.Patterns.PATTERN011:
        return (i + j) % 3 === 0;
      case exports.Patterns.PATTERN100:
        return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case exports.Patterns.PATTERN101:
        return i * j % 2 + i * j % 3 === 0;
      case exports.Patterns.PATTERN110:
        return (i * j % 2 + i * j % 3) % 2 === 0;
      case exports.Patterns.PATTERN111:
        return (i * j % 3 + (i + j) % 2) % 2 === 0;
      default:
        throw new Error("bad maskPattern:" + maskPattern2);
    }
  }
  exports.applyMask = function applyMask(pattern, data) {
    const size = data.size;
    for (let col = 0; col < size; col++) {
      for (let row = 0; row < size; row++) {
        if (data.isReserved(row, col)) continue;
        data.xor(row, col, getMaskAt(pattern, row, col));
      }
    }
  };
  exports.getBestMask = function getBestMask(data, setupFormatFunc) {
    const numPatterns = Object.keys(exports.Patterns).length;
    let bestPattern = 0;
    let lowerPenalty = Infinity;
    for (let p = 0; p < numPatterns; p++) {
      setupFormatFunc(p);
      exports.applyMask(p, data);
      const penalty = exports.getPenaltyN1(data) + exports.getPenaltyN2(data) + exports.getPenaltyN3(data) + exports.getPenaltyN4(data);
      exports.applyMask(p, data);
      if (penalty < lowerPenalty) {
        lowerPenalty = penalty;
        bestPattern = p;
      }
    }
    return bestPattern;
  };
})(maskPattern);
var errorCorrectionCode = {};
const ECLevel$1 = errorCorrectionLevel;
const EC_BLOCKS_TABLE = [
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
];
const EC_CODEWORDS_TABLE = [
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
errorCorrectionCode.getBlocksCount = function getBlocksCount(version2, errorCorrectionLevel2) {
  switch (errorCorrectionLevel2) {
    case ECLevel$1.L:
      return EC_BLOCKS_TABLE[(version2 - 1) * 4 + 0];
    case ECLevel$1.M:
      return EC_BLOCKS_TABLE[(version2 - 1) * 4 + 1];
    case ECLevel$1.Q:
      return EC_BLOCKS_TABLE[(version2 - 1) * 4 + 2];
    case ECLevel$1.H:
      return EC_BLOCKS_TABLE[(version2 - 1) * 4 + 3];
    default:
      return void 0;
  }
};
errorCorrectionCode.getTotalCodewordsCount = function getTotalCodewordsCount(version2, errorCorrectionLevel2) {
  switch (errorCorrectionLevel2) {
    case ECLevel$1.L:
      return EC_CODEWORDS_TABLE[(version2 - 1) * 4 + 0];
    case ECLevel$1.M:
      return EC_CODEWORDS_TABLE[(version2 - 1) * 4 + 1];
    case ECLevel$1.Q:
      return EC_CODEWORDS_TABLE[(version2 - 1) * 4 + 2];
    case ECLevel$1.H:
      return EC_CODEWORDS_TABLE[(version2 - 1) * 4 + 3];
    default:
      return void 0;
  }
};
var polynomial = {};
var galoisField = {};
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);
(function initTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 256) {
      x ^= 285;
    }
  }
  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255];
  }
})();
galoisField.log = function log(n) {
  if (n < 1) throw new Error("log(" + n + ")");
  return LOG_TABLE[n];
};
galoisField.exp = function exp(n) {
  return EXP_TABLE[n];
};
galoisField.mul = function mul(x, y) {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
};
(function(exports) {
  const GF = galoisField;
  exports.mul = function mul2(p1, p2) {
    const coeff = new Uint8Array(p1.length + p2.length - 1);
    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        coeff[i + j] ^= GF.mul(p1[i], p2[j]);
      }
    }
    return coeff;
  };
  exports.mod = function mod(divident, divisor) {
    let result = new Uint8Array(divident);
    while (result.length - divisor.length >= 0) {
      const coeff = result[0];
      for (let i = 0; i < divisor.length; i++) {
        result[i] ^= GF.mul(divisor[i], coeff);
      }
      let offset = 0;
      while (offset < result.length && result[offset] === 0) offset++;
      result = result.slice(offset);
    }
    return result;
  };
  exports.generateECPolynomial = function generateECPolynomial(degree) {
    let poly = new Uint8Array([1]);
    for (let i = 0; i < degree; i++) {
      poly = exports.mul(poly, new Uint8Array([1, GF.exp(i)]));
    }
    return poly;
  };
})(polynomial);
const Polynomial = polynomial;
function ReedSolomonEncoder$1(degree) {
  this.genPoly = void 0;
  this.degree = degree;
  if (this.degree) this.initialize(this.degree);
}
ReedSolomonEncoder$1.prototype.initialize = function initialize(degree) {
  this.degree = degree;
  this.genPoly = Polynomial.generateECPolynomial(this.degree);
};
ReedSolomonEncoder$1.prototype.encode = function encode(data) {
  if (!this.genPoly) {
    throw new Error("Encoder not initialized");
  }
  const paddedData = new Uint8Array(data.length + this.degree);
  paddedData.set(data);
  const remainder = Polynomial.mod(paddedData, this.genPoly);
  const start = this.degree - remainder.length;
  if (start > 0) {
    const buff = new Uint8Array(this.degree);
    buff.set(remainder, start);
    return buff;
  }
  return remainder;
};
var reedSolomonEncoder = ReedSolomonEncoder$1;
var version = {};
var mode = {};
var versionCheck = {};
versionCheck.isValid = function isValid(version2) {
  return !isNaN(version2) && version2 >= 1 && version2 <= 40;
};
var regex = {};
const numeric = "[0-9]+";
const alphanumeric = "[A-Z $%*+\\-./:]+";
let kanji = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
kanji = kanji.replace(/u/g, "\\u");
const byte = "(?:(?![A-Z0-9 $%*+\\-./:]|" + kanji + ")(?:.|[\r\n]))+";
regex.KANJI = new RegExp(kanji, "g");
regex.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
regex.BYTE = new RegExp(byte, "g");
regex.NUMERIC = new RegExp(numeric, "g");
regex.ALPHANUMERIC = new RegExp(alphanumeric, "g");
const TEST_KANJI = new RegExp("^" + kanji + "$");
const TEST_NUMERIC = new RegExp("^" + numeric + "$");
const TEST_ALPHANUMERIC = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
regex.testKanji = function testKanji(str) {
  return TEST_KANJI.test(str);
};
regex.testNumeric = function testNumeric(str) {
  return TEST_NUMERIC.test(str);
};
regex.testAlphanumeric = function testAlphanumeric(str) {
  return TEST_ALPHANUMERIC.test(str);
};
(function(exports) {
  const VersionCheck = versionCheck;
  const Regex = regex;
  exports.NUMERIC = {
    id: "Numeric",
    bit: 1 << 0,
    ccBits: [10, 12, 14]
  };
  exports.ALPHANUMERIC = {
    id: "Alphanumeric",
    bit: 1 << 1,
    ccBits: [9, 11, 13]
  };
  exports.BYTE = {
    id: "Byte",
    bit: 1 << 2,
    ccBits: [8, 16, 16]
  };
  exports.KANJI = {
    id: "Kanji",
    bit: 1 << 3,
    ccBits: [8, 10, 12]
  };
  exports.MIXED = {
    bit: -1
  };
  exports.getCharCountIndicator = function getCharCountIndicator(mode2, version2) {
    if (!mode2.ccBits) throw new Error("Invalid mode: " + mode2);
    if (!VersionCheck.isValid(version2)) {
      throw new Error("Invalid version: " + version2);
    }
    if (version2 >= 1 && version2 < 10) return mode2.ccBits[0];
    else if (version2 < 27) return mode2.ccBits[1];
    return mode2.ccBits[2];
  };
  exports.getBestModeForData = function getBestModeForData(dataStr) {
    if (Regex.testNumeric(dataStr)) return exports.NUMERIC;
    else if (Regex.testAlphanumeric(dataStr)) return exports.ALPHANUMERIC;
    else if (Regex.testKanji(dataStr)) return exports.KANJI;
    else return exports.BYTE;
  };
  exports.toString = function toString3(mode2) {
    if (mode2 && mode2.id) return mode2.id;
    throw new Error("Invalid mode");
  };
  exports.isValid = function isValid2(mode2) {
    return mode2 && mode2.bit && mode2.ccBits;
  };
  function fromString(string) {
    if (typeof string !== "string") {
      throw new Error("Param is not a string");
    }
    const lcStr = string.toLowerCase();
    switch (lcStr) {
      case "numeric":
        return exports.NUMERIC;
      case "alphanumeric":
        return exports.ALPHANUMERIC;
      case "kanji":
        return exports.KANJI;
      case "byte":
        return exports.BYTE;
      default:
        throw new Error("Unknown mode: " + string);
    }
  }
  exports.from = function from(value, defaultValue) {
    if (exports.isValid(value)) {
      return value;
    }
    try {
      return fromString(value);
    } catch (e) {
      return defaultValue;
    }
  };
})(mode);
(function(exports) {
  const Utils2 = utils$1;
  const ECCode2 = errorCorrectionCode;
  const ECLevel2 = errorCorrectionLevel;
  const Mode2 = mode;
  const VersionCheck = versionCheck;
  const G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
  const G18_BCH = Utils2.getBCHDigit(G18);
  function getBestVersionForDataLength(mode2, length, errorCorrectionLevel2) {
    for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
      if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel2, mode2)) {
        return currentVersion;
      }
    }
    return void 0;
  }
  function getReservedBitsCount(mode2, version2) {
    return Mode2.getCharCountIndicator(mode2, version2) + 4;
  }
  function getTotalBitsFromDataArray(segments2, version2) {
    let totalBits = 0;
    segments2.forEach(function(data) {
      const reservedBits = getReservedBitsCount(data.mode, version2);
      totalBits += reservedBits + data.getBitsLength();
    });
    return totalBits;
  }
  function getBestVersionForMixedData(segments2, errorCorrectionLevel2) {
    for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
      const length = getTotalBitsFromDataArray(segments2, currentVersion);
      if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel2, Mode2.MIXED)) {
        return currentVersion;
      }
    }
    return void 0;
  }
  exports.from = function from(value, defaultValue) {
    if (VersionCheck.isValid(value)) {
      return parseInt(value, 10);
    }
    return defaultValue;
  };
  exports.getCapacity = function getCapacity(version2, errorCorrectionLevel2, mode2) {
    if (!VersionCheck.isValid(version2)) {
      throw new Error("Invalid QR Code version");
    }
    if (typeof mode2 === "undefined") mode2 = Mode2.BYTE;
    const totalCodewords = Utils2.getSymbolTotalCodewords(version2);
    const ecTotalCodewords = ECCode2.getTotalCodewordsCount(version2, errorCorrectionLevel2);
    const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
    if (mode2 === Mode2.MIXED) return dataTotalCodewordsBits;
    const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode2, version2);
    switch (mode2) {
      case Mode2.NUMERIC:
        return Math.floor(usableBits / 10 * 3);
      case Mode2.ALPHANUMERIC:
        return Math.floor(usableBits / 11 * 2);
      case Mode2.KANJI:
        return Math.floor(usableBits / 13);
      case Mode2.BYTE:
      default:
        return Math.floor(usableBits / 8);
    }
  };
  exports.getBestVersionForData = function getBestVersionForData(data, errorCorrectionLevel2) {
    let seg;
    const ecl = ECLevel2.from(errorCorrectionLevel2, ECLevel2.M);
    if (Array.isArray(data)) {
      if (data.length > 1) {
        return getBestVersionForMixedData(data, ecl);
      }
      if (data.length === 0) {
        return 1;
      }
      seg = data[0];
    } else {
      seg = data;
    }
    return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
  };
  exports.getEncodedBits = function getEncodedBits2(version2) {
    if (!VersionCheck.isValid(version2) || version2 < 7) {
      throw new Error("Invalid QR Code version");
    }
    let d = version2 << 12;
    while (Utils2.getBCHDigit(d) - G18_BCH >= 0) {
      d ^= G18 << Utils2.getBCHDigit(d) - G18_BCH;
    }
    return version2 << 12 | d;
  };
})(version);
var formatInfo = {};
const Utils$3 = utils$1;
const G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
const G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
const G15_BCH = Utils$3.getBCHDigit(G15);
formatInfo.getEncodedBits = function getEncodedBits(errorCorrectionLevel2, mask) {
  const data = errorCorrectionLevel2.bit << 3 | mask;
  let d = data << 10;
  while (Utils$3.getBCHDigit(d) - G15_BCH >= 0) {
    d ^= G15 << Utils$3.getBCHDigit(d) - G15_BCH;
  }
  return (data << 10 | d) ^ G15_MASK;
};
var segments = {};
const Mode$4 = mode;
function NumericData(data) {
  this.mode = Mode$4.NUMERIC;
  this.data = data.toString();
}
NumericData.getBitsLength = function getBitsLength(length) {
  return 10 * Math.floor(length / 3) + (length % 3 ? length % 3 * 3 + 1 : 0);
};
NumericData.prototype.getLength = function getLength() {
  return this.data.length;
};
NumericData.prototype.getBitsLength = function getBitsLength2() {
  return NumericData.getBitsLength(this.data.length);
};
NumericData.prototype.write = function write(bitBuffer2) {
  let i, group, value;
  for (i = 0; i + 3 <= this.data.length; i += 3) {
    group = this.data.substr(i, 3);
    value = parseInt(group, 10);
    bitBuffer2.put(value, 10);
  }
  const remainingNum = this.data.length - i;
  if (remainingNum > 0) {
    group = this.data.substr(i);
    value = parseInt(group, 10);
    bitBuffer2.put(value, remainingNum * 3 + 1);
  }
};
var numericData = NumericData;
const Mode$3 = mode;
const ALPHA_NUM_CHARS = [
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
function AlphanumericData(data) {
  this.mode = Mode$3.ALPHANUMERIC;
  this.data = data;
}
AlphanumericData.getBitsLength = function getBitsLength3(length) {
  return 11 * Math.floor(length / 2) + 6 * (length % 2);
};
AlphanumericData.prototype.getLength = function getLength2() {
  return this.data.length;
};
AlphanumericData.prototype.getBitsLength = function getBitsLength4() {
  return AlphanumericData.getBitsLength(this.data.length);
};
AlphanumericData.prototype.write = function write2(bitBuffer2) {
  let i;
  for (i = 0; i + 2 <= this.data.length; i += 2) {
    let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;
    value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);
    bitBuffer2.put(value, 11);
  }
  if (this.data.length % 2) {
    bitBuffer2.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
  }
};
var alphanumericData = AlphanumericData;
const Mode$2 = mode;
function ByteData(data) {
  this.mode = Mode$2.BYTE;
  if (typeof data === "string") {
    this.data = new TextEncoder().encode(data);
  } else {
    this.data = new Uint8Array(data);
  }
}
ByteData.getBitsLength = function getBitsLength5(length) {
  return length * 8;
};
ByteData.prototype.getLength = function getLength3() {
  return this.data.length;
};
ByteData.prototype.getBitsLength = function getBitsLength6() {
  return ByteData.getBitsLength(this.data.length);
};
ByteData.prototype.write = function(bitBuffer2) {
  for (let i = 0, l = this.data.length; i < l; i++) {
    bitBuffer2.put(this.data[i], 8);
  }
};
var byteData = ByteData;
const Mode$1 = mode;
const Utils$2 = utils$1;
function KanjiData(data) {
  this.mode = Mode$1.KANJI;
  this.data = data;
}
KanjiData.getBitsLength = function getBitsLength7(length) {
  return length * 13;
};
KanjiData.prototype.getLength = function getLength4() {
  return this.data.length;
};
KanjiData.prototype.getBitsLength = function getBitsLength8() {
  return KanjiData.getBitsLength(this.data.length);
};
KanjiData.prototype.write = function(bitBuffer2) {
  let i;
  for (i = 0; i < this.data.length; i++) {
    let value = Utils$2.toSJIS(this.data[i]);
    if (value >= 33088 && value <= 40956) {
      value -= 33088;
    } else if (value >= 57408 && value <= 60351) {
      value -= 49472;
    } else {
      throw new Error(
        "Invalid SJIS character: " + this.data[i] + "\nMake sure your charset is UTF-8"
      );
    }
    value = (value >>> 8 & 255) * 192 + (value & 255);
    bitBuffer2.put(value, 13);
  }
};
var kanjiData = KanjiData;
var dijkstra = { exports: {} };
(function(module) {
  var dijkstra2 = {
    single_source_shortest_paths: function(graph, s, d) {
      var predecessors = {};
      var costs = {};
      costs[s] = 0;
      var open = dijkstra2.PriorityQueue.make();
      open.push(s, 0);
      var closest, u, v, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
      while (!open.empty()) {
        closest = open.pop();
        u = closest.value;
        cost_of_s_to_u = closest.cost;
        adjacent_nodes = graph[u] || {};
        for (v in adjacent_nodes) {
          if (adjacent_nodes.hasOwnProperty(v)) {
            cost_of_e = adjacent_nodes[v];
            cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
            cost_of_s_to_v = costs[v];
            first_visit = typeof costs[v] === "undefined";
            if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
              costs[v] = cost_of_s_to_u_plus_cost_of_e;
              open.push(v, cost_of_s_to_u_plus_cost_of_e);
              predecessors[v] = u;
            }
          }
        }
      }
      if (typeof d !== "undefined" && typeof costs[d] === "undefined") {
        var msg2 = ["Could not find a path from ", s, " to ", d, "."].join("");
        throw new Error(msg2);
      }
      return predecessors;
    },
    extract_shortest_path_from_predecessor_list: function(predecessors, d) {
      var nodes = [];
      var u = d;
      while (u) {
        nodes.push(u);
        predecessors[u];
        u = predecessors[u];
      }
      nodes.reverse();
      return nodes;
    },
    find_path: function(graph, s, d) {
      var predecessors = dijkstra2.single_source_shortest_paths(graph, s, d);
      return dijkstra2.extract_shortest_path_from_predecessor_list(
        predecessors,
        d
      );
    },
    /**
     * A very naive priority queue implementation.
     */
    PriorityQueue: {
      make: function(opts) {
        var T = dijkstra2.PriorityQueue, t = {}, key;
        opts = opts || {};
        for (key in T) {
          if (T.hasOwnProperty(key)) {
            t[key] = T[key];
          }
        }
        t.queue = [];
        t.sorter = opts.sorter || T.default_sorter;
        return t;
      },
      default_sorter: function(a, b) {
        return a.cost - b.cost;
      },
      /**
       * Add a new item to the queue and ensure the highest priority element
       * is at the front of the queue.
       */
      push: function(value, cost) {
        var item = { value, cost };
        this.queue.push(item);
        this.queue.sort(this.sorter);
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
  {
    module.exports = dijkstra2;
  }
})(dijkstra);
var dijkstraExports = dijkstra.exports;
(function(exports) {
  const Mode2 = mode;
  const NumericData2 = numericData;
  const AlphanumericData2 = alphanumericData;
  const ByteData2 = byteData;
  const KanjiData2 = kanjiData;
  const Regex = regex;
  const Utils2 = utils$1;
  const dijkstra2 = dijkstraExports;
  function getStringByteLength(str) {
    return unescape(encodeURIComponent(str)).length;
  }
  function getSegments(regex2, mode2, str) {
    const segments2 = [];
    let result;
    while ((result = regex2.exec(str)) !== null) {
      segments2.push({
        data: result[0],
        index: result.index,
        mode: mode2,
        length: result[0].length
      });
    }
    return segments2;
  }
  function getSegmentsFromString(dataStr) {
    const numSegs = getSegments(Regex.NUMERIC, Mode2.NUMERIC, dataStr);
    const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode2.ALPHANUMERIC, dataStr);
    let byteSegs;
    let kanjiSegs;
    if (Utils2.isKanjiModeEnabled()) {
      byteSegs = getSegments(Regex.BYTE, Mode2.BYTE, dataStr);
      kanjiSegs = getSegments(Regex.KANJI, Mode2.KANJI, dataStr);
    } else {
      byteSegs = getSegments(Regex.BYTE_KANJI, Mode2.BYTE, dataStr);
      kanjiSegs = [];
    }
    const segs = numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs);
    return segs.sort(function(s1, s2) {
      return s1.index - s2.index;
    }).map(function(obj) {
      return {
        data: obj.data,
        mode: obj.mode,
        length: obj.length
      };
    });
  }
  function getSegmentBitsLength(length, mode2) {
    switch (mode2) {
      case Mode2.NUMERIC:
        return NumericData2.getBitsLength(length);
      case Mode2.ALPHANUMERIC:
        return AlphanumericData2.getBitsLength(length);
      case Mode2.KANJI:
        return KanjiData2.getBitsLength(length);
      case Mode2.BYTE:
        return ByteData2.getBitsLength(length);
    }
  }
  function mergeSegments(segs) {
    return segs.reduce(function(acc, curr) {
      const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
      if (prevSeg && prevSeg.mode === curr.mode) {
        acc[acc.length - 1].data += curr.data;
        return acc;
      }
      acc.push(curr);
      return acc;
    }, []);
  }
  function buildNodes(segs) {
    const nodes = [];
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      switch (seg.mode) {
        case Mode2.NUMERIC:
          nodes.push([
            seg,
            { data: seg.data, mode: Mode2.ALPHANUMERIC, length: seg.length },
            { data: seg.data, mode: Mode2.BYTE, length: seg.length }
          ]);
          break;
        case Mode2.ALPHANUMERIC:
          nodes.push([
            seg,
            { data: seg.data, mode: Mode2.BYTE, length: seg.length }
          ]);
          break;
        case Mode2.KANJI:
          nodes.push([
            seg,
            { data: seg.data, mode: Mode2.BYTE, length: getStringByteLength(seg.data) }
          ]);
          break;
        case Mode2.BYTE:
          nodes.push([
            { data: seg.data, mode: Mode2.BYTE, length: getStringByteLength(seg.data) }
          ]);
      }
    }
    return nodes;
  }
  function buildGraph(nodes, version2) {
    const table = {};
    const graph = { start: {} };
    let prevNodeIds = ["start"];
    for (let i = 0; i < nodes.length; i++) {
      const nodeGroup = nodes[i];
      const currentNodeIds = [];
      for (let j = 0; j < nodeGroup.length; j++) {
        const node2 = nodeGroup[j];
        const key = "" + i + j;
        currentNodeIds.push(key);
        table[key] = { node: node2, lastCount: 0 };
        graph[key] = {};
        for (let n = 0; n < prevNodeIds.length; n++) {
          const prevNodeId = prevNodeIds[n];
          if (table[prevNodeId] && table[prevNodeId].node.mode === node2.mode) {
            graph[prevNodeId][key] = getSegmentBitsLength(table[prevNodeId].lastCount + node2.length, node2.mode) - getSegmentBitsLength(table[prevNodeId].lastCount, node2.mode);
            table[prevNodeId].lastCount += node2.length;
          } else {
            if (table[prevNodeId]) table[prevNodeId].lastCount = node2.length;
            graph[prevNodeId][key] = getSegmentBitsLength(node2.length, node2.mode) + 4 + Mode2.getCharCountIndicator(node2.mode, version2);
          }
        }
      }
      prevNodeIds = currentNodeIds;
    }
    for (let n = 0; n < prevNodeIds.length; n++) {
      graph[prevNodeIds[n]].end = 0;
    }
    return { map: graph, table };
  }
  function buildSingleSegment(data, modesHint) {
    let mode2;
    const bestMode = Mode2.getBestModeForData(data);
    mode2 = Mode2.from(modesHint, bestMode);
    if (mode2 !== Mode2.BYTE && mode2.bit < bestMode.bit) {
      throw new Error('"' + data + '" cannot be encoded with mode ' + Mode2.toString(mode2) + ".\n Suggested mode is: " + Mode2.toString(bestMode));
    }
    if (mode2 === Mode2.KANJI && !Utils2.isKanjiModeEnabled()) {
      mode2 = Mode2.BYTE;
    }
    switch (mode2) {
      case Mode2.NUMERIC:
        return new NumericData2(data);
      case Mode2.ALPHANUMERIC:
        return new AlphanumericData2(data);
      case Mode2.KANJI:
        return new KanjiData2(data);
      case Mode2.BYTE:
        return new ByteData2(data);
    }
  }
  exports.fromArray = function fromArray(array) {
    return array.reduce(function(acc, seg) {
      if (typeof seg === "string") {
        acc.push(buildSingleSegment(seg, null));
      } else if (seg.data) {
        acc.push(buildSingleSegment(seg.data, seg.mode));
      }
      return acc;
    }, []);
  };
  exports.fromString = function fromString(data, version2) {
    const segs = getSegmentsFromString(data, Utils2.isKanjiModeEnabled());
    const nodes = buildNodes(segs);
    const graph = buildGraph(nodes, version2);
    const path2 = dijkstra2.find_path(graph.map, "start", "end");
    const optimizedSegs = [];
    for (let i = 1; i < path2.length - 1; i++) {
      optimizedSegs.push(graph.table[path2[i]].node);
    }
    return exports.fromArray(mergeSegments(optimizedSegs));
  };
  exports.rawSplit = function rawSplit(data) {
    return exports.fromArray(
      getSegmentsFromString(data, Utils2.isKanjiModeEnabled())
    );
  };
})(segments);
const Utils$1 = utils$1;
const ECLevel = errorCorrectionLevel;
const BitBuffer = bitBuffer;
const BitMatrix = bitMatrix;
const AlignmentPattern = alignmentPattern;
const FinderPattern = finderPattern;
const MaskPattern = maskPattern;
const ECCode = errorCorrectionCode;
const ReedSolomonEncoder = reedSolomonEncoder;
const Version = version;
const FormatInfo = formatInfo;
const Mode = mode;
const Segments = segments;
function setupFinderPattern(matrix, version2) {
  const size = matrix.size;
  const pos = FinderPattern.getPositions(version2);
  for (let i = 0; i < pos.length; i++) {
    const row = pos[i][0];
    const col = pos[i][1];
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || size <= row + r) continue;
      for (let c2 = -1; c2 <= 7; c2++) {
        if (col + c2 <= -1 || size <= col + c2) continue;
        if (r >= 0 && r <= 6 && (c2 === 0 || c2 === 6) || c2 >= 0 && c2 <= 6 && (r === 0 || r === 6) || r >= 2 && r <= 4 && c2 >= 2 && c2 <= 4) {
          matrix.set(row + r, col + c2, true, true);
        } else {
          matrix.set(row + r, col + c2, false, true);
        }
      }
    }
  }
}
function setupTimingPattern(matrix) {
  const size = matrix.size;
  for (let r = 8; r < size - 8; r++) {
    const value = r % 2 === 0;
    matrix.set(r, 6, value, true);
    matrix.set(6, r, value, true);
  }
}
function setupAlignmentPattern(matrix, version2) {
  const pos = AlignmentPattern.getPositions(version2);
  for (let i = 0; i < pos.length; i++) {
    const row = pos[i][0];
    const col = pos[i][1];
    for (let r = -2; r <= 2; r++) {
      for (let c2 = -2; c2 <= 2; c2++) {
        if (r === -2 || r === 2 || c2 === -2 || c2 === 2 || r === 0 && c2 === 0) {
          matrix.set(row + r, col + c2, true, true);
        } else {
          matrix.set(row + r, col + c2, false, true);
        }
      }
    }
  }
}
function setupVersionInfo(matrix, version2) {
  const size = matrix.size;
  const bits = Version.getEncodedBits(version2);
  let row, col, mod;
  for (let i = 0; i < 18; i++) {
    row = Math.floor(i / 3);
    col = i % 3 + size - 8 - 3;
    mod = (bits >> i & 1) === 1;
    matrix.set(row, col, mod, true);
    matrix.set(col, row, mod, true);
  }
}
function setupFormatInfo(matrix, errorCorrectionLevel2, maskPattern2) {
  const size = matrix.size;
  const bits = FormatInfo.getEncodedBits(errorCorrectionLevel2, maskPattern2);
  let i, mod;
  for (i = 0; i < 15; i++) {
    mod = (bits >> i & 1) === 1;
    if (i < 6) {
      matrix.set(i, 8, mod, true);
    } else if (i < 8) {
      matrix.set(i + 1, 8, mod, true);
    } else {
      matrix.set(size - 15 + i, 8, mod, true);
    }
    if (i < 8) {
      matrix.set(8, size - i - 1, mod, true);
    } else if (i < 9) {
      matrix.set(8, 15 - i - 1 + 1, mod, true);
    } else {
      matrix.set(8, 15 - i - 1, mod, true);
    }
  }
  matrix.set(size - 8, 8, 1, true);
}
function setupData(matrix, data) {
  const size = matrix.size;
  let inc = -1;
  let row = size - 1;
  let bitIndex = 7;
  let byteIndex = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    while (true) {
      for (let c2 = 0; c2 < 2; c2++) {
        if (!matrix.isReserved(row, col - c2)) {
          let dark = false;
          if (byteIndex < data.length) {
            dark = (data[byteIndex] >>> bitIndex & 1) === 1;
          }
          matrix.set(row, col - c2, dark);
          bitIndex--;
          if (bitIndex === -1) {
            byteIndex++;
            bitIndex = 7;
          }
        }
      }
      row += inc;
      if (row < 0 || size <= row) {
        row -= inc;
        inc = -inc;
        break;
      }
    }
  }
}
function createData(version2, errorCorrectionLevel2, segments2) {
  const buffer = new BitBuffer();
  segments2.forEach(function(data) {
    buffer.put(data.mode.bit, 4);
    buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version2));
    data.write(buffer);
  });
  const totalCodewords = Utils$1.getSymbolTotalCodewords(version2);
  const ecTotalCodewords = ECCode.getTotalCodewordsCount(version2, errorCorrectionLevel2);
  const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
  if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
    buffer.put(0, 4);
  }
  while (buffer.getLengthInBits() % 8 !== 0) {
    buffer.putBit(0);
  }
  const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
  for (let i = 0; i < remainingByte; i++) {
    buffer.put(i % 2 ? 17 : 236, 8);
  }
  return createCodewords(buffer, version2, errorCorrectionLevel2);
}
function createCodewords(bitBuffer2, version2, errorCorrectionLevel2) {
  const totalCodewords = Utils$1.getSymbolTotalCodewords(version2);
  const ecTotalCodewords = ECCode.getTotalCodewordsCount(version2, errorCorrectionLevel2);
  const dataTotalCodewords = totalCodewords - ecTotalCodewords;
  const ecTotalBlocks = ECCode.getBlocksCount(version2, errorCorrectionLevel2);
  const blocksInGroup2 = totalCodewords % ecTotalBlocks;
  const blocksInGroup1 = ecTotalBlocks - blocksInGroup2;
  const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);
  const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
  const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;
  const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
  const rs = new ReedSolomonEncoder(ecCount);
  let offset = 0;
  const dcData = new Array(ecTotalBlocks);
  const ecData = new Array(ecTotalBlocks);
  let maxDataSize = 0;
  const buffer = new Uint8Array(bitBuffer2.buffer);
  for (let b = 0; b < ecTotalBlocks; b++) {
    const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
    dcData[b] = buffer.slice(offset, offset + dataSize);
    ecData[b] = rs.encode(dcData[b]);
    offset += dataSize;
    maxDataSize = Math.max(maxDataSize, dataSize);
  }
  const data = new Uint8Array(totalCodewords);
  let index = 0;
  let i, r;
  for (i = 0; i < maxDataSize; i++) {
    for (r = 0; r < ecTotalBlocks; r++) {
      if (i < dcData[r].length) {
        data[index++] = dcData[r][i];
      }
    }
  }
  for (i = 0; i < ecCount; i++) {
    for (r = 0; r < ecTotalBlocks; r++) {
      data[index++] = ecData[r][i];
    }
  }
  return data;
}
function createSymbol(data, version2, errorCorrectionLevel2, maskPattern2) {
  let segments2;
  if (Array.isArray(data)) {
    segments2 = Segments.fromArray(data);
  } else if (typeof data === "string") {
    let estimatedVersion = version2;
    if (!estimatedVersion) {
      const rawSegments = Segments.rawSplit(data);
      estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel2);
    }
    segments2 = Segments.fromString(data, estimatedVersion || 40);
  } else {
    throw new Error("Invalid data");
  }
  const bestVersion = Version.getBestVersionForData(segments2, errorCorrectionLevel2);
  if (!bestVersion) {
    throw new Error("The amount of data is too big to be stored in a QR Code");
  }
  if (!version2) {
    version2 = bestVersion;
  } else if (version2 < bestVersion) {
    throw new Error(
      "\nThe chosen QR Code version cannot contain this amount of data.\nMinimum version required to store current data is: " + bestVersion + ".\n"
    );
  }
  const dataBits = createData(version2, errorCorrectionLevel2, segments2);
  const moduleCount = Utils$1.getSymbolSize(version2);
  const modules = new BitMatrix(moduleCount);
  setupFinderPattern(modules, version2);
  setupTimingPattern(modules);
  setupAlignmentPattern(modules, version2);
  setupFormatInfo(modules, errorCorrectionLevel2, 0);
  if (version2 >= 7) {
    setupVersionInfo(modules, version2);
  }
  setupData(modules, dataBits);
  if (isNaN(maskPattern2)) {
    maskPattern2 = MaskPattern.getBestMask(
      modules,
      setupFormatInfo.bind(null, modules, errorCorrectionLevel2)
    );
  }
  MaskPattern.applyMask(maskPattern2, modules);
  setupFormatInfo(modules, errorCorrectionLevel2, maskPattern2);
  return {
    modules,
    version: version2,
    errorCorrectionLevel: errorCorrectionLevel2,
    maskPattern: maskPattern2,
    segments: segments2
  };
}
qrcode.create = function create(data, options) {
  if (typeof data === "undefined" || data === "") {
    throw new Error("No input text");
  }
  let errorCorrectionLevel2 = ECLevel.M;
  let version2;
  let mask;
  if (typeof options !== "undefined") {
    errorCorrectionLevel2 = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
    version2 = Version.from(options.version);
    mask = MaskPattern.from(options.maskPattern);
    if (options.toSJISFunc) {
      Utils$1.setToSJISFunction(options.toSJISFunc);
    }
  }
  return createSymbol(data, version2, errorCorrectionLevel2, mask);
};
var png$1 = {};
var png = {};
var parserAsync = { exports: {} };
var chunkstream = { exports: {} };
let util$4 = require$$0$2;
let Stream$2 = require$$1$1;
let ChunkStream$2 = chunkstream.exports = function() {
  Stream$2.call(this);
  this._buffers = [];
  this._buffered = 0;
  this._reads = [];
  this._paused = false;
  this._encoding = "utf8";
  this.writable = true;
};
util$4.inherits(ChunkStream$2, Stream$2);
ChunkStream$2.prototype.read = function(length, callback) {
  this._reads.push({
    length: Math.abs(length),
    // if length < 0 then at most this length
    allowLess: length < 0,
    func: callback
  });
  process.nextTick(
    (function() {
      this._process();
      if (this._paused && this._reads && this._reads.length > 0) {
        this._paused = false;
        this.emit("drain");
      }
    }).bind(this)
  );
};
ChunkStream$2.prototype.write = function(data, encoding) {
  if (!this.writable) {
    this.emit("error", new Error("Stream not writable"));
    return false;
  }
  let dataBuffer;
  if (Buffer.isBuffer(data)) {
    dataBuffer = data;
  } else {
    dataBuffer = Buffer.from(data, encoding || this._encoding);
  }
  this._buffers.push(dataBuffer);
  this._buffered += dataBuffer.length;
  this._process();
  if (this._reads && this._reads.length === 0) {
    this._paused = true;
  }
  return this.writable && !this._paused;
};
ChunkStream$2.prototype.end = function(data, encoding) {
  if (data) {
    this.write(data, encoding);
  }
  this.writable = false;
  if (!this._buffers) {
    return;
  }
  if (this._buffers.length === 0) {
    this._end();
  } else {
    this._buffers.push(null);
    this._process();
  }
};
ChunkStream$2.prototype.destroySoon = ChunkStream$2.prototype.end;
ChunkStream$2.prototype._end = function() {
  if (this._reads.length > 0) {
    this.emit("error", new Error("Unexpected end of input"));
  }
  this.destroy();
};
ChunkStream$2.prototype.destroy = function() {
  if (!this._buffers) {
    return;
  }
  this.writable = false;
  this._reads = null;
  this._buffers = null;
  this.emit("close");
};
ChunkStream$2.prototype._processReadAllowingLess = function(read) {
  this._reads.shift();
  let smallerBuf = this._buffers[0];
  if (smallerBuf.length > read.length) {
    this._buffered -= read.length;
    this._buffers[0] = smallerBuf.slice(read.length);
    read.func.call(this, smallerBuf.slice(0, read.length));
  } else {
    this._buffered -= smallerBuf.length;
    this._buffers.shift();
    read.func.call(this, smallerBuf);
  }
};
ChunkStream$2.prototype._processRead = function(read) {
  this._reads.shift();
  let pos = 0;
  let count = 0;
  let data = Buffer.alloc(read.length);
  while (pos < read.length) {
    let buf = this._buffers[count++];
    let len = Math.min(buf.length, read.length - pos);
    buf.copy(data, pos, 0, len);
    pos += len;
    if (len !== buf.length) {
      this._buffers[--count] = buf.slice(len);
    }
  }
  if (count > 0) {
    this._buffers.splice(0, count);
  }
  this._buffered -= read.length;
  read.func.call(this, data);
};
ChunkStream$2.prototype._process = function() {
  try {
    while (this._buffered > 0 && this._reads && this._reads.length > 0) {
      let read = this._reads[0];
      if (read.allowLess) {
        this._processReadAllowingLess(read);
      } else if (this._buffered >= read.length) {
        this._processRead(read);
      } else {
        break;
      }
    }
    if (this._buffers && !this.writable) {
      this._end();
    }
  } catch (ex) {
    this.emit("error", ex);
  }
};
var chunkstreamExports = chunkstream.exports;
var filterParseAsync = { exports: {} };
var filterParse = { exports: {} };
var interlace = {};
let imagePasses = [
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
interlace.getImagePasses = function(width, height) {
  let images = [];
  let xLeftOver = width % 8;
  let yLeftOver = height % 8;
  let xRepeats = (width - xLeftOver) / 8;
  let yRepeats = (height - yLeftOver) / 8;
  for (let i = 0; i < imagePasses.length; i++) {
    let pass = imagePasses[i];
    let passWidth = xRepeats * pass.x.length;
    let passHeight = yRepeats * pass.y.length;
    for (let j = 0; j < pass.x.length; j++) {
      if (pass.x[j] < xLeftOver) {
        passWidth++;
      } else {
        break;
      }
    }
    for (let j = 0; j < pass.y.length; j++) {
      if (pass.y[j] < yLeftOver) {
        passHeight++;
      } else {
        break;
      }
    }
    if (passWidth > 0 && passHeight > 0) {
      images.push({ width: passWidth, height: passHeight, index: i });
    }
  }
  return images;
};
interlace.getInterlaceIterator = function(width) {
  return function(x, y, pass) {
    let outerXLeftOver = x % imagePasses[pass].x.length;
    let outerX = (x - outerXLeftOver) / imagePasses[pass].x.length * 8 + imagePasses[pass].x[outerXLeftOver];
    let outerYLeftOver = y % imagePasses[pass].y.length;
    let outerY = (y - outerYLeftOver) / imagePasses[pass].y.length * 8 + imagePasses[pass].y[outerYLeftOver];
    return outerX * 4 + outerY * width * 4;
  };
};
var paethPredictor$2 = function paethPredictor(left, above, upLeft) {
  let paeth = left + above - upLeft;
  let pLeft = Math.abs(paeth - left);
  let pAbove = Math.abs(paeth - above);
  let pUpLeft = Math.abs(paeth - upLeft);
  if (pLeft <= pAbove && pLeft <= pUpLeft) {
    return left;
  }
  if (pAbove <= pUpLeft) {
    return above;
  }
  return upLeft;
};
let interlaceUtils$1 = interlace;
let paethPredictor$1 = paethPredictor$2;
function getByteWidth(width, bpp, depth) {
  let byteWidth = width * bpp;
  if (depth !== 8) {
    byteWidth = Math.ceil(byteWidth / (8 / depth));
  }
  return byteWidth;
}
let Filter$2 = filterParse.exports = function(bitmapInfo, dependencies) {
  let width = bitmapInfo.width;
  let height = bitmapInfo.height;
  let interlace2 = bitmapInfo.interlace;
  let bpp = bitmapInfo.bpp;
  let depth = bitmapInfo.depth;
  this.read = dependencies.read;
  this.write = dependencies.write;
  this.complete = dependencies.complete;
  this._imageIndex = 0;
  this._images = [];
  if (interlace2) {
    let passes = interlaceUtils$1.getImagePasses(width, height);
    for (let i = 0; i < passes.length; i++) {
      this._images.push({
        byteWidth: getByteWidth(passes[i].width, bpp, depth),
        height: passes[i].height,
        lineIndex: 0
      });
    }
  } else {
    this._images.push({
      byteWidth: getByteWidth(width, bpp, depth),
      height,
      lineIndex: 0
    });
  }
  if (depth === 8) {
    this._xComparison = bpp;
  } else if (depth === 16) {
    this._xComparison = bpp * 2;
  } else {
    this._xComparison = 1;
  }
};
Filter$2.prototype.start = function() {
  this.read(
    this._images[this._imageIndex].byteWidth + 1,
    this._reverseFilterLine.bind(this)
  );
};
Filter$2.prototype._unFilterType1 = function(rawData, unfilteredLine, byteWidth) {
  let xComparison = this._xComparison;
  let xBiggerThan = xComparison - 1;
  for (let x = 0; x < byteWidth; x++) {
    let rawByte = rawData[1 + x];
    let f1Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
    unfilteredLine[x] = rawByte + f1Left;
  }
};
Filter$2.prototype._unFilterType2 = function(rawData, unfilteredLine, byteWidth) {
  let lastLine = this._lastLine;
  for (let x = 0; x < byteWidth; x++) {
    let rawByte = rawData[1 + x];
    let f2Up = lastLine ? lastLine[x] : 0;
    unfilteredLine[x] = rawByte + f2Up;
  }
};
Filter$2.prototype._unFilterType3 = function(rawData, unfilteredLine, byteWidth) {
  let xComparison = this._xComparison;
  let xBiggerThan = xComparison - 1;
  let lastLine = this._lastLine;
  for (let x = 0; x < byteWidth; x++) {
    let rawByte = rawData[1 + x];
    let f3Up = lastLine ? lastLine[x] : 0;
    let f3Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
    let f3Add = Math.floor((f3Left + f3Up) / 2);
    unfilteredLine[x] = rawByte + f3Add;
  }
};
Filter$2.prototype._unFilterType4 = function(rawData, unfilteredLine, byteWidth) {
  let xComparison = this._xComparison;
  let xBiggerThan = xComparison - 1;
  let lastLine = this._lastLine;
  for (let x = 0; x < byteWidth; x++) {
    let rawByte = rawData[1 + x];
    let f4Up = lastLine ? lastLine[x] : 0;
    let f4Left = x > xBiggerThan ? unfilteredLine[x - xComparison] : 0;
    let f4UpLeft = x > xBiggerThan && lastLine ? lastLine[x - xComparison] : 0;
    let f4Add = paethPredictor$1(f4Left, f4Up, f4UpLeft);
    unfilteredLine[x] = rawByte + f4Add;
  }
};
Filter$2.prototype._reverseFilterLine = function(rawData) {
  let filter2 = rawData[0];
  let unfilteredLine;
  let currentImage = this._images[this._imageIndex];
  let byteWidth = currentImage.byteWidth;
  if (filter2 === 0) {
    unfilteredLine = rawData.slice(1, byteWidth + 1);
  } else {
    unfilteredLine = Buffer.alloc(byteWidth);
    switch (filter2) {
      case 1:
        this._unFilterType1(rawData, unfilteredLine, byteWidth);
        break;
      case 2:
        this._unFilterType2(rawData, unfilteredLine, byteWidth);
        break;
      case 3:
        this._unFilterType3(rawData, unfilteredLine, byteWidth);
        break;
      case 4:
        this._unFilterType4(rawData, unfilteredLine, byteWidth);
        break;
      default:
        throw new Error("Unrecognised filter type - " + filter2);
    }
  }
  this.write(unfilteredLine);
  currentImage.lineIndex++;
  if (currentImage.lineIndex >= currentImage.height) {
    this._lastLine = null;
    this._imageIndex++;
    currentImage = this._images[this._imageIndex];
  } else {
    this._lastLine = unfilteredLine;
  }
  if (currentImage) {
    this.read(currentImage.byteWidth + 1, this._reverseFilterLine.bind(this));
  } else {
    this._lastLine = null;
    this.complete();
  }
};
var filterParseExports = filterParse.exports;
let util$3 = require$$0$2;
let ChunkStream$1 = chunkstreamExports;
let Filter$1 = filterParseExports;
let FilterAsync$1 = filterParseAsync.exports = function(bitmapInfo) {
  ChunkStream$1.call(this);
  let buffers = [];
  let that = this;
  this._filter = new Filter$1(bitmapInfo, {
    read: this.read.bind(this),
    write: function(buffer) {
      buffers.push(buffer);
    },
    complete: function() {
      that.emit("complete", Buffer.concat(buffers));
    }
  });
  this._filter.start();
};
util$3.inherits(FilterAsync$1, ChunkStream$1);
var filterParseAsyncExports = filterParseAsync.exports;
var parser = { exports: {} };
var constants$5 = {
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
};
var crc = { exports: {} };
let crcTable = [];
(function() {
  for (let i = 0; i < 256; i++) {
    let currentCrc = i;
    for (let j = 0; j < 8; j++) {
      if (currentCrc & 1) {
        currentCrc = 3988292384 ^ currentCrc >>> 1;
      } else {
        currentCrc = currentCrc >>> 1;
      }
    }
    crcTable[i] = currentCrc;
  }
})();
let CrcCalculator$1 = crc.exports = function() {
  this._crc = -1;
};
CrcCalculator$1.prototype.write = function(data) {
  for (let i = 0; i < data.length; i++) {
    this._crc = crcTable[(this._crc ^ data[i]) & 255] ^ this._crc >>> 8;
  }
  return true;
};
CrcCalculator$1.prototype.crc32 = function() {
  return this._crc ^ -1;
};
CrcCalculator$1.crc32 = function(buf) {
  let crc2 = -1;
  for (let i = 0; i < buf.length; i++) {
    crc2 = crcTable[(crc2 ^ buf[i]) & 255] ^ crc2 >>> 8;
  }
  return crc2 ^ -1;
};
var crcExports = crc.exports;
let constants$4 = constants$5;
let CrcCalculator = crcExports;
let Parser$3 = parser.exports = function(options, dependencies) {
  this._options = options;
  options.checkCRC = options.checkCRC !== false;
  this._hasIHDR = false;
  this._hasIEND = false;
  this._emittedHeadersFinished = false;
  this._palette = [];
  this._colorType = 0;
  this._chunks = {};
  this._chunks[constants$4.TYPE_IHDR] = this._handleIHDR.bind(this);
  this._chunks[constants$4.TYPE_IEND] = this._handleIEND.bind(this);
  this._chunks[constants$4.TYPE_IDAT] = this._handleIDAT.bind(this);
  this._chunks[constants$4.TYPE_PLTE] = this._handlePLTE.bind(this);
  this._chunks[constants$4.TYPE_tRNS] = this._handleTRNS.bind(this);
  this._chunks[constants$4.TYPE_gAMA] = this._handleGAMA.bind(this);
  this.read = dependencies.read;
  this.error = dependencies.error;
  this.metadata = dependencies.metadata;
  this.gamma = dependencies.gamma;
  this.transColor = dependencies.transColor;
  this.palette = dependencies.palette;
  this.parsed = dependencies.parsed;
  this.inflateData = dependencies.inflateData;
  this.finished = dependencies.finished;
  this.simpleTransparency = dependencies.simpleTransparency;
  this.headersFinished = dependencies.headersFinished || function() {
  };
};
Parser$3.prototype.start = function() {
  this.read(constants$4.PNG_SIGNATURE.length, this._parseSignature.bind(this));
};
Parser$3.prototype._parseSignature = function(data) {
  let signature2 = constants$4.PNG_SIGNATURE;
  for (let i = 0; i < signature2.length; i++) {
    if (data[i] !== signature2[i]) {
      this.error(new Error("Invalid file signature"));
      return;
    }
  }
  this.read(8, this._parseChunkBegin.bind(this));
};
Parser$3.prototype._parseChunkBegin = function(data) {
  let length = data.readUInt32BE(0);
  let type = data.readUInt32BE(4);
  let name = "";
  for (let i = 4; i < 8; i++) {
    name += String.fromCharCode(data[i]);
  }
  let ancillary = Boolean(data[4] & 32);
  if (!this._hasIHDR && type !== constants$4.TYPE_IHDR) {
    this.error(new Error("Expected IHDR on beggining"));
    return;
  }
  this._crc = new CrcCalculator();
  this._crc.write(Buffer.from(name));
  if (this._chunks[type]) {
    return this._chunks[type](length);
  }
  if (!ancillary) {
    this.error(new Error("Unsupported critical chunk type " + name));
    return;
  }
  this.read(length + 4, this._skipChunk.bind(this));
};
Parser$3.prototype._skipChunk = function() {
  this.read(8, this._parseChunkBegin.bind(this));
};
Parser$3.prototype._handleChunkEnd = function() {
  this.read(4, this._parseChunkEnd.bind(this));
};
Parser$3.prototype._parseChunkEnd = function(data) {
  let fileCrc = data.readInt32BE(0);
  let calcCrc = this._crc.crc32();
  if (this._options.checkCRC && calcCrc !== fileCrc) {
    this.error(new Error("Crc error - " + fileCrc + " - " + calcCrc));
    return;
  }
  if (!this._hasIEND) {
    this.read(8, this._parseChunkBegin.bind(this));
  }
};
Parser$3.prototype._handleIHDR = function(length) {
  this.read(length, this._parseIHDR.bind(this));
};
Parser$3.prototype._parseIHDR = function(data) {
  this._crc.write(data);
  let width = data.readUInt32BE(0);
  let height = data.readUInt32BE(4);
  let depth = data[8];
  let colorType = data[9];
  let compr = data[10];
  let filter2 = data[11];
  let interlace2 = data[12];
  if (depth !== 8 && depth !== 4 && depth !== 2 && depth !== 1 && depth !== 16) {
    this.error(new Error("Unsupported bit depth " + depth));
    return;
  }
  if (!(colorType in constants$4.COLORTYPE_TO_BPP_MAP)) {
    this.error(new Error("Unsupported color type"));
    return;
  }
  if (compr !== 0) {
    this.error(new Error("Unsupported compression method"));
    return;
  }
  if (filter2 !== 0) {
    this.error(new Error("Unsupported filter method"));
    return;
  }
  if (interlace2 !== 0 && interlace2 !== 1) {
    this.error(new Error("Unsupported interlace method"));
    return;
  }
  this._colorType = colorType;
  let bpp = constants$4.COLORTYPE_TO_BPP_MAP[this._colorType];
  this._hasIHDR = true;
  this.metadata({
    width,
    height,
    depth,
    interlace: Boolean(interlace2),
    palette: Boolean(colorType & constants$4.COLORTYPE_PALETTE),
    color: Boolean(colorType & constants$4.COLORTYPE_COLOR),
    alpha: Boolean(colorType & constants$4.COLORTYPE_ALPHA),
    bpp,
    colorType
  });
  this._handleChunkEnd();
};
Parser$3.prototype._handlePLTE = function(length) {
  this.read(length, this._parsePLTE.bind(this));
};
Parser$3.prototype._parsePLTE = function(data) {
  this._crc.write(data);
  let entries = Math.floor(data.length / 3);
  for (let i = 0; i < entries; i++) {
    this._palette.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2], 255]);
  }
  this.palette(this._palette);
  this._handleChunkEnd();
};
Parser$3.prototype._handleTRNS = function(length) {
  this.simpleTransparency();
  this.read(length, this._parseTRNS.bind(this));
};
Parser$3.prototype._parseTRNS = function(data) {
  this._crc.write(data);
  if (this._colorType === constants$4.COLORTYPE_PALETTE_COLOR) {
    if (this._palette.length === 0) {
      this.error(new Error("Transparency chunk must be after palette"));
      return;
    }
    if (data.length > this._palette.length) {
      this.error(new Error("More transparent colors than palette size"));
      return;
    }
    for (let i = 0; i < data.length; i++) {
      this._palette[i][3] = data[i];
    }
    this.palette(this._palette);
  }
  if (this._colorType === constants$4.COLORTYPE_GRAYSCALE) {
    this.transColor([data.readUInt16BE(0)]);
  }
  if (this._colorType === constants$4.COLORTYPE_COLOR) {
    this.transColor([
      data.readUInt16BE(0),
      data.readUInt16BE(2),
      data.readUInt16BE(4)
    ]);
  }
  this._handleChunkEnd();
};
Parser$3.prototype._handleGAMA = function(length) {
  this.read(length, this._parseGAMA.bind(this));
};
Parser$3.prototype._parseGAMA = function(data) {
  this._crc.write(data);
  this.gamma(data.readUInt32BE(0) / constants$4.GAMMA_DIVISION);
  this._handleChunkEnd();
};
Parser$3.prototype._handleIDAT = function(length) {
  if (!this._emittedHeadersFinished) {
    this._emittedHeadersFinished = true;
    this.headersFinished();
  }
  this.read(-length, this._parseIDAT.bind(this, length));
};
Parser$3.prototype._parseIDAT = function(length, data) {
  this._crc.write(data);
  if (this._colorType === constants$4.COLORTYPE_PALETTE_COLOR && this._palette.length === 0) {
    throw new Error("Expected palette not found");
  }
  this.inflateData(data);
  let leftOverLength = length - data.length;
  if (leftOverLength > 0) {
    this._handleIDAT(leftOverLength);
  } else {
    this._handleChunkEnd();
  }
};
Parser$3.prototype._handleIEND = function(length) {
  this.read(length, this._parseIEND.bind(this));
};
Parser$3.prototype._parseIEND = function(data) {
  this._crc.write(data);
  this._hasIEND = true;
  this._handleChunkEnd();
  if (this.finished) {
    this.finished();
  }
};
var parserExports = parser.exports;
var bitmapper$2 = {};
let interlaceUtils = interlace;
let pixelBppMapper = [
  // 0 - dummy entry
  function() {
  },
  // 1 - L
  // 0: 0, 1: 0, 2: 0, 3: 0xff
  function(pxData, data, pxPos, rawPos) {
    if (rawPos === data.length) {
      throw new Error("Ran out of data");
    }
    let pixel = data[rawPos];
    pxData[pxPos] = pixel;
    pxData[pxPos + 1] = pixel;
    pxData[pxPos + 2] = pixel;
    pxData[pxPos + 3] = 255;
  },
  // 2 - LA
  // 0: 0, 1: 0, 2: 0, 3: 1
  function(pxData, data, pxPos, rawPos) {
    if (rawPos + 1 >= data.length) {
      throw new Error("Ran out of data");
    }
    let pixel = data[rawPos];
    pxData[pxPos] = pixel;
    pxData[pxPos + 1] = pixel;
    pxData[pxPos + 2] = pixel;
    pxData[pxPos + 3] = data[rawPos + 1];
  },
  // 3 - RGB
  // 0: 0, 1: 1, 2: 2, 3: 0xff
  function(pxData, data, pxPos, rawPos) {
    if (rawPos + 2 >= data.length) {
      throw new Error("Ran out of data");
    }
    pxData[pxPos] = data[rawPos];
    pxData[pxPos + 1] = data[rawPos + 1];
    pxData[pxPos + 2] = data[rawPos + 2];
    pxData[pxPos + 3] = 255;
  },
  // 4 - RGBA
  // 0: 0, 1: 1, 2: 2, 3: 3
  function(pxData, data, pxPos, rawPos) {
    if (rawPos + 3 >= data.length) {
      throw new Error("Ran out of data");
    }
    pxData[pxPos] = data[rawPos];
    pxData[pxPos + 1] = data[rawPos + 1];
    pxData[pxPos + 2] = data[rawPos + 2];
    pxData[pxPos + 3] = data[rawPos + 3];
  }
];
let pixelBppCustomMapper = [
  // 0 - dummy entry
  function() {
  },
  // 1 - L
  // 0: 0, 1: 0, 2: 0, 3: 0xff
  function(pxData, pixelData, pxPos, maxBit) {
    let pixel = pixelData[0];
    pxData[pxPos] = pixel;
    pxData[pxPos + 1] = pixel;
    pxData[pxPos + 2] = pixel;
    pxData[pxPos + 3] = maxBit;
  },
  // 2 - LA
  // 0: 0, 1: 0, 2: 0, 3: 1
  function(pxData, pixelData, pxPos) {
    let pixel = pixelData[0];
    pxData[pxPos] = pixel;
    pxData[pxPos + 1] = pixel;
    pxData[pxPos + 2] = pixel;
    pxData[pxPos + 3] = pixelData[1];
  },
  // 3 - RGB
  // 0: 0, 1: 1, 2: 2, 3: 0xff
  function(pxData, pixelData, pxPos, maxBit) {
    pxData[pxPos] = pixelData[0];
    pxData[pxPos + 1] = pixelData[1];
    pxData[pxPos + 2] = pixelData[2];
    pxData[pxPos + 3] = maxBit;
  },
  // 4 - RGBA
  // 0: 0, 1: 1, 2: 2, 3: 3
  function(pxData, pixelData, pxPos) {
    pxData[pxPos] = pixelData[0];
    pxData[pxPos + 1] = pixelData[1];
    pxData[pxPos + 2] = pixelData[2];
    pxData[pxPos + 3] = pixelData[3];
  }
];
function bitRetriever(data, depth) {
  let leftOver = [];
  let i = 0;
  function split() {
    if (i === data.length) {
      throw new Error("Ran out of data");
    }
    let byte2 = data[i];
    i++;
    let byte8, byte7, byte6, byte5, byte4, byte3, byte22, byte1;
    switch (depth) {
      default:
        throw new Error("unrecognised depth");
      case 16:
        byte22 = data[i];
        i++;
        leftOver.push((byte2 << 8) + byte22);
        break;
      case 4:
        byte22 = byte2 & 15;
        byte1 = byte2 >> 4;
        leftOver.push(byte1, byte22);
        break;
      case 2:
        byte4 = byte2 & 3;
        byte3 = byte2 >> 2 & 3;
        byte22 = byte2 >> 4 & 3;
        byte1 = byte2 >> 6 & 3;
        leftOver.push(byte1, byte22, byte3, byte4);
        break;
      case 1:
        byte8 = byte2 & 1;
        byte7 = byte2 >> 1 & 1;
        byte6 = byte2 >> 2 & 1;
        byte5 = byte2 >> 3 & 1;
        byte4 = byte2 >> 4 & 1;
        byte3 = byte2 >> 5 & 1;
        byte22 = byte2 >> 6 & 1;
        byte1 = byte2 >> 7 & 1;
        leftOver.push(byte1, byte22, byte3, byte4, byte5, byte6, byte7, byte8);
        break;
    }
  }
  return {
    get: function(count) {
      while (leftOver.length < count) {
        split();
      }
      let returner = leftOver.slice(0, count);
      leftOver = leftOver.slice(count);
      return returner;
    },
    resetAfterLine: function() {
      leftOver.length = 0;
    },
    end: function() {
      if (i !== data.length) {
        throw new Error("extra data found");
      }
    }
  };
}
function mapImage8Bit(image, pxData, getPxPos, bpp, data, rawPos) {
  let imageWidth = image.width;
  let imageHeight = image.height;
  let imagePass = image.index;
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < imageWidth; x++) {
      let pxPos = getPxPos(x, y, imagePass);
      pixelBppMapper[bpp](pxData, data, pxPos, rawPos);
      rawPos += bpp;
    }
  }
  return rawPos;
}
function mapImageCustomBit(image, pxData, getPxPos, bpp, bits, maxBit) {
  let imageWidth = image.width;
  let imageHeight = image.height;
  let imagePass = image.index;
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < imageWidth; x++) {
      let pixelData = bits.get(bpp);
      let pxPos = getPxPos(x, y, imagePass);
      pixelBppCustomMapper[bpp](pxData, pixelData, pxPos, maxBit);
    }
    bits.resetAfterLine();
  }
}
bitmapper$2.dataToBitMap = function(data, bitmapInfo) {
  let width = bitmapInfo.width;
  let height = bitmapInfo.height;
  let depth = bitmapInfo.depth;
  let bpp = bitmapInfo.bpp;
  let interlace2 = bitmapInfo.interlace;
  let bits;
  if (depth !== 8) {
    bits = bitRetriever(data, depth);
  }
  let pxData;
  if (depth <= 8) {
    pxData = Buffer.alloc(width * height * 4);
  } else {
    pxData = new Uint16Array(width * height * 4);
  }
  let maxBit = Math.pow(2, depth) - 1;
  let rawPos = 0;
  let images;
  let getPxPos;
  if (interlace2) {
    images = interlaceUtils.getImagePasses(width, height);
    getPxPos = interlaceUtils.getInterlaceIterator(width, height);
  } else {
    let nonInterlacedPxPos = 0;
    getPxPos = function() {
      let returner = nonInterlacedPxPos;
      nonInterlacedPxPos += 4;
      return returner;
    };
    images = [{ width, height }];
  }
  for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
    if (depth === 8) {
      rawPos = mapImage8Bit(
        images[imageIndex],
        pxData,
        getPxPos,
        bpp,
        data,
        rawPos
      );
    } else {
      mapImageCustomBit(
        images[imageIndex],
        pxData,
        getPxPos,
        bpp,
        bits,
        maxBit
      );
    }
  }
  if (depth === 8) {
    if (rawPos !== data.length) {
      throw new Error("extra data found");
    }
  } else {
    bits.end();
  }
  return pxData;
};
function dePalette(indata, outdata, width, height, palette) {
  let pxPos = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = palette[indata[pxPos]];
      if (!color) {
        throw new Error("index " + indata[pxPos] + " not in palette");
      }
      for (let i = 0; i < 4; i++) {
        outdata[pxPos + i] = color[i];
      }
      pxPos += 4;
    }
  }
}
function replaceTransparentColor(indata, outdata, width, height, transColor) {
  let pxPos = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let makeTrans = false;
      if (transColor.length === 1) {
        if (transColor[0] === indata[pxPos]) {
          makeTrans = true;
        }
      } else if (transColor[0] === indata[pxPos] && transColor[1] === indata[pxPos + 1] && transColor[2] === indata[pxPos + 2]) {
        makeTrans = true;
      }
      if (makeTrans) {
        for (let i = 0; i < 4; i++) {
          outdata[pxPos + i] = 0;
        }
      }
      pxPos += 4;
    }
  }
}
function scaleDepth(indata, outdata, width, height, depth) {
  let maxOutSample = 255;
  let maxInSample = Math.pow(2, depth) - 1;
  let pxPos = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let i = 0; i < 4; i++) {
        outdata[pxPos + i] = Math.floor(
          indata[pxPos + i] * maxOutSample / maxInSample + 0.5
        );
      }
      pxPos += 4;
    }
  }
}
var formatNormaliser$2 = function(indata, imageData) {
  let depth = imageData.depth;
  let width = imageData.width;
  let height = imageData.height;
  let colorType = imageData.colorType;
  let transColor = imageData.transColor;
  let palette = imageData.palette;
  let outdata = indata;
  if (colorType === 3) {
    dePalette(indata, outdata, width, height, palette);
  } else {
    if (transColor) {
      replaceTransparentColor(indata, outdata, width, height, transColor);
    }
    if (depth !== 8) {
      if (depth === 16) {
        outdata = Buffer.alloc(width * height * 4);
      }
      scaleDepth(indata, outdata, width, height, depth);
    }
  }
  return outdata;
};
let util$2 = require$$0$2;
let zlib$3 = require$$1$2;
let ChunkStream = chunkstreamExports;
let FilterAsync = filterParseAsyncExports;
let Parser$2 = parserExports;
let bitmapper$1 = bitmapper$2;
let formatNormaliser$1 = formatNormaliser$2;
let ParserAsync = parserAsync.exports = function(options) {
  ChunkStream.call(this);
  this._parser = new Parser$2(options, {
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
  });
  this._options = options;
  this.writable = true;
  this._parser.start();
};
util$2.inherits(ParserAsync, ChunkStream);
ParserAsync.prototype._handleError = function(err2) {
  this.emit("error", err2);
  this.writable = false;
  this.destroy();
  if (this._inflate && this._inflate.destroy) {
    this._inflate.destroy();
  }
  if (this._filter) {
    this._filter.destroy();
    this._filter.on("error", function() {
    });
  }
  this.errord = true;
};
ParserAsync.prototype._inflateData = function(data) {
  if (!this._inflate) {
    if (this._bitmapInfo.interlace) {
      this._inflate = zlib$3.createInflate();
      this._inflate.on("error", this.emit.bind(this, "error"));
      this._filter.on("complete", this._complete.bind(this));
      this._inflate.pipe(this._filter);
    } else {
      let rowSize = (this._bitmapInfo.width * this._bitmapInfo.bpp * this._bitmapInfo.depth + 7 >> 3) + 1;
      let imageSize = rowSize * this._bitmapInfo.height;
      let chunkSize = Math.max(imageSize, zlib$3.Z_MIN_CHUNK);
      this._inflate = zlib$3.createInflate({ chunkSize });
      let leftToInflate = imageSize;
      let emitError = this.emit.bind(this, "error");
      this._inflate.on("error", function(err2) {
        if (!leftToInflate) {
          return;
        }
        emitError(err2);
      });
      this._filter.on("complete", this._complete.bind(this));
      let filterWrite = this._filter.write.bind(this._filter);
      this._inflate.on("data", function(chunk) {
        if (!leftToInflate) {
          return;
        }
        if (chunk.length > leftToInflate) {
          chunk = chunk.slice(0, leftToInflate);
        }
        leftToInflate -= chunk.length;
        filterWrite(chunk);
      });
      this._inflate.on("end", this._filter.end.bind(this._filter));
    }
  }
  this._inflate.write(data);
};
ParserAsync.prototype._handleMetaData = function(metaData) {
  this._metaData = metaData;
  this._bitmapInfo = Object.create(metaData);
  this._filter = new FilterAsync(this._bitmapInfo);
};
ParserAsync.prototype._handleTransColor = function(transColor) {
  this._bitmapInfo.transColor = transColor;
};
ParserAsync.prototype._handlePalette = function(palette) {
  this._bitmapInfo.palette = palette;
};
ParserAsync.prototype._simpleTransparency = function() {
  this._metaData.alpha = true;
};
ParserAsync.prototype._headersFinished = function() {
  this.emit("metadata", this._metaData);
};
ParserAsync.prototype._finished = function() {
  if (this.errord) {
    return;
  }
  if (!this._inflate) {
    this.emit("error", "No Inflate block");
  } else {
    this._inflate.end();
  }
};
ParserAsync.prototype._complete = function(filteredData) {
  if (this.errord) {
    return;
  }
  let normalisedBitmapData;
  try {
    let bitmapData = bitmapper$1.dataToBitMap(filteredData, this._bitmapInfo);
    normalisedBitmapData = formatNormaliser$1(bitmapData, this._bitmapInfo);
    bitmapData = null;
  } catch (ex) {
    this._handleError(ex);
    return;
  }
  this.emit("parsed", normalisedBitmapData);
};
var parserAsyncExports = parserAsync.exports;
var packerAsync = { exports: {} };
var packer = { exports: {} };
let constants$3 = constants$5;
var bitpacker = function(dataIn, width, height, options) {
  let outHasAlpha = [constants$3.COLORTYPE_COLOR_ALPHA, constants$3.COLORTYPE_ALPHA].indexOf(
    options.colorType
  ) !== -1;
  if (options.colorType === options.inputColorType) {
    let bigEndian = function() {
      let buffer = new ArrayBuffer(2);
      new DataView(buffer).setInt16(
        0,
        256,
        true
        /* littleEndian */
      );
      return new Int16Array(buffer)[0] !== 256;
    }();
    if (options.bitDepth === 8 || options.bitDepth === 16 && bigEndian) {
      return dataIn;
    }
  }
  let data = options.bitDepth !== 16 ? dataIn : new Uint16Array(dataIn.buffer);
  let maxValue = 255;
  let inBpp = constants$3.COLORTYPE_TO_BPP_MAP[options.inputColorType];
  if (inBpp === 4 && !options.inputHasAlpha) {
    inBpp = 3;
  }
  let outBpp = constants$3.COLORTYPE_TO_BPP_MAP[options.colorType];
  if (options.bitDepth === 16) {
    maxValue = 65535;
    outBpp *= 2;
  }
  let outData = Buffer.alloc(width * height * outBpp);
  let inIndex = 0;
  let outIndex = 0;
  let bgColor = options.bgColor || {};
  if (bgColor.red === void 0) {
    bgColor.red = maxValue;
  }
  if (bgColor.green === void 0) {
    bgColor.green = maxValue;
  }
  if (bgColor.blue === void 0) {
    bgColor.blue = maxValue;
  }
  function getRGBA() {
    let red;
    let green;
    let blue;
    let alpha = maxValue;
    switch (options.inputColorType) {
      case constants$3.COLORTYPE_COLOR_ALPHA:
        alpha = data[inIndex + 3];
        red = data[inIndex];
        green = data[inIndex + 1];
        blue = data[inIndex + 2];
        break;
      case constants$3.COLORTYPE_COLOR:
        red = data[inIndex];
        green = data[inIndex + 1];
        blue = data[inIndex + 2];
        break;
      case constants$3.COLORTYPE_ALPHA:
        alpha = data[inIndex + 1];
        red = data[inIndex];
        green = red;
        blue = red;
        break;
      case constants$3.COLORTYPE_GRAYSCALE:
        red = data[inIndex];
        green = red;
        blue = red;
        break;
      default:
        throw new Error(
          "input color type:" + options.inputColorType + " is not supported at present"
        );
    }
    if (options.inputHasAlpha) {
      if (!outHasAlpha) {
        alpha /= maxValue;
        red = Math.min(
          Math.max(Math.round((1 - alpha) * bgColor.red + alpha * red), 0),
          maxValue
        );
        green = Math.min(
          Math.max(Math.round((1 - alpha) * bgColor.green + alpha * green), 0),
          maxValue
        );
        blue = Math.min(
          Math.max(Math.round((1 - alpha) * bgColor.blue + alpha * blue), 0),
          maxValue
        );
      }
    }
    return { red, green, blue, alpha };
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rgba = getRGBA();
      switch (options.colorType) {
        case constants$3.COLORTYPE_COLOR_ALPHA:
        case constants$3.COLORTYPE_COLOR:
          if (options.bitDepth === 8) {
            outData[outIndex] = rgba.red;
            outData[outIndex + 1] = rgba.green;
            outData[outIndex + 2] = rgba.blue;
            if (outHasAlpha) {
              outData[outIndex + 3] = rgba.alpha;
            }
          } else {
            outData.writeUInt16BE(rgba.red, outIndex);
            outData.writeUInt16BE(rgba.green, outIndex + 2);
            outData.writeUInt16BE(rgba.blue, outIndex + 4);
            if (outHasAlpha) {
              outData.writeUInt16BE(rgba.alpha, outIndex + 6);
            }
          }
          break;
        case constants$3.COLORTYPE_ALPHA:
        case constants$3.COLORTYPE_GRAYSCALE: {
          let grayscale = (rgba.red + rgba.green + rgba.blue) / 3;
          if (options.bitDepth === 8) {
            outData[outIndex] = grayscale;
            if (outHasAlpha) {
              outData[outIndex + 1] = rgba.alpha;
            }
          } else {
            outData.writeUInt16BE(grayscale, outIndex);
            if (outHasAlpha) {
              outData.writeUInt16BE(rgba.alpha, outIndex + 2);
            }
          }
          break;
        }
        default:
          throw new Error("unrecognised color Type " + options.colorType);
      }
      inIndex += inBpp;
      outIndex += outBpp;
    }
  }
  return outData;
};
let paethPredictor2 = paethPredictor$2;
function filterNone(pxData, pxPos, byteWidth, rawData, rawPos) {
  for (let x = 0; x < byteWidth; x++) {
    rawData[rawPos + x] = pxData[pxPos + x];
  }
}
function filterSumNone(pxData, pxPos, byteWidth) {
  let sum = 0;
  let length = pxPos + byteWidth;
  for (let i = pxPos; i < length; i++) {
    sum += Math.abs(pxData[i]);
  }
  return sum;
}
function filterSub(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
  for (let x = 0; x < byteWidth; x++) {
    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    let val = pxData[pxPos + x] - left;
    rawData[rawPos + x] = val;
  }
}
function filterSumSub(pxData, pxPos, byteWidth, bpp) {
  let sum = 0;
  for (let x = 0; x < byteWidth; x++) {
    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    let val = pxData[pxPos + x] - left;
    sum += Math.abs(val);
  }
  return sum;
}
function filterUp(pxData, pxPos, byteWidth, rawData, rawPos) {
  for (let x = 0; x < byteWidth; x++) {
    let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    let val = pxData[pxPos + x] - up;
    rawData[rawPos + x] = val;
  }
}
function filterSumUp(pxData, pxPos, byteWidth) {
  let sum = 0;
  let length = pxPos + byteWidth;
  for (let x = pxPos; x < length; x++) {
    let up = pxPos > 0 ? pxData[x - byteWidth] : 0;
    let val = pxData[x] - up;
    sum += Math.abs(val);
  }
  return sum;
}
function filterAvg(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
  for (let x = 0; x < byteWidth; x++) {
    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    let val = pxData[pxPos + x] - (left + up >> 1);
    rawData[rawPos + x] = val;
  }
}
function filterSumAvg(pxData, pxPos, byteWidth, bpp) {
  let sum = 0;
  for (let x = 0; x < byteWidth; x++) {
    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    let val = pxData[pxPos + x] - (left + up >> 1);
    sum += Math.abs(val);
  }
  return sum;
}
function filterPaeth(pxData, pxPos, byteWidth, rawData, rawPos, bpp) {
  for (let x = 0; x < byteWidth; x++) {
    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
    let val = pxData[pxPos + x] - paethPredictor2(left, up, upleft);
    rawData[rawPos + x] = val;
  }
}
function filterSumPaeth(pxData, pxPos, byteWidth, bpp) {
  let sum = 0;
  for (let x = 0; x < byteWidth; x++) {
    let left = x >= bpp ? pxData[pxPos + x - bpp] : 0;
    let up = pxPos > 0 ? pxData[pxPos + x - byteWidth] : 0;
    let upleft = pxPos > 0 && x >= bpp ? pxData[pxPos + x - (byteWidth + bpp)] : 0;
    let val = pxData[pxPos + x] - paethPredictor2(left, up, upleft);
    sum += Math.abs(val);
  }
  return sum;
}
let filters = {
  0: filterNone,
  1: filterSub,
  2: filterUp,
  3: filterAvg,
  4: filterPaeth
};
let filterSums = {
  0: filterSumNone,
  1: filterSumSub,
  2: filterSumUp,
  3: filterSumAvg,
  4: filterSumPaeth
};
var filterPack = function(pxData, width, height, options, bpp) {
  let filterTypes;
  if (!("filterType" in options) || options.filterType === -1) {
    filterTypes = [0, 1, 2, 3, 4];
  } else if (typeof options.filterType === "number") {
    filterTypes = [options.filterType];
  } else {
    throw new Error("unrecognised filter types");
  }
  if (options.bitDepth === 16) {
    bpp *= 2;
  }
  let byteWidth = width * bpp;
  let rawPos = 0;
  let pxPos = 0;
  let rawData = Buffer.alloc((byteWidth + 1) * height);
  let sel = filterTypes[0];
  for (let y = 0; y < height; y++) {
    if (filterTypes.length > 1) {
      let min = Infinity;
      for (let i = 0; i < filterTypes.length; i++) {
        let sum = filterSums[filterTypes[i]](pxData, pxPos, byteWidth, bpp);
        if (sum < min) {
          sel = filterTypes[i];
          min = sum;
        }
      }
    }
    rawData[rawPos] = sel;
    rawPos++;
    filters[sel](pxData, pxPos, byteWidth, rawData, rawPos, bpp);
    rawPos += byteWidth;
    pxPos += byteWidth;
  }
  return rawData;
};
let constants$2 = constants$5;
let CrcStream = crcExports;
let bitPacker = bitpacker;
let filter = filterPack;
let zlib$2 = require$$1$2;
let Packer$3 = packer.exports = function(options) {
  this._options = options;
  options.deflateChunkSize = options.deflateChunkSize || 32 * 1024;
  options.deflateLevel = options.deflateLevel != null ? options.deflateLevel : 9;
  options.deflateStrategy = options.deflateStrategy != null ? options.deflateStrategy : 3;
  options.inputHasAlpha = options.inputHasAlpha != null ? options.inputHasAlpha : true;
  options.deflateFactory = options.deflateFactory || zlib$2.createDeflate;
  options.bitDepth = options.bitDepth || 8;
  options.colorType = typeof options.colorType === "number" ? options.colorType : constants$2.COLORTYPE_COLOR_ALPHA;
  options.inputColorType = typeof options.inputColorType === "number" ? options.inputColorType : constants$2.COLORTYPE_COLOR_ALPHA;
  if ([
    constants$2.COLORTYPE_GRAYSCALE,
    constants$2.COLORTYPE_COLOR,
    constants$2.COLORTYPE_COLOR_ALPHA,
    constants$2.COLORTYPE_ALPHA
  ].indexOf(options.colorType) === -1) {
    throw new Error(
      "option color type:" + options.colorType + " is not supported at present"
    );
  }
  if ([
    constants$2.COLORTYPE_GRAYSCALE,
    constants$2.COLORTYPE_COLOR,
    constants$2.COLORTYPE_COLOR_ALPHA,
    constants$2.COLORTYPE_ALPHA
  ].indexOf(options.inputColorType) === -1) {
    throw new Error(
      "option input color type:" + options.inputColorType + " is not supported at present"
    );
  }
  if (options.bitDepth !== 8 && options.bitDepth !== 16) {
    throw new Error(
      "option bit depth:" + options.bitDepth + " is not supported at present"
    );
  }
};
Packer$3.prototype.getDeflateOptions = function() {
  return {
    chunkSize: this._options.deflateChunkSize,
    level: this._options.deflateLevel,
    strategy: this._options.deflateStrategy
  };
};
Packer$3.prototype.createDeflate = function() {
  return this._options.deflateFactory(this.getDeflateOptions());
};
Packer$3.prototype.filterData = function(data, width, height) {
  let packedData = bitPacker(data, width, height, this._options);
  let bpp = constants$2.COLORTYPE_TO_BPP_MAP[this._options.colorType];
  let filteredData = filter(packedData, width, height, this._options, bpp);
  return filteredData;
};
Packer$3.prototype._packChunk = function(type, data) {
  let len = data ? data.length : 0;
  let buf = Buffer.alloc(len + 12);
  buf.writeUInt32BE(len, 0);
  buf.writeUInt32BE(type, 4);
  if (data) {
    data.copy(buf, 8);
  }
  buf.writeInt32BE(
    CrcStream.crc32(buf.slice(4, buf.length - 4)),
    buf.length - 4
  );
  return buf;
};
Packer$3.prototype.packGAMA = function(gamma) {
  let buf = Buffer.alloc(4);
  buf.writeUInt32BE(Math.floor(gamma * constants$2.GAMMA_DIVISION), 0);
  return this._packChunk(constants$2.TYPE_gAMA, buf);
};
Packer$3.prototype.packIHDR = function(width, height) {
  let buf = Buffer.alloc(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = this._options.bitDepth;
  buf[9] = this._options.colorType;
  buf[10] = 0;
  buf[11] = 0;
  buf[12] = 0;
  return this._packChunk(constants$2.TYPE_IHDR, buf);
};
Packer$3.prototype.packIDAT = function(data) {
  return this._packChunk(constants$2.TYPE_IDAT, data);
};
Packer$3.prototype.packIEND = function() {
  return this._packChunk(constants$2.TYPE_IEND, null);
};
var packerExports = packer.exports;
let util$1 = require$$0$2;
let Stream$1 = require$$1$1;
let constants$1 = constants$5;
let Packer$2 = packerExports;
let PackerAsync = packerAsync.exports = function(opt) {
  Stream$1.call(this);
  let options = opt || {};
  this._packer = new Packer$2(options);
  this._deflate = this._packer.createDeflate();
  this.readable = true;
};
util$1.inherits(PackerAsync, Stream$1);
PackerAsync.prototype.pack = function(data, width, height, gamma) {
  this.emit("data", Buffer.from(constants$1.PNG_SIGNATURE));
  this.emit("data", this._packer.packIHDR(width, height));
  if (gamma) {
    this.emit("data", this._packer.packGAMA(gamma));
  }
  let filteredData = this._packer.filterData(data, width, height);
  this._deflate.on("error", this.emit.bind(this, "error"));
  this._deflate.on(
    "data",
    (function(compressedData) {
      this.emit("data", this._packer.packIDAT(compressedData));
    }).bind(this)
  );
  this._deflate.on(
    "end",
    (function() {
      this.emit("data", this._packer.packIEND());
      this.emit("end");
    }).bind(this)
  );
  this._deflate.end(filteredData);
};
var packerAsyncExports = packerAsync.exports;
var pngSync = {};
var syncInflate = { exports: {} };
(function(module, exports) {
  let assert = require$$0$3.ok;
  let zlib2 = require$$1$2;
  let util2 = require$$0$2;
  let kMaxLength = require$$0$1.kMaxLength;
  function Inflate2(opts) {
    if (!(this instanceof Inflate2)) {
      return new Inflate2(opts);
    }
    if (opts && opts.chunkSize < zlib2.Z_MIN_CHUNK) {
      opts.chunkSize = zlib2.Z_MIN_CHUNK;
    }
    zlib2.Inflate.call(this, opts);
    this._offset = this._offset === void 0 ? this._outOffset : this._offset;
    this._buffer = this._buffer || this._outBuffer;
    if (opts && opts.maxLength != null) {
      this._maxLength = opts.maxLength;
    }
  }
  function createInflate(opts) {
    return new Inflate2(opts);
  }
  function _close(engine, callback) {
    if (!engine._handle) {
      return;
    }
    engine._handle.close();
    engine._handle = null;
  }
  Inflate2.prototype._processChunk = function(chunk, flushFlag, asyncCb) {
    if (typeof asyncCb === "function") {
      return zlib2.Inflate._processChunk.call(this, chunk, flushFlag, asyncCb);
    }
    let self2 = this;
    let availInBefore = chunk && chunk.length;
    let availOutBefore = this._chunkSize - this._offset;
    let leftToInflate = this._maxLength;
    let inOff = 0;
    let buffers = [];
    let nread = 0;
    let error;
    this.on("error", function(err2) {
      error = err2;
    });
    function handleChunk(availInAfter, availOutAfter) {
      if (self2._hadError) {
        return;
      }
      let have = availOutBefore - availOutAfter;
      assert(have >= 0, "have should not go down");
      if (have > 0) {
        let out2 = self2._buffer.slice(self2._offset, self2._offset + have);
        self2._offset += have;
        if (out2.length > leftToInflate) {
          out2 = out2.slice(0, leftToInflate);
        }
        buffers.push(out2);
        nread += out2.length;
        leftToInflate -= out2.length;
        if (leftToInflate === 0) {
          return false;
        }
      }
      if (availOutAfter === 0 || self2._offset >= self2._chunkSize) {
        availOutBefore = self2._chunkSize;
        self2._offset = 0;
        self2._buffer = Buffer.allocUnsafe(self2._chunkSize);
      }
      if (availOutAfter === 0) {
        inOff += availInBefore - availInAfter;
        availInBefore = availInAfter;
        return true;
      }
      return false;
    }
    assert(this._handle, "zlib binding closed");
    let res;
    do {
      res = this._handle.writeSync(
        flushFlag,
        chunk,
        // in
        inOff,
        // in_off
        availInBefore,
        // in_len
        this._buffer,
        // out
        this._offset,
        //out_off
        availOutBefore
      );
      res = res || this._writeState;
    } while (!this._hadError && handleChunk(res[0], res[1]));
    if (this._hadError) {
      throw error;
    }
    if (nread >= kMaxLength) {
      _close(this);
      throw new RangeError(
        "Cannot create final Buffer. It would be larger than 0x" + kMaxLength.toString(16) + " bytes"
      );
    }
    let buf = Buffer.concat(buffers, nread);
    _close(this);
    return buf;
  };
  util2.inherits(Inflate2, zlib2.Inflate);
  function zlibBufferSync(engine, buffer) {
    if (typeof buffer === "string") {
      buffer = Buffer.from(buffer);
    }
    if (!(buffer instanceof Buffer)) {
      throw new TypeError("Not a string or buffer");
    }
    let flushFlag = engine._finishFlushFlag;
    if (flushFlag == null) {
      flushFlag = zlib2.Z_FINISH;
    }
    return engine._processChunk(buffer, flushFlag);
  }
  function inflateSync2(buffer, opts) {
    return zlibBufferSync(new Inflate2(opts), buffer);
  }
  module.exports = exports = inflateSync2;
  exports.Inflate = Inflate2;
  exports.createInflate = createInflate;
  exports.inflateSync = inflateSync2;
})(syncInflate, syncInflate.exports);
var syncInflateExports = syncInflate.exports;
var syncReader = { exports: {} };
let SyncReader$2 = syncReader.exports = function(buffer) {
  this._buffer = buffer;
  this._reads = [];
};
SyncReader$2.prototype.read = function(length, callback) {
  this._reads.push({
    length: Math.abs(length),
    // if length < 0 then at most this length
    allowLess: length < 0,
    func: callback
  });
};
SyncReader$2.prototype.process = function() {
  while (this._reads.length > 0 && this._buffer.length) {
    let read = this._reads[0];
    if (this._buffer.length && (this._buffer.length >= read.length || read.allowLess)) {
      this._reads.shift();
      let buf = this._buffer;
      this._buffer = buf.slice(read.length);
      read.func.call(this, buf.slice(0, read.length));
    } else {
      break;
    }
  }
  if (this._reads.length > 0) {
    return new Error("There are some read requests waitng on finished stream");
  }
  if (this._buffer.length > 0) {
    return new Error("unrecognised content at end of stream");
  }
};
var syncReaderExports = syncReader.exports;
var filterParseSync = {};
let SyncReader$1 = syncReaderExports;
let Filter = filterParseExports;
filterParseSync.process = function(inBuffer, bitmapInfo) {
  let outBuffers = [];
  let reader = new SyncReader$1(inBuffer);
  let filter2 = new Filter(bitmapInfo, {
    read: reader.read.bind(reader),
    write: function(bufferPart) {
      outBuffers.push(bufferPart);
    },
    complete: function() {
    }
  });
  filter2.start();
  reader.process();
  return Buffer.concat(outBuffers);
};
let hasSyncZlib$1 = true;
let zlib$1 = require$$1$2;
let inflateSync = syncInflateExports;
if (!zlib$1.deflateSync) {
  hasSyncZlib$1 = false;
}
let SyncReader = syncReaderExports;
let FilterSync = filterParseSync;
let Parser$1 = parserExports;
let bitmapper = bitmapper$2;
let formatNormaliser = formatNormaliser$2;
var parserSync = function(buffer, options) {
  if (!hasSyncZlib$1) {
    throw new Error(
      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
    );
  }
  let err2;
  function handleError(_err_) {
    err2 = _err_;
  }
  let metaData;
  function handleMetaData(_metaData_) {
    metaData = _metaData_;
  }
  function handleTransColor(transColor) {
    metaData.transColor = transColor;
  }
  function handlePalette(palette) {
    metaData.palette = palette;
  }
  function handleSimpleTransparency() {
    metaData.alpha = true;
  }
  let gamma;
  function handleGamma(_gamma_) {
    gamma = _gamma_;
  }
  let inflateDataList = [];
  function handleInflateData(inflatedData2) {
    inflateDataList.push(inflatedData2);
  }
  let reader = new SyncReader(buffer);
  let parser2 = new Parser$1(options, {
    read: reader.read.bind(reader),
    error: handleError,
    metadata: handleMetaData,
    gamma: handleGamma,
    palette: handlePalette,
    transColor: handleTransColor,
    inflateData: handleInflateData,
    simpleTransparency: handleSimpleTransparency
  });
  parser2.start();
  reader.process();
  if (err2) {
    throw err2;
  }
  let inflateData = Buffer.concat(inflateDataList);
  inflateDataList.length = 0;
  let inflatedData;
  if (metaData.interlace) {
    inflatedData = zlib$1.inflateSync(inflateData);
  } else {
    let rowSize = (metaData.width * metaData.bpp * metaData.depth + 7 >> 3) + 1;
    let imageSize = rowSize * metaData.height;
    inflatedData = inflateSync(inflateData, {
      chunkSize: imageSize,
      maxLength: imageSize
    });
  }
  inflateData = null;
  if (!inflatedData || !inflatedData.length) {
    throw new Error("bad png - invalid inflate data response");
  }
  let unfilteredData = FilterSync.process(inflatedData, metaData);
  inflateData = null;
  let bitmapData = bitmapper.dataToBitMap(unfilteredData, metaData);
  unfilteredData = null;
  let normalisedBitmapData = formatNormaliser(bitmapData, metaData);
  metaData.data = normalisedBitmapData;
  metaData.gamma = gamma || 0;
  return metaData;
};
let hasSyncZlib = true;
let zlib = require$$1$2;
if (!zlib.deflateSync) {
  hasSyncZlib = false;
}
let constants = constants$5;
let Packer$1 = packerExports;
var packerSync = function(metaData, opt) {
  if (!hasSyncZlib) {
    throw new Error(
      "To use the sync capability of this library in old node versions, please pin pngjs to v2.3.0"
    );
  }
  let options = opt || {};
  let packer2 = new Packer$1(options);
  let chunks = [];
  chunks.push(Buffer.from(constants.PNG_SIGNATURE));
  chunks.push(packer2.packIHDR(metaData.width, metaData.height));
  if (metaData.gamma) {
    chunks.push(packer2.packGAMA(metaData.gamma));
  }
  let filteredData = packer2.filterData(
    metaData.data,
    metaData.width,
    metaData.height
  );
  let compressedData = zlib.deflateSync(
    filteredData,
    packer2.getDeflateOptions()
  );
  filteredData = null;
  if (!compressedData || !compressedData.length) {
    throw new Error("bad png - invalid compressed data response");
  }
  chunks.push(packer2.packIDAT(compressedData));
  chunks.push(packer2.packIEND());
  return Buffer.concat(chunks);
};
let parse = parserSync;
let pack = packerSync;
pngSync.read = function(buffer, options) {
  return parse(buffer, options || {});
};
pngSync.write = function(png2, options) {
  return pack(png2, options);
};
let util = require$$0$2;
let Stream = require$$1$1;
let Parser = parserAsyncExports;
let Packer = packerAsyncExports;
let PNGSync = pngSync;
let PNG = png.PNG = function(options) {
  Stream.call(this);
  options = options || {};
  this.width = options.width | 0;
  this.height = options.height | 0;
  this.data = this.width > 0 && this.height > 0 ? Buffer.alloc(4 * this.width * this.height) : null;
  if (options.fill && this.data) {
    this.data.fill(0);
  }
  this.gamma = 0;
  this.readable = this.writable = true;
  this._parser = new Parser(options);
  this._parser.on("error", this.emit.bind(this, "error"));
  this._parser.on("close", this._handleClose.bind(this));
  this._parser.on("metadata", this._metadata.bind(this));
  this._parser.on("gamma", this._gamma.bind(this));
  this._parser.on(
    "parsed",
    (function(data) {
      this.data = data;
      this.emit("parsed", data);
    }).bind(this)
  );
  this._packer = new Packer(options);
  this._packer.on("data", this.emit.bind(this, "data"));
  this._packer.on("end", this.emit.bind(this, "end"));
  this._parser.on("close", this._handleClose.bind(this));
  this._packer.on("error", this.emit.bind(this, "error"));
};
util.inherits(PNG, Stream);
PNG.sync = PNGSync;
PNG.prototype.pack = function() {
  if (!this.data || !this.data.length) {
    this.emit("error", "No data provided");
    return this;
  }
  process.nextTick(
    (function() {
      this._packer.pack(this.data, this.width, this.height, this.gamma);
    }).bind(this)
  );
  return this;
};
PNG.prototype.parse = function(data, callback) {
  if (callback) {
    let onParsed, onError;
    onParsed = (function(parsedData) {
      this.removeListener("error", onError);
      this.data = parsedData;
      callback(null, this);
    }).bind(this);
    onError = (function(err2) {
      this.removeListener("parsed", onParsed);
      callback(err2, null);
    }).bind(this);
    this.once("parsed", onParsed);
    this.once("error", onError);
  }
  this.end(data);
  return this;
};
PNG.prototype.write = function(data) {
  this._parser.write(data);
  return true;
};
PNG.prototype.end = function(data) {
  this._parser.end(data);
};
PNG.prototype._metadata = function(metadata) {
  this.width = metadata.width;
  this.height = metadata.height;
  this.emit("metadata", metadata);
};
PNG.prototype._gamma = function(gamma) {
  this.gamma = gamma;
};
PNG.prototype._handleClose = function() {
  if (!this._parser.writable && !this._packer.readable) {
    this.emit("close");
  }
};
PNG.bitblt = function(src, dst, srcX, srcY, width, height, deltaX, deltaY) {
  srcX |= 0;
  srcY |= 0;
  width |= 0;
  height |= 0;
  deltaX |= 0;
  deltaY |= 0;
  if (srcX > src.width || srcY > src.height || srcX + width > src.width || srcY + height > src.height) {
    throw new Error("bitblt reading outside image");
  }
  if (deltaX > dst.width || deltaY > dst.height || deltaX + width > dst.width || deltaY + height > dst.height) {
    throw new Error("bitblt writing outside image");
  }
  for (let y = 0; y < height; y++) {
    src.data.copy(
      dst.data,
      (deltaY + y) * dst.width + deltaX << 2,
      (srcY + y) * src.width + srcX << 2,
      (srcY + y) * src.width + srcX + width << 2
    );
  }
};
PNG.prototype.bitblt = function(dst, srcX, srcY, width, height, deltaX, deltaY) {
  PNG.bitblt(this, dst, srcX, srcY, width, height, deltaX, deltaY);
  return this;
};
PNG.adjustGamma = function(src) {
  if (src.gamma) {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let idx = src.width * y + x << 2;
        for (let i = 0; i < 3; i++) {
          let sample = src.data[idx + i] / 255;
          sample = Math.pow(sample, 1 / 2.2 / src.gamma);
          src.data[idx + i] = Math.round(sample * 255);
        }
      }
    }
    src.gamma = 0;
  }
};
PNG.prototype.adjustGamma = function() {
  PNG.adjustGamma(this);
};
var utils = {};
(function(exports) {
  function hex2rgba(hex) {
    if (typeof hex === "number") {
      hex = hex.toString();
    }
    if (typeof hex !== "string") {
      throw new Error("Color should be defined as hex string");
    }
    let hexCode = hex.slice().replace("#", "").split("");
    if (hexCode.length < 3 || hexCode.length === 5 || hexCode.length > 8) {
      throw new Error("Invalid hex color: " + hex);
    }
    if (hexCode.length === 3 || hexCode.length === 4) {
      hexCode = Array.prototype.concat.apply([], hexCode.map(function(c2) {
        return [c2, c2];
      }));
    }
    if (hexCode.length === 6) hexCode.push("F", "F");
    const hexValue = parseInt(hexCode.join(""), 16);
    return {
      r: hexValue >> 24 & 255,
      g: hexValue >> 16 & 255,
      b: hexValue >> 8 & 255,
      a: hexValue & 255,
      hex: "#" + hexCode.slice(0, 6).join("")
    };
  }
  exports.getOptions = function getOptions(options) {
    if (!options) options = {};
    if (!options.color) options.color = {};
    const margin = typeof options.margin === "undefined" || options.margin === null || options.margin < 0 ? 4 : options.margin;
    const width = options.width && options.width >= 21 ? options.width : void 0;
    const scale = options.scale || 4;
    return {
      width,
      scale: width ? 4 : scale,
      margin,
      color: {
        dark: hex2rgba(options.color.dark || "#000000ff"),
        light: hex2rgba(options.color.light || "#ffffffff")
      },
      type: options.type,
      rendererOpts: options.rendererOpts || {}
    };
  };
  exports.getScale = function getScale(qrSize, opts) {
    return opts.width && opts.width >= qrSize + opts.margin * 2 ? opts.width / (qrSize + opts.margin * 2) : opts.scale;
  };
  exports.getImageWidth = function getImageWidth(qrSize, opts) {
    const scale = exports.getScale(qrSize, opts);
    return Math.floor((qrSize + opts.margin * 2) * scale);
  };
  exports.qrToImageData = function qrToImageData(imgData, qr, opts) {
    const size = qr.modules.size;
    const data = qr.modules.data;
    const scale = exports.getScale(size, opts);
    const symbolSize = Math.floor((size + opts.margin * 2) * scale);
    const scaledMargin = opts.margin * scale;
    const palette = [opts.color.light, opts.color.dark];
    for (let i = 0; i < symbolSize; i++) {
      for (let j = 0; j < symbolSize; j++) {
        let posDst = (i * symbolSize + j) * 4;
        let pxColor = opts.color.light;
        if (i >= scaledMargin && j >= scaledMargin && i < symbolSize - scaledMargin && j < symbolSize - scaledMargin) {
          const iSrc = Math.floor((i - scaledMargin) / scale);
          const jSrc = Math.floor((j - scaledMargin) / scale);
          pxColor = palette[data[iSrc * size + jSrc] ? 1 : 0];
        }
        imgData[posDst++] = pxColor.r;
        imgData[posDst++] = pxColor.g;
        imgData[posDst++] = pxColor.b;
        imgData[posDst] = pxColor.a;
      }
    }
  };
})(utils);
(function(exports) {
  const fs2 = require$$0;
  const PNG2 = png.PNG;
  const Utils2 = utils;
  exports.render = function render3(qrData, options) {
    const opts = Utils2.getOptions(options);
    const pngOpts = opts.rendererOpts;
    const size = Utils2.getImageWidth(qrData.modules.size, opts);
    pngOpts.width = size;
    pngOpts.height = size;
    const pngImage = new PNG2(pngOpts);
    Utils2.qrToImageData(pngImage.data, qrData, opts);
    return pngImage;
  };
  exports.renderToDataURL = function renderToDataURL(qrData, options, cb) {
    if (typeof cb === "undefined") {
      cb = options;
      options = void 0;
    }
    exports.renderToBuffer(qrData, options, function(err2, output) {
      if (err2) cb(err2);
      let url = "data:image/png;base64,";
      url += output.toString("base64");
      cb(null, url);
    });
  };
  exports.renderToBuffer = function renderToBuffer(qrData, options, cb) {
    if (typeof cb === "undefined") {
      cb = options;
      options = void 0;
    }
    const png2 = exports.render(qrData, options);
    const buffer = [];
    png2.on("error", cb);
    png2.on("data", function(data) {
      buffer.push(data);
    });
    png2.on("end", function() {
      cb(null, Buffer.concat(buffer));
    });
    png2.pack();
  };
  exports.renderToFile = function renderToFile(path2, qrData, options, cb) {
    if (typeof cb === "undefined") {
      cb = options;
      options = void 0;
    }
    let called = false;
    const done = (...args) => {
      if (called) return;
      called = true;
      cb.apply(null, args);
    };
    const stream2 = fs2.createWriteStream(path2);
    stream2.on("error", done);
    stream2.on("close", done);
    exports.renderToFileStream(stream2, qrData, options);
  };
  exports.renderToFileStream = function renderToFileStream(stream2, qrData, options) {
    const png2 = exports.render(qrData, options);
    png2.pack().pipe(stream2);
  };
})(png$1);
var utf8 = {};
(function(exports) {
  const Utils2 = utils;
  const BLOCK_CHAR = {
    WW: " ",
    WB: "▄",
    BB: "█",
    BW: "▀"
  };
  const INVERTED_BLOCK_CHAR = {
    BB: " ",
    BW: "▄",
    WW: "█",
    WB: "▀"
  };
  function getBlockChar(top, bottom, blocks) {
    if (top && bottom) return blocks.BB;
    if (top && !bottom) return blocks.BW;
    if (!top && bottom) return blocks.WB;
    return blocks.WW;
  }
  exports.render = function(qrData, options, cb) {
    const opts = Utils2.getOptions(options);
    let blocks = BLOCK_CHAR;
    if (opts.color.dark.hex === "#ffffff" || opts.color.light.hex === "#000000") {
      blocks = INVERTED_BLOCK_CHAR;
    }
    const size = qrData.modules.size;
    const data = qrData.modules.data;
    let output = "";
    let hMargin = Array(size + opts.margin * 2 + 1).join(blocks.WW);
    hMargin = Array(opts.margin / 2 + 1).join(hMargin + "\n");
    const vMargin = Array(opts.margin + 1).join(blocks.WW);
    output += hMargin;
    for (let i = 0; i < size; i += 2) {
      output += vMargin;
      for (let j = 0; j < size; j++) {
        const topModule = data[i * size + j];
        const bottomModule = data[(i + 1) * size + j];
        output += getBlockChar(topModule, bottomModule, blocks);
      }
      output += vMargin + "\n";
    }
    output += hMargin.slice(0, -1);
    if (typeof cb === "function") {
      cb(null, output);
    }
    return output;
  };
  exports.renderToFile = function renderToFile(path2, qrData, options, cb) {
    if (typeof cb === "undefined") {
      cb = options;
      options = void 0;
    }
    const fs2 = require$$0;
    const utf82 = exports.render(qrData, options);
    fs2.writeFile(path2, utf82, cb);
  };
})(utf8);
var terminal$1 = {};
var terminal = {};
terminal.render = function(qrData, options, cb) {
  const size = qrData.modules.size;
  const data = qrData.modules.data;
  const black = "\x1B[40m  \x1B[0m";
  const white = "\x1B[47m  \x1B[0m";
  let output = "";
  const hMargin = Array(size + 3).join(white);
  const vMargin = Array(2).join(white);
  output += hMargin + "\n";
  for (let i = 0; i < size; ++i) {
    output += white;
    for (let j = 0; j < size; j++) {
      output += data[i * size + j] ? black : white;
    }
    output += vMargin + "\n";
  }
  output += hMargin + "\n";
  if (typeof cb === "function") {
    cb(null, output);
  }
  return output;
};
var terminalSmall = {};
const backgroundWhite = "\x1B[47m";
const backgroundBlack = "\x1B[40m";
const foregroundWhite = "\x1B[37m";
const foregroundBlack = "\x1B[30m";
const reset = "\x1B[0m";
const lineSetupNormal = backgroundWhite + foregroundBlack;
const lineSetupInverse = backgroundBlack + foregroundWhite;
const createPalette = function(lineSetup, foregroundWhite2, foregroundBlack2) {
  return {
    // 1 ... white, 2 ... black, 0 ... transparent (default)
    "00": reset + " " + lineSetup,
    "01": reset + foregroundWhite2 + "▄" + lineSetup,
    "02": reset + foregroundBlack2 + "▄" + lineSetup,
    10: reset + foregroundWhite2 + "▀" + lineSetup,
    11: " ",
    12: "▄",
    20: reset + foregroundBlack2 + "▀" + lineSetup,
    21: "▀",
    22: "█"
  };
};
const mkCodePixel = function(modules, size, x, y) {
  const sizePlus = size + 1;
  if (x >= sizePlus || y >= sizePlus || y < -1 || x < -1) return "0";
  if (x >= size || y >= size || y < 0 || x < 0) return "1";
  const idx = y * size + x;
  return modules[idx] ? "2" : "1";
};
const mkCode = function(modules, size, x, y) {
  return mkCodePixel(modules, size, x, y) + mkCodePixel(modules, size, x, y + 1);
};
terminalSmall.render = function(qrData, options, cb) {
  const size = qrData.modules.size;
  const data = qrData.modules.data;
  const inverse = !!(options && options.inverse);
  const lineSetup = options && options.inverse ? lineSetupInverse : lineSetupNormal;
  const white = inverse ? foregroundBlack : foregroundWhite;
  const black = inverse ? foregroundWhite : foregroundBlack;
  const palette = createPalette(lineSetup, white, black);
  const newLine = reset + "\n" + lineSetup;
  let output = lineSetup;
  for (let y = -1; y < size + 1; y += 2) {
    for (let x = -1; x < size; x++) {
      output += palette[mkCode(data, size, x, y)];
    }
    output += palette[mkCode(data, size, size, y)] + newLine;
  }
  output += reset;
  if (typeof cb === "function") {
    cb(null, output);
  }
  return output;
};
const big = terminal;
const small = terminalSmall;
terminal$1.render = function(qrData, options, cb) {
  if (options && options.small) {
    return small.render(qrData, options, cb);
  }
  return big.render(qrData, options, cb);
};
var svg = {};
var svgTag = {};
const Utils = utils;
function getColorAttrib(color, attrib) {
  const alpha = color.a / 255;
  const str = attrib + '="' + color.hex + '"';
  return alpha < 1 ? str + " " + attrib + '-opacity="' + alpha.toFixed(2).slice(1) + '"' : str;
}
function svgCmd(cmd, x, y) {
  let str = cmd + x;
  if (typeof y !== "undefined") str += " " + y;
  return str;
}
function qrToPath(data, size, margin) {
  let path2 = "";
  let moveBy = 0;
  let newRow = false;
  let lineLength = 0;
  for (let i = 0; i < data.length; i++) {
    const col = Math.floor(i % size);
    const row = Math.floor(i / size);
    if (!col && !newRow) newRow = true;
    if (data[i]) {
      lineLength++;
      if (!(i > 0 && col > 0 && data[i - 1])) {
        path2 += newRow ? svgCmd("M", col + margin, 0.5 + row + margin) : svgCmd("m", moveBy, 0);
        moveBy = 0;
        newRow = false;
      }
      if (!(col + 1 < size && data[i + 1])) {
        path2 += svgCmd("h", lineLength);
        lineLength = 0;
      }
    } else {
      moveBy++;
    }
  }
  return path2;
}
svgTag.render = function render(qrData, options, cb) {
  const opts = Utils.getOptions(options);
  const size = qrData.modules.size;
  const data = qrData.modules.data;
  const qrcodesize = size + opts.margin * 2;
  const bg = !opts.color.light.a ? "" : "<path " + getColorAttrib(opts.color.light, "fill") + ' d="M0 0h' + qrcodesize + "v" + qrcodesize + 'H0z"/>';
  const path2 = "<path " + getColorAttrib(opts.color.dark, "stroke") + ' d="' + qrToPath(data, size, opts.margin) + '"/>';
  const viewBox = 'viewBox="0 0 ' + qrcodesize + " " + qrcodesize + '"';
  const width = !opts.width ? "" : 'width="' + opts.width + '" height="' + opts.width + '" ';
  const svgTag2 = '<svg xmlns="http://www.w3.org/2000/svg" ' + width + viewBox + ' shape-rendering="crispEdges">' + bg + path2 + "</svg>\n";
  if (typeof cb === "function") {
    cb(null, svgTag2);
  }
  return svgTag2;
};
(function(exports) {
  const svgTagRenderer = svgTag;
  exports.render = svgTagRenderer.render;
  exports.renderToFile = function renderToFile(path2, qrData, options, cb) {
    if (typeof cb === "undefined") {
      cb = options;
      options = void 0;
    }
    const fs2 = require$$0;
    const svgTag2 = exports.render(qrData, options);
    const xmlStr = '<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + svgTag2;
    fs2.writeFile(path2, xmlStr, cb);
  };
})(svg);
var browser = {};
var canvas = {};
var hasRequiredCanvas;
function requireCanvas() {
  if (hasRequiredCanvas) return canvas;
  hasRequiredCanvas = 1;
  (function(exports) {
    const Utils2 = utils;
    function clearCanvas(ctx, canvas2, size) {
      ctx.clearRect(0, 0, canvas2.width, canvas2.height);
      if (!canvas2.style) canvas2.style = {};
      canvas2.height = size;
      canvas2.width = size;
      canvas2.style.height = size + "px";
      canvas2.style.width = size + "px";
    }
    function getCanvasElement() {
      try {
        return document.createElement("canvas");
      } catch (e) {
        throw new Error("You need to specify a canvas element");
      }
    }
    exports.render = function render3(qrData, canvas2, options) {
      let opts = options;
      let canvasEl = canvas2;
      if (typeof opts === "undefined" && (!canvas2 || !canvas2.getContext)) {
        opts = canvas2;
        canvas2 = void 0;
      }
      if (!canvas2) {
        canvasEl = getCanvasElement();
      }
      opts = Utils2.getOptions(opts);
      const size = Utils2.getImageWidth(qrData.modules.size, opts);
      const ctx = canvasEl.getContext("2d");
      const image = ctx.createImageData(size, size);
      Utils2.qrToImageData(image.data, qrData, opts);
      clearCanvas(ctx, canvasEl, size);
      ctx.putImageData(image, 0, 0);
      return canvasEl;
    };
    exports.renderToDataURL = function renderToDataURL(qrData, canvas2, options) {
      let opts = options;
      if (typeof opts === "undefined" && (!canvas2 || !canvas2.getContext)) {
        opts = canvas2;
        canvas2 = void 0;
      }
      if (!opts) opts = {};
      const canvasEl = exports.render(qrData, canvas2, opts);
      const type = opts.type || "image/png";
      const rendererOpts = opts.rendererOpts || {};
      return canvasEl.toDataURL(type, rendererOpts.quality);
    };
  })(canvas);
  return canvas;
}
var hasRequiredBrowser;
function requireBrowser() {
  if (hasRequiredBrowser) return browser;
  hasRequiredBrowser = 1;
  const canPromise2 = canPromise$1;
  const QRCode2 = qrcode;
  const CanvasRenderer = requireCanvas();
  const SvgRenderer2 = svgTag;
  function renderCanvas(renderFunc, canvas2, text, opts, cb) {
    const args = [].slice.call(arguments, 1);
    const argsNum = args.length;
    const isLastArgCb = typeof args[argsNum - 1] === "function";
    if (!isLastArgCb && !canPromise2()) {
      throw new Error("Callback required as last argument");
    }
    if (isLastArgCb) {
      if (argsNum < 2) {
        throw new Error("Too few arguments provided");
      }
      if (argsNum === 2) {
        cb = text;
        text = canvas2;
        canvas2 = opts = void 0;
      } else if (argsNum === 3) {
        if (canvas2.getContext && typeof cb === "undefined") {
          cb = opts;
          opts = void 0;
        } else {
          cb = opts;
          opts = text;
          text = canvas2;
          canvas2 = void 0;
        }
      }
    } else {
      if (argsNum < 1) {
        throw new Error("Too few arguments provided");
      }
      if (argsNum === 1) {
        text = canvas2;
        canvas2 = opts = void 0;
      } else if (argsNum === 2 && !canvas2.getContext) {
        opts = text;
        text = canvas2;
        canvas2 = void 0;
      }
      return new Promise(function(resolve, reject) {
        try {
          const data = QRCode2.create(text, opts);
          resolve(renderFunc(data, canvas2, opts));
        } catch (e) {
          reject(e);
        }
      });
    }
    try {
      const data = QRCode2.create(text, opts);
      cb(null, renderFunc(data, canvas2, opts));
    } catch (e) {
      cb(e);
    }
  }
  browser.create = QRCode2.create;
  browser.toCanvas = renderCanvas.bind(null, CanvasRenderer.render);
  browser.toDataURL = renderCanvas.bind(null, CanvasRenderer.renderToDataURL);
  browser.toString = renderCanvas.bind(null, function(data, _, opts) {
    return SvgRenderer2.render(data, opts);
  });
  return browser;
}
const canPromise = canPromise$1;
const QRCode$1 = qrcode;
const PngRenderer = png$1;
const Utf8Renderer = utf8;
const TerminalRenderer = terminal$1;
const SvgRenderer = svg;
function checkParams(text, opts, cb) {
  if (typeof text === "undefined") {
    throw new Error("String required as first argument");
  }
  if (typeof cb === "undefined") {
    cb = opts;
    opts = {};
  }
  if (typeof cb !== "function") {
    if (!canPromise()) {
      throw new Error("Callback required as last argument");
    } else {
      opts = cb || {};
      cb = null;
    }
  }
  return {
    opts,
    cb
  };
}
function getTypeFromFilename(path2) {
  return path2.slice((path2.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
}
function getRendererFromType(type) {
  switch (type) {
    case "svg":
      return SvgRenderer;
    case "txt":
    case "utf8":
      return Utf8Renderer;
    case "png":
    case "image/png":
    default:
      return PngRenderer;
  }
}
function getStringRendererFromType(type) {
  switch (type) {
    case "svg":
      return SvgRenderer;
    case "terminal":
      return TerminalRenderer;
    case "utf8":
    default:
      return Utf8Renderer;
  }
}
function render2(renderFunc, text, params) {
  if (!params.cb) {
    return new Promise(function(resolve, reject) {
      try {
        const data = QRCode$1.create(text, params.opts);
        return renderFunc(data, params.opts, function(err2, data2) {
          return err2 ? reject(err2) : resolve(data2);
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  try {
    const data = QRCode$1.create(text, params.opts);
    return renderFunc(data, params.opts, params.cb);
  } catch (e) {
    params.cb(e);
  }
}
server.create = QRCode$1.create;
server.toCanvas = requireBrowser().toCanvas;
server.toString = function toString2(text, opts, cb) {
  const params = checkParams(text, opts, cb);
  const type = params.opts ? params.opts.type : void 0;
  const renderer = getStringRendererFromType(type);
  return render2(renderer.render, text, params);
};
server.toDataURL = function toDataURL(text, opts, cb) {
  const params = checkParams(text, opts, cb);
  const renderer = getRendererFromType(params.opts.type);
  return render2(renderer.renderToDataURL, text, params);
};
server.toBuffer = function toBuffer(text, opts, cb) {
  const params = checkParams(text, opts, cb);
  const renderer = getRendererFromType(params.opts.type);
  return render2(renderer.renderToBuffer, text, params);
};
server.toFile = function toFile(path2, text, opts, cb) {
  if (typeof path2 !== "string" || !(typeof text === "string" || typeof text === "object")) {
    throw new Error("Invalid argument");
  }
  if (arguments.length < 3 && !canPromise()) {
    throw new Error("Too few arguments provided");
  }
  const params = checkParams(text, opts, cb);
  const type = params.opts.type || getTypeFromFilename(path2);
  const renderer = getRendererFromType(type);
  const renderToFile = renderer.renderToFile.bind(null, path2);
  return render2(renderToFile, text, params);
};
server.toFileStream = function toFileStream(stream2, text, opts) {
  if (arguments.length < 2) {
    throw new Error("Too few arguments provided");
  }
  const params = checkParams(text, opts, stream2.emit.bind(stream2, "error"));
  const renderer = getRendererFromType("png");
  const renderToFileStream = renderer.renderToFileStream.bind(null, stream2);
  render2(renderToFileStream, text, params);
};
var lib = server;
const QRCode = /* @__PURE__ */ getDefaultExportFromCjs(lib);
function getAssetsRootDir() {
  return getAssetsDir();
}
function getAssetKindDir(kind) {
  const dir = path$1.join(getAssetsRootDir(), kind === "logo" ? "logos" : "products");
  fs$1.mkdirSync(dir, { recursive: true });
  return dir;
}
function resolveAssetAbsolutePath(relativePath) {
  const normalized = relativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid asset path");
  }
  const root = path$1.resolve(getAssetsRootDir());
  const absolute = path$1.resolve(root, normalized);
  const rootWithSep = root.endsWith(path$1.sep) ? root : root + path$1.sep;
  if (absolute !== root && !absolute.startsWith(rootWithSep)) {
    throw new Error("Invalid asset path");
  }
  return absolute;
}
function assetUrl(relativePath) {
  if (!relativePath) return null;
  const clean = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `kaarobar-asset:///${clean}`;
}
function mimeForAsset(filePath) {
  switch (path$1.extname(filePath).toLowerCase()) {
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
function serveAssetRequest(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const relative = decodeURIComponent(
      url.hostname ? `${url.hostname}${url.pathname}` : url.pathname
    ).replace(/^\/+/, "");
    const absolute = resolveAssetAbsolutePath(relative);
    if (!fs$1.existsSync(absolute)) {
      return new Response("Not found", { status: 404 });
    }
    const data = fs$1.readFileSync(absolute);
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": mimeForAsset(absolute),
        "Content-Length": String(data.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
async function pickAndSaveAsset(kind) {
  if (kind === "logo") requirePermission("business:edit");
  else requirePermission("products:edit");
  const result = await dialog.showOpenDialog({
    title: kind === "logo" ? "Choose business logo" : "Choose product image",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const source = result.filePaths[0];
  const ext = path$1.extname(source).toLowerCase() || ".png";
  const fileName = `${randomUUID()}${ext}`;
  const folder = kind === "logo" ? "logos" : "products";
  const targetDir = getAssetKindDir(kind);
  const target = path$1.join(targetDir, fileName);
  fs$1.copyFileSync(source, target);
  const relativePath = `${folder}/${fileName}`;
  return { relativePath, url: assetUrl(relativePath) };
}
const ICONS = {
  whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.99.52 3.93 1.51 5.64L2 22l4.6-1.51a9.86 9.86 0 0 0 5.44 1.52h.01c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.79 14.06c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.93-4.36-.14-.19-1.17-1.56-1.17-2.97 0-1.41.74-2.1 1-2.39.26-.29.57-.36.76-.36h.55c.18 0 .42-.07.65.5.24.58.82 2 .89 2.14.07.14.12.31.02.5-.1.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.56.16.28.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.61-.13.25.09 1.6.75 1.87.89.27.14.45.21.52.33.07.12.07.69-.17 1.37z"/></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zm5.25-3.75a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/></svg>`,
  facebook: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z"/></svg>`,
  tiktok: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M14.5 3c.4 1.7 1.5 3.2 3.1 4.1V9c-1.2-.05-2.3-.4-3.3-1v6.3A5.3 5.3 0 1 1 9 9.1v2.2a3.1 3.1 0 1 0 2.2 3V3h3.3z"/></svg>`,
  website: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="#111" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.9 9h-3.2a15 15 0 0 0-1.3-5 8.1 8.1 0 0 1 4.5 5zM12 4c.9 1.3 1.7 3.2 2.1 5H9.9C10.3 7.2 11.1 5.3 12 4zM4.1 13h3.2a15 15 0 0 0 1.3 5 8.1 8.1 0 0 1-4.5-5zm3.2-2H4.1a8.1 8.1 0 0 1 4.5-5 15 15 0 0 0-1.3 5zm2.6 0h4.2c-.4 1.9-1.2 3.8-2.1 5-.9-1.2-1.7-3.1-2.1-5zm4.2 2H9.9c.4 1.8 1.2 3.7 2.1 5 .9-1.3 1.7-3.2 2.1-5zm.7 5a15 15 0 0 0 1.3-5h3.2a8.1 8.1 0 0 1-4.5 5z"/></svg>`
};
function socialIconDataUrl(platform) {
  const svg2 = ICONS[platform];
  return `data:image/svg+xml;base64,${Buffer.from(svg2).toString("base64")}`;
}
const SOCIAL_LABELS = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  website: "Web"
};
const PRODUCT_NAME = "Kaarobar";
const DEFAULT_BRAND_HEX = "#2d6df6";
const HEX_RE = /^#([0-9a-fA-F]{6})$/;
function resolvePrintBrandHex(hex) {
  const value = (hex ?? "").trim();
  if (HEX_RE.test(value)) return value.toLowerCase();
  return DEFAULT_BRAND_HEX;
}
function kaarobarMarkDataUrl(brandHex) {
  const fill = resolvePrintBrandHex(brandHex);
  const svg2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="128" height="128" role="img" aria-label="${PRODUCT_NAME}">
  <rect width="1024" height="1024" rx="180" fill="${fill}"/>
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
  return `data:image/svg+xml;base64,${Buffer.from(svg2).toString("base64")}`;
}
function getPrintLanguage() {
  return normalizeAppLanguage(appStore.get("language"));
}
const POWERED_BY = {
  en: "Powered by Kaarobar POS · 2ndHub Solutions",
  ur: "کاروبار POS · 2ndHub Solutions سے تقویت یافتہ",
  de: "Bereitgestellt von Kaarobar POS · 2ndHub Solutions",
  pt: "Desenvolvido por Kaarobar POS · 2ndHub Solutions",
  es: "Desarrollado por Kaarobar POS · 2ndHub Solutions",
  fr: "Propulsé par Kaarobar POS · 2ndHub Solutions",
  ar: "مدعوم من Kaarobar POS · 2ndHub Solutions"
};
const SALE_LABELS = {
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
    customSoftwareSupport: "For custom software solutions, contact us at support.kaarobar@gmail.com or +93326307145",
    poweredBy: POWERED_BY.en,
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
    customSoftwareSupport: "اس طرح کے سسٹمز بنانے کے لیے رابطہ کریں: support.kaarobar@gmail.com یا +93326307145",
    poweredBy: POWERED_BY.ur,
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
    customSoftwareSupport: "Für individuelle Software kontaktieren Sie uns unter support.kaarobar@gmail.com oder +93326307145",
    poweredBy: POWERED_BY.de,
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
    customSoftwareSupport: "Para soluções de software personalizadas, entre em contato em support.kaarobar@gmail.com ou +93326307145",
    poweredBy: POWERED_BY.pt,
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
    customSoftwareSupport: "Para software a medida, contáctanos en support.kaarobar@gmail.com o +93326307145",
    poweredBy: POWERED_BY.es,
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
    customSoftwareSupport: "Pour un logiciel sur mesure, contactez-nous à support.kaarobar@gmail.com ou +93326307145",
    poweredBy: POWERED_BY.fr,
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
    customSoftwareSupport: "للحلول البرمجية حسب الطلب، تواصل معنا على support.kaarobar@gmail.com أو +93326307145",
    poweredBy: POWERED_BY.ar,
    cash: "نقد",
    card: "بطاقة / أونلاين",
    credit: "ائتمان"
  }
};
const PO_LABELS = {
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
    poweredBy: POWERED_BY.en
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
    poweredBy: POWERED_BY.ur
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
    poweredBy: POWERED_BY.de
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
    poweredBy: POWERED_BY.pt
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
    poweredBy: POWERED_BY.es
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
    poweredBy: POWERED_BY.fr
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
    poweredBy: POWERED_BY.ar
  }
};
const LEDGER_LABELS = {
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
    poweredBy: POWERED_BY.en,
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
    poweredBy: POWERED_BY.ur,
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
    poweredBy: POWERED_BY.de,
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
    poweredBy: POWERED_BY.pt,
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
    poweredBy: POWERED_BY.es,
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
    poweredBy: POWERED_BY.fr,
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
    poweredBy: POWERED_BY.ar,
    sale: "بيع",
    payment: "دفعة",
    adjustment: "تعديل",
    opening: "افتتاحي",
    cash: "نقد",
    card: "بطاقة / أونلاين"
  }
};
function getSalePrintLabels(lang = getPrintLanguage()) {
  return SALE_LABELS[lang];
}
function getPoPrintLabels(lang = getPrintLanguage()) {
  return PO_LABELS[lang];
}
function getLedgerPrintLabels(lang = getPrintLanguage()) {
  return LEDGER_LABELS[lang];
}
const PREVIEW_LABELS = {
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
function getPrintPreviewLabels(lang = getPrintLanguage()) {
  return PREVIEW_LABELS[lang];
}
function printDocumentChrome(lang = getPrintLanguage()) {
  const rtl = isRtlLanguage(lang);
  return {
    lang,
    dir: rtl ? "rtl" : "ltr",
    fontFamily: rtl ? `'Noto Sans Arabic', 'Noto Naskh Arabic', ui-sans-serif, sans-serif` : `'Poppins', ui-sans-serif, sans-serif`,
    fontLink: rtl ? "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap" : "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
  };
}
function formatPrintDate(iso, lang = getPrintLanguage()) {
  try {
    return new Date(iso).toLocaleString(toBcp47(lang));
  } catch {
    return iso;
  }
}
const CURRENCY_PREFIX = {
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
function currencyPrefix(currency) {
  const code = (currency || "PKR").trim().toUpperCase();
  return CURRENCY_PREFIX[code] ?? code;
}
function escapeHtml$3(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function divider() {
  return `<div class="stars">********************************</div>`;
}
function fileToDataUrl$2(absolute) {
  try {
    const buf = fs$1.readFileSync(absolute);
    const ext = path$1.extname(absolute).toLowerCase().replace(".", "") || "png";
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : ext === "svg" ? "image/svg+xml" : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
async function socialBlock(input, followUsLabel) {
  const links = [
    { platform: "whatsapp", url: input.socialWhatsapp || "" },
    { platform: "instagram", url: input.socialInstagram || "" },
    { platform: "facebook", url: input.socialFacebook || "" },
    { platform: "tiktok", url: input.socialTiktok || "" },
    { platform: "website", url: input.socialWebsite || "" }
  ].filter((l) => l.url.trim());
  if (links.length === 0) return "";
  const cells = [];
  for (const link of links) {
    const qr = await QRCode.toDataURL(link.url.trim(), {
      margin: 1,
      width: 72,
      color: { dark: "#000000", light: "#ffffff" }
    });
    cells.push(`
      <div class="social-item">
        <img class="social-icon" src="${socialIconDataUrl(link.platform)}" alt="" />
        <img class="social-qr" src="${qr}" alt="${SOCIAL_LABELS[link.platform]}" />
        <div class="social-label">${SOCIAL_LABELS[link.platform]}</div>
      </div>
    `);
  }
  return `
    ${divider()}
    <div class="social-title">${escapeHtml$3(followUsLabel)}</div>
    <div class="social-row">${cells.join("")}</div>
  `;
}
async function buildSaleReceiptHtml(input) {
  var _a, _b;
  const lang = input.language ?? getPrintLanguage();
  const labels = getSalePrintLabels(lang);
  const chrome = printDocumentChrome(lang);
  const currency = currencyPrefix(input.currency);
  const hasCredit = input.payments.some((p) => p.method === "credit");
  const hasCash = input.payments.some((p) => p.method === "cash");
  const hasCard = input.payments.some((p) => p.method === "card");
  const title = hasCredit && !hasCash ? labels.creditReceipt : hasCard && !hasCash && !hasCredit ? labels.cardReceipt : labels.cashReceipt;
  const paymentMethodLabel = (method) => {
    if (method === "card") return labels.card;
    if (method === "cash") return labels.cash;
    if (method === "credit") return labels.credit;
    return method;
  };
  let logoHtml = "";
  if (input.logoPath) {
    try {
      const dataUrl = fileToDataUrl$2(resolveAssetAbsolutePath(input.logoPath));
      if (dataUrl) {
        logoHtml = `<img class="logo" src="${dataUrl}" alt="" />`;
      }
    } catch {
      logoHtml = "";
    }
  }
  const contactBits = [
    input.branchAddress ? escapeHtml$3(input.branchAddress) : "",
    input.branchPhone ? `${escapeHtml$3(labels.tel)}: ${escapeHtml$3(input.branchPhone)}` : ""
  ].filter(Boolean);
  const itemRows = input.items.map(
    (item) => `
      <tr>
        <td class="desc">${escapeHtml$3(item.productName)} × ${item.qty}</td>
        <td class="price">${currency} ${item.lineTotal.toFixed(2)}</td>
      </tr>`
  ).join("");
  const paymentRows = input.payments.map(
    (p) => `<div class="row"><span>${escapeHtml$3(paymentMethodLabel(p.method))}</span><span>${currency} ${p.amount.toFixed(2)}</span></div>`
  ).join("");
  const change = Math.max(0, input.amountPaid - input.total);
  const socialHtml = await socialBlock(input, labels.followUs);
  const brandHex = resolvePrintBrandHex(input.brandColor);
  const brandMark = kaarobarMarkDataUrl(brandHex);
  const invoiceJs = JSON.stringify(input.invoiceNo);
  const jsBarcodeSrc = input.jsBarcodeScript;
  const dateLabel = formatPrintDate(input.createdAt, lang);
  return `<!DOCTYPE html>
<html lang="${chrome.lang}" dir="${chrome.dir}">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${chrome.fontLink}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: ${chrome.fontFamily};
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
    .brand-name { font-size: 11px; font-weight: 700; color: ${brandHex}; }
    .brand-tag { font-size: 9px; color: #555; }
    .support-line { font-size: 9px; color: #444; margin-top: 6px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      ${logoHtml}
      <p class="shop">${escapeHtml$3(input.businessName)}</p>
      ${contactBits.map((line) => `<p class="muted">${line}</p>`).join("")}
      ${((_a = input.receiptHeader) == null ? void 0 : _a.trim()) ? `<p class="muted" style="margin-top:6px;white-space:pre-wrap">${escapeHtml$3(input.receiptHeader.trim())}</p>` : ""}
    </div>
    ${divider()}
    <div class="center title">${escapeHtml$3(title)}</div>
    ${divider()}
    <div class="row"><span>${escapeHtml$3(labels.invoice)}</span><span>${escapeHtml$3(input.invoiceNo)}</span></div>
    <div class="row"><span>${escapeHtml$3(labels.date)}</span><span>${escapeHtml$3(dateLabel)}</span></div>
    ${input.customerName ? `<div class="row"><span>${escapeHtml$3(labels.customer)}</span><span>${escapeHtml$3(input.customerName)}</span></div>` : ""}
    ${input.cashierName ? `<div class="row"><span>${escapeHtml$3(labels.cashier)}</span><span>${escapeHtml$3(input.cashierName)}</span></div>` : ""}
    ${input.printedByName ? `<div class="row"><span>${escapeHtml$3(labels.printedBy)}</span><span>${escapeHtml$3(input.printedByName)}</span></div>` : ""}
    ${divider()}
    <table>
      <thead>
        <tr>
          <th class="desc">${escapeHtml$3(labels.description)}</th>
          <th class="price">${escapeHtml$3(labels.price)}</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    ${divider()}
    ${input.discount > 0 ? `<div class="row"><span>${escapeHtml$3(labels.subtotal)}</span><span>${currency} ${input.subtotal.toFixed(2)}</span></div>
    <div class="row"><span>${escapeHtml$3(labels.discount)}</span><span>- ${currency} ${input.discount.toFixed(2)}</span></div>` : ""}
    <div class="row total"><span>${escapeHtml$3(labels.total)}</span><span>${currency} ${input.total.toFixed(2)}</span></div>
    ${paymentRows}
    ${change > 0 ? `<div class="row"><span>${escapeHtml$3(labels.change)}</span><span>${currency} ${change.toFixed(2)}</span></div>` : ""}
    ${socialHtml}
    ${divider()}
    <div class="center thanks" style="white-space:pre-wrap">${escapeHtml$3(
    ((_b = input.receiptFooter) == null ? void 0 : _b.trim()) || labels.thankYou
  )}</div>
    <div class="center support-line">${escapeHtml$3(labels.customSoftwareSupport)}</div>
    <svg id="barcode"></svg>
    <div class="center brand">
      <img src="${brandMark}" alt="Kaarobar" />
      <div class="brand-name">Kaarobar</div>
      <div class="brand-tag">${escapeHtml$3(labels.poweredBy)}</div>
    </div>
  </div>
  <script>${jsBarcodeSrc}<\/script>
  <script>
    try {
      JsBarcode("#barcode", ${invoiceJs}, {
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
function escapeHtml$2(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fileToDataUrl$1(absolute) {
  try {
    const buf = fs$1.readFileSync(absolute);
    const ext = path$1.extname(absolute).toLowerCase().replace(".", "") || "png";
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "svg" ? "image/svg+xml" : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
function buildPurchaseOrderHtml(input) {
  const lang = input.language ?? getPrintLanguage();
  const labels = getPoPrintLabels(lang);
  const chrome = printDocumentChrome(lang);
  const currency = currencyPrefix(input.currency);
  const brandHex = resolvePrintBrandHex(input.brandColor);
  let logoHtml = "";
  if (input.logoPath) {
    try {
      const dataUrl = fileToDataUrl$1(resolveAssetAbsolutePath(input.logoPath));
      if (dataUrl) logoHtml = `<img class="logo" src="${dataUrl}" alt="" />`;
    } catch {
      logoHtml = "";
    }
  }
  const itemRows = input.items.map(
    (item) => `
      <tr>
        <td>${escapeHtml$2(item.productName)}</td>
        <td class="num">${item.orderedQty}</td>
        <td class="num">${currency} ${item.unitCost.toFixed(2)}</td>
        <td class="num">${currency} ${item.lineTotal.toFixed(2)}</td>
      </tr>`
  ).join("");
  const brandMark = kaarobarMarkDataUrl(brandHex);
  return `<!DOCTYPE html>
<html lang="${chrome.lang}" dir="${chrome.dir}">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${chrome.fontLink}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: ${chrome.fontFamily};
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
    .brand-name { font-size: 11px; font-weight: 700; color: ${brandHex}; }
    .brand-tag { font-size: 9px; color: #555; }
  </style>
</head>
<body>
  <div class="center">
    ${logoHtml}
    <h1>${escapeHtml$2(input.businessName)}</h1>
    <p class="muted">${escapeHtml$2(input.branchName)}</p>
  </div>
  <h2 class="center">${escapeHtml$2(labels.purchaseOrder)}</h2>
  <div class="meta">
    <div><span>${escapeHtml$2(labels.poNumber)}</span><span>${escapeHtml$2(input.poNumber)}</span></div>
    <div><span>${escapeHtml$2(labels.date)}</span><span>${escapeHtml$2(input.orderDate)}</span></div>
    <div><span>${escapeHtml$2(labels.status)}</span><span>${escapeHtml$2(input.status)}</span></div>
  </div>
  <div class="meta">
    <div><span>${escapeHtml$2(labels.supplier)}</span><span>${escapeHtml$2(input.supplierName)}</span></div>
    ${input.supplierPhone ? `<div><span>${escapeHtml$2(labels.phone)}</span><span>${escapeHtml$2(input.supplierPhone)}</span></div>` : ""}
    ${input.supplierAddress ? `<div><span>${escapeHtml$2(labels.address)}</span><span>${escapeHtml$2(input.supplierAddress)}</span></div>` : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml$2(labels.product)}</th>
        <th class="num">${escapeHtml$2(labels.qty)}</th>
        <th class="num">${escapeHtml$2(labels.unitCost)}</th>
        <th class="num">${escapeHtml$2(labels.total)}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="total"><span>${escapeHtml$2(labels.total)}</span><span>${currency} ${input.total.toFixed(2)}</span></div>
  <div class="brand">
    <img src="${brandMark}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
    <div class="brand-tag">${escapeHtml$2(labels.poweredBy)}</div>
  </div>
</body>
</html>`;
}
function escapeHtml$1(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fileToDataUrl(absolute) {
  try {
    const buf = fs$1.readFileSync(absolute);
    const ext = path$1.extname(absolute).toLowerCase().replace(".", "") || "png";
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "svg" ? "image/svg+xml" : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
function money(currency, amount) {
  return `${currency} ${amount.toFixed(2)}`;
}
function noteText(note) {
  var _a;
  if (!note) return "";
  const match = note.match(/^method:(cash|card)(?:\s*\|\s*(.*))?$/i);
  if (match) return ((_a = match[2]) == null ? void 0 : _a.trim()) || "";
  return note.trim();
}
function particulars(entry, labels) {
  const typeLabel = entry.type === "sale" ? labels.sale : entry.type === "payment" ? labels.payment : entry.type === "adjustment" ? labels.adjustment : labels.opening;
  const parts = [typeLabel];
  if (entry.invoiceNo) parts.push(entry.invoiceNo);
  if (entry.method === "cash") parts.push(labels.cash);
  if (entry.method === "card") parts.push(labels.card);
  const note = noteText(entry.note);
  if (note) parts.push(note);
  return parts.join(" · ");
}
function buildCustomerLedgerHtml(input) {
  const lang = input.language ?? getPrintLanguage();
  const labels = getLedgerPrintLabels(lang);
  const chrome = printDocumentChrome(lang);
  const currency = currencyPrefix(input.currency);
  const brandHex = resolvePrintBrandHex(input.brandColor);
  let logoHtml = "";
  if (input.logoPath) {
    try {
      const dataUrl = fileToDataUrl(resolveAssetAbsolutePath(input.logoPath));
      if (dataUrl) logoHtml = `<img class="logo" src="${dataUrl}" alt="" />`;
    } catch {
      logoHtml = "";
    }
  }
  const periodLabel = input.from || input.to ? `${input.from || "…"} → ${input.to || "…"}` : labels.allEntries;
  let debitTotal = 0;
  let creditTotal = 0;
  const rows = input.entries.map((entry) => {
    const debit = entry.amount > 0 ? entry.amount : 0;
    const credit = entry.amount < 0 ? Math.abs(entry.amount) : 0;
    debitTotal += debit;
    creditTotal += credit;
    return `
      <tr>
        <td>${escapeHtml$1(formatPrintDate(entry.createdAt, lang))}</td>
        <td>${escapeHtml$1(particulars(entry, labels))}</td>
        <td class="num">${debit ? escapeHtml$1(money(currency, debit)) : ""}</td>
        <td class="num">${credit ? escapeHtml$1(money(currency, credit)) : ""}</td>
        <td class="num">${escapeHtml$1(money(currency, entry.balanceAfter))}</td>
      </tr>`;
  }).join("");
  const closingBalance = input.entries.length > 0 ? input.entries[input.entries.length - 1].balanceAfter : input.openingBalance;
  const brandMark = kaarobarMarkDataUrl(brandHex);
  const showOpening = Boolean(input.from || input.to) || input.openingBalance !== 0;
  return `<!DOCTYPE html>
<html lang="${chrome.lang}" dir="${chrome.dir}">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${chrome.fontLink}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: ${chrome.fontFamily};
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
    .brand-name { font-size: 11px; font-weight: 700; color: ${brandHex}; }
    .brand-tag { font-size: 9px; color: #555; }
  </style>
</head>
<body>
  <div class="center">
    ${logoHtml}
    <h1>${escapeHtml$1(input.businessName)}</h1>
  </div>
  <h2 class="center">${escapeHtml$1(labels.title)}</h2>
  <div class="meta">
    <div><span>${escapeHtml$1(labels.customer)}</span><span>${escapeHtml$1(input.customerName)}</span></div>
    ${input.customerPhone ? `<div><span>${escapeHtml$1(labels.phone)}</span><span>${escapeHtml$1(input.customerPhone)}</span></div>` : ""}
    <div><span>${escapeHtml$1(labels.period)}</span><span>${escapeHtml$1(periodLabel)}</span></div>
    <div><span>${escapeHtml$1(labels.printedAt)}</span><span>${escapeHtml$1(formatPrintDate((/* @__PURE__ */ new Date()).toISOString(), lang))}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml$1(labels.date)}</th>
        <th>${escapeHtml$1(labels.particulars)}</th>
        <th class="num">${escapeHtml$1(labels.debit)}</th>
        <th class="num">${escapeHtml$1(labels.credit)}</th>
        <th class="num">${escapeHtml$1(labels.balance)}</th>
      </tr>
    </thead>
    <tbody>
      ${showOpening ? `<tr class="opening">
        <td></td>
        <td>${escapeHtml$1(labels.balanceBroughtForward)}</td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num">${escapeHtml$1(money(currency, input.openingBalance))}</td>
      </tr>` : ""}
      ${rows}
      <tr class="totals">
        <td colspan="2">${escapeHtml$1(labels.totals)}</td>
        <td class="num">${escapeHtml$1(money(currency, debitTotal))}</td>
        <td class="num">${escapeHtml$1(money(currency, creditTotal))}</td>
        <td class="num"></td>
      </tr>
    </tbody>
  </table>
  <div class="closing">
    <span>${escapeHtml$1(labels.closingBalance)}</span>
    <span>${escapeHtml$1(money(currency, closingBalance))}</span>
  </div>
  <div class="brand">
    <img src="${brandMark}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
    <div class="brand-tag">${escapeHtml$1(labels.poweredBy)}</div>
  </div>
</body>
</html>`;
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function writePreviewHtmlFile(prefix, html) {
  const previewDir = path$1.join(getKaarobarDataDir(), "preview");
  fs$1.mkdirSync(previewDir, { recursive: true });
  const filePath = path$1.join(previewDir, `${prefix}-${Date.now()}.html`);
  fs$1.writeFileSync(filePath, html, "utf8");
  return filePath;
}
function injectPrintPreviewChrome(documentHtml) {
  const labels = getPrintPreviewLabels(getPrintLanguage());
  const chrome = `
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
<div id="kaarobar-print-toolbar" role="toolbar" aria-label="${escapeHtml(labels.previewHint)}">
  <div class="hint">${escapeHtml(labels.previewHint)}</div>
  <div class="actions">
    <button type="button" class="close" onclick="window.close()">${escapeHtml(labels.close)}</button>
    <button type="button" class="print" onclick="window.print()">${escapeHtml(labels.print)}</button>
  </div>
</div>`;
  if (/<\/body>/i.test(documentHtml)) {
    return documentHtml.replace(/<\/body>/i, `${chrome}</body>`);
  }
  return `${documentHtml}${chrome}`;
}
function openPrintPreview(options) {
  const previewHtml = injectPrintPreviewChrome(options.html);
  const previewFilePath = writePreviewHtmlFile(options.filePrefix, previewHtml);
  const printWindow = new BrowserWindow({
    show: true,
    width: options.width ?? 720,
    height: options.height ?? 900,
    autoHideMenuBar: true,
    title: options.title ?? "Preview",
    webPreferences: { sandbox: true, contextIsolation: true }
  });
  void printWindow.loadFile(previewFilePath);
  return { ok: true };
}
const require$1 = createRequire(import.meta.url);
function db() {
  openDatabase();
  runMigrations(getDb());
  return getDb();
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function writeActivity(input) {
  db().prepare(
    `INSERT INTO activity_log (id, business_id, actor_user_id, entity_type, entity_id, action, summary, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    v4(),
    input.businessId,
    input.actorUserId,
    input.entityType,
    input.entityId,
    input.action,
    input.summary,
    input.payload ? JSON.stringify(input.payload) : null,
    nowIso()
  );
}
function assertProductPrices(price, costPrice) {
  if (!Number.isFinite(price) || price < 0) throw new Error("Sale price must be >= 0");
  if (costPrice != null && (!Number.isFinite(costPrice) || costPrice < 0)) {
    throw new Error("Cost price must be >= 0");
  }
  if (costPrice != null && price < costPrice) {
    throw new Error("Sale price must be greater than or equal to cost price");
  }
}
function mapProductRow(row) {
  var _a;
  const kind = row.kind || "item";
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    name: row.name,
    barcode: row.barcode,
    price: row.price,
    costPrice: row.cost_price,
    stockQty: row.stock_qty,
    kind,
    tracksStock: row.tracks_stock == null ? defaultTracksStock(kind) : Boolean(row.tracks_stock),
    kitchenStation: ((_a = row.kitchen_station) == null ? void 0 : _a.trim()) || "main",
    imagePath: row.image_path,
    isActive: Boolean(row.is_active)
  };
}
function getBusinessNature(businessId) {
  const row = db().prepare("SELECT business_nature FROM businesses WHERE id = ?").get(businessId);
  return normalizeBusinessNature(row == null ? void 0 : row.business_nature);
}
function mapSupplierProductRow(row) {
  return {
    linkId: row.link_id,
    supplierId: row.supplier_id,
    productId: row.product_id,
    unitCost: row.unit_cost,
    product: mapProductRow(row)
  };
}
function mapActivity(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    summary: row.summary,
    payloadJson: row.payload_json,
    createdAt: row.created_at
  };
}
function listActivity(entityType, entityId) {
  requireSession();
  const rows = db().prepare(
    `SELECT a.id, a.business_id, a.actor_user_id, u.name as actor_name, a.entity_type, a.entity_id,
              a.action, a.summary, a.payload_json, a.created_at
       FROM activity_log a
       JOIN users u ON u.id = a.actor_user_id
       WHERE a.entity_type = ? AND a.entity_id = ?
       ORDER BY a.created_at DESC`
  ).all(entityType, entityId);
  return rows.map(mapActivity);
}
function listBusinesses() {
  const session = requireSession();
  const rows = session.role === "owner" ? db().prepare(
    `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
                  social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
                  receipt_header, receipt_footer
           FROM businesses ORDER BY created_at DESC`
  ).all() : db().prepare(
    `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
                  social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
                  receipt_header, receipt_footer
           FROM businesses WHERE id = ?`
  ).all(session.businessId);
  return rows.map(mapBusinessRow);
}
function mapBusinessRow(row) {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    brandColor: row.brand_color,
    businessNature: normalizeBusinessNature(row.business_nature),
    logoPath: row.logo_path,
    socialWhatsapp: row.social_whatsapp,
    socialInstagram: row.social_instagram,
    socialFacebook: row.social_facebook,
    socialTiktok: row.social_tiktok,
    socialWebsite: row.social_website,
    receiptHeader: row.receipt_header ?? null,
    receiptFooter: row.receipt_footer ?? null,
    isActive: Boolean(row.is_active)
  };
}
function normalizeSocial(value) {
  const trimmed = (value == null ? void 0 : value.trim()) || "";
  return trimmed || null;
}
function createBusiness(payload) {
  var _a;
  const session = requirePermission("business:edit");
  const existing = db().prepare("SELECT id FROM businesses LIMIT 1").get();
  if (existing) {
    throw new Error("This installation already has a business. Only one business is supported.");
  }
  const id = v4();
  const at = nowIso();
  const logoPath = ((_a = payload.logoPath) == null ? void 0 : _a.trim()) || null;
  const businessNature = normalizeBusinessNature(payload.businessNature);
  const socials = {
    socialWhatsapp: normalizeSocial(payload.socialWhatsapp),
    socialInstagram: normalizeSocial(payload.socialInstagram),
    socialFacebook: normalizeSocial(payload.socialFacebook),
    socialTiktok: normalizeSocial(payload.socialTiktok),
    socialWebsite: normalizeSocial(payload.socialWebsite)
  };
  const receiptHeader = normalizeSocial(payload.receiptHeader);
  const receiptFooter = normalizeSocial(payload.receiptFooter) ?? "Thank you for shopping with us";
  db().prepare(
    `INSERT INTO businesses (
         id, owner_id, name, currency, brand_color, business_nature, logo_path,
         social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
         receipt_header, receipt_footer,
         is_active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    id,
    session.id,
    payload.name.trim(),
    payload.currency.trim() || "PKR",
    payload.brandColor,
    businessNature,
    logoPath,
    socials.socialWhatsapp,
    socials.socialInstagram,
    socials.socialFacebook,
    socials.socialTiktok,
    socials.socialWebsite,
    receiptHeader,
    receiptFooter,
    at,
    at
  );
  writeActivity({
    businessId: id,
    actorUserId: session.id,
    entityType: "business",
    entityId: id,
    action: "created",
    summary: `Created business ${payload.name.trim()}`
  });
  return {
    id,
    name: payload.name.trim(),
    currency: payload.currency.trim() || "PKR",
    brandColor: payload.brandColor,
    businessNature,
    logoPath,
    ...socials,
    receiptHeader,
    receiptFooter,
    isActive: true
  };
}
function updateBusiness(payload) {
  var _a;
  const session = requirePermission("business:edit");
  assertBusinessAccess(payload.id);
  const logoPath = payload.logoPath === void 0 ? void 0 : ((_a = payload.logoPath) == null ? void 0 : _a.trim()) || null;
  const businessNature = payload.businessNature === void 0 ? void 0 : normalizeBusinessNature(payload.businessNature);
  const socials = {
    socialWhatsapp: normalizeSocial(payload.socialWhatsapp),
    socialInstagram: normalizeSocial(payload.socialInstagram),
    socialFacebook: normalizeSocial(payload.socialFacebook),
    socialTiktok: normalizeSocial(payload.socialTiktok),
    socialWebsite: normalizeSocial(payload.socialWebsite)
  };
  if (logoPath === void 0) {
    if (businessNature === void 0) {
      db().prepare(
        `UPDATE businesses SET name = ?, currency = ?, brand_color = ?,
           social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
           WHERE id = ?`
      ).run(
        payload.name.trim(),
        payload.currency.trim() || "PKR",
        payload.brandColor,
        socials.socialWhatsapp,
        socials.socialInstagram,
        socials.socialFacebook,
        socials.socialTiktok,
        socials.socialWebsite,
        payload.id
      );
    } else {
      db().prepare(
        `UPDATE businesses SET name = ?, currency = ?, brand_color = ?, business_nature = ?,
           social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
           WHERE id = ?`
      ).run(
        payload.name.trim(),
        payload.currency.trim() || "PKR",
        payload.brandColor,
        businessNature,
        socials.socialWhatsapp,
        socials.socialInstagram,
        socials.socialFacebook,
        socials.socialTiktok,
        socials.socialWebsite,
        payload.id
      );
    }
  } else if (businessNature === void 0) {
    db().prepare(
      `UPDATE businesses SET name = ?, currency = ?, brand_color = ?, logo_path = ?,
         social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
         WHERE id = ?`
    ).run(
      payload.name.trim(),
      payload.currency.trim() || "PKR",
      payload.brandColor,
      logoPath,
      socials.socialWhatsapp,
      socials.socialInstagram,
      socials.socialFacebook,
      socials.socialTiktok,
      socials.socialWebsite,
      payload.id
    );
  } else {
    db().prepare(
      `UPDATE businesses SET name = ?, currency = ?, brand_color = ?, business_nature = ?, logo_path = ?,
         social_whatsapp = ?, social_instagram = ?, social_facebook = ?, social_tiktok = ?, social_website = ?
         WHERE id = ?`
    ).run(
      payload.name.trim(),
      payload.currency.trim() || "PKR",
      payload.brandColor,
      businessNature,
      logoPath,
      socials.socialWhatsapp,
      socials.socialInstagram,
      socials.socialFacebook,
      socials.socialTiktok,
      socials.socialWebsite,
      payload.id
    );
  }
  if (payload.receiptHeader !== void 0 || payload.receiptFooter !== void 0) {
    const current = db().prepare(`SELECT receipt_header, receipt_footer FROM businesses WHERE id = ?`).get(payload.id);
    db().prepare(`UPDATE businesses SET receipt_header = ?, receipt_footer = ? WHERE id = ?`).run(
      payload.receiptHeader !== void 0 ? normalizeSocial(payload.receiptHeader) : current.receipt_header,
      payload.receiptFooter !== void 0 ? normalizeSocial(payload.receiptFooter) : current.receipt_footer,
      payload.id
    );
  }
  const row = db().prepare(
    `SELECT id, name, currency, brand_color, business_nature, logo_path, is_active,
              social_whatsapp, social_instagram, social_facebook, social_tiktok, social_website,
              receipt_header, receipt_footer
       FROM businesses WHERE id = ?`
  ).get(payload.id);
  writeActivity({
    businessId: payload.id,
    actorUserId: session.id,
    entityType: "business",
    entityId: payload.id,
    action: "updated",
    summary: `Updated business ${payload.name.trim()}`
  });
  return mapBusinessRow(row);
}
function setActiveBusiness(businessId) {
  assertBusinessAccess(businessId);
  appStore.set("lastBusinessId", businessId);
  return { ok: true };
}
function listBranches(businessId) {
  assertBusinessAccess(businessId);
  const rows = db().prepare(
    "SELECT id, business_id, name, address, phone, is_main_branch, is_active FROM branches WHERE business_id = ? ORDER BY created_at DESC"
  ).all(businessId);
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    isMainBranch: Boolean(row.is_main_branch),
    isActive: Boolean(row.is_active)
  }));
}
function createBranch(payload) {
  var _a, _b, _c, _d;
  requirePermission("branch:edit");
  assertBusinessAccess(payload.businessId);
  const existing = db().prepare("SELECT id FROM branches WHERE business_id = ? LIMIT 1").get(payload.businessId);
  if (existing) {
    throw new Error("This business already has a branch. Only one branch is supported.");
  }
  const session = requireSession();
  const id = v4();
  db().prepare(
    `INSERT INTO branches (id, business_id, name, address, phone, is_main_branch, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, ?)`
  ).run(id, payload.businessId, payload.name.trim(), ((_a = payload.address) == null ? void 0 : _a.trim()) || null, ((_b = payload.phone) == null ? void 0 : _b.trim()) || null, nowIso());
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: "branch",
    entityId: id,
    action: "created",
    summary: `Created branch ${payload.name.trim()}`
  });
  return {
    id,
    businessId: payload.businessId,
    name: payload.name.trim(),
    address: ((_c = payload.address) == null ? void 0 : _c.trim()) || null,
    phone: ((_d = payload.phone) == null ? void 0 : _d.trim()) || null,
    isMainBranch: true,
    isActive: true
  };
}
function updateBranch(payload) {
  var _a, _b, _c, _d;
  const session = requirePermission("branch:edit");
  const existing = db().prepare("SELECT business_id, is_main_branch, is_active FROM branches WHERE id = ?").get(payload.id);
  if (!existing) throw new Error("Branch not found");
  assertBusinessAccess(existing.business_id);
  const isActive = payload.isActive === void 0 ? existing.is_active : payload.isActive ? 1 : 0;
  db().prepare("UPDATE branches SET name = ?, address = ?, phone = ?, is_active = ? WHERE id = ?").run(
    payload.name.trim(),
    ((_a = payload.address) == null ? void 0 : _a.trim()) || null,
    ((_b = payload.phone) == null ? void 0 : _b.trim()) || null,
    isActive,
    payload.id
  );
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: "branch",
    entityId: payload.id,
    action: "updated",
    summary: `Updated branch ${payload.name.trim()}`
  });
  return {
    id: payload.id,
    businessId: existing.business_id,
    name: payload.name.trim(),
    address: ((_c = payload.address) == null ? void 0 : _c.trim()) || null,
    phone: ((_d = payload.phone) == null ? void 0 : _d.trim()) || null,
    isMainBranch: Boolean(existing.is_main_branch),
    isActive: Boolean(isActive)
  };
}
function listUsers(businessId) {
  requireSession();
  assertBusinessAccess(businessId);
  const rows = db().prepare(
    `SELECT id, name, email, role, business_id, branch_id, is_active FROM users
       WHERE business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?)
       ORDER BY created_at DESC`
  ).all(businessId, businessId);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    businessId: row.business_id,
    branchId: row.branch_id,
    isActive: Boolean(row.is_active)
  }));
}
function createUser(payload) {
  const session = requirePermission("users:manage");
  assertBusinessAccess(payload.businessId);
  if (session.role !== "owner" && payload.role === "admin") throw new Error("Only owner can create admins");
  if (payload.branchId) assertBranchAccess(payload.branchId);
  const id = v4();
  const hash = bcrypt.hashSync(payload.password, 12);
  db().prepare(
    `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, payload.businessId, payload.branchId, payload.name.trim(), payload.email.trim().toLowerCase(), hash, payload.role, nowIso());
  return {
    id,
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    role: payload.role,
    businessId: payload.businessId,
    branchId: payload.branchId,
    isActive: true
  };
}
function setUserActive(payload) {
  requirePermission("users:manage");
  const row = db().prepare("SELECT business_id FROM users WHERE id = ?").get(payload.userId);
  if (!row) throw new Error("User not found");
  assertBusinessAccess(row.business_id);
  db().prepare("UPDATE users SET is_active = ? WHERE id = ?").run(payload.isActive ? 1 : 0, payload.userId);
  return { ok: true };
}
function updateSelfUserProfile(payload) {
  var _a, _b, _c, _d;
  const session = requireSession();
  const existing = db().prepare("SELECT id, name, email, role, business_id, branch_id, password_hash, image_path FROM users WHERE id = ?").get(session.id);
  if (!existing) throw new Error("User not found");
  const nextName = ((_a = payload.name) == null ? void 0 : _a.trim()) || existing.name;
  if (!nextName) throw new Error("Name is required");
  const nextImagePath = payload.imagePath === void 0 ? existing.image_path : ((_b = payload.imagePath) == null ? void 0 : _b.trim()) || null;
  let nextPasswordHash = existing.password_hash;
  const newPassword = ((_c = payload.newPassword) == null ? void 0 : _c.trim()) || "";
  const wantsPasswordChange = Boolean(newPassword);
  if (wantsPasswordChange) {
    if (session.role !== "owner") throw new Error("Only owner can change password from settings");
    if (!((_d = payload.currentPassword) == null ? void 0 : _d.trim())) throw new Error("Current password is required");
    if (!bcrypt.compareSync(payload.currentPassword, existing.password_hash)) {
      throw new Error("Current password is incorrect");
    }
    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    nextPasswordHash = bcrypt.hashSync(newPassword, 12);
  }
  db().prepare("UPDATE users SET name = ?, image_path = ?, password_hash = ? WHERE id = ?").run(nextName, nextImagePath, nextPasswordHash, session.id);
  session.name = nextName;
  session.imagePath = nextImagePath;
  return {
    id: existing.id,
    name: nextName,
    email: existing.email,
    role: existing.role,
    businessId: existing.business_id,
    branchId: existing.branch_id,
    imagePath: nextImagePath
  };
}
function listProducts(businessId) {
  requireValidLicense();
  assertBusinessAccess(businessId);
  const rows = db().prepare(
    `SELECT id, business_id, branch_id, name, barcode, price, cost_price, stock_qty, kind, tracks_stock,
              kitchen_station, image_path, is_active
       FROM products WHERE business_id = ? ORDER BY created_at DESC`
  ).all(businessId);
  return rows.map(mapProductRow);
}
function createProduct(payload) {
  var _a, _b, _c;
  requireValidLicense();
  requirePermission("products:edit");
  assertBusinessAccess(payload.businessId);
  if (payload.branchId) assertBranchAccess(payload.branchId);
  assertProductPrices(payload.price, payload.costPrice ?? null);
  const nature = getBusinessNature(payload.businessId);
  const kind = payload.kind ?? "item";
  if (!isValidProductKind(nature, kind)) {
    throw new Error(`Product kind "${kind}" is not allowed for this business type`);
  }
  const tracksStock = payload.tracksStock === void 0 ? defaultTracksStock(kind) : Boolean(payload.tracksStock);
  if (tracksStock && kind !== "item") {
    throw new Error("Only item products can track stock");
  }
  const session = requireSession();
  const id = v4();
  const at = nowIso();
  const imagePath = ((_a = payload.imagePath) == null ? void 0 : _a.trim()) || null;
  const stockQty = tracksStock ? payload.stockQty ?? 0 : 0;
  db().prepare(
    `INSERT INTO products (id, business_id, branch_id, category_id, name, sku, barcode, price, cost_price, stock_qty, kind, tracks_stock, unit, image_path, is_active, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, 'pcs', ?, ?, ?, ?)`
  ).run(
    id,
    payload.businessId,
    payload.branchId,
    payload.name.trim(),
    ((_b = payload.barcode) == null ? void 0 : _b.trim()) || null,
    payload.price,
    payload.costPrice ?? null,
    stockQty,
    kind,
    tracksStock ? 1 : 0,
    imagePath,
    payload.isActive === false ? 0 : 1,
    at,
    at
  );
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: "product",
    entityId: id,
    action: "created",
    summary: `Created product ${payload.name.trim()}`
  });
  return {
    id,
    businessId: payload.businessId,
    branchId: payload.branchId,
    name: payload.name.trim(),
    barcode: ((_c = payload.barcode) == null ? void 0 : _c.trim()) || null,
    price: payload.price,
    costPrice: payload.costPrice ?? null,
    stockQty,
    kind,
    tracksStock,
    kitchenStation: "main",
    imagePath,
    isActive: payload.isActive !== false
  };
}
function updateProduct(payload) {
  var _a, _b, _c;
  requireValidLicense();
  const session = requirePermission("products:edit");
  const existing = db().prepare(
    "SELECT business_id, branch_id, stock_qty, kind, tracks_stock, image_path FROM products WHERE id = ?"
  ).get(payload.id);
  if (!existing) throw new Error("Product not found");
  assertBusinessAccess(existing.business_id);
  assertProductPrices(payload.price, payload.costPrice ?? null);
  const nature = getBusinessNature(existing.business_id);
  const kind = payload.kind ?? (existing.kind || "item");
  if (!isValidProductKind(nature, kind)) {
    throw new Error(`Product kind "${kind}" is not allowed for this business type`);
  }
  const tracksStock = payload.tracksStock === void 0 ? Boolean(existing.tracks_stock) : Boolean(payload.tracksStock);
  if (tracksStock && kind !== "item") {
    throw new Error("Only item products can track stock");
  }
  const isActive = payload.isActive === false ? 0 : 1;
  const imagePath = payload.imagePath === void 0 ? existing.image_path : ((_a = payload.imagePath) == null ? void 0 : _a.trim()) || null;
  const stockQty = tracksStock ? payload.stockQty ?? existing.stock_qty : 0;
  db().prepare(
    `UPDATE products SET name = ?, barcode = ?, price = ?, cost_price = ?, stock_qty = ?, kind = ?, tracks_stock = ?, image_path = ?, is_active = ?
       WHERE id = ?`
  ).run(
    payload.name.trim(),
    ((_b = payload.barcode) == null ? void 0 : _b.trim()) || null,
    payload.price,
    payload.costPrice ?? null,
    stockQty,
    kind,
    tracksStock ? 1 : 0,
    imagePath,
    isActive,
    payload.id
  );
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: "product",
    entityId: payload.id,
    action: "updated",
    summary: `Updated product ${payload.name.trim()}`
  });
  return {
    id: payload.id,
    businessId: existing.business_id,
    branchId: existing.branch_id,
    name: payload.name.trim(),
    barcode: ((_c = payload.barcode) == null ? void 0 : _c.trim()) || null,
    price: payload.price,
    costPrice: payload.costPrice ?? null,
    stockQty,
    kind,
    tracksStock,
    kitchenStation: "main",
    imagePath,
    isActive: Boolean(isActive)
  };
}
function setProductActive(payload) {
  requireValidLicense();
  const session = requirePermission("products:edit");
  const existing = db().prepare("SELECT business_id, name FROM products WHERE id = ?").get(payload.id);
  if (!existing) throw new Error("Product not found");
  assertBusinessAccess(existing.business_id);
  db().prepare("UPDATE products SET is_active = ? WHERE id = ?").run(payload.isActive ? 1 : 0, payload.id);
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: "product",
    entityId: payload.id,
    action: payload.isActive ? "activated" : "deactivated",
    summary: `${payload.isActive ? "Activated" : "Deactivated"} product ${existing.name}`
  });
  return { ok: true };
}
function deleteProduct(id) {
  requireValidLicense();
  const session = requirePermission("products:edit");
  const existing = db().prepare("SELECT business_id, name, is_active FROM products WHERE id = ?").get(id);
  if (!existing) throw new Error("Product not found");
  assertBusinessAccess(existing.business_id);
  const inSales = db().prepare("SELECT id FROM sale_items WHERE product_id = ? LIMIT 1").get(id);
  const inPo = db().prepare("SELECT id FROM purchase_order_items WHERE product_id = ? LIMIT 1").get(id);
  if (inSales || inPo) {
    if (existing.is_active) {
      db().prepare("UPDATE products SET is_active = 0 WHERE id = ?").run(id);
      writeActivity({
        businessId: existing.business_id,
        actorUserId: session.id,
        entityType: "product",
        entityId: id,
        action: "deactivated",
        summary: `Deactivated product ${existing.name} (used in history)`
      });
    }
    return { ok: true, mode: "deactivated" };
  }
  const run = db().transaction(() => {
    db().prepare("DELETE FROM supplier_products WHERE product_id = ?").run(id);
    db().prepare("DELETE FROM products WHERE id = ?").run(id);
  });
  run();
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: "product",
    entityId: id,
    action: "deleted",
    summary: `Deleted product ${existing.name}`
  });
  return { ok: true, mode: "deleted" };
}
function listProductSuppliers(productId) {
  const product = db().prepare("SELECT business_id FROM products WHERE id = ?").get(productId);
  if (!product) throw new Error("Product not found");
  assertBusinessAccess(product.business_id);
  const rows = db().prepare(
    `SELECT sp.id as link_id, sp.supplier_id, sp.unit_cost, s.name as supplier_name
       FROM supplier_products sp
       JOIN suppliers s ON s.id = sp.supplier_id
       WHERE sp.product_id = ?
       ORDER BY s.name ASC`
  ).all(productId);
  return rows.map((row) => ({
    linkId: row.link_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    unitCost: row.unit_cost
  }));
}
function generateProductBarcode(businessId) {
  requireValidLicense();
  requirePermission("products:edit");
  assertBusinessAccess(businessId);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const barcode = `KB${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
    const exists = db().prepare("SELECT id FROM products WHERE business_id = ? AND barcode = ?").get(businessId, barcode);
    if (!exists) return { barcode };
  }
  throw new Error("Could not generate unique barcode");
}
function listSuppliers(businessId) {
  assertBusinessAccess(businessId);
  const rows = db().prepare("SELECT id, business_id, name, phone, address, notes, is_active FROM suppliers WHERE business_id = ? ORDER BY created_at DESC").all(businessId);
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    isActive: Boolean(row.is_active)
  }));
}
function createSupplier(payload) {
  var _a, _b, _c, _d, _e, _f;
  requirePermission("suppliers:edit");
  assertBusinessAccess(payload.businessId);
  const session = requireSession();
  const id = v4();
  db().prepare(
    `INSERT INTO suppliers (id, business_id, name, phone, address, notes, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, payload.businessId, payload.name.trim(), ((_a = payload.phone) == null ? void 0 : _a.trim()) || null, ((_b = payload.address) == null ? void 0 : _b.trim()) || null, ((_c = payload.notes) == null ? void 0 : _c.trim()) || null, nowIso());
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: "supplier",
    entityId: id,
    action: "created",
    summary: `Created supplier ${payload.name.trim()}`
  });
  return {
    id,
    businessId: payload.businessId,
    name: payload.name.trim(),
    phone: ((_d = payload.phone) == null ? void 0 : _d.trim()) || null,
    address: ((_e = payload.address) == null ? void 0 : _e.trim()) || null,
    notes: ((_f = payload.notes) == null ? void 0 : _f.trim()) || null,
    isActive: true
  };
}
function updateSupplier(payload) {
  var _a, _b, _c, _d, _e, _f;
  const session = requirePermission("suppliers:edit");
  const existing = db().prepare("SELECT business_id FROM suppliers WHERE id = ?").get(payload.id);
  if (!existing) throw new Error("Supplier not found");
  assertBusinessAccess(existing.business_id);
  const isActive = payload.isActive === false ? 0 : 1;
  db().prepare("UPDATE suppliers SET name = ?, phone = ?, address = ?, notes = ?, is_active = ? WHERE id = ?").run(
    payload.name.trim(),
    ((_a = payload.phone) == null ? void 0 : _a.trim()) || null,
    ((_b = payload.address) == null ? void 0 : _b.trim()) || null,
    ((_c = payload.notes) == null ? void 0 : _c.trim()) || null,
    isActive,
    payload.id
  );
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: "supplier",
    entityId: payload.id,
    action: "updated",
    summary: `Updated supplier ${payload.name.trim()}`
  });
  return {
    id: payload.id,
    businessId: existing.business_id,
    name: payload.name.trim(),
    phone: ((_d = payload.phone) == null ? void 0 : _d.trim()) || null,
    address: ((_e = payload.address) == null ? void 0 : _e.trim()) || null,
    notes: ((_f = payload.notes) == null ? void 0 : _f.trim()) || null,
    isActive: Boolean(isActive)
  };
}
function requireSupplier(supplierId) {
  const row = db().prepare("SELECT id, business_id, name, phone, address, notes, is_active FROM suppliers WHERE id = ?").get(supplierId);
  if (!row) throw new Error("Supplier not found");
  assertBusinessAccess(row.business_id);
  return row;
}
function listSupplierProducts(supplierId) {
  requireSupplier(supplierId);
  const rows = db().prepare(
    `SELECT sp.id as link_id, sp.supplier_id, sp.product_id, sp.unit_cost,
              p.id, p.business_id, p.branch_id, p.name, p.barcode, p.price, p.cost_price,
              p.stock_qty, p.kind, p.tracks_stock, p.image_path, p.is_active
       FROM supplier_products sp
       JOIN products p ON p.id = sp.product_id
       WHERE sp.supplier_id = ?
       ORDER BY p.name ASC`
  ).all(supplierId);
  return rows.map(mapSupplierProductRow);
}
function getSupplierDetail(supplierId) {
  const row = requireSupplier(supplierId);
  return {
    supplier: {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      isActive: Boolean(row.is_active)
    },
    products: listSupplierProducts(supplierId)
  };
}
function linkSupplierProduct(payload) {
  requirePermission("suppliers:edit");
  const supplier = requireSupplier(payload.supplierId);
  if (!Number.isFinite(payload.unitCost) || payload.unitCost < 0) {
    throw new Error("Unit cost must be >= 0");
  }
  const product = db().prepare(
    `SELECT id, business_id, branch_id, name, barcode, price, cost_price, stock_qty, kind, tracks_stock, image_path, is_active
       FROM products WHERE id = ?`
  ).get(payload.productId);
  if (!product) throw new Error("Product not found");
  if (product.business_id !== supplier.business_id) {
    throw new Error("Product and supplier must belong to the same business");
  }
  assertBusinessAccess(product.business_id);
  const existing = db().prepare("SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ?").get(payload.supplierId, payload.productId);
  if (existing) throw new Error("Product is already attached to this supplier");
  const linkId = v4();
  db().prepare(
    `INSERT INTO supplier_products (id, supplier_id, product_id, unit_cost, created_at)
       VALUES (?, ?, ?, ?, ?)`
  ).run(linkId, payload.supplierId, payload.productId, payload.unitCost, nowIso());
  return {
    linkId,
    supplierId: payload.supplierId,
    productId: payload.productId,
    unitCost: payload.unitCost,
    product: mapProductRow(product)
  };
}
function unlinkSupplierProduct(payload) {
  requirePermission("suppliers:edit");
  requireSupplier(payload.supplierId);
  const result = db().prepare("DELETE FROM supplier_products WHERE supplier_id = ? AND product_id = ?").run(payload.supplierId, payload.productId);
  if (result.changes === 0) throw new Error("Product is not attached to this supplier");
  return { ok: true };
}
function updateLinkedSupplierProduct(payload) {
  requirePermission("suppliers:edit");
  requireSupplier(payload.supplierId);
  if (!Number.isFinite(payload.unitCost) || payload.unitCost < 0) {
    throw new Error("Unit cost must be >= 0");
  }
  const result = db().prepare("UPDATE supplier_products SET unit_cost = ? WHERE supplier_id = ? AND product_id = ?").run(payload.unitCost, payload.supplierId, payload.productId);
  if (result.changes === 0) throw new Error("Product is not attached to this supplier");
  const linked = listSupplierProducts(payload.supplierId).find((p) => p.productId === payload.productId);
  if (!linked) throw new Error("Product is not attached to this supplier");
  return linked;
}
function listPurchaseOrders(businessId) {
  assertBusinessAccess(businessId);
  const rows = db().prepare(
    "SELECT id, business_id, branch_id, supplier_id, po_number, status, order_date FROM purchase_orders WHERE business_id = ? ORDER BY created_at DESC"
  ).all(businessId);
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    supplierId: row.supplier_id,
    poNumber: row.po_number,
    status: row.status,
    orderDate: row.order_date
  }));
}
function createPurchaseOrder(payload) {
  var _a;
  requirePermission("purchaseOrders:edit");
  assertBusinessAccess(payload.businessId);
  assertBranchAccess(payload.branchId);
  const supplier = requireSupplier(payload.supplierId);
  if (supplier.business_id !== payload.businessId) {
    throw new Error("Supplier does not belong to this business");
  }
  if (!((_a = payload.items) == null ? void 0 : _a.length)) throw new Error("Add at least one product line");
  const id = v4();
  const session = requireSession();
  const insertItem = db().prepare(
    `INSERT INTO purchase_order_items (id, po_id, product_id, ordered_qty, received_qty, unit_cost, line_total)
     VALUES (?, ?, ?, ?, 0, ?, ?)`
  );
  const run = db().transaction(() => {
    db().prepare(
      `INSERT INTO purchase_orders (id, business_id, branch_id, supplier_id, po_number, status, order_date, expected_date, notes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'draft', ?, NULL, NULL, ?, ?)`
    ).run(
      id,
      payload.businessId,
      payload.branchId,
      payload.supplierId,
      payload.poNumber.trim(),
      payload.orderDate,
      session.id,
      nowIso()
    );
    for (const item of payload.items) {
      if (!Number.isFinite(item.orderedQty) || item.orderedQty <= 0) {
        throw new Error("Ordered quantity must be greater than 0");
      }
      if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
        throw new Error("Unit cost must be >= 0");
      }
      const linked = db().prepare("SELECT id FROM supplier_products WHERE supplier_id = ? AND product_id = ?").get(payload.supplierId, item.productId);
      if (!linked) throw new Error("All products must be attached to the selected supplier");
      const lineTotal = item.orderedQty * item.unitCost;
      insertItem.run(v4(), id, item.productId, item.orderedQty, item.unitCost, lineTotal);
    }
  });
  run();
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: "purchase_order",
    entityId: id,
    action: "created",
    summary: `Created PO ${payload.poNumber.trim()}`
  });
  return {
    id,
    businessId: payload.businessId,
    branchId: payload.branchId,
    supplierId: payload.supplierId,
    poNumber: payload.poNumber.trim(),
    status: "draft",
    orderDate: payload.orderDate
  };
}
function getPurchaseOrderDetail(poId) {
  const row = db().prepare(
    `SELECT po.id, po.business_id, po.branch_id, po.supplier_id, po.po_number, po.status, po.order_date,
              s.name as supplier_name, br.name as branch_name, b.name as business_name
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN branches br ON br.id = po.branch_id
       JOIN businesses b ON b.id = po.business_id
       WHERE po.id = ?`
  ).get(poId);
  if (!row) throw new Error("Purchase order not found");
  assertBusinessAccess(row.business_id);
  const items = db().prepare(
    `SELECT poi.id, poi.product_id, p.name as product_name, poi.ordered_qty, poi.received_qty, poi.unit_cost, poi.line_total
       FROM purchase_order_items poi
       JOIN products p ON p.id = poi.product_id
       WHERE poi.po_id = ?
       ORDER BY p.name ASC`
  ).all(poId);
  const mappedItems = items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName: item.product_name,
    orderedQty: item.ordered_qty,
    receivedQty: item.received_qty,
    unitCost: item.unit_cost,
    lineTotal: item.line_total
  }));
  return {
    po: {
      id: row.id,
      businessId: row.business_id,
      branchId: row.branch_id,
      supplierId: row.supplier_id,
      poNumber: row.po_number,
      status: row.status,
      orderDate: row.order_date
    },
    supplierName: row.supplier_name,
    branchName: row.branch_name,
    businessName: row.business_name,
    items: mappedItems,
    total: mappedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  };
}
async function printPurchaseOrder(poId) {
  requirePermission("purchaseOrders:edit");
  const detail = getPurchaseOrderDetail(poId);
  const business = db().prepare("SELECT currency, logo_path, brand_color FROM businesses WHERE id = ?").get(detail.po.businessId);
  const supplier = db().prepare("SELECT phone, address FROM suppliers WHERE id = ?").get(detail.po.supplierId);
  const html = buildPurchaseOrderHtml({
    businessName: detail.businessName,
    currency: (business == null ? void 0 : business.currency) || "Rs",
    brandColor: (business == null ? void 0 : business.brand_color) ?? null,
    logoPath: (business == null ? void 0 : business.logo_path) ?? null,
    supplierName: detail.supplierName,
    supplierPhone: (supplier == null ? void 0 : supplier.phone) ?? null,
    supplierAddress: (supplier == null ? void 0 : supplier.address) ?? null,
    branchName: detail.branchName,
    poNumber: detail.po.poNumber,
    orderDate: detail.po.orderDate,
    status: detail.po.status,
    items: detail.items.map((item) => ({
      productName: item.productName,
      orderedQty: item.orderedQty,
      unitCost: item.unitCost,
      lineTotal: item.lineTotal
    })),
    total: detail.total
  });
  return openPrintPreview({
    html,
    filePrefix: "purchase-order",
    title: detail.po.poNumber,
    width: 780,
    height: 920
  });
}
function listCustomers(businessId) {
  assertBusinessAccess(businessId);
  const rows = db().prepare("SELECT id, business_id, name, phone, current_balance, is_active FROM customers WHERE business_id = ? ORDER BY created_at DESC").all(businessId);
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    currentBalance: row.current_balance,
    isActive: Boolean(row.is_active)
  }));
}
function createCustomer(payload) {
  var _a, _b;
  const session = requirePermission("customers:edit");
  assertBusinessAccess(payload.businessId);
  const id = v4();
  const at = nowIso();
  db().prepare(
    `INSERT INTO customers (id, business_id, name, phone, address, opening_balance, current_balance, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 0, 0, 1, ?, ?)`
  ).run(id, payload.businessId, payload.name.trim(), ((_a = payload.phone) == null ? void 0 : _a.trim()) || null, at, at);
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: "customer",
    entityId: id,
    action: "created",
    summary: `Created customer ${payload.name.trim()}`
  });
  return {
    id,
    businessId: payload.businessId,
    name: payload.name.trim(),
    phone: ((_b = payload.phone) == null ? void 0 : _b.trim()) || null,
    currentBalance: 0,
    isActive: true
  };
}
function updateCustomer(payload) {
  var _a, _b;
  const session = requirePermission("customers:edit");
  const existing = db().prepare("SELECT business_id, current_balance FROM customers WHERE id = ?").get(payload.id);
  if (!existing) throw new Error("Customer not found");
  assertBusinessAccess(existing.business_id);
  const isActive = payload.isActive === false ? 0 : 1;
  db().prepare("UPDATE customers SET name = ?, phone = ?, is_active = ? WHERE id = ?").run(payload.name.trim(), ((_a = payload.phone) == null ? void 0 : _a.trim()) || null, isActive, payload.id);
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: "customer",
    entityId: payload.id,
    action: "updated",
    summary: `Updated customer ${payload.name.trim()}`
  });
  return {
    id: payload.id,
    businessId: existing.business_id,
    name: payload.name.trim(),
    phone: ((_b = payload.phone) == null ? void 0 : _b.trim()) || null,
    currentBalance: existing.current_balance,
    isActive: Boolean(isActive)
  };
}
function getCustomerDetail(customerId) {
  requireSession();
  const row = db().prepare("SELECT id, business_id, name, phone, current_balance, is_active FROM customers WHERE id = ?").get(customerId);
  if (!row) throw new Error("Customer not found");
  assertBusinessAccess(row.business_id);
  const sales = db().prepare(
    `SELECT id, invoice_no, total, status, created_at
       FROM sales WHERE customer_id = ? ORDER BY created_at DESC`
  ).all(customerId);
  const paymentStmt = db().prepare("SELECT method FROM payments WHERE sale_id = ?");
  const ledgerRows = db().prepare(
    `SELECT l.id, l.customer_id, l.business_id, l.branch_id, l.type, l.amount, l.balance_after,
              l.reference_sale_id, l.note, l.created_by, l.created_at, u.name as created_by_name
       FROM ledger_entries l
       LEFT JOIN users u ON u.id = l.created_by
       WHERE l.customer_id = ?
       ORDER BY l.created_at DESC, l.id DESC`
  ).all(customerId);
  return {
    customer: {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      phone: row.phone,
      currentBalance: row.current_balance,
      isActive: Boolean(row.is_active)
    },
    remainingBalance: row.current_balance,
    sales: sales.map((sale) => {
      const methods = paymentStmt.all(sale.id);
      return {
        id: sale.id,
        invoiceNo: sale.invoice_no,
        total: sale.total,
        status: sale.status,
        createdAt: sale.created_at,
        paymentMethods: [...new Set(methods.map((m) => m.method))]
      };
    }),
    ledger: ledgerRows.map((entry) => {
      let method = null;
      if (entry.type === "payment" && entry.note) {
        const match = entry.note.match(/^method:(cash|card)(?:\s*\|\s*(.*))?$/i);
        if (match) method = match[1].toLowerCase();
      }
      return {
        id: entry.id,
        customerId: entry.customer_id,
        businessId: entry.business_id,
        branchId: entry.branch_id,
        type: entry.type,
        amount: entry.amount,
        balanceAfter: entry.balance_after,
        referenceSaleId: entry.reference_sale_id,
        note: entry.note,
        createdBy: entry.created_by,
        createdByName: entry.created_by_name,
        createdAt: entry.created_at,
        method
      };
    })
  };
}
function entryDateYmd(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
async function printCustomerLedger(payload) {
  var _a, _b;
  requireValidLicense();
  requirePermission("sales:print");
  const detail = getCustomerDetail(payload.customerId);
  const business = db().prepare("SELECT name, currency, logo_path, brand_color FROM businesses WHERE id = ?").get(detail.customer.businessId);
  if (!business) throw new Error("Business not found");
  const from = ((_a = payload.from) == null ? void 0 : _a.trim()) || null;
  const to = ((_b = payload.to) == null ? void 0 : _b.trim()) || null;
  if (from && to && from > to) throw new Error("Invalid date range");
  const asc = [...detail.ledger].sort((a, b) => {
    const byDate = a.createdAt.localeCompare(b.createdAt);
    return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
  });
  const filtered = asc.filter((entry) => {
    const ymd = entryDateYmd(entry.createdAt);
    if (from && ymd < from) return false;
    if (to && ymd > to) return false;
    return true;
  });
  let openingBalance = 0;
  if (from) {
    const before = asc.filter((entry) => entryDateYmd(entry.createdAt) < from);
    if (before.length > 0) openingBalance = before[before.length - 1].balanceAfter;
  }
  const invoiceBySaleId = new Map(
    detail.sales.map((sale) => [sale.id, sale.invoiceNo])
  );
  const html = buildCustomerLedgerHtml({
    businessName: business.name,
    currency: business.currency || "Rs",
    brandColor: business.brand_color,
    logoPath: business.logo_path,
    customerName: detail.customer.name,
    customerPhone: detail.customer.phone,
    from,
    to,
    openingBalance,
    entries: filtered.map((entry) => ({
      createdAt: entry.createdAt,
      type: entry.type,
      amount: entry.amount,
      balanceAfter: entry.balanceAfter,
      note: entry.note,
      method: entry.method,
      invoiceNo: entry.referenceSaleId ? invoiceBySaleId.get(entry.referenceSaleId) ?? null : null
    }))
  });
  return openPrintPreview({
    html,
    filePrefix: "customer-ledger",
    title: detail.customer.name,
    width: 900,
    height: 960
  });
}
function recordCustomerPayment(payload) {
  var _a, _b;
  const session = requirePermission("customers:edit");
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Payment amount must be greater than 0");
  if (payload.method !== "cash" && payload.method !== "card") {
    throw new Error("Payment method must be cash or card");
  }
  const customer = db().prepare("SELECT id, business_id, name, current_balance FROM customers WHERE id = ?").get(payload.customerId);
  if (!customer) throw new Error("Customer not found");
  assertBusinessAccess(customer.business_id);
  if (amount > customer.current_balance) {
    throw new Error("Payment cannot exceed remaining credit balance");
  }
  let branchId = ((_a = payload.branchId) == null ? void 0 : _a.trim()) || null;
  if (branchId) {
    assertBranchAccess(branchId);
  } else if (session.branchId) {
    branchId = session.branchId;
  }
  const id = v4();
  const at = nowIso();
  const newBalance = customer.current_balance - amount;
  const userNote = ((_b = payload.note) == null ? void 0 : _b.trim()) || "";
  const note = userNote ? `method:${payload.method} | ${userNote}` : `method:${payload.method}`;
  db().transaction(() => {
    db().prepare("UPDATE customers SET current_balance = ?, updated_at = ? WHERE id = ?").run(
      newBalance,
      at,
      customer.id
    );
    db().prepare(
      `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
         VALUES (?, ?, ?, ?, 'payment', ?, ?, NULL, ?, ?, ?)`
    ).run(id, customer.id, customer.business_id, branchId, -amount, newBalance, note, session.id, at);
  })();
  writeActivity({
    businessId: customer.business_id,
    actorUserId: session.id,
    entityType: "customer",
    entityId: customer.id,
    action: "payment_recorded",
    summary: `Recorded ${payload.method} payment of ${amount} for ${customer.name}`
  });
  return {
    id,
    customerId: customer.id,
    businessId: customer.business_id,
    branchId,
    type: "payment",
    amount: -amount,
    balanceAfter: newBalance,
    referenceSaleId: null,
    note,
    createdBy: session.id,
    createdByName: session.name,
    createdAt: at,
    method: payload.method
  };
}
function nextInvoiceNumber(businessId, branchId) {
  const business = db().prepare("SELECT name FROM businesses WHERE id = ?").get(businessId);
  const branch = db().prepare("SELECT name FROM branches WHERE id = ?").get(branchId);
  if (!business || !branch) throw new Error("Business or branch not found");
  const prefix = invoicePrefix(business.name, branch.name);
  const rows = db().prepare("SELECT invoice_no FROM sales WHERE business_id = ? AND invoice_no LIKE ?").all(businessId, `${prefix}%`);
  let max = 0;
  for (const row of rows) {
    const seq = parseInvoiceSequence(row.invoice_no, prefix);
    if (seq != null && seq > max) max = seq;
  }
  return formatInvoiceNumber(business.name, branch.name, max + 1);
}
function createSale(payload) {
  var _a, _b, _c, _d, _e;
  requireValidLicense();
  requirePermission("sales:checkout");
  assertBusinessAccess(payload.businessId);
  assertBranchAccess(payload.branchId);
  const session = requireSession();
  if (!payload.items.length) throw new Error("Add at least one item to the sale");
  const nature = getBusinessNature(payload.businessId);
  let servedByUserId = ((_a = payload.servedByUserId) == null ? void 0 : _a.trim()) || null;
  let serviceMode = payload.serviceMode ?? null;
  let tableId = ((_b = payload.tableId) == null ? void 0 : _b.trim()) || null;
  const ticketId = ((_c = payload.ticketId) == null ? void 0 : _c.trim()) || null;
  let riderUserId = ((_d = payload.riderUserId) == null ? void 0 : _d.trim()) || null;
  let deliveryStatus = payload.deliveryStatus ?? null;
  const deliveryNotes = ((_e = payload.deliveryNotes) == null ? void 0 : _e.trim()) || null;
  const partialTicketBill = Boolean(payload.partialTicketBill);
  if (showsServedBy(nature)) {
    if (!servedByUserId) throw new Error("Served by staff is required");
    const staff = db().prepare(
      `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
    ).get(servedByUserId, payload.businessId, payload.businessId);
    if (!staff) throw new Error("Selected staff member was not found");
  } else if (servedByUserId) {
    throw new Error("Served by is not used for this business type");
  }
  if (showsServiceMode(nature)) {
    if (!serviceMode || !["dine_in", "takeaway", "delivery"].includes(serviceMode)) {
      throw new Error("Service mode is required");
    }
    if (serviceMode === "dine_in") {
      if (!tableId) throw new Error("Table is required for dine-in");
      const table = db().prepare("SELECT id FROM dining_tables WHERE id = ? AND business_id = ? AND is_active = 1").get(tableId, payload.businessId);
      if (!table) throw new Error("Table not found");
    } else {
      tableId = null;
    }
  } else {
    if (serviceMode || tableId) {
      throw new Error("Tables and service modes are not used for this business type");
    }
    serviceMode = null;
    tableId = null;
  }
  if (ticketId) {
    if (!showsTables(nature)) throw new Error("Tickets are only available for food businesses");
    const ticket = db().prepare(
      `SELECT id, status, table_id, service_mode, rider_user_id, delivery_status, delivery_notes
         FROM pos_tickets WHERE id = ? AND business_id = ?`
    ).get(ticketId, payload.businessId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status !== "open") throw new Error("Ticket is no longer open");
    serviceMode = ticket.service_mode;
    tableId = ticket.table_id;
    if (!riderUserId) riderUserId = ticket.rider_user_id;
    if (!deliveryStatus) deliveryStatus = ticket.delivery_status;
  }
  if (serviceMode === "takeaway" || serviceMode === "delivery") {
    if (riderUserId) {
      const rider = db().prepare(
        `SELECT id FROM users
           WHERE id = ? AND is_active = 1
             AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
      ).get(riderUserId, payload.businessId, payload.businessId);
      if (!rider) throw new Error("Rider not found");
      if (!deliveryStatus) deliveryStatus = "assigned";
    } else if (!deliveryStatus && serviceMode === "delivery") {
      deliveryStatus = "pending";
    }
  } else {
    riderUserId = null;
    deliveryStatus = null;
  }
  const id = v4();
  const at = nowIso();
  const invoiceNo = nextInvoiceNumber(payload.businessId, payload.branchId);
  const subtotal = payload.items.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);
  const discount = Math.max(0, Number(payload.discount ?? 0));
  if (!Number.isFinite(discount)) throw new Error("Discount must be a valid number");
  if (discount > subtotal) throw new Error("Discount cannot exceed subtotal");
  const total = subtotal - discount;
  const amountPaid = payload.payments.reduce((acc, p) => acc + p.amount, 0);
  db().transaction(() => {
    for (const item of payload.items) {
      if (!Number.isFinite(item.qty) || item.qty <= 0) throw new Error("Item quantity must be greater than 0");
      const product = db().prepare(
        `SELECT id, name, stock_qty, tracks_stock, is_active FROM products WHERE id = ? AND business_id = ?`
      ).get(item.productId, payload.businessId);
      if (!product || !product.is_active) throw new Error("Product not found or inactive");
      if (product.tracks_stock && item.qty > product.stock_qty) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
      if (ticketId && item.ticketItemId) {
        const ticketItem = db().prepare(
          `SELECT id, product_id, qty, billed_qty FROM pos_ticket_items WHERE id = ? AND ticket_id = ?`
        ).get(item.ticketItemId, ticketId);
        if (!ticketItem) throw new Error("Ticket line not found");
        if (ticketItem.product_id !== item.productId) throw new Error("Ticket line product mismatch");
        const remaining = ticketItem.qty - (ticketItem.billed_qty || 0);
        if (item.qty > remaining + 1e-9) {
          throw new Error(`Cannot bill more than remaining qty for ${product.name}`);
        }
      }
    }
    db().prepare(
      `INSERT INTO sales (
           id, business_id, branch_id, invoice_no, customer_id, cashier_id,
           subtotal, discount, tax, total, amount_paid, change_due, status,
           served_by_user_id, service_mode, table_id, rider_user_id, delivery_status, delivery_notes, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 'completed', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      payload.businessId,
      payload.branchId,
      invoiceNo,
      payload.customerId,
      session.id,
      subtotal,
      discount,
      total,
      amountPaid,
      servedByUserId,
      serviceMode,
      tableId,
      riderUserId,
      deliveryStatus,
      deliveryNotes,
      at
    );
    const insertSaleItem = db().prepare(
      `INSERT INTO sale_items (id, sale_id, product_id, product_name_snapshot, qty, unit_price, discount, line_total, refunded_qty, price_rule_id)
       SELECT ?, ?, p.id, p.name, ?, ?, 0, ?, 0, ?
       FROM products p WHERE p.id = ?`
    );
    const updateStock = db().prepare(
      "UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND tracks_stock = 1"
    );
    const bumpBilled = db().prepare(
      `UPDATE pos_ticket_items SET billed_qty = billed_qty + ? WHERE id = ? AND ticket_id = ?`
    );
    for (const item of payload.items) {
      insertSaleItem.run(
        v4(),
        id,
        item.qty,
        item.unitPrice,
        item.qty * item.unitPrice,
        item.priceRuleId ?? null,
        item.productId
      );
      updateStock.run(item.qty, item.productId);
      if (ticketId && item.ticketItemId) {
        bumpBilled.run(item.qty, item.ticketItemId, ticketId);
      }
    }
    const insertPayment = db().prepare(
      "INSERT INTO payments (id, sale_id, method, amount, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    for (const payment of payload.payments) {
      insertPayment.run(v4(), id, payment.method, payment.amount, at);
    }
    const creditAmount = payload.payments.filter((p) => p.method === "credit").reduce((acc, p) => acc + p.amount, 0);
    if (payload.customerId && creditAmount > 0) {
      const customer = db().prepare("SELECT current_balance FROM customers WHERE id = ?").get(payload.customerId);
      const newBalance = customer.current_balance + creditAmount;
      db().prepare("UPDATE customers SET current_balance = ? WHERE id = ?").run(newBalance, payload.customerId);
      db().prepare(
        `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
           VALUES (?, ?, ?, ?, 'sale', ?, ?, ?, 'Sale on credit', ?, ?)`
      ).run(
        v4(),
        payload.customerId,
        payload.businessId,
        payload.branchId,
        creditAmount,
        newBalance,
        id,
        session.id,
        at
      );
    }
    if (ticketId) {
      if (partialTicketBill) {
        const remaining = db().prepare(
          `SELECT COUNT(*) as c FROM pos_ticket_items
             WHERE ticket_id = ? AND billed_qty + 0.000001 < qty`
        ).get(ticketId);
        if (remaining.c === 0) {
          db().prepare(`UPDATE pos_tickets SET status = 'billed', updated_at = ? WHERE id = ? AND status = 'open'`).run(at, ticketId);
        } else {
          db().prepare(`UPDATE pos_tickets SET updated_at = ? WHERE id = ?`).run(at, ticketId);
        }
      } else {
        db().prepare(
          `UPDATE pos_ticket_items SET billed_qty = qty WHERE ticket_id = ?`
        ).run(ticketId);
        db().prepare(`UPDATE pos_tickets SET status = 'billed', updated_at = ? WHERE id = ? AND status = 'open'`).run(at, ticketId);
      }
    }
  })();
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: "sale",
    entityId: id,
    action: "created",
    summary: `Sale ${invoiceNo} completed`,
    payload: { total, itemCount: payload.items.length }
  });
  return getSaleById(id);
}
function mapSaleRow(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    invoiceNo: row.invoice_no,
    customerId: row.customer_id,
    cashierId: row.cashier_id,
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    amountPaid: row.amount_paid,
    status: row.status,
    createdAt: row.created_at,
    servedByUserId: row.served_by_user_id,
    servedByName: row.served_by_name,
    serviceMode: row.service_mode,
    tableId: row.table_id,
    tableName: row.table_name,
    riderUserId: row.rider_user_id ?? null,
    riderName: row.rider_name ?? null,
    deliveryStatus: row.delivery_status ?? null,
    deliveryNotes: row.delivery_notes ?? null
  };
}
function getSaleById(saleId) {
  const row = db().prepare(
    `SELECT s.id, s.business_id, s.branch_id, s.invoice_no, s.customer_id, s.cashier_id,
              s.subtotal, s.discount, s.total, s.amount_paid, s.status, s.created_at,
              s.served_by_user_id, u.name as served_by_name, s.service_mode, s.table_id, t.name as table_name,
              s.rider_user_id, r.name as rider_name, s.delivery_status, s.delivery_notes
       FROM sales s
       LEFT JOIN users u ON u.id = s.served_by_user_id
       LEFT JOIN users r ON r.id = s.rider_user_id
       LEFT JOIN dining_tables t ON t.id = s.table_id
       WHERE s.id = ?`
  ).get(saleId);
  if (!row) throw new Error("Sale not found");
  return mapSaleRow(row);
}
function listSales(businessId) {
  requireValidLicense();
  assertBusinessAccess(businessId);
  const rows = db().prepare(
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
  ).all(businessId);
  return rows.map(mapSaleRow);
}
function loadRefundRequest(id) {
  const row = db().prepare(
    `SELECT r.id, r.sale_id, r.business_id, r.requested_by, ru.name as requested_by_name, r.reason, r.status,
              r.reviewed_by, rv.name as reviewed_by_name, r.reviewed_at, r.review_note, r.created_at
       FROM refund_requests r
       JOIN users ru ON ru.id = r.requested_by
       LEFT JOIN users rv ON rv.id = r.reviewed_by
       WHERE r.id = ?`
  ).get(id);
  if (!row) throw new Error("Refund request not found");
  const items = db().prepare(
    `SELECT i.id, i.sale_item_id, i.product_id, COALESCE(si.product_name_snapshot, p.name) as product_name, i.qty
       FROM refund_request_items i
       LEFT JOIN sale_items si ON si.id = i.sale_item_id
       LEFT JOIN products p ON p.id = i.product_id
       WHERE i.refund_request_id = ?`
  ).all(id);
  return {
    id: row.id,
    saleId: row.sale_id,
    businessId: row.business_id,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name,
    reason: row.reason,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    items: items.map((item) => ({
      id: item.id,
      saleItemId: item.sale_item_id,
      productId: item.product_id,
      productName: item.product_name,
      qty: item.qty
    }))
  };
}
function createRefundRequest(payload) {
  requireValidLicense();
  const session = requirePermission("sales:refund_request");
  if (!payload.reason.trim()) throw new Error("Refund reason is required");
  if (!payload.items.length) throw new Error("Select at least one item to refund");
  const sale = db().prepare("SELECT id, business_id, status FROM sales WHERE id = ?").get(payload.saleId);
  if (!sale) throw new Error("Sale not found");
  assertBusinessAccess(sale.business_id);
  if (sale.status === "void" || sale.status === "refunded") {
    throw new Error("Sale cannot be refunded");
  }
  const pending = db().prepare("SELECT id FROM refund_requests WHERE sale_id = ? AND status = 'pending'").get(payload.saleId);
  if (pending) throw new Error("A pending refund request already exists for this sale");
  const requestId = v4();
  const at = nowIso();
  db().transaction(() => {
    db().prepare(
      `INSERT INTO refund_requests (id, sale_id, business_id, requested_by, reason, status, reviewed_by, reviewed_at, review_note, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, NULL, ?)`
    ).run(requestId, payload.saleId, sale.business_id, session.id, payload.reason.trim(), at);
    const insertItem = db().prepare(
      `INSERT INTO refund_request_items (id, refund_request_id, sale_item_id, product_id, qty)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const item of payload.items) {
      if (item.qty <= 0) throw new Error("Refund qty must be positive");
      const saleItem = db().prepare("SELECT id, product_id, qty, refunded_qty FROM sale_items WHERE id = ? AND sale_id = ?").get(item.saleItemId, payload.saleId);
      if (!saleItem) throw new Error("Sale item not found");
      const remaining = saleItem.qty - (saleItem.refunded_qty || 0);
      if (item.qty > remaining) throw new Error("Refund qty exceeds remaining quantity");
      insertItem.run(v4(), requestId, saleItem.id, saleItem.product_id, item.qty);
    }
    writeActivity({
      businessId: sale.business_id,
      actorUserId: session.id,
      entityType: "sale",
      entityId: payload.saleId,
      action: "refund_requested",
      summary: `Refund requested: ${payload.reason.trim()}`,
      payload: { requestId, items: payload.items }
    });
  })();
  return loadRefundRequest(requestId);
}
function reviewRefundRequest(payload) {
  var _a;
  requireValidLicense();
  const session = requirePermission("sales:refund_approve");
  const request = db().prepare("SELECT id, sale_id, business_id, status, reason FROM refund_requests WHERE id = ?").get(payload.id);
  if (!request) throw new Error("Refund request not found");
  assertBusinessAccess(request.business_id);
  if (request.status !== "pending") throw new Error("Refund request already reviewed");
  const at = nowIso();
  if (payload.decision === "reject") {
    db().prepare(
      `UPDATE refund_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?`
    ).run(session.id, at, ((_a = payload.note) == null ? void 0 : _a.trim()) || null, payload.id);
    writeActivity({
      businessId: request.business_id,
      actorUserId: session.id,
      entityType: "sale",
      entityId: request.sale_id,
      action: "refund_rejected",
      summary: `Refund rejected${payload.note ? `: ${payload.note}` : ""}`,
      payload: { requestId: payload.id }
    });
    return loadRefundRequest(payload.id);
  }
  const sale = db().prepare("SELECT id, customer_id, status, total FROM sales WHERE id = ?").get(request.sale_id);
  if (!sale) throw new Error("Sale not found");
  const items = db().prepare("SELECT sale_item_id, product_id, qty FROM refund_request_items WHERE refund_request_id = ?").all(payload.id);
  db().transaction(() => {
    var _a2;
    const restock = db().prepare(
      "UPDATE products SET stock_qty = stock_qty + ? WHERE id = ? AND tracks_stock = 1"
    );
    const bumpRefunded = db().prepare(
      "UPDATE sale_items SET refunded_qty = refunded_qty + ? WHERE id = ?"
    );
    let refundAmount = 0;
    for (const item of items) {
      const saleItem = db().prepare("SELECT qty, refunded_qty, unit_price FROM sale_items WHERE id = ?").get(item.sale_item_id);
      const remaining = saleItem.qty - (saleItem.refunded_qty || 0);
      if (item.qty > remaining) throw new Error("Refund qty no longer available");
      bumpRefunded.run(item.qty, item.sale_item_id);
      restock.run(item.qty, item.product_id);
      refundAmount += item.qty * saleItem.unit_price;
    }
    const allItems = db().prepare("SELECT qty, refunded_qty FROM sale_items WHERE sale_id = ?").all(request.sale_id);
    const fullyRefunded = allItems.every((row) => row.refunded_qty >= row.qty);
    const newStatus = fullyRefunded ? "refunded" : "partially_refunded";
    db().prepare("UPDATE sales SET status = ? WHERE id = ?").run(newStatus, request.sale_id);
    if (sale.customer_id && refundAmount > 0) {
      const creditPaid = db().prepare("SELECT SUM(amount) as total FROM payments WHERE sale_id = ? AND method = 'credit'").get(request.sale_id);
      const creditTotal = creditPaid.total ?? 0;
      if (creditTotal > 0) {
        const reverseAmount = Math.min(refundAmount, creditTotal);
        const customer = db().prepare("SELECT current_balance FROM customers WHERE id = ?").get(sale.customer_id);
        const newBalance = customer.current_balance - reverseAmount;
        db().prepare("UPDATE customers SET current_balance = ? WHERE id = ?").run(newBalance, sale.customer_id);
        db().prepare(
          `INSERT INTO ledger_entries (id, customer_id, business_id, branch_id, type, amount, balance_after, reference_sale_id, note, created_by, created_at)
             VALUES (?, ?, ?, NULL, 'adjustment', ?, ?, ?, ?, ?, ?)`
        ).run(
          v4(),
          sale.customer_id,
          request.business_id,
          -reverseAmount,
          newBalance,
          request.sale_id,
          `Refund approved: ${request.reason}`,
          session.id,
          at
        );
      }
    }
    db().prepare(
      `UPDATE refund_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?`
    ).run(session.id, at, ((_a2 = payload.note) == null ? void 0 : _a2.trim()) || null, payload.id);
    writeActivity({
      businessId: request.business_id,
      actorUserId: session.id,
      entityType: "sale",
      entityId: request.sale_id,
      action: "refund_approved",
      summary: `Refund approved (${newStatus})`,
      payload: { requestId: payload.id, refundAmount, items }
    });
  })();
  return loadRefundRequest(payload.id);
}
function getSaleDetail(saleId) {
  requireValidLicense();
  requireSession();
  const sale = getSaleById(saleId);
  assertBusinessAccess(sale.businessId);
  const itemRows = db().prepare(
    `SELECT si.id, si.sale_id, si.product_id, si.product_name_snapshot, si.qty, si.unit_price, si.line_total,
              si.refunded_qty, si.price_rule_id, r.name as price_rule_name
       FROM sale_items si
       LEFT JOIN happy_hour_price_rules r ON r.id = si.price_rule_id
       WHERE si.sale_id = ?`
  ).all(saleId);
  const paymentRows = db().prepare("SELECT id, method, amount, created_at FROM payments WHERE sale_id = ?").all(saleId);
  const requestIds = db().prepare("SELECT id FROM refund_requests WHERE sale_id = ? ORDER BY created_at DESC").all(saleId);
  return {
    sale,
    items: itemRows.map(
      (row) => ({
        id: row.id,
        saleId: row.sale_id,
        productId: row.product_id,
        productName: row.product_name_snapshot,
        qty: row.qty,
        unitPrice: row.unit_price,
        lineTotal: row.line_total,
        refundedQty: row.refunded_qty || 0,
        refundableQty: row.qty - (row.refunded_qty || 0),
        priceRuleId: row.price_rule_id,
        priceRuleName: row.price_rule_name
      })
    ),
    payments: paymentRows.map((row) => ({
      id: row.id,
      method: row.method,
      amount: row.amount,
      createdAt: row.created_at
    })),
    refundRequests: requestIds.map((row) => loadRefundRequest(row.id)),
    activity: listActivity("sale", saleId)
  };
}
function findSaleByInvoice(businessId, invoiceNo) {
  requireValidLicense();
  assertBusinessAccess(businessId);
  const code = invoiceNo.trim();
  if (!code) return null;
  const row = db().prepare(`SELECT id FROM sales WHERE business_id = ? AND invoice_no = ? LIMIT 1`).get(businessId, code);
  if (!row) return null;
  return getSaleById(row.id);
}
function updateSaleDelivery(payload) {
  var _a, _b;
  requireValidLicense();
  requirePermission("sales:checkout");
  const session = requireSession();
  const sale = getSaleById(payload.saleId);
  assertBusinessAccess(sale.businessId);
  if (sale.serviceMode !== "takeaway" && sale.serviceMode !== "delivery") {
    throw new Error("Delivery tracking is only for takeaway or delivery sales");
  }
  let riderUserId = payload.riderUserId === void 0 ? sale.riderUserId : ((_a = payload.riderUserId) == null ? void 0 : _a.trim()) || null;
  let deliveryStatus = payload.deliveryStatus === void 0 ? sale.deliveryStatus : payload.deliveryStatus;
  const deliveryNotes = payload.deliveryNotes === void 0 ? sale.deliveryNotes : ((_b = payload.deliveryNotes) == null ? void 0 : _b.trim()) || null;
  if (riderUserId) {
    const rider = db().prepare(
      `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
    ).get(riderUserId, sale.businessId, sale.businessId);
    if (!rider) throw new Error("Rider not found");
    if (!deliveryStatus || deliveryStatus === "pending") deliveryStatus = "assigned";
  }
  db().prepare(
    `UPDATE sales SET rider_user_id = ?, delivery_status = ?, delivery_notes = ? WHERE id = ?`
  ).run(riderUserId, deliveryStatus, deliveryNotes, payload.saleId);
  writeActivity({
    businessId: sale.businessId,
    actorUserId: session.id,
    entityType: "sale",
    entityId: payload.saleId,
    action: "delivery_updated",
    summary: `Delivery status ${deliveryStatus ?? "cleared"}`
  });
  return getSaleById(payload.saleId);
}
async function printSaleReceipt(saleId) {
  requireValidLicense();
  requirePermission("sales:print");
  const session = requireSession();
  const sale = db().prepare(
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
  ).get(saleId);
  if (!sale) throw new Error("Sale not found");
  assertBusinessAccess(sale.business_id);
  const mainBranch = db().prepare(
    `SELECT address, phone FROM branches
       WHERE business_id = ? AND is_main_branch = 1
       ORDER BY created_at ASC LIMIT 1`
  ).get(sale.business_id);
  const branchFallback = db().prepare(
    `SELECT address, phone FROM branches WHERE business_id = ? ORDER BY created_at ASC LIMIT 1`
  ).get(sale.business_id);
  const branch = mainBranch ?? branchFallback;
  const items = db().prepare(
    `SELECT product_name_snapshot as product_name, qty, unit_price, line_total FROM sale_items WHERE sale_id = ? ORDER BY id`
  ).all(saleId);
  const payments = db().prepare(`SELECT method, amount FROM payments WHERE sale_id = ?`).all(saleId);
  let jsBarcodeScript = "";
  try {
    const barcodePath = require$1.resolve("jsbarcode/dist/JsBarcode.all.min.js");
    jsBarcodeScript = fs$1.readFileSync(barcodePath, "utf8");
  } catch {
    jsBarcodeScript = "";
  }
  const html = await buildSaleReceiptHtml({
    invoiceNo: sale.invoice_no,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    amountPaid: sale.amount_paid,
    createdAt: sale.created_at,
    businessName: sale.business_name,
    currency: sale.currency,
    brandColor: sale.brand_color,
    logoPath: sale.logo_path,
    customerName: sale.customer_name,
    cashierName: sale.cashier_name,
    printedByName: session.name,
    receiptHeader: sale.receipt_header,
    receiptFooter: sale.receipt_footer,
    branchAddress: (branch == null ? void 0 : branch.address) ?? null,
    branchPhone: (branch == null ? void 0 : branch.phone) ?? null,
    socialWhatsapp: sale.social_whatsapp,
    socialInstagram: sale.social_instagram,
    socialFacebook: sale.social_facebook,
    socialTiktok: sale.social_tiktok,
    socialWebsite: sale.social_website,
    items: items.map((item) => ({
      productName: item.product_name,
      qty: item.qty,
      unitPrice: item.unit_price,
      lineTotal: item.line_total
    })),
    payments,
    jsBarcodeScript
  });
  return openPrintPreview({
    html,
    filePrefix: "sale-receipt",
    title: sale.invoice_no,
    width: 420,
    height: 760
  });
}
function normalizeAnalyticsDays(days) {
  const n = typeof days === "string" ? Number(days) : days;
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}
function utcYmd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function startOfUtcDay(date = /* @__PURE__ */ new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_ANALYTICS_DAYS = 366;
function parseUtcYmd(value) {
  if (!value || !YMD_RE.test(value)) return null;
  const [, ys, ms, ds] = value.match(YMD_RE);
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (utcYmd(date) !== value) return null;
  return date;
}
function resolveAnalyticsWindow(payload) {
  const fromRaw = typeof payload.from === "string" ? payload.from.trim() : "";
  const toRaw = typeof payload.to === "string" ? payload.to.trim() : "";
  const hasCustom = Boolean(fromRaw || toRaw);
  if (hasCustom) {
    let fromDate2 = parseUtcYmd(fromRaw);
    let toDate2 = parseUtcYmd(toRaw);
    if (!fromDate2 && !toDate2) {
      throw new Error("Invalid analytics date range");
    }
    if (!toDate2) toDate2 = startOfUtcDay();
    if (!fromDate2) fromDate2 = new Date(toDate2.getTime());
    if (fromDate2.getTime() > toDate2.getTime()) {
      const swap = fromDate2;
      fromDate2 = toDate2;
      toDate2 = swap;
    }
    const dayMs = 24 * 60 * 60 * 1e3;
    let days2 = Math.floor((toDate2.getTime() - fromDate2.getTime()) / dayMs) + 1;
    if (days2 > MAX_ANALYTICS_DAYS) {
      fromDate2 = new Date(toDate2.getTime());
      fromDate2.setUTCDate(fromDate2.getUTCDate() - (MAX_ANALYTICS_DAYS - 1));
      days2 = MAX_ANALYTICS_DAYS;
    }
    return {
      from: utcYmd(fromDate2),
      to: utcYmd(toDate2),
      days: days2,
      sinceIso: fromDate2.toISOString()
    };
  }
  const days = normalizeAnalyticsDays(payload.days);
  const toDate = startOfUtcDay();
  const fromDate = new Date(toDate.getTime());
  fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
  return {
    from: utcYmd(fromDate),
    to: utcYmd(toDate),
    days,
    sinceIso: fromDate.toISOString()
  };
}
function getAnalyticsSummary(payload) {
  const businessId = typeof payload === "object" && payload && "businessId" in payload ? String(payload.businessId) : "";
  const window2 = resolveAnalyticsWindow(
    typeof payload === "object" && payload ? {
      days: payload.days,
      from: payload.from,
      to: payload.to
    } : {}
  );
  requirePermission("business:view");
  assertBusinessAccess(businessId);
  const { from, to, days, sinceIso: sinceIso2 } = window2;
  const untilExclusive = parseUtcYmd(to);
  untilExclusive.setUTCDate(untilExclusive.getUTCDate() + 1);
  const untilIso = untilExclusive.toISOString();
  const salesRows = db().prepare(
    `SELECT date(created_at) as day, SUM(total) as total, COUNT(*) as count
       FROM sales
       WHERE business_id = ? AND created_at >= ? AND created_at < ? AND status != 'void'
       GROUP BY date(created_at)
       ORDER BY day ASC`
  ).all(businessId, sinceIso2, untilIso);
  const dayMap = new Map(salesRows.map((row) => [row.day, row]));
  const salesByDay = [];
  let salesTotal = 0;
  let salesCount = 0;
  const cursor = parseUtcYmd(from);
  for (let i = 0; i < days; i += 1) {
    const key = utcYmd(cursor);
    const row = dayMap.get(key);
    const total = (row == null ? void 0 : row.total) ?? 0;
    const count = (row == null ? void 0 : row.count) ?? 0;
    salesTotal += total;
    salesCount += count;
    salesByDay.push({ date: key, total, count });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const paymentRows = db().prepare(
    `SELECT p.method, SUM(p.amount) as total
       FROM payments p
       JOIN sales s ON s.id = p.sale_id
       WHERE s.business_id = ? AND s.created_at >= ? AND s.created_at < ? AND s.status != 'void'
       GROUP BY p.method`
  ).all(businessId, sinceIso2, untilIso);
  const paymentMap = new Map(paymentRows.map((row) => [row.method, row.total]));
  const paymentsByMethod = ["cash", "card", "credit"].map((method) => ({ method, total: paymentMap.get(method) ?? 0 }));
  const topProducts = db().prepare(
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
  ).all(businessId, sinceIso2, untilIso);
  const creditBalances = db().prepare(
    `SELECT COALESCE(SUM(current_balance), 0) as total,
              COUNT(*) as customers
       FROM customers
       WHERE business_id = ? AND current_balance > 0 AND is_active = 1`
  ).get(businessId);
  const lowStock = db().prepare(
    `SELECT COUNT(*) as c FROM products
       WHERE business_id = ? AND is_active = 1 AND tracks_stock = 1 AND stock_qty <= 5`
  ).get(businessId);
  return {
    days,
    from,
    to,
    salesByDay,
    paymentsByMethod,
    topProducts: topProducts.map((row) => ({
      productName: row.product_name,
      qty: row.qty,
      revenue: row.revenue
    })),
    creditOutstanding: creditBalances.total,
    customersWithBalance: creditBalances.customers,
    lowStockCount: lowStock.c,
    salesTotal,
    salesCount
  };
}
function mapPosTicketItem(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name_snapshot,
    qty: row.qty,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
    seatNo: row.seat_no ?? null,
    kitchenStatus: row.kitchen_status || "held",
    firedAt: row.fired_at ?? null,
    bumpedAt: row.bumped_at ?? null,
    billedQty: row.billed_qty || 0,
    priceRuleId: row.price_rule_id ?? null
  };
}
function loadPosTicket(ticketId) {
  const row = db().prepare(
    `SELECT t.id, t.business_id, t.branch_id, t.table_id, t.service_mode, t.status, t.opened_by, t.notes,
              t.rider_user_id, u.name as rider_name, t.delivery_status, t.delivery_notes,
              t.created_at, t.updated_at
       FROM pos_tickets t
       LEFT JOIN users u ON u.id = t.rider_user_id
       WHERE t.id = ?`
  ).get(ticketId);
  if (!row) throw new Error("Ticket not found");
  const items = db().prepare(
    `SELECT id, product_id, product_name_snapshot, qty, unit_price, line_total,
              seat_no, kitchen_status, fired_at, bumped_at, billed_qty, price_rule_id
       FROM pos_ticket_items WHERE ticket_id = ? ORDER BY rowid ASC`
  ).all(ticketId);
  const mappedItems = items.map(mapPosTicketItem);
  const unbilledTotal = mappedItems.reduce((acc, item) => {
    const remaining = Math.max(0, item.qty - item.billedQty);
    return acc + remaining * item.unitPrice;
  }, 0);
  return {
    id: row.id,
    businessId: row.business_id,
    branchId: row.branch_id,
    tableId: row.table_id,
    serviceMode: row.service_mode,
    status: row.status,
    openedBy: row.opened_by,
    notes: row.notes,
    riderUserId: row.rider_user_id,
    riderName: row.rider_name,
    deliveryStatus: row.delivery_status,
    deliveryNotes: row.delivery_notes,
    items: mappedItems,
    total: mappedItems.reduce((acc, item) => acc + item.lineTotal, 0),
    unbilledTotal,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function listDiningTables(businessId) {
  requireValidLicense();
  assertBusinessAccess(businessId);
  if (!showsTables(getBusinessNature(businessId))) {
    throw new Error("Tables are only available for food businesses");
  }
  const rows = db().prepare(
    `SELECT t.id, t.business_id, t.name, t.seats, t.sort_order, t.is_active,
              ot.id as open_ticket_id,
              COALESCE((
                SELECT SUM(ti.line_total) FROM pos_ticket_items ti WHERE ti.ticket_id = ot.id
              ), 0) as open_ticket_total
       FROM dining_tables t
       LEFT JOIN pos_tickets ot ON ot.table_id = t.id AND ot.status = 'open'
       WHERE t.business_id = ?
       ORDER BY t.sort_order ASC, t.name ASC`
  ).all(businessId);
  return rows.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    seats: row.seats,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    occupied: Boolean(row.open_ticket_id),
    openTicketId: row.open_ticket_id,
    openTicketTotal: row.open_ticket_total || 0
  }));
}
function createDiningTable(payload) {
  requireValidLicense();
  requirePermission("tables:edit");
  assertBusinessAccess(payload.businessId);
  if (!showsTables(getBusinessNature(payload.businessId))) {
    throw new Error("Tables are only available for food businesses");
  }
  const session = requireSession();
  const id = v4();
  const name = payload.name.trim();
  if (!name) throw new Error("Table name is required");
  db().prepare(
    `INSERT INTO dining_tables (id, business_id, name, seats, sort_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
  ).run(
    id,
    payload.businessId,
    name,
    payload.seats ?? null,
    payload.sortOrder ?? 0,
    nowIso()
  );
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: "dining_table",
    entityId: id,
    action: "created",
    summary: `Created table ${name}`
  });
  return listDiningTables(payload.businessId).find((t) => t.id === id);
}
function updateDiningTable(payload) {
  requireValidLicense();
  const session = requirePermission("tables:edit");
  const existing = db().prepare("SELECT business_id FROM dining_tables WHERE id = ?").get(payload.id);
  if (!existing) throw new Error("Table not found");
  assertBusinessAccess(existing.business_id);
  if (!showsTables(getBusinessNature(existing.business_id))) {
    throw new Error("Tables are only available for food businesses");
  }
  const name = payload.name.trim();
  if (!name) throw new Error("Table name is required");
  db().prepare(
    `UPDATE dining_tables SET name = ?, seats = ?, sort_order = ?, is_active = ?
       WHERE id = ?`
  ).run(
    name,
    payload.seats ?? null,
    payload.sortOrder ?? 0,
    payload.isActive === false ? 0 : 1,
    payload.id
  );
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: "dining_table",
    entityId: payload.id,
    action: "updated",
    summary: `Updated table ${name}`
  });
  return listDiningTables(existing.business_id).find((t) => t.id === payload.id);
}
function listOpenTickets(businessId) {
  requireValidLicense();
  assertBusinessAccess(businessId);
  if (!showsTables(getBusinessNature(businessId))) {
    throw new Error("Tickets are only available for food businesses");
  }
  const rows = db().prepare(`SELECT id FROM pos_tickets WHERE business_id = ? AND status = 'open' ORDER BY updated_at DESC`).all(businessId);
  return rows.map((row) => loadPosTicket(row.id));
}
function getPosTicket(ticketId) {
  requireValidLicense();
  requireSession();
  const ticket = loadPosTicket(ticketId);
  assertBusinessAccess(ticket.businessId);
  return ticket;
}
function openPosTicket(payload) {
  var _a, _b;
  requireValidLicense();
  requirePermission("sales:checkout");
  assertBusinessAccess(payload.businessId);
  assertBranchAccess(payload.branchId);
  if (!showsTables(getBusinessNature(payload.businessId))) {
    throw new Error("Tickets are only available for food businesses");
  }
  if (!["dine_in", "takeaway", "delivery"].includes(payload.serviceMode)) {
    throw new Error("Invalid service mode");
  }
  const session = requireSession();
  let tableId = ((_a = payload.tableId) == null ? void 0 : _a.trim()) || null;
  if (payload.serviceMode === "dine_in") {
    if (!tableId) throw new Error("Table is required for dine-in");
    const table = db().prepare("SELECT id FROM dining_tables WHERE id = ? AND business_id = ? AND is_active = 1").get(tableId, payload.businessId);
    if (!table) throw new Error("Table not found");
    const open = db().prepare(`SELECT id FROM pos_tickets WHERE table_id = ? AND status = 'open'`).get(tableId);
    if (open) throw new Error("Table already has an open ticket");
  } else {
    tableId = null;
  }
  const id = v4();
  const at = nowIso();
  const deliveryStatus = payload.serviceMode === "takeaway" || payload.serviceMode === "delivery" ? "pending" : null;
  db().prepare(
    `INSERT INTO pos_tickets (
         id, business_id, branch_id, table_id, service_mode, status, opened_by, notes,
         rider_user_id, delivery_status, delivery_notes, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, 'open', ?, ?, NULL, ?, NULL, ?, ?)`
  ).run(
    id,
    payload.businessId,
    payload.branchId,
    tableId,
    payload.serviceMode,
    session.id,
    ((_b = payload.notes) == null ? void 0 : _b.trim()) || null,
    deliveryStatus,
    at,
    at
  );
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: "pos_ticket",
    entityId: id,
    action: "opened",
    summary: `Opened ${payload.serviceMode} ticket`
  });
  return loadPosTicket(id);
}
function setPosTicketItems(payload) {
  requireValidLicense();
  requirePermission("sales:checkout");
  const existing = db().prepare("SELECT id, business_id, status FROM pos_tickets WHERE id = ?").get(payload.ticketId);
  if (!existing) throw new Error("Ticket not found");
  assertBusinessAccess(existing.business_id);
  if (existing.status !== "open") throw new Error("Ticket is no longer open");
  const at = nowIso();
  db().transaction(() => {
    const previous = db().prepare(
      `SELECT id, kitchen_status, fired_at, bumped_at, billed_qty FROM pos_ticket_items WHERE ticket_id = ?`
    ).all(payload.ticketId);
    const prevById = new Map(previous.map((p) => [p.id, p]));
    db().prepare("DELETE FROM pos_ticket_items WHERE ticket_id = ?").run(payload.ticketId);
    const insert = db().prepare(
      `INSERT INTO pos_ticket_items (
         id, ticket_id, product_id, product_name_snapshot, qty, unit_price, line_total,
         seat_no, kitchen_status, fired_at, bumped_at, billed_qty, price_rule_id
       )
       SELECT ?, ?, p.id, p.name, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM products p WHERE p.id = ? AND p.business_id = ? AND p.is_active = 1`
    );
    for (const item of payload.items) {
      if (!Number.isFinite(item.qty) || item.qty <= 0) throw new Error("Item quantity must be greater than 0");
      const product = db().prepare(
        `SELECT id, name, stock_qty, tracks_stock FROM products WHERE id = ? AND business_id = ? AND is_active = 1`
      ).get(item.productId, existing.business_id);
      if (!product) throw new Error("Product not found or inactive");
      if (product.tracks_stock && item.qty > product.stock_qty) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
      const keepId = item.id && prevById.has(item.id) ? item.id : v4();
      const prev = item.id ? prevById.get(item.id) : void 0;
      const billedQty = Math.min((prev == null ? void 0 : prev.billed_qty) || 0, item.qty);
      const result = insert.run(
        keepId,
        payload.ticketId,
        item.qty,
        item.unitPrice,
        item.qty * item.unitPrice,
        item.seatNo ?? null,
        (prev == null ? void 0 : prev.kitchen_status) || "held",
        (prev == null ? void 0 : prev.fired_at) ?? null,
        (prev == null ? void 0 : prev.bumped_at) ?? null,
        billedQty,
        item.priceRuleId ?? null,
        item.productId,
        existing.business_id
      );
      if (result.changes !== 1) throw new Error("Failed to add ticket item");
    }
    db().prepare(`UPDATE pos_tickets SET updated_at = ? WHERE id = ?`).run(at, payload.ticketId);
  })();
  return loadPosTicket(payload.ticketId);
}
function cancelPosTicket(ticketId) {
  requireValidLicense();
  requirePermission("sales:checkout");
  const session = requireSession();
  const existing = db().prepare("SELECT id, business_id, status FROM pos_tickets WHERE id = ?").get(ticketId);
  if (!existing) throw new Error("Ticket not found");
  assertBusinessAccess(existing.business_id);
  if (existing.status !== "open") throw new Error("Ticket is no longer open");
  db().prepare(`UPDATE pos_tickets SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(nowIso(), ticketId);
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: "pos_ticket",
    entityId: ticketId,
    action: "cancelled",
    summary: "Cancelled open ticket"
  });
  return { ok: true };
}
function fireTicketItems(payload) {
  requireValidLicense();
  requirePermission("sales:checkout");
  const session = requireSession();
  const ticket = loadPosTicket(payload.ticketId);
  assertBusinessAccess(ticket.businessId);
  if (ticket.status !== "open") throw new Error("Ticket is no longer open");
  if (!payload.itemIds.length) throw new Error("Select items to send to kitchen");
  const at = nowIso();
  const update = db().prepare(
    `UPDATE pos_ticket_items
     SET kitchen_status = 'fired', fired_at = COALESCE(fired_at, ?)
     WHERE id = ? AND ticket_id = ? AND kitchen_status = 'held'`
  );
  db().transaction(() => {
    for (const itemId of payload.itemIds) {
      update.run(at, itemId, payload.ticketId);
    }
    db().prepare(`UPDATE pos_tickets SET updated_at = ? WHERE id = ?`).run(at, payload.ticketId);
  })();
  writeActivity({
    businessId: ticket.businessId,
    actorUserId: session.id,
    entityType: "pos_ticket",
    entityId: payload.ticketId,
    action: "kitchen_fired",
    summary: `Fired ${payload.itemIds.length} item(s) to kitchen`
  });
  return loadPosTicket(payload.ticketId);
}
function assignTicketRider(payload) {
  var _a, _b;
  requireValidLicense();
  requirePermission("sales:checkout");
  const session = requireSession();
  const ticket = loadPosTicket(payload.ticketId);
  assertBusinessAccess(ticket.businessId);
  if (ticket.status !== "open") throw new Error("Ticket is no longer open");
  if (ticket.serviceMode !== "takeaway" && ticket.serviceMode !== "delivery") {
    throw new Error("Rider assignment is only for takeaway or delivery");
  }
  const riderUserId = ((_a = payload.riderUserId) == null ? void 0 : _a.trim()) || null;
  let deliveryStatus = payload.deliveryStatus ?? ticket.deliveryStatus;
  const deliveryNotes = payload.deliveryNotes === void 0 ? ticket.deliveryNotes : ((_b = payload.deliveryNotes) == null ? void 0 : _b.trim()) || null;
  if (riderUserId) {
    const rider = db().prepare(
      `SELECT id FROM users
         WHERE id = ? AND is_active = 1
           AND (business_id = ? OR id = (SELECT owner_id FROM businesses WHERE id = ?))`
    ).get(riderUserId, ticket.businessId, ticket.businessId);
    if (!rider) throw new Error("Rider not found");
    if (!deliveryStatus || deliveryStatus === "pending") deliveryStatus = "assigned";
  }
  db().prepare(
    `UPDATE pos_tickets
       SET rider_user_id = ?, delivery_status = ?, delivery_notes = ?, updated_at = ?
       WHERE id = ?`
  ).run(riderUserId, deliveryStatus, deliveryNotes, nowIso(), payload.ticketId);
  writeActivity({
    businessId: ticket.businessId,
    actorUserId: session.id,
    entityType: "pos_ticket",
    entityId: payload.ticketId,
    action: "rider_assigned",
    summary: riderUserId ? "Rider assigned" : "Rider cleared"
  });
  return loadPosTicket(payload.ticketId);
}
function listActiveKitchen(businessId) {
  requireValidLicense();
  requirePermission("sales:checkout");
  assertBusinessAccess(businessId);
  if (!showsTables(getBusinessNature(businessId))) {
    throw new Error("Kitchen display is only available for food businesses");
  }
  const rows = db().prepare(
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
  ).all(businessId);
  return rows.map((row) => ({
    itemId: row.item_id,
    ticketId: row.ticket_id,
    tableName: row.table_name,
    serviceMode: row.service_mode,
    productName: row.product_name_snapshot,
    qty: row.qty,
    seatNo: row.seat_no,
    kitchenStatus: row.kitchen_status,
    kitchenStation: row.kitchen_station,
    firedAt: row.fired_at,
    bumpedAt: row.bumped_at,
    createdAt: row.created_at
  }));
}
function bumpKitchenItems(payload) {
  requireValidLicense();
  requirePermission("sales:checkout");
  requireSession();
  if (!payload.itemIds.length) throw new Error("Select items to bump");
  const at = nowIso();
  const update = db().prepare(
    `UPDATE pos_ticket_items
     SET kitchen_status = 'bumped', bumped_at = ?
     WHERE id = ? AND kitchen_status IN ('fired', 'ready')`
  );
  db().transaction(() => {
    for (const id of payload.itemIds) update.run(at, id);
  })();
  return { ok: true };
}
function recallKitchenItems(payload) {
  requireValidLicense();
  requirePermission("sales:checkout");
  requireSession();
  if (!payload.itemIds.length) throw new Error("Select items to recall");
  const update = db().prepare(
    `UPDATE pos_ticket_items
     SET kitchen_status = 'fired', bumped_at = NULL
     WHERE id = ? AND kitchen_status = 'bumped'`
  );
  db().transaction(() => {
    for (const id of payload.itemIds) update.run(id);
  })();
  return { ok: true };
}
function mapHappyHourRule(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    productId: row.product_id,
    categoryId: row.category_id,
    overridePrice: row.override_price,
    percentOff: row.percent_off,
    weekdaysMask: row.weekdays_mask,
    startTime: row.start_time,
    endTime: row.end_time,
    priority: row.priority,
    isActive: Boolean(row.is_active),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function assertHappyHourPricing(payload) {
  var _a, _b;
  const overridePrice = payload.overridePrice == null || payload.overridePrice === "" ? null : Number(payload.overridePrice);
  const percentOff = payload.percentOff == null || payload.percentOff === "" ? null : Number(payload.percentOff);
  const hasOverride = overridePrice != null && Number.isFinite(overridePrice);
  const hasPercent = percentOff != null && Number.isFinite(percentOff);
  if (hasOverride === hasPercent) {
    throw new Error("Set either an override price or a percent off, not both");
  }
  if (hasOverride && overridePrice < 0) throw new Error("Override price must be >= 0");
  if (hasPercent && (percentOff < 0 || percentOff > 100)) {
    throw new Error("Percent off must be between 0 and 100");
  }
  const productId = ((_a = payload.productId) == null ? void 0 : _a.trim()) || null;
  const categoryId = ((_b = payload.categoryId) == null ? void 0 : _b.trim()) || null;
  if (productId && categoryId) throw new Error("Rule cannot target both a product and a category");
  if (!Number.isInteger(payload.weekdaysMask) || payload.weekdaysMask < 0 || payload.weekdaysMask > 127) {
    throw new Error("Invalid weekdays mask");
  }
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRe.test(payload.startTime) || !timeRe.test(payload.endTime)) {
    throw new Error("Start and end time must be HH:MM");
  }
  return {
    overridePrice: hasOverride ? overridePrice : null,
    percentOff: hasPercent ? percentOff : null,
    productId,
    categoryId
  };
}
function localParts(atIso) {
  const d = atIso ? new Date(atIso) : /* @__PURE__ */ new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const jsDay = d.getDay();
  const weekdayBit = jsDay === 0 ? 1 << 6 : 1 << jsDay - 1;
  return { date: `${y}-${m}-${day}`, weekdayBit, hm: `${hh}:${mm}` };
}
function timeInWindow(hm, start, end) {
  if (start === end) return true;
  if (start < end) return hm >= start && hm < end;
  return hm >= start || hm < end;
}
function resolveUnitPrice(payload) {
  requireValidLicense();
  assertBusinessAccess(payload.businessId);
  const product = db().prepare(
    `SELECT id, price, category_id FROM products WHERE id = ? AND business_id = ? AND is_active = 1`
  ).get(payload.productId, payload.businessId);
  if (!product) throw new Error("Product not found");
  const { date, weekdayBit, hm } = localParts(payload.at);
  const rules = db().prepare(
    `SELECT id, name, product_id, category_id, override_price, percent_off, weekdays_mask,
              start_time, end_time, priority, valid_from, valid_to
       FROM happy_hour_price_rules
       WHERE business_id = ? AND is_active = 1
       ORDER BY priority DESC, created_at DESC`
  ).all(payload.businessId);
  const candidates = [];
  for (const rule of rules) {
    if ((rule.weekdays_mask & weekdayBit) === 0) continue;
    if (!timeInWindow(hm, rule.start_time, rule.end_time)) continue;
    if (rule.valid_from && date < rule.valid_from.slice(0, 10)) continue;
    if (rule.valid_to && date > rule.valid_to.slice(0, 10)) continue;
    let scope = 0;
    if (rule.product_id) {
      if (rule.product_id !== product.id) continue;
      scope = 2;
    } else if (rule.category_id) {
      if (!product.category_id || rule.category_id !== product.category_id) continue;
      scope = 1;
    } else {
      scope = 0;
    }
    const unitPrice = rule.override_price != null ? rule.override_price : Math.max(0, product.price * (1 - (rule.percent_off || 0) / 100));
    candidates.push({ id: rule.id, name: rule.name, unitPrice, scope });
  }
  candidates.sort((a, b) => b.scope - a.scope);
  const best = candidates[0];
  if (!best) {
    return { unitPrice: product.price, listPrice: product.price, priceRuleId: null, priceRuleName: null };
  }
  return {
    unitPrice: best.unitPrice,
    listPrice: product.price,
    priceRuleId: best.id,
    priceRuleName: best.name
  };
}
function listHappyHourRules(businessId) {
  requireValidLicense();
  requirePermission("products:view");
  assertBusinessAccess(businessId);
  const rows = db().prepare(
    `SELECT id, business_id, name, product_id, category_id, override_price, percent_off,
              weekdays_mask, start_time, end_time, priority, is_active, valid_from, valid_to,
              created_at, updated_at
       FROM happy_hour_price_rules WHERE business_id = ?
       ORDER BY priority DESC, name ASC`
  ).all(businessId);
  return rows.map(mapHappyHourRule);
}
function createHappyHourRule(payload) {
  var _a, _b;
  requireValidLicense();
  requirePermission("products:edit");
  assertBusinessAccess(payload.businessId);
  const session = requireSession();
  const name = payload.name.trim();
  if (!name) throw new Error("Rule name is required");
  const pricing = assertHappyHourPricing(payload);
  const id = v4();
  const at = nowIso();
  db().prepare(
    `INSERT INTO happy_hour_price_rules (
         id, business_id, name, product_id, category_id, override_price, percent_off,
         weekdays_mask, start_time, end_time, priority, is_active, valid_from, valid_to,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    payload.businessId,
    name,
    pricing.productId,
    pricing.categoryId,
    pricing.overridePrice,
    pricing.percentOff,
    payload.weekdaysMask,
    payload.startTime,
    payload.endTime,
    payload.priority ?? 0,
    payload.isActive === false ? 0 : 1,
    ((_a = payload.validFrom) == null ? void 0 : _a.trim()) || null,
    ((_b = payload.validTo) == null ? void 0 : _b.trim()) || null,
    at,
    at
  );
  writeActivity({
    businessId: payload.businessId,
    actorUserId: session.id,
    entityType: "happy_hour_rule",
    entityId: id,
    action: "created",
    summary: `Created happy hour rule ${name}`
  });
  return listHappyHourRules(payload.businessId).find((r) => r.id === id);
}
function updateHappyHourRule(payload) {
  var _a, _b;
  requireValidLicense();
  requirePermission("products:edit");
  const session = requireSession();
  const existing = db().prepare("SELECT business_id FROM happy_hour_price_rules WHERE id = ?").get(payload.id);
  if (!existing) throw new Error("Rule not found");
  assertBusinessAccess(existing.business_id);
  const name = payload.name.trim();
  if (!name) throw new Error("Rule name is required");
  const pricing = assertHappyHourPricing(payload);
  const at = nowIso();
  db().prepare(
    `UPDATE happy_hour_price_rules SET
         name = ?, product_id = ?, category_id = ?, override_price = ?, percent_off = ?,
         weekdays_mask = ?, start_time = ?, end_time = ?, priority = ?, is_active = ?,
         valid_from = ?, valid_to = ?, updated_at = ?
       WHERE id = ?`
  ).run(
    name,
    pricing.productId,
    pricing.categoryId,
    pricing.overridePrice,
    pricing.percentOff,
    payload.weekdaysMask,
    payload.startTime,
    payload.endTime,
    payload.priority ?? 0,
    payload.isActive === false ? 0 : 1,
    ((_a = payload.validFrom) == null ? void 0 : _a.trim()) || null,
    ((_b = payload.validTo) == null ? void 0 : _b.trim()) || null,
    at,
    payload.id
  );
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: "happy_hour_rule",
    entityId: payload.id,
    action: "updated",
    summary: `Updated happy hour rule ${name}`
  });
  return listHappyHourRules(existing.business_id).find((r) => r.id === payload.id);
}
function setHappyHourRuleActive(payload) {
  requireValidLicense();
  requirePermission("products:edit");
  const session = requireSession();
  const existing = db().prepare("SELECT business_id, name FROM happy_hour_price_rules WHERE id = ?").get(payload.id);
  if (!existing) throw new Error("Rule not found");
  assertBusinessAccess(existing.business_id);
  db().prepare(`UPDATE happy_hour_price_rules SET is_active = ?, updated_at = ? WHERE id = ?`).run(payload.isActive ? 1 : 0, nowIso(), payload.id);
  writeActivity({
    businessId: existing.business_id,
    actorUserId: session.id,
    entityType: "happy_hour_rule",
    entityId: payload.id,
    action: payload.isActive ? "activated" : "deactivated",
    summary: `${payload.isActive ? "Activated" : "Deactivated"} happy hour rule ${existing.name}`
  });
  return listHappyHourRules(existing.business_id).find((r) => r.id === payload.id);
}
function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.APP_PING, async () => ({
    ok: true,
    at: (/* @__PURE__ */ new Date()).toISOString()
  }));
  ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, async () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    userDataPath: app.getPath("userData")
  }));
  ipcMain.handle(IPC_CHANNELS.APP_GET_BOOT_STATE, async () => getBootState());
  ipcMain.handle(IPC_CHANNELS.APP_GET_BRAND_COLOR, async () => getBootBrandColor());
  ipcMain.handle(IPC_CHANNELS.APP_GET_LANGUAGE, async () => normalizeAppLanguage(appStore.get("language")));
  ipcMain.handle(IPC_CHANNELS.APP_SET_LANGUAGE, async (_event, language) => {
    const next = normalizeAppLanguage(language);
    appStore.set("language", next);
    return { ok: true };
  });
  ipcMain.handle(IPC_CHANNELS.APP_GET_LICENSE_STATUS, async () => {
    const status = getLicenseStatus();
    if (status.status === "none") {
      return { state: "missing", expiresAt: null, issuedTo: null };
    }
    if (status.status === "expired") {
      return {
        state: "expired",
        expiresAt: status.record.expiresAt,
        issuedTo: status.record.issuedTo
      };
    }
    return {
      state: status.record.expiresAt ? "valid" : "lifetime",
      expiresAt: status.record.expiresAt,
      issuedTo: status.record.issuedTo
    };
  });
  ipcMain.handle(IPC_CHANNELS.APP_GET_RESTOCK_ALERTS, async (_event, businessId) => {
    requirePermission("business:view");
    const scopedBusinessId = businessId == null ? void 0 : businessId.trim();
    if (!scopedBusinessId) return [];
    assertBusinessAccess(scopedBusinessId);
    return getRestockAlertsForBusiness(scopedBusinessId);
  });
  ipcMain.handle(IPC_CHANNELS.REMINDERS_MAYBE_RUN, async () => {
    requireSession();
    return maybeRunDailyReminders();
  });
  ipcMain.handle(IPC_CHANNELS.LICENSE_ACTIVATE, async (_event, licenseKey) => activateLicense(licenseKey));
  ipcMain.handle(IPC_CHANNELS.SETUP_COMPLETE, async (_event, payload) => completeSetup(payload));
  ipcMain.handle(
    IPC_CHANNELS.SETUP_RESTORE_FROM_BACKUP,
    async (event, payload) => restoreSetupFromBackup(payload, (progress) => {
      event.sender.send(IPC_CHANNELS.BACKUP_PROGRESS, progress);
    })
  );
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, payload) => login(payload));
  ipcMain.handle(
    IPC_CHANNELS.AUTH_RESET_OWNER_PASSWORD_OFFLINE,
    async (_event, payload) => resetOwnerPasswordOffline(payload)
  );
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => logout());
  ipcMain.handle(IPC_CHANNELS.AUTH_SESSION, async () => getSession());
  ipcMain.handle(IPC_CHANNELS.BUSINESS_LIST, async () => listBusinesses());
  ipcMain.handle(IPC_CHANNELS.BUSINESS_CREATE, async (_event, payload) => createBusiness(payload));
  ipcMain.handle(IPC_CHANNELS.BUSINESS_UPDATE, async (_event, payload) => updateBusiness(payload));
  ipcMain.handle(IPC_CHANNELS.BUSINESS_SET_ACTIVE, async (_event, businessId) => setActiveBusiness(businessId));
  ipcMain.handle(IPC_CHANNELS.BRANCH_LIST, async (_event, businessId) => listBranches(businessId));
  ipcMain.handle(IPC_CHANNELS.BRANCH_CREATE, async (_event, payload) => createBranch(payload));
  ipcMain.handle(IPC_CHANNELS.BRANCH_UPDATE, async (_event, payload) => updateBranch(payload));
  ipcMain.handle(IPC_CHANNELS.USER_LIST, async (_event, businessId) => listUsers(businessId));
  ipcMain.handle(IPC_CHANNELS.USER_CREATE, async (_event, payload) => createUser(payload));
  ipcMain.handle(IPC_CHANNELS.USER_UPDATE_SELF, async (_event, payload) => updateSelfUserProfile(payload));
  ipcMain.handle(IPC_CHANNELS.USER_SET_ACTIVE, async (_event, payload) => setUserActive(payload));
  ipcMain.handle(IPC_CHANNELS.PRODUCT_LIST, async (_event, businessId) => listProducts(businessId));
  ipcMain.handle(IPC_CHANNELS.PRODUCT_CREATE, async (_event, payload) => createProduct(payload));
  ipcMain.handle(IPC_CHANNELS.PRODUCT_UPDATE, async (_event, payload) => updateProduct(payload));
  ipcMain.handle(IPC_CHANNELS.PRODUCT_SET_ACTIVE, async (_event, payload) => setProductActive(payload));
  ipcMain.handle(IPC_CHANNELS.PRODUCT_DELETE, async (_event, id) => deleteProduct(id));
  ipcMain.handle(
    IPC_CHANNELS.PRODUCT_GENERATE_BARCODE,
    async (_event, businessId) => generateProductBarcode(businessId)
  );
  ipcMain.handle(
    IPC_CHANNELS.PRODUCT_ACTIVITY,
    async (_event, productId) => listActivity("product", productId)
  );
  ipcMain.handle(
    IPC_CHANNELS.PRODUCT_LIST_SUPPLIERS,
    async (_event, productId) => listProductSuppliers(productId)
  );
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_LIST, async (_event, businessId) => listSuppliers(businessId));
  ipcMain.handle(
    IPC_CHANNELS.SUPPLIER_GET_DETAIL,
    async (_event, supplierId) => getSupplierDetail(supplierId)
  );
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_CREATE, async (_event, payload) => createSupplier(payload));
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_UPDATE, async (_event, payload) => updateSupplier(payload));
  ipcMain.handle(
    IPC_CHANNELS.SUPPLIER_LIST_PRODUCTS,
    async (_event, supplierId) => listSupplierProducts(supplierId)
  );
  ipcMain.handle(IPC_CHANNELS.SUPPLIER_LINK_PRODUCT, async (_event, payload) => linkSupplierProduct(payload));
  ipcMain.handle(
    IPC_CHANNELS.SUPPLIER_UNLINK_PRODUCT,
    async (_event, payload) => unlinkSupplierProduct(payload)
  );
  ipcMain.handle(
    IPC_CHANNELS.SUPPLIER_UPDATE_LINKED_PRODUCT,
    async (_event, payload) => updateLinkedSupplierProduct(payload)
  );
  ipcMain.handle(IPC_CHANNELS.PO_LIST, async (_event, businessId) => listPurchaseOrders(businessId));
  ipcMain.handle(IPC_CHANNELS.PO_GET_DETAIL, async (_event, poId) => getPurchaseOrderDetail(poId));
  ipcMain.handle(IPC_CHANNELS.PO_CREATE, async (_event, payload) => createPurchaseOrder(payload));
  ipcMain.handle(IPC_CHANNELS.PO_PRINT, async (_event, poId) => printPurchaseOrder(poId));
  ipcMain.handle(IPC_CHANNELS.CUSTOMER_LIST, async (_event, businessId) => listCustomers(businessId));
  ipcMain.handle(IPC_CHANNELS.CUSTOMER_GET_DETAIL, async (_event, customerId) => getCustomerDetail(customerId));
  ipcMain.handle(IPC_CHANNELS.CUSTOMER_CREATE, async (_event, payload) => createCustomer(payload));
  ipcMain.handle(IPC_CHANNELS.CUSTOMER_UPDATE, async (_event, payload) => updateCustomer(payload));
  ipcMain.handle(
    IPC_CHANNELS.CUSTOMER_RECORD_PAYMENT,
    async (_event, payload) => recordCustomerPayment(payload)
  );
  ipcMain.handle(
    IPC_CHANNELS.CUSTOMER_PRINT_LEDGER,
    async (_event, payload) => printCustomerLedger(payload)
  );
  ipcMain.handle(IPC_CHANNELS.SALES_LIST, async (_event, businessId) => listSales(businessId));
  ipcMain.handle(IPC_CHANNELS.SALES_GET_DETAIL, async (_event, saleId) => getSaleDetail(saleId));
  ipcMain.handle(
    IPC_CHANNELS.SALES_FIND_BY_INVOICE,
    async (_event, payload) => findSaleByInvoice(payload.businessId, payload.invoiceNo)
  );
  ipcMain.handle(IPC_CHANNELS.SALES_CREATE, async (_event, payload) => createSale(payload));
  ipcMain.handle(IPC_CHANNELS.SALES_REFUND_REQUEST, async (_event, payload) => createRefundRequest(payload));
  ipcMain.handle(IPC_CHANNELS.SALES_REFUND_REVIEW, async (_event, payload) => reviewRefundRequest(payload));
  ipcMain.handle(IPC_CHANNELS.SALES_PRINT, async (_event, saleId) => printSaleReceipt(saleId));
  ipcMain.handle(IPC_CHANNELS.TABLE_LIST, async (_event, businessId) => listDiningTables(businessId));
  ipcMain.handle(IPC_CHANNELS.TABLE_CREATE, async (_event, payload) => createDiningTable(payload));
  ipcMain.handle(IPC_CHANNELS.TABLE_UPDATE, async (_event, payload) => updateDiningTable(payload));
  ipcMain.handle(IPC_CHANNELS.TICKET_LIST_OPEN, async (_event, businessId) => listOpenTickets(businessId));
  ipcMain.handle(IPC_CHANNELS.TICKET_GET, async (_event, ticketId) => getPosTicket(ticketId));
  ipcMain.handle(IPC_CHANNELS.TICKET_OPEN, async (_event, payload) => openPosTicket(payload));
  ipcMain.handle(IPC_CHANNELS.TICKET_SET_ITEMS, async (_event, payload) => setPosTicketItems(payload));
  ipcMain.handle(IPC_CHANNELS.TICKET_CANCEL, async (_event, ticketId) => cancelPosTicket(ticketId));
  ipcMain.handle(IPC_CHANNELS.TICKET_FIRE_ITEMS, async (_event, payload) => fireTicketItems(payload));
  ipcMain.handle(IPC_CHANNELS.TICKET_ASSIGN_RIDER, async (_event, payload) => assignTicketRider(payload));
  ipcMain.handle(
    IPC_CHANNELS.KITCHEN_LIST_ACTIVE,
    async (_event, businessId) => listActiveKitchen(businessId)
  );
  ipcMain.handle(IPC_CHANNELS.KITCHEN_BUMP, async (_event, payload) => bumpKitchenItems(payload));
  ipcMain.handle(IPC_CHANNELS.KITCHEN_RECALL, async (_event, payload) => recallKitchenItems(payload));
  ipcMain.handle(
    IPC_CHANNELS.HAPPY_HOUR_LIST,
    async (_event, businessId) => listHappyHourRules(businessId)
  );
  ipcMain.handle(IPC_CHANNELS.HAPPY_HOUR_CREATE, async (_event, payload) => createHappyHourRule(payload));
  ipcMain.handle(IPC_CHANNELS.HAPPY_HOUR_UPDATE, async (_event, payload) => updateHappyHourRule(payload));
  ipcMain.handle(
    IPC_CHANNELS.HAPPY_HOUR_SET_ACTIVE,
    async (_event, payload) => setHappyHourRuleActive(payload)
  );
  ipcMain.handle(IPC_CHANNELS.HAPPY_HOUR_RESOLVE_PRICE, async (_event, payload) => resolveUnitPrice(payload));
  ipcMain.handle(IPC_CHANNELS.SALES_UPDATE_DELIVERY, async (_event, payload) => updateSaleDelivery(payload));
  ipcMain.handle(
    IPC_CHANNELS.ACTIVITY_LIST,
    async (_event, payload) => listActivity(payload.entityType, payload.entityId)
  );
  ipcMain.handle(
    IPC_CHANNELS.ANALYTICS_SUMMARY,
    async (_event, payload) => {
      if (typeof payload === "string") {
        return getAnalyticsSummary({ businessId: payload, days: 30 });
      }
      return getAnalyticsSummary({
        businessId: (payload == null ? void 0 : payload.businessId) ?? "",
        days: payload == null ? void 0 : payload.days,
        from: payload == null ? void 0 : payload.from,
        to: payload == null ? void 0 : payload.to
      });
    }
  );
  ipcMain.handle(
    IPC_CHANNELS.ASSETS_PICK_AND_SAVE,
    async (_event, payload) => pickAndSaveAsset(payload.kind)
  );
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_CREATE,
    async (event) => createBackup((progress) => {
      event.sender.send(IPC_CHANNELS.BACKUP_PROGRESS, progress);
    })
  );
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_RESTORE,
    async (event, filePath) => restoreBackup(filePath, (progress) => {
      event.sender.send(IPC_CHANNELS.BACKUP_PROGRESS, progress);
    })
  );
  ipcMain.handle(IPC_CHANNELS.BACKUP_PICK_FILE, async () => pickBackupFile());
  ipcMain.handle(IPC_CHANNELS.BACKUP_GET_AUTO_SETTINGS, async () => {
    requirePermission("business:view");
    return getAutoBackupSettings();
  });
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_SET_AUTO_SETTINGS,
    async (_event, payload) => {
      requirePermission("business:view");
      return setAutoBackupSettings(payload);
    }
  );
}
const CHECK_INTERVAL_MS = 45e3;
let timer = null;
let running = false;
function localDateKey(d = /* @__PURE__ */ new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function alreadyRanToday(lastAt) {
  if (!lastAt) return false;
  const last = new Date(lastAt);
  if (Number.isNaN(last.getTime())) return false;
  return localDateKey(last) === localDateKey();
}
function isScheduledMinuteNow(timeHhMm, now = /* @__PURE__ */ new Date()) {
  const normalized = normalizeAutoBackupTime(timeHhMm);
  const [hh, mm] = normalized.split(":").map(Number);
  return now.getHours() === hh && now.getMinutes() === mm;
}
async function tickAutoBackup() {
  if (running || isBackupBusy()) return;
  const settings = getAutoBackupSettings();
  if (!settings.autoBackupEnabled) return;
  if (!isScheduledMinuteNow(settings.autoBackupTime)) return;
  if (alreadyRanToday(settings.lastAutoBackupAt)) return;
  running = true;
  try {
    await createBackupInternal();
    markAutoBackupCompleted();
  } catch (error) {
    console.error("[auto-backup] failed", error);
  } finally {
    running = false;
  }
}
function startAutoBackupScheduler() {
  if (timer) return;
  void tickAutoBackup();
  timer = setInterval(() => {
    void tickAutoBackup();
  }, CHECK_INTERVAL_MS);
}
protocol.registerSchemesAsPrivileged([
  {
    scheme: "kaarobar-asset",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
]);
const __dirname$1 = path$1.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path$1.join(__dirname$1, "..");
dotenv.config({ path: path$1.join(process.env.APP_ROOT, ".env") });
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win = null;
function createWindow() {
  win = new BrowserWindow({
    title: "Kaarobar",
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#f6f8fb",
    icon: path$1.join(process.env.VITE_PUBLIC, "kaarobar-logo.svg"),
    webPreferences: {
      preload: path$1.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.once("ready-to-show", () => {
    win == null ? void 0 : win.show();
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
}
app.whenReady().then(() => {
  app.setPath("userData", getKaarobarDataDir());
  protocol.handle("kaarobar-asset", (request) => serveAssetRequest(request.url));
  registerIpcHandlers();
  createWindow();
  startAutoBackupScheduler();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
