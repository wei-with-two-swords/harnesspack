"""Public data-health summary for ``/status``.

Reads the snapshot files directly (they are the source of truth) and adds a few
database counters so readers can verify coverage without trusting the site.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from .ranking import latest_date


def snapshot_status(snapshot_dir: Path, seed_count: int | None = None) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    for path in sorted(snapshot_dir.glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict):
            continue
        entries.append(
            {
                "date": payload.get("date") or path.stem,
                "total": int(payload.get("total") or 0),
                "ok": int(payload.get("ok") or 0),
                "failed": int(payload.get("failed") or 0),
                "elapsed_s": payload.get("elapsed_s"),
                "fetched_at": payload.get("fetched_at"),
                "failures": payload.get("failures") or [],
            }
        )
    latest = entries[-1] if entries else None
    latest_ok_rate = None
    coverage = None
    if latest and latest["total"]:
        latest_ok_rate = round(latest["ok"] / latest["total"], 4)
        if seed_count:
            coverage = round(latest["ok"] / seed_count, 4)
    return {
        "as_of": latest["date"] if latest else None,
        "first_date": entries[0]["date"] if entries else None,
        "days": len(entries),
        "seed_count": seed_count,
        "latest": latest,
        "ok_rate": latest_ok_rate,
        "coverage": coverage,
        "failures": (latest["failures"] if latest else [])[:50],
    }


def database_status(conn: sqlite3.Connection) -> dict[str, Any]:
    def scalar(sql: str, params: tuple = ()) -> int:
        row = conn.execute(sql, params).fetchone()
        return int(row[0]) if row and row[0] is not None else 0

    day = latest_date(conn)
    return {
        "as_of": day,
        "plugins": scalar("SELECT COUNT(*) FROM plugins"),
        "active": scalar("SELECT COUNT(*) FROM plugins WHERE status = 'active'"),
        "exited": scalar("SELECT COUNT(*) FROM plugins WHERE status = 'exited'"),
        "added_today": scalar("SELECT COUNT(*) FROM plugins WHERE added_at = ?", (day,)) if day else 0,
        "exited_today": scalar("SELECT COUNT(*) FROM plugins WHERE exited_at = ?", (day,)) if day else 0,
        "unavailable": scalar(
            "SELECT COUNT(*) FROM plugins WHERE status = 'active' AND stars_latest IS NULL"
        ),
        "stars_rows": scalar("SELECT COUNT(*) FROM stars"),
        "anomalies": scalar("SELECT COUNT(*) FROM stars WHERE is_anomaly = 1"),
    }
