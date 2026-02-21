"""
Previa App — Health Check Endpoints
Provides system health status and data freshness information.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from datetime import datetime
from app.data.db.session import get_db
from app.data.db.models import SATDataset, SweepMetadata
from app.config.settings import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Lightweight liveness probe — no DB dependency.
    Railway hits this endpoint to determine if the service is alive.
    """
    return {
        "status": "ok",
        "version": settings.app_version,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/health/detailed")
async def health_check_detailed(db: AsyncSession = Depends(get_db)):
    """
    Detailed readiness probe with DB connectivity and data freshness.
    """
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    data_freshness = {}
    sweep_status = None

    if db_ok:
        try:
            result = await db.execute(select(SATDataset))
            datasets = result.scalars().all()
            for dataset in datasets:
                data_freshness[dataset.dataset_name] = {
                    "last_updated": dataset.last_updated.isoformat() if dataset.last_updated else None,
                    "row_count": dataset.row_count,
                }

            sweep = await db.execute(select(SweepMetadata).limit(1))
            sweep_row = sweep.scalar_one_or_none()
            if sweep_row:
                sweep_status = {
                    "last_completed_at": sweep_row.last_completed_at.isoformat() if sweep_row.last_completed_at else None,
                    "total_files": sweep_row.total_files,
                    "total_rows": sweep_row.total_rows,
                }
        except Exception:
            pass

    return {
        "status": "ok" if db_ok else "degraded",
        "version": settings.app_version,
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected" if db_ok else "unavailable",
        "data_freshness": data_freshness or "No datasets loaded yet",
        "sweep_status": sweep_status,
    }
