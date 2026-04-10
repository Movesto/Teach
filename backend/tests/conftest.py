"""
Shared fixtures for the backend test suite.

Strategy
--------
* A dedicated 'teach_test_db' database is created once per session so tests
  never touch the production database.
* The real schema (init-user-data-only.sql) is applied to the test DB so
  schema drift is caught immediately.
* Every test starts with a clean slate — users and all cascaded child rows
  are deleted before each function runs.
* AI-dependent helpers (ask_qwen, translate_text, _teacher_tts) are mocked
  so tests run offline and stay fast.

Important: env vars MUST be set before 'main' is imported because main.py
reads them at module level (get_db, _ensure_conversation_table, etc.).
"""

import os
from pathlib import Path
from unittest.mock import AsyncMock

import psycopg2
import pytest

# ── 1. Point the app at the test database ─────────────────────────────────
os.environ["DB_NAME"]        = "teach_test_db"
os.environ["DB_HOST"]        = os.environ.get("DB_HOST", "localhost")
os.environ["DB_USER"]        = os.environ.get("DB_USER", "teach_user")
os.environ["DB_PASSWORD"]    = os.environ.get("DB_PASSWORD", "teach_secure_pass_123")
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-pytest-32chars!!"

# ── 2. Create test DB + schema before importing main ──────────────────────
_INIT_SQL = (
    Path(__file__).parent.parent.parent
    / "services" / "database" / "init-user-data-only.sql"
)

# Stable guest UUID used by the app when no user is logged in
_GUEST_UUID = "00000000-0000-0000-0000-000000000001"


def _connect(database="teach_test_db"):
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        database=database,
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )


def _bootstrap_test_db():
    """Create teach_test_db and apply the schema (idempotent)."""
    # Create the database if it doesn't exist
    conn = _connect("postgres")
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = 'teach_test_db'")
    if not cur.fetchone():
        cur.execute("CREATE DATABASE teach_test_db")
    cur.close()
    conn.close()

    # Patch SQL for test environment:
    # - Make all CREATE TABLE idempotent (add IF NOT EXISTS where missing)
    # - Use gen_random_uuid() (built-in PG 13+) instead of uuid_generate_v4()
    #   so the uuid-ossp extension is not required in the test DB.
    import re
    sql = _INIT_SQL.read_text()
    # Only add IF NOT EXISTS where it isn't already present
    sql = re.sub(
        r'\bCREATE TABLE\b(?!\s+IF\s+NOT\s+EXISTS)',
        'CREATE TABLE IF NOT EXISTS',
        sql,
        flags=re.IGNORECASE,
    )
    sql = sql.replace("uuid_generate_v4()", "gen_random_uuid()")

    conn = _connect()
    conn.autocommit = True
    cur = conn.cursor()
    for stmt in sql.split(";"):
        stmt = stmt.strip()
        # Strip leading comment lines so a DDL block prefixed by "--" comments
        # isn't mistakenly skipped entirely.
        code_lines = [l for l in stmt.splitlines() if not l.strip().startswith("--")]
        code = "\n".join(code_lines).strip()
        if code:
            try:
                cur.execute(code)
            except Exception:
                pass  # skip "already exists" and other ignorable errors
    cur.close()
    conn.close()


_bootstrap_test_db()

# ── 3. Now it is safe to import main ──────────────────────────────────────
import main  # noqa: E402
from main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


# ── 4. Session-scoped test client ─────────────────────────────────────────
@pytest.fixture(scope="session")
def client():
    """A single TestClient for the whole session (lifespan runs once)."""
    with TestClient(app) as c:
        yield c


# ── 5. Per-test table cleanup ─────────────────────────────────────────────
_TABLES_TO_CLEAN = [
    "conversation_sessions",
    "unit_test_results",
    "user_chapter_progress",
    "placement_results",
    "user_lessons",
    "quiz_attempts",
    "user_vocabulary",
    "users",
]


@pytest.fixture(autouse=True)
def clean_db():
    """Reset rate-limit counters and user tables before every test."""
    # Clear in-memory rate limit stores so auth tests don't bleed into each other
    main._rate_limit_store.clear()
    main._auth_rate_store.clear()

    conn = _connect()
    conn.autocommit = True
    cur = conn.cursor()
    for table in _TABLES_TO_CLEAN:
        try:
            cur.execute(f"DELETE FROM {table}")
        except Exception:
            pass  # table may not exist (e.g. conversation_sessions before first run)

    # Re-seed the guest user so quiz-submit tests work (FK constraint on user_lessons)
    try:
        cur.execute(
            """
            INSERT INTO users (id, name, email, password_hash)
            VALUES (%s, 'Guest', 'guest@system.internal', 'none')
            ON CONFLICT DO NOTHING
            """,
            (_GUEST_UUID,),
        )
    except Exception:
        pass

    cur.close()
    conn.close()
    yield


# ── 6. Mocks for external AI services ────────────────────────────────────
@pytest.fixture
def mock_ai(monkeypatch):
    """Patch ask_qwen and translate_text so no real AI calls are made."""
    monkeypatch.setattr("main.ask_qwen", AsyncMock(return_value="Good job! Keep practising."))
    monkeypatch.setattr("main.translate_text", AsyncMock(side_effect=lambda text, _dir: text))
    monkeypatch.setattr("main._teacher_tts", AsyncMock(return_value="/audio/test.mp3"))
    yield


# ── 7. Convenience: registered + logged-in user ──────────────────────────
@pytest.fixture
def auth_headers(client):
    """Register a fresh test user and return its Bearer token headers."""
    resp = client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "testpass123",
    })
    assert resp.status_code == 200, resp.text
    token = resp.json()["token"]
    return {"Authorization": f"Bearer {token}"}
