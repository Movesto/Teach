from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import psycopg2
from psycopg2.extras import RealDictCursor
import httpx
import json
import os
import re
import sys
import time
import random
from pathlib import Path
from datetime import datetime, timedelta
from pydantic import BaseModel

try:
    from jose import JWTError, jwt
    from passlib.context import CryptContext
    _AUTH_AVAILABLE = True
except ImportError:
    _AUTH_AVAILABLE = False
    print("Warning: python-jose or passlib not installed. Auth endpoints disabled. Run: pip install python-jose[cryptography] passlib[bcrypt]")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Placement router is included after config block (see below)

# --- Config ---
NLLB_URL = "http://localhost:8001/translate"
QWEN_URL = "http://localhost:8010/v1/chat/completions"
QWEN_MODEL = "Qwen/Qwen2.5-7B-Instruct-AWQ"
PRONUNCIATION_URL = "http://localhost:5002"
BOOKS_DIR = Path(__file__).parent / "books"

# --- Auth config ---
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-in-prod-32chars!!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

if _AUTH_AVAILABLE:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer(auto_error=False)


# --- Auth Pydantic models ---
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


# --- Auth helper functions ---
def hash_password(p: str) -> str:
    return pwd_context.hash(p) if _AUTH_AVAILABLE else p


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed) if _AUTH_AVAILABLE else plain == hashed


def create_access_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM) if _AUTH_AVAILABLE else ""


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not _AUTH_AVAILABLE:
        raise HTTPException(status_code=501, detail="Auth not configured")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, email, placement_done, cefr_level, recommended_unit FROM users WHERE id = %s",
            (user_id,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=401, detail="User not found")
        return dict(row)
    except (JWTError, Exception) as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(http_bearer)):
    if not credentials or not _AUTH_AVAILABLE:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        return {"id": user_id} if user_id else None
    except Exception:
        return None


# Serve PDFs and other book assets as static files at /books/pdf/...
app.mount("/books", StaticFiles(directory=str(BOOKS_DIR)), name="books")

# Register placement test router
sys.path.insert(0, str(Path(__file__).parent.parent))
try:
    from services.placement_test.placement_routes import router as placement_router
    app.include_router(placement_router)
except Exception as _e:
    print(f"Warning: could not load placement router: {_e}")

QWEN_SYSTEM_PROMPT = (
    "You are a kind English tutor for a Somali beginner. "
    "Answer in 3 to 5 short plain sentences. "
    "Use very simple words. No lists. No bullet points. No bold. No headings. No markdown. "
    "Just plain short sentences a child could read. "
    "Write only in English. A translation system will convert your words to Somali. "
    "Talk to the student directly using 'you'. Be friendly and encouraging.\n\n"
    "IMPORTANT: When you show an English word or phrase you are teaching the student, "
    "wrap it in double curly braces like {{hello}} or {{I was born in London}}. "
    "These phrases will be kept in English while the rest is translated to Somali. "
    "Always use {{}} around English words you want the student to see in English."
)

WRITING_ASSESSMENT_PROMPT = (
    "You are an English writing assessor for beginner to intermediate English learners. "
    "Assess the student's writing and respond ONLY in this exact format:\n"
    "SCORE: [0-100]\n"
    "FEEDBACK: [2-3 specific sentences about what they did well and what to improve]\n\n"
    "Scoring rubric:\n"
    "- Relevance (40 pts): Did the student address the actual prompt?\n"
    "- Content (35 pts): Is the content meaningful and correct?\n"
    "- Language (25 pts): Is English used correctly enough to communicate?\n\n"
    "IMPORTANT RULES — apply these before scoring:\n"
    "1. If the student's writing is copied or nearly copied from the prompt itself, score 0 and say so.\n"
    "2. If the writing is just a single sentence, a question, or fewer than 15 meaningful words, score below 30.\n"
    "3. If the writing is off-topic or completely irrelevant, score 0-20.\n"
    "Be encouraging but honest. Give specific, actionable feedback. "
    "Do not use markdown, bullet points, or any special formatting."
)


