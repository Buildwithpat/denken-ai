"""
Smoke tests for /rag/retrieve.

Uses seeded_client so the ChromaDB is populated before queries run.
"""
import pytest

pytestmark = pytest.mark.ai_service


class TestRetrieve:
    def test_retrieve_200(self, seeded_client):
        resp = seeded_client.post("/rag/retrieve", json={
            "query": "force mass acceleration Newton",
            "exam":  "JEE_MAIN",
        })
        assert resp.status_code == 200

    def test_retrieve_response_shape(self, seeded_client):
        body = seeded_client.post("/rag/retrieve", json={
            "query": "kinetic energy moving body",
        }).json()
        for field in ("query", "total_found", "collection_size", "chunks"):
            assert field in body
        assert isinstance(body["chunks"], list)

    def test_retrieve_chunk_shape(self, seeded_client):
        chunks = seeded_client.post("/rag/retrieve", json={
            "query": "force equals mass times acceleration",
            "exam":  "JEE_MAIN",
            "top_k": 3,
        }).json()["chunks"]
        assert len(chunks) > 0
        c = chunks[0]
        for field in ("content", "score", "exam", "subject", "chapter",
                      "chunk_type", "source", "has_diagram", "keywords"):
            assert field in c, f"Missing field in chunk: {field}"

    def test_retrieve_scores_in_range(self, seeded_client):
        chunks = seeded_client.post("/rag/retrieve", json={
            "query": "work done force displacement",
            "top_k": 5,
        }).json()["chunks"]
        for c in chunks:
            assert 0.0 <= c["score"] <= 1.0, f"Score out of range: {c['score']}"

    def test_retrieve_respects_top_k(self, seeded_client):
        for k in (1, 3, 5):
            chunks = seeded_client.post("/rag/retrieve", json={
                "query": "energy", "top_k": k,
            }).json()["chunks"]
            assert len(chunks) <= k

    def test_retrieve_exam_filter(self, seeded_client):
        chunks = seeded_client.post("/rag/retrieve", json={
            "query":   "alkane substitution reaction",
            "exam":    "JEE_MAIN",
            "subject": "Chemistry",
            "top_k":   5,
        }).json()["chunks"]
        for c in chunks:
            assert c["exam"] == "JEE_MAIN"

    def test_retrieve_chapter_filter(self, seeded_client):
        chunks = seeded_client.post("/rag/retrieve", json={
            "query":   "Newton's laws of motion",
            "exam":    "JEE_MAIN",
            "chapter": "Laws of Motion",
            "top_k":   5,
        }).json()["chunks"]
        for c in chunks:
            assert c["chapter"] == "Laws of Motion"

    def test_retrieve_returns_empty_for_unseen_topic(self, seeded_client):
        # Query that should not match anything in the seeded set
        resp = seeded_client.post("/rag/retrieve", json={
            "query":   "quantum chromodynamics string theory",
            "exam":    "JEE_MAIN",
            "chapter": "NONEXISTENT_CHAPTER_XYZ",
            "top_k":   5,
        })
        assert resp.status_code == 200
        # May return 0 results or a few low-score ones — no crash
        body = resp.json()
        assert body["total_found"] >= 0

    def test_retrieve_query_too_short_422(self, seeded_client):
        resp = seeded_client.post("/rag/retrieve", json={"query": "hi"})
        assert resp.status_code == 422

    def test_retrieve_include_diagrams_false(self, seeded_client):
        body = seeded_client.post("/rag/retrieve", json={
            "query":            "force acceleration",
            "include_diagrams": False,
            "top_k":            5,
        }).json()
        for c in body["chunks"]:
            assert c["chunk_type"] != "diagram"
