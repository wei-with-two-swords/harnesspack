"""Community feed storage: posts, one-level comments and likes.

All writes use short SQLite transactions; reads never create rows. Authors are
created lazily from the signed GitHub session the first time they write.
"""

from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone
from typing import Any

from ..auth import User
from . import notifications as notifs

MAX_POST_LENGTH = 5000
MAX_COMMENT_LENGTH = 1000
MAX_PLUGIN_CARDS = 3

_MENTION_RE = re.compile(
    r"(?<![\w/])@([A-Za-z0-9][A-Za-z0-9_.-]*)/([A-Za-z0-9][A-Za-z0-9_.-]*)"
)
# User mentions: @login outside code fences, not part of a plugin reference
# (@owner/repo) and not glued to a word, slash or e-mail address.
_USER_MENTION_RE = re.compile(r"(?<![\w/@])@([A-Za-z0-9][A-Za-z0-9-]{0,38})(?![/\w-])")
_PLUGIN_PATH_RE = re.compile(
    r"/plugins/([A-Za-z0-9][A-Za-z0-9_.-]*)(?:/([A-Za-z0-9][A-Za-z0-9_.-]*))?"
)
_FENCE_RE = re.compile(r"```.*?```", re.S)
_INLINE_CODE_RE = re.compile(r"`[^`\n]*`")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def validate_body(body: Any, limit: int) -> str:
    if not isinstance(body, str):
        raise ValueError("body must be a string")
    text = body.strip()
    if not text:
        raise ValueError("body must not be empty")
    if len(text) > limit:
        raise ValueError(f"body must be at most {limit} characters")
    return text


def _plugin_refs(body: str) -> list[tuple[str | None, str | None, str | None]]:
    """Collect @owner/name mentions and /plugins/... links outside code fences."""
    text = _FENCE_RE.sub(" ", body)
    refs: list[tuple[str | None, str | None, str | None]] = []
    for owner, repo in _MENTION_RE.findall(text):
        refs.append((owner.lower(), repo.lower(), None))
    for match in _PLUGIN_PATH_RE.finditer(text):
        first, second = match.group(1), match.group(2)
        if second:
            refs.append((first.lower(), second.lower(), None))
        else:
            refs.append((None, None, first.lower()))
    return refs


def plugin_cards(conn: sqlite3.Connection, body: str) -> list[dict[str, Any]]:
    """Resolve text references to local plugin cards; unknown plugins get none."""
    columns = "id, slug, name, owner, repo, description, url, stars_latest, category, harness"
    cards: list[dict[str, Any]] = []
    seen: set[int] = set()
    for owner, repo, slug in _plugin_refs(body):
        if slug:
            row = conn.execute(
                f"SELECT {columns} FROM plugins WHERE slug = ? COLLATE NOCASE AND status = 'active'",
                (slug,),
            ).fetchone()
        else:
            row = conn.execute(
                f"SELECT {columns} FROM plugins "
                "WHERE owner = ? COLLATE NOCASE AND repo = ? COLLATE NOCASE AND status = 'active'",
                (owner, repo),
            ).fetchone()
        if row is None or int(row["id"]) in seen:
            continue
        seen.add(int(row["id"]))
        cards.append(
            {
                "slug": row["slug"],
                "name": row["name"],
                "owner": row["owner"],
                "repo": row["repo"],
                "description": row["description"],
                "url": row["url"],
                "stars_latest": row["stars_latest"],
                "category": row["category"],
                "harness": row["harness"],
            }
        )
        if len(cards) >= MAX_PLUGIN_CARDS:
            break
    return cards


def find_user_id(conn: sqlite3.Connection, login: str) -> int | None:
    row = conn.execute(
        "SELECT id FROM users WHERE login = ? COLLATE NOCASE AND deleted_at IS NULL", (login,)
    ).fetchone()
    return int(row["id"]) if row else None


def _notify_mentions(
    conn: sqlite3.Connection, actor_id: int, text: str, post_id: int, comment_id: int | None
) -> None:
    """Notify registered users @mentioned outside code (same transaction)."""
    fenceless = _INLINE_CODE_RE.sub(" ", _FENCE_RE.sub(" ", text))
    logins = list(dict.fromkeys(_USER_MENTION_RE.findall(fenceless)))
    for login in logins:
        target = find_user_id(conn, login)
        if target is not None:
            notifs.notify(conn, target, actor_id, "mention", post_id, comment_id)


