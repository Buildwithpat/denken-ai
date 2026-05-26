"""
Question Intelligence Service — AI explanation generation and ChromaDB embedding.

Explanation generation: Gemini 1.5 Flash (never for question creation).
ChromaDB storage: questions indexed with chunk_type="question" for RAG retrieval.
"""
from __future__ import annotations

import json
import textwrap
from typing import Optional, Any

from app.config    import settings
from app.schemas.questions import (
    QuestionExplainRequest, QuestionExplainResponse,
    QuestionEmbedRequest, QuestionEmbedResponse,
)

# ── ChromaDB client (lazy — not imported until first embed call) ──────────────

_chroma_client: Optional[Any] = None
_embed_model:   Optional[Any] = None
_questions_collection: Optional[Any] = None


def _get_chroma():
    global _chroma_client, _questions_collection
    if _chroma_client is None:
        import chromadb  # deferred — not available in lite mode
        _chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    if _questions_collection is None:
        _questions_collection = _chroma_client.get_or_create_collection(
            name="questions",
            metadata={"hnsw:space": "cosine"},
        )
    return _questions_collection


def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer  # deferred — not available in lite mode
        _embed_model = SentenceTransformer(settings.embedding_model)
    return _embed_model


# ── Explanation generation ────────────────────────────────────────────────────

STYLE_INSTRUCTIONS: dict[str, str] = {
    "step-by-step":   "Provide a clear, numbered step-by-step solution. Show all working.",
    "beginner":       "Explain as if to a student seeing this topic for the first time. Use simple language and analogies.",
    "intermediate":   "Assume the student knows the basic concepts. Focus on the approach and key insight.",
    "advanced":       "Assume strong conceptual understanding. Cover edge cases, common exam traps, and alternative approaches.",
    "mistake-aware":  "The student got this wrong. Focus on why the common wrong approach fails and what the correct thinking is.",
    "alternative":    "Show an alternative method to solve this, different from the standard textbook approach.",
}


def _build_explanation_prompt(req: QuestionExplainRequest) -> str:
    opts_text = ""
    if req.options and req.type == "mcq":
        opts_text = "\n".join(
            f"  {chr(65 + i)}. {opt}" for i, opt in enumerate(req.options)
        )
        answer_text = f"Correct answer: {req.correct_option}"
    else:
        answer_text = f"Correct numerical answer: {req.answer}"

    mistake_note = ""
    if req.mistake_type:
        mistake_note = f"\nThis student's mistake type was: {req.mistake_type}. Address this specifically."

    style_instr = STYLE_INSTRUCTIONS.get(req.style, STYLE_INSTRUCTIONS["step-by-step"])

    return textwrap.dedent(f"""
        You are an expert {req.subject} tutor for competitive exams (JEE/NEET/CBSE).

        Question ({req.type.upper()}) from {req.subject} — {req.chapter} — {req.topic}:
        {req.question_text}
        {opts_text}
        {answer_text}

        Bloom's Level: {req.bloom_level or 'apply'}
        Learning Objective: {req.learning_objective or 'Not specified'}
        Concept Tags: {', '.join(req.concept_tags) if req.concept_tags else 'None'}
        Formula Tags: {', '.join(req.formula_tags) if req.formula_tags else 'None'}
        {mistake_note}

        Style: {style_instr}

        Respond with a JSON object (no markdown fences) with exactly these keys:
        {{
          "explanation": "<main explanation, 2–4 paragraphs in markdown>",
          "step_by_step": ["step 1", "step 2", ...],
          "key_insight": "<single most important concept this question tests>",
          "common_mistakes": ["mistake 1", "mistake 2", "mistake 3"],
          "hints_progressive": ["hint 1 (vague)", "hint 2 (moderate)", "hint 3 (near-answer)"],
          "alternative_method": "<optional alternative approach or null>",
          "formulas_used": ["formula name: equation", ...]
        }}
    """).strip()


def _mock_explanation(req: QuestionExplainRequest) -> QuestionExplainResponse:
    return QuestionExplainResponse(
        explanation=f"**{req.subject} — {req.topic}**\n\nThis question tests {req.bloom_level or 'application'} level understanding. "
                    f"The key is to apply the relevant formula correctly after identifying the given and unknown quantities.",
        step_by_step=[
            "Identify given quantities and what is asked.",
            "Select the appropriate formula or concept.",
            "Substitute values carefully (watch units).",
            "Compute the result and verify the answer makes physical sense.",
        ],
        key_insight=f"This question primarily tests {', '.join(req.concept_tags[:2]) if req.concept_tags else req.topic} understanding.",
        common_mistakes=[
            "Forgetting to convert units before substituting.",
            "Using the wrong formula due to similar-looking variables.",
            "Sign errors in vector or algebraic manipulations.",
        ],
        hints_progressive=[
            f"Think about what {req.topic} formula connects the given quantities.",
            "Write down all given values with units before solving.",
            f"The answer requires applying {req.formula_tags[0] if req.formula_tags else 'a core formula'} directly.",
        ],
        alternative_method=None,
        formulas_used=[f"{tag}: see formula sheet" for tag in req.formula_tags[:3]],
    )


async def generate_explanation(req: QuestionExplainRequest) -> QuestionExplainResponse:
    if settings.ai_provider != "gemini" or not settings.gemini_api_key:
        return _mock_explanation(req)

    try:
        import google.generativeai as genai  # type: ignore[import]
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)

        prompt = _build_explanation_prompt(req)
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        data = json.loads(text)
        return QuestionExplainResponse(**data)

    except Exception:
        return _mock_explanation(req)


# ── ChromaDB question embedding ───────────────────────────────────────────────

async def embed_question(req: QuestionEmbedRequest) -> QuestionEmbedResponse:
    try:
        collection = _get_chroma()
        model = _get_embed_model()

        doc_text = (
            f"Question: {req.question_text}\n"
            f"Subject: {req.subject}\n"
            f"Chapter: {req.chapter}\n"
            f"Topic: {req.topic}\n"
            f"Concepts: {', '.join(req.concept_tags)}\n"
            f"Formulas: {', '.join(req.formula_tags)}\n"
            f"Bloom Level: {req.bloom_level or 'apply'}\n"
            f"Difficulty: {req.difficulty}\n"
            f"Type: {req.type}"
        )

        embedding = model.encode(doc_text).tolist()

        collection.upsert(
            ids=[req.stable_id],
            embeddings=[embedding],
            documents=[doc_text],
            metadatas=[{
                "chunk_type":  "question",
                "stable_id":   req.stable_id,
                "subject":     req.subject,
                "chapter":     req.chapter,
                "topic":       req.topic,
                "bloom_level": req.bloom_level or "apply",
                "difficulty":  req.difficulty,
                "type":        req.type,
                "concept_tags": ",".join(req.concept_tags),
                "formula_tags": ",".join(req.formula_tags),
            }],
        )

        return QuestionEmbedResponse(stable_id=req.stable_id, embedded=True)

    except Exception:
        return QuestionEmbedResponse(stable_id=req.stable_id, embedded=False)


async def embed_questions_batch(reqs: list[QuestionEmbedRequest]) -> list[QuestionEmbedResponse]:
    results = []
    for req in reqs:
        results.append(await embed_question(req))
    return results
