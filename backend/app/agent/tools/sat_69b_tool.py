"""
Previa App — Article 69-B Screening Tool
Screen RFCs against SAT's Article 69-B lists (EFOS/EDOS).
"""

import logging
from typing import Dict
from sqlalchemy.ext.asyncio import AsyncSession
from app.config.risk_rules import Art69BStatus

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


async def screen_69b(rfc: str, db: AsyncSession) -> Dict:
    """
    Screen an RFC against Article 69-B lists (EFOS/EDOS).

    Returns mock findings for known demo RFCs. In production this will
    query a locally-indexed SAT dataset or the Reachcore API.
    """
    rfc_upper = rfc.strip().upper()
    if rfc_upper in _MOCK_69B:
        logger.info("RFC %s found in Art. 69-B data", rfc)
        return _MOCK_69B[rfc_upper]

    logger.info("RFC %s not found in Art. 69-B lists", rfc)
    return {"found": False, "status": Art69BStatus.NOT_FOUND, "razon_social": None}
