"""
Previa App — SAT Datos Abiertos fetcher.
Downloads the actual Excel/CSV files from SAT Datos Abiertos landing pages
and parses them with pandas to extract RFCs + statuses for each article type.

Landing pages:
  - http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/contribuyentes_publicados.html
  - http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/controversia.html
  - http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/sat_mas_abierto.html

Each page contains download links (.xlsx, .csv) to the real datasets.
"""

import io
import logging
import re
import zipfile
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urljoin

import httpx
import pandas as pd
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

SAT_BASE = "http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos"

# Headers that mimic a regular browser — needed because the SAT server blocks
# plain bot requests and some endpoints redirect to HTTPS with certificate
# chains that may not be trusted in the Railway container.
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
}

SAT_PAGES = [
    ("contribuyentes_publicados.html", "contribuyentes_publicados"),
    ("controversia.html", "controversia"),
    ("sat_mas_abierto.html", "sat_mas_abierto"),
]

RFC_PATTERN = re.compile(r"\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b")

# Extensions we treat as downloadable (including ZIP for archive extraction).
DOWNLOAD_EXTS = (".xlsx", ".xls", ".csv", ".zip")

# Known SAT file URLs used when HTML yields no usable links or no notices.
# Format: (path_or_full_url, article_type, status). Paths are joined with SAT_BASE.
KNOWN_SAT_FILES: List[Tuple[str, str, Optional[str]]] = [
    ("Lista69B_Definitivos.zip", "art_69b", "definitivo"),
    ("Lista69B_Presuntos.zip", "art_69b", "presunto"),
    ("Lista69B_Desvirtuados.zip", "art_69b", "desvirtuado"),
    ("Firmes.zip", "art_69", "credito_firme"),
    ("NoLocalizados.zip", "art_69", "no_localizado"),
    ("Cancelados.zip", "art_69", "credito_cancelado"),
    ("Sentencias.zip", "art_69", "sentencia_condenatoria"),
]

# ── Mapping: link text keywords → (article_type, status/category) ──────────
# The SAT page link text (anchor inner text) identifies which list is being
# linked.  We match case-insensitively.  Order matters: first match wins.
# See: http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/contribuyentes_publicados.html

FILE_CLASSIFICATION: List[Tuple[str, str, Optional[str]]] = [
    # Art. 69-B
    ("definitivo",            "art_69b",  "definitivo"),
    ("presunto",              "art_69b",  "presunto"),
    ("desvirtuado",           "art_69b",  "desvirtuado"),
    ("sentencia favorable",   "art_69b",  "sentencia_favorable"),
    ("sentencias favorable",  "art_69b",  "sentencia_favorable"),
    ("listado completo",      "art_69b",  None),             # mixed statuses

    # Art. 69-B Bis
    ("listado global",        "art_69_bis", "definitivo"),
    ("69-b bis",              "art_69_bis", None),

    # Art. 69 — contribuyentes publicados (todos los listados del Art. 69 CFF)
    ("firme",                 "art_69",   "credito_firme"),
    ("no localizado",         "art_69",   "no_localizado"),
    ("cancelado",             "art_69",   "credito_cancelado"),
    ("sentencia",             "art_69",   "sentencia_condenatoria"),
    ("exigible",              "art_69",   "credito_firme"),
    ("csd sin efecto",        "art_69",   None),
    ("entes públicos",        "art_69",   None),
    ("gobierno omisos",       "art_69",   None),
    ("omisos",                "art_69",   None),
    ("retorno",               "art_69",   None),
    ("inversiones",           "art_69",   None),            # retorno de inversiones
    ("condonado",             "art_69",   "credito_cancelado"),
    ("concurso mercantil",    "art_69",   "credito_cancelado"),  # Art. 146B
    ("146b",                  "art_69",   "credito_cancelado"),
    ("por decreto",           "art_69",   "credito_cancelado"),
    ("146a",                  "art_69",   "credito_cancelado"),  # Cancelados Art. 146A
    ("reducción de multa",    "art_69",   "credito_cancelado"),
    ("reducción de recargo",  "art_69",   "credito_cancelado"),
    ("artículo 74",           "art_69",   "credito_cancelado"),
    ("artículo 21",           "art_69",   "credito_cancelado"),
]


