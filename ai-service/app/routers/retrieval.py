from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.rag import (
    IngestRequest, IngestResponse,
    RetrieveRequest, RetrieveResponse, RetrievedChunk,
    ImageIngestResponse,
    CollectionStatus,
)
from app.rag.pipeline  import ingest_content_map
from app.rag.retriever import retrieve
from app.rag.store     import collection_count
from app.config        import settings
from app.ingestion.formula_ingester import ingest_formula_batch

router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post(
    "/ingest",
    response_model=IngestResponse,
    summary="Ingest syllabus content into the vector store",
    description=(
        "Chunks the supplied topic texts using syllabus-aware hierarchical splitting, "
        "generates local embeddings, and upserts into ChromaDB. "
        "Set `replace=true` to re-ingest a chapter from scratch."
    ),
)
def ingest_endpoint(req: IngestRequest) -> IngestResponse:
    content_map = {
        "exam":    req.exam,
        "subject": req.subject,
        "unit":    req.unit,
        "chapter": req.chapter,
        "topics":  req.topics,
        "source":  req.source,
    }
    if req.content:
        content_map["content"] = req.content

    result = ingest_content_map(content_map, replace=req.replace)

    if result.errors and result.ingested == 0:
        raise HTTPException(status_code=422, detail=result.errors)

    return IngestResponse(
        ingested=result.ingested,
        skipped=result.skipped,
        collection=result.collection,
        errors=result.errors,
    )


@router.post(
    "/retrieve",
    response_model=RetrieveResponse,
    summary="Retrieve relevant chunks for a query",
    description=(
        "Embeds `query` locally, runs ANN search against ChromaDB, and returns "
        "the top_k most relevant chunks with metadata and cosine-similarity scores. "
        "Supports filtering by exam, subject, chapter, and chunk_type."
    ),
)
def retrieve_endpoint(req: RetrieveRequest) -> RetrieveResponse:
    results = retrieve(
        req.query,
        exam=req.exam,
        subject=req.subject,
        chapter=req.chapter,
        topic=req.topic,
        chunk_type=req.chunk_type,
        top_k=req.top_k,
        include_diagrams=req.include_diagrams,
    )
    return RetrieveResponse(
        query=req.query,
        total_found=len(results),
        collection_size=collection_count(),
        chunks=[RetrievedChunk(**r) for r in results],
    )


@router.get(
    "/status",
    response_model=CollectionStatus,
    summary="Vector store statistics",
)
def status_endpoint() -> CollectionStatus:
    from app.rag.embedder import embedding_dim
    return CollectionStatus(
        collection=settings.chroma_collection,
        persist_dir=settings.chroma_persist_dir,
        total_chunks=collection_count(),
        embedding_model=settings.embedding_model,
        embedding_dim=embedding_dim(),  # returns 0 when ST not installed
    )


@router.post(
    "/ingest/formulas",
    summary="Bulk-ingest formula dataset chapters for one subject",
    description=(
        "Accepts a list of formula chapter objects (from the Express formulaLoader) and "
        "ingests them into ChromaDB as formula/definition/theory chunks. "
        "Called once per subject from the Express admin endpoint to populate the vector store. "
        "Set `replace=true` to re-ingest a subject from scratch."
    ),
)
def ingest_formulas_endpoint(payload: dict) -> dict:
    chapters     = payload.get("chapters", [])
    subject_slug = payload.get("subject_slug", "")
    exam         = payload.get("exam", "JEE_MAIN")
    replace      = payload.get("replace", False)

    if not chapters:
        return {"error": "chapters array is required", "ingested": 0}
    if not subject_slug:
        return {"error": "subject_slug is required", "ingested": 0}

    return ingest_formula_batch(chapters, subject_slug, exam, replace)


@router.post(
    "/ingest/image",
    response_model=ImageIngestResponse,
    summary="Ingest a PNG/JPG/WEBP image into the vector store via OCR",
    description=(
        "Uploads an image, extracts text via OCR, cleans it, chunks it, embeds it, "
        "and stores into ChromaDB with the supplied educational metadata. "
        "Diagram-heavy images (very little text) are stored with a placeholder description. "
        "Set `is_question_screenshot=true` for PYQ or student question screenshots."
    ),
)
async def ingest_image_endpoint(
    file:                   UploadFile = File(..., description="Image file: PNG, JPG, or WEBP"),
    exam:                   str        = Form(...),
    subject:                str        = Form(...),
    chapter:                str        = Form(...),
    unit:                   Optional[str]  = Form(default=None),
    topic:                  Optional[str]  = Form(default=None),
    source:                 str            = Form(default="image"),
    replace:                bool           = Form(default=False),
    is_question_screenshot: bool           = Form(default=False),
) -> ImageIngestResponse:
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

    if result.errors and result.ingested == 0:
        raise HTTPException(status_code=422, detail=result.errors)

    return ImageIngestResponse(
        ingested=result.ingested,
        skipped=result.skipped,
        collection=result.collection,
        errors=result.errors,
        ocr_text_length=len(ocr_text),
        is_diagram_heavy=is_heavy,
    )


@router.post(
    "/retrieve/from-image",
    response_model=RetrieveResponse,
    summary="Retrieve relevant chunks using a question screenshot as the query",
    description=(
        "Extracts text from the uploaded image via OCR and uses it as the retrieval query. "
        "Useful for question-screenshot workflows where a student uploads a photo of a problem. "
        "Optional metadata filters (exam, subject, chapter) narrow the search scope."
    ),
)
async def retrieve_from_image_endpoint(
    file:             UploadFile     = File(..., description="Question screenshot: PNG, JPG, or WEBP"),
    exam:             Optional[str]  = Form(default=None),
    subject:          Optional[str]  = Form(default=None),
    chapter:          Optional[str]  = Form(default=None),
    chunk_type:       Optional[str]  = Form(default=None),
    top_k:            int            = Form(default=5, ge=1, le=20),
    include_diagrams: bool           = Form(default=True),
) -> RetrieveResponse:
    from app.ingestion.image_loader import extract_query_from_image, SUPPORTED_EXTENSIONS
    import pathlib

    ext = pathlib.Path(file.filename or "").suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(SUPPORTED_EXTENSIONS)}",
        )

    file_bytes = await file.read()
    try:
        query = extract_query_from_image(file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    results = retrieve(
        query,
        exam=exam, subject=subject, chapter=chapter,
        chunk_type=chunk_type, top_k=top_k,
        include_diagrams=include_diagrams,
    )
    return RetrieveResponse(
        query=query,
        total_found=len(results),
        collection_size=collection_count(),
        chunks=[RetrievedChunk(**r) for r in results],
    )
