"""
Previa App — DOF (Diario Oficial de la Federación) fetcher.
Fetches https://dof.gob.mx/ and edition pages (index.php?year=...&month=...&day=...&edicion=MAT)
for SAT/SHCP-related notices to index for alert generation.
"""

import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

DOF_BASE = "https://www.dof.gob.mx"
DOF_INDEX = "https://www.dof.gob.mx/index.php"
# Edition URL: index.php?year=2025&month=11&day=21&edicion=MAT
DOF_EDITION_TEMPLATE = "https://www.dof.gob.mx/index.php?year={year}&month={month}&day={day}&edicion={edicion}"
# Nota detail URL pattern: nota_detalle.php?codigo=XXXXXXX&fecha=DD/MM/YYYY
NOTA_PATTERN = re.compile(r"nota_detalle\.php\?codigo=(\d+)&(?:amp;)?fecha=([\d/]+)", re.I)
# RFC pattern (13 chars: 3-4 letters, 6 digits, 3 alphanum)
RFC_PATTERN = re.compile(r"\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b")
# Keywords that suggest SAT/69-B/EFOS content
SAT_KEYWORDS = ("SAT", "69-B", "69 BIS", "EFOS", "operaciones presuntamente inexistentes",
                "contribuyentes publicados", "artículo 69", "artículo 69-B", "SHCP", "Hacienda")


class DOFFetcher:
    """Fetch and parse DOF for public notices relevant to fiscal compliance."""

    @classmethod
    async def fetch_index(cls) -> str:
        """Fetch DOF index/main page HTML."""
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            resp = await client.get(DOF_INDEX)
            resp.raise_for_status()
            return resp.text

    @classmethod
    async def fetch_edition(cls, year: int, month: int, day: int, edicion: str = "MAT") -> str | None:
        """Fetch a specific DOF edition page (e.g. index.php?year=2025&month=11&day=21&edicion=MAT)."""
        url = DOF_EDITION_TEMPLATE.format(year=year, month=month, day=day, edicion=edicion)
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.text
        except Exception as e:
            logger.warning("DOF edition %s fetch failed: %s", url, e)
            return None

    @classmethod
    def parse_notice_links(cls, html: str) -> List[Dict[str, str]]:
        """Extract notice links (codigo, fecha) from DOF HTML."""
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
                })
        # Deduplicate by codigo
        seen = set()
        unique = []
        for item in links:
            if item["codigo"] not in seen:
                seen.add(item["codigo"])
                unique.append(item)
        return unique

    @classmethod
    def filter_sat_related(cls, notices: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Keep only notices whose title suggests SAT/SHCP/69-B content."""
        out = []
        for n in notices:
            title_upper = (n.get("title") or "").upper()
            if any(kw.upper() in title_upper for kw in SAT_KEYWORDS):
                out.append(n)
        return out

    @classmethod
    async def fetch_notice_detail(cls, codigo: str, fecha: str) -> str:
        """Fetch a single DOF notice page to extract RFCs and snippet."""
        url = f"{DOF_BASE}/nota_detalle.php?codigo={codigo}&fecha={fecha}"
        async with httpx.AsyncClient(follow_redirects=True, timeout=25.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text

    @classmethod
    def extract_rfcs_from_html(cls, html: str) -> List[str]:
        """Extract RFC-like tokens from HTML text."""
        text = BeautifulSoup(html, "html.parser").get_text()
        return list(set(RFC_PATTERN.findall(text.upper())))

    @classmethod
    async def run(cls, limit_notices: int = 100, edition_days_back: int = 14) -> List[Dict[str, Any]]:
        """
        Fetch DOF index and recent edition pages (index.php?year=...&month=...&day=...&edicion=MAT),
        parse notice links, filter SAT-related, fetch detail pages to extract RFCs.
        Returns list of notice dicts suitable for PublicNotice upsert.
        """
        notices_for_db = []
        try:
            all_links = []
            # 1) Main index
            html = await cls.fetch_index()
            all_links.extend(cls.parse_notice_links(html))
            logger.info("DOF index: parsed %s notice links", len(all_links))

            # 2) Recent edition pages (e.g. index.php?year=2025&month=11&day=21&edicion=MAT)
            today = datetime.utcnow().date()
            for i in range(edition_days_back):
                d = today - timedelta(days=i)
                edition_html = await cls.fetch_edition(d.year, d.month, d.day, "MAT")
                if edition_html:
                    edition_links = cls.parse_notice_links(edition_html)
                    all_links.extend(edition_links)
            # Deduplicate by codigo
            seen_codigo = set()
            links = []
            for item in all_links:
                if item["codigo"] not in seen_codigo:
                    seen_codigo.add(item["codigo"])
                    links.append(item)
            logger.info("DOF total (index + editions): %s unique notice links", len(links))

            sat_related = cls.filter_sat_related(links[: limit_notices * 2])
            # Limit how many we actually fetch for RFC extraction
            to_fetch = sat_related[:limit_notices]
            for item in to_fetch:
                try:
                    detail_html = await cls.fetch_notice_detail(item["codigo"], item["fecha"])
                    rfcs = cls.extract_rfcs_from_html(detail_html)
                    for rfc in rfcs[:50]:  # cap RFCs per notice
                        notices_for_db.append({
                            "source": "dof",
                            "source_url": item["url"],
                            "dof_url": item["url"],
                            "rfc": rfc,
                            "razon_social": None,
                            "article_type": "art_69b",  # DOF notices often 69-B
                            "status": None,
                            "oficio_number": None,
                            "authority": "SAT/SHCP",
                            "motivo": (item.get("title") or "")[:500],
                            "published_at": cls._parse_fecha(item.get("fecha")),
                            "raw_snippet": (item.get("title") or "")[:1000],
                        })
                    if not rfcs:
                        # Still store notice so we have the DOF link for manual lookup
                        notices_for_db.append({
                            "source": "dof",
                            "source_url": item["url"],
                            "dof_url": item["url"],
                            "rfc": None,
                            "razon_social": None,
                            "article_type": "art_69b",
                            "status": None,
                            "oficio_number": None,
                            "authority": "SAT/SHCP",
                            "motivo": (item.get("title") or "")[:500],
                            "published_at": cls._parse_fecha(item.get("fecha")),
                            "raw_snippet": (item.get("title") or "")[:1000],
                        })
                except Exception as e:
                    logger.warning("DOF notice %s fetch failed: %s", item.get("codigo"), e)
        except Exception as e:
            logger.error("DOF fetch failed: %s", e)
        return notices_for_db

    @staticmethod
    def _parse_fecha(fecha: str) -> datetime | None:
        """Parse DD/MM/YYYY or DD/MM/YY to datetime."""
        if not fecha:
            return None
        try:
            parts = fecha.replace(" ", "").split("/")
            if len(parts) != 3:
                return None
            d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
            if y < 100:
                y += 2000
            return datetime(y, m, d)
        except (ValueError, IndexError):
            return None