def strip_markdown(text: str) -> str:
    """Remove markdown formatting so NLLB gets clean plain text."""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)   # **bold**
    text = re.sub(r'\*(.+?)\*', r'\1', text)        # *italic*
    text = re.sub(r'#{1,4}\s*', '', text)            # ### headings
    text = re.sub(r'^\s*[-*]\s+', '', text, flags=re.MULTILINE)  # bullet lists
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE) # numbered lists
    text = re.sub(r'`(.+?)`', r'\1', text)           # `code`
    text = re.sub(r'\n{3,}', '\n\n', text)           # excess newlines
    return text.strip()


async def translate_preserving_english(text: str) -> str:
    """Translate English text to Somali, but keep {{marked}} English phrases intact.

    Qwen marks English teaching phrases with {{...}}.
    We split the text into parts, translate only the non-English parts,
    and reassemble with the English phrases quoted inline.
    """
    # Split text by {{...}} markers into alternating [text, english, text, english, ...]
    parts = re.split(r'\{\{(.+?)\}\}', text)

    if len(parts) == 1:
        # No markers — translate the whole thing
        return await translate_text(text, "eng_to_som")

    # parts[0], parts[2], parts[4]... are text to translate
    # parts[1], parts[3], parts[5]... are English phrases to keep
    result_parts = []
    for i, part in enumerate(parts):
        if i % 2 == 0:
            # Regular text — translate to Somali
            stripped = part.strip()
            if stripped:
                translated = await translate_text(stripped, "eng_to_som")
                result_parts.append(translated)
        else:
            # English phrase — keep as-is, quoted
            result_parts.append(f'"{part}"')

    return " ".join(result_parts)


def get_db():
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        database=os.environ.get("DB_NAME", "teach_db"),
        user=os.environ.get("DB_USER", "teach_user"),
        password=os.environ.get("DB_PASSWORD", "teach_secure_pass_123"),
        cursor_factory=RealDictCursor
    )


# --- Rate limiting (in-memory, per-IP, AI endpoints only) ---
_rate_limit_store: dict = {}
_RATE_LIMIT = 20        # max requests
_RATE_WINDOW = 60       # per seconds


def ai_rate_limit(req: Request):
    ip = req.client.host if req.client else "unknown"
    now = time.time()
    window_start = now - _RATE_WINDOW
    # Prune stale IPs to prevent unbounded memory growth
    stale = [k for k, ts in _rate_limit_store.items() if not any(t > window_start for t in ts)]
    for k in stale:
        del _rate_limit_store[k]
    timestamps = [t for t in _rate_limit_store.get(ip, []) if t > window_start]
    if len(timestamps) >= _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a minute before trying again.")
    timestamps.append(now)
    _rate_limit_store[ip] = timestamps


# --- Input sanitization ---
def sanitize_text(text: str, max_len: int = 5000) -> str:
    """Strip null bytes and non-printable control chars; truncate to max_len."""
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    return cleaned[:max_len]


# IMPORTANT: Lessons are in the backend folder
LESSONS_DIR = Path(__file__).parent  # This is the backend/ folder


def load_units():
    units_file = LESSONS_DIR / "units.json"
    with open(units_file, encoding='utf-8') as f:
        return json.load(f)


def load_book_library():
    with open(BOOKS_DIR / "book-library.json", encoding='utf-8') as f:
        return json.load(f)


def load_question_banks():
    with open(BOOKS_DIR / "question-banks.json", encoding='utf-8') as f:
        return json.load(f)


def _lesson_numeric_id(raw_id) -> int:
    """Extract a numeric ID from either an int (1) or string ('lesson-15')."""
    return int(re.sub(r"\D", "", str(raw_id)) or "0")


