"""
Notes generation service.

Execution path
--------------
generate_notes(req)
  │
  ├─ build_context()  — retrieve syllabus chunks from ChromaDB (safe no-op when empty)
  │
  ├─ [swap point] if settings.ai_provider == "gemini":
  │       prompt = _build_notes_prompt(req, ctx)   ← ctx.formatted injected as grounding
  │       return _generate_with_gemini(prompt)
  │
  └─ _generate_mock(req, ctx)
       · if ctx.is_empty  → fully generic mock response (current baseline)
       · if ctx has chunks → sections/formulas/key_points derived from real RAG content
"""
from __future__ import annotations

from app.schemas.notes import NoteDepth, NoteMode, NotesRequest, NotesResponse, NoteSection
from app.rag.context_builder import RAGContext, build_context, extract_key_points, format_for_prompt


def generate_notes(req: NotesRequest) -> NotesResponse:
    # Retrieve syllabus context (empty RAGContext when store is unpopulated)
    ctx = build_context(
        req.topic,
        exam=req.exam,
        subject=req.subject,
        chapter=req.topic,   # notes req uses "topic" for the chapter name
        top_k=8,
    )

    # --- swap point ---
    # from app.config import settings
    # if settings.ai_provider == "gemini":
    #     prompt = _build_notes_prompt(req, ctx)
    #     return _generate_with_gemini(prompt)
    # if settings.ai_provider == "openrouter":
    #     prompt = _build_notes_prompt(req, ctx)
    #     return _generate_with_openrouter(prompt)

    return _generate_mock(req, ctx)


# ---------------------------------------------------------------------------
# Prompt builder (used by future Gemini / OpenRouter path)
# ---------------------------------------------------------------------------

def _build_notes_prompt(req: NotesRequest, ctx: RAGContext) -> str:
    """
    Build a structured LLM prompt.  When ctx has retrieved chunks the
    CONTEXT block grounds the model in real syllabus content.
    """
    context_block = format_for_prompt(ctx)
    context_section = (
        f"\n\n<CONTEXT>\n{context_block}\n</CONTEXT>" if context_block else ""
    )
    return (
        f"You are a precise {req.exam} exam tutor.\n"
        f"Generate {req.depth.value} {req.mode.value} notes for the topic "
        f"'{req.topic}' ({req.subject}).{context_section}\n\n"
        f"Return JSON with keys: topic, subject, depth, sections (list of "
        f"{{heading, content}}), formulas (list[str]), key_points (list[str])."
    )


# ---------------------------------------------------------------------------
# Mock provider — RAG-enriched when context is available
# ---------------------------------------------------------------------------

def _generate_mock(req: NotesRequest, ctx: RAGContext) -> NotesResponse:
    topic   = req.topic
    subject = req.subject
    depth   = req.depth
    mode    = req.mode

    sections = _build_sections(topic, subject, req.exam, depth, ctx)
    formulas = _build_formulas(topic, mode, ctx)
    key_pts  = _build_key_points(topic, subject, req.exam, depth, ctx)

    return NotesResponse(
        topic=topic,
        subject=subject,
        depth=depth.value,
        sections=sections,
        formulas=formulas,
        key_points=key_pts,
        generated_by="mock",
    )


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def _build_sections(
    topic: str, subject: str, exam: str,
    depth: NoteDepth, ctx: RAGContext,
) -> list[NoteSection]:
    """
    Build NoteSection list.
    When RAG context has theory content, real extracted text is used
    for the Introduction and Core Concepts sections.
    Generic text is used as fallback and for deeper sections.
    """
    sections: list[NoteSection] = []

    # ── Introduction ─────────────────────────────────────────────────────────
    if ctx.has_theory:
        intro_body = ctx.theory[0]
    else:
        intro_body = (
            f"{topic} is a core concept in {subject} that carries significant "
            f"weightage in {exam}. A clear understanding of its foundations "
            "unlocks many connected problem types."
        )
    sections.append(NoteSection(heading="Introduction", content=intro_body))

    # ── Core Concepts ─────────────────────────────────────────────────────────
    if len(ctx.theory) > 1:
        core_body = "\n\n".join(ctx.theory[1:3])
    else:
        core_body = (
            f"The study of {topic} rests on governing principles, definitions, "
            "and mathematical relations. Start by understanding what each variable "
            "represents physically, then learn how they interact."
        )
    sections.append(NoteSection(heading="Core Concepts", content=core_body))

    # ── Worked Examples (medium+) ─────────────────────────────────────────────
    if depth in (NoteDepth.medium, NoteDepth.detailed):
        if ctx.has_examples:
            ex_body = ctx.examples[0]
        else:
            ex_body = (
                f"When solving {topic} problems: (1) list all given quantities, "
                "(2) identify the target, (3) choose the applicable relation, "
                "(4) substitute and simplify, (5) verify units. "
                f"Most {exam} errors happen at step 3 — choose the relation carefully."
            )
        sections.append(NoteSection(heading="Worked Examples", content=ex_body))

    # ── Advanced Applications + Exam Tips (detailed only) ────────────────────
    if depth == NoteDepth.detailed:
        adv_body = (
            f"High-difficulty {exam} problems on {topic} typically combine "
            "multiple principles within a single scenario. Practice multi-step "
            f"problems that link {topic} to adjacent {subject} chapters."
        )
        sections.append(NoteSection(heading="Advanced Applications", content=adv_body))

        if ctx.has_diagrams:
            diagram_body = "Diagram reference: " + ctx.diagram_refs[0]
        else:
            diagram_body = (
                f"Frequent errors in {topic}: misapplied sign conventions, skipped "
                "unit checks, and confusing similar-looking formulae. "
                "Write each formula before substituting — it prevents careless mistakes."
            )
        sections.append(NoteSection(heading="Common Mistakes & Exam Tips", content=diagram_body))

    return sections


def _build_formulas(topic: str, mode: NoteMode, ctx: RAGContext) -> list[str]:
    if mode not in (NoteMode.formula, NoteMode.both):
        return []
    if ctx.has_formulas:
        return ctx.formulas[:5]  # cap at 5 formula chunks
    return [
        f"Primary relation for {topic}: [formula — AI will generate when live]",
        f"Derived / alternate form: [formula — AI will generate when live]",
        f"Special-case / boundary condition: [formula — AI will generate when live]",
    ]


def _build_key_points(
    topic: str, subject: str, exam: str,
    depth: NoteDepth, ctx: RAGContext,
) -> list[str]:
    rag_points = extract_key_points(ctx, max_points=3)

    generic = [
        f"{topic} falls under {subject} and commonly appears in {exam} questions.",
        "Understand the derivation — exams test conceptual depth, not formula recall alone.",
        f"Link {topic} to adjacent chapters in {subject} for faster problem recognition.",
        "Practice at least 15–20 problems of varying difficulty before the exam.",
    ]

    # Interleave RAG-derived points first, then generic fill-ins
    combined = rag_points + [g for g in generic if g not in rag_points]

    cap = {NoteDepth.short: 2, NoteDepth.medium: 4, NoteDepth.detailed: 6}
    return combined[: cap[depth]]


# ---------------------------------------------------------------------------
# Future provider stubs
# ---------------------------------------------------------------------------

# async def _generate_with_gemini(prompt: str) -> NotesResponse:
#     import google.generativeai as genai
#     from app.config import settings
#     genai.configure(api_key=settings.gemini_api_key)
#     model = genai.GenerativeModel(settings.gemini_model)
#     response = model.generate_content(prompt)
#     return _parse_gemini_notes(response.text)
