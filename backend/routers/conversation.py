import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from psycopg2.extras import RealDictCursor

from core.config import (
    CONVERSATION_DAILY_LIMIT, KOKORO_VOICE, TEACHER_VOICE, support_level_for_unit,
)
from core.db import get_db, release_db
from core.security import get_current_user
from core.rate_limit import ai_rate_limit
from core.ai_client import ask_qwen, sanitize_user_message
from core.speech import synthesize
from core.curriculum import (
    load_lesson, support_level_for_lesson, lesson_scenario_prompt,
    conversation_support_directive,
)
from core.prompts import TEACHER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/conversation", tags=["conversation"])


class ConversationMessageRequest(BaseModel):
    message: str = Field(..., max_length=1000)
    history: list = Field(default_factory=list)
    elapsed_seconds: int = Field(0, ge=0)
    lesson_id: int | None = Field(None, ge=0)   # scope the role-play to a lesson (Phase 4)
    unit_id: int | None = Field(None, ge=1)      # used for the support tier if no lesson_id


async def _teacher_tts(text: str) -> str | None:
    return await synthesize(text, KOKORO_VOICE, TEACHER_VOICE, prefix="teacher")


def _build_system_prompt(lesson_id: int | None, unit_id: int | None) -> str:
    """Assemble the conversation system prompt: base teacher persona + an optional
    lesson-scoped scenario (Phase 4) + the tier's Somali-scaffolding directive (Phase 5)."""
    parts = [TEACHER_SYSTEM_PROMPT]
    support_level = "english_first"
    if lesson_id:
        lesson = load_lesson(lesson_id)
        if lesson:
            support_level = support_level_for_lesson(lesson)
            parts.append(lesson_scenario_prompt(lesson))
    elif unit_id:
        support_level = support_level_for_unit(unit_id)
    parts.append(conversation_support_directive(support_level))
    return "\n\n".join(parts)


def _get_today_session(user_id: str) -> dict:
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            INSERT INTO conversation_sessions (user_id, date)
            VALUES (%s, CURRENT_DATE)
            ON CONFLICT (user_id, date) DO NOTHING
        """, (user_id,))
        conn.commit()
        cur.execute(
            "SELECT * FROM conversation_sessions WHERE user_id = %s AND date = CURRENT_DATE",
            (user_id,),
        )
        row = cur.fetchone()
        cur.close()
        return dict(row)
    finally:
        release_db(conn)


@router.get("/status")
async def conversation_status(user=Depends(get_current_user)):
    session = _get_today_session(user["id"])
    used = session["total_seconds"]
    remaining = max(0, CONVERSATION_DAILY_LIMIT - used)
    return {
        "used_seconds": used,
        "remaining_seconds": remaining,
        "limit_seconds": CONVERSATION_DAILY_LIMIT,
        "session_id": str(session["id"]),
    }


@router.post("/message")
async def conversation_message(
    req: ConversationMessageRequest,
    _=Depends(ai_rate_limit),
    user=Depends(get_current_user),
):
    message = sanitize_user_message(req.message.strip())
    elapsed = min(req.elapsed_seconds, CONVERSATION_DAILY_LIMIT)

    if not message:
        raise HTTPException(status_code=400, detail="Message is empty")

    session = _get_today_session(user["id"])
    if session["total_seconds"] >= CONVERSATION_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="Daily limit reached")

    qwen_messages = [{"role": "system", "content": _build_system_prompt(req.lesson_id, req.unit_id)}]
    for msg in req.history[-12:]:
        qwen_messages.append({"role": msg["role"], "content": msg["content"]})
    qwen_messages.append({"role": "user", "content": message})

    reply_text = await ask_qwen(qwen_messages, max_tokens=150)
    audio_url = await _teacher_tts(reply_text)

    new_messages = req.history + [
        {"role": "user", "content": message},
        {"role": "assistant", "content": reply_text},
    ]
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE conversation_sessions
            SET messages = %s, total_seconds = %s, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND date = CURRENT_DATE
        """, (json.dumps(new_messages), elapsed, user["id"]))
        conn.commit()
        cur.close()
    finally:
        release_db(conn)

    return {
        "reply": reply_text,
        "audio_url": audio_url,
        "remaining_seconds": max(0, CONVERSATION_DAILY_LIMIT - elapsed),
    }


@router.get("/history")
async def conversation_history(user=Depends(get_current_user)):
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT messages, total_seconds FROM conversation_sessions WHERE user_id = %s AND date = CURRENT_DATE",
            (user["id"],),
        )
        row = cur.fetchone()
        cur.close()
    finally:
        release_db(conn)
    if not row:
        return {"messages": [], "total_seconds": 0}
    return {"messages": row["messages"] or [], "total_seconds": row["total_seconds"]}
