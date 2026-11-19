#!/usr/bin/env bash
# certbot 续期后需要 reload nginx。
set -euo pipefail
systemctl reload nginx
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] nginx reloaded after certificate renewal"
