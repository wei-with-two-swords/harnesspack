#!/usr/bin/env python3
"""Fetch today's GitHub star counts for the seeded plugin list.

Writes one JSON snapshot per UTC day: data/snapshots/YYYY-MM-DD.json

Design notes
------------
* One REST call per repo: GET /repos/{owner}/{repo} (60/h unauthenticated,
  5000/h with GITHUB_TOKEN). 100 repos/day is well inside either budget.
* Failures are isolated: a 404 / 5xx / timeout for one repo never aborts the
  batch. The snapshot records what succeeded and lists what failed.
* We never invent data. A repo that disappears is kept with status
  "not_found" and its last known values are carried forward by the builder.
* Rate limiting: honours Retry-After / X-RateLimit-Reset with bounded backoff.

Usage
-----
    python scripts/snapshot.py                 # today (UTC)
    python scripts/snapshot.py --date 2026-11-19
    python scripts/snapshot.py --limit 5       # smoke test
    GITHUB_TOKEN=... python scripts/snapshot.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SEED = ROOT / "data" / "plugins.seed.json"
DEFAULT_OUT = ROOT / "data" / "snapshots"
API = "https://api.github.com/repos/"

FIELDS = (
    "stargazers_count",
    "forks_count",
    "created_at",
    "pushed_at",
    "archived",
    "description",
    "topics",
    "html_url",
    "license",
    "default_branch",
)

_local = threading.local()


def _opener() -> urllib.request.OpenerDirector:
    """One opener per thread (urllib is not documented as thread-safe).

    On Windows urllib honours the registry proxy settings, which can point at a
    shared egress whose unauthenticated GitHub quota is already exhausted (or
    whose IP GitHub throttles). Direct connections work fine from here, so we
    bypass proxies unless HARNESSPACK_USE_PROXY=1 explicitly asks for them.
    """
    if not hasattr(_local, "opener"):
        if os.environ.get("HARNESSPACK_USE_PROXY") == "1":
            _local.opener = urllib.request.build_opener()
        else:
            _local.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    return _local.opener


class RateLimited(Exception):
    def __init__(self, reset_epoch: int | None):
        self.reset_epoch = reset_epoch
        super().__init__(f"GitHub rate limit exhausted (reset={reset_epoch})")


def _headers(token: str | None) -> dict[str, str]:
    h = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "HarnessPack-snapshot/0.1",
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def fetch_repo(owner: str, repo: str, token: str | None, timeout: float, attempts: int = 3) -> dict:
    """Return a normalized record. Never raises for per-repo failures."""
    url = f"{API}{owner}/{repo}"
    last_err = ""
    for attempt in range(1, attempts + 1):
        req = urllib.request.Request(url, headers=_headers(token))
        try:
            with _opener().open(req, timeout=timeout) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            return _normalize(owner, repo, raw, status="ok")
        except urllib.error.HTTPError as exc:
            status = exc.code
            if status == 404:
                return _empty(owner, repo, status="not_found", error="repo not found")
            if status == 403 or status == 429:
                # Retrying inside the same hour is pointless: GitHub resets the
                # quota on a fixed schedule. The caller records the repo as
                # rate_limited and the next run fills the gap with --missing-only.
                reset = exc.headers.get("X-RateLimit-Reset") if exc.headers else None
                raise RateLimited(int(reset) if reset and reset.isdigit() else None)
            if 500 <= status < 600 and attempt < attempts:
                wait = 2 ** attempt
                time.sleep(wait)
                last_err = f"HTTP {status}"
                continue
            return _empty(owner, repo, status="error", error=f"HTTP {status}")
        except (TimeoutError, urllib.error.URLError, OSError) as exc:
            last_err = f"{type(exc).__name__}: {exc}"
            if attempt < attempts:
                time.sleep(2 ** attempt)
                continue
            return _empty(owner, repo, status="error", error=last_err)
    return _empty(owner, repo, status="error", error=last_err or "unknown error")


def _normalize(owner: str, repo: str, raw: dict, status: str) -> dict:
    rec = {"owner": owner, "repo": repo, "status": status}
    for key in FIELDS:
        rec[key] = raw.get(key)
    lic = raw.get("license") or {}
    rec["license"] = lic.get("spdx_id") if isinstance(lic, dict) else None
    rec["stars"] = raw.get("stargazers_count")
    rec.pop("stargazers_count", None)
    return rec


def _empty(owner: str, repo: str, status: str, error: str) -> dict:
    rec = {"owner": owner, "repo": repo, "status": status, "error": error}
    for key in FIELDS:
        rec[key] = None
    rec["stars"] = None
    rec.pop("stargazers_count", None)
    return rec


def load_seed(path: Path) -> list[dict]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    plugins = doc.get("plugins")
    if not isinstance(plugins, list) or not plugins:
        raise SystemExit(f"seed file has no plugins: {path}")
    seen = set()
    for p in plugins:
        key = (p["owner"].lower(), p["repo"].lower())
        if key in seen:
            raise SystemExit(f"duplicate seed entry: {p['owner']}/{p['repo']}")
        seen.add(key)
        for field in ("owner", "repo", "slug"):
            if not p.get(field):
                raise SystemExit(f"seed entry missing {field}: {p}")
    return plugins


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--date", help="UTC date YYYY-MM-DD (default: today)")
    ap.add_argument("--seed", type=Path, default=DEFAULT_SEED)
    ap.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--limit", type=int, default=0, help="only fetch the first N (smoke test)")
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--timeout", type=float, default=20.0)
    ap.add_argument("--force", action="store_true", help="overwrite an existing snapshot")
    ap.add_argument(
        "--missing-only",
        action="store_true",
        help="merge into the existing snapshot, fetching only slugs without an ok record",
    )
    args = ap.parse_args(argv)

    date = args.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise SystemExit(f"invalid --date: {date}")

    out = args.out_dir / f"{date}.json"
    existing: dict = {}
    if out.exists():
        if not (args.force or args.missing_only):
            print(f"snapshot already exists: {out} (use --force to overwrite)", file=sys.stderr)
            return 2
        if args.missing_only:
            existing = json.loads(out.read_text(encoding="utf-8"))
    args.out_dir.mkdir(parents=True, exist_ok=True)

    seed_plugins = load_seed(args.seed)
    done = {
        r["slug"]
        for r in existing.get("plugins", [])
        if r.get("status") == "ok"
    } if existing else set()
    plugins = [p for p in seed_plugins if p["slug"] not in done]
    if args.limit:
        plugins = plugins[: args.limit]
    if not plugins:
        print(f"nothing to fetch: {out} already covers every seed repo", file=sys.stderr)
        return 0

    token = os.environ.get("GITHUB_TOKEN") or None
    started = time.time()
    records: dict[str, dict] = {}
    limited = threading.Event()
    limit_reason = {"message": ""}

    def task(p: dict) -> tuple[str, dict]:
        if limited.is_set():
            return p["slug"], _empty(
                p["owner"], p["repo"], "rate_limited", "quota exhausted earlier in this batch"
            )
        try:
            return p["slug"], fetch_repo(p["owner"], p["repo"], token, args.timeout)
        except RateLimited as exc:
            limited.set()
            limit_reason["message"] = str(exc)
            return p["slug"], _empty(p["owner"], p["repo"], "rate_limited", str(exc))

    with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
        for slug, rec in pool.map(task, plugins):
            rec["slug"] = slug
            records[slug] = rec
            print(
                f"  {rec['owner']}/{rec['repo']:<40} {rec['status']:<12} "
                f"{rec['stars'] if rec['stars'] is not None else '-'}",
                file=sys.stderr,
            )

    merged: dict[str, dict] = {}
    for rec in existing.get("plugins", []):
        slug = rec.get("slug") or f"{rec.get('owner')}-{rec.get('repo')}".lower()
        merged[slug] = {**rec, "slug": slug}
    merged.update(records)
    ordered = [merged.pop(p["slug"]) for p in seed_plugins if p["slug"] in merged]
    ordered.extend(merged.values())
    failures = [
        {
            "slug": rec["slug"],
            "repo": f"{rec['owner']}/{rec['repo']}",
            "status": rec["status"],
            "error": rec.get("error"),
        }
        for rec in ordered
        if rec["status"] != "ok"
    ]
    doc = {
        "date": date,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "github-api",
        "authenticated": bool(token) or bool(existing.get("authenticated")),
        "elapsed_s": round(time.time() - started, 2),
        "total": len(ordered),
        "ok": sum(1 for rec in ordered if rec["status"] == "ok"),
        "failed": len(failures),
        "failures": failures,
        "plugins": ordered,
    }
    tmp = out.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(out)

    print(f"\n{date}: ok={doc['ok']}/{doc['total']} failed={doc['failed']} -> {out}")
    rate_limited = sum(1 for rec in ordered if rec["status"] == "rate_limited")
    if failures:
        print(
            "not ok: " + ", ".join(f"{f['repo']}({f['status']})" for f in failures),
            file=sys.stderr,
        )
    if rate_limited:
        print(
            "hint: re-run with --missing-only after the GitHub quota resets "
            f"({limit_reason['message'] or 'rate limited'}).",
            file=sys.stderr,
        )
        return 3
    if doc["ok"] == 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
