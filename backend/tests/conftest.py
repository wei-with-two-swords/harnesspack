"""Shared fixtures: 12 daily snapshots for 4 synthetic plugins."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.db import connect, init_db
from backend.app.main import create_app
from backend.app.services.ingest import ingest

SNAPSHOT_DAYS = [f"2026-11-{day:02d}" for day in range(1, 13)]
CREATED = {"beta-two": "2026-11-05T00:00:00Z"}

SEED_PLUGINS = [
    {
        "owner": "alpha",
        "repo": "one",
        "slug": "alpha-one",
        "name": "Alpha One",
        "category": "workflow",
        "harness": "claude",
        "url": "https://github.com/alpha/one",
    },
    {
        "owner": "beta",
        "repo": "two",
        "slug": "beta-two",
        "name": "Beta Two",
        "category": "coding",
        "harness": "codex",
        "url": "https://github.com/beta/two",
    },
    {
        "owner": "gamma",
        "repo": "three",
        "slug": "gamma-three",
        "name": "Gamma Three",
        "category": "design",
        "harness": "cursor",
        "url": "https://github.com/gamma/three",
    },
    {
        "owner": "delta",
        "repo": "four",
        "slug": "delta-four",
        "name": "Delta Four",
        "category": "workflow",
        "harness": "multi",
        "url": "https://github.com/delta/four",
    },
]


def counts_for(index: int) -> dict[str, int]:
    return {
        "alpha-one": 100 + 10 * index,
        "beta-two": 50 + 5 * index,
        "gamma-three": 200,
        "delta-four": 250 - 10 * index,
    }


def _record(slug: str, stars: int, status: str = "ok") -> dict:
    owner, repo = slug.split("-", 1)
    return {
        "slug": slug,
        "owner": owner,
        "repo": repo,
        "name": slug.replace("-", " ").title(),
        "description": f"{slug} description",
        "status": status,
        "stars": stars,
        "html_url": f"https://github.com/{owner}/{repo}",
        "created_at": CREATED.get(slug, "2024-01-01T00:00:00Z"),
        "archived": False,
    }


def write_seed(path: Path) -> Path:
    payload = {"version": 1, "updated_at": "2026-11-01", "plugins": SEED_PLUGINS}
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return path


def write_snapshots(snap_dir: Path) -> Path:
    snap_dir.mkdir(parents=True, exist_ok=True)
    for index, day in enumerate(SNAPSHOT_DAYS):
        records = [_record(slug, stars) for slug, stars in counts_for(index).items()]
        payload = {
            "date": day,
            "fetched_at": f"{day}T00:10:00Z",
            "source": "fixture",
            "authenticated": True,
            "total": len(records),
            "ok": len(records),
            "failed": 0,
            "elapsed_s": 0.1,
            "plugins": records,
        }
        (snap_dir / f"{day}.json").write_text(
            json.dumps(payload, ensure_ascii=False), encoding="utf-8"
        )
    return snap_dir


@pytest.fixture
def data_dir(tmp_path: Path) -> tuple[Path, Path]:
    seed = write_seed(tmp_path / "plugins.seed.json")
    snaps = write_snapshots(tmp_path / "snapshots")
    return seed, snaps


@pytest.fixture
def db(tmp_path: Path, data_dir: tuple[Path, Path]):
    seed, snaps = data_dir
    conn = connect(tmp_path / "test.db")
    init_db(conn)
    ingest(conn, snaps, seed)
    yield conn
    conn.close()


@pytest.fixture
def client(tmp_path: Path, data_dir: tuple[Path, Path]):
    seed, snaps = data_dir
    settings = Settings(
        db_path=tmp_path / "api.db",
        snapshot_dir=snaps,
        seed_path=seed,
        frontend_dist=tmp_path / "dist",
        base_url="http://testserver",
        api_anon_per_minute=1000,
        api_anon_per_day=1000,
        api_auth_per_minute=1000,
        api_auth_per_day=1000,
    )
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client


DIST_HTML = (
    '<!doctype html><html><head><title>HarnessPack</title>'
    '<meta name="description" content="placeholder">'
    '<meta property="og:image" content="">'
    '<meta name="twitter:card" content="summary">'
    '</head><body><div id="root"></div></body></html>'
)


@pytest.fixture
def client_with_dist(tmp_path: Path, data_dir: tuple[Path, Path]):
    seed, snaps = data_dir
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text(DIST_HTML, encoding="utf-8")
    settings = Settings(
        db_path=tmp_path / "api.db",
        snapshot_dir=snaps,
        seed_path=seed,
        frontend_dist=dist,
        base_url="http://testserver",
        api_anon_per_minute=1000,
        api_anon_per_day=1000,
        api_auth_per_minute=1000,
        api_auth_per_day=1000,
    )
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client
