"""
AI Mentor service — personalized tutoring using RAG + student context + Gemini.

Each public function:
  1. Retrieves semantically relevant chunks from ChromaDB (syllabus/formula content).
  2. Builds a student-aware system prompt using mastery scores, mistake patterns,
     roadmap phase, and today's focus (all assembled by the Express backend).
  3. Calls Gemini when configured (settings.ai_provider == "gemini").
  4. Falls back to a structured, context-enriched mock response otherwise.

The separation of concerns is deliberate:
  - Express assembles student context (MongoDB reads, analytics computation).
  - Python service handles retrieval, prompt building, and LLM generation.
  - ChromaDB holds syllabus knowledge (never personal data).
"""
from __future__ import annotations

import re
from typing import Optional

from app.config                import settings
from app.rag.context_builder   import (
    RAGContext, build_context, extract_key_points, format_for_prompt,
)
from app.schemas.mentor import (
    StudentContext, StudentMastery, StudentMistake,
    ExplainRequest, DoubtRequest, ReviseRequest,
    WhyMistakesRequest, StudyPlanRequest, ChatRequest,
    MentorResponse, StudyPlanResponse,
)


# ── Intent detection ──────────────────────────────────────────────────────────

_RE_WHY_MISTAKES  = re.compile(r"(?i)why|mistake|error|wrong|keep getting|repeatedly|pattern|keep failing")
_RE_REVISE        = re.compile(r"(?i)revis|revision|review session|study session|drill|refresh")
_RE_STUDY_PLAN    = re.compile(r"(?i)study today|study plan|schedule|mission|roadmap|what should|what to")
_RE_SEARCH        = re.compile(r"(?i)search|find formula|find notes|look for|where is")
_RE_EXPLAIN       = re.compile(r"(?i)explain|teach|concept|what is|how does|understand|tell me|describe")


def detect_intent(message: str) -> str:
    if _RE_WHY_MISTAKES.search(message): return "why-mistakes"
    if _RE_REVISE.search(message):       return "revise"
    if _RE_STUDY_PLAN.search(message):   return "study-plan"
    if _RE_SEARCH.search(message):       return "search"
    if _RE_EXPLAIN.search(message):      return "explain"
    return "doubt"


# ── Student context formatters ────────────────────────────────────────────────

def _mastery_label(score: int) -> str:
    if score < 35: return "CRITICAL"
    if score < 55: return "WEAK"
    if score < 75: return "MODERATE"
    return "STRONG"


def _build_system_prompt(ctx: StudentContext) -> str:
    """Build the personalized system prompt injected before every Gemini call."""
    lines: list[str] = [
        "You are DenkenAI — a deeply personalized AI tutor for JEE/NEET/CBSE preparation.",
        "You have full visibility into this student's preparation state.",
        "Be specific: reference their actual mastery scores, mistake patterns, and roadmap.",
        "",
        "STUDENT PROFILE:",
        f"- Exam: {ctx.exam.replace('_', ' ')}",
    ]

    if ctx.days_to_exam is not None:
        lines.append(f"- Days to exam: {ctx.days_to_exam} ({ctx.phase.replace('-', ' ').title()} phase)")
    else:
        lines.append(f"- Phase: {ctx.phase.replace('-', ' ').title()}")

    lines.append(f"- Syllabus covered: {ctx.syllabus_progress}%")

    if ctx.today_focus:
        lines.append(f"- Today's focus: {ctx.today_focus}")
    if ctx.priority_chapters:
        lines.append(f"- Priority chapters: {', '.join(ctx.priority_chapters[:5])}")

    # Mastery table (weakest first, max 8)
    if ctx.mastery:
        lines.extend(["", "TOPIC MASTERY (sorted by mastery, weakest first):"])
        sorted_m = sorted(ctx.mastery, key=lambda m: m.mastery_score)[:8]
        for m in sorted_m:
            flag = _mastery_label(m.mastery_score)
            line = (
                f"  - {m.topic} ({m.subject}): "
                f"Mastery {m.mastery_score}% | Retention {m.retention_score}% [{flag}]"
            )
            if m.recent_wrong:
                line += " ← wrong in recent tests"
            lines.append(line)

    # Mistake patterns (max 6)
    if ctx.mistakes:
        lines.extend(["", "RECURRING MISTAKE PATTERNS:"])
        for mk in ctx.mistakes[:6]:
            lines.append(
                f"  - {mk.topic} ({mk.subject}): {mk.dominant_type} mistakes "
                f"× {mk.total_mistakes} total"
                + (f", {mk.consecutive_wrong} consecutive wrong" if mk.consecutive_wrong >= 2 else "")
            )
            if mk.insight:
                lines.append(f"    → {mk.insight}")

    lines.extend([
        "",
        "TUTORING GUIDELINES:",
        "1. Reference student's specific mastery scores and mistake patterns naturally.",
        "2. For mastery < 50%: start from first principles before advanced concepts.",
        "3. For formula-type mistakes: emphasize formula derivation, not just memorization.",
        "4. For careless mistakes: highlight common sign/unit pitfalls in this topic.",
        "5. For weak-retention mistakes: briefly recap prerequisites before the main explanation.",
        "6. Always end with 2 specific, actionable next steps referencing their data.",
        "7. Use exam-level rigor — no oversimplification for JEE/NEET.",
        "8. If a KNOWLEDGE BASE CONTEXT block is provided, prioritize it for factual accuracy.",
        "9. Format response in clear markdown with ## headings.",
    ])

    return "\n".join(lines)


