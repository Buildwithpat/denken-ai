from typing import Literal

from pydantic import BaseModel, Field


class SubjectPerf(BaseModel):
    subject:  str
    accuracy: float = Field(ge=0, le=100)
    trend:    float = 0.0  # accuracy delta vs previous period (percentage points)


class WeakTopicPerf(BaseModel):
    topic:       str
    subject:     str
    accuracy:    float = Field(ge=0, le=100)
    wrong_count: int   = 0


class QuestionTypePerf(BaseModel):
    type:     str    # "mcq" | "numerical"
    accuracy: float = Field(ge=0, le=100)


class PerformanceRequest(BaseModel):
    exam:           str
    subjects:       list[SubjectPerf]
    weak_topics:    list[WeakTopicPerf]
    question_types: list[QuestionTypePerf] = []
    avg_accuracy:   float = Field(ge=0, le=100)
    tests_taken:    int   = 0

    model_config = {"json_schema_extra": {
        "example": {
            "exam":         "JEE_MAIN",
            "subjects":     [{"subject": "Physics", "accuracy": 72, "trend": 5}],
            "weak_topics":  [{"topic": "Electrostatics", "subject": "Physics", "accuracy": 38, "wrong_count": 6}],
            "question_types": [{"type": "mcq", "accuracy": 70}, {"type": "numerical", "accuracy": 48}],
            "avg_accuracy": 65,
            "tests_taken":  8,
        }
    }}


class RecommendationItem(BaseModel):
    title:     str
    body:      str
    sentiment: Literal["success", "warning", "danger"]
    priority:  int = Field(default=1, ge=1, description="1 = highest priority")


class PerformanceResponse(BaseModel):
    summary:         str
    strengths:       list[str]
    weaknesses:      list[str]
    recommendations: list[RecommendationItem]
    study_focus:     str
    generated_by:    Literal["mock", "gemini", "openrouter"] = "mock"
