import { beforeEach, describe, expect, it } from "vitest";
import { getParagraphNodeFromSelection } from "../src/contentScript.js";

describe("getParagraphNodeFromSelection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns null when there is no selection", () => {
    const selection = window.getSelection();
    selection?.removeAllRanges();

    expect(getParagraphNodeFromSelection(selection)).toBeNull();
  });

  it("finds the containing list item from a nested selection", () => {
    const list = document.createElement("ul");
    const item = document.createElement("li");
    const span = document.createElement("span");

    span.textContent = "List item text";
    item.append(span);
    list.append(item);
    document.body.append(list);

    const range = document.createRange();
    range.selectNodeContents(span);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const paragraphNode = getParagraphNodeFromSelection(selection);
    expect(paragraphNode).not.toBeNull();
    expect(paragraphNode!.tagName).toBe("LI");
  });
});
