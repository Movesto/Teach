"""
Tests for conversation sessions:
  GET /api/conversation/status   — atomic session upsert (INSERT..RETURNING)
  GET /api/conversation/history
"""
from core.config import CONVERSATION_DAILY_LIMIT


def test_status_requires_auth(client):
    client.cookies.clear()
    assert client.get("/api/conversation/status").status_code == 401


def test_status_creates_todays_session(client, auth_headers):
    resp = client.get("/api/conversation/status", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["used_seconds"] == 0
    assert data["remaining_seconds"] == CONVERSATION_DAILY_LIMIT
    assert data["session_id"]


def test_status_is_stable_across_calls(client, auth_headers):
    """Repeated calls must return the same session row (upsert, not duplicate)."""
    first = client.get("/api/conversation/status", headers=auth_headers).json()
    second = client.get("/api/conversation/status", headers=auth_headers).json()
    assert first["session_id"] == second["session_id"]


def test_history_empty_for_new_user(client, auth_headers):
    resp = client.get("/api/conversation/history", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["messages"] == []
    assert data["total_seconds"] == 0
