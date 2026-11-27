#!/usr/bin/env python3
"""Retire dead repositories from the seed via a maintained exclusion list.

The upstream catalog (and topic discovery) keep listing repositories that have
been deleted or made private on GitHub; the daily snapshot then records them
as ``repository not found`` forever, dragging the snapshot ok-rate down until
the monitor trips (2026-11-26: 129 dead repos -> 98.99% < 99%).

This script maintains ``data/catalog/excluded.json``:

- a slug that failed with ``repository not found`` for ``--min-streak``
  consecutive most-recent snapshots is added to the exclusion list;
- an excluded slug that shows ``status: ok`` in the newest snapshot (repo went
  public again / restored) is removed automatically;
- an excluded slug that no longer appears in the newest snapshot at all (left
  the seed some other way) is dropped from the list as well.

Upstream catalog files stay byte-for-byte vendored; ``build_seed.py`` applies
the exclusion when building the seed. Ingest then marks these plugins as
exited per the published inclusion rule ("仓库 404 → 退出榜单，历史曲线保留").

Usage:
    python scripts/prune_seed.py [--snapshots data/snapshots] [--min-streak 3]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOT_FOUND = "not_found"
EXCLUDED_PATH = ROOT / "data" / "catalog" / "excluded.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshots", type=Path, default=ROOT / "data" / "snapshots")
    parser.add_argument("--min-streak", type=int, default=3,
                        help="consecutive not_found days required to exclude a slug")
    parser.add_argument("--window", type=int, default=5,
                        help="how many most-recent snapshots to inspect")
    return parser.parse_args()


def load_recent_snapshots(directory: Path, window: int) -> list[tuple[str, dict]]:
    """Return the most recent `window` snapshots as (date, payload), oldest first."""
    entries: list[tuple[dt.date, dict]] = []
    for path in directory.glob("*.json"):
        try:
            day = dt.date.fromisoformat(path.stem)
        except ValueError:
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        entries.append((day, payload))
    entries.sort(key=lambda item: item[0])
    return [(day.isoformat(), payload) for day, _ in entries[-max(window, 1):]]


def status_of(payload: dict, slug: str) -> str | None:
    for record in payload.get("plugins") or []:
        if isinstance(record, dict) and record.get("slug") == slug:
            return str(record.get("status") or "")
    return None


def main() -> int:
    args = parse_args()

    snapshots = load_recent_snapshots(args.snapshots, args.window)
    if not snapshots:
        print("no snapshots found; nothing to do", file=sys.stderr)
        return 0
    newest_day, newest = snapshots[-1]

    existing: dict = {}
    if EXCLUDED_PATH.exists():
        try:
            existing = json.loads(EXCLUDED_PATH.read_text(encoding="utf-8")).get("excluded") or {}
        except (OSError, json.JSONDecodeError):
            existing = {}

    # Collect per-slug *trailing* not_found streaks: walk snapshots from the
    # newest backwards; the first non-not_found result ends the streak.
    streaks: dict[str, int] = {}
    for slug in existing:
        streaks[str(slug)] = 0
    finished: set[str] = set()
    for day, payload in reversed(snapshots):
        for record in payload.get("plugins") or []:
            if not isinstance(record, dict):
                continue
            slug = str(record.get("slug") or "")
            if not slug or slug in finished:
                continue
            if record.get("status") == NOT_FOUND:
                streaks[slug] = streaks.get(slug, 0) + 1
            else:
                streaks[slug] = 0
                finished.add(slug)

    excluded: dict = {}
    added, removed, kept = [], [], 0
    for slug, streak in sorted(streaks.items()):
        latest_state = status_of(newest, slug)
        if slug in existing:
            # Stay excluded only while the repo is still not found (or absent
            # because an older snapshot predates it); a recovered repo returns.
            if latest_state == "ok" or latest_state is None:
                removed.append(slug)
                continue
            excluded[slug] = existing[slug]
            kept += 1
        elif streak >= max(args.min_streak, 1):
            excluded[slug] = {
                "reason": "repository not found",
                "since": newest_day,
                "streak": streak,
            }
            added.append(slug)

    payload = {
        "version": 1,
        "updated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rule": f"repository not found for {args.min_streak}+ consecutive snapshots; auto-restored when ok again",
        "excluded": excluded,
    }
    EXCLUDED_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXCLUDED_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    print(json.dumps({
        "window": [snapshots[0][0], snapshots[-1][0]],
        "kept": kept,
        "added": len(added),
        "removed": removed,
        "total_excluded": len(excluded),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
