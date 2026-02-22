"""
Prevify — SIDOF (Sistema de Información del Diario Oficial de la Federación) fetcher.
Fetches https://sidof.segob.gob.mx/ as an additional discovery source for DOF notices.
SIDOF is the official DOF information system (SEGOB); it links to the same DOF content
(dof.gob.mx). We use SIDOF pages to discover notices, then fetch details from DOF.
"""

import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import httpx
from bs4 import BeautifulSoup

from app.data.sources.dof_fetcher import (
    DOFFetcher,
    NOTA_PATTERN,
    SAT_KEYWORDS,
    _classify_notice,
    _BROWSER_HEADERS,
)

logger = logging.getLogger(__name__)

SIDOF_BASE = "https://sidof.segob.gob.mx"
SIDOF_INDEX = "https://sidof.segob.gob.mx/"
# SIDOF may support date-based queries similar to DOF
SIDOF_EDITION_TEMPLATE = "https://sidof.segob.gob.mx/index.php?year={year}&month={month}&day={day}&edicion={edicion}"
DOF_BASE = "https://www.dof.gob.mx"
DOF_EDITIONS = ("MAT", "SUP")


class SIDOFFetcher:
    """Fetch SIDOF pages to discover DOF notices; reuse DOF parsing for detail extraction."""

    @classmethod
    async def fetch_page(cls, url: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=30.0, verify=False, headers=_BROWSER_HEADERS
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.text
        except Exception as e:
            logger.debug("SIDOF fetch %s failed: %s", url, e)
            return None

    @classmethod
    def parse_notice_links(cls, html: str, base_url: str = SIDOF_INDEX) -> List[Dict[str, str]]:
        """Extract DOF nota_detalle links from SIDOF (or any) HTML.

        SIDOF pages often embed links to dof.gob.mx/nota_detalle.php?codigo=...&fecha=...
        """
        soup = BeautifulSoup(html, "html.parser")
        links = []
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            m = NOTA_PATTERN.search(href)
            if m:
                codigo, fecha = m.groups()
                full_url = f"{DOF_BASE}/nota_detalle.php?codigo={codigo}&fecha={fecha}"
                title = (a.get_text(strip=True) or "")[:500]
                links.append({
                    "codigo": codigo,
                    "fecha": fecha,
                    "url": full_url,
                    "title": title,
                    "discovery_url": base_url,
                })
        seen = set()
        unique = []
        for item in links:
            if item["codigo"] not in seen:
                seen.add(item["codigo"])
                unique.append(item)
        return unique

    @classmethod
    def filter_sat_related(cls, notices: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        out = []
        for n in notices:
            title_upper = (n.get("title") or "").upper()
            if any(kw.upper() in title_upper for kw in SAT_KEYWORDS):
                out.append(n)
        return out

    @classmethod
    async def run(
        cls,
        limit_notices: int = 60,
        edition_days_back: int = 14,
    ) -> List[Dict[str, Any]]:
        """
        Fetch SIDOF index + date-based pages, discover DOF notices, fetch details
        from DOF, and return PublicNotice-compatible dicts with source='sidof'.
        """
        notices_for_db: List[Dict[str, Any]] = []
        try:
            all_links: List[Dict[str, str]] = []

            html = await cls.fetch_page(SIDOF_INDEX)
            if html:
                all_links.extend(cls.parse_notice_links(html, SIDOF_INDEX))
                logger.info("SIDOF index: parsed %s notice links", len(all_links))

            today = datetime.utcnow().date()
            for i in range(edition_days_back):
                d = today - timedelta(days=i)
                for edicion in DOF_EDITIONS:
                    url = SIDOF_EDITION_TEMPLATE.format(
                        year=d.year, month=d.month, day=d.day, edicion=edicion
                    )
                    edition_html = await cls.fetch_page(url)
                    if edition_html:
                        all_links.extend(cls.parse_notice_links(edition_html, url))

            seen_codigo: set = set()
            links: List[Dict[str, str]] = []
            for item in all_links:
                if item["codigo"] not in seen_codigo:
                    seen_codigo.add(item["codigo"])
                    links.append(item)
            logger.info("SIDOF total: %s unique notice links", len(links))

            sat_related = cls.filter_sat_related(links[: limit_notices * 2])
            to_fetch = sat_related[:limit_notices]

            for item in to_fetch:
                try:
                    detail_html = await DOFFetcher.fetch_notice_detail(item["codigo"], item["fecha"])
                    article_type, status = _classify_notice(item.get("title") or "")
                    entities = DOFFetcher._extract_entities(detail_html)
                    discovery_url = item.get("discovery_url") or SIDOF_INDEX

                    for ent in entities[:200]:
                        notices_for_db.append({
                            "source": "sidof",
                            "source_url": discovery_url,
                            "dof_url": item["url"],
                            "rfc": ent["rfc"],
                            "razon_social": ent.get("razon_social"),
                            "article_type": article_type,
                            "status": status,
                            "oficio_number": None,
                            "authority": "SAT/SHCP",
                            "motivo": (item.get("title") or "")[:500],
                            "published_at": DOFFetcher._parse_fecha(item.get("fecha")),
                            "raw_snippet": (item.get("title") or "")[:1000],
                        })
                    if not entities:
                        notices_for_db.append({
                            "source": "sidof",
                            "source_url": discovery_url,
                            "dof_url": item["url"],
                            "rfc": None,
                            "razon_social": None,
                            "article_type": article_type,
                            "status": status,
                            "oficio_number": None,
                            "authority": "SAT/SHCP",
                            "motivo": (item.get("title") or "")[:500],
                            "published_at": DOFFetcher._parse_fecha(item.get("fecha")),
                            "raw_snippet": (item.get("title") or "")[:1000],
                        })
                except Exception as e:
                    logger.warning("SIDOF notice %s fetch failed: %s", item.get("codigo"), e)
        except Exception as e:
            logger.error("SIDOF fetch failed: %s", e)
        return notices_for_db
