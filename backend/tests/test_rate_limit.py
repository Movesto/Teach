"""
Tests for rate limiting:
  - Auth endpoints cap at 5 requests/minute per IP
  - AI endpoints cap at 20 requests/minute per IP
"""

from core import rate_limit


def _reset_rate_stores():
    """Clear in-memory rate limit stores between tests."""
    rate_limit._ai_store.clear()
    rate_limit._auth_store.clear()


def test_auth_rate_limit_blocks_after_5_attempts(client):
    _reset_rate_stores()
    payload = {"email": "brute@example.com", "password": "wrong"}
    responses = [client.post("/api/auth/login", json=payload) for _ in range(6)]
    statuses = [r.status_code for r in responses]
    # First 5 attempts: 401 (wrong credentials).  6th: 429 (rate limited).
    assert 429 in statuses, f"Expected a 429 among: {statuses}"
    assert statuses.index(429) == 5, "Rate limit should trigger on the 6th attempt"


def test_auth_rate_limit_also_applies_to_register(client):
    _reset_rate_stores()
    responses = []
    for i in range(6):
        responses.append(client.post("/api/auth/register", json={
            "name": f"User{i}",
            "email": f"user{i}@rate.com",
            "password": "pass1234",
        }))
    statuses = [r.status_code for r in responses]
    assert 429 in statuses


def test_ai_rate_limit_allows_20_requests(client):
    """The AI rate limiter (20/min) should not trigger on the 20th request."""
    _reset_rate_stores()
    # /api/translate is rate-limited by ai_rate_limit and needs no auth
    responses = [
        client.post("/api/translate", json={"text": "hello", "direction": "eng_to_som"})
        for _ in range(20)
    ]
    # All 20 should pass through (translate may fail due to NLLB being down, but not 429)
    statuses = [r.status_code for r in responses]
    assert 429 not in statuses, f"AI rate limit triggered too early: {statuses}"


def test_ai_rate_limit_blocks_on_21st(client):
    _reset_rate_stores()
    for _ in range(20):
        client.post("/api/translate", json={"text": "hello", "direction": "eng_to_som"})
    resp = client.post("/api/translate", json={"text": "hello", "direction": "eng_to_som"})
    assert resp.status_code == 429