def normalize_lesson(data: dict) -> dict:
    """Normalise Unit-3+ lesson schema to the Unit-1 shape the frontend expects."""
    # description fallback
    if not data.get("description"):
        lvl = data.get("level", "")
        mins = data.get("estimated_time", "")
        data["description"] = (
            f"{lvl.capitalize()} level" + (f" · {mins} min" if mins else "")
        )

    # difficulty fallback
    if not data.get("difficulty"):
        data["difficulty"] = data.get("level", "beginner")

    # story_context — pass through as-is (already at root level if present)
    # No transformation needed; frontend reads data["story_context"] directly.

    # target_phrases → target_language
    if "target_phrases" in data and "target_language" not in data:
        data["target_language"] = {"phrases": data["target_phrases"]}

    # dialogue { lines } → story { dialogue }
    if "dialogue" in data and "story" not in data:
        d = data["dialogue"]
        data["story"] = {
            "title": d.get("title", ""),
            "context": d.get("context", ""),
            "dialogue": d.get("lines", []),
        }

    # pattern_drills → drills
    if "pattern_drills" in data and "drills" not in data:
        drills = []
        for pd in data["pattern_drills"]:
            examples = pd.get("examples", [])
            drills.append({
                "title": pd.get("focus", ""),
                "instruction": pd.get("pattern", ""),
                "your_turn": pd.get("your_turn", examples[-1] if examples else pd.get("pattern", "")),
                "repetitions": 1,
                "examples": examples,
                "prompts": pd.get("prompts", []),
            })
        data["drills"] = drills

    # listening_exercises → listening
    if "listening_exercises" in data and "listening" not in data:
        data["listening"] = data["listening_exercises"]

    # speaking_tasks → speaking
    if "speaking_tasks" in data and "speaking" not in data:
        data["speaking"] = [
            {
                "title": t.get("prompt", "")[:80],
                "instruction": t.get("prompt", ""),
                "example": t.get("example", ""),
                "sentence_starters": t.get("sentence_starters", []),
            }
            for t in data["speaking_tasks"]
        ]

    # writing_tasks → writing
    if "writing_tasks" in data and "writing" not in data:
        data["writing"] = [
            {
                "title": t.get("prompt", "")[:80],
                "instruction": t.get("prompt", ""),
                "example": t.get("example", ""),
                "rubric": t.get("rubric", []),
            }
            for t in data["writing_tasks"]
        ]

    # grammar_focus → grammar_discovery
    if "grammar_focus" in data and "grammar_discovery" not in data:
        data["grammar_discovery"] = {
            "sections": [
                {
                    "title": g.get("title", ""),
                    "examples": g.get("examples", []),
                    "explanation": g.get("explanation", ""),
                    "practice": g.get("practice", []),
                }
                for g in data["grammar_focus"]
            ]
        }

    # quiz: unwrap { questions } and normalise unsupported types
    if isinstance(data.get("quiz"), dict) and "questions" in data["quiz"]:
        normalised = []
        for q in data["quiz"]["questions"]:
            qt = q.get("type")
            if qt == "true-false":
                correct_bool = q.get("correct", True)
                normalised.append({
                    **q,
                    "type": "multiple-choice",
                    "options": ["True", "False"],
                    "correct": 0 if correct_bool else 1,
                })
            elif qt in ("fill-blank", "matching"):
                normalised.append({**q, "type": "open-ended"})
            else:
                normalised.append(q)
        data["quiz"] = normalised

    return data


# --- Helper: NLLB Translation ---
async def translate_text(text: str, direction: str) -> str:
    """Translate text via NLLB. direction is 'eng_to_som' or 'som_to_eng'."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                NLLB_URL,
                json={"text": text, "direction": direction},
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()["translation"]
    except Exception as e:
        print(f"NLLB translation error ({direction}): {e}")
        return ""


# --- Helper: Qwen AI ---
async def ask_qwen(messages: list, max_tokens: int = 300) -> str:
    """Send a chat completion request to Qwen and return the assistant reply."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                QWEN_URL,
                json={
                    "model": QWEN_MODEL,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                },
                timeout=60.0,
            )
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"]
            return strip_markdown(text)
    except Exception as e:
        print(f"Qwen error: {e}")
        return f"[AI explanation unavailable: {e}]"


# --- Auth endpoints ---

