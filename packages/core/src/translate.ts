import { createCacheKey } from "./cacheKey.js";
import { buildGlossaryPrompt } from "./glossary.js";
import { AuthError, ConfigError, RateLimitError } from "./errors.js";
import { callOpenAICompatible } from "./openaiClient.js";
import { retry } from "./retry.js";
import type {
  Settings,
  StorageAdapter,
  TranslateRequest,
  TranslateResponse,
} from "./types.js";

export type TranslateDeps = {
  storage: StorageAdapter;
  fetchImpl?: typeof fetch;
};

export async function translate(
  req: TranslateRequest,
  deps: TranslateDeps,
): Promise<TranslateResponse> {
  validateRequest(req);

  const [settings, glossary] = await Promise.all([
    deps.storage.getSettings(),
    deps.storage.getGlossary(),
  ]);
  validateSettings(settings);

  const cacheKey = createCacheKey({
    text: req.text,
    sourceLang: req.sourceLang,
    targetLang: req.targetLang,
    model: req.model,
    baseUrl: req.baseUrl,
    glossaryVersion: glossary.version,
    promptVersion: settings.promptVersion,
  });

  if (!req.forceRefresh) {
    const cached = await deps.storage.getCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        fromCache: true,
      };
    }
  }

  const messages = buildMessages(req, glossary);
  const startedAt = Date.now();

  const translatedText = await retry(
    () =>
      callOpenAICompatible({
        baseUrl: req.baseUrl,
        model: req.model,
        apiKey: req.apiKey,
        messages,
        fetchImpl: deps.fetchImpl,
      }),
    {
      maxAttempts: 3,
      delayMs: 50,
      factor: 2,
      shouldRetry: (error) =>
        !(error instanceof ConfigError) &&
        !(error instanceof AuthError),
    },
  );

  const response: TranslateResponse = {
    translatedText,
    fromCache: false,
    latencyMs: Date.now() - startedAt,
  };

  await deps.storage.setCache(cacheKey, response, settings.cacheTtlMs);

  return response;
}

function validateRequest(req: TranslateRequest): void {
  if (!req.text.trim()) {
    throw new ConfigError("text is required");
  }

  if (!req.sourceLang.trim()) {
    throw new ConfigError("sourceLang is required");
  }

  if (!req.targetLang.trim()) {
    throw new ConfigError("targetLang is required");
  }

  if (!req.model.trim()) {
    throw new ConfigError("model is required");
  }

  if (!req.baseUrl.trim()) {
    throw new ConfigError("baseUrl is required");
  }
}

function validateSettings(settings: Settings): void {
  if (!settings.promptVersion.trim()) {
    throw new ConfigError("promptVersion is required");
  }

  if (!Number.isFinite(settings.cacheTtlMs) || settings.cacheTtlMs < 0) {
    throw new ConfigError("cacheTtlMs must be a non-negative number");
  }
}

function buildMessages(
  req: TranslateRequest,
  glossary: { version: string; terms: Array<{ source: string; target: string }> },
) {
  const systemParts = [
    `Translate from ${req.sourceLang} to ${req.targetLang}.`,
    "Return only the translated text.",
  ];

  if (glossary.terms.length > 0) {
    systemParts.push(buildGlossaryPrompt(glossary));
  }

  return [
    {
      role: "system" as const,
      content: systemParts.join("\n\n"),
    },
    {
      role: "user" as const,
      content: req.text,
    },
  ];
}
