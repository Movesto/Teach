from alembic import op

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None

# Phase 7 daily engine: homework loop + AI writing-feedback rate limiting.
#
# user_homework — a lesson writing task the learner assigns to themselves, due
# "tomorrow", reviewed on return by self-checking against the model answer.
#
# writing_feedback_log — one row per AI writing-feedback request, used only to
# enforce the free 1/day quota (count today's rows for the user).


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_homework (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            lesson_id INTEGER,
            title TEXT,
            task TEXT NOT NULL,
            model_answer TEXT,
            min_words INTEGER DEFAULT 0,
            submission TEXT,
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            due_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 day'),
            completed_at TIMESTAMP WITH TIME ZONE
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_homework_user ON user_homework (user_id, completed_at)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS writing_feedback_log (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_writing_feedback_user ON writing_feedback_log (user_id, created_at)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS writing_feedback_log")
    op.execute("DROP TABLE IF EXISTS user_homework")
