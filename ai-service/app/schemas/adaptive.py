"""
Schemas for the adaptive practice and concept guidance endpoints.
"""
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.mentor import StudentContext


# ── Concept Guidance ──────────────────────────────────────────────────────────

class ConceptGuidanceRequest(BaseModel):
    concept_name:     str
    subject:          str
    chapter:          str
    mastery_score:    int = Field(default=0, ge=0, le=100)
    mistake_type:     Optional[str]  = None   # conceptual|formula|careless|...
    formula_context:  list[str]      = []
    student_context:  StudentContext


class ConceptGuidanceResponse(BaseModel):
    guidance:      str
    key_formulas:  list[str] = []
    common_errors: list[str] = []
    next_steps:    list[str] = []
    generated_by:  str = "mock"


# ── Concept Assessment ────────────────────────────────────────────────────────

class PracticeResponse(BaseModel):
    question:       str
    is_correct:     bool
    solving_time_sec: float = 60.0


class ConceptAssessRequest(BaseModel):
    concept_tag: str
    responses:   list[PracticeResponse]
    exam:        str = "JEE_MAIN"


class ConceptAssessResponse(BaseModel):
    mastery_estimate: int    = Field(ge=0, le=100)
    confidence:       str    = "low"   # low|medium|high
    weak_areas:       list[str] = []
    recommendation:   str    = ""


# ── Next Concept Recommendation ───────────────────────────────────────────────

class ConceptRecommendRequest(BaseModel):
    mastered_concepts: list[str]  = []
    weak_concepts:     list[str]  = []
    roadmap_phase:     str        = "foundation-building"
    subject:           Optional[str] = None
    exam:              str        = "JEE_MAIN"


class ConceptRecommendResponse(BaseModel):
    next_concept:  str
    reason:        str
    urgency:       str = "medium"   # critical|high|medium|low
    estimated_min: int = 30
