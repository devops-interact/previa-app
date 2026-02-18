import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.agent.tools.constitution import ConstitutionIngester
from app.data.sources.ingestion_job import run_ingestion
from app.data.sources.sweep_job import sweep_watchlist_companies

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _ingest_then_sweep():
    """Run data ingestion, then immediately sweep watchlist companies."""
    await run_ingestion()
    await sweep_watchlist_companies()


def start_scheduler():
    """Start the application scheduler."""
    if not scheduler.running:
        scheduler.add_job(
            ConstitutionIngester.process,
            CronTrigger(day_of_week='mon', hour=3, minute=0),
            id='update_constitution',
            replace_existing=True
        )
        # DOF + SAT ingestion every 6 hours, then sweep all watchlist companies
        scheduler.add_job(
            _ingest_then_sweep,
            CronTrigger(hour='*/6', minute=5),
            id='ingest_and_sweep',
            replace_existing=True
        )
        # Standalone daily sweep at 07:00 (catches newly added companies)
        scheduler.add_job(
            sweep_watchlist_companies,
            CronTrigger(hour=7, minute=0),
            id='daily_sweep',
            replace_existing=True
        )
        scheduler.start()
        logger.info(
            "Scheduler started. Jobs: update_constitution (Mon 3:00), "
            "ingest_and_sweep (every 6h), daily_sweep (07:00)"
        )


async def shutdown_scheduler():
    """Shutdown the application scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
