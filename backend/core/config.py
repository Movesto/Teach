import os
from pathlib import Path

NLLB_URL = os.environ.get("NLLB_URL", "http://localhost:8001/translate")
QWEN_URL = os.environ.get("QWEN_URL", "http://localhost:8010/v1/chat/completions")
QWEN_MODEL = "Qwen/Qwen2.5-7B-Instruct-AWQ"
PRONUNCIATION_URL = os.environ.get("PRONUNCIATION_URL", "http://localhost:5002")
KOKORO_URL = os.environ.get("KOKORO_URL", "http://kokoro-tts:8880")
KOKORO_VOICE = "bm_george"

BACKEND_DIR = Path(__file__).parent.parent
BOOKS_DIR = BACKEND_DIR / "books"
AUDIO_DIR = BACKEND_DIR / "audio"
LESSONS_DIR = BACKEND_DIR
UNIT_TESTS_DIR = BACKEND_DIR / "unit-tests"

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
if _db_password in ("", "teach_secure_pass_123", "change_me_strong_password"):
    raise RuntimeError(
        "DB_PASSWORD is not set or is using a placeholder. Set a real password in your .env file."
    )
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
