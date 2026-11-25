"""Share/embed endpoints: SVG badge, OG image and RSS feed.

Everything here is derived from the same snapshot data as the API; nothing is
stored separately, so a board change is reflected on the next request. OG images
are cached on disk with a content hash and bounded, serialized generation (see
:mod:`backend.app.og_cache`) so a crawler sweep cannot exhaust worker memory.
"""

from __future__ import annotations

import io
import sqlite3
from datetime import datetime, timezone
from functools import lru_cache
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from .. import og_cache
from ..db import connect
from ..services import changelog as changelog_service
from ..services import ranking

router = APIRouter(tags=["meta"], include_in_schema=False)

BLUE = "#4cc9f0"
INK = "#070b10"
SURFACE = "#0e141c"
LINE = "#1e2a3a"
MUTED = "#8b9bb4"
WHITE = "#dbe6f3"
RISE = "#4ade80"
FALL = "#f87171"
GOLD = "#f5b544"

_FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
]


@lru_cache(maxsize=32)
def _font(size: int):
    """Font objects are immutable and safe to share across render threads.

    Without this cache every draw call re-reads a TTF file; a burst of OG
    renders loaded the same font hundreds of times and spiked worker memory.
    """
    from PIL import ImageFont

    for candidate in _FONTS:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default(size=size)


def _ascii(text: str, limit: int = 48) -> str:
    cleaned = "".join(ch if 32 <= ord(ch) < 127 else " " for ch in text)
    cleaned = " ".join(cleaned.split())
    return cleaned[:limit].rstrip() if cleaned else ""


def get_conn(request: Request):
    settings = request.app.state.settings
    conn = connect(settings.db_path)
    try:
        yield conn
    finally:
        conn.close()


