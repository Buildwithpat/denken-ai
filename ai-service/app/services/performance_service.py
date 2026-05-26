"""
Performance analysis service.

Execution path
--------------
analyze_performance(req)
  │
  ├─ build_context() for the weakest topic (safe no-op when store empty)
  │
  ├─ [swap point] if settings.ai_provider == "gemini":
  │       return _analyze_with_gemini(req, ctx)
  │
  └─ _analyze_mock(req, ctx)
       · Rule-based recommendations are fully data-driven (unchanged)
       · study_focus is enriched with a RAG-derived content pointer when available
"""
from __future__ import annotations

from app.schemas.performance import (
    PerformanceRequest,
    PerformanceResponse,
    RecommendationItem,
)
from app.rag.context_builder import RAGContext, build_context, extract_key_points


def analyze_performance(req: PerformanceRequest) -> PerformanceResponse:
    # Retrieve context for the single weakest topic only (one query, low cost)
    ctx = _get_weak_context(req)

    # --- swap point ---
    # from app.config import settings
    # if settings.ai_provider == "gemini":
    #     return _analyze_with_gemini(req, ctx)

    return _analyze_mock(req, ctx)


def _get_weak_context(req: PerformanceRequest) -> RAGContext:
    if not req.weak_topics:
        return RAGContext()
    worst = min(req.weak_topics, key=lambda t: t.accuracy)
    return build_context(
        worst.topic,
        exam=req.exam,
        subject=worst.subject,
        chapter=worst.topic,
        top_k=5,
    )


# ---------------------------------------------------------------------------
# Prompt builder (used by future Gemini path)
# ---------------------------------------------------------------------------

def _build_performance_prompt(req: PerformanceRequest, ctx: RAGContext) -> str:
    from app.rag.context_builder import format_for_prompt
    context_block = format_for_prompt(ctx)
    context_section = f"\n\n<CONTEXT>\n{context_block}\n</CONTEXT>" if context_block else ""
    subj_lines = ", ".join(f"{s.subject} {s.accuracy:.0f}%" for s in req.subjects)
    weak_lines = ", ".join(f"{t.topic} ({t.subject}) {t.accuracy:.0f}%" for t in req.weak_topics[:4])
    return (
        f"You are a {req.exam} performance analyst.\n"
        f"Subjects: {subj_lines}\n"
        f"Weak topics: {weak_lines}\n"
        f"Average accuracy: {req.avg_accuracy:.0f}% over {req.tests_taken} tests.{context_section}\n\n"
        "Return JSON: summary, strengths[], weaknesses[], recommendations[{title,body,sentiment,priority}], study_focus."
    )


# ---------------------------------------------------------------------------
# Mock provider — rule-based + optional RAG enrichment for study_focus
# ---------------------------------------------------------------------------

