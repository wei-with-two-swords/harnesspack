"""Cheap, per-visitor rate limiting for a single-worker FastAPI box.

Ordinary HTML pages and images keep the old, generous buckets. JSON API
traffic gets a tighter two-tier quota: anonymous visitors share 20/min and
100/day per IP, signed-in GitHub users get 50/min and 500/day per account.
State is in process on purpose: no Redis on a 1C1G machine.
"""

from __future__ import annotations

import time
from collections import deque
from typing import Any

from fastapi import Request
from starlette.responses import JSONResponse

#: Paths that never count against a visitor's quota.
EXEMPT_PATHS = frozenset(
    {
        "/api/v1/health",
        "/robots.txt",
        "/sitemap.xml",
        "/favicon.ico",
        "/favicon-32.png",
        "/favicon-64.png",
        "/favicon-180.png",
        "/whale.png",
    }
)

#: Image endpoints are much more expensive than JSON, so they get their own,
#: smaller bucket (a social crawler fetching a preview must not drain the API).
OG_PREFIX = "/og/"
COMMUNITY_PREFIX = "/api/community/"

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


class DailyLimiter:
    """Count hits per key within the server's local calendar day."""

    def __init__(self, limit: int) -> None:
        self.limit = max(1, int(limit))
        self._days: dict[str, dict[str, int]] = {}

    def check(self, key: str, now: float | None = None) -> tuple[bool, int]:
        moment = time.time() if now is None else now
        day = time.strftime("%Y-%m-%d", time.localtime(moment))
        counts = self._days.get(day)
        if counts is None:
            if len(self._days) > 2:
                for old in sorted(self._days)[:-2]:
                    self._days.pop(old, None)
            counts = self._days[day] = {}
        used = counts.get(key, 0)
        if used >= self.limit:
            tomorrow = time.mktime(time.strptime(day, "%Y-%m-%d")) + 86_400
            return False, max(1, int(tomorrow - moment) + 1)
        counts[key] = used + 1
        return True, 0


def client_ip(request: Request) -> str:
    """Resolve the visitor IP from the nginx-rewritten header only.

    Trust boundary: uvicorn binds to 127.0.0.1, so every production request
    arrives through nginx, which *overwrites* ``X-Real-IP`` with ``$remote_addr``
    on every proxied location. With ngx_http_realip_module configured from the
    Cloudflare IP ranges, ``$remote_addr`` is the real visitor IP; a direct-to-
    origin request is not in those ranges, so it stays the attacker's own IP.
    Either way the caller cannot forge it by sending their own header.

    We deliberately ignore client-supplied ``CF-Connecting-IP`` and
    ``X-Forwarded-For``: both are attacker-controlled when someone bypasses
    Cloudflare and hits the origin directly, and trusting them would let a
    visitor reset the rate-limit bucket at will by changing the header.

    In local development (uvicorn without nginx) these headers are absent, so
    we fall back to the ASGI peer address (127.0.0.1).
    """
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else "unknown"


def _deny(scope: str, limit: int, window_seconds: int, retry_after: int) -> JSONResponse:
    return JSONResponse(
        {
            "detail": "rate limit exceeded",
            "scope": scope,
            "limit": limit,
            "window_seconds": window_seconds,
            "retry_after": retry_after,
        },
        status_code=429,
        headers={"Retry-After": str(retry_after), "Cache-Control": "no-store"},
    )