def _badge_svg(label: str, value: str) -> Response:
    width = 96 + 7 * max(len(label), 0) + 8 * len(value)
    label_w = width - (18 + 7 * len(value))
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="24" role="img" aria-label="{xml_escape(label)}: {xml_escape(value)}">
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#1c2735"/><stop offset="1" stop-color="#0e141c"/></linearGradient>
<rect width="{width}" height="24" rx="4" fill="url(#s)"/>
<rect x="{label_w}" width="{width - label_w}" height="24" rx="4" fill="{INK}"/>
<rect x="{label_w}" width="6" height="24" fill="{INK}"/>
<g font-family="Verdana,DejaVu Sans,Geneva,sans-serif" font-size="11" fill="{WHITE}">
<text x="8" y="16">{xml_escape(label)}</text>
<text x="{label_w + 8}" y="16" fill="{BLUE}" font-weight="bold">{xml_escape(value)}</text>
</g>
</svg>"""
    return Response(content=svg, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=900"})


@router.get("/badge/{slug}.svg")
def badge(slug: str, conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    detail = ranking.plugin_detail(conn, slug)
    if detail is None:
        return _badge_svg("HarnessPack", "not listed")
    if detail["status"] == "exited":
        return _badge_svg("HarnessPack", "exited")
    if not detail["available"] or detail["stars"] is None:
        return _badge_svg("HarnessPack", "unavailable")
    parts = [f"#{detail['rank_total']}" if detail["rank_total"] else "unranked"]
    if detail.get("delta"):
        parts.append(f"{detail['delta']:+d}")
    return _badge_svg("HarnessPack", " · ".join(parts))


@router.get("/og/site.png")
@og_cache.guard
def og_site(request: Request, conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    """Site-wide social card used by the home page and every non-plugin route."""
    from PIL import Image, ImageDraw

    day = ranking.latest_date(conn) or "unknown"
    row = conn.execute(
        "SELECT COUNT(*) AS plugins, COALESCE(SUM(stars_latest), 0) AS stars FROM plugins WHERE status = 'active'"
    ).fetchone()
    days = conn.execute("SELECT COUNT(DISTINCT date) AS days FROM stars").fetchone()["days"]
    cache_dir = Path(request.app.state.settings.db_path).parent / "cache" / "og"
    cache_dir.mkdir(parents=True, exist_ok=True)
    digest = og_cache.content_key("site", day, row["plugins"], row["stars"], days)
    cached = og_cache.cache_path(cache_dir, "site", day, digest)
    headers = {"Cache-Control": "public, max-age=3600"}
    hit = og_cache.read_cached(cached)
    if hit is not None:
        return Response(content=hit, media_type="image/png", headers=headers)

    def render() -> bytes:
        width, height = 1200, 630
        image = Image.new("RGB", (width, height), INK)
        draw = ImageDraw.Draw(image)
        draw.rectangle([0, 0, width, 6], fill=BLUE)
        draw.text((100, 70), "HarnessPack", font=_font(40), fill=BLUE)
        draw.text((100, 124), "DSH plugin star race / daily snapshot", font=_font(20), fill=MUTED)
        draw.rounded_rectangle([60, 180, 1140, 470], radius=24, fill=SURFACE, outline=LINE, width=2)

        stats = [
            ("PLUGINS TRACKED", f"{row['plugins']:,}"),
            ("TOTAL STARS", f"{row['stars']:,}"),
            ("SNAPSHOT DAYS", str(days)),
        ]
        x = 100
        for label, value in stats:
            draw.text((x, 220), label, font=_font(18), fill=MUTED)
            draw.text((x, 252), value, font=_font(72), fill=WHITE)
            x += 340

        draw.text((100, 380), "Ranks by real star growth, not by ads.", font=_font(22), fill=GOLD)
        draw.text((100, 600), f"harnesspack.dev · {day}", font=_font(16), fill=MUTED)

        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()

    payload = og_cache.render_once(cached, render)
    og_cache.prune(cache_dir)
    return Response(content=payload, media_type="image/png", headers=headers)


@router.get("/og/{slug}.png")
@og_cache.guard
def og_image(slug: str, request: Request, conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    from PIL import Image, ImageDraw

    detail = ranking.plugin_detail(conn, slug)
    if detail is None:
        raise HTTPException(status_code=404, detail="plugin not found")
    day = detail.get("as_of") or "unknown"
    cache_dir = Path(request.app.state.settings.db_path).parent / "cache" / "og"
    cache_dir.mkdir(parents=True, exist_ok=True)
    digest = og_cache.content_key(
        slug,
        detail.get("name"),
        detail.get("owner"),
        detail.get("repo"),
        detail.get("stars"),
        detail.get("delta"),
        detail.get("rank_total"),
        detail.get("category"),
        day,
    )
    cached = og_cache.cache_path(cache_dir, slug, day, digest)
    headers = {"Cache-Control": "public, max-age=3600"}
    hit = og_cache.read_cached(cached)
    if hit is not None:
        return Response(content=hit, media_type="image/png", headers=headers)

    def render() -> bytes:
        width, height = 1200, 630
        image = Image.new("RGB", (width, height), INK)
        draw = ImageDraw.Draw(image)
        draw.rectangle([0, 0, width, 6], fill=BLUE)
        draw.rounded_rectangle([60, 140, 1140, 520], radius=24, fill=SURFACE, outline=LINE, width=2)

        title = _ascii(detail["name"], 26) or f"{detail['owner']}/{detail['repo']}"
        repo = _ascii(f"{detail['owner']}/{detail['repo']}", 40)
        draw.text((100, 70), "HarnessPack", font=_font(34), fill=BLUE)
        draw.text((100, 112), "DSH plugin star race / daily snapshot", font=_font(18), fill=MUTED)
        draw.text((100, 180), title, font=_font(64), fill=WHITE)
        draw.text((100, 280), repo, font=_font(26), fill=MUTED)

        stars = detail.get("stars")
        draw.text((100, 360), "STARS" if stars is not None else "STARS (unavailable)", font=_font(20), fill=MUTED)
        draw.text((100, 392), f"{stars:,}" if stars is not None else "—", font=_font(88), fill=WHITE)

        stats: list[tuple[str, str, str]] = []
        if detail.get("rank_total"):
            stats.append(("TOTAL RANK", f"#{detail['rank_total']}", GOLD))
        delta = detail.get("delta")
        if delta is not None:
            stats.append(("TODAY", f"{delta:+d}", RISE if delta > 0 else FALL))
        if detail.get("category"):
            stats.append(("CATEGORY", _ascii(detail["category"], 14), BLUE))
        x = 100
        for label, value, color in stats[:3]:
            draw.text((x, 570 - 60), label, font=_font(18), fill=MUTED)
            draw.text((x, 570 - 36), value, font=_font(34), fill=color)
            x += 300

        draw.text((100, 600), f"harnesspack.dev · {day}", font=_font(16), fill=MUTED)

        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()

    payload = og_cache.render_once(cached, render)
    og_cache.prune(cache_dir)
    return Response(content=payload, media_type="image/png", headers=headers)


@router.get("/feed.xml")
def feed(request: Request, conn: sqlite3.Connection = Depends(get_conn)) -> Response:
    base = request.app.state.settings.base_url.rstrip("/")
    day = ranking.latest_date(conn)
    items: list[str] = []

    if day:
        velocity = ranking.get_board(conn, "velocity")["items"][:20]
        published = datetime.fromisoformat(f"{day}T00:10:00+00:00")
        for item in velocity:
            title = f"{item['name']} 今日 +{item['delta']} star"
            link = f"{base}/plugins/{item['slug']}"
            items.append(
                "<item>"
                f"<title>{xml_escape(title)}</title>"
                f"<link>{xml_escape(link)}</link>"
                f"<guid isPermaLink=\"false\">hp-{xml_escape(item['slug'])}-{xml_escape(day)}</guid>"
                f"<pubDate>{format_datetime(published)}</pubDate>"
                f"<description>{xml_escape(item['description'] or '')}</description>"
                "</item>"
            )

    for entry in changelog_service.recent(limit=5):
        at = entry.get("at") or ""
        try:
            stamp = datetime.fromisoformat(at)
        except ValueError:
            stamp = datetime.now(timezone.utc)
        title = (
            f"名单更新：+{entry.get('added', 0)} / -{entry.get('removed', 0)}"
            f" / ~{entry.get('changed', 0)}"
        )
        items.append(
            "<item>"
            f"<title>{xml_escape(title)}</title>"
            f"<link>{xml_escape(base + '/changelog')}</link>"
            f"<guid isPermaLink=\"false\">hp-changelog-{xml_escape(at)}</guid>"
            f"<pubDate>{format_datetime(stamp)}</pubDate>"
            "<description>上游清单同步结果</description>"
            "</item>"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<rss version="2.0"><channel>'
        "<title>HarnessPack · DSH 插件榜单</title>"
        f"<link>{xml_escape(base)}/</link>"
        "<description>每日一次 GitHub star 快照，按真实增量排名</description>"
        "<language>zh-CN</language>"
        + "".join(items)
        + "</channel></rss>"
    )
    return Response(content=xml, media_type="application/rss+xml; charset=utf-8", headers={"Cache-Control": "public, max-age=900"})
