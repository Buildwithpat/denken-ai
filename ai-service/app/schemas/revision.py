from typing import Literal

from pydantic import BaseModel, Field


class RevisionTopic(BaseModel):
    topic:    str
    subject:  str
    accuracy: float = Field(ge=0, le=100, description="Percent correct out of attempted")


class RevisionRequest(BaseModel):
    topics:         list[RevisionTopic]
    exam:           str                                  = "JEE_MAIN"
    mode:           Literal["drill", "concept", "practice"] = "drill"
    question_count: int = Field(default=10, ge=5, le=30)

    model_config = {"json_schema_extra": {
        "example": {
            "topics": [
                {"topic": "Kinematics", "subject": "Physics", "accuracy": 38},
                {"topic": "Electrochemistry", "subject": "Chemistry", "accuracy": 45},
            ],
            "exam":           "JEE_MAIN",
            "mode":           "drill",
            "question_count": 10,
        }
    }}


class RevisionPlanItem(BaseModel):
    day:          str
    topic:        str
    subject:      str
    duration:     str
    mode:         str
    focus_points: list[str]


class RevisionResponse(BaseModel):
    plan:         list[RevisionPlanItem]
    summary:      str
    generated_by: Literal["mock", "gemini", "openrouter"] = "mock"
