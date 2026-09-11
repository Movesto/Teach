import datetime
import re
import logging
import httpx
from fastapi import HTTPException

from .config import (
    QWEN_URL, QWEN_MODEL, NLLB_URL, LLM_API_KEY, LLM_FALLBACK_MODELS,
    FOLDED_MODEL, FOLDED_FALLBACK_MODEL, FOLDED_INPUT_PER_M, FOLDED_OUTPUT_PER_M,
    LLM_DAILY_SPEND_CAP_USD,
)

logger = logging.getLogger(__name__)
_client: httpx.AsyncClient = None


def init_client() -> None:
    global _client
    _client = httpx.AsyncClient(timeout=60.0)


async def close_client() -> None:
    if _client:
        await _client.aclose()


def get_client() -> httpx.AsyncClient:
    return _client


def strip_markdown(text: str) -> str:
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'#{1,4}\s*', '', text)
    text = re.sub(r'^\s*[-*]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'`(.+?)`', r'\1', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def sanitize_text(text: str, max_len: int = 5000) -> str:
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)[:max_len]


def sanitize_user_message(text: str) -> str:
    return re.sub(r'\{\{|\}\}', '', text)


async def translate_text(text: str, direction: str) -> str:
    try:
        resp = await _client.post(NLLB_URL, json={"text": text, "direction": direction})
        resp.raise_for_status()
        return resp.json()["translation"]
    except Exception as e:
        logger.warning("NLLB translation error (%s): %s", direction, e)
        return text


async def ask_qwen(messages: list, max_tokens: int = 300) -> str:
    # Bearer auth only when a key is configured (hosted APIs need it; local Qwen doesn't).
    headers = {}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
        headers["X-Title"] = "Barashada Ingiriisiga"
    body = {
        "model": QWEN_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }
    if "openrouter.ai" in QWEN_URL:
        # The free OpenRouter models are reasoning models. Left unchecked, their
        # chain-of-thought consumes the whole max_tokens budget and `content` comes
        # back null. A chat reply doesn't need visible reasoning, so disable it.
        body["reasoning"] = {"enabled": False}
        # On a 429 for the primary model, fall through to these alternates.
        if LLM_FALLBACK_MODELS:
            body["models"] = [QWEN_MODEL, *LLM_FALLBACK_MODELS]
    try:
        resp = await _client.post(QWEN_URL, headers=headers, json=body)
        resp.raise_for_status()
        content = (resp.json()["choices"][0]["message"].get("content") or "").strip()
        if not content:
            raise ValueError("model returned empty content")
        return strip_markdown(content)
    except Exception as e:
        logger.error("Qwen request failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="The AI tutor is temporarily unavailable. Please try again in a moment.",
        )


# ── Folded tutor: one call does understand-Somali + reply-in-Somali ───────────
# Primary is a cheap paid model (quality + no free-tier 429s); on failure or once
# the daily spend cap is hit, fall back to a free model, then the free ask_qwen
# chain. A per-day in-process spend estimate enforces the cap (approximate: it
# resets on restart and is not shared across workers — a guardrail, not billing).
_spend = {"date": None, "usd": 0.0}


def _today() -> str:
    return datetime.date.today().isoformat()


def folded_spend_today() -> float:
    return _spend["usd"] if _spend["date"] == _today() else 0.0


def _add_spend(usd: float) -> None:
    if _spend["date"] != _today():
        _spend["date"] = _today()
        _spend["usd"] = 0.0
    _spend["usd"] += usd


async def _call_model(model: str, messages: list, max_tokens: int, temperature: float):
    """Single OpenAI-compatible call to one model. Returns (content, usage_dict).
    Raises on HTTP error or empty content so the caller can fall back."""
    headers = {}
    if LLM_API_KEY:
        headers["Authorization"] = f"Bearer {LLM_API_KEY}"
        headers["X-Title"] = "Barashada Ingiriisiga"
    body = {"model": model, "messages": messages,
            "max_tokens": max_tokens, "temperature": temperature}
    if "openrouter.ai" in QWEN_URL:
        body["reasoning"] = {"enabled": False}
    resp = await _client.post(QWEN_URL, headers=headers, json=body)
    resp.raise_for_status()
    data = resp.json()
    content = (data["choices"][0]["message"].get("content") or "").strip()
    if not content:
        raise ValueError("model returned empty content")
    return strip_markdown(content), (data.get("usage") or {})


async def ask_folded(messages: list, user_id=None, feature: str = "tutor",
                     max_tokens: int = 500, temperature: float = 0.5) -> str:
    """Ask the folded tutor: paid primary within the daily cap, else free fallback,
    else the existing free ask_qwen chain. Never raises for model failure alone.

    When `user_id` is given, the turn is recorded in the strict per-user accounting
    (core.usage) — requests always, plus tokens/cost when the paid model was used."""
    content = used_model = None
    usage: dict = {}
    cost = 0.0

    if LLM_DAILY_SPEND_CAP_USD > 0 and folded_spend_today() < LLM_DAILY_SPEND_CAP_USD:
        try:
            content, usage = await _call_model(FOLDED_MODEL, messages, max_tokens, temperature)
            cost = (usage.get("prompt_tokens", 0) * FOLDED_INPUT_PER_M
                    + usage.get("completion_tokens", 0) * FOLDED_OUTPUT_PER_M) / 1_000_000
            _add_spend(cost)
            used_model = FOLDED_MODEL
        except Exception as e:
            logger.warning("Folded primary (%s) failed, falling back: %s", FOLDED_MODEL, e)
    else:
        logger.info("Daily LLM spend cap reached (~$%.2f) — using free fallback", folded_spend_today())

    if content is None:
        try:
            content, usage = await _call_model(FOLDED_FALLBACK_MODEL, messages, max_tokens, temperature)
            used_model, cost = FOLDED_FALLBACK_MODEL, 0.0
        except Exception as e:
            logger.warning("Folded fallback (%s) failed, using ask_qwen chain: %s", FOLDED_FALLBACK_MODEL, e)

    if content is None:
        content = await ask_qwen(messages, max_tokens=max_tokens)
        used_model, usage, cost = QWEN_MODEL, {}, 0.0

    if user_id:
        # Imported lazily so core.usage (which imports the DB) isn't a hard
        # dependency of ai_client at module load.
        from core.usage import record_usage
        record_usage(user_id, feature, used_model,
                     usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), cost)
    return content


async def translate_preserving_english(text: str) -> str:
    parts = re.split(r'\{\{(.+?)\}\}', text)
    if len(parts) == 1:
        return await translate_text(text, "eng_to_som")
    result_parts = []
    for i, part in enumerate(parts):
        if i % 2 == 0:
            stripped = part.strip()
            if stripped:
                result_parts.append(await translate_text(stripped, "eng_to_som"))
        else:
            result_parts.append(f'"{part}"')
    return " ".join(result_parts)
