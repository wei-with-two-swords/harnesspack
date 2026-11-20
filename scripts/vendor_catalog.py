"""Vendor the awesome-dsh-plugin catalog into our repo.

The catalog (https://awesome-dsh-plugin.com/plugins.json, CC0-1.0) is the
membership source: it decides which repos are listed and their category.
We normalise it to repo level (one entry per repository, sub-directory links
collapsed), drop the volatile star counts (our own snapshots are the source of
truth for stars) and record a changelog of additions/removals.

Usage:
    python scripts/vendor_catalog.py [--out data/catalog] [--from-file PATH]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_URL = "https://awesome-dsh-plugin.com/plugins.json"
USER_AGENT = "HarnessPack-catalog/0.1"
REPO_URL_RE = re.compile(r"^https://github\.com/([^/]+)/([^/?#]+)")
FIELDS = ("name", "owner", "url", "category", "description", "install", "npm", "version", "added")


def load_env() -> None:
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(req, timeout=90) as resp:
            return resp.read()
    except Exception:
        proxy_url = os.environ.get("HTTPS_PROXY") or "http://127.0.0.1:7897"
        proxy = urllib.request.ProxyHandler({"https": proxy_url})
        with urllib.request.build_opener(proxy).open(req, timeout=120) as resp:
            return resp.read()


def normalise(raw: dict) -> dict[str, dict]:
    entries = raw.get("plugins") or []
    if not isinstance(entries, list):
        raise SystemExit("catalog has no plugins list")
    repos: dict[str, dict] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        match = REPO_URL_RE.match(str(entry.get("url") or ""))
        if not match:
            continue
        owner, repo = match.group(1), match.group(2)
        key = f"{owner.lower()}/{repo.lower()}"
        desc = entry.get("description") or {}
        if not isinstance(desc, dict):
            desc = {}
        stars = entry.get("stars") or 0
        current = repos.get(key)
        if current is not None and current["stars"] >= stars:
            continue
        repos[key] = {
            "owner": owner,
            "repo": repo,
            "name": str(entry.get("name") or f"{owner}/{repo}")[:120],
            "url": f"https://github.com/{owner}/{repo}",
            "category": str(entry.get("category") or "other"),
            "npm": str(entry.get("npm") or ""),
            "stars": stars,
        }
    out: dict[str, dict] = {}
    for key, item in repos.items():
        item.pop("stars", None)
        out[key] = item
    return out


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(ROOT / "data" / "catalog"))
    parser.add_argument("--from-file", help="read a saved plugins.json instead of the network")
    args = parser.parse_args()

    if args.from_file:
        raw = json.loads(Path(args.from_file).read_text(encoding="utf-8"))
        source = args.from_file
    else:
        raw = json.loads(fetch(CATALOG_URL).decode("utf-8"))
        source = CATALOG_URL

    repos = normalise(raw)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    latest_path = out_dir / "latest.json"
    previous: dict[str, dict] = {}
    if latest_path.exists():
        previous = json.loads(latest_path.read_text(encoding="utf-8")).get("repos", {})

    added = sorted(set(repos) - set(previous))
    removed = sorted(set(previous) - set(repos))
    changed = sorted(
        key for key in set(repos) & set(previous)
        if repos[key]["category"] != previous[key]["category"] or repos[key]["name"] != previous[key]["name"]
    )

    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "source": source,
        "upstream_updated": raw.get("updated"),
        "vendored_at": now.isoformat(timespec="seconds"),
        "count": len(repos),
        "repos": repos,
    }
    latest_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True), encoding="utf-8")

    if added or removed or changed:
        record = {
            "at": payload["vendored_at"],
            "added": added,
            "removed": removed,
            "changed": changed,
        }
        with (out_dir / "changelog.jsonl").open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    size = latest_path.stat().st_size
    categories: dict[str, int] = {}
    for item in repos.values():
        categories[item["category"]] = categories.get(item["category"], 0) + 1
    print(
        json.dumps(
            {
                "entries": len(repos),
                "bytes": size,
                "added": len(added),
                "removed": len(removed),
                "changed": len(changed),
                "upstream_updated": raw.get("updated"),
                "categories": dict(sorted(categories.items(), key=lambda kv: -kv[1])),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

