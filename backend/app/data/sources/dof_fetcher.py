"""
Previa App — DOF (Diario Oficial de la Federación) fetcher.
Fetches https://dof.gob.mx/ and edition pages (MAT + SUP) for SAT/SHCP-related
notices to index for alert generation.

Improvements over v1:
- Parses HTML tables from detail pages to extract (RFC, razon_social) pairs
- Classifies article_type from notice title (69-B, 69, 69-B Bis, 49 BIS)
- Extracts status (presunto, definitivo, desvirtuado, etc.) from title
- Fetches both MAT and SUP editions
- Default lookback: 30 days
"""

import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
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

DOF_BASE = "https://www.dof.gob.mx"
DOF_INDEX = "https://www.dof.gob.mx/index.php"
DOF_EDITION_TEMPLATE = "https://www.dof.gob.mx/index.php?year={year}&month={month}&day={day}&edicion={edicion}"
NOTA_PATTERN = re.compile(r"nota_detalle\.php\?codigo=(\d+)&(?:amp;)?fecha=([\d/]+)", re.I)
RFC_PATTERN = re.compile(r"\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b")

SAT_KEYWORDS = (
    "SAT", "69-B", "69 BIS", "EFOS", "operaciones presuntamente inexistentes",
    "contribuyentes publicados", "artículo 69", "artículo 69-B", "SHCP", "Hacienda",
    "incumplido", "no localizado", "crédito fiscal", "pérdidas fiscales",
    "49 bis", "facturación", "operaciones simuladas", "sello digital",
)

# Edition types to fetch (MAT = matutina, SUP = suplemento)
DOF_EDITIONS = ("MAT", "SUP")

# ── Article type + status classification from notice titles ──────────────────

_ARTICLE_RULES: List[Tuple[str, str, Optional[str]]] = [
    # Art 69-B Bis (must come before 69-B to avoid false match)
    ("69-b bis",                "art_69_bis",  None),
    ("69 b bis",                "art_69_bis",  None),
    ("pérdidas fiscales",       "art_69_bis",  None),
    # Art 69-B
    ("69-b",                    "art_69b",     None),
    ("efos",                    "art_69b",     None),
    ("operaciones presuntamente inexistentes", "art_69b", None),
    ("operaciones simuladas",   "art_69b",     None),
    ("operaciones inexistentes","art_69b",     None),
    # Art 49 BIS
    ("49 bis",                  "art_49_bis",  None),
    ("49-bis",                  "art_49_bis",  None),
    # Art 69 (generic)
    ("artículo 69",             "art_69",      None),
    ("contribuyentes incumplidos", "art_69",   None),
    ("no localizado",           "art_69",      "no_localizado"),
    ("crédito fiscal firme",    "art_69",      "credito_firme"),
    ("créditos fiscales",       "art_69",      "credito_firme"),
    ("sello digital",           "art_69",      "csd_sin_efectos"),
]

_STATUS_HINTS: List[Tuple[str, str]] = [
    ("presunto",                "presunto"),
    ("definitivo",              "definitivo"),
    ("desvirtuado",             "desvirtuado"),
    ("sentencia favorable",     "sentencia_favorable"),
    ("sentencias favorable",    "sentencia_favorable"),
    ("sentencia condenatoria",  "sentencia_condenatoria"),
    ("no localizado",           "no_localizado"),
    ("cancelado",               "credito_cancelado"),
    ("firme",                   "credito_firme"),
]


def _classify_notice(title: str) -> Tuple[str, Optional[str]]:
    """Return (article_type, status) based on notice title keywords."""
    t = title.lower()
    article_type = "art_69b"  # DOF SAT notices are most commonly 69-B
    status: Optional[str] = None

    for keyword, art, st in _ARTICLE_RULES:
        if keyword in t:
            article_type = art
            if st:
                status = st
            break

    if status is None:
        for keyword, st in _STATUS_HINTS:
            if keyword in t:
                status = st
                break

    return article_type, status


