import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChromeStorageAdapter } from "../src/storageAdapter.js";

describe("createChromeStorageAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to the shared default glossary when storage is empty", async () => {
    const get = vi.fn(async () => ({}));

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get,
          set: vi.fn(async () => undefined),
          remove: vi.fn(async () => undefined),
        },
      },
    });

    const adapter = createChromeStorageAdapter();
    const glossary = await adapter.getGlossary();

    expect(glossary.version).toBe("1");
    expect(glossary.terms.length).toBeGreaterThan(0);
  });

  it("writes cache entries under per-key storage records", async () => {
    const set = vi.fn(async () => undefined);
    const get = vi.fn(async () => ({}));

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get,
          set,
        },
      },
    });

    const adapter = createChromeStorageAdapter();

    await adapter.setCache(
      "abc123",
      {
        translatedText: "你好",
        fromCache: false,
        latencyMs: 8,
      },
      60_000,
    );

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({
      "cache:abc123": expect.objectContaining({
        value: expect.objectContaining({
          translatedText: "你好",
          fromCache: false,
          latencyMs: 8,
        }),
        expiresAt: expect.any(Number),
      }),
    });
  });
});
