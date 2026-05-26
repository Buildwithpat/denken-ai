"""
Smoke tests for RAG ingest and admin endpoints.

  /rag/ingest          — structured content map
  /admin/ingest/text   — raw text
  /admin/ingest/formulas
  /admin/ingest/maps   — batch
  /admin/validate
  /admin/stats
  /admin/chunks
  /admin/chunks/{id}
  /admin/search-debug
  /admin/quality
  DELETE /admin/chapters
"""
import pytest

pytestmark = pytest.mark.ai_service

_CHAPTER = "Test Electrostatics"
_EXAM    = "JEE_MAIN"
_SUBJECT = "Physics"


@pytest.fixture(scope="module")
def ingest_map(ai_client):
    """Ingest a small content map and return the response body."""
    cm = {
        "exam":    _EXAM,
        "subject": _SUBJECT,
        "unit":    "Electrostatics",
        "chapter": _CHAPTER,
        "source":  "textbook",
        "topics": {
            "Coulomb's Law": (
                "Coulomb's Law states that the electrostatic force between two point charges is "
                "directly proportional to the product of the charges and inversely proportional to "
                "the square of the distance between them. F = kq₁q₂/r² where k = 9×10⁹ Nm²/C²."
            ),
            "Electric Field": (
                "The electric field E at a point is defined as the force experienced by a unit "
                "positive test charge placed at that point. E = F/q₀. The SI unit is N/C or V/m."
            ),
        },
    }
    resp = ai_client.post("/rag/ingest", json=cm)
    assert resp.status_code == 200
    return resp.json()


# ---------------------------------------------------------------------------
# /rag/ingest
# ---------------------------------------------------------------------------

class TestRagIngest:
    def test_ingest_returns_200(self, ingest_map):
        pass  # fixture already asserts 200

    def test_ingest_body_shape(self, ingest_map):
        for field in ("ingested", "skipped", "collection", "errors"):
            assert field in ingest_map

    def test_ingest_creates_chunks(self, ingest_map):
        assert ingest_map["ingested"] > 0

    def test_ingest_no_errors(self, ingest_map):
        assert ingest_map["errors"] == []

    def test_ingest_missing_exam_422(self, ai_client):
        resp = ai_client.post("/rag/ingest", json={
            "subject": "Physics", "chapter": "X",
            "topics": {"A": "some text here at least forty chars long to pass validation"},
        })
        assert resp.status_code == 422

    def test_ingest_replace_flag(self, ai_client):
        cm = {
            "exam": _EXAM, "subject": _SUBJECT, "chapter": _CHAPTER,
            "source": "textbook",
            "topics": {"Coulomb's Law": "F = kq₁q₂/r² — restated for replace test."},
            "replace": True,
        }
        resp = ai_client.post("/rag/ingest", json=cm)
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# /admin/ingest/text
# ---------------------------------------------------------------------------

class TestAdminIngestText:
    def test_ingest_text_200(self, ai_client):
        resp = ai_client.post("/admin/ingest/text", json={
            "text":    "Gauss's Law relates the electric flux through a closed surface to the enclosed charge. Φ = Q_enc / ε₀.",
            "exam":    _EXAM,
            "subject": _SUBJECT,
            "chapter": _CHAPTER,
            "source":  "notes",
        })
        assert resp.status_code == 200

    def test_ingest_text_shape(self, ai_client):
        resp = ai_client.post("/admin/ingest/text", json={
            "text":    "Electric potential is the work done per unit charge to bring a test charge from infinity to a given point.",
            "exam":    _EXAM,
            "subject": _SUBJECT,
            "chapter": _CHAPTER,
        })
        body = resp.json()
        for field in ("chunks_created", "chunks_skipped", "errors", "source"):
            assert field in body


# ---------------------------------------------------------------------------
# /admin/ingest/formulas
# ---------------------------------------------------------------------------

class TestAdminIngestFormulas:
    def test_ingest_formulas_200(self, ai_client):
        resp = ai_client.post("/admin/ingest/formulas", json={
            "content": "F = kq₁q₂/r²  |  E = F/q₀  |  V = kq/r  |  W = qV",
            "exam":    _EXAM,
            "subject": _SUBJECT,
            "chapter": _CHAPTER,
        })
        assert resp.status_code == 200
        assert resp.json()["chunks_created"] > 0


# ---------------------------------------------------------------------------
# /admin/ingest/maps (batch)
# ---------------------------------------------------------------------------

class TestAdminBatchIngest:
    def test_batch_ingest_returns_200(self, ai_client):
        maps = [
            {
                "exam": _EXAM, "subject": _SUBJECT,
                "chapter": "Test Magnetism", "source": "textbook",
                "topics": {
                    "Magnetic Force": "F = qv × B — the Lorentz force on a moving charge in a magnetic field.",
                    "Biot-Savart Law": "dB = (μ₀/4π)(I dl × r̂)/r² — gives the magnetic field due to a current element.",
                },
            },
        ]
        resp = ai_client.post("/admin/ingest/maps", json={
            "content_maps": maps, "replace": True,
            "run_validation": True, "stop_on_error": False,
        })
        assert resp.status_code == 200
        body = resp.json()
        for field in ("total", "succeeded", "failed", "chunks_created", "item_results"):
            assert field in body
        assert body["succeeded"] == 1

    def test_batch_partial_failure_does_not_raise(self, ai_client):
        maps = [
            {"exam": _EXAM, "subject": _SUBJECT, "chapter": "Good",
             "source": "textbook",
             "topics": {"Topic": "Long enough content for validation to pass, more text here."}},
            {"exam": "INVALID_EXAM_XYZ"},   # should fail validation
        ]
        resp = ai_client.post("/admin/ingest/maps", json={
            "content_maps": maps, "run_validation": True, "stop_on_error": False,
        })
        assert resp.status_code == 200
        assert resp.json()["failed"] >= 1


