"""
Retrieval Debugger and AI Observability endpoints.

All routes are prefixed /debug and require the X-Internal-Key header
(see app.deps.internal_auth.require_internal_key) — they expose pipeline
internals and must never be reachable without it.

Endpoints
---------
POST /debug/retrieve-inspect   — full RAG pipeline run with latency breakdown + prompt preview
POST /debug/ocr-inspect        — upload an image and inspect OCR output (raw vs cleaned)
GET  /debug/pipeline-health    — system health + collection stats + embedding smoke test
POST /debug/similarity         — compute cosine similarity between a query and reference texts
"""
from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import settings
from app.deps.internal_auth import require_internal_key
from app.rag.context_builder import (
    _THEORY_TYPES, _FORMULA_TYPES, _EXAMPLE_TYPES, _DIAGRAM_TYPES,
    build_context, format_for_prompt,
)
from app.rag.embedder import embed_query
from app.rag.retriever import retrieve
from app.rag.store import collection_count, _get_collection
from app.schemas.debug import (
    ChunkDebugInfo,
    ContextGroupDebug,
    LatencyBreakdown,
    OcrInspectResponse,
    PipelineHealthResponse,
    RetrieveInspectRequest,
    RetrieveInspectResponse,
    SimilarityItem,
    SimilarityRequest,
    SimilarityResponse,
    SmokeTestResult,
)

router = APIRouter(prefix="/debug", tags=["Debug / Observability"], dependencies=[Depends(require_internal_key)])

_ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def _classify_bucket(chunk_type: str) -> str:
    if chunk_type in _THEORY_TYPES:   return "theory"
    if chunk_type in _FORMULA_TYPES:  return "formula"
    if chunk_type in _EXAMPLE_TYPES:  return "example"
    if chunk_type in _DIAGRAM_TYPES:  return "diagram"
    return "unclassified"


# ---------------------------------------------------------------------------
# POST /debug/retrieve-inspect
# ---------------------------------------------------------------------------

@router.post("/retrieve-inspect", response_model=RetrieveInspectResponse)
def retrieve_inspect(req: RetrieveInspectRequest):
    """
    Run the full RAG retrieval pipeline and return per-step latency,
    ranked chunk details, context grouping, and the formatted prompt block.
    """
    warnings: list[str] = []

    if len(req.query.strip()) < 5:
        raise HTTPException(status_code=422, detail="Query too short (min 5 chars).")

    coll_size = collection_count()
    if coll_size == 0:
        warnings.append("Collection is empty — no chunks have been ingested yet.")

    # ── Step 1: embed ─────────────────────────────────────────────────────────
    t0 = time.perf_counter()
    qvec = embed_query(req.query)
    embed_ms = (time.perf_counter() - t0) * 1000

    # ── Step 2: retrieve ──────────────────────────────────────────────────────
    t1 = time.perf_counter()
    chunks_raw = retrieve(
        req.query,
        exam=req.exam,
        subject=req.subject,
        chapter=req.chapter,
        top_k=req.top_k,
        include_diagrams=req.include_diagrams,
    )
    query_ms = (time.perf_counter() - t1) * 1000

    # ── Step 3: context builder ───────────────────────────────────────────────
    t2 = time.perf_counter()
    ctx = build_context(
        req.query,
        exam=req.exam,
        subject=req.subject,
        chapter=req.chapter,
        top_k=req.top_k,
    )
    prompt_text = format_for_prompt(ctx)
    build_ms = (time.perf_counter() - t2) * 1000

    total_ms = embed_ms + query_ms + build_ms

    # ── Fetch chunk IDs directly from ChromaDB (ids not returned by retrieve()) ─
    chunk_ids: list[str] = []
    if coll_size > 0:
        from app.rag.store import _get_collection
        col = _get_collection()
        raw_result = col.query(
            query_embeddings=[qvec],
            n_results=min(req.top_k, max(coll_size, 1)),
            include=["ids"],
        )
        chunk_ids = raw_result.get("ids", [[]])[0]

    # ── Build debug chunk list ────────────────────────────────────────────────
    debug_chunks: list[ChunkDebugInfo] = []
    for i, (c, cid) in enumerate(
        zip(chunks_raw, chunk_ids if chunk_ids else [""] * len(chunks_raw))
    ):
        bucket = _classify_bucket(c.get("chunk_type", "theory"))
        debug_chunks.append(ChunkDebugInfo(
            rank=i + 1,
            chunk_id=cid,
            content=c["content"],
            score=c["score"],
            raw_semantic_score=c.get("raw_semantic_score", c["score"]),
            chunk_type=c.get("chunk_type", "theory"),
            exam=c.get("exam", ""),
            subject=c.get("subject", ""),
            chapter=c.get("chapter", ""),
            topic=c.get("topic"),
            unit=c.get("unit"),
            source=c.get("source", ""),
            difficulty=c.get("difficulty"),
            has_diagram=c.get("has_diagram", False),
            diagram_type=c.get("diagram_type"),
            diagram_description=c.get("diagram_description"),
            keywords=c.get("keywords", []),
            context_bucket=bucket,
        ))

    # ── Context groups ────────────────────────────────────────────────────────
    bucket_map: dict[str, list[str]] = {
        "theory": ctx.theory,
        "formula": ctx.formulas,
        "example": ctx.examples,
        "diagram": ctx.diagram_refs,
    }
    context_groups = [
        ContextGroupDebug(bucket=b, count=len(items), items=items)
        for b, items in bucket_map.items()
    ]

    # ── Warnings ──────────────────────────────────────────────────────────────
    if not chunks_raw:
        warnings.append("No chunks returned — try broadening the query or removing filters.")
    if chunks_raw and chunks_raw[0]["score"] < 0.25:
        warnings.append(
            f"Low top-score ({chunks_raw[0]['score']:.3f}) — content may not be well-ingested for this query."
        )
    if ctx.is_empty and chunks_raw:
        warnings.append("Context builder returned empty despite retrieval hits — check chunk_type values.")

    return RetrieveInspectResponse(
        query=req.query,
        total_found=len(debug_chunks),
        collection_size=coll_size,
        latency=LatencyBreakdown(
            embed_ms=round(embed_ms, 2),
            query_ms=round(query_ms, 2),
            build_ms=round(build_ms, 2),
            total_ms=round(total_ms, 2),
        ),
        chunks=debug_chunks,
        context_groups=context_groups,
        prompt_preview=prompt_text or "(empty — no context built)",
        warnings=warnings,
        rerank_applied=True,
    )


