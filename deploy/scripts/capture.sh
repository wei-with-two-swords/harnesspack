#!/usr/bin/env bash
# Server-side capture: fetch the upstream catalog, refresh the seed, snapshot
# GitHub stars, commit the result and ingest it into SQLite.
#
# Runs as the harnesspack user from systemd (00:10 / 01:40 / 03:10 UTC).
# GitHub Actions is kept as a fallback; both paths are idempotent because the
# snapshot step merges into the existing file with --missing-only.
set -uo pipefail

APP_ROOT="${APP_ROOT:-/opt/harnesspack}"
cd "$APP_ROOT"

PY="$APP_ROOT/.venv/bin/python"
DATE="$(date -u +%F)"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

log "capture start date=$DATE"

# Pick up anything pushed by another runner since the last run.
git pull --rebase --autostash || log "warn: git pull failed, continuing"

# Catalog -> seed -> snapshot. The catalog is the only network step that is
# not GitHub, so a failure there must not abort the run.
"$PY" scripts/vendor_catalog.py || log "warn: catalog refresh failed"
"$PY" scripts/heal_seed.py || log "warn: renamed-repo healing failed"
"$PY" scripts/build_seed.py || { log "error: build_seed failed"; exit 1; }

rc=1
for attempt in 1 2 3; do
  if "$PY" scripts/snapshot_graphql.py --date "$DATE" --missing-only; then
    rc=0
    break
  fi
  log "snapshot attempt $attempt failed; retrying in 120s"
  sleep 120
done
if [ "$rc" -ne 0 ]; then
  log "error: snapshot failed after 3 attempts"
  exit 1
fi

"$PY" scripts/validate.py || log "warn: validate reported problems"

git add data/catalog data/plugins.seed.json data/snapshots
if git diff --cached --quiet; then
  log "no snapshot changes to commit"
else
  git -c user.name="HarnessPack Capture" -c user.email="harnesspack@local" \
    commit -m "data: snapshot $DATE" || log "warn: commit failed"
  if ! git push origin HEAD:main; then
    git pull --rebase --autostash origin main || log "warn: rebase failed"
    git push origin HEAD:main || log "warn: push failed (deploy key missing?)"
  fi
fi

"$PY" -m backend.app.cli ingest || { log "error: ingest failed"; exit 1; }
log "capture done"
