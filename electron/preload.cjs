const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("kicoDesktop", {
  isElectron: true,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  getAppVersion: () => invoke("kico:get-app-version"),
  registerLocalFile: (filePath) => invoke("kico:register-local-file", filePath),
  pickVideoFile: () => invoke("kico:pick-video-file"),
  pickSubtitleFile: () => invoke("kico:pick-subtitle-file"),
  readTextFile: (filePath) => invoke("kico:read-text-file", filePath),
});
