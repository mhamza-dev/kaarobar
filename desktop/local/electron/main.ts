import { app, BrowserWindow, protocol } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { registerIpcHandlers } from "./ipc/handlers";
import { getKaarobarDataDir } from "./config/paths";
import { serveAssetRequest } from "./assets/service";
import { startAutoBackupScheduler } from "./backup/autoBackup";
import { startCloudSyncScheduler } from "./sync/cloudSync";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "kaarobar-asset",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(process.env.APP_ROOT, ".env") });

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null = null;

function createWindow(): void {
  const iconPath = path.join(
    process.env.VITE_PUBLIC ?? RENDERER_DIST,
    "kaarobar-icon.png",
  );

  win = new BrowserWindow({
    title: "Kaarobar",
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#f6f8fb",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => {
    win?.show();
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

app.whenReady().then(() => {
  app.setPath("userData", getKaarobarDataDir());

  protocol.handle("kaarobar-asset", (request) =>
    serveAssetRequest(request.url),
  );

  registerIpcHandlers();
  createWindow();
  startAutoBackupScheduler();
  // License heartbeat + customer push, every 15 minutes. See sync/cloudSync.ts.
  startCloudSyncScheduler();

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
