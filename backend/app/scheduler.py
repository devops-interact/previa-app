import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.agent.tools.constitution import ConstitutionIngester
from app.data.sources.ingestion_job import run_ingestion

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

def start_scheduler():
    """Start the application scheduler."""
    if not scheduler.running:
        # Constitution update every Monday at 3:00 AM
        scheduler.add_job(
            ConstitutionIngester.process,
            CronTrigger(day_of_week='mon', hour=3, minute=0),
            id='update_constitution',
            replace_existing=True
        )
        # DOF + SAT Datos Abiertos ingestion every 6 hours for alert generation
        scheduler.add_job(
            run_ingestion,
            CronTrigger(hour='*/6', minute=5),
            id='ingest_dof_sat',
            replace_existing=True
        )
        scheduler.start()
        logger.info("Scheduler started. Jobs: update_constitution (Mon 3:00), ingest_dof_sat (every 6h)")

async def shutdown_scheduler():
    """Shutdown the application scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
