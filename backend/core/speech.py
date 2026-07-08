"""Shared text-to-speech: try Kokoro first, fall back to edge-tts, cache the result
under AUDIO_DIR. Returns a public "/audio/<file>.mp3" URL, or None if every engine
fails. Used by the conversation teacher voice and by lesson listening audio.
"""
import hashlib
import logging
import re
from typing import Optional

from core.config import AUDIO_DIR, KOKORO_URL
from core.ai_client import get_client

logger = logging.getLogger(__name__)


async def synthesize(text: str, kokoro_voice: str, edge_voice: str, prefix: str = "tts") -> Optional[str]:
    """Synthesize `text` to a cached mp3 and return its /audio URL (or None).

    Caching is keyed by (prefix, kokoro_voice, text), so identical requests reuse
    the file and audio is only generated on first access.
    """
    clean = re.sub(r"[^\x00-\x7F]+", " ", text or "").strip()
    if not clean:
        return None

    cache_key = hashlib.md5(f"{prefix}:{kokoro_voice}:{clean}".encode()).hexdigest()
    filename = f"{prefix}_{cache_key}.mp3"
    cache_file = AUDIO_DIR / filename
    url = f"/audio/{filename}"

    if cache_file.exists():
        return url

    client = get_client()
    try:
        resp = await client.post(
            f"{KOKORO_URL}/v1/audio/speech",
            json={"model": "kokoro", "input": clean, "voice": kokoro_voice, "response_format": "mp3"},
        )
        if resp.status_code == 200:
            cache_file.write_bytes(resp.content)
            return url
    except Exception as e:
        logger.warning("Kokoro TTS unavailable (%s), falling back to edge-tts", e)

    try:
        import edge_tts
        communicate = edge_tts.Communicate(clean, edge_voice, rate="-8%")
        await communicate.save(str(cache_file))
        return url
    except Exception as e:
        logger.error("edge-tts also failed: %s", e)
        return None
