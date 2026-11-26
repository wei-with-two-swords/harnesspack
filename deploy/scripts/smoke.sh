#!/usr/bin/env bash
# Post-deploy smoke test. Verifies pages answer 200, the health endpoint
# reports an ingested database and (optionally) that the deployed HTML
# references the freshly built asset hashes.
#
# Usage:
#   deploy/scripts/smoke.sh                                # routes + health
#   deploy/scripts/smoke.sh https://harnesspack.dev index-cJktyOp0.js
set -uo pipefail

BASE="${1:-https://harnesspack.dev}"
EXPECT_JS="${2:-}"
FAIL=0

check() {
  local path="$1" code
  code=$(curl -sL -o /dev/null -w '%{http_code}' --max-time 20 "$BASE$path")
  if [ "$code" = "200" ]; then
    echo "ok    $path"
  else
    echo "FAIL  $code $path"
    FAIL=1
  fi
}

HEALTH=$(curl -sL --max-time 20 "$BASE/api/v1/health" || true)
if echo "$HEALTH" | grep -q '"status": *"ok"'; then
  echo "ok    /api/v1/health ($(echo "$HEALTH" | grep -oE '"plugins": *[0-9]+'))"
else
  echo "FAIL  health: $HEALTH"
  FAIL=1
fi

for path in / /community /community/notifications /subscribe /changelog /about /api /compare \
            /sitemap.xml /feed.xml /robots.txt; do
  check "$path"
done

if [ -n "$EXPECT_JS" ]; then
  HTML=$(curl -sL --max-time 20 "$BASE/" || true)
  if printf '%s' "$HTML" | grep -q "$EXPECT_JS"; then
    echo "ok    asset $EXPECT_JS"
  else
    echo "FAIL  expected asset not referenced: $EXPECT_JS"
    FAIL=1
  fi
fi

if [ "$FAIL" = "0" ]; then
  echo "smoke: all checks passed"
else
  echo "smoke: FAILED"
fi
exit "$FAIL"
