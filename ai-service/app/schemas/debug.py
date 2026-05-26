"""
Pydantic schemas for the /debug observability endpoints.
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Shared sub-models
# ---------------------------------------------------------------------------

class LatencyBreakdown(BaseModel):
    embed_ms:    float
    query_ms:    float
    build_ms:    float
    total_ms:    float


class ChunkDebugInfo(BaseModel):
    rank:                int
    chunk_id:            str
    content:             str
    score:               float
    raw_semantic_score:  float
    chunk_type:          str
    exam:               str
    subject:            str
    chapter:            str
    topic:              Optional[str]
    unit:               Optional[str]
    source:             str
    difficulty:         Optional[str]
    has_diagram:        bool
    diagram_type:       Optional[str]
    diagram_description: Optional[str]
    keywords:           list[str]
    context_bucket:     str   # "theory" | "formula" | "example" | "diagram" | "unclassified"


class ContextGroupDebug(BaseModel):
    bucket:     str
    count:      int
    items:      list[str]


# ---------------------------------------------------------------------------
# POST /debug/retrieve-inspect
# ---------------------------------------------------------------------------

class RetrieveInspectRequest(BaseModel):
    query:            str
    exam:             Optional[str] = None
    subject:          Optional[str] = None
    chapter:          Optional[str] = None
    top_k:            int  = 8
    include_diagrams: bool = True


class RetrieveInspectResponse(BaseModel):
    query:           str
    total_found:     int
    collection_size: int
    latency:         LatencyBreakdown
    chunks:          list[ChunkDebugInfo]
    context_groups:  list[ContextGroupDebug]
    prompt_preview:  str
    warnings:        list[str]
    rerank_applied:  bool = True


# ---------------------------------------------------------------------------
# POST /debug/ocr-inspect
# ---------------------------------------------------------------------------

class OcrInspectResponse(BaseModel):
    filename:        str
    ocr_engine:      str          # "easyocr" | "pytesseract" | "none"
    raw_text:        str
    cleaned_text:    str
    word_count:      int
    is_diagram_heavy: bool
    ocr_ms:          float
    errors:          list[str]


# ---------------------------------------------------------------------------
# GET /debug/pipeline-health
# ---------------------------------------------------------------------------

class SmokeTestResult(BaseModel):
    name:       str
    ok:         bool
    latency_ms: float
    detail:     str


class PipelineHealthResponse(BaseModel):
    status:          str   # "ok" | "degraded" | "down"
    collection:      str
    total_chunks:    int
    embedding_dim:   int
    ai_provider:     str
    smoke_tests:     list[SmokeTestResult]
    warnings:        list[str]


# ---------------------------------------------------------------------------
# POST /debug/similarity
# ---------------------------------------------------------------------------

class SimilarityRequest(BaseModel):
    query:      str
    references: list[str]


class SimilarityItem(BaseModel):
    text:       str
    score:      float
    rank:       int


class SimilarityResponse(BaseModel):
    query:    str
    results:  list[SimilarityItem]
    embed_ms: float
