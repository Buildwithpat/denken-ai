"""
AI Mentor router — personalized tutoring endpoints.

All endpoints accept a StudentContext payload assembled by the Express backend
(mastery scores, mistake patterns, roadmap phase, formula context). This keeps
MongoDB reads and analytics computation in Express while keeping LLM logic here.

Routes:
  POST /mentor/chat          — unified chat (intent auto-detected)
  POST /mentor/explain       — explain a chapter/concept
  POST /mentor/doubt         — solve a specific doubt
  POST /mentor/revise        — generate a personalised revision session
  POST /mentor/why-mistakes  — analyse persistent mistake patterns
  POST /mentor/study-plan    — generate today's personalised study plan
"""
import time

from fastapi import APIRouter

from app.lib.cache import cache_get, cache_set, mentor_cache_key
from app.lib.logger import get_logger
from app.config import settings
from app.schemas.mentor import (
    ChatRequest, ExplainRequest, DoubtRequest,
    ReviseRequest, WhyMistakesRequest, StudyPlanRequest,
    MentorResponse, StudyPlanResponse,
)
from app.services import mentor_service

log = get_logger("mentor_router")
router = APIRouter(prefix="/mentor", tags=["Mentor"])


@router.post(
    "/chat",
    response_model=MentorResponse,
    summary="Unified AI mentor chat (intent auto-detected)",
    description=(
        "Routes the student's message to the best handler based on intent detection. "
        "Intent is auto-detected from the message text but can be overridden via `intent` field. "
        "Combines RAG retrieval + student context + Gemini (when configured)."
    ),
)
async def chat_endpoint(req: ChatRequest) -> MentorResponse:
    user_id = req.student_context.user_id if req.student_context else "anon"

    # Cache check — skip caching for study-plan intent (always time-sensitive)
    intent = req.intent or mentor_service.detect_intent(req.message)
    should_cache = intent not in ("study-plan",)

    if should_cache:
        key = mentor_cache_key(user_id, req.message, req.intent, req.subject)
        cached = await cache_get(key)
        if cached:
            log.info("mentor/chat cache HIT", extra={"user_id": user_id, "intent": intent})
            return MentorResponse(**cached)

    log.info("mentor/chat", extra={
        "user_id":  user_id,
        "intent":   intent,
        "subject":  req.subject or "any",
        "topics":   len(req.student_context.mastery) if req.student_context else 0,
    })

    t0 = time.monotonic()
    result = mentor_service.chat(req)
    ms = round((time.monotonic() - t0) * 1000)

    log.info("mentor/chat OK", extra={
        "generated_by": result.generated_by,
        "latency_ms":   ms,
        "cached":       False,
    })

    if should_cache and result.generated_by != "mock":
        key = mentor_cache_key(user_id, req.message, req.intent, req.subject)
        await cache_set(key, result.model_dump(), settings.cache_ttl_mentor)

    return result


@router.post(
    "/explain",
    response_model=MentorResponse,
    summary="Explain a chapter/concept with personalization",
)
async def explain_endpoint(req: ExplainRequest) -> MentorResponse:
    user_id = req.student_context.user_id if req.student_context else "anon"
    t0 = time.monotonic()
    result = mentor_service.explain(req)
    log.info("mentor/explain OK", extra={"generated_by": result.generated_by, "ms": round((time.monotonic()-t0)*1000)})
    return result


@router.post(
    "/doubt",
    response_model=MentorResponse,
    summary="Solve a specific student doubt",
)
async def doubt_endpoint(req: DoubtRequest) -> MentorResponse:
    return mentor_service.solve_doubt(req)


@router.post(
    "/revise",
    response_model=MentorResponse,
    summary="Generate a personalised revision session",
)
async def revise_endpoint(req: ReviseRequest) -> MentorResponse:
    return mentor_service.revise(req)


@router.post(
    "/why-mistakes",
    response_model=MentorResponse,
    summary="Analyse persistent mistake patterns",
)
async def why_mistakes_endpoint(req: WhyMistakesRequest) -> MentorResponse:
    return mentor_service.why_mistakes(req)


@router.post(
    "/study-plan",
    response_model=StudyPlanResponse,
    summary="Generate today's personalised study plan",
)
async def study_plan_endpoint(req: StudyPlanRequest) -> StudyPlanResponse:
    return mentor_service.study_plan(req)
