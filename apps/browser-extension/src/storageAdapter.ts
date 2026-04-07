import type { Glossary, Settings, StorageAdapter, TranslateResponse } from "@llm-translator/core";

type ChromeStorageRecord = {
  glossary?: Glossary;
  settings?: Settings;
  [key: string]: Glossary | Settings | CachedTranslateResponse | undefined;
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
      const chromeApi = getChromeApi();
      const data = await chromeApi.storage.local.get("glossary");
      return (data.glossary as Glossary | undefined) ?? DEFAULT_GLOSSARY;
    },
    async saveGlossary(glossary) {
      const chromeApi = getChromeApi();
      await chromeApi.storage.local.set({ glossary });
    },
    async getCache(key) {
      const chromeApi = getChromeApi();
      const storageKey = getCacheStorageKey(key);
      const data = await chromeApi.storage.local.get(storageKey);
      const entry = data[storageKey] as CachedTranslateResponse | undefined;
      if (!entry) {
        return null;
      }

      if (entry.expiresAt <= Date.now()) {
        await chromeApi.storage.local.remove(storageKey);
        return null;
      }

      return entry.value;
    },
    async setCache(key, value, ttlMs) {
      const chromeApi = getChromeApi();
      await chromeApi.storage.local.set({
        [getCacheStorageKey(key)]: {
          value,
          expiresAt: Date.now() + ttlMs,
        },
      });
    },
    async getSettings() {
      const chromeApi = getChromeApi();
      const data = await chromeApi.storage.local.get("settings");
      return (data.settings as Settings | undefined) ?? DEFAULT_SETTINGS;
    },
    async saveSettings(settings) {
      const chromeApi = getChromeApi();
      await chromeApi.storage.local.set({ settings });
    },
  };
}

function getCacheStorageKey(key: string): string {
  return `cache:${key}`;
}

type ChromeApi = {
  storage: {
    local: {
      get(keys: string[] | string): Promise<ChromeStorageRecord>;
      set(items: Partial<ChromeStorageRecord>): Promise<void>;
      remove(keys: string[] | string): Promise<void>;
    };
  };
};

function getChromeApi(): ChromeApi {
  const chromeApi = (globalThis as { chrome?: ChromeApi }).chrome;
  if (!chromeApi) {
    throw new Error("chrome.storage is not available");
  }

  return chromeApi;
}
