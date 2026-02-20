"""
Previa App — Scheduler
Uses PostgreSQL advisory locks to ensure only one replica runs scheduled jobs.
Falls back to always-run for SQLite (single-instance dev mode).
"""

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from app.config.settings import settings
from app.agent.tools.constitution import ConstitutionIngester
from app.data.sources.ingestion_job import run_ingestion
from app.data.sources.sweep_job import sweep_watchlist_companies
from app.data.sources.news_ingestion_job import run_news_ingestion

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

ADVISORY_LOCK_ID = 73891  # arbitrary unique int for the scheduler lock


async def _try_advisory_lock() -> bool:
    """Attempt to acquire a PostgreSQL advisory lock. Returns True if acquired."""
    if settings.sqlalchemy_database_url.startswith("sqlite"):
        return True
    from app.data.db.session import engine
    try:
        async with engine.connect() as conn:
            r = await conn.execute(text(f"SELECT pg_try_advisory_lock({ADVISORY_LOCK_ID})"))
            acquired = r.scalar()
            if acquired:
                await conn.commit()
            return bool(acquired)
    except Exception as e:
        logger.warning("Advisory lock check failed, proceeding anyway: %s", e)
        return True


async def _run_sat_batch(batch_index: int):
    await run_ingestion(sat_batch_index=batch_index)
    if batch_index == 3:
        await sweep_watchlist_companies()
        logger.info("Daily SAT sweep (4 batches) and watchlist sweep completed.")


async def _sat_batch_0(): await _run_sat_batch(0)
async def _sat_batch_1(): await _run_sat_batch(1)
async def _sat_batch_2(): await _run_sat_batch(2)
async def _sat_batch_3(): await _run_sat_batch(3)


async def _run_news_ingestion():
    await run_news_ingestion()


def start_scheduler():
    """Start the scheduler only if this replica acquires the advisory lock."""
    if scheduler.running:
        return

    import asyncio

    async def _start():
        acquired = await _try_advisory_lock()
        if not acquired:
            logger.info("Another replica holds the scheduler lock — skipping scheduler start.")
            return

        scheduler.add_job(
            ConstitutionIngester.process,
            CronTrigger(day_of_week='mon', hour=3, minute=0),
            id='update_constitution',
            replace_existing=True,
        )
        batch_jobs = [
            (_sat_batch_0, "daily_sat_batch_0", (6, 0)),
            (_sat_batch_1, "daily_sat_batch_1", (6, 30)),
            (_sat_batch_2, "daily_sat_batch_2", (7, 0)),
            (_sat_batch_3, "daily_sat_batch_3", (7, 30)),
        ]
        for fn, job_id, (hour, minute) in batch_jobs:
            scheduler.add_job(
                fn,
                CronTrigger(hour=hour, minute=minute),
                id=job_id,
                replace_existing=True,
                max_instances=1,
                misfire_grace_time=3600,
            )
        scheduler.add_job(
            _run_news_ingestion,
            CronTrigger(hour=8, minute=0),
            id='daily_news_ingestion',
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=3600,
        )
        scheduler.start()
        logger.info(
            "Scheduler started (advisory lock acquired). "
            "Jobs: constitution (Mon 3:00), SAT batches (6:00-7:30), news (8:00 UTC)."
        )

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(_start())
        else:
            loop.run_until_complete(_start())
    except RuntimeError:
        asyncio.run(_start())


async def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
    if not settings.sqlalchemy_database_url.startswith("sqlite"):
        from app.data.db.session import engine
        try:
            async with engine.connect() as conn:
                await conn.execute(text(f"SELECT pg_advisory_unlock({ADVISORY_LOCK_ID})"))
                await conn.commit()
        except Exception:
            pass
