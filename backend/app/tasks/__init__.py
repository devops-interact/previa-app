"""
Previa App — Async Task Infrastructure
Provides a Celery-compatible task queue when Redis is available,
with graceful fallback to in-process asyncio tasks for development.
"""
