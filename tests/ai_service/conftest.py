"""
AI-service test fixtures.

All tests in this package run against the live FastAPI process.
The seeded_client fixture uses /admin/ingest/maps to inject deterministic
content before retrieval and quality tests execute.

Run with an isolated ChromaDB to avoid polluting development data:

  CHROMA_PERSIST_DIR=./chroma_db_test  \\
  AI_SERVICE_URL=http://localhost:8000  \\
  pytest tests/ai_service/

Long timeouts (60 s) are intentional — the first request can trigger
embedding-model download + warm-up.
"""
import os
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from fixtures.seed_data import SEED_CONTENT_MAPS

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8000")
TIMEOUT = 60.0   # embedding warm-up can be slow


# ---------------------------------------------------------------------------
# Reachability guard
# ---------------------------------------------------------------------------

def _ai_alive() -> bool:
    try:
        r = httpx.get(f"{AI_SERVICE_URL}/health", timeout=5.0)
        return r.status_code == 200
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Base client
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def ai_client() -> httpx.Client:
    """Unauthenticated httpx client pointed at the AI service."""
    if not _ai_alive():
        pytest.skip(f"AI service not reachable at {AI_SERVICE_URL}. Start it first.")
    client = httpx.Client(base_url=AI_SERVICE_URL, timeout=TIMEOUT)
    yield client
    client.close()


# ---------------------------------------------------------------------------
# Seeded client — idempotent chapter injection
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def seeded_client(ai_client: httpx.Client) -> httpx.Client:
    """
    Ensure SEED_CONTENT_MAPS are present in the running ChromaDB.

    Steps:
      1. Delete each seed chapter (no-op if it doesn't exist yet).
      2. Batch-ingest all seed maps with replace=True so the session
         starts from a known, consistent state.
    """
    for cm in SEED_CONTENT_MAPS:
        ai_client.request(
            "DELETE",
            "/admin/chapters",
            json={"exam": cm["exam"], "subject": cm["subject"], "chapter": cm["chapter"]},
        )

    resp = ai_client.post(
        "/admin/ingest/maps",
        json={
            "content_maps":   SEED_CONTENT_MAPS,
            "replace":        True,
            "run_validation": True,
            "stop_on_error":  False,
        },
    )
    assert resp.status_code == 200, (
        f"Seed ingestion failed ({resp.status_code}): {resp.text}"
    )
    body = resp.json()
    assert body["succeeded"] == len(SEED_CONTENT_MAPS), (
        f"Expected {len(SEED_CONTENT_MAPS)} successful ingests, got {body}"
    )
    return ai_client
