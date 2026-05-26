"""
Structured JSON logging for the ai-service.

In production, every log line is a valid JSON object consumable by
log aggregators (Datadog, CloudWatch, Grafana Loki).
In development, human-readable output is used instead.

Usage:
    from app.lib.logger import get_logger
    log = get_logger(__name__)
    log.info("Gemini call completed", extra={"latency_ms": 320, "tokens": 800})
"""

import json
import logging
import os
import time


class JsonFormatter(logging.Formatter):
    """Emit one JSON object per log record."""

    def format(self, record: logging.LogRecord) -> str:
        obj: dict = {
            "ts":      self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.getMessage(),
        }
        # Merge any `extra` fields the caller passed
        for key, val in record.__dict__.items():
            if key not in (
                "args", "asctime", "created", "exc_info", "exc_text", "filename",
                "funcName", "id", "levelname", "levelno", "lineno", "module",
                "msecs", "message", "msg", "name", "pathname", "process",
                "processName", "relativeCreated", "stack_info", "thread",
                "threadName",
            ):
                obj[key] = val

        if record.exc_info:
            obj["exc"] = self.formatException(record.exc_info)

        return json.dumps(obj, default=str)


def _build_handler() -> logging.Handler:
    handler = logging.StreamHandler()
    env = os.getenv("NODE_ENV", os.getenv("APP_ENV", "development"))
    if env == "production":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s", "%H:%M:%S")
        )
    return handler


_root = logging.getLogger("denken_ai")
_root.setLevel(logging.DEBUG if os.getenv("APP_ENV") != "production" else logging.INFO)
if not _root.handlers:
    _root.addHandler(_build_handler())


def get_logger(name: str) -> logging.Logger:
    """Return a child logger scoped to `name`."""
    return _root.getChild(name)
