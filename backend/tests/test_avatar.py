"""Avatar proxy: owner validation, disk cache, and upstream failure handling."""

from __future__ import annotations

import httpx
import pytest

from app.api import avatar as avatar_module


@pytest.fixture(autouse=True)
def _clear_avatar_cache():
    avatar_module._load.cache_clear()
    yield
    avatar_module._load.cache_clear()


def _fake_github(monkeypatch, calls: list[str], payload: bytes | None = None):
    def fake_get(url, **kwargs):
        calls.append(url)
        if payload is None:
            request = httpx.Request("GET", url)
            return httpx.Response(404, request=request)
        request = httpx.Request("GET", url)
        return httpx.Response(200, content=payload, request=request)

    monkeypatch.setattr(avatar_module.httpx, "get", fake_get)


def test_avatar_rejects_bad_owner(client):
    for bad in ("../etc", "a--b", "-leading", "trailing-", "x" * 50, ""):
        response = client.get(f"/api/v1/avatar/{bad}.png")
        assert response.status_code == 404


def test_avatar_proxies_and_caches(client, monkeypatch, tmp_path):
    calls: list[str] = []
    _fake_github(monkeypatch, calls, payload=b"\x89PNG\r\n\x1a\n-fake")

    first = client.get("/api/v1/avatar/octocat.png")
    assert first.status_code == 200
    assert first.headers["content-type"].startswith("image/png")
    assert "max-age=" in first.headers["cache-control"]
    assert calls == ["https://github.com/octocat.png?size=64"]

    # Second call must hit the disk cache, not the upstream.
    second = client.get("/api/v1/avatar/octocat.png")
    assert second.status_code == 200
    assert calls == ["https://github.com/octocat.png?size=64"]

    client.get("/api/v1/avatar/octocat.png?s=96")
    assert calls == [
        "https://github.com/octocat.png?size=64",
        "https://github.com/octocat.png?size=96",
    ]


def test_avatar_upstream_404_maps_to_404(client, monkeypatch):
    calls: list[str] = []
    _fake_github(monkeypatch, calls, payload=None)
    response = client.get("/api/v1/avatar/ghost-user.png")
    assert response.status_code == 404


def test_avatar_bypasses_api_daily_quota(tmp_path, data_dir, monkeypatch):
    """Avatars use their own minute bucket and never drain the JSON API quota.

    A board page loads 20+ avatars at once; before the dedicated bucket each
    one consumed the visitor's 50/day anonymous allowance and got real browsing
    rate-limited (2026-11-27 incident).
    """
    from fastapi.testclient import TestClient

    from backend.app.config import Settings
    from backend.app.main import create_app

    calls: list[str] = []
    _fake_github(monkeypatch, calls, payload=b"\x89PNG\r\n\x1a\n-fake")

    seed, snaps = data_dir
    settings = Settings(
        db_path=tmp_path / "av.db",
        snapshot_dir=snaps,
        seed_path=seed,
        frontend_dist=tmp_path / "dist",
        rate_limit_per_minute=100,
        api_anon_per_minute=5,
        api_anon_per_day=1,
    )
    with TestClient(create_app(settings)) as client:
        # An avatar hit uses the avatar bucket, leaving the 1/day JSON quota alone.
        assert client.get("/api/v1/avatar/octocat.png").status_code == 200

        # The single daily JSON request succeeds...
        assert client.get("/api/v1/status").status_code == 200
        # ...and the next one is blocked by the daily ceiling as designed...
        assert client.get("/api/v1/status").status_code == 429
        assert client.get("/api/v1/status").json()["scope"] == "anonymous-day"
        # ...while avatars keep working.
        assert client.get("/api/v1/avatar/octocat.png").status_code == 200
        assert client.get("/api/v1/avatar/another-owner.png").status_code == 200


def test_public_api_cache_headers(client):
    rankings = client.get("/api/v1/rankings/total")
    assert rankings.status_code == 200
    assert "s-maxage=60" in rankings.headers["cache-control"]

    plugins = client.get("/api/v1/plugins?limit=5")
    assert plugins.status_code == 200
    assert "s-maxage=60" in plugins.headers["cache-control"]

    # Health stays uncached so monitoring always sees live state.
    health = client.get("/api/v1/health")
    assert "cache-control" not in health.headers

    # Community/auth endpoints are user-scoped and never cacheable here.
    community = client.get("/api/community/posts")
    if community.status_code == 200:
        assert "s-maxage" not in community.headers.get("cache-control", "")
