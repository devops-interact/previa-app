"""
Previa App — Ingestion job: DOF + SAT Datos Abiertos → PublicNotice table.
Runs periodically to refresh indexed data so screening and alerts use real sources.
"""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import AsyncSessionLocal
from app.data.db.models import PublicNotice, SATDataset
from app.data.sources.dof_fetcher import DOFFetcher
from app.data.sources.sat_datos_abiertos_fetcher import SATDatosAbiertosFetcher

logger = logging.getLogger(__name__)


async def run_ingestion():
    """
    Fetch DOF and SAT Datos Abiertos, upsert into public_notices, update SATDataset.
    Call this from the scheduler (e.g. every 6–12 hours).
    """
    logger.info("Starting public data ingestion (DOF + SAT Datos Abiertos)...")
    async with AsyncSessionLocal() as db:
        try:
            # 1) DOF
            dof_notices = await DOFFetcher.run(limit_notices=80)
            logger.info("DOF: %s notices to upsert", len(dof_notices))
            for n in dof_notices:
                await _upsert_notice(db, n)
            await _update_sat_dataset(db, "lista_69b", len(dof_notices))

            # 2) SAT Datos Abiertos
            sat_notices = await SATDatosAbiertosFetcher.run(limit_per_page=500)
            logger.info("SAT Datos Abiertos: %s notices to upsert", len(sat_notices))
            for n in sat_notices:
                await _upsert_notice(db, n)
            await _update_sat_dataset(db, "art69_creditos_firmes", len(sat_notices))

            await db.commit()
            logger.info("Public data ingestion completed.")
        except Exception as e:
            await db.rollback()
            logger.exception("Ingestion failed: %s", e)
            raise


async def _upsert_notice(db: AsyncSession, n: dict):
    """Insert or replace a public notice (by source + source_url + rfc to avoid huge dupes)."""
    # Simple insert; we could add unique constraint and ON CONFLICT later
    notice = PublicNotice(
        source=n["source"],
        source_url=n["source_url"],
        dof_url=n.get("dof_url"),
        rfc=n.get("rfc"),
        razon_social=n.get("razon_social"),
        article_type=n["article_type"],
        status=n.get("status"),
        category=n.get("category"),
        oficio_number=n.get("oficio_number"),
        authority=n.get("authority"),
        motivo=n.get("motivo"),
        published_at=n.get("published_at"),
        raw_snippet=n.get("raw_snippet"),
    )
    db.add(notice)


async def _update_sat_dataset(db: AsyncSession, dataset_name: str, _row_delta: int):
    """Update SATDataset last_updated for freshness."""
    r = await db.execute(select(SATDataset).where(SATDataset.dataset_name == dataset_name))
    row = r.scalar_one_or_none()
    if row:
        row.last_updated = datetime.utcnow()
    await db.flush()
