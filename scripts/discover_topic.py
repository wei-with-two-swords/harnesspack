"""Discover DSH plugin repos via GitHub topics, diff them against the catalog.

The upstream catalog is the membership authority, but it can lag behind the
ecosystem. This script scans the ``dsh-plugin`` topic family (plus variants),
filters obvious noise (forks, archived repos) and keeps every repo that the
catalog does not list yet as a discovery candidate in
``data/catalog/discovered.json``. ``build_seed.py`` merges candidates into the
seed as ``watch`` entries: they never enter the rankings directly and are
promoted to ``active`` automatically once the upstream catalog lists them.

Search API limits: 30 req/min authenticated, max 1000 results per query, so a
full sweep bisects the ``created`` date range until each slice fits.

Usage:
    python scripts/discover_topic.py [--mode full|incremental]
        [--topics dsh-plugin,dsh-plugins,deepseek-harness-plugin]
        [--start 2025-01-01] [--dry-run]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from snapshot import _load_dotenv, _opener  # noqa: E402

DEFAULT_TOPICS = ("dsh-plugin", "dsh-plugins", "deepseek-harness-plugin")
BASE_QUALIFIERS = "fork:false archived:false"
PER_PAGE = 100
SEARCH_MAX = 1000  # GitHub never returns results beyond this offset.
STATE_PATH = ROOT / "data" / "catalog" / "discovery_state.json"
OUT_PATH = ROOT / "data" / "catalog" / "discovered.json"


def _iso(d: dt.date) -> str:
    return d.strftime("%Y-%m-%d")


def _search_once(query: str, page: int) -> dict:
    url = (
        "https://api.github.com/search/repositories"
        f"?q={urllib.parse.quote(query)}&per_page={PER_PAGE}&page={page}"
    )
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "HarnessPack-discover/0.1",
            **_auth_header(),
        },
    )
    while True:
        try:
            with _opener().open(request, timeout=45) as response:
                payload = json.load(response)
                remaining = response.headers.get("X-RateLimit-Remaining")
                reset = response.headers.get("X-RateLimit-Reset")
            if remaining is not None and reset is not None and int(remaining) <= 2:
                wait = max(int(reset) - time.time(), 0) + 2
                print(f"  search quota nearly spent, sleeping {wait:.0f}s", flush=True)
                time.sleep(wait)
            return payload
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 429):
                reset = exc.headers.get("X-RateLimit-Reset")
                retry_after = exc.headers.get("Retry-After")
                wait = 60
                if reset:
                    wait = max(int(reset) - time.time(), 1) + 2
                elif retry_after:
                    wait = int(retry_after) + 2
                print(f"  rate limited ({exc.code}), sleeping {wait:.0f}s", flush=True)
                time.sleep(wait)
                continue
            raise


def _auth_header() -> dict:
    token = (os.environ.get("GITHUB_TOKEN") or "").strip()
    return {"Authorization": f"Bearer {token}"} if token else {}


def _collect_range(topic: str, start: dt.date, end: dt.date, found: dict) -> None:
    """Walk one topic over a created-date range, bisecting past the 1000 cap."""
    query = f"topic:{topic} {BASE_QUALIFIERS} created:{_iso(start)}..{_iso(end)}"
    first = _search_once(query, 1)
    total = int(first.get("total_count") or 0)
    if total == 0:
        return
    if total > SEARCH_MAX and start != end:
        mid = start + dt.timedelta(days=(end - start).days // 2)
        print(f"  {topic} {_iso(start)}..{_iso(end)}: {total} > {SEARCH_MAX}, bisect at {_iso(mid)}", flush=True)
        _collect_range(topic, start, mid, found)
        _collect_range(topic, mid + dt.timedelta(days=1), end, found)
        return
    if total > SEARCH_MAX:
        print(f"  WARNING: {total} results in a single day for {topic}; results truncated", file=sys.stderr)
    pages = min((total + PER_PAGE - 1) // PER_PAGE, 100)
    items = list(first.get("items") or [])
    for page in range(2, pages + 1):
        time.sleep(2.2)
        items.extend(_search_once(query, page).get("items") or [])
    for item in items:
        owner = ((item.get("owner") or {}).get("login") or "").strip()
        repo = (item.get("name") or "").strip()
        if not owner or not repo:
            continue
        key = f"{owner}/{repo}".lower()
        entry = {
            "owner": owner,
            "repo": repo,
            "name": (item.get("name") or "")[:120],
            "description": (item.get("description") or "")[:300],
            "stars": int(item.get("stargazers_count") or 0),
            "pushed_at": (item.get("pushed_at") or "")[:10],
            "topics": [t for t in (item.get("topics") or []) if t in DEFAULT_TOPICS] or [topic],
        }
        prev = found.get(key)
        if prev is None or entry["stars"] > prev.get("stars", 0):
            if prev is None:
                entry["discovered_at"] = _iso(dt.date.today())
            else:
                entry["discovered_at"] = prev.get("discovered_at")
            found[key] = entry


def load_catalog_keys() -> set[str]:
    catalog = json.loads((ROOT / "data" / "catalog" / "latest.json").read_text(encoding="utf-8"))
    keys = set(catalog.get("repos") or {})
    aliases_path = ROOT / "data" / "catalog" / "aliases.json"
    if aliases_path.exists():
        for old, alias in (json.loads(aliases_path.read_text(encoding="utf-8")).get("aliases") or {}).items():
            keys.add(old)
            keys.add(f'{alias["owner"]}/{alias["repo"]}'.lower())
    return keys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("full", "incremental"), default="full")
    parser.add_argument("--topics", default=",".join(DEFAULT_TOPICS))
    parser.add_argument("--start", default="2025-01-01", help="earliest created date for full sweeps")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    _load_dotenv()
    topics = [t.strip() for t in args.topics.split(",") if t.strip()]
    today = dt.date.today()
    state = {}
    if STATE_PATH.exists():
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))

    start = dt.date.fromisoformat(args.start)
    if args.mode == "incremental":
        last = state.get("last_run")
        if not last:
            print("no previous run recorded; falling back to full sweep")
        else:
            start = dt.date.fromisoformat(last) + dt.timedelta(days=1)
            if start > today:
                print("nothing to do: catalog swept today already")
                return 0

    found: dict[str, dict] = {}
    if OUT_PATH.exists() and args.mode == "full":
        found = {
            k: v
            for k, v in (json.loads(OUT_PATH.read_text(encoding="utf-8")).get("repos") or {}).items()
        }

    catalog_keys = load_catalog_keys()
    print(f"sweeping {len(topics)} topic(s) from {_iso(start)} to {_iso(today)}", flush=True)
    for topic in topics:
        print(f"topic:{topic}", flush=True)
        _collect_range(topic, start, today, found)

    total_found = len(found)
    previous = found
    if OUT_PATH.exists() and args.mode == "incremental":
        previous = {
            k: v
            for k, v in (json.loads(OUT_PATH.read_text(encoding="utf-8")).get("repos") or {}).items()
        }
        merged = dict(previous)
        for key, entry in found.items():
            prev = merged.get(key)
            if prev is None:
                entry["discovered_at"] = _iso(today)
                merged[key] = entry
            else:
                entry["discovered_at"] = prev.get("discovered_at") or _iso(today)
                merged[key] = entry
        found = merged

    known = {k for k in found if k in catalog_keys}
    for key in known:
        found.pop(key)
    for entry in found.values():
        entry["last_seen"] = _iso(today)

    payload = {
        "source": "github-topics",
        "topics": topics,
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "sweep_mode": args.mode,
        "sweep_start": _iso(start),
        "count": len(found),
        "repos": dict(sorted(found.items())),
    }
    if not args.dry_run:
        OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
        state.update(
            {
                "last_run": _iso(today),
                "last_mode": args.mode,
                "last_total_found": total_found,
                "last_catalog_overlap": len(known),
                "last_kept": len(found),
                "updated_at": payload["updated_at"],
            }
        )
        STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")

    print(
        json.dumps(
            {
                "mode": args.mode,
                "topics": topics,
                "seen": total_found,
                "already_in_catalog": len(known),
                "new_candidates": len(found),
                "dry_run": args.dry_run,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
