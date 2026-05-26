"""Pydantic schemas for admin/debug endpoints."""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class CollectionStatsResponse(BaseModel):
    total_chunks: int
    collection:   str
    persist_dir:  str


# ---------------------------------------------------------------------------
# Chunk inspection
# ---------------------------------------------------------------------------

class ChunkRecord(BaseModel):
    id:       str
    content:  str
    metadata: dict[str, Any]


class ChunkListResponse(BaseModel):
    chunks: list[ChunkRecord]
    total:  int
    limit:  int
    offset: int


# ---------------------------------------------------------------------------
# Quality report
# ---------------------------------------------------------------------------

class QualityReportRequest(BaseModel):
    exam:    str
    subject: Optional[str] = None


class QualityReportResponse(BaseModel):
    exam:            str
    subject:         Optional[str] = None
    total_chunks:    int
    by_type:         dict[str, int]
    by_chapter:      dict[str, int]
    diagram_pct:     float
    formula_pct:     float
    theory_pct:      float
    has_examples:    bool
    warnings:        list[str]


# ---------------------------------------------------------------------------
# Search debug
# ---------------------------------------------------------------------------

class SearchDebugRequest(BaseModel):
    query:    str
    exam:     Optional[str] = None
    subject:  Optional[str] = None
    chapter:  Optional[str] = None
    top_k:    int           = Field(default=10, ge=1, le=50)


class SearchDebugResponse(BaseModel):
    query:   str
    results: list[dict[str, Any]]
    total:   int


# ---------------------------------------------------------------------------
# Delete chapter
# ---------------------------------------------------------------------------

class DeleteChapterRequest(BaseModel):
    exam:    str
    subject: str
    chapter: str


class DeleteChapterResponse(BaseModel):
    deleted: int
    exam:    str
    subject: str
    chapter: str


# ---------------------------------------------------------------------------
# Ingest content_maps
# ---------------------------------------------------------------------------

class BatchIngestRequest(BaseModel):
    content_maps:   list[dict[str, Any]]
    replace:        bool = False
    run_validation: bool = True
    stop_on_error:  bool = False


class ItemIngestResult(BaseModel):
    index:          int
    label:          str
    status:         str
    chunks_created: int = 0
    chunks_skipped: int = 0
    errors:         list[str] = Field(default_factory=list)


class BatchIngestResponse(BaseModel):
    total:          int
    succeeded:      int
    failed:         int
    chunks_created: int
    chunks_skipped: int
    item_results:   list[ItemIngestResult]


# ---------------------------------------------------------------------------
# Ingest raw text / formulas
# ---------------------------------------------------------------------------

class TextIngestRequest(BaseModel):
    text:    str
    exam:    str
    subject: str
    chapter: str
    unit:    Optional[str] = None
    topic:   Optional[str] = None
    source:  str           = "raw"
    replace: bool          = False


class FormulaSheetRequest(BaseModel):
    content: str
    exam:    str
    subject: str
    chapter: str
    source:  str  = "formula_sheet"
    replace: bool = False


class SimpleIngestResponse(BaseModel):
    chunks_created: int
    chunks_skipped: int
    errors:         list[str]
    source:         str


# ---------------------------------------------------------------------------
# PDF ingest
# ---------------------------------------------------------------------------

class PdfIngestResponse(BaseModel):
    maps_processed: int
    chunks_created: int
    chunks_skipped: int
    errors:         list[str]


# ---------------------------------------------------------------------------
# Eval
# ---------------------------------------------------------------------------

class EvalRequest(BaseModel):
    exam:  str
    cases: Optional[list[dict[str, Any]]] = None   # None = use defaults


class CaseResultItem(BaseModel):
    query: str
    hit:   bool
    rank:  int
    score: float


class EvalResponse(BaseModel):
    total:            int
    hits:             int
    hit_rate:         float
    mrr:              float
    precision_at_k:   float
    case_results:     list[CaseResultItem]


# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------

class ValidateRequest(BaseModel):
    content_maps: list[dict[str, Any]]


class ValidateResponse(BaseModel):
    valid:    int
    invalid:  int
    failures: dict[str, list[str]]


# ---------------------------------------------------------------------------
# Image ingest (admin)
# ---------------------------------------------------------------------------

class ImageIngestAdminResponse(BaseModel):
    chunks_created:   int
    chunks_skipped:   int
    errors:           list[str]
    filename:         str
    ocr_text_length:  int
    is_diagram_heavy: bool
