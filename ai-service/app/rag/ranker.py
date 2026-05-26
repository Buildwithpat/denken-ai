"""
Re-ranking and hybrid scoring for the RAG retrieval pipeline.

Called after ChromaDB ANN search (with an over-fetched candidate set).
Returns a de-duplicated, re-scored, and trimmed list of top_k chunks.

Scoring pipeline per candidate
-------------------------------
1. Keyword hybrid   — TF-style query/chunk token overlap blended with cosine score
2. Metadata bonus   — exam / subject / chapter / topic / chunk_type match
3. Intent bonus     — formula, definition, example, PYQ, diagram signal alignment
4. Noise penalty    — penalise very short content; de-rank unintended diagram chunks
5. Dedup            — prefix-key hash + Jaccard near-duplicate suppression
6. Normalise        — min-max across candidate set → [0.05, 1.0] when spread > 0.05
7. Sort + trim      — return best top_k

Public constants OVERFETCH_FACTOR and MAX_FETCH are imported by retriever.py
to control how many candidates are fetched before re-ranking.
"""
from __future__ import annotations

import re
from typing import Optional

# ---------------------------------------------------------------------------
# Over-fetch constants (used by retriever.py)
# ---------------------------------------------------------------------------

OVERFETCH_FACTOR = 3   # fetch this many × top_k candidates from ChromaDB
MAX_FETCH        = 50  # hard cap on candidates fetched

# ---------------------------------------------------------------------------
# Hybrid score weights
# ---------------------------------------------------------------------------

W_SEMANTIC = 0.75
W_KEYWORD  = 0.25

# ---------------------------------------------------------------------------
# Metadata match bonuses (additive on top of hybrid score)
# ---------------------------------------------------------------------------
# chapter is the strongest signal — not WHERE-filtered when chapter=None
# topic is never used as a ChromaDB WHERE clause, so it always differentiates

BONUS_EXAM     = 0.04
BONUS_SUBJECT  = 0.05
BONUS_CHAPTER  = 0.10
BONUS_TOPIC    = 0.07
BONUS_TYPE     = 0.03

# ---------------------------------------------------------------------------
# Query-intent bonuses
# ---------------------------------------------------------------------------

BONUS_FORMULA_CHUNK    = 0.08
BONUS_DEFINITION_CHUNK = 0.06
BONUS_EXAMPLE_CHUNK    = 0.05
BONUS_PYQ_CHUNK        = 0.07
BONUS_DIAGRAM_CHUNK    = 0.06

# ---------------------------------------------------------------------------
# Penalties
# ---------------------------------------------------------------------------

PENALTY_SHORT           = 0.05   # content < 80 chars (not applied to formula chunks)
PENALTY_DIAGRAM_MISMATCH = 0.04  # diagram chunk when query has no visual intent

# ---------------------------------------------------------------------------
# Duplicate-suppression thresholds
# ---------------------------------------------------------------------------

_DEDUP_PREFIX_LEN          = 80
_NEAR_DUP_JACCARD_THRESHOLD = 0.82

# ---------------------------------------------------------------------------
# Stop-word list (tiny, hand-picked for speed)
# ---------------------------------------------------------------------------

_STOP = frozenset({
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
    "her", "was", "one", "our", "out", "day", "get", "has", "him", "his",
    "how", "man", "new", "now", "old", "see", "two", "way", "who", "its",
    "let", "put", "say", "she", "too", "use", "that", "this", "with",
    "from", "they", "been", "have", "will", "your", "when", "more", "very",
    "also", "after", "into", "than", "then", "some", "what", "were", "like",
    "over", "such", "each", "both", "here", "does", "just", "know", "take",
    "time", "year", "them", "well", "only", "come", "could", "there",
    "their", "about", "which", "would", "these", "other", "first", "those",
    "where", "while", "being", "every", "under",
})

# ---------------------------------------------------------------------------
# Intent-detection patterns
# ---------------------------------------------------------------------------

