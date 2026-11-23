from __future__ import annotations


def test_health(client):
    payload = client.get("/api/v1/health").json()
    assert payload["status"] == "ok"
    assert payload["as_of"] == "2026-11-12"
    assert payload["plugins"] == 4
    assert payload["stars"] == 48
    assert payload["days"] == 12


def test_dashboard(client):
    payload = client.get("/api/v1/dashboard").json()
    assert payload["as_of"] == "2026-11-12"
    assert payload["kpis"]["tracked"] == 4
    assert payload["top_total"][0]["slug"] == "alpha-one"


def test_rankings_pagination(client):
    payload = client.get("/api/v1/rankings/growth?window=7&limit=2&offset=0").json()
    assert payload["total"] == 4
    assert len(payload["items"]) == 2
    assert payload["items"][0]["slug"] == "alpha-one"
    page2 = client.get("/api/v1/rankings/growth?window=7&limit=2&offset=2").json()
    assert [item["slug"] for item in page2["items"]] == ["gamma-three", "delta-four"]


def test_rankings_reject_bad_input(client):
    assert client.get("/api/v1/rankings/nope").status_code == 400
    assert client.get("/api/v1/rankings/growth?window=5").status_code == 400


def test_categories_endpoint(client):
    payload = client.get("/api/v1/categories").json()
    names = [item["category"] for item in payload["items"]]
    assert "workflow" in names
    workflow = next(item for item in payload["items"] if item["category"] == "workflow")
    assert workflow["count"] == 2
    assert payload["as_of"] == "2026-11-12"


def test_rankings_category_filter(client):
    payload = client.get("/api/v1/rankings/total?category=workflow").json()
    assert payload["total"] == 2
    assert [item["slug"] for item in payload["items"]] == ["alpha-one", "delta-four"]
    assert client.get("/api/v1/rankings/total?category=nope").json()["total"] == 0


def test_plugins_search(client):
    payload = client.get("/api/v1/plugins?query=beta").json()
    assert payload["total"] == 1
    assert payload["items"][0]["slug"] == "beta-two"


def test_plugin_detail(client):
    payload = client.get("/api/v1/plugins/alpha-one").json()
    assert payload["stars"] == 210
    assert payload["rank_total"] == 1
    assert client.get("/api/v1/plugins/unknown").status_code == 404


def test_plugin_series(client):
    payload = client.get("/api/v1/plugins/alpha-one/series?days=90").json()
    assert len(payload["items"]) == 12
    assert client.get("/api/v1/plugins/unknown/series").status_code == 404


def test_compare(client):
    payload = client.get("/api/v1/compare?slugs=alpha-one,beta-two").json()
    assert len(payload["plugins"]) == 2
    assert len(payload["plugins"][0]["series"]) == 12
    assert client.get("/api/v1/compare?slugs=alpha-one").status_code == 400
    assert (
        client.get("/api/v1/compare?slugs=alpha-one,alpha-one").status_code == 400
    )
    assert client.get("/api/v1/compare?slugs=alpha-one,nope").status_code == 404


def test_sponsors_empty(client):
    payload = client.get("/api/v1/sponsors").json()
    assert payload["items"] == []
    assert payload["disclosure"] == "sponsored"


def test_robots_and_sitemap(client):
    robots = client.get("/robots.txt")
    assert robots.status_code == 200
    assert "Sitemap: http://testserver/sitemap.xml" in robots.text

    sitemap = client.get("/sitemap.xml")
    assert sitemap.status_code == 200
    assert sitemap.headers["content-type"].startswith("application/xml")
    body = sitemap.text
    assert "http://testserver/rankings/velocity" in body
    assert "http://testserver/plugins/alpha-one" in body
    assert "http://testserver/categories" in body
    assert "http://testserver/plugins" in body
    assert "http://testserver/about/data" in body
    assert "http://testserver/rankings/category/workflow" in body
    assert "http://testserver/status" in body
    assert "http://testserver/about/terms" in body
    assert "http://testserver/about/api" in body
    assert "http://testserver/rankings/quality" in body
    assert body.count("<url>") == 23


def test_spa_missing_dist_returns_404(client):
    assert client.get("/").status_code == 404


