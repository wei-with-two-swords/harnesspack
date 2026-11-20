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
    assert "http://testserver/about/rules" in body
    assert "http://testserver/rankings/category/workflow" in body
    assert body.count("<url>") == 20


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
