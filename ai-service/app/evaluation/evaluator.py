"""
Retrieval quality evaluator — hit-rate, MRR, P@k testing.

A TestCase specifies a query and the expected chunk-type / chapter / keyword
that should appear in the top-k results.  run_eval() executes all test cases
against the live ChromaDB and returns an EvalReport.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TestCase:
    query:            str
    exam:             str
    subject:          Optional[str] = None
    chapter:          Optional[str] = None
    expected_type:    Optional[str] = None   # e.g. "formula", "theory"
    expected_keyword: Optional[str] = None   # substring match in content
    top_k:            int           = 5


@dataclass
class CaseResult:
    query:   str
    hit:     bool   = False    # at least one result matches expected criteria
    rank:    int    = 0        # 1-based rank of first hit; 0 = not found
    score:   float  = 0.0     # similarity score of first hit


@dataclass
class EvalReport:
    total:      int         = 0
    hits:       int         = 0
    hit_rate:   float       = 0.0
    mrr:        float       = 0.0    # Mean Reciprocal Rank
    precision_at_k: float   = 0.0   # average P@k (k = TestCase.top_k)
    case_results: list[CaseResult] = field(default_factory=list)


def run_eval(test_cases: list[TestCase]) -> EvalReport:
    """
    Run all test cases against ChromaDB and compute retrieval metrics.
    Safe to call when the store is empty (returns zero metrics).
    """
    from app.rag.retriever import retrieve
    from app.rag.store import collection_count

    report = EvalReport(total=len(test_cases))
    if not test_cases:
        return report

    if collection_count() == 0:
        # Store empty — all cases fail
        report.case_results = [CaseResult(query=tc.query) for tc in test_cases]
        return report

    rr_sum   = 0.0
    pk_sum   = 0.0

    for tc in test_cases:
        results = retrieve(
            tc.query,
            exam=tc.exam,
            subject=tc.subject,
            chapter=tc.chapter,
            top_k=tc.top_k,
            include_diagrams=True,
        )

        first_hit_rank  = 0
        first_hit_score = 0.0
        hits_in_k       = 0

        for rank, r in enumerate(results, start=1):
            match = _is_match(r, tc)
            if match:
                hits_in_k += 1
                if first_hit_rank == 0:
                    first_hit_rank  = rank
                    first_hit_score = r.get("score", 0.0)

        hit = first_hit_rank > 0
        report.hits     += int(hit)
        rr_sum          += (1.0 / first_hit_rank) if first_hit_rank else 0.0
        pk_sum          += hits_in_k / max(tc.top_k, 1)

        report.case_results.append(CaseResult(
            query=tc.query,
            hit=hit,
            rank=first_hit_rank,
            score=round(first_hit_score, 4),
        ))

    n = len(test_cases)
    report.hit_rate       = round(report.hits / n, 3)
    report.mrr            = round(rr_sum / n, 3)
    report.precision_at_k = round(pk_sum / n, 3)
    return report


def _is_match(result: dict, tc: TestCase) -> bool:
    if tc.expected_type:
        if result.get("chunk_type") != tc.expected_type:
            return False
    if tc.expected_keyword:
        content = result.get("content", "").lower()
        if tc.expected_keyword.lower() not in content:
            return False
    return True


# ---------------------------------------------------------------------------
# Default test-case sets per exam
# ---------------------------------------------------------------------------

def default_test_cases(exam: str) -> list[TestCase]:
    """Minimal smoke-test suite for a given exam."""
    if exam in ("JEE_MAIN", "JEE_ADVANCED"):
        return [
            TestCase("Newton's laws of motion", exam=exam, subject="Physics",
                     expected_keyword="newton", top_k=5),
            TestCase("formula for kinetic energy", exam=exam, subject="Physics",
                     expected_type="formula", top_k=5),
            TestCase("periodic table trends", exam=exam, subject="Chemistry",
                     expected_keyword="period", top_k=5),
            TestCase("integration by parts", exam=exam, subject="Mathematics",
                     expected_keyword="integr", top_k=5),
            TestCase("Ohm's law solved example", exam=exam, subject="Physics",
                     expected_type="solved_example", top_k=5),
        ]
    if exam == "NEET":
        return [
            TestCase("cell division mitosis", exam=exam, subject="Biology",
                     expected_keyword="mitosis", top_k=5),
            TestCase("oxidation reduction reaction", exam=exam, subject="Chemistry",
                     expected_keyword="oxidat", top_k=5),
            TestCase("force acceleration formula", exam=exam, subject="Physics",
                     expected_type="formula", top_k=5),
        ]
    # Generic fallback
    return [
        TestCase("definition of force", exam=exam, expected_type="definition", top_k=5),
        TestCase("example problem kinetic energy", exam=exam, expected_keyword="kinetic", top_k=5),
    ]
