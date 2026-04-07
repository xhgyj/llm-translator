import { translate, type Settings } from "@llm-translator/core";
import { Notice, Plugin, PluginSettingTab, Setting, MarkdownView, Menu } from "obsidian";
import type { Editor } from "obsidian";
import { ObsidianEditorAdapter } from "./obsidianEditorAdapter.js";
import { ObsidianStorageAdapter, type ObsidianStorageState } from "./obsidianStorageAdapter.js";
import { showTemporaryTranslationOverlay } from "./temporaryOverlay.js";

type PluginConfig = {
  baseUrl: string;
  model: string;
  targetLang: string;
  sourceLang?: string;
  apiKey?: string;
  placeholderText?: string;
};

type PluginState = ObsidianStorageState & {
  config: PluginConfig;
};

type MenuItemLike = {
  setTitle(title: string): MenuItemLike;
  onClick(callback: () => void): MenuItemLike;
};

type MenuLike = {
  addItem(builder: (item: MenuItemLike) => void): void;
};

const DEFAULT_CONFIG: PluginConfig = {
  baseUrl: "http://localhost:11434/v1",
  model: "qwen2.5:7b-instruct",
  targetLang: "zh",
  sourceLang: "auto",
  placeholderText: "Translating...",
};

const DEFAULT_RUNTIME_SETTINGS: Settings = {
  promptVersion: "v1",
  cacheTtlMs: 24 * 60 * 60 * 1000,
};

export default class LlmTranslatorPlugin extends Plugin {
  private state: PluginState = {
    config: DEFAULT_CONFIG,
    settings: DEFAULT_RUNTIME_SETTINGS,
    cache: {},
  };

  private storageAdapter = new ObsidianStorageAdapter(
    () => this.state,
    async (nextState) => {
      this.state = nextState as PluginState;
      await this.saveData(this.state);
    },
  );

  async onload(): Promise<void> {
    const loadedState = (await this.loadData()) as Partial<PluginState> | null;
    this.state = mergeState(loadedState);

    this.addCommand({
      id: "translate-selection",
      name: "Translate selected text",
      callback: () => {
        void this.runSelectionTranslationCommand();
      },
    });

    this.addCommand({
      id: "translate-paragraph",
      name: "Translate current paragraph",
      callback: () => {
        void this.runParagraphTranslationCommand();
      },
    });

    this.registerContextMenus();
    this.addSettingTab(new TranslatorSettingTab(this));
  }

  getConfig(): PluginConfig {
    return this.state.config;
  }

  async updateConfig(nextConfig: Partial<PluginConfig>): Promise<void> {
    this.state = {
      ...this.state,
      config: {
        ...this.state.config,
        ...nextConfig,
      },
    };
    await this.saveData(this.state);
  }

  private registerContextMenus(): void {
    const workspace = this.app.workspace as {
      on(
        event: "editor-menu",
        callback: (menu: MenuLike, editor: Editor) => void,
      ): unknown;
    };

    this.registerEvent(
      workspace.on("editor-menu", (menu, editor) => {
        const selectedText = editor.getSelection().trim();
        if (!selectedText) {
          return;
        }

        menu.addItem((item) => {
          item.setTitle("Translate selected text").onClick(() => {
            void this.translateAndShowOverlay({
              sourceText: selectedText,
              dismissOnSelectionClear: true,
              allowPin: true,
              onPin: (translatedText) => {
                this.pinToEditor(editor, translatedText);
              },
            });
          });
        });
      }),
    );

    this.registerDomEvent(document, "contextmenu", (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const target = mouseEvent.target as HTMLElement | null;
      if (!isPdfTarget(target)) {
        return;
      }

      const selectedText = window.getSelection()?.toString().trim() ?? "";
      if (!selectedText) {
        return;
      }

      mouseEvent.preventDefault();
      const menu = new Menu();
      menu.addItem((item) => {
        item.setTitle("Translate selected text").onClick(() => {
          void this.translateAndShowOverlay({
            sourceText: selectedText,
            dismissOnSelectionClear: true,
            allowPin: false,
          });
        });
      });
      menu.showAtMouseEvent(mouseEvent);
    });
  }

  private async runSelectionTranslationCommand(): Promise<void> {
    const editor = this.getActiveEditor();
    if (!editor) {
      new Notice("No active markdown editor found.");
      return;
    }

    const selectedText = editor.getSelection().trim();
    if (!selectedText) {
      new Notice("Select text first, then run translation.");
      return;
    }

    await this.translateAndShowOverlay({
      sourceText: selectedText,
      dismissOnSelectionClear: true,
      allowPin: true,
      onPin: (translatedText) => {
        this.pinToEditor(editor, translatedText);
      },
    });
  }

