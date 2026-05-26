"""
Local embedding generation using sentence-transformers.

Default model: all-MiniLM-L6-v2
  - 22 MB on disk, 384-dimensional vectors
  - Runs entirely on CPU, ~10 ms per sentence

The model is loaded once and cached for the process lifetime via lru_cache.

Swap point: to use Gemini text embeddings instead, set
  EMBEDDING_PROVIDER=gemini in .env and implement `_embed_with_gemini()`.

  # async def _embed_with_gemini(texts: list[str]) -> list[list[float]]:
  #     import google.generativeai as genai
  #     from app.config import settings
  #     genai.configure(api_key=settings.gemini_api_key)
  #     result = genai.embed_content(
  #         model="models/text-embedding-004",
  #         content=texts,
  #         task_type="retrieval_document",
  #     )
  #     return result["embedding"]
"""
from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from app.config import settings

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=1)
def _get_model() -> "SentenceTransformer":
    from sentence_transformers import SentenceTransformer  # deferred — heavy import
    return SentenceTransformer(settings.embedding_model)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a batch of text strings.
    Returns a list of float vectors, one per input string.
    Batch size 32 balances memory and throughput on CPU.
    """
    # --- swap point ---
    # if settings.embedding_provider == "gemini":
    #     return _embed_with_gemini(texts)
    model   = _get_model()
    vectors = model.encode(texts, batch_size=32, show_progress_bar=False, normalize_embeddings=True)
    return [v.tolist() for v in vectors]


def embed_query(query: str) -> list[float]:
    """Embed a single query string. Used at retrieval time."""
    return embed_texts([query])[0]


def embedding_dim() -> int:
    """Return the vector dimension of the current model."""
    return _get_model().get_sentence_embedding_dimension()  # type: ignore[return-value]
