"""Request / response schemas for the AI Mentor service."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ── Student context models (assembled by Express, sent per-request) ───────────

class StudentMastery(BaseModel):
    topic:             str
    subject:           str
    mastery_score:     int    # 0–100
    retention_score:   int    # 0–100
    forgetting_factor: float  = 0.0
    error_rate:        float  = 0.0
    days_since_seen:   int    = 0
    recent_wrong:      bool   = False


class StudentMistake(BaseModel):
    topic:                str
    subject:              str
    dominant_type:        str   # conceptual | formula | careless | time-pressure | weak-retention | guessing | repeated
    total_mistakes:       int
    consecutive_wrong:    int   = 0
    recent_mistakes:      int   = 0
    insight:              str   = ""
    linked_formula_slug:  Optional[str] = None
    linked_subject_slug:  Optional[str] = None


class StudentContext(BaseModel):
    user_id:            str
    exam:               str = "JEE_MAIN"
    phase:              str = "foundation-building"
    mastery:            list[StudentMastery] = []
    mistakes:           list[StudentMistake] = []
    priority_chapters:  list[str] = []
    today_focus:        str = ""
    days_to_exam:       Optional[int] = None
    syllabus_progress:  int = 0
    formula_context:    list[str] = []  # pre-fetched formula strings for the topic


# ── Mentor request schemas ────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    question:        str            = Field(min_length=3)
    chapter:         Optional[str]  = None
    subject:         Optional[str]  = None
    student_context: StudentContext
    depth:           str            = "adaptive"  # beginner | medium | advanced | adaptive

    model_config = {"json_schema_extra": {"example": {
        "question": "Explain Gauss's Law and when to use it vs Coulomb's Law",
        "chapter":  "Electrostatics",
        "subject":  "Physics",
        "depth":    "adaptive",
        "student_context": {"user_id": "abc123", "exam": "JEE_MAIN"},
    }}}


class DoubtRequest(BaseModel):
    doubt:           str            = Field(min_length=5)
    chapter:         Optional[str]  = None
    subject:         Optional[str]  = None
    student_context: StudentContext


class ReviseRequest(BaseModel):
    topics:           list[str]     = []  # empty → AI picks from weak areas
    subject:          Optional[str] = None
    student_context:  StudentContext
    session_minutes:  int           = 45


class WhyMistakesRequest(BaseModel):
    topic:           Optional[str] = None   # None → analyse all patterns
    student_context: StudentContext


class StudyPlanRequest(BaseModel):
    student_context:  StudentContext
    available_hours:  float = 2.0


class ChatRequest(BaseModel):
    message:         str            = Field(min_length=2)
    chapter:         Optional[str]  = None
    subject:         Optional[str]  = None
    student_context: StudentContext
    intent:          Optional[str]  = None  # auto-detected if None: explain | doubt | revise | why-mistakes | study-plan | search

    model_config = {"json_schema_extra": {"example": {
        "message": "Why do I keep making mistakes in Optics?",
        "student_context": {"user_id": "abc123", "exam": "JEE_MAIN"},
    }}}


# ── Mentor response schemas ───────────────────────────────────────────────────

class MentorResponse(BaseModel):
    answer:          str            # main markdown response
    key_points:      list[str]      = []
    related_topics:  list[str]      = []
    formula_refs:    list[str]      = []  # formula snippet strings
    suggestions:     list[str]      = []  # follow-up action links/texts
    generated_by:    str            = "mock"
    rag_chunks_used: int            = 0
    intent_detected: str            = "explain"


class StudyPlanResponse(BaseModel):
    plan:              str       # markdown
    tasks:             list[dict] = []  # [{title, subject, chapter, duration_min, type, href}]
    generated_by:      str       = "mock"
    estimated_minutes: int       = 120
