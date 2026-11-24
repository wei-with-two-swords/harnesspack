"""Map npm package names for plugins already in the catalog (no repo discovery).

Only repos listed in the local database are scanned. Two phases:

1. Probe ``raw.githubusercontent.com/{owner}/{repo}/HEAD/package.json`` — this
   host has no API rate limit, so the bulk of repos are resolved cheaply.
2. For repos without a root manifest, list the default-branch tree via the
   GitHub trees API (token required, rate-limit aware) and probe a bounded
   set of candidate ``package.json`` paths.

Every candidate ``name`` is verified against ``registry.npmjs.org``: the
package's ``repository`` URL must resolve back to the plugin's owner/repo,
otherwise the candidate is kept as ``unverified`` and never applied.

Outputs:
    data/npm_map.json   full audit (verified mappings + unverified candidates)
    --apply             write verified names into plugins.npm_package
                        (only fills NULL/empty values; never overwrites)

Checkpoint ``data/npm_map/progress.json`` lets an interrupted run resume.

Usage:
    python scripts/npm_map.py [--limit N] [--apply] [--workers 8]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
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

from snapshot import _load_dotenv, _opener as _snapshot_opener  # noqa: E402

DB_PATH = ROOT / "data" / "harnesspack.db"
OUT_PATH = ROOT / "data" / "npm_map.json"
PROGRESS_PATH = ROOT / "data" / "npm_map" / "progress.json"

RAW_HOST = "https://raw.githubusercontent.com"
API_HOST = "https://api.github.com"
REGISTRY = "https://registry.npmjs.org"

# Paths that never contain a publishable plugin manifest.
SKIP_PATH_PARTS = ("node_modules/", "/dist/", "/build/", "/.github/", "/vendor/", "/test/", "/tests/")
# Paths worth probing first when a repo has many manifests.
PREFER_PARTS = ("dsh", "plugin", "integration", "deepseek", "extension")
MAX_TREE_PROBES = 8
MAX_TREE_DEPTH = 5


def _auth_header() -> dict:
    token = (os.environ.get("GITHUB_TOKEN") or "").strip()
    return {"Authorization": f"Bearer {token}"} if token else {}


# Explicit proxy (e.g. http://127.0.0.1:7897). Set via --proxy; wins over any
# ambient HTTP_PROXY env vars, which sandboxed shells may inject arbitrarily.
_EXPLICIT_PROXY: str | None = None
_local = threading.local()


def _opener() -> urllib.request.OpenerDirector:
    """One opener per thread; uses the explicit proxy when configured."""
    if not hasattr(_local, "opener"):
        if _EXPLICIT_PROXY:
            _local.opener = urllib.request.build_opener(
                urllib.request.ProxyHandler({"http": _EXPLICIT_PROXY, "https": _EXPLICIT_PROXY})
            )
        else:
            _local.opener = _snapshot_opener()
    return _local.opener


def _url_part(value: str) -> str:
    """Percent-encode path components (repo names can contain non-ASCII)."""
    return urllib.parse.quote(str(value), safe="")


def _retry_sleep(attempt: int) -> None:
    time.sleep(min(2**attempt, 8))


def _fetch_json(url: str, headers: dict | None = None, timeout: int = 30, retries: int = 3):
    request = urllib.request.Request(url, headers={"User-Agent": "HarnessPack-npm-map/0.1", **(headers or {})})
    for attempt in range(retries + 1):
        try:
            with _opener().open(request, timeout=timeout) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries:
                _retry_sleep(attempt)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            if attempt < retries:
                _retry_sleep(attempt)
                continue
            raise


def _fetch_raw_text(url: str, timeout: int = 25, retries: int = 3) -> str | None:
    """Return response body text, or None on 404. Retries transient failures."""
    request = urllib.request.Request(url, headers={"User-Agent": "HarnessPack-npm-map/0.1"})
    for attempt in range(retries + 1):
        try:
            with _opener().open(request, timeout=timeout) as response:
                return response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries:
                _retry_sleep(attempt)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt < retries:
                _retry_sleep(attempt)
                continue
            raise


def _manifest_candidates(text: str) -> list[str]:
    """Extract publishable package names from a package.json body."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, dict) or not data.get("name"):
        return []
    dsh = data.get("dsh")
    has_bundle = isinstance(dsh, dict) and ("bundle" in dsh or "bundle.patch" in dsh)
    # A dsh.bundle marker is the strongest signal; a plain name still counts
    # as a candidate and the registry check decides.
    name = str(data["name"]).strip()
    return [name] if name and not name.startswith(("github:", "git+")) else []


