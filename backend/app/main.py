"""
Previa App — FastAPI Application Entry Point
Production-ready application with CORS, per-user rate limiting, JWT auth,
Sentry error tracking, and database initialization.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config.settings import settings
from app.data.db.session import init_db
from app.api.routes import health, scan, rfc
from app.api.routes import auth as auth_router
from app.api.routes import organizations as org_router
from app.api.routes import chat as chat_router
from app.api.routes import news as news_router
from app.api.routes import billing as billing_router

# ── Sentry (production error tracking) ────────────────────────────────────────

if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.1,
        environment=settings.environment,
    )

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ── Per-user rate limiting ────────────────────────────────────────────────────

def _get_user_or_ip(request: Request) -> str:
    """Extract user_id from JWT for rate-limit keying; fall back to IP."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            from jose import jwt as jose_jwt
            payload = jose_jwt.decode(
                auth[7:], settings.jwt_secret_key,
                algorithms=[settings.jwt_algorithm],
                options={"verify_exp": False},
            )
            uid = payload.get("user_id")
            if uid:
                return f"user:{uid}"
        except Exception:
            pass
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_get_user_or_ip, default_limits=["200/minute"])

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Previa App backend (env=%s)...", ENVIRONMENT)
    logger.info("Database: %s", settings.sqlalchemy_database_url)

    db_ready = False
    try:
        await init_db()
        logger.info("Database tables ensured")
        db_ready = True
    except Exception as e:
        logger.error("Database init failed — app will start in degraded mode: %s", e)

    if db_ready:
        if ENVIRONMENT == "development":
            from app.data.db.session import AsyncSessionLocal
            from app.data.db.models import User
            from app.api.deps import hash_password
            from sqlalchemy import select

            try:
                async with AsyncSessionLocal() as db:
                    r = await db.execute(select(User).where(User.email == settings.demo_user_email))
                    if r.scalar_one_or_none() is None:
                        demo_user = User(
                            email=settings.demo_user_email,
                            hashed_password=hash_password(settings.demo_user_password),
                            full_name="Demo User",
                            role=settings.demo_user_role,
                            plan="company",
                        )
                        db.add(demo_user)
                        await db.commit()
                        logger.info("Demo user created: %s", settings.demo_user_email)
                    else:
                        logger.info("Demo user already exists: %s", settings.demo_user_email)
            except Exception as e:
                logger.error("Demo user seeding failed: %s", e)

        from app.data.db.session import AsyncSessionLocal
        from app.data.db.models import SATDataset
        from sqlalchemy import select

        try:
            async with AsyncSessionLocal() as db:
                for ds_name in ("lista_69b", "art69_creditos_firmes", "art69_no_localizados",
                                "art69_creditos_cancelados", "art69_sentencias", "art69_bis", "art49_bis"):
                    r = await db.execute(select(SATDataset).where(SATDataset.dataset_name == ds_name))
                    if r.scalar_one_or_none() is None:
                        db.add(SATDataset(dataset_name=ds_name, last_updated=None, row_count=0))
                await db.commit()
                logger.info("SAT dataset sentinel rows ensured")
        except Exception as e:
            logger.error("SAT dataset seeding failed: %s", e)

    try:
        from app.scheduler import start_scheduler, shutdown_scheduler
        start_scheduler()
    except Exception as e:
        logger.error("Scheduler start failed: %s", e)

    from app.agent.tools.constitution import ConstitutionIngester
    import asyncio

    if not os.path.exists(
        os.path.join(ConstitutionIngester.DATA_DIR, ConstitutionIngester.OUTPUT_FILE)
    ):
        logger.info("Constitution data not found — triggering initial ingestion...")
        asyncio.create_task(ConstitutionIngester.process())

    yield

    logger.info("Shutting down Previa App backend...")
    try:
        from app.scheduler import shutdown_scheduler
        await shutdown_scheduler()
    except Exception:
        pass


# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Autonomous fiscal compliance screening agent for Mexican tax regulations",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────

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
app.include_router(news_router.router, prefix="/api", tags=["News"])
app.include_router(billing_router.router, prefix="/api", tags=["Billing"])


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "status": "running",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
