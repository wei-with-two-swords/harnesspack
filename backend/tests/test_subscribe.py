"""Email digest subscriptions: opt-in, confirm, unsubscribe, idempotent send."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.app import auth
from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.services import digest as digest_service
from backend.app.services import subscribers as subscribers_service

SECRET = "sub-secret"


def _app(tmp_path, data_dir, **overrides):
    seed, snaps = data_dir
    defaults = dict(
        db_path=tmp_path / "sub.db",
        snapshot_dir=snaps,
        seed_path=seed,
        frontend_dist=tmp_path / "dist",
        session_secret=SECRET,
        smtp_host="smtp.test",
        smtp_user="noreply@test",
        smtp_password="secret",
        smtp_from="noreply@test",
        base_url="http://testserver",
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


def test_subscribe_requires_smtp(tmp_path, data_dir):
    with TestClient(_app(tmp_path, data_dir, smtp_host="")) as client:
        response = client.post("/api/subscribe", json={"email": "reader@example.com"})
        assert response.status_code == 502


def test_subscribe_confirm_unsubscribe_flow(tmp_path, data_dir, monkeypatch):
    captured: list = []
    monkeypatch.setattr(
        subscribers_service.mailer,
        "send_mail",
        lambda settings, to, subject, text, html=None: captured.append((to, subject)) or 1,
    )
    with TestClient(_app(tmp_path, data_dir)) as client:
        bad = client.post("/api/subscribe", json={"email": "not-an-email"})
        assert bad.status_code == 422

        first = client.post("/api/subscribe", json={"email": "Reader@Example.com"})
        assert first.status_code == 201
        assert first.json()["status"] == "subscribed"
        assert len(captured) == 1

        # Duplicate subscribe re-sends the confirmation mail (lost-mail rescue).
        again = client.post("/api/subscribe", json={"email": "reader@example.com"})
        assert again.json()["status"] == "resubscribed"
        assert len(captured) == 2

        token = _token_for(client, "reader@example.com")

        confirmed = client.get(f"/api/subscribe/confirm?token={token}", follow_redirects=False)
        assert confirmed.status_code == 307
        assert "/subscribe?status=confirmed" in confirmed.headers["location"]

        unsub = client.get(f"/api/subscribe/unsubscribe?token={token}", follow_redirects=False)
        assert unsub.status_code == 307
        assert "/subscribe?status=unsubscribed" in unsub.headers["location"]

        # Unsubscribed rows are out of the mailing list.
        from backend.app.db import connect as _connect

        db_conn = _connect(client.app.state.settings.db_path)
        try:
            assert subscribers_service.active_emails(db_conn) == []
        finally:
            db_conn.close()


def _token_for(client: TestClient, email: str) -> str:
    from backend.app.db import connect as _connect

    conn = _connect(client.app.state.settings.db_path)
    try:
        row = conn.execute(
            "SELECT token FROM subscribers WHERE email = ?", (email,)
        ).fetchone()
        return row["token"]
    finally:
        conn.close()


def test_digest_send_is_idempotent(tmp_path, data_dir, monkeypatch):
    monkeypatch.setattr(
        subscribers_service.mailer,
        "send_mail",
        lambda settings, to, subject, text, html=None: 1,
    )
    sent_messages: list[int] = []
    monkeypatch.setattr(
        digest_service.mailer,
        "_send",
        lambda settings, messages: sent_messages.append(len(messages)) or len(messages),
    )
    with TestClient(_app(tmp_path, data_dir)) as client:
        assert client.post("/api/subscribe", json={"email": "reader@example.com"}).status_code == 201

        conn_settings = client.app.state.settings
        from backend.app.db import connect as _connect

        db_conn = _connect(conn_settings.db_path)
        try:
            # Not confirmed yet -> nothing is sent.
            result = digest_service.send_digest(db_conn, conn_settings)
            assert result["status"] == "skipped"

            token = _token_for(client, "reader@example.com")
            assert subscribers_service.confirm(db_conn, token)

            result = digest_service.send_digest(db_conn, conn_settings)
            assert result["status"] == "sent"
            assert result["recipients"] == 1
            assert len(sent_messages) == 1

            # Same-day re-run is a no-op (timer may refire).
            result = digest_service.send_digest(db_conn, conn_settings)
            assert result == {"status": "already", "date": result["date"]}
            assert len(sent_messages) == 1
        finally:
            db_conn.close()


def test_subscribe_page_and_api_endpoints_wired(tmp_path, data_dir, monkeypatch):
    monkeypatch.setattr(
        subscribers_service.mailer,
        "send_mail",
        lambda settings, to, subject, text, html=None: 1,
    )
    from backend.tests.conftest import DIST_HTML

    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text(DIST_HTML, encoding="utf-8")
    with TestClient(_app(tmp_path, data_dir, frontend_dist=dist)) as client:
        page = client.get("/subscribe")
        assert page.status_code == 200
        assert "noindex" in page.text

        response = client.post(
            "/api/subscribe",
            json={"email": "reader@example.com"},
            headers={"Origin": "http://testserver"},
        )
        assert response.status_code == 201
