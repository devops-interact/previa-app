"""
Previa App — News ingestion job: fetch and index controversial news for watchlist companies.
Uses NewsAPI (when NEWS_API_KEY is set) and stores results in CompanyNews for agent search.
"""

import logging
from datetime import datetime

from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.session import AsyncSessionLocal
from app.data.db.models import WatchlistCompany, CompanyNews
from app.data.sources.news_fetcher import fetch_news_for_companies

logger = logging.getLogger(__name__)

# Cap companies per run to stay within NewsAPI free tier (100 req/day)
MAX_COMPANIES_PER_RUN = 50


async def run_news_ingestion(max_companies: int = MAX_COMPANIES_PER_RUN):
    """
    Load watchlist companies, fetch news for each (via NewsAPI), upsert into CompanyNews.
    No-op if NEWS_API_KEY is not set.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(
                WatchlistCompany.rfc,
                WatchlistCompany.razon_social,
                WatchlistCompany.watchlist_id,
            )
            .distinct()
        )
        rows = result.all()
        companies = [
            {"rfc": r.rfc, "razon_social": r.razon_social, "watchlist_id": r.watchlist_id}
            for r in rows
            if (r.razon_social or "").strip()
        ]
        if not companies:
            logger.info("News ingestion: no watchlist companies with razon_social")
            return

        news_items = await fetch_news_for_companies(companies, max_companies=max_companies)
        if not news_items:
            logger.info("News ingestion: no articles fetched (check NEWS_API_KEY or quota)")
            return

        inserted = 0
        for n in news_items:
            # Avoid duplicate url for same company
            existing = await db.execute(
                select(CompanyNews.id).where(
                    and_(
                        CompanyNews.url == n["url"],
                        or_(
                            CompanyNews.rfc == n.get("rfc"),
                            CompanyNews.razon_social == n.get("razon_social"),
                        ),
                    )
                ).limit(1)
            )
            if existing.scalar_one_or_none():
                continue
            db.add(CompanyNews(
                rfc=n.get("rfc"),
                razon_social=n.get("razon_social"),
                watchlist_id=n.get("watchlist_id"),
                source=n.get("source") or "news_api",
                title=n["title"],
                url=n["url"],
                summary=n.get("summary"),
                published_at=n.get("published_at"),
            ))
            inserted += 1

        await db.commit()
        logger.info("News ingestion: %d new articles indexed for watchlist companies", inserted)
