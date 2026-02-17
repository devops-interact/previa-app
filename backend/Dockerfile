# =============================================================================
# Previa App — Backend Dockerfile
# Multi-stage build for production deployment
# Compatible with Railway/Render
# =============================================================================

FROM python:3.11-slim as base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create data directory for SQLite (optional for Railway if using Postgres)
RUN mkdir -p /app/data

# Expose port (Railway sets PORT env var dynamically)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/api/health')"

# Run application (Use shell form to expand $PORT)
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"
