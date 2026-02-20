"""
Previa App — SAT Certificate Checker Tool
Queries the SAT portal (portalsat.plataforma.sat.gob.mx) to retrieve the
digital‑certificate status for a given RFC.

Uses 2Captcha to solve the image CAPTCHA on the JSF form.

Flow:
  1. GET the portal page → extract session cookies, ViewState, and CAPTCHA image URL
  2. Download the CAPTCHA image and send it to 2Captcha (base64)
  3. Poll 2Captcha until the solution is ready
  4. POST the JSF form with RFC + solved CAPTCHA
  5. Parse the response HTML for certificate rows
"""

import asyncio
import base64
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional

import httpx
from bs4 import BeautifulSoup

from app.config.settings import settings
from app.config.risk_rules import CertificateStatus

logger = logging.getLogger(__name__)

PORTAL_URL = (
    "https://portalsat.plataforma.sat.gob.mx"
    "/RecuperacionDeCertificados/faces/consultaCertificados.xhtml"
)

TWOCAPTCHA_IN = "https://2captcha.com/in.php"
TWOCAPTCHA_RES = "https://2captcha.com/res.php"
TWOCAPTCHA_POLL_INTERVAL = 5  # seconds between polls
TWOCAPTCHA_MAX_WAIT = 90  # seconds total

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
}


async def check_certificate(rfc: str) -> Dict:
    """
    Query the SAT certificate portal for a given RFC.

    Returns a dict with:
        checked: bool — whether the lookup completed successfully
        status: CertificateStatus — active | expired | revoked | not_found
        serial_number: str | None
        valid_from: datetime | None
        valid_to: datetime | None
        certificates: list[dict] — all certs found (for audit trail)
        error: str | None — human-readable error when checked is False
    """
    api_key = settings.captcha_api_key
    if not api_key:
        logger.warning("CAPTCHA_API_KEY not set — skipping certificate check")
        return _error_result("CAPTCHA_API_KEY not configured")

    rfc_upper = rfc.strip().upper()
    if not rfc_upper:
        return _error_result("Empty RFC")

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30, connect=15),
            follow_redirects=True,
            verify=False,
            headers=HEADERS,
        ) as client:
            page_data = await _load_portal_page(client)
            if not page_data:
                return _error_result("Could not load portal page")

            captcha_solution = await _solve_captcha(client, api_key, page_data)
            if not captcha_solution:
                return _error_result("CAPTCHA solving failed or timed out")

            result_html = await _submit_form(
                client, rfc_upper, captcha_solution, page_data
            )
            if not result_html:
                return _error_result("Form submission failed")

            return _parse_certificates(result_html, rfc_upper)

    except httpx.TimeoutException:
        logger.error("Timeout querying SAT certificate portal for RFC %s", rfc_upper)
        return _error_result("Timeout connecting to SAT portal")
    except Exception as exc:
        logger.exception("Certificate check failed for RFC %s: %s", rfc_upper, exc)
        return _error_result(f"Unexpected error: {exc}")


# ── Step 1: Load the portal page ────────────────────────────────────────────


async def _load_portal_page(client: httpx.AsyncClient) -> Optional[Dict]:
    """GET the portal page and extract ViewState, form id, and CAPTCHA image URL."""
    resp = await client.get(PORTAL_URL)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    view_state = _extract_view_state(soup)
    if not view_state:
        logger.error("Could not extract javax.faces.ViewState from portal page")
        return None

    form = soup.find("form")
    form_id = form.get("id", "") if form else ""

    captcha_img = _find_captcha_image(soup)
    if not captcha_img:
        logger.error("Could not locate CAPTCHA image on portal page")
        return None

    rfc_input = _find_rfc_input(soup)

    captcha_input = _find_captcha_input(soup)

    submit_btn = _find_submit_button(soup)

    return {
        "view_state": view_state,
        "form_id": form_id,
        "captcha_img_url": captcha_img,
        "rfc_input_name": rfc_input,
        "captcha_input_name": captcha_input,
        "submit_btn_name": submit_btn,
        "cookies": dict(resp.cookies),
    }


