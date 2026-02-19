import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.agent.tools.constitution import ConstitutionIngester
from app.data.sources.ingestion_job import run_ingestion
from app.data.sources.sweep_job import sweep_watchlist_companies
from app.data.sources.news_ingestion_job import run_news_ingestion

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# Phased SAT sweep: 4 batches at 6:00, 6:30, 7:00, 7:30 UTC; last batch runs sweep

async def _run_sat_batch(batch_index: int):
    """Run one SAT ingestion batch (0–3). Batch 3 also runs watchlist sweep."""
    await run_ingestion(sat_batch_index=batch_index)
    if batch_index == 3:
        await sweep_watchlist_companies()
        logger.info("Daily SAT sweep (4 batches) and watchlist sweep completed.")


async def _sat_batch_0(): await _run_sat_batch(0)
async def _sat_batch_1(): await _run_sat_batch(1)
async def _sat_batch_2(): await _run_sat_batch(2)
async def _sat_batch_3(): await _run_sat_batch(3)


async def _run_news_ingestion():
    """Index controversial news for watchlist companies (NewsAPI; no-op if key not set)."""
    await run_news_ingestion()


def start_scheduler():
    """Start the application scheduler."""
    if not scheduler.running:
        scheduler.add_job(
            ConstitutionIngester.process,
            CronTrigger(day_of_week='mon', hour=3, minute=0),
            id='update_constitution',
            replace_existing=True
        )
        # SAT daily sweep in 4 phases at 6:00, 6:30, 7:00, 7:30 UTC (full access, no OOM)
        batch_jobs = [(_sat_batch_0, "daily_sat_batch_0", (6, 0)), (_sat_batch_1, "daily_sat_batch_1", (6, 30)),
                      (_sat_batch_2, "daily_sat_batch_2", (7, 0)), (_sat_batch_3, "daily_sat_batch_3", (7, 30))]
        for fn, job_id, (hour, minute) in batch_jobs:
            scheduler.add_job(
                fn,
                CronTrigger(hour=hour, minute=minute),
                id=job_id,
                replace_existing=True,
                max_instances=1,
                misfire_grace_time=3600,
            )
        # Controversial news indexing for watchlist companies (8:00 UTC; no-op if NEWS_API_KEY unset)
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
            "Scheduler started. Jobs: update_constitution (Mon 3:00), "
            "daily_sat_batch_0..3 (6:00, 6:30, 7:00, 7:30 UTC); batch 3 runs sweep; "
            "daily_news_ingestion (8:00 UTC)."
        )


async def shutdown_scheduler():
    """Shutdown the application scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