def _analyze_mock(req: PerformanceRequest, ctx: RAGContext) -> PerformanceResponse:
    subjects    = req.subjects
    weak_topics = req.weak_topics
    avg         = req.avg_accuracy
    exam        = req.exam

    # ── Summary ────────────────────────────────────────────────────────────
    trend_word = "progressing steadily" if avg >= 65 else "still building momentum"
    summary = (
        f"You've taken {req.tests_taken} test(s) for {exam} with an average accuracy "
        f"of {avg:.0f}%. Your performance is {trend_word}. "
        + (
            "Keep pushing — consistency will get you past the next threshold."
            if avg >= 60
            else "Focus on your weakest areas first to see the fastest gains."
        )
    )

    # ── Strengths ──────────────────────────────────────────────────────────
    strong = sorted(
        [s for s in subjects if s.accuracy >= avg],
        key=lambda s: s.accuracy, reverse=True,
    )
    strengths: list[str] = [
        f"{s.subject} — {s.accuracy:.0f}% accuracy"
        + (f" (↑{s.trend:.0f}% trend)" if s.trend > 0 else "")
        for s in strong
    ]
    if not strengths:
        strengths = ["More tests needed to identify strong areas — keep going!"]

    # ── Weaknesses ────────────────────────────────────────────────────────
    sorted_weak = sorted(weak_topics, key=lambda t: t.accuracy)[:4]
    weaknesses: list[str] = [
        f"{t.topic} ({t.subject}) — {t.accuracy:.0f}% accuracy, {t.wrong_count} wrong"
        for t in sorted_weak
    ]
    if not weaknesses:
        weaknesses = ["No critical weak areas detected yet."]

    # ── Recommendations (rule-based, data-driven) ─────────────────────────
    recs: list[RecommendationItem] = []

    # 1. Weakest subject < 60%
    if subjects:
        weakest_subj = min(subjects, key=lambda s: s.accuracy)
        if weakest_subj.accuracy < 60:
            recs.append(RecommendationItem(
                title=f"{weakest_subj.subject} needs focused attention",
                body=(
                    f"Your accuracy in {weakest_subj.subject} is "
                    f"{weakest_subj.accuracy:.0f}%. Dedicate at least 40 minutes "
                    "daily to this subject until you cross 65%."
                ),
                sentiment="danger", priority=1,
            ))

    # 2. Most-missed topic
    if weak_topics:
        top_miss = max(weak_topics, key=lambda t: t.wrong_count)
        rag_hint = _rag_study_hint(ctx) if not ctx.is_empty else ""
        recs.append(RecommendationItem(
            title=f"Revisit '{top_miss.topic}'",
            body=(
                f"You've gotten {top_miss.wrong_count} question(s) wrong on "
                f"'{top_miss.topic}'. Start with a concept review, then drill "
                f"10 targeted problems.{rag_hint}"
            ),
            sentiment="warning", priority=2,
        ))

    # 3. MCQ vs numerical gap > 15 pp
    mcq_acc = next((q.accuracy for q in req.question_types if q.type == "mcq"), None)
    num_acc = next((q.accuracy for q in req.question_types if q.type == "numerical"), None)
    if mcq_acc is not None and num_acc is not None and mcq_acc - num_acc > 15:
        recs.append(RecommendationItem(
            title="Strengthen numerical problem-solving",
            body=(
                f"MCQ accuracy ({mcq_acc:.0f}%) is significantly higher than "
                f"numerical accuracy ({num_acc:.0f}%). "
                "Allocate 20 minutes daily to pure numerical drills."
            ),
            sentiment="warning", priority=3,
        ))

    # 4. Best subject with upward trend
    if subjects:
        best_subj = max(subjects, key=lambda s: s.accuracy)
        if best_subj.accuracy >= 75 and best_subj.trend >= 3:
            recs.append(RecommendationItem(
                title=f"Strong momentum in {best_subj.subject}",
                body=(
                    f"You're at {best_subj.accuracy:.0f}% in {best_subj.subject} "
                    f"with an upward trend of +{best_subj.trend:.0f}%. "
                    "Maintain this pace with one practice test per week."
                ),
                sentiment="success", priority=4,
            ))

    if not recs:
        recs.append(RecommendationItem(
            title="Keep up the consistency",
            body=(
                "You're building a solid practice habit. "
                "Take at least 3 tests per week to accelerate your improvement curve."
            ),
            sentiment="success", priority=1,
        ))

    # ── Study focus (RAG-enriched when context available) ─────────────────
    if sorted_weak:
        focus_topic = sorted_weak[0]
        rag_points  = extract_key_points(ctx, max_points=1)
        rag_content = f" Key insight: {rag_points[0]}" if rag_points else ""
        study_focus = (
            f"This week: prioritise '{focus_topic.topic}' ({focus_topic.subject}) — "
            f"accuracy {focus_topic.accuracy:.0f}%, {focus_topic.wrong_count} wrong "
            f"answer(s).{rag_content}"
        )
    else:
        study_focus = "Maintain your current pace and attempt harder test sets this week."

    return PerformanceResponse(
        summary=summary,
        strengths=strengths,
        weaknesses=weaknesses,
        recommendations=sorted(recs, key=lambda r: r.priority),
        study_focus=study_focus,
        generated_by="mock",
    )


def _rag_study_hint(ctx: RAGContext) -> str:
    """Short addendum for the 'revisit topic' recommendation body."""
    points = extract_key_points(ctx, max_points=1)
    if points:
        return f" Key concept to review: {points[0]}"
    return ""
