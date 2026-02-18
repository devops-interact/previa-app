"""
Previa App — FastAPI Application Entry Point
Main application with CORS, rate limiting, JWT auth, and database initialization.

Security hardening applied:
- CORS restricted to explicit methods and headers (no wildcard).
- Slowapi rate limiter applied to mutation endpoints.
- JWT authentication required on all data endpoints (see deps.py).
- Auth router registered at /api/auth/login.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config.settings import settings
from app.data.db.session import init_db, apply_migrations
from app.api.routes import health, scan, rfc
from app.api.routes import auth as auth_router
from app.api.routes import organizations as org_router
from app.api.routes import chat as chat_router

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ── Rate Limiter ──────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Runs setup on startup and teardown on shutdown.
    """
    logger.info("Starting Previa App backend...")
    logger.info("Database: %s", settings.sqlalchemy_database_url)

    # Initialize database tables and apply idempotent column migrations
    await init_db()
    await apply_migrations()
    logger.info("Database initialized and migrations applied")

    # Seed demo user (idempotent)
    from app.data.db.session import AsyncSessionLocal
    from app.data.db.models import User
    from app.api.deps import hash_password
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == settings.demo_user_email))
        existing_user = result.scalar_one_or_none()

        if not existing_user:
            demo_user = User(
                email=settings.demo_user_email,
                hashed_password=hash_password(settings.demo_user_password),
                role=settings.demo_user_role,
            )
            db.add(demo_user)
            await db.commit()
            logger.info("Demo user created: %s", settings.demo_user_email)
        else:
            logger.info("Demo user already exists: %s", settings.demo_user_email)

        # Ensure documented demo account exists (user@example.com / 1234) so login always works
        default_demo_email = "user@example.com"
        if default_demo_email != settings.demo_user_email:
            r2 = await db.execute(select(User).where(User.email == default_demo_email))
            if r2.scalar_one_or_none() is None:
                extra_demo = User(
                    email=default_demo_email,
                    hashed_password=hash_password(settings.demo_user_password),
                    role=settings.demo_user_role,
                )
                db.add(extra_demo)
                await db.commit()
                logger.info("Demo user created: %s (documented credentials)", default_demo_email)

    # Seed demo SATDataset sentinel rows so the freshness-check has a row to
    # query.  Use last_updated=None (never ingested) so the deferred ingestion
    # task is NOT skipped on first boot — it will then download real SAT data.
    from app.data.db.models import SATDataset

    async with AsyncSessionLocal() as db:
        for ds_name in ("lista_69b", "art69_creditos_firmes", "art69_no_localizados",
                        "art69_creditos_cancelados", "art69_sentencias", "art69_bis", "art49_bis"):
            r = await db.execute(select(SATDataset).where(SATDataset.dataset_name == ds_name))
            if r.scalar_one_or_none() is None:
                # last_updated=None means "never fetched" → freshness gate will
                # NOT skip ingestion on next startup, allowing a real download.
                db.add(SATDataset(dataset_name=ds_name, last_updated=None, row_count=0))
        await db.commit()
        logger.info("SAT dataset sentinel rows ensured (last_updated=None for fresh installs)")

    # Scheduler (background SAT data refresh)
    from app.scheduler import start_scheduler, shutdown_scheduler
    from app.agent.tools.constitution import ConstitutionIngester
    import os

    start_scheduler()

    if not os.path.exists(
        os.path.join(ConstitutionIngester.DATA_DIR, ConstitutionIngester.OUTPUT_FILE)
    ):
        logger.info("Constitution data not found — triggering initial ingestion...")
        import asyncio
        asyncio.create_task(ConstitutionIngester.process())

    # Deferred ingestion: wait 60s so the app serves requests first, then skip
    # if data was already ingested within the last 6 hours (avoids re-downloading
    # large SAT Excel files on every Railway redeploy).
    import asyncio
    from datetime import datetime as _dt2
    from app.data.sources.ingestion_job import run_ingestion
    from app.data.sources.sweep_job import sweep_watchlist_companies
    from app.data.db.models import SATDataset as _SATDataset2

    async def _delayed_ingest_and_sweep():
        await asyncio.sleep(60)  # let the app be fully ready before heavy work
        try:
            async with AsyncSessionLocal() as _db:
                _r = await _db.execute(
                    select(_SATDataset2).where(_SATDataset2.dataset_name == "lista_69b")
                )
                _row = _r.scalar_one_or_none()
                if _row and _row.last_updated and (_row.row_count or 0) > 0:
                    # Only skip if data was both recently updated AND has actual rows.
                    # row_count=0 means only the sentinel was seeded, not real data.
                    age_hours = (_dt2.utcnow() - _row.last_updated).total_seconds() / 3600
                    if age_hours < 6:
                        logger.info(
                            "Skipping startup ingestion — data is %.1fh old, %d rows (< 6h threshold)",
                            age_hours, _row.row_count,
                        )
                        return
            logger.info("Starting deferred ingestion + sweep...")
            await run_ingestion(sat_max_files=10)  # capped at startup to avoid memory saturation
            await sweep_watchlist_companies()
        except Exception as _e:
            logger.exception("Deferred ingestion/sweep failed: %s", _e)

    asyncio.create_task(_delayed_ingest_and_sweep())

    yield

    # Shutdown
    logger.info("Shutting down Previa App backend...")
    await shutdown_scheduler()


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Autonomous fiscal compliance screening agent for Mexican tax regulations",
    lifespan=lifespan,
)

# Attach rate limiter state and error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS (hardened) ───────────────────────────────────────────────────────────
# Wildcard methods/headers removed — only what the frontend actually needs.

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router.router, prefix="/api", tags=["Auth"])
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(scan.router, prefix="/api", tags=["Scan"])
app.include_router(rfc.router, prefix="/api", tags=["RFC"])
app.include_router(org_router.router, prefix="/api", tags=["Organizations"])
app.include_router(chat_router.router, prefix="/api", tags=["Chat"])

# ── Root ──────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    """Root health/identity endpoint (public)."""
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "status": "running",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
