from __future__ import annotations

import pytest

from backend.app.db import connect, init_db
from backend.app.services import ranking


def test_total_board_order_and_prev_rank(db):
    payload = ranking.board(db, "total")
    assert payload["as_of"] == "2026-11-12"
    assert [item["slug"] for item in payload["items"]] == [
        "alpha-one",
        "gamma-three",
        "delta-four",
        "beta-two",
    ]
    assert payload["items"][0]["rank"] == 1
    # on 11-11 alpha (200) and gamma (200) tie and alpha wins on name
    assert payload["items"][0]["prev_rank"] == 1
    assert payload["items"][0]["stars"] == 210


def test_velocity_board(db):
    payload = ranking.board(db, "velocity")
    assert [item["slug"] for item in payload["items"]] == [
        "alpha-one",
        "beta-two",
        "gamma-three",
        "delta-four",
    ]
    assert payload["items"][0]["delta"] == 10
    assert payload["items"][-1]["delta"] == -10


def test_growth_uses_exact_base_date_and_ties_on_stars(db):
    payload = ranking.board(db, "growth", window=7)
    items = payload["items"]
    assert [item["slug"] for item in items] == [
        "alpha-one",
        "beta-two",
        "gamma-three",
        "delta-four",
    ]
    assert items[0]["growth"] == pytest.approx(0.5)
    assert items[1]["growth"] == pytest.approx(0.5)
    assert items[1]["stars"] < items[0]["stars"]


def test_growth_missing_base_snapshot_is_empty(db):
    payload = ranking.board(db, "growth", window=7, on="2026-11-03")
    assert payload["items"] == []
    assert "missing snapshot for 2026-10-27" in payload["reason"]


def test_darkhorse_rank_jump(db):
    items = ranking.board(db, "darkhorse", window=7)["items"]
    assert items[0]["slug"] == "alpha-one"
    assert items[0]["growth"] == 2
    assert items[0]["prev_rank"] == 3
    assert items[-1]["slug"] == "delta-four"
    assert items[-1]["growth"] == -2


def test_rookie_board_only_recent_repos(db):
    payload = ranking.rookie_board(db)
    assert [item["slug"] for item in payload["items"]] == ["beta-two"]


def test_unknown_board_raises(db):
    with pytest.raises(ranking.BoardError):
        ranking.board(db, "nope")


def test_bad_window_raises(db):
    with pytest.raises(ranking.BoardError):
        ranking.board(db, "growth", window=5)


def test_empty_database(tmp_path):
    conn = connect(tmp_path / "empty.db")
    init_db(conn)
    assert ranking.latest_date(conn) is None
    payload = ranking.board(conn, "total")
    assert payload["items"] == []
    assert ranking.dashboard(conn)["kpis"]["tracked"] == 0
    conn.close()


def test_category_board_filters_and_reranks(db):
    payload = ranking.board(db, "total", category="workflow")
    assert [item["slug"] for item in payload["items"]] == ["alpha-one", "delta-four"]
    assert [item["rank"] for item in payload["items"]] == [1, 2]
    assert payload["items"][0]["prev_rank"] == 1

    velocity = ranking.board(db, "velocity", category="workflow")
    assert [item["slug"] for item in velocity["items"]] == ["alpha-one", "delta-four"]

    rookie = ranking.rookie_board(db, category="workflow")
    assert rookie["items"] == []
    assert ranking.rookie_board(db, category="coding")["items"][0]["slug"] == "beta-two"


def test_categories_index(db):
    payload = ranking.categories(db)
    by_name = {item["category"]: item for item in payload["items"]}
    assert set(by_name) == {"workflow", "coding", "design"}
    workflow = by_name["workflow"]
    assert workflow["count"] == 2
    assert workflow["total_stars"] == 210 + 140
    assert [t["slug"] for t in workflow["top"]] == ["alpha-one", "delta-four"]
    assert payload["items"][0]["category"] == "workflow"


def test_plugin_detail_and_series(db):
    detail = ranking.plugin_detail(db, "alpha-one")
    assert detail is not None
    assert detail["stars"] == 210
    assert detail["delta"] == 10
    assert detail["rank_total"] == 1
    assert detail["rank_velocity"] == 1
    points = ranking.series(db, "alpha-one")
    assert len(points) == 12
    assert points[-1]["stars"] == 210
    assert points[0]["delta"] is None
    assert ranking.plugin_detail(db, "missing") is None


