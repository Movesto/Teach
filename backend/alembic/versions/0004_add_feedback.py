from alembic import op

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE feedback (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            user_name   TEXT NOT NULL,
            user_email  TEXT NOT NULL,
            rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
            message     TEXT,
            lesson_id   INTEGER,
            lesson_title TEXT,
            page        TEXT NOT NULL DEFAULT 'general',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX idx_feedback_created_at ON feedback (created_at DESC)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS feedback")
