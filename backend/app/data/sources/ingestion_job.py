"""
Previa App — Ingestion job: DOF + SAT Datos Abiertos → PublicNotice table.
Daily SAT sweep runs in phased batches (e.g. 6:00, 6:30, 7:00, 7:30) so the agent
gets full document access without OOM; each batch uses safe file/row caps.
"""

import logging
from datetime import datetime

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import AsyncSessionLocal
from app.data.db.models import PublicNotice, SATDataset, SweepMetadata
from app.data.sources.dof_fetcher import DOFFetcher
from app.data.sources.sat_datos_abiertos_fetcher import SATDatosAbiertosFetcher

logger = logging.getLogger(__name__)

# Phased sweep: files per batch and rows per file (keeps memory safe per batch)
SAT_FILES_PER_BATCH = 15
SAT_MAX_ROWS_PER_FILE = 40_000


async def run_ingestion(
    sat_batch_index: int = 0,
    sat_max_files_per_batch: int = SAT_FILES_PER_BATCH,
    sat_max_rows_per_file: int = SAT_MAX_ROWS_PER_FILE,
):
    """
    Run one ingestion step. For daily phased sweep:
    - batch_index 0: run DOF, clear sat_datos_abiertos, ingest first SAT batch, set sweep metadata.
    - batch_index 1,2,3,...: ingest next SAT batch (append), update sweep metadata.
    """
    start_file_offset = sat_batch_index * sat_max_files_per_batch
    logger.info(
        "Ingestion batch %d: SAT offset=%d, max_files=%d, max_rows_per_file=%d",
        sat_batch_index,
        start_file_offset,
        sat_max_files_per_batch,
        sat_max_rows_per_file,
    )
    async with AsyncSessionLocal() as db:
        try:
            now = datetime.utcnow()

            if sat_batch_index == 0:
                # ── DOF (only on first batch of the day) ─────────────────────
                dof_notices = await DOFFetcher.run(limit_notices=80)
                logger.info("DOF: %d notices fetched", len(dof_notices))
                await _replace_source(db, "dof", dof_notices, now)
                await _update_sat_dataset(db, "lista_69b")
                # Clear SAT so we replace with batch 0
                await db.execute(delete(PublicNotice).where(PublicNotice.source == "sat_datos_abiertos"))
                await db.flush()

            # ── SAT batch ──────────────────────────────────────────────────
            sat_notices = await SATDatosAbiertosFetcher.run(
                max_files=sat_max_files_per_batch,
                max_rows_per_file=sat_max_rows_per_file,
                start_file_offset=start_file_offset,
            )
            batch_files = len({n.get("source_url") for n in sat_notices}) if sat_notices else 0
            if batch_files == 0 and sat_notices:
                batch_files = 1
            batch_rows = len(sat_notices)

            for n in sat_notices:
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

            if sat_batch_index == 0:
                sat_69b_count = sum(1 for n in sat_notices if n.get("article_type") == "art_69b")
                await _update_sat_dataset(db, "lista_69b", row_count=sat_69b_count)

            # ── Sweep metadata (for UI: last run, total files, total rows) ───
            await _upsert_sweep_metadata(db, now, batch_files, batch_rows, sat_batch_index)

            await db.commit()
            logger.info(
                "Ingestion batch %d completed — SAT: %d notices from ~%d files",
                sat_batch_index,
                batch_rows,
                batch_files,
            )
        except Exception as e:
            await db.rollback()
            logger.exception("Ingestion failed: %s", e)
            raise


async def _upsert_sweep_metadata(
    db: AsyncSession,
    completed_at: datetime,
    batch_files: int,
    batch_rows: int,
    batch_index: int,
):
    """Update the single sweep_metadata row (create if missing). Accumulate totals across batches."""
    r = await db.execute(select(SweepMetadata).limit(1))
    row = r.scalar_one_or_none()
    if batch_index == 0:
        if row:
            row.last_completed_at = completed_at
            row.total_files = batch_files
            row.total_rows = batch_rows
        else:
            db.add(SweepMetadata(
                last_completed_at=completed_at,
                total_files=batch_files,
                total_rows=batch_rows,
            ))
    else:
        if row:
            row.last_completed_at = completed_at
            row.total_files = (row.total_files or 0) + batch_files
            row.total_rows = (row.total_rows or 0) + batch_rows
        else:
            db.add(SweepMetadata(
                last_completed_at=completed_at,
                total_files=batch_files,
                total_rows=batch_rows,
            ))
    await db.flush()


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
