"""
Smoke tests for health and status endpoints.
"""
import pytest

pytestmark = pytest.mark.ai_service


class TestRoot:
    def test_root_200(self, ai_client):
        resp = ai_client.get("/")
        assert resp.status_code == 200

    def test_root_status_field(self, ai_client):
        body = ai_client.get("/").json()
        assert "status" in body


class TestHealth:
    def test_health_200(self, ai_client):
        assert ai_client.get("/health").status_code == 200

    def test_health_ok(self, ai_client):
        body = ai_client.get("/health").json()
        assert body["status"] == "ok"

    def test_health_service_name(self, ai_client):
        body = ai_client.get("/health").json()
        assert "service" in body
        assert "denken" in body["service"].lower()

    def test_health_ai_provider_present(self, ai_client):
        body = ai_client.get("/health").json()
        assert "ai_provider" in body


class TestRagStatus:
    def test_status_200(self, ai_client):
        assert ai_client.get("/rag/status").status_code == 200

    def test_status_shape(self, ai_client):
        body = ai_client.get("/rag/status").json()
        for field in ("collection", "persist_dir", "total_chunks",
                      "embedding_model", "embedding_dim"):
            assert field in body

    def test_status_embedding_dim_is_int(self, ai_client):
        dim = ai_client.get("/rag/status").json()["embedding_dim"]
        assert isinstance(dim, int)
        assert dim > 0

    def test_status_total_chunks_non_negative(self, ai_client):
        total = ai_client.get("/rag/status").json()["total_chunks"]
        assert total >= 0
