"""In-site notifications: mentions, replies, likes, unread count, mark read."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app import auth

SECRET = "notif-secret"


def _app(tmp_path, data_dir, **overrides):
    from backend.app.config import Settings
    from backend.app.main import create_app

    seed, snaps = data_dir
    defaults = dict(
        db_path=tmp_path / "notif.db",
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


def test_mention_creates_notification(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        _sign_in(client, "octocat")
        client.post("/api/community/posts", json={"body": "first post"})

        _sign_in(client, "otheruser")
        created = client.post(
            "/api/community/posts",
            json={"body": "hey @octocat check @octocat again and @ghost-nobody"},
        )
        assert created.status_code == 201

        _sign_in(client, "octocat")
        unread = client.get("/api/community/notifications/unread-count").json()
        assert unread["unread"] == 1
        items = client.get("/api/community/notifications").json()
        assert items["unread"] == 1
        assert items["total"] == 1
        first = items["items"][0]
        assert first["kind"] == "mention"
        assert first["actor"]["login"] == "otheruser"
        assert "octocat" in first["excerpt"]


def test_plugin_reference_is_not_a_user_mention(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        _sign_in(client, "octocat")
        client.post("/api/community/posts", json={"body": "seed"})

        _sign_in(client, "otheruser")
        client.post(
            "/api/community/posts",
            json={"body": "try @alpha/one and `@octocat in fence`\n```\n@octocat\n```"},
        )

        _sign_in(client, "octocat")
        assert client.get("/api/community/notifications/unread-count").json()["unread"] == 0


def test_reply_and_like_notify_author(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        _sign_in(client, "octocat")
        post = client.post("/api/community/posts", json={"body": "my post"}).json()

        _sign_in(client, "otheruser")
        client.post(f"/api/community/posts/{post['id']}/comments", json={"body": "nice"})
        client.post(f"/api/community/posts/{post['id']}/like")
        # Toggle off and on again must not duplicate the like notification.
        client.post(f"/api/community/posts/{post['id']}/like")
        client.post(f"/api/community/posts/{post['id']}/like")

        _sign_in(client, "octocat")
        items = client.get("/api/community/notifications").json()
        kinds = sorted(item["kind"] for item in items["items"])
        assert kinds == ["like", "reply"]

        # Self-actions never notify.
        client.post(f"/api/community/posts/{post['id']}/comments", json={"body": "@octocat self"})
        refreshed = client.get("/api/community/notifications").json()
        assert len(refreshed["items"]) == 2


def test_mark_read_resets_counter(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        _sign_in(client, "octocat")
        post = client.post("/api/community/posts", json={"body": "mine"}).json()

        _sign_in(client, "otheruser")
        client.post(f"/api/community/posts/{post['id']}/comments", json={"body": "hi"})

        _sign_in(client, "octocat")
        assert client.get("/api/community/notifications/unread-count").json()["unread"] == 1
        assert client.post("/api/community/notifications/read").json()["updated"] == 1
        assert client.get("/api/community/notifications/unread-count").json()["unread"] == 0


def test_notification_apis_require_signin(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir)) as client:
        assert client.get("/api/community/notifications").status_code == 401
        assert client.post("/api/community/notifications/read").status_code == 401
        assert client.get("/api/community/notifications/unread-count").json() == {"unread": 0}
