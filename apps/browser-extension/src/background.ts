import { translate, type TranslateRequest } from "@llm-translator/core";
import { createChromeStorageAdapter } from "./storageAdapter.js";

declare const chrome: ChromeApi;

type TranslateMessage = {
  type: "translate";
  request: TranslateRequest;
};

type TranslateMessageResponse =
  | {
      ok: true;
      result: Awaited<ReturnType<typeof translate>>;
    }
  | {
      ok: false;
      error: string;
    };

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const translateMessage = getTranslateMessage(message);
  if (!translateMessage) {
    return undefined;
  }

  void handleTranslateMessage(translateMessage)
    .then((response) => sendResponse(response))
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies TranslateMessageResponse);
    });

  return true;
});

async function handleTranslateMessage(message: TranslateMessage): Promise<TranslateMessageResponse> {
  const storage = createChromeStorageAdapter();
  const result = await translate(message.request, { storage });

  return {
    ok: true,
    result,
  };
}

function getTranslateMessage(message: unknown): TranslateMessage | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const candidate = message as Partial<TranslateMessage>;
  if (candidate.type !== "translate" || !candidate.request) {
    return null;
  }

  return candidate as TranslateMessage;
}

type ChromeApi = {
  runtime: {
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: TranslateMessageResponse) => void,
        ) => boolean | void,
      ): void;
    };
  };
};
