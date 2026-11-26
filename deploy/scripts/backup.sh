#!/usr/bin/env bash
# 备份 SQLite（WAL 安全）与 npm 下载档案，分别保留 14 / 7 天。
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/harnesspack}"
DB="$APP_ROOT/data/harnesspack.db"
NPM_DIR="$APP_ROOT/data/npm_downloads"
OUT="$APP_ROOT/backups"
keep=14
npm_keep=7

mkdir -p "$OUT"
if [ ! -f "$DB" ]; then
  echo "no database at $DB" >&2
  exit 1
fi

day="$(date -u +%F)"
target="$OUT/harnesspack-$day.db"
sqlite3 "$DB" ".backup '$target'"
find "$OUT" -name 'harnesspack-*.db' -type f -mtime +$((keep - 1)) -delete
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup -> $target"

# npm archives are server-local (not in git) — snapshot them too.
if [ -f "$NPM_DIR/archive.json" ]; then
  npm_target="$OUT/npm-downloads-$day.tar.gz"
  tar -czf "$npm_target" -C "$NPM_DIR" archive.json latest.json
  find "$OUT" -name 'npm-downloads-*.tar.gz' -type f -mtime +$((npm_keep - 1)) -delete
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] backup -> $npm_target"
fi
