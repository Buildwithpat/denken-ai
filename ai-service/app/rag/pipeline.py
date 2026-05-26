"""
RAG ingestion pipeline — orchestrates chunking → embedding → storage.

Two entry points:

  ingest_content_map(content_map, replace=False)
      Full pipeline for a structured dict (see chunker.py for shape).

  ingest_text(text, exam, subject, chapter, ...)
      Convenience wrapper for ingesting a plain text block at any
      hierarchy level.

Both return IngestResult with counts and any error messages.
"""
from __future__ import annotations

from typing import Optional

from app.rag.chunker  import chunk_syllabus_content, chunk_text
from app.rag.embedder import embed_texts
from app.rag.store    import upsert_chunks, delete_by_chapter
from app.rag.models   import IngestResult
from app.config       import settings


def ingest_content_map(
    content_map: dict,
    replace:     bool = False,
) -> IngestResult:
    """
    Full ingestion pipeline for a structured content_map dict.

    Set replace=True to delete all existing chunks for
    (exam, subject, chapter) before ingesting the new content.
    """
    errors: list[str] = []

    try:
        chunks = chunk_syllabus_content(content_map)
    except Exception as exc:
        return IngestResult(ingested=0, skipped=0, collection="", errors=[str(exc)])

    if not chunks:
        return IngestResult(
            ingested=0, skipped=0,
            collection=settings.chroma_collection,
            errors=["No chunks produced — check that text fields are non-empty"],
        )

    if replace:
        try:
            delete_by_chapter(
                exam=content_map.get("exam", ""),
                subject=content_map.get("subject", ""),
                chapter=content_map.get("chapter", ""),
            )
        except Exception as exc:
            errors.append(f"delete warning: {exc}")

    try:
        embeddings = embed_texts([c.content for c in chunks])
        count      = upsert_chunks(chunks, embeddings)
    except Exception as exc:
        return IngestResult(
            ingested=0, skipped=len(chunks),
            collection=settings.chroma_collection,
            errors=[str(exc)],
        )

    return IngestResult(
        ingested=count,
        skipped=0,
        collection=settings.chroma_collection,
        errors=errors,
    )


def ingest_text(
    text:    str,
    exam:    str,
    subject: str,
    chapter: str,
    unit:    Optional[str] = None,
    topic:   Optional[str] = None,
    source:  str  = "generated",
    replace: bool = False,
) -> IngestResult:
    """
    Convenience wrapper — ingest a plain text block at any hierarchy level.
    Supply `topic` to tag chunks at the sub-chapter level.
    """
    content_map: dict = {
        "exam":    exam,
        "subject": subject,
        "chapter": chapter,
        "source":  source,
    }
    if unit:
        content_map["unit"] = unit

    if topic:
        content_map["topics"] = {topic: text}
    else:
        content_map["content"] = text

    return ingest_content_map(content_map, replace=replace)