# ---------------------------------------------------------------------------
# /admin/validate
# ---------------------------------------------------------------------------

class TestAdminValidate:
    def test_validate_valid_map(self, ai_client):
        resp = ai_client.post("/admin/validate", json={"content_maps": [{
            "exam": _EXAM, "subject": _SUBJECT, "chapter": "V",
            "topics": {"T": "Enough content for the validator to accept this map."},
        }]})
        assert resp.status_code == 200
        assert resp.json()["valid"] == 1
        assert resp.json()["invalid"] == 0

    def test_validate_invalid_map(self, ai_client):
        resp = ai_client.post("/admin/validate", json={"content_maps": [
            {"exam": "NOPE"},
        ]})
        assert resp.status_code == 200
        assert resp.json()["invalid"] >= 1


# ---------------------------------------------------------------------------
# /admin/stats
# ---------------------------------------------------------------------------

class TestAdminStats:
    def test_stats_200(self, ai_client):
        assert ai_client.get("/admin/stats").status_code == 200

    def test_stats_shape(self, ai_client):
        body = ai_client.get("/admin/stats").json()
        for field in ("total_chunks", "collection", "persist_dir"):
            assert field in body
        assert body["total_chunks"] >= 0


# ---------------------------------------------------------------------------
# /admin/chunks
# ---------------------------------------------------------------------------

class TestAdminChunks:
    def test_list_chunks_200(self, ai_client, ingest_map):
        resp = ai_client.get("/admin/chunks", params={
            "exam": _EXAM, "subject": _SUBJECT, "chapter": _CHAPTER,
        })
        assert resp.status_code == 200

    def test_list_chunks_shape(self, ai_client, ingest_map):
        body = ai_client.get("/admin/chunks", params={
            "exam": _EXAM, "subject": _SUBJECT, "chapter": _CHAPTER,
        }).json()
        for field in ("chunks", "total", "limit", "offset"):
            assert field in body
        assert isinstance(body["chunks"], list)

    def test_get_chunk_by_id(self, ai_client, ingest_map):
        chunks = ai_client.get("/admin/chunks", params={
            "exam": _EXAM, "subject": _SUBJECT, "chapter": _CHAPTER,
        }).json()["chunks"]
        if not chunks:
            pytest.skip("No chunks found for test chapter")
        chunk_id = chunks[0]["id"]
        resp = ai_client.get(f"/admin/chunks/{chunk_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == chunk_id

    def test_get_chunk_unknown_id_404(self, ai_client):
        resp = ai_client.get("/admin/chunks/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# /admin/search-debug
# ---------------------------------------------------------------------------

class TestAdminSearchDebug:
    def test_search_debug_200(self, ai_client, ingest_map):
        resp = ai_client.post("/admin/search-debug", json={
            "query":   "electric charge force",
            "exam":    _EXAM,
            "subject": _SUBJECT,
            "top_k":   3,
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "results" in body
        assert "total"   in body
        assert isinstance(body["results"], list)


# ---------------------------------------------------------------------------
# /admin/quality
# ---------------------------------------------------------------------------

class TestAdminQuality:
    def test_quality_200(self, ai_client, ingest_map):
        resp = ai_client.post("/admin/quality", json={"exam": _EXAM, "subject": _SUBJECT})
        assert resp.status_code == 200
        body = resp.json()
        for field in ("total_chunks", "by_type", "by_chapter"):
            assert field in body


# ---------------------------------------------------------------------------
# DELETE /admin/chapters  (run last so it doesn't affect other tests)
# ---------------------------------------------------------------------------

class TestAdminDeleteChapters:
    def test_delete_chapter_returns_deleted_count(self, ai_client):
        # Ingest a throw-away chapter then delete it
        ai_client.post("/rag/ingest", json={
            "exam": _EXAM, "subject": _SUBJECT, "chapter": "Delete Me",
            "topics": {"Topic": "Temporary content to be deleted during testing of the delete endpoint."},
        })
        resp = ai_client.request("DELETE", "/admin/chapters", json={
            "exam": _EXAM, "subject": _SUBJECT, "chapter": "Delete Me",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "deleted" in body
        assert body["deleted"] >= 0

    def test_delete_nonexistent_chapter_returns_zero(self, ai_client):
        resp = ai_client.request("DELETE", "/admin/chapters", json={
            "exam": _EXAM, "subject": _SUBJECT, "chapter": "Chapter That Does Not Exist",
        })
        assert resp.status_code == 200
        assert resp.json()["deleted"] == 0
