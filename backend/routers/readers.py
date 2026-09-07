"""In-app graded reading library (Phase 4).

Readers are original, level-tagged texts stored one-per-file under READERS_DIR
(schema: docs/reader-schema.md). Unlike books/ (external PDFs), a reader holds its
full prose, so the app displays it and synthesizes chapter audio on demand — the
same Kokoro→edge cache used for lesson listening.

Deliberately lean (see the Phase 4 scope note): catalog, detail (answers hidden),
per-chapter audio, and answer grading. Bookmark / words-read tracking is a later
Phase 4 item and is not built here.
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from core.config import READERS_DIR, KOKORO_VOICE, TTS_VOICE_DEFAULT
from core.db import get_db, release_db
from core.security import get_optional_user
from core.speech import synthesize

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["readers"])


def _load_all() -> list[dict]:
    """Every reader JSON on disk (skips the generation manifest)."""
    if not READERS_DIR.is_dir():
        return []
    out = []
    for path in sorted(READERS_DIR.glob("reader-*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                out.append(json.load(f))
        except (OSError, json.JSONDecodeError) as e:
            logger.warning("skipping unreadable reader %s: %s", path.name, e)
    return out


def _load_one(reader_id: str) -> dict | None:
    path = READERS_DIR / f"{reader_id}.json"
    if not path.is_file():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def _card(reader: dict) -> dict:
    """Catalog card — metadata only, no chapter text or questions."""
    return {
        "id": reader.get("id"),
        "title": reader.get("title"),
        "author": reader.get("author"),
        "level": reader.get("level"),
        "cefr": reader.get("cefr"),
        "interest_tags": reader.get("interest_tags", []),
        "genre": reader.get("genre"),
        "description": reader.get("description"),
        "word_count": reader.get("word_count"),
        "reading_time_minutes": reader.get("reading_time_minutes"),
        "chapter_count": len(reader.get("chapters", [])),
    }


@router.get("/readers")
async def list_readers(level: str = None, tag: str = None):
    """Catalog cards, optionally filtered by CEFR level and/or interest tag."""
    readers = _load_all()
    if level:
        readers = [r for r in readers if r.get("level") == level]
    if tag:
        readers = [r for r in readers if tag in r.get("interest_tags", [])]
    return [_card(r) for r in readers]


@router.get("/readers/{reader_id}")
async def get_reader(reader_id: str):
    """Full reader for the reading view: chapters with prose, questions with the
    answer key stripped, and each chapter pointed at its on-demand audio URL."""
    reader = _load_one(reader_id)
    if not reader:
        raise HTTPException(status_code=404, detail="Reader not found")
    chapters = []
    for i, ch in enumerate(reader.get("chapters", [])):
        questions = [
            {k: v for k, v in q.items() if k not in ("correct", "explanation")}
            for q in ch.get("questions", [])
        ]
        chapters.append({
            "id": ch.get("id"),
            "title": ch.get("title"),
            "text": ch.get("text"),
            "word_count": ch.get("word_count"),
            "audio": f"/api/readers/{reader_id}/listen/{i}",
            "questions": questions,
            "vocabulary": ch.get("vocabulary", []),
        })
    return {**_card(reader), "chapters": chapters,
            "writing_prompt": reader.get("writing_prompt")}


@router.get("/readers/{reader_id}/listen/{idx}")
async def reader_chapter_audio(reader_id: str, idx: int):
    """Synthesize (and cache) a chapter's audio from its text, then redirect to the
    static /audio file. First play synthesizes via Kokoro; later plays hit cache."""
    reader = _load_one(reader_id)
    if not reader:
        raise HTTPException(status_code=404, detail="Reader not found")
    chapters = reader.get("chapters", [])
    if not (0 <= idx < len(chapters)):
        raise HTTPException(status_code=404, detail="Chapter not found")
    text = (chapters[idx] or {}).get("text")
    if not text:
        raise HTTPException(status_code=404, detail="No text for this chapter")
    url = await synthesize(text, KOKORO_VOICE, TTS_VOICE_DEFAULT,
                           prefix=f"reader_{reader_id}_{idx}")
    if not url:
        raise HTTPException(status_code=503, detail="Audio generation unavailable")
    return RedirectResponse(url)


@router.post("/readers/{reader_id}/chapters/{idx}/submit")
async def submit_chapter(reader_id: str, idx: int, submission: dict,
                         current_user=Depends(get_optional_user)):
    """Grade a chapter's multiple-choice answers against the stored key, and (for a
    logged-in reader) record the chapter as read so it counts toward vocabulary
    coverage — reusing user_chapter_progress (book_id = reader id).

    submission: {"answers": [{"question_id": str, "answer": int}, ...]}
    """
    reader = _load_one(reader_id)
    if not reader:
        raise HTTPException(status_code=404, detail="Reader not found")
    chapters = reader.get("chapters", [])
    if not (0 <= idx < len(chapters)):
        raise HTTPException(status_code=404, detail="Chapter not found")
    chapter = chapters[idx]
    qmap = {q["id"]: q for q in chapter.get("questions", [])}

    correct = 0
    detailed = []
    answers = submission.get("answers", [])
    for ans in answers:
        q = qmap.get(ans.get("question_id"))
        if q is None or ans.get("answer") is None:
            continue
        is_correct = ans["answer"] == q.get("correct")
        correct += 1 if is_correct else 0
        detailed.append({
            "question_id": ans["question_id"],
            "correct": is_correct,
            "correct_answer": q.get("correct"),
            "explanation": q.get("explanation"),
        })
    total = len(qmap)
    score = round(correct / total * 100) if total else 0

    if current_user:
        _mark_chapter_read(current_user["id"], reader_id, chapter.get("id"), score)

    return {
        "score": score,
        "correct_answers": correct,
        "total_questions": total,
        "detailed_results": detailed,
    }


def _mark_chapter_read(user_id, reader_id, chapter_id, score):
    """Record a read reader-chapter in user_chapter_progress (shared with books)."""
    if not chapter_id:
        return
    conn = None
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_chapter_progress
                    (user_id, book_id, chapter_id, quiz_score, writing_passed)
                VALUES (%s, %s, %s, %s, TRUE)
                ON CONFLICT (user_id, book_id, chapter_id) DO UPDATE SET
                    completed_at = CURRENT_TIMESTAMP,
                    quiz_score   = EXCLUDED.quiz_score
                """,
                (user_id, reader_id, chapter_id, score),
            )
            conn.commit()
    except Exception as e:
        logger.warning("[readers] could not record chapter progress: %s", e)
    finally:
        release_db(conn)