def _extract_view_state(soup: BeautifulSoup) -> Optional[str]:
    tag = soup.find("input", {"name": "javax.faces.ViewState"})
    if tag:
        return tag.get("value")
    tag = soup.find("input", {"id": re.compile(r"ViewState", re.I)})
    if tag:
        return tag.get("value")
    match = re.search(
        r'name=["\']javax\.faces\.ViewState["\']\s+value=["\']([^"\']+)',
        str(soup),
    )
    return match.group(1) if match else None


def _find_captcha_image(soup: BeautifulSoup) -> Optional[str]:
    """Find the CAPTCHA <img> tag and return its absolute src URL."""
    for img in soup.find_all("img"):
        src = img.get("src", "")
        alt = (img.get("alt") or "").lower()
        img_id = (img.get("id") or "").lower()
        if any(kw in src.lower() + alt + img_id for kw in ("captcha", "capimg", "code")):
            if src.startswith("/"):
                return f"https://portalsat.plataforma.sat.gob.mx{src}"
            return src

    for img in soup.find_all("img"):
        src = img.get("src", "")
        if "RecuperacionDeCertificados" in src:
            if src.startswith("/"):
                return f"https://portalsat.plataforma.sat.gob.mx{src}"
            return src
    return None


def _find_rfc_input(soup: BeautifulSoup) -> str:
    """Find the RFC text input field name."""
    for inp in soup.find_all("input", {"type": "text"}):
        name = inp.get("name", "")
        inp_id = inp.get("id", "")
        if any(kw in (name + inp_id).lower() for kw in ("rfc", "busqueda")):
            return name
    texts = soup.find_all("input", {"type": "text"})
    if texts:
        return texts[0].get("name", "")
    return ""


def _find_captcha_input(soup: BeautifulSoup) -> str:
    """Find the CAPTCHA text input field name."""
    for inp in soup.find_all("input", {"type": "text"}):
        name = inp.get("name", "")
        inp_id = inp.get("id", "")
        if any(kw in (name + inp_id).lower() for kw in ("captcha", "capimg", "codigo", "code")):
            return name
    texts = soup.find_all("input", {"type": "text"})
    if len(texts) >= 2:
        return texts[-1].get("name", "")
    return ""


def _find_submit_button(soup: BeautifulSoup) -> str:
    """Find the submit button name for the JSF form."""
    for btn in soup.find_all("input", {"type": "submit"}):
        name = btn.get("name", "")
        if name:
            return name
    for btn in soup.find_all("button", {"type": "submit"}):
        name = btn.get("name", btn.get("id", ""))
        if name:
            return name
    for link in soup.find_all("a", onclick=True):
        onclick = link.get("onclick", "")
        match = re.search(r"mojarra\.jsfcljs\(.*?'([^']+)'", onclick)
        if match:
            return match.group(1)
    return ""


# ── Step 2: Solve CAPTCHA via 2Captcha ──────────────────────────────────────


async def _solve_captcha(
    client: httpx.AsyncClient,
    api_key: str,
    page_data: Dict,
) -> Optional[str]:
    """Download the CAPTCHA image and send it to 2Captcha for solving."""
    img_url = page_data["captcha_img_url"]
    img_resp = await client.get(img_url)
    if img_resp.status_code != 200:
        logger.error("Failed to download CAPTCHA image (HTTP %d)", img_resp.status_code)
        return None

    b64_body = base64.b64encode(img_resp.content).decode()

    submit_resp = await client.post(
        TWOCAPTCHA_IN,
        data={
            "key": api_key,
            "method": "base64",
            "body": b64_body,
            "json": "1",
        },
    )
    submit_data = submit_resp.json()
    if submit_data.get("status") != 1:
        logger.error("2Captcha submit error: %s", submit_data)
        return None

    captcha_id = submit_data["request"]
    logger.info("CAPTCHA submitted to 2Captcha — id=%s, polling...", captcha_id)

    elapsed = 0
    while elapsed < TWOCAPTCHA_MAX_WAIT:
        await asyncio.sleep(TWOCAPTCHA_POLL_INTERVAL)
        elapsed += TWOCAPTCHA_POLL_INTERVAL

        poll_resp = await client.get(
            TWOCAPTCHA_RES,
            params={"key": api_key, "action": "get", "id": captcha_id, "json": "1"},
        )
        poll_data = poll_resp.json()
        if poll_data.get("status") == 1:
            solution = poll_data["request"]
            logger.info("CAPTCHA solved: %s (took ~%ds)", solution, elapsed)
            return solution
        if poll_data.get("request") != "CAPCHA_NOT_READY":
            logger.error("2Captcha poll error: %s", poll_data)
            return None

    logger.error("2Captcha timed out after %d seconds", TWOCAPTCHA_MAX_WAIT)
    return None


