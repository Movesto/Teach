import os
import re
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
from enum import Enum

from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_DAYS
from .db import get_db, release_db

logger = logging.getLogger(__name__)

try:
    from jose import jwt, JWTError
    import bcrypt as _bcrypt
    _AUTH_AVAILABLE = True
except ImportError:
    _AUTH_AVAILABLE = False
    JWTError = Exception  # type: ignore[misc,assignment]
    logging.warning("python-jose or bcrypt not installed — auth endpoints disabled.")

http_bearer = HTTPBearer(auto_error=False)

COOKIE_NAME = "auth_token"
_IS_PRODUCTION = os.environ.get("ENVIRONMENT") == "production"


class CEFRLevel(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        if len(v) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email address")
        if len(v) > 254:
            raise ValueError("Email address is too long")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password must be 128 characters or fewer")
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r'[0-9!@#$%^&*()\-_=+\[\]{};:\'",.<>/?\\|`~]', v):
            raise ValueError("Password must contain at least one number or special character")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


class PlacementSaveRequest(BaseModel):
    score: int = Field(..., ge=0)
    percentage: float = Field(..., ge=0.0, le=100.0)
    level: str = Field(..., max_length=50)
    cefr: CEFRLevel
    recommended_unit: int = Field(..., ge=1, le=20)
    breakdown: dict = Field(default_factory=dict)


def hash_password(p: str) -> str:
    if not _AUTH_AVAILABLE:
        return p
    return _bcrypt.hashpw(p.encode("utf-8")[:72], _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not _AUTH_AVAILABLE:
        return plain == hashed
    return _bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))


def create_access_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM) if _AUTH_AVAILABLE else ""


def set_auth_cookie(response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=_IS_PRODUCTION,
        max_age=ACCESS_TOKEN_EXPIRE_DAYS * 86400,
    )


def clear_auth_cookie(response) -> None:
    response.delete_cookie(key=COOKIE_NAME, samesite="lax", secure=_IS_PRODUCTION)


def _decode_token(raw: str) -> str | None:
    try:
        payload = jwt.decode(raw, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    auth_token: Annotated[str | None, Cookie()] = None,
) -> dict:
    if not _AUTH_AVAILABLE:
        raise HTTPException(status_code=501, detail="Auth not configured")
    raw = auth_token or (credentials.credentials if credentials else None)
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")
    conn = None
    try:
        user_id = _decode_token(raw)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, email, placement_done, cefr_level, recommended_unit FROM users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        cur.close()
        if not row:
            raise HTTPException(status_code=401, detail="User not found")
        return dict(row)
    except HTTPException:
        raise
    finally:
        release_db(conn)


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(http_bearer)],
    auth_token: Annotated[str | None, Cookie()] = None,
):
    if not _AUTH_AVAILABLE:
        return None
    raw = auth_token or (credentials.credentials if credentials else None)
    if not raw:
        return None
    try:
        payload = jwt.decode(raw, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        return {"id": user_id} if user_id else None
    except Exception:
        return None
