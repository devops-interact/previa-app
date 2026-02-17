"""
PREV.IA — FastAPI Application Entry Point
Main application with CORS, routes, and database initialization.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.data.db.session import init_db
from app.api.routes import health, scan, rfc

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Runs on startup and shutdown.
    """
    # Startup
    logger.info("Starting PREV.IA backend...")
    logger.info(f"Database: {settings.sqlalchemy_database_url}")
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    # Seed demo user (if not exists)
    from app.data.db.session import AsyncSessionLocal
    from app.data.db.models import User
    from passlib.context import CryptContext
    from sqlalchemy import select
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    async with AsyncSessionLocal() as db:
        # Check if demo user exists
        result = await db.execute(
            select(User).where(User.email == settings.demo_user_email)
        )
        existing_user = result.scalar_one_or_none()
        
        if not existing_user:
            # Create demo user
            demo_user = User(
                email=settings.demo_user_email,
                hashed_password=pwd_context.hash(settings.demo_user_password),
                role=settings.demo_user_role
            )
            db.add(demo_user)
            await db.commit()
            logger.info(f"Demo user created: {settings.demo_user_email}")
        else:
            logger.info(f"Demo user already exists: {settings.demo_user_email}")
    
    # Scheduler
    from app.scheduler import start_scheduler, shutdown_scheduler
    from app.agent.tools.constitution import ConstitutionIngester
    import os

    start_scheduler()
    
    # Check if Constitution data exists, if not, fetch it
    if not os.path.exists(os.path.join(ConstitutionIngester.DATA_DIR, ConstitutionIngester.OUTPUT_FILE)):
        logger.info("Constitution data not found. triggering initial ingestion...")
        # Run in background to not block startup
        import asyncio
        asyncio.create_task(ConstitutionIngester.process())
    
    yield
    
    # Shutdown
    logger.info("Shutting down PREV.IA backend...")
    await shutdown_scheduler()


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Autonomous fiscal compliance screening agent for Mexican tax regulations",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(scan.router, prefix="/api", tags=["Scan"])
app.include_router(rfc.router, prefix="/api", tags=["RFC"])

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