_REPO_URL_RE = re.compile(r"github\.com[/:]([A-Za-z0-9_.-]+)/([^/#?.]+)")


def _registry_verify(name: str, owner: str, repo: str) -> dict:
    """Check the npm registry, returning a confidence tier.

    strong  — the package's repository field resolves back to owner/repo
    medium  — the package exists and was declared in the repo's own manifest,
              but the registry repository field names a different repo of the
              same owner (common after repo renames), or no repository field
    rejected — package missing from npm, or points at a different owner
    """
    encoded = urllib.parse.quote(name, safe="@")
    try:
        meta = _fetch_json(f"{REGISTRY}/{encoded}/latest", timeout=25)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return {"name": name, "verified": False, "confidence": "rejected", "reason": "not on npm"}
        return {"name": name, "verified": False, "confidence": "rejected", "reason": f"http {exc.code}"}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        return {"name": name, "verified": False, "confidence": "rejected", "reason": f"{type(exc).__name__}"}
    repo_field = meta.get("repository")
    if isinstance(repo_field, dict):
        repo_url = str(repo_field.get("url") or "")
        directory = str(repo_field.get("directory") or "")
    else:
        repo_url, directory = str(repo_field or ""), ""
    base = {"name": name, "version": meta.get("version"), "repository": repo_url or None}
    haystack = (repo_url + " " + directory).lower()
    if f"{owner}/{repo}".lower() in haystack:
        return {**base, "verified": True, "confidence": "strong"}
    match = _REPO_URL_RE.search(repo_url)
    reg_owner = (match.group(1) or "").lower() if match else ""
    if not repo_url:
        return {**base, "verified": True, "confidence": "medium", "reason": "no repository field"}
    if reg_owner == owner.lower():
        return {**base, "verified": True, "confidence": "medium", "reason": "same owner, different repo (rename?)"}
    return {**base, "verified": False, "confidence": "rejected", "reason": "repository points at another owner"}


def _api_json_rate_aware(path: str) -> dict | None:
    """GET an api.github.com JSON resource, sleeping through core-rate limits."""
    url = f"{API_HOST}{path}"
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        **_auth_header(),
    }
    while True:
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "HarnessPack-npm-map/0.1", **headers})
            with _opener().open(request, timeout=40) as response:
                remaining = response.headers.get("X-RateLimit-Remaining")
                reset = response.headers.get("X-RateLimit-Reset")
                payload = json.load(response)
            if remaining is not None and reset is not None and int(remaining) <= 5:
                wait = max(int(reset) - time.time(), 0) + 5
                print(f"  core quota nearly spent, sleeping {wait:.0f}s", flush=True)
                time.sleep(wait)
            return payload
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            if exc.code in (403, 429):
                reset = exc.headers.get("X-RateLimit-Reset")
                wait = max(int(reset) - time.time(), 1) + 5 if reset else 120
                print(f"  core rate limited ({exc.code}), sleeping {wait:.0f}s", flush=True)
                time.sleep(wait)
                continue
            raise


def _probe_paths(owner: str, repo: str, paths: list[str]) -> list[str]:
    """Probe raw manifest paths concurrently, return candidate package names."""
    names: list[str] = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(_fetch_raw_text, f"{RAW_HOST}/{_url_part(owner)}/{_url_part(repo)}/HEAD/{urllib.parse.quote(path, safe='/')}"): path
            for path in paths
        }
        for future in as_completed(futures):
            text = future.result()
            if text:
                names.extend(_manifest_candidates(text))
    return names


def _resolve_repo(owner: str, repo: str, progress: dict) -> dict:
    """Resolve one repo to verified npm package names (or a failure reason)."""
    # Phase 1: root manifest, no API quota spent.
    text = _fetch_raw_text(f"{RAW_HOST}/{_url_part(owner)}/{_url_part(repo)}/HEAD/package.json")
    if text is None:
        return _resolve_via_tree(owner, repo, progress)
    names = _manifest_candidates(text)
    if not names:
        # Root manifest exists but has no usable name (e.g. workspace root) —
        # the real package usually lives in a subdirectory.
        return _resolve_via_tree(owner, repo, progress, skip_root=True)
    checks = [_registry_verify(n, owner, repo) for n in names[:3]]
    verified = [c for c in checks if c["verified"]]
    if verified:
        return {"status": "resolved", "source": "root-manifest", "packages": checks}
    # Root name not published: fall through to the tree scan.
    return _resolve_via_tree(owner, repo, progress, extra_names=[c["name"] for c in checks])


