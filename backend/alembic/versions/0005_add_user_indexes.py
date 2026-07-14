from alembic import op

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None

# Most per-user tables already get a user_id-leading index from their UNIQUE
# constraints (user_lessons, user_vocabulary, user_chapter_progress,
# conversation_sessions, unit_test_results) — only these two are missing.


def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_vocabulary_due ON user_vocabulary (user_id, next_review)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_quiz_attempts_user_id")
    op.execute("DROP INDEX IF EXISTS idx_user_vocabulary_due")
