"""Versioned public API. Everything lives under /api/v1."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..db import connect
from ..services import changelog as changelog_service
from ..services import status as status_service
from ..services import ranking

router = APIRouter()


def get_conn(request: Request):
    settings = request.app.state.settings
    conn = connect(settings.db_path)
    try:
        yield conn
    finally:
        conn.close()


@router.get("/health")
def health(conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    day = ranking.latest_date(conn)
    plugins = int(conn.execute("SELECT COUNT(*) FROM plugins").fetchone()[0])
    stars = int(conn.execute("SELECT COUNT(*) FROM stars").fetchone()[0])
    days = int(conn.execute("SELECT COUNT(DISTINCT date) FROM stars").fetchone()[0])
    exited = int(
        conn.execute("SELECT COUNT(*) FROM plugins WHERE status = 'exited'").fetchone()[0]
    )
    return {
        "status": "ok" if day else "starting",
        "as_of": day,
        "plugins": plugins,
        "stars": stars,
        "days": days,
        "exited": exited,
    }


@router.get("/status")
def status(request: Request, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    settings = request.app.state.settings
    seed_count = 0
    try:
        import json

        seed = json.loads(Path(settings.seed_path).read_text(encoding="utf-8"))
        seed_count = len(seed.get("plugins") or [])
    except (OSError, ValueError):
        seed_count = 0
    snapshots = status_service.snapshot_status(Path(settings.snapshot_dir), seed_count)
    database = status_service.database_status(conn)
    latest_changelog = changelog_service.recent(1)
    return {
        "snapshots": snapshots,
        "database": database,
        "last_catalog_sync": latest_changelog[0] if latest_changelog else None,
    }


@router.get("/dashboard")
def dashboard(conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    return ranking.dashboard(conn)


@router.get("/categories")
def categories(conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    return ranking.categories(conn)


@router.get("/rankings/{board_name}")
def rankings(
    board_name: str,
    window: int = Query(7),
    category: str | None = Query(None, max_length=40),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    try:
        payload = ranking.get_board(conn, board_name, window=window, category=category)
    except ranking.BoardError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    items = payload["items"]
    return {
        **payload,
        "items": items[offset : offset + limit],
        "total": len(items),
    }


@router.get("/plugins")
def plugins(
    query: str | None = Query(None, max_length=80),
    harness: str | None = Query(None, max_length=20),
    category: str | None = Query(None, max_length=40),
    sort: str = Query("stars"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    if sort not in ranking.PLUGIN_SORTS:
        raise HTTPException(status_code=400, detail="unknown sort")
    items, total = ranking.list_plugins(
        conn,
        query=query,
        harness=harness,
        category=category,
        limit=limit,
        offset=offset,
        sort=sort,
    )
    return {"items": items, "total": total, "as_of": ranking.latest_date(conn)}


@router.get("/changelog")
def changelog(
    limit: int = Query(50, ge=1, le=200),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    entries = changelog_service.recent(limit=limit)
    return {"items": list(reversed(entries)), "as_of": ranking.latest_date(conn)}


@router.get("/plugins/{slug}")
def plugin_detail(slug: str, conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    detail = ranking.plugin_detail(conn, slug)
    if detail is None:
        raise HTTPException(status_code=404, detail="plugin not found")
    return detail


@router.get("/plugins/{slug}/series")
def plugin_series(
    slug: str,
    days: int = Query(90, ge=1, le=365),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    points = ranking.series(conn, slug, days=days)
    if points is None:
        raise HTTPException(status_code=404, detail="plugin not found")
    return {"slug": slug, "days": days, "as_of": ranking.latest_date(conn), "items": points}


@router.get("/compare")
def compare(
    slugs: str = Query(..., description="comma separated, 2-5 slugs"),
    days: int = Query(90, ge=1, le=365),
    conn: sqlite3.Connection = Depends(get_conn),
) -> dict:
    wanted = [part.strip() for part in slugs.split(",") if part.strip()]
    if not 2 <= len(wanted) <= 5:
        raise HTTPException(status_code=400, detail="compare requires 2-5 slugs")
    if len(set(wanted)) != len(wanted):
        raise HTTPException(status_code=400, detail="slugs must be unique")
    payload = ranking.compare(conn, wanted, days=days)
    if payload is None:
        raise HTTPException(status_code=404, detail="plugin not found")
    return payload


@router.get("/sponsors")
def sponsors(conn: sqlite3.Connection = Depends(get_conn)) -> dict:
    rows = conn.execute(
        """
        SELECT p.slug, p.name, p.owner, p.repo, p.url, s.label
        FROM sponsor_slots s JOIN plugins p ON p.id = s.plugin_id
        WHERE s.status = 'active'
        ORDER BY s.week DESC, p.slug
        """
    ).fetchall()
    return {
        "items": [dict(r) for r in rows],
        "as_of": ranking.latest_date(conn),
        "disclosure": "sponsored",
    }
