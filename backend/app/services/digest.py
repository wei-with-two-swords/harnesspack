"""Daily Top10 digest mail: build from the latest snapshot, send once a day.

The send is idempotent through the ``digest_log`` table — the timer may fire
again after a reboot and must not double-send. Every reader gets their own
copy with a personal unsubscribe link.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from html import escape as html_escape
from typing import Any

from ..config import Settings
from . import mailer, subscribers

TOP_SIZE = 10


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def build_digest(conn: sqlite3.Connection) -> dict[str, Any] | None:
    day = conn.execute("SELECT MAX(date) AS d FROM stars").fetchone()["d"]
    if not day:
        return None
    rows = conn.execute(
        """SELECT p.slug, p.name, p.owner, p.repo, p.stars_latest, s.delta, s.count
           FROM stars s JOIN plugins p ON p.id = s.plugin_id
           WHERE s.date = ? AND s.is_anomaly = 0 AND s.delta IS NOT NULL
           ORDER BY s.delta DESC, p.stars_latest DESC, p.slug
           LIMIT ?""",
        (day, TOP_SIZE),
    ).fetchall()
    total_plugins = conn.execute(
        "SELECT COUNT(*) FROM plugins WHERE status = 'active'"
    ).fetchone()[0]
    return {
        "day": day,
        "total_plugins": int(total_plugins),
        "items": [
            {
                "slug": row["slug"],
                "name": row["name"],
                "owner": row["owner"],
                "repo": row["repo"],
                "delta": int(row["delta"]),
                "stars": int(row["stars_latest"] or row["count"] or 0),
            }
            for row in rows
        ],
    }


def _render_text(data: dict[str, Any], base_url: str, unsubscribe_url: str) -> str:
    lines = [
        f"HarnessPack 每日 Top10 · {data['day']}",
        "",
        "昨日净增 STAR 最多的 10 个 DSH 插件：",
        "",
    ]
    for index, item in enumerate(data["items"], start=1):
        lines.append(
            f"{index:>2}. {item['name']} ({item['owner']}/{item['repo']})  "
            f"+{item['delta']} → {item['stars']} ★"
        )
        lines.append(f"    {base_url}/plugins/{item['slug']}")
    lines += [
        "",
        f"共收录 {data['total_plugins']} 个在册插件 · 完整榜单：{base_url}/",
        f"退订：{unsubscribe_url}",
    ]
    return "\n".join(lines)


def _render_html(data: dict[str, Any], base_url: str, unsubscribe_url: str) -> str:
    rows = "".join(
        f"<tr>"
        f'<td style="padding:4px 10px;color:#888">{index}</td>'
        f'<td style="padding:4px 10px"><a href="{base_url}/plugins/{html_escape(item["slug"])}">'
        f'{html_escape(item["name"])}</a> '
        f'<span style="color:#888">{html_escape(item["owner"])}/{html_escape(item["repo"])}</span></td>'
        f'<td style="padding:4px 10px;text-align:right">+{item["delta"]}</td>'
        f'<td style="padding:4px 10px;text-align:right">{item["stars"]} ★</td>'
        f"</tr>"
        for index, item in enumerate(data["items"], start=1)
    )
    return (
        f'<p>昨日净增 STAR 最多的 10 个 DSH 插件（{html_escape(data["day"])}）：</p>'
        f'<table style="border-collapse:collapse;font-size:14px">{rows}</table>'
        f'<p style="color:#888">共收录 {data["total_plugins"]} 个在册插件 · '
        f'<a href="{base_url}/">完整榜单</a></p>'
        f'<p style="color:#888;font-size:12px">'
        f'<a href="{html_escape(unsubscribe_url)}">退订此邮件</a></p>'
    )


def send_digest(conn: sqlite3.Connection, settings: Settings, force: bool = False) -> dict:
    if not mailer.mail_configured(settings):
        return {"status": "skipped", "reason": "SMTP is not configured"}
    today = utc_now()[:10]
    if not force:
        already = conn.execute(
            "SELECT 1 FROM digest_log WHERE date = ?", (today,)
        ).fetchone()
        if already:
            return {"status": "already", "date": today}
    data = build_digest(conn)
    if data is None:
        return {"status": "skipped", "reason": "no star data yet"}
    readers = subscribers.active_emails(conn)
    if not readers:
        return {"status": "skipped", "reason": "no confirmed subscribers"}
    base_url = settings.base_url.rstrip("/")
    messages = []
    for email, token in readers:
        _, unsubscribe_url = subscribers._links(base_url, token)
        messages.append(
            mailer.build_message(
                settings,
                email,
                f"HarnessPack 每日 Top10 · {data['day']}",
                _render_text(data, base_url, unsubscribe_url),
                _render_html(data, base_url, unsubscribe_url),
            )
        )
    sent = mailer._send(settings, messages)
    conn.execute(
        "INSERT INTO digest_log (date, sent_at, recipients) VALUES (?, ?, ?) "
        "ON CONFLICT(date) DO UPDATE SET sent_at = excluded.sent_at, "
        "recipients = excluded.recipients",
        (today, utc_now(), sent),
    )
    conn.commit()
    return {"status": "sent", "date": today, "recipients": sent, "day": data["day"]}