def ensure_user(conn: sqlite3.Connection, user: User) -> int:
    """Create or refresh the local row for a verified GitHub login."""
    nickname = user.name or user.login
    conn.execute(
        """INSERT INTO users (login, nickname, avatar_url, created_at, deleted_at)
           VALUES (?, ?, ?, ?, NULL)
           ON CONFLICT(login) DO UPDATE SET
             nickname = excluded.nickname,
             avatar_url = excluded.avatar_url,
             deleted_at = NULL""",
        (user.login, nickname, user.avatar_url, utc_now()),
    )
    conn.commit()
    user_id = find_user_id(conn, user.login)
    if user_id is None:  # pragma: no cover - the insert above always succeeds
        raise RuntimeError("could not resolve community user")
    return user_id


_POST_SELECT = """
SELECT p.id, p.body, p.created_at,
       u.login AS author_login, u.nickname AS author_name, u.avatar_url AS author_avatar,
       (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS like_count,
       (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_hidden = 0) AS comment_count,
       EXISTS(SELECT 1 FROM post_likes l
              WHERE l.post_id = p.id AND l.user_id = ?) AS liked_by_me
FROM posts p
JOIN users u ON u.id = p.user_id
WHERE p.is_hidden = 0 AND u.deleted_at IS NULL
"""


def _post_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "body": row["body"],
        "plugins": plugin_cards(conn, row["body"]),
        "created_at": row["created_at"],
        "author": {
            "login": row["author_login"],
            "name": row["author_name"],
            "avatar_url": row["author_avatar"],
        },
        "like_count": int(row["like_count"]),
        "comment_count": int(row["comment_count"]),
        "liked_by_me": bool(row["liked_by_me"]),
    }


def _where(user_id: int | None) -> tuple[str, tuple[Any, ...]]:
    if user_id is None:
        return "", ()
    return " AND p.user_id = ?", (user_id,)


def list_posts(
    conn: sqlite3.Connection,
    limit: int = 20,
    offset: int = 0,
    viewer_id: int | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    extra_where, extra_params = _where(user_id)
    total = conn.execute(
        "SELECT COUNT(*) FROM posts p JOIN users u ON u.id = p.user_id "
        "WHERE p.is_hidden = 0 AND u.deleted_at IS NULL" + extra_where,
        extra_params,
    ).fetchone()[0]
    rows = conn.execute(
        _POST_SELECT + extra_where + " ORDER BY p.id DESC LIMIT ? OFFSET ?",
        (viewer_id, *extra_params, limit, offset),
    ).fetchall()
    return {"items": [_post_dict(conn, row) for row in rows], "total": int(total)}


def get_post(conn: sqlite3.Connection, post_id: int, viewer_id: int | None = None) -> dict[str, Any] | None:
    row = conn.execute(
        _POST_SELECT + " AND p.id = ?", (viewer_id, post_id)
    ).fetchone()
    return _post_dict(conn, row) if row else None


def create_post(conn: sqlite3.Connection, user_id: int, body: Any) -> dict[str, Any]:
    text = validate_body(body, MAX_POST_LENGTH)
    cursor = conn.execute(
        "INSERT INTO posts (user_id, body, created_at) VALUES (?, ?, ?)",
        (user_id, text, utc_now()),
    )
    _notify_mentions(conn, user_id, text, int(cursor.lastrowid), None)
    conn.commit()
    post = get_post(conn, int(cursor.lastrowid), user_id)
    if post is None:  # pragma: no cover - the insert above always succeeds
        raise RuntimeError("could not read created post")
    return post


def delete_post(conn: sqlite3.Connection, post_id: int, user_id: int) -> bool:
    cursor = conn.execute("DELETE FROM posts WHERE id = ? AND user_id = ?", (post_id, user_id))
    conn.commit()
    return cursor.rowcount > 0


def _comment_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "post_id": int(row["post_id"]),
        "body": row["body"],
        "plugins": plugin_cards(conn, row["body"]),
        "created_at": row["created_at"],
        "author": {
            "login": row["author_login"],
            "name": row["author_name"],
            "avatar_url": row["author_avatar"],
        },
    }