@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    if not _AUTH_AVAILABLE:
        raise HTTPException(status_code=501, detail="Auth libraries not installed")
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        hashed = hash_password(req.password)
        cur.execute(
            """INSERT INTO users (name, email, password_hash)
               VALUES (%s, %s, %s)
               RETURNING id, name, email, placement_done, cefr_level, recommended_unit""",
            (req.name.strip(), req.email.strip().lower(), hashed)
        )
        user = dict(cur.fetchone())
        conn.commit()
        cur.close()
        token = create_access_token({"sub": str(user["id"])})
        return {"token": token, "user": user}
    except Exception as e:
        if conn:
            conn.rollback()
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    if not _AUTH_AVAILABLE:
        raise HTTPException(status_code=501, detail="Auth libraries not installed")
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """SELECT id, name, email, password_hash, placement_done, cefr_level, recommended_unit
               FROM users WHERE email = %s""",
            (req.email.strip().lower(),)
        )
        row = cur.fetchone()
        cur.close()
        if not row or not verify_password(req.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        user_data = {k: v for k, v in dict(row).items() if k != "password_hash"}
        token = create_access_token({"sub": str(user_data["id"])})
        return {"token": token, "user": user_data}
    finally:
        if conn:
            conn.close()


@app.get("/api/auth/me")
async def get_me(user=Depends(get_current_user)):
    return user


@app.post("/api/placement/save")
async def save_placement(data: dict, user=Depends(get_current_user)):
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO placement_results
               (user_id, score, percentage, level, cefr, recommended_unit, breakdown)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (
                user["id"],
                data.get("score"),
                data.get("percentage"),
                data.get("level"),
                data.get("cefr"),
                data.get("recommended_unit"),
                json.dumps(data.get("breakdown", {})),
            )
        )
        cur.execute(
            "UPDATE users SET placement_done = TRUE, cefr_level = %s, recommended_unit = %s WHERE id = %s",
            (data.get("cefr"), data.get("recommended_unit"), user["id"])
        )
        conn.commit()
        cur.close()
        return {"success": True}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


# --- Existing endpoints ---

@app.get("/api/units")
async def get_units():
    units = load_units()

    for unit in units:
        unit_dir = LESSONS_DIR / f"unit-{unit['id']}"

        if unit_dir.exists():
            lessons = []
            for lesson_file in sorted(unit_dir.glob("lesson-*.json")):
                try:
                    with open(lesson_file, encoding='utf-8') as f:
                        lesson_data = json.load(f)
                except (json.JSONDecodeError, KeyError, UnicodeDecodeError) as e:
                    print(f"Skipping invalid lesson file {lesson_file}: {e}")
                    continue
                lessons.append({
                    "id": _lesson_numeric_id(lesson_data["id"]),
                    "lesson_number": lesson_data["lesson_number"],
                    "title": lesson_data["title"],
                    "description": lesson_data.get("description") or lesson_data.get("level", ""),
                    "difficulty": lesson_data.get("difficulty") or lesson_data.get("level", "beginner"),
                    "completed": False,
                    "score": None,
                    "locked": False
                })
            lessons.sort(key=lambda l: l["lesson_number"])
            unit["lessons"] = lessons
            unit["total_lessons"] = len(lessons)
            unit["completed_lessons"] = 0

    return units


@app.get("/api/lessons/{lesson_id}")
async def get_lesson(lesson_id: str):
    for unit_dir in LESSONS_DIR.glob("unit-*"):
        for lesson_file in unit_dir.glob("lesson-*.json"):
            try:
                with open(lesson_file, encoding='utf-8') as f:
                    lesson_data = json.load(f)
                if str(_lesson_numeric_id(lesson_data.get("id", ""))) == lesson_id:
                    return normalize_lesson(lesson_data)
            except (json.JSONDecodeError, KeyError, UnicodeDecodeError):
                continue

    raise HTTPException(status_code=404, detail="Lesson not found")


