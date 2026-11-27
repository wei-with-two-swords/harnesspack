#!/usr/bin/env python3
"""Check that the daily snapshot for a given UTC date exists and is complete.

Exit codes:
  0  snapshot is present and healthy
  1  snapshot missing, partial, or the history has gaps
  2  bad input (unreadable files, invalid arguments)
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

SNAPSHOT_RE = "%Y-%m-%d"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify the daily snapshot and its continuity.")
    parser.add_argument("--snapshots", type=Path, default=Path("data/snapshots"))
    parser.add_argument("--seed", type=Path, default=Path("data/plugins.seed.json"))
    parser.add_argument("--date", help="UTC date to check, YYYY-MM-DD (default: today UTC)")
    parser.add_argument("--min-ok-rate", type=float, default=0.99, help="minimum ok/total ratio")
    parser.add_argument("--lookback-days", type=int, default=30, help="how many days of history to scan for gaps")
    return parser.parse_args()


def snapshot_dates(directory: Path) -> list[date]:
    dates: list[date] = []
    for path in directory.glob("*.json"):
        try:
            dates.append(datetime.strptime(path.stem, SNAPSHOT_RE).date())
        except ValueError:
            continue
    return sorted(dates)


def seed_size(path: Path) -> int:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return 0
    plugins = payload.get("plugins") if isinstance(payload, dict) else None
    return len(plugins) if isinstance(plugins, list) else 0


def main() -> int:
    args = parse_args()
    try:
        target = datetime.strptime(args.date, SNAPSHOT_RE).date() if args.date else datetime.now(timezone.utc).date()
    except ValueError:
        print(json.dumps({"status": "error", "error": f"invalid --date: {args.date}"}, ensure_ascii=False))
        return 2

    snapshots = args.snapshots
    if not snapshots.is_dir():
        print(json.dumps({"status": "error", "error": f"snapshot directory not found: {snapshots}"}, ensure_ascii=False))
        return 2

    path = snapshots / f"{target.isoformat()}.json"
    seed_count = seed_size(args.seed)
    dates = snapshot_dates(snapshots)

    report: dict[str, object] = {
        "date": target.isoformat(),
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seed_count": seed_count,
        "min_ok_rate": args.min_ok_rate,
        "latest_snapshot": dates[-1].isoformat() if dates else None,
        "snapshot_days": len(dates),
    }

    # Gap scan: between the oldest snapshot and the target date there must be no missing day.
    gaps: list[str] = []
    if dates:
        cursor = dates[0]
        while cursor < target:
            if cursor not in dates:
                gaps.append(cursor.isoformat())
            cursor += timedelta(days=1)
        # Only report gaps within the lookback window to keep the message short.
        cutoff = target - timedelta(days=max(args.lookback_days, 1))
        gaps = [day for day in gaps if date.fromisoformat(day) >= cutoff]
    report["gaps"] = gaps

    if not path.is_file():
        report.update({"status": "missing", "ok": 0, "total": 0, "ok_rate": 0.0})
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print(f"::error::snapshot for {target.isoformat()} is missing")
        return 1

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        report.update({"status": "error", "error": str(exc)})
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 2

    total = int(payload.get("total") or 0)
    ok = int(payload.get("ok") or 0)
    failed = payload.get("failed")

    # "repository not found" records are known-dead upstream repositories that
    # the seed prune retires after a few days (scripts/prune_seed.py). They are
    # expected noise, not a collection failure — judge health on the rest.
    records = payload.get("plugins") if isinstance(payload.get("plugins"), list) else []
    anticipated = sum(1 for r in records if isinstance(r, dict) and r.get("status") == "not_found")
    effective_total = max(total - anticipated, 0)
    ok_rate = (ok / effective_total) if effective_total else 0.0
    report.update({
        "total": total,
        "ok": ok,
        "failed": failed,
        "anticipated_failures": anticipated,
        "effective_total": effective_total,
        "ok_rate": round(ok_rate, 4),
    })

    problems: list[str] = []
    if total <= 0 or ok <= 0:
        problems.append("snapshot has no successful records")
    elif ok_rate < args.min_ok_rate:
        problems.append(
            f"ok rate {ok_rate:.2%} is below {args.min_ok_rate:.2%}"
            f" ({ok}/{effective_total}; {anticipated} known-dead repos excluded)"
        )
    if seed_count and total < seed_count:
        problems.append(f"snapshot covers {total} of {seed_count} seed repositories")
    if gaps:
        problems.append("missing days: " + ", ".join(gaps))

    if problems:
        report["status"] = "unhealthy"
        report["problems"] = problems
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print("::error::" + "; ".join(problems))
        return 1

    report["status"] = "ok"
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
