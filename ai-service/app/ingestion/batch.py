"""
Batch ingestion coordinator.

Accepts a list of content_maps, runs optional validation, calls the pipeline
for each map, accumulates results, and never raises — errors go into the result.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.rag.models import IngestResult
from app.rag.pipeline import ingest_content_map


@dataclass
class BatchIngestResult:
    total:          int = 0
    succeeded:      int = 0
    failed:         int = 0
    chunks_created: int = 0
    chunks_skipped: int = 0
    item_results:   list[dict[str, Any]] = field(default_factory=list)


def batch_ingest(
    content_maps:  list[dict],
    replace:       bool = False,
    validate:      bool = True,
    stop_on_error: bool = False,
) -> BatchIngestResult:
    """
    Ingest a list of content_maps.

    Parameters
    ----------
    content_maps   : list of raw dicts following the content_map schema
    replace        : if True, delete existing chunks for each chapter first
    validate       : if True, run validate_content_map() before ingesting
    stop_on_error  : if True, abort after the first validation/ingest failure

    Returns
    -------
    BatchIngestResult with per-item details and aggregate counts.
    """
    from app.ingestion.validators import validate_content_map

    batch = BatchIngestResult(total=len(content_maps))

    for i, cm in enumerate(content_maps):
        label = f"{cm.get('exam','?')}/{cm.get('subject','?')}/{cm.get('chapter','?')}"

        # ── Validate ──────────────────────────────────────────────────────
        if validate:
            errs = validate_content_map(cm)
            if errs:
                batch.failed += 1
                batch.item_results.append({
                    "index": i, "label": label,
                    "status": "validation_failed", "errors": errs,
                    "chunks_created": 0,
                })
                if stop_on_error:
                    break
                continue

        # ── Ingest ────────────────────────────────────────────────────────
        try:
            result: IngestResult = ingest_content_map(cm, replace=replace)
        except Exception as exc:
            batch.failed += 1
            batch.item_results.append({
                "index": i, "label": label,
                "status": "ingest_error", "errors": [str(exc)],
                "chunks_created": 0,
            })
            if stop_on_error:
                break
            continue

        if result.errors:
            batch.failed += 1
            batch.item_results.append({
                "index": i, "label": label,
                "status": "ingest_error", "errors": result.errors,
                "chunks_created": result.ingested,
            })
        else:
            batch.succeeded += 1
            batch.chunks_created += result.ingested
            batch.chunks_skipped += result.skipped
            batch.item_results.append({
                "index": i, "label": label, "status": "ok",
                "chunks_created": result.ingested,
                "chunks_skipped": result.skipped,
            })

        if stop_on_error and result.errors:
            break

    return batch
