"""Signed-cookie sessions and the anonymous/authenticated API quotas."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app import auth
from backend.app.config import Settings
from backend.app.main import create_app


def _app(tmp_path, data_dir, **overrides):
    seed, snaps = data_dir
    defaults = dict(
        db_path=tmp_path / "auth-limits.db",
        snapshot_dir=snaps,
        seed_path=seed,
        frontend_dist=tmp_path / "dist",
        session_secret="test-secret",
        api_anon_per_minute=10,
        api_anon_per_day=2,
        api_auth_per_minute=2,
        api_auth_per_day=100,
    )
    defaults.update(overrides)
    return create_app(Settings(**defaults))


def test_session_cookie_requires_valid_signature(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        assert client.get("/api/auth/me").status_code == 401
        client.cookies.set(auth.SESSION_COOKIE, "payload.forged")
        assert client.get("/api/auth/me").status_code == 401

        token = auth.make_session("test-secret", auth.User(login="octocat", name="The Cat"))
        client.cookies.set(auth.SESSION_COOKIE, token)
        response = client.get("/api/auth/me")
        assert response.status_code == 200
        assert response.json()["login"] == "octocat"


def test_anonymous_day_quota_and_signed_in_minute_quota(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        assert client.get("/api/v1/dashboard").status_code == 200
        assert client.get("/api/v1/dashboard").status_code == 200
        blocked = client.get("/api/v1/dashboard")
        assert blocked.status_code == 429
        assert blocked.json()["scope"] == "anonymous-day"
        assert blocked.json()["limit"] == 2
        assert blocked.headers["Retry-After"].isdigit()

        # Same IP, but a valid signed session gets the authenticated bucket.
        token = auth.make_session("test-secret", auth.User(login="octocat"))
        client.cookies.set(auth.SESSION_COOKIE, token)
        assert client.get("/api/v1/dashboard").status_code == 200
        assert client.get("/api/v1/dashboard").status_code == 200
        blocked = client.get("/api/v1/dashboard")
        assert blocked.status_code == 429
        assert blocked.json()["scope"] == "authenticated-minute"
        assert blocked.json()["limit"] == 2


def test_oauth_login_disabled_without_credentials(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        assert client.get("/api/auth/github").status_code == 503


def test_oauth_callback_clears_state_on_success(tmp_path, data_dir, monkeypatch):
    """State is single-use: a successful callback must not leave it reusable."""
    settings_app = _app(
        tmp_path,
        data_dir,
        github_client_id="client-id",
        github_client_secret="client-secret",
    )
    monkeypatch.setattr(
        auth,
        "exchange_code",
        lambda _settings, _code: auth.User(login="octocat", name="The Cat"),
    )
    with TestClient(settings_app) as client:
        client.cookies.set(auth.STATE_COOKIE, "expected-state")
        response = client.get(
            "/api/auth/github/callback",
            params={"code": "valid-code", "state": "expected-state"},
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert "/community?auth=ok" in response.headers["location"]
        # The response expires the state cookie, just like the failure path.
        cookies = response.headers.get_list("set-cookie")
        state_cookies = [c for c in cookies if c.startswith(f"{auth.STATE_COOKIE}=")]
        assert state_cookies
        assert "Max-Age=0" in state_cookies[0]
        # A signed-in session was established in the same response.
        assert any(c.startswith(f"{auth.SESSION_COOKIE}=") for c in cookies)


def test_logout_clears_session(tmp_path, data_dir):
    token = auth.make_session("test-secret", auth.User(login="octocat"))
    with TestClient(_app(tmp_path, data_dir)) as client:
        client.cookies.set(auth.SESSION_COOKIE, token)
        assert client.get("/api/auth/me").status_code == 200
        response = client.get("/api/auth/logout")
        assert response.status_code == 200
        assert "Max-Age=0" in response.headers["set-cookie"]
        # httpx' test cookie jar keeps the old value; a browser honours the
        # expiry above. Drop it here to verify the unauthenticated response.
        client.cookies.clear()
        assert client.get("/api/auth/me").status_code == 401
