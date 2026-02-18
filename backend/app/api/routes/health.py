"""
Previa App — Health Check Endpoint
Provides system health status and data freshness information.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.data.db.session import get_db
from app.data.db.models import SATDataset
from app.config.settings import settings

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint.
    Returns system status and data freshness.
    """
    # Get SAT dataset freshness
    result = await db.execute(select(SATDataset))
    datasets = result.scalars().all()
    
    data_freshness = {}
    for dataset in datasets:
        data_freshness[dataset.dataset_name] = {
            "last_updated": dataset.last_updated.isoformat() if dataset.last_updated else None,
            "row_count": dataset.row_count
        }
    
    return {
        "status": "ok",
        "version": settings.app_version,
        "timestamp": datetime.utcnow().isoformat(),
        "data_freshness": data_freshness if data_freshness else "No datasets loaded yet"
    }
