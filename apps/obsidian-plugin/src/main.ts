import {
  translate as coreTranslate,
  type StorageAdapter,
  type TranslateRequest,
  type TranslateResponse,
} from "@llm-translator/core";
import { BackfillStore } from "./backfill";
import type { EditorAdapter } from "./editorAdapter";

export type TranslateFn = (
  request: TranslateRequest,
  deps: { storage: StorageAdapter },
) => Promise<TranslateResponse>;

export type ObsidianTranslatorConfig = {
  baseUrl: string;
  model: string;
  targetLang: string;
  apiKey?: string;
  sourceLang?: string;
  placeholderText?: string;
};

export type ObsidianTranslatorDeps = {
  translateFn?: TranslateFn;
  backfillStore?: BackfillStore;
};

export class ObsidianTranslatorController {
  private readonly translateFn: TranslateFn;
  private readonly backfillStore: BackfillStore;

  constructor(
    private readonly editor: EditorAdapter,
    private readonly storage: StorageAdapter,
    private readonly config: ObsidianTranslatorConfig,
    deps: ObsidianTranslatorDeps = {},
  ) {
    this.translateFn = deps.translateFn ?? coreTranslate;
    this.backfillStore = deps.backfillStore ?? new BackfillStore();
  }

  async translateSelection(): Promise<void> {
    const text = this.normalizeCapturedText(this.editor.getSelectionText());
    if (!text) {
      return;
    }

    const placeholderId = this.editor.insertSelectionPlaceholder(this.placeholderText);
    const job = this.backfillStore.create(placeholderId);

    await this.translateAndBackfill(job.jobId, placeholderId, text);
  }

  async translateParagraph(): Promise<void> {
    const text = this.normalizeCapturedText(this.editor.getParagraphText());
    if (!text) {
      return;
    }

    const placeholderId = this.editor.insertParagraphPlaceholder(this.placeholderText);
    const job = this.backfillStore.create(placeholderId);

    await this.translateAndBackfill(job.jobId, placeholderId, text);
  }

  private async translateAndBackfill(
    jobId: string,
    placeholderId: string,
    text: string,
  ): Promise<void> {
    try {
      const result = await this.translateFn(
        {
          text,
          sourceLang: this.config.sourceLang ?? "auto",
          targetLang: this.config.targetLang,
          model: this.config.model,
          baseUrl: this.config.baseUrl,
          apiKey: this.config.apiKey,
        },
        { storage: this.storage },
      );

      this.editor.replacePlaceholder(placeholderId, result.translatedText);
      this.backfillStore.resolve(jobId, result.translatedText);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.editor.markPlaceholderFailed(placeholderId, reason);
      this.backfillStore.fail(jobId, error);
    }
  }

  private normalizeCapturedText(text: string | null): string {
    return text?.trim() ?? "";
  }

  private get placeholderText(): string {
    return this.config.placeholderText ?? "Translating...";
  }
}
