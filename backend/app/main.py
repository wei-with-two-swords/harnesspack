"""FastAPI application factory.

On startup the schema is created and every snapshot file is ingested
(idempotent), so a fresh server only needs ``data/snapshots`` to come up.
The built SPA in ``frontend/dist`` is served from the same port.
"""

from __future__ import annotations

import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from .api.meta import router as meta_router
from .api.site import router as site_router
from .api.v1 import router as v1_router
from .config import Settings, get_settings
from .db import connect, init_db
from .rate_limit import install_rate_limit
from .services import ranking
from .services.ingest import ingest



def _inject_meta(html: str, title: str | None, description: str | None, image: str | None, url: str) -> str:
    """Rewrite the SPA shell for crawlers and social cards.

    The React app sets titles client-side, which social crawlers never execute,
    so the same metadata is injected server-side for shareable routes.
    """
    if title:
        html = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", html, count=1, flags=re.S)
    if description:
        html = re.sub(
            r'<meta name="description" content="[^"]*"',
            f'<meta name="description" content="{description}"',
            html,
            count=1,
        )
    html = re.sub(r'\s*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>', "", html)
    tags = [
        f'<meta property="og:url" content="{url}"',
        f'<meta property="og:type" content="article"',
    ]
    if title:
        tags.append(f'<meta property="og:title" content="{title}"')
    if description:
        tags.append(f'<meta property="og:description" content="{description}"')
    if image:
        tags.append(f'<meta property="og:image" content="{image}"')
        tags.append('<meta name="twitter:card" content="summary_large_image"')
        tags.append(f'<meta name="twitter:image" content="{image}"')
    tags.append('<link rel="alternate" type="application/rss+xml" title="HarnessPack" href="/feed.xml"')
    block = "\n    ".join(
        (tag if tag.endswith(">") else tag + ">") for tag in tags
    )
    return html.replace("</head>", f"    {block}\n  </head>", 1)


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
        )
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
            base = str(request.base_url).rstrip("/")
            title = description = image = None
            if full_path.startswith("plugins/"):
                slug = full_path.split("/", 1)[1]
                conn = connect(settings.db_path)
                try:
                    detail = ranking.plugin_detail(conn, slug)
                finally:
                    conn.close()
                if detail is not None:
                    title = f"{detail['name']} · {detail['owner']}/{detail['repo']} · HarnessPack"
                    description = (detail.get("description") or "DSH 插件 star 竞速榜").replace('"', " ")
                    image = f"{base}/og/{slug}.png"
            elif full_path.startswith("rankings/"):
                title = "榜单 · HarnessPack"
            elif full_path == "categories":
                title = "分类榜 · HarnessPack"
            html = _inject_meta(html, title, description, image, f"{base}/{full_path}")
            return Response(content=html, media_type="text/html")

    return app


app = create_app()
