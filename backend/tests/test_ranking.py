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
