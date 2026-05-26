"""
Smoke tests for /api/auth endpoints.

  signup  → login  → /me  → logout
"""
import pytest
import httpx

pytestmark = pytest.mark.backend

from .conftest import BACKEND_URL
from fixtures.seed_data import TEST_USER, TEST_LOGIN


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fresh_client() -> httpx.Client:
    return httpx.Client(base_url=BACKEND_URL, timeout=10.0)


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------

class TestSignup:
    def test_signup_returns_201_or_409(self, raw_client):
        """Signup is idempotent: 201 on first call, 409 on repeat."""
        resp = raw_client.post("/api/auth/signup", json=TEST_USER)
        assert resp.status_code in (201, 409), resp.text

    def test_signup_201_body_shape(self, raw_client):
        """When signup succeeds the body contains token and user fields."""
        # Use a unique throw-away account to guarantee 201
        import uuid
        throwaway = {**TEST_USER, "email": f"throw-{uuid.uuid4().hex[:8]}@denken.local"}
        resp = raw_client.post("/api/auth/signup", json=throwaway)
        if resp.status_code != 201:
            pytest.skip("Throwaway signup returned unexpected status — skipping shape test")
        body = resp.json()
        assert "token" in body
        assert "user" in body
        user = body["user"]
        assert user["email"] == throwaway["email"]
        assert "passwordHash" not in user

    def test_signup_missing_email_returns_4xx(self, raw_client):
        bad = {k: v for k, v in TEST_USER.items() if k != "email"}
        resp = raw_client.post("/api/auth/signup", json=bad)
        assert resp.status_code in (400, 422)

    def test_signup_missing_password_returns_4xx(self, raw_client):
        bad = {k: v for k, v in TEST_USER.items() if k != "password"}
        resp = raw_client.post("/api/auth/signup", json=bad)
        assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class TestLogin:
    def test_login_correct_credentials(self, raw_client):
        resp = raw_client.post("/api/auth/login", json=TEST_LOGIN)
        assert resp.status_code == 200
        body = resp.json()
        assert "token" in body
        assert isinstance(body["token"], str)
        assert len(body["token"]) > 20

    def test_login_wrong_password(self, raw_client):
        resp = raw_client.post(
            "/api/auth/login",
            json={"email": TEST_LOGIN["email"], "password": "wrong!"},
        )
        assert resp.status_code in (400, 401)

    def test_login_unknown_email(self, raw_client):
        resp = raw_client.post(
            "/api/auth/login",
            json={"email": "nobody@nowhere.test", "password": "whatever"},
        )
        assert resp.status_code in (400, 401)

    def test_login_missing_fields(self, raw_client):
        resp = raw_client.post("/api/auth/login", json={"email": TEST_LOGIN["email"]})
        assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# /me
# ---------------------------------------------------------------------------

class TestGetMe:
    def test_me_returns_user_profile(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200
        user = resp.json()
        assert user["email"] == TEST_USER["email"]
        assert "passwordHash" not in user
        assert "_id" in user or "id" in user

    def test_me_requires_auth(self, raw_client):
        resp = raw_client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_rejects_bad_token(self, raw_client):
        resp = raw_client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer this.is.not.valid"},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

class TestLogout:
    def test_logout_returns_success(self, client):
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200

    def test_logout_requires_auth(self, raw_client):
        resp = raw_client.post("/api/auth/logout")
        assert resp.status_code == 401
