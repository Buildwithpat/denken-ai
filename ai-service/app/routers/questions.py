"""Question intelligence endpoints — explanation generation and ChromaDB embedding."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.questions import (
    QuestionExplainRequest, QuestionExplainResponse,
    QuestionEmbedRequest, QuestionEmbedResponse,
)
from app.services.question_service import generate_explanation, embed_question, embed_questions_batch

router = APIRouter(prefix="/questions", tags=["Questions"])


@router.post(
    "/explain",
    response_model=QuestionExplainResponse,
    summary="Generate AI explanation for a question",
)
async def explain_question(req: QuestionExplainRequest) -> QuestionExplainResponse:
    try:
        return await generate_explanation(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/embed",
    response_model=QuestionEmbedResponse,
    summary="Embed a question into ChromaDB for RAG retrieval",
)
async def embed_one(req: QuestionEmbedRequest) -> QuestionEmbedResponse:
    try:
        return await embed_question(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/embed/batch",
    response_model=list[QuestionEmbedResponse],
    summary="Batch-embed questions into ChromaDB",
)
async def embed_batch(reqs: list[QuestionEmbedRequest]) -> list[QuestionEmbedResponse]:
    if len(reqs) > 200:
        raise HTTPException(status_code=400, detail="Batch size must be ≤ 200.")
    try:
        return await embed_questions_batch(reqs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
