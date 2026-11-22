const { contextBridge, ipcRenderer } = require("electron");
const versionArg = process.argv.find((arg) =>
  arg.startsWith("--qala-version="),
);
contextBridge.exposeInMainWorld("qalaNative", {
  version: versionArg?.slice("--qala-version=".length),
  apiBase: "",
  save: (text) => ipcRenderer.invoke("pack:save", text),
  open: () => ipcRenderer.invoke("pack:open"),
  clear: () => ipcRenderer.invoke("pack:clear"),
});
