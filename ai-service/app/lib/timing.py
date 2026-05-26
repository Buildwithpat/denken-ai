"""
Request timing middleware — logs every request with method, path, status, and latency.
"""

import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.lib.logger import get_logger

log = get_logger("http")


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        t0 = time.monotonic()
        response = await call_next(request)
        ms = round((time.monotonic() - t0) * 1000)

        level = "error" if response.status_code >= 500 else (
                "warning" if response.status_code >= 400 else "info")

        getattr(log, level)(
            f"{request.method} {request.url.path}",
            extra={
                "method": request.method,
                "path":   request.url.path,
                "status": response.status_code,
                "ms":     ms,
            },
        )
        return response
