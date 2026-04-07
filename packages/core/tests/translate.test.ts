import { describe, expect, it, vi } from "vitest";
import { translate, type StorageAdapter } from "../src";

function memoryStorage(): StorageAdapter {
  const cache = new Map<string, { value: unknown; expiresAt: number }>();

  return {
    async getGlossary() {
      return {
        version: "1",
        terms: [{ source: "fine-tuning", target: "微调" }],
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
      return { promptVersion: "v1", cacheTtlMs: 60_000 };
    },
    async saveSettings() {},
  };
}

describe("translate", () => {
  it("returns a cache hit when available", async () => {
    const storage = memoryStorage();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "你好" } }],
      }),
    });

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
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
