const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("qalaNative", {
  version: "0.1.2",
  apiBase: "",
  save: (text) => ipcRenderer.invoke("pack:save", text),
  open: () => ipcRenderer.invoke("pack:open"),
  clear: () => ipcRenderer.invoke("pack:clear"),
});