def test_list_plugins_filters(db):
    items, total = ranking.list_plugins(db)
    assert total == 4
    assert items[0]["slug"] == "alpha-one"
    items, total = ranking.list_plugins(db, query="beta")
    assert total == 1 and items[0]["slug"] == "beta-two"
    items, total = ranking.list_plugins(db, harness="codex")
    assert total == 1
    items, total = ranking.list_plugins(db, category="workflow")
    assert total == 2


def test_dashboard_kpis(db):
    payload = ranking.dashboard(db)
    assert payload["kpis"]["tracked"] == 4
    assert payload["kpis"]["total_stars"] == 210 + 200 + 140 + 105
    assert payload["kpis"]["stars_delta"] == 5
    assert len(payload["top_velocity"]) == 4
    assert payload["top_total"][0]["slug"] == "alpha-one"


def test_detail_exposes_availability_and_peers(db):
    from backend.app.services import ranking

    detail = ranking.plugin_detail(db, "alpha-one")
    assert detail is not None
    assert detail["available"] is True
    assert detail["status"] == "active"
    assert [p["slug"] for p in detail["peers"]]
    assert all(p["slug"] != "alpha-one" for p in detail["peers"])


def test_quality_board_drops_anomaly_days(db):
    beta_id = db.execute("SELECT id FROM plugins WHERE slug = 'beta-two'").fetchone()[0]
    db.execute(
        "UPDATE stars SET delta = 500, is_anomaly = 1 WHERE plugin_id = ? AND date = '2026-11-10'",
        (beta_id,),
    )
    db.commit()

    payload = ranking.board(db, "quality", window=7)
    items = payload["items"]
    assert [item["slug"] for item in items] == [
        "alpha-one",
        "beta-two",
        "gamma-three",
        "delta-four",
    ]
    alpha, beta = items[0], items[1]
    assert alpha["growth"] == 10.0
    assert alpha["real_delta"] == 70
    assert alpha["observed_days"] == 7
    assert alpha["anomaly_days"] == 0
    # The 500-star spike is dropped from both the sum and the day count.
    assert beta["real_delta"] == 30
    assert beta["observed_days"] == 6
    assert beta["anomaly_days"] == 1
    assert beta["growth"] == 5.0
    assert items[2]["growth"] == 0.0
    assert items[3]["growth"] == -10.0


# --- plugin_detail rank equivalence: _plugin_ranks must equal board() ---


def _board_rank(db, name: str, slug: str, window: int | None = None):
    """The rank a plugin holds on a public board, or None if absent."""
    payload = (
        ranking.board(db, name, window=window) if window else ranking.board(db, name)
    )
    for item in payload["items"]:
        if item["slug"] == slug:
            return item["rank"]
    return None


def test_detail_ranks_match_boards(db):
    """On the standard fixture, every detail rank equals its public board rank."""
    slugs = [
        r["slug"] for r in db.execute("SELECT slug FROM plugins WHERE status='active'")
    ]
    assert len(slugs) == 4
    for slug in slugs:
        detail = ranking.plugin_detail(db, slug)
        assert detail is not None
        assert detail["rank_total"] == _board_rank(db, "total", slug)
        assert detail["rank_velocity"] == _board_rank(db, "velocity", slug)
        assert detail["rank_growth7"] == _board_rank(db, "growth", slug, window=7)
        assert detail["rank_darkhorse7"] == _board_rank(db, "darkhorse", slug, window=7)
        assert detail["rank_quality7"] == _board_rank(db, "quality", slug, window=7)
        assert detail["rank_quality30"] == _board_rank(db, "quality", slug, window=30)


