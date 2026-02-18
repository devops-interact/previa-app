"""
Previa App — Ingestion job: DOF + SAT Datos Abiertos → PublicNotice table.
Runs periodically to refresh indexed data so screening and alerts use real sources.

Dedup strategy: for each source ('dof', 'sat_datos_abiertos'), we delete all
existing rows from that source before inserting the fresh batch.  This prevents
unbounded table growth while keeping the data always up-to-date.
"""

import logging
from datetime import datetime

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import AsyncSessionLocal
from app.data.db.models import PublicNotice, SATDataset
from app.data.sources.dof_fetcher import DOFFetcher
from app.data.sources.sat_datos_abiertos_fetcher import SATDatosAbiertosFetcher

logger = logging.getLogger(__name__)


async def run_ingestion(sat_max_files: int = 10):
    """
    Fetch DOF and SAT Datos Abiertos, replace stale data in public_notices,
    and update SATDataset freshness.  Called at startup and by the scheduler.

    Args:
        sat_max_files: Maximum number of SAT Excel/CSV files to download.
                       Default 10 for startup; scheduler passes 30 for full coverage.
    """
    logger.info(
        "Starting public data ingestion (DOF + SAT Datos Abiertos, sat_max_files=%d)...",
        sat_max_files,
    )
    async with AsyncSessionLocal() as db:
        try:
            now = datetime.utcnow()

            # ── 1) DOF ────────────────────────────────────────────────────────
            dof_notices = await DOFFetcher.run(limit_notices=80)
            logger.info("DOF: %d notices fetched", len(dof_notices))
            await _replace_source(db, "dof", dof_notices, now)
            await _update_sat_dataset(db, "lista_69b")

            # ── 2) SAT Datos Abiertos (Excel/CSV files) ──────────────────────
            sat_notices = await SATDatosAbiertosFetcher.run(max_files=sat_max_files)
            logger.info("SAT Datos Abiertos: %d notices fetched", len(sat_notices))
            await _replace_source(db, "sat_datos_abiertos", sat_notices, now)
            sat_69b_count = sum(1 for n in sat_notices if n.get("article_type") == "art_69b")
            await _update_sat_dataset(db, "lista_69b", row_count=sat_69b_count)
            for ds_name in ("art69_creditos_firmes", "art69_no_localizados",
                            "art69_creditos_cancelados", "art69_sentencias"):
                await _update_sat_dataset(db, ds_name, row_count=len(sat_notices))

            await db.commit()
            logger.info("Public data ingestion completed — DOF: %d, SAT: %d",
                        len(dof_notices), len(sat_notices))
        except Exception as e:
            await db.rollback()
            logger.exception("Ingestion failed: %s", e)
            raise


async def _replace_source(db: AsyncSession, source: str, notices: list, now: datetime):
    """Delete all old rows for the given source and bulk-insert fresh ones."""
    await db.execute(delete(PublicNotice).where(PublicNotice.source == source))
    await db.flush()

    for n in notices:
        db.add(PublicNotice(
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
            indexed_at=now,
            last_seen_at=now,
            raw_snippet=n.get("raw_snippet"),
        ))
    await db.flush()


async def _update_sat_dataset(db: AsyncSession, dataset_name: str, row_count: int = 0):
    """Update SATDataset last_updated and row_count for freshness gating."""
    r = await db.execute(select(SATDataset).where(SATDataset.dataset_name == dataset_name))
    row = r.scalar_one_or_none()
    if row:
        row.last_updated = datetime.utcnow()
        if row_count > 0:
            row.row_count = row_count
    await db.flush()
