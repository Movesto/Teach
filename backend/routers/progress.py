import json
import logging
from datetime import date, timedelta
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from core.db import get_db, release_db
from core.security import get_current_user, get_optional_user
from core.config import UNIT_TESTS_DIR

_WRITING_EXAMS_PATH = Path(__file__).parent.parent / "services" / "placement_test" / "writing-exams.json"


def _load_writing_exams():
    try:
        with open(_WRITING_EXAMS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["progress"])

_CANDO_PATH = Path(__file__).parent.parent / "data" / "can-do-statements.json"
_cando = None


def _get_cando():
    global _cando
    if _cando is None:
        try:
            with open(_CANDO_PATH, encoding="utf-8") as f:
                _cando = json.load(f)
        except (OSError, json.JSONDecodeError):
            _cando = []
    return _cando


@router.get("/progress/can-do")
async def get_can_do(user=Depends(get_current_user)):
    """CEFR can-do descriptors per unit, marked achieved when the unit test is
    passed (>=60%). Makes progress concrete: 'here's what you can now do'."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT unit_id FROM unit_test_results WHERE user_id = %s AND percentage >= 60",
            (user["id"],),
        )
        passed = {r["unit_id"] for r in cur.fetchall()}
        cur.close()
    finally:
        release_db(conn)
    units = [{**u, "achieved": u["unit_id"] in passed} for u in _get_cando()]
    return {"units": units, "achieved_units": len(passed)}


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


@router.get("/writing-exam/{unit}")
async def get_writing_exam(unit: int, user=Depends(get_current_user)):
    """Units 11-13 exam-shape writing tasks: a timed C1 essay + an integrated
    listen-then-write. The listen-then-write transcript is NOT sent (the learner
    must listen); it's pointed at server-side audio. Grading via /api/writing/assess."""
    exam = _load_writing_exams().get(str(unit))
    if not exam:
        raise HTTPException(status_code=404, detail="No writing exam for that unit")
    lw = dict(exam.get("listen_write", {}))
    lw.pop("transcript", None)
    lw["audio"] = f"/api/writing-exam/{unit}/listen"
    return {"unit": unit, "essay": exam.get("essay"), "listen_write": lw}


@router.get("/writing-exam/{unit}/listen")
async def writing_exam_audio(unit: int):
    from core.config import KOKORO_VOICE, TTS_VOICE_DEFAULT
    from core.speech import synthesize
    exam = _load_writing_exams().get(str(unit))
    transcript = (exam or {}).get("listen_write", {}).get("transcript")
    if not transcript:
        raise HTTPException(status_code=404, detail="No audio for that exam")
    url = await synthesize(transcript, KOKORO_VOICE, TTS_VOICE_DEFAULT, prefix=f"writingexam_{unit}")
    if not url:
        raise HTTPException(status_code=503, detail="Audio generation unavailable")
    return RedirectResponse(url)


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