def install_rate_limit(
    app: Any,
    *,
    general_per_minute: int,
    og_per_minute: int,
    api_anon_per_minute: int = 10,
    api_anon_per_day: int = 50,
    api_auth_per_minute: int = 50,
    api_auth_per_day: int = 500,
    community_read_per_minute: int = 120,
    community_post_per_minute: int = 5,
    community_post_per_day: int = 50,
    community_comment_per_minute: int = 10,
    community_comment_per_day: int = 100,
    community_like_per_minute: int = 30,
    community_like_per_day: int = 300,
) -> None:
    """Attach middleware: page/image brakes plus the two-tier API quota."""
    general = SlidingWindowLimiter(general_per_minute)
    images = SlidingWindowLimiter(og_per_minute)
    anon_minute = SlidingWindowLimiter(api_anon_per_minute)
    anon_day = DailyLimiter(api_anon_per_day)
    auth_minute = SlidingWindowLimiter(api_auth_per_minute)
    auth_day = DailyLimiter(api_auth_per_day)
    community_reads = SlidingWindowLimiter(community_read_per_minute)
    community_buckets = {
        "post": (
            SlidingWindowLimiter(community_post_per_minute),
            DailyLimiter(community_post_per_day),
        ),
        "comment": (
            SlidingWindowLimiter(community_comment_per_minute),
            DailyLimiter(community_comment_per_day),
        ),
        "like": (
            SlidingWindowLimiter(community_like_per_minute),
            DailyLimiter(community_like_per_day),
        ),
    }

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or path.startswith("/assets/") or path in EXEMPT_PATHS:
            return await call_next(request)

        ip = client_ip(request)

        # Community browsing gets its own roomy read bucket. Posting,
        # commenting and liking have independent per-user quotas; deleting
        # your own content is never throttled.
        if path.startswith(COMMUNITY_PREFIX):
            if request.method == "GET":
                allowed, retry_after = community_reads.check(f"{ip}:community-read")
                if not allowed:
                    return _deny(
                        "community-read",
                        community_reads.limit,
                        int(community_reads.window),
                        retry_after,
                    )
                return await call_next(request)
            if request.method == "DELETE":
                return await call_next(request)
            if path.endswith("/comments"):
                scope = "comment"
            elif path.endswith("/like"):
                scope = "like"
            elif path == COMMUNITY_PREFIX + "posts":
                scope = "post"
            else:
                return await call_next(request)
            user = getattr(request.state, "user", None)
            identity = f"user:{user.login}" if user else f"ip:{ip}"
            minute, day = community_buckets[scope]
            minute_ok, minute_retry = minute.check(f"{identity}:{scope}:minute")
            day_ok, day_retry = day.check(f"{identity}:{scope}:day")
            if not minute_ok:
                return _deny(
                    f"community-{scope}-minute", minute.limit, int(minute.window), minute_retry
                )
            if not day_ok:
                return _deny(f"community-{scope}-day", day.limit, 86_400, day_retry)
            return await call_next(request)

        # Sign-in endpoints must stay usable but are not part of the API quota.
        if path.startswith("/api/auth/"):
            allowed, retry_after = general.check(f"{ip}:auth")
            if not allowed:
                return _deny("auth", general.limit, int(general.window), retry_after)
            return await call_next(request)

        if path.startswith("/api/"):
            user = getattr(request.state, "user", None)
            if user is not None:
                identity = f"user:{user.login}"
                minute, day = auth_minute, auth_day
                tier = "authenticated"
            else:
                identity = f"ip:{ip}"
                minute, day = anon_minute, anon_day
                tier = "anonymous"

            minute_ok, minute_retry = minute.check(f"{identity}:minute")
            day_ok, day_retry = day.check(f"{identity}:day")
            if not minute_ok:
                return _deny(f"{tier}-minute", minute.limit, int(minute.window), minute_retry)
            if not day_ok:
                return _deny(f"{tier}-day", day.limit, 86_400, day_retry)
            return await call_next(request)

        if path.startswith(OG_PREFIX):
            allowed, retry_after = images.check(f"{ip}:img")
            if not allowed:
                return _deny("image", images.limit, int(images.window), retry_after)
            return await call_next(request)

        allowed, retry_after = general.check(f"{ip}:page")
        if not allowed:
            return _deny("page", general.limit, int(general.window), retry_after)
        return await call_next(request)
