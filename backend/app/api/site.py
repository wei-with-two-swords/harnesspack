"""Crawler-facing files served from the root domain: robots.txt and sitemap.xml."""

from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from ..db import connect
from ..services import ranking

router = APIRouter()


def get_conn(request: Request):
    settings = request.app.state.settings
    conn = connect(settings.db_path)
    try:
        yield conn
    finally:
        conn.close()


def _base_url(request: Request) -> str:
    # Use the configured root, not the request Host header, so a forged Host
    # cannot poison sitemap.xml or robots.txt URLs served to crawlers.
    return request.app.state.settings.base_url.rstrip("/")


def _url_entry(loc: str, lastmod: str | None) -> str:
    entry = f"  <url><loc>{loc}</loc>"
    if lastmod:
        entry += f"<lastmod>{lastmod}</lastmod>"
    return entry + "</url>"


@router.get("/robots.txt", include_in_schema=False)
def robots(request: Request) -> Response:
    body = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /api/\n"
        f"Sitemap: {_base_url(request)}/sitemap.xml\n"
    )
    return Response(body, media_type="text/plain; charset=utf-8")


@router.get("/sitemap.xml", include_in_schema=False)
def sitemap(request: Request, conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    base = _base_url(request)
    lastmod = ranking.latest_date(conn)
    urls = [_url_entry(f"{base}/", lastmod)]
    rows = conn.execute(
        "SELECT slug FROM plugins WHERE status = 'active' ORDER BY slug"
    ).fetchall()
    urls += [_url_entry(f"{base}/plugins/{row['slug']}", lastmod) for row in rows]
    urls += [
        _url_entry(f"{base}/about", lastmod),
        _url_entry(f"{base}/changelog", lastmod),
        _url_entry(f"{base}/api", lastmod),
        _url_entry(f"{base}/community", lastmod),
    ]
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(body, media_type="application/xml; charset=utf-8")
