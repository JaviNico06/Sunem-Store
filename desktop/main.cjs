const {
  app,
  BrowserWindow,
  Menu,
  shell,
  session,
  dialog,
} = require("electron");
const path = require("node:path");
const config = require("./config.json");
const { validateSiteUrl, sameOrigin } = require("./url-policy.cjs");
let mainWindow;
let origin;
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
function loadPanel() {
  if (mainWindow)
    mainWindow.loadURL(origin + "/admin").catch(() => {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow
          .loadFile(path.join(__dirname, "offline.html"))
          .catch(() => {});
    });
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "Sunem",
    icon: path.join(__dirname, "icon.ico"),
    backgroundColor: "#fcfaf7",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (sameOrigin(url, origin)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!sameOrigin(url, origin)) event.preventDefault();
  });
  mainWindow.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  loadPanel();
}
app.whenReady().then(() => {
  try {
    origin = validateSiteUrl(process.env.DUNA_SITE_URL || config.siteUrl);
  } catch (e) {
    dialog.showErrorBox(
      "Configura tu boutique",
      e.message + " Consulta README.md.",
    );
    app.quit();
    return;
  }
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on("will-download", (event) => event.preventDefault());
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Boutique",
        submenu: [
          {
            label: "Abrir catálogo en navegador",
            click: () => void shell.openExternal(origin),
          },
          { type: "separator" },
          { role: "quit", label: "Salir" },
        ],
      },
      {
        label: "Edición",
        submenu: [
          { role: "undo", label: "Deshacer" },
          { role: "redo", label: "Rehacer" },
          { type: "separator" },
          { role: "cut", label: "Cortar" },
          { role: "copy", label: "Copiar" },
          { role: "paste", label: "Pegar" },
          { role: "selectAll", label: "Seleccionar todo" },
        ],
      },
      {
        label: "Vista",
        submenu: [
          {
            label: "Actualizar / reconectar",
            accelerator: "F5",
            click: loadPanel,
          },
          { role: "resetZoom", label: "Tamaño original" },
          { role: "zoomIn", label: "Acercar" },
          { role: "zoomOut", label: "Alejar" },
          { role: "togglefullscreen", label: "Pantalla completa" },
        ],
      },
    ]),
  );
  createWindow();
});
app.on("window-all-closed", () => app.quit());
