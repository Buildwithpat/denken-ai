"""
Image ingestion pipeline: OCR → text cleaning → diagram detection → RAG storage.

Supported formats: PNG, JPG/JPEG, WEBP.

Flow:
    image bytes → PIL load + preprocess → OCR (easyocr, pytesseract fallback)
    → text cleaning → content_map construction → existing RAG pipeline
"""
from __future__ import annotations

import functools
import io
import re
from typing import Optional

from app.rag.models import IngestResult
from app.rag.pipeline import ingest_content_map

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
SUPPORTED_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}

_MIN_QUERY_CHARS       = 10   # Minimum OCR text needed for a retrieval query
_DIAGRAM_WORD_THRESHOLD = 15  # Fewer words than this → treat as diagram-heavy image
_MAX_QUERY_CHARS       = 300  # Truncate OCR query to avoid embedding noise

# Strip leading question numbering: "Q1.", "Q.1", "1.", "(1)" etc.
_RE_Q_PREFIX    = re.compile(r'^(?:[Qq]\.?\s*)?\d+[.):\s]+')
# MCQ answer-option lines: "(A) foo\n", "(a) bar" — remove before embedding
_RE_MCQ_OPTIONS = re.compile(r'\([A-Da-d]\)\s*[^\n]*', re.IGNORECASE)


# ---------------------------------------------------------------------------
# OCR backend (lazy-loaded, cached)
# ---------------------------------------------------------------------------

@functools.lru_cache(maxsize=1)
def _easyocr_reader():
    """Load EasyOCR reader once. Downloads ~100 MB models on first call."""
    try:
        import easyocr  # noqa: PLC0415
        return easyocr.Reader(["en"], gpu=False, verbose=False)
    except ImportError:
        return None


def _preprocess(img: "PIL.Image.Image") -> "PIL.Image.Image":
    """Auto-contrast + mild contrast boost — improves OCR on low-contrast scans."""
    from PIL import ImageEnhance, ImageOps  # noqa: PLC0415
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img = ImageOps.autocontrast(img)
    img = ImageEnhance.Contrast(img).enhance(1.4)
    return img


def _ocr_easyocr(img: "PIL.Image.Image") -> str:
    reader = _easyocr_reader()
    if reader is None:
        return ""
    try:
        import numpy as np  # noqa: PLC0415
    except ImportError:
        return ""
    results = reader.readtext(np.array(img), detail=0, paragraph=True)
    return "\n".join(results)


def _ocr_pytesseract(img: "PIL.Image.Image") -> str:
    try:
        import pytesseract  # noqa: PLC0415
        return pytesseract.image_to_string(img)
    except ImportError:
        return ""


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def extract_text_from_image(file_bytes: bytes) -> str:
    """
    Run OCR on raw image bytes.
    Tries easyocr first; falls back to pytesseract if easyocr yields nothing.
    Returns empty string when neither backend is installed.
    """
    from PIL import Image  # noqa: PLC0415
    img = Image.open(io.BytesIO(file_bytes))
    img.load()
    img = _preprocess(img)

    text = _ocr_easyocr(img)
    if not text.strip():
        text = _ocr_pytesseract(img)
    return text


def clean_ocr_text(raw: str) -> str:
    """
    Normalize OCR output for downstream chunking and embedding.

    - Strips non-printable characters
    - Collapses internal whitespace runs
    - Drops lines shorter than 3 chars (OCR noise) unless they are list markers
    - Collapses triple+ blank lines to a single blank line
    """
    if not raw:
        return ""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    # Drop non-printable chars except LF, TAB, standard unicode
    text = re.sub(r"[^\x09\x0a\x20-\x7e -￿]", " ", text)
    # Collapse intra-line whitespace
    text = re.sub(r"[ \t]+", " ", text)

    cleaned_lines: list[str] = []
    for line in text.split("\n"):
        s = line.strip()
        # Keep if substantial, or if it's a list / section marker
        if len(s) >= 3 or re.match(r"^\d+[.)]\s*$", s):
            cleaned_lines.append(s)

    result = re.sub(r"\n{3,}", "\n\n", "\n".join(cleaned_lines))
    return result.strip()


def image_is_diagram_heavy(ocr_text: str) -> bool:
    """
    Heuristic: return True when the image contains very little readable text,
    suggesting it is primarily a diagram, figure, or graph.
    """
    return len(ocr_text.split()) < _DIAGRAM_WORD_THRESHOLD


# ---------------------------------------------------------------------------
# Ingestion entry point
# ---------------------------------------------------------------------------

def ingest_image(
    file_bytes:             bytes,
    filename:               str,
    exam:                   str,
    subject:                str,
    chapter:                str,
    unit:                   Optional[str] = None,
    topic:                  Optional[str] = None,
    source:                 str  = "image",
    replace:                bool = False,
    is_question_screenshot: bool = False,
) -> tuple[IngestResult, str, bool]:
    """
    Full image → RAG pipeline.

    Returns
    -------
    (IngestResult, ocr_text, is_diagram_heavy)
      ocr_text        — cleaned OCR text (empty string for diagram-only images)
      is_diagram_heavy — True when the image had very little readable text
    """
    if is_question_screenshot and source == "image":
        source = "question_screenshot"

    raw_text = extract_text_from_image(file_bytes)
    cleaned  = clean_ocr_text(raw_text)
    heavy    = image_is_diagram_heavy(cleaned)

    if not cleaned or len(cleaned) < _MIN_QUERY_CHARS:
        # Minimal text — synthesise a placeholder description so the image
        # is still discoverable via its metadata.
        placeholder = f"[Image: {filename}] Diagram or figure — no readable text extracted."
        body = placeholder
    else:
        body = cleaned

    cm: dict = {
        "exam":    exam,
        "subject": subject,
        "chapter": chapter,
        "source":  source,
    }
    if unit:
        cm["unit"] = unit
    if topic:
        cm["topics"] = {topic: body}
    else:
        cm["content"] = body

    result = ingest_content_map(cm, replace=replace)
    return result, cleaned, heavy


# ---------------------------------------------------------------------------
# Question-screenshot retrieval helper
# ---------------------------------------------------------------------------

def _clean_for_query(text: str) -> str:
    """
    Prepare cleaned OCR text for use as a retrieval query.

    Removes:
    - Leading question numbering ("Q1.", "Q.1", "1.", "(1) …")
    - MCQ answer-option lines ("(A) foo", "(B) bar", …)
    - Isolated single/double-char OCR noise tokens

    Truncates to _MAX_QUERY_CHARS to keep the embedding focused on the
    question stem rather than OCR garbage at the end of the page.
    """
    text = _RE_Q_PREFIX.sub('', text.strip())
    text = _RE_MCQ_OPTIONS.sub('', text)
    # Remove isolated 1–2 char tokens that are likely OCR noise
    text = re.sub(r'(?<!\w)[A-Za-z]{1,2}(?!\w)\s*', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:_MAX_QUERY_CHARS]


def extract_query_from_image(file_bytes: bytes) -> str:
    """
    Extract question text from a screenshot for use as a retrieval query.

    Applies OCR, then cleans the raw text (clean_ocr_text), then strips
    question numbering and MCQ answer options (_clean_for_query) before
    returning a focused, embedding-ready query string.

    Raises ValueError when the resulting text is too short to be useful.
    """
    raw   = extract_text_from_image(file_bytes)
    clean = clean_ocr_text(raw)
    query = _clean_for_query(clean)
    if len(query) < _MIN_QUERY_CHARS:
        raise ValueError(
            "Insufficient text extracted from image to form a retrieval query. "
            "Ensure the image contains readable printed text."
        )
    return query
