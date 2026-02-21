"""Add user plan fields, composite indexes, and full_name column.

Revision ID: 001
Revises: None
Create Date: 2026-02-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # User plan fields (idempotent: skip if column/index already exists)
    for col_name, col_def in [
        ("full_name", sa.Column("full_name", sa.String(), nullable=True)),
        ("plan", sa.Column("plan", sa.String(), server_default="free", nullable=True)),
        ("stripe_customer_id", sa.Column("stripe_customer_id", sa.String(), nullable=True)),
        ("stripe_subscription_id", sa.Column("stripe_subscription_id", sa.String(), nullable=True)),
        ("plan_expires_at", sa.Column("plan_expires_at", sa.DateTime(), nullable=True)),
    ]:
        try:
            op.add_column("users", col_def)
        except Exception:
            pass
    try:
        op.create_index("ix_users_stripe_customer_id", "users", ["stripe_customer_id"], unique=True)
    except Exception:
        pass

    # WatchlistCompany compliance fields (idempotent for existing DBs)
    for col_name, col_type, default in [
        ("risk_level", sa.String(), None),
        ("risk_score", sa.Integer(), None),
        ("art_69b_status", sa.String(), None),
        ("art_69_categories", sa.JSON(), None),
        ("art_69_bis_found", sa.Boolean(), False),
        ("art_49_bis_found", sa.Boolean(), False),
        ("last_screened_at", sa.DateTime(), None),
    ]:
        try:
            op.add_column("watchlist_companies", sa.Column(col_name, col_type, server_default=str(default) if default is not None else None, nullable=True))
        except Exception:
            pass

    # PublicNotice last_seen_at
    try:
        op.add_column("public_notices", sa.Column("last_seen_at", sa.DateTime(), nullable=True))
    except Exception:
        pass

    # Performance indexes (wrapped in try/except for idempotency)
    for idx_name, table, cols in [
        ("ix_wc_watchlist_rfc", "watchlist_companies", ["watchlist_id", "rfc"]),
        ("ix_pn_rfc_article", "public_notices", ["rfc", "article_type"]),
        ("ix_cn_rfc_published", "company_news", ["rfc", "published_at"]),
    ]:
        try:
            op.create_index(idx_name, table, cols)
        except Exception:
            pass


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
