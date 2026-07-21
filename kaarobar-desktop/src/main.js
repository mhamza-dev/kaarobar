const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const API_URL = process.env.KAAROBAR_API_URL || "http://localhost:4000/api/v1";
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function outboxPath() {
  return path.join(app.getPath("userData"), "sales-outbox.json");
}

function catalogPath() {
  return path.join(app.getPath("userData"), "catalog-cache.json");
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "Kaarobar POS",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("pos:get-status", async () => {
  const outbox = readJson(outboxPath(), []);
  return {
    online: true,
    pendingSyncCount: outbox.filter((s) => s.status === "pending").length,
    mode: "online-first",
  };
});

ipcMain.handle("pos:enqueue-sale", async (_e, sale) => {
  const outbox = readJson(outboxPath(), []);
  outbox.push({
    ...sale,
    status: "pending",
    enqueued_at: new Date().toISOString(),
  });
  writeJson(outboxPath(), outbox);
  return { pendingSyncCount: outbox.filter((s) => s.status === "pending").length };
});

ipcMain.handle("pos:cache-catalog", async (_e, catalog) => {
  writeJson(catalogPath(), { cached_at: new Date().toISOString(), items: catalog || [] });
  return { ok: true, count: (catalog || []).length };
});

ipcMain.handle("pos:get-cached-catalog", async () => {
  return readJson(catalogPath(), { items: [] });
});

ipcMain.handle("pos:sync-outbox", async (_e, { token, businessId, branchId }) => {
  const outbox = readJson(outboxPath(), []);
  const pending = outbox.filter((s) => s.status === "pending");
  if (pending.length === 0) return { synced: 0, results: [] };

  const res = await fetch(`${API_URL}/sync/sales`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-business-id": businessId,
      "x-branch-id": branchId,
    },
    body: JSON.stringify({ branch_id: branchId, sales: pending }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Sync failed (${res.status})`);
  }

  const results = body.data || [];
  const byTxn = new Map(results.map((r) => [r.client_txn_id, r]));
  const next = outbox.map((sale) => {
    const r = byTxn.get(sale.client_txn_id);
    if (!r) return sale;
    if (r.status === "ok") return { ...sale, status: "synced", sale_id: r.sale_id };
    return { ...sale, status: "error", error: r.error };
  });
  writeJson(outboxPath(), next);

  return {
    synced: results.filter((r) => r.status === "ok").length,
    results,
    pendingSyncCount: next.filter((s) => s.status === "pending").length,
  };
});
