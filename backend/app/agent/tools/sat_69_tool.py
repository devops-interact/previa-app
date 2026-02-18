"""
Previa App — Article 69 Screening Tool
Screen RFCs against SAT's Article 69 non-compliance lists.

Covers four categories:
1. Créditos Fiscales Firmes — Taxpayers with firm, enforceable tax debts
2. No Localizados — Taxpayers whose fiscal domicile cannot be verified
3. Créditos Cancelados — Cancelled tax credits
4. Sentencia Condenatoria por Delito Fiscal — Criminal convictions for fiscal crimes
"""

import logging
from typing import Dict
from sqlalchemy.ext.asyncio import AsyncSession
from app.config.risk_rules import Art69Category

logger = logging.getLogger(__name__)

# Demo RFCs with known Art. 69 findings
_MOCK_69: Dict[str, Dict] = {
    "GFS1109204G1": {
        "found": True,
        "categories": [
            {
                "type": Art69Category.NO_LOCALIZADO.value,
                "details": "Contribuyente no localizado en domicilio fiscal",
                "publication_date": None,
                "sat_url": "https://datos.gob.mx/dataset/contribuyentes_incumplidos",
            }
        ],
    },
    "BAD180409H32": {
        "found": True,
        "categories": [
            {
                "type": Art69Category.CREDITO_FIRME.value,
                "details": "Crédito fiscal firme pendiente de pago",
                "amount": 150000.00,
                "publication_date": None,
                "sat_url": "https://datos.gob.mx/dataset/contribuyentes_incumplidos",
            }
        ],
    },
    "CAL080328S18": {
        "found": True,
        "categories": [
            {
                "type": Art69Category.CREDITO_FIRME.value,
                "details": "Crédito fiscal firme — Operaciones inexistentes",
                "publication_date": None,
                "sat_url": "https://datos.gob.mx/dataset/contribuyentes_incumplidos",
            }
        ],
    },
}


async def screen_69(rfc: str, db: AsyncSession) -> Dict:
    """
    Screen an RFC against Article 69 non-compliance lists.

    Returns mock findings for known demo RFCs. In production this will
    query locally-indexed SAT Art. 69 datasets across all four categories.
    """
    rfc_upper = rfc.strip().upper()
    if rfc_upper in _MOCK_69:
        logger.info("RFC %s found in Art. 69 data", rfc)
        return _MOCK_69[rfc_upper]

    logger.info("RFC %s not found in Art. 69 lists", rfc)
    return {"found": False, "categories": []}
