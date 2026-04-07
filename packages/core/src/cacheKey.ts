import { sha256Hex } from "./sha256.js";

export type CacheKeyInput = {
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
  baseUrl: string;
  glossaryVersion?: string;
  promptVersion: string;
};

export function createCacheKey(input: CacheKeyInput): string {
  const joinedFields = [
    input.text,
    input.sourceLang,
    input.targetLang,
    input.model,
    input.baseUrl,
    input.glossaryVersion ?? "",
    input.promptVersion,
  ].join("|");

  return sha256Hex(joinedFields);
}
