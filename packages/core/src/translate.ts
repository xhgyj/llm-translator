import { createCacheKey } from "./cacheKey.js";
import { buildGlossaryPrompt } from "./glossary.js";
import { AuthError, ConfigError, UpstreamError } from "./errors.js";
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
  const normalizedRequest = normalizeRequest(req);

  const [settings, glossary] = await Promise.all([
    deps.storage.getSettings(),
    deps.storage.getGlossary(),
  ]);
  const normalizedSettings = normalizeSettings(settings);

  const cacheKey = createCacheKey({
    text: normalizedRequest.text,
    sourceLang: normalizedRequest.sourceLang,
    targetLang: normalizedRequest.targetLang,
    model: normalizedRequest.model,
    baseUrl: normalizedRequest.baseUrl,
    glossaryVersion: glossary.version,
    promptVersion: normalizedSettings.promptVersion,
  });

  if (!normalizedRequest.forceRefresh) {
    const cached = await deps.storage.getCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        fromCache: true,
        latencyMs: 0,
      };
    }
  }

  const messages = buildMessages(normalizedRequest, glossary);
  const startedAt = Date.now();

  const translatedText = await retry(
    () =>
      callOpenAICompatible({
        baseUrl: normalizedRequest.baseUrl,
        model: normalizedRequest.model,
        apiKey: normalizedRequest.apiKey,
        messages,
        fetchImpl: deps.fetchImpl,
      }),
    {
      maxAttempts: 3,
      delayMs: 50,
      factor: 2,
      shouldRetry: isRetryableError,
    },
  );

  const response: TranslateResponse = {
    translatedText,
    fromCache: false,
    latencyMs: Date.now() - startedAt,
  };

  await deps.storage.setCache(cacheKey, response, normalizedSettings.cacheTtlMs);

  return response;
}

type NormalizedTranslateRequest = {
  text: string;
  sourceLang: string;
  targetLang: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  forceRefresh?: boolean;
};

function normalizeRequest(req: TranslateRequest): NormalizedTranslateRequest {
  return {
    text: normalizeTextField(req.text, "text"),
    sourceLang: normalizeStringField(req.sourceLang, "sourceLang"),
    targetLang: normalizeStringField(req.targetLang, "targetLang"),
    model: normalizeStringField(req.model, "model"),
    baseUrl: normalizeBaseUrl(req.baseUrl),
    apiKey: normalizeOptionalStringField(req.apiKey),
    forceRefresh: req.forceRefresh,
  };
}

function normalizeSettings(settings: Settings): Settings {
  return {
    promptVersion: normalizeStringField(settings.promptVersion, "promptVersion"),
    cacheTtlMs: normalizeCacheTtlMs(settings.cacheTtlMs),
  };
}

function normalizeBaseUrl(baseUrl: unknown): string {
  const value = normalizeStringField(baseUrl, "baseUrl");
  return value.replace(/\/+$/, "");
}

function normalizeStringField(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ConfigError(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ConfigError(`${field} is required`);
  }

  return trimmed;
}

function normalizeOptionalStringField(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ConfigError("apiKey must be a string");
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTextField(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ConfigError(`${field} must be a string`);
  }

  if (!value.trim()) {
    throw new ConfigError(`${field} is required`);
  }

  return value;
}

function normalizeCacheTtlMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ConfigError("cacheTtlMs must be a non-negative number");
  }

  return value;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof ConfigError || error instanceof AuthError) {
    return false;
  }

  if (error instanceof UpstreamError) {
    return error.status === undefined || error.status >= 500;
  }

  return true;
}

function buildMessages(
  req: NormalizedTranslateRequest,
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