def test_detail_ranks_match_boards_adversarial(tmp_path):
    """Ties, case-variant names, delta gaps, base-threshold edges, anomalies,
    mid-window newcomers and category peers must all rank identically."""
    import random

    random.seed(20261127)
    conn = connect(tmp_path / "adv.db")
    init_db(conn)

    days = [f"2026-11-{d:02d}" for d in range(1, 21)]  # 20 daily snapshots
    categories = ["workflow", "coding", "design"]
    # Case-variant names exercise the name.lower() tie-break; equal stars
    # exercise the stable-sort fallback.
    name_styles = ["Zeta Tool", "zeta tool", "ZETA TOOL", "Éta Tool", "eta tool"]
    plugins = []
    for i in range(40):
        style = name_styles[i % len(name_styles)]
        plugins.append(
            {
                "slug": f"p{i:02d}-repo",
                "owner": f"o{i:02d}",
                "repo": "repo",
                # Identical display names within a group force tie-break paths.
                "name": f"{style} {i % len(name_styles)}",
                "category": categories[i % len(categories)],
            }
        )

    for p in plugins:
        conn.execute(
            """
            INSERT INTO plugins (slug, owner, repo, name, category, url, status,
                                 repo_created_at, stars_latest)
            VALUES (?, ?, ?, ?, ?, ?, 'active', '2024-01-01T00:00:00Z', NULL)
            """,
            (p["slug"], p["owner"], p["repo"], p["name"], p["category"],
             f"https://github.com/{p['owner']}/{p['repo']}"),
        )
    conn.commit()

    # Stars: heavy ties, three threshold-edge plugins on the growth base day,
    # a few first-appearance gaps (delta NULL) and flagged anomaly days.
    base_day = days[12]  # day - 7 == 2026-11-13 for the latest day 2026-11-20
    star_plan: dict[str, dict[str, int]] = {}
    for i, p in enumerate(plugins):
        star_plan[p["slug"]] = {}
        level = (i * 7) % 60  # many collisions across 40 plugins
        for j, day in enumerate(days):
            if i % 9 == 4 and j < 7:
                continue  # mid-window newcomer: absent early, delta NULL later
            star_plan[p["slug"]][day] = level + j

    # Threshold edges against GROWTH_MIN_BASE=50 on the base day.
    star_plan["p00-repo"][base_day] = 50   # exactly at the floor -> candidate
    star_plan["p01-repo"][base_day] = 49   # just under -> excluded
    star_plan["p02-repo"][base_day] = 51

    for slug, by_day in star_plan.items():
        pid = conn.execute(
            "SELECT id FROM plugins WHERE slug = ?", (slug,)
        ).fetchone()[0]
        for day, count in by_day.items():
            conn.execute(
                "INSERT INTO stars (plugin_id, date, count, delta, is_anomaly)"
                " VALUES (?, ?, ?, ?, ?)",
                (pid, day, count, None, 0),
            )
    # Backfill deltas (count - previous count, NULL on first appearance).
    for slug, by_day in star_plan.items():
        pid = conn.execute(
            "SELECT id FROM plugins WHERE slug = ?", (slug,)
        ).fetchone()[0]
        prev = None
        for day in days:
            if day not in by_day:
                continue
            delta = None if prev is None else by_day[day] - prev
            conn.execute(
                "UPDATE stars SET delta = ? WHERE plugin_id = ? AND date = ?",
                (delta, pid, day),
            )
            prev = by_day[day]
    # Flag a handful of days as anomalies on the biggest movers.
    for slug in ("p03-repo", "p11-repo", "p27-repo"):
        pid = conn.execute(
            "SELECT id FROM plugins WHERE slug = ?", (slug,)
        ).fetchone()[0]
        for day in days[10:14]:
            conn.execute(
                "UPDATE stars SET is_anomaly = 1 WHERE plugin_id = ? AND date = ?",
                (pid, day),
            )
    conn.commit()

    latest = ranking.latest_date(conn)
    assert latest == "2026-11-20"

    slugs = [p["slug"] for p in plugins]
    for slug in slugs:
        detail = ranking.plugin_detail(conn, slug)
        assert detail is not None, slug
        assert detail["rank_total"] == _board_rank(conn, "total", slug), slug
        assert detail["rank_velocity"] == _board_rank(conn, "velocity", slug), slug
        assert detail["rank_growth7"] == _board_rank(conn, "growth", slug, window=7), slug
        assert (
            detail["rank_darkhorse7"] == _board_rank(conn, "darkhorse", slug, window=7)
        ), slug
        assert detail["rank_quality7"] == _board_rank(conn, "quality", slug, window=7), slug
        assert (
            detail["rank_quality30"] == _board_rank(conn, "quality", slug, window=30)
        ), slug

        # Category rank and peers: identical to the category board's items.
        # The peer loop caps at 5 and breaks before walking the rest, so a
        # plugin ranked 6th-or-lower inside its category keeps rank_category
        # = None (long-standing board() behavior, preserved here).
        cat = next(p["category"] for p in plugins if p["slug"] == slug)
        cat_board = ranking.board(conn, "total", category=cat)
        expected_peers = []
        expected_rank_category = None
        for item in cat_board["items"]:
            if item["slug"] == slug:
                expected_rank_category = item["rank"]
                continue
            expected_peers.append(
                {
                    "slug": item["slug"],
                    "name": item["name"],
                    "stars": item["stars"],
                    "rank": item["rank"],
                }
            )
            if len(expected_peers) == 5:
                break
        if expected_rank_category is not None:
            assert detail["rank_category"] == expected_rank_category, slug
        else:
            assert detail["rank_category"] is None, slug
        assert detail["peers"] == expected_peers, slug
    conn.close()
