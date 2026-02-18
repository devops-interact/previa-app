import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.agent.tools.constitution import ConstitutionIngester
from app.data.sources.ingestion_job import run_ingestion
from app.data.sources.sweep_job import sweep_watchlist_companies

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _ingest_then_sweep():
    """Run full data ingestion then sweep watchlist companies.
    Downloads all listed files from SAT contribuyentes_publicados (and other pages)
    so the agent can validate flags and assess severity from real data."""
    await run_ingestion(sat_max_files=50)
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
        # SAT daily sweep: first run 30s after startup, then every 24h (no asyncio task)
        scheduler.add_job(
            _ingest_then_sweep,
            "interval",
            days=1,
            start_date=datetime.utcnow() + timedelta(seconds=30),
            id='daily_sat_sweep',
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=3600,
        )
        scheduler.start()
        logger.info(
            "Scheduler started. Jobs: update_constitution (Mon 3:00), "
            "daily_sat_sweep (30s after startup, then every 24h)"
        )


async def shutdown_scheduler():
    """Shutdown the application scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
