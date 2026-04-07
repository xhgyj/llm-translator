export type TemporaryOverlayOptions = {
  sourceText: string;
  translatedText: string;
  allowPin: boolean;
  dismissOnSelectionClear?: boolean;
  onPin?: () => void;
};

export type TemporaryOverlayHandle = {
  element: HTMLElement;
  dispose: () => void;
};

export function showTemporaryTranslationOverlay(
  options: TemporaryOverlayOptions,
): TemporaryOverlayHandle {
  const overlay = document.createElement("div");
  overlay.setAttribute("data-llm-translator-obsidian-overlay", "true");
  overlay.setAttribute(
    "style",
    "position:fixed;right:16px;bottom:16px;width:420px;max-height:60vh;overflow-y:auto;" +
      "border-radius:10px;padding:12px;z-index:9999;background:#ffffff;" +
      "box-shadow:0 12px 30px rgba(0,0,0,0.2);border:1px solid #d0d7de;" +
      "color:#111827;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI;",
  );

  const title = document.createElement("div");
  title.textContent = "Temporary translation";
  title.setAttribute("style", "font-weight:600;margin-bottom:8px;");
  overlay.append(title);

  const source = document.createElement("pre");
  source.textContent = options.sourceText;
  source.setAttribute("style", "margin:0 0 8px;white-space:pre-wrap;font-size:12px;opacity:0.75;");
  overlay.append(source);

  const translated = document.createElement("pre");
  translated.textContent = options.translatedText;
  translated.setAttribute("style", "margin:0;white-space:pre-wrap;font-size:13px;line-height:1.5;");
  overlay.append(translated);

  const actions = document.createElement("div");
  actions.setAttribute(
    "style",
    "display:flex;justify-content:flex-end;gap:8px;margin-top:10px;",
  );

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.onclick = () => {
    dispose();
  };
  actions.append(closeButton);

  if (options.allowPin && options.onPin) {
    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.textContent = "Pin to note";
    pinButton.setAttribute("data-llm-translator-obsidian-pin", "true");
    pinButton.onclick = () => {
      options.onPin?.();
      dispose();
    };
    actions.append(pinButton);
  }

  overlay.append(actions);
  document.body.append(overlay);

  const onSelectionChange = () => {
    const selection = window.getSelection();
    const hasSelection =
      !!selection && selection.rangeCount > 0 && selection.toString().trim().length > 0;
    if (!hasSelection) {
      dispose();
    }
  };

  const canListenSelectionChange =
    typeof (document as unknown as { addEventListener?: unknown }).addEventListener === "function";

  if ((options.dismissOnSelectionClear ?? true) && canListenSelectionChange) {
    document.addEventListener("selectionchange", onSelectionChange);
  }

  function dispose(): void {
    if (overlay.parentElement) {
      overlay.remove();
    }

    if (
      typeof (document as unknown as { removeEventListener?: unknown }).removeEventListener ===
      "function"
    ) {
      document.removeEventListener("selectionchange", onSelectionChange);
    }
  }

  return {
    element: overlay,
    dispose,
  };
}
