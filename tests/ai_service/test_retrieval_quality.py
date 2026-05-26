"""
Retrieval-quality evaluation harness.

Runs a fixed suite of EvalCases against the seeded ChromaDB and measures:
  - Hit@k   — fraction of cases where an expected topic appears in top_k
  - MRR     — mean reciprocal rank of the first hit
  - P@1     — precision at rank 1 (top result is a hit)

Quality gates (configurable in seed_data.py):
  EVAL_MIN_HIT_RATE = 0.60
  EVAL_MIN_MRR      = 0.35

All tests in this module require the seeded_client fixture (ChromaDB
populated with SEED_CONTENT_MAPS) and are marked `quality` + `slow`.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import pytest

pytestmark = [pytest.mark.ai_service, pytest.mark.quality, pytest.mark.slow]

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from fixtures.seed_data import (
    RETRIEVAL_EVAL_CASES, EvalCase,
    EVAL_MIN_HIT_RATE, EVAL_MIN_MRR,
)


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def _is_hit(chunk: dict[str, Any], expected_topics: list[str]) -> bool:
    """True when any expected topic appears (case-insensitive) in chunk['topic']."""
    topic = chunk.get("topic", "").lower()
    return any(et.lower() in topic for et in expected_topics)


def score_case(
    client,
    case: EvalCase,
) -> dict[str, Any]:
    """
    Execute a single retrieval case and return a dict with:
      hit_at_k, rank (1-indexed, None if no hit), mrr, top_score,
      top_semantic_score, case
    """
    payload: dict[str, Any] = {
        "query":  case.query,
        "top_k":  case.top_k,
        "exam":   case.exam,
    }
    if case.subject:
        payload["subject"] = case.subject
    if case.chapter:
        payload["chapter"] = case.chapter

    resp = client.post("/rag/retrieve", json=payload)
    assert resp.status_code == 200, f"Retrieve failed: {resp.text}"
    chunks = resp.json()["chunks"]

    hit_rank: int | None = None
    for i, c in enumerate(chunks[: case.top_k]):
        if _is_hit(c, case.expected_topics):
            hit_rank = i + 1
            break

    top_chunk = chunks[0] if chunks else {}
    top_score          = top_chunk.get("score", 0.0)
    top_semantic_score = top_chunk.get("raw_semantic_score", top_score)

    return {
        "hit_at_k":          hit_rank is not None,
        "rank":               hit_rank,
        "mrr":                (1.0 / hit_rank) if hit_rank else 0.0,
        "top_score":          top_score,
        "top_semantic_score": top_semantic_score,
        "case":               case,
        "chunks":             chunks,
    }


def run_eval_suite(client, cases: list[EvalCase]) -> dict[str, Any]:
    """Run all cases; return aggregate metrics."""
    results = [score_case(client, c) for c in cases]

    n = len(results)
    hits = sum(1 for r in results if r["hit_at_k"])
    hit_rate = hits / n if n else 0.0
    mrr = sum(r["mrr"] for r in results) / n if n else 0.0
    p_at_1 = sum(1 for r in results if r["rank"] == 1) / n if n else 0.0

    return {
        "n":         n,
        "hits":      hits,
        "hit_rate":  hit_rate,
        "mrr":       mrr,
        "p_at_1":    p_at_1,
        "results":   results,
    }


# ---------------------------------------------------------------------------
# Per-case parametrised tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("case", RETRIEVAL_EVAL_CASES, ids=[c.query[:40] for c in RETRIEVAL_EVAL_CASES])
def test_case_returns_results(seeded_client, case: EvalCase):
    """Every eval query must return at least one chunk."""
    payload: dict[str, Any] = {"query": case.query, "top_k": case.top_k, "exam": case.exam}
    if case.subject:
        payload["subject"] = case.subject
    resp = seeded_client.post("/rag/retrieve", json=payload)
    assert resp.status_code == 200
    assert len(resp.json()["chunks"]) > 0, f"No results for: {case.query!r}"


@pytest.mark.parametrize("case", RETRIEVAL_EVAL_CASES, ids=[c.query[:40] for c in RETRIEVAL_EVAL_CASES])
def test_case_top_score_above_minimum(seeded_client, case: EvalCase):
    """
    The top result's original cosine similarity must exceed the case's min_score.

    Uses raw_semantic_score (pre-re-ranking cosine) rather than the composite
    re-ranked score, so the threshold tests the embedding quality, not the
    re-ranker's confidence normalisation.
    """
    payload: dict[str, Any] = {"query": case.query, "top_k": case.top_k, "exam": case.exam}
    if case.subject:
        payload["subject"] = case.subject
    chunks = seeded_client.post("/rag/retrieve", json=payload).json()["chunks"]
    if not chunks:
        pytest.fail(f"No chunks returned for query: {case.query!r}")
    # raw_semantic_score preserves the cosine similarity before composite re-ranking
    top_score = chunks[0].get("raw_semantic_score", chunks[0]["score"])
    assert top_score >= case.min_score, (
        f"Top semantic score {top_score:.3f} < min {case.min_score} for: {case.query!r}"
    )


# ---------------------------------------------------------------------------
# Aggregate quality gates
# ---------------------------------------------------------------------------

def test_hit_rate_above_threshold(seeded_client):
    """
    At least EVAL_MIN_HIT_RATE fraction of eval cases must hit the expected
    topic within top_k results.
    """
    report = run_eval_suite(seeded_client, RETRIEVAL_EVAL_CASES)

    misses = [
        f"  MISS  q={r['case'].query!r}  expected={r['case'].expected_topics}"
        for r in report["results"] if not r["hit_at_k"]
    ]

    assert report["hit_rate"] >= EVAL_MIN_HIT_RATE, (
        f"Hit rate {report['hit_rate']:.2f} < {EVAL_MIN_HIT_RATE} "
        f"({report['hits']}/{report['n']} hits)\n"
        + "\n".join(misses)
    )


def test_mrr_above_threshold(seeded_client):
    """Mean reciprocal rank must exceed EVAL_MIN_MRR."""
    report = run_eval_suite(seeded_client, RETRIEVAL_EVAL_CASES)
    assert report["mrr"] >= EVAL_MIN_MRR, (
        f"MRR {report['mrr']:.3f} < {EVAL_MIN_MRR}"
    )


def test_eval_report_json_serialisable(seeded_client, tmp_path):
    """
    The full eval report must be JSON-serialisable so CI pipelines can
    archive it as an artifact.
    """
    report = run_eval_suite(seeded_client, RETRIEVAL_EVAL_CASES)

    serialisable = {
        "n":        report["n"],
        "hits":     report["hits"],
        "hit_rate": report["hit_rate"],
        "mrr":      report["mrr"],
        "p_at_1":   report["p_at_1"],
        "results":  [
            {
                "query":               r["case"].query,
                "expected":            r["case"].expected_topics,
                "hit_at_k":            r["hit_at_k"],
                "rank":                r["rank"],
                "mrr":                 r["mrr"],
                "top_score":           r["top_score"],
                "top_semantic_score":  r["top_semantic_score"],
                "top_topics":          [c.get("topic") for c in r["chunks"][:3]],
            }
            for r in report["results"]
        ],
    }

    out = tmp_path / "eval_report.json"
    out.write_text(json.dumps(serialisable, indent=2))
    assert out.exists()

    # Verify the file can be reloaded without error
    loaded = json.loads(out.read_text())
    assert loaded["n"] == report["n"]
