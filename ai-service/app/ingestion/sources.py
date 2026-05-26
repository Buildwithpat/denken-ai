"""
High-level ingestion entry points.

Each function accepts a source (file path, dict, or raw text), validates it,
converts it to one or more content_maps, and calls pipeline.ingest_content_map().

All functions return IngestResult or a list thereof.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from app.rag.models import IngestResult
from app.rag.pipeline import ingest_content_map


# ---------------------------------------------------------------------------
# From PDF
# ---------------------------------------------------------------------------

def ingest_from_pdf(
    pdf_path:  str,
    exam:      str,
    subject:   str,
    source:    str = "pdf",
    chapter:   Optional[str] = None,
    replace:   bool = False,
    validate:  bool = True,
) -> list[IngestResult]:
    """
    Ingest a PDF file (NCERT / PYQ / formula sheet).
    Returns one IngestResult per detected chapter.
    """
    from app.ingestion.pdf_loader import load_pdf
    from app.ingestion.validators import validate_content_map

    maps = load_pdf(pdf_path, exam=exam, subject=subject,
                    source=source, chapter=chapter)
    results: list[IngestResult] = []
    for cm in maps:
        if validate:
            errs = validate_content_map(cm)
            if errs:
                results.append(IngestResult(
                    ingested=0, skipped=0, collection="",
                    errors=errs,
                ))
                continue
        results.append(ingest_content_map(cm, replace=replace))
    return results


# ---------------------------------------------------------------------------
# From syllabus JSON
# ---------------------------------------------------------------------------

def ingest_from_json_file(
    json_path: str,
    replace:   bool = False,
    validate:  bool = True,
) -> list[IngestResult]:
    """
    Ingest one or more content_maps from a JSON file.
    The file must contain either a single dict or a list of dicts.
    """
    from app.ingestion.validators import validate_content_map

    path = Path(json_path)
    if not path.exists():
        raise FileNotFoundError(f"JSON file not found: {json_path}")

    raw = json.loads(path.read_text(encoding="utf-8"))
    maps: list[dict] = raw if isinstance(raw, list) else [raw]

    results: list[IngestResult] = []
    for cm in maps:
        if validate:
            errs = validate_content_map(cm)
            if errs:
                results.append(IngestResult(
                    ingested=0, skipped=0, collection="",
                    errors=errs,
                ))
                continue
        results.append(ingest_content_map(cm, replace=replace))
    return results


# ---------------------------------------------------------------------------
# Formula sheet (plain text or dict)
# ---------------------------------------------------------------------------

def ingest_formula_sheet(
    content:  str,
    exam:     str,
    subject:  str,
    chapter:  str,
    source:   str = "formula_sheet",
    replace:  bool = False,
) -> IngestResult:
    """
    Ingest a plain-text formula sheet, marking every chunk type as 'formula'.
    The content is passed directly as a single content_map.
    """
    cm = {
        "exam":    exam,
        "subject": subject,
        "chapter": chapter,
        "content": content,
        "source":  source,
    }
    return ingest_content_map(cm, replace=replace)


# ---------------------------------------------------------------------------
# Raw text
# ---------------------------------------------------------------------------

def ingest_raw_text(
    text:     str,
    exam:     str,
    subject:  str,
    chapter:  str,
    unit:     Optional[str] = None,
    topic:    Optional[str] = None,
    source:   str = "raw",
    replace:  bool = False,
    validate: bool = True,
) -> IngestResult:
    """Convenience wrapper: ingest arbitrary text with explicit metadata."""
    from app.ingestion.validators import validate_content_map

    cm: dict = {
        "exam": exam, "subject": subject,
        "chapter": chapter, "content": text, "source": source,
    }
    if unit:
        cm["unit"] = unit
    if topic:
        cm["topics"] = {topic: text}
        cm.pop("content", None)

    if validate:
        errs = validate_content_map(cm)
        if errs:
            return IngestResult(ingested=0, skipped=0, collection="", errors=errs)
    return ingest_content_map(cm, replace=replace)
