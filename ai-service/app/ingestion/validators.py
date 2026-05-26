"""
Content-map validation before ingestion.

Checks field presence, known exam/subject values, and content length.
Returns a list of error strings (empty list = valid).
"""
from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Known domain values (extend as needed)
# ---------------------------------------------------------------------------

KNOWN_EXAMS = {"JEE_MAIN", "JEE_ADVANCED", "NEET", "CBSE", "BOARDS"}

KNOWN_SUBJECTS: dict[str, set[str]] = {
    "JEE_MAIN":     {"Physics", "Chemistry", "Mathematics"},
    "JEE_ADVANCED": {"Physics", "Chemistry", "Mathematics"},
    "NEET":         {"Physics", "Chemistry", "Biology"},
    "CBSE":         {"Physics", "Chemistry", "Mathematics", "Biology", "English", "History"},
    "BOARDS":       {"Physics", "Chemistry", "Mathematics", "Biology", "English"},
}

_MIN_CONTENT_CHARS = 40
_MAX_CONTENT_CHARS = 200_000   # ~200 KB per content_map


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_content_map(cm: dict[str, Any]) -> list[str]:
    """
    Validate a single content_map dict.
    Returns a list of human-readable error strings.
    An empty list means the map is valid.
    """
    errors: list[str] = []

    # ── Required string fields ────────────────────────────────────────────
    for field in ("exam", "subject", "chapter"):
        val = cm.get(field)
        if not val or not isinstance(val, str) or not val.strip():
            errors.append(f"Missing or blank required field: '{field}'")

    exam    = str(cm.get("exam", "")).strip()
    subject = str(cm.get("subject", "")).strip()

    # ── Exam consistency ─────────────────────────────────────────────────
    if exam and exam not in KNOWN_EXAMS:
        errors.append(
            f"Unknown exam '{exam}'. Known values: {sorted(KNOWN_EXAMS)}"
        )

    # ── Subject consistency ──────────────────────────────────────────────
    if exam in KNOWN_SUBJECTS and subject:
        allowed = KNOWN_SUBJECTS[exam]
        if subject not in allowed:
            errors.append(
                f"Subject '{subject}' is not recognised for exam '{exam}'. "
                f"Allowed: {sorted(allowed)}"
            )

    # ── Content presence ─────────────────────────────────────────────────
    topics  = cm.get("topics", {})
    content = cm.get("content", "")

    has_topics  = isinstance(topics, dict)  and bool(topics)
    has_content = isinstance(content, str)  and len(content.strip()) >= _MIN_CONTENT_CHARS

    if not has_topics and not has_content:
        errors.append(
            "content_map must have either a non-empty 'topics' dict or a "
            f"'content' string of at least {_MIN_CONTENT_CHARS} characters."
        )

    # ── Content length cap ────────────────────────────────────────────────
    total_chars = len(content)
    if isinstance(topics, dict):
        for v in topics.values():
            if isinstance(v, str):
                total_chars += len(v)
    if total_chars > _MAX_CONTENT_CHARS:
        errors.append(
            f"Total content size {total_chars:,} chars exceeds the "
            f"{_MAX_CONTENT_CHARS:,}-char limit per content_map. Split it."
        )

    return errors


def validate_batch(
    content_maps: list[dict[str, Any]],
) -> dict[str, list[str]]:
    """
    Validate a list of content_maps.
    Returns {index_str: [errors]} for every map that has at least one error.
    """
    failures: dict[str, list[str]] = {}
    for i, cm in enumerate(content_maps):
        errs = validate_content_map(cm)
        if errs:
            failures[str(i)] = errs
    return failures