class DOFFetcher:
    """Fetch and parse DOF for public notices relevant to fiscal compliance."""

    @classmethod
    async def fetch_index(cls) -> str:
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=30.0, verify=False, headers=_BROWSER_HEADERS
        ) as client:
            resp = await client.get(DOF_INDEX)
            resp.raise_for_status()
            return resp.text

    @classmethod
    async def fetch_edition(cls, year: int, month: int, day: int, edicion: str = "MAT") -> Optional[str]:
        url = DOF_EDITION_TEMPLATE.format(year=year, month=month, day=day, edicion=edicion)
        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=30.0, verify=False, headers=_BROWSER_HEADERS
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.text
        except Exception as e:
            logger.debug("DOF edition %s fetch failed: %s", url, e)
            return None

    @classmethod
    def parse_notice_links(cls, html: str) -> List[Dict[str, str]]:
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
    async def fetch_notice_detail(cls, codigo: str, fecha: str) -> str:
        url = f"{DOF_BASE}/nota_detalle.php?codigo={codigo}&fecha={fecha}"
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=25.0, verify=False, headers=_BROWSER_HEADERS
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.text

    # ── Structured extraction from detail pages ────────────────────────────

    @classmethod
    def extract_rfcs_from_html(cls, html: str) -> List[str]:
        text = BeautifulSoup(html, "html.parser").get_text()
        return list(set(RFC_PATTERN.findall(text.upper())))

    @classmethod
    def extract_table_entries(cls, html: str) -> List[Dict[str, Optional[str]]]:
        """Parse HTML tables for (RFC, razon_social) pairs.

        DOF Art 69-B lists typically contain <table> elements with columns for
        RFC and Razón Social / Denominación.  We look for header rows that
        contain those keywords and extract matching cells.
        """
        soup = BeautifulSoup(html, "html.parser")
        entries: List[Dict[str, Optional[str]]] = []
        seen_rfcs: set = set()

        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if not rows:
                continue

            rfc_idx: Optional[int] = None
            razon_idx: Optional[int] = None

            for row in rows:
                cells = row.find_all(["th", "td"])
                cell_texts = [(c.get_text(strip=True) or "").upper() for c in cells]

                # Detect header row
                if rfc_idx is None:
                    for i, t in enumerate(cell_texts):
                        if t in ("RFC", "R.F.C.", "RFC CONTRIBUYENTE", "CLAVE RFC", "RFC_CONTRIBUYENTE"):
                            rfc_idx = i
                        if any(kw in t for kw in ("RAZON", "RAZÓN", "NOMBRE", "DENOMINACION", "DENOMINACIÓN")):
                            razon_idx = i
                    if rfc_idx is not None:
                        continue

                if rfc_idx is None:
                    continue

                if rfc_idx >= len(cells):
                    continue

                rfc_text = cells[rfc_idx].get_text(strip=True).upper()
                m = RFC_PATTERN.search(rfc_text)
                if not m:
                    continue
                rfc = m.group(1)
                if rfc in seen_rfcs:
                    continue
                seen_rfcs.add(rfc)

                razon: Optional[str] = None
                if razon_idx is not None and razon_idx < len(cells):
                    razon = cells[razon_idx].get_text(strip=True)[:300] or None

                entries.append({"rfc": rfc, "razon_social": razon})

        return entries

    @classmethod
    def _extract_entities(cls, detail_html: str) -> List[Dict[str, Optional[str]]]:
        """Extract (RFC, razon_social) from a detail page.

        Tries structured table parsing first; falls back to regex RFC extraction.
        """
        table_entries = cls.extract_table_entries(detail_html)
        if table_entries:
            return table_entries

        rfcs = cls.extract_rfcs_from_html(detail_html)
        return [{"rfc": rfc, "razon_social": None} for rfc in rfcs]

    # ── Main entry point ──────────────────────────────────────────────────

    @classmethod
    async def run(cls, limit_notices: int = 100, edition_days_back: int = 30) -> List[Dict[str, Any]]:
        """
        Fetch DOF index + recent MAT and SUP edition pages, filter SAT-related
        notices, fetch detail pages, extract (RFC, razon_social), classify
        article_type and status.
        """
        notices_for_db: List[Dict[str, Any]] = []
        try:
            all_links: List[Dict[str, str]] = []

            html = await cls.fetch_index()
            all_links.extend(cls.parse_notice_links(html))
            logger.info("DOF index: parsed %s notice links", len(all_links))

            today = datetime.utcnow().date()
            for i in range(edition_days_back):
                d = today - timedelta(days=i)
                for edicion in DOF_EDITIONS:
                    edition_html = await cls.fetch_edition(d.year, d.month, d.day, edicion)
                    if edition_html:
                        all_links.extend(cls.parse_notice_links(edition_html))

            seen_codigo: set = set()
            links: List[Dict[str, str]] = []
            for item in all_links:
                if item["codigo"] not in seen_codigo:
                    seen_codigo.add(item["codigo"])
                    links.append(item)
            logger.info("DOF total (index + editions): %s unique notice links", len(links))

            sat_related = cls.filter_sat_related(links[:limit_notices * 2])
            to_fetch = sat_related[:limit_notices]

            for item in to_fetch:
                try:
                    detail_html = await cls.fetch_notice_detail(item["codigo"], item["fecha"])
                    article_type, status = _classify_notice(item.get("title") or "")
                    entities = cls._extract_entities(detail_html)

                    for ent in entities[:200]:
                        notices_for_db.append({
                            "source": "dof",
                            "source_url": item["url"],
                            "dof_url": item["url"],
                            "rfc": ent["rfc"],
                            "razon_social": ent.get("razon_social"),
                            "article_type": article_type,
                            "status": status,
                            "oficio_number": None,
                            "authority": "SAT/SHCP",
                            "motivo": (item.get("title") or "")[:500],
                            "published_at": cls._parse_fecha(item.get("fecha")),
                            "raw_snippet": (item.get("title") or "")[:1000],
                        })
                    if not entities:
                        notices_for_db.append({
                            "source": "dof",
                            "source_url": item["url"],
                            "dof_url": item["url"],
                            "rfc": None,
                            "razon_social": None,
                            "article_type": article_type,
                            "status": status,
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
    def _parse_fecha(fecha: str) -> Optional[datetime]:
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
