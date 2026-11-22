#!/usr/bin/env bash
# 同步：拉取快照 → 校验 → 导入。失败时非零退出，systemd 记录日志。
#
# 定时器每小时跑一次，因为 GitHub Actions 的 schedule 经常延迟数小时
# （例如 00:10 UTC 的任务实际在 06:47 UTC 才提交快照）。拉取后如果没有
# 新提交就立即退出，避免每小时都做一遍全量校验和导入。
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/harnesspack}"
cd "$APP_ROOT"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] sync start"
before="$(git rev-parse HEAD)"
git pull --ff-only
after="$(git rev-parse HEAD)"

if [ "$before" = "$after" ]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] no new commits; nothing to ingest"
  exit 0
fi

"$APP_ROOT/.venv/bin/python" scripts/validate.py
"$APP_ROOT/.venv/bin/python" -m backend.app.cli ingest
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] sync done"
