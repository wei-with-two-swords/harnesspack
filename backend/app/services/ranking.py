"""Ranking queries.

All boards are computed on read from the ``stars`` table, so adding a new board
never requires a migration. Every board returns a list already sorted; the API
layer slices it for pagination.
"""

from __future__ import annotations

import sqlite3
from datetime import date as Date, timedelta
from typing import Any

BOARDS = ("velocity", "growth", "total", "darkhorse", "rookie")
WINDOWS = (7, 30)
GROWTH_MIN_BASE = 50
ROOKIE_DAYS = 30
ROOKIE_MIN_STARS = 10


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
        SELECT p.slug, p.owner, p.repo, p.name, p.description, p.category,
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
    if name in ("growth", "darkhorse") and window not in WINDOWS:
        raise BoardError(f"window must be one of {WINDOWS}")
    day = on or latest_date(conn)
    if day is None:
        return _empty(name, None, window if name in ("growth", "darkhorse") else None, "no snapshots")

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


def get_board(
    conn: sqlite3.Connection,
    name: str,
    window: int = 7,
    on: str | None = None,
    category: str | None = None,
) -> dict[str, Any]:
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


def list_plugins(
    conn: sqlite3.Connection,
    query: str | None = None,
    harness: str | None = None,
    category: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
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
    total = int(
        conn.execute(f"SELECT COUNT(*) FROM plugins WHERE {clause}", params).fetchone()[0]
    )
    rows = conn.execute(
        f"SELECT slug, name, owner, repo, description, category, harness, url, "
        f"stars_latest, stars_at, repo_created_at, archived FROM plugins WHERE {clause} "
        f"ORDER BY stars_latest DESC NULLS LAST, name COLLATE NOCASE, slug LIMIT ? OFFSET ?",
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
