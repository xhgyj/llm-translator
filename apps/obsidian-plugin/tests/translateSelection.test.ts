import { describe, expect, it, vi } from "vitest";
import type { StorageAdapter, TranslateRequest, TranslateResponse } from "@llm-translator/core";
import { ObsidianTranslatorController } from "../src/main";

function createStorage(): StorageAdapter {
  return {
    async getGlossary() {
      return { version: "1", terms: [] };
    },
    async saveGlossary() {},
    async getCache() {
      return null;
    },
    async setCache() {},
    async getSettings() {
      return { promptVersion: "v1", cacheTtlMs: 60_000 };
    },
    async saveSettings() {},
  };
}

describe("ObsidianTranslatorController.translateSelection", () => {
  it("captures selection, inserts a placeholder, and replaces it on success", async () => {
    const translateFn = vi.fn(
      async (_request: TranslateRequest): Promise<TranslateResponse> => ({
        translatedText: "你好",
        fromCache: false,
        latencyMs: 12,
      }),
    );

    const editor = {
      getSelectionText: () => "Hello world",
      getParagraphText: () => "",
      insertSelectionPlaceholder: vi.fn(() => "selection-placeholder"),
      insertParagraphPlaceholder: vi.fn(),
      replacePlaceholder: vi.fn(),
      markPlaceholderFailed: vi.fn(),
    };

    const controller = new ObsidianTranslatorController(
      editor,
      createStorage(),
      { baseUrl: "http://localhost:11434/v1", model: "qwen2.5", targetLang: "zh" },
      { translateFn },
    );

    await controller.translateSelection();

    expect(editor.getSelectionText()).toBe("Hello world");
    expect(editor.insertSelectionPlaceholder).toHaveBeenCalledWith("Translating...");
    expect(translateFn).toHaveBeenCalledTimes(1);
    expect(translateFn.mock.calls[0]?.[0]).toMatchObject({
      text: "Hello world",
      sourceLang: "auto",
      targetLang: "zh",
      model: "qwen2.5",
      baseUrl: "http://localhost:11434/v1",
    });
    expect(editor.replacePlaceholder).toHaveBeenCalledWith("selection-placeholder", "你好");
    expect(editor.markPlaceholderFailed).not.toHaveBeenCalled();
  });

  it("marks the placeholder failed when translation throws", async () => {
    const translateFn = vi.fn(async () => {
      throw new Error("upstream unavailable");
    });

    const editor = {
      getSelectionText: () => "Hello world",
      getParagraphText: () => "",
      insertSelectionPlaceholder: vi.fn(() => "selection-placeholder"),
      insertParagraphPlaceholder: vi.fn(),
      replacePlaceholder: vi.fn(),
      markPlaceholderFailed: vi.fn(),
    };

    const controller = new ObsidianTranslatorController(
      editor,
      createStorage(),
      { baseUrl: "http://localhost:11434/v1", model: "qwen2.5", targetLang: "zh" },
      { translateFn },
    );

    await controller.translateSelection();

    expect(editor.replacePlaceholder).not.toHaveBeenCalled();
    expect(editor.markPlaceholderFailed).toHaveBeenCalledWith(
      "selection-placeholder",
      "upstream unavailable",
    );
  });
});
