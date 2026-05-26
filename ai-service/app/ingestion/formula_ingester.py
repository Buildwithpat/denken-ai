"""
Formula dataset ingester.

Receives formula chapter data from the Express backend (via HTTP POST)
and ingests it as structured chunks into ChromaDB, making all 105 formula
chapters semantically searchable.

Each formula chapter is split into:
  - One "formula" chunk per concept (containing all formulas for that concept)
  - One "theory" chunk for the chapter's common mistakes + important notes
  - One "definition" chunk per concept description (if present)

This enables queries like:
  "formula for electric field intensity" → retrieves Electrostatics formula chunk
  "common mistakes in optics" → retrieves Optics notes chunk
"""
from __future__ import annotations

from typing import Optional

from app.rag.models    import Chunk, ChunkMetadata, ChunkType
from app.rag.embedder  import embed_texts
from app.rag.store     import upsert_chunks, delete_by_chapter
from app.rag.models    import IngestResult
from app.config        import settings


def _subject_to_exam(subject: str) -> str:
    """Map subject slug to exam tag (conservative — all map to JEE_MAIN for now)."""
    return "JEE_MAIN"


def ingest_formula_chapter(
    chapter_data: dict,
    subject_slug: str,
    exam:         str      = "JEE_MAIN",
    replace:      bool     = False,
) -> IngestResult:
    """
    Ingest a single formula chapter (the JSON structure from formulaLoader).

    Expected chapter_data shape:
    {
      "chapterName": "Electrostatics",
      "subject": "Physics",
      "concepts": [
        {
          "conceptName": "Coulomb's Law",
          "description": "...",
          "formulas": [
            {"name": "Coulomb's Law", "equation": "F = kq1q2/r²", "meaning": "...", ...}
          ]
        }
      ],
      "commonMistakes": ["...", "..."],
      "importantNotes": ["...", "..."]
    }
    """
    chapter_name = chapter_data.get("chapterName", "Unknown Chapter")
    subject_name = chapter_data.get("subject", subject_slug.title())
    concepts     = chapter_data.get("concepts", [])
    mistakes     = chapter_data.get("commonMistakes", [])
    notes        = chapter_data.get("importantNotes", [])
    keywords     = chapter_data.get("keywords", [])
    tags         = chapter_data.get("tags", [])

    if replace:
        try:
            delete_by_chapter(exam=exam, subject=subject_name, chapter=chapter_name)
        except Exception:
            pass  # ignore — best effort

    chunks: list[Chunk] = []

    for concept in concepts:
        concept_name = concept.get("conceptName", "")
        description  = concept.get("description", "")
        formulas     = concept.get("formulas", [])

        # Theory/definition chunk for the concept description
        if description and len(description.strip()) > 30:
            chunks.append(Chunk(
                content  = f"{concept_name}: {description}",
                metadata = ChunkMetadata(
                    exam       = exam,
                    subject    = subject_name,
                    chapter    = chapter_name,
                    topic      = concept_name,
                    chunk_type = ChunkType.definition,
                    source     = "formula_dataset",
                    keywords   = keywords + tags,
                ),
            ))

        # Formula chunk — all formulas for this concept in one chunk
        if formulas:
            formula_lines = [f"**{concept_name}** formulas:"]
            for f in formulas:
                name      = f.get("name", "")
                equation  = f.get("equation", "")
                meaning   = f.get("meaning", "")
                variables = f.get("variables", {})
                conditions = f.get("conditions", [])

                line = f"{name}: {equation}"
                if meaning:
                    line += f" — {meaning}"
                formula_lines.append(line)

                if variables:
                    var_str = ", ".join(f"{k}={v}" for k, v in list(variables.items())[:4])
                    formula_lines.append(f"  Variables: {var_str}")
                if conditions:
                    formula_lines.append(f"  Conditions: {'; '.join(conditions[:2])}")

            chunks.append(Chunk(
                content  = "\n".join(formula_lines),
                metadata = ChunkMetadata(
                    exam       = exam,
                    subject    = subject_name,
                    chapter    = chapter_name,
                    topic      = concept_name,
                    chunk_type = ChunkType.formula,
                    source     = "formula_dataset",
                    keywords   = keywords + tags + [concept_name],
                ),
            ))

    # Common mistakes chunk
    if mistakes:
        chunks.append(Chunk(
            content  = f"Common mistakes in {chapter_name}:\n" + "\n".join(f"- {m}" for m in mistakes[:8]),
            metadata = ChunkMetadata(
                exam       = exam,
                subject    = subject_name,
                chapter    = chapter_name,
                chunk_type = ChunkType.summary,
                source     = "formula_dataset",
                keywords   = keywords + ["common mistakes", "errors", "pitfalls"],
            ),
        ))

    # Important notes chunk
    if notes:
        chunks.append(Chunk(
            content  = f"Important notes for {chapter_name}:\n" + "\n".join(f"- {n}" for n in notes[:6]),
            metadata = ChunkMetadata(
                exam       = exam,
                subject    = subject_name,
                chapter    = chapter_name,
                chunk_type = ChunkType.theory,
                source     = "formula_dataset",
                keywords   = keywords + ["important notes", "remember", "key points"],
            ),
        ))

    if not chunks:
        return IngestResult(
            ingested=0, skipped=0,
            collection=settings.chroma_collection,
            errors=[f"No chunks produced for {chapter_name}"],
        )

    try:
        embeddings = embed_texts([c.content for c in chunks])
        count      = upsert_chunks(chunks, embeddings)
        return IngestResult(ingested=count, skipped=0, collection=settings.chroma_collection)
    except Exception as exc:
        return IngestResult(
            ingested=0, skipped=len(chunks),
            collection=settings.chroma_collection,
            errors=[str(exc)],
        )


def ingest_formula_batch(
    chapters: list[dict],
    subject_slug: str,
    exam: str = "JEE_MAIN",
    replace: bool = False,
) -> dict:
    """
    Ingest a batch of formula chapters for one subject.
    Returns summary statistics.
    """
    total_ingested = 0
    total_skipped  = 0
    errors: list[str] = []

    for chapter_data in chapters:
        result = ingest_formula_chapter(chapter_data, subject_slug, exam, replace)
        total_ingested += result.ingested
        total_skipped  += result.skipped
        errors.extend(result.errors)

    return {
        "ingested":  total_ingested,
        "skipped":   total_skipped,
        "chapters":  len(chapters),
        "subject":   subject_slug,
        "errors":    errors[:5],  # cap to avoid huge payloads
    }
