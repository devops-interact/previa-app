"""
Previa App — SAT Datos Abiertos fetcher.
Fetches http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/ for public
lists (contribuyentes publicados, controversia, sat_mas_abierto, etc.) to index for alerts.
"""

import logging
import re
from datetime import datetime
from typing import List, Dict, Any
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SAT_BASE = "http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos"
# Pages to index (from user requirements)
SAT_PAGES = [
    ("index.html", "sat_datos_abiertos_index"),
    ("contribuyentes_publicados.html", "contribuyentes_publicados"),
    ("controversia.html", "controversia"),
    ("sat_mas_abierto.html", "sat_mas_abierto"),
]
RFC_PATTERN = re.compile(r"\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b")


class SATDatosAbiertosFetcher:
    """Fetch and parse SAT Datos Abiertos pages for RFC lists and links."""

    @classmethod
    def _url(cls, path: str) -> str:
        if path.startswith("http"):
            return path
        return f"{SAT_BASE}/{path}"

    @classmethod
    async def fetch_page(cls, path: str) -> str | None:
        """Fetch one SAT Datos Abiertos page."""
        url = cls._url(path)
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=25.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.text
        except Exception as e:
            logger.warning("SAT Datos Abiertos fetch %s failed: %s", url, e)
            return None

    @classmethod
    def parse_tables_for_rfcs(cls, html: str, source_url: str, article_type: str) -> List[Dict[str, Any]]:
        """Parse HTML tables for RFC column and build notice records."""
        soup = BeautifulSoup(html, "html.parser")
        rows = []
        for table in soup.find_all("table"):
            for tr in table.find_all("tr"):
                cells = tr.find_all(["td", "th"])
                if not cells:
                    continue
                text = " ".join(c.get_text(strip=True) for c in cells)
                rfcs = RFC_PATTERN.findall(text.upper())
                # Try to get razon_social from adjacent cell (often next to RFC)
                razon = None
                for c in cells:
                    t = c.get_text(strip=True)
                    if RFC_PATTERN.match(t) and len(cells) > 1:
                        idx = cells.index(c)
                        if idx + 1 < len(cells):
                            razon = cells[idx + 1].get_text(strip=True)[:300]
                        break
                for rfc in rfcs:
                    rows.append({
                        "source": "sat_datos_abiertos",
                        "source_url": source_url,
                        "dof_url": None,
                        "rfc": rfc,
                        "razon_social": razon,
                        "article_type": article_type,
                        "status": None,
                        "category": None,
                        "oficio_number": None,
                        "authority": "SAT",
                        "motivo": text[:500] if len(text) <= 500 else None,
                        "published_at": None,
                        "raw_snippet": text[:1000],
                    })
        return rows

    @classmethod
    def parse_links_to_data(cls, html: str, base_url: str) -> List[str]:
        """Extract links to Excel/CSV/PDF that might contain RFC lists."""
        soup = BeautifulSoup(html, "html.parser")
        links = []
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            lower = href.lower()
            if any(lower.endswith(ext) for ext in (".xlsx", ".xls", ".csv", ".pdf")):
                if not href.startswith("http"):
                    href = base_url.rsplit("/", 1)[0] + "/" + href.lstrip("/")
                links.append(href)
        return list(dict.fromkeys(links))

    @classmethod
    async def run(cls, limit_per_page: int = 500) -> List[Dict[str, Any]]:
        """
        Fetch each SAT Datos Abiertos page, parse tables for RFCs, return
        list of notice dicts for PublicNotice upsert.
        """
        all_notices = []
        for path, label in SAT_PAGES:
            html = await cls.fetch_page(path)
            if not html:
                continue
            url = cls._url(path)
            # Map page to article type for screening
            if "contribuyentes_publicados" in label:
                article_type = "art_69b"
            elif "controversia" in label:
                article_type = "art_69"
            else:
                article_type = "art_69b"
            notices = cls.parse_tables_for_rfcs(html, url, article_type)
            # Dedupe by RFC per page
            seen = set()
            for n in notices[:limit_per_page]:
                key = (n["rfc"], n["source_url"])
                if key not in seen:
                    seen.add(key)
                    all_notices.append(n)
            logger.info("SAT Datos Abiertos %s: %s notices", label, len(notices))
        return all_notices