# ---------------------------------------------------------------------------
# POST /debug/ocr-inspect
# ---------------------------------------------------------------------------

@router.post("/ocr-inspect", response_model=OcrInspectResponse)
async def ocr_inspect(
    file: UploadFile = File(...),
):
    """
    Upload an image and receive raw OCR text, cleaned text, and diagnostics.
    No chunks are stored — purely inspection.
    """
    from pathlib import Path

    ext = Path(file.filename or "").suffix.lower()
    if ext not in _ALLOWED_IMAGE_EXTS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image format '{ext}'. Accepted: {sorted(_ALLOWED_IMAGE_EXTS)}",
        )

    file_bytes = await file.read()

    # Detect which OCR engine is available
    engine = "none"
    try:
        import easyocr  # noqa: F401
        engine = "easyocr"
    except ImportError:
        try:
            import pytesseract  # noqa: F401
            engine = "pytesseract"
        except ImportError:
            pass

    from app.ingestion.image_loader import extract_text_from_image, clean_ocr_text, image_is_diagram_heavy

    errors: list[str] = []
    t0 = time.perf_counter()

    raw_text = ""
    try:
        raw_text = extract_text_from_image(file_bytes)
    except Exception as exc:
        errors.append(f"OCR extraction error: {exc}")

    ocr_ms = (time.perf_counter() - t0) * 1000
    cleaned = clean_ocr_text(raw_text)
    word_count = len(cleaned.split()) if cleaned else 0
    is_diagram_heavy = image_is_diagram_heavy(cleaned)

    return OcrInspectResponse(
        filename=file.filename or "unknown",
        ocr_engine=engine,
        raw_text=raw_text,
        cleaned_text=cleaned,
        word_count=word_count,
        is_diagram_heavy=is_diagram_heavy,
        ocr_ms=round(ocr_ms, 2),
        errors=errors,
    )


# ---------------------------------------------------------------------------
# GET /debug/pipeline-health
# ---------------------------------------------------------------------------

