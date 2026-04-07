import {
  getParagraphNodeFromSelection,
  getParagraphTextFromSelection,
  getSelectionText,
  insertPlaceholderBelow,
  markPlaceholderFailed,
  replacePlaceholder,
} from "./contentScript.js";

declare const chrome: ChromeApi | undefined;

export type TranslationConfig = {
  targetLang: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  sourceLang?: string;
  placeholderText?: string;
  forceRefresh?: boolean;
};

type TranslateRequest = {
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  forceRefresh?: boolean;
};

type TranslateSuccessResponse = {
  ok: true;
  result: {
    translatedText: string;
    fromCache: boolean;
    latencyMs: number;
  };
};

type TranslateErrorResponse = {
  ok: false;
  error: string;
};

type TranslateResponse = TranslateSuccessResponse | TranslateErrorResponse;

type RuntimeCommandResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

type RuntimeCommandMessage =
  | {
      type: "translate-selection";
      config: TranslationConfig;
    }
  | {
      type: "translate-paragraph";
      config: TranslationConfig;
    }
  | {
      type: "show-temporary-translation";
      sourceText: string;
      translatedText: string;
    };

export async function translateSelectionFromPage(
  config: TranslationConfig,
): Promise<HTMLElement | null> {
  const selection = window.getSelection();
  const text = getSelectionText(selection);
  const sourceNode = getParagraphNodeFromSelection(selection);

  return translateFromSource({
    sourceNode,
    request: text
      ? {
          text,
          sourceLang: config.sourceLang ?? "auto",
          targetLang: config.targetLang,
          model: config.model,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          forceRefresh: config.forceRefresh,
        }
      : null,
    placeholderText: config.placeholderText,
    allowPin: true,
  });
}

export async function translateParagraphFromPage(
  config: TranslationConfig,
): Promise<HTMLElement | null> {
  const selection = window.getSelection();
  const sourceNode = getParagraphNodeFromSelection(selection);

  return translateFromSource({
    sourceNode,
    request:
      sourceNode && getParagraphTextFromSelection(selection)
        ? {
            text: getParagraphTextFromSelection(selection),
            sourceLang: config.sourceLang ?? "auto",
            targetLang: config.targetLang,
            model: config.model,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            forceRefresh: config.forceRefresh,
          }
        : null,
    placeholderText: config.placeholderText,
    allowPin: false,
  });
}

export function installContentScriptRuntime(): void {
  const chromeApi = getChromeApi();
  if (!chromeApi?.runtime?.onMessage?.addListener) {
    return;
  }

  chromeApi.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const command = getRuntimeCommand(message);
    if (!command) {
      return undefined;
    }

    void handleRuntimeCommand(command)
      .then((response) => sendResponse(response))
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies RuntimeCommandResponse);
      });

    return true;
  });
}

async function handleRuntimeCommand(
  command: RuntimeCommandMessage,
): Promise<RuntimeCommandResponse> {
  if (command.type === "translate-selection") {
    await translateSelectionFromPage(command.config);
  } else if (command.type === "translate-paragraph") {
    await translateParagraphFromPage(command.config);
  } else {
    showTemporaryTranslatedSelection(command.sourceText, command.translatedText);
  }

  return {
    ok: true,
  };
}

async function translateFromSource({
  sourceNode,
  request,
  placeholderText,
  allowPin,
}: {
  sourceNode: Element | null;
  request: TranslateRequest | null;
  placeholderText?: string;
  allowPin: boolean;
}): Promise<HTMLElement | null> {
  if (!sourceNode || !request) {
    return null;
  }

  const placeholder = insertPlaceholderBelow(sourceNode, placeholderText ?? "Translating...");

  try {
    const response = await sendTranslateMessage(request);
    if (response.ok) {
      resolveTemporaryLayer(placeholder, sourceNode, response.result.translatedText, {
        allowPin,
      });
    } else {
      markPlaceholderFailed(placeholder, response.error);
    }
  } catch (error) {
    markPlaceholderFailed(placeholder, getErrorMessage(error));
  }

  return placeholder;
}

function showTemporaryTranslatedSelection(sourceText: string, translatedText: string): void {
  const selection = window.getSelection();
  const text = getSelectionText(selection);
  if (sourceText.trim().length === 0 || translatedText.trim().length === 0) {
    return;
  }

  const sourceNode = getParagraphNodeFromSelection(selection);
  if (!sourceNode || (text && text !== sourceText)) {
    return;
  }

  const placeholder = insertPlaceholderBelow(sourceNode, "Translating...");
  resolveTemporaryLayer(placeholder, sourceNode, translatedText, { allowPin: true });
}

async function sendTranslateMessage(request: TranslateRequest): Promise<TranslateResponse> {
  const response = await getChromeApi()?.runtime?.sendMessage?.({
    type: "translate",
    request,
  });

  if (!response || typeof response !== "object" || !("ok" in response)) {
    throw new Error("Unexpected translation response");
  }

  return response as TranslateResponse;
}