def _chapter_mastery(chapter: Optional[str], ctx: StudentContext) -> Optional[StudentMastery]:
    if not chapter:
        return None
    ch_lower = chapter.lower()
    return next(
        (m for m in ctx.mastery if ch_lower in m.topic.lower() or m.topic.lower() in ch_lower),
        None,
    )


def _chapter_mistake(chapter: Optional[str], ctx: StudentContext) -> Optional[StudentMistake]:
    if not chapter:
        return None
    ch_lower = chapter.lower()
    return next(
        (mk for mk in ctx.mistakes if ch_lower in mk.topic.lower() or mk.topic.lower() in ch_lower),
        None,
    )


def _related_topics(ctx: StudentContext, chapter: Optional[str]) -> list[str]:
    """Return up to 4 related topics from student's mastery/mistake data."""
    topics: list[str] = []
    for m in sorted(ctx.mastery, key=lambda x: x.mastery_score):
        if m.topic not in topics and (not chapter or m.topic.lower() != chapter.lower()):
            topics.append(m.topic)
        if len(topics) >= 4:
            break
    return topics


def _retrieve_practice_questions(
    concept_tag: str,
    subject:     Optional[str],
    exam:        str,
    top_k:       int = 3,
) -> list[str]:
    """
    Retrieve practice questions from the ChromaDB 'questions' collection
    tagged with the given concept. Returns question text snippets for
    inclusion in mentor suggestions.
    """
    try:
        from app.rag.embedder import embed_query
        from app.config       import settings
        import chromadb

        client     = chromadb.PersistentClient(path=settings.chroma_persist_dir)
        collection = client.get_collection("questions")

        where: dict = {"chunk_type": "question"}
        query_vec = embed_query(f"practice question on {concept_tag}")
        results   = collection.query(
            query_embeddings=[query_vec],
            n_results=top_k,
            where=where,
        )
        docs  = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]

        snippets: list[str] = []
        for doc, meta in zip(docs, metas):
            # Only include if concept/subject matches
            meta_concepts = meta.get("concept_tags", "") or ""
            if concept_tag.lower() in meta_concepts.lower() or not meta_concepts:
                q_text = doc[:200] if doc else ""
                if q_text:
                    snippets.append(q_text)
        return snippets[:top_k]
    except Exception:
        return []


