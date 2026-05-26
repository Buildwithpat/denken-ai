"""Schemas for question explanation and embedding endpoints."""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class QuestionExplainRequest(BaseModel):
    stable_id:          str
    style:              str   # step-by-step | beginner | intermediate | advanced | mistake-aware | alternative
    question_text:      str
    options:            Optional[list[str]] = None
    correct_option:     Optional[str]       = None
    answer:             Optional[float]     = None
    type:               str                 # mcq | numerical
    subject:            str
    chapter:            str
    topic:              str
    concept_tags:       list[str]           = []
    formula_tags:       list[str]           = []
    bloom_level:        Optional[str]       = None
    learning_objective: Optional[str]       = None
    mistake_type:       Optional[str]       = None


class QuestionExplainResponse(BaseModel):
    explanation:        str
    step_by_step:       list[str]
    key_insight:        str
    common_mistakes:    list[str]
    hints_progressive:  list[str]
    alternative_method: Optional[str] = None
    formulas_used:      list[str]     = []


class QuestionEmbedRequest(BaseModel):
    stable_id:    str
    question_text: str
    subject:      str
    chapter:      str
    topic:        str
    concept_tags: list[str] = []
    formula_tags: list[str] = []
    bloom_level:  Optional[str] = None
    difficulty:   str           = "medium"
    type:         str           = "mcq"


class QuestionEmbedResponse(BaseModel):
    stable_id:  str
    embedded:   bool
    collection: str = "questions"
