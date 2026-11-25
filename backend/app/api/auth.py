"""GitHub OAuth endpoints: /api/auth/github, /callback, /me, /logout."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from starlette.responses import JSONResponse, RedirectResponse

from .. import auth

router = APIRouter()


@router.get("/config")
def auth_config(request: Request):
    return {"enabled": auth.oauth_enabled(request.app.state.settings)}


@router.get("/github")
def github_login(request: Request):
    settings = request.app.state.settings
    if not auth.oauth_enabled(settings):
        raise HTTPException(status_code=503, detail="GitHub sign-in is not configured")
    state = auth.new_state()
    return auth.login_redirect(settings, state)


@router.get("/github/callback")
def github_callback(
    request: Request,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
):
    settings = request.app.state.settings
    expected = request.cookies.get(auth.STATE_COOKIE)
    failed = RedirectResponse("/community?auth=error", status_code=302)
    auth.clear_cookie(failed, auth.STATE_COOKIE, settings)

    if error or not code or not auth.state_matches(expected, state):
        return failed

    try:
        user = auth.exchange_code(settings, code)
    except auth.AuthError:
        return failed

    response = RedirectResponse("/community?auth=ok", status_code=302)
    auth.set_cookie(
        response,
        settings,
        auth.make_session(settings.session_secret, user),
        max_age=auth.SESSION_TTL,
    )
    return response


@router.get("/me")
def me(request: Request):
    user = auth.current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="not signed in")
    return user.as_dict()


@router.get("/logout")
def logout(request: Request):
    response = JSONResponse({"ok": True})
    auth.clear_cookie(response, auth.SESSION_COOKIE, request.app.state.settings)
    return response
