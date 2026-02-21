# =============================================================================
# Previa App — Backend Dockerfile
# Production deployment with Gunicorn + Uvicorn workers
# Compatible with Railway Pro / Enterprise
# =============================================================================

FROM python:3.11-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic/ ./alembic/
COPY app/ ./app/

RUN mkdir -p /app/data

EXPOSE 8000

CMD ["sh", "-c", "python -c \"
import asyncio
from app.data.db.session import init_db
asyncio.run(init_db())
\" && timeout 60 alembic upgrade head 2>&1 || echo 'Alembic skipped or timed out' && gunicorn app.main:app -w ${WEB_CONCURRENCY:-2} -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --timeout 120 --graceful-timeout 30 --access-logfile -"]
