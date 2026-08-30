from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.lib.logger import get_logger
from app.lib.timing import TimingMiddleware
from app.routers import notes, revision, performance, retrieval, admin, debug, mentor, questions, adaptive

log = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle hooks."""
    log.info("DenkenAI service starting", extra={
        "ai_provider": settings.ai_provider,
        "redis_enabled": bool(settings.redis_url),
    })

    # Warm the Redis connection pool on startup (non-blocking)
    if settings.redis_url:
        try:
            from app.lib.cache import _get_client
            await _get_client()
        except Exception as e:
            log.warning("Redis warm-up failed — continuing without cache", extra={"err": str(e)})

    yield

    # Graceful shutdown
    log.info("DenkenAI service shutting down")
    try:
        from app.lib.cache import close as close_redis
        await close_redis()
    except Exception:
        pass


def create_app() -> FastAPI:
    is_prod = settings.environment == "production"

    app = FastAPI(
        title="DenkenAI — AI Service",
        description=(
            "AI microservice powering DenkenAI's notes generation, "
            "revision planning, mentor tutoring, and adaptive practice. "
            "Set AI_PROVIDER=gemini in .env to enable Gemini."
        ),
        version="0.3.0",
        docs_url=None if is_prod else "/docs",
        redoc_url=None if is_prod else "/redoc",
        openapi_url=None if is_prod else "/openapi.json",
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(TimingMiddleware)

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(notes.router)
    app.include_router(revision.router)
    app.include_router(performance.router)
    app.include_router(retrieval.router)
    app.include_router(admin.router)
    app.include_router(debug.router)
    app.include_router(mentor.router)
    app.include_router(questions.router)
    app.include_router(adaptive.router)

    # ── Health probes ─────────────────────────────────────────────────────────

    @app.get("/", tags=["Health"], include_in_schema=False)
    def root():
        return {"status": "DenkenAI Service Online", "docs": "/docs"}

    @app.get("/health", tags=["Health"], summary="Service health check")
    async def health():
        redis_ok = False
        if settings.redis_url:
            try:
                from app.lib.cache import _get_client
                r = await _get_client()
                if r:
                    await r.ping()
                    redis_ok = True
            except Exception:
                pass

        return {
            "status":        "ok",
            "service":       "denken-ai-service",
            "version":       "0.3.0",
            "ai_provider":   settings.ai_provider,
            "redis_enabled": bool(settings.redis_url),
            "redis_ok":      redis_ok,
        }

    return app


app = create_app()
