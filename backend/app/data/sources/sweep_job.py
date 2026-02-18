"""
Previa App — Watchlist Sweep Job
Re-screens every WatchlistCompany RFC against the PublicNotice table,
updates compliance fields on WatchlistCompany, and logs status changes.

Runs daily (or after each ingestion) via the scheduler.
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import AsyncSessionLocal
from app.data.db.models import WatchlistCompany, PublicNotice
from app.config.risk_rules import (
    Art69BStatus, Art69Category, calculate_risk_score, get_risk_level,
)

logger = logging.getLogger(__name__)


async def sweep_watchlist_companies():
    """
    For every unique RFC in watchlist_companies:
      1. Query PublicNotice for all article types
      2. Compute risk score
      3. Update compliance fields on all WatchlistCompany rows sharing that RFC
      4. Log changes (RFC went from CLEAR → CRITICAL, etc.)
    """
    logger.info("Starting watchlist compliance sweep...")
    async with AsyncSessionLocal() as db:
        try:
            rfc_result = await db.execute(
                select(distinct(WatchlistCompany.rfc))
            )
            rfcs = [row[0] for row in rfc_result.all() if row[0]]
            logger.info("Sweep: %d unique RFCs to check", len(rfcs))

            changes = 0
            now = datetime.utcnow()

            for rfc in rfcs:
                findings = await _screen_rfc_against_notices(db, rfc)
                updated = await _update_companies(db, rfc, findings, now)
                changes += updated

            await db.commit()
            logger.info("Sweep completed — %d company records updated across %d RFCs", changes, len(rfcs))
        except Exception as e:
            await db.rollback()
            logger.exception("Sweep failed: %s", e)
            raise


async def _screen_rfc_against_notices(db: AsyncSession, rfc: str) -> Dict:
    """Query PublicNotice for all article types and assemble findings dict."""
    rfc_upper = rfc.strip().upper()

    # Art. 69-B
    art_69b_status = Art69BStatus.NOT_FOUND
    r69b = await db.execute(
        select(PublicNotice)
        .where(PublicNotice.rfc == rfc_upper, PublicNotice.article_type == "art_69b")
        .order_by(PublicNotice.indexed_at.desc())
        .limit(1)
    )
    row_69b = r69b.scalar_one_or_none()
    if row_69b:
        raw = (row_69b.status or "").strip().lower()
        try:
            art_69b_status = Art69BStatus(raw) if raw else Art69BStatus.PRESUNTO
        except ValueError:
            art_69b_status = Art69BStatus.PRESUNTO

    # Art. 69 (multiple categories possible)
    art_69_cats: List[str] = []
    r69 = await db.execute(
        select(PublicNotice)
        .where(PublicNotice.rfc == rfc_upper, PublicNotice.article_type == "art_69")
    )
    for row in r69.scalars().all():
        cat_raw = (row.category or row.status or "").strip().lower()
        if cat_raw and cat_raw not in art_69_cats:
            art_69_cats.append(cat_raw)

    # Art. 69-B Bis
    r69bis = await db.execute(
        select(PublicNotice)
        .where(PublicNotice.rfc == rfc_upper, PublicNotice.article_type == "art_69_bis")
        .limit(1)
    )
    art_69_bis_found = r69bis.scalar_one_or_none() is not None

    # Art. 49 BIS
    r49 = await db.execute(
        select(PublicNotice)
        .where(PublicNotice.rfc == rfc_upper, PublicNotice.article_type == "art_49_bis")
        .limit(1)
    )
    art_49_bis_found = r49.scalar_one_or_none() is not None

    # Resolve Art. 69 category enums for risk calculation
    art_69_enums = []
    _CAT_MAP = {
        "credito_firme": Art69Category.CREDITO_FIRME,
        "no_localizado": Art69Category.NO_LOCALIZADO,
        "credito_cancelado": Art69Category.CREDITO_CANCELADO,
        "sentencia_condenatoria": Art69Category.SENTENCIA_CONDENATORIA,
    }
    for c in art_69_cats:
        if c in _CAT_MAP:
            art_69_enums.append(_CAT_MAP[c])

    risk_findings = {
        "art_69b_status": art_69b_status,
        "art_69_categories": art_69_enums,
        "cert_status": None,
    }
    risk_score, risk_level = calculate_risk_score(risk_findings)

    return {
        "risk_score": risk_score,
        "risk_level": risk_level.value,
        "art_69b_status": art_69b_status.value if art_69b_status != Art69BStatus.NOT_FOUND else None,
        "art_69_categories": art_69_cats or None,
        "art_69_bis_found": art_69_bis_found,
        "art_49_bis_found": art_49_bis_found,
    }


async def _update_companies(
    db: AsyncSession, rfc: str, findings: Dict, now: datetime
) -> int:
    """Update all WatchlistCompany rows matching this RFC and return how many changed."""
    result = await db.execute(
        select(WatchlistCompany).where(WatchlistCompany.rfc == rfc)
    )
    companies = result.scalars().all()
    changed = 0

    for c in companies:
        old_level = c.risk_level
        c.risk_score = findings["risk_score"]
        c.risk_level = findings["risk_level"]
        c.art_69b_status = findings["art_69b_status"]
        c.art_69_categories = findings["art_69_categories"]
        c.art_69_bis_found = findings["art_69_bis_found"]
        c.art_49_bis_found = findings["art_49_bis_found"]
        c.last_screened_at = now

        if old_level != findings["risk_level"]:
            logger.warning(
                "RFC %s risk changed: %s → %s (score=%d)",
                rfc, old_level or "NEW", findings["risk_level"], findings["risk_score"],
            )
            changed += 1

    await db.flush()
    return changed