@app.post("/api/quiz/submit")
async def submit_quiz(request: dict, optional_user=Depends(get_optional_user)):
    user_id = optional_user["id"] if optional_user else "00000000-0000-0000-0000-000000000001"
    raw_lid = request.get("lesson_id")
    lesson_id = _lesson_numeric_id(raw_lid) if raw_lid is not None else None
    unit_id = request.get("unit_id", 1)
    score = request.get("score")

    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO user_lessons (user_id, lesson_id, unit_id, completed, score, completed_at)
            VALUES (%s, %s, %s, true, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, lesson_id)
            DO UPDATE SET score = EXCLUDED.score, completed_at = CURRENT_TIMESTAMP
        """, (user_id, lesson_id, unit_id, score))

        conn.commit()
        cur.close()
        return {"success": True, "score": score}
    except Exception as e:
        print(f"Database error: {e}")
        return {"success": False, "error": str(e)}
    finally:
        if conn:
            conn.close()


# --- Translation endpoint (handles both formats) ---

@app.post("/api/translate")
async def translate(request: dict):
    """Forward to NLLB service. Accepts either:
    - {text, direction}  (native NLLB format)
    - {text, source_lang, target_lang}  (frontend format, auto-mapped)
    """
    text = request.get("text", "")
    direction = request.get("direction")

    # Map source_lang/target_lang to direction if needed
    if not direction:
        source = request.get("source_lang", "")
        target = request.get("target_lang", "")
        if "eng" in source and "som" in target:
            direction = "eng_to_som"
        elif "som" in source and "eng" in target:
            direction = "som_to_eng"
        else:
            direction = "eng_to_som"  # default

    translation = await translate_text(text, direction)
    return {"translation": translation, "direction": direction}


@app.post("/api/pronunciation/assess")
async def pronunciation_assess(
    audio: UploadFile = File(...),
    language: str = Form("english"),
    expected_text: str = Form(...)
):
    try:
        audio_bytes = await audio.read()
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PRONUNCIATION_URL}/api/pronunciation/assess",
                files={"audio": (audio.filename or "recording.webm", audio_bytes, audio.content_type or "audio/webm")},
                data={"language": language, "expected_text": expected_text},
                timeout=30
            )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pronunciation assessment failed: {e}")


# --- Explain endpoint (Qwen-powered) ---

@app.post("/api/explain")
async def explain(request: dict, _=Depends(ai_rate_limit)):
    """Generate a context-aware English explanation via Qwen, then translate to Somali."""
    english = request.get("english", "")
    context = request.get("context", "")
    content_type = request.get("type", "phrase")

    # Build a context-specific prompt for Qwen
    # Brevity reminder is added to every prompt because Qwen 7B needs reinforcement
    brevity = "Remember: answer in 3 to 5 short plain sentences only. No lists. No formatting."

    if content_type == "question":
        user_prompt = (
            f'The student sees this quiz question: "{english}"\n'
            f"Context: {context}\n\n"
            f"Help them understand what the question is asking. Explain any hard words simply. "
            f"Give a small hint but not the answer. {brevity}"
        )
    elif content_type == "drill":
        user_prompt = (
            f'The student is practicing: "{english}"\n'
            f"Instructions: {context}\n\n"
            f"Explain what they need to do and show one example. {brevity}"
        )
    elif content_type == "lesson":
        user_prompt = (
            f'The student is learning about: "{english}"\n'
            f"Context: {context}\n\n"
            f"Explain the main idea simply. If there is a grammar pattern, show one example. {brevity}"
        )
    else:  # phrase or generic
        user_prompt = (
            f'The student wants to understand: "{english}"\n'
            f"Context: {context}\n\n"
            f"Tell them what it means and give one example sentence. {brevity}"
        )

    messages = [
        {"role": "system", "content": QWEN_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    # Get English explanation from Qwen (slightly longer for explanations)
    explanation_english = await ask_qwen(messages, max_tokens=400)

    # Translate to Somali, preserving {{English}} phrases inline
    explanation_combined = await translate_preserving_english(explanation_english)

    return {
        "explanation": explanation_combined,
        "explanation_english": explanation_english,
    }


# --- Chat endpoint (full round-trip translation) ---

@app.post("/api/chat")
async def chat(request: dict, _=Depends(ai_rate_limit)):
    """Chat with the AI tutor in Somali.

    Receives: {message (Somali), history[], lesson_context}
    Flow: Somali → NLLB → English → Qwen → English → NLLB → Somali
    """
    somali_message = request.get("message", "")
    history = request.get("history", [])
    lesson_context = request.get("lesson_context", "")

    # Step 1: Translate user's Somali message to English
    user_english = await translate_text(somali_message, "som_to_eng")

    # Step 2: Build Qwen conversation (all in English)
    qwen_messages = [{"role": "system", "content": QWEN_SYSTEM_PROMPT}]

    if lesson_context:
        qwen_messages.append({
            "role": "system",
            "content": f"The student is currently studying: {lesson_context}",
        })

    # Add conversation history (already in English from previous rounds)
    for msg in history:
        qwen_messages.append({
            "role": msg["role"],
            "content": msg["content_english"],
        })

    # Add current user message
    qwen_messages.append({"role": "user", "content": user_english})

    # Step 3: Get Qwen response in English (keep chat replies short)
    reply_english = await ask_qwen(qwen_messages, max_tokens=200)

    # Step 4: Translate to Somali, preserving {{English}} phrases inline
    reply_combined = await translate_preserving_english(reply_english)

    return {
        "reply": reply_combined,
        "reply_english": reply_english,
        "user_message_english": user_english,
    }


# --- Book endpoints ---

def _all_books(library: dict) -> list:
    """Return the flat books list regardless of nesting."""
    if "library" in library:
        return library["library"].get("books", [])
    return library.get("books", [])


@app.get("/api/books")
async def get_books(unit_id: int = None):
    library = load_book_library()
    books = _all_books(library)
    if unit_id is not None:
        books = [b for b in books if b.get("unit_id") == unit_id]
    return books


@app.get("/api/books/{book_id}")
async def get_book(book_id: str):
    library = load_book_library()
    book = next((b for b in _all_books(library) if b["id"] == book_id), None)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@app.get("/api/books/{book_id}/assignment/{student_id}")
async def get_book_assignment(book_id: str, student_id: str):
    banks = load_question_banks()
    bank = banks.get(book_id)
    if not bank:
        raise HTTPException(status_code=404, detail=f"No question bank for book '{book_id}'")
    questions = random.sample(bank["questions"], min(10, len(bank["questions"])))
    prompts = random.sample(bank["writing_prompts"], min(2, len(bank["writing_prompts"])))
    return {"book_id": book_id, "questions": questions, "writing_prompts": prompts}


@app.post("/api/books/submit")
async def submit_book_assignment(submission: dict):
    book_id = submission.get("book_id", "")
    comprehension_answers = submission.get("comprehension_answers", [])
    writing_submissions = submission.get("writing_submissions", [])

    banks = load_question_banks()
    bank = banks.get(book_id, {})
    question_map = {q["id"]: q for q in bank.get("questions", [])}
    prompt_map = {p["id"]: p for p in bank.get("writing_prompts", [])}

    correct = 0
    detailed = []
    for ans in comprehension_answers:
        q = question_map.get(ans.get("question_id"))
        if q and ans.get("answer") is not None:
            is_correct = ans["answer"] == q.get("correct")
            correct += 1 if is_correct else 0
            detailed.append({
                "question_id": ans["question_id"],
                "correct": is_correct,
                "difficulty": q.get("difficulty", "medium"),
            })

    total = len(comprehension_answers)
    score_pct = round((correct / total * 100) if total > 0 else 0)

    writing_results = []
    for sub in writing_submissions:
        p = prompt_map.get(sub.get("prompt_id"))
        wc = sub.get("word_count", 0)
        meets = bool(p and wc >= p.get("word_count_min", 0) and wc <= p.get("word_count_max", 99999))
        writing_results.append({
            "prompt_id": sub.get("prompt_id"),
            "word_count": wc,
            "meets_requirement": meets,
            "required_min": p.get("word_count_min") if p else None,
            "required_max": p.get("word_count_max") if p else None,
            "status": "meets_requirement" if meets else "needs_revision",
        })

    return {
        "comprehension": {
            "score": score_pct,
            "correct_answers": correct,
            "total_questions": total,
            "detailed_results": detailed,
        },
        "writing": {"submissions": writing_results},
    }


# --- Writing Assessment ---

def _similarity_ratio(a: str, b: str) -> float:
    """Return word-overlap ratio between two strings (0.0–1.0)."""
    a_words = set(a.lower().split())
    b_words = set(b.lower().split())
    if not a_words or not b_words:
        return 0.0
    overlap = len(a_words & b_words)
    return overlap / max(len(a_words), len(b_words))


async def _run_writing_assessment(writing_text: str, prompt_instruction: str, example: str = "", min_words: int = 20) -> dict:
    """Core writing assessment logic shared by the endpoint and chapter submit."""
    text = writing_text.strip()
    prompt_stripped = prompt_instruction.strip()

    # Fast pre-checks before calling the AI
    word_count = len(text.split())

    # 1. Empty or too short
    if word_count < 10:
        feedback = "Your response is too short. Please write at least a few sentences addressing the prompt."
        return {
            "score": 0, "passed": False,
            "feedback": feedback,
            "feedback_somali": await translate_preserving_english(feedback),
        }

    # 2. Student copied the prompt (>70% word overlap)
    similarity = _similarity_ratio(text, prompt_stripped)
    if similarity > 0.70:
        feedback = (
            "It looks like you copied the question instead of answering it. "
            "Please write your own original response to the prompt in your own words."
        )
        return {
            "score": 0, "passed": False,
            "feedback": feedback,
            "feedback_somali": await translate_preserving_english(feedback),
        }

    user_prompt = (
        f'Writing prompt given to student: "{prompt_instruction}"\n'
        + (f'Example answer: {example}\n' if example else "")
        + f'Student\'s writing:\n"{writing_text}"\n\n'
        f"Minimum words required: {min_words}\n"
        f"Assess the student's writing."
    )
    messages = [
        {"role": "system", "content": WRITING_ASSESSMENT_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    response = await ask_qwen(messages, max_tokens=200)

    score_match = re.search(r'SCORE:\s*(\d+)', response, re.IGNORECASE)
    feedback_match = re.search(r'FEEDBACK:\s*(.+)', response, re.DOTALL)

    score = int(score_match.group(1)) if score_match else 50
    score = max(0, min(100, score))
    feedback_english = feedback_match.group(1).strip() if feedback_match else response.strip()

    feedback_somali = await translate_preserving_english(feedback_english)
    return {
        "score": score,
        "passed": score >= 60,
        "feedback": feedback_english,
        "feedback_somali": feedback_somali,
    }


@app.post("/api/writing/assess")
async def assess_writing(request: dict, _=Depends(ai_rate_limit)):
    """AI-assess a student's writing submission. Returns score (0-100), passed flag, and feedback."""
    writing_text = sanitize_text(request.get("writing_text", ""))
    prompt_instruction = sanitize_text(request.get("prompt_instruction", ""), max_len=1000)
    example = sanitize_text(request.get("example", ""), max_len=500)
    min_words = request.get("min_words", 20)
    return await _run_writing_assessment(writing_text, prompt_instruction, example, min_words)


