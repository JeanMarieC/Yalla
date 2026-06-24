// Shared resilience for Gemini calls. The free tier throttles aggressively
// (HTTP 429 / RESOURCE_EXHAUSTED) and tells us how long to wait — so on a 429 we
// back off (honoring the suggested retry delay) and try again instead of failing.

function is429(err: unknown): boolean {
  const s =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err ?? "");
  return /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(s);
}

function retryDelayMs(err: unknown, fallbackMs: number): number {
  const s = err instanceof Error ? err.message : String(err);
  // Matches "retry in 15.9s" / "retryDelay":"15s".
  const m = s.match(/(\d+(?:\.\d+)?)\s*s\b/i);
  if (m) return Math.min(Math.ceil(parseFloat(m[1]) * 1000) + 500, 30000);
  return fallbackMs;
}

/**
 * Run a Gemini call with backoff on rate limits. Non-429 errors throw straight
 * through (caller may still have its own fallback).
 */
export async function withGeminiRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!is429(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, retryDelayMs(err, 2000 * 2 ** i)));
    }
  }
  throw lastErr;
}
