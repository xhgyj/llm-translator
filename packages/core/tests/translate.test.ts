import { describe, expect, it, vi } from "vitest";
import { ConfigError, translate, type StorageAdapter } from "../src";

type StoredCacheEntry = {
  value: unknown;
  expiresAt: number;
};

type MemoryStorageOptions = {
  glossaryVersion?: string;
  promptVersion?: string;
  cacheTtlMs?: number;
  glossaryTerms?: Array<{ source: string; target: string }>;
  seededCache?: Record<string, unknown>;
};

function createMemoryStorage(options: MemoryStorageOptions = {}): StorageAdapter {
  const cache = new Map<string, StoredCacheEntry>();
  const glossaryVersion = options.glossaryVersion ?? "1";
  const promptVersion = options.promptVersion ?? "v1";
  const cacheTtlMs = options.cacheTtlMs ?? 60_000;
  const glossaryTerms =
    options.glossaryTerms ?? [{ source: "fine-tuning", target: "微调" }];

  if (options.seededCache) {
    for (const [key, value] of Object.entries(options.seededCache)) {
      cache.set(key, { value, expiresAt: Number.POSITIVE_INFINITY });
    }
  }

  return {
    async getGlossary() {
      return {
        version: glossaryVersion,
        terms: glossaryTerms,
      };
    },
    async saveGlossary() {},
    async getCache(key) {
      const hit = cache.get(key);
      if (!hit || hit.expiresAt < Date.now()) {
        return null;
      }

      return hit.value as never;
    },
    async setCache(key, value, ttlMs) {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    async getSettings() {
      return { promptVersion, cacheTtlMs };
    },
    async saveSettings() {},
  };
}

function createFetchResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  };
}

function createUpstreamFailure(status = 500) {
  return {
    ok: false,
    status,
    text: async () => "upstream unavailable",
    json: async () => {
      throw new Error("unexpected json read");
    },
  };
}

describe("translate", () => {
  it.each([
    { field: "text", request: { text: "   " } },
    { field: "sourceLang", request: { sourceLang: "   " } },
    { field: "targetLang", request: { targetLang: "   " } },
    { field: "model", request: { model: "   " } },
    { field: "baseUrl", request: { baseUrl: "   " } },
  ])("throws when required request config %s is missing", async ({ request }) => {
    const storage = createMemoryStorage();

    await expect(
      translate(
        {
          text: "hello",
          sourceLang: "auto",
          targetLang: "zh",
          model: "qwen2.5",
          baseUrl: "http://localhost:11434/v1",
          ...request,
        },
        { storage, fetchImpl: vi.fn() },
      ),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("throws when required settings config is missing", async () => {
    const storage = {
      ...createMemoryStorage(),
      getSettings: async () => ({ promptVersion: "   ", cacheTtlMs: -1 }),
    } satisfies StorageAdapter;

    await expect(
      translate(
        {
          text: "hello",
          sourceLang: "auto",
          targetLang: "zh",
          model: "qwen2.5",
          baseUrl: "http://localhost:11434/v1",
        },
        { storage, fetchImpl: vi.fn() },
      ),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("returns a cache hit when available", async () => {
    const storage = createMemoryStorage();
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse("你好"));

    const first = await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );
    const second = await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    expect(first.fromCache).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(second.latencyMs).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bypasses cache when forceRefresh is true", async () => {
    const storage = createMemoryStorage();
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse("你好"));

    await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    const refreshed = await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
        forceRefresh: true,
      },
      { storage, fetchImpl: fetchMock },
    );

    expect(refreshed.fromCache).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("includes glossary guidance in the composed prompt", async () => {
    const storage = createMemoryStorage({
      glossaryTerms: [{ source: "fine-tuning", target: "微调" }],
    });
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse("你好"));

    await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(requestInit?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(body.messages[0]?.content).toContain(
      "Glossary (must prefer these translations):",
    );
    expect(body.messages[0]?.content).toContain("fine-tuning => 微调");
    expect(body.messages[1]?.content).toBe("hello");
  });

  it("persists translated responses to cache", async () => {
    const storage = createMemoryStorage();
    const setCache = vi.spyOn(storage, "setCache");
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse("你好"));

    const result = await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    expect(result.fromCache).toBe(false);
    expect(setCache).toHaveBeenCalledTimes(1);
    expect(setCache.mock.calls[0]?.[1]).toMatchObject({
      translatedText: "你好",
      fromCache: false,
    });
    expect(setCache.mock.calls[0]?.[2]).toBe(60_000);
  });

  it("invalidates cache when glossary version changes", async () => {
    let glossaryVersion = "1";
    const storage = {
      ...createMemoryStorage(),
      getGlossary: async () => ({
        version: glossaryVersion,
        terms: [{ source: "fine-tuning", target: "微调" }],
      }),
    } satisfies StorageAdapter;
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse("你好"));

    await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    glossaryVersion = "2";

    await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("invalidates cache when prompt version changes", async () => {
    let promptVersion = "v1";
    const storage = {
      ...createMemoryStorage(),
      getSettings: async () => ({ promptVersion, cacheTtlMs: 60_000 }),
    } satisfies StorageAdapter;
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse("你好"));

    await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    promptVersion = "v2";

    await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries when the upstream fails before succeeding", async () => {
    const storage = createMemoryStorage();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createUpstreamFailure())
      .mockResolvedValueOnce(createFetchResponse("你好"));

    const result = await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    expect(result.translatedText).toBe("你好");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats baseUrl trailing slashes as the same cache entry", async () => {
    const storage = createMemoryStorage();
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse("你好"));

    await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      { storage, fetchImpl: fetchMock },
    );

    const second = await translate(
      {
        text: "hello",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1/",
      },
      { storage, fetchImpl: fetchMock },
    );

    expect(second.fromCache).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
