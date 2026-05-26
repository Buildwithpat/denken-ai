"""
Retrieval logic — embed a query, filter by metadata, over-fetch candidates,
re-rank with hybrid scoring, and return top-k chunks.

Each returned chunk dict contains:
  content, score (composite re-ranked 0–1), raw_semantic_score (cosine 0–1),
  exam, subject, unit, chapter, topic, chunk_type, source, has_diagram,
  diagram_type, diagram_description, keywords

Filtering:
  Supports compound WHERE clauses on exam / subject / chapter / chunk_type.
  Single-field filters skip the $and wrapper (ChromaDB requirement).

Re-ranking (app.rag.ranker):
  Fetches OVERFETCH_FACTOR × top_k candidates from ChromaDB, then applies
  keyword hybrid scoring, metadata/intent bonuses, duplicate suppression,
  and adaptive normalisation before trimming to top_k.
"""
from __future__ import annotations

from typing import Optional

from app.rag.embedder import embed_query
from app.rag.store    import collection_count, query_collection, _chroma_to_meta_dict
from app.rag.ranker   import rerank, OVERFETCH_FACTOR, MAX_FETCH


def _build_where(
    exam:       Optional[str],
    subject:    Optional[str],
    chapter:    Optional[str],
    chunk_type: Optional[str],
) -> Optional[dict]:
    clauses: list[dict] = []
    if exam:       clauses.append({"exam":       {"$eq": exam}})
    if subject:    clauses.append({"subject":    {"$eq": subject}})
    if chapter:    clauses.append({"chapter":    {"$eq": chapter}})
    if chunk_type: clauses.append({"chunk_type": {"$eq": chunk_type}})

    if not clauses:       return None
    if len(clauses) == 1: return clauses[0]
    return {"$and": clauses}


def retrieve(
    query:            str,
    *,
    exam:             Optional[str] = None,
    subject:          Optional[str] = None,
    chapter:          Optional[str] = None,
    chunk_type:       Optional[str] = None,
    topic:            Optional[str] = None,
    top_k:            int  = 5,
    include_diagrams: bool = True,
) -> list[dict]:
    """
    Retrieve the top_k most relevant chunks for `query`.

    Over-fetches (OVERFETCH_FACTOR × top_k, capped at MAX_FETCH) then
    applies re-ranking via app.rag.ranker.rerank() before trimming.

    Returns an empty list when the collection is empty — safe to call
    before any content has been ingested.

    Parameters
    ----------
    topic : Optional hint for metadata bonus scoring in the re-ranker.
            Not used as a ChromaDB WHERE filter.
    """
    if collection_count() == 0:
        return []

    qvec    = embed_query(query)
    where   = _build_where(exam, subject, chapter, chunk_type)
    fetch_k = min(top_k * OVERFETCH_FACTOR, MAX_FETCH)
    raw     = query_collection(qvec, fetch_k, where)

    candidates: list[dict] = []
    for doc, meta_raw, dist in zip(
        raw["documents"][0],
        raw["metadatas"][0],
        raw["distances"][0],
    ):
        meta = _chroma_to_meta_dict(meta_raw)
        if not include_diagrams and meta["has_diagram"]:
            continue
        candidates.append({
            "content": doc,
            "score":   round(1.0 - float(dist), 4),
            **meta,
        })

    return rerank(
        query=query,
        candidates=candidates,
        top_k=top_k,
        requested_exam=exam,
        requested_subject=subject,
        requested_chapter=chapter,
        requested_topic=topic,
        requested_type=chunk_type,
    )
