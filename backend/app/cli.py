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
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    handlers = {
        "init-db": cmd_init_db,
        "ingest": cmd_ingest,
        "rebuild": cmd_rebuild,
        "stats": cmd_stats,
        "community": cmd_community,
    }
    try:
        return handlers[args.command](args)
    except IngestError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
