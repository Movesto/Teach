import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import json
from pathlib import Path
from datetime import datetime

from core.db import get_db, release_db
from core.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/placement", tags=["placement"])

PLACEMENT_TEST_FILE = Path(__file__).parent / "placement-test.json"
CAPSTONE_TEST_FILE = Path(__file__).parent / "capstone-test.json"


def load_placement_test():
    with open(PLACEMENT_TEST_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def _strip_for_client(test_data, listen_path):
    """Remove answer keys + transcripts; point listening at server-side audio."""
    for section in test_data.get("sections", []):
        for q in section.get("questions", []):
            q.pop("correct", None)
            if q.pop("transcript", None) is not None:
                q["audio"] = f"{listen_path}/{q['id']}"
        for passage in section.get("passages", []):
            for q in passage.get("questions", []):
                q.pop("correct", None)
    return test_data


def _score_test(test_data, answers):
    """Generic scorer for a placement/capstone test (same schema). Returns
    (total, max, percentage, breakdown, level)."""
    answer_map = {a.question_id: a for a in answers}
    total = 0
    max_score = test_data["scoring"]["total_points"]
    breakdown = {
        s: {"score": 0, "max": m, "questions_answered": 0, "questions_total": 0}
        for s, m in test_data["scoring"]["breakdown"].items()
    }

    def grade_mcq(sid, q):
        breakdown[sid]["questions_total"] += 1
        ans = answer_map.get(q["id"])
        if ans and ans.selected_option is not None:
            breakdown[sid]["questions_answered"] += 1
            if ans.selected_option == q.get("correct"):
                breakdown[sid]["score"] += q["points"]
                return q["points"]
        return 0

    for section in test_data["sections"]:
        sid = section["id"]
        for q in section.get("questions", []):
            total += grade_mcq(sid, q)
        for passage in section.get("passages", []):
            for q in passage.get("questions", []):
                total += grade_mcq(sid, q)
        for prompt in section.get("prompts", []):
            breakdown[sid]["questions_total"] += 1
            ans = answer_map.get(prompt["id"])
            if ans and ans.audio_url:
                breakdown[sid]["questions_answered"] += 1
                pts = int(prompt["points"] * 0.6)
                breakdown[sid]["score"] += pts
                total += pts

    percentage = round((total / max_score) * 100, 1) if max_score else 0.0
    level = next(
        (lv for lv in test_data["scoring"]["levels"] if lv["min_score"] <= percentage <= lv["max_score"]),
        test_data["scoring"]["levels"][0],
    )
    return total, max_score, percentage, breakdown, level


class Answer(BaseModel):
    question_id: str
    selected_option: Optional[int] = None
    audio_url: Optional[str] = None
    text_response: Optional[str] = None


class SubmitTestRequest(BaseModel):
    user_id: Optional[str] = None
    answers: List[Answer]
    time_taken_minutes: int


class PlacementResult(BaseModel):
    total_score: int
    max_score: int
    percentage: float
    level: str
    cefr: str
    description: str
    recommended_unit: int
    unit_name: str
    message: str
    breakdown: Dict[str, dict]
    completed_at: str
    can_retake: bool
    certificate_available: bool


@router.get("/test")
async def get_placement_test():
    try:
        return _strip_for_client(load_placement_test(), "/api/placement/listen")
    except Exception:
        logger.exception("Error loading placement test")
        raise HTTPException(status_code=500, detail="Error loading placement test")


@router.get("/listen/{question_id}")
async def placement_listening_audio(question_id: str):
    """Generate (and cache) audio for a listening question from its transcript.
    The committed mp3 paths in the test JSON never existed; this mirrors the
    lesson listening endpoint (Kokoro -> edge-tts fallback, cached under /audio)."""
    from core.config import KOKORO_VOICE, TTS_VOICE_DEFAULT
    from core.speech import synthesize

    test_data = load_placement_test()
    for section in test_data.get("sections", []):
        for question in section.get("questions", []):
            if question.get("id") == question_id and question.get("transcript"):
                url = await synthesize(
                    question["transcript"], KOKORO_VOICE, TTS_VOICE_DEFAULT,
                    prefix=f"placement_{question_id}",
                )
                if not url:
                    raise HTTPException(status_code=503, detail="Audio generation unavailable")
                return RedirectResponse(url)
    raise HTTPException(status_code=404, detail="Listening question not found")


@router.post("/submit", response_model=PlacementResult)
async def submit_placement_test(submission: SubmitTestRequest):
    try:
        test_data = load_placement_test()
        total_score, max_score, percentage, breakdown, placement_level = _score_test(
            test_data, submission.answers)

        return PlacementResult(
            total_score=total_score,
            max_score=max_score,
            percentage=percentage,
            level=placement_level["level"],
            cefr=placement_level["cefr"],
            description=placement_level["description"],
            recommended_unit=placement_level["recommended_unit"],
            unit_name=placement_level["unit_name"],
            message=placement_level["message"],
            breakdown=breakdown,
            completed_at=datetime.now().isoformat(),
            can_retake=True,
            certificate_available=percentage >= 70,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error processing placement test")
        raise HTTPException(status_code=500, detail="Error processing placement test")


def load_capstone_test():
    with open(CAPSTONE_TEST_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


@router.get("/capstone/test")
async def get_capstone_test():
    try:
        return _strip_for_client(load_capstone_test(), "/api/placement/capstone/listen")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Capstone assessment is not available yet")
    except Exception:
        logger.exception("Error loading capstone")
        raise HTTPException(status_code=500, detail="Error loading capstone")


@router.get("/capstone/listen/{question_id}")
async def capstone_listening_audio(question_id: str):
    from core.config import KOKORO_VOICE, TTS_VOICE_DEFAULT
    from core.speech import synthesize
    for section in load_capstone_test().get("sections", []):
        for q in section.get("questions", []):
            if q.get("id") == question_id and q.get("transcript"):
                url = await synthesize(q["transcript"], KOKORO_VOICE, TTS_VOICE_DEFAULT,
                                       prefix=f"capstone_{question_id}")
                if not url:
                    raise HTTPException(status_code=503, detail="Audio generation unavailable")
                return RedirectResponse(url)
    raise HTTPException(status_code=404, detail="Listening question not found")


@router.post("/capstone/submit", response_model=PlacementResult)
async def submit_capstone(submission: SubmitTestRequest):
    try:
        test_data = load_capstone_test()
        total, mx, pct, breakdown, level = _score_test(test_data, submission.answers)
        return PlacementResult(
            total_score=total, max_score=mx, percentage=pct,
            level=level["level"], cefr=level["cefr"], description=level["description"],
            recommended_unit=level["recommended_unit"], unit_name=level["unit_name"],
            message=level["message"], breakdown=breakdown,
            completed_at=datetime.now().isoformat(),
            can_retake=True, certificate_available=pct >= 75,
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error processing capstone")
        raise HTTPException(status_code=500, detail="Error processing capstone")


@router.get("/history")
async def placement_history(user=Depends(get_current_user)):
    """The learner's assessment timeline (baseline placement + later progress
    checks) for a 'then vs now' view. Each retake inserts a placement_results row."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT percentage, level, cefr, recommended_unit, taken_at
               FROM placement_results WHERE user_id = %s ORDER BY taken_at ASC""",
            (user["id"],),
        )
        attempts = [
            {
                "percentage": r["percentage"],
                "level": r["level"],
                "cefr": r["cefr"],
                "recommended_unit": r["recommended_unit"],
                "taken_at": r["taken_at"].isoformat() if r["taken_at"] else None,
            }
            for r in cur.fetchall()
        ]
        cur.close()
        return {"attempts": attempts}
    finally:
        release_db(conn)


@router.get("/results/{user_id}")
async def get_placement_results(user_id: str):
    raise HTTPException(status_code=501, detail="Not implemented")
