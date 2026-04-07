import { createHash } from "node:crypto";

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

  return createHash("sha256").update(joinedFields).digest("hex");
}
