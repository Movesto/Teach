import json
import logging
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import get_db, release_db
from core.security import get_current_user, get_optional_user
from core.config import UNIT_TESTS_DIR

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["progress"])


@router.get("/progress/stats")
async def get_progress_stats(user=Depends(get_current_user)):
    conn = get_db()
    try:
        cur = conn.cursor()

        cur.execute("""
            SELECT
                COUNT(*) as lessons_completed,
                COALESCE(AVG(score), 0) as avg_score,
                COALESCE(SUM(time_spent), 0) as total_seconds
            FROM user_lessons
            WHERE user_id = %s AND completed = true
        """, (user["id"],))
        ls = cur.fetchone()

        cur.execute("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE mastery_level >= 3) as mastered
            FROM user_vocabulary WHERE user_id = %s
        """, (user["id"],))
        vs = cur.fetchone()

        cur.execute("""
            SELECT score FROM user_lessons
            WHERE user_id = %s AND completed = true AND score IS NOT NULL
            ORDER BY completed_at DESC LIMIT 10
        """, (user["id"],))
        recent = list(reversed([r["score"] for r in cur.fetchall()]))

        cur.execute("""
            SELECT DISTINCT DATE(completed_at) as day
            FROM user_lessons
            WHERE user_id = %s AND completed = true AND completed_at IS NOT NULL
            ORDER BY day DESC LIMIT 365
        """, (user["id"],))
        study_days = {r["day"] for r in cur.fetchall()}
        streak = 0
        check = date.today()
        if check not in study_days:
            check -= timedelta(days=1)
        while check in study_days:
            streak += 1
            check -= timedelta(days=1)

        cur.close()
        return {
            "lessons_completed": ls["lessons_completed"],
            "avg_score": round(float(ls["avg_score"]), 1),
            "total_minutes": round(ls["total_seconds"] / 60),
            "words_learning": vs["total"],
            "words_mastered": vs["mastered"],
            "recent_scores": recent,
            "streak_days": streak,
            "cefr_level": user.get("cefr_level") or "A1",
        }
    finally:
        release_db(conn)


@router.get("/unit-tests/{unit_id}")
async def get_unit_test(unit_id: int, optional_user=Depends(get_optional_user)):
    test_file = UNIT_TESTS_DIR / f"unit-{unit_id}-test.json"
    if not test_file.exists():
        raise HTTPException(status_code=404, detail="Test not found")
    with open(test_file, encoding="utf-8") as f:
        data = json.load(f)
    data["previous_result"] = None
    if optional_user:
        conn = get_db()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT score, percentage, taken_at FROM unit_test_results WHERE user_id = %s AND unit_id = %s",
                (optional_user["id"], unit_id),
            )
            row = cur.fetchone()
            if row:
                data["previous_result"] = {
                    "score": row["score"],
                    "percentage": row["percentage"],
                    "taken_at": row["taken_at"].isoformat() if row["taken_at"] else None,
                }
            cur.close()
        finally:
            release_db(conn)
    return data


class UnitTestSubmit(BaseModel):
    score: int
    percentage: float
    answers: list


@router.post("/unit-tests/{unit_id}/submit")
async def submit_unit_test(unit_id: int, req: UnitTestSubmit, user=Depends(get_current_user)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO unit_test_results (user_id, unit_id, score, percentage, answers)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (user_id, unit_id)
            DO UPDATE SET score=EXCLUDED.score, percentage=EXCLUDED.percentage,
                          answers=EXCLUDED.answers, taken_at=CURRENT_TIMESTAMP
        """, (user["id"], unit_id, req.score, req.percentage, json.dumps(req.answers)))
        conn.commit()
        cur.close()
    finally:
        release_db(conn)
    return {"success": True}
