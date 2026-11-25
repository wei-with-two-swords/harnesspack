"""Community API: feed, posts, comments, likes and author pages.

Reads are public; writes require the signed GitHub session cookie. Write
requests also check the Origin header so a third-party site cannot post on a
visitor's behalf.
"""

from __future__ import annotations

import sqlite3
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from .. import auth
from ..db import connect
from ..services import community

router = APIRouter()


class TextBody(BaseModel):
    body: str


def get_conn(request: Request):
    conn = connect(request.app.state.settings.db_path)
    try:
        yield conn
    finally:
        conn.close()


def require_user(request: Request) -> auth.User:
    user = auth.current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="sign in required")
    return user


def check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        return
    allowed = {
        request.url.netloc,
        urlparse(str(request.app.state.settings.base_url)).netloc,
    }
    if urlparse(origin).netloc not in allowed:
        raise HTTPException(status_code=403, detail="invalid origin")


def _viewer_id(conn: sqlite3.Connection, request: Request) -> int | None:
    user = auth.current_user(request)
    return community.find_user_id(conn, user.login) if user else None


def _bad_body(exc: ValueError) -> HTTPException:
    return HTTPException(status_code=422, detail=str(exc))


@router.get("/posts")
def list_posts(
    request: Request,
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    conn: sqlite3.Connection = Depends(get_conn),
):
    return community.list_posts(conn, limit, offset, _viewer_id(conn, request))


@router.post("/posts", status_code=201)
def create_post(
    request: Request,
    payload: TextBody,
    conn: sqlite3.Connection = Depends(get_conn),
):
    check_origin(request)
    user_id = community.ensure_user(conn, require_user(request))
    try:
        return community.create_post(conn, user_id, payload.body)
    except ValueError as exc:
        raise _bad_body(exc) from exc


@router.get("/posts/{post_id}")
def get_post(
    post_id: int,
    request: Request,
    conn: sqlite3.Connection = Depends(get_conn),
):
    post = community.get_post(conn, post_id, _viewer_id(conn, request))
    if post is None:
        raise HTTPException(status_code=404, detail="post not found")
    return post


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    request: Request,
    conn: sqlite3.Connection = Depends(get_conn),
):
    check_origin(request)
    user_id = community.ensure_user(conn, require_user(request))
    if not community.delete_post(conn, post_id, user_id):
        raise HTTPException(status_code=404, detail="post not found")
    return {"ok": True}


@router.get("/posts/{post_id}/comments")
def list_comments(
    post_id: int,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    conn: sqlite3.Connection = Depends(get_conn),
):
    if community.get_post(conn, post_id) is None:
        raise HTTPException(status_code=404, detail="post not found")
    return community.list_comments(conn, post_id, limit, offset)


@router.post("/posts/{post_id}/comments", status_code=201)
def create_comment(
    post_id: int,
    request: Request,
    payload: TextBody,
    conn: sqlite3.Connection = Depends(get_conn),
):
    check_origin(request)
    user_id = community.ensure_user(conn, require_user(request))
    try:
        return community.create_comment(conn, post_id, user_id, payload.body)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="post not found") from exc
    except ValueError as exc:
        raise _bad_body(exc) from exc


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    request: Request,
    conn: sqlite3.Connection = Depends(get_conn),
):
    check_origin(request)
    user_id = community.ensure_user(conn, require_user(request))
    if not community.delete_comment(conn, comment_id, user_id):
        raise HTTPException(status_code=404, detail="comment not found")
    return {"ok": True}


@router.post("/posts/{post_id}/like")
def toggle_like(
    post_id: int,
    request: Request,
    conn: sqlite3.Connection = Depends(get_conn),
):
    check_origin(request)
    user_id = community.ensure_user(conn, require_user(request))
    try:
        return community.toggle_like(conn, post_id, user_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="post not found") from exc


@router.get("/users/{login}")
def get_user(
    login: str,
    request: Request,
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    conn: sqlite3.Connection = Depends(get_conn),
):
    profile = community.get_user_profile(
        conn, login, _viewer_id(conn, request), limit, offset
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="user not found")
    return profile
