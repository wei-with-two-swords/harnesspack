"""Take the daily snapshot with GitHub's GraphQL API.

The REST fetcher costs one request per repo; at 11k repos that exceeds the
hourly limit. GraphQL lets us batch 100 repos per request, so a full snapshot
takes ~120 requests and a couple of minutes.

Output format is identical to ``scripts/snapshot.py`` so ingest/validate treat
both the same.

Rate limits
-----------
GitHub counts GraphQL calls in points and a full snapshot is a burst of ~120
queries. Both the hourly point budget (1,000 for the workflow's GITHUB_TOKEN,
5,000 for a personal access token) and the per-minute secondary limits can cut
a run short. This module therefore:

* paces batches (``--delay``) instead of firing them back to back;
* reads ``retry-after`` / ``x-ratelimit-reset`` and waits the limit out when
  the reset is close (``--max-wait``, bounded by ``--max-seconds``);
* persists everything fetched so far after every ``--flush-every`` batches and
  before giving up, so a later ``--missing-only`` run resumes instead of
  restarting from zero.
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
# Only fields the snapshot/ingest pipeline actually consumes: every extra
# field makes each batch heavier without adding data to the snapshot.
FIELDS = """
  stargazerCount
  forkCount
  isArchived
  createdAt
  pushedAt
  description
  url
