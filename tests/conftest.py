"""
Root conftest — loads .env and exposes base-URL constants used by both
backend and ai_service sub-packages.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env.test first (test overrides), then project root .env as fallback
_root = Path(__file__).parent.parent
load_dotenv(_root / "tests" / ".env.test", override=False)
load_dotenv(_root / ".env", override=False)

BACKEND_URL     = os.getenv("BACKEND_URL",     "http://localhost:5000")
AI_SERVICE_URL  = os.getenv("AI_SERVICE_URL",  "http://localhost:8000")
