#!/usr/bin/env bash
# 每日同步：拉取快照 → 校验 → 导入。失败时非零退出，systemd 记录日志。
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/harnesspack}"
cd "$APP_ROOT"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] sync start"
git pull --ff-only
"$APP_ROOT/.venv/bin/python" scripts/validate.py
"$APP_ROOT/.venv/bin/python" -m backend.app.cli ingest
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] sync done"
