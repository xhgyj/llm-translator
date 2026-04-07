import { randomUUID } from "node:crypto";
import type { Editor, EditorPosition } from "obsidian";
import type { EditorAdapter } from "./editorAdapter.js";

const PLACEHOLDER_PREFIX = "[llm-translator:";

export class ObsidianEditorAdapter implements EditorAdapter {
  constructor(private readonly editor: Editor) {}

  getSelectionText(): string | null {
    return this.editor.getSelection();
  }

  getParagraphText(): string | null {
    const lineNumber = this.editor.getCursor("from").line;
    const { startLine, endLine } = getParagraphRange(this.editor, lineNumber);
    const lines: string[] = [];

    for (let line = startLine; line <= endLine; line += 1) {
      lines.push(this.editor.getLine(line));
    }

    return lines.join("\n");
  }

  insertSelectionPlaceholder(text: string): string {
    const placeholderId = randomUUID();
    const insertPosition = this.editor.getCursor("to");
    this.editor.replaceRange(`\n${formatPlaceholder(placeholderId, text)}\n`, insertPosition);
    return placeholderId;
  }

  insertParagraphPlaceholder(text: string): string {
    const placeholderId = randomUUID();
    const cursorLine = this.editor.getCursor("from").line;
    const { endLine } = getParagraphRange(this.editor, cursorLine);
    const lineText = this.editor.getLine(endLine);
    const insertPosition: EditorPosition = {
      line: endLine,
      ch: lineText.length,
    };
    this.editor.replaceRange(`\n${formatPlaceholder(placeholderId, text)}\n`, insertPosition);
    return placeholderId;
  }

  replacePlaceholder(placeholderId: string, translatedText: string): void {
    const placeholderLine = findPlaceholderLine(this.editor, placeholderId);
    if (placeholderLine < 0) {
      return;
    }

    const originalLine = this.editor.getLine(placeholderLine);
    this.editor.replaceRange(
      translatedText,
      { line: placeholderLine, ch: 0 },
      { line: placeholderLine, ch: originalLine.length },
    );
  }

  markPlaceholderFailed(placeholderId: string, reason: string): void {
    const placeholderLine = findPlaceholderLine(this.editor, placeholderId);
    if (placeholderLine < 0) {
      return;
    }

    const originalLine = this.editor.getLine(placeholderLine);
    const message = `Translation failed: ${reason}`;
    this.editor.replaceRange(
      message,
      { line: placeholderLine, ch: 0 },
      { line: placeholderLine, ch: originalLine.length },
    );
  }
}

function getParagraphRange(
  editor: Editor,
  anchorLine: number,
): {
  startLine: number;
  endLine: number;
} {
  let startLine = anchorLine;
  while (startLine > 0 && editor.getLine(startLine - 1).trim().length > 0) {
    startLine -= 1;
  }

  let endLine = anchorLine;
  while (endLine < editor.lineCount() - 1 && editor.getLine(endLine + 1).trim().length > 0) {
    endLine += 1;
  }

  return { startLine, endLine };
}

function formatPlaceholder(placeholderId: string, text: string): string {
  return `${PLACEHOLDER_PREFIX}${placeholderId}] ${text}`;
}

function findPlaceholderLine(editor: Editor, placeholderId: string): number {
  const marker = `${PLACEHOLDER_PREFIX}${placeholderId}]`;
  for (let line = 0; line < editor.lineCount(); line += 1) {
    if (editor.getLine(line).includes(marker)) {
      return line;
    }
  }

  return -1;
}
