import {
  parseGlossary,
  type Glossary,
  type Settings,
  type StorageAdapter,
  type TranslateResponse,
} from "@llm-translator/core";
import sharedGlossaryFile from "../../../shared/glossary.json";

type CachedTranslateResponse = {
  value: TranslateResponse;
  expiresAt: number;
};

export type ObsidianStorageState = {
  glossary?: Glossary;
  settings?: Settings;
  cache?: Record<string, CachedTranslateResponse>;
};

type StateReader = () => ObsidianStorageState;
type StateWriter = (nextState: ObsidianStorageState) => Promise<void>;

const DEFAULT_GLOSSARY = parseGlossary(sharedGlossaryFile);

const DEFAULT_SETTINGS: Settings = {
  promptVersion: "v1",
  cacheTtlMs: 24 * 60 * 60 * 1000,
};

export class ObsidianStorageAdapter implements StorageAdapter {
  constructor(
    private readonly readState: StateReader,
    private readonly writeState: StateWriter,
  ) {}

  async getGlossary(): Promise<Glossary> {
    const state = this.readState();
    try {
      return state.glossary ? parseGlossary(state.glossary) : DEFAULT_GLOSSARY;
    } catch {
      return DEFAULT_GLOSSARY;
    }
  }

  async saveGlossary(glossary: Glossary): Promise<void> {
    const state = this.readState();
    await this.writeState({
      ...state,
      glossary,
    });
  }

  async getCache(key: string): Promise<TranslateResponse | null> {
    const state = this.readState();
    const cacheKey = getCacheStorageKey(key);
    const entry = state.cache?.[cacheKey];
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      const nextCache = { ...(state.cache ?? {}) };
      delete nextCache[cacheKey];
      await this.writeState({
        ...state,
        cache: nextCache,
      });
      return null;
    }

    return entry.value;
  }

  async setCache(key: string, value: TranslateResponse, ttlMs: number): Promise<void> {
    const state = this.readState();
    await this.writeState({
      ...state,
      cache: {
        ...(state.cache ?? {}),
        [getCacheStorageKey(key)]: {
          value,
          expiresAt: Date.now() + ttlMs,
        },
      },
    });
  }

  async getSettings(): Promise<Settings> {
    const state = this.readState();
    return state.settings ?? DEFAULT_SETTINGS;
  }

  async saveSettings(settings: Settings): Promise<void> {
    const state = this.readState();
    await this.writeState({
      ...state,
      settings,
    });
  }
}

function getCacheStorageKey(key: string): string {
  return `cache:${key}`;
}
