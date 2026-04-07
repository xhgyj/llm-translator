export type RetryOptions = {
  maxAttempts?: number;
  delayMs?: number;
  factor?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean | Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const delayMs = Math.max(0, options.delayMs ?? 50);
  const factor = options.factor ?? 2;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const canRetry =
        attempt < maxAttempts &&
        (options.shouldRetry ? await options.shouldRetry(error, attempt) : true);

      if (!canRetry) {
        break;
      }

      const backoffMs = Math.round(delayMs * factor ** (attempt - 1));
      if (backoffMs > 0) {
        await sleep(backoffMs);
      }
    }
  }

  throw lastError;
}
