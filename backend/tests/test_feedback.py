"""
Tests for feedback submission and admin access control:
  POST /api/feedback
  GET  /api/admin/feedback
"""


def test_feedback_requires_auth(client):
    client.cookies.clear()
    resp = client.post("/api/feedback", json={"rating": 5, "message": "great"})
    assert resp.status_code == 401


def test_feedback_submit_succeeds(client, auth_headers):
    resp = client.post("/api/feedback", json={
        "rating": 4,
        "message": "Waan jeclahay casharrada!",
        "lesson_id": 1,
        "lesson_title": "Meeting Your Neighbor",
        "page": "lesson",
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["success"] is True


def test_feedback_rating_bounds(client, auth_headers):
    resp = client.post("/api/feedback", json={"rating": 6}, headers=auth_headers)
    assert resp.status_code == 422


def test_admin_feedback_forbidden_for_regular_user(client, auth_headers, monkeypatch):
    monkeypatch.setattr("routers.feedback.ADMIN_EMAIL", "admin@example.com")
    resp = client.get("/api/admin/feedback", headers=auth_headers)
    assert resp.status_code == 403


def test_admin_feedback_denies_everyone_when_unset(client, auth_headers, monkeypatch):
    """No ADMIN_EMAIL configured must mean no admin — not a default admin."""
    monkeypatch.setattr("routers.feedback.ADMIN_EMAIL", None)
    resp = client.get("/api/admin/feedback", headers=auth_headers)
    assert resp.status_code == 403


def test_admin_feedback_allows_admin(client, auth_headers, monkeypatch):
    monkeypatch.setattr("routers.feedback.ADMIN_EMAIL", "test@example.com")
    client.post("/api/feedback", json={"rating": 5, "message": "hi"}, headers=auth_headers)
    resp = client.get("/api/admin/feedback", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(f["rating"] == 5 for f in data["feedback"])
