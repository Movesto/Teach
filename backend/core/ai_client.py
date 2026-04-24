import re
import logging
import httpx
from fastapi import HTTPException

from .config import QWEN_URL, QWEN_MODEL, NLLB_URL

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
    try:
        resp = await _client.post(
            QWEN_URL,
            json={
                "model": QWEN_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.7,
            },
        )
        resp.raise_for_status()
        return strip_markdown(resp.json()["choices"][0]["message"]["content"])
    except Exception as e:
        logger.error("Qwen request failed: %s", e)
        raise HTTPException(
            status_code=503,
            detail="The AI tutor is temporarily unavailable. Please try again in a moment.",
        )


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
