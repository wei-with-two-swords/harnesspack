"""Minimal GitHub sign-in with signed, stateless session cookies.

There is no user table: the session carries only the GitHub login, display
name and avatar, authenticated with an HMAC secret from the environment.
That keeps the 1C1G box simple while still letting the API tell anonymous and
signed-in visitors apart for rate limiting.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import Request as FastAPIRequest
from starlette.responses import RedirectResponse, Response

SESSION_COOKIE = "hp_session"
STATE_COOKIE = "hp_oauth_state"
SESSION_TTL = 30 * 24 * 3600
STATE_TTL = 10 * 60

AUTH_URL = "https://github.com/login/oauth/authorize"
TOKEN_URL = "https://github.com/login/oauth/access_token"
USER_URL = "https://api.github.com/user"


class AuthError(RuntimeError):
    """Raised when the OAuth exchange fails."""


@dataclass(frozen=True)
class User:
    login: str
    name: str | None = None
    avatar_url: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {"login": self.login, "name": self.name, "avatar_url": self.avatar_url}


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64d(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def make_session(secret: str, user: User, ttl: int = SESSION_TTL) -> str:
    payload = {**user.as_dict(), "exp": int(time.time()) + ttl}
    body = _b64e(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = _b64e(hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{signature}"


def read_session(secret: str, value: str | None) -> User | None:
    if not value or "." not in value or not secret:
        return None
    body, signature = value.split(".", 1)
    expected = _b64e(hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        payload = json.loads(_b64d(body))
        if int(payload["exp"]) <= time.time() or not payload.get("login"):
            return None
        return User(
            login=str(payload["login"]),
            name=payload.get("name"),
            avatar_url=payload.get("avatar_url"),
        )
    except (KeyError, TypeError, ValueError, UnicodeDecodeError):
        return None


def current_user(request: FastAPIRequest) -> User | None:
    return getattr(request.state, "user", None)


def oauth_enabled(settings: Any) -> bool:
    return bool(settings.github_client_id and settings.github_client_secret and settings.session_secret)


def redirect_uri(settings: Any) -> str:
    return f"{settings.base_url.rstrip('/')}/api/auth/github/callback"


def authorization_url(settings: Any, state: str) -> str:
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": redirect_uri(settings),
        "scope": "read:user",
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def exchange_code(settings: Any, code: str) -> User:
    data = urlencode(
        {
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "code": code,
            "redirect_uri": redirect_uri(settings),
        }
    ).encode("ascii")
    token_req = Request(
        TOKEN_URL,
        data=data,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "harnesspack-auth",
        },
        method="POST",
    )
    try:
        with urlopen(token_req, timeout=12) as response:
            token_payload = json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError) as exc:
        raise AuthError("GitHub token exchange failed") from exc

    token = token_payload.get("access_token")
    if not token:
        detail = token_payload.get("error_description") or token_payload.get("error") or "no access token"
        raise AuthError(str(detail))

    user_req = Request(
        USER_URL,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "harnesspack-auth",
        },
    )
    try:
        with urlopen(user_req, timeout=12) as response:
            profile = json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError) as exc:
        raise AuthError("GitHub profile lookup failed") from exc

    login = profile.get("login")
    if not login:
        raise AuthError("GitHub profile has no login")
    return User(
        login=str(login),
        name=profile.get("name"),
        avatar_url=profile.get("avatar_url"),
    )


def new_state() -> str:
    return secrets.token_urlsafe(24)


def state_matches(expected: str | None, actual: str | None) -> bool:
    return bool(expected and actual and hmac.compare_digest(expected, actual))


def set_cookie(
    response: Response, settings: Any, value: str, *, max_age: int, name: str = SESSION_COOKIE
) -> None:
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        httponly=True,
        secure=settings.env == "production",
        samesite="lax",
        path="/",
    )


def clear_cookie(response: Response, name: str, settings: Any) -> None:
    response.delete_cookie(
        name,
        path="/",
        secure=settings.env == "production",
        samesite="lax",
        httponly=True,
    )


def install_auth(app: Any) -> None:
    """Read the signed cookie into ``request.state.user`` before rate limiting."""

    @app.middleware("http")
    async def auth_middleware(request: FastAPIRequest, call_next):
        settings = request.app.state.settings
        request.state.user = read_session(settings.session_secret, request.cookies.get(SESSION_COOKIE))
        return await call_next(request)


def login_redirect(settings: Any, state: str) -> RedirectResponse:
    response = RedirectResponse(authorization_url(settings, state), status_code=302)
    set_cookie(response, settings, state, max_age=STATE_TTL, name=STATE_COOKIE)
    return response
