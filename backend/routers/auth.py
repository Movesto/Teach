import logging
from fastapi import APIRouter, Depends, HTTPException, Response

from core.security import (
    RegisterRequest, LoginRequest, PlacementSaveRequest,
    hash_password, verify_password, create_access_token,
    get_current_user, set_auth_cookie, clear_auth_cookie,
    _AUTH_AVAILABLE,
)
from core.rate_limit import auth_rate_limit
from core.db import get_db, release_db

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
placement_router = APIRouter(prefix="/api/placement", tags=["placement"])


@auth_router.post("/register")
async def register(req: RegisterRequest, response: Response, _=Depends(auth_rate_limit)):
    if not _AUTH_AVAILABLE:
        raise HTTPException(status_code=501, detail="Auth libraries not installed")
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO users (name, email, password_hash)
               VALUES (%s, %s, %s)
               RETURNING id, name, email, placement_done, cefr_level, recommended_unit""",
            (req.name, req.email, hash_password(req.password)),
        )
        user = dict(cur.fetchone())
        conn.commit()
        cur.close()
        token = create_access_token({"sub": str(user["id"])})
        set_auth_cookie(response, token)
        return {"token": token, "user": user}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=400, detail="Email already registered")
        logger.error("Register error: %s", e)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
    finally:
        release_db(conn)


@auth_router.post("/login")
async def login(req: LoginRequest, response: Response, _=Depends(auth_rate_limit)):
    if not _AUTH_AVAILABLE:
        raise HTTPException(status_code=501, detail="Auth libraries not installed")
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """SELECT id, name, email, password_hash, placement_done, cefr_level, recommended_unit
               FROM users WHERE email = %s""",
            (req.email,),
        )
        row = cur.fetchone()
        cur.close()
        if not row or not verify_password(req.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        user_data = {k: v for k, v in dict(row).items() if k != "password_hash"}
        token = create_access_token({"sub": str(user_data["id"])})
        set_auth_cookie(response, token)
        return {"token": token, "user": user_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Login error: %s", e)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
    finally:
        release_db(conn)


@auth_router.post("/logout")
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"success": True}


@auth_router.get("/me")
async def get_me(user=Depends(get_current_user)):
    return user


@placement_router.post("/save")
async def save_placement(data: PlacementSaveRequest, user=Depends(get_current_user)):
    import json
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO placement_results
               (user_id, score, percentage, level, cefr, recommended_unit, breakdown)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (
                user["id"],
                data.score,
                data.percentage,
                data.level,
                data.cefr.value,
                data.recommended_unit,
                json.dumps(data.breakdown),
            ),
        )
        cur.execute(
            "UPDATE users SET placement_done = TRUE, cefr_level = %s, recommended_unit = %s WHERE id = %s",
            (data.cefr.value, data.recommended_unit, user["id"]),
        )
        conn.commit()
        cur.close()
        return {"success": True}
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error("Placement save error: %s", e)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")
    finally:
        release_db(conn)
