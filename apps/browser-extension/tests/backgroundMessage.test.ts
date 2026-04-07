import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const translateMock = vi.hoisted(() =>
  vi.fn(async () => ({
    translatedText: "Translated background text",
    fromCache: false,
    latencyMs: 14,
  })),
);

vi.mock("@llm-translator/core", () => ({
  translate: translateMock,
}));

describe("background message handling", () => {
  let listener:
    | ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void)
    | undefined;
  let addListener: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    listener = undefined;

    addListener = vi.fn((callback) => {
      listener = callback;
    });

    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener,
        },
      },
    });

    await import("../src/background.js");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers a translate listener on startup", () => {
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(listener).toEqual(expect.any(Function));
  });

  it("responds to translate messages with the mocked translate result", async () => {
    const sendResponse = vi.fn();

    expect(
      listener?.(
        {
          type: "translate",
          request: {
            text: "Hello background",
            sourceLang: "auto",
            targetLang: "zh",
            model: "qwen2.5",
            baseUrl: "http://localhost:11434/v1",
          },
        },
        {},
        sendResponse,
      ),
    ).toBe(true);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        result: {
          translatedText: "Translated background text",
          fromCache: false,
          latencyMs: 14,
        },
      });
    });

    expect(translateMock).toHaveBeenCalledTimes(1);
  });
});
