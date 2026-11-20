"""Load daily snapshot JSON files into SQLite.

Rules:
- ``data/snapshots`` is the single source of truth. Ingest is idempotent and
  the whole database can be rebuilt by replaying the files in date order.
- one malformed or partial file never blocks the others: it is recorded as
  skipped and the remaining files are still ingested.
- star deltas are computed from the previous observation of the same plugin,
  and ``delta_span_days`` records how many days that gap actually was.
"""

from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import date as Date
from pathlib import Path
from typing import Iterable

DATE_FILE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})\.json$")
SLUG_RE = re.compile(r"[^a-z0-9]+")

ANOMALY_FACTOR = 5
ANOMALY_ABS = 20
ANOMALY_MIN_HISTORY = 3
ANOMALY_WINDOW = 7


class IngestError(Exception):
    pass


@dataclass
class IngestStats:
    snapshots: int = 0
    plugins: int = 0
    rows: int = 0
    inserted: int = 0
    ignored: int = 0
    exited: int = 0
    dates: list[str] = field(default_factory=list)
    skipped: list[dict] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "snapshots": self.snapshots,
            "plugins": self.plugins,
            "rows": self.rows,
            "inserted": self.inserted,
            "ignored": self.ignored,
            "exited": self.exited,
            "dates": self.dates,
            "skipped": self.skipped,
        }


def slugify(owner: str, repo: str) -> str:
    return SLUG_RE.sub("-", f"{owner}-{repo}".lower()).strip("-")


def _load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def load_seed(seed_path: Path) -> list[dict]:
    if not Path(seed_path).exists():
        raise IngestError(f"seed file not found: {seed_path}")
    payload = _load_json(Path(seed_path))
    plugins = payload.get("plugins") if isinstance(payload, dict) else None
    if not isinstance(plugins, list) or not plugins:
        raise IngestError(f"seed file has no plugins: {seed_path}")
    return plugins


def _prepare_seed_record(p: dict) -> tuple:
    owner = str(p["owner"])
    repo = str(p["repo"])
    return (
        (p.get("slug") or slugify(owner, repo)).strip(),
        owner,
        repo,
        p.get("name") or repo,
        p.get("description") or None,
        p.get("category") or None,
        p.get("harness") or None,
        p.get("url") or f"https://github.com/{owner}/{repo}",
    )


UPSERT_SEED_SQL = """
INSERT INTO plugins (slug, owner, repo, name, description, category, harness, url)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(slug) DO UPDATE SET
    owner = excluded.owner,
    repo = excluded.repo,
    name = excluded.name,
    description = COALESCE(NULLIF(excluded.description, ''), plugins.description),
    category = COALESCE(NULLIF(excluded.category, ''), plugins.category),
    harness = COALESCE(NULLIF(excluded.harness, ''), plugins.harness),
    url = excluded.url,
    status = 'active',
    exited_at = NULL,
    exit_reason = NULL
"""


def upsert_seed(conn: sqlite3.Connection, seed_plugins: Iterable[dict]) -> int:
    count = 0
    for p in seed_plugins:
        conn.execute(UPSERT_SEED_SQL, _prepare_seed_record(p))
        count += 1
    return count


def _iso_date(value: str | None) -> str | None:
    if not value:
        return None
    return str(value)[:10]


def _plugin_id(conn: sqlite3.Connection, slug: str) -> int:
    row = conn.execute("SELECT id FROM plugins WHERE slug = ?", (slug,)).fetchone()
    if row is None:
        raise IngestError(f"plugin not present after upsert: {slug}")
    return int(row["id"])


