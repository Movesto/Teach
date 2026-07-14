"""
Tests for the vocabulary SRS:
  GET  /api/vocabulary/due
  POST /api/vocabulary/review
"""
from tests.conftest import _connect


def _user_id(client, auth_headers):
    return client.get("/api/auth/me", headers=auth_headers).json()["id"]


def _seed_word(user_id, word="hello", translation="salaan"):
    conn = _connect()
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO user_vocabulary (user_id, word, translation, next_review)
           VALUES (%s, %s, %s, NOW() - INTERVAL '1 hour') RETURNING id""",
        (user_id, word, translation),
    )
    word_id = str(cur.fetchone()[0])
    cur.close()
    conn.close()
    return word_id


def test_due_requires_auth(client):
    client.cookies.clear()
    assert client.get("/api/vocabulary/due").status_code == 401


def test_due_empty_for_new_user(client, auth_headers):
    data = client.get("/api/vocabulary/due", headers=auth_headers).json()
    assert data["words"] == []
    assert data["total_words"] == 0


def test_due_returns_seeded_word(client, auth_headers):
    _seed_word(_user_id(client, auth_headers))
    data = client.get("/api/vocabulary/due", headers=auth_headers).json()
    assert data["total_words"] == 1
    assert any(w["word"] == "hello" for w in data["words"])


def test_review_updates_schedule(client, auth_headers):
    word_id = _seed_word(_user_id(client, auth_headers))
    resp = client.post("/api/vocabulary/review", json={
        "word_id": word_id,
        "knew": True,
    }, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    # A known word is rescheduled into the future — no longer due
    data = client.get("/api/vocabulary/due", headers=auth_headers).json()
    assert all(str(w["id"]) != word_id for w in data["words"])


def test_review_rejects_other_users_word(client, auth_headers):
    """A user must not be able to review (or probe) another user's words."""
    conn = _connect()
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO users (name, email, password_hash)
           VALUES ('Other', 'other@example.com', 'x') RETURNING id"""
    )
    other_id = cur.fetchone()[0]
    cur.execute(
        """INSERT INTO user_vocabulary (user_id, word, translation, next_review)
           VALUES (%s, 'secret', 'qarsoodi', NOW()) RETURNING id""",
        (other_id,),
    )
    other_word = str(cur.fetchone()[0])
    cur.close()
    conn.close()

    resp = client.post("/api/vocabulary/review", json={
        "word_id": other_word,
        "knew": True,
    }, headers=auth_headers)
    # Must not succeed against another user's row
    assert resp.status_code in (403, 404) or resp.json().get("success") is not True
