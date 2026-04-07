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
  command.type === "translate-selection"
    ? await translateSelectionFromPage(command.config)
    : await translateParagraphFromPage(command.config);

  return {
    ok: true,
  };
}

async function translateFromSource({
  sourceNode,
  request,
  placeholderText,
}: {
  sourceNode: Element | null;
  request: TranslateRequest | null;
  placeholderText?: string;
}): Promise<HTMLElement | null> {
  if (!sourceNode || !request) {
    return null;
  }

  const placeholder = insertPlaceholderBelow(sourceNode, placeholderText ?? "Translating...");

  try {
    const response = await sendTranslateMessage(request);
    if (response.ok) {
      replacePlaceholder(placeholder, response.result.translatedText);
    } else {
      markPlaceholderFailed(placeholder, response.error);
    }
  } catch (error) {
    markPlaceholderFailed(placeholder, getErrorMessage(error));
  }

  return placeholder;
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

  return null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
