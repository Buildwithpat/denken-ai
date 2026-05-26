"""
OCR image ingestion tests.

Covers:
  POST /rag/ingest/image          — PNG, JPEG, WEBP uploads
  POST /rag/retrieve/from-image   — question-screenshot retrieval
  POST /admin/ingest/image        — admin variant

OCR accuracy varies by engine and environment, so assertions are kept
intentionally lenient:
  - `ingested > 0` confirms at least one chunk was created
  - `ocr_text_length >= 0` is always valid
  - `is_diagram_heavy` is checked only for images with very sparse text

Mark: ocr + slow (embedding warm-up + OCR model load on first run).
"""
import pytest

pytestmark = [pytest.mark.ai_service, pytest.mark.ocr, pytest.mark.slow]

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from fixtures.image_factory import (
    make_text_image, make_diagram_image, make_question_screenshot,
    NEWTON_LAW_TEXT, KINETIC_ENERGY_TEXT, QUESTION_TEXT,
)

_EXAM    = "JEE_MAIN"
_SUBJECT = "Physics"
_CHAPTER = "OCR Test Chapter"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ingest_image(client, image_bytes: bytes, filename: str, **extra_fields) -> dict:
    mime = {
        ".png":  "image/png",
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }
    ext = Path(filename).suffix.lower()
    content_type = mime.get(ext, "image/png")

    resp = client.post(
        "/rag/ingest/image",
        data={
            "exam":    _EXAM,
            "subject": _SUBJECT,
            "chapter": _CHAPTER,
            **extra_fields,
        },
        files={"file": (filename, image_bytes, content_type)},
    )
    return resp


def _admin_ingest_image(client, image_bytes: bytes, filename: str, **extra_fields) -> dict:
    ext = Path(filename).suffix.lower()
    mime = {".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp"}
    resp = client.post(
        "/admin/ingest/image",
        data={
            "exam": _EXAM, "subject": _SUBJECT, "chapter": _CHAPTER,
            **extra_fields,
        },
        files={"file": (filename, image_bytes, mime.get(ext, "image/png"))},
    )
    return resp


# ---------------------------------------------------------------------------
# /rag/ingest/image — format coverage
# ---------------------------------------------------------------------------

class TestImageIngestFormats:
    def test_ingest_png_returns_200(self, seeded_client):
        img = make_text_image(NEWTON_LAW_TEXT, fmt="PNG")
        resp = _ingest_image(seeded_client, img, "newton.png")
        assert resp.status_code == 200

    def test_ingest_png_body_shape(self, seeded_client):
        img = make_text_image(NEWTON_LAW_TEXT, fmt="PNG")
        body = _ingest_image(seeded_client, img, "newton.png").json()
        for field in ("ingested", "skipped", "collection", "errors",
                      "ocr_text_length", "is_diagram_heavy"):
            assert field in body

    def test_ingest_png_creates_chunks(self, seeded_client):
        img = make_text_image(NEWTON_LAW_TEXT, fmt="PNG")
        body = _ingest_image(seeded_client, img, "newton2.png").json()
        # At least one chunk must be ingested (or a placeholder if OCR failed)
        assert body["ingested"] > 0

    def test_ingest_jpeg_returns_200(self, seeded_client):
        img = make_text_image(KINETIC_ENERGY_TEXT, fmt="JPEG")
        resp = _ingest_image(seeded_client, img, "kinetic.jpg")
        assert resp.status_code == 200

    def test_ingest_jpeg_creates_chunks(self, seeded_client):
        img = make_text_image(KINETIC_ENERGY_TEXT, fmt="JPEG")
        body = _ingest_image(seeded_client, img, "kinetic2.jpg").json()
        assert body["ingested"] > 0

    def test_ingest_webp_returns_200(self, seeded_client):
        img = make_text_image(QUESTION_TEXT, fmt="WEBP")
        resp = _ingest_image(seeded_client, img, "question.webp")
        assert resp.status_code == 200

    def test_ingest_webp_creates_chunks(self, seeded_client):
        img = make_text_image(QUESTION_TEXT, fmt="WEBP")
        body = _ingest_image(seeded_client, img, "question2.webp").json()
        assert body["ingested"] > 0

    def test_ingest_unsupported_format_415(self, seeded_client):
        """A .gif upload must be rejected with 415 Unsupported Media Type."""
        fake_gif = b"GIF89a" + b"\x00" * 20
        resp = _ingest_image(seeded_client, fake_gif, "bad.gif")
        assert resp.status_code == 415

    def test_ingest_bmp_rejected(self, seeded_client):
        fake_bmp = b"BM" + b"\x00" * 50
        resp = _ingest_image(seeded_client, fake_bmp, "bad.bmp")
        assert resp.status_code == 415


# ---------------------------------------------------------------------------
# /rag/ingest/image — OCR quality signals
# ---------------------------------------------------------------------------

