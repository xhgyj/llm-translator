import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChromeStorageAdapter } from "../src/storageAdapter.js";

describe("createChromeStorageAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
