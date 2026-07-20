const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

/** Offline outbox stub — SQLite sync lands in Phase 6 (OFF-FR). */
const pendingSyncCount = 0;

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

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
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

ipcMain.handle("pos:get-status", async () => ({
  online: true,
  pendingSyncCount,
  mode: "online-first",
}));
