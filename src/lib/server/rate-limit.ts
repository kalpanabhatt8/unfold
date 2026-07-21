/**
 * Fixed-window per-key rate limiter (in-memory).
 *
 * Best-effort on multi-instance / serverless deploys — each isolate has its
 * own map — but enough to blunt single-session scripted Anthropic abuse.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/** Shared budget across all AI routes for one signed-in user. */
export const AI_RATE_LIMIT = 60;
export const AI_RATE_WINDOW_MS = 60_000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export const checkRateLimit = (
  key: string,
  limit: number = AI_RATE_LIMIT,
  windowMs: number = AI_RATE_WINDOW_MS,
): RateLimitResult => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true };
};
