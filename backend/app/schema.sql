-- HarnessPack schema (SQLite, WAL). Dates are UTC ISO dates: YYYY-MM-DD.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS plugins (
    id              INTEGER PRIMARY KEY,
    slug            TEXT    NOT NULL UNIQUE,
    owner           TEXT    NOT NULL,
    repo            TEXT    NOT NULL,
    name            TEXT    NOT NULL,
    description     TEXT,
    category        TEXT,
    npm_package     TEXT,
    harness         TEXT,
    url             TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'watch', 'exited')),
    added_at        TEXT,
    exited_at       TEXT,
    exit_reason     TEXT,
    repo_created_at TEXT,
    archived        INTEGER NOT NULL DEFAULT 0,
    stars_latest    INTEGER,
    stars_at        TEXT,
    UNIQUE (owner, repo)
);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins (status);
CREATE INDEX IF NOT EXISTS idx_plugins_harness ON plugins (harness);

CREATE TABLE IF NOT EXISTS stars (
    plugin_id       INTEGER NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
    date            TEXT    NOT NULL,
    count           INTEGER NOT NULL CHECK (count >= 0),
    delta           INTEGER,
    delta_span_days INTEGER,
    is_anomaly      INTEGER NOT NULL DEFAULT 0,
    anomaly_reason  TEXT,
    PRIMARY KEY (plugin_id, date)
);
CREATE INDEX IF NOT EXISTS idx_stars_date ON stars (date);
CREATE INDEX IF NOT EXISTS idx_stars_date_count ON stars (date, count DESC);

CREATE TABLE IF NOT EXISTS fetch_runs (
    date          TEXT PRIMARY KEY,
    fetched_at    TEXT NOT NULL,
    source        TEXT,
    authenticated INTEGER NOT NULL DEFAULT 0,
    total         INTEGER NOT NULL DEFAULT 0,
    ok            INTEGER NOT NULL DEFAULT 0,
    failed        INTEGER NOT NULL DEFAULT 0,
    elapsed_s     REAL,
    note          TEXT
);

-- Phase 2: GitHub OAuth accounts, betting, points. Created now so the schema
-- never needs a destructive migration.
CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY,
    github_id  INTEGER UNIQUE,
    login      TEXT    UNIQUE,
    nickname   TEXT    NOT NULL,
    avatar_url TEXT,
    created_at TEXT    NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash   TEXT PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bets (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    week       TEXT    NOT NULL,
    plugin_id  INTEGER NOT NULL REFERENCES plugins (id),
    created_at TEXT    NOT NULL,
    UNIQUE (user_id, week, plugin_id)
);
CREATE INDEX IF NOT EXISTS idx_bets_week ON bets (week);

CREATE TABLE IF NOT EXISTS points_ledger (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    delta      INTEGER NOT NULL,
    reason     TEXT    NOT NULL,
    week       TEXT,
    created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON points_ledger (user_id);

CREATE TABLE IF NOT EXISTS sponsor_slots (
    id         INTEGER PRIMARY KEY,
    week       TEXT    NOT NULL,
    plugin_id  INTEGER NOT NULL REFERENCES plugins (id),
    label      TEXT    NOT NULL DEFAULT '赞助',
    status     TEXT    NOT NULL DEFAULT 'active',
    UNIQUE (week, plugin_id)
);

CREATE TABLE IF NOT EXISTS repo_history (
    id         INTEGER PRIMARY KEY,
    plugin_id  INTEGER NOT NULL REFERENCES plugins (id) ON DELETE CASCADE,
    old_owner  TEXT,
    old_repo   TEXT,
    new_owner  TEXT,
    new_repo   TEXT,
    changed_at TEXT NOT NULL
);
