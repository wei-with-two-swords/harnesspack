"""Take the daily snapshot with GitHub's GraphQL API.

The REST fetcher costs one request per repo; at 11k repos that exceeds the
hourly limit. GraphQL lets us batch 100 repos per request, so a full snapshot
takes ~120 requests and a couple of minutes.

Output format is identical to ``scripts/snapshot.py`` so ingest/validate treat
both the same.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.github.com/graphql"
BATCH = 100
FIELDS = """
  nameWithOwner
  stargazerCount
  forkCount
  isArchived
  createdAt
  pushedAt
  description
  url
"""


class RateLimited(RuntimeError):
    pass


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


def opener():
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


def graphql(token: str, query: str) -> dict:
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        API,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "HarnessPack-snapshot/0.2",
        },
        method="POST",
    )
    try:
        with opener().open(req, timeout=90) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        if exc.code in (403, 429) or "rate limit" in body.lower():
            raise RateLimited(body[:400]) from exc
        raise


def fetch_batch(token: str, batch: list[dict]) -> dict:
    aliases = " ".join(
        f'r{i}: repository(owner: "{p["owner"]}", name: "{p["repo"]}") {{ {FIELDS} }}'
        for i, p in enumerate(batch)
    )
    data = graphql(token, "query { " + aliases + " }")
    if data.get("errors"):
        messages = [str(e.get("message")) for e in data["errors"]]
        if any("rate limit" in m.lower() for m in messages):
            raise RateLimited("; ".join(messages)[:400])
    return data.get("data") or {}


def record(plugin: dict, node: dict | None) -> dict:
    if not node:
        return {
            "slug": plugin["slug"],
            "owner": plugin["owner"],
            "repo": plugin["repo"],
            "status": "not_found",
            "error": "repository not found",
        }
    topics: list[str] = []
    license_info: dict = {}
    return {
        "slug": plugin["slug"],
        "owner": plugin["owner"],
        "repo": plugin["repo"],
        "status": "ok",
        "stars": node.get("stargazerCount"),
        "forks_count": node.get("forkCount"),
        "created_at": node.get("createdAt"),
        "pushed_at": node.get("pushedAt"),
        "archived": bool(node.get("isArchived")),
        "description": node.get("description"),
        "topics": topics,
        "html_url": node.get("url"),
        "license": license_info.get("spdxId"),
        "default_branch": None,
    }


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", default=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"))
    parser.add_argument("--seed", default=str(ROOT / "data" / "plugins.seed.json"))
    parser.add_argument("--out-dir", default=str(ROOT / "data" / "snapshots"))
    parser.add_argument("--limit", type=int, default=0, help="only snapshot the first N seed entries")
    parser.add_argument("--force", action="store_true", help="overwrite an existing snapshot for the date")
    parser.add_argument("--missing-only", action="store_true", help="keep existing ok records, fetch only missing slugs")
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()

    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("SNAPSHOT_TOKEN")
    if not token:
        print("GITHUB_TOKEN is required for GraphQL snapshots", file=sys.stderr)
        return 1

    seed = json.loads(Path(args.seed).read_text(encoding="utf-8"))
    plugins = seed["plugins"]
    if args.limit:
        plugins = plugins[: args.limit]
    assert len({p["slug"] for p in plugins}) == len(plugins), "duplicate slugs in seed"

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{args.date}.json"
    existing: dict | None = None
    if out_path.exists():
        if args.missing_only:
            existing = json.loads(out_path.read_text(encoding="utf-8"))
            have = {r["slug"] for r in existing.get("plugins", []) if r.get("status") == "ok"}
            plugins = [p for p in plugins if p["slug"] not in have]
            if not plugins:
                print(json.dumps({"date": args.date, "missing": 0, "note": "nothing to fetch"}))
                return 0
        elif not args.force:
            print(f"snapshot already exists: {out_path} (use --force)", file=sys.stderr)
            return 2

    started = time.time()
    records: list[dict] = []
    failures: list[dict] = []
    try:
        for start in range(0, len(plugins), BATCH):
            batch = plugins[start : start + BATCH]
            data = fetch_batch(token, batch)
            for i, plugin in enumerate(batch):
                rec = record(plugin, data.get(f"r{i}"))
                records.append(rec)
                if rec["status"] != "ok":
                    failures.append({"slug": rec["slug"], "repo": f'{rec["owner"]}/{rec["repo"]}', "status": rec["status"], "error": rec.get("error", "")})
            done = min(start + BATCH, len(plugins))
            print(f"{done}/{len(plugins)}", flush=True)
    except RateLimited as exc:
        print(f"GitHub rate limit exhausted: {exc}", file=sys.stderr)
        return 3

    if existing:
        merged = {r["slug"]: r for r in existing.get("plugins", [])}
        for rec in records:
            merged[rec["slug"]] = rec
        seed_order = [p["slug"] for p in seed["plugins"]]
        seen = set(seed_order)
        ordered = [merged[s] for s in seed_order if s in merged]
        ordered += [r for s, r in merged.items() if s not in seen]
        records = ordered

    ok = sum(1 for r in records if r["status"] == "ok")
    failures = [
        {"slug": r["slug"], "repo": f'{r["owner"]}/{r["repo"]}', "status": r["status"], "error": r.get("error", "")}
        for r in records
        if r["status"] != "ok"
    ]
    payload = {
        "date": args.date,
        "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "awesome-dsh-plugin catalog + GitHub GraphQL",
        "authenticated": True,
        "elapsed_s": round(time.time() - started, 2),
        "total": len(records),
        "ok": ok,
        "failed": len(records) - ok,
        "failures": failures,
        "plugins": records,
    }
    tmp = out_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(out_path)
    print(json.dumps({"date": args.date, "total": len(records), "ok": ok, "failed": len(records) - ok, "elapsed_s": payload["elapsed_s"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())

