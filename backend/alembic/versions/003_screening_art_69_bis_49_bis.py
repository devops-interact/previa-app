"""Add art_69_bis_found and art_49_bis_found to screening_results.

Revision ID: 003
Revises: 002
Create Date: 2026-02-21
"""

from alembic import op
from sqlalchemy import text

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text(
        "ALTER TABLE screening_results ADD COLUMN IF NOT EXISTS art_69_bis_found BOOLEAN DEFAULT FALSE"
    ))
    conn.execute(text(
        "ALTER TABLE screening_results ADD COLUMN IF NOT EXISTS art_49_bis_found BOOLEAN DEFAULT FALSE"
    ))


def downgrade() -> None:
    pass
