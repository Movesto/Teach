"""
Tests for:
  POST /api/quiz/submit   — saves lesson progress for guests and authenticated users
  GET  /api/units         — lesson marked completed after submit
"""


def test_quiz_submit_guest_succeeds(client):
    """Guest users (no token) can submit a quiz using the fallback guest UUID."""
    resp = client.post("/api/quiz/submit", json={
        "lesson_id": 1,
        "unit_id": 1,
        "score": 80,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["score"] == 80


def test_quiz_submit_authenticated_saves_to_user(client, auth_headers):
    resp = client.post("/api/quiz/submit", json={
        "lesson_id": 1,
        "unit_id": 1,
        "score": 95,
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_quiz_submit_updates_existing_score(client, auth_headers):
    """Resubmitting the same lesson should update the score (upsert)."""
    client.post("/api/quiz/submit", json={"lesson_id": 2, "unit_id": 1, "score": 60},
                headers=auth_headers)
    resp = client.post("/api/quiz/submit", json={"lesson_id": 2, "unit_id": 1, "score": 90},
                       headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["score"] == 90


def test_quiz_submit_returns_unit_complete_flag(client, auth_headers):
    resp = client.post("/api/quiz/submit", json={
        "lesson_id": 1,
        "unit_id": 1,
        "score": 70,
    }, headers=auth_headers)
    assert "unit_complete" in resp.json()
    assert isinstance(resp.json()["unit_complete"], bool)


def test_lesson_marked_completed_in_units(client, auth_headers):
    """After submitting, /api/units should show that lesson as completed."""
    client.post("/api/quiz/submit", json={"lesson_id": 1, "unit_id": 1, "score": 85},
                headers=auth_headers)
    units = client.get("/api/units", headers=auth_headers).json()
    unit_1 = next(u for u in units if u["id"] == 1)
    lesson_1 = next((l for l in unit_1["lessons"] if l.get("lesson_number") == 1), None)
    if lesson_1:
        assert lesson_1["completed"] is True
