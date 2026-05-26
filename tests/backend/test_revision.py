"""
Smoke tests for GET /api/revision.
"""
import pytest

pytestmark = pytest.mark.backend


class TestRevision:
    @pytest.fixture(autouse=True)
    def _ensure_result(self, submitted_result):
        pass

    def test_revision_returns_200(self, client):
        assert client.get("/api/revision").status_code == 200

    def test_revision_top_level_shape(self, client):
        body = client.get("/api/revision").json()
        for key in ("queue", "mistakeLog", "plan"):
            assert key in body, f"Missing key: {key}"

    def test_revision_queue_items_shape(self, client):
        queue = client.get("/api/revision").json()["queue"]
        assert isinstance(queue, list)
        for item in queue:
            for field in ("topic", "subject", "accuracy",
                          "priorityScore", "wrongCount",
                          "totalAttempted", "lastSeenAt"):
                assert field in item
            assert 0.0 <= item["priorityScore"] <= 1.0
            assert 0.0 <= item["accuracy"] <= 100.0

    def test_revision_plan_items_shape(self, client):
        plan = client.get("/api/revision").json()["plan"]
        assert isinstance(plan, list)
        for item in plan:
            for field in ("day", "topic", "subject", "duration", "mode", "priorityLabel"):
                assert field in item
            assert item["mode"]          in ("concept", "drill", "practice")
            assert item["priorityLabel"] in ("critical", "high", "medium")

    def test_revision_mistake_log_shape(self, client):
        log = client.get("/api/revision").json()["mistakeLog"]
        assert isinstance(log, list)
        for entry in log:
            for field in ("topic", "subject", "wrongCount", "lastSeen"):
                assert field in entry

    def test_revision_requires_auth(self, raw_client):
        assert raw_client.get("/api/revision").status_code == 401