_RE_FORMULA = re.compile(
    r"(?i)"
    r"formula|equation|derive|derivation|expression|calculate|compute|"
    r"find\s+(?:the\s+)?(?:value|formula)|"
    r"[=+\-*/^∝∑∫∂Δαβγλμωθ]|"
    r"\b[A-Za-z]\s*=\s*[A-Za-z0-9]",
)
_RE_DEFINITION = re.compile(
    r"(?i)"
    r"what\s+is|define|definition|meaning|means|concept\s+of|"
    r"explain\s+(?:the\s+)?(?:concept|term|law|principle)|"
    r"what\s+(?:do\s+you\s+mean|are\s+the)|"
    r"state\s+(?:the\s+)?(?:law|principle|theorem)",
)
_RE_EXAMPLE = re.compile(
    r"(?i)"
    r"example|solve|find\s+(?:the\s+)?"
    r"(?:acceleration|force|energy|velocity|time|distance|mass|speed|"
    r"charge|current|voltage|pressure|temperature)|"
    r"calculate\s+the|work\s+out|determine\s+the|how\s+much|how\s+many",
)
_RE_PYQ = re.compile(
    r"(?i)jee\s+\d{4}|neet\s+\d{4}|pyq|previous.?year|past\s+paper|\b20[0-2]\d\b",
)
_RE_DIAGRAM = re.compile(
    r"(?i)diagram|figure|circuit|graph|sketch|draw|show|represent|"
    r"illustration|schematic|plot",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> frozenset[str]:
    """Lowercase alphabetic tokens ≥ 3 chars, minus stop words."""
    return frozenset(
        t for t in re.findall(r'\b[a-z]{3,}\b', text.lower())
        if t not in _STOP
    )


def _jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    """Jaccard similarity; returns 0.0 for empty sets (not NaN)."""
    if not a or not b:
        return 0.0
    union = a | b
    return len(a & b) / len(union)


def _prefix_key(content: str) -> str:
    return re.sub(r'\s+', ' ', content.strip().lower())[:_DEDUP_PREFIX_LEN]


# ---------------------------------------------------------------------------
# Query intent
# ---------------------------------------------------------------------------

class _QueryIntent:
    __slots__ = ("formula", "definition", "example", "pyq", "diagram")

    def __init__(self, query: str) -> None:
        self.formula    = bool(_RE_FORMULA.search(query))
        self.definition = bool(_RE_DEFINITION.search(query))
        self.example    = bool(_RE_EXAMPLE.search(query))
        self.pyq        = bool(_RE_PYQ.search(query))
        self.diagram    = bool(_RE_DIAGRAM.search(query))


# ---------------------------------------------------------------------------
# Per-chunk composite scorer
# ---------------------------------------------------------------------------

def _score_chunk(
    chunk:             dict,
    query_tokens:      frozenset[str],
    intent:            _QueryIntent,
    requested_exam:    Optional[str],
    requested_subject: Optional[str],
    requested_chapter: Optional[str],
    requested_topic:   Optional[str],
    requested_type:    Optional[str],
) -> float:
    semantic = float(chunk["score"])  # cosine similarity in [0, 1]

    # ── 1. Keyword overlap ────────────────────────────────────────────────────
    chunk_tokens = _tokenize(chunk.get("content", "")) | frozenset(
        kw.lower() for kw in chunk.get("keywords", [])
    )
    if query_tokens:
        keyword_score = len(query_tokens & chunk_tokens) / len(query_tokens)
    else:
        keyword_score = 0.0

    hybrid = W_SEMANTIC * semantic + W_KEYWORD * keyword_score

    # ── 2. Metadata bonuses ──────────────────────────────────────────────────
    bonus = 0.0
    if requested_exam    and chunk.get("exam")    == requested_exam:    bonus += BONUS_EXAM
    if requested_subject and chunk.get("subject") == requested_subject: bonus += BONUS_SUBJECT
    if requested_chapter and chunk.get("chapter") == requested_chapter: bonus += BONUS_CHAPTER

    if requested_topic and chunk.get("topic"):
        rt = requested_topic.lower()
        ct = chunk["topic"].lower()
        if rt in ct or ct in rt:
            bonus += BONUS_TOPIC

    if requested_type and chunk.get("chunk_type") == requested_type:    bonus += BONUS_TYPE

    # ── 3. Intent bonuses ────────────────────────────────────────────────────
    ctype = chunk.get("chunk_type", "theory")

    if intent.formula    and ctype == "formula":                            bonus += BONUS_FORMULA_CHUNK
    if intent.definition and ctype in ("definition", "theory"):             bonus += BONUS_DEFINITION_CHUNK
    if intent.example    and ctype in ("example", "solved_example"):        bonus += BONUS_EXAMPLE_CHUNK
    if intent.pyq        and ctype == "previous_year":                      bonus += BONUS_PYQ_CHUNK
    if intent.diagram    and chunk.get("has_diagram"):                      bonus += BONUS_DIAGRAM_CHUNK

    # ── 4. Penalties ─────────────────────────────────────────────────────────
    penalty = 0.0
    # Formula chunks are intentionally short (e.g. "F = ma") — exempt them
    if ctype != "formula" and len(chunk.get("content", "").strip()) < 80:
        penalty += PENALTY_SHORT
    if chunk.get("has_diagram") and not intent.diagram and not intent.formula:
        penalty += PENALTY_DIAGRAM_MISMATCH

    return hybrid + bonus - penalty


# ---------------------------------------------------------------------------
# Duplicate suppression
# ---------------------------------------------------------------------------

def _dedup(candidates: list[dict]) -> list[dict]:
    """
    Remove near-duplicate chunks.  Candidates must already be sorted by
    descending _raw_score so the first occurrence (highest scored) wins.
    """
    seen_prefixes: set[str]          = set()
    seen_tokens:   list[frozenset[str]] = []
    result: list[dict]               = []

    for c in candidates:
        prefix = _prefix_key(c.get("content", ""))

        if prefix in seen_prefixes:
            continue

        tokens = _tokenize(c.get("content", ""))
        if any(
            _jaccard(tokens, prev) >= _NEAR_DUP_JACCARD_THRESHOLD
            for prev in seen_tokens
        ):
            continue

        seen_prefixes.add(prefix)
        seen_tokens.append(tokens)
        result.append(c)

    return result


# ---------------------------------------------------------------------------
# Score normalisation
# ---------------------------------------------------------------------------

def _normalise(candidates: list[dict]) -> None:
    """
    Min-max normalise _raw_score in-place and write the result to chunk["score"].

    - Spread > 0.05  → map to [0.05, 1.0]
    - Tight cluster  → clamp to [0.0, 1.0] without stretching the range

    This ensures the published score is always in (0, 1] regardless of how
    many metadata bonuses were applied.
    """
    if not candidates:
        return

    raw = [c["_raw_score"] for c in candidates]
    mn, mx = min(raw), max(raw)
    spread = mx - mn

    for c in candidates:
        if spread > 0.05:
            normalised = (c["_raw_score"] - mn) / spread
            c["score"] = round(0.05 + 0.95 * normalised, 4)
        else:
            c["score"] = round(min(max(c["_raw_score"], 0.0), 1.0), 4)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def rerank(
    query:             str,
    candidates:        list[dict],
    top_k:             int,
    requested_exam:    Optional[str] = None,
    requested_subject: Optional[str] = None,
    requested_chapter: Optional[str] = None,
    requested_topic:   Optional[str] = None,
    requested_type:    Optional[str] = None,
) -> list[dict]:
    """
    Re-rank a list of candidate chunks and return the top_k best.

    Each candidate must be a dict with at least: "score" (raw cosine similarity),
    "content", "chunk_type", "keywords", and the standard metadata fields from
    `_chroma_to_meta_dict`.

    The "score" field is overwritten with the final normalised composite score.
    The original cosine similarity is preserved as "raw_semantic_score".

    Returns at most top_k chunk dicts.
    """
    if not candidates:
        return []

    query_tokens = _tokenize(query)
    intent       = _QueryIntent(query)

    for c in candidates:
        # Preserve original semantic score before overwriting
        c.setdefault("raw_semantic_score", c["score"])

        c["_raw_score"] = _score_chunk(
            chunk=c,
            query_tokens=query_tokens,
            intent=intent,
            requested_exam=requested_exam,
            requested_subject=requested_subject,
            requested_chapter=requested_chapter,
            requested_topic=requested_topic,
            requested_type=requested_type,
        )

    # Sort descending before dedup so highest-scored wins ties
    candidates.sort(key=lambda c: c["_raw_score"], reverse=True)

    # Remove near-duplicates
    candidates = _dedup(candidates)

    # Normalise composite scores → [0.05, 1.0]
    _normalise(candidates)

    # Clean up internal scratch field
    for c in candidates:
        del c["_raw_score"]

    return candidates[:top_k]
