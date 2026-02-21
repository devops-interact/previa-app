"""
Previa App — Database Session Management
Async database session factory with production-grade connection pooling.
"""

import logging
import ssl as ssl_module
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from app.config.settings import settings
from app.data.db.models import Base

logger = logging.getLogger(__name__)

database_url = settings.sqlalchemy_database_url


def _prepare_pg_url(url: str) -> tuple[str, dict]:
    """
    asyncpg does not understand libpq params like 'sslmode'.
    Strip them from the URL and return (clean_url, connect_args).
    """
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)

    connect_args: dict = {}
    sslmode = qs.pop("sslmode", [None])[0]

    if sslmode and sslmode != "disable":
        ctx = ssl_module.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl_module.CERT_NONE
        connect_args["ssl"] = ctx

    clean_query = urlencode({k: v[0] for k, v in qs.items()}, doseq=False)
    clean_url = urlunparse(parsed._replace(query=clean_query))
    return clean_url, connect_args


if database_url.startswith("sqlite"):
    engine = create_async_engine(
        database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=settings.log_level == "DEBUG",
    )
else:
    clean_url, pg_connect_args = _prepare_pg_url(database_url)
    logger.info(
        "PostgreSQL engine: host=%s db=%s",
        urlparse(clean_url).hostname,
        urlparse(clean_url).path.lstrip("/"),
    )
    engine = create_async_engine(
        clean_url,
        connect_args=pg_connect_args,
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=True,
        echo=settings.log_level == "DEBUG",
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """Create tables that don't exist yet (safe for first boot)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """FastAPI dependency for database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
