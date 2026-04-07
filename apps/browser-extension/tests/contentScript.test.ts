import { beforeEach, describe, expect, it } from "vitest";
import { getParagraphNodeFromSelection, insertPlaceholderBelow, replacePlaceholder } from "../src/contentScript.js";

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
    replacePlaceholder(placeholder, "你好");

    expect(placeholder.dataset.llmTranslatorState).toBe("resolved");
    expect(placeholder.textContent).toBe("你好");
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
