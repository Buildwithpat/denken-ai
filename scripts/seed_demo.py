#!/usr/bin/env python3
"""
Deterministic demo-data seeder for local development and CI.

Idempotent — safe to run multiple times.

Usage:
    python scripts/seed_demo.py

Environment variables (all optional, defaults shown):
    BACKEND_URL      = http://localhost:5000
    AI_SERVICE_URL   = http://localhost:8000

What it does:
    1. Registers the CI test user in the backend (skips if already exists).
    2. Deletes then re-ingests the seed content maps into the AI service.
    3. Runs a quick smoke check on both services.
    4. Prints a summary with credentials and stats.
"""
from __future__ import annotations

import json
import os
import sys
import textwrap
from pathlib import Path

# Allow imports from the tests/ package sibling directory
sys.path.insert(0, str(Path(__file__).parent.parent / "tests"))

try:
    import httpx
except ImportError:
    print("ERROR: httpx is not installed.  Run:  pip install httpx")
    sys.exit(1)

from fixtures.seed_data import SEED_CONTENT_MAPS, TEST_USER, TEST_LOGIN

BACKEND_URL    = os.getenv("BACKEND_URL",    "http://localhost:5000")
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8000")

# ── ANSI colours ─────────────────────────────────────────────────────────────
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
CYAN   = "\033[36m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

ok   = lambda s: f"{GREEN}✓{RESET}  {s}"
warn = lambda s: f"{YELLOW}⚠{RESET}  {s}"
err  = lambda s: f"{RED}✗{RESET}  {s}"
hdr  = lambda s: f"\n{BOLD}{CYAN}{s}{RESET}"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check(url: str, label: str) -> bool:
    try:
        r = httpx.get(url, timeout=5.0)
        if r.status_code < 500:
            print(ok(f"{label} reachable  ({url})"))
            return True
        print(err(f"{label} returned {r.status_code}"))
        return False
    except Exception as exc:
        print(err(f"{label} unreachable — {exc}"))
        return False


# ── Backend seeding ───────────────────────────────────────────────────────────

def seed_backend() -> str | None:
    """Register CI user; return JWT token or None on failure."""
    print(hdr("Backend  →  " + BACKEND_URL))

    with httpx.Client(base_url=BACKEND_URL, timeout=15.0) as c:
        # Try signup
        r = c.post("/api/auth/signup", json=TEST_USER)

        if r.status_code == 201:
            token = r.json()["token"]
            print(ok(f"Test user created:  {TEST_USER['email']}"))
            return token

        if r.status_code in (409, 400):
            # User already exists — log in
            r = c.post("/api/auth/login", json=TEST_LOGIN)
            if r.status_code == 200:
                token = r.json()["token"]
                print(warn(f"Test user already exists — logged in:  {TEST_USER['email']}"))
                return token
            print(err(f"Login failed:  {r.status_code}  {r.text}"))
            return None

        print(err(f"Signup failed:  {r.status_code}  {r.text}"))
        return None


def smoke_backend(token: str) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    with httpx.Client(base_url=BACKEND_URL, timeout=15.0, headers=headers) as c:
        r = c.get("/api/auth/me")
        if r.status_code == 200:
            print(ok("/api/auth/me  →  OK"))
        else:
            print(err(f"/api/auth/me  →  {r.status_code}"))

        r = c.get("/api/test/syllabus", params={"exam": "JEE_MAIN"})
        if r.status_code == 200:
            subs = len(r.json().get("subjects", []))
            print(ok(f"/api/test/syllabus  →  {subs} subjects loaded"))
        else:
            print(err(f"/api/test/syllabus  →  {r.status_code}"))


# ── AI service seeding ────────────────────────────────────────────────────────

