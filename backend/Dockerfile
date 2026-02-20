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

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/api/health')"

CMD sh -c "alembic upgrade head 2>/dev/null || true && gunicorn app.main:app -w ${WEB_CONCURRENCY:-4} -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --timeout 120 --graceful-timeout 30 --access-logfile -"
