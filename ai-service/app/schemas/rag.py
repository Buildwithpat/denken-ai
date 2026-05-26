from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Ingest
# ---------------------------------------------------------------------------

class IngestRequest(BaseModel):
    exam:    str
    subject: str
    chapter: str
    unit:    Optional[str] = None
    topics:  dict[str, str] = Field(
        default_factory=dict,
        description="topic name → raw text.  At least one of `topics` or `content` must be non-empty.",
        examples=[{"Newton's First Law": "An object at rest stays at rest..."}],
    )
    content: Optional[str] = Field(
        default=None,
        description="Chapter-level text (no topic tag). Processed alongside `topics`.",
    )
    source:  str  = Field(default="generated", description="'textbook'|'notes'|'pyq'|'generated'")
    replace: bool = Field(
        default=False,
        description="Delete existing chunks for this (exam, subject, chapter) before ingesting.",
    )

    model_config = {"json_schema_extra": {
        "example": {
            "exam":    "JEE_MAIN",
            "subject": "Physics",
            "unit":    "Mechanics",
            "chapter": "Laws of Motion",
            "topics":  {
                "Newton's First Law":  "An object continues in its state of rest or uniform motion...",
                "Newton's Second Law": "The rate of change of momentum is proportional to the force...",
                "Newton's Third Law":  "Every action has an equal and opposite reaction...",
            },
            "source":  "textbook",
            "replace": False,
        }
    }}


class IngestResponse(BaseModel):
    ingested:   int
    skipped:    int
    collection: str
    errors:     list[str] = []


# ---------------------------------------------------------------------------
# Retrieve
# ---------------------------------------------------------------------------

class RetrieveRequest(BaseModel):
    query:            str  = Field(min_length=3, description="Natural-language query string")
    exam:             Optional[str] = Field(default=None, description="Filter by exam: 'JEE_MAIN'|'NEET'|'CBSE'")
    subject:          Optional[str] = Field(default=None, description="Filter by subject")
    chapter:          Optional[str] = Field(default=None, description="Filter by chapter name")
    topic:            Optional[str] = Field(default=None, description="Topic hint for re-ranking bonus (not a hard filter)")
    chunk_type:       Optional[str] = Field(default=None, description="Filter by type: 'theory'|'formula'|'diagram'|...")
    top_k:            int  = Field(default=5, ge=1, le=20, description="Max chunks to return")
    include_diagrams: bool = Field(default=True, description="Set False to exclude diagram-reference chunks")

    model_config = {"json_schema_extra": {
        "example": {
            "query":   "What is Newton's second law and how is F=ma derived?",
            "exam":    "JEE_MAIN",
            "subject": "Physics",
            "chapter": "Laws of Motion",
            "top_k":   5,
        }
    }}


class RetrievedChunk(BaseModel):
    content:              str
    score:                float = Field(description="Composite re-ranked score 0–1 (higher = more relevant)")
    raw_semantic_score:   float = Field(description="Original cosine similarity 0–1 before re-ranking")
    exam:                 str
    subject:              str
    unit:                 Optional[str]
    chapter:              str
    topic:                Optional[str]
    chunk_type:           str
    source:               str
    has_diagram:          bool
    diagram_type:         Optional[str]
    diagram_description:  Optional[str]
    keywords:             list[str]


class RetrieveResponse(BaseModel):
    query:           str
    total_found:     int
    collection_size: int
    chunks:          list[RetrievedChunk]


# ---------------------------------------------------------------------------
# Image ingest
# ---------------------------------------------------------------------------

class ImageIngestResponse(BaseModel):
    ingested:         int
    skipped:          int
    collection:       str
    errors:           list[str] = []
    ocr_text_length:  int  = Field(description="Character count of cleaned OCR text")
    is_diagram_heavy: bool = Field(description="True when image had very little readable text")


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

class CollectionStatus(BaseModel):
    collection:   str
    persist_dir:  str
    total_chunks: int
    embedding_model: str
    embedding_dim:   int
