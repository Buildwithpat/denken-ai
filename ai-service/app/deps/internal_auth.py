"""
Shared-secret guard for internal-only routes (/admin, /debug).

These routes expose data ingestion, deletion, and RAG pipeline internals and
must never be reachable without this header. Fails closed: if
INTERNAL_API_KEY is not configured, every request is rejected rather than
left open.
"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from app.config import settings


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    if not settings.internal_api_key or not x_internal_key or not hmac.compare_digest(
        x_internal_key, settings.internal_api_key
    ):
        # 404, not 401/403 — don't reveal that this route exists to unauthenticated callers.
        raise HTTPException(status_code=404, detail="Not Found")
