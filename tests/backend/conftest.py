"""
Backend test fixtures.

All fixtures are session-scoped because auth is expensive (bcrypt round-trips).
Tests that need the backend are automatically skipped when BACKEND_URL is
unreachable — run the server before invoking this suite.

  BACKEND_URL=http://localhost:5000 pytest tests/backend/
"""
import os
import sys
from pathlib import Path

import httpx
import pytest

# Allow `from fixtures.*` imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from fixtures.seed_data import TEST_USER, TEST_LOGIN, DEMO_GENERATE_REQUESTS

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")


# ---------------------------------------------------------------------------
# Reachability guard
# ---------------------------------------------------------------------------

def _backend_alive() -> bool:
    try:
        r = httpx.get(f"{BACKEND_URL}/api/health", timeout=3.0)
        return r.status_code < 500
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Session fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def raw_client() -> httpx.Client:
    """Unauthenticated client. Skips the whole session if backend is down."""
    if not _backend_alive():
        pytest.skip(f"Backend not reachable at {BACKEND_URL}. Start the server first.")
    client = httpx.Client(base_url=BACKEND_URL, timeout=15.0)
    yield client
    client.close()


@pytest.fixture(scope="session")
def auth_token(raw_client: httpx.Client) -> str:
    """
    Sign up the CI test user on first run; fall back to login on subsequent
    runs (user already exists → 409 conflict from the backend).
    """
    resp = raw_client.post("/api/auth/signup", json=TEST_USER)
    if resp.status_code == 201:
        return resp.json()["token"]

    # Already exists — log in
    resp = raw_client.post("/api/auth/login", json=TEST_LOGIN)
    assert resp.status_code == 200, (
        f"Could not authenticate CI user: {resp.status_code} {resp.text}"
    )
    return resp.json()["token"]


@pytest.fixture(scope="session")
def client(auth_token: str) -> httpx.Client:
    """Authenticated client — passes Bearer token on every request."""
    c = httpx.Client(
        base_url=BACKEND_URL,
        headers={"Authorization": f"Bearer {auth_token}"},
        timeout=15.0,
    )
    yield c
    c.close()


@pytest.fixture(scope="session")
def generated_test(client: httpx.Client) -> dict:
    """
    Generate a small JEE_MAIN test once per session.
    Used by test_tests.py and re-used by analytics/revision tests so there
    is at least one graded result in the database.
    """
    req = DEMO_GENERATE_REQUESTS[0]   # JEE_MAIN / Physics / 10 questions
    resp = client.post("/api/test/generate", json=req)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture(scope="session")
def submitted_result(client: httpx.Client, generated_test: dict) -> dict:
    """
    Submit a fully-answered test (all correct options chosen deterministically)
    so analytics and revision endpoints have at least one result to aggregate.
    """
    questions = generated_test["questions"]
    answers = []
    for q in questions:
        ans: dict = {"questionId": q["id"]}
        if q["type"] == "mcq":
            ans["selectedOption"] = q.get("correctOption", "A")
        else:
            ans["numericalValue"] = q.get("answer", 0)
        answers.append(ans)

    resp = client.post(
        "/api/test/submit",
        json={
            "testId":    generated_test["testId"],
            "timeTaken": 600,
            "answers":   answers,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["result"]
