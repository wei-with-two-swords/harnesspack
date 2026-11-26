"""Bing IndexNow push: tell crawlers which plugin pages changed today.

One push per day through ``push_log`` (the timer may refire after a reboot).
URL selection is deliberately modest — the pages that actually change are
the plugin pages with a fresh snapshot delta, so we push the velocity Top200
plus recently added plugins, capped to keep the request small.
"""

from __future__ import annotations

import json
import sqlite3
import urllib.error
import urllib.request
from datetime import date as Date, datetime, timedelta, timezone
from urllib.parse import urlparse

from ..config import Settings

ENDPOINT = "https://api.indexnow.org/IndexNow"
MAX_URLS = 500
RECENT_DAYS = 3


class PushError(RuntimeError):
    pass


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def build_urls(conn: sqlite3.Connection, base_url: str) -> list[str]:
    base = base_url.rstrip("/")
    urls = [
        f"{base}/",
        f"{base}/changelog",
        f"{base}/about",
        f"{base}/api",
        f"{base}/community",
        f"{base}/compare",
        f"{base}/subscribe",
    ]
    seen: set[str] = set(urls)

    rows = conn.execute(
        """SELECT p.slug FROM plugins p
           LEFT JOIN stars s ON s.plugin_id = p.id AND s.date = (
               SELECT MAX(date) FROM stars
           )
           WHERE p.status = 'active'
           ORDER BY (s.delta IS NULL), s.delta DESC, p.stars_latest DESC
           LIMIT 200"""
    ).fetchall()
    cutoff = (Date.today() - timedelta(days=RECENT_DAYS)).isoformat()
    for row in rows:
        slug = row["slug"]
        if slug not in seen:
            urls.append(f"{base}/plugins/{slug}")
            seen.add(slug)

    # Newly added plugins may sit outside the velocity top ranks.
    recent = conn.execute(
        "SELECT slug FROM plugins WHERE status = 'active' AND added_at >= ? "
        "ORDER BY added_at DESC LIMIT 100",
        (cutoff,),
    ).fetchall()
    for row in recent:
        slug = row["slug"]
        if slug not in seen:
            urls.append(f"{base}/plugins/{slug}")
            seen.add(slug)

    return urls[:MAX_URLS]


def _post(payload: dict) -> tuple[int, str]:
    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, response.read(200).decode("utf-8", "replace").strip()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(200).decode("utf-8", "replace").strip()
    except (urllib.error.URLError, OSError) as exc:
        raise PushError(f"IndexNow request failed: {exc}") from exc


def push(conn: sqlite3.Connection, settings: Settings, force: bool = False) -> dict:
    if not settings.indexnow_key:
        return {"status": "skipped", "reason": "HARNESSPACK_INDEXNOW_KEY is not set"}
    today = utc_now()[:10]
    if not force:
        already = conn.execute(
            "SELECT status FROM push_log WHERE kind = 'indexnow' AND date = ?", (today,)
        ).fetchone()
        if already:
            return {"status": "already", "date": today, "last_status": already["status"]}

    base = settings.base_url.rstrip("/")
    urls = build_urls(conn, base)
    host = urlparse(base).netloc
    payload = {
        "host": host,
        "key": settings.indexnow_key,
        "keyLocation": f"{base}/{settings.indexnow_key}.txt",
        "urlList": urls,
    }
    code, body = _post(payload)
    status = "ok" if code in (200, 202) else f"http-{code}"
    conn.execute(
        "INSERT INTO push_log (kind, date, sent_at, urls, status) VALUES ('indexnow', ?, ?, ?, ?) "
        "ON CONFLICT(kind, date) DO UPDATE SET sent_at = excluded.sent_at, "
        "urls = excluded.urls, status = excluded.status",
        (today, utc_now(), len(urls), status),
    )
    conn.commit()
    return {"status": status, "date": today, "urls": len(urls), "code": code, "detail": body}
