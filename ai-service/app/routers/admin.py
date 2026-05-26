"""
Admin / debug endpoints.

All routes are prefixed /admin.  They are NOT protected by auth in this
phase — add an API-key dependency before exposing to production.

Routes
------
GET  /admin/stats                  — collection counts + config
GET  /admin/chunks                 — paginated chunk listing with optional filter
GET  /admin/chunks/{chunk_id}      — single chunk by UUID
GET  /admin/quality                — chunk quality report (exam + optional subject)
POST /admin/search-debug           — raw retrieval debug (query, filters, top_k)
DELETE /admin/chapters             — delete all chunks for a chapter
POST /admin/ingest/maps            — batch ingest list[content_map]
POST /admin/ingest/text            — ingest raw text block
POST /admin/ingest/formulas        — ingest formula sheet
POST /admin/ingest/pdf             — ingest PDF by file path (server-side path)
POST /admin/ingest/image           — ingest PNG/JPG/WEBP image via OCR
POST /admin/eval                   — run retrieval eval test suite
POST /admin/validate               — validate content_maps without ingesting
"""
from __future__ import annotations
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from app.config import settings
from app.rag.store import (
    collection_count, delete_by_chapter,
    get_chunk_by_id, get_chunks, get_all_metadata,
)
from app.schemas.admin import (
    BatchIngestRequest, BatchIngestResponse,
    ChunkListResponse, ChunkRecord,
    CollectionStatsResponse,
    DeleteChapterRequest, DeleteChapterResponse,
    EvalRequest, EvalResponse, CaseResultItem,
    FormulaSheetRequest,
    ImageIngestAdminResponse,
    ItemIngestResult,
    PdfIngestResponse,
    QualityReportRequest, QualityReportResponse,
    SearchDebugRequest, SearchDebugResponse,
    SimpleIngestResponse,
    TextIngestRequest,
    ValidateRequest, ValidateResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=CollectionStatsResponse)
def get_stats():
    return CollectionStatsResponse(
        total_chunks=collection_count(),
        collection=settings.chroma_collection,
        persist_dir=settings.chroma_persist_dir,
    )


# ---------------------------------------------------------------------------
# Chunk inspection
# ---------------------------------------------------------------------------

