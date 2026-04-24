import time
from fastapi import HTTPException, Request

from .config import RATE_LIMIT, RATE_WINDOW, AUTH_RATE_LIMIT

_ai_store: dict = {}
_auth_store: dict = {}
_ai_last_prune: float = 0.0
_auth_last_prune: float = 0.0


def _prune_stale(store: dict, window_start: float) -> None:
    stale = [k for k, ts in store.items() if not any(t > window_start for t in ts)]
    for k in stale:
        del store[k]


def _check_rate(store: dict, limit: int, ip: str, detail: str) -> None:
    now = time.time()
    window_start = now - RATE_WINDOW
    timestamps = [t for t in store.get(ip, []) if t > window_start]
    if len(timestamps) >= limit:
        raise HTTPException(status_code=429, detail=detail)
    timestamps.append(now)
    store[ip] = timestamps


def ai_rate_limit(req: Request) -> None:
    global _ai_last_prune
    ip = req.client.host if req.client else "unknown"
    now = time.time()
    if now - _ai_last_prune >= RATE_WINDOW:
        _prune_stale(_ai_store, now - RATE_WINDOW)
        _ai_last_prune = now
    _check_rate(_ai_store, RATE_LIMIT, ip,
                "Too many requests. Please wait a minute before trying again.")


def auth_rate_limit(req: Request) -> None:
    global _auth_last_prune
    ip = req.client.host if req.client else "unknown"
    now = time.time()
    if now - _auth_last_prune >= RATE_WINDOW:
        _prune_stale(_auth_store, now - RATE_WINDOW)
        _auth_last_prune = now
    _check_rate(_auth_store, AUTH_RATE_LIMIT, ip,
                "Too many login attempts. Please wait a minute before trying again.")
