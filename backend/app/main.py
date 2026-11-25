"""FastAPI application factory.

On startup the schema is created and every snapshot file is ingested
(idempotent), so a fresh server only needs ``data/snapshots`` to come up.
The built SPA in ``frontend/dist`` is served from the same port.

For crawlers the SPA shell is rewritten per route with title, description,
canonical link, social cards and JSON-LD (see :mod:`backend.app.seo`).
"""

from __future__ import annotations

import re
from contextlib import asynccontextmanager
from html import escape as html_escape
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from . import auth, seo
from .api.auth import router as auth_router
from .api.community import router as community_router
from .api.meta import router as meta_router
from .api.site import router as site_router
from .api.v1 import router as v1_router
from .config import Settings, get_settings
from .db import connect, init_db
from .rate_limit import install_rate_limit
from .services import community, ranking
from .services.ingest import ingest

_META_RE = re.compile(
    r'\s*<meta\s+(?:property="og:[^"]*"|name="(?:twitter:[^"]*|description|robots)")[^>]*>'
)
_CANONICAL_RE = re.compile(r'\s*<link\s+rel="canonical"[^>]*>')
_JSONLD_RE = re.compile(r'\s*<script\s+type="application/ld\+json">.*?</script>', re.S)
_TITLE_RE = re.compile(r"<title>.*?</title>", re.S)


def _render_shell(
    html: str,
    *,
    title: str,
    description: str,
    canonical: str | None,
    image: str,
    robots: str,
    jsonld: list[dict[str, Any]],
) -> str:
    html = _TITLE_RE.sub(lambda _match: f"<title>{html_escape(title)}</title>", html, count=1)
    html = _META_RE.sub("", html)
    html = _CANONICAL_RE.sub("", html)
    html = _JSONLD_RE.sub("", html)
    block = seo.build_tags(
        title=title,
        description=description,
        canonical=canonical,
        image=image,
        robots=robots,
        jsonld=jsonld,
    )
    return html.replace("</head>", f"    {block}\n  </head>", 1)


def _meta(
    *,
    title: str,
    description: str,
    canonical: str | None,
    image: str,
    robots: str = "index,follow",
    jsonld: list[dict[str, Any]] | None = None,
    status: int = 200,
) -> dict[str, Any]:
    return {
        "title": title,
        "description": description,
        "canonical": canonical,
        "image": image,
        "robots": robots,
        "jsonld": jsonld or [],
        "status": status,
    }


def _not_found(base: str, title: str, description: str) -> dict[str, Any]:
    return _meta(
        title=title,
        description=description,
        canonical=None,
        image=f"{base}/og/site.png",
        robots="noindex,follow",
        status=404,
    )


def _day_range(conn) -> tuple[str | None, str | None]:
    row = conn.execute("SELECT MIN(date) AS first, MAX(date) AS last FROM stars").fetchone()
    if not row:
        return None, None
    return row["first"], row["last"]


