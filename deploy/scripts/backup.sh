#!/usr/bin/env bash
# 备份 SQLite（WAL 安全），保留 14 天。
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/harnesspack}"
DB="$APP_ROOT/data/harnesspack.db"
OUT="$APP_ROOT/backups"
keep=14

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
