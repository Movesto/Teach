import os
from pathlib import Path

NLLB_URL = os.environ.get("NLLB_URL", "http://localhost:8001/translate")
# The chat LLM ("brain"): any OpenAI-compatible chat/completions endpoint.
# Defaults to the local Qwen container; point QWEN_URL/QWEN_MODEL at a hosted
# provider (OpenRouter, Gemini's OpenAI-compat endpoint, Groq, …) to drop the GPU.
# LLM_API_KEY is sent as a Bearer token when set (hosted APIs need it; local Qwen
# does not). OPENROUTER_API_KEY is accepted as a fallback so the existing key works.
QWEN_URL = os.environ.get("QWEN_URL", "http://localhost:8010/v1/chat/completions")
QWEN_MODEL = os.environ.get("QWEN_MODEL", "Qwen/Qwen2.5-3B-Instruct-AWQ")
LLM_API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get("OPENROUTER_API_KEY", "")
# Comma-separated fallback models. On OpenRouter, if the primary QWEN_MODEL is
# rate-limited (429) it auto-tries these in order (OpenRouter's `models` routing),
# so a throttled free model doesn't take the tutor down. Ignored on non-OpenRouter
# endpoints (they don't accept a `models` array).
LLM_FALLBACK_MODELS = [m.strip() for m in os.environ.get("LLM_FALLBACK_MODELS", "").split(",") if m.strip()]

# ── Folded tutor translation (see docs/translation-model-decision.md) ─────────
# The in-lesson tutor (chat/explain) does understand-Somali + reply-in-Somali in a
# SINGLE model call — no NLLB round-trip. Primary is a cheap paid model for quality
# and reliability; on failure or once the daily spend cap is hit it falls back to a
# free model, then to the existing free chain (ask_qwen). This keeps the GPU free
# and, unlike separate translate calls, does not multiply the request count.
FOLDED_MODEL = os.environ.get("FOLDED_MODEL", "deepseek/deepseek-v4-flash-0731")
FOLDED_FALLBACK_MODEL = os.environ.get("FOLDED_FALLBACK_MODEL", "nex-agi/nex-n2.5-pro:free")
# Primary-model pricing (USD per 1M tokens) — used only to enforce the daily cap.
FOLDED_INPUT_PER_M = float(os.environ.get("FOLDED_INPUT_PER_M", "0.065"))
FOLDED_OUTPUT_PER_M = float(os.environ.get("FOLDED_OUTPUT_PER_M", "0.18"))
# Once the estimated spend on the primary model reaches this (USD/day), the tutor
# serves everyone from the free fallback for the rest of the day. 0 = never use paid.
LLM_DAILY_SPEND_CAP_USD = float(os.environ.get("LLM_DAILY_SPEND_CAP_USD", "5.0"))

PRONUNCIATION_URL = os.environ.get("PRONUNCIATION_URL", "http://localhost:5002")
KOKORO_URL = os.environ.get("KOKORO_URL", "http://kokoro-tts:8880")
KOKORO_VOICE = "bm_george"

BACKEND_DIR = Path(__file__).parent.parent
BOOKS_DIR = BACKEND_DIR / "books"
READERS_DIR = BACKEND_DIR / "readers"   # in-app graded readers (Phase 4)
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

# Email allowed to read /api/admin/feedback. No default: unset means no admin.
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")

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

# Accent variety for practice audio (Phase 7). "us" keeps the default Kokoro voice;
# every other accent is produced by a regional edge-tts voice (Kokoro is bypassed).
ACCENT_VOICES = {
    "us": "en-US-JennyNeural",
    "uk": "en-GB-SoniaNeural",
    "ke": "en-KE-AsiliaNeural",
    "ng": "en-NG-EzinneNeural",
    "tz": "en-TZ-ImaniNeural",
}

RATE_LIMIT = 20
RATE_WINDOW = 60
AUTH_RATE_LIMIT = 5

CONVERSATION_DAILY_LIMIT = 3600
SRS_INTERVALS = [1, 3, 7, 14, 30, 60]

AUDIO_TEACHER_MAX_AGE_DAYS = int(os.environ.get("AUDIO_TEACHER_MAX_AGE_DAYS", "7"))
