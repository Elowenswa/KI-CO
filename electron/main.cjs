const { app, BrowserWindow, dialog, ipcMain, protocol, screen, shell } = require("electron");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");

const appRoot = path.resolve(__dirname, "..");
const devServerUrl = process.env.ELECTRON_START_URL || process.env.VITE_DEV_SERVER_URL || "";
const localFileRegistry = new Map();
const MAIN_WINDOW_STATE_FILE = "main-window-state.json";
const MIN_MAIN_WINDOW_WIDTH = 390;
const MIN_MAIN_WINDOW_HEIGHT = 700;
const DEFAULT_MAIN_WINDOW_WIDTH = 1180;
const DEFAULT_MAIN_WINDOW_HEIGHT = 820;
const DEFAULT_WINDOW_SCREEN_MARGIN = 48;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "kico-local",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

function resolveWindowIcon() {
  const icoPath = path.join(appRoot, "build", "icon.ico");
  if (process.platform === "win32" && fs.existsSync(icoPath)) return icoPath;
  return path.join(appRoot, "public", "pwa-icon-512.png");
}

function isSafeAppUrl(url) {
  if (devServerUrl && url.startsWith(devServerUrl)) return true;
  return url.startsWith("file://");
}

function getWindowStatePath() {
  return path.join(app.getPath("userData"), MAIN_WINDOW_STATE_FILE);
}

function getDefaultMainWindowBounds() {
  const { workAreaSize } = screen.getPrimaryDisplay();
  return {
    width: Math.max(MIN_MAIN_WINDOW_WIDTH, Math.min(DEFAULT_MAIN_WINDOW_WIDTH, workAreaSize.width - DEFAULT_WINDOW_SCREEN_MARGIN)),
    height: Math.max(MIN_MAIN_WINDOW_HEIGHT, Math.min(DEFAULT_MAIN_WINDOW_HEIGHT, workAreaSize.height - DEFAULT_WINDOW_SCREEN_MARGIN)),
  };
}

function normalizeWindowBounds(bounds) {
  const defaults = getDefaultMainWindowBounds();
  const width = Math.max(MIN_MAIN_WINDOW_WIDTH, Math.round(Number(bounds?.width) || defaults.width));
  const height = Math.max(MIN_MAIN_WINDOW_HEIGHT, Math.round(Number(bounds?.height) || defaults.height));
  const normalized = { width, height };
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    normalized.x = Math.round(x);
    normalized.y = Math.round(y);
  }
  return normalized;
}

function readMainWindowBounds() {
  try {
    const raw = fs.readFileSync(getWindowStatePath(), "utf8");
    return normalizeWindowBounds(JSON.parse(raw));
  } catch {
    return getDefaultMainWindowBounds();
  }
}

function saveMainWindowBounds(win) {
  if (!win || win.isDestroyed()) return;
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(win.getNormalBounds(), null, 2), "utf8");
  } catch (error) {
    console.warn("[KI-CO] Failed to save window bounds:", error);
  }
}

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function registerLocalFile(filePath) {
  const resolvedPath = path.resolve(String(filePath || ""));
  if (!fs.existsSync(resolvedPath)) {
    throw new Error("Local file does not exist.");
  }

  const token = randomUUID();
  localFileRegistry.set(token, resolvedPath);
  return {
    path: resolvedPath,
    name: path.basename(resolvedPath),
    url: `kico-local://file/${token}/${encodeURIComponent(path.basename(resolvedPath))}`,
  };
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".mp4", ".m4v"].includes(ext)) return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mkv") return "video/x-matroska";
  if (ext === ".avi") return "video/x-msvideo";
  if (ext === ".ogg") return "video/ogg";
  if ([".srt", ".vtt", ".ass", ".ssa", ".txt"].includes(ext)) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

