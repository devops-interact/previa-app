"""
Previa App — Article 69-B Screening Tool
Screen RFCs against SAT's Article 69-B lists (EFOS/EDOS).
Uses indexed data from DOF (dof.gob.mx) and SAT Datos Abiertos; falls back to mock for demo RFCs.
"""

import logging
from typing import Dict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.risk_rules import Art69BStatus
from app.data.db.models import PublicNotice

logger = logging.getLogger(__name__)

# Demo RFCs with known 69-B findings (used until real SAT dataset is indexed)
_MOCK_69B: Dict[str, Dict] = {
    "CAL080328S18": {
        "found": True,
        "status": Art69BStatus.DEFINITIVO,
        "razon_social": "COMERCIALIZADORA ALCAER, S.A. DE C.V.",
        "oficio_number": "500-39-00-02-02-2021-5221",
        "authority": "SAT",
        "motivo": "Ausencia de Activos, Ausencia de Personal, Falta de Infraestructura, Sin Capacidad Material",
        "publication_date": None,
        "dof_url": "https://dof.gob.mx/nota_detalle.php?codigo=5629553",
    },
    "ACA0604119X3": {
        "found": True,
        "status": Art69BStatus.PRESUNTO,
        "razon_social": "AGROEXPORT DE CAMPECHE, S.P.R. DE R.L.",
        "oficio_number": "500-05-2021-15394",
        "authority": "SAT",
        "motivo": "Operaciones Presuntamente Inexistentes",
        "publication_date": None,
        "dof_url": "https://www.dof.gob.mx/nota_detalle_popup.php?codigo=5629553",
    },
    "LAS191217BD4": {
        "found": True,
        "status": Art69BStatus.DEFINITIVO,
        "razon_social": "LEGALIDAD Y AUDITORIA 727, S.C. DE C.V.",
        "oficio_number": "SAT-700-07-2024-0012",
        "authority": "Administración Central de Fiscalización",
        "motivo": "Operaciones inexistentes confirmadas",
        "publication_date": None,
        "dof_url": "https://www.sat.gob.mx/consultas/76355/consulta-la-lista-de-contribuyentes-con-operaciones-presuntamente-inexistentes",
    },
    "BMS190313BU0": {
        "found": True,
        "status": Art69BStatus.PRESUNTO,
        "razon_social": "BMS COMERCIALIZADORA S.A. DE C.V.",
        "oficio_number": "SAT-ADR-2024-0044",
        "authority": "SAT — Administración Regional",
        "motivo": "Bajo investigación por operaciones presuntas",
        "publication_date": None,
        "dof_url": None,
    },
}


def _notice_to_69b_result(notice) -> Dict:
    """Map a PublicNotice row to the 69-B screening result dict."""
    raw = (notice.status or "").strip().lower()
    try:
        status_enum = Art69BStatus(raw) if raw else Art69BStatus.PRESUNTO
    except ValueError:
        status_enum = Art69BStatus.PRESUNTO
    return {
        "found": True,
        "status": status_enum,
        "razon_social": notice.razon_social,
        "oficio_number": notice.oficio_number,
        "authority": notice.authority,
        "motivo": notice.motivo,
        "publication_date": notice.published_at,
        "dof_url": notice.dof_url or notice.source_url,
    }


async def screen_69b(rfc: str, db: AsyncSession) -> Dict:
    """
    Screen an RFC against Article 69-B lists (EFOS/EDOS).
    First queries indexed PublicNotice (DOF + SAT Datos Abiertos); then falls back to mock.
    """
    rfc_upper = rfc.strip().upper()

    # 1) Query indexed public data (DOF, SAT Datos Abiertos)
    result = await db.execute(
        select(PublicNotice)
        .where(PublicNotice.rfc == rfc_upper, PublicNotice.article_type == "art_69b")
        .order_by(PublicNotice.indexed_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row:
        logger.info("RFC %s found in indexed Art. 69-B data (source=%s)", rfc, row.source)
        return _notice_to_69b_result(row)

    # 2) Fall back to mock for demo RFCs
    if rfc_upper in _MOCK_69B:
        logger.info("RFC %s found in Art. 69-B mock data", rfc)
        return _MOCK_69B[rfc_upper]

    logger.info("RFC %s not found in Art. 69-B lists", rfc)
    return {"found": False, "status": Art69BStatus.NOT_FOUND, "razon_social": None}