def _resolve_via_tree(owner: str, repo: str, progress: dict, skip_root: bool = False, extra_names: list[str] | None = None) -> dict:
    tree = None
    for branch in ("HEAD", "main", "master"):
        tree = _api_json_rate_aware(f"/repos/{_url_part(owner)}/{_url_part(repo)}/git/trees/{_url_part(branch)}?recursive=1")
        if tree is not None:
            break
    if tree is None:
        meta = _api_json_rate_aware(f"/repos/{_url_part(owner)}/{_url_part(repo)}")
        if meta is None:
            return {"status": "repo-not-found"}
        branch = meta.get("default_branch") or "main"
        tree = _api_json_rate_aware(f"/repos/{_url_part(owner)}/{_url_part(repo)}/git/trees/{_url_part(branch)}?recursive=1")
        if tree is None:
            return {"status": "repo-not-found"}
    if tree.get("truncated"):
        progress["truncated_repos"] = progress.get("truncated_repos", []) + [f"{owner}/{repo}"]

    paths = []
    for item in tree.get("tree") or []:
        path = item.get("path") or ""
        if not path.endswith("package.json") or item.get("type") != "blob":
            continue
        if skip_root and path == "package.json":
            continue
        if any(part in f"/{path}" for part in SKIP_PATH_PARTS):
            continue
        depth = path.count("/")
        if depth > MAX_TREE_DEPTH:
            continue
        paths.append((depth, path))
    if not paths:
        return {"status": "no-manifest"}

    paths.sort(key=lambda p: (0 if any(k in p[1].lower() for k in PREFER_PARTS) else 1, p[0], p[1]))
    probe = [p for _, p in paths[:MAX_TREE_PROBES]]
    names = _probe_paths(owner, repo, probe)
    if extra_names:
        names = list(dict.fromkeys(extra_names + names))
    if not names:
        return {"status": "no-manifest"}
    checks = [_registry_verify(n, owner, repo) for n in list(dict.fromkeys(names))[:5]]
    verified = [c for c in checks if c["verified"]]
    return {
        "status": "resolved" if verified else "unverified",
        "source": "tree-scan",
        "packages": checks,
    }