async function createLocalFileResponse(filePath, request) {
  const stat = await fs.promises.stat(filePath);
  const size = stat.size;
  const range = request.headers.get("range");
  const baseHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Type": getMimeType(filePath),
  };

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes */${size}`,
        },
      });
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    const safeStart = Math.min(Math.max(0, start), Math.max(0, size - 1));
    const safeEnd = Math.min(Math.max(safeStart, end), Math.max(0, size - 1));
    const contentLength = safeEnd - safeStart + 1;
    const stream = fs.createReadStream(filePath, { start: safeStart, end: safeEnd });

    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(contentLength),
        "Content-Range": `bytes ${safeStart}-${safeEnd}/${size}`,
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream), {
    headers: {
      ...baseHeaders,
      "Content-Length": String(size),
    },
  });
}

function registerLocalFileProtocol() {
  protocol.handle("kico-local", async (request) => {
    try {
      const parsed = new URL(request.url);
      const token = parsed.pathname.split("/").filter(Boolean)[0];
      const filePath = token ? localFileRegistry.get(token) : null;
      if (!filePath) return new Response("Local file not registered.", { status: 404 });
      return createLocalFileResponse(filePath, request);
    } catch (error) {
      return new Response(error instanceof Error ? error.message : String(error), { status: 500 });
    }
  });
}

function createMainWindow() {
  const windowBounds = readMainWindowBounds();
  let saveWindowBoundsTimer = null;
  const win = new BrowserWindow({
    ...windowBounds,
    minWidth: MIN_MAIN_WINDOW_WIDTH,
    minHeight: MIN_MAIN_WINDOW_HEIGHT,
    show: false,
    title: "KI-CO",
    backgroundColor: "#15110e",
    icon: resolveWindowIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: "persist:kico-cottage",
    },
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  const scheduleWindowBoundsSave = () => {
    if (saveWindowBoundsTimer) clearTimeout(saveWindowBoundsTimer);
    saveWindowBoundsTimer = setTimeout(() => saveMainWindowBounds(win), 350);
  };

  win.on("resize", scheduleWindowBoundsSave);
  win.on("move", scheduleWindowBoundsSave);
  win.on("close", () => {
    if (saveWindowBoundsTimer) clearTimeout(saveWindowBoundsTimer);
    saveMainWindowBounds(win);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (isSafeAppUrl(url)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
  });

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(path.join(appRoot, "dist", "index.html"));
  }

  return win;
}

app.setAppUserModelId("com.kisera.kico");

ipcMain.handle("kico:get-app-version", () => app.getVersion());

ipcMain.handle("kico:register-local-file", async (_event, filePath) => {
  try {
    return { success: true, ...registerLocalFile(filePath) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("kico:pick-video-file", async (event) => {
  const win = getSenderWindow(event);
  const result = await dialog.showOpenDialog(win || undefined, {
    title: "选择影片",
    properties: ["openFile"],
    filters: [
      { name: "Video", extensions: ["mp4", "m4v", "mov", "webm", "mkv", "avi", "rmvb", "ogg"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true };

  try {
    return { success: true, ...registerLocalFile(result.filePaths[0]) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("kico:pick-subtitle-file", async (event) => {
  const win = getSenderWindow(event);
  const result = await dialog.showOpenDialog(win || undefined, {
    title: "选择字幕",
    properties: ["openFile"],
    filters: [
      { name: "Subtitles", extensions: ["srt", "vtt", "ass", "ssa"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true };

  try {
    const filePath = path.resolve(result.filePaths[0]);
    const buffer = await fs.promises.readFile(filePath);
    return { success: true, path: filePath, name: path.basename(filePath), dataBase64: buffer.toString("base64") };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("kico:read-text-file", async (_event, filePath) => {
  try {
    const buffer = await fs.promises.readFile(path.resolve(String(filePath || "")));
    return { success: true, dataBase64: buffer.toString("base64") };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

app.whenReady().then(() => {
  registerLocalFileProtocol();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
