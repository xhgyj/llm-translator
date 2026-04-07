export const PLACEHOLDER_ATTR = "data-llm-translator-placeholder";

export function getSelectionText(selection: Selection | null = window.getSelection()): string {
  return selection?.toString().trim() ?? "";
}

export function getParagraphNodeFromSelection(selection: Selection | null = window.getSelection()): Element | null {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const anchor = getElementFromNode(range.startContainer);
  if (!anchor) {
    return null;
  }

  return anchor.closest("p, li, blockquote, pre, td, th, h1, h2, h3, h4, h5, h6");
}

export function insertPlaceholderBelow(sourceNode: Element, placeholderText: string): HTMLElement {
  const placeholder = document.createElement("div");
  placeholder.setAttribute(PLACEHOLDER_ATTR, "true");
  placeholder.dataset.llmTranslatorState = "pending";
  placeholder.textContent = placeholderText;

  sourceNode.insertAdjacentElement("afterend", placeholder);
  return placeholder;
}

export function replacePlaceholder(placeholderNode: HTMLElement, translatedText: string): void {
  placeholderNode.dataset.llmTranslatorState = "resolved";
  placeholderNode.textContent = translatedText;
}

export function markPlaceholderFailed(placeholderNode: HTMLElement, reason: string): void {
  placeholderNode.dataset.llmTranslatorState = "failed";
  placeholderNode.textContent = reason;
}

export function getParagraphTextFromSelection(selection: Selection | null = window.getSelection()): string {
  const paragraph = getParagraphNodeFromSelection(selection);
  return paragraph?.textContent?.trim() ?? "";
}

function getElementFromNode(node: Node): Element | null {
  if (node.nodeType === Node.ELEMENT_NODE) {
    return node as Element;
  }

  return node.parentElement;
}