def test_plugins_sort_and_search(client):
    names = [
        item["name"]
        for item in client.get("/api/v1/plugins?sort=name&limit=10").json()["items"]
    ]
    assert names == sorted(names, key=str.lower)

    by_stars = client.get("/api/v1/plugins?sort=stars&limit=10").json()["items"]
    assert by_stars[0]["stars"] >= by_stars[-1]["stars"]

    found = client.get("/api/v1/plugins?query=alpha").json()
    assert found["total"] == 1
    assert found["items"][0]["slug"] == "alpha-one"

    assert client.get("/api/v1/plugins?sort=nonsense").status_code == 400


def test_changelog_endpoint(client):
    resp = client.get("/api/v1/changelog?limit=5")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["items"], list)


def test_openapi_and_health_fields(client):
    body = client.get("/api/v1/openapi.json").json()
    assert body["info"]["title"] == "HarnessPack API"
    health = client.get("/api/v1/health").json()
    assert "exited" in health


def test_badge_og_and_feed(client):
    badge = client.get("/badge/alpha-one.svg")
    assert badge.status_code == 200
    assert badge.headers["content-type"].startswith("image/svg+xml")
    assert "HarnessPack" in badge.text

    site_og = client.get("/og/site.png")
    assert site_og.status_code == 200
    assert site_og.headers["content-type"] == "image/png"

    og = client.get("/og/alpha-one.png")
    assert og.status_code == 200
    assert og.headers["content-type"] == "image/png"
    assert og.content[:8] == b"\x89PNG\r\n\x1a\n"

    feed = client.get("/feed.xml")
    assert feed.status_code == 200
    assert "<rss" in feed.text
    assert "<item>" in feed.text


def test_plugin_page_injects_social_meta(client_with_dist):
    response = client_with_dist.get("/plugins/alpha-one")
    assert response.status_code == 200
    html = response.text
    assert 'property="og:image"' in html
    assert "http://testserver/og/alpha-one.png" in html
    assert "<title>Alpha One" in html
    assert 'rel="canonical" href="http://testserver/plugins/alpha-one"' in html
    assert "application/ld+json" in html
    assert '"@type":"SoftwareApplication"' in html


def test_home_page_has_dataset_metadata(client_with_dist):
    html = client_with_dist.get("/").text
    assert 'rel="canonical" href="http://testserver/"' in html
    assert 'property="og:image" content="http://testserver/og/site.png"' in html
    assert 'name="twitter:card" content="summary_large_image"' in html
    assert '"@type":"Dataset"' in html


def test_board_page_has_item_list(client_with_dist):
    response = client_with_dist.get("/rankings/total")
    assert response.status_code == 200
    html = response.text
    assert "<title>总榜 · HarnessPack</title>" in html
    assert 'rel="canonical" href="http://testserver/rankings/total"' in html
    assert '"@type":"ItemList"' in html


def test_unknown_plugin_returns_404_and_noindex(client_with_dist):
    response = client_with_dist.get("/plugins/does-not-exist")
    assert response.status_code == 404
    assert 'name="robots" content="noindex,follow"' in response.text
    assert 'rel="canonical"' not in response.text


def test_compare_page_is_noindex(client_with_dist):
    response = client_with_dist.get("/compare?slugs=alpha-one,beta-two")
    assert response.status_code == 200
    assert 'name="robots" content="noindex,follow"' in response.text
    assert 'rel="canonical" href="http://testserver/compare"' in response.text


def test_status_exposes_snapshot_and_database_health(client):
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload["snapshots"]["days"] == 12
    assert payload["snapshots"]["latest"]["ok"] == 4
    assert payload["database"]["plugins"] == 4
    assert payload["database"]["active"] == 4
    assert payload["database"]["stars_rows"] == 48
    assert payload["snapshots"]["coverage"] is None or 0 <= payload["snapshots"]["coverage"] <= 1


def test_rate_limit_returns_429(tmp_path, data_dir):
    from fastapi.testclient import TestClient

    from backend.app.config import Settings
    from backend.app.main import create_app

    seed, snaps = data_dir
    settings = Settings(
        db_path=tmp_path / "rl.db",
        snapshot_dir=snaps,
        seed_path=seed,
        frontend_dist=tmp_path / "dist",
        rate_limit_per_minute=2,
        og_rate_limit_per_minute=1,
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/v1/health").status_code == 200
        assert client.get("/api/v1/dashboard").status_code == 200
        assert client.get("/api/v1/dashboard").status_code == 200
        blocked = client.get("/api/v1/dashboard")
        assert blocked.status_code == 429
        assert blocked.headers["Retry-After"].isdigit()
        assert blocked.json()["detail"] == "rate limit exceeded"
