import { translate, type TranslateRequest } from "@llm-translator/core";
import { createChromeStorageAdapter } from "./storageAdapter.js";

type TriggerMode = "selection" | "paragraph";

type TranslatorConfig = {
  baseUrl: string;
  model: string;
  targetLang: string;
  sourceLang?: string;
  apiKey?: string;
  placeholderText?: string;
  forceRefresh?: boolean;
};

type TranslateMessage = {
  type: "translate";
  request: TranslateRequest;
};

type GetConfigMessage = {
  type: "ui:get-config";
};

type SetConfigMessage = {
  type: "ui:set-config";
  config: TranslatorConfig;
};

type TriggerTranslationMessage = {
  type: "trigger-translation";
  mode: TriggerMode;
};

type RuntimeMessage = TranslateMessage | GetConfigMessage | SetConfigMessage | TriggerTranslationMessage;

type TranslateMessageResponse =
  | {
      ok: true;
      result: Awaited<ReturnType<typeof translate>>;
    }
  | {
      ok: false;
      error: string;
    };

type ConfigMessageResponse =
  | {
      ok: true;
      config: TranslatorConfig;
    }
  | {
      ok: false;
      error: string;
    };

type GenericOkResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

type RuntimeResponse = TranslateMessageResponse | ConfigMessageResponse | GenericOkResponse;

type ContentScriptResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

const CONFIG_STORAGE_KEY = "translatorConfig";

const DEFAULT_TRANSLATOR_CONFIG: TranslatorConfig = {
  baseUrl: "http://localhost:11434/v1",
  model: "qwen2.5:7b-instruct",
  targetLang: "zh",
  sourceLang: "auto",
  placeholderText: "Translating...",
};

const chromeApi = getChromeApi();

chromeApi?.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const runtimeMessage = getRuntimeMessage(message);
  if (!runtimeMessage) {
    return undefined;
  }

  void handleRuntimeMessage(runtimeMessage)
    .then((response) => sendResponse(response))
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies RuntimeResponse);
    });

  return true;
});

chromeApi?.commands?.onCommand?.addListener((command: string) => {
  if (command === "translate-selection") {
    void triggerTranslation("selection");
  } else if (command === "translate-paragraph") {
    void triggerTranslation("paragraph");
  }
});

async function handleRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  if (message.type === "translate") {
    return handleTranslateMessage(message);
  }

  if (message.type === "ui:get-config") {
    return {
      ok: true,
      config: await getTranslatorConfig(),
    };
  }

  if (message.type === "ui:set-config") {
    await saveTranslatorConfig(message.config);
    return {
      ok: true,
    };
  }

  await triggerTranslation(message.mode);
  return {
    ok: true,
  };
}

async function handleTranslateMessage(message: TranslateMessage): Promise<TranslateMessageResponse> {
  const storage = createChromeStorageAdapter();
  const result = await translate(message.request, { storage });

  return {
    ok: true,
    result,
  };
}

async function triggerTranslation(mode: TriggerMode): Promise<void> {
  const chromeRuntime = getRequiredChromeApi();
  const tabId = await getActiveTabId(chromeRuntime);
  const config = await getTranslatorConfig();
  const runtimeMessageType = mode === "selection" ? "translate-selection" : "translate-paragraph";

  const response = await chromeRuntime.tabs.sendMessage(tabId, {
    type: runtimeMessageType,
    config,
  });

  if (!response || typeof response !== "object" || !("ok" in response)) {
    throw new Error("Unexpected content script response");
  }

  const typedResponse = response as ContentScriptResponse;
  if (!typedResponse.ok) {
    throw new Error(typedResponse.error);
  }
}

async function getActiveTabId(chromeRuntime: ChromeApi): Promise<number> {
  const tabs = await chromeRuntime.tabs.query({
    active: true,
    currentWindow: true,
  });
  const tabId = tabs[0]?.id;
  if (typeof tabId !== "number") {
    throw new Error("No active tab found");
  }

  return tabId;
}

async function getTranslatorConfig(): Promise<TranslatorConfig> {
  const chromeRuntime = getRequiredChromeApi();
  const data = await chromeRuntime.storage.local.get(CONFIG_STORAGE_KEY);
  const storedConfig = data[CONFIG_STORAGE_KEY] as Partial<TranslatorConfig> | undefined;
  return normalizeTranslatorConfig(storedConfig);
}

async function saveTranslatorConfig(config: TranslatorConfig): Promise<void> {
  const chromeRuntime = getRequiredChromeApi();
  const normalized = normalizeTranslatorConfig(config);
  await chromeRuntime.storage.local.set({
    [CONFIG_STORAGE_KEY]: normalized,
  });
}

function normalizeTranslatorConfig(
  input: Partial<TranslatorConfig> | undefined,
): TranslatorConfig {
  return {
    baseUrl: normalizeRequired(input?.baseUrl, DEFAULT_TRANSLATOR_CONFIG.baseUrl),
    model: normalizeRequired(input?.model, DEFAULT_TRANSLATOR_CONFIG.model),
    targetLang: normalizeRequired(input?.targetLang, DEFAULT_TRANSLATOR_CONFIG.targetLang),
    sourceLang: normalizeOptional(input?.sourceLang, DEFAULT_TRANSLATOR_CONFIG.sourceLang),
    apiKey: normalizeOptional(input?.apiKey),
    placeholderText: normalizeOptional(
      input?.placeholderText,
      DEFAULT_TRANSLATOR_CONFIG.placeholderText,
    ),
    forceRefresh: input?.forceRefresh ?? false,
  };
}

function normalizeRequired(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function normalizeOptional(value: string | undefined, fallback?: string): string | undefined {
  const normalized = value?.trim();
  if (normalized && normalized.length > 0) {
    return normalized;
  }

  return fallback;
}

function getRuntimeMessage(message: unknown): RuntimeMessage | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const candidate = message as Partial<RuntimeMessage>;
  if (candidate.type === "translate" && candidate.request) {
    return candidate as TranslateMessage;
  }

  if (candidate.type === "ui:get-config") {
    return candidate as GetConfigMessage;
  }

  if (candidate.type === "ui:set-config" && candidate.config) {
    return candidate as SetConfigMessage;
  }

  if (
    candidate.type === "trigger-translation" &&
    (candidate.mode === "selection" || candidate.mode === "paragraph")
  ) {
    return candidate as TriggerTranslationMessage;
  }

  return null;
}

type ChromeApi = {
  runtime: {
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: RuntimeResponse) => void,
        ) => boolean | void,
      ): void;
    };
  };
  storage: {
    local: {
      get(keys: string[] | string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
  tabs: {
    query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Array<{ id?: number }>>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
  commands?: {
    onCommand?: {
      addListener(listener: (command: string) => void): void;
    };
  };
};

function getChromeApi(): ChromeApi | undefined {
  return (globalThis as { chrome?: ChromeApi }).chrome;
}

function getRequiredChromeApi(): ChromeApi {
  const chromeRuntime = getChromeApi();
  if (!chromeRuntime) {
    throw new Error("chrome runtime API is not available");
  }

  return chromeRuntime;
}
