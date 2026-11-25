"""Regression tests for the read-path caches added to ranking/status.

These guard the subtle part: a cache keyed by file signature must observe new
data once the DB/snapshot changes, otherwise a long-lived worker would serve
stale boards after every nightly ingest.
"""

from __future__ import annotations

import json
import sqlite3

from backend.app.db import connect, init_db
from backend.app.services import ranking, status


def test_connect_sets_busy_timeout_without_wal_switch(tmp_path):
    # Read connections must not flip journal mode (that needs a write lock);
    # WAL is enabled once by init_db, and busy_timeout is always installed.
    conn = connect(tmp_path / "fresh.db")
    try:
        assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == 5000
        assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "delete"
    finally:
        conn.close()


def test_init_db_enables_wal_once(tmp_path):
    conn = connect(tmp_path / "initialized.db")
    try:
        init_db(conn)
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    finally:
        conn.close()


def _make_db(path):
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE plugins (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, "
        "owner TEXT, repo TEXT, description TEXT, category TEXT, harness TEXT, "
        "url TEXT, repo_created_at TEXT, stars_latest INTEGER, status TEXT)"
    )
    conn.execute(
        "CREATE TABLE stars (plugin_id INTEGER, date TEXT, count INTEGER, "
        "delta INTEGER, is_anomaly INTEGER)"
    )
    conn.commit()
    return conn


def test_rows_cache_observes_new_wal_data(tmp_path):
    db_path = tmp_path / "data.db"
    conn = _make_db(db_path)
    conn.execute(
        "INSERT INTO plugins (id, slug, name, status) VALUES (1, 'alpha', 'Alpha', 'active')"
    )
    conn.execute("INSERT INTO stars (plugin_id, date, count, delta) VALUES (1, '2026-01-01', 10, 1)")
    conn.commit()

    first = ranking._rows_on(conn, "2026-01-01")
    assert [r["slug"] for r in first] == ["alpha"]

    # Write in WAL mode (no checkpoint) — signature must still change.
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute(
        "INSERT INTO plugins (id, slug, name, status) VALUES (2, 'beta', 'Beta', 'active')"
    )
    conn.execute("INSERT INTO stars (plugin_id, date, count, delta) VALUES (2, '2026-01-01', 5, 1)")
    conn.commit()

    second = ranking._rows_on(conn, "2026-01-01")
    assert {r["slug"] for r in second} == {"alpha", "beta"}
    conn.close()


def test_snapshot_status_cache_observes_new_file(tmp_path):
    snap_dir = tmp_path / "snapshots"
    snap_dir.mkdir()
    first_file = snap_dir / "2026-01-01.json"
    first_file.write_text(
        json.dumps({"date": "2026-01-01", "total": 10, "ok": 9, "failed": 1, "failures": []}),
        encoding="utf-8",
    )
    a = status.snapshot_status(snap_dir, seed_count=10)
    assert a["as_of"] == "2026-01-01" and a["days"] == 1

    second_file = snap_dir / "2026-01-02.json"
    second_file.write_text(
        json.dumps({"date": "2026-01-02", "total": 12, "ok": 11, "failed": 1, "failures": []}),
        encoding="utf-8",
    )
    b = status.snapshot_status(snap_dir, seed_count=12)
    assert b["as_of"] == "2026-01-02" and b["days"] == 2
