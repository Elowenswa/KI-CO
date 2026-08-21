export enum ArchiveRole {
  USER = "USER",
  AI = "AI",
  SYSTEM = "SYSTEM",
}

export interface ArchiveMessage {
  id: string;
  role: ArchiveRole;
  content: string;
  timestamp: string;
  timestampObj?: Date;
  speakerName?: string;
  model?: string;
  archiveKind?: "memory_write";
  metadata?: Record<string, unknown>;
  thoughts?: string;
  thoughtsTranslated?: string;
  safetyFlags?: string[];
}

export interface ArchiveSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  messages: ArchiveMessage[];
  messageCount: number;
  summary?: string;
  generatedContextSummary?: string;
  threadId?: string;
  threadTitle?: string;
}

const DB_NAME = "kico_memory_gallery_archives_v1";
const DB_VERSION = 1;
const STORE_NAME = "sessions";

class ArchiveDB {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private openDB(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("startTime", "startTime", { unique: false });
          store.createIndex("threadTitle", "threadTitle", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  async saveSessions(sessions: ArchiveSession[]): Promise<void> {
    const db = await this.openDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      sessions.forEach((session) => store.put(session));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllSessions(): Promise<ArchiveSession[]> {
    const db = await this.openDB();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("startTime");
      const request = index.openCursor(null, "prev");
      const results: ArchiveSession[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(id: string): Promise<ArchiveSession | undefined> {
    const db = await this.openDB();
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const request = transaction.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateSession(id: string, updates: Partial<ArchiveSession>): Promise<void> {
    const db = await this.openDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        const current = request.result;
        if (!current) {
          reject(new Error("Archive session not found"));
          return;
        }
        store.put({ ...current, ...updates });
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.openDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const archiveDb = new ArchiveDB();