# ── Step 3: Submit the form ─────────────────────────────────────────────────


async def _submit_form(
    client: httpx.AsyncClient,
    rfc: str,
    captcha_solution: str,
    page_data: Dict,
) -> Optional[str]:
    """POST the JSF form with the RFC and CAPTCHA solution, return the result HTML."""
    form_data = {
        "javax.faces.partial.ajax": "true",
        "javax.faces.ViewState": page_data["view_state"],
    }

    rfc_name = page_data["rfc_input_name"]
    captcha_name = page_data["captcha_input_name"]
    submit_name = page_data["submit_btn_name"]

    if rfc_name:
        form_data[rfc_name] = rfc
    if captcha_name:
        form_data[captcha_name] = captcha_solution
    if submit_name:
        form_data[submit_name] = submit_name

    if page_data["form_id"]:
        form_data[page_data["form_id"]] = page_data["form_id"]

    resp = await client.post(
        PORTAL_URL,
        data=form_data,
        headers={
            **HEADERS,
            "Referer": PORTAL_URL,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    if resp.status_code != 200:
        logger.error("Form submission returned HTTP %d", resp.status_code)
        return None

    return resp.text


# ── Step 4: Parse the certificate table ─────────────────────────────────────

_DATE_PATTERNS = ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S"]


def _parse_date(text: str) -> Optional[datetime]:
    clean = text.strip()
    for fmt in _DATE_PATTERNS:
        try:
            return datetime.strptime(clean, fmt)
        except ValueError:
            continue
    return None


def _parse_certificates(html: str, rfc: str) -> Dict:
    """Extract certificate rows from the portal response HTML."""
    soup = BeautifulSoup(html, "html.parser")

    error_div = soup.find(string=re.compile(
        r"no se encontr|no existen certificados|incorrecto|error",
        re.I,
    ))
    captcha_error = soup.find(string=re.compile(r"c[oó]digo.*(incorrecto|inv[aá]lido)", re.I))
    if captcha_error:
        logger.warning("CAPTCHA solution was rejected by the portal")
        return _error_result("CAPTCHA solution rejected — will retry on next sweep")

    table = soup.find("table")
    rows: List[Dict] = []

    if table:
        trs = table.find_all("tr")
        header_cells = []
        if trs:
            header_cells = [th.get_text(strip=True).lower() for th in trs[0].find_all(["th", "td"])]

        for tr in trs[1:]:
            cells = [td.get_text(strip=True) for td in tr.find_all("td")]
            if not cells:
                continue
            cert = _map_row_to_cert(cells, header_cells, rfc)
            if cert:
                rows.append(cert)

    if not rows and not error_div:
        all_text = soup.get_text(" ", strip=True)
        inline = _extract_inline_cert(all_text, rfc)
        if inline:
            rows.append(inline)

    if not rows:
        if error_div:
            return {
                "checked": True,
                "status": CertificateStatus.NOT_FOUND,
                "serial_number": None,
                "valid_from": None,
                "valid_to": None,
                "certificates": [],
                "error": None,
            }
        return _error_result("Could not parse portal response")

    latest = _pick_latest_cert(rows)
    return {
        "checked": True,
        "status": latest["status"],
        "serial_number": latest.get("serial_number"),
        "valid_from": latest.get("valid_from"),
        "valid_to": latest.get("valid_to"),
        "certificates": rows,
        "error": None,
    }


def _map_row_to_cert(
    cells: List[str],
    headers: List[str],
    rfc: str,
) -> Optional[Dict]:
    """Map a table row to a certificate dict using column headers or positional heuristic."""
    if len(cells) < 2:
        return None

    cert: Dict = {"rfc": rfc, "serial_number": None, "valid_from": None, "valid_to": None}

    if headers:
        col_map: Dict[str, int] = {}
        for i, h in enumerate(headers):
            h_lower = h.lower()
            if "serie" in h_lower or "serial" in h_lower or "número" in h_lower:
                col_map["serial"] = i
            elif "inicio" in h_lower or "desde" in h_lower or "emisi" in h_lower:
                col_map["from"] = i
            elif "fin" in h_lower or "vigencia" in h_lower or "vencimiento" in h_lower:
                col_map["to"] = i
            elif "estado" in h_lower or "status" in h_lower or "estatus" in h_lower:
                col_map["status_col"] = i

        if "serial" in col_map and col_map["serial"] < len(cells):
            cert["serial_number"] = cells[col_map["serial"]]
        if "from" in col_map and col_map["from"] < len(cells):
            cert["valid_from"] = _parse_date(cells[col_map["from"]])
        if "to" in col_map and col_map["to"] < len(cells):
            cert["valid_to"] = _parse_date(cells[col_map["to"]])
        if "status_col" in col_map and col_map["status_col"] < len(cells):
            cert["status"] = _classify_status(cells[col_map["status_col"]], cert.get("valid_to"))
        else:
            cert["status"] = _classify_status(None, cert.get("valid_to"))
    else:
        cert["serial_number"] = cells[0] if len(cells) > 0 else None
        cert["valid_from"] = _parse_date(cells[1]) if len(cells) > 1 else None
        cert["valid_to"] = _parse_date(cells[2]) if len(cells) > 2 else None
        status_text = cells[3] if len(cells) > 3 else None
        cert["status"] = _classify_status(status_text, cert.get("valid_to"))

    return cert


def _extract_inline_cert(text: str, rfc: str) -> Optional[Dict]:
    """Try to extract certificate data from free-form text when no table is present."""
    serial_match = re.search(r"(?:serie|serial|número)[:\s]*(\d{10,40})", text, re.I)
    from_match = re.search(r"(?:inicio|desde|emisi[oó]n)[:\s]*([\d/\-]+)", text, re.I)
    to_match = re.search(r"(?:fin|vigencia|vencimiento)[:\s]*([\d/\-]+)", text, re.I)

    if not serial_match and not from_match:
        return None

    cert: Dict = {"rfc": rfc}
    cert["serial_number"] = serial_match.group(1) if serial_match else None
    cert["valid_from"] = _parse_date(from_match.group(1)) if from_match else None
    cert["valid_to"] = _parse_date(to_match.group(1)) if to_match else None
    cert["status"] = _classify_status(None, cert.get("valid_to"))
    return cert


def _classify_status(
    status_text: Optional[str],
    valid_to: Optional[datetime],
) -> CertificateStatus:
    """Determine CertificateStatus from explicit status text or expiry date."""
    if status_text:
        low = status_text.lower()
        if any(kw in low for kw in ("revocado", "revoked", "cancelado")):
            return CertificateStatus.REVOKED
        if any(kw in low for kw in ("vigente", "activo", "active", "válido")):
            return CertificateStatus.ACTIVE
        if any(kw in low for kw in ("vencido", "expired", "expirado", "no vigente")):
            return CertificateStatus.EXPIRED

    if valid_to:
        return CertificateStatus.ACTIVE if valid_to > datetime.utcnow() else CertificateStatus.EXPIRED

    return CertificateStatus.NOT_FOUND


def _pick_latest_cert(certs: List[Dict]) -> Dict:
    """Choose the most recent certificate (by valid_to) from a list."""
    if len(certs) == 1:
        return certs[0]

    active = [c for c in certs if c.get("status") == CertificateStatus.ACTIVE]
    if active:
        return max(active, key=lambda c: c.get("valid_to") or datetime.min)

    return max(certs, key=lambda c: c.get("valid_to") or datetime.min)


def _expired_days(valid_to: Optional[datetime]) -> Optional[int]:
    """Return how many days ago the certificate expired, or None."""
    if not valid_to:
        return None
    delta = datetime.utcnow() - valid_to
    return max(delta.days, 0) if delta.days > 0 else None


def _error_result(msg: str) -> Dict:
    return {
        "checked": False,
        "status": CertificateStatus.NOT_FOUND,
        "serial_number": None,
        "valid_from": None,
        "valid_to": None,
        "certificates": [],
        "error": msg,
    }


def cert_expired_days(valid_to: Optional[datetime]) -> Optional[int]:
    """Public helper — used by orchestrator / risk rules to compute expiry delta."""
    return _expired_days(valid_to)
