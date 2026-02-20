"""
Previa App — Gaceta Parlamentaria fetcher.
Scrapes https://gaceta.diputados.gob.mx/ for legislative proposals and reforms
related to fiscal/tax law (CFF, ISR, LIVA, etc.) to enrich compliance context.
"""

import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
}

GACETA_BASE = "https://gaceta.diputados.gob.mx"

FISCAL_KEYWORDS = (
    "SAT", "fiscal", "CFF", "69-B", "69-b", "contribuyente", "EFOS",
    "SHCP", "tributari", "impuesto", "recaudaci", "Hacienda",
    "código fiscal", "facturación", "evasión", "defraudación",
    "operaciones simuladas", "operaciones inexistentes",
    "lavado de dinero", "procedencia ilícita",
    "ISR", "IVA", "IEPS", "aduaner", "contrabando",
    "69 bis", "49 bis", "artículo 69", "artículo 49",
)

_STAGE_RULES = [
    ("dictamen", "dictamen"),
    ("decreto", "reforma_aprobada"),
    ("reforma", "reforma_aprobada"),
    ("minuta", "minuta"),
    ("iniciativa", "iniciativa"),
    ("comunicación", "comunicacion"),
    ("proposición", "proposicion"),
    ("punto de acuerdo", "punto_de_acuerdo"),
]


def _classify_stage(title: str) -> str:
    t = title.lower()
    for keyword, stage in _STAGE_RULES:
        if keyword in t:
            return stage
    return "iniciativa"


class GacetaDiputadosFetcher:
    """Fetch fiscal/tax legislative entries from Gaceta Parlamentaria."""

    @classmethod
    async def _fetch_page(cls, url: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=30.0, verify=False, headers=_BROWSER_HEADERS
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.text
        except Exception as e:
            logger.debug("Gaceta fetch failed for %s: %s", url, e)
            return None

    @classmethod
    def _extract_entries(cls, html: str, page_url: str) -> List[Dict[str, str]]:
        """Extract entry links with titles from a Gaceta page."""
        soup = BeautifulSoup(html, "html.parser")
        entries: List[Dict[str, str]] = []
        seen: set = set()

        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            title = (a.get_text(strip=True) or "")[:500]
            if not title or len(title) < 15:
                continue
            full_url = urljoin(page_url, href) if not href.startswith("http") else href
            if full_url in seen:
                continue
            seen.add(full_url)
            entries.append({"url": full_url, "title": title})

        return entries

    @classmethod
    def _filter_fiscal(cls, entries: List[Dict[str, str]]) -> List[Dict[str, str]]:
        out = []
        for e in entries:
            title_upper = e["title"].upper()
            if any(kw.upper() in title_upper for kw in FISCAL_KEYWORDS):
                out.append(e)
        return out

    @classmethod
    async def _fetch_snippet(cls, url: str) -> str:
        """Fetch a detail page and return a text snippet (first 2000 chars)."""
        html = await cls._fetch_page(url)
        if not html:
            return ""
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        return text[:2000]

    @classmethod
    def _parse_date_from_url(cls, url: str) -> Optional[datetime]:
        """Try to extract a date from the URL path (common Gaceta pattern)."""
        m = re.search(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})", url)
        if m:
            try:
                return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            except ValueError:
                pass
        m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", url)
        if m:
            try:
                return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))
            except ValueError:
                pass
        return None

    @classmethod
    async def run(cls, days_back: int = 30, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Scrape Gaceta Parlamentaria for fiscal/tax legislative entries.
        Returns notices compatible with PublicNotice schema.
        """
        notices: List[Dict[str, Any]] = []
        try:
            all_entries: List[Dict[str, str]] = []

            index_html = await cls._fetch_page(GACETA_BASE)
            if index_html:
                all_entries.extend(cls._extract_entries(index_html, GACETA_BASE))
                logger.info("Gaceta index: %d links extracted", len(all_entries))

            today = datetime.utcnow().date()
            for i in range(0, days_back, 3):
                d = today - timedelta(days=i)
                dated_url = f"{GACETA_BASE}/Gaceta/{d.year}/{d.month:02d}/{d.day:02d}/"
                html = await cls._fetch_page(dated_url)
                if html:
                    all_entries.extend(cls._extract_entries(html, dated_url))

            seen_urls: set = set()
            unique: List[Dict[str, str]] = []
            for e in all_entries:
                if e["url"] not in seen_urls:
                    seen_urls.add(e["url"])
                    unique.append(e)

            fiscal_entries = cls._filter_fiscal(unique)
            logger.info("Gaceta: %d fiscal-related entries from %d total", len(fiscal_entries), len(unique))

            for entry in fiscal_entries[:limit]:
                try:
                    snippet = await cls._fetch_snippet(entry["url"])
                    stage = _classify_stage(entry["title"])
                    pub_date = cls._parse_date_from_url(entry["url"]) or datetime.utcnow()

                    notices.append({
                        "source": "gaceta_diputados",
                        "source_url": entry["url"],
                        "dof_url": None,
                        "rfc": None,
                        "razon_social": None,
                        "article_type": "legislative",
                        "status": stage,
                        "category": None,
                        "oficio_number": None,
                        "authority": "Camara de Diputados",
                        "motivo": entry["title"][:500],
                        "published_at": pub_date,
                        "raw_snippet": snippet[:1000] if snippet else entry["title"][:1000],
                    })
                except Exception as e:
                    logger.warning("Gaceta entry fetch failed: %s — %s", entry["url"], e)

        except Exception as e:
            logger.error("Gaceta Parlamentaria fetch failed: %s", e)

        logger.info("GacetaDiputadosFetcher: returning %d notices", len(notices))
        return notices
