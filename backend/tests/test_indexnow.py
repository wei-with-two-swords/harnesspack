"""IndexNow: URL selection, per-day idempotency and the key verification file."""

from __future__ import annotations

from backend.app.db import connect
from backend.app.services import indexnow as indexnow_service


def test_build_urls_covers_static_and_plugins(tmp_path, data_dir):
    from backend.app.main import create_app
    from backend.app.config import Settings
    from fastapi.testclient import TestClient

    seed, snaps = data_dir
    settings = Settings(
        db_path=tmp_path / "db.sqlite", snapshot_dir=snaps, seed_path=seed,
        frontend_dist=tmp_path / "dist", base_url="https://harnesspack.dev",
    )
    app = create_app(settings)
    with TestClient(app):
        conn = connect(settings.db_path)
        try:
            urls = indexnow_service.build_urls(conn, settings.base_url)
        finally:
            conn.close()
    assert "https://harnesspack.dev/" in urls
    assert "https://harnesspack.dev/plugins/alpha-one" in urls
    assert len(urls) == len(set(urls))
    assert all(url.startswith("https://harnesspack.dev/") for url in urls)


def test_push_requires_key_and_is_idempotent(tmp_path, data_dir, monkeypatch):
    from backend.app.main import create_app
    from backend.app.config import Settings
    from fastapi.testclient import TestClient

    seed, snaps = data_dir
    settings = Settings(
        db_path=tmp_path / "db.sqlite", snapshot_dir=snaps, seed_path=seed,
        frontend_dist=tmp_path / "dist", base_url="https://harnesspack.dev",
    )
    app = create_app(settings)
    with TestClient(app):
        conn = connect(settings.db_path)
        try:
            assert indexnow_service.push(conn, settings)["status"] == "skipped"

            posted: list[dict] = []
            monkeypatch.setattr(
                indexnow_service, "_post", lambda payload: posted.append(payload) or (200, "OK")
            )
            settings = Settings(
                db_path=tmp_path / "db.sqlite", snapshot_dir=snaps, seed_path=seed,
                frontend_dist=tmp_path / "dist", base_url="https://harnesspack.dev",
                indexnow_key="a" * 32,
            )
            result = indexnow_service.push(conn, settings)
            assert result["status"] == "ok"
            assert len(posted) == 1
            assert posted[0]["key"] == "a" * 32
            assert posted[0]["keyLocation"].endswith("/" + "a" * 32 + ".txt")

            again = indexnow_service.push(conn, settings)
            assert again == {"status": "already", "date": result["date"], "last_status": "ok"}
            assert len(posted) == 1
        finally:
            conn.close()


def test_key_file_route_served_when_configured(tmp_path, data_dir):
    from backend.app.main import create_app
    from backend.app.config import Settings
    from fastapi.testclient import TestClient

    seed, snaps = data_dir
    settings = Settings(
        db_path=tmp_path / "db.sqlite", snapshot_dir=snaps, seed_path=seed,
        frontend_dist=tmp_path / "dist", indexnow_key="b" * 32,
    )
    with TestClient(create_app(settings)) as client:
        response = client.get(f"/{'b' * 32}.txt")
        assert response.status_code == 200
        assert response.text == "b" * 32

    settings_no_key = Settings(
        db_path=tmp_path / "db2.sqlite", snapshot_dir=snaps, seed_path=seed,
        frontend_dist=tmp_path / "dist",
    )
    with TestClient(create_app(settings_no_key)) as client:
        assert client.get(f"/{'b' * 32}.txt").status_code == 404
