/// <reference types="vite/client" />

interface KicoDesktopFileResult {
  success: boolean;
  canceled?: boolean;
  error?: string;
  url?: string;
  path?: string;
  name?: string;
  dataBase64?: string;
}

interface KicoDesktopBridge {
  isElectron: boolean;
  platform?: string;
  versions?: {
    chrome?: string;
    electron?: string;
    node?: string;
  };
  getAppVersion?: () => Promise<string>;
  registerLocalFile?: (filePath: string) => Promise<KicoDesktopFileResult>;
  pickVideoFile?: () => Promise<KicoDesktopFileResult>;
  pickSubtitleFile?: () => Promise<KicoDesktopFileResult>;
  readTextFile?: (filePath: string) => Promise<KicoDesktopFileResult>;
}

interface Window {
  kicoDesktop?: KicoDesktopBridge;
}
