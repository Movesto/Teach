import hashlib
import logging
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from core.config import AUDIO_DIR, TTS_VOICE_MAP, TTS_VOICE_DEFAULT, PRONUNCIATION_URL
from core.rate_limit import ai_rate_limit
from core.ai_client import get_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["tts"])

PRONUNCIATION_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


@router.get("/tts")
async def text_to_speech(
    text: str = Query(..., max_length=500),
    voice: str = Query("jenny"),
    _=Depends(ai_rate_limit),
):
    try:
        import edge_tts
    except ImportError:
        raise HTTPException(status_code=501, detail="edge-tts not installed")

    voice_id = TTS_VOICE_MAP.get(voice, TTS_VOICE_DEFAULT)
    cache_key = hashlib.md5(f"{voice_id}:{text}".encode()).hexdigest()
    cache_file = AUDIO_DIR / f"tts_{cache_key}.mp3"

    if not cache_file.exists():
        communicate = edge_tts.Communicate(text, voice_id, rate="-5%")
        await communicate.save(str(cache_file))

    return FileResponse(
        str(cache_file),
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/pronunciation/assess")
async def pronunciation_assess(
    audio: UploadFile = File(...),
    language: str = Form("english"),
    expected_text: str = Form(...),
):
    audio_bytes = await audio.read(PRONUNCIATION_MAX_BYTES + 1)
    if len(audio_bytes) > PRONUNCIATION_MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file is too large (max {PRONUNCIATION_MAX_BYTES // (1024 * 1024)} MB).",
        )
    try:
        client = get_client()
        response = await client.post(
            f"{PRONUNCIATION_URL}/api/pronunciation/assess",
            files={"audio": (audio.filename or "recording.webm", audio_bytes, audio.content_type or "audio/webm")},
            data={"language": language, "expected_text": expected_text},
        )
        return response.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pronunciation assessment failed: {e}")