function getRuntimeCommand(message: unknown): RuntimeCommandMessage | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const candidate = message as Partial<RuntimeCommandMessage>;
  if (candidate.type === "translate-selection" && candidate.config) {
    return candidate as RuntimeCommandMessage;
  }

  if (candidate.type === "translate-paragraph" && candidate.config) {
    return candidate as RuntimeCommandMessage;
  }

  if (
    candidate.type === "show-temporary-translation" &&
    typeof candidate.sourceText === "string" &&
    typeof candidate.translatedText === "string"
  ) {
    return candidate as RuntimeCommandMessage;
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveTemporaryLayer(
  placeholder: HTMLElement,
  sourceNode: Element,
  translatedText: string,
  options: { allowPin: boolean },
): void {
  ensureTemporaryLayerStyles();
  replacePlaceholder(placeholder, translatedText);
  placeholder.classList.add("llm-translator-card");
  placeholder.innerHTML = "";

  const header = document.createElement("div");
  header.className = "llm-translator-card-header";
  header.textContent = "Translation Preview";
  placeholder.append(header);

  const translatedBlock = document.createElement("pre");
  translatedBlock.className = "llm-translator-card-body";
  translatedBlock.textContent = translatedText;
  placeholder.append(translatedBlock);

  if (options.allowPin) {
    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.setAttribute("data-llm-translator-pin", "true");
    pinButton.className = "llm-translator-btn llm-translator-btn-primary";
    pinButton.textContent = "Pin to page";
    pinButton.addEventListener("click", () => {
      const pinned = document.createElement("div");
      pinned.setAttribute("data-llm-translator-pinned", "true");
      pinned.className = "llm-translator-card llm-translator-pinned";
      pinned.innerHTML = `
        <div class="llm-translator-card-header">Pinned Translation</div>
      `;
      const pinnedBody = document.createElement("pre");
      pinnedBody.className = "llm-translator-card-body";
      pinnedBody.textContent = translatedText;
      pinned.append(pinnedBody);
      sourceNode.insertAdjacentElement("afterend", pinned);
      placeholder.remove();
    });
    const actions = document.createElement("div");
    actions.className = "llm-translator-actions";
    actions.append(pinButton);
    placeholder.append(actions);
  }

  const onSelectionChange = () => {
    const selection = window.getSelection();
    const hasActiveSelection =
      !!selection && selection.rangeCount > 0 && selection.toString().trim().length > 0;
    if (!hasActiveSelection) {
      placeholder.remove();
      document.removeEventListener("selectionchange", onSelectionChange);
    }
  };

  document.addEventListener("selectionchange", onSelectionChange);
}

function ensureTemporaryLayerStyles(): void {
  if (document.getElementById("llm-translator-temporary-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "llm-translator-temporary-styles";
  style.textContent = `
    .llm-translator-card {
      margin-top: 8px;
      border-radius: 12px;
      border: 1px solid rgba(148, 163, 184, 0.45);
      background: #ffffff;
      box-shadow: 0 14px 36px rgba(2, 6, 23, 0.16);
      color: #0f172a;
      overflow: hidden;
      animation: llmTranslatorRise 180ms ease-out;
    }
    .llm-translator-card-header {
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.2px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.28);
      background: linear-gradient(125deg, #f8fafc, #ffffff);
    }
    .llm-translator-card-body {
      margin: 0;
      padding: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      line-height: 1.6;
    }
    .llm-translator-actions {
      display: flex;
      justify-content: flex-end;
      padding: 0 12px 12px;
    }
    .llm-translator-btn {
      border-radius: 8px;
      font-size: 12px;
      line-height: 1;
      padding: 8px 10px;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .llm-translator-btn-primary {
      color: #ffffff;
      background: #2563eb;
      border-color: #2563eb;
    }
    .llm-translator-btn-primary:hover {
      background: #1d4ed8;
      border-color: #1d4ed8;
    }
    .llm-translator-pinned {
      margin-top: 8px;
    }
    @keyframes llmTranslatorRise {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @media (prefers-color-scheme: dark) {
      .llm-translator-card {
        background: #0f172a;
        border-color: rgba(148, 163, 184, 0.28);
        box-shadow: 0 20px 48px rgba(2, 6, 23, 0.45);
        color: #e2e8f0;
      }
      .llm-translator-card-header {
        border-bottom-color: rgba(148, 163, 184, 0.24);
        background: linear-gradient(125deg, #111827, #0f172a);
      }
      .llm-translator-btn-primary {
        background: #3b82f6;
        border-color: #3b82f6;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .llm-translator-card {
        animation: none;
      }
    }
  `;

  document.head.append(style);
}

function getChromeApi(): ChromeApi | undefined {
  return (globalThis as { chrome?: ChromeApi }).chrome;
}

type ChromeApi = {
  runtime: {
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: RuntimeCommandResponse) => void,
        ) => boolean | void,
      ): void;
    };
    sendMessage?(message: unknown): Promise<unknown>;
  };
};
