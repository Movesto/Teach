import asyncio
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core import ai_client, db
from core.config import (
    AUDIO_DIR, AUDIO_TEACHER_MAX_AGE_DAYS, BOOKS_DIR, QWEN_URL, QWEN_MODEL,
)

logger = logging.getLogger(__name__)


def _cleanup_teacher_audio() -> int:
    cutoff = time.time() - (AUDIO_TEACHER_MAX_AGE_DAYS * 86400)
    deleted = 0
    for f in AUDIO_DIR.glob("teacher_*.mp3"):
        if f.stat().st_mtime < cutoff:
            f.unlink(missing_ok=True)
            deleted += 1
    return deleted


async def _audio_cleanup_loop() -> None:
    while True:
        await asyncio.sleep(86400)
        try:
            deleted = _cleanup_teacher_audio()
            if deleted:
                logger.info("Audio cleanup: removed %d teacher audio file(s) older than %d days",
                            deleted, AUDIO_TEACHER_MAX_AGE_DAYS)
        except Exception as e:
            logger.error("Audio cleanup error: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ai_client.init_client()
    db.init_pool()
    AUDIO_DIR.mkdir(exist_ok=True)

    try:
        from otel import setup_telemetry
        setup_telemetry(app)
    except Exception as err:
        logger.warning("Telemetry setup skipped: %s", err)

    try:
        await ai_client.get_client().post(
            QWEN_URL,
            json={"model": QWEN_MODEL, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1},
        )
        logger.info("Qwen warm-up complete.")
    except Exception as e:
        logger.warning("Qwen warm-up skipped: %s", e)

    deleted = _cleanup_teacher_audio()
    if deleted:
        logger.info("Audio cleanup: removed %d teacher audio file(s) on startup", deleted)
    cleanup_task = asyncio.create_task(_audio_cleanup_loop())

    yield

    cleanup_task.cancel()
    await ai_client.close_client()
    db.close_pool()


app = FastAPI(lifespan=lifespan)

_cors_origins = ["http://localhost:3000"]
for _origin in os.environ.get("FRONTEND_URL", "").split(","):
    _o = _origin.strip()
    if _o:
        _cors_origins.append(_o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/books", StaticFiles(directory=str(BOOKS_DIR)), name="books")
app.mount("/audio", StaticFiles(directory=str(AUDIO_DIR)), name="audio")

sys.path.insert(0, str(Path(__file__).parent.parent))
try:
    from services.placement_test.placement_routes import router as placement_router
    app.include_router(placement_router)
except Exception as _e:
    logging.warning("Could not load placement router: %s", _e)

from routers.auth import auth_router, placement_router as auth_placement_router
from routers.lessons import router as lessons_router
from routers.vocabulary import router as vocabulary_router
from routers.translate import router as translate_router
from routers.tts import router as tts_router
from routers.assessment import router as assessment_router
from routers.books import router as books_router
from routers.progress import router as progress_router
from routers.conversation import router as conversation_router

app.include_router(auth_router)
app.include_router(auth_placement_router)
app.include_router(lessons_router)
app.include_router(vocabulary_router)
app.include_router(translate_router)
app.include_router(tts_router)
app.include_router(assessment_router)
app.include_router(books_router)
app.include_router(progress_router)
app.include_router(conversation_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
