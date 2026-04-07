const sourceTextNode = getRequiredElement("sourceText");
const translatedTextNode = getRequiredElement("translatedText");
const modeTagNode = getRequiredElement("modeTag");
const params = new URLSearchParams(window.location.search);

sourceTextNode.textContent = params.get("source") ?? "";
translatedTextNode.textContent = params.get("translated") ?? "";

const mode = params.get("mode");
if (mode === "pdf") {
  modeTagNode.textContent = "PDF Mode";
  modeTagNode.hidden = false;
}

function getRequiredElement(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing node: ${id}`);
  }

  return node;
}

export {};
