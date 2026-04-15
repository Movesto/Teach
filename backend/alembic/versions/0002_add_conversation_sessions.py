"""Add conversation_sessions table

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-14
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS conversation_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            date DATE NOT NULL DEFAULT CURRENT_DATE,
            total_seconds INTEGER DEFAULT 0,
            messages JSONB DEFAULT '[]',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, date)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS conversation_sessions")