def _classify_link(link_text: str) -> Tuple[str, Optional[str]]:
    """Return (article_type, status_or_category) for a download link."""
    text = link_text.lower().strip()
    for keyword, article_type, status in FILE_CLASSIFICATION:
        if keyword in text:
            return article_type, status
    return "art_69b", None


def _find_rfc_column(df: pd.DataFrame) -> Optional[str]:
    """Locate the column that holds RFCs (by name heuristic or content sampling)."""
    for col in df.columns:
        name = str(col).strip().upper()
        if name in ("RFC", "R.F.C.", "RFC_CONTRIBUYENTE", "RFC CONTRIBUYENTE"):
            return str(col)

    for col in df.columns:
        sample = df[col].dropna().head(20).astype(str)
        matches = sample.apply(lambda v: bool(RFC_PATTERN.fullmatch(v.strip().upper())))
        if matches.sum() >= max(1, len(sample) * 0.4):
            return str(col)
    return None


def _find_razon_column(df: pd.DataFrame, rfc_col: str) -> Optional[str]:
    """Best-effort: find the 'razon social' or 'nombre' column."""
    for col in df.columns:
        name = str(col).strip().upper()
        if col == rfc_col:
            continue
        if any(kw in name for kw in ("RAZON", "RAZÓN", "NOMBRE", "DENOMINACION", "DENOMINACIÓN")):
            return str(col)
    return None


def _find_status_column(df: pd.DataFrame) -> Optional[str]:
    """Find a column that might contain the status (presunto/definitivo/etc.)."""
    for col in df.columns:
        name = str(col).strip().upper()
        if any(kw in name for kw in ("SITUACION", "SITUACIÓN", "ESTATUS", "STATUS", "SUPUESTO")):
            return str(col)
    return None


