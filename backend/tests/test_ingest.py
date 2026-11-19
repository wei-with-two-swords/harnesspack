from __future__ import annotations

import json
from pathlib import Path

from backend.app.db import connect, init_db
from backend.app.services.ingest import ingest


def _counts(conn) -> dict:
    return {
        "plugins": conn.execute("SELECT COUNT(*) FROM plugins").fetchone()[0],
        "stars": conn.execute("SELECT COUNT(*) FROM stars").fetchone()[0],
        "runs": conn.execute("SELECT COUNT(*) FROM fetch_runs").fetchone()[0],
    }


def test_ingest_loads_all_snapshots(db):
    counts = _counts(db)
    assert counts["plugins"] == 4
    assert counts["stars"] == 4 * 12
    assert counts["runs"] == 12


def test_ingest_is_idempotent(tmp_path: Path, data_dir):
    seed, snaps = data_dir
    conn = connect(tmp_path / "idem.db")
    init_db(conn)
    first = ingest(conn, snaps, seed)
    second = ingest(conn, snaps, seed)
    assert first.inserted == 4 * 12
    assert second.inserted == 0
    assert second.rows == first.rows
    assert _counts(conn) == {"plugins": 4, "stars": 48, "runs": 12}
    conn.close()


def test_delta_span_uses_real_gap(tmp_path: Path):
    seed = tmp_path / "seed.json"
    seed.write_text(
        json.dumps({"plugins": [{"owner": "a", "repo": "b", "slug": "a-b"}]}),
        encoding="utf-8",
    )
    snaps = tmp_path / "snapshots"
    snaps.mkdir()
    for day, stars in (("2026-11-01", 100), ("2026-11-03", 130)):
        payload = {
            "date": day,
            "plugins": [
                {"slug": "a-b", "owner": "a", "repo": "b", "name": "AB",
                 "status": "ok", "stars": stars}
            ],
        }
        (snaps / f"{day}.json").write_text(json.dumps(payload), encoding="utf-8")
    conn = connect(tmp_path / "gap.db")
    init_db(conn)
    ingest(conn, snaps, seed)
    rows = conn.execute("SELECT date, delta, delta_span_days FROM stars ORDER BY date").fetchall()
    assert rows[0]["delta"] is None
    assert rows[1]["delta"] == 30
    assert rows[1]["delta_span_days"] == 2
    conn.close()


def test_anomaly_flags_spike_and_keeps_row(tmp_path: Path):
    seed = tmp_path / "seed.json"
    seed.write_text(
        json.dumps({"plugins": [{"owner": "a", "repo": "b", "slug": "a-b"}]}),
        encoding="utf-8",
    )
    snaps = tmp_path / "snapshots"
    snaps.mkdir()
    for i, day in enumerate([f"2026-11-{d:02d}" for d in range(1, 7)]):
        stars = 505 if i == 5 else 5
        payload = {
            "date": day,
            "plugins": [
                {"slug": "a-b", "owner": "a", "repo": "b", "name": "AB",
                 "status": "ok", "stars": stars}
            ],
        }
        (snaps / f"{day}.json").write_text(json.dumps(payload), encoding="utf-8")
    conn = connect(tmp_path / "anomaly.db")
    init_db(conn)
    ingest(conn, snaps, seed)
    rows = conn.execute("SELECT date, delta, is_anomaly FROM stars ORDER BY date").fetchall()
    assert rows[-1]["is_anomaly"] == 1
    assert all(r["is_anomaly"] == 0 for r in rows[:-1])
    assert conn.execute("SELECT COUNT(*) FROM stars").fetchone()[0] == 6
    conn.close()


def test_bad_file_is_skipped_without_blocking(db, tmp_path: Path):
    seed, snaps = tmp_path / "seed2.json", tmp_path / "snapshots2"
    snaps.mkdir()
    (snaps / "2026-11-01.json").write_text(
        json.dumps({
            "date": "2026-11-02",
            "plugins": [{"slug": "a-b", "owner": "a", "repo": "b", "name": "AB",
                         "status": "ok", "stars": 1}],
        }),
        encoding="utf-8",
    )
    seed.write_text(json.dumps({"plugins": [{"owner": "a", "repo": "b", "slug": "a-b"}]}),
                    encoding="utf-8")
    conn = connect(tmp_path / "bad.db")
    init_db(conn)
    stats = ingest(conn, snaps, seed)
    assert stats.snapshots == 0
    assert stats.skipped and "date does not match" in stats.skipped[0]["reason"]
    conn.close()