"""


class RateLimited(RuntimeError):
    """GitHub refused the call because of a primary or secondary rate limit."""

    def __init__(self, message: str, wait: int | None = None, headers: dict[str, str] | None = None):
        self.wait = wait
        self.headers = headers or {}
        super().__init__(message)


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


def _header_int(headers: dict[str, str], name: str) -> int | None:
    value = headers.get(name)
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _rate_wait(headers: dict[str, str]) -> int | None:
    """Seconds GitHub asked us to wait, from retry-after or the reset header."""
    retry_after = _header_int(headers, "retry-after")
    if retry_after is not None:
        return max(0, retry_after)
    if headers.get("x-ratelimit-remaining") == "0":
        reset = _header_int(headers, "x-ratelimit-reset")
        if reset is not None:
            return max(0, reset - int(time.time()))
    return None


def _rate_note(headers: dict[str, str]) -> str:
    limit = headers.get("x-ratelimit-limit")
    remaining = headers.get("x-ratelimit-remaining")
    reset = _header_int(headers, "x-ratelimit-reset")
    parts: list[str] = []
    if remaining is not None and limit is not None:
        parts.append(f"graphql points remaining={remaining}/{limit}")
    elif remaining is not None:
        parts.append(f"graphql points remaining={remaining}")
    if reset is not None:
        parts.append(f"reset in {max(0, reset - int(time.time()))}s")
    return ", ".join(parts)


def graphql(token: str, query: str) -> tuple[dict, dict[str, str]]:
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
            headers = {key.lower(): value for key, value in resp.headers.items()}
            body = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        headers = {key.lower(): value for key, value in (exc.headers or {}).items()}
        body_text = exc.read().decode("utf-8", "replace")
        if exc.code in (403, 429) or "rate limit" in body_text.lower():
            raise RateLimited(body_text[:400], _rate_wait(headers), headers) from exc
        raise
    if body.get("errors"):
        messages = [str(e.get("message")) for e in body["errors"]]
        if any("rate limit" in m.lower() for m in messages):
            raise RateLimited("; ".join(messages)[:400], _rate_wait(headers), headers)
    return body.get("data") or {}, headers


def fetch_batch(token: str, batch: list[dict]) -> tuple[dict, dict[str, str]]:
    aliases = " ".join(
        f'r{i}: repository(owner: "{p["owner"]}", name: "{p["repo"]}") {{ {FIELDS} }}'
        for i, p in enumerate(batch)
    )
    return graphql(token, "query { " + aliases + " }")


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


def assemble(seed_plugins: list[dict], by_slug: dict[str, dict]) -> tuple[list[dict], int]:
    """Order records like the seed, keep extra (historic) slugs at the end."""
    order = [p["slug"] for p in seed_plugins]
    ordered = [by_slug[slug] for slug in order if slug in by_slug]
    known = set(order)
    ordered += [rec for slug, rec in by_slug.items() if slug not in known]
    ok = sum(1 for rec in ordered if rec.get("status") == "ok")
    return ordered, ok


def build_payload(
    date: str,
    seed_plugins: list[dict],
    by_slug: dict[str, dict],
    elapsed_s: float,
    authenticated: bool,
) -> dict:
    ordered, ok = assemble(seed_plugins, by_slug)
    failures = [
        {
            "slug": rec["slug"],
            "repo": f'{rec["owner"]}/{rec["repo"]}',
            "status": rec["status"],
            "error": rec.get("error", ""),
        }
        for rec in ordered
        if rec["status"] != "ok"
    ]
    complete = len(ordered) >= len(seed_plugins)
    return {
        "date": date,
        "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "source": "awesome-dsh-plugin catalog + GitHub GraphQL",
        "authenticated": authenticated,
        "partial": not complete,
        "elapsed_s": round(elapsed_s, 2),
        "total": len(ordered),
        "ok": ok,
        "failed": len(ordered) - ok,
        "failures": failures,
        "plugins": ordered,
    }


def write_payload(out_path: Path, payload: dict) -> None:
    tmp = out_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(out_path)


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
    parser.add_argument("--delay", type=float, default=1.0, help="seconds to sleep between batches (default 1.0)")
    parser.add_argument("--flush-every", type=int, default=10, help="persist progress after this many batches")
    parser.add_argument("--max-wait", type=int, default=300, help="longest single rate-limit wait in seconds")
    parser.add_argument("--max-seconds", type=int, default=1500, help="stop fetching after this many seconds")
    parser.add_argument("--backoff", type=float, default=30.0, help="wait when the limit gives no reset hint")
    parser.add_argument("--max-retries", type=int, default=3, help="rate-limit retries per batch")
    args = parser.parse_args()

    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("SNAPSHOT_TOKEN")
    if not token:
        print("GITHUB_TOKEN is required for GraphQL snapshots", file=sys.stderr)
        return 1
    try:
        dt.datetime.strptime(args.date, "%Y-%m-%d")
    except ValueError:
        print(f"invalid --date: {args.date} (expected YYYY-MM-DD)", file=sys.stderr)
        return 2

    seed = json.loads(Path(args.seed).read_text(encoding="utf-8"))
    seed_plugins = seed["plugins"]
    assert len({p["slug"] for p in seed_plugins}) == len(seed_plugins), "duplicate slugs in seed"
    fetch_plugins = seed_plugins[: args.limit] if args.limit else seed_plugins
    seed_slugs = {p["slug"] for p in seed_plugins}

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{args.date}.json"
    by_slug: dict[str, dict] = {}
    if out_path.exists():
        if not (args.missing_only or args.force):
            print(f"snapshot already exists: {out_path} (use --force)", file=sys.stderr)
            return 2
        if args.missing_only:
            existing = json.loads(out_path.read_text(encoding="utf-8"))
            by_slug = {
                rec["slug"]: rec
                for rec in existing.get("plugins", [])
                if rec.get("slug") in seed_slugs
            }

    have = {slug for slug, rec in by_slug.items() if rec.get("status") == "ok"}
    pending = [p for p in fetch_plugins if p["slug"] not in have]
    if not pending:
        print(json.dumps({"date": args.date, "missing": 0, "note": "nothing to fetch"}))
        return 0

    started = time.time()
    deadline = started + args.max_seconds
    existing_records = len(by_slug)

    def persist(note: str = "") -> None:
        if not by_slug:
            # Nothing fetched yet: never write an empty snapshot file.
            return
        payload = build_payload(args.date, seed_plugins, by_slug, time.time() - started, True)
        write_payload(out_path, payload)
        if note:
            print(
                f"{note}: saved {payload['ok']}/{len(fetch_plugins)} ok "
                f"({payload['total']} records) -> {out_path}",
                file=sys.stderr,
            )

    index = 0
    since_flush = 0
    retries = 0
    while index < len(pending):
        batch = pending[index : index + BATCH]
        try:
            data, headers = fetch_batch(token, batch)
        except RateLimited as exc:
            retries += 1
            persist("rate limited")
            wait = exc.wait if exc.wait is not None else args.backoff
            if (
                retries > args.max_retries
                or wait > args.max_wait
                or time.time() + wait > deadline
            ):
                print(
                    f"GitHub rate limit exhausted ({exc}); fetched "
                    f"{len(by_slug)}/{len(fetch_plugins)}. Re-run the workflow and it will "
                    f"resume with --missing-only.",
                    file=sys.stderr,
                )
                return 3
            wait = max(1.0, wait)
            print(
                f"rate limited ({exc}); waiting {wait:.0f}s before retrying this batch "
                f"({_rate_note(exc.headers)})",
                file=sys.stderr,
            )
            time.sleep(wait)
            continue
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            retries += 1
            persist("request failed")
            if retries > args.max_retries:
                print(
                    f"request failed after {len(by_slug)}/{len(fetch_plugins)}: {exc}",
                    file=sys.stderr,
                )
                return 1
            wait = min(max(5.0, args.backoff), 60.0)
            print(f"request failed ({exc}); retrying this batch in {wait:.0f}s", file=sys.stderr)
            time.sleep(wait)
            continue
        for i, plugin in enumerate(batch):
            rec = record(plugin, data.get(f"r{i}"))
            by_slug[rec["slug"]] = rec
        index += len(batch)
        retries = 0
        since_flush += 1
        done = len(by_slug)
        note = _rate_note(headers)
        print(f"{done}/{len(fetch_plugins)}{' ' + note if note else ''}", flush=True)
        if since_flush >= max(1, args.flush_every) and index < len(pending):
            persist()
            since_flush = 0
        if index < len(pending):
            time.sleep(max(0.0, args.delay))

    payload = build_payload(args.date, seed_plugins, by_slug, time.time() - started, True)
    write_payload(out_path, payload)
    print(
        json.dumps(
            {
                "date": args.date,
                "total": payload["total"],
                "ok": payload["ok"],
                "failed": payload["failed"],
                "elapsed_s": payload["elapsed_s"],
                "resumed_from": existing_records,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
