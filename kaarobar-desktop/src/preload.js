const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kaarobarPos", {
  getStatus: () => ipcRenderer.invoke("pos:get-status"),
});
