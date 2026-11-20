"""Detect upstream renames and record them as aliases.

The awesome-dsh-plugin catalog keeps the names its maintainers typed, and the
daily GraphQL snapshot reports canonical ``url`` values. When a repository is
renamed (or 404s under the old name), the old entry would stay "unavailable"
forever unless we map it to the new name.

This script only writes ``data/catalog/aliases.json``; ``build_seed.py`` applies
the aliases, so the vendored catalog stays byte-for-byte upstream data.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from snapshot import _load_dotenv, _opener  # noqa: E402

GITHUB_RE = re.compile(r"https://github\.com/([^/]+)/([^/?#]+)")


def repo_url(owner: str, repo: str) -> str:
    return f"https://github.com/{owner}/{repo}"


def parse_repo(url: str) -> tuple[str, str] | None:
    match = GITHUB_RE.match(url or "")
    if not match:
        return None
    return match.group(1), match.group(2)


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def latest_snapshot(snapshot_dir: Path) -> dict:
    files = sorted(snapshot_dir.glob("*.json"))
    if not files:
        return {}
    return load_json(files[-1], {})


def rest_final_url(owner: str, repo: str, timeout: float) -> str | None:
    url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "HarnessPack-heal/0.1",
    }
    token = (os.environ.get("GITHUB_TOKEN") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with _opener().open(request, timeout=timeout) as response:
            return response.geturl()
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise
    except (urllib.error.URLError, TimeoutError):
        return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", default=str(ROOT / "data" / "plugins.seed.json"))
    parser.add_argument("--snapshots", default=str(ROOT / "data" / "snapshots"))
    parser.add_argument("--out", default=str(ROOT / "data" / "catalog" / "aliases.json"))
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    _load_dotenv()
    seed = load_json(Path(args.seed), {})
    snapshot = latest_snapshot(Path(args.snapshots))
    by_key = {
        f'{p["owner"]}/{p["repo"]}'.lower(): p for p in seed.get("plugins") or []
    }

    out_path = Path(args.out)
    existing = load_json(out_path, {}).get("aliases") or {}
    aliases: dict[str, dict] = dict(existing)
    checked = 0
    detected = 0

    for record in snapshot.get("plugins") or []:
        old = f'{record["owner"]}/{record["repo"]}'.lower()
        if old not in by_key:
            continue
        if args.limit and checked >= args.limit:
            break
        new: str | None = None
        status = record.get("status")
        if status == "ok":
            canonical = parse_repo(str(record.get("html_url") or ""))
            if canonical:
                owner, repo = canonical
                if f"{owner}/{repo}".lower() != old:
                    new = f"{owner}/{repo}"
        elif status in ("not_found", "error", "rate_limited"):
            checked += 1
            final = rest_final_url(record["owner"], record["repo"], args.timeout)
            canonical = parse_repo(final or "")
            if canonical:
                owner, repo = canonical
                if f"{owner}/{repo}".lower() != old:
                    new = f"{owner}/{repo}"
        if not new:
            continue
        owner, repo = new.split("/", 1)
        slug = re.sub(r"[^a-z0-9]+", "-", new.lower()).strip("-")
        entry = {
            "owner": owner,
            "repo": repo,
            "url": repo_url(owner, repo),
            "slug": slug,
            "source": "snapshot-html-url" if status == "ok" else "rest-301",
            "detected_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        if aliases.get(old) != entry:
            detected += 1
        aliases[old] = entry

    payload = {
        "updated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "aliases": dict(sorted(aliases.items())),
    }
    if not args.dry_run:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(
        json.dumps(
            {
                "checked_rest": checked,
                "aliases": len(aliases),
                "new_or_changed": detected,
                "dry_run": args.dry_run,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
