"""FastAPI application factory.

On startup the schema is created and every snapshot file is ingested
(idempotent), so a fresh server only needs ``data/snapshots`` to come up.
The built SPA in ``frontend/dist`` is served from the same port.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api.site import router as site_router
from .api.v1 import router as v1_router
from .config import Settings, get_settings
from .db import connect, init_db
from .services.ingest import ingest


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

    app = FastAPI(title="HarnessRank API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.include_router(v1_router, prefix="/api/v1")
    app.include_router(site_router)

    dist = Path(settings.frontend_dist)
    if dist.exists():
        assets = dist / "assets"
        if assets.exists():
            app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")
        dist_root = dist.resolve()

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa(full_path: str):
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="not found")
            candidate = (dist_root / full_path).resolve()
            if candidate.is_file() and dist_root in candidate.parents:
                return FileResponse(candidate)
            index = dist_root / "index.html"
            if index.is_file():
                return FileResponse(index)
            raise HTTPException(status_code=404, detail="not found")

    return app


app = create_app()
