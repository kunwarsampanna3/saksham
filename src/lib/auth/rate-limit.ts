import "server-only";

/**
 * Fixed-window limiter kept in process memory. It protects a single server and
 * the dev machine; on multi-instance hosts back it with Postgres or Redis.
 * Per-account lockout (5 wrong MPINs → 15 min) is stored with the user record,
 * so it holds across instances regardless.
 */
// Shared across every route's copy of this module (see file-store.ts for why).
const g = globalThis as unknown as { __sakshamRateBuckets?: Map<string, { count: number; resetAt: number }> };
const buckets = (g.__sakshamRateBuckets ??= new Map());

export function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}
