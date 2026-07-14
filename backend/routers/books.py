import json
import logging
import random
from fastapi import APIRouter, Depends, HTTPException

from core.config import BOOKS_DIR
from core.db import get_db, release_db
from core.security import get_current_user, get_optional_user
from routers.assessment import run_writing_assessment

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["books"])


def load_book_library():
    with open(BOOKS_DIR / "book-library.json", encoding="utf-8") as f:
        return json.load(f)


def load_question_banks():
    with open(BOOKS_DIR / "question-banks.json", encoding="utf-8") as f:
        return json.load(f)


def _all_books(library: dict) -> list:
    if "library" in library:
        return library["library"].get("books", [])
    return library.get("books", [])


@router.get("/books")
async def get_books(unit_id: int = None):
    library = load_book_library()
    books = _all_books(library)
    if unit_id is not None:
        books = [b for b in books if b.get("unit_id") == unit_id]
    return books


@router.get("/books/{book_id}")
async def get_book(book_id: str):
    library = load_book_library()
    book = next((b for b in _all_books(library) if b["id"] == book_id), None)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.get("/books/{book_id}/assignment/{student_id}")
async def get_book_assignment(book_id: str, student_id: str):
    banks = load_question_banks()
    bank = banks.get(book_id)
    if not bank:
        raise HTTPException(status_code=404, detail=f"No question bank for book '{book_id}'")
    questions = random.sample(bank["questions"], min(10, len(bank["questions"])))
    prompts = random.sample(bank["writing_prompts"], min(2, len(bank["writing_prompts"])))
    return {"book_id": book_id, "questions": questions, "writing_prompts": prompts}


@router.post("/books/submit")
async def submit_book_assignment(submission: dict, user=Depends(get_current_user)):
    book_id = submission.get("book_id", "")
    comprehension_answers = submission.get("comprehension_answers", [])
    writing_submissions = submission.get("writing_submissions", [])

    banks = load_question_banks()
    bank = banks.get(book_id, {})
    question_map = {q["id"]: q for q in bank.get("questions", [])}
    prompt_map = {p["id"]: p for p in bank.get("writing_prompts", [])}

    correct = 0
    detailed = []
    for ans in comprehension_answers:
        q = question_map.get(ans.get("question_id"))
        if q and ans.get("answer") is not None:
            is_correct = ans["answer"] == q.get("correct")
            correct += 1 if is_correct else 0
            detailed.append({
                "question_id": ans["question_id"],
                "correct": is_correct,
                "difficulty": q.get("difficulty", "medium"),
            })

    total = len(comprehension_answers)
    score_pct = round((correct / total * 100) if total > 0 else 0)

    writing_results = []
    for sub in writing_submissions:
        p = prompt_map.get(sub.get("prompt_id"))
        wc = sub.get("word_count", 0)
        meets = bool(p and wc >= p.get("word_count_min", 0) and wc <= p.get("word_count_max", 99999))
        writing_results.append({
            "prompt_id": sub.get("prompt_id"),
            "word_count": wc,
            "meets_requirement": meets,
            "required_min": p.get("word_count_min") if p else None,
            "required_max": p.get("word_count_max") if p else None,
            "status": "meets_requirement" if meets else "needs_revision",
        })

    return {
        "comprehension": {
            "score": score_pct,
            "correct_answers": correct,
            "total_questions": total,
            "detailed_results": detailed,
        },
        "writing": {"submissions": writing_results},
    }


@router.get("/books/{book_id}/chapters")
async def get_book_chapters(book_id: str):
    banks = load_question_banks()
    bank = banks.get(book_id)
    if not bank:
        raise HTTPException(status_code=404, detail=f"No question bank for book '{book_id}'")
    return bank.get("chapters", [])


@router.get("/books/{book_id}/chapters/{chapter_id}/assignment/{student_id}")
async def get_chapter_assignment(book_id: str, chapter_id: str, student_id: str):
    banks = load_question_banks()
    bank = banks.get(book_id)
    if not bank:
        raise HTTPException(status_code=404, detail=f"No question bank for book '{book_id}'")
    chapter_questions = [q for q in bank.get("questions", []) if q.get("chapter_id") == chapter_id]
    chapter_prompts = [p for p in bank.get("writing_prompts", []) if p.get("chapter_id") == chapter_id]
    selected_questions = random.sample(chapter_questions, min(8, len(chapter_questions)))
    return {
        "chapter_id": chapter_id,
        "questions": selected_questions,
        "writing_prompts": chapter_prompts,
    }


@router.post("/books/chapters/submit")
async def submit_chapter_assignment(submission: dict, user=Depends(get_current_user)):
    book_id = submission.get("book_id", "")
    comprehension_answers = submission.get("comprehension_answers", [])
    writing_submissions = submission.get("writing_submissions", [])

    banks = load_question_banks()
    bank = banks.get(book_id, {})
    question_map = {q["id"]: q for q in bank.get("questions", [])}
    prompt_map = {p["id"]: p for p in bank.get("writing_prompts", [])}

    correct = 0
    detailed = []
    for ans in comprehension_answers:
        q = question_map.get(ans.get("question_id"))
        if q and ans.get("answer") is not None:
            is_correct = ans["answer"] == q.get("correct")
            correct += 1 if is_correct else 0
            detailed.append({
                "question_id": ans["question_id"],
                "correct": is_correct,
                "difficulty": q.get("difficulty", "medium"),
            })
    total = len(comprehension_answers)
    score_pct = round((correct / total * 100) if total > 0 else 0)

    writing_results = []
    for sub in writing_submissions:
        p = prompt_map.get(sub.get("prompt_id"))
        result = await run_writing_assessment(
            writing_text=sub.get("writing_text", ""),
            prompt_instruction=p.get("prompt", "") if p else "",
            min_words=p.get("word_count_min", 40) if p else 40,
        )
        writing_results.append({"prompt_id": sub.get("prompt_id"), **result})

    return {"comprehension_score": score_pct, "writing": writing_results}


@router.post("/books/{book_id}/chapters/{chapter_id}/complete")
async def complete_chapter(
    book_id: str,
    chapter_id: str,
    payload: dict = None,
    current_user=Depends(get_optional_user),
):
    if not current_user:
        return {"ok": True}
    user_id = current_user["id"]
    quiz_score = (payload or {}).get("quiz_score")
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
                    quiz_score   = EXCLUDED.quiz_score,
                    writing_passed = TRUE
                """,
                (user_id, book_id, chapter_id, quiz_score),
            )
            conn.commit()
    except Exception as e:
        logger.error("[complete_chapter] DB error: %s", e)
    finally:
        release_db(conn)
    return {"ok": True}


@router.get("/user/book-progress")
async def get_book_progress(current_user=Depends(get_optional_user)):
    if not current_user:
        return {}
    user_id = current_user["id"]
    banks = load_question_banks()
    completed_by_book: dict[str, list] = {}
    conn = None
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT book_id, chapter_id FROM user_chapter_progress WHERE user_id = %s",
                (user_id,),
            )
            for row in cur.fetchall():
                completed_by_book.setdefault(row["book_id"], []).append(row["chapter_id"])
    except Exception as e:
        logger.error("[get_book_progress] DB error: %s", e)
    finally:
        release_db(conn)
    result = {}
    for bid, bank in banks.items():
        total = len(bank.get("chapters", []))
        done_ids = completed_by_book.get(bid, [])
        result[bid] = {
            "completed": len(done_ids),
            "total": total,
            "percentage": round(len(done_ids) / total * 100) if total else 0,
            "completed_chapter_ids": done_ids,
        }
    return result
