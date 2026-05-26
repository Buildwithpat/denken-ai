/**
 * Typed Redis cache helpers.
 *
 * All operations are null-safe: if Redis is unavailable they return
 * undefined/false and let the caller fall through to the source of truth.
 *
 * Cache key namespaces:
 *   tw:{userId}                           — topic weights         (5 min)
 *   roadmap:{userId}:{exam}               — roadmap output        (15 min)
 *   practice:recs:{userId}:{exam}[:{sub}] — recommendations       (5 min)
 *   practice:session:{sessionId}          — adaptive sessions     (10 min)
 *   explanation:{stableId}:{style}[:{mt}] — AI explanations       (24 h)
 *   ai:usage:{userId}:{yyyymmdd}:{ep}     — per-user AI counters  (25 h)
 *   cb:{endpoint}                         — circuit-breaker state (1 min)
 */

import { getRedis } from './redis';

// ── TTLs (seconds) ────────────────────────────────────────────────────────────

export const TTL = {
  TOPIC_WEIGHTS:        5   * 60,
  ROADMAP:              15  * 60,
  PRACTICE_RECS:        5   * 60,
  PRACTICE_SESSION:     10  * 60,
  EXPLANATION:          24  * 60 * 60,
  MENTOR_RESPONSE:      30  * 60,
  AI_USAGE_COUNTER:     25  * 60 * 60, // slightly > 24h so midnight rollover is safe
  CIRCUIT_BREAKER:      60,
} as const;

// ── Generic helpers ───────────────────────────────────────────────────────────

/** Get a cached JSON value. Returns undefined on cache miss or Redis down. */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;
  try {
    const raw = await redis.get(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Set a JSON value with a TTL. Silently no-ops if Redis is down. */
export async function cacheSet<T>(key: string, value: T, ttlSec: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch {
    // Cache failure is non-fatal
  }
}

/** Delete one or more keys. Silently no-ops if Redis is down. */
export async function cacheDel(...keys: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // non-fatal
  }
}

/** Delete all keys matching a pattern (uses SCAN to avoid blocking). */
export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } catch {
    // non-fatal
  }
}

/** Atomically increment a counter and set TTL on first increment. */
export async function cacheIncr(key: string, ttlSec: number): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const val = await redis.incr(key);
    if (val === 1) await redis.expire(key, ttlSec); // set TTL only on first write
    return val;
  } catch {
    return 0;
  }
}

/** Read a counter without incrementing. Returns 0 if key absent or Redis down. */
export async function cacheGetCount(key: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const raw = await redis.get(key);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

// ── Domain key builders ───────────────────────────────────────────────────────

export const CacheKey = {
  topicWeights:     (userId: string)                        => `tw:${userId}`,
  roadmap:          (userId: string, exam: string)          => `roadmap:${userId}:${exam}`,
  practiceRecs:     (userId: string, exam: string, sub?: string) =>
    sub ? `practice:recs:${userId}:${exam}:${sub}` : `practice:recs:${userId}:${exam}`,
  practiceSession:  (sessionId: string)                     => `practice:session:${sessionId}`,
  explanation:      (stableId: string, style: string, mistakeType?: string) =>
    mistakeType ? `explanation:${stableId}:${style}:${mistakeType}` : `explanation:${stableId}:${style}`,
  mentorResponse:   (hash: string)                          => `mentor:resp:${hash}`,
  aiUsage:          (userId: string, date: string, ep: string) => `ai:usage:${userId}:${date}:${ep}`,
  circuitBreaker:   (endpoint: string)                      => `cb:${endpoint}`,
};

/** Invalidate all cached data for a user (called after test submission). */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    cacheDel(CacheKey.topicWeights(userId)),
    cacheDelPattern(`roadmap:${userId}:*`),
    cacheDelPattern(`practice:recs:${userId}:*`),
  ]);
}