def _suggestions(ctx: StudentContext, chapter: Optional[str]) -> list[str]:
    sugg: list[str] = []
    enc = lambda s: s.replace(" ", "%20")

    ch_mk = _chapter_mistake(chapter, ctx)
    if ch_mk and ch_mk.linked_formula_slug and ch_mk.linked_subject_slug:
        sugg.append(f"Revise formulas → /formula/{ch_mk.linked_subject_slug}/{ch_mk.linked_formula_slug}")

    if chapter:
        sugg.append(f"Take a focused test → /denkenstudio?topic={enc(chapter)}")

    if ctx.priority_chapters:
        pc = ctx.priority_chapters[0]
        if pc != chapter:
            sugg.append(f"Next priority chapter: {pc}")

    return sugg[:3]


# ── Gemini call ───────────────────────────────────────────────────────────────

def _call_gemini(prompt: str, max_tokens: int = 1024) -> str:
    """
    Call Gemini generate_content. Returns the text on success, or an empty
    string on any failure so callers can fall back to mock.
    """
    import logging
    log = logging.getLogger("mentor_service")

    try:
        import google.generativeai as genai  # deferred — not always installed
        genai.configure(api_key=settings.gemini_api_key)
        model    = genai.GenerativeModel(settings.gemini_model)
        log.info("Calling Gemini %s (max_tokens=%d, prompt_len=%d)", settings.gemini_model, max_tokens, len(prompt))
        response = model.generate_content(
            prompt,
            generation_config={"max_output_tokens": max_tokens, "temperature": 0.4},
        )
        text = response.text or ""
        if not text:
            log.warning("Gemini returned empty text (finish_reason=%s)", getattr(response, 'finish_reason', 'unknown'))
        else:
            log.info("Gemini OK — response_len=%d", len(text))
        return text
    except ImportError:
        log.error("google-generativeai not installed — install it with: pip install google-generativeai")
        return ""
    except Exception as exc:
        log.error("Gemini call failed: %s: %s", type(exc).__name__, exc)
        return ""


def _should_use_gemini() -> bool:
    return settings.ai_provider == "gemini" and bool(settings.gemini_api_key)


# ── Mock response builders ────────────────────────────────────────────────────

def _mock_explain(req: ExplainRequest, ctx: RAGContext) -> str:
    sc      = req.student_context
    chapter = req.chapter or req.question[:40]
    m       = _chapter_mastery(chapter, sc)
    mk      = _chapter_mistake(chapter, sc)

    lines: list[str] = []

    # Personalised intro
    if m:
        level = "basics" if m.mastery_score < 50 else "intermediate level" if m.mastery_score < 75 else "advanced level"
        lines.append(
            f"Your mastery in **{m.topic}** is currently **{m.mastery_score}%** "
            f"(retention: {m.retention_score}%). I'll pitch this at the {level}."
        )
        if m.retention_score < 50:
            lines.append(f"\n> ⚠️ Retention has dropped to {m.retention_score}% — schedule daily reviews.")

    # RAG theory
    if ctx.has_theory:
        lines.append(f"\n## Core Explanation\n{ctx.theory[0]}")
        if len(ctx.theory) > 1:
            lines.append(f"\n{ctx.theory[1]}")
    else:
        lines.append(
            f"\n## {chapter}\n"
            f"{chapter} is a key topic in your {sc.exam.replace('_', ' ')} preparation. "
            "The AI knowledge base for this chapter will be available once content is ingested."
        )

    # RAG formulas
    if ctx.has_formulas:
        lines.append("\n## Key Formulas\n" + "\n\n".join(ctx.formulas[:3]))
    elif req.student_context.formula_context:
        lines.append("\n## Key Formulas\n" + "\n".join(sc.formula_context[:3]))

    # Mistake-aware coaching
    if mk:
        type_advice = {
            "formula":        "Focus on deriving each formula from first principles — don't just memorize.",
            "conceptual":     "Build conceptual clarity before applying formulas.",
            "careless":       "Double-check signs, units, and direction in every step.",
            "weak-retention": "Space your reviews: study today, review in 3 days, then 7 days.",
            "time-pressure":  "Practice timed sets of 5 problems per session to build speed.",
            "repeated":       "You've made this mistake repeatedly — create a specific error log entry.",
        }
        advice = type_advice.get(mk.dominant_type, "Review your error pattern carefully.")
        lines.append(f"\n> 💡 **Your pattern**: {mk.insight or advice}")

    # Next steps
    lines.append("\n## Next Steps")
    lines.append("1. Solve 5 targeted problems on this topic right after reading this.")
    if chapter in sc.priority_chapters:
        lines.append("2. Priority chapter — aim to close this gap within 2 focused sessions.")
    else:
        lines.append("2. Take an adaptive practice test to validate your understanding.")

    return "\n".join(lines)


