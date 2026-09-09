from alembic import op

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None

# Mistake notebook (Phase 7): wrong quiz answers auto-collected into a personal
# review deck. One row per distinct question the learner got wrong.


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_mistakes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            question TEXT NOT NULL,
            correct_answer TEXT,
            your_answer TEXT,
            source VARCHAR(30) DEFAULT 'quiz',
            lesson_id INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            reviewed_count INTEGER DEFAULT 0,
            mastered BOOLEAN DEFAULT FALSE,
            UNIQUE(user_id, question)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_user_mistakes_user ON user_mistakes (user_id, mastered)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS user_mistakes")
