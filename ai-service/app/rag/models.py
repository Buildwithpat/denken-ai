"""
Core data models for the RAG pipeline.

Hierarchy represented in metadata:
  exam → subject → unit → chapter → topic → chunk
"""
from __future__ import annotations

import uuid
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ChunkType(str, Enum):
    theory         = "theory"
    formula        = "formula"
    definition     = "definition"
    example        = "example"
    solved_example = "solved_example"
    diagram        = "diagram"
    summary        = "summary"
    previous_year  = "previous_year"


class DiagramInfo(BaseModel):
    has_diagram:  bool            = False
    diagram_type: Optional[str]   = None   # "circuit"|"graph"|"geometric"|"chemical"|"figure"
    description:  Optional[str]   = None   # sentence excerpt mentioning the diagram


class ChunkMetadata(BaseModel):
    exam:       str                        # "JEE_MAIN" | "NEET" | "CBSE"
    subject:    str                        # "Physics" | "Chemistry" | "Mathematics" | "Biology"
    unit:       Optional[str]  = None      # "Mechanics" | "Organic Chemistry"
    chapter:    str                        # "Laws of Motion"
    topic:      Optional[str]  = None      # "Newton's Third Law"  (sub-chapter level)
    chunk_type: ChunkType      = ChunkType.theory
    source:     str            = "generated"  # "textbook"|"notes"|"pyq"|"generated"
    difficulty: Optional[str]  = None      # "easy" | "medium" | "hard"
    diagram:    DiagramInfo    = Field(default_factory=DiagramInfo)
    keywords:   list[str]      = Field(default_factory=list)
    page_ref:   Optional[str]  = None      # e.g. "NCERT Ch.5 p.89"


class Chunk(BaseModel):
    id:       str          = Field(default_factory=lambda: str(uuid.uuid4()))
    content:  str
    metadata: ChunkMetadata


class IngestResult(BaseModel):
    ingested:   int
    skipped:    int
    collection: str
    errors:     list[str] = Field(default_factory=list)
