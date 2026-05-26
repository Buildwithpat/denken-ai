"""
PDF → content_map loader.

Supports NCERT-style textbooks and PYQ (Previous Year Question) PDFs.
Extracts text per page, detects section headings heuristically, and
groups pages into chapter-level content_maps.

Requires PyMuPDF (fitz). Import is deferred so the module can be imported
even when pymupdf is not installed (it raises ImportError only on use).
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Heading detection
# ---------------------------------------------------------------------------

# Matches lines that look like chapter/section headings:
#   "1.1  Newton's Laws"  /  "CHAPTER 3 — THERMODYNAMICS"  /  "Unit 2: ..."
_HEADING_RE = re.compile(
    r"^(?:\d+[\.\d]*\s+|CHAPTER\s+\d+|Unit\s+\d+|SECTION\s+\d+)",
    re.IGNORECASE,
)
_ALL_CAPS_HEADING = re.compile(r"^[A-Z][A-Z\s\-]{5,80}$")


def _looks_like_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped or len(stripped) > 100:
        return False
    return bool(_HEADING_RE.match(stripped)) or bool(_ALL_CAPS_HEADING.match(stripped))


# ---------------------------------------------------------------------------
# PDF text extraction
# ---------------------------------------------------------------------------

def _extract_pages(pdf_path: str) -> list[str]:
    """Return a list of text strings, one per page."""
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise ImportError(
            "PyMuPDF is required for PDF ingestion. "
            "Install it with: pip install pymupdf"
        ) from exc

    doc = fitz.open(pdf_path)
    pages: list[str] = []
    for page in doc:
        pages.append(page.get_text("text"))
    doc.close()
    return pages


# ---------------------------------------------------------------------------
# Content-map builder
# ---------------------------------------------------------------------------

def _group_into_chapters(
    pages: list[str],
    exam:    str,
    subject: str,
    source:  str,
) -> list[dict]:
    """
    Split pages into chapter-level content_maps using heading detection.
    When no headings are found, the entire PDF is treated as one chapter.
    """
    content_maps: list[dict] = []
    current_chapter = "Chapter 1"
    current_pages:  list[str] = []

    def _flush():
        text = "\n\n".join(current_pages).strip()
        if text:
            content_maps.append({
                "exam":    exam,
                "subject": subject,
                "chapter": current_chapter,
                "content": text,
                "source":  source,
            })

    for page_text in pages:
        lines = page_text.splitlines()
        for line in lines[:6]:          # headings normally appear near the top
            if _looks_like_heading(line):
                _flush()
                current_chapter = line.strip()[:120]
                current_pages = []
                break
        current_pages.append(page_text)

    _flush()
    return content_maps


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_pdf(
    pdf_path:   str,
    exam:       str,
    subject:    str,
    source:     str = "pdf",
    chapter:    Optional[str] = None,
) -> list[dict]:
    """
    Extract text from a PDF and return a list of content_map dicts.

    If `chapter` is provided, all pages are merged into one map with that
    chapter name (useful for short formula sheets or single-chapter PDFs).
    Otherwise, heading detection splits the PDF into per-chapter maps.

    Each returned dict has keys: exam, subject, chapter, content, source.
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    pages = _extract_pages(pdf_path)
    if not pages:
        return []

    if chapter:
        text = "\n\n".join(pages).strip()
        return [{
            "exam": exam, "subject": subject,
            "chapter": chapter, "content": text, "source": source,
        }] if text else []

    return _group_into_chapters(pages, exam=exam, subject=subject, source=source)
