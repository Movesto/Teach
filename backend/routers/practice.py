"""Phase 7 practice modes. Dictation: the app plays a sentence, the learner types
what they hear, and the server scores it against the hidden text (the text is never
sent to the client until after they answer). Audio reuses the Kokoro TTS cache."""
import datetime
import difflib
import json
import logging
import random
import re
from pathlib import Path

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from core.ai_client import ask_qwen, sanitize_user_message
from core.config import ACCENT_VOICES, KOKORO_VOICE, TTS_VOICE_DEFAULT
from core.db import get_db, release_db
from core.security import get_current_user
from core.speech import synthesize

router = APIRouter(prefix="/api/practice", tags=["practice"])

_DICT_PATH = Path(__file__).parent.parent / "data" / "dictation.json"
_dict = None
_by_id = None


def _load():
    global _dict, _by_id
    if _dict is None:
        try:
            with open(_DICT_PATH, encoding="utf-8") as f:
                _dict = json.load(f)
        except (OSError, json.JSONDecodeError):
            _dict = {}
        _by_id = {it["id"]: it["text"] for lst in _dict.values() for it in lst}
    return _dict, _by_id


@router.get("/dictation")
async def dictation_set(level: str = "A2", n: int = 10):
    """A random dictation set — ids + audio URLs only (never the text)."""
    d, _ = _load()
    items = d.get(level) or d.get("A2") or []
    picked = random.sample(items, min(n, len(items))) if items else []
    return {"level": level, "items": [
        {"id": it["id"], "audio": f"/api/practice/dictation/{it['id']}/listen"} for it in picked]}


_SC_PATH = Path(__file__).parent.parent / "data" / "speaking-club.json"
_sc = None


def _load_sc():
    global _sc
    if _sc is None:
        try:
            with open(_SC_PATH, encoding="utf-8") as f:
                _sc = json.load(f)
        except (OSError, json.JSONDecodeError):
            _sc = {}
    return _sc


@router.get("/speaking-club")
async def speaking_club(level: str = "A2"):
    """This week's discussion prompt for the level (rotates by ISO week)."""
    sc = _load_sc()
    prompts = sc.get(level) or sc.get("A2") or []
    if not prompts:
        return {"level": level, "prompt": None}
    week = datetime.date.today().isocalendar()[1]
    return {"level": level, "week": week, "prompt": prompts[week % len(prompts)]}


@router.get("/shadowing")
async def shadowing_set(level: str = "A2", n: int = 8):
    """Shadowing shows the text (you read, hear the model, then record + compare),
    so unlike dictation the text IS returned. Audio reuses the dictation endpoint."""
    d, _ = _load()
    items = d.get(level) or d.get("A2") or []
    picked = random.sample(items, min(n, len(items))) if items else []
    return {"level": level, "items": [
        {"id": it["id"], "text": it["text"], "audio": f"/api/practice/dictation/{it['id']}/listen"}
        for it in picked]}


@router.get("/dictation/{item_id}/listen")
async def dictation_audio(item_id: str, accent: str = "us"):
    """Audio for a dictation/shadowing item. `accent` picks a regional English
    voice (us/uk/ke/ng/tz) — anything but 'us' is produced by edge-tts."""
    _, by_id = _load()
    text = by_id.get(item_id)
    if not text:
        raise HTTPException(status_code=404, detail="Dictation item not found")
    edge_voice = ACCENT_VOICES.get(accent, TTS_VOICE_DEFAULT)
    force_edge = accent in ACCENT_VOICES and accent != "us"
    url = await synthesize(text, KOKORO_VOICE, edge_voice,
                           prefix=f"dict_{item_id}", force_edge=force_edge)
    if not url:
        raise HTTPException(status_code=503, detail="Audio generation unavailable")
    return RedirectResponse(url)


def _norm(s):
    return re.sub(r"[^\w\s']", " ", (s or "").lower()).split()


@router.post("/dictation/{item_id}/check")
async def dictation_check(item_id: str, submission: dict):
    """Score the typed attempt against the hidden target (word-level ratio) and
    reveal the target + a per-word diff for highlighting."""
    _, by_id = _load()
    target = by_id.get(item_id)
    if not target:
        raise HTTPException(status_code=404, detail="Dictation item not found")
    typed_words = (submission.get("typed") or "").split()
    tn = _norm(submission.get("typed"))
    gn = _norm(target)
    score = round(difflib.SequenceMatcher(None, tn, gn).ratio() * 100)
    # per-typed-word correctness (aligned against the normalized target set order)
    diff = []
    matcher = difflib.SequenceMatcher(None, tn, gn)
    correct_idx = set()
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            correct_idx.update(range(i1, i2))
    for i, w in enumerate(typed_words):
        diff.append({"word": w, "ok": i < len(tn) and i in correct_idx})
    return {"score": score, "correct": score >= 90, "target": target, "diff": diff}


