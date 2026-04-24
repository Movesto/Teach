import json
import logging
import re
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from core.config import LESSONS_DIR
from core.db import get_db, release_db
from core.security import get_optional_user
from core.ai_client import translate_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["lessons"])

_REQUIRED_LESSON_FIELDS = {"id", "title", "unit_id"}


class QuizSubmitRequest(BaseModel):
    lesson_id: int | None = Field(None, ge=0)
    unit_id: int = Field(1, ge=1, le=100)
    score: float | None = Field(None, ge=0, le=100)


def _lesson_numeric_id(raw_id) -> int:
    return int(re.sub(r"\D", "", str(raw_id)) or "0")


def _validate_lesson(data: dict, path) -> bool:
    missing = _REQUIRED_LESSON_FIELDS - data.keys()
    if missing:
        logger.warning("Skipping lesson file %s — missing fields: %s", path, missing)
        return False
    return True


def load_units():
    with open(LESSONS_DIR / "units.json", encoding="utf-8") as f:
        return json.load(f)


def normalize_lesson(data: dict) -> dict:
    if not data.get("description"):
        lvl = data.get("level", "")
        mins = data.get("estimated_time", "")
        data["description"] = f"{lvl.capitalize()} level" + (f" · {mins} min" if mins else "")

    if not data.get("difficulty"):
        data["difficulty"] = data.get("level", "beginner")

    if "target_phrases" in data and "target_language" not in data:
        data["target_language"] = {"phrases": data["target_phrases"]}

    if "dialogue" in data and "story" not in data:
        d = data["dialogue"]
        data["story"] = {
            "title": d.get("title", ""),
            "context": d.get("context", ""),
            "dialogue": d.get("lines", []),
        }

    if "pattern_drills" in data and "drills" not in data:
        drills = []
        for pd in data["pattern_drills"]:
            examples = pd.get("examples", [])
            drills.append({
                "title": pd.get("focus", ""),
                "instruction": pd.get("pattern", ""),
                "your_turn": pd.get("your_turn", examples[-1] if examples else pd.get("pattern", "")),
                "repetitions": 1,
                "examples": examples,
                "prompts": pd.get("prompts", []),
            })
        data["drills"] = drills

    if "listening_exercises" in data and "listening" not in data:
        data["listening"] = data["listening_exercises"]

    if "speaking_tasks" in data and "speaking" not in data:
        data["speaking"] = [
            {
                "title": t.get("prompt", "")[:80],
                "instruction": t.get("prompt", ""),
                "example": t.get("example", ""),
                "sentence_starters": t.get("sentence_starters", []),
            }
            for t in data["speaking_tasks"]
        ]

    if "writing_tasks" in data and "writing" not in data:
        data["writing"] = [
            {
                "title": t.get("prompt", "")[:80],
                "instruction": t.get("prompt", ""),
                "example": t.get("example", ""),
                "rubric": t.get("rubric", []),
            }
            for t in data["writing_tasks"]
        ]

    if "grammar_focus" in data and "grammar_discovery" not in data:
        data["grammar_discovery"] = {
            "sections": [
                {
                    "title": g.get("title", ""),
                    "examples": g.get("examples", []),
                    "explanation": g.get("explanation", ""),
                    "practice": g.get("practice", []),
                }
                for g in data["grammar_focus"]
            ]
        }

    if isinstance(data.get("quiz"), dict) and "questions" in data["quiz"]:
        normalised = []
        for q in data["quiz"]["questions"]:
            qt = q.get("type")
            if qt == "true-false":
                correct_bool = q.get("correct", True)
                normalised.append({
                    **q,
                    "type": "multiple-choice",
                    "options": ["True", "False"],
                    "correct": 0 if correct_bool else 1,
                })
            elif qt in ("fill-blank", "matching"):
                normalised.append({**q, "type": "open-ended"})
            else:
                normalised.append(q)
        data["quiz"] = normalised

    return data


async def _populate_vocabulary(user_id: str, lesson_id: int) -> None:
    lesson_data = None
    for unit_dir in LESSONS_DIR.glob("unit-*"):
        for lf in sorted(unit_dir.glob("lesson-*.json")):
            try:
                with open(lf, encoding="utf-8") as f:
                    data = json.load(f)
                if _lesson_numeric_id(data.get("id", "")) == lesson_id:
                    lesson_data = data
                    break
            except Exception:
                continue
        if lesson_data:
            break

    if not lesson_data:
        return

    phrases = lesson_data.get("target_language", {}).get("phrases", [])
    phrases = [p for p in phrases if isinstance(p, str) and p.strip()]
    if not phrases:
        return

    conn = get_db()
    try:
        cur = conn.cursor()
        inserted = 0
        for phrase in phrases:
            try:
                translation = await translate_text(phrase, "eng_to_som")
            except Exception:
                translation = ""
            cur.execute("""
                INSERT INTO user_vocabulary (user_id, word, translation, lesson_id, next_review)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (user_id, word) DO NOTHING
            """, (user_id, phrase, translation, lesson_id))
            inserted += cur.rowcount
        conn.commit()
        cur.close()
        if inserted:
            logger.info("Vocabulary: added %d phrases for user %s lesson %d", inserted, user_id, lesson_id)
    except Exception as e:
        logger.error("Vocabulary population error: %s", e)
    finally:
        release_db(conn)


