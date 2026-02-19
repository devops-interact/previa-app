"""
Previa App — Controversial news fetcher for empresas.
Uses NewsAPI.org to search news about companies (razon_social).
When NEWS_API_KEY is set, indexes articles for watchlist companies; otherwise no-op.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)

NEWS_API_BASE = "https://newsapi.org/v2/everything"
# Free tier: 100 req/day; search up to 1 month
PAGE_SIZE = 10
MAX_PAGES = 1  # 10 articles per company per run to save quota


def _parse_news_date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


async def fetch_news_for_company(
    razon_social: str,
    rfc: str | None = None,
    *,
    language: str = "es",
    days_back: int = 30,
) -> List[Dict[str, Any]]:
    """
    Search NewsAPI for articles about a company (controversy/relevance).
    Returns list of dicts: title, url, summary, published_at, source.
    No-op if settings.news_api_key is empty.
    """
    if not (getattr(settings, "news_api_key", None) or "").strip():
        logger.debug("NewsAPI key not set; skipping news fetch for %s", razon_social)
        return []

    # Query: company name + Mexico to focus on local news; optional "controversia"
    query = f'"{razon_social}" México'
    from_date = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")

    articles: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=15.0) as client:
        for page in range(MAX_PAGES):
            params = {
                "q": query,
                "language": language,
                "from": from_date,
                "pageSize": PAGE_SIZE,
                "page": page + 1,
                "apiKey": settings.news_api_key.strip(),
                "sortBy": "publishedAt",
            }
            try:
                resp = await client.get(NEWS_API_BASE, params=params)
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as e:
                logger.warning("NewsAPI HTTP error for %s: %s", razon_social, e)
                break
            except Exception as e:
                logger.warning("NewsAPI request failed for %s: %s", razon_social, e)
                break

            items = data.get("articles") or []
            if not items:
                break
            for a in items:
                if not a.get("title") or a.get("title") == "[Removed]":
                    continue
                published = _parse_news_date(a.get("publishedAt"))
                articles.append({
                    "title": (a.get("title") or "").strip(),
                    "url": (a.get("url") or "").strip(),
                    "summary": (a.get("description") or "").strip() or None,
                    "published_at": published,
                    "source": a.get("source", {}).get("name") or "news_api",
                })
            if len(items) < PAGE_SIZE:
                break

    logger.info("NewsAPI: %d articles for %s", len(articles), razon_social)
    return articles


async def fetch_news_for_companies(
    companies: List[Dict[str, Any]],
    *,
    max_companies: int = 50,
) -> List[Dict[str, Any]]:
    """
    Fetch news for each company. Each item in companies should have
    'razon_social' and optionally 'rfc', 'watchlist_id'.
    Returns flat list of { razon_social, rfc, watchlist_id, title, url, summary, published_at, source }.
    """
    results: List[Dict[str, Any]] = []
    for c in companies[:max_companies]:
        rfc = c.get("rfc")
        razon = (c.get("razon_social") or "").strip()
        if not razon:
            continue
        items = await fetch_news_for_company(razon_social=razon, rfc=rfc)
        for item in items:
            results.append({
                "rfc": rfc,
                "razon_social": razon,
                "watchlist_id": c.get("watchlist_id"),
                "title": item["title"],
                "url": item["url"],
                "summary": item.get("summary"),
                "published_at": item.get("published_at"),
                "source": item.get("source") or "news_api",
            })
    return results
