"""Shared text-to-speech: OpenRouter's free flux-tts first, fall back to edge-tts,
cache the result under AUDIO_DIR. Returns a public "/audio/<file>.mp3" URL, or None
if every engine fails. No local model / GPU. Used by the conversation teacher voice
and by lesson/practice listening audio.
"""
import hashlib
import logging
import re
from typing import Optional

from core.config import AUDIO_DIR, TTS_URL, TTS_MODEL, TTS_FLUX_VOICE, LLM_API_KEY
from core.ai_client import get_client

logger = logging.getLogger(__name__)


async def synthesize(text: str, kokoro_voice: str, edge_voice: str, prefix: str = "tts",
                     force_edge: bool = False) -> Optional[str]:
    """Synthesize `text` to a cached mp3 and return its /audio URL (or None).

    Primary engine is OpenRouter flux-tts (free, US English). Set `force_edge` to
    skip it and use edge-tts directly — needed for the regional accents flux can't
    produce (the cache key then uses `edge_voice` so each accent caches separately).
    `kokoro_voice` is accepted for call-site compatibility but no longer used.
    """
    clean = re.sub(r"[^\x00-\x7F]+", " ", text or "").strip()
    if not clean:
        return None

    voice_key = edge_voice if force_edge else TTS_FLUX_VOICE
    cache_key = hashlib.md5(f"{prefix}:{voice_key}:{clean}".encode()).hexdigest()
    filename = f"{prefix}_{cache_key}.mp3"
    cache_file = AUDIO_DIR / filename
    url = f"/audio/{filename}"

    if cache_file.exists():
        return url

    client = get_client()
    if not force_edge:
        # Primary: OpenRouter flux-tts (OpenAI-compatible /audio/speech, free).
        try:
            headers = {"Authorization": f"Bearer {LLM_API_KEY}"} if LLM_API_KEY else {}
            resp = await client.post(
                TTS_URL, headers=headers,
                json={"model": TTS_MODEL, "input": clean, "voice": TTS_FLUX_VOICE,
                      "response_format": "mp3"},
            )
            if resp.status_code == 200 and resp.content:
                cache_file.write_bytes(resp.content)
                return url
            logger.warning("flux-tts non-200 (%s): %s — falling back to edge-tts",
                           resp.status_code, resp.text[:200])
        except Exception as e:
            logger.warning("flux-tts unavailable (%s), falling back to edge-tts", e)

    # Fallback (or forced): edge-tts (keyless, supports regional accents).
    try:
        import edge_tts
        communicate = edge_tts.Communicate(clean, edge_voice, rate="-8%")
        await communicate.save(str(cache_file))
        return url
    except Exception as e:
        logger.error("edge-tts also failed: %s", e)
        return None