@router.get("/chunks", response_model=ChunkListResponse)
def list_chunks(
    exam:    str | None = Query(default=None),
    subject: str | None = Query(default=None),
    chapter: str | None = Query(default=None),
    limit:   int        = Query(default=50,  ge=1, le=500),
    offset:  int        = Query(default=0,   ge=0),
):
    where = _build_filter(exam, subject, chapter)
    records = get_chunks(where=where, limit=limit, offset=offset)
    # total without pagination — use metadata-only query for efficiency
    total = len(get_all_metadata(where=where))
    return ChunkListResponse(
        chunks=[ChunkRecord(**r) for r in records],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/chunks/{chunk_id}", response_model=ChunkRecord)
def get_chunk(chunk_id: str):
    record = get_chunk_by_id(chunk_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Chunk '{chunk_id}' not found.")
    return ChunkRecord(**record)


# ---------------------------------------------------------------------------
# Quality report
# ---------------------------------------------------------------------------

@router.post("/quality", response_model=QualityReportResponse)
def quality_report(req: QualityReportRequest):
    from app.evaluation.metrics import compute_quality_report
    r = compute_quality_report(exam=req.exam, subject=req.subject)
    return QualityReportResponse(
        exam=r.exam, subject=r.subject,
        total_chunks=r.total_chunks,
        by_type=r.by_type, by_chapter=r.by_chapter,
        diagram_pct=r.diagram_pct, formula_pct=r.formula_pct,
        theory_pct=r.theory_pct, has_examples=r.has_examples,
        warnings=r.warnings,
    )


# ---------------------------------------------------------------------------
# Search debug
# ---------------------------------------------------------------------------

@router.post("/search-debug", response_model=SearchDebugResponse)
def search_debug(req: SearchDebugRequest):
    from app.rag.retriever import retrieve
    results = retrieve(
        req.query,
        exam=req.exam, subject=req.subject, chapter=req.chapter,
        top_k=req.top_k, include_diagrams=True,
    )
    return SearchDebugResponse(
        query=req.query,
        results=results,
        total=len(results),
    )


# ---------------------------------------------------------------------------
# Delete chapter
# ---------------------------------------------------------------------------

@router.delete("/chapters", response_model=DeleteChapterResponse)
def delete_chapter(req: DeleteChapterRequest):
    deleted = delete_by_chapter(exam=req.exam, subject=req.subject, chapter=req.chapter)
    return DeleteChapterResponse(
        deleted=deleted,
        exam=req.exam, subject=req.subject, chapter=req.chapter,
    )


# ---------------------------------------------------------------------------
# Batch ingest content_maps
# ---------------------------------------------------------------------------

@router.post("/ingest/maps", response_model=BatchIngestResponse)
def ingest_maps(req: BatchIngestRequest):
    from app.ingestion.batch import batch_ingest
    result = batch_ingest(
        req.content_maps,
        replace=req.replace,
        validate=req.run_validation,
        stop_on_error=req.stop_on_error,
    )
    return BatchIngestResponse(
        total=result.total,
        succeeded=result.succeeded,
        failed=result.failed,
        chunks_created=result.chunks_created,
        chunks_skipped=result.chunks_skipped,
        item_results=[ItemIngestResult(**item) for item in result.item_results],
    )


# ---------------------------------------------------------------------------
# Raw text ingest
# ---------------------------------------------------------------------------

@router.post("/ingest/text", response_model=SimpleIngestResponse)
def ingest_text(req: TextIngestRequest):
    from app.ingestion.sources import ingest_raw_text
    result = ingest_raw_text(
        text=req.text, exam=req.exam, subject=req.subject,
        chapter=req.chapter, unit=req.unit, topic=req.topic,
        source=req.source, replace=req.replace,
    )
    return SimpleIngestResponse(
        chunks_created=result.ingested,
        chunks_skipped=result.skipped,
        errors=result.errors,
        source=req.chapter,
    )


# ---------------------------------------------------------------------------
# Formula sheet ingest
# ---------------------------------------------------------------------------

@router.post("/ingest/formulas", response_model=SimpleIngestResponse)
def ingest_formulas(req: FormulaSheetRequest):
    from app.ingestion.sources import ingest_formula_sheet
    result = ingest_formula_sheet(
        content=req.content, exam=req.exam, subject=req.subject,
        chapter=req.chapter, source=req.source, replace=req.replace,
    )
    return SimpleIngestResponse(
        chunks_created=result.ingested,
        chunks_skipped=result.skipped,
        errors=result.errors,
        source=req.chapter,
    )


# ---------------------------------------------------------------------------
# PDF ingest (server-side path)
# ---------------------------------------------------------------------------

@router.post("/ingest/pdf", response_model=PdfIngestResponse)
def ingest_pdf(
    pdf_path: str = Query(..., description="Absolute server-side path to the PDF file"),
    exam:     str = Query(...),
    subject:  str = Query(...),
    chapter:  str | None = Query(default=None, description="Override chapter name"),
    source:   str = Query(default="pdf"),
    replace:  bool = Query(default=False),
    validate: bool = Query(default=True),
):
    from app.ingestion.sources import ingest_from_pdf
    results = ingest_from_pdf(
        pdf_path=pdf_path, exam=exam, subject=subject,
        source=source, chapter=chapter,
        replace=replace, validate=validate,
    )
    total_created = sum(r.ingested for r in results)
    total_skipped = sum(r.skipped for r in results)
    all_errors    = [e for r in results for e in r.errors]
    return PdfIngestResponse(
        maps_processed=len(results),
        chunks_created=total_created,
        chunks_skipped=total_skipped,
        errors=all_errors,
    )


# ---------------------------------------------------------------------------
# Eval
# ---------------------------------------------------------------------------

@router.post("/eval", response_model=EvalResponse)
def run_eval(req: EvalRequest):
    from app.evaluation.evaluator import EvalReport, TestCase, default_test_cases, run_eval as _run

    if req.cases:
        test_cases = [TestCase(**c) for c in req.cases]
    else:
        test_cases = default_test_cases(req.exam)

    report: EvalReport = _run(test_cases)
    return EvalResponse(
        total=report.total,
        hits=report.hits,
        hit_rate=report.hit_rate,
        mrr=report.mrr,
        precision_at_k=report.precision_at_k,
        case_results=[
            CaseResultItem(query=c.query, hit=c.hit, rank=c.rank, score=c.score)
            for c in report.case_results
        ],
    )


# ---------------------------------------------------------------------------
# Validate (dry-run)
# ---------------------------------------------------------------------------

@router.post("/validate", response_model=ValidateResponse)
def validate_maps(req: ValidateRequest):
    from app.ingestion.validators import validate_batch
    failures = validate_batch(req.content_maps)
    total   = len(req.content_maps)
    invalid = len(failures)
    return ValidateResponse(
        valid=total - invalid,
        invalid=invalid,
        failures=failures,
    )


# ---------------------------------------------------------------------------
# Image ingest (multipart upload)
# ---------------------------------------------------------------------------

@router.post(
    "/ingest/image",
    response_model=ImageIngestAdminResponse,
    summary="Ingest a PNG/JPG/WEBP image via OCR (admin upload)",
)
async def admin_ingest_image(
    file:                   UploadFile     = File(...),
    exam:                   str            = Form(...),
    subject:                str            = Form(...),
    chapter:                str            = Form(...),
    unit:                   Optional[str]  = Form(default=None),
    topic:                  Optional[str]  = Form(default=None),
    source:                 str            = Form(default="image"),
    replace:                bool           = Form(default=False),
    is_question_screenshot: bool           = Form(default=False),
) -> ImageIngestAdminResponse:
    from app.ingestion.image_loader import ingest_image, SUPPORTED_EXTENSIONS
    import pathlib

    ext = pathlib.Path(file.filename or "").suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(SUPPORTED_EXTENSIONS)}",
        )

    file_bytes = await file.read()
    try:
        result, ocr_text, is_heavy = ingest_image(
            file_bytes=file_bytes,
            filename=file.filename or "upload",
            exam=exam, subject=subject, chapter=chapter,
            unit=unit, topic=topic, source=source,
            replace=replace, is_question_screenshot=is_question_screenshot,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return ImageIngestAdminResponse(
        chunks_created=result.ingested,
        chunks_skipped=result.skipped,
        errors=result.errors,
        filename=file.filename or "upload",
        ocr_text_length=len(ocr_text),
        is_diagram_heavy=is_heavy,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_filter(
    exam:    str | None,
    subject: str | None,
    chapter: str | None,
) -> dict | None:
    clauses = []
    if exam:
        clauses.append({"exam": {"$eq": exam}})
    if subject:
        clauses.append({"subject": {"$eq": subject}})
    if chapter:
        clauses.append({"chapter": {"$eq": chapter}})
    if not clauses:
        return None
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}
