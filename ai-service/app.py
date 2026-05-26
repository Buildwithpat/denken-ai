# Compatibility shim — the real application lives in app/main.py
# Run: uvicorn app.main:app --reload --port 8000
from app.main import app  # noqa: F401
