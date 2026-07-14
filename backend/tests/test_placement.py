"""
Tests for the placement test:
  GET  /api/placement/test    — answers and transcripts must never reach the client
  POST /api/placement/submit  — scoring derives from the test JSON
  POST /api/placement/save    — sets placement_done on the user
"""
import json
from pathlib import Path

_TEST_JSON = (
    Path(__file__).parent.parent.parent
    / "services" / "placement_test" / "placement-test.json"
)


def _load_raw():
    return json.loads(_TEST_JSON.read_text(encoding="utf-8"))


def test_get_placement_test_strips_answers_and_transcripts(client):
    resp = client.get("/api/placement/test")
    assert resp.status_code == 200
    data = resp.json()
    for section in data["sections"]:
        for q in section.get("questions", []):
            assert "correct" not in q
            assert "transcript" not in q
        for passage in section.get("passages", []):
            for q in passage["questions"]:
                assert "correct" not in q


def test_get_placement_test_listening_audio_is_synthesized(client):
    """Committed mp3 paths never existed; audio must point at the TTS endpoint."""
    data = client.get("/api/placement/test").json()
    listening = next(s for s in data["sections"] if s["id"] == "listening")
    assert listening["questions"]
    for q in listening["questions"]:
        assert q["audio"].startswith("/api/placement/listen/"), q["audio"]


def test_submit_empty_answers_scores_zero(client):
    resp = client.post("/api/placement/submit", json={
        "answers": [],
        "time_taken_minutes": 1,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_score"] == 0
    assert data["cefr"] == "A1"


def test_submit_breakdown_maxes_match_test_json(client):
    """Section maxima must come from the JSON, not hardcoded numbers."""
    raw = _load_raw()
    data = client.post("/api/placement/submit", json={
        "answers": [],
        "time_taken_minutes": 1,
    }).json()
    for section_id, max_pts in raw["scoring"]["breakdown"].items():
        assert data["breakdown"][section_id]["max"] == max_pts
    assert data["max_score"] == raw["scoring"]["total_points"]


def test_submit_all_correct_places_high(client):
    raw = _load_raw()
    answers = []
    for s in raw["sections"]:
        for q in s.get("questions", []):
            answers.append({"question_id": q["id"], "selected_option": q["correct"]})
        for p in s.get("passages", []):
            for q in p["questions"]:
                answers.append({"question_id": q["id"], "selected_option": q["correct"]})
        for prompt in s.get("prompts", []):
            answers.append({"question_id": prompt["id"], "audio_url": "audio_x"})
    resp = client.post("/api/placement/submit", json={
        "answers": answers,
        "time_taken_minutes": 12,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["percentage"] > 80
    assert data["cefr"] in ("B2", "C1")


def test_placement_save_sets_placement_done(client, auth_headers):
    resp = client.post("/api/placement/save", json={
        "score": 50,
        "percentage": 50.0,
        "level": "intermediate",
        "cefr": "B1",
        "recommended_unit": 5,
        "breakdown": {},
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    me = client.get("/api/auth/me", headers=auth_headers).json()
    assert me["placement_done"] is True
    assert me["cefr_level"] == "B1"
    assert me["recommended_unit"] == 5
