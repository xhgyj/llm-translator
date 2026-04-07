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

describe("ObsidianTranslatorController.translateParagraph", () => {
  it("captures paragraph text, inserts a placeholder, and replaces it on success", async () => {
    const translateFn = vi.fn(
      async (_request: TranslateRequest): Promise<TranslateResponse> => ({
        translatedText: "你好，段落",
        fromCache: false,
        latencyMs: 9,
      }),
    );

    const editor = {
      getSelectionText: () => "",
      getParagraphText: () => "Hello paragraph",
      insertSelectionPlaceholder: vi.fn(),
      insertParagraphPlaceholder: vi.fn(() => "paragraph-placeholder"),
      replacePlaceholder: vi.fn(),
      markPlaceholderFailed: vi.fn(),
    };

    const controller = new ObsidianTranslatorController(
      editor,
      createStorage(),
      { baseUrl: "http://localhost:11434/v1", model: "qwen2.5", targetLang: "zh" },
      { translateFn },
    );

    await controller.translateParagraph();

    expect(editor.insertParagraphPlaceholder).toHaveBeenCalledWith("Translating...");
    expect(translateFn).toHaveBeenCalledTimes(1);
    expect(translateFn.mock.calls[0]?.[0]).toMatchObject({
      text: "Hello paragraph",
      sourceLang: "auto",
      targetLang: "zh",
      model: "qwen2.5",
      baseUrl: "http://localhost:11434/v1",
    });
    expect(editor.replacePlaceholder).toHaveBeenCalledWith("paragraph-placeholder", "你好，段落");
    expect(editor.markPlaceholderFailed).not.toHaveBeenCalled();
  });

  it("marks the paragraph placeholder failed when translation throws", async () => {
    const translateFn = vi.fn(async () => {
      throw new Error("upstream unavailable");
    });

    const editor = {
      getSelectionText: () => "",
      getParagraphText: () => "Hello paragraph",
      insertSelectionPlaceholder: vi.fn(),
      insertParagraphPlaceholder: vi.fn(() => "paragraph-placeholder"),
      replacePlaceholder: vi.fn(),
      markPlaceholderFailed: vi.fn(),
    };

    const controller = new ObsidianTranslatorController(
      editor,
      createStorage(),
      { baseUrl: "http://localhost:11434/v1", model: "qwen2.5", targetLang: "zh" },
      { translateFn },
    );

    await controller.translateParagraph();

    expect(editor.insertParagraphPlaceholder).toHaveBeenCalledWith("Translating...");
    expect(editor.replacePlaceholder).not.toHaveBeenCalled();
    expect(editor.markPlaceholderFailed).toHaveBeenCalledWith(
      "paragraph-placeholder",
      "upstream unavailable",
    );
    expect(translateFn).toHaveBeenCalledTimes(1);
  });
});