@router.get("/units")
async def get_units(optional_user=Depends(get_optional_user)):
    user_id = optional_user["id"] if optional_user else None
    units = load_units()

    completed_map: dict = {}
    test_map: dict = {}
    if user_id:
        conn = get_db()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT lesson_id, score FROM user_lessons WHERE user_id = %s AND completed = true",
                (user_id,),
            )
            for row in cur.fetchall():
                completed_map[row["lesson_id"]] = row["score"]
            cur.execute(
                "SELECT unit_id, score, percentage FROM unit_test_results WHERE user_id = %s",
                (user_id,),
            )
            for row in cur.fetchall():
                test_map[row["unit_id"]] = {"score": row["score"], "percentage": row["percentage"]}
            cur.close()
        finally:
            release_db(conn)

    for unit in units:
        unit_dir = LESSONS_DIR / f"unit-{unit['id']}"
        if unit_dir.exists():
            lessons = []
            for lesson_file in sorted(unit_dir.glob("lesson-*.json")):
                try:
                    with open(lesson_file, encoding="utf-8") as f:
                        lesson_data = json.load(f)
                except (json.JSONDecodeError, KeyError, UnicodeDecodeError) as e:
                    logger.warning("Skipping invalid lesson file %s: %s", lesson_file, e)
                    continue
                if not _validate_lesson(lesson_data, lesson_file):
                    continue
                lid = _lesson_numeric_id(lesson_data["id"])
                done = lid in completed_map
                lessons.append({
                    "id": lid,
                    "lesson_number": lesson_data["lesson_number"],
                    "title": lesson_data["title"],
                    "description": lesson_data.get("description") or lesson_data.get("level", ""),
                    "difficulty": lesson_data.get("difficulty") or lesson_data.get("level", "beginner"),
                    "completed": done,
                    "score": completed_map.get(lid),
                    "locked": False,
                })
            lessons.sort(key=lambda x: x["lesson_number"])
            unit["lessons"] = lessons
            unit["total_lessons"] = len(lessons)
            unit["completed_lessons"] = sum(1 for x in lessons if x["completed"])
            tid = unit["id"]
            unit["test_done"] = tid in test_map
            unit["test_score"] = test_map[tid]["score"] if tid in test_map else None
            unit["test_percentage"] = test_map[tid]["percentage"] if tid in test_map else None

    return units


@router.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: str):
    for unit_dir in LESSONS_DIR.glob("unit-*"):
        for lesson_file in unit_dir.glob("lesson-*.json"):
            try:
                with open(lesson_file, encoding="utf-8") as f:
                    lesson_data = json.load(f)
                if not _validate_lesson(lesson_data, lesson_file):
                    continue
                if str(_lesson_numeric_id(lesson_data.get("id", ""))) == lesson_id:
                    return normalize_lesson(lesson_data)
            except (json.JSONDecodeError, KeyError, UnicodeDecodeError):
                continue
    raise HTTPException(status_code=404, detail="Lesson not found")


@router.post("/quiz/submit")
async def submit_quiz(
    request: QuizSubmitRequest,
    background_tasks: BackgroundTasks,
    optional_user=Depends(get_optional_user),
):
    user_id = optional_user["id"] if optional_user else "00000000-0000-0000-0000-000000000001"
    lesson_id = request.lesson_id
    unit_id = request.unit_id
    score = request.score

    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO user_lessons (user_id, lesson_id, unit_id, completed, score, completed_at)
            VALUES (%s, %s, %s, true, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, lesson_id)
            DO UPDATE SET score = EXCLUDED.score, completed_at = CURRENT_TIMESTAMP
        """, (user_id, lesson_id, unit_id, score))
        conn.commit()

        cur.execute(
            "SELECT COUNT(*) as done FROM user_lessons WHERE user_id = %s AND unit_id = %s AND completed = true",
            (user_id, unit_id),
        )
        done_count = cur.fetchone()["done"]
        unit_dir = LESSONS_DIR / f"unit-{unit_id}"
        total = len(list(unit_dir.glob("lesson-*.json"))) if unit_dir.exists() else 0
        unit_complete = total > 0 and done_count >= total
        cur.close()

        if optional_user and lesson_id:
            background_tasks.add_task(_populate_vocabulary, str(user_id), lesson_id)
        return {"success": True, "score": score, "unit_complete": unit_complete, "unit_id": unit_id}
    except Exception as e:
        logger.error("Database error in quiz submit: %s", e)
        return {"success": False, "error": str(e)}
    finally:
        release_db(conn)
