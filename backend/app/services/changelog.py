"""Catalog changelog: what the upstream awesome-dsh-plugin list added/removed/changed.

The vendored catalog lives in data/catalog/latest.json and every vendor run appends
one JSON line to data/catalog/changelog.jsonl. We only expose counts plus a small
sample, so the page stays readable even on the first (huge) import.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..config import REPO_ROOT

CHANGELOG_PATH = REPO_ROOT / "data" / "catalog" / "changelog.jsonl"
SAMPLE_SIZE = 10


def recent(limit: int = 50) -> list[dict[str, Any]]:
    """Return the last `limit` changelog entries, newest last (page reverses)."""
    path: Path = CHANGELOG_PATH
    if not path.exists():
        return []
    entries: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
            except ValueError:
                continue
            added = raw.get("added") or []
            removed = raw.get("removed") or []
            changed = raw.get("changed") or []
            entries.append(
                {
                    "at": raw.get("at"),
                    "added": len(added),
                    "removed": len(removed),
                    "changed": len(changed),
                    "added_sample": added[:SAMPLE_SIZE],
                    "removed_sample": removed[:SAMPLE_SIZE],
                    "changed_sample": changed[:SAMPLE_SIZE],
                }
            )
    return entries[-limit:]
