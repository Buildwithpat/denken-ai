"""
Syllabus-aware hierarchical text chunker.

Hierarchy supported:
  exam → subject → unit → chapter → topic → content

The chunker splits at sentence boundaries to stay within MAX_CHUNK_CHARS
and carries one sentence of overlap between adjacent chunks so retrieval
doesn't lose context at split points.

Input formats accepted by `chunk_syllabus_content()`:
  {
    "exam":    "JEE_MAIN",
    "subject": "Physics",
    "unit":    "Mechanics",         # optional
    "chapter": "Laws of Motion",
    "topics":  {
        "Newton's First Law":  "An object at rest...",
        "Newton's Second Law": "F = ma means...",
    },
    "content": "Chapter-level prose...",   # optional, processed as topic=None
    "source":  "textbook",                 # optional, default "generated"
  }
"""
from __future__ import annotations

import re
import uuid
from typing import Optional

from app.rag.models import Chunk, ChunkMetadata, ChunkType
from app.rag.extractor import extract_diagram_info, infer_chunk_type, extract_keywords

MAX_CHUNK_CHARS  = 1_600   # ~400 tokens at 4 chars/token
MIN_CHUNK_CHARS  = 60
OVERLAP_SENTENCES = 1      # sentences shared between consecutive chunks


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _sentence_split(text: str) -> list[str]:
    """Split on sentence-ending punctuation followed by whitespace."""
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def _build_chunk(
    sentences:  list[str],
    exam:       str,
    subject:    str,
    chapter:    str,
    unit:       Optional[str],
    topic:      Optional[str],
    source:     str,
) -> Optional[Chunk]:
    content = " ".join(sentences)
    if len(content) < MIN_CHUNK_CHARS:
        return None

    diagram  = extract_diagram_info(content)
    ctype    = ChunkType.diagram if diagram.has_diagram else infer_chunk_type(content)
    keywords = extract_keywords(content)

    meta = ChunkMetadata(
        exam=exam,
        subject=subject,
        unit=unit,
        chapter=chapter,
        topic=topic,
        chunk_type=ctype,
        source=source,
        diagram=diagram,
        keywords=keywords,
    )
    return Chunk(id=str(uuid.uuid4()), content=content, metadata=meta)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def chunk_text(
    text:       str,
    exam:       str,
    subject:    str,
    chapter:    str,
    unit:       Optional[str] = None,
    topic:      Optional[str] = None,
    source:     str = "generated",
    max_chars:  int = MAX_CHUNK_CHARS,
) -> list[Chunk]:
    """
    Split `text` into overlapping sentence-boundary chunks,
    each ≤ max_chars characters. Returns Chunk objects with
    extracted diagram info, chunk type, and keywords.
    """
    sentences = _sentence_split(text)
    chunks:  list[Chunk] = []
    window:  list[str]   = []
    char_len = 0

    for sent in sentences:
        if char_len + len(sent) > max_chars and window:
            c = _build_chunk(window, exam, subject, chapter, unit, topic, source)
            if c:
                chunks.append(c)
            # carry overlap into next window
            window   = window[-OVERLAP_SENTENCES:] + [sent]
            char_len = sum(len(s) for s in window)
        else:
            window.append(sent)
            char_len += len(sent)

    # flush remaining window
    if window:
        c = _build_chunk(window, exam, subject, chapter, unit, topic, source)
        if c:
            chunks.append(c)

    return chunks


def chunk_syllabus_content(content_map: dict) -> list[Chunk]:
    """
    Process a structured content_map and return all Chunks.

    Each topic in `content_map["topics"]` is chunked independently,
    preserving full hierarchy metadata at every chunk level.
    A top-level "content" key is treated as chapter-level text (topic=None).
    """
    exam    = content_map.get("exam",    "JEE_MAIN")
    subject = content_map["subject"]
    chapter = content_map["chapter"]
    unit    = content_map.get("unit")
    source  = content_map.get("source", "generated")

    chunks: list[Chunk] = []

    # Topic-level content (most granular — preferred)
    for topic_name, text in content_map.get("topics", {}).items():
        if text and text.strip():
            chunks.extend(chunk_text(
                text, exam, subject, chapter,
                unit=unit, topic=topic_name, source=source,
            ))

    # Chapter-level content (no topic tag)
    chapter_text = content_map.get("content", "")
    if chapter_text and chapter_text.strip():
        chunks.extend(chunk_text(
            chapter_text, exam, subject, chapter,
            unit=unit, topic=None, source=source,
        ))

    return chunks
