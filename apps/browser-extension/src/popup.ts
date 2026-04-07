type TranslatorConfig = {
  baseUrl: string;
  model: string;
  targetLang: string;
  sourceLang?: string;
  apiKey?: string;
  placeholderText?: string;
  forceRefresh?: boolean;
};

type PopupMessage =
  | { type: "ui:get-config" }
  | { type: "ui:set-config"; config: TranslatorConfig }
  | { type: "trigger-translation"; mode: "selection" | "paragraph" };

type PopupResponse =
  | { ok: true; config?: TranslatorConfig }
  | { ok: false; error: string };

document.addEventListener("DOMContentLoaded", () => {
  void initializePopup();
});

async function initializePopup(): Promise<void> {
  const statusText = getRequiredElement<HTMLParagraphElement>("statusText");

  try {
    const response = await sendMessage({ type: "ui:get-config" });
    if (!response.ok || !response.config) {
      throw new Error(response.ok ? "Missing config response" : response.error);
    }

    applyFormValues(response.config);
  } catch (error) {
    statusText.textContent = getErrorMessage(error);
  }

  getRequiredElement<HTMLButtonElement>("saveConfig").addEventListener("click", () => {
    void saveConfig();
  });

  getRequiredElement<HTMLButtonElement>("translateSelection").addEventListener("click", () => {
    void triggerTranslation("selection");
  });

  getRequiredElement<HTMLButtonElement>("translateParagraph").addEventListener("click", () => {
    void triggerTranslation("paragraph");
  });
}

async function saveConfig(): Promise<void> {
  const statusText = getRequiredElement<HTMLParagraphElement>("statusText");

  try {
    const response = await sendMessage({
      type: "ui:set-config",
      config: readFormValues(),
    });

    statusText.textContent = response.ok ? "Config saved." : response.error;
  } catch (error) {
    statusText.textContent = getErrorMessage(error);
  }
}

async function triggerTranslation(mode: "selection" | "paragraph"): Promise<void> {
  const statusText = getRequiredElement<HTMLParagraphElement>("statusText");

  try {
    const saveResponse = await sendMessage({
      type: "ui:set-config",
      config: readFormValues(),
    });
    if (!saveResponse.ok) {
      throw new Error(saveResponse.error);
    }

    const response = await sendMessage({
      type: "trigger-translation",
      mode,
    });

    statusText.textContent = response.ok ? "Translation started." : response.error;
  } catch (error) {
    statusText.textContent = getErrorMessage(error);
  }
}

function readFormValues(): TranslatorConfig {
  return {
    baseUrl: getRequiredElement<HTMLInputElement>("baseUrl").value.trim(),
    model: getRequiredElement<HTMLInputElement>("model").value.trim(),
    targetLang: getRequiredElement<HTMLInputElement>("targetLang").value.trim(),
    sourceLang: normalizeOptional(
      getRequiredElement<HTMLInputElement>("sourceLang").value,
    ),
    apiKey: normalizeOptional(getRequiredElement<HTMLInputElement>("apiKey").value),
    placeholderText: "Translating...",
  };
}

function applyFormValues(config: TranslatorConfig): void {
  getRequiredElement<HTMLInputElement>("baseUrl").value = config.baseUrl ?? "";
  getRequiredElement<HTMLInputElement>("model").value = config.model ?? "";
  getRequiredElement<HTMLInputElement>("targetLang").value = config.targetLang ?? "";
  getRequiredElement<HTMLInputElement>("sourceLang").value = config.sourceLang ?? "auto";
  getRequiredElement<HTMLInputElement>("apiKey").value = config.apiKey ?? "";
}

function normalizeOptional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

async function sendMessage(message: PopupMessage): Promise<PopupResponse> {
  const chromeApi = getChromeApi();
  const response = await chromeApi.runtime.sendMessage(message);

  if (!response || typeof response !== "object" || !("ok" in response)) {
    throw new Error("Unexpected popup response");
  }

  return response as PopupResponse;
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }

  return element as T;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type ChromeApi = {
  runtime: {
    sendMessage(message: PopupMessage): Promise<PopupResponse>;
  };
};

function getChromeApi(): ChromeApi {
  const chromeApi = (globalThis as { chrome?: ChromeApi }).chrome;
  if (!chromeApi) {
    throw new Error("chrome.runtime is not available");
  }

  return chromeApi;
}

export {};
