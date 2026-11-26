"""Email digest subscriptions: double opt-in, token-based unsubscribe.

A row only receives mail once ``confirmed_at`` is set. The same token drives
the unsubscribe link, so no separate credentials are stored.
"""

from __future__ import annotations

import re
import secrets
import sqlite3
from html import escape as html_escape

from ..config import Settings
from . import mailer

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
MAX_EMAIL_LENGTH = 254


class SubscribeError(ValueError):
    pass


def _normalize(email: str) -> str:
    address = email.strip().lower()
    if not address or len(address) > MAX_EMAIL_LENGTH or not EMAIL_RE.match(address):
        raise SubscribeError("invalid email address")
    return address


def _links(base_url: str, token: str) -> tuple[str, str]:
    confirm_url = f"{base_url}/api/subscribe/confirm?token={token}"
    unsubscribe_url = f"{base_url}/api/subscribe/unsubscribe?token={token}"
    return confirm_url, unsubscribe_url


def _confirm_mail(
    settings: Settings, to: str, confirm_url: str, unsubscribe_url: str
) -> None:
    text = (
        "HarnessPack 每日 Top10 订阅确认\n\n"
        "点击下面的链接完成订阅（链接长期有效）：\n"
        f"{confirm_url}\n\n"
        "如果这不是你的操作，请忽略本邮件。\n"
        f"随时退订：{unsubscribe_url}\n"
    )
    html = (
        '<p>点击下面的链接完成 <strong>HarnessPack 每日 Top10</strong> 订阅：</p>'
        f'<p><a href="{html_escape(confirm_url)}">确认订阅</a></p>'
        '<p>如果这不是你的操作，请忽略本邮件。'
        f'随时<a href="{html_escape(unsubscribe_url)}">退订</a>。</p>'
    )
    mailer.send_mail(settings, to, "确认订阅 HarnessPack 每日 Top10", text, html)


def subscribe(conn: sqlite3.Connection, email: str, settings: Settings) -> dict:
    """Store the address and mail the confirmation link. Idempotent."""
    if not mailer.mail_configured(settings):
        raise mailer.MailError("SMTP is not configured on this server")
    from datetime import datetime, timezone

    address = _normalize(email)
    token = secrets.token_urlsafe(24)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    base_url = settings.base_url.rstrip("/")
    existing = conn.execute(
        "SELECT id, confirmed_at, unsubscribed_at FROM subscribers WHERE email = ?", (address,)
    ).fetchone()
    if existing is not None and existing["confirmed_at"] and not existing["unsubscribed_at"]:
        return {"status": "already", "email": address}
    if existing is not None:
        conn.execute(
            "UPDATE subscribers SET token = ?, created_at = ?, confirmed_at = NULL, "
            "unsubscribed_at = NULL WHERE id = ?",
            (token, now, existing["id"]),
        )
        status = "resubscribed"
    else:
        conn.execute(
            "INSERT INTO subscribers (email, token, created_at) VALUES (?, ?, ?)",
            (address, token, now),
        )
        status = "subscribed"
    conn.commit()
    confirm_url, unsubscribe_url = _links(base_url, token)
    _confirm_mail(settings, address, confirm_url, unsubscribe_url)
    return {"status": status, "email": address}


def confirm(conn: sqlite3.Connection, token: str) -> bool:
    row = conn.execute(
        "SELECT id FROM subscribers WHERE token = ? AND unsubscribed_at IS NULL", (token,)
    ).fetchone()
    if row is None:
        return False
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    conn.execute(
        "UPDATE subscribers SET confirmed_at = ? WHERE id = ? AND confirmed_at IS NULL",
        (now, row["id"]),
    )
    conn.commit()
    return True


def unsubscribe(conn: sqlite3.Connection, token: str) -> bool:
    from datetime import datetime, timezone

    row = conn.execute("SELECT id FROM subscribers WHERE token = ?", (token,)).fetchone()
    if row is None:
        return False
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    conn.execute(
        "UPDATE subscribers SET unsubscribed_at = ? WHERE id = ?", (now, row["id"])
    )
    conn.commit()
    return True


def active_emails(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    """Confirmed subscribers as (email, token) pairs for per-reader links."""
    rows = conn.execute(
        "SELECT email, token FROM subscribers "
        "WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL ORDER BY id"
    ).fetchall()
    return [(row["email"], row["token"]) for row in rows]