def _route_meta(conn, path: str, base: str) -> dict[str, Any]:
    image = f"{base}/og/site.png"
    first_day, last_day = _day_range(conn)

    if path == "":
        return _meta(
            title=seo.SITE_TITLE,
            description=seo.SITE_DESCRIPTION,
            canonical=f"{base}/",
            image=image,
            jsonld=seo.website_jsonld(base, first_day, last_day),
        )

    if path.startswith("plugins/"):
        parts = path.split("/")
        if len(parts) != 2 or not parts[1]:
            return _not_found(base, "页面未找到 · HarnessPack", "这个地址不存在。")
        slug = parts[1]
        detail = ranking.plugin_detail(conn, slug)
        if detail is None:
            return _not_found(
                base,
                "插件未找到 · HarnessPack",
                "这个插件不在当前名单里，可能已被上游移除、改名或从未收录。",
            )
        canonical = f"{base}/plugins/{detail['slug']}"
        return _meta(
            title=f"{detail['name']} · {detail['owner']}/{detail['repo']} · HarnessPack",
            description=seo.truncate(detail.get("description")),
            canonical=canonical,
            image=f"{base}/og/{detail['slug']}.png",
            jsonld=seo.plugin_jsonld(detail, base),
        )

    if path == "compare":
        return _meta(
            title="插件对比 · HarnessPack",
            description="把 2-5 个 DSH 插件放在同一张 star 曲线上对比，缺快照的日子留空、不插值。",
            canonical=f"{base}/compare",
            image=image,
            robots="noindex,follow",
        )

    if path.startswith("community/p/"):
        parts = path.split("/")
        if len(parts) != 3 or not parts[2].isdigit():
            return _not_found(base, "帖子未找到 · HarnessPack", "这条帖子不存在或已被删除。")
        post = community.get_post(conn, int(parts[2]))
        if post is None:
            return _not_found(base, "帖子未找到 · HarnessPack", "这条帖子不存在或已被删除。")
        return _meta(
            title=f"{post['author']['login']} · DSH 讨论区 · HarnessPack",
            description=seo.truncate(post["body"]),
            canonical=f"{base}/community/p/{post['id']}",
            image=image,
        )

    if path.startswith("community/u/"):
        parts = path.split("/")
        if len(parts) != 3 or not parts[2]:
            return _not_found(base, "页面未找到 · HarnessPack", "这个地址不存在。")
        return _meta(
            title=f"@{parts[2]} · DSH 讨论区 · HarnessPack",
            description=f"@{parts[2]} 在 HarnessPack DSH 讨论区发的帖子。",
            canonical=None,
            image=image,
            robots="noindex,follow",
        )

    if path in seo.PAGES:
        label, description = seo.PAGES[path]
        return _meta(
            title=f"{label} · HarnessPack",
            description=description,
            canonical=f"{base}/{path}",
            image=image,
        )

    return _not_found(base, "页面未找到 · HarnessPack", "这个地址不存在。")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        conn = connect(settings.db_path)
        try:
            init_db(conn)
            if settings.ingest_on_startup and settings.snapshot_dir.exists():
                ingest(conn, settings.snapshot_dir, settings.seed_path)
        finally:
            conn.close()
        yield

    app = FastAPI(
        title="HarnessPack API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/v1/docs",
        redoc_url=None,
        openapi_url="/api/v1/openapi.json",
    )
    app.state.settings = settings
    if settings.rate_limit_enabled:
        install_rate_limit(
            app,
            general_per_minute=settings.rate_limit_per_minute,
            og_per_minute=settings.og_rate_limit_per_minute,
            api_anon_per_minute=settings.api_anon_per_minute,
            api_anon_per_day=settings.api_anon_per_day,
            api_auth_per_minute=settings.api_auth_per_minute,
            api_auth_per_day=settings.api_auth_per_day,
            community_read_per_minute=settings.community_read_per_minute,
            community_post_per_minute=settings.community_post_per_minute,
            community_post_per_day=settings.community_post_per_day,
            community_comment_per_minute=settings.community_comment_per_minute,
            community_comment_per_day=settings.community_comment_per_day,
            community_like_per_minute=settings.community_like_per_minute,
            community_like_per_day=settings.community_like_per_day,
        )
    # Registered after the limiter so it runs first and sets request.state.user.
    auth.install_auth(app)
    app.include_router(auth_router, prefix="/api/auth")
    app.include_router(community_router, prefix="/api/community")
    app.include_router(v1_router, prefix="/api/v1")
    app.include_router(meta_router)
    app.include_router(site_router)

    dist = Path(settings.frontend_dist)
    if dist.exists():
        assets = dist / "assets"
        if assets.exists():
            app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")
        dist_root = dist.resolve()

        index_file = dist_root / "index.html"

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa(full_path: str, request: Request):
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="not found")
            candidate = (dist_root / full_path).resolve()
            if candidate.is_file() and dist_root in candidate.parents:
                return FileResponse(candidate)
            if not index_file.is_file():
                raise HTTPException(status_code=404, detail="not found")
            html = index_file.read_text(encoding="utf-8")
            # Derive canonical/social URLs from the configured site root, never
            # from the request Host header (host-header injection would let a
            # forged request poison cached canonical/og:url tags).
            base = settings.base_url.rstrip("/")
            path = full_path.strip("/")
            conn = connect(settings.db_path)
            try:
                meta = _route_meta(conn, path, base)
            finally:
                conn.close()
            html = _render_shell(
                html,
                title=meta["title"],
                description=meta["description"],
                canonical=meta["canonical"],
                image=meta["image"],
                robots=meta["robots"],
                jsonld=meta["jsonld"],
            )
            return Response(content=html, media_type="text/html", status_code=meta["status"])

    return app


app = create_app()