# ── Mistake notebook ─────────────────────────────────────────────────────────

@router.post("/mistakes")
async def record_mistakes(payload: dict, user=Depends(get_current_user)):
    """Collect wrong answers into the learner's notebook (idempotent per question)."""
    mistakes = payload.get("mistakes", [])
    if not mistakes:
        return {"added": 0}
    conn = None
    added = 0
    try:
        conn = get_db()
        with conn.cursor() as cur:
            for m in mistakes[:50]:
                q = (m.get("question") or "").strip()
                if not q:
                    continue
                cur.execute(
                    """INSERT INTO user_mistakes
                           (user_id, question, correct_answer, your_answer, source, lesson_id)
                       VALUES (%s,%s,%s,%s,%s,%s)
                       ON CONFLICT (user_id, question) DO UPDATE SET
                           mastered = FALSE, your_answer = EXCLUDED.your_answer""",
                    (user["id"], q[:2000], (m.get("correct_answer") or "")[:1000],
                     (m.get("your_answer") or "")[:1000], m.get("source", "quiz"),
                     m.get("lesson_id")),
                )
                added += cur.rowcount
        conn.commit()
    except Exception as e:
        logger.warning("[practice] mistake record error: %s", e)
    finally:
        release_db(conn)
    return {"added": added}


@router.get("/mistakes")
async def list_mistakes(user=Depends(get_current_user)):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, question, correct_answer, your_answer, source, lesson_id, reviewed_count
               FROM user_mistakes WHERE user_id = %s AND mastered = FALSE
               ORDER BY created_at ASC LIMIT 50""",
            (user["id"],),
        )
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            r["id"] = str(r["id"])
        cur.execute("SELECT COUNT(*) AS n FROM user_mistakes WHERE user_id = %s AND mastered = TRUE",
                    (user["id"],))
        mastered = cur.fetchone()["n"]
        cur.close()
        return {"mistakes": rows, "mastered": mastered}
    finally:
        release_db(conn)


@router.post("/mistakes/{mistake_id}/review")
async def review_mistake(mistake_id: str, payload: dict, user=Depends(get_current_user)):
    """Mark a review: 'knew' masters it (leaves the deck); otherwise it stays."""
    knew = bool(payload.get("knew"))
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """UPDATE user_mistakes
               SET reviewed_count = reviewed_count + 1, mastered = %s
               WHERE id = %s AND user_id = %s""",
            (knew, mistake_id, user["id"]),
        )
        conn.commit()
        cur.close()
    finally:
        release_db(conn)
    return {"ok": True, "mastered": knew}


# ── Weekly review ────────────────────────────────────────────────────────────

@router.get("/weekly-review")
async def weekly_review(user=Depends(get_current_user)):
    """One catch-up session: this week's unmastered mistakes + vocabulary now due.
    Reuses the mistake-notebook and SRS review endpoints for the actual grading."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, question, correct_answer, your_answer, source, lesson_id
               FROM user_mistakes
               WHERE user_id = %s AND mastered = FALSE
                 AND created_at >= NOW() - INTERVAL '7 days'
               ORDER BY created_at DESC LIMIT 30""",
            (user["id"],),
        )
        mistakes = [dict(r) for r in cur.fetchall()]
        for r in mistakes:
            r["id"] = str(r["id"])
        cur.execute(
            """SELECT COUNT(*) AS n FROM user_vocabulary
               WHERE user_id = %s AND (next_review IS NULL OR next_review <= NOW())""",
            (user["id"],),
        )
        due_vocab = cur.fetchone()["n"]
        cur.close()
        return {"mistakes": mistakes, "due_vocab": due_vocab,
                "total": len(mistakes) + due_vocab}
    finally:
        release_db(conn)


# ── Homework loop ────────────────────────────────────────────────────────────

@router.post("/homework")
async def assign_homework(payload: dict, user=Depends(get_current_user)):
    """Assign a lesson's writing task to yourself, due tomorrow (idempotent per
    open task+lesson so re-opening a lesson doesn't stack duplicates)."""
    task = (payload.get("task") or "").strip()
    if not task:
        raise HTTPException(status_code=400, detail="A task is required")
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id FROM user_homework
               WHERE user_id = %s AND lesson_id IS NOT DISTINCT FROM %s
                 AND task = %s AND completed_at IS NULL""",
            (user["id"], payload.get("lesson_id"), task[:4000]),
        )
        existing = cur.fetchone()
        if existing:
            cur.close()
            return {"id": str(existing["id"]), "assigned": False}
        cur.execute(
            """INSERT INTO user_homework
                   (user_id, lesson_id, title, task, model_answer, min_words)
               VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
            (user["id"], payload.get("lesson_id"), (payload.get("title") or "")[:300],
             task[:4000], (payload.get("model_answer") or "")[:6000],
             int(payload.get("min_words") or 0)),
        )
        hid = str(cur.fetchone()["id"])
        conn.commit()
        cur.close()
        return {"id": hid, "assigned": True}
    finally:
        release_db(conn)


