from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.app.services import ranking


def _write_summary(path: Path, plugins: dict) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "npm-registry",
        "metric": "downloads",
        "unit": "tarball_downloads",
        "is_approximate": True,
        "note": "not user installs",
        "window": {"start": "2026-10-26", "end": "2026-11-24"},
        "package_count": len(plugins),
        "covered_packages": len(plugins),
        "plugins": plugins,
    }
    (path / "latest.json").write_text(json.dumps(payload), encoding="utf-8")
    return path


def _entry(d7: int, d30: int, prev7: int = 0, prev30: int = 0) -> dict:
    return {
        "npm_package": "pkg",
        "downloads_7d": d7,
        "downloads_30d": d30,
        "downloads_prev_7d": prev7,
        "downloads_prev_30d": prev30,
        "days_in_archive": 365,
    }


def test_npm_board_sorts_by_downloads_and_keeps_star_reference(db, tmp_path):
    summary = _write_summary(
        tmp_path / "npm",
        {
            "alpha-one": _entry(100, 500, prev7=80),
            "beta-two": _entry(300, 400, prev7=120),
            "gamma-three": _entry(0, 900),
        },
    )
    payload = ranking.npm_board(db, summary, window=7)
    assert payload["board"] == "npm"
    assert payload["as_of"] == "2026-11-24"
    assert payload["source"] == "npm-registry"
    assert payload["is_approximate"] is True
    # zero-download entries are excluded (gamma has 0 in the 7d window)
    assert [i["slug"] for i in payload["items"]] == ["beta-two", "alpha-one"]
    beta, alpha = payload["items"]
    assert beta["downloads"] == 300 and beta["stars"] == 105
    assert beta["rank"] == 1 and beta["prev_rank"] == 1
    assert beta["growth"] == pytest.approx((300 - 120) / 120)
    # alpha rises from #2 to #2? prev 80 < 120, so still #2
    assert alpha["prev_rank"] == 2
    assert alpha["npm_package"] == "pkg"


def test_npm_board_window_and_new_entry(db, tmp_path):
    summary = _write_summary(
        tmp_path / "npm",
        {
            "alpha-one": _entry(100, 500, prev7=0, prev30=200),
            "delta-four": _entry(50, 900, prev7=0, prev30=600),
        },
    )
    seven = ranking.npm_board(db, summary, window=7)
    assert [i["slug"] for i in seven["items"]] == ["alpha-one", "delta-four"]
    assert all(i["prev_rank"] is None for i in seven["items"])

    thirty = ranking.npm_board(db, summary, window=30)
    assert [i["slug"] for i in thirty["items"]] == ["delta-four", "alpha-one"]
    assert thirty["items"][0]["prev_rank"] == 1
    assert thirty["items"][1]["prev_rank"] == 2


def test_npm_board_category_filter(db, tmp_path):
    summary = _write_summary(
        tmp_path / "npm",
        {
            "alpha-one": _entry(100, 100),
            "delta-four": _entry(300, 300),
            "gamma-three": _entry(200, 200),
        },
    )
    payload = ranking.npm_board(db, summary, window=7, category="workflow")
    assert [i["slug"] for i in payload["items"]] == ["delta-four", "alpha-one"]


def test_npm_board_missing_data_degrades(db, tmp_path):
    payload = ranking.npm_board(db, tmp_path / "absent", window=7)
    assert payload["items"] == []
    assert payload["as_of"] is None
    assert "尚未采集" in payload["reason"]


def test_npm_board_rejects_bad_window(db, tmp_path):
    summary = _write_summary(tmp_path / "npm", {"alpha-one": _entry(1, 1)})
    with pytest.raises(ranking.BoardError):
        ranking.npm_board(db, summary, window=14)


def test_get_board_dispatches_npm(db, tmp_path):
    summary = _write_summary(tmp_path / "npm", {"alpha-one": _entry(9, 9)})
    payload = ranking.get_board(db, "npm", window=7, npm_dir=summary)
    assert payload["board"] == "npm"
    assert [i["slug"] for i in payload["items"]] == ["alpha-one"]
