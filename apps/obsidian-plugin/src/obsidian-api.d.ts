declare module "obsidian" {
  export type EditorPosition = {
    line: number;
    ch: number;
  };

  export interface Editor {
    getSelection(): string;
    getCursor(which?: "from" | "to"): EditorPosition;
    getLine(line: number): string;
    lineCount(): number;
    replaceRange(text: string, from: EditorPosition, to?: EditorPosition): void;
  }

  export class MarkdownView {
    editor: Editor;
  }

  export class App {
    workspace: {
      getActiveViewOfType<T>(type: new (...args: never[]) => T): T | null;
    };
  }

  export class Plugin {
    app: App;
    onload(): Promise<void> | void;
    onunload(): void;
    addCommand(command: {
      id: string;
      name: string;
      callback?: () => void;
      checkCallback?: (checking: boolean) => boolean | void;
    }): void;
    addSettingTab(tab: PluginSettingTab): void;
    loadData(): Promise<unknown>;
    saveData(data: unknown): Promise<void>;
  }

  export class PluginSettingTab {
    app: App;
    containerEl: HTMLElement;
    constructor(app: App, plugin: Plugin);
    display(): void;
  }

  export class Notice {
    constructor(message: string);
  }

  export class TextComponent {
    setPlaceholder(value: string): this;
    setValue(value: string): this;
    onChange(callback: (value: string) => void | Promise<void>): this;
  }

  export class Setting {
    constructor(containerEl: HTMLElement);
    setName(name: string): this;
    setDesc(description: string): this;
    addText(callback: (text: TextComponent) => void): this;
  }
}
