/**
 * Redis client singleton.
 *
 * All cache operations go through this module. If Redis is unavailable
 * (e.g. local dev without Docker), operations silently no-op so the
 * application continues working — just without caching.
 */

import Redis from 'ioredis';
import { env } from '../config/env';

let client: Redis | null = null;
let connectAttempted = false;

export function getRedis(): Redis | null {
  if (connectAttempted) return client;
  connectAttempted = true;

  const url = env.REDIS_URL;
  if (!url) {
    // Redis is optional — dev environments without Redis run fine
    console.warn('[Redis] REDIS_URL not set — caching disabled');
    return null;
  }

  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect:          true,
      connectTimeout:       5_000,
      commandTimeout:       2_000,
      enableOfflineQueue:   false, // fail fast if disconnected
    });

    client.on('connect',   () => console.log('[Redis] Connected'));
    client.on('error',     (err: Error) => console.error('[Redis] Error:', err.message));
    client.on('close',     () => console.warn('[Redis] Connection closed'));
    client.on('reconnecting', () => console.log('[Redis] Reconnecting…'));

    void client.connect().catch((err: Error) => {
      console.error('[Redis] Failed to connect:', err.message);
      client = null;
    });
  } catch (err) {
    console.error('[Redis] Initialization error:', (err as Error).message);
    client = null;
  }

  return client;
}

/** Gracefully shut down the Redis connection (call from server.ts on SIGTERM). */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => {});
    client = null;
  }
}
