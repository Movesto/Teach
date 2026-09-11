from alembic import op

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None

# Strict per-user LLM accounting + a plan flag for tiered limits.
# See docs/translation-model-decision.md (paid-tier section).
#
# users.plan     — 'free' (default) or 'paid'; drives the daily tutor limit.
# user_llm_usage — one aggregate row per (user, day, feature), incremented on every
#                  folded tutor call. Powers per-user daily limits and cost reports.


def upgrade():
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(10) NOT NULL DEFAULT 'free'")
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_llm_usage (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            day DATE NOT NULL,
            feature VARCHAR(20) NOT NULL DEFAULT 'tutor',
            requests INTEGER NOT NULL DEFAULT 0,
            prompt_tokens BIGINT NOT NULL DEFAULT 0,
            completion_tokens BIGINT NOT NULL DEFAULT 0,
            cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, day, feature)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_llm_usage_day ON user_llm_usage (day)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS user_llm_usage")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS plan")
