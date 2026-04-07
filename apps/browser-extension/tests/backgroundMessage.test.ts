import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const translateMock = vi.hoisted(() =>
  vi.fn(async () => ({
    translatedText: "Translated background text",
    fromCache: false,
    latencyMs: 14,
  })),
);

vi.mock("@llm-translator/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@llm-translator/core")>();
  return {
    ...actual,
    translate: translateMock,
  };
});

describe("background message handling", () => {
  let listener:
    | ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void)
    | undefined;
  let addListener: ReturnType<typeof vi.fn>;
  let addCommandListener: ReturnType<typeof vi.fn>;
  let createContextMenu: ReturnType<typeof vi.fn>;
  let addContextMenuListener: ReturnType<typeof vi.fn>;
  let createWindow: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    listener = undefined;

    addListener = vi.fn((callback) => {
      listener = callback;
    });
    addCommandListener = vi.fn();
    createContextMenu = vi.fn();
    addContextMenuListener = vi.fn();
    createWindow = vi.fn(async () => ({}));

    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener,
        },
        getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
      },
      commands: {
        onCommand: {
          addListener: addCommandListener,
        },
      },
      contextMenus: {
        create: createContextMenu,
        onClicked: {
          addListener: addContextMenuListener,
        },
      },
      windows: {
        create: createWindow,
      },
      tabs: {
        query: vi.fn(async () => [{ id: 1 }]),
        sendMessage: vi.fn(async () => ({ ok: true })),
      },
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
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
    expect(createContextMenu).toHaveBeenCalled();
    expect(addContextMenuListener).toHaveBeenCalledTimes(1);
  });

  it("opens a read-only translation popup for pdf context-menu selections", async () => {
    const [handler] = addContextMenuListener.mock.calls[0] ?? [];
    expect(handler).toEqual(expect.any(Function));

    await handler(
      {
        menuItemId: "llm-translator-translate-selection",
        selectionText: "hello pdf",
      },
      {
        id: 99,
        url: "https://example.com/file.pdf",
      },
    );

    await vi.waitFor(() => {
      expect(translateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "hello pdf",
        }),
        expect.any(Object),
      );
      expect(createWindow).toHaveBeenCalledTimes(1);
    });
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
    expect(translateMock).toHaveBeenCalledWith(
      {
        text: "Hello background",
        sourceLang: "auto",
        targetLang: "zh",
        model: "qwen2.5",
        baseUrl: "http://localhost:11434/v1",
      },
      expect.objectContaining({
        storage: expect.any(Object),
      }),
    );
  });
});
