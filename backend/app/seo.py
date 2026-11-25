"""Server-side SEO metadata for the SPA shell.

React sets titles and meta tags client-side, but crawlers and social previews
never execute JavaScript. The shell therefore has to leave FastAPI with the
right ``title``, ``meta description``, canonical link, Open Graph / Twitter
tags and JSON-LD for every public route.

The helpers here are pure (no database access) so they are easy to test; the
route table lives in :mod:`backend.app.main`.
"""

from __future__ import annotations

import json
from html import escape
from typing import Any

SITE_NAME = "HarnessPack"
SITE_TITLE = "HarnessPack · DSH 插件 star 榜单"
SITE_DESCRIPTION = (
    "HarnessPack 每天抓取一次 DeepSeek Harness（DSH）插件的 GitHub star，"
    "按真实增量排近 24 小时、区间增速、总榜、名次、最新、稳健与 NPM 榜，覆盖 11,700+ 个可安装插件。"
)

BOARDS: dict[str, tuple[str, str]] = {
    "velocity": ("近 24 小时榜", "按最近 24 小时新增 star 排序：相邻两次快照的差值，谁涨得最快。"),
    "growth": ("区间增速榜", "按近 7 天或近 30 天涨幅排序：只统计基准日 star 不低于 50 的插件。"),
    "total": ("总榜", "按当前 star 总量排序，并列时按名称升序。"),
    "darkhorse": ("名次榜", "按近 7 天总榜名次跃升幅度排序，谁在悄悄爬升。"),
    "rookie": ("最新榜", "最近 30 天新建、且 star 不低于 10 的在册插件。"),
    "quality": ("稳健榜", "按近 30 天剔除异常单日涨幅后的日均新增排序。"),
    "npm": ("NPM 榜", "按 npm registry 近 1 年、年至今、近 24 小时、近 7 天或近 30 天的包下载量排序，star 仅作对照，两种数据不合并。"),
}

CATEGORY_LABELS: dict[str, str] = {
    "ui": "UI",
    "tools": "工具",
    "session": "会话",
    "workflow": "工作流",
    "usage": "用量",
    "dev": "开发",
    "model": "模型",
    "memory": "记忆",
    "theme": "主题",
    "skill": "技能",
    "notify": "通知",
    "fun": "趣味",
    "remote": "远程",
    "security": "安全",
    "browser": "浏览器",
    "docs": "文档",
    "vision": "视觉",
    "git": "Git",
    "voice": "语音",
    "market": "市场",
    "identity": "身份",
    "agi": "AGI",
    "wsl": "WSL",
}

PAGES: dict[str, tuple[str, str]] = {
    "about": (
        "关于",
        "站点简介、收录规则、插件提交、数据口径与使用条款。",
    ),
    "changelog": (
        "名单变更与数据状态",
        "上游清单每次同步的新增、移除与变更记录，以及快照覆盖率、最近抓取、失败清单与数据库计数。",
    ),
    "api": ("API", "只读 JSON API：榜单、插件详情、曲线、对比与名单变更。"),
    "community": ("DSH 讨论区", "DeepSeek Harness 开发者的公开广场，用 GitHub 账号登录发帖、评论与点赞。"),
}


def truncate(text: str | None, limit: int = 155) -> str:
    cleaned = " ".join((text or "").split())
    if not cleaned:
        return SITE_DESCRIPTION
    return cleaned if len(cleaned) <= limit else cleaned[: limit - 1].rstrip() + "…"


def _jsonld_block(payload: dict[str, Any]) -> str:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f'<script type="application/ld+json">{body}</script>'


def website_jsonld(base: str, first_day: str | None, last_day: str | None) -> list[dict[str, Any]]:
    dataset: dict[str, Any] = {
        "@type": "Dataset",
        "name": "DSH 插件 star 每日快照",
        "description": SITE_DESCRIPTION,
        "url": f"{base}/",
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "isAccessibleForFree": True,
        "creator": {"@type": "Organization", "name": SITE_NAME, "url": base},
        "encodingFormat": "application/json",
        "distribution": {
            "@type": "DataDownload",
            "contentUrl": f"{base}/sitemap.xml",
            "encodingFormat": "application/xml",
        },
    }
    if first_day and last_day:
        dataset["temporalCoverage"] = f"{first_day}/{last_day}"
    return [
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebSite",
                    "name": SITE_NAME,
                    "url": f"{base}/",
                    "description": SITE_DESCRIPTION,
                    "inLanguage": "zh-CN",
                },
                dataset,
            ],
        }
    ]


def plugin_jsonld(detail: dict[str, Any], base: str) -> list[dict[str, Any]]:
    canonical = f"{base}/plugins/{detail['slug']}"
    return [
        {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "SoftwareApplication",
                    "name": detail["name"],
                    "description": truncate(detail.get("description")),
                    "url": canonical,
                    "codeRepository": detail.get("url"),
                    "applicationCategory": "DeveloperApplication",
                    "operatingSystem": "Any",
                    "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
                    "softwareHelp": f"{base}/api",
                    "author": {"@type": "Organization", "name": detail["owner"]},
                },
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {"@type": "ListItem", "position": 1, "name": "首页", "item": f"{base}/"},
                        {"@type": "ListItem", "position": 2, "name": detail["name"], "item": canonical},
                    ],
                },
            ],
        }
    ]


def board_jsonld(
    label: str,
    items: list[dict[str, Any]],
    base: str,
    canonical: str,
) -> list[dict[str, Any]]:
    if not items:
        return []
    return [
        {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": f"{label} | {SITE_NAME}",
            "url": canonical,
            "numberOfItems": len(items),
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": index + 1,
                    "name": item["name"],
                    "url": f"{base}/plugins/{item['slug']}",
                }
                for index, item in enumerate(items)
            ],
        }
    ]


def build_tags(
    *,
    title: str,
    description: str,
    canonical: str | None,
    image: str,
    robots: str,
    jsonld: list[dict[str, Any]],
) -> str:
    tags = [
        f'<meta name="description" content="{escape(description, quote=True)}">',
    ]
    if canonical:
        tags.append(f'<link rel="canonical" href="{escape(canonical, quote=True)}">')
    tags += [
        f'<meta name="robots" content="{escape(robots, quote=True)}">',
        '<meta property="og:site_name" content="HarnessPack">',
        '<meta property="og:locale" content="zh_CN">',
        '<meta property="og:type" content="website">',
    ]
    if canonical:
        tags.append(f'<meta property="og:url" content="{escape(canonical, quote=True)}">')
    tags += [
        f'<meta property="og:title" content="{escape(title, quote=True)}">',
        f'<meta property="og:description" content="{escape(description, quote=True)}">',
        f'<meta property="og:image" content="{escape(image, quote=True)}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{escape(title, quote=True)}">',
        f'<meta name="twitter:description" content="{escape(description, quote=True)}">',
        f'<meta name="twitter:image" content="{escape(image, quote=True)}">',
        '<link rel="alternate" type="application/rss+xml" title="HarnessPack" href="/feed.xml">',
    ]
    tags += [_jsonld_block(item) for item in jsonld]
    return "\n    ".join(tags)
