import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.config import SRS_INTERVALS
from core.db import get_db, release_db
from core.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])

_WORDLISTS_DIR = Path(__file__).parent.parent / "data" / "wordlists"
_CONTENT_INDEX_PATH = _WORDLISTS_DIR / "content-index.json"
_content_index = None
_examples = None


def _get_examples():
    """word -> example sentence (built by scripts/tag_vocabulary.py)."""
    global _examples
    if _examples is None:
        try:
            with open(_WORDLISTS_DIR / "word-examples.json", encoding="utf-8") as f:
                _examples = json.load(f)
        except (OSError, json.JSONDecodeError):
            _examples = {}
    return _examples


def _get_content_index():
    """Lesson/reader -> target-list words map (built by scripts/tag_vocabulary.py)."""
    global _content_index
    if _content_index is None:
        try:
            with open(_CONTENT_INDEX_PATH, encoding="utf-8") as f:
                _content_index = json.load(f)
        except (OSError, json.JSONDecodeError):
            _content_index = {"target_total": 0, "list_totals": {}, "lessons": {},
                              "readers": {}, "content_coverage": {"total": 0}}
    return _content_index


class VocabReviewRequest(BaseModel):
    # user_vocabulary.id is a UUID — validating as int rejected every real row.
    word_id: UUID
    knew: bool


@router.get("/due")
async def get_vocabulary_due(user=Depends(get_current_user)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, word, translation, mastery_level, review_count
            FROM user_vocabulary
            WHERE user_id = %s
              AND (next_review IS NULL OR next_review <= NOW())
            ORDER BY COALESCE(next_review, '1970-01-01'::timestamptz) ASC
            LIMIT 20
        """, (user["id"],))
        rows = [dict(r) for r in cur.fetchall()]
        cur.execute(
            "SELECT COUNT(*) as total FROM user_vocabulary WHERE user_id = %s",
            (user["id"],)
        )
        total = cur.fetchone()["total"]
        cur.close()
        examples = _get_examples()
        for r in rows:
            r["example"] = examples.get((r.get("word") or "").lower())
        return {"words": rows, "total_words": total}
    finally:
        release_db(conn)


@router.get("/coverage")
async def get_vocabulary_coverage(user=Depends(get_current_user)):
    """How many target-list words (NGSL + NAWL + supplementary) the learner has met
    through the lessons they've completed, against the ~3,800-word C1 target."""
    idx = _get_content_index()
    lessons_map = idx.get("lessons", {})
    reader_chapters_map = idx.get("reader_chapters", {})

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT lesson_id FROM user_lessons WHERE user_id = %s AND completed = true",
            (user["id"],),
        )
        completed = [r["lesson_id"] for r in cur.fetchall()]
        # reader chapters read (stored in user_chapter_progress with a reader- book_id)
        cur.execute(
            "SELECT chapter_id FROM user_chapter_progress "
            "WHERE user_id = %s AND book_id LIKE 'reader-%%'",
            (user["id"],),
        )
        reader_chapter_ids = [r["chapter_id"] for r in cur.fetchall()]
        cur.close()
    finally:
        release_db(conn)

    learned = set()
    for lid in completed:
        learned.update(lessons_map.get(str(lid), []))
    reading_only = set()
    for cid in reader_chapter_ids:
        reading_only.update(reader_chapters_map.get(cid, []))
    reading_added = len(reading_only - learned)
    learned |= reading_only

    from core import wordlists
    list_totals = idx.get("list_totals", {})
    per_list = {name: 0 for name in list_totals}
    for w in learned:
        name = wordlists.which_list(w)
        if name in per_list:
            per_list[name] += 1

    return {
        "learned": len(learned),
        "target_total": idx.get("target_total", 0),
        "content_ceiling": idx.get("content_coverage", {}).get("total", 0),
        "reading_added": reading_added,
        "reader_chapters_read": len(reader_chapter_ids),
        "by_list": {
            name: {"learned": per_list.get(name, 0), "total": list_totals.get(name, 0)}
            for name in list_totals
        },
    }


@router.post("/review")
async def review_vocabulary(request: VocabReviewRequest, user=Depends(get_current_user)):
    word_id = str(request.word_id)  # psycopg2 can't adapt uuid.UUID without register_uuid
    knew = request.knew

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT mastery_level FROM user_vocabulary WHERE id = %s AND user_id = %s",
            (word_id, user["id"]),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Word not found")

        current = row["mastery_level"]
        new_level = min(current + 1, len(SRS_INTERVALS) - 1) if knew else max(current - 1, 0)
        days = SRS_INTERVALS[new_level]
        next_review = datetime.now(timezone.utc) + timedelta(days=days)

        cur.execute("""
            UPDATE user_vocabulary
            SET mastery_level = %s,
                next_review = %s,
                last_reviewed = NOW(),
                review_count = review_count + 1
            WHERE id = %s AND user_id = %s
        """, (new_level, next_review, word_id, user["id"]))
        conn.commit()
        cur.close()
        return {"mastery_level": new_level, "next_review_days": days}
    finally:
        release_db(conn)
