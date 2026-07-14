import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.config import ADMIN_EMAIL
from core.db import get_db, release_db
from core.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["feedback"])


class FeedbackRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    message: str = Field("", max_length=2000)
    lesson_id: int | None = None
    lesson_title: str | None = Field(None, max_length=200)
    page: str = Field("general", max_length=100)


@router.post("/feedback")
async def submit_feedback(req: FeedbackRequest, user=Depends(get_current_user)):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO feedback (user_id, user_name, user_email, rating, message, lesson_id, lesson_title, page)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            user["id"], user["name"], user["email"],
            req.rating, req.message.strip() or None,
            req.lesson_id, req.lesson_title, req.page,
        ))
        conn.commit()
        cur.close()
        return {"success": True}
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("Feedback submit error: %s", e)
        raise HTTPException(status_code=500, detail="Could not save feedback.")
    finally:
        release_db(conn)


@router.get("/admin/feedback")
async def get_all_feedback(user=Depends(get_current_user)):
    if not ADMIN_EMAIL or user["email"] != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Forbidden")
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, user_name, user_email, rating, message,
                   lesson_id, lesson_title, page,
                   to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
            FROM feedback
            ORDER BY created_at DESC
        """)
        rows = [dict(r) for r in cur.fetchall()]
        cur.close()
        return {"feedback": rows, "total": len(rows)}
    finally:
        release_db(conn)
