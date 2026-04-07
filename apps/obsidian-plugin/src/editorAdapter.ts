export type EditorAdapter = {
  getSelectionText(): string | null;
  getParagraphText(): string | null;
  insertSelectionPlaceholder(text: string): string;
  insertParagraphPlaceholder(text: string): string;
  replacePlaceholder(placeholderId: string, translatedText: string): void;
  markPlaceholderFailed(placeholderId: string, reason: string): void;
};
