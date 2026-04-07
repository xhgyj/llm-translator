const sourceTextNode = getRequiredElement("sourceText");
const translatedTextNode = getRequiredElement("translatedText");
const params = new URLSearchParams(window.location.search);

sourceTextNode.textContent = params.get("source") ?? "";
translatedTextNode.textContent = params.get("translated") ?? "";

function getRequiredElement(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing node: ${id}`);
  }

  return node;
}

export {};
