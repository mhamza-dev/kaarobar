const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kaarobarPos", {
  getStatus: () => ipcRenderer.invoke("pos:get-status"),
  enqueueSale: (sale) => ipcRenderer.invoke("pos:enqueue-sale", sale),
  cacheCatalog: (catalog) => ipcRenderer.invoke("pos:cache-catalog", catalog),
  getCachedCatalog: () => ipcRenderer.invoke("pos:get-cached-catalog"),
  syncOutbox: (opts) => ipcRenderer.invoke("pos:sync-outbox", opts),
});
