"""
Heuristic diagram-aware metadata extractor.

Detects diagram references, formula blocks, and semantic chunk types
from raw text using regex patterns — no vision model required.

Swap point: when Gemini Vision / GPT-4V is available, replace
`extract_diagram_info()` with `_extract_with_vision(text, image_bytes)`.
"""
from __future__ import annotations

import re

from app.rag.models import ChunkType, DiagramInfo

# ---------------------------------------------------------------------------
# Pattern banks
# ---------------------------------------------------------------------------

_DIAGRAM_PATTERNS = [
    r"\bfig(?:ure)?\b", r"\bdiagram\b", r"\bsketch\b", r"\bdraw(?:ing)?\b",
    r"\bschematic\b", r"\brepresent(?:ation)?\b", r"\billustrat",
]
_FORMULA_PATTERNS = [
    r"\$\$",               # $$ display math
    r"\\\[",               # \[ LaTeX display math  (\\[ in raw str = regex \\\[)
    r"\\begin\{eq",        # \begin{equation}
    r"\b[A-Za-z]\s*=\s*\d",
    r"[∝∑∫∂Δαβγλμωθ]",   # common math symbols — char class avoids alternation issues
]
_DEFINITION_PATTERNS = [
    r"\bdefin(?:e|ition|ed)\b", r"\bis defined as\b", r"\bwe define\b",
    r"\bmeant by\b", r"\brefers to\b",
]
_EXAMPLE_PATTERNS = [
    r"\bexample\b", r"\billustration\b", r"\bsuppose\b", r"\bconsider\b",
]
_SOLVED_PATTERNS = [
    r"\bsolution\b", r"\bsolved\b", r"\bstep[\s-]?\d", r"\bans(?:wer)?\s*:",
]
_PYQ_PATTERNS = [
    r"\bjee\s+\d{4}\b", r"\bneet\s+\d{4}\b", r"\bpyq\b",
    r"\bprevious.?year\b", r"\bboard\s+\d{4}\b",
]

# Vocabulary sets for diagram sub-type classification
_CIRCUIT_WORDS  = {"resistor", "capacitor", "inductor", "battery", "circuit", "emf", "diode", "transistor"}
_GEOMETRIC_WORDS = {"triangle", "circle", "angle", "perpendicular", "tangent", "chord", "radius", "polygon"}
_GRAPH_WORDS    = {"axis", "slope", "intercept", "parabola", "hyperbola", "curve", "ordinate"}
_CHEMICAL_WORDS = {"reaction", "compound", "bond", "molecule", "reagent", "product", "catalyst", "isomer"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _matches_any(text: str, patterns: list[str]) -> bool:
    low = text.lower()
    return any(re.search(p, low) for p in patterns)


def _diagram_sub_type(text: str) -> str:
    words = set(text.lower().split())
    if words & _CIRCUIT_WORDS:  return "circuit"
    if words & _CHEMICAL_WORDS: return "chemical"
    if words & _GEOMETRIC_WORDS: return "geometric"
    if words & _GRAPH_WORDS:    return "graph"
    return "figure"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_diagram_info(text: str) -> DiagramInfo:
    """Detect whether text references a diagram and classify its type."""
    if not _matches_any(text, _DIAGRAM_PATTERNS):
        return DiagramInfo(has_diagram=False)

    dtype = _diagram_sub_type(text)
    # Grab the first sentence that contains the diagram keyword as description
    sentences = re.split(r"(?<=[.!?])\s+", text)
    desc = next(
        (s.strip() for s in sentences if _matches_any(s, _DIAGRAM_PATTERNS)),
        "",
    )[:200]
    return DiagramInfo(has_diagram=True, diagram_type=dtype, description=desc or None)


def infer_chunk_type(text: str) -> ChunkType:
    """Rule-based chunk-type classifier (order matters — most specific first)."""
    if _matches_any(text, _PYQ_PATTERNS):     return ChunkType.previous_year
    if _matches_any(text, _SOLVED_PATTERNS):  return ChunkType.solved_example
    if _matches_any(text, _FORMULA_PATTERNS): return ChunkType.formula
    if _matches_any(text, _DEFINITION_PATTERNS): return ChunkType.definition
    if _matches_any(text, _EXAMPLE_PATTERNS): return ChunkType.example
    if _matches_any(text, _DIAGRAM_PATTERNS): return ChunkType.diagram
    return ChunkType.theory


def extract_keywords(text: str, max_kw: int = 10) -> list[str]:
    """
    Extract significant content words as lightweight keywords.
    Prefers CamelCase or title-cased tokens (proper nouns, named laws).
    """
    _STOP = {
        "this", "that", "with", "from", "into", "when", "then", "they",
        "them", "their", "have", "been", "will", "which", "each", "some",
        "more", "than", "also", "under", "such", "about", "where", "while",
        "these", "those", "other", "after", "before", "between", "both",
    }
    words = re.findall(r"\b[A-Za-z][a-z]{3,}\b", text)
    seen: set[str] = set()
    result: list[str] = []
    for w in words:
        lw = w.lower()
        if lw not in _STOP and lw not in seen:
            seen.add(lw)
            result.append(lw)
        if len(result) >= max_kw:
            break
    return result
