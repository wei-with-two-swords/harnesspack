"""Lightweight per-IP rate limiting.

The site is public and cacheable, so the goal is not bullet-proof abuse
prevention but a clear, cheap brake on bulk scraping: normal browsing and
embeds stay untouched, while a single IP hammering the JSON API or the
image endpoints gets ``429`` with ``Retry-After``.

State is in-process on purpose (single uvicorn worker, ~11k plugins): no
Redis dependency for a 1C1G box. Restarting the API resets the counters.
"""

from __future__ import annotations

import time
from collections import deque

from fastapi import Request
from starlette.responses import JSONResponse

#: Paths that never count against a visitor's quota.
EXEMPT_PATHS = frozenset(
    {
        "/api/v1/health",
        "/robots.txt",
        "/sitemap.xml",
        "/favicon.svg",
    }
)

#: Image endpoints are much more expensive than JSON, so they get their own,
#: smaller bucket (a social crawler fetching a preview must not drain the API).
OG_PREFIX = "/og/"

MAX_TRACKED_CLIENTS = 20_000


class SlidingWindowLimiter:
    """Count hits in the last ``window`` seconds for each key."""

    def __init__(self, limit: int, window: float = 60.0) -> None:
        self.limit = max(1, int(limit))
        self.window = window
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str, now: float | None = None) -> tuple[bool, int]:
        """Return ``(allowed, retry_after_seconds)``."""
        moment = time.monotonic() if now is None else now
        bucket = self._hits.get(key)
        if bucket is None:
            if len(self._hits) >= MAX_TRACKED_CLIENTS:
                self._drop_stale(moment)
            bucket = self._hits[key] = deque()
        cutoff = moment - self.window
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= self.limit:
            retry_after = max(1, int(bucket[0] + self.window - moment) + 1)
            return False, retry_after
        bucket.append(moment)
        return True, 0

    def _drop_stale(self, now: float) -> None:
        cutoff = now - self.window
        stale = [key for key, bucket in self._hits.items() if not bucket or bucket[-1] <= cutoff]
        for key in stale:
            self._hits.pop(key, None)


def client_ip(request: Request) -> str:
    """Best-effort client IP behind Cloudflare and nginx.

    ``CF-Connecting-IP`` is set by Cloudflare and cannot be spoofed by the
    visitor; nginx fills ``X-Forwarded-For``/``X-Real-IP`` for direct access.
    """
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else "unknown"


def install_rate_limit(app, *, general_per_minute: int, og_per_minute: int) -> None:
    """Attach the middleware to ``app`` (no-op when limits are disabled)."""
    general = SlidingWindowLimiter(general_per_minute)
    images = SlidingWindowLimiter(og_per_minute)

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or path.startswith("/assets/") or path in EXEMPT_PATHS:
            return await call_next(request)

        limiter = images if path.startswith(OG_PREFIX) else general

        # Badge SVGs are cheap and embedded in READMEs; keep them in the
        # general bucket but skip counting them entirely for tiny images.
        key = f"{client_ip(request)}:{'img' if limiter is images else 'api'}"
        allowed, retry_after = limiter.check(key)
        if not allowed:
            return JSONResponse(
                {
                    "detail": "rate limit exceeded",
                    "limit": limiter.limit,
                    "window_seconds": int(limiter.window),
                    "retry_after": retry_after,
                },
                status_code=429,
                headers={"Retry-After": str(retry_after), "Cache-Control": "no-store"},
            )
        return await call_next(request)
