"""
Tests for Phase 7 practice modes (routers/practice.py):
  dictation, shadowing, speaking-club, mistakes notebook, weekly review,
  homework loop, authentic materials, and the 1/day AI writing feedback.
"""
from unittest.mock import AsyncMock

from tests.conftest import _connect


def _user_id(client, auth_headers):
    return client.get("/api/auth/me", headers=auth_headers).json()["id"]


def _seed_mistake(user_id, question="What is the past of 'go'?", correct="went"):
    conn = _connect()
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO user_mistakes (user_id, question, correct_answer, your_answer)
           VALUES (%s, %s, %s, 'goed') RETURNING id""",
        (user_id, question, correct),
    )
    mid = str(cur.fetchone()[0])
    cur.close()
    conn.close()
    return mid


# ── Dictation ────────────────────────────────────────────────────────────────

def test_dictation_set_hides_text(client):
    data = client.get("/api/practice/dictation?level=A2&n=5").json()
    assert data["level"] == "A2"
    assert len(data["items"]) > 0
    for it in data["items"]:
        assert "id" in it and "audio" in it
        assert "text" not in it  # the answer must never be sent up front


def test_dictation_check_scores_and_reveals(client):
    items = client.get("/api/practice/dictation?level=A2&n=1").json()["items"]
    item_id = items[0]["id"]
    resp = client.post(f"/api/practice/dictation/{item_id}/check",
                       json={"typed": "this is definitely wrong text"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "score" in data and 0 <= data["score"] <= 100
    assert data["target"]  # revealed only after answering
    assert isinstance(data["diff"], list)


def test_dictation_check_unknown_item(client):
    resp = client.post("/api/practice/dictation/nope-not-real/check", json={"typed": "x"})
    assert resp.status_code == 404


# ── Shadowing / speaking club ────────────────────────────────────────────────

def test_shadowing_returns_text(client):
    data = client.get("/api/practice/shadowing?level=A2&n=3").json()
    assert len(data["items"]) > 0
    for it in data["items"]:
        assert it["text"] and it["audio"]


def test_speaking_club_returns_prompt(client):
    data = client.get("/api/practice/speaking-club?level=A2").json()
    assert data["level"] == "A2"
    assert isinstance(data["prompt"], str) and data["prompt"]


# ── Authentic materials ──────────────────────────────────────────────────────

def test_authentic_has_b1_assignments(client):
    data = client.get("/api/practice/authentic?level=B1").json()
    assert data["level"] == "B1"
    assert len(data["assignments"]) > 0
    a = data["assignments"][0]
    assert a["title"] and a["url"] and a["comprehension"]


# ── Mistake notebook ─────────────────────────────────────────────────────────

def test_mistakes_requires_auth(client):
    client.cookies.clear()
    assert client.get("/api/practice/mistakes").status_code == 401


def test_mistake_record_list_and_master(client, auth_headers):
    add = client.post("/api/practice/mistakes", json={"mistakes": [
        {"question": "past of eat?", "correct_answer": "ate", "your_answer": "eated"},
    ]}, headers=auth_headers)
    assert add.status_code == 200
    listed = client.get("/api/practice/mistakes", headers=auth_headers).json()
    assert any(m["question"] == "past of eat?" for m in listed["mistakes"])
    mid = listed["mistakes"][0]["id"]
    client.post(f"/api/practice/mistakes/{mid}/review", json={"knew": True}, headers=auth_headers)
    after = client.get("/api/practice/mistakes", headers=auth_headers).json()
    assert all(m["id"] != mid for m in after["mistakes"])  # mastered leaves the deck


# ── Weekly review ────────────────────────────────────────────────────────────

def test_weekly_review_empty(client, auth_headers):
    data = client.get("/api/practice/weekly-review", headers=auth_headers).json()
    assert data["mistakes"] == []
    assert data["due_vocab"] == 0
    assert data["total"] == 0


def test_weekly_review_collects_recent_mistake(client, auth_headers):
    _seed_mistake(_user_id(client, auth_headers))
    data = client.get("/api/practice/weekly-review", headers=auth_headers).json()
    assert len(data["mistakes"]) == 1


# ── Homework loop ────────────────────────────────────────────────────────────

def test_homework_assign_list_submit(client, auth_headers):
    assign = client.post("/api/practice/homework", json={
        "lesson_id": 42, "title": "Essay", "task": "Write about your week.",
        "model_answer": "This week I studied English.", "min_words": 50,
    }, headers=auth_headers)
    assert assign.status_code == 200
    assert assign.json()["assigned"] is True
    hid = assign.json()["id"]

    listed = client.get("/api/practice/homework", headers=auth_headers).json()
    assert listed["pending"] == 1
    assert listed["homework"][0]["task"] == "Write about your week."

    submit = client.post(f"/api/practice/homework/{hid}/submit",
                         json={"submission": "My week was busy and good."},
                         headers=auth_headers)
    assert submit.status_code == 200
    assert submit.json()["model_answer"] == "This week I studied English."

    after = client.get("/api/practice/homework", headers=auth_headers).json()
    assert after["pending"] == 0


def test_homework_assign_is_idempotent(client, auth_headers):
    body = {"lesson_id": 7, "task": "Same task text.", "model_answer": "m"}
    first = client.post("/api/practice/homework", json=body, headers=auth_headers)
    second = client.post("/api/practice/homework", json=body, headers=auth_headers)
    assert first.json()["assigned"] is True
    assert second.json()["assigned"] is False  # no duplicate while still open


def test_homework_submit_other_user_404(client, auth_headers):
    resp = client.post("/api/practice/homework/00000000-0000-0000-0000-000000000000/submit",
                       json={"submission": "x"}, headers=auth_headers)
    assert resp.status_code == 404


# ── AI writing feedback (free 1/day) ─────────────────────────────────────────

def test_writing_feedback_once_per_day(client, auth_headers, monkeypatch):
    monkeypatch.setattr("routers.practice.ask_qwen",
                        AsyncMock(return_value="Nice work. Watch your tenses."))
    body = {"text": "Yesterday I go to the market and buy some fish for dinner."}
    first = client.post("/api/practice/writing-feedback", json=body, headers=auth_headers)
    assert first.status_code == 200, first.text
    assert first.json()["feedback"]
    second = client.post("/api/practice/writing-feedback", json=body, headers=auth_headers)
    assert second.status_code == 429  # daily quota used


def test_writing_feedback_rejects_too_short(client, auth_headers):
    resp = client.post("/api/practice/writing-feedback", json={"text": "hi"}, headers=auth_headers)
    assert resp.status_code == 400