UPSERT_SNAPSHOT_PLUGIN_SQL = """
INSERT INTO plugins
    (slug, owner, repo, name, description, url, repo_created_at, archived,
     stars_latest, stars_at, added_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(slug) DO UPDATE SET
    name = COALESCE(NULLIF(excluded.name, ''), plugins.name),
    description = COALESCE(NULLIF(excluded.description, ''), plugins.description),
    url = COALESCE(NULLIF(excluded.url, ''), plugins.url),
    repo_created_at = COALESCE(excluded.repo_created_at, plugins.repo_created_at),
    archived = excluded.archived,
    stars_latest = CASE
        WHEN plugins.stars_at IS NULL OR excluded.stars_at >= plugins.stars_at
        THEN excluded.stars_latest ELSE plugins.stars_latest END,
    stars_at = CASE
        WHEN plugins.stars_at IS NULL OR excluded.stars_at >= plugins.stars_at
        THEN excluded.stars_at ELSE plugins.stars_at END,
    added_at = COALESCE(plugins.added_at, excluded.added_at)
"""


def _ingest_record(conn: sqlite3.Connection, record: dict, day: str, stats: IngestStats) -> None:
    if record.get("status") != "ok":
        return
    stars = record.get("stars")
    if not isinstance(stars, int) or stars < 0:
        return
    owner = record.get("owner") or ""
    repo = record.get("repo") or ""
    slug = record.get("slug") or slugify(owner, repo)
    url = record.get("html_url") or record.get("url") or f"https://github.com/{owner}/{repo}"

    conn.execute(
        UPSERT_SNAPSHOT_PLUGIN_SQL,
        (
            slug,
            owner,
            repo,
            record.get("name") or repo,
            record.get("description") or None,
            url,
            _iso_date(record.get("created_at")),
            1 if record.get("archived") else 0,
            stars,
            day,
            day,
        ),
    )
    plugin_id = _plugin_id(conn, slug)

    prev = conn.execute(
        "SELECT date, count FROM stars WHERE plugin_id = ? AND date < ? "
        "ORDER BY date DESC LIMIT 1",
        (plugin_id, day),
    ).fetchone()
    if prev is None:
        delta = None
        span = None
    else:
        delta = stars - int(prev["count"])
        span = (Date.fromisoformat(day) - Date.fromisoformat(prev["date"])).days

    cur = conn.execute(
        "INSERT OR IGNORE INTO stars (plugin_id, date, count, delta, delta_span_days) "
        "VALUES (?, ?, ?, ?, ?)",
        (plugin_id, day, stars, delta, span),
    )
    stats.rows += 1
    stats.inserted += cur.rowcount

    conn.execute(
        "UPDATE plugins SET added_at = COALESCE(added_at, ?) WHERE id = ?",
        (day, plugin_id),
    )


def _mark_exited(conn: sqlite3.Connection, seed_slugs: set[str], files: list[Path]) -> int:
    """Mark catalog-removed plugins as exited, keeping their star history.

    The catalog is the membership authority: a repo that disappears from it is
    no longer ranked, but its historical curve stays available on the detail
    page. Re-adding a slug revives it via ``upsert_seed``.
    """
    day = "1970-01-01"
    if files:
        match = DATE_FILE_RE.match(files[-1].name)
        if match:
            day = match.group(1)
    rows = conn.execute("SELECT slug FROM plugins WHERE status = 'active'").fetchall()
    crossed = 0
    for row in rows:
        if row["slug"] in seed_slugs:
            continue
        conn.execute(
            "UPDATE plugins SET status = 'exited', exited_at = ?, "
            "exit_reason = 'removed from awesome-dsh-plugin catalog' WHERE slug = ?",
            (day, row["slug"]),
        )
        crossed += 1
    return crossed


