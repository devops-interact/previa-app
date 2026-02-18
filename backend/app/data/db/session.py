"""
Previa App — Database Session Management
Async database session factory for SQLite.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from app.config.settings import settings
from app.data.db.models import Base


# Create async engine
# Handle specific configurations for SQLite vs Postgres
database_url = settings.sqlalchemy_database_url
connect_args = {}
pool_class = None

if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    pool_class = StaticPool

engine = create_async_engine(
    database_url,
    connect_args=connect_args,
    poolclass=pool_class,
    echo=settings.log_level == "DEBUG"
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def apply_migrations():
    """
    Idempotent column migrations for tables that already exist in production.
    SQLAlchemy's create_all() only creates missing tables — it never alters
    existing ones.  This function adds any new columns using PostgreSQL's
    ADD COLUMN IF NOT EXISTS, so it is safe to run on every startup.
    """
    migrations = [
        # WatchlistCompany compliance fields (added in real-SAT-verification release)
        "ALTER TABLE watchlist_companies ADD COLUMN IF NOT EXISTS risk_level VARCHAR",
        "ALTER TABLE watchlist_companies ADD COLUMN IF NOT EXISTS risk_score INTEGER",
        "ALTER TABLE watchlist_companies ADD COLUMN IF NOT EXISTS art_69b_status VARCHAR",
        "ALTER TABLE watchlist_companies ADD COLUMN IF NOT EXISTS art_69_categories JSON",
        "ALTER TABLE watchlist_companies ADD COLUMN IF NOT EXISTS art_69_bis_found BOOLEAN DEFAULT FALSE",
        "ALTER TABLE watchlist_companies ADD COLUMN IF NOT EXISTS art_49_bis_found BOOLEAN DEFAULT FALSE",
        "ALTER TABLE watchlist_companies ADD COLUMN IF NOT EXISTS last_screened_at TIMESTAMP",
        # PublicNotice freshness tracking
        "ALTER TABLE public_notices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP",
    ]
    db_url = settings.sqlalchemy_database_url
    if db_url.startswith("sqlite"):
        # SQLite does not support ADD COLUMN IF NOT EXISTS; skip gracefully.
        # New columns are created via create_all() on fresh SQLite databases.
        return
    async with engine.begin() as conn:
        for sql in migrations:
            await conn.execute(text(sql))


async def get_db() -> AsyncSession:
    """
    Dependency for FastAPI routes to get database session.
    
    Usage:
        @app.get("/endpoint")
        async def endpoint(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