@router.get("/pipeline-health", response_model=PipelineHealthResponse)
def pipeline_health():
    """
    Full health check: collection stats, embedding probe, retrieval smoke test.
    """
    warnings: list[str] = []
    smoke_tests: list[SmokeTestResult] = []

    # ── Embedding probe ───────────────────────────────────────────────────────
    t0 = time.perf_counter()
    try:
        vec = embed_query("health check probe")
        embed_ms = (time.perf_counter() - t0) * 1000
        dim = len(vec)
        smoke_tests.append(SmokeTestResult(
            name="embedding",
            ok=True,
            latency_ms=round(embed_ms, 2),
            detail=f"dim={dim}",
        ))
    except Exception as exc:
        embed_ms = (time.perf_counter() - t0) * 1000
        dim = 0
        smoke_tests.append(SmokeTestResult(
            name="embedding",
            ok=False,
            latency_ms=round(embed_ms, 2),
            detail=str(exc),
        ))
        warnings.append("Embedding model failed to load.")

    # ── Collection stats ──────────────────────────────────────────────────────
    t1 = time.perf_counter()
    try:
        total = collection_count()
        coll_ms = (time.perf_counter() - t1) * 1000
        smoke_tests.append(SmokeTestResult(
            name="chromadb",
            ok=True,
            latency_ms=round(coll_ms, 2),
            detail=f"{total} chunks in '{settings.chroma_collection}'",
        ))
    except Exception as exc:
        total = 0
        coll_ms = (time.perf_counter() - t1) * 1000
        smoke_tests.append(SmokeTestResult(
            name="chromadb",
            ok=False,
            latency_ms=round(coll_ms, 2),
            detail=str(exc),
        ))
        warnings.append("ChromaDB connection failed.")

    # ── Retrieval smoke test (only if collection has data) ────────────────────
    if total > 0:
        t2 = time.perf_counter()
        try:
            hits = retrieve("force equals mass times acceleration", top_k=1)
            ret_ms = (time.perf_counter() - t2) * 1000
            top_score = hits[0]["score"] if hits else 0.0
            smoke_tests.append(SmokeTestResult(
                name="retrieval",
                ok=bool(hits),
                latency_ms=round(ret_ms, 2),
                detail=f"top_score={top_score:.3f}" if hits else "no results",
            ))
        except Exception as exc:
            ret_ms = (time.perf_counter() - t2) * 1000
            smoke_tests.append(SmokeTestResult(
                name="retrieval",
                ok=False,
                latency_ms=round(ret_ms, 2),
                detail=str(exc),
            ))
    else:
        warnings.append("Collection is empty — retrieval smoke test skipped.")

    all_ok = all(s.ok for s in smoke_tests)
    status = "ok" if all_ok else ("degraded" if any(s.ok for s in smoke_tests) else "down")

    return PipelineHealthResponse(
        status=status,
        collection=settings.chroma_collection,
        total_chunks=total,
        embedding_dim=dim,
        ai_provider=settings.ai_provider,
        smoke_tests=smoke_tests,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# POST /debug/similarity
# ---------------------------------------------------------------------------

@router.post("/similarity", response_model=SimilarityResponse)
def similarity_heatmap(req: SimilarityRequest):
    """
    Embed the query and each reference text, then return cosine similarity scores.
    Useful for understanding why a chunk does or doesn't rank for a given query.
    """
    if not req.references:
        raise HTTPException(status_code=422, detail="references list must not be empty.")
    if len(req.references) > 20:
        raise HTTPException(status_code=422, detail="Max 20 reference texts per request.")

    import numpy as np

    t0 = time.perf_counter()
    qvec = embed_query(req.query)
    ref_vecs = [embed_query(r) for r in req.references]
    embed_ms = (time.perf_counter() - t0) * 1000

    q = np.array(qvec, dtype=float)
    q /= np.linalg.norm(q) + 1e-10

    scored: list[tuple[float, int, str]] = []
    for i, (rv, ref_text) in enumerate(zip(ref_vecs, req.references)):
        r = np.array(rv, dtype=float)
        r /= np.linalg.norm(r) + 1e-10
        score = float(np.dot(q, r))
        scored.append((score, i, ref_text))

    scored.sort(key=lambda x: -x[0])

    results = [
        SimilarityItem(text=text, score=round(score, 4), rank=rank + 1)
        for rank, (score, _, text) in enumerate(scored)
    ]

    return SimilarityResponse(
        query=req.query,
        results=results,
        embed_ms=round(embed_ms, 2),
    )