def _ingest_file(
    conn: sqlite3.Connection,
    path: Path,
    stats: IngestStats,
    seed_slugs: set[str] | None = None,
) -> None:
    match = DATE_FILE_RE.match(path.name)
    if match is None:
        return
    expected = match.group(1)
    try:
        payload = _load_json(path)
    except (OSError, json.JSONDecodeError) as exc:
        stats.skipped.append({"file": path.name, "reason": f"unreadable: {exc}"})
        return
    if not isinstance(payload, dict) or payload.get("date") != expected:
        stats.skipped.append({"file": path.name, "reason": "date does not match file name"})
        return
    records = payload.get("plugins")
    if not isinstance(records, list):
        stats.skipped.append({"file": path.name, "reason": "missing plugins list"})
        return

    conn.execute(
        "INSERT OR REPLACE INTO fetch_runs "
        "(date, fetched_at, source, authenticated, total, ok, failed, elapsed_s, note) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            expected,
            payload.get("fetched_at") or "",
            payload.get("source") or "github",
            1 if payload.get("authenticated") else 0,
            int(payload.get("total") or len(records)),
            int(payload.get("ok") or 0),
            int(payload.get("failed") or 0),
            payload.get("elapsed_s"),
            None,
        ),
    )
    for record in records:
        if isinstance(record, dict):
            slug = record.get("slug") or slugify(
                str(record.get("owner") or ""), str(record.get("repo") or "")
            )
            if seed_slugs is not None and slug not in seed_slugs:
                # The seed is the membership authority: historical snapshots may
                # still carry repos that were removed by a later curation pass.
                stats.ignored += 1
                continue
            _ingest_record(conn, record, expected, stats)
    stats.snapshots += 1
    stats.dates.append(expected)


def recompute_anomalies(conn: sqlite3.Connection) -> int:
    """Flag implausible single-day spikes, deterministically.

    A delta is flagged when it is larger than max(5 x mean(last 7 deltas), 20)
    and at least 3 observations exist. Flagged deltas are kept (never dropped)
    and excluded from the rolling mean, so one spike cannot mask the next.
    """
    conn.execute("UPDATE stars SET is_anomaly = 0, anomaly_reason = NULL")
    flagged = 0
    plugin_ids = [int(r["plugin_id"]) for r in conn.execute("SELECT DISTINCT plugin_id FROM stars")]
    for plugin_id in plugin_ids:
        history: list[int] = []
        rows = conn.execute(
            "SELECT date, delta, delta_span_days FROM stars WHERE plugin_id = ? ORDER BY date",
            (plugin_id,),
        ).fetchall()
        for row in rows:
            delta = row["delta"]
            span = row["delta_span_days"]
            if delta is None or span is None or span > ANOMALY_WINDOW:
                continue
            if len(history) >= ANOMALY_MIN_HISTORY:
                mean = sum(history) / len(history)
                if delta > max(ANOMALY_FACTOR * mean, ANOMALY_ABS):
                    reason = f"delta {delta} > max(5x{mean:.1f}, {ANOMALY_ABS})"
                    conn.execute(
                        "UPDATE stars SET is_anomaly = 1, anomaly_reason = ? "
                        "WHERE plugin_id = ? AND date = ?",
                        (reason, plugin_id, row["date"]),
                    )
                    flagged += 1
                    continue
            history.append(int(delta))
            if len(history) > ANOMALY_WINDOW:
                history.pop(0)
    return flagged


def ingest(
    conn: sqlite3.Connection,
    snapshot_dir: Path,
    seed_path: Path | None = None,
) -> IngestStats:
    stats = IngestStats()
    snapshot_dir = Path(snapshot_dir)
    files = sorted(
        p for p in snapshot_dir.glob("*.json") if DATE_FILE_RE.match(p.name)
    ) if snapshot_dir.exists() else []
    seed_slugs: set[str] | None = None
    if seed_path is not None and Path(seed_path).exists():
        seed_plugins = load_seed(Path(seed_path))
        stats.plugins = upsert_seed(conn, seed_plugins)
        seed_slugs = {
            (p.get("slug") or slugify(str(p["owner"]), str(p["repo"]))).strip()
            for p in seed_plugins
        }
        stats.exited = _mark_exited(conn, seed_slugs, files)
    for path in files:
        _ingest_file(conn, path, stats, seed_slugs)

    recompute_anomalies(conn)
    conn.commit()
    stats.plugins = int(conn.execute("SELECT COUNT(*) FROM plugins").fetchone()[0])
    return stats
