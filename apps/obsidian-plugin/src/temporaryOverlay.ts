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
    "position:fixed;right:20px;bottom:20px;width:min(560px,calc(100vw - 32px));" +
      "max-height:72vh;overflow-y:auto;border-radius:14px;padding:0;z-index:9999;" +
      "background:var(--background-primary,#fff);" +
      "box-shadow:0 24px 60px rgba(0,0,0,0.28);" +
      "border:1px solid var(--background-modifier-border,#c8ccd0);" +
      "color:var(--text-normal,#1f2937);font-family:var(--font-interface);",
  );

  const header = document.createElement("div");
  header.setAttribute(
    "style",
    "display:flex;align-items:center;justify-content:space-between;padding:12px 14px;" +
      "border-bottom:1px solid var(--background-modifier-border,#c8ccd0);" +
      "background:linear-gradient(135deg,var(--background-secondary,#f7f7f8),var(--background-primary,#fff));",
  );
  overlay.append(header);

  const title = document.createElement("div");
  title.textContent = "Translation Preview";
  title.setAttribute("style", "font-weight:700;letter-spacing:0.2px;");
  header.append(title);

  const tag = document.createElement("span");
  tag.textContent = "Temporary";
  tag.setAttribute(
    "style",
    "font-size:11px;padding:2px 8px;border-radius:999px;" +
      "border:1px solid var(--interactive-accent,#4f46e5);" +
      "color:var(--interactive-accent,#4f46e5);",
  );
  header.append(tag);

  const body = document.createElement("div");
  body.setAttribute("style", "padding:12px 14px 8px;display:grid;gap:10px;");
  overlay.append(body);

  const sourceBlock = document.createElement("div");
  sourceBlock.setAttribute(
    "style",
    "border:1px solid var(--background-modifier-border,#c8ccd0);" +
      "border-radius:10px;padding:10px;background:var(--background-secondary,#f7f7f8);",
  );
  body.append(sourceBlock);

  const sourceLabel = document.createElement("div");
  sourceLabel.textContent = "Source";
  sourceLabel.setAttribute("style", "font-size:11px;opacity:0.75;margin-bottom:6px;");
  sourceBlock.append(sourceLabel);

  const source = document.createElement("pre");
  source.textContent = options.sourceText;
  source.setAttribute("style", "margin:0;white-space:pre-wrap;font-size:12px;line-height:1.5;");
  sourceBlock.append(source);

  const translatedBlock = document.createElement("div");
  translatedBlock.setAttribute(
    "style",
    "border:1px solid var(--interactive-accent,#4f46e5);" +
      "border-radius:10px;padding:10px;background:color-mix(in srgb, var(--interactive-accent,#4f46e5) 7%, transparent);",
  );
  body.append(translatedBlock);

  const translatedLabel = document.createElement("div");
  translatedLabel.textContent = "Translated";
  translatedLabel.setAttribute("style", "font-size:11px;opacity:0.8;margin-bottom:6px;");
  translatedBlock.append(translatedLabel);

  const translated = document.createElement("pre");
  translated.textContent = options.translatedText;
  translated.setAttribute(
    "style",
    "margin:0;white-space:pre-wrap;font-size:13px;line-height:1.65;font-weight:500;",
  );
  translatedBlock.append(translated);

  const actions = document.createElement("div");
  actions.setAttribute(
    "style",
    "display:flex;justify-content:flex-end;gap:8px;padding:0 14px 12px;",
  );
  overlay.append(actions);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.setAttribute(
    "style",
    "border:1px solid var(--background-modifier-border,#c8ccd0);" +
      "border-radius:8px;padding:6px 12px;background:var(--background-secondary,#f7f7f8);" +
      "color:var(--text-normal,#1f2937);cursor:pointer;",
  );
  closeButton.onclick = () => {
    dispose();
  };
  actions.append(closeButton);

  if (options.allowPin && options.onPin) {
    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.textContent = "Pin to note";
    pinButton.setAttribute("data-llm-translator-obsidian-pin", "true");
    pinButton.setAttribute(
      "style",
      "border:1px solid var(--interactive-accent,#4f46e5);" +
        "border-radius:8px;padding:6px 12px;background:var(--interactive-accent,#4f46e5);" +
        "color:var(--text-on-accent,#fff);cursor:pointer;font-weight:600;",
    );
    pinButton.onclick = () => {
      options.onPin?.();
      dispose();
    };
    actions.append(pinButton);
  }
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
