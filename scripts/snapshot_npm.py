"""Fetch npm registry download counts for plugins mapped in the local DB.

Data source: api.npmjs.org/downloads — tarball downloads from the public npm
registry (NOT user installs). Includes CI, mirrors and repeated downloads, so
it is an approximate signal. It is stored under its own namespace and MUST NOT
be summed with GitHub stars or 1024Store installs.

Storage (data/npm_downloads/):
    archive.json      cumulative daily series {package: {day: count}}
    latest.json       summary with metadata + last 7/30-day totals per package
    raw/YYYY-MM-DD.json   original API responses for the current day (audit)

Usage:
    python scripts/snapshot_npm.py [--days 365] [--proxy http://127.0.0.1:7897]
    python scripts/snapshot_npm.py --incremental --proxy ...   # last 7 days only

Bulk endpoint: comma-separated GET, max 128 packages; scoped packages must
be queried one at a time. Both point and range APIs are used here.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from snapshot import _load_dotenv  # noqa: E402

DB_PATH = ROOT / "data" / "harnesspack.db"
OUT_DIR = ROOT / "data" / "npm_downloads"
ARCHIVE_PATH = OUT_DIR / "archive.json"
LATEST_PATH = OUT_DIR / "latest.json"
RAW_DIR = OUT_DIR / "raw"
API = "https://api.npmjs.org/downloads"
BATCH_SIZE = 128
TODAY = dt.date.today()

_local = threading.local()
_proxy: str | None = None


def _opener() -> urllib.request.OpenerDirector:
    if not hasattr(_local, "opener"):
        handlers = [urllib.request.ProxyHandler({"http": _proxy, "https": _proxy})] if _proxy else []
        _local.opener = urllib.request.build_opener(*handlers)
    return _local.opener


def _get(url: str, retries: int = 3, timeout: int = 40) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "HarnessPack-npm-downloads/0.1"})
    for attempt in range(retries + 1):
        try:
            with _opener().open(request, timeout=timeout) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return {"error": "not found"}
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(min(2**attempt, 8))
                continue
            return {"error": f"http {exc.code}"}
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError):
            if attempt < retries:
                time.sleep(min(2**attempt, 8))
                continue
            return {"error": "network failure"}
    return {"error": "unreachable"}


def _range_url(packages: list[str], start: dt.date, end: dt.date) -> str:
    quoted = ",".join(urllib.parse.quote(p, safe="@/") for p in packages)
    return f"{API}/range/{start.isoformat()}:{end.isoformat()}/{quoted}"


def _load_packages() -> dict[str, list[str]]:
    """Return {package_name: [slugs]} for non-empty npm_package values."""
    import sqlite3

    conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    rows = conn.execute(
        "SELECT slug, npm_package FROM plugins WHERE status IN ('active','watch') "
        "AND npm_package IS NOT NULL AND npm_package != ''"
    ).fetchall()
    conn.close()
    mapping: dict[str, list[str]] = {}
    for slug, package in rows:
        mapping.setdefault(package.strip(), []).append(slug)
    return mapping


def _fetch_batch(packages: list[str], start: dt.date, end: dt.date) -> dict[str, dict]:
    """Fetch one bulk range response; normalize to {package: {day: count}}."""
    result = _get(_range_url(packages, start, end))
    out: dict[str, dict] = {}
    for package in packages:
        payload = result.get(package) if isinstance(result, dict) else None
        if isinstance(payload, dict) and isinstance(payload.get("downloads"), list):
            out[package] = {
                str(day["day"]): int(day["downloads"])
                for day in payload["downloads"]
                if isinstance(day, dict) and "day" in day and "downloads" in day
            }
        else:
            out[package] = {}
    return out


def _fetch_scoped(package: str, start: dt.date, end: dt.date) -> tuple[str, dict]:
    """Fetch one scoped package via its own request."""
    quoted = urllib.parse.quote(package, safe="@/")
    result = _get(f"{API}/range/{start.isoformat()}:{end.isoformat()}/{quoted}")
    if isinstance(result, dict) and isinstance(result.get("downloads"), list):
        return package, {
            str(day["day"]): int(day["downloads"])
            for day in result["downloads"]
            if isinstance(day, dict) and "day" in day and "downloads" in day
        }
    return package, {}


def _merge_into_archive(archive: dict, fetched: dict[str, dict]) -> int:
    """Merge fetched daily counts into the archive. Returns new (package,day) pairs."""
    added = 0
    for package, days in fetched.items():
        target = archive.setdefault(package, {})
        for day, count in days.items():
            if day not in target:
                added += 1
            target[day] = count  # npm may revise recent days; overwrite in place
    return added


def _sum_window(days: dict[str, int], window: int, end: dt.date | None = None) -> int:
    end = end or TODAY
    cutoff = (end - dt.timedelta(days=window - 1)).isoformat()
    return sum(count for day, count in days.items() if cutoff <= day <= end.isoformat())


def _sum_prev_window(days: dict[str, int], window: int, end: dt.date | None = None) -> int:
    """The equally long window immediately before the current one."""
    end = end or TODAY
    prev_end = end - dt.timedelta(days=window)
    prev_start = prev_end - dt.timedelta(days=window - 1)
    return sum(
        count for day, count in days.items() if prev_start.isoformat() <= day <= prev_end.isoformat()
    )


def _sum_ytd(days: dict[str, int], end: dt.date | None = None) -> int:
    """Year to date: Jan 1 of the end year through end (inclusive)."""
    end = end or TODAY
    start = end.replace(month=1, day=1).isoformat()
    return sum(count for day, count in days.items() if start <= day <= end.isoformat())


def _last_active_day(archive: dict, end: dt.date) -> dt.date:
    """Most recent day with any non-zero download (npm leaves newest days at 0)."""
    active = {
        day
        for days in archive.values()
        if isinstance(days, dict)
        for day, count in days.items()
        if count > 0 and day <= end.isoformat()
    }
    return dt.date.fromisoformat(max(active)) if active else end


def _write_summary(archive: dict, package_to_slugs: dict, added: int, start: dt.date, end: dt.date) -> None:
    """Rebuild latest.json from the cumulative archive (used by both modes)."""
    last_active = _last_active_day(archive, end)
    summary = {
        "source": "npm-registry",
        "metric": "downloads",
        "unit": "tarball_downloads",
        "is_approximate": True,
        "note": "Includes CI, mirrors, dependencies and repeated downloads; NOT user installs. Do not sum with stars.",
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "last_active_day": last_active.isoformat(),
        "package_count": len(package_to_slugs),
        "covered_packages": sum(1 for p in package_to_slugs if archive.get(p)),
        "new_data_points": added,
        "plugins": {},
    }
    for package, slugs in package_to_slugs.items():
        days = archive.get(package) or {}
        entry = {
            "npm_package": package,
            "downloads_24h": _sum_window(days, 1, last_active),
            "downloads_7d": _sum_window(days, 7, end),
            "downloads_30d": _sum_window(days, 30, end),
            "downloads_1y": _sum_window(days, 365, end),
            "downloads_ytd": _sum_ytd(days, end),
            "downloads_prev_7d": _sum_prev_window(days, 7, end),
            "downloads_prev_30d": _sum_prev_window(days, 30, end),
            "days_in_archive": len(days),
            "first_day": min(days) if days else None,
            "last_day": max(days) if days else None,
        }
        for slug in slugs:
            summary["plugins"][slug] = entry
    LATEST_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proxy", default="", help="explicit HTTP(S) proxy URL")
    parser.add_argument("--days", type=int, default=365, help="history window in days (first run)")
    parser.add_argument("--incremental", action="store_true", help="fetch only the last 7 days")
    parser.add_argument("--workers", type=int, default=2, help="scoped-package concurrency (keep low: 3+ drops requests)")
    parser.add_argument("--retry-empty", action="store_true", help="re-fetch only packages that came back empty (low concurrency)")
    args = parser.parse_args()

    global _proxy
    if args.proxy:
        _proxy = args.proxy.strip()
    _load_dotenv()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    package_to_slugs = _load_packages()
    packages = sorted(package_to_slugs)
    plain = [p for p in packages if not p.startswith("@")]
    scoped = [p for p in packages if p.startswith("@")]
    print(
        f"packages: {len(packages)} ({len(plain)} plain, {len(scoped)} scoped) "
        f"covering {sum(len(v) for v in package_to_slugs.values())} plugins",
        flush=True,
    )

    end = TODAY
    start = end - dt.timedelta(days=(7 if args.incremental else args.days) - 1)
    print(f"fetching range {start} .. {end}", flush=True)

    archive: dict[str, dict] = json.loads(ARCHIVE_PATH.read_text(encoding="utf-8")) if ARCHIVE_PATH.exists() else {}
    fetched: dict[str, dict] = {}
    raw_payload: dict = {
        "source": "api.npmjs.org/downloads",
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "packages": {},
    }

    if args.retry_empty:
        # Resume mode: only re-fetch packages with no data in the archive.
        # Scoped requests are fragile under concurrency; keep workers low.
        targets = [p for p in packages if not archive.get(p)]
        print(f"retry-empty: {len(targets)} packages with no archived data", flush=True)

        def _retry_one(package: str) -> tuple[str, dict]:
            if package.startswith("@"):
                return _fetch_scoped(package, start, end)
            return package, _fetch_batch([package], start, end).get(package, {})

        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(_retry_one, package) for package in targets]
            for i, future in enumerate(as_completed(futures), 1):
                package, days = future.result()
                if days:
                    fetched[package] = days
                    raw_payload["packages"][package] = days
                if i % 100 == 0 or i == len(targets):
                    print(f"  retried {i}/{len(targets)}, recovered {sum(1 for v in fetched.values() if v)}", flush=True)
        added = _merge_into_archive(archive, fetched)
        ARCHIVE_PATH.write_text(json.dumps(archive, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        raw_path = RAW_DIR / f"{TODAY.isoformat()}-retry.json"
        raw_path.write_text(json.dumps(raw_payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        _write_summary(archive, package_to_slugs, added, start, end)
        print(f"recovered {added} data points, wrote {ARCHIVE_PATH.name}, {LATEST_PATH.name}, {raw_path.name}", flush=True)
        return 0

    # Bulk plain packages.
    batches = [plain[i : i + BATCH_SIZE] for i in range(0, len(plain), BATCH_SIZE)]
    print(f"bulk: {len(batches)} batches of <= {BATCH_SIZE}", flush=True)
    for i, batch in enumerate(batches, 1):
        result = _fetch_batch(batch, start, end)
        fetched.update(result)
        raw_payload["packages"].update(result)
        if i % 10 == 0 or i == len(batches):
            print(f"  bulk {i}/{len(batches)}", flush=True)
        time.sleep(0.1)

    # Scoped packages, concurrent.
    print(f"scoped: {len(scoped)} single requests", flush=True)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(_fetch_scoped, package, start, end) for package in scoped]
        for i, future in enumerate(as_completed(futures), 1):
            package, days = future.result()
            fetched[package] = days
            raw_payload["packages"][package] = days
            if i % 200 == 0 or i == len(scoped):
                print(f"  scoped {i}/{len(scoped)}", flush=True)

    added = _merge_into_archive(archive, fetched)
    ARCHIVE_PATH.write_text(json.dumps(archive, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    raw_path = RAW_DIR / f"{TODAY.isoformat()}.json"
    raw_path.write_text(json.dumps(raw_payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    _write_summary(archive, package_to_slugs, added, start, end)

    top = sorted(
        ((sum(days.values()), package) for package, days in archive.items()),
        reverse=True,
    )[:10]
    print(f"archive: {len(archive)} packages, {added} new data points", flush=True)
    print("top packages by archive total:", flush=True)
    for total, package in top:
        print(f"  {package:50s} {total:>12,}", flush=True)
    print(f"wrote {ARCHIVE_PATH.name}, {LATEST_PATH.name}, {raw_path.name}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
