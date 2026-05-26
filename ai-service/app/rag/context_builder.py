"""
RAG context builder — retrieves syllabus chunks, groups them by semantic
type, and formats the result for LLM prompt injection.

Public API
----------
build_context(query, *, exam, subject, chapter, top_k) -> RAGContext
format_for_prompt(ctx)                                  -> str
extract_key_points(ctx, max_points)                     -> list[str]

RAGContext is a plain dataclass; it carries four typed buckets
(theory, formulas, examples, diagram_refs) plus an is_empty flag so
callers never need to check individual lists for emptiness.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from app.rag.retriever import retrieve
from app.rag.store import collection_count

# chunk_type values that go into each bucket
_THEORY_TYPES   = {"theory", "definition", "summary"}
_FORMULA_TYPES  = {"formula"}
_EXAMPLE_TYPES  = {"example", "solved_example", "previous_year"}
_DIAGRAM_TYPES  = {"diagram"}


# ---------------------------------------------------------------------------
# Data type
# ---------------------------------------------------------------------------

@dataclass
class RAGContext:
    theory:       list[str] = field(default_factory=list)
    formulas:     list[str] = field(default_factory=list)
    examples:     list[str] = field(default_factory=list)
    diagram_refs: list[str] = field(default_factory=list)
    is_empty:     bool      = True
    total_chunks: int       = 0

    @property
    def has_theory(self)   -> bool: return bool(self.theory)
    @property
    def has_formulas(self) -> bool: return bool(self.formulas)
    @property
    def has_examples(self) -> bool: return bool(self.examples)
    @property
    def has_diagrams(self) -> bool: return bool(self.diagram_refs)


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def build_context(
    query:   str,
    *,
    exam:    Optional[str] = None,
    subject: Optional[str] = None,
    chapter: Optional[str] = None,
    top_k:   int = 8,
) -> RAGContext:
    """
    Retrieve up to top_k chunks relevant to `query`, group by type,
    and return a RAGContext.  Always safe to call — returns is_empty=True
    when the store is empty or retrieval fails, so callers need no try/except.
    """
    try:
        if collection_count() == 0:
            return RAGContext()
        results = retrieve(
            query,
            exam=exam, subject=subject, chapter=chapter,
            top_k=top_k, include_diagrams=True,
        )
    except Exception:
        return RAGContext()

    if not results:
        return RAGContext()

    ctx = RAGContext(is_empty=False, total_chunks=len(results))

    for r in results:
        ctype   = r.get("chunk_type", "theory")
        content = r["content"].strip()

        if ctype in _THEORY_TYPES:
            ctx.theory.append(content)
        elif ctype in _FORMULA_TYPES:
            ctx.formulas.append(content)
        elif ctype in _EXAMPLE_TYPES:
            ctx.examples.append(content)
        elif ctype in _DIAGRAM_TYPES:
            # prefer the dedicated description; fall back to truncated content
            desc = r.get("diagram_description") or content[:180]
            if desc:
                ctx.diagram_refs.append(desc.strip())

    ctx.theory       = _dedup(ctx.theory)
    ctx.formulas     = _dedup(ctx.formulas)
    ctx.examples     = _dedup(ctx.examples)
    ctx.diagram_refs = _dedup(ctx.diagram_refs)

    return ctx


def _dedup(items: list[str]) -> list[str]:
    """Stable deduplication using a short prefix key."""
    seen:   set[str]   = set()
    result: list[str]  = []
    for item in items:
        key = item[:80].lower()
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


# ---------------------------------------------------------------------------
# Format for LLM prompt injection
# ---------------------------------------------------------------------------

def format_for_prompt(ctx: RAGContext) -> str:
    """
    Render RAGContext into a structured, section-labelled string that can
    be injected verbatim into a Gemini / OpenRouter prompt as grounding.

    Returns an empty string when ctx.is_empty — the prompt builder should
    omit the CONTEXT block entirely in that case.

    Swap point:
      When Gemini is active, call this and pass the result as the
      {{CONTEXT}} placeholder in _build_notes_prompt() / etc.
    """
    if ctx.is_empty:
        return ""

    parts: list[str] = []

    if ctx.theory:
        parts.append("=== THEORY & DEFINITIONS ===\n" + "\n\n".join(ctx.theory))

    if ctx.formulas:
        parts.append("=== KEY FORMULAS ===\n" + "\n\n".join(ctx.formulas))

    if ctx.examples:
        parts.append("=== WORKED EXAMPLES ===\n" + "\n\n".join(ctx.examples[:2]))

    if ctx.diagram_refs:
        refs = [f"[Figure]: {d}" for d in ctx.diagram_refs]
        parts.append("=== DIAGRAM REFERENCES ===\n" + "\n".join(refs))

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# Key-point extraction (used by notes + revision enrichment)
# ---------------------------------------------------------------------------

def extract_key_points(ctx: RAGContext, max_points: int = 5) -> list[str]:
    """
    Pull concise, first-sentence extracts from theory and formula chunks.
    Returns at most max_points strings, each ≤ 120 chars.
    Used to populate NoteSection key_points and revision focus_points.
    """
    points: list[str] = []

    for block in ctx.theory + ctx.formulas:
        sentence = re.split(r"(?<=[.!?])\s+", block.strip())[0].strip()
        if 20 < len(sentence) <= 120:
            points.append(sentence)
        if len(points) >= max_points:
            break

    return points
