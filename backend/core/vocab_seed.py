"""Seed the SRS deck with the academic (NAWL) target words a learner meets in the
content they complete — so the review deck becomes the C1 vocabulary, not just each
lesson's handful of target phrases.

Only academic (NAWL) words are seeded: general NGSL words are too common to be worth
drilling, and seeding them all would bury the deck. Cards use the pre-baked Somali
gloss (glosses-so.json, machine-generated — flagged for native review) and the
example sentence comes from word-examples.json at read time (routers/vocabulary).
"""
import json
import logging
from pathlib import Path

from core.db import get_db, release_db
from core import wordlists

logger = logging.getLogger(__name__)
_DIR = Path(__file__).parent.parent / "data" / "wordlists"
_glosses = None
_index = None


def _load(name, default):
    try:
        with open(_DIR / name, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return default


def _get_glosses():
    global _glosses
    if _glosses is None:
        _glosses = _load("glosses-so.json", {})
    return _glosses


def content_index():
    global _index
    if _index is None:
        _index = _load("content-index.json", {"lessons": {}, "reader_chapters": {}})
    return _index


def _academic(words):
    return [w for w in words if wordlists.which_list(w) == "nawl"]


def academic_words_for_lesson(lesson_id):
    return _academic(content_index().get("lessons", {}).get(str(lesson_id), []))


def academic_words_for_chapter(chapter_id):
    return _academic(content_index().get("reader_chapters", {}).get(chapter_id, []))


def seed_words(user_id, words):
    """Insert academic words into user_vocabulary (idempotent). Returns count added."""
    if not words:
        return 0
    glosses = _get_glosses()
    conn = None
    added = 0
    try:
        conn = get_db()
        with conn.cursor() as cur:
            for w in words:
                cur.execute(
                    """
                    INSERT INTO user_vocabulary (user_id, word, translation, next_review)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (user_id, word) DO NOTHING
                    """,
                    (user_id, w, glosses.get(w, "")),
                )
                added += cur.rowcount
        conn.commit()
    except Exception as e:
        logger.warning("[vocab_seed] could not seed academic words: %s", e)
    finally:
        release_db(conn)
    return added
