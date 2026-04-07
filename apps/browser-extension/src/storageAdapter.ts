import type { Glossary, Settings, StorageAdapter, TranslateResponse } from "@llm-translator/core";

declare const chrome: ChromeApi;

type ChromeStorageRecord = {
  glossary?: Glossary;
  settings?: Settings;
  cache?: Record<string, CachedTranslateResponse>;
};

type CachedTranslateResponse = {
  value: TranslateResponse;
  expiresAt: number;
};

const DEFAULT_GLOSSARY: Glossary = {
  version: "1",
  terms: [],
};

const DEFAULT_SETTINGS: Settings = {
  promptVersion: "v1",
  cacheTtlMs: 24 * 60 * 60 * 1000,
};

export function createChromeStorageAdapter(): StorageAdapter {
  return {
    async getGlossary() {
      const data = await readStorage();
      return data.glossary ?? DEFAULT_GLOSSARY;
    },
    async saveGlossary(glossary) {
      await chrome.storage.local.set({ glossary });
    },
    async getCache(key) {
      const data = await readStorage();
      const entry = data.cache?.[key];
      if (!entry) {
        return null;
      }

      if (entry.expiresAt <= Date.now()) {
        await removeCacheEntry(key);
        return null;
      }

      return entry.value;
    },
    async setCache(key, value, ttlMs) {
      const data = await readStorage();
      const cache = data.cache ?? {};

      cache[key] = {
        value,
        expiresAt: Date.now() + ttlMs,
      };

      await chrome.storage.local.set({ cache });
    },
    async getSettings() {
      const data = await readStorage();
      return data.settings ?? DEFAULT_SETTINGS;
    },
    async saveSettings(settings) {
      await chrome.storage.local.set({ settings });
    },
  };
}

async function readStorage(): Promise<ChromeStorageRecord> {
  const data = await chrome.storage.local.get(["glossary", "settings", "cache"]);
  return data as ChromeStorageRecord;
}

async function removeCacheEntry(key: string): Promise<void> {
  const data = await readStorage();
  const cache = data.cache ?? {};

  if (!(key in cache)) {
    return;
  }

  delete cache[key];
  await chrome.storage.local.set({ cache });
}

type ChromeApi = {
  storage: {
    local: {
      get(keys: string[] | string): Promise<ChromeStorageRecord>;
      set(items: Partial<ChromeStorageRecord>): Promise<void>;
    };
  };
};
