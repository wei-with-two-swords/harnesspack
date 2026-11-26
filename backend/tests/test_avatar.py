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
