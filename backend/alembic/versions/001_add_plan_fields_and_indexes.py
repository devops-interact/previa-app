"""Add user plan fields, composite indexes, and full_name column.

Revision ID: 001
Revises: None
Create Date: 2026-02-17

Uses raw SQL with IF NOT EXISTS / IF EXISTS so migration is idempotent
and does not abort the transaction when columns already exist.
"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # User plan fields (IF NOT EXISTS — no-op when column exists, no transaction abort)
    for col_name, col_sql in [
        ("full_name", "ADD COLUMN IF NOT EXISTS full_name VARCHAR"),
        ("plan", "ADD COLUMN IF NOT EXISTS plan VARCHAR DEFAULT 'free'"),
        ("stripe_customer_id", "ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR"),
        ("stripe_subscription_id", "ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR"),
        ("plan_expires_at", "ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP"),
    ]:
        conn.execute(text(f"ALTER TABLE users {col_sql}"))

    conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_stripe_customer_id ON users (stripe_customer_id)"
    ))

    # WatchlistCompany compliance fields
    for col_name, col_sql in [
        ("risk_level", "ADD COLUMN IF NOT EXISTS risk_level VARCHAR"),
        ("risk_score", "ADD COLUMN IF NOT EXISTS risk_score INTEGER"),
        ("art_69b_status", "ADD COLUMN IF NOT EXISTS art_69b_status VARCHAR"),
        ("art_69_categories", "ADD COLUMN IF NOT EXISTS art_69_categories JSON"),
        ("art_69_bis_found", "ADD COLUMN IF NOT EXISTS art_69_bis_found BOOLEAN DEFAULT FALSE"),
        ("art_49_bis_found", "ADD COLUMN IF NOT EXISTS art_49_bis_found BOOLEAN DEFAULT FALSE"),
        ("last_screened_at", "ADD COLUMN IF NOT EXISTS last_screened_at TIMESTAMP"),
    ]:
        conn.execute(text(f"ALTER TABLE watchlist_companies {col_sql}"))

    conn.execute(text(
        "ALTER TABLE public_notices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP"
    ))

    # Performance indexes
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_wc_watchlist_rfc ON watchlist_companies (watchlist_id, rfc)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_pn_rfc_article ON public_notices (rfc, article_type)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_cn_rfc_published ON company_news (rfc, published_at)"
    ))


def downgrade() -> None:
    op.drop_index("ix_cn_rfc_published", table_name="company_news")
    op.drop_index("ix_pn_rfc_article", table_name="public_notices")
    op.drop_index("ix_wc_watchlist_rfc", table_name="watchlist_companies")
    op.drop_index("ix_users_stripe_customer_id", table_name="users")
    op.drop_column("users", "plan_expires_at")
    op.drop_column("users", "stripe_subscription_id")
    op.drop_column("users", "stripe_customer_id")
    op.drop_column("users", "plan")
    op.drop_column("users", "full_name")
