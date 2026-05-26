from enum import Enum
from typing import Literal

from pydantic import BaseModel


class NoteDepth(str, Enum):
    short    = "short"
    medium   = "medium"
    detailed = "detailed"


class NoteMode(str, Enum):
    theory  = "theory"
    formula = "formula"
    both    = "both"


class NotesRequest(BaseModel):
    topic:   str
    subject: str
    exam:    str       = "JEE_MAIN"
    depth:   NoteDepth = NoteDepth.medium
    mode:    NoteMode  = NoteMode.both

    model_config = {"json_schema_extra": {
        "example": {
            "topic":   "Kinematics",
            "subject": "Physics",
            "exam":    "JEE_MAIN",
            "depth":   "medium",
            "mode":    "both",
        }
    }}


class NoteSection(BaseModel):
    heading: str
    content: str


class NotesResponse(BaseModel):
    topic:        str
    subject:      str
    depth:        str
    sections:     list[NoteSection]
    formulas:     list[str]
    key_points:   list[str]
    generated_by: Literal["mock", "gemini", "openrouter"] = "mock"
