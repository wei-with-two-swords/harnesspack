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
    npm_downloads_dir: Path = REPO_ROOT / "data" / "npm_downloads"
    frontend_dist: Path = REPO_ROOT / "frontend" / "dist"
    env: str = "dev"
    ingest_on_startup: bool = True
    base_url: str = "http://127.0.0.1:8000"
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = 120
    og_rate_limit_per_minute: int = 20
    # /api/* gets a tighter, two-tier quota than ordinary page browsing.
    api_anon_per_minute: int = 20
    api_anon_per_day: int = 100
    api_auth_per_minute: int = 50
    api_auth_per_day: int = 500
    # Community browsing is cheap; writing is not. Keep separate buckets so
    # the tight general API quota does not break the community feed.
    community_read_per_minute: int = 120
    community_post_per_minute: int = 5
    community_post_per_day: int = 50
    community_comment_per_minute: int = 10
    community_comment_per_day: int = 100
    community_like_per_minute: int = 30
    community_like_per_day: int = 300
    # GitHub OAuth (empty client id disables sign-in entirely).
    github_client_id: str = ""
    github_client_secret: str = ""
    session_secret: str = ""
    # Outbound email (SMTP). An empty host disables sending: the digest and
    # memory-alert commands then exit without touching the network.
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    # Where memory/ops alerts go (falls back to smtp_from).
    alert_email: str = ""
    # Bing IndexNow key: non-empty enables the key file route and CLI push.
    indexnow_key: str = ""


def _env_path(name: str, default: Path) -> Path:
    return Path(os.environ.get(name, str(default))).expanduser().resolve()


def get_settings() -> Settings:
    return Settings(
        db_path=_env_path("HARNESSPACK_DB", REPO_ROOT / "data" / "harnesspack.db"),
        snapshot_dir=_env_path("HARNESSPACK_SNAPSHOTS", REPO_ROOT / "data" / "snapshots"),
        seed_path=_env_path("HARNESSPACK_SEED", REPO_ROOT / "data" / "plugins.seed.json"),
        npm_downloads_dir=_env_path(
            "HARNESSPACK_NPM_DOWNLOADS", REPO_ROOT / "data" / "npm_downloads"
        ),
        frontend_dist=_env_path("HARNESSPACK_FRONTEND", REPO_ROOT / "frontend" / "dist"),
        env=os.environ.get("HARNESSPACK_ENV", "dev"),
        ingest_on_startup=os.environ.get("HARNESSPACK_INGEST", "1") != "0",
        base_url=os.environ.get("HARNESSPACK_BASE_URL", "http://127.0.0.1:8000"),
        rate_limit_enabled=os.environ.get("HARNESSPACK_RATE_LIMIT", "1") != "0",
        rate_limit_per_minute=int(os.environ.get("HARNESSPACK_RATE_LIMIT_PER_MIN", "120")),
        og_rate_limit_per_minute=int(os.environ.get("HARNESSPACK_OG_LIMIT_PER_MIN", "20")),
        api_anon_per_minute=int(os.environ.get("HARNESSPACK_API_ANON_PER_MIN", "20")),
        api_anon_per_day=int(os.environ.get("HARNESSPACK_API_ANON_PER_DAY", "100")),
        api_auth_per_minute=int(os.environ.get("HARNESSPACK_API_AUTH_PER_MIN", "50")),
        api_auth_per_day=int(os.environ.get("HARNESSPACK_API_AUTH_PER_DAY", "500")),
        community_read_per_minute=int(
            os.environ.get("HARNESSPACK_COMMUNITY_READ_PER_MIN", "120")
        ),
        community_post_per_minute=int(os.environ.get("HARNESSPACK_COMMUNITY_POST_PER_MIN", "5")),
        community_post_per_day=int(os.environ.get("HARNESSPACK_COMMUNITY_POST_PER_DAY", "50")),
        community_comment_per_minute=int(
            os.environ.get("HARNESSPACK_COMMUNITY_COMMENT_PER_MIN", "10")
        ),
        community_comment_per_day=int(os.environ.get("HARNESSPACK_COMMUNITY_COMMENT_PER_DAY", "100")),
        community_like_per_minute=int(os.environ.get("HARNESSPACK_COMMUNITY_LIKE_PER_MIN", "30")),
        community_like_per_day=int(os.environ.get("HARNESSPACK_COMMUNITY_LIKE_PER_DAY", "300")),
        github_client_id=os.environ.get("GITHUB_CLIENT_ID", ""),
        github_client_secret=os.environ.get("GITHUB_CLIENT_SECRET", ""),
        session_secret=os.environ.get("HARNESSPACK_SESSION_SECRET", ""),
        smtp_host=os.environ.get("HARNESSPACK_SMTP_HOST", ""),
        smtp_port=int(os.environ.get("HARNESSPACK_SMTP_PORT", "465")),
        smtp_user=os.environ.get("HARNESSPACK_SMTP_USER", ""),
        smtp_password=os.environ.get("HARNESSPACK_SMTP_PASSWORD", ""),
        smtp_from=os.environ.get("HARNESSPACK_SMTP_FROM", ""),
        alert_email=os.environ.get("HARNESSPACK_ALERT_EMAIL", ""),
        indexnow_key=os.environ.get("HARNESSPACK_INDEXNOW_KEY", ""),
    )
