import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse

from core.config import TTS_VOICE_MAP, TTS_VOICE_DEFAULT
from core.rate_limit import ai_rate_limit
from core.speech import synthesize

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["tts"])


@router.get("/tts")
async def text_to_speech(
    text: str = Query(..., max_length=500),
    voice: str = Query("jenny"),
    _=Depends(ai_rate_limit),
):
    voice_id = TTS_VOICE_MAP.get(voice, TTS_VOICE_DEFAULT)
    url = await synthesize(text, None, voice_id, prefix="tts")
    if not url:
        raise HTTPException(status_code=503, detail="Audio generation unavailable")
    return RedirectResponse(url)