def _mock_why_mistakes(req: WhyMistakesRequest, ctx: RAGContext) -> str:
    sc     = req.student_context
    topic  = req.topic
    mk_list = (
        [mk for mk in sc.mistakes if topic and topic.lower() in mk.topic.lower()]
        if topic else sc.mistakes
    )

    if not mk_list:
        return (
            "I don't see persistent mistake patterns for this topic yet. "
            "Take a few more tests so I can build a clear picture of your error patterns."
        )

    lines = ["## Mistake Pattern Analysis\n"]

    dominant_types: dict[str, int] = {}
    for mk in mk_list:
        dominant_types[mk.dominant_type] = dominant_types.get(mk.dominant_type, 0) + mk.total_mistakes

    top_type = max(dominant_types, key=lambda k: dominant_types[k])

    type_explanations = {
        "formula":        "You frequently confuse or misapply formulas. This usually means you're memorizing without understanding the derivation.",
        "conceptual":     "The conceptual foundation is shaky. You might recognize the topic but struggle to map the right principle to each problem.",
        "careless":       "The mistakes are execution errors — you likely understand the concept but lose marks on signs, units, or arithmetic.",
        "weak-retention": "You learn it but forget it. Your retention decay is fast, meaning you need more spaced repetition on these topics.",
        "time-pressure":  "You rush under timed conditions. The accuracy drops when the clock is ticking — work on building speed with accuracy.",
        "repeated":       "These are persistent patterns — same mistakes across multiple tests. This needs deliberate, focused correction.",
        "guessing":       "You're marking answers without confidence. This suggests gaps in conceptual understanding or exam strategy.",
    }

    lines.append(f"**Primary pattern**: {top_type.replace('-', ' ').title()} mistakes ({dominant_types[top_type]} total)")
    lines.append(f"\n{type_explanations.get(top_type, 'Review these topics systematically.')}\n")

    lines.append("### Breakdown by Topic\n")
    for mk in sorted(mk_list, key=lambda m: m.total_mistakes, reverse=True)[:5]:
        lines.append(f"- **{mk.topic}** ({mk.subject}): {mk.total_mistakes} mistakes — {mk.dominant_type}")
        if mk.insight:
            lines.append(f"  → {mk.insight}")

    lines.extend([
        "\n### How to Fix This",
        f"1. **For {top_type} mistakes**: {type_explanations.get(top_type, '')[:80]}...",
        "2. Start each revision session by writing the formula/definition from memory before checking.",
        "3. After each wrong answer, write one sentence explaining *why* you were wrong.",
    ])

    return "\n".join(lines)