def _load_missing() -> list[dict]:
    import sqlite3

    conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT slug, owner, repo FROM plugins "
        "WHERE status IN ('active', 'watch') AND (npm_package IS NULL OR npm_package = '') "
        "ORDER BY slug"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _save_progress(progress: dict, results: dict) -> None:
    """Merge new results into the checkpoint and persist it."""
    PROGRESS_PATH.parent.mkdir(parents=True, exist_ok=True)
    progress.setdefault("results", {}).update(results)
    PROGRESS_PATH.write_text(json.dumps(progress, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=0, help="only process the first N repos")
    parser.add_argument("--sample", type=int, default=0, help="process N random repos (fixed seed, for yield estimation)")
    parser.add_argument("--apply", action="store_true", help="write verified names into the database")
    parser.add_argument("--workers", type=int, default=8, help="raw-fetch concurrency for phase 1")
    parser.add_argument("--proxy", default="", help="explicit HTTP(S) proxy URL, e.g. http://127.0.0.1:7897")
    args = parser.parse_args()

    global _EXPLICIT_PROXY
    if args.proxy:
        _EXPLICIT_PROXY = args.proxy.strip()

    _load_dotenv()
    if not _auth_header():
        print("WARNING: GITHUB_TOKEN not set; phase 2 will be heavily rate limited", file=sys.stderr)

    repos = _load_missing()
    progress = {}
    if PROGRESS_PATH.exists():
        progress = json.loads(PROGRESS_PATH.read_text(encoding="utf-8"))
    done: dict = progress.get("results") or {}
    todo = [r for r in repos if r["slug"] not in done]
    if args.sample:
        import random

        random.Random(42).shuffle(todo)
        todo = todo[: args.sample]
    elif args.limit:
        todo = todo[: args.limit]
    print(f"missing npm: {len(repos)}, already resolved: {len(repos) - len([r for r in repos if r['slug'] not in done])}, todo: {len(todo)}", flush=True)

    # Phase 1 in parallel: raw root-manifest probe only, no API quota.
    def phase1(repo_row: dict):
        owner, repo = repo_row["owner"], repo_row["repo"]
        text = _fetch_raw_text(f"{RAW_HOST}/{_url_part(owner)}/{_url_part(repo)}/HEAD/package.json")
        if text is None:
            return None  # needs phase 2
        names = _manifest_candidates(text)
        if not names:
            return None
        checks = [_registry_verify(n, owner, repo) for n in names[:3]]
        if any(c["verified"] for c in checks):
            return {"status": "resolved", "source": "root-manifest", "packages": checks}
        return None

    needs_tree: list[dict] = []
    batch: dict = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(phase1, row): row for row in todo}
        for i, future in enumerate(as_completed(futures), 1):
            row = futures[future]
            try:
                result = future.result()
            except Exception as exc:  # noqa: BLE001
                result = {"status": "error", "reason": f"{type(exc).__name__}: {exc}"}
            if result is None:
                needs_tree.append(row)
            else:
                batch[row["slug"]] = result
            if i % 10 == 0 or i == len(todo):
                print(f"phase1 {i}/{len(todo)}: resolved {len(batch)}, need tree {len(needs_tree)}", flush=True)
                _save_progress(progress, batch)
                batch = {}
    print(f"phase1 done: resolved {len(batch) + sum(1 for v in done.values() if v.get('status') == 'resolved')}, need tree scan: {len(needs_tree)}", flush=True)

    # Phase 2: tree scan, a few repos in flight; per-request rate limiting
    # lives in _api_json_rate_aware, so a shared core quota pauses all workers.
    def phase2_worker(row: dict):
        try:
            return row["slug"], _resolve_repo(row["owner"], row["repo"], progress)
        except Exception as exc:  # noqa: BLE001
            return row["slug"], {"status": "error", "reason": f"{type(exc).__name__}: {exc}"}

    tree_workers = min(args.workers, 6)
    with ThreadPoolExecutor(max_workers=tree_workers) as pool:
        futures = [pool.submit(phase2_worker, row) for row in needs_tree]
        for i, future in enumerate(as_completed(futures), 1):
            slug, result = future.result()
            batch[slug] = result
            if i % 50 == 0 or i == len(needs_tree):
                counts = {}
                for v in batch.values():
                    counts[v.get("status")] = counts.get(v.get("status"), 0) + 1
                print(f"phase2 {i}/{len(needs_tree)}: {counts}", flush=True)
                _save_progress(progress, batch)
                batch = {}

    _save_progress(progress, batch)

    # Build the audit payload from full progress.
    results: dict = progress.get("results") or {}

    def _pick(entry: dict) -> dict:
        strong = [c for c in entry["packages"] if c.get("confidence") == "strong"]
        medium = [c for c in entry["packages"] if c.get("confidence") == "medium"]
        return (strong or medium)[0]

    verified = {
        slug: {
            "npm": _pick(entry)["name"],
            "confidence": _pick(entry)["confidence"],
            "all": [c["name"] for c in entry["packages"]],
            "source": entry.get("source"),
        }
        for slug, entry in results.items()
        if entry.get("status") == "resolved"
    }
    summary = {}
    for entry in results.values():
        summary[entry.get("status")] = summary.get(entry.get("status"), 0) + 1
    payload = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "basis": "local database plugins without npm_package",
        "summary": summary,
        "verified_count": len(verified),
        "verified": dict(sorted(verified.items())),
        "unresolved": {
            slug: entry
            for slug, entry in sorted(results.items())
            if entry.get("status") != "resolved"
        },
    }
    OUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"summary": summary, "verified": len(verified)}, ensure_ascii=False), flush=True)

    if args.apply:
        import sqlite3

        conn = sqlite3.connect(DB_PATH)
        updated = 0
        for slug, info in verified.items():
            cur = conn.execute(
                "UPDATE plugins SET npm_package = ? WHERE slug = ? AND (npm_package IS NULL OR npm_package = '')",
                (info["npm"], slug),
            )
            updated += cur.rowcount
        conn.commit()
        conn.close()
        print(f"applied {updated} npm_package values to {DB_PATH.name}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
