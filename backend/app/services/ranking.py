"""Ranking queries.

All boards are computed on read from the ``stars`` table, so adding a new board
never requires a migration. Every board returns a list already sorted; the API
layer slices it for pagination.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import date as Date, timedelta
from pathlib import Path
from typing import Any

BOARDS = ("velocity", "growth", "total", "darkhorse", "rookie", "quality")
NPM_BOARD = "npm"
WINDOWS = (7, 30)
NPM_WINDOWS = (7, 30)
# npm board supports five windows; only 7d/30d carry a previous-window baseline.
NPM_RANGES = ("24h", "7d", "30d", "1y", "ytd")
NPM_RANGE_KEYS: dict[str, str] = {
    "24h": "downloads_24h",
    "7d": "downloads_7d",
    "30d": "downloads_30d",
    "1y": "downloads_1y",
    "ytd": "downloads_ytd",
}
NPM_RANGE_PREV_KEYS: dict[str, str] = {
    "7d": "downloads_prev_7d",
    "30d": "downloads_prev_30d",
}
GROWTH_MIN_BASE = 50
ROOKIE_DAYS = 30
ROOKIE_MIN_STARS = 10
QUALITY_MIN_DAYS = 3


class BoardError(ValueError):
    pass


def latest_date(conn: sqlite3.Connection) -> str | None:
    row = conn.execute("SELECT MAX(date) AS d FROM stars").fetchone()
    return row["d"] if row and row["d"] else None


def _previous_date(conn: sqlite3.Connection, day: str) -> str | None:
    row = conn.execute(
        "SELECT MAX(date) AS d FROM stars WHERE date < ?", (day,)
    ).fetchone()
    return row["d"] if row and row["d"] else None


def _rows_on(conn: sqlite3.Connection, day: str, category: str | None = None) -> list[dict[str, Any]]:
    sql = """
        SELECT p.id, p.slug, p.owner, p.repo, p.name, p.description, p.category,
               p.harness, p.url, p.repo_created_at, p.stars_latest,
               s.count AS stars, s.delta, s.is_anomaly
        FROM stars s
        JOIN plugins p ON p.id = s.plugin_id
        WHERE s.date = ? AND p.status = 'active'
        """
    params: list[Any] = [day]
    if category:
        sql += " AND p.category = ?"
        params.append(category)
    rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def _rank_map(rows: list[dict[str, Any]]) -> dict[str, int]:
    ordered = sorted(rows, key=lambda r: (-r["stars"], r["name"].lower(), r["slug"]))
    return {r["slug"]: i + 1 for i, r in enumerate(ordered)}


def _base_item(row: dict[str, Any], rank: int) -> dict[str, Any]:
    return {
        "slug": row["slug"],
        "name": row["name"],
        "owner": row["owner"],
        "repo": row["repo"],
        "description": row["description"],
        "category": row["category"],
        "harness": row["harness"],
        "url": row["url"],
        "stars": row["stars"],
        "delta": row["delta"],
        "is_anomaly": bool(row["is_anomaly"]),
        "repo_created_at": row["repo_created_at"],
        "rank": rank,
        "prev_rank": None,
        "growth": None,
    }


def _empty(board: str, day: str | None, window: int | None, reason: str) -> dict[str, Any]:
    return {
        "board": board,
        "as_of": day,
        "window": window,
        "items": [],
        "reason": reason,
    }


def board(
    conn: sqlite3.Connection,
    name: str,
    window: int = 7,
    on: str | None = None,
    category: str | None = None,
) -> dict[str, Any]:
    if name not in BOARDS:
        raise BoardError(f"unknown board: {name}")
    if name in ("growth", "darkhorse", "quality") and window not in WINDOWS:
        raise BoardError(f"window must be one of {WINDOWS}")
    day = on or latest_date(conn)
    if day is None:
        return _empty(name, None, window if name in ("growth", "darkhorse", "quality") else None, "no snapshots")

    rows = _rows_on(conn, day, category)
    prev_day = _previous_date(conn, day)
    prev_rank = _rank_map(_rows_on(conn, prev_day, category)) if prev_day else {}

    if name == "total":
        items = []
        for i, row in enumerate(sorted(rows, key=lambda r: (-r["stars"], r["name"].lower(), r["slug"]))):
            item = _base_item(row, i + 1)
            item["prev_rank"] = prev_rank.get(row["slug"])
            items.append(item)
        return {"board": name, "as_of": day, "window": None, "items": items}

    if name == "velocity":
        candidates = sorted(
            (r for r in rows if r["delta"] is not None),
            key=lambda r: (-r["delta"], -r["stars"], r["name"].lower(), r["slug"]),
        )
        items = []
        for i, row in enumerate(candidates):
            item = _base_item(row, i + 1)
            item["prev_rank"] = prev_rank.get(row["slug"])
            items.append(item)
        return {"board": name, "as_of": day, "window": None, "items": items}

    if name == "quality":
        # Real growth: drop days flagged as star spikes, then average the rest.
        base_day = (Date.fromisoformat(day) - timedelta(days=window)).isoformat()
        stats = {
            r["plugin_id"]: dict(r)
            for r in conn.execute(
                """
                SELECT plugin_id,
                       SUM(CASE WHEN is_anomaly = 0 THEN 1 ELSE 0 END) AS observed_days,
                       SUM(CASE WHEN is_anomaly = 0 THEN delta ELSE 0 END) AS real_delta,
                       SUM(CASE WHEN is_anomaly = 1 THEN 1 ELSE 0 END) AS anomaly_days
                FROM stars
                WHERE date > ? AND date <= ? AND delta IS NOT NULL
                GROUP BY plugin_id
                """,
                (base_day, day),
            ).fetchall()
        }
        candidates: list[tuple[float, dict[str, Any], dict[str, Any]]] = []
        for row in rows:
            stat = stats.get(row.get("id"))
            if stat is None or stat["observed_days"] < QUALITY_MIN_DAYS:
                continue
            daily = stat["real_delta"] / stat["observed_days"]
            candidates.append((daily, row, stat))
        candidates.sort(
            key=lambda c: (-c[0], -c[1]["stars"], c[1]["name"].lower(), c[1]["slug"])
        )
        items = []
        for i, (daily, row, stat) in enumerate(candidates):
            item = _base_item(row, i + 1)
            item["growth"] = round(daily, 2)
            item["real_delta"] = int(stat["real_delta"])
            item["observed_days"] = int(stat["observed_days"])
            item["anomaly_days"] = int(stat["anomaly_days"])
            items.append(item)
        if not items:
            return {
                "board": name,
                "as_of": day,
                "window": window,
                "items": [],
                "reason": f"需要至少 {QUALITY_MIN_DAYS} 天有效快照（异常日不计入），当前样本不足。",
            }
        return {"board": name, "as_of": day, "window": window, "items": items}

    base_day = (Date.fromisoformat(day) - timedelta(days=window)).isoformat()
    base_rows = _rows_on(conn, base_day, category)
    if not base_rows:
        return _empty(name, day, window, f"missing snapshot for {base_day}")

    if name == "growth":
        base = {r["slug"]: r for r in base_rows}
        candidates: list[tuple[float, dict[str, Any]]] = []
        for row in rows:
            old = base.get(row["slug"])
            if old is None or old["stars"] < GROWTH_MIN_BASE:
                continue
            growth = (row["stars"] - old["stars"]) / old["stars"]
            candidates.append((growth, row))
        candidates.sort(key=lambda c: (-c[0], -c[1]["stars"], c[1]["name"].lower(), c[1]["slug"]))
        items = []
        for i, (growth, row) in enumerate(candidates):
            item = _base_item(row, i + 1)
            item["growth"] = round(growth, 6)
            items.append(item)
        return {"board": name, "as_of": day, "window": window, "items": items}

    # darkhorse: biggest improvement in total-star rank over the window
    base_rank = _rank_map(base_rows)
    jumps: list[tuple[int, dict[str, Any], int]] = []
    for i, row in enumerate(sorted(rows, key=lambda r: (-r["stars"], r["name"].lower(), r["slug"]))):
        old_rank = base_rank.get(row["slug"])
        if old_rank is None:
            continue
        jumps.append((old_rank - (i + 1), row, old_rank))
    jumps.sort(key=lambda j: (-j[0], -j[1]["stars"], j[1]["name"].lower(), j[1]["slug"]))
    items = []
    for i, (jump, row, old_rank) in enumerate(jumps):
        item = _base_item(row, i + 1)
        item["prev_rank"] = old_rank
        item["growth"] = jump
        items.append(item)
    return {"board": name, "as_of": day, "window": window, "items": items}


def rookie_board(
    conn: sqlite3.Connection, on: str | None = None, category: str | None = None
) -> dict[str, Any]:
    day = on or latest_date(conn)
    if day is None:
        return {"board": "rookie", "as_of": None, "window": None, "items": []}
    cutoff = (Date.fromisoformat(day) - timedelta(days=ROOKIE_DAYS)).isoformat()
    rows = [
        r
        for r in _rows_on(conn, day, category)
        if r["repo_created_at"]
        and cutoff <= r["repo_created_at"][:10] <= day
        and (r["stars"] or 0) >= ROOKIE_MIN_STARS
    ]
    rows.sort(key=lambda r: (-r["stars"], r["name"].lower(), r["slug"]))
    return {
        "board": "rookie",
        "as_of": day,
        "window": None,
        "items": [_base_item(row, i + 1) for i, row in enumerate(rows)],
    }


def _load_npm_latest(npm_dir: str | Path | None) -> dict[str, Any] | None:
    """Load the npm download summary; return None when unavailable."""
    if not npm_dir:
        return None
    path = Path(npm_dir) / "latest.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return payload if isinstance(payload, dict) else None


def npm_board(
    conn: sqlite3.Connection,
    npm_dir: str | Path | None = None,
    window: int = 7,
    category: str | None = None,
    range: str | None = None,
) -> dict[str, Any]:
    """Independent npm download board.

    Downloads come from the archived npm-registry summary (a separate namespace
    from stars). Each item carries stars only as a side-by-side reference; the
    two metrics are never combined into one score.

    ``range`` selects one of the five npm windows (24h/7d/30d/1y/ytd). When
    omitted, ``window`` (7 or 30) is used for backward compatibility. Only 7d
    and 30d have a previous-window baseline; the other ranges report no rank
    change.
    """
    rng = range or f"{window}d"
    if rng not in NPM_RANGES:
        raise BoardError(f"range must be one of {NPM_RANGES}")
    summary = _load_npm_latest(npm_dir)
    if summary is None:
        return {
            "board": NPM_BOARD,
            "as_of": None,
            "window": rng,
            "items": [],
            "reason": "npm 下载数据尚未采集。",
        }

    by_slug = summary.get("plugins") or {}
    cur_key = NPM_RANGE_KEYS[rng]
    prev_key = NPM_RANGE_PREV_KEYS.get(rng)
    has_prev = prev_key is not None

    rows = conn.execute(
        "SELECT slug, name, owner, repo, description, category, harness, url, "
        "stars_latest, repo_created_at, npm_package FROM plugins WHERE status = 'active'"
    ).fetchall()
    params: dict[str, dict[str, Any]] = {}
    for row in rows:
        entry = by_slug.get(row["slug"])
        if not entry:
            continue
        downloads = int(entry.get(cur_key) or 0)
        if downloads <= 0:
            continue
        if category and row["category"] != category:
            continue
        prev = int(entry.get(prev_key) or 0) if prev_key else 0
        params[row["slug"]] = {**dict(row), "downloads": downloads, "prev": prev}

    prev_order = sorted(
        params.values(),
        key=lambda r: (-r["prev"], -r["downloads"], r["name"].lower(), r["slug"]),
    )
    prev_rank = {r["slug"]: i + 1 for i, r in enumerate(prev_order) if r["prev"] > 0} if has_prev else {}

    ordered = sorted(
        params.values(),
        key=lambda r: (-r["downloads"], -(r["stars_latest"] or 0), r["name"].lower(), r["slug"]),
    )
    items = []
    for i, row in enumerate(ordered):
        prev = row["prev"]
        growth = (row["downloads"] - prev) / prev if has_prev and prev > 0 else None
        items.append(
            {
                "slug": row["slug"],
                "name": row["name"],
                "owner": row["owner"],
                "repo": row["repo"],
                "description": row["description"],
                "category": row["category"],
                "harness": row["harness"],
                "url": row["url"],
                "stars": row["stars_latest"],
                "delta": None,
                "is_anomaly": False,
                "repo_created_at": row["repo_created_at"],
                "npm_package": row["npm_package"] or by_slug[row["slug"]].get("npm_package"),
                "downloads": row["downloads"],
                "downloads_prev": prev if has_prev else None,
                "growth": round(growth, 6) if growth is not None else None,
                "rank": i + 1,
                "prev_rank": prev_rank.get(row["slug"]) if has_prev else None,
                "has_prev": has_prev,
            }
        )
    window_meta = summary.get("window") or {}
    return {
        "board": NPM_BOARD,
        "as_of": window_meta.get("end"),
        "last_active_day": summary.get("last_active_day"),
        "window": rng,
        "items": items,
        "source": summary.get("source"),
        "metric": summary.get("metric"),
        "unit": summary.get("unit"),
        "is_approximate": summary.get("is_approximate", True),
        "note": summary.get("note"),
        "covered_packages": summary.get("covered_packages"),
    }


def get_board(
    conn: sqlite3.Connection,
    name: str,
    window: int = 7,
    on: str | None = None,
    category: str | None = None,
    npm_dir: str | Path | None = None,
    range: str | None = None,
) -> dict[str, Any]:
    if name == NPM_BOARD:
        return npm_board(conn, npm_dir=npm_dir, window=window, category=category, range=range)
    if name == "rookie":
        return rookie_board(conn, on, category)
    return board(conn, name, window=window, on=on, category=category)


def categories(conn: sqlite3.Connection, on: str | None = None) -> dict[str, Any]:
    """Board-ready category index: seat count, total stars and the top three."""
    day = on or latest_date(conn)
    if day is None:
        return {"as_of": None, "items": []}
    rows = _rows_on(conn, day)
    groups: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        groups.setdefault(row["category"] or "other", []).append(row)
    items = []
    for name, group in groups.items():
        group.sort(key=lambda r: (-r["stars"], r["name"].lower(), r["slug"]))
        items.append(
            {
                "category": name,
                "count": len(group),
                "total_stars": sum(r["stars"] for r in group),
                "top": [
                    {"slug": r["slug"], "name": r["name"], "stars": r["stars"]}
                    for r in group[:3]
                ],
            }
        )
    items.sort(key=lambda c: (c["category"] == "other", -c["total_stars"], c["category"]))
    return {"as_of": day, "items": items}


def plugin_detail(conn: sqlite3.Connection, slug: str, on: str | None = None) -> dict[str, Any] | None:
    row = conn.execute("SELECT * FROM plugins WHERE slug = ?", (slug,)).fetchone()
    if row is None:
        return None
    plugin = dict(row)
    day = on or latest_date(conn)
    detail: dict[str, Any] = {
        "slug": plugin["slug"],
        "name": plugin["name"],
        "owner": plugin["owner"],
        "repo": plugin["repo"],
        "description": plugin["description"],
        "category": plugin["category"],
        "harness": plugin["harness"],
        "url": plugin["url"],
        "status": plugin["status"],
        "exited_at": plugin["exited_at"],
        "exit_reason": plugin["exit_reason"],
        "available": plugin["stars_latest"] is not None,
        "stars_at": plugin["stars_at"],
        "peers": [],
        "archived": bool(plugin["archived"]),
        "repo_created_at": plugin["repo_created_at"],
        "added_at": plugin["added_at"],
        "as_of": day,
        "stars": plugin["stars_latest"],
        "delta": None,
        "is_anomaly": False,
        "rank_total": None,
        "rank_velocity": None,
        "rank_growth7": None,
        "rank_darkhorse7": None,
        "rank_quality7": None,
    }
    if day is None:
        return detail

    latest = conn.execute(
        "SELECT count, delta, is_anomaly FROM stars WHERE plugin_id = ? AND date = ?",
        (plugin["id"], day),
    ).fetchone()
    if latest is not None:
        detail["stars"] = latest["count"]
        detail["delta"] = latest["delta"]
        detail["is_anomaly"] = bool(latest["is_anomaly"])

    def _rank(board_payload: dict[str, Any]) -> int | None:
        for item in board_payload["items"]:
            if item["slug"] == slug:
                return item["rank"]
        return None

    detail["rank_total"] = _rank(board(conn, "total", on=day))
    detail["rank_velocity"] = _rank(board(conn, "velocity", on=day))
    detail["rank_growth7"] = _rank(board(conn, "growth", window=7, on=day))
    detail["rank_darkhorse7"] = _rank(board(conn, "darkhorse", window=7, on=day))
    detail["rank_quality7"] = _rank(board(conn, "quality", window=7, on=day))

    if plugin["category"]:
        same = _rows_on(conn, day, plugin["category"])
        ordered = sorted(same, key=lambda r: (-r["stars"], r["name"].lower(), r["slug"]))
        peers = []
        for i, row in enumerate(ordered):
            if row["slug"] == slug:
                continue
            peers.append(
                {
                    "slug": row["slug"],
                    "name": row["name"],
                    "stars": row["stars"],
                    "rank": i + 1,
                }
            )
            if len(peers) == 5:
                break
        detail["peers"] = peers
    return detail


def series(conn: sqlite3.Connection, slug: str, days: int = 90, on: str | None = None) -> list[dict[str, Any]] | None:
    row = conn.execute("SELECT id FROM plugins WHERE slug = ?", (slug,)).fetchone()
    if row is None:
        return None
    day = on or latest_date(conn)
    if day is None:
        return []
    cutoff = (Date.fromisoformat(day) - timedelta(days=max(1, days))).isoformat()
    rows = conn.execute(
        "SELECT date, count, delta, is_anomaly FROM stars "
        "WHERE plugin_id = ? AND date > ? AND date <= ? ORDER BY date",
        (row["id"], cutoff, day),
    ).fetchall()
    return [
        {
            "date": r["date"],
            "stars": r["count"],
            "delta": r["delta"],
            "is_anomaly": bool(r["is_anomaly"]),
        }
        for r in rows
    ]


def compare(conn: sqlite3.Connection, slugs: list[str], days: int = 90) -> dict[str, Any] | None:
    plugins = []
    for slug in slugs:
        detail = plugin_detail(conn, slug)
        if detail is None:
            return None
        points = series(conn, slug, days=days)
        plugins.append({"slug": slug, "name": detail["name"], "series": points or []})
    return {"as_of": latest_date(conn), "days": days, "plugins": plugins}


PLUGIN_SORTS = {
    "stars": "stars_latest DESC NULLS LAST, name COLLATE NOCASE, slug",
    "name": "name COLLATE NOCASE, slug",
    "recent": "repo_created_at DESC NULLS LAST, stars_latest DESC NULLS LAST, slug",
    "downloads": "stars_latest DESC NULLS LAST, name COLLATE NOCASE, slug",  # replaced below when npm_dir given
}


def list_plugins(
    conn: sqlite3.Connection,
    query: str | None = None,
    harness: str | None = None,
    category: str | None = None,
    limit: int = 50,
    offset: int = 0,
    sort: str = "stars",
    npm_dir: str | Path | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """List plugins. ``sort='downloads'`` orders by npm 1-year downloads (desc);
    plugins without npm data are omitted, consistent with the npm board."""
    if sort == "downloads":
        summary = _load_npm_latest(npm_dir)
        downloads_by_slug: dict[str, int] = {}
        if summary:
            for slug, entry in (summary.get("plugins") or {}).items():
                value = int(entry.get("downloads_1y") or 0)
                if value > 0:
                    downloads_by_slug[slug] = value
        where = ["status = 'active'"]
        params: list[Any] = []
        if query:
            where.append("(name LIKE ? OR owner LIKE ? OR repo LIKE ? OR slug LIKE ? OR description LIKE ?)")
            like = f"%{query}%"
            params.extend([like, like, like, like, like])
        if harness:
            where.append("harness = ?")
            params.append(harness)
        if category:
            where.append("category = ?")
            params.append(category)
        clause = " AND ".join(where)
        rows = conn.execute(
            f"SELECT slug, name, owner, repo, description, category, harness, url, "
            f"stars_latest, stars_at, repo_created_at, archived FROM plugins WHERE {clause}",
            params,
        ).fetchall()
        matched = [r for r in rows if r["slug"] in downloads_by_slug]
        matched.sort(key=lambda r: (-downloads_by_slug[r["slug"]], -(r["stars_latest"] or 0), r["name"].lower(), r["slug"]))
        total = len(matched)
        page = matched[offset : offset + limit]
        items = [
            {
                "slug": r["slug"], "name": r["name"], "owner": r["owner"], "repo": r["repo"],
                "description": r["description"], "category": r["category"], "harness": r["harness"],
                "url": r["url"], "stars": r["stars_latest"], "stars_at": r["stars_at"],
                "repo_created_at": r["repo_created_at"], "archived": bool(r["archived"]),
                "downloads": downloads_by_slug[r["slug"]],
            }
            for r in page
        ]
        return items, total

    where = ["status = 'active'"]
    params: list[Any] = []
    if query:
        where.append("(name LIKE ? OR owner LIKE ? OR repo LIKE ? OR slug LIKE ? OR description LIKE ?)")
        like = f"%{query}%"
        params.extend([like, like, like, like, like])
    if harness:
        where.append("harness = ?")
        params.append(harness)
    if category:
        where.append("category = ?")
        params.append(category)
    clause = " AND ".join(where)
    order = PLUGIN_SORTS.get(sort, PLUGIN_SORTS["stars"])
    total = int(
        conn.execute(f"SELECT COUNT(*) FROM plugins WHERE {clause}", params).fetchone()[0]
    )
    rows = conn.execute(
        f"SELECT slug, name, owner, repo, description, category, harness, url, "
        f"stars_latest, stars_at, repo_created_at, archived FROM plugins WHERE {clause} "
        f"ORDER BY {order} LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    items = [
        {
            "slug": r["slug"],
            "name": r["name"],
            "owner": r["owner"],
            "repo": r["repo"],
            "description": r["description"],
            "category": r["category"],
            "harness": r["harness"],
            "url": r["url"],
            "stars": r["stars_latest"],
            "stars_at": r["stars_at"],
            "repo_created_at": r["repo_created_at"],
            "archived": bool(r["archived"]),
        }
        for r in rows
    ]
    return items, total


def dashboard(conn: sqlite3.Connection, on: str | None = None) -> dict[str, Any]:
    day = on or latest_date(conn)
    if day is None:
        return {
            "as_of": None,
            "kpis": {"total_stars": 0, "stars_delta": 0, "tracked": 0, "new_today": 0, "snapshots": 0},
            "top_velocity": [],
            "top_growth": [],
            "top_total": [],
            "newest": [],
        }
    rows = _rows_on(conn, day)
    total_stars = sum(r["stars"] for r in rows)
    total_delta = sum(r["delta"] or 0 for r in rows)
    tracked = int(conn.execute("SELECT COUNT(*) FROM plugins WHERE status = 'active'").fetchone()[0])
    new_today = int(
        conn.execute("SELECT COUNT(*) FROM plugins WHERE added_at = ?", (day,)).fetchone()[0]
    )
    snapshots = int(conn.execute("SELECT COUNT(*) FROM fetch_runs").fetchone()[0])

    def _top(payload: dict[str, Any], n: int) -> list[dict[str, Any]]:
        return payload["items"][:n]

    return {
        "as_of": day,
        "kpis": {
            "total_stars": total_stars,
            "stars_delta": total_delta,
            "tracked": tracked,
            "new_today": new_today,
            "snapshots": snapshots,
        },
        "top_velocity": _top(board(conn, "velocity", on=day), 5),
        "top_growth": _top(board(conn, "growth", window=7, on=day), 5),
        "top_total": _top(board(conn, "total", on=day), 5),
        "newest": _top(rookie_board(conn, on=day), 3),
    }
