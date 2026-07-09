const RETRY_DELAYS_MS = [500, 1500, 4000];

/**
 * Retries a single OpenRouter call on HTTP 429 (rate limited) with backoff,
 * honoring a Retry-After header when present. Any other error (including a
 * non-429 HTTP status) is rethrown immediately so the caller's own
 * model-fallback loop can move on to the next model. At large batch sizes,
 * a 429 usually just means "try again shortly," not "this model is broken."
 */
export async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: any;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      if (status !== 429 || attempt === RETRY_DELAYS_MS.length) throw err;

      const retryAfterHeader = err.response?.headers?.["retry-after"];
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const delay = Number.isFinite(retryAfterMs)
        ? retryAfterMs
        : RETRY_DELAYS_MS[attempt] + Math.random() * 250;

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastErr;
}
