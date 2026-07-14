import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.config import SRS_INTERVALS
from core.db import get_db, release_db
from core.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])


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
        return {"words": rows, "total_words": total}
    finally:
        release_db(conn)


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