# --- Chapter endpoints ---

@app.get("/api/books/{book_id}/chapters")
async def get_book_chapters(book_id: str):
    banks = load_question_banks()
    bank = banks.get(book_id)
    if not bank:
        raise HTTPException(status_code=404, detail=f"No question bank for book '{book_id}'")
    return bank.get("chapters", [])


@app.get("/api/books/{book_id}/chapters/{chapter_id}/assignment/{student_id}")
async def get_chapter_assignment(book_id: str, chapter_id: str, student_id: str):
    banks = load_question_banks()
    bank = banks.get(book_id)
    if not bank:
        raise HTTPException(status_code=404, detail=f"No question bank for book '{book_id}'")
    chapter_questions = [q for q in bank.get("questions", []) if q.get("chapter_id") == chapter_id]
    chapter_prompts = [p for p in bank.get("writing_prompts", []) if p.get("chapter_id") == chapter_id]
    selected_questions = random.sample(chapter_questions, min(8, len(chapter_questions)))
    return {
        "chapter_id": chapter_id,
        "questions": selected_questions,
        "writing_prompts": chapter_prompts,
    }


@app.post("/api/books/chapters/submit")
async def submit_chapter_assignment(submission: dict):
    book_id = submission.get("book_id", "")
    comprehension_answers = submission.get("comprehension_answers", [])
    writing_submissions = submission.get("writing_submissions", [])

    banks = load_question_banks()
    bank = banks.get(book_id, {})
    question_map = {q["id"]: q for q in bank.get("questions", [])}
    prompt_map = {p["id"]: p for p in bank.get("writing_prompts", [])}

    # Score comprehension
    correct = 0
    detailed = []
    for ans in comprehension_answers:
        q = question_map.get(ans.get("question_id"))
        if q and ans.get("answer") is not None:
            is_correct = ans["answer"] == q.get("correct")
            correct += 1 if is_correct else 0
            detailed.append({
                "question_id": ans["question_id"],
                "correct": is_correct,
                "difficulty": q.get("difficulty", "medium"),
            })
    total = len(comprehension_answers)
    score_pct = round((correct / total * 100) if total > 0 else 0)

    # AI-assess writing
    writing_results = []
    for sub in writing_submissions:
        p = prompt_map.get(sub.get("prompt_id"))
        result = await _run_writing_assessment(
            writing_text=sub.get("writing_text", ""),
            prompt_instruction=p.get("prompt", "") if p else "",
            min_words=p.get("word_count_min", 40) if p else 40,
        )
        writing_results.append({"prompt_id": sub.get("prompt_id"), **result})

    return {"comprehension_score": score_pct, "writing": writing_results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