  private async runParagraphTranslationCommand(): Promise<void> {
    const editor = this.getActiveEditor();
    if (!editor) {
      new Notice("No active markdown editor found.");
      return;
    }

    const paragraph = new ObsidianEditorAdapter(editor).getParagraphText()?.trim() ?? "";
    if (!paragraph) {
      new Notice("No paragraph text found at cursor.");
      return;
    }

    await this.translateAndShowOverlay({
      sourceText: paragraph,
      dismissOnSelectionClear: false,
      allowPin: true,
      onPin: (translatedText) => {
        this.pinToEditor(editor, translatedText);
      },
    });
  }

  private async translateAndShowOverlay({
    sourceText,
    dismissOnSelectionClear,
    allowPin,
    onPin,
  }: {
    sourceText: string;
    dismissOnSelectionClear: boolean;
    allowPin: boolean;
    onPin?: (translatedText: string) => void;
  }): Promise<void> {
    try {
      const translatedText = await this.translateText(sourceText);
      showTemporaryTranslationOverlay({
        sourceText,
        translatedText,
        allowPin: allowPin && Boolean(onPin),
        dismissOnSelectionClear,
        onPin: onPin ? () => onPin(translatedText) : undefined,
      });
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  private async translateText(sourceText: string): Promise<string> {
    const config = this.state.config;
    const response = await translate(
      {
        text: sourceText,
        sourceLang: config.sourceLang ?? "auto",
        targetLang: config.targetLang,
        model: config.model,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      },
      { storage: this.storageAdapter },
    );

    return response.translatedText;
  }

  private getActiveEditor(): Editor | null {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    return markdownView?.editor ?? null;
  }

  private pinToEditor(editor: Editor, translatedText: string): void {
    const insertAt = editor.getCursor("to");
    editor.replaceRange(`\n${translatedText}\n`, insertAt);
  }
}

class TranslatorSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: LlmTranslatorPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.innerHTML = "";

    const config = this.plugin.getConfig();

    this.addTextSetting({
      containerEl,
      name: "Base URL",
      description: "OpenAI-compatible endpoint URL",
      initialValue: config.baseUrl,
      onChange: async (value) => {
        await this.plugin.updateConfig({ baseUrl: value.trim() });
      },
    });

    this.addTextSetting({
      containerEl,
      name: "Model",
      description: "Model name for translation",
      initialValue: config.model,
      onChange: async (value) => {
        await this.plugin.updateConfig({ model: value.trim() });
      },
    });

    this.addTextSetting({
      containerEl,
      name: "Target Language",
      description: "Language code for translated output (for example: zh, en, ja)",
      initialValue: config.targetLang,
      onChange: async (value) => {
        await this.plugin.updateConfig({ targetLang: value.trim() });
      },
    });

    this.addTextSetting({
      containerEl,
      name: "Source Language",
      description: "Use auto for automatic source detection",
      initialValue: config.sourceLang ?? "auto",
      onChange: async (value) => {
        await this.plugin.updateConfig({ sourceLang: value.trim() || "auto" });
      },
    });

    this.addTextSetting({
      containerEl,
      name: "API Key",
      description: "Optional key for remote endpoints",
      initialValue: config.apiKey ?? "",
      onChange: async (value) => {
        await this.plugin.updateConfig({ apiKey: value.trim() || undefined });
      },
    });
  }

  private addTextSetting({
    containerEl,
    name,
    description,
    initialValue,
    onChange,
  }: {
    containerEl: HTMLElement;
    name: string;
    description: string;
    initialValue: string;
    onChange: (value: string) => Promise<void>;
  }): void {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) => {
        text.setValue(initialValue).onChange((value) => {
          void onChange(value);
        });
      });
  }
}

function isPdfTarget(element: HTMLElement | null): boolean {
  if (!element) {
    return false;
  }

  return Boolean(
    element.closest(
      ".pdf-viewer, .pdf-container, .pdf-embed, .workspace-leaf-content[data-type='pdf']",
    ),
  );
}

function mergeState(state: Partial<PluginState> | null): PluginState {
  const config = state?.config ?? {};
  return {
    ...state,
    config: {
      ...DEFAULT_CONFIG,
      ...config,
    },
    settings: state?.settings ?? DEFAULT_RUNTIME_SETTINGS,
    cache: state?.cache ?? {},
  };
}