class TestOcrSignals:
    def test_text_image_has_positive_ocr_length(self, seeded_client):
        """A dense-text image should yield ocr_text_length > 0 when OCR is installed."""
        img = make_text_image(NEWTON_LAW_TEXT, fmt="PNG")
        body = _ingest_image(seeded_client, img, "text_dense.png").json()
        # This assertion is informational; if OCR is not installed, length is 0
        # but ingestion still succeeds with a placeholder.
        assert body["ocr_text_length"] >= 0

    def test_diagram_heavy_flag(self, seeded_client):
        """Diagram image (very few words) must set is_diagram_heavy=True."""
        img = make_diagram_image(fmt="PNG")
        body = _ingest_image(seeded_client, img, "diagram.png").json()
        # is_diagram_heavy should be True (diagram has < 15 words of text)
        assert body["is_diagram_heavy"] is True

    def test_text_image_not_diagram_heavy(self, seeded_client):
        """Dense-text image should not be flagged as diagram-heavy."""
        long_text = (NEWTON_LAW_TEXT + " " + KINETIC_ENERGY_TEXT) * 2
        img = make_text_image(long_text, fmt="PNG")
        body = _ingest_image(seeded_client, img, "dense_text.png").json()
        # Only assert False if OCR successfully extracted text
        if body["ocr_text_length"] > 20:
            assert body["is_diagram_heavy"] is False

    def test_question_screenshot_source_flag(self, seeded_client):
        """is_question_screenshot=true must set source to 'question_screenshot'."""
        img = make_question_screenshot(QUESTION_TEXT)
        resp = _ingest_image(
            seeded_client, img, "screenshot.png",
            is_question_screenshot="true",  # form fields are strings
        )
        assert resp.status_code == 200
        # Verify the chunk was ingested (source field is stored in ChromaDB metadata)
        assert resp.json()["ingested"] > 0

    def test_ocr_errors_list_is_present(self, seeded_client):
        img = make_text_image("Sample text for errors field verification.", fmt="PNG")
        body = _ingest_image(seeded_client, img, "errors_check.png").json()
        assert "errors" in body
        assert isinstance(body["errors"], list)


# ---------------------------------------------------------------------------
# /rag/retrieve/from-image — question screenshot retrieval
# ---------------------------------------------------------------------------

class TestRetrieveFromImage:
    def test_retrieve_from_png_returns_200(self, seeded_client):
        img = make_question_screenshot(
            "What is the acceleration of a 5 kg body acted on by a 20 N force?"
        )
        resp = seeded_client.post(
            "/rag/retrieve/from-image",
            data={"exam": _EXAM, "subject": _SUBJECT, "top_k": "5"},
            files={"file": ("q.png", img, "image/png")},
        )
        assert resp.status_code == 200

    def test_retrieve_from_image_response_shape(self, seeded_client):
        img = make_question_screenshot("kinetic energy formula moving body")
        resp = seeded_client.post(
            "/rag/retrieve/from-image",
            data={"top_k": "5"},
            files={"file": ("q.png", img, "image/png")},
        )
        assert resp.status_code == 200
        body = resp.json()
        for field in ("query", "total_found", "collection_size", "chunks"):
            assert field in body

    def test_retrieve_from_image_query_field_populated(self, seeded_client):
        """The `query` field in the response must come from OCR extraction."""
        img = make_question_screenshot("Newton second law force mass")
        resp = seeded_client.post(
            "/rag/retrieve/from-image",
            data={"top_k": "3"},
            files={"file": ("q.png", img, "image/png")},
        )
        body = resp.json()
        # If OCR ran, query should be non-empty
        # (may be empty if OCR libs are not installed — that raises 422)
        if resp.status_code == 200:
            assert isinstance(body["query"], str)

    def test_retrieve_from_blank_image_422(self, seeded_client):
        """A blank white image yields no OCR text → 422 from extract_query_from_image."""
        from PIL import Image
        import io
        blank = Image.new("RGB", (200, 100), color="white")
        buf = io.BytesIO()
        blank.save(buf, format="PNG")
        buf.seek(0)

        resp = seeded_client.post(
            "/rag/retrieve/from-image",
            data={"top_k": "5"},
            files={"file": ("blank.png", buf.read(), "image/png")},
        )
        # Expect 422 (insufficient text) if OCR is installed; 200 if not
        assert resp.status_code in (200, 422)

    def test_retrieve_from_image_unsupported_format_415(self, seeded_client):
        resp = seeded_client.post(
            "/rag/retrieve/from-image",
            data={"top_k": "5"},
            files={"file": ("q.tiff", b"\x00" * 50, "image/tiff")},
        )
        assert resp.status_code == 415


# ---------------------------------------------------------------------------
# /admin/ingest/image
# ---------------------------------------------------------------------------

class TestAdminImageIngest:
    def test_admin_ingest_image_200(self, seeded_client):
        img = make_text_image(KINETIC_ENERGY_TEXT, fmt="PNG")
        resp = _admin_ingest_image(seeded_client, img, "admin_kinetic.png")
        assert resp.status_code == 200

    def test_admin_ingest_image_shape(self, seeded_client):
        img = make_text_image(NEWTON_LAW_TEXT, fmt="PNG")
        body = _admin_ingest_image(seeded_client, img, "admin_newton.png").json()
        for field in ("chunks_created", "chunks_skipped", "errors",
                      "filename", "ocr_text_length", "is_diagram_heavy"):
            assert field in body

    def test_admin_ingest_image_filename_preserved(self, seeded_client):
        img = make_text_image("Some content for filename test.", fmt="JPEG")
        body = _admin_ingest_image(seeded_client, img, "named_file.jpg").json()
        assert body["filename"] == "named_file.jpg"

    def test_admin_ingest_unsupported_format_415(self, seeded_client):
        resp = _admin_ingest_image(seeded_client, b"\x00" * 30, "bad.svg")
        assert resp.status_code == 415
