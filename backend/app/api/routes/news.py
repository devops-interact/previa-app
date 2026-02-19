"""
Previa App — Controversial news search API for empresas.
Used by the chat agent and by the frontend to show news about watchlist companies.
"""

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.data.db.session import get_db
from app.data.db.models import CompanyNews

router = APIRouter()


class NewsItem(BaseModel):
    id: int
    rfc: Optional[str]
    razon_social: Optional[str]
    title: str
    url: str
    summary: Optional[str]
    published_at: Optional[str]
    source: str

    class Config:
        from_attributes = True


@router.get("/news", response_model=List[NewsItem])
async def search_news(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    rfc: Optional[str] = Query(None, description="Filter by RFC"),
    company: Optional[str] = Query(None, description="Filter by company name (razon_social)"),
    watchlist_id: Optional[int] = Query(None, description="Filter by watchlist"),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Search indexed controversial news about empresas.
    Returns articles matching RFC, company name, or watchlist.
    """
    q = select(CompanyNews).order_by(CompanyNews.published_at.desc().nullslast(), CompanyNews.indexed_at.desc())
    if rfc:
        q = q.where(CompanyNews.rfc == rfc.strip().upper())
    if company:
        q = q.where(CompanyNews.razon_social.ilike(f"%{company.strip()}%"))
    if watchlist_id is not None:
        q = q.where(CompanyNews.watchlist_id == watchlist_id)
    q = q.limit(limit)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        NewsItem(
            id=r.id,
            rfc=r.rfc,
            razon_social=r.razon_social,
            title=r.title,
            url=r.url,
            summary=r.summary,
            published_at=r.published_at.isoformat() if r.published_at else None,
            source=r.source,
        )
        for r in rows
    ]
