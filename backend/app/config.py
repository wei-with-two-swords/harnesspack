"""Application settings.

Every path can be overridden with an environment variable so the same code
runs against the local workspace, CI, and the 1C1G server.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

# backend/app/config.py -> repository root
REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    db_path: Path = REPO_ROOT / "data" / "harnesspack.db"
    snapshot_dir: Path = REPO_ROOT / "data" / "snapshots"
    seed_path: Path = REPO_ROOT / "data" / "plugins.seed.json"
    frontend_dist: Path = REPO_ROOT / "frontend" / "dist"
    env: str = "dev"
    ingest_on_startup: bool = True
    base_url: str = "http://127.0.0.1:8000"
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 120
    og_rate_limit_per_minute: int = 20


def _env_path(name: str, default: Path) -> Path:
    return Path(os.environ.get(name, str(default))).expanduser().resolve()


def get_settings() -> Settings:
    return Settings(
        db_path=_env_path("HARNESSPACK_DB", REPO_ROOT / "data" / "harnesspack.db"),
        snapshot_dir=_env_path("HARNESSPACK_SNAPSHOTS", REPO_ROOT / "data" / "snapshots"),
        seed_path=_env_path("HARNESSPACK_SEED", REPO_ROOT / "data" / "plugins.seed.json"),
        frontend_dist=_env_path("HARNESSPACK_FRONTEND", REPO_ROOT / "frontend" / "dist"),
        env=os.environ.get("HARNESSPACK_ENV", "dev"),
        ingest_on_startup=os.environ.get("HARNESSPACK_INGEST", "1") != "0",
        base_url=os.environ.get("HARNESSPACK_BASE_URL", "http://127.0.0.1:8000"),
        rate_limit_enabled=os.environ.get("HARNESSPACK_RATE_LIMIT", "1") != "0",
        rate_limit_per_minute=int(os.environ.get("HARNESSPACK_RATE_LIMIT_PER_MIN", "120")),
        og_rate_limit_per_minute=int(os.environ.get("HARNESSPACK_OG_LIMIT_PER_MIN", "20")),
    )
