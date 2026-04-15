"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-13
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE,
            password_hash VARCHAR(255),
            name VARCHAR(100),
            preferred_language VARCHAR(10) DEFAULT 'so',
            level VARCHAR(20) DEFAULT 'beginner',
            recommended_unit INTEGER DEFAULT 1,
            cefr_level VARCHAR(10),
            placement_done BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS user_lessons (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            lesson_id INTEGER NOT NULL,
            unit_id INTEGER NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            score INTEGER,
            time_spent INTEGER,
            completed_at TIMESTAMP WITH TIME ZONE,
            UNIQUE(user_id, lesson_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            lesson_id INTEGER NOT NULL,
            answers JSONB,
            score INTEGER,
            attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS user_vocabulary (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            word VARCHAR(100) NOT NULL,
            lesson_id INTEGER,
            mastery_level INTEGER DEFAULT 0,
            last_reviewed TIMESTAMP WITH TIME ZONE,
            next_review TIMESTAMP WITH TIME ZONE,
            review_count INTEGER DEFAULT 0,
            UNIQUE(user_id, word)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS placement_results (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            score INTEGER,
            percentage FLOAT,
            level VARCHAR(20),
            cefr VARCHAR(10),
            recommended_unit INTEGER,
            breakdown JSONB,
            taken_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS user_chapter_progress (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            book_id VARCHAR(50) NOT NULL,
            chapter_id VARCHAR(50) NOT NULL,
            completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            quiz_score INTEGER,
            writing_passed BOOLEAN DEFAULT FALSE,
            UNIQUE(user_id, book_id, chapter_id)
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS unit_test_results (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            unit_id INTEGER NOT NULL,
            score INTEGER,
            percentage FLOAT,
            answers JSONB,
            taken_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, unit_id)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS unit_test_results")
    op.execute("DROP TABLE IF EXISTS user_chapter_progress")
    op.execute("DROP TABLE IF EXISTS placement_results")
    op.execute("DROP TABLE IF EXISTS user_vocabulary")
    op.execute("DROP TABLE IF EXISTS quiz_attempts")
    op.execute("DROP TABLE IF EXISTS user_lessons")
    op.execute("DROP TABLE IF EXISTS users")
