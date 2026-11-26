"""Proxied GitHub avatars.

The ranking pages load 20+ avatars per view straight from github.com, which is
slow or blocked for many mainland visitors. The server reaches GitHub fine, so
this endpoint fetches once, caches on disk for a week, and lets browsers (and
Cloudflare, which caches .png by extension) serve the rest. Unknown users
return 404; the frontend already falls back to an initial-letter avatar.
"""

from __future__ import annotations

import os
import re
import time
from functools import lru_cache
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

router = APIRouter(tags=["avatar"], include_in_schema=False)

# GitHub login charset: alphanumerics and single hyphens, 1-39 chars. The
# strict pattern doubles as path-traversal protection for the cache file name.
_GITHUB_LOGIN = re.compile(r"^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$")
_SIZES = (64, 96, 128, 256)
_MAX_AGE = 7 * 24 * 3600


@lru_cache(maxsize=1024)
def _load(owner: str, size: int, cache_dir: str) -> bytes | None:
    """Fetch and disk-cache one avatar. Called only with a validated owner."""
    path = Path(cache_dir) / f"{owner}-{size}.png"
    now = time.time()
    try:
        if path.is_file() and now - path.stat().st_mtime < _MAX_AGE:
            return path.read_bytes()
    except OSError:
        return None

    try:
        resp = httpx.get(
            f"https://github.com/{owner}.png?size={size}",
            follow_redirects=True,
            timeout=6.0,
            headers={"User-Agent": "harnesspack/1.0 (+https://harnesspack.dev)"},
        )
    except httpx.HTTPError:
        return None
    if resp.status_code != 200 or not resp.content:
        return None

    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    try:
        tmp.write_bytes(resp.content)
        os.replace(tmp, path)
    except OSError:
        return resp.content
    return resp.content


@router.get("/avatar/{owner}.png")
def avatar(owner: str, request: Request, s: int = Query(default=64)) -> Response:
    if not _GITHUB_LOGIN.match(owner):
        raise HTTPException(status_code=404, detail="avatar unavailable")
    size = s if s in _SIZES else 64
    cache_dir = Path(request.app.state.settings.db_path).parent / "cache" / "avatars"
    data = _load(owner, size, str(cache_dir))
    if data is None:
        raise HTTPException(status_code=404, detail="avatar unavailable")
    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": f"public, max-age={_MAX_AGE}"},
    )
