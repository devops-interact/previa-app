"""Production hardening: add FK indexes, unique constraint, cleanup demo users.

Revision ID: 002
Revises: 001
Create Date: 2026-02-21
"""

from alembic import op
from sqlalchemy import text

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    indexes = [
        "CREATE INDEX IF NOT EXISTS ix_organizations_user_id ON organizations (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_watchlists_organization_id ON watchlists (organization_id)",
        "CREATE INDEX IF NOT EXISTS ix_scan_jobs_user_id ON scan_jobs (user_id)",
        "CREATE INDEX IF NOT EXISTS ix_entities_scan_job_id ON entities (scan_job_id)",
        "CREATE INDEX IF NOT EXISTS ix_screening_results_scan_job_id ON screening_results (scan_job_id)",
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_result_id ON audit_logs (result_id)",
    ]
    for stmt in indexes:
        conn.execute(text(stmt))

    conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_wc_unique_watchlist_rfc "
        "ON watchlist_companies (watchlist_id, rfc)"
    ))

    conn.execute(text(
        "DELETE FROM users WHERE email = 'user@example.com'"
    ))


def downgrade() -> None:
    pass
