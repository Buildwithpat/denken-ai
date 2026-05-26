"""
Local embedding generation using sentence-transformers.

The sentence-transformers import is deferred inside _get_model() so that
importing this module costs zero RAM when the package isn't installed.

When sentence-transformers is not available (lite deployment mode):
  - embed_texts() raises RuntimeError — caught by pipeline.py's try/except
  - embed_query() raises RuntimeError — never reached because retriever
    short-circuits on collection_count() == 0
  - embedding_dim() returns 0 — used by the status endpoint only

Swap point: to use Gemini embeddings instead, implement _embed_with_gemini()
and route through it by setting EMBEDDING_PROVIDER=gemini in .env.
"""
from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from app.config import settings

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer


def _is_st_available() -> bool:
    try:
        import sentence_transformers  # noqa: F401
        return True
    except ImportError:
        return False


@lru_cache(maxsize=1)
def _get_model() -> "SentenceTransformer":
    from sentence_transformers import SentenceTransformer  # deferred — heavy import
    return SentenceTransformer(settings.embedding_model)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of text strings.
    Raises RuntimeError when sentence-transformers is not installed.
    Callers (pipeline.py) catch this via the existing except Exception block.
    """
    if not _is_st_available():
        raise RuntimeError(
            "sentence-transformers not installed — embeddings unavailable in lite mode. "
            "Install requirements.txt to enable full RAG."
        )
    model   = _get_model()
    vectors = model.encode(texts, batch_size=32, show_progress_bar=False, normalize_embeddings=True)
    return [v.tolist() for v in vectors]


def embed_query(query: str) -> list[float]:
    """Embed a single query string. Used at retrieval time."""
    return embed_texts([query])[0]


def embedding_dim() -> int:
    """
    Return the vector dimension of the current model.
    Returns 0 when sentence-transformers is not installed (safe for status endpoint).
    """
    if not _is_st_available():
        return 0
    return _get_model().get_sentence_embedding_dimension()  # type: ignore[return-value]
