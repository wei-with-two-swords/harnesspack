"""Small operator CLI: init-db, ingest, rebuild, stats.

Examples:
    python -m backend.app.cli init-db
    python -m backend.app.cli ingest
    python -m backend.app.cli rebuild
    python -m backend.app.cli stats
    python -m backend.app.cli community hide post 42
    python -m backend.app.cli community unhide comment 7
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import get_settings
from .db import connect, init_db
from .services.ingest import IngestError, ingest


def _print(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def cmd_init_db(args: argparse.Namespace) -> int:
    settings = get_settings()
    conn = connect(settings.db_path)
    try:
        init_db(conn)
    finally:
        conn.close()
    _print({"db": str(settings.db_path), "status": "initialized"})
    return 0


def cmd_ingest(args: argparse.Namespace) -> int:
    settings = get_settings()
    conn = connect(settings.db_path)
    try:
        init_db(conn)
        stats = ingest(conn, settings.snapshot_dir, settings.seed_path)
    finally:
        conn.close()
    _print({"db": str(settings.db_path), **stats.as_dict()})
    return 0


def cmd_rebuild(args: argparse.Namespace) -> int:
    settings = get_settings()
    db_path = settings.db_path
    for suffix in ("", "-wal", "-shm"):
        Path(str(db_path) + suffix).unlink(missing_ok=True)
    conn = connect(db_path)
    try:
        init_db(conn)
        stats = ingest(conn, settings.snapshot_dir, settings.seed_path)
    finally:
        conn.close()
    _print({"db": str(db_path), "rebuilt": True, **stats.as_dict()})
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    settings = get_settings()
    conn = connect(settings.db_path)
    try:
        init_db(conn)
        row = conn.execute("SELECT MAX(date) AS d FROM stars").fetchone()
        payload = {
            "db": str(settings.db_path),
            "as_of": row["d"] if row else None,
            "plugins": int(conn.execute("SELECT COUNT(*) FROM plugins").fetchone()[0]),
            "stars": int(conn.execute("SELECT COUNT(*) FROM stars").fetchone()[0]),
            "days": int(conn.execute("SELECT COUNT(DISTINCT date) FROM stars").fetchone()[0]),
            "snapshots": int(conn.execute("SELECT COUNT(*) FROM fetch_runs").fetchone()[0]),
            "anomalies": int(
                conn.execute("SELECT COUNT(*) FROM stars WHERE is_anomaly = 1").fetchone()[0]
            ),
        }
    finally:
        conn.close()
    _print(payload)
    return 0


def cmd_community(args: argparse.Namespace) -> int:
    """Hide or restore a post/comment that breaks the community rules."""
    settings = get_settings()
    conn = connect(settings.db_path)
    try:
        init_db(conn)
        table = "posts" if args.target == "post" else "comments"
        hidden = 1 if args.action == "hide" else 0
        cursor = conn.execute(
            f"UPDATE {table} SET is_hidden = ? WHERE id = ?", (hidden, args.id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            print(f"error: {args.target} {args.id} not found", file=sys.stderr)
            return 1
        _print({"table": table, "id": args.id, "is_hidden": hidden})
        return 0
    finally:
        conn.close()


def cmd_send_digest(args: argparse.Namespace) -> int:
    """Mail the daily Top10 digest; a no-op without SMTP or subscribers."""
    from .services import digest as digest_service

    settings = get_settings()
    conn = connect(settings.db_path)
    try:
        init_db(conn)
        result = digest_service.send_digest(conn, settings, force=args.force)
    finally:
        conn.close()
    _print(result)
    return 0


def cmd_check_memory(args: argparse.Namespace) -> int:
    """Alert by email when the API service stays above a memory threshold.

    State file tracks consecutive over-threshold readings so a single spike
    stays quiet and one sustained episode triggers exactly one alert, plus a
    recovery notice when memory comes back down.
    """
    import json as _json
    import subprocess
    from datetime import datetime, timezone
    from pathlib import Path

    from .services import mailer

    settings = get_settings()
    result = subprocess.run(
        ["systemctl", "show", args.service, "-p", "MemoryCurrent", "--value"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    raw = result.stdout.strip()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    if not raw or raw == "0":
        # Service stopped or cgroup value unavailable: nothing to judge.
        _print({"status": "unknown", "service": args.service, "checked_at": now})
        return 0
    current_mb = int(raw) / (1024 * 1024)
    state_path = Path(args.state)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        state = _json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        state = {"streak": 0, "alerted": False}
    state = {"streak": int(state.get("streak", 0)), "alerted": bool(state.get("alerted"))}

    if current_mb >= args.threshold_mb:
        state["streak"] += 1
        if state["streak"] >= args.consecutive and not state["alerted"]:
            recipient = settings.alert_email or settings.smtp_from
            if mailer.mail_configured(settings) and recipient:
                mailer.send_mail(
                    settings,
                    recipient,
                    f"[HarnessPack] 内存告警 {args.service} {current_mb:.0f}MB",
                    (
                        f"{args.service} 连续 {state['streak']} 次检测超过 "
                        f"{args.threshold_mb}MB 阈值，当前 {current_mb:.0f}MB。\n"
                        f"时间：{now}\n处理建议：先 systemctl status {args.service} 看是否 "
                        f"OG/统计热点未清理，必要时 systemctl restart {args.service}。\n"
                    ),
                )
                state["alerted"] = True
                result_payload: dict = {"status": "alerted"}
            else:
                result_payload = {"status": "would-alert", "reason": "SMTP or alert email unset"}
        else:
            result_payload = {"status": "over-threshold"}
    else:
        if state["alerted"]:
            recipient = settings.alert_email or settings.smtp_from
            if mailer.mail_configured(settings) and recipient:
                mailer.send_mail(
                    settings,
                    recipient,
                    f"[HarnessPack] 内存恢复 {args.service} {current_mb:.0f}MB",
                    f"{args.service} 内存已回落到 {current_mb:.0f}MB（阈值 {args.threshold_mb}MB）。\n时间：{now}\n",
                )
            result_payload = {"status": "recovered"}
        else:
            result_payload = {"status": "ok"}
        state = {"streak": 0, "alerted": False}
    state_path.write_text(_json.dumps(state), encoding="utf-8")
    _print({"service": args.service, "memory_mb": round(current_mb, 1), **result_payload})
    return 0


def cmd_indexnow(args: argparse.Namespace) -> int:
    """Push changed URLs to Bing IndexNow; idempotent per day."""
    from .services import indexnow as indexnow_service

    settings = get_settings()
    conn = connect(settings.db_path)
    try:
        init_db(conn)
        result = indexnow_service.push(conn, settings, force=args.force)
    finally:
        conn.close()
    _print(result)
    return 0 if result.get("status") in ("ok", "already") else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="harnesspack", description="HarnessPack operator CLI")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init-db", help="create the SQLite schema")
    sub.add_parser("ingest", help="replay snapshot files into the database")
    sub.add_parser("rebuild", help="delete the database and replay every snapshot")
    sub.add_parser("stats", help="print database counters")
    moderation = sub.add_parser("community", help="hide or restore community content")
    moderation.add_argument("action", choices=["hide", "unhide"])
    moderation.add_argument("target", choices=["post", "comment"])
    moderation.add_argument("id", type=int)
    digest = sub.add_parser("send-digest", help="mail the daily Top10 digest")
    digest.add_argument("--force", action="store_true", help="send even if today already sent")
    memory = sub.add_parser("check-memory", help="alert when the API service uses too much memory")
    memory.add_argument("--service", default="harnesspack-api")
    memory.add_argument("--threshold-mb", type=int, default=300)
    memory.add_argument("--consecutive", type=int, default=3)
    memory.add_argument("--state", default="/var/lib/harnesspack/memalert.json")
    indexnow = sub.add_parser("indexnow", help="push changed URLs to Bing IndexNow")
    indexnow.add_argument("--force", action="store_true", help="push even if today already pushed")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    handlers = {
        "init-db": cmd_init_db,
        "ingest": cmd_ingest,
        "rebuild": cmd_rebuild,
        "stats": cmd_stats,
        "community": cmd_community,
        "send-digest": cmd_send_digest,
        "check-memory": cmd_check_memory,
        "indexnow": cmd_indexnow,
    }
    try:
        return handlers[args.command](args)
    except IngestError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
