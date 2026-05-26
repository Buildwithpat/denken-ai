"""
ChromaDB persistence layer.

All chromadb imports are deferred inside functions so that importing this
module is free (no RAM cost) when ChromaDB is not installed. This lets the
service start cleanly on Render free-tier with requirements-lite.txt.

To re-enable full vector-store support: install chromadb and its deps.
The code path is identical — no other changes needed.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from app.config import settings
from app.rag.models import Chunk, ChunkMetadata


# ---------------------------------------------------------------------------
# Availability sentinel — checked once, cached forever
# ---------------------------------------------------------------------------

_CHROMA_AVAILABLE: Optional[bool] = None


def _is_chroma_available() -> bool:
    global _CHROMA_AVAILABLE
    if _CHROMA_AVAILABLE is None:
        try:
            import chromadb  # noqa: F401
            _CHROMA_AVAILABLE = True
        except ImportError:
            _CHROMA_AVAILABLE = False
    return _CHROMA_AVAILABLE


# ---------------------------------------------------------------------------
# Client / collection (lazy — only instantiated on first real call)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_client():  # type: ignore[return]
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    return chromadb.PersistentClient(
        path=settings.chroma_persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def _get_collection():  # type: ignore[return]
    import chromadb
    return _get_client().get_or_create_collection(
        name=settings.chroma_collection,
        metadata={"hnsw:space": "cosine"},
    )


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------

def _meta_to_chroma(meta: ChunkMetadata) -> dict[str, str]:
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
    if not _is_chroma_available():
        raise RuntimeError("ChromaDB not installed — RAG ingestion unavailable in lite mode.")
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
    if not _is_chroma_available():
        return 0
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
    """Returns 0 when ChromaDB is not installed — safe to call always."""
    if not _is_chroma_available():
        return 0
    try:
        return _get_collection().count()
    except Exception:
        return 0


def query_collection(
    query_embedding: list[float],
    n_results:       int,
    where:           Optional[dict] = None,
) -> dict:
    if not _is_chroma_available():
        return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}
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
    if not _is_chroma_available():
        return []
    col = _get_collection()
    kwargs: dict = {"include": ["documents", "metadatas"]}
    if where:
        kwargs["where"] = where

    results = col.get(**kwargs)
    ids   = results.get("ids", [])
    docs  = results.get("documents", [])
    metas = results.get("metadatas", [])

    records = [
        {"id": i, "content": d, "metadata": _chroma_to_meta_dict(m)}
        for i, d, m in zip(ids, docs, metas)
    ]
    return records[offset: offset + limit]


def get_chunk_by_id(chunk_id: str) -> Optional[dict]:
    if not _is_chroma_available():
        return None
    col = _get_collection()
    results = col.get(ids=[chunk_id], include=["documents", "metadatas"])
    ids = results.get("ids", [])
    if not ids:
        return None
    return {
        "id":       ids[0],
        "content":  results["documents"][0],
        "metadata": _chroma_to_meta_dict(results["metadatas"][0]),
    }


def get_all_metadata(where: Optional[dict] = None) -> list[dict]:
    if not _is_chroma_available():
        return []
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
