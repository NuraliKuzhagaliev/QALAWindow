const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  protocol,
  net,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "../..");
const storage =
  process.env.QALA_DATA_DIR ||
  path.join(
    process.env.PORTABLE_EXECUTABLE_DIR ||
      (app.isPackaged ? path.dirname(app.getPath("exe")) : root),
    ".desktop-data",
  );
app.setPath("userData", storage);
app.setPath("sessionData", path.join(storage, "session"));
app.setPath("temp", path.join(storage, "tmp"));
app.setAppLogsPath(path.join(storage, "logs"));
app.commandLine.appendSwitch("disk-cache-dir", path.join(storage, "cache"));
// Use Windows Location Services without a billed network geolocation key.
app.commandLine.appendSwitch(
  "enable-features",
  [
    app.commandLine.getSwitchValue("enable-features"),
    "LocationProviderManager:LocationProviderManagerMode/PlatformOnly",
  ]
    .filter(Boolean)
    .join(","),
);
protocol.registerSchemesAsPrivileged([
  {
    scheme: "qala",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
const allowedExternal = (url) => {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      [
        "www.openstreetmap.org",
        "open-meteo.com",
        "openfreemap.org",
        "www.openmaptiles.org",
        "www.openstreetmap.org",
        "creativecommons.org",
      ].includes(u.hostname)
    );
  } catch {
    return false;
  }
};
let window;
app.whenReady().then(async () => {
  await fs.mkdir(path.join(storage, "tmp"), { recursive: true });
  await fs.mkdir(path.join(storage, "packs"), { recursive: true });
  const renderer = path.join(root, "dist", "client");
  protocol.handle("qala", (request) => {
    const u = new URL(request.url);
    let requested;
    try {
      requested = decodeURIComponent(u.pathname);
    } catch {
      return new Response("Bad path", { status: 400 });
    }
    const resolved = path.resolve(renderer, "." + requested);
    if (resolved !== renderer && !resolved.startsWith(renderer + path.sep))
      return new Response("Forbidden", { status: 403 });
    return net.fetch(
      pathToFileURL(
        resolved === renderer ? path.join(renderer, "index.html") : resolved,
      ).toString(),
    );
  });
  window = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 390,
    minHeight: 640,
    title: "QALA Window",
    backgroundColor: "#f6f3ec",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      additionalArguments: [`--qala-version=${app.getVersion()}`],
    },
  });
  window.webContents.session.webRequest.onHeadersReceived((details, callback) =>
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org; font-src 'self' https://tiles.openfreemap.org; connect-src 'self' https://tiles.openfreemap.org https://*.openfreemap.org https://api.open-meteo.com https://qala-window-astana-2026.nurali6002217.chatgpt.site; object-src 'none'; base-uri 'self'; frame-src 'none'",
        ],
      },
    }),
  );
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("qala://app/")) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (allowedExternal(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  const ownLocationRequest = (webContents, permission, details) =>
    webContents === window.webContents &&
    ["geolocation", "geolocation-approximate"].includes(permission) &&
    details.isMainFrame === true &&
    details.requestingUrl?.startsWith("qala://app/") === true;
  window.webContents.session.setPermissionCheckHandler(
    (contents, permission, origin, details) =>
      (origin === "qala://app" || origin === "qala://app/") &&
      ownLocationRequest(contents, permission, details),
  );
  window.webContents.session.setPermissionRequestHandler(
    (contents, permission, callback, details) =>
      callback(ownLocationRequest(contents, permission, details)),
  );
  const authorized = (event) =>
    event.sender === window.webContents &&
    event.senderFrame?.url.startsWith("qala://app/");
  ipcMain.handle("pack:save", async (event, text) => {
    if (
      !authorized(event) ||
      typeof text !== "string" ||
      Buffer.byteLength(text) > 5000000
    )
      throw new Error("Invalid pack");
    const data = JSON.parse(text);
    if (data.format !== "qala-route-pack" || data.version !== 1)
      throw new Error("Invalid pack");
    const save = await dialog.showSaveDialog(window, {
      defaultPath: path.join(storage, "packs", "Walk.qala.json"),
      filters: [{ name: "QALA route pack", extensions: ["qala.json"] }],
    });
    if (save.canceled || !save.filePath) return false;
    await fs.writeFile(save.filePath, text, "utf8");
    return true;
  });
  ipcMain.handle("pack:open", async (event) => {
    if (!authorized(event)) throw new Error("Invalid origin");
    const open = await dialog.showOpenDialog(window, {
      defaultPath: path.join(storage, "packs"),
      properties: ["openFile"],
      filters: [{ name: "QALA route pack", extensions: ["json"] }],
    });
    if (open.canceled || !open.filePaths[0]) return null;
    const stat = await fs.stat(open.filePaths[0]);
    if (stat.size > 5000000) throw new Error("Pack too large");
    return fs.readFile(open.filePaths[0], "utf8");
  });
  ipcMain.handle("pack:clear", async (event) => {
    if (!authorized(event)) throw new Error("Invalid origin");
    const owned = path.join(await fs.realpath(storage), "packs");
    if ((await fs.realpath(owned)) !== owned)
      throw new Error("Managed pack folder was redirected");
    for (const entry of await fs.readdir(owned, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".qala.json")) {
        try {
          await fs.unlink(path.join(owned, entry.name));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    }
    await window.webContents.session.clearStorageData({
      storages: ["localstorage", "cachestorage"],
    });
    return true;
  });
  await window.loadURL("qala://app/index.html");
});
app.on("window-all-closed", () => app.quit());
