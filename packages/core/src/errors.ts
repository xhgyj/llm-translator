export class TranslatorError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ConfigError extends TranslatorError {}

export class AuthError extends TranslatorError {}

export class RateLimitError extends TranslatorError {}

export class UpstreamError extends TranslatorError {
  readonly status?: number;

  constructor(message: string, options?: { cause?: unknown; status?: number }) {
    super(message, options);
    this.status = options?.status;
  }
}