def seed_ai_service() -> None:
    print(hdr("AI Service  →  " + AI_SERVICE_URL))

    with httpx.Client(base_url=AI_SERVICE_URL, timeout=90.0) as c:
        # Delete existing seed chapters first (idempotency)
        deleted_total = 0
        for cm in SEED_CONTENT_MAPS:
            r = c.request("DELETE", "/admin/chapters", json={
                "exam":    cm["exam"],
                "subject": cm["subject"],
                "chapter": cm["chapter"],
            })
            if r.status_code == 200:
                deleted_total += r.json().get("deleted", 0)
        if deleted_total:
            print(warn(f"Removed {deleted_total} stale chunks from previous seed run"))

        # Batch ingest
        print(f"  Ingesting {len(SEED_CONTENT_MAPS)} content maps "
              f"({sum(len(cm.get('topics', {})) for cm in SEED_CONTENT_MAPS)} topics)...")

        r = c.post("/admin/ingest/maps", json={
            "content_maps":   SEED_CONTENT_MAPS,
            "replace":        True,
            "run_validation": True,
            "stop_on_error":  False,
        })

        if r.status_code != 200:
            print(err(f"Batch ingest failed:  {r.status_code}  {r.text}"))
            return

        body = r.json()
        print(ok(
            f"Ingested  {body['succeeded']}/{body['total']} maps  "
            f"→  {body['chunks_created']} chunks created"
        ))
        if body["failed"]:
            print(warn(f"{body['failed']} map(s) failed:"))
            for item in body["item_results"]:
                if item["status"] != "ok":
                    print(f"      [{item['index']}] {item['label']}: {item['errors']}")

        # Verify stats
        r = c.get("/admin/stats")
        if r.status_code == 200:
            total = r.json()["total_chunks"]
            coll  = r.json()["collection"]
            print(ok(f"ChromaDB  '{coll}'  →  {total} total chunks"))


def smoke_ai_service() -> None:
    print(hdr("AI Service smoke"))
    with httpx.Client(base_url=AI_SERVICE_URL, timeout=90.0) as c:
        # Quick retrieve on each seed chapter to confirm embedding worked
        probes = [
            ("force equals mass acceleration",       "JEE_MAIN", "Physics"),
            ("saturated hydrocarbons alkane formula", "JEE_MAIN", "Chemistry"),
        ]
        for query, exam, subject in probes:
            r = c.post("/rag/retrieve", json={
                "query": query, "exam": exam, "subject": subject, "top_k": 3,
            })
            if r.status_code == 200:
                n = r.json()["total_found"]
                top = r.json()["chunks"][0]["score"] if r.json()["chunks"] else 0.0
                print(ok(f"retrieve '{query[:40]}…'  →  {n} hits  top_score={top:.3f}"))
            else:
                print(err(f"retrieve failed  {r.status_code}"))


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    print(f"{BOLD}DenkenAI Demo Seeder{RESET}")
    print("=" * 50)

    backend_ok    = _check(f"{BACKEND_URL}/api/health",    "Backend")
    ai_service_ok = _check(f"{AI_SERVICE_URL}/health", "AI Service")

    if not backend_ok and not ai_service_ok:
        print(err("Neither service is reachable.  Start them and re-run."))
        sys.exit(1)

    token: str | None = None

    if backend_ok:
        token = seed_backend()
        if token:
            smoke_backend(token)
    else:
        print(warn("Skipping backend seeding (not reachable)"))

    if ai_service_ok:
        seed_ai_service()
        smoke_ai_service()
    else:
        print(warn("Skipping AI service seeding (not reachable)"))

    print(hdr("Summary"))
    if token:
        print(f"  Test user email  :  {TEST_USER['email']}")
        print(f"  Test user pass   :  {TEST_USER['password']}")
    print(f"  Seed chapters    :  {len(SEED_CONTENT_MAPS)}")
    print(f"  Seed topics      :  {sum(len(cm.get('topics', {})) for cm in SEED_CONTENT_MAPS)}")
    print()
    print(textwrap.dedent(f"""\
      Run tests with:
        {BOLD}pytest tests/backend/{RESET}         — Express API smoke tests
        {BOLD}pytest tests/ai_service/{RESET}      — FastAPI + RAG smoke tests
        {BOLD}pytest tests/ -m quality{RESET}      — retrieval-quality eval only
        {BOLD}pytest tests/ -m 'not ocr'{RESET}    — skip OCR tests (no easyocr required)
    """))


if __name__ == "__main__":
    main()
