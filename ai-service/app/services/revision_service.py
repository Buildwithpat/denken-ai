"""
Revision plan generation service.

Execution path
--------------
generate_revision(req)
  │
  ├─ For each topic: build_context() to retrieve syllabus chunks
  │
  ├─ [swap point] if settings.ai_provider == "gemini":
  │       return _generate_with_gemini(req, contexts)
  │
  └─ _generate_mock(req, contexts)
       · Each topic's focus_points are enriched with RAG key-points when available
       · Falls back to mode-specific generic hints when RAG store is empty
"""
from __future__ import annotations

from app.schemas.revision import RevisionPlanItem, RevisionRequest, RevisionResponse
from app.rag.context_builder import RAGContext, build_context, extract_key_points

_DURATIONS = ["45 min", "40 min", "50 min", "35 min", "45 min", "40 min", "30 min"]

_MODE_FOCUS: dict[str, list[str]] = {
    "concept": [
        "Review theory and definitions before touching problems",
        "Study derivations step-by-step; write them out by hand",
        "Summarise the key ideas in your own words after each session",
    ],
    "drill": [
        "Solve 15–20 targeted problems in one sitting",
        "Time yourself: aim for 1.5 min per MCQ, 3 min per numerical",
        "Review every wrong answer immediately — do not skip post-analysis",
    ],
    "practice": [
        "Attempt mixed-difficulty problems across easy, medium, and hard",
        "Focus on accuracy first; build speed once accuracy is above 70%",
        "Note recurring error patterns and flag them for concept review",
    ],
}


def generate_revision(req: RevisionRequest) -> RevisionResponse:
    # Retrieve context for each topic (safe no-op when store empty)
    contexts: list[RAGContext] = [
        build_context(
            t.topic,
            exam=req.exam,
            subject=t.subject,
            chapter=t.topic,
            top_k=5,
        )
        for t in req.topics[:7]
    ]

    # --- swap point ---
    # from app.config import settings
    # if settings.ai_provider == "gemini":
    #     return _generate_with_gemini(req, contexts)

    return _generate_mock(req, contexts)


# ---------------------------------------------------------------------------
# Prompt builder (used by future Gemini path)
# ---------------------------------------------------------------------------

def _build_revision_prompt(req: RevisionRequest, contexts: list[RAGContext]) -> str:
    from app.rag.context_builder import format_for_prompt
    topic_lines = []
    for t, ctx in zip(req.topics, contexts):
        block = format_for_prompt(ctx)
        ctx_note = f"\n  Context:\n{block[:400]}" if block else ""
        topic_lines.append(
            f"- {t.topic} ({t.subject}), accuracy {t.accuracy:.0f}%{ctx_note}"
        )
    topics_str = "\n".join(topic_lines)
    return (
        f"You are a {req.exam} tutor. Create a {req.mode} revision plan.\n"
        f"Topics (weakest first):\n{topics_str}\n\n"
        "Return JSON: plan (list of {day, topic, subject, duration, mode, focus_points[]}), summary."
    )


# ---------------------------------------------------------------------------
# Mock provider — RAG-enriched focus_points when context is available
# ---------------------------------------------------------------------------

def _generate_mock(req: RevisionRequest, contexts: list[RAGContext]) -> RevisionResponse:
    if not req.topics:
        return RevisionResponse(
            plan=[],
            summary="No topics provided. Add weak topics to generate a revision plan.",
            generated_by="mock",
        )

    generic_focus = _MODE_FOCUS.get(req.mode, _MODE_FOCUS["drill"])
    plan: list[RevisionPlanItem] = []

    for i, (t, ctx) in enumerate(zip(req.topics[:7], contexts)):
        focus_points = _build_focus_points(t.subject, req.mode, ctx, generic_focus)
        plan.append(RevisionPlanItem(
            day=f"Day {i + 1}",
            topic=t.topic,
            subject=t.subject,
            duration=_DURATIONS[i % len(_DURATIONS)],
            mode=req.mode,
            focus_points=focus_points,
        ))

    weakest = min(req.topics, key=lambda t: t.accuracy)
    rag_hint = ""
    if contexts and not contexts[0].is_empty:
        rag_hint = " Syllabus context has been loaded for targeted focus points."

    summary = (
        f"Your {req.mode} plan covers {len(plan)} topic(s) over {len(plan)} day(s). "
        f"Start with '{weakest.topic}' ({weakest.subject}) — "
        f"your accuracy there is {weakest.accuracy:.0f}%, the lowest in your queue. "
        f"Even 30 focused minutes daily yields measurable improvement within a week.{rag_hint}"
    )

    return RevisionResponse(plan=plan, summary=summary, generated_by="mock")


def _build_focus_points(
    subject: str,
    mode: str,
    ctx: RAGContext,
    generic_focus: list[str],
) -> list[str]:
    """
    Combine RAG-derived key-points (specific to the topic) with
    mode-appropriate generic hints. RAG points come first.
    """
    rag_points = extract_key_points(ctx, max_points=2)

    subject_hint = (
        "Prioritise numerical and derivation-heavy problems."
        if any(kw in subject for kw in ("Physics", "Math", "Chemistry"))
        else "Focus on conceptual clarity and diagram-based questions."
    )

    # RAG points + first 2 generic hints + subject hint
    return rag_points + generic_focus[:2] + [subject_hint]
