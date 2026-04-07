import { describe, expect, it } from "vitest";
import { createCacheKey } from "../src";

describe("createCacheKey", () => {
  it("returns a stable key for the same input", () => {
    const input = {
      text: "Hello world",
      sourceLang: "auto",
      targetLang: "zh",
      model: "gpt-4o-mini",
      baseUrl: "http://localhost:11434/v1",
      glossaryVersion: "1",
      promptVersion: "v1",
    };

    expect(createCacheKey(input)).toBe(createCacheKey(input));
  });

  it("changes when the model changes", () => {
    const base = {
      text: "Hello world",
      sourceLang: "auto",
      targetLang: "zh",
      baseUrl: "http://localhost:11434/v1",
      glossaryVersion: "1",
      promptVersion: "v1",
    };

    const keyA = createCacheKey({ ...base, model: "model-a" });
    const keyB = createCacheKey({ ...base, model: "model-b" });

    expect(keyA).not.toBe(keyB);
  });
});