def list_comments(
    conn: sqlite3.Connection, post_id: int, limit: int = 50, offset: int = 0
) -> dict[str, Any]:
    where = (
        "FROM comments c JOIN users u ON u.id = c.user_id "
        "WHERE c.post_id = ? AND c.is_hidden = 0 AND u.deleted_at IS NULL"
    )
    total = conn.execute("SELECT COUNT(*) " + where, (post_id,)).fetchone()[0]
    rows = conn.execute(
        "SELECT c.id, c.post_id, c.body, c.created_at, "
        "u.login AS author_login, u.nickname AS author_name, u.avatar_url AS author_avatar "
        + where
        + " ORDER BY c.id ASC LIMIT ? OFFSET ?",
        (post_id, limit, offset),
    ).fetchall()
    return {"items": [_comment_dict(conn, row) for row in rows], "total": int(total)}


def create_comment(
    conn: sqlite3.Connection, post_id: int, user_id: int, body: Any
) -> dict[str, Any]:
    text = validate_body(body, MAX_COMMENT_LENGTH)
    post = conn.execute(
        "SELECT user_id FROM posts WHERE id = ? AND is_hidden = 0", (post_id,)
    ).fetchone()
    if post is None:
        raise LookupError("post not found")
    cursor = conn.execute(
        "INSERT INTO comments (post_id, user_id, body, created_at) VALUES (?, ?, ?, ?)",
        (post_id, user_id, text, utc_now()),
    )
    comment_id = int(cursor.lastrowid)
    # Replying on the author's post outranks a mention in the same comment.
    if int(post["user_id"]) != user_id:
        notifs.notify(conn, int(post["user_id"]), user_id, "reply", post_id, comment_id)
    _notify_mentions(conn, user_id, text, post_id, comment_id)
    conn.commit()
    row = conn.execute(
        "SELECT c.id, c.post_id, c.body, c.created_at, "
        "u.login AS author_login, u.nickname AS author_name, u.avatar_url AS author_avatar "
        "FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?",
        (int(cursor.lastrowid),),
    ).fetchone()
    if row is None:  # pragma: no cover - the insert above always succeeds
        raise RuntimeError("could not read created comment")
    return _comment_dict(conn, row)


def delete_comment(conn: sqlite3.Connection, comment_id: int, user_id: int) -> bool:
    cursor = conn.execute(
        "DELETE FROM comments WHERE id = ? AND user_id = ?", (comment_id, user_id)
    )
    conn.commit()
    return cursor.rowcount > 0


def toggle_like(conn: sqlite3.Connection, post_id: int, user_id: int) -> dict[str, Any]:
    post = conn.execute(
        "SELECT user_id FROM posts WHERE id = ? AND is_hidden = 0", (post_id,)
    ).fetchone()
    if post is None:
        raise LookupError("post not found")
    existing = conn.execute(
        "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?", (post_id, user_id)
    ).fetchone()
    try:
        if existing:
            conn.execute(
                "DELETE FROM post_likes WHERE post_id = ? AND user_id = ?", (post_id, user_id)
            )
            liked = False
        else:
            conn.execute(
                "INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)",
                (post_id, user_id, utc_now()),
            )
            notifs.notify(conn, int(post["user_id"]), user_id, "like", post_id)
            liked = True
        conn.commit()
    except sqlite3.IntegrityError:  # concurrent double-like: keep a single row
        conn.rollback()
        liked = True
    count = conn.execute(
        "SELECT COUNT(*) FROM post_likes WHERE post_id = ?", (post_id,)
    ).fetchone()[0]
    return {"liked": liked, "like_count": int(count)}


def get_user_profile(
    conn: sqlite3.Connection, login: str, viewer_id: int | None = None,
    limit: int = 20, offset: int = 0,
) -> dict[str, Any] | None:
    row = conn.execute(
        "SELECT id, login, nickname, avatar_url, created_at FROM users "
        "WHERE login = ? COLLATE NOCASE AND deleted_at IS NULL",
        (login,),
    ).fetchone()
    if row is None:
        return None
    posts = list_posts(conn, limit, offset, viewer_id, user_id=int(row["id"]))
    return {
        "user": {
            "login": row["login"],
            "name": row["nickname"],
            "avatar_url": row["avatar_url"],
            "created_at": row["created_at"],
        },
        "items": posts["items"],
        "total": posts["total"],
    }
