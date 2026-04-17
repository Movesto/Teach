"""Add translation column to user_vocabulary

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-16
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE user_vocabulary
        ADD COLUMN IF NOT EXISTS translation VARCHAR(255) DEFAULT ''
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE user_vocabulary DROP COLUMN IF EXISTS translation")
