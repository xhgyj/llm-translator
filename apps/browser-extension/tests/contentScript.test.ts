import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getParagraphNodeFromSelection,
  insertPlaceholderBelow,
  replacePlaceholder,
} from "../src/contentScript.js";
import {
  translateParagraphFromPage,
  translateSelectionFromPage,
} from "../src/contentScriptRuntime.js";

describe("contentScript placeholder helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("inserts a placeholder immediately after the source element", () => {
    const root = document.createElement("div");
    const paragraph = document.createElement("p");
    paragraph.textContent = "Hello world";
    root.append(paragraph);
    document.body.append(root);

    const placeholder = insertPlaceholderBelow(paragraph, "Translating...");

    expect(root.lastElementChild).toBe(placeholder);
    expect(placeholder.getAttribute("data-llm-translator-placeholder")).toBe("true");
    expect(placeholder.dataset.llmTranslatorState).toBe("pending");
    expect(placeholder.textContent).toBe("Translating...");
  });

  it("replaces placeholder content in place", () => {
    const placeholder = document.createElement("div");
    replacePlaceholder(placeholder, "Translated text");

    expect(placeholder.dataset.llmTranslatorState).toBe("resolved");
    expect(placeholder.textContent).toBe("Translated text");
  });
});

describe("getParagraphNodeFromSelection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns the closest paragraph-like element for the current selection", () => {
    const paragraph = document.createElement("p");
    const span = document.createElement("span");
    span.textContent = "Selected text";
    paragraph.append(span);
    document.body.append(paragraph);

    const range = document.createRange();
    range.selectNodeContents(span);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(getParagraphNodeFromSelection(selection)?.tagName).toBe("P");
  });
});

describe("translateSelectionFromPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("captures the selected text, inserts a placeholder, sends a translate message, and replaces the placeholder", async () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Hello world";
    document.body.append(paragraph);

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const sendMessage = vi.fn(async () => ({
      ok: true as const,
      result: {
        translatedText: "Translated text",
        fromCache: false,
        latencyMs: 12,
      },
    }));
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
      },
    });

    await translateSelectionFromPage({
      placeholderText: "Translating...",
      targetLang: "zh",
      model: "qwen2.5",
      baseUrl: "http://localhost:11434/v1",
    });

    const placeholder = document.body.querySelector("[data-llm-translator-placeholder='true']");

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      type: "translate",
      request: {
        text: "Hello world",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
    });
    expect(placeholder?.textContent).toBe("Translated text");
    expect(placeholder?.dataset.llmTranslatorState).toBe("resolved");
  });
});

describe("translateParagraphFromPage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("captures the containing paragraph text and sends a translate message", async () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Paragraph text";
    document.body.append(paragraph);

    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const sendMessage = vi.fn(async () => ({
      ok: true as const,
      result: {
        translatedText: "Paragraph translated",
        fromCache: false,
        latencyMs: 9,
      },
    }));
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage,
      },
    });

    await translateParagraphFromPage({
      placeholderText: "Translating...",
      targetLang: "zh",
      model: "qwen2.5",
      baseUrl: "http://localhost:11434/v1",
    });

    expect(sendMessage).toHaveBeenCalledWith({
      type: "translate",
      request: {
        text: "Paragraph text",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
    });
    expect(document.body.querySelector("[data-llm-translator-placeholder='true']")?.textContent).toBe(
      "Paragraph translated",
    );
  });
});
