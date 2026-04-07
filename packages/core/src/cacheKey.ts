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

  return fnv1a64Hex(joinedFields);
}

function fnv1a64Hex(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, "0");
}
