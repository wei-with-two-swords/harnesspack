"""In-site community notifications: mentions, replies and likes.

Notification rows are written inside the same transaction as the event that
produces them (posts/comments/likes), so a failed insert never leaves a
notification without its source event.
"""

from __future__ import annotations

import sqlite3
from typing import Any

EXCERPT_LENGTH = 120


def _excerpt(text: str) -> str:
    collapsed = " ".join(text.split())
    return collapsed[:EXCERPT_LENGTH] + ("…" if len(collapsed) > EXCERPT_LENGTH else "")


def notify(
    conn: sqlite3.Connection,
    user_id: int,
    actor_id: int | None,
    kind: str,
    post_id: int,
    comment_id: int | None = None,
) -> None:
    """Insert one notification unless the actor notifies themselves or an
    identical row already exists (e.g. a like toggled off and on again)."""
    if actor_id is not None and actor_id == user_id:
        return
    existing = conn.execute(
        "SELECT 1 FROM notifications "
        "WHERE user_id = ? AND actor_id IS ? AND kind = ? AND post_id = ? "
        "AND comment_id IS ?",
        (user_id, actor_id, kind, post_id, comment_id),
    ).fetchone()
    if existing:
        return
    from .community import utc_now

    conn.execute(
        "INSERT INTO notifications (user_id, actor_id, kind, post_id, comment_id, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, actor_id, kind, post_id, comment_id, utc_now()),
    )


def unread_count(conn: sqlite3.Connection, user_id: int) -> int:
    row = conn.execute(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0", (user_id,)
    ).fetchone()
    return int(row[0])


def list_notifications(
    conn: sqlite3.Connection, user_id: int, limit: int = 20, offset: int = 0
) -> dict[str, Any]:
    rows = conn.execute(
        """SELECT n.id, n.kind, n.post_id, n.comment_id, n.created_at, n.is_read,
                  a.login AS actor_login, a.nickname AS actor_name, a.avatar_url AS actor_avatar,
                  COALESCE(c.body, p.body) AS excerpt
           FROM notifications n
           LEFT JOIN users a ON a.id = n.actor_id
           JOIN posts p ON p.id = n.post_id
           LEFT JOIN comments c ON c.id = n.comment_id
           WHERE n.user_id = ?
           ORDER BY n.id DESC LIMIT ? OFFSET ?""",
        (user_id, limit, offset),
    ).fetchall()
    total = conn.execute(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ?", (user_id,)
    ).fetchone()[0]
    return {
        "items": [
            {
                "id": int(row["id"]),
                "kind": row["kind"],
                "post_id": int(row["post_id"]),
                "comment_id": int(row["comment_id"]) if row["comment_id"] else None,
                "created_at": row["created_at"],
                "is_read": bool(row["is_read"]),
                "actor": (
                    {
                        "login": row["actor_login"],
                        "name": row["actor_name"],
                        "avatar_url": row["actor_avatar"],
                    }
                    if row["actor_login"]
                    else None
                ),
                "excerpt": _excerpt(row["excerpt"]),
            }
            for row in rows
        ],
        "total": int(total),
        "unread": unread_count(conn, user_id),
    }


def mark_all_read(conn: sqlite3.Connection, user_id: int) -> int:
    cursor = conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", (user_id,)
    )
    conn.commit()
    return cursor.rowcount
