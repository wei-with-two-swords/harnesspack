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
)


def slugify(owner: str, repo: str) -> str:
    return SLUG_RE.sub("-", f"{owner}-{repo}".lower()).strip("-")


def main() -> int:
    catalog_path = ROOT / "data" / "catalog" / "latest.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    repos = catalog.get("repos") or {}

    plugins = []
    for key in sorted(repos):
        item = repos[key]
        owner = item["owner"]
        repo = item["repo"]
        name = str(item.get("name") or f"{owner}/{repo}")
        shown = name.split("#", 1)[0].strip() or repo
        plugins.append(
            {
                "owner": owner,
                "repo": repo,
                "slug": slugify(owner, repo),
                "name": shown[:120],
                "category": str(item.get("category") or "other"),
                "harness": "dsh",
                "url": f"https://github.com/{owner}/{repo}",
                "note": "",
            }
        )

    slugs = [p["slug"] for p in plugins]
    dupes = {s for s in slugs if slugs.count(s) > 1}
    if dupes:
        print(f"duplicate slugs: {sorted(dupes)[:10]}", file=sys.stderr)
        return 1

    payload = {
        "version": 6,
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
    print(json.dumps({"plugins": len(plugins), "bytes": out.stat().st_size, "categories": dict(sorted(counts.items(), key=lambda kv: -kv[1]))}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())