class SATDatosAbiertosFetcher:
    """Fetch SAT Datos Abiertos landing pages, download linked Excel/CSV files,
    and parse them to extract RFC + classification data."""

    TIMEOUT = 60.0
    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB cap per file (prevents memory saturation on startup)

    @classmethod
    def _url(cls, path: str) -> str:
        if path.startswith("http"):
            return path
        return f"{SAT_BASE}/{path}"

    @classmethod
    async def _get(cls, url: str, timeout: float | None = None) -> httpx.Response:
        # verify=False: SAT/government servers often have self-signed or expired
        # intermediate certs that cause SSL handshake failures in containers.
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=timeout or cls.TIMEOUT,
            verify=False,
            headers=_BROWSER_HEADERS,
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp

    # ── Step 1: fetch landing page and extract download links ─────────────

    @classmethod
    async def fetch_page(cls, path: str) -> Optional[str]:
        url = cls._url(path)
        try:
            resp = await cls._get(url, timeout=25.0)
            return resp.text
        except Exception as e:
            logger.warning("SAT fetch %s failed: %s", url, e)
            return None

    @classmethod
    def extract_download_links(cls, html: str, base_url: str) -> List[Dict[str, str]]:
        """Extract download links (.xlsx, .xls, .csv, .zip) with their anchor text."""
        soup = BeautifulSoup(html, "html.parser")
        links: List[Dict[str, str]] = []
        seen = set()
        for a in soup.find_all("a", href=True):
            href = a.get("href", "").strip()
            lower = href.lower()
            if not any(lower.endswith(ext) for ext in DOWNLOAD_EXTS):
                continue
            if not href.startswith("http"):
                href = urljoin(base_url, href)
            if href in seen:
                continue
            seen.add(href)
            text = a.get_text(strip=True) or ""
            parent_text = ""
            for parent in a.parents:
                if parent.name in ("li", "p", "td", "div"):
                    parent_text = parent.get_text(strip=True)[:300]
                    break
            links.append({
                "url": href,
                "link_text": text,
                "context_text": parent_text,
            })
        return links

    # ── Step 2: download and parse a single file ─────────────────────────

    @classmethod
    async def download_file(cls, url: str, referer: Optional[str] = None) -> Optional[bytes]:
        try:
            headers = dict(_BROWSER_HEADERS)
            if referer:
                headers["Referer"] = referer
            async with httpx.AsyncClient(
                follow_redirects=True,
                timeout=cls.TIMEOUT,
                verify=False,
                headers=headers,
            ) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.content
            if len(data) > cls.MAX_FILE_SIZE:
                logger.warning("SAT file %s exceeds size limit (%d bytes), skipping", url, len(data))
                return None
            return data
        except Exception as e:
            logger.warning("SAT download %s failed: %s", url, e)
            return None

    @classmethod
    def _parse_single_sheet(cls, data: bytes, name: str) -> Optional[pd.DataFrame]:
        """Parse a single Excel/CSV buffer (e.g. from a ZIP member)."""
        lower = name.lower()
        try:
            if lower.endswith(".csv"):
                for enc in ("utf-8", "latin-1", "cp1252"):
                    try:
                        return pd.read_csv(io.BytesIO(data), encoding=enc, dtype=str)
                    except UnicodeDecodeError:
                        continue
                return pd.read_csv(io.BytesIO(data), encoding="latin-1", dtype=str, on_bad_lines="skip")
            elif lower.endswith(".xlsx"):
                return pd.read_excel(io.BytesIO(data), engine="openpyxl", dtype=str)
            elif lower.endswith(".xls"):
                return pd.read_excel(io.BytesIO(data), engine="xlrd", dtype=str)
        except Exception as e:
            logger.warning("SAT parse member %s failed: %s", name, e)
        return None

    @classmethod
    def parse_file_to_df(cls, data: bytes, url: str) -> Optional[pd.DataFrame]:
        """Read bytes into a pandas DataFrame (Excel, CSV, or ZIP with inner .xlsx/.xls/.csv)."""
        lower = url.lower()
        # ZIP: by URL or by magic (PK\x03\x04)
        if lower.endswith(".zip") or (len(data) >= 4 and data[:4] == b"PK\x03\x04"):
            try:
                with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
                    dfs: List[pd.DataFrame] = []
                    for name in zf.namelist():
                        if not any(name.lower().endswith(ext) for ext in (".xlsx", ".xls", ".csv")):
                            continue
                        member_data = zf.read(name)
                        df = cls._parse_single_sheet(member_data, name)
                        if df is not None and not df.empty:
                            dfs.append(df)
                    if not dfs:
                        return None
                    return pd.concat(dfs, ignore_index=True)
            except Exception as e:
                logger.warning("SAT ZIP %s failed: %s", url, e)
                return None
        try:
            if lower.endswith(".csv"):
                for enc in ("utf-8", "latin-1", "cp1252"):
                    try:
                        return pd.read_csv(io.BytesIO(data), encoding=enc, dtype=str)
                    except UnicodeDecodeError:
                        continue
                return pd.read_csv(io.BytesIO(data), encoding="latin-1", dtype=str, on_bad_lines="skip")
            elif lower.endswith(".xlsx"):
                return pd.read_excel(io.BytesIO(data), engine="openpyxl", dtype=str)
            elif lower.endswith(".xls"):
                return pd.read_excel(io.BytesIO(data), engine="xlrd", dtype=str)
        except Exception as e:
            logger.warning("SAT parse %s failed: %s", url, e)
        return None

    @classmethod
    def extract_notices_from_df(
        cls,
        df: pd.DataFrame,
        source_url: str,
        article_type: str,
        default_status: Optional[str],
    ) -> List[Dict[str, Any]]:
        """Convert a DataFrame into a list of notice dicts for PublicNotice."""
        rfc_col = _find_rfc_column(df)
        if not rfc_col:
            logger.info("No RFC column found in %s (%d rows, cols=%s)", source_url, len(df), list(df.columns)[:10])
            return []

        razon_col = _find_razon_column(df, rfc_col)
        status_col = _find_status_column(df) if default_status is None else None

        notices = []
        for _, row in df.iterrows():
            raw_rfc = str(row.get(rfc_col, "")).strip().upper()
            if not RFC_PATTERN.fullmatch(raw_rfc):
                continue

            razon = str(row[razon_col]).strip()[:300] if razon_col and pd.notna(row.get(razon_col)) else None

            status = default_status
            if status_col and pd.notna(row.get(status_col)):
                status = str(row[status_col]).strip().lower()

            notices.append({
                "source": "sat_datos_abiertos",
                "source_url": source_url,
                "dof_url": None,
                "rfc": raw_rfc,
                "razon_social": razon,
                "article_type": article_type,
                "status": status,
                "category": status if article_type == "art_69" else None,
                "oficio_number": None,
                "authority": "SAT",
                "motivo": None,
                "published_at": None,
                "raw_snippet": None,
            })
        return notices

    # ── Step 3: orchestrate ──────────────────────────────────────────────

    @classmethod
    async def run(cls, max_files: int = 10) -> List[Dict[str, Any]]:
        """
        Fetch each SAT Datos Abiertos landing page, discover download links,
        download Excel/CSV/ZIP files, parse them, and return notice dicts.
        contribuyentes_publicados.html is processed first and contains the main
        Art. 69 / 69-B / 69-B Bis lists; screening tools use this data to
        validate flags and assess severity (risk score).
        """
        all_notices: List[Dict[str, Any]] = []
        files_processed = 0

        for path, label in SAT_PAGES:
            html = await cls.fetch_page(path)
            if not html:
                continue

            base_url = cls._url(path)
            links = cls.extract_download_links(html, base_url)
            logger.info("SAT %s: found %d download links", label, len(links))

            for link in links:
                if files_processed >= max_files:
                    break

                context = link["link_text"] or link["context_text"]
                article_type, status = _classify_link(context)

                logger.info("SAT downloading: %s [%s / %s]", link["url"][-60:], article_type, status)
                data = await cls.download_file(link["url"], referer=base_url)
                if data is None:
                    continue

                df = cls.parse_file_to_df(data, link["url"])
                if df is None or df.empty:
                    continue

                notices = cls.extract_notices_from_df(df, link["url"], article_type, status)
                logger.info("SAT %s: parsed %d RFCs from %s", label, len(notices), link["url"][-50:])
                all_notices.extend(notices)
                files_processed += 1

            if files_processed >= max_files:
                break

        # Fallback: if no links or no notices from HTML, try known SAT file URLs.
        landing_url = cls._url("index.html")
        if (not all_notices or files_processed == 0) and files_processed < max_files:
            for path_or_url, article_type, status in KNOWN_SAT_FILES:
                if files_processed >= max_files:
                    break
                url = cls._url(path_or_url) if not path_or_url.startswith("http") else path_or_url
                logger.info("SAT fallback: %s [%s / %s]", url[-60:], article_type, status)
                data = await cls.download_file(url, referer=landing_url)
                if data is None:
                    continue
                df = cls.parse_file_to_df(data, url)
                if df is None or df.empty:
                    continue
                notices = cls.extract_notices_from_df(df, url, article_type, status)
                logger.info("SAT fallback: %d RFCs from %s", len(notices), url[-50:])
                all_notices.extend(notices)
                files_processed += 1

        logger.info("SAT Datos Abiertos total: %d notices from %d files", len(all_notices), files_processed)
        return all_notices
