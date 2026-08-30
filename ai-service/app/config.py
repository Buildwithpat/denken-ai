from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Comma-separated or JSON array in .env:
    #   CORS_ORIGINS=http://localhost:3000,http://localhost:5000
    cors_origins: list[str] = [
        "http://localhost:3000",   # Next.js frontend
        "http://localhost:5000",   # Express backend
    ]

    # ── AI Provider ───────────────────────────────────────────────────────────
    # "mock" | "gemini" | "openrouter"
    ai_provider: str = "mock"

    # ── Gemini ────────────────────────────────────────────────────────────────
    gemini_api_key: str = ""
    gemini_model:   str = "gemini-1.5-flash"

    # ── OpenRouter ────────────────────────────────────────────────────────────
    openrouter_api_key:  str = ""
    openrouter_model:    str = "mistralai/mistral-7b-instruct"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # ── RAG / ChromaDB ────────────────────────────────────────────────────────
    chroma_persist_dir: str = "./chroma_db"
    chroma_collection:  str = "denken_notes"

    # ── Embeddings ────────────────────────────────────────────────────────────
    embedding_model: str = "all-MiniLM-L6-v2"

    # ── Redis (optional) ──────────────────────────────────────────────────────
    # Leave empty to disable Redis caching (falls back to no-cache operation).
    redis_url: str = ""

    # ── Cache TTLs (seconds) ──────────────────────────────────────────────────
    cache_ttl_mentor:      int = 1800   # 30 min — mentor/concept-guidance responses
    cache_ttl_explanation: int = 86400  # 24 h  — question explanations

    # ── Environment ───────────────────────────────────────────────────────────
    environment: str = "development"  # set to "production" on the deployed service

    # ── Internal admin/debug auth ────────────────────────────────────────────
    # Required to access /admin and /debug routes (data ingestion, deletion,
    # and pipeline internals). Must match the header sent by trusted callers.
    internal_api_key: str = ""


settings = Settings()
