"""
Previa App — Scan Processing Tasks
Dispatches scan jobs to Celery when available, otherwise falls back to asyncio.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)


def dispatch_scan(scan_id: str) -> None:
    """
    Dispatch a scan processing job. Uses Celery if available,
    otherwise falls back to an asyncio background task.
    """
    from app.tasks.celery_app import celery_app, is_celery_available

    if celery_app and is_celery_available():
        _process_scan_celery.delay(scan_id)
        logger.info("Scan %s dispatched to Celery", scan_id)
    else:
        from app.agent.orchestrator import process_scan
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(_run_scan_async(scan_id))
            else:
                loop.run_until_complete(_run_scan_async(scan_id))
        except RuntimeError:
            asyncio.run(_run_scan_async(scan_id))
        logger.info("Scan %s dispatched in-process (no Celery)", scan_id)


async def _run_scan_async(scan_id: str) -> None:
    from app.agent.orchestrator import process_scan
    await process_scan(scan_id)


try:
    from app.tasks.celery_app import celery_app
    if celery_app:
        @celery_app.task(name="process_scan", bind=True, max_retries=2)
        def _process_scan_celery(self, scan_id: str):
            asyncio.run(_run_scan_async(scan_id))
except Exception:
    pass
