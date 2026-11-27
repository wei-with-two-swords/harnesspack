"""Build data/plugins.seed.json from the vendored awesome-dsh-plugin catalog.

Membership and categories come from the upstream catalog; this script only
normalises it into the seed format used by the ingest pipeline. One row per
repository, sorted by stars-agnostic key (owner/repo) so the file is stable.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SLUG_RE = re.compile(r"[^a-z0-9]+")

INCLUSION_RULE = (
    "名单与分类来自 awesome-dsh-plugin 精选清单（CC0-1.0，https://github.com/awesome-dsh-plugin/awesome-dsh-plugin），"
    "按其 data/plugins 条目收录、按仓库去重（子目录条目归一到仓库）；分类沿用上游 23 类。"
    "移除规则：上游删除、仓库 404/archived、90 天无 commit/release 且 star 无净增长（先进观察区）即退出榜单，历史曲线保留。"
    "另：GitHub topic 扫描发现的、上游尚未收录的仓库以 watch 观察条目并入（scripts/discover_topic.py），"
    "上游收录后自动升级为正式条目。"
)


def slugify(owner: str, repo: str) -> str:
    return SLUG_RE.sub("-", f"{owner}-{repo}".lower()).strip("-")


def main() -> int:
    catalog_path = ROOT / "data" / "catalog" / "latest.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    repos = catalog.get("repos") or {}
    aliases_path = ROOT / "data" / "catalog" / "aliases.json"
    aliases = {}
    if aliases_path.exists():
        aliases = json.loads(aliases_path.read_text(encoding="utf-8")).get("aliases") or {}

    # Repositories retired by scripts/prune_seed.py (deleted/private upstream,
    # not found for N consecutive snapshots). They leave the rankings per the
    # inclusion rule; the exclusion list restores them automatically if the
    # repository becomes available again.
    excluded_path = ROOT / "data" / "catalog" / "excluded.json"
    excluded: set[str] = set()
    if excluded_path.exists():
        try:
            excluded = set(
                str(slug)
                for slug in (json.loads(excluded_path.read_text(encoding="utf-8")).get("excluded") or {})
            )
        except (OSError, json.JSONDecodeError):
            excluded = set()

    plugins = []
    for key in sorted(repos):
        item = repos[key]
        owner = item["owner"]
        repo = item["repo"]
        original = f"{owner}/{repo}"
        alias = aliases.get(original.lower())
        canonical = alias is None
        if alias:
            owner = alias["owner"]
            repo = alias["repo"]
        name = str(item.get("name") or f"{owner}/{repo}")
        shown = name.split("#", 1)[0].strip() or repo
        plugins.append(
            {
                "owner": owner,
                "repo": repo,
                "slug": slugify(owner, repo),
                "name": shown[:120],
                "category": str(item.get("category") or "other"),
                "npm": str(item.get("npm") or ""),
                "harness": "dsh",
                "url": f"https://github.com/{owner}/{repo}",
                "note": "",
                "_canonical": canonical,
                "_original": original,
            }
        )

    # Topic-discovered candidates the upstream catalog does not list yet.
    # They enter the seed as watch entries (observation zone): never ranked,
    # promoted automatically once the catalog lists them.
    discovered_path = ROOT / "data" / "catalog" / "discovered.json"
    if discovered_path.exists():
        discovered = json.loads(discovered_path.read_text(encoding="utf-8")).get("repos") or {}
        for key in sorted(discovered):
            item = discovered[key]
            owner = str(item.get("owner") or key.split("/", 1)[0])
            repo = str(item.get("repo") or key.split("/", 1)[-1])
            plugins.append(
                {
                    "owner": owner,
                    "repo": repo,
                    "slug": slugify(owner, repo),
                    "name": str(item.get("name") or f"{owner}/{repo}")[:120],
                    "category": "other",
                    "npm": "",
                    "harness": "dsh",
                    "url": f"https://github.com/{owner}/{repo}",
                    "note": "",
                    "watch": True,
                    "_canonical": False,
                    "_original": key,
                }
            )

    # Renames can collide with an existing entry; keep the canonical name.
    plugins = [p for p in plugins if p["slug"] not in excluded]
    by_repo = {}
    for plugin in plugins:
        key = f'{plugin["owner"]}/{plugin["repo"]}'.lower()
        current = by_repo.get(key)
        if current is None or (plugin['_canonical'] and not current['_canonical']):
            by_repo[key] = plugin
        elif current['_canonical'] == plugin['_canonical'] and len(plugin['name']) < len(current['name']):
            by_repo[key] = plugin
    plugins = [by_repo[k] for k in sorted(by_repo)]
    for plugin in plugins:
        plugin.pop("_canonical", None)
        plugin.pop("_original", None)

    slugs = [p["slug"] for p in plugins]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    if dupes:
        print(f"duplicate slugs: {sorted(dupes)[:10]}", file=sys.stderr)
        return 1

    payload = {
        "version": 7,
        "updated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"),
        "source": "awesome-dsh-plugin catalog",
        "inclusion_rule": INCLUSION_RULE,
        "plugins": plugins,
    }
    out = ROOT / "data" / "plugins.seed.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    counts: dict[str, int] = {}
    for p in plugins:
        counts[p["category"]] = counts.get(p["category"], 0) + 1
    print(json.dumps({"plugins": len(plugins), "excluded_dead": len(excluded), "bytes": out.stat().st_size, "categories": dict(sorted(counts.items(), key=lambda kv: -kv[1]))}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())

