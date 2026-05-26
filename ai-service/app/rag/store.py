"""
ChromaDB persistence layer.

Collection metadata schema (flat dict — ChromaDB requirement):
  exam                 str   "JEE_MAIN" | "NEET" | "CBSE"
  subject              str   "Physics" | "Chemistry" | ...
  unit                 str   "" if None
  chapter              str   "Laws of Motion"
  topic                str   "" if None
  chunk_type           str   ChunkType.value
  source               str   "textbook" | "generated" | ...
  difficulty           str   "" if None
  has_diagram          str   "true" | "false"   (ChromaDB stores str, not bool)
  diagram_type         str   "" if None
  diagram_description  str   "" if None
  keywords_csv         str   comma-separated keyword list

Embeddings: 384-dim cosine-normalised float32 (all-MiniLM-L6-v2).
Similarity metric: cosine (hnsw:space = cosine).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings
from app.rag.models import Chunk, ChunkMetadata


# ---------------------------------------------------------------------------
# Client / collection
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(
        path=settings.chroma_persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def _get_collection() -> chromadb.Collection:
    return _get_client().get_or_create_collection(
        name=settings.chroma_collection,
        metadata={"hnsw:space": "cosine"},
    )


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------

def _meta_to_chroma(meta: ChunkMetadata) -> dict[str, str]:
    """Flatten ChunkMetadata → ChromaDB-compatible flat str dict."""
    return {
        "exam":                meta.exam,
        "subject":             meta.subject,
        "unit":                meta.unit    or "",
        "chapter":             meta.chapter,
        "topic":               meta.topic   or "",
        "chunk_type":          meta.chunk_type.value,
        "source":              meta.source,
        "difficulty":          meta.difficulty or "",
        "has_diagram":         "true" if meta.diagram.has_diagram else "false",
        "diagram_type":        meta.diagram.diagram_type    or "",
        "diagram_description": meta.diagram.description     or "",
        "keywords_csv":        ",".join(meta.keywords),
    }


def _chroma_to_meta_dict(raw: dict) -> dict:
    """Rehydrate a ChromaDB metadata dict into the shape retriever expects."""
    return {
        "exam":                raw.get("exam", ""),
        "subject":             raw.get("subject", ""),
        "unit":                raw.get("unit",    "") or None,
        "chapter":             raw.get("chapter", ""),
        "topic":               raw.get("topic",   "") or None,
        "chunk_type":          raw.get("chunk_type", "theory"),
        "source":              raw.get("source", ""),
        "difficulty":          raw.get("difficulty", "") or None,
        "has_diagram":         raw.get("has_diagram", "false") == "true",
        "diagram_type":        raw.get("diagram_type", "") or None,
        "diagram_description": raw.get("diagram_description", "") or None,
        "keywords":            [k for k in raw.get("keywords_csv", "").split(",") if k],
    }


# ---------------------------------------------------------------------------
# Public write API
# ---------------------------------------------------------------------------

def upsert_chunks(chunks: list[Chunk], embeddings: list[list[float]]) -> int:
    """
    Upsert chunks + pre-computed embeddings into ChromaDB.
    Returns the number of chunks stored.
    """
    if not chunks:
        return 0
    col = _get_collection()
    col.upsert(
        ids        = [c.id for c in chunks],
        documents  = [c.content for c in chunks],
        embeddings = embeddings,
        metadatas  = [_meta_to_chroma(c.metadata) for c in chunks],
    )
    return len(chunks)


def delete_by_chapter(exam: str, subject: str, chapter: str) -> int:
    """Delete all chunks for a given chapter (used before re-ingestion)."""
    col = _get_collection()
    results = col.get(
        where={"$and": [
            {"exam":    {"$eq": exam}},
            {"subject": {"$eq": subject}},
            {"chapter": {"$eq": chapter}},
        ]},
        include=[],
    )
    ids = results.get("ids", [])
    if ids:
        col.delete(ids=ids)
    return len(ids)


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------

def collection_count() -> int:
    """Total number of chunks currently stored."""
    return _get_collection().count()


def query_collection(
    query_embedding: list[float],
    n_results:       int,
    where:           Optional[dict] = None,
) -> dict:
    """
    Raw ChromaDB query. Returns the native response dict with
    keys: ids, documents, metadatas, distances.
    """
    col = _get_collection()
    kwargs: dict = {
        "query_embeddings": [query_embedding],
        "n_results":        min(n_results, max(col.count(), 1)),
        "include":          ["documents", "metadatas", "distances"],
    }
    if where:
        kwargs["where"] = where
    return col.query(**kwargs)


# ---------------------------------------------------------------------------
# Admin read API
# ---------------------------------------------------------------------------

def get_chunks(
    where:  Optional[dict] = None,
    limit:  int = 50,
    offset: int = 0,
) -> list[dict]:
    """
    Fetch raw chunk records (id + document + metadata) for admin inspection.
    Returns a list of dicts with keys: id, content, metadata.
    """
    col = _get_collection()
    kwargs: dict = {"include": ["documents", "metadatas"]}
    if where:
        kwargs["where"] = where

    results = col.get(**kwargs)
    ids  = results.get("ids", [])
    docs = results.get("documents", [])
    metas = results.get("metadatas", [])

    records = [
        {"id": i, "content": d, "metadata": _chroma_to_meta_dict(m)}
        for i, d, m in zip(ids, docs, metas)
    ]
    return records[offset: offset + limit]


def get_chunk_by_id(chunk_id: str) -> Optional[dict]:
    """Fetch a single chunk by its UUID. Returns None if not found."""
    col = _get_collection()
    results = col.get(ids=[chunk_id], include=["documents", "metadatas"])
    ids  = results.get("ids", [])
    if not ids:
        return None
    return {
        "id":       ids[0],
        "content":  results["documents"][0],
        "metadata": _chroma_to_meta_dict(results["metadatas"][0]),
    }


def get_all_metadata(where: Optional[dict] = None) -> list[dict]:
    """
    Fetch metadata for all matching chunks (no document content).
    Used by quality metrics and evaluator to avoid large document payloads.
    """
    col = _get_collection()
    kwargs: dict = {"include": ["metadatas"]}
    if where:
        kwargs["where"] = where
    results = col.get(**kwargs)
    ids   = results.get("ids", [])
    metas = results.get("metadatas", [])
    return [
        {"id": i, **_chroma_to_meta_dict(m)}
        for i, m in zip(ids, metas)
    ]
