"""
Adaptive Service — Gemini-powered concept guidance and mastery assessment.

Responsibilities:
  - generate_concept_guidance(): personalised explanation + formula recall
    for a specific concept, tuned to the student's mastery level and mistake type.
  - assess_concept_mastery(): derive a mastery estimate from a batch of
    practice responses (without needing MongoDB access in Python).
  - recommend_next_concept(): suggest highest-ROI concept to tackle next.

Gemini is used ONLY for guidance text generation.
Mastery assessment is deterministic (no LLM required).
"""

import logging
import math
from typing import Optional

log = logging.getLogger("adaptive_service")

# ── Mastery level labels ──────────────────────────────────────────────────────

def _mastery_label(score: int) -> str:
    if score < 25:  return "CRITICAL"
    if score < 45:  return "WEAK"
    if score < 65:  return "MODERATE"
    if score < 80:  return "STRONG"
    return "EXPERT"


# ── Mistake-type coaching inserts ─────────────────────────────────────────────

_MISTAKE_COACHING = {
    "formula": (
        "Your errors suggest formula recall issues. "
        "Derive each formula from first principles before using it — "
        "this embeds the formula structure into memory rather than rote recall."
    ),
    "conceptual": (
        "Your errors are conceptual. "
        "Build a mental model of **why** this concept works before solving problems. "
        "Draw a diagram or write a one-sentence explanation in plain English."
    ),
    "careless": (
        "Your errors appear careless — correct concept, wrong execution. "
        "Slow down during sign changes, unit conversions, and substitutions. "
        "Write each intermediate step explicitly."
    ),
    "weak-retention": (
        "You've seen this before but retention is low. "
        "Active recall beats re-reading: close your notes and recall the key ideas, "
        "then check. Repeat after 1 day, 3 days, 1 week."
    ),
    "repeated": (
        "This is a recurring mistake pattern. "
        "Identify the exact step where you go wrong and create a personal checklist "
        "to catch it every time."
    ),
}


# ── Gemini caller ─────────────────────────────────────────────────────────────

def _call_gemini(prompt: str, max_tokens: int = 700) -> Optional[str]:
    try:
        import google.generativeai as genai  # type: ignore
        from app.config import settings

        if not settings.gemini_api_key:
            return None

        genai.configure(api_key=settings.gemini_api_key)
        model  = genai.GenerativeModel(settings.gemini_model)
        result = model.generate_content(
            prompt,
            generation_config={"max_output_tokens": max_tokens, "temperature": 0.35},
        )
        text = result.text.strip() if result.text else ""
        if not text:
            log.warning("Gemini returned empty text for concept guidance")
        return text or None
    except ImportError:
        log.error("google-generativeai not installed — Gemini unavailable")
        return None
    except Exception as exc:
        log.error("Gemini concept guidance failed: %s: %s", type(exc).__name__, exc)
        return None


# ── Mock guidance builder ─────────────────────────────────────────────────────

def _mock_guidance(
    concept_name: str,
    subject:      str,
    chapter:      str,
    mastery_score: int,
    mistake_type: Optional[str],
    formula_context: list[str],
) -> dict:
    mastery_lbl = _mastery_label(mastery_score)
    mistake_note = _MISTAKE_COACHING.get(mistake_type or "", "")

    guidance_parts = [
        f"## {concept_name} — Concept Guidance\n",
        f"**Your current level**: {mastery_lbl} ({mastery_score}%)\n",
    ]

    if mastery_score < 45:
        guidance_parts.append(
            f"Since your mastery of {concept_name} is still developing, "
            "we'll start from the foundational idea and build upward. "
            "Focus on understanding the **why** before the **how**.\n"
        )
    else:
        guidance_parts.append(
            f"You have a decent foundation in {concept_name}. "
            "This session focuses on closing remaining gaps and "
            "sharpening your problem-solving approach.\n"
        )

    if mistake_note:
        guidance_parts.append(f"\n### What your mistakes reveal\n{mistake_note}\n")

    guidance_parts.append(f"\n### Core idea of {concept_name}\n")
    guidance_parts.append(
        f"{concept_name} is a key concept in **{chapter}** ({subject}). "
        "Master the defining relationship, identify the variables involved, "
        "and practise applying it under different conditions (numerical, graphical, qualitative).\n"
    )

    if formula_context:
        guidance_parts.append("\n### Relevant formulas to recall\n")
        for f in formula_context[:4]:
            guidance_parts.append(f"- `{f}`\n")

    guidance_parts.append("\n### Common exam traps\n")
    guidance_parts.append(
        "- Sign errors in vector quantities\n"
        "- Forgetting to check units before substituting\n"
        "- Applying formulas outside their valid conditions\n"
        "- Missing limiting cases\n"
    )

    next_steps = [
        f"Solve 3 varied problems on {concept_name} (easy → medium → hard)",
        "Verify each formula by deriving it once from scratch",
        f"Link this concept to adjacent topics in {chapter}",
    ]

    return {
        "guidance":      "".join(guidance_parts),
        "key_formulas":  formula_context[:4],
        "common_errors": [
            "Sign error in vector direction",
            "Unit mismatch before substitution",
            "Applying formula outside valid range",
        ],
        "next_steps": next_steps,
        "generated_by": "mock",
    }


