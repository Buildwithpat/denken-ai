"""
Chunk quality metrics — aggregate statistics over stored chunks.

compute_quality_report() analyses what is in ChromaDB and returns counts,
type distribution, diagram percentage, average content length, etc.
This is read-only: no writes to ChromaDB.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.rag.store import get_all_metadata, collection_count


@dataclass
class ChunkQualityReport:
    exam:             str
    subject:          Optional[str]
    total_chunks:     int = 0
    by_type:          dict[str, int]      = field(default_factory=dict)
    by_chapter:       dict[str, int]      = field(default_factory=dict)
    avg_content_len:  float               = 0.0
    diagram_pct:      float               = 0.0
    formula_pct:      float               = 0.0
    theory_pct:       float               = 0.0
    has_examples:     bool                = False
    warnings:         list[str]           = field(default_factory=list)


def compute_quality_report(
    exam:    str,
    subject: Optional[str] = None,
) -> ChunkQualityReport:
    """
    Build a quality report for all chunks matching the given exam (+ optional
    subject).  Content length stats come from metadata-only records to avoid
    pulling large document blobs.
    """
    # Build filter
    if subject:
        where: dict = {"$and": [
            {"exam":    {"$eq": exam}},
            {"subject": {"$eq": subject}},
        ]}
    else:
        where = {"exam": {"$eq": exam}}

    records = get_all_metadata(where)
    report  = ChunkQualityReport(exam=exam, subject=subject, total_chunks=len(records))

    if not records:
        report.warnings.append(f"No chunks found for exam='{exam}'" +
                               (f", subject='{subject}'" if subject else ""))
        return report

    by_type:    dict[str, int] = {}
    by_chapter: dict[str, int] = {}
    has_diagram_count  = 0

    for rec in records:
        ctype   = rec.get("chunk_type", "theory")
        chapter = rec.get("chapter", "")
        has_diag = rec.get("has_diagram", False)

        by_type[ctype]       = by_type.get(ctype, 0) + 1
        by_chapter[chapter]  = by_chapter.get(chapter, 0) + 1
        if has_diag:
            has_diagram_count += 1

    total = len(records)
    report.by_type         = by_type
    report.by_chapter      = by_chapter
    report.diagram_pct     = round(has_diagram_count / total * 100, 1)
    report.formula_pct     = round(by_type.get("formula", 0) / total * 100, 1)
    report.theory_pct      = round(
        (by_type.get("theory", 0) + by_type.get("definition", 0) +
         by_type.get("summary", 0)) / total * 100, 1
    )
    report.has_examples    = bool(
        by_type.get("example", 0) + by_type.get("solved_example", 0) +
        by_type.get("previous_year", 0)
    )

    # Quality warnings
    if report.formula_pct == 0:
        report.warnings.append("No formula chunks detected — consider adding a formula sheet.")
    if not report.has_examples:
        report.warnings.append("No example / solved-example chunks — worked examples improve retrieval quality.")
    if len(by_chapter) == 1:
        report.warnings.append("Only one chapter detected — ensure syllabus coverage is complete.")

    return report
