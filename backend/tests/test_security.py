"""Regression tests for security fixes: JSON-LD escaping and trusted client IP."""

from __future__ import annotations

import json

from starlette.requests import Request

from backend.app import seo
from backend.app.rate_limit import client_ip


def _request(headers: list[tuple[bytes, bytes]]) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "query_string": b"",
        "headers": headers,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("testserver", 80),
    }
    return Request(scope)


def test_jsonld_escapes_script_breakout_chars():
    payload = {"description": "good </script><img src=x onerror=alert(1)> & more"}
    block = seo._jsonld_block(payload)
    # The dangerous raw sequences must not appear verbatim in the HTML.
    assert "</script><img" not in block
    assert "\\u003c/script\\u003e" in block
    assert "\\u0026" in block
    # JSON semantics are preserved: parsing recovers the original string.
    body = block.split(">", 1)[1].rsplit("</script>", 1)[0]
    assert json.loads(body) == payload


def test_client_ip_trusts_only_x_real_ip():
    # nginx overwrites X-Real-IP; that is the only header we trust.
    req = _request([(b"x-real-ip", b"1.2.3.4")])
    assert client_ip(req) == "1.2.3.4"


def test_client_ip_ignores_spoofable_headers():
    # A direct-to-origin attacker can send arbitrary CF/XFF headers; they must
    # be ignored. With no nginx-provided X-Real-IP we fall back to the peer.
    req = _request(
        [
            (b"cf-connecting-ip", b"9.9.9.9"),
            (b"x-forwarded-for", b"8.8.8.8"),
        ]
    )
    assert client_ip(req) == "127.0.0.1"


def test_client_ip_x_real_ip_wins_over_spoofable_headers():
    req = _request(
        [
            (b"x-real-ip", b"1.2.3.4"),
            (b"cf-connecting-ip", b"9.9.9.9"),
            (b"x-forwarded-for", b"8.8.8.8"),
        ]
    )
    assert client_ip(req) == "1.2.3.4"