# ── Public API ────────────────────────────────────────────────────────────────

def generate_concept_guidance(req) -> dict:
    """
    Generate personalised concept guidance for a student.
    Uses Gemini when available; falls back to structured mock.
    """
    from app.schemas.adaptive import ConceptGuidanceRequest
    r: ConceptGuidanceRequest = req

    log.info(
        "concept_guidance concept=%s subject=%s mastery=%d mistake=%s",
        r.concept_name, r.subject, r.mastery_score, r.mistake_type or "none",
    )

    # Retrieve RAG context for the concept from ChromaDB
    rag_context: list[str] = []
    try:
        from app.rag.context_builder import build_context
        ctx = build_context(
            query=f"{r.concept_name} {r.subject}",
            exam=r.student_context.exam,
            subject=r.subject,
            chapter=r.chapter,
            top_k=4,
        )
        rag_context = [c.get("content", "") for c in ctx.get("theory", [])]
    except Exception:
        pass

    # Build Gemini prompt
    mastery_lbl  = _mastery_label(r.mastery_score)
    mistake_note = _MISTAKE_COACHING.get(r.mistake_type or "", "")
    formula_block = "\n".join(f"  • {f}" for f in r.formula_context[:4]) if r.formula_context else "  (none provided)"
    rag_block     = "\n".join(f"  {c[:300]}" for c in rag_context[:3]) if rag_context else "  (no syllabus context available)"

    prompt = f"""You are an expert {r.subject} tutor for JEE/NEET exam preparation.

## Student Profile
- Concept: {r.concept_name} (chapter: {r.chapter}, subject: {r.subject})
- Mastery level: {mastery_lbl} ({r.mastery_score}%)
- Dominant mistake type: {r.mistake_type or "unknown"}
- Phase: {r.student_context.phase}
- Days to exam: {r.student_context.days_to_exam or "unknown"}

## Relevant Formulas
{formula_block}

## Knowledge Base Context
{rag_block}

## Coaching Directive
{mistake_note or "Provide balanced concept guidance."}

## Task
Write a focused, personalised concept explanation for this student (250–400 words, markdown):
1. Acknowledge their current level honestly
2. Explain the core idea of {r.concept_name} in plain language
3. Reference the most important formula(s) with brief derivation hint
4. Point out the 2–3 most common exam mistakes for this concept
5. End with 3 concrete next steps

Keep it actionable and exam-focused. No filler."""

    gemini_text = _call_gemini(prompt, max_tokens=700)

    if gemini_text:
        log.info("concept_guidance generated by Gemini len=%d", len(gemini_text))
        return {
            "guidance":      gemini_text,
            "key_formulas":  r.formula_context[:4],
            "common_errors": [],
            "next_steps":    [],
            "generated_by":  "gemini",
        }

    log.info("concept_guidance falling back to mock")
    return _mock_guidance(
        r.concept_name, r.subject, r.chapter,
        r.mastery_score, r.mistake_type, r.formula_context,
    )


def assess_concept_mastery(req) -> dict:
    """
    Deterministic mastery estimation from practice responses.
    No LLM required — pure statistics.
    """
    from app.schemas.adaptive import ConceptAssessRequest
    r: ConceptAssessRequest = req

    if not r.responses:
        return {
            "mastery_estimate": 0,
            "confidence": "low",
            "weak_areas": [],
            "recommendation": "No responses to assess.",
        }

    total    = len(r.responses)
    correct  = sum(1 for resp in r.responses if resp.is_correct)
    accuracy = correct / total

    # Weight recent answers more heavily (last 3 count 2×)
    recent = r.responses[-3:]
    recent_accuracy = sum(1 for resp in recent if resp.is_correct) / len(recent) if recent else accuracy
    weighted_accuracy = accuracy * 0.55 + recent_accuracy * 0.45

    # Solving time factor: if avg time > 90s per question, reduce estimate
    avg_time = sum(resp.solving_time_sec for resp in r.responses) / total
    time_penalty = max(0.0, min(0.15, (avg_time - 90) / 300)) if avg_time > 90 else 0.0

    mastery_estimate = max(0, min(100, round((weighted_accuracy - time_penalty) * 100)))

    confidence = "high" if total >= 8 else "medium" if total >= 5 else "low"

    weak_areas: list[str] = []
    if accuracy < 0.5:
        weak_areas.append("core concept understanding")
    if avg_time > 120:
        weak_areas.append("solving speed")
    if recent_accuracy < accuracy - 0.2:
        weak_areas.append("consistency under pressure")

    if mastery_estimate >= 75:
        recommendation = "Strong grasp. Move to harder problems or a new concept."
    elif mastery_estimate >= 55:
        recommendation = "Good foundation. Drill medium-difficulty variations to solidify."
    elif mastery_estimate >= 35:
        recommendation = "Partial understanding. Review the core concept with your mentor."
    else:
        recommendation = "Significant gaps detected. Consult the AI mentor for step-by-step guidance."

    return {
        "mastery_estimate": mastery_estimate,
        "confidence":       confidence,
        "weak_areas":       weak_areas,
        "recommendation":   recommendation,
    }
