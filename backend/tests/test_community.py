"""Community feed: posts, comments, likes, plugin cards and rate limits."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app import auth
from backend.app.config import Settings
from backend.app.main import create_app

SECRET = "community-secret"
DIST_HTML = (
    '<!doctype html><html><head><title>HarnessPack</title>'
    '<meta name="description" content="placeholder">'
    '<meta property="og:image" content="">'
    '<meta name="twitter:card" content="summary">'
    '</head><body><div id="root"></div></body></html>'
)


def _app(tmp_path, data_dir, **overrides):
    seed, snaps = data_dir
    defaults = dict(
        db_path=tmp_path / "community.db",
        snapshot_dir=snaps,
        seed_path=seed,
        frontend_dist=tmp_path / "dist",
        session_secret=SECRET,
        api_anon_per_minute=1000,
        api_anon_per_day=1000,
        api_auth_per_minute=1000,
        api_auth_per_day=1000,
    )
    defaults.update(overrides)
    return create_app(Settings(**defaults))


def _sign_in(client: TestClient, login: str = "octocat") -> None:
    token = auth.make_session(SECRET, auth.User(login=login, name=login.title()))
    client.cookies.set(auth.SESSION_COOKIE, token)


def test_read_is_public_but_writing_requires_github(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        assert client.get("/api/community/posts").status_code == 200
        assert client.post("/api/community/posts", json={"body": "hello"}).status_code == 401

        _sign_in(client)
        created = client.post("/api/community/posts", json={"body": "hello"})
        assert created.status_code == 201
        assert created.json()["body"] == "hello"
        assert client.get("/api/community/posts").json()["total"] == 1


def test_plugin_cards_resolve_local_plugins_only(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        _sign_in(client)
        body = "看 @alpha/one 和 /plugins/beta-two，还有 @nope/missing"
        created = client.post("/api/community/posts", json={"body": body})
        assert created.status_code == 201
        slugs = [card["slug"] for card in created.json()["plugins"]]
        assert slugs == ["alpha-one", "beta-two"]

        detail = client.get(f"/api/community/posts/{created.json()['id']}")
        assert [card["slug"] for card in detail.json()["plugins"]] == slugs


def test_comments_and_likes_are_one_level_and_owned(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        _sign_in(client)
        post = client.post("/api/community/posts", json={"body": "post"}).json()

        comment = client.post(
            f"/api/community/posts/{post['id']}/comments", json={"body": "reply"}
        )
        assert comment.status_code == 201
        comment_id = comment.json()["id"]
        assert client.get(f"/api/community/posts/{post['id']}/comments").json()["total"] == 1

        like = client.post(f"/api/community/posts/{post['id']}/like")
        assert like.json() == {"liked": True, "like_count": 1}
        assert client.post(f"/api/community/posts/{post['id']}/like").json() == {
            "liked": False,
            "like_count": 0,
        }

        # A different GitHub account cannot delete someone else's content.
        _sign_in(client, "other")
        assert client.delete(f"/api/community/comments/{comment_id}").status_code == 404
        assert client.delete(f"/api/community/posts/{post['id']}").status_code == 404

        _sign_in(client)
        assert client.delete(f"/api/community/comments/{comment_id}").status_code == 200
        assert client.delete(f"/api/community/posts/{post['id']}").status_code == 200
        assert client.get(f"/api/community/posts/{post['id']}").status_code == 404


def test_post_comment_like_quotas_are_independent(tmp_path, data_dir):
    with TestClient(
        _app(
            tmp_path,
            data_dir,
            community_post_per_minute=1,
            community_post_per_day=50,
            community_comment_per_minute=1,
            community_like_per_minute=1,
        )
    ) as client:
        _sign_in(client)
        post = client.post("/api/community/posts", json={"body": "first"})
        assert post.status_code == 201
        post_id = post.json()["id"]

        blocked = client.post("/api/community/posts", json={"body": "second"})
        assert blocked.status_code == 429
        assert blocked.json()["scope"] == "community-post-minute"

        assert client.post(
            f"/api/community/posts/{post_id}/comments", json={"body": "reply"}
        ).status_code == 201
        assert client.post(f"/api/community/posts/{post_id}/like").status_code == 200

        # Deleting your own post is never throttled by the write quota.
        assert client.delete(f"/api/community/posts/{post_id}").status_code == 200


def test_foreign_origin_cannot_post(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        _sign_in(client)
        response = client.post(
            "/api/community/posts",
            json={"body": "spam"},
            headers={"Origin": "https://evil.example"},
        )
        assert response.status_code == 403


def test_empty_and_oversized_bodies_are_rejected(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        _sign_in(client)
        assert client.post("/api/community/posts", json={"body": "   "}).status_code == 422
        assert client.post(
            "/api/community/posts", json={"body": "x" * 5001}
        ).status_code == 422


def test_community_seo_meta(tmp_path, data_dir):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text(DIST_HTML, encoding="utf-8")
    with TestClient(_app(tmp_path, data_dir, frontend_dist=dist)) as client:
        _sign_in(client)
        post = client.post("/api/community/posts", json={"body": "seo body"}).json()

        html = client.get(f"/community/p/{post['id']}").text
        assert "DSH 讨论区" in html
        assert "/community/p/" in html

        profile_html = client.get("/community/u/octocat").text
        assert "noindex" in profile_html
