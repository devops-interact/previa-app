"""
Previa App — Leyes Federales fetcher.
Scrapes https://www.diputados.gob.mx/LeyesBiblio/index.htm to track reform dates
for tax/compliance-relevant federal laws and detect recent changes.
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

LEYES_BASE = "https://www.diputados.gob.mx/LeyesBiblio"
LEYES_INDEX = f"{LEYES_BASE}/index.htm"

TRACKED_LAWS = {
    "CFF": "Código Fiscal de la Federación",
    "ISR": "Impuesto sobre la Renta",
    "LIVA": "Impuesto al Valor Agregado",
    "LIEPS": "Impuesto Especial sobre Producción y Servicios",
    "LFPIORPI": "Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita",
    "LIF": "Ingresos de la Federación",
    "LSAT": "Servicio de Administración Tributaria",
    "LFISAN": "Impuesto sobre Automóviles Nuevos",
    "LIC": "Instituciones de Crédito",
    "LGSM": "Sociedades Mercantiles",
    "LMV": "Mercado de Valores",
    "LFPC": "Protección al Consumidor",
    "LGRA": "Responsabilidades Administrativas",
    "LGSNA": "Sistema Nacional Anticorrupción",
    "LFPPI": "Protección a la Propiedad Industrial",
    "LFD": "Derechos",
    "LFPRH": "Presupuesto y Responsabilidad Hacendaria",
    "LCF": "Coordinación Fiscal",
    "LADUA": "Aduanera",
    "LCM": "Concursos Mercantiles",
}

_MONTH_MAP = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}

DOF_DATE_PATTERN = re.compile(
    r"DOF\s+(\d{1,2})/(\d{1,2})/(\d{4})", re.I
)


def _parse_dof_date(text: str) -> Optional[datetime]:
    """Parse 'DOF dd/mm/yyyy' format from Última Reforma column."""
    m = DOF_DATE_PATTERN.search(text)
    if m:
        try:
            return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    m2 = re.search(r"(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})", text)
    if m2:
        try:
            return datetime(int(m2.group(3)), int(m2.group(2)), int(m2.group(1)))
        except ValueError:
            pass
    return None


def _is_tracked_law(text: str) -> Optional[str]:
    """Check if a law name matches any tracked law. Returns the law code or None."""
    upper = text.upper()
    for code, name_fragment in TRACKED_LAWS.items():
        if code.upper() in upper or name_fragment.upper() in upper:
            return code
    return None


class LeyesFederalesFetcher:
    """Track reform dates for tax-relevant Mexican federal laws."""

    @classmethod
    async def _fetch_page(cls, url: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=30.0, verify=False, headers=_BROWSER_HEADERS
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                content = resp.content
                for encoding in ("utf-8", "latin-1", "cp1252"):
                    try:
                        return content.decode(encoding)
                    except (UnicodeDecodeError, ValueError):
                        continue
                return content.decode("utf-8", errors="replace")
        except Exception as e:
            logger.debug("LeyesFederales fetch failed for %s: %s", url, e)
            return None

    @classmethod
    def _parse_law_table(cls, html: str) -> List[Dict[str, Any]]:
        """Parse the main index table to extract law names, reform dates, and links."""
        soup = BeautifulSoup(html, "html.parser")
        laws: List[Dict[str, Any]] = []

        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            for row in rows:
                cells = row.find_all(["td", "th"])
                if len(cells) < 3:
                    continue

                law_cell = cells[1] if len(cells) > 1 else cells[0]
                law_text = law_cell.get_text(strip=True)[:300]

                law_code = _is_tracked_law(law_text)
                if not law_code:
                    continue

                reform_text = ""
                for cell in cells[2:]:
                    ct = cell.get_text(strip=True)
                    if "DOF" in ct or re.search(r"\d{1,2}/\d{1,2}/\d{4}", ct):
                        reform_text = ct
                        break

                reform_date = _parse_dof_date(reform_text) if reform_text else None

                ref_link = None
                for a in law_cell.find_all("a", href=True):
                    href = a.get("href", "")
                    if "ref/" in href:
                        ref_link = urljoin(LEYES_INDEX, href)
                        break

                pdf_link = None
                for cell in cells:
                    for a in cell.find_all("a", href=True):
                        href = a.get("href", "")
                        if href.endswith(".pdf"):
                            pdf_link = urljoin(LEYES_INDEX, href)
                            break
                    if pdf_link:
                        break

                laws.append({
                    "code": law_code,
                    "name": law_text,
                    "reform_date": reform_date,
                    "reform_text": reform_text,
                    "ref_link": ref_link,
                    "pdf_link": pdf_link,
                })

        seen_codes: set = set()
        unique: List[Dict[str, Any]] = []
        for law in laws:
            if law["code"] not in seen_codes:
                seen_codes.add(law["code"])
                unique.append(law)

        return unique

    @classmethod
    async def _fetch_reform_details(cls, ref_url: str) -> str:
        """Fetch the reform reference page and extract a text summary."""
        html = await cls._fetch_page(ref_url)
        if not html:
            return ""
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        return text[:2000]

    @classmethod
    async def run(cls, reform_lookback_days: int = 90) -> List[Dict[str, Any]]:
        """
        Fetch the LeyesBiblio index, identify tracked laws, and generate
        notices for recently reformed ones.
        """
        notices: List[Dict[str, Any]] = []
        try:
            html = await cls._fetch_page(LEYES_INDEX)
            if not html:
                logger.warning("LeyesFederales: could not fetch index page")
                return notices

            laws = cls._parse_law_table(html)
            logger.info("LeyesFederales: found %d tracked laws in index", len(laws))

            cutoff = datetime.utcnow() - timedelta(days=reform_lookback_days)
            now = datetime.utcnow()

            for law in laws:
                try:
                    reform_date = law.get("reform_date")
                    is_recent = reform_date and reform_date >= cutoff
                    status = "reforma_reciente" if is_recent else "vigente"

                    snippet = ""
                    if is_recent and law.get("ref_link"):
                        snippet = await cls._fetch_reform_details(law["ref_link"])

                    source_url = law.get("ref_link") or law.get("pdf_link") or LEYES_INDEX
                    motivo = f"{law['code']}: {law['name']}"
                    if law.get("reform_text"):
                        motivo += f" — Última reforma: {law['reform_text']}"

                    notices.append({
                        "source": "leyes_federales",
                        "source_url": source_url,
                        "dof_url": None,
                        "rfc": None,
                        "razon_social": None,
                        "article_type": "law_reform",
                        "status": status,
                        "category": law["code"],
                        "oficio_number": None,
                        "authority": "Congreso de la Union",
                        "motivo": motivo[:500],
                        "published_at": reform_date or now,
                        "raw_snippet": snippet[:1000] if snippet else motivo[:1000],
                    })
                except Exception as e:
                    logger.warning("LeyesFederales entry failed for %s: %s", law.get("code"), e)

        except Exception as e:
            logger.error("LeyesFederales fetch failed: %s", e)

        logger.info("LeyesFederalesFetcher: returning %d notices", len(notices))
        return notices
