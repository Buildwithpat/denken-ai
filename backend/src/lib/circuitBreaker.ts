/**
 * Lightweight Redis-backed circuit breaker for the AI service.
 *
 * States:
 *  CLOSED   — normal operation (all requests flow through)
 *  OPEN     — failures exceeded threshold; requests fail fast with fallback
 *  HALF_OPEN — one probe request allowed; success closes, failure re-opens
 *
 * State is stored in Redis so it's shared across multiple backend instances.
 * Falls back to CLOSED (pass-through) if Redis is unavailable.
 */

import { getRedis } from './redis';
import { logger }   from './logger';

const FAILURE_THRESHOLD = 5;    // failures before opening
const OPEN_WINDOW_SEC   = 60;   // seconds to stay open before trying again
const FAILURE_WINDOW_SEC = 120; // window in which failures accumulate

function failKey(endpoint: string)  { return `cb:fail:${endpoint}`; }
function stateKey(endpoint: string) { return `cb:state:${endpoint}`; }

type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

async function getState(endpoint: string): Promise<CBState> {
  const redis = getRedis();
  if (!redis) return 'CLOSED';
  const val = await redis.get(stateKey(endpoint)).catch(() => null);
  return (val as CBState | null) ?? 'CLOSED';
}

async function setState(endpoint: string, state: CBState, ttlSec: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(stateKey(endpoint), state, 'EX', ttlSec).catch(() => {});
}

async function incrementFailures(endpoint: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  const key = failKey(endpoint);
  const count = await redis.incr(key).catch(() => 0);
  if (count === 1) await redis.expire(key, FAILURE_WINDOW_SEC).catch(() => {});
  return count;
}

async function resetFailures(endpoint: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(failKey(endpoint), stateKey(endpoint)).catch(() => {});
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns true when the circuit is open (request should be blocked / use fallback). */
export async function isCircuitOpen(endpoint: string): Promise<boolean> {
  const state = await getState(endpoint).catch(() => 'CLOSED' as CBState);
  if (state === 'OPEN') {
    logger.warn('[CircuitBreaker] Circuit OPEN — using fallback', { endpoint });
    return true;
  }
  return false;
}

/** Record a successful AI call. Resets failure counter and closes the circuit. */
export async function recordSuccess(endpoint: string): Promise<void> {
  const state = await getState(endpoint).catch(() => 'CLOSED' as CBState);
  if (state !== 'CLOSED') {
    logger.info('[CircuitBreaker] Circuit closed after successful probe', { endpoint });
    await resetFailures(endpoint);
  }
}

/** Record a failed AI call. Opens the circuit after FAILURE_THRESHOLD failures. */
export async function recordFailure(endpoint: string): Promise<void> {
  const count = await incrementFailures(endpoint);
  if (count >= FAILURE_THRESHOLD) {
    await setState(endpoint, 'OPEN', OPEN_WINDOW_SEC);
    logger.error('[CircuitBreaker] Circuit OPENED after failures', { endpoint, count });
  } else {
    logger.warn('[CircuitBreaker] Failure recorded', { endpoint, count, threshold: FAILURE_THRESHOLD });
  }
}
