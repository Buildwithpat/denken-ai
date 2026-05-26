"""
Redis response cache for the ai-service.

All cache operations are async-safe and silently no-op if Redis is
unavailable so the service continues working without caching.

Cache key convention (mirrors backend/src/lib/cache.ts):
  mentor:resp:{hash}         — mentor/concept-guidance responses  (30 min)
  explanation:{id}:{style}   — question explanation responses      (24 h)
"""

import asyncio
import hashlib
import json
import os
from typing import Any, Optional

from app.config import settings
from app.lib.logger import get_logger

log = get_logger("cache")

# ── Redis client (lazy init) ──────────────────────────────────────────────────

_client = None
_init_lock = asyncio.Lock()


async def _get_client():
    global _client
    if _client is not None:
        return _client

    async with _init_lock:
        if _client is not None:
            return _client

        if not settings.redis_url:
            log.warning("REDIS_URL not set — caching disabled")
            return None

        try:
            import redis.asyncio as aioredis
            c = aioredis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=2,
            )
            await c.ping()
            log.info("Redis connected", extra={"url": settings.redis_url[:30]})
            _client = c
        except Exception as e:
            log.warning("Redis unavailable — caching disabled", extra={"err": str(e)})
            _client = None

    return _client


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash(data: Any) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:16]


async def cache_get(key: str) -> Optional[Any]:
    try:
        r = await _get_client()
        if not r:
            return None
        raw = await r.get(key)
        if raw:
            log.debug("Cache HIT", extra={"key": key})
            return json.loads(raw)
        log.debug("Cache MISS", extra={"key": key})
        return None
    except Exception as e:
        log.warning("cache_get error", extra={"key": key, "err": str(e)})
        return None


async def cache_set(key: str, value: Any, ttl_sec: int) -> None:
    try:
        r = await _get_client()
        if not r:
            return
        await r.set(key, json.dumps(value, default=str), ex=ttl_sec)
    except Exception as e:
        log.warning("cache_set error", extra={"key": key, "err": str(e)})


# ── Domain key builders ───────────────────────────────────────────────────────

def mentor_cache_key(user_id: str, message: str, intent: Optional[str], subject: Optional[str]) -> str:
    return f"mentor:resp:{_hash({'uid': user_id, 'msg': message[:120], 'intent': intent, 'sub': subject})}"


def guidance_cache_key(concept: str, mastery_bucket: int, mistake_type: Optional[str]) -> str:
    return f"guidance:{_hash({'c': concept, 'm': mastery_bucket, 'mt': mistake_type})}"


def explanation_cache_key(stable_id: str, style: str, mistake_type: Optional[str] = None) -> str:
    suffix = f":{mistake_type}" if mistake_type else ""
    return f"explanation:{stable_id}:{style}{suffix}"


async def close():
    """Graceful shutdown."""
    global _client
    if _client:
        await _client.aclose()
        _client = None