@router.get("/homework")
async def list_homework(user=Depends(get_current_user)):
    """Pending homework first (with a due/overdue flag), then recently completed."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, lesson_id, title, task, model_answer, min_words, submission,
                      assigned_at, due_at, completed_at,
                      (completed_at IS NULL AND due_at < NOW()) AS overdue
               FROM user_homework WHERE user_id = %s
               ORDER BY completed_at IS NOT NULL, due_at ASC LIMIT 30""",
            (user["id"],),
        )
        rows = [dict(r) for r in cur.fetchall()]
        for r in rows:
            r["id"] = str(r["id"])
            for k in ("assigned_at", "due_at", "completed_at"):
                if r.get(k):
                    r[k] = r[k].isoformat()
        cur.close()
        pending = sum(1 for r in rows if not r["completed_at"])
        return {"homework": rows, "pending": pending}
    finally:
        release_db(conn)


@router.post("/homework/{homework_id}/submit")
async def submit_homework(homework_id: str, payload: dict, user=Depends(get_current_user)):
    """Save the learner's answer and mark it done. The model answer is revealed
    client-side for self-checking; the server just records the submission."""
    submission = (payload.get("submission") or "").strip()
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """UPDATE user_homework
               SET submission = %s, completed_at = NOW()
               WHERE id = %s AND user_id = %s RETURNING model_answer""",
            (submission[:8000], homework_id, user["id"]),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Homework not found")
        conn.commit()
        cur.close()
        return {"ok": True, "model_answer": row["model_answer"]}
    finally:
        release_db(conn)


# ── Authentic-materials bridge ───────────────────────────────────────────────

_AM_PATH = Path(__file__).parent.parent / "data" / "authentic-materials.json"
_am = None


def _load_am():
    global _am
    if _am is None:
        try:
            with open(_AM_PATH, encoding="utf-8") as f:
                _am = json.load(f)
        except (OSError, json.JSONDecodeError):
            _am = {}
    return _am


@router.get("/authentic")
async def authentic_materials(level: str = "B1"):
    """Curated real-world assignments (news, talks, texts) wrapped in the app's own
    task apparatus, for B1 and up. Below B1 there is nothing yet — returns empty."""
    am = _load_am()
    return {"level": level, "assignments": am.get(level, [])}


# ── AI writing feedback (free 1/day) ─────────────────────────────────────────

_FEEDBACK_SYSTEM = (
    "You are an encouraging English writing tutor for adult learners whose first "
    "language is Somali. Give short, practical feedback on the learner's writing. "
    "Structure it as: one sentence of genuine praise; then 3-5 specific corrections "
    "(quote the learner's phrase, then the better version); then one tip to work on "
    "next. Be warm and concrete. Do not rewrite the whole text for them."
)


@router.post("/writing-feedback")
async def writing_feedback(payload: dict, user=Depends(get_current_user)):
    """Free AI feedback on a piece of writing, limited to once per calendar day."""
    text = sanitize_user_message((payload.get("text") or "").strip())
    if len(text) < 20:
        raise HTTPException(status_code=400, detail="Please write at least a sentence or two first.")
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT COUNT(*) AS n FROM writing_feedback_log
               WHERE user_id = %s AND created_at::date = CURRENT_DATE""",
            (user["id"],),
        )
        if cur.fetchone()["n"] >= 1:
            cur.close()
            raise HTTPException(
                status_code=429,
                detail="You've used your free writing check for today. Come back tomorrow!",
            )
        cur.close()
    finally:
        release_db(conn)

    prompt = payload.get("prompt")
    user_msg = f"Task: {prompt}\n\nMy writing:\n{text[:3000]}" if prompt else text[:3000]
    feedback = await ask_qwen(
        [{"role": "system", "content": _FEEDBACK_SYSTEM},
         {"role": "user", "content": user_msg}],
        max_tokens=500,
    )

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO writing_feedback_log (user_id) VALUES (%s)", (user["id"],))
        conn.commit()
        cur.close()
    except Exception as e:
        logger.warning("[practice] feedback log error: %s", e)
    finally:
        release_db(conn)
    return {"feedback": feedback}