def _mock_revise(req: ReviseRequest, ctx: RAGContext) -> str:
    sc    = req.student_context
    mins  = req.session_minutes

    # Pick topics to revise: requested ones, then weakest
    topics = req.topics or [
        m.topic for m in sorted(sc.mastery, key=lambda m: m.mastery_score)[:3]
    ]
    if not topics:
        topics = sc.priority_chapters[:3] or ["your priority topics"]

    lines = [f"## {mins}-Minute Revision Session\n"]
    per_topic = max(10, mins // len(topics))

    for i, t in enumerate(topics, 1):
        m  = _chapter_mastery(t, sc)
        mk = _chapter_mistake(t, sc)
        status = f"Mastery: {m.mastery_score}%" if m else "Not yet practiced"
        lines.append(f"### Block {i}: {t} ({per_topic} min)")
        lines.append(f"Status: {status}")
        if mk:
            lines.append(f"Watch for: {mk.dominant_type} mistakes")
            if mk.insight:
                lines.append(f"> {mk.insight}")
        lines.append(f"1. Read key formulas/definitions (5 min)")
        lines.append(f"2. Solve 3 targeted problems (rest of time)")
        lines.append("")

    lines.extend([
        "### After This Session",
        "- Log any mistakes in your error journal.",
        "- Schedule a follow-up test within 48 hours to lock in the revision.",
    ])

    return "\n".join(lines)


def _mock_study_plan(req: StudyPlanRequest) -> StudyPlanResponse:
    sc    = req.student_context
    hours = req.available_hours
    mins  = int(hours * 60)

    tasks: list[dict] = []
    plan_lines: list[str] = [
        f"## Today's AI Study Plan ({mins} minutes)\n",
        f"**Phase**: {sc.phase.replace('-', ' ').title()}",
        f"**Focus**: {sc.today_focus or 'Adaptive study based on your weak areas'}\n",
        "---\n",
    ]

    # Combine priority chapters + weakest mastery topics
    candidates = list(sc.priority_chapters[:2])
    for m in sorted(sc.mastery, key=lambda m: m.mastery_score):
        if m.topic not in candidates:
            candidates.append(m.topic)
        if len(candidates) >= 4:
            break

    block_mins = mins // max(len(candidates), 1)

    for i, ch in enumerate(candidates[:3], 1):
        m  = _chapter_mastery(ch, sc)
        mk = _chapter_mistake(ch, sc)
        task_type = "mistake-drill" if mk and mk.total_mistakes >= 3 else "revise" if m and m.mastery_score < 60 else "test"
        subj = m.subject if m else sc.mastery[0].subject if sc.mastery else "Physics"

        plan_lines.append(f"### Block {i}: {ch} ({block_mins} min)")
        if m:
            plan_lines.append(f"Mastery: {m.mastery_score}% | Retention: {m.retention_score}%")
        if mk:
            plan_lines.append(f"Mistake type: {mk.dominant_type}")
        if task_type == "mistake-drill":
            plan_lines.append("→ Drill your mistakes before attempting new problems.")
        elif task_type == "revise":
            plan_lines.append("→ Review concepts + solve 5 targeted problems.")
        else:
            plan_lines.append("→ Take a focused adaptive practice test.")
        plan_lines.append("")

        tasks.append({
            "title":       f"{'Mistake drill' if task_type == 'mistake-drill' else 'Revise' if task_type == 'revise' else 'Practice test'} — {ch}",
            "subject":     subj,
            "chapter":     ch,
            "duration_min": block_mins,
            "type":        task_type,
            "href":        f"/denkenstudio?topic={ch.replace(' ', '%20')}" if task_type == "test" else f"/revision?topic={ch.replace(' ', '%20')}",
        })

    if sc.days_to_exam is not None:
        plan_lines.append(f"\n> 📅 {sc.days_to_exam} days to exam. Stay consistent — today counts.")

    return StudyPlanResponse(
        plan="\n".join(plan_lines),
        tasks=tasks,
        generated_by="mock",
        estimated_minutes=mins,
    )


# ── Public API ────────────────────────────────────────────────────────────────

def explain(req: ExplainRequest) -> MentorResponse:
    ctx = build_context(
        req.question,
        exam    = req.student_context.exam,
        subject = req.subject,
        chapter = req.chapter,
        top_k   = 6,
    )

    if _should_use_gemini():
        system_prompt = _build_system_prompt(req.student_context)
        rag_block     = format_for_prompt(ctx)
        user_msg      = f"Student question: {req.question}"
        if req.chapter:
            user_msg += f"\nChapter context: {req.chapter}"
        if req.depth != "adaptive":
            user_msg += f"\nExplanation depth requested: {req.depth}"

        # Inject formula context provided by Express
        if req.student_context.formula_context:
            rag_block = (rag_block + "\n\n=== FORMULA DATASET (trusted) ===\n" +
                         "\n".join(req.student_context.formula_context[:5]))

        full_prompt = system_prompt
        if rag_block:
            full_prompt += f"\n\nKNOWLEDGE BASE CONTEXT:\n{rag_block}"
        full_prompt += f"\n\n{user_msg}"

        answer = _call_gemini(full_prompt, max_tokens=1200)
        generated_by = "gemini" if answer else "mock"
        if not answer:
            answer = _mock_explain(req, ctx)
    else:
        answer       = _mock_explain(req, ctx)
        generated_by = "mock"

    return MentorResponse(
        answer          = answer,
        key_points      = extract_key_points(ctx, max_points=4),
        related_topics  = _related_topics(req.student_context, req.chapter),
        formula_refs    = ctx.formulas[:3],
        suggestions     = _suggestions(req.student_context, req.chapter),
        generated_by    = generated_by,
        rag_chunks_used = ctx.total_chunks,
        intent_detected = "explain",
    )


def solve_doubt(req: DoubtRequest) -> MentorResponse:
    ctx = build_context(
        req.doubt,
        exam    = req.student_context.exam,
        subject = req.subject,
        chapter = req.chapter,
        top_k   = 5,
    )

    if _should_use_gemini():
        system_prompt = _build_system_prompt(req.student_context)
        rag_block     = format_for_prompt(ctx)
        if req.student_context.formula_context:
            rag_block += "\n\n=== FORMULA DATASET ===\n" + "\n".join(req.student_context.formula_context[:4])

        full_prompt = system_prompt
        if rag_block:
            full_prompt += f"\n\nKNOWLEDGE BASE CONTEXT:\n{rag_block}"
        full_prompt += f"\n\nStudent's doubt: {req.doubt}"
        if req.chapter:
            full_prompt += f"\nChapter: {req.chapter}"

        answer       = _call_gemini(full_prompt, max_tokens=900)
        generated_by = "gemini" if answer else "mock"
        if not answer:
            # Fallback: treat as explain
            explain_req = ExplainRequest(
                question=req.doubt, chapter=req.chapter,
                subject=req.subject, student_context=req.student_context,
            )
            answer = _mock_explain(explain_req, ctx)
    else:
        explain_req = ExplainRequest(
            question=req.doubt, chapter=req.chapter,
            subject=req.subject, student_context=req.student_context,
        )
        answer       = _mock_explain(explain_req, ctx)
        generated_by = "mock"

    return MentorResponse(
        answer          = answer,
        key_points      = extract_key_points(ctx, max_points=3),
        related_topics  = _related_topics(req.student_context, req.chapter),
        formula_refs    = ctx.formulas[:2],
        suggestions     = _suggestions(req.student_context, req.chapter),
        generated_by    = generated_by,
        rag_chunks_used = ctx.total_chunks,
        intent_detected = "doubt",
    )


def why_mistakes(req: WhyMistakesRequest) -> MentorResponse:
    query = f"common mistakes in {req.topic}" if req.topic else "common student mistakes"
    ctx = build_context(
        query,
        exam    = req.student_context.exam,
        chapter = req.topic,
        top_k   = 4,
    )

    if _should_use_gemini():
        system_prompt = _build_system_prompt(req.student_context)
        mk_text = "\n".join(
            f"- {mk.topic}: {mk.dominant_type} × {mk.total_mistakes} ({mk.insight})"
            for mk in req.student_context.mistakes[:6]
        )
        full_prompt = (
            f"{system_prompt}\n\n"
            f"MISTAKE DATA:\n{mk_text}\n\n"
            f"Student's question: Why do I keep making mistakes"
            + (f" in {req.topic}?" if req.topic else "?")
            + "\nAnalyse the mistake patterns, explain the root causes, and give 3 specific correction strategies."
        )
        answer       = _call_gemini(full_prompt, max_tokens=900)
        generated_by = "gemini" if answer else "mock"
        if not answer:
            answer = _mock_why_mistakes(req, ctx)
    else:
        answer       = _mock_why_mistakes(req, ctx)
        generated_by = "mock"

    return MentorResponse(
        answer          = answer,
        key_points      = [],
        related_topics  = _related_topics(req.student_context, req.topic),
        formula_refs    = [],
        suggestions     = [
            "Take a targeted adaptive test on these topics",
            "Review mistake patterns → /revision",
        ],
        generated_by    = generated_by,
        rag_chunks_used = ctx.total_chunks,
        intent_detected = "why-mistakes",
    )


def revise(req: ReviseRequest) -> MentorResponse:
    topics_str = ", ".join(req.topics) if req.topics else "weak topics"
    ctx = build_context(
        f"revision session for {topics_str}",
        exam    = req.student_context.exam,
        subject = req.subject,
        top_k   = 5,
    )

    if _should_use_gemini():
        system_prompt = _build_system_prompt(req.student_context)
        topics_info = req.topics or [m.topic for m in sorted(req.student_context.mastery, key=lambda m: m.mastery_score)[:3]]
        full_prompt = (
            f"{system_prompt}\n\n"
            f"Generate a structured {req.session_minutes}-minute revision session for: "
            f"{', '.join(topics_info[:4])}.\n"
            f"Break it into timed blocks. Include specific formula checkpoints and problem types "
            f"matching the student's mistake patterns. End with a self-assessment checklist."
        )
        answer       = _call_gemini(full_prompt, max_tokens=1000)
        generated_by = "gemini" if answer else "mock"
        if not answer:
            answer = _mock_revise(req, ctx)
    else:
        answer       = _mock_revise(req, ctx)
        generated_by = "mock"

    return MentorResponse(
        answer          = answer,
        key_points      = extract_key_points(ctx, max_points=3),
        related_topics  = _related_topics(req.student_context, None),
        formula_refs    = ctx.formulas[:2],
        suggestions     = ["Take an adaptive test after this session → /denkenstudio"],
        generated_by    = generated_by,
        rag_chunks_used = ctx.total_chunks,
        intent_detected = "revise",
    )


def study_plan(req: StudyPlanRequest) -> StudyPlanResponse:
    if _should_use_gemini():
        system_prompt = _build_system_prompt(req.student_context)
        full_prompt = (
            f"{system_prompt}\n\n"
            f"Generate a detailed study plan for {req.available_hours} hours today.\n"
            "Return: timed blocks for each topic, what to do in each block (concept/formula/test/drill), "
            "and a motivating closing message. Use markdown. Reference the student's mastery levels."
        )
        answer = _call_gemini(full_prompt, max_tokens=800)
        if answer:
            return StudyPlanResponse(plan=answer, tasks=[], generated_by="gemini",
                                     estimated_minutes=int(req.available_hours * 60))

    return _mock_study_plan(req)


def chat(req: ChatRequest) -> MentorResponse:
    """Unified chat entry point — routes to the right handler based on intent."""
    intent = req.intent or detect_intent(req.message)

    if intent == "why-mistakes":
        return why_mistakes(WhyMistakesRequest(
            topic=req.chapter, student_context=req.student_context,
        ))
    if intent == "revise":
        return revise(ReviseRequest(
            topics=[req.chapter] if req.chapter else [],
            subject=req.subject, student_context=req.student_context,
        ))
    if intent == "study-plan":
        plan = study_plan(StudyPlanRequest(student_context=req.student_context))
        return MentorResponse(
            answer=plan.plan, suggestions=[t.get("href", "") for t in plan.tasks[:2] if t.get("href")],
            generated_by=plan.generated_by, intent_detected="study-plan",
        )
    if intent == "explain":
        return explain(ExplainRequest(
            question=req.message, chapter=req.chapter,
            subject=req.subject, student_context=req.student_context,
        ))
    # Default: doubt-solving
    return solve_doubt(DoubtRequest(
        doubt=req.message, chapter=req.chapter,
        subject=req.subject, student_context=req.student_context,
    ))
