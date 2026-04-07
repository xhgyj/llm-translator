import { Notice, Plugin, PluginSettingTab, Setting, MarkdownView } from "obsidian";
import type { Settings } from "@llm-translator/core";
import { ObsidianTranslatorController, type ObsidianTranslatorConfig } from "./main.js";
import { ObsidianEditorAdapter } from "./obsidianEditorAdapter.js";
import { ObsidianStorageAdapter, type ObsidianStorageState } from "./obsidianStorageAdapter.js";

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
        void this.runTranslation("selection");
      },
    });

    this.addCommand({
      id: "translate-paragraph",
      name: "Translate current paragraph",
      callback: () => {
        void this.runTranslation("paragraph");
      },
    });

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

  private async runTranslation(mode: "selection" | "paragraph"): Promise<void> {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = markdownView?.editor;

    if (!editor) {
      new Notice("No active markdown editor found.");
      return;
    }

    const controller = new ObsidianTranslatorController(
      new ObsidianEditorAdapter(editor),
      this.storageAdapter,
      this.toControllerConfig(),
    );

    if (mode === "selection") {
      await controller.translateSelection();
    } else {
      await controller.translateParagraph();
    }
  }

  private toControllerConfig(): ObsidianTranslatorConfig {
    const config = this.state.config;
    return {
      baseUrl: config.baseUrl,
      model: config.model,
      targetLang: config.targetLang,
      sourceLang: config.sourceLang,
      apiKey: config.apiKey,
      placeholderText: config.placeholderText,
    };
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
