"""
Adaptive practice router — concept guidance and mastery assessment.
"""
import time

from fastapi import APIRouter

from app.lib.cache import cache_get, cache_set, guidance_cache_key
from app.lib.logger import get_logger
from app.config import settings
from app.schemas.adaptive import (
    ConceptGuidanceRequest, ConceptGuidanceResponse,
    ConceptAssessRequest,   ConceptAssessResponse,
)
from app.services import adaptive_service

log    = get_logger("adaptive_router")
router = APIRouter(prefix="/adaptive", tags=["Adaptive Practice"])


@router.post(
    "/concept-guidance",
    response_model=ConceptGuidanceResponse,
    summary="Generate personalised concept guidance",
    description=(
        "Returns a Gemini-powered (or mock) concept explanation tuned to the student's "
        "mastery level, dominant mistake type, and formula context."
    ),
)
async def concept_guidance_endpoint(req: ConceptGuidanceRequest) -> ConceptGuidanceResponse:
    # Bucket mastery to nearest 10 so similar students share cached explanations
    mastery_bucket = (req.mastery_score // 10) * 10
    key = guidance_cache_key(req.concept_name, mastery_bucket, req.mistake_type)

    cached = await cache_get(key)
    if cached:
        log.info("concept_guidance cache HIT", extra={
            "concept": req.concept_name, "mastery_bucket": mastery_bucket,
        })
        return ConceptGuidanceResponse(**cached)

    log.info("concept_guidance", extra={
        "concept":  req.concept_name,
        "mastery":  req.mastery_score,
        "mistake":  req.mistake_type or "none",
    })

    t0 = time.monotonic()
    result = adaptive_service.generate_concept_guidance(req)
    ms = round((time.monotonic() - t0) * 1000)
    response = ConceptGuidanceResponse(**result)

    log.info("concept_guidance OK", extra={
        "generated_by": result.get("generated_by"),
        "latency_ms":   ms,
    })

    if result.get("generated_by") != "mock":
        await cache_set(key, result, settings.cache_ttl_mentor)

    return response


@router.post(
    "/assess",
    response_model=ConceptAssessResponse,
    summary="Assess concept mastery from practice responses",
    description="Deterministic mastery estimate — no LLM used.",
)
async def assess_endpoint(req: ConceptAssessRequest) -> ConceptAssessResponse:
    log.info("assess", extra={"concept": req.concept_tag, "responses": len(req.responses)})
    result = adaptive_service.assess_concept_mastery(req)
    return ConceptAssessResponse(**result)
