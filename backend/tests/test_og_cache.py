"""Tests for the bounded, content-addressed OG image cache."""

from __future__ import annotations

import os
import threading

from backend.app import og_cache


def test_content_key_changes_with_visible_field():
    a = og_cache.content_key("slug", "Name", 100, None, "2026-01-01")
    b = og_cache.content_key("slug", "Name", 100, None, "2026-01-01")
    c = og_cache.content_key("slug", "Name", 101, None, "2026-01-01")
    d = og_cache.content_key("slug", "Name", 100, 5, "2026-01-01")
    assert a == b
    assert a != c, "star change must invalidate the cache"
    assert a != d, "delta change must invalidate the cache"
    assert len(a) == 16


def test_write_atomic_leaves_no_temp_file(tmp_path):
    path = tmp_path / "card.png"
    og_cache.write_atomic(path, b"\x89PNG fake payload")
    assert path.read_bytes() == b"\x89PNG fake payload"
    assert not list(tmp_path.glob("*.tmp"))


def test_render_once_deduplicates_concurrent_misses(tmp_path):
    path = tmp_path / "card.png"
    calls = []
    barrier = threading.Barrier(6)
    results = []

    def render():
        calls.append(1)
        return b"png"

    def worker():
        barrier.wait()
        results.append(og_cache.render_once(path, render))

    threads = [threading.Thread(target=worker) for _ in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert all(r == b"png" for r in results)
    # At most two renders (semaphore allows 2 slots); cache double-check keeps it low.
    assert len(calls) <= 2
    assert path.read_bytes() == b"png"


def test_prune_evicts_oldest_by_count_and_size(tmp_path):
    files = []
    for i in range(12):
        p = tmp_path / f"card-{i:02d}.png"
        p.write_bytes(b"x" * 100)
        os.utime(p, (1_000_000 + i, 1_000_000 + i))
        files.append(p)
    # Cap at 5 files and 350 bytes -> remove 7 by count, then 2 more by size.
    og_cache.prune(tmp_path, max_files=5, max_bytes=350)
    remaining = sorted(p.name for p in tmp_path.glob("*.png"))
    assert len(remaining) == 3
    assert remaining == ["card-09.png", "card-10.png", "card-11.png"]


def test_prune_removes_stale_temp_files(tmp_path):
    (tmp_path / "leftover.tmp").write_bytes(b"partial")
    (tmp_path / "card.png").write_bytes(b"png")
    og_cache.prune(tmp_path, max_files=10, max_bytes=1024)
    assert not list(tmp_path.glob("*.tmp"))
    assert (tmp_path / "card.png").exists()
