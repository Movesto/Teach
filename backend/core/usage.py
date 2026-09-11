"""Strict per-user LLM accounting for the folded tutor (chat + explain).

One aggregate row per (user, day, feature) in user_llm_usage, incremented on every
call. Powers the per-user daily tier limits and cost reporting. Writes and reads are
best-effort: an accounting failure must never take the tutor down, so callers get
safe defaults on error.
"""
import datetime
import logging

from core.config import TUTOR_FREE_DAILY_LIMIT, TUTOR_PAID_DAILY_LIMIT
from core.db import get_db, release_db

logger = logging.getLogger(__name__)


def daily_limit_for(plan: str | None) -> int:
    return TUTOR_PAID_DAILY_LIMIT if plan == "paid" else TUTOR_FREE_DAILY_LIMIT


def record_usage(user_id, feature, model, prompt_tokens, completion_tokens, cost_usd) -> None:
    """Increment today's usage row for (user, feature). Best-effort."""
    if not user_id:
        return
    conn = None
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO user_llm_usage
                       (user_id, day, feature, requests, prompt_tokens, completion_tokens, cost_usd)
                   VALUES (%s, CURRENT_DATE, %s, 1, %s, %s, %s)
                   ON CONFLICT (user_id, day, feature) DO UPDATE SET
                       requests = user_llm_usage.requests + 1,
                       prompt_tokens = user_llm_usage.prompt_tokens + EXCLUDED.prompt_tokens,
                       completion_tokens = user_llm_usage.completion_tokens + EXCLUDED.completion_tokens,
                       cost_usd = user_llm_usage.cost_usd + EXCLUDED.cost_usd""",
                (user_id, feature, int(prompt_tokens or 0), int(completion_tokens or 0), float(cost_usd or 0)),
            )
        conn.commit()
    except Exception as e:
        logger.warning("[usage] record failed: %s", e)
    finally:
        release_db(conn)


def tutor_requests_today(user_id, feature: str = "tutor") -> int:
    """How many tutor turns this user has used today (0 on any error)."""
    if not user_id:
        return 0
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT COALESCE(SUM(requests), 0) AS n FROM user_llm_usage "
            "WHERE user_id = %s AND day = CURRENT_DATE AND feature = %s",
            (user_id, feature),
        )
        n = cur.fetchone()["n"]
        cur.close()
        return int(n)
    except Exception as e:
        logger.warning("[usage] read failed: %s", e)
        return 0
    finally:
        release_db(conn)


def usage_summary(user_id, plan: str | None) -> dict:
    """Today's tutor count + limit + remaining, and this month's cost — for /me."""
    used = tutor_requests_today(user_id)
    limit = daily_limit_for(plan)
    month_cost = 0.0
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT COALESCE(SUM(cost_usd), 0) AS c FROM user_llm_usage "
            "WHERE user_id = %s AND day >= date_trunc('month', CURRENT_DATE)",
            (user_id,),
        )
        month_cost = float(cur.fetchone()["c"])
        cur.close()
    except Exception as e:
        logger.warning("[usage] summary failed: %s", e)
    finally:
        release_db(conn)
    return {
        "tutor_used_today": used,
        "tutor_daily_limit": limit,
        "tutor_remaining_today": max(0, limit - used),
        "month_cost_usd": round(month_cost, 4),
    }
