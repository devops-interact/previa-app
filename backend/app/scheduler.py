from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.agent.tools.constitution import ConstitutionIngester
import logging

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

def start_scheduler():
    """Start the application scheduler."""
    if not scheduler.running:
        # Schedule Constitution update every Monday at 3:00 AM CDMX time (approx)
        # Using simple cron trigger
        scheduler.add_job(
            ConstitutionIngester.process,
            CronTrigger(day_of_week='mon', hour=3, minute=0),
            id='update_constitution',
            replace_existing=True
        )
        
        scheduler.start()
        logger.info("Scheduler started. Jobs: update_constitution (Weekly: Mon 3:00 AM)")

async def shutdown_scheduler():
    """Shutdown the application scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
