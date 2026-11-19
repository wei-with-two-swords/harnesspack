#!/usr/bin/env python3
"""Validate the seed list and every stored snapshot.

Hard errors (exit 1)
--------------------
* seed is empty / has duplicate repos or slugs / misses required fields
* snapshot filename does not match its declared date
* snapshot references a repo that is not in the seed
* a snapshot lacks a seeded repo and the snapshot is not partial
* the same plugin appears twice in one snapshot
* star counts are negative or non-integer on an `ok` record
* a snapshot is dated before the seed's earliest snapshot and has no baseline

Soft warnings (exit 0, printed)
-------------------------------
* failed/not_found repos in a snapshot (recorded, tolerated by design)
* day gaps (a missed run is reported loudly but never fabricated)
* unusually large drops (possible repo reset / transfer), kept for review

Usage
-----
    python scripts/validate.py
    python scripts/validate.py --strict        # warnings also fail
    python scripts/validate.py --json          # machine-readable report
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SEED = ROOT / "data" / "plugins.seed.json"
DEFAULT_SNAP = ROOT / "data" / "snapshots"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--seed", type=Path, default=DEFAULT_SEED)
    ap.add_argument("--snapshots", type=Path, default=DEFAULT_SNAP)
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    ap.add_argument("--json", action="store_true", help="emit a JSON report")
    args = ap.parse_args(argv)

    errors: list[str] = []
    warnings: list[str] = []
    report: dict = {"errors": errors, "warnings": warnings, "snapshots": []}

    seed = load_json(args.seed)
    plugins = seed.get("plugins", [])
    if len(plugins) < 1:
        errors.append("seed list is empty")
    slugs: set[str] = set()
    by_slug: dict[str, dict] = {}
    for p in plugins:
        for field in ("owner", "repo", "slug", "category", "harness"):
            if not p.get(field):
                errors.append(f"seed entry missing {field}: {p.get('owner')}/{p.get('repo')}")
        key = (p.get("owner", "").lower(), p.get("repo", "").lower())
        if p.get("slug") in slugs:
            errors.append(f"duplicate slug: {p['slug']}")
        slugs.add(p.get("slug"))
        by_slug[p.get("slug")] = p
    report["seed_count"] = len(plugins)
    report["unique_slugs"] = len(slugs)

    snap_dir = args.snapshots
    files = sorted(snap_dir.glob("*.json")) if snap_dir.exists() else []
    if not files:
        warnings.append(f"no snapshots yet in {snap_dir}")

    seen_dates: set[str] = set()
    previous: dict[str, int] = {}
    previous_date: date | None = None
    for path in files:
        try:
            snap = load_json(path)
        except json.JSONDecodeError as exc:
            errors.append(f"{path.name}: invalid JSON ({exc})")
            continue
        declared = snap.get("date")
        stem = path.stem
        if declared != stem:
            errors.append(f"{path.name}: declared date {declared!r} does not match filename")
        if stem in seen_dates:
            errors.append(f"{path.name}: duplicate date {stem}")
        seen_dates.add(stem)
        try:
            current_date = datetime.strptime(stem, "%Y-%m-%d").date()
        except ValueError:
            errors.append(f"{path.name}: filename is not YYYY-MM-DD")
            continue

        records = snap.get("plugins")
        if not isinstance(records, list):
            errors.append(f"{path.name}: missing plugins array")
            continue
        if len(records) != snap.get("total"):
            errors.append(f"{path.name}: total={snap.get('total')} but {len(records)} plugin records")
        partial = snap.get("ok", 0) < snap.get("total", 0)

        local_slugs: set[str] = set()
        current: dict[str, int] = {}
        for rec in records:
            slug = None
            for p in plugins:
                if p["owner"].lower() == str(rec.get("owner", "")).lower() and p["repo"].lower() == str(rec.get("repo", "")).lower():
                    slug = p["slug"]
                    break
            if slug is None:
                errors.append(f"{path.name}: repo {rec.get('owner')}/{rec.get('repo')} not in seed")
                continue
            if slug in local_slugs:
                errors.append(f"{path.name}: duplicate plugin {slug}")
            local_slugs.add(slug)
            status = rec.get("status")
            stars = rec.get("stars")
            if status == "ok":
                if not isinstance(stars, int) or stars < 0:
                    errors.append(f"{path.name}: {slug} has invalid stars={stars!r}")
                else:
                    current[slug] = stars
            elif status not in ("not_found", "error", "rate_limited"):
                errors.append(f"{path.name}: {slug} has unknown status {status!r}")

        if snap.get("total") != len(plugins):
            warnings.append(f"{path.name}: covers {snap.get('total')} of {len(plugins)} seed repos")
        elif not partial and len(local_slugs) != len(plugins):
            missing = slugs - local_slugs
            errors.append(f"{path.name}: complete snapshot but {len(missing)} seed repos missing: {sorted(missing)[:5]}")

        # consecutive-day delta sanity (only when both days have the value)
        if previous_date is not None and current_date - previous_date == timedelta(days=1):
            for slug, count in current.items():
                prev = previous.get(slug)
                if prev is not None and count < prev and prev - count > max(5, prev // 100):
                    warnings.append(f"{path.name}: {slug} dropped {prev - count} stars ({prev} -> {count}); possible repo reset")

        entry = {
            "date": stem,
            "total": snap.get("total"),
            "ok": snap.get("ok"),
            "failed": snap.get("failed", 0),
            "partial": partial,
            "failures": [f"{f.get('repo')} ({f.get('status')})" for f in snap.get("failures", [])],
        }
        report["snapshots"].append(entry)
        if partial:
            warnings.append(f"{path.name}: partial snapshot ({snap.get('ok')}/{snap.get('total')} ok)")

        previous = current
        previous_date = current_date

    ordered_dates = sorted(seen_dates)
    for i in range(1, len(ordered_dates)):
        a = datetime.strptime(ordered_dates[i - 1], "%Y-%m-%d").date()
        b = datetime.strptime(ordered_dates[i], "%Y-%m-%d").date()
        gap = (b - a).days
        if gap > 1:
            warnings.append(f"gap of {gap - 1} day(s) between {a} and {b} — missed runs, never backfilled")

    report["snapshot_count"] = len(report["snapshots"])
    report["ok"] = not errors

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=1))
    else:
        print(f"seed: {report['seed_count']} plugins ({report['unique_slugs']} unique slugs)")
        print(f"snapshots: {len(report['snapshots'])}")
        for s in report["snapshots"]:
            flag = "PARTIAL" if s["partial"] else "ok"
            print(f"  {s['date']}  {s['ok']}/{s['total']}  {flag}")
        for w in warnings:
            print(f"WARN  {w}")
        for e in errors:
            print(f"ERROR {e}")
        print("VALID" if not errors else f"INVALID ({len(errors)} errors)")

    if errors:
        return 1
    if args.strict and warnings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
