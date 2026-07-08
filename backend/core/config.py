import os
from pathlib import Path

NLLB_URL = os.environ.get("NLLB_URL", "http://localhost:8001/translate")
QWEN_URL = os.environ.get("QWEN_URL", "http://localhost:8010/v1/chat/completions")
QWEN_MODEL = "Qwen/Qwen2.5-3B-Instruct-AWQ"
PRONUNCIATION_URL = os.environ.get("PRONUNCIATION_URL", "http://localhost:5002")
KOKORO_URL = os.environ.get("KOKORO_URL", "http://kokoro-tts:8880")
KOKORO_VOICE = "bm_george"

BACKEND_DIR = Path(__file__).parent.parent
BOOKS_DIR = BACKEND_DIR / "books"
AUDIO_DIR = BACKEND_DIR / "audio"
LESSONS_DIR = BACKEND_DIR
UNIT_TESTS_DIR = BACKEND_DIR / "unit-tests"

# ── Curriculum support tiers ────────────────────────────────────────────────
# How much Somali scaffolding a unit shows, fading from bottom to top.
# See docs/curriculum-architecture.md. Single source of truth — read everywhere.
BILINGUAL_MAX_UNIT = 2        # units 1–2  → Somali + English
ENGLISH_FIRST_MAX_UNIT = 7    # units 3–7  → English, Somali help on demand
#                               units 8+   → immersion (English only)


def support_level_for_unit(unit_id: int) -> str:
    if unit_id <= BILINGUAL_MAX_UNIT:
        return "bilingual"
    if unit_id <= ENGLISH_FIRST_MAX_UNIT:
        return "english_first"
    return "immersion"

_dev_secrets = {"dev-secret-change-in-prod-32chars!!", "change_me_64_char_hex_secret", ""}
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
if SECRET_KEY in _dev_secrets:
    raise RuntimeError(
        "JWT_SECRET_KEY is not set or is using a placeholder. "
        "Generate one with: python3 -c \"import secrets; print(secrets.token_hex(32))\" "
        "and set it in your .env file."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

_db_password = os.environ.get("DB_PASSWORD", "")
if not _db_password:
    raise RuntimeError("DB_PASSWORD is not set. Set a password in your .env file.")
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "database": os.environ.get("DB_NAME", "teach_db"),
    "user": os.environ.get("DB_USER", "teach_user"),
    "password": _db_password,
}

TTS_VOICE_MAP = {
    "jenny": "en-US-JennyNeural",
    "guy":   "en-US-GuyNeural",
    "aria":  "en-US-AriaNeural",
}
TTS_VOICE_DEFAULT = "en-US-JennyNeural"
TEACHER_VOICE = "en-US-ChristopherNeural"

RATE_LIMIT = 20
RATE_WINDOW = 60
AUTH_RATE_LIMIT = 5

CONVERSATION_DAILY_LIMIT = 3600
SRS_INTERVALS = [1, 3, 7, 14, 30, 60]

AUDIO_TEACHER_MAX_AGE_DAYS = int(os.environ.get("AUDIO_TEACHER_MAX_AGE_DAYS", "7"))
