"""Email digest subscription API: opt-in, confirm, unsubscribe.

POST /api/subscribe       -> store the address and mail a confirmation link
GET  /api/subscribe/confirm?token=...
GET  /api/subscribe/unsubscribe?token=...
    Email-link endpoints redirect back to /subscribe with a status banner.
"""

from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from ..config import Settings
from ..db import connect
from ..services import subscribers
from ..services.mailer import MailError
from .community import check_origin, get_conn

router = APIRouter()


class EmailBody(BaseModel):
    email: str


def _redirect(settings: Settings, status: str) -> RedirectResponse:
    return RedirectResponse(f"{settings.base_url.rstrip('/')}/subscribe?status={status}")


@router.post("", status_code=201)
def subscribe(
    request: Request,
    payload: EmailBody,
    conn: sqlite3.Connection = Depends(get_conn),
):
    check_origin(request)
    settings: Settings = request.app.state.settings
    try:
        return subscribers.subscribe(conn, payload.email, settings)
    except subscribers.SubscribeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except MailError as exc:
        raise HTTPException(status_code=502, detail=f"mail delivery failed: {exc}") from exc


@router.get("/confirm")
def confirm(token: str, request: Request, conn: sqlite3.Connection = Depends(get_conn)):
    settings: Settings = request.app.state.settings
    status = "confirmed" if subscribers.confirm(conn, token) else "invalid"
    return _redirect(settings, status)


@router.get("/unsubscribe")
def unsubscribe(token: str, request: Request, conn: sqlite3.Connection = Depends(get_conn)):
    settings: Settings = request.app.state.settings
    status = "unsubscribed" if subscribers.unsubscribe(conn, token) else "invalid"
    return _redirect(settings, status)
