"""
Previa App — Database Session Management
Async database session factory for SQLite.
"""

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
