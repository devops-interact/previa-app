"""
Previa App — Celery Application
Optional task queue for scan processing and sweep jobs.
Requires REDIS_URL env var. Falls back to in-process if not configured.

Usage (production):
    celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
"""

import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "")

celery_app: Celery | None = None

if REDIS_URL:
    celery_app = Celery(
        "previa",
        broker=REDIS_URL,
        backend=REDIS_URL,
    )
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        task_track_started=True,
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        result_expires=3600,
    )


def is_celery_available() -> bool:
    """Check if Celery + Redis is configured and reachable."""
    if not celery_app:
        return False
    try:
        celery_app.connection_or_acquire(block=True, timeout=2)
        return True
    except Exception:
        return False
