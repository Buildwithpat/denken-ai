"""
Smoke tests for GET /api/analytics.

The submitted_result fixture ensures the CI user has at least one graded
result in the database before these tests run.
"""
import pytest

pytestmark = pytest.mark.backend


class TestAnalytics:
    # Use submitted_result to guarantee at least one result exists first
    @pytest.fixture(autouse=True)
    def _ensure_result(self, submitted_result):
        pass

    def test_analytics_returns_200(self, client):
        resp = client.get("/api/analytics")
        assert resp.status_code == 200

    def test_analytics_top_level_shape(self, client):
        body = client.get("/api/analytics").json()
        for key in ("overview", "trends", "subjects", "weakTopics",
                    "questionTypes", "activity", "recommendations",
                    "revisionRoadmap", "lastTest"):
            assert key in body, f"Missing top-level key: {key}"

    def test_analytics_overview_fields(self, client):
        overview = client.get("/api/analytics").json()["overview"]
        for field in ("testsTaken", "avgAccuracy", "bestAccuracy", "currentStreak"):
            assert field in overview
        assert overview["testsTaken"] >= 1
        assert 0.0 <= overview["avgAccuracy"] <= 100.0
        assert 0.0 <= overview["bestAccuracy"] <= 100.0
        assert overview["currentStreak"] >= 0

    def test_analytics_trends_are_list(self, client):
        trends = client.get("/api/analytics").json()["trends"]
        assert isinstance(trends, list)
        if trends:
            item = trends[0]
            assert "accuracy" in item
            assert "date"     in item

    def test_analytics_subjects_shape(self, client):
        subjects = client.get("/api/analytics").json()["subjects"]
        assert isinstance(subjects, list)
        if subjects:
            s = subjects[0]
            for field in ("subject", "correct", "wrong", "unattempted", "accuracy", "trend"):
                assert field in s

    def test_analytics_recommendations_not_empty(self, client):
        recs = client.get("/api/analytics").json()["recommendations"]
        assert isinstance(recs, list)
        assert len(recs) >= 1
        for r in recs:
            assert "title"     in r
            assert "body"      in r
            assert "sentiment" in r
            assert r["sentiment"] in ("success", "warning", "danger")

    def test_analytics_requires_auth(self, raw_client):
        resp = raw_client.get("/api/analytics")
        assert resp.status_code == 401

    def test_analytics_last_test_not_null(self, client):
        last = client.get("/api/analytics").json()["lastTest"]
        assert last is not None
        assert "exam"     in last
        assert "accuracy" in last
        assert "date"     in last
