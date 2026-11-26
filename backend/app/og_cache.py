"""Disk cache for generated OG images.

Why this exists
---------------
OG cards are expensive: each one allocates a 1200x630 RGB image plus several
font renders (~10-15 MB peak) before PNG compression. FastAPI runs sync
endpoints in a thread pool, so a crawler sweeping thousands of plugin pages
could generate many images at once and blow the 384 MB worker limit (this
actually happened on 2026-11-25).

This module provides:
* a content-addressed cache key -- the cache file name hashes every field shown
  on the image, so a data refresh invalidates only what changed;
* a bounded generation semaphore -- at most ``max_concurrent`` images render at
  once, capping peak memory regardless of request concurrency;
* atomic writes -- render to a sibling ``.tmp`` file then ``os.replace`` so a
  concurrent reader never sees a half-written PNG;
* LRU eviction -- the cache is capped by file count and total bytes, oldest
  files first, so the directory cannot grow without bound.
"""

from __future__ import annotations

import hashlib
import os
import re
import threading
from contextlib import contextmanager
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Iterator

DEFAULT_MAX_FILES = 5000
DEFAULT_MAX_BYTES = 200 * 1024 * 1024
DEFAULT_MAX_CONCURRENT = 2

_SAFE = re.compile(r"[^a-zA-Z0-9_-]")

# Render at most a couple of images at once. A PIL card peaks around 10-15 MB;
# two in flight keeps the worker well under its 384 MB ceiling.
_render_slots = threading.BoundedSemaphore(DEFAULT_MAX_CONCURRENT)
_evict_lock = threading.Lock()
_key_locks_guard = threading.Lock()
_key_locks: dict[str, threading.Lock] = {}


def _key_lock(path: Path) -> threading.Lock:
    """One lock per cache key so simultaneous misses render exactly once."""
    key = str(path)
    with _key_locks_guard:
        lock = _key_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _key_locks[key] = lock
        return lock


@contextmanager
def processing_slot() -> Iterator[None]:
    """Gate the *whole* OG request (data load + render), not just the render.

    ``plugin_detail`` itself allocates ~10 MB of temporary ranking rows. If 20
    request threads each run it before queueing to render, peak memory still
    blows past the worker limit. This slot is acquired first so at most a
    couple of requests hold expensive state at any instant; the rest wait
    cheaply on the semaphore.
    """
    with _render_slots:
        yield


def guard(func: Callable) -> Callable:
    """Decorator: run the whole endpoint under the processing semaphore.

    ``functools.wraps`` preserves the signature FastAPI inspects for DI.
    """
    @wraps(func)
    def wrapped(*args: Any, **kwargs: Any):
        with _render_slots:
            return func(*args, **kwargs)
    return wrapped


def safe_name(value: str, limit: int = 60) -> str:
    """Filesystem-safe slug fragment (kept short and readable in the cache)."""
    return _SAFE.sub("-", value)[:limit] or "unknown"


def content_key(*fields: Any) -> str:
    """Short hash of every value that affects the rendered image."""
    raw = "|".join("" if f is None else str(f) for f in fields)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def cache_path(cache_dir: Path, prefix: str, day: str, digest: str, ext: str = ".png") -> Path:
    return cache_dir / f"{safe_name(prefix)}-{safe_name(day, 16)}-{digest}{ext}"


def read_cached(path: Path) -> bytes | None:
    if not path.is_file():
        return None
    try:
        return path.read_bytes()
    except OSError:
        return None


def write_atomic(path: Path, payload: bytes) -> None:
    """Write via a sibling temp file so readers never observe a partial PNG."""
    tmp = path.with_name(path.name + f".{os.getpid()}.{threading.get_ident()}.tmp")
    try:
        tmp.write_bytes(payload)
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


def render_once(path: Path, render: Callable[[], bytes]) -> bytes:
    """Render once per key.

    Callers wrap the whole request in :func:`processing_slot`, which is what
    bounds global concurrency/memory; here a per-key lock only collapses N
    simultaneous misses for the same image into a single render. The cache is
    re-checked after waiting so no thread re-renders what another just wrote.
    """
    with _key_lock(path):
        existing = read_cached(path)
        if existing is not None:
            return existing
        payload = render()
        write_atomic(path, payload)
        return payload


def prune(cache_dir: Path, *, max_files: int = DEFAULT_MAX_FILES, max_bytes: int = DEFAULT_MAX_BYTES) -> None:
    """Evict oldest PNGs until both file-count and byte-size caps are met.

    Runs under a lock so the LRU sweep itself is serialized. Temp files left by
    a crashed render are removed first. Errors are swallowed: cache cleanup is
    best-effort and must never fail an image response.
    """
    if not _evict_lock.acquire(blocking=False):
        return
    try:
        if not cache_dir.is_dir():
            return
        files = [p for p in cache_dir.iterdir() if p.is_file()]
        for p in files:
            if p.suffix == ".tmp":
                try:
                    p.unlink()
                except OSError:
                    pass
        pngs = [p for p in files if p.suffix in (".png", ".webp")]
        try:
            sized = [(p.stat().st_mtime_ns, p.stat().st_size, p) for p in pngs]
        except OSError:
            return
        sized.sort()  # oldest first
        over_count = max(0, len(sized) - max_files)
        # Subtract files evicted by the count cap before applying the byte cap;
        # otherwise the byte pass re-evicts them and empties the whole cache.
        total = sum(size for _, size, _ in sized[over_count:])
        remove = {p for _, _, p in sized[:over_count]}
        for _mtime, size, p in sized[over_count:]:
            if total <= max_bytes:
                break
            remove.add(p)
            total -= size
        for p in remove:
            try:
                p.unlink()
            except OSError:
                pass
    finally:
        _evict_lock.release()
