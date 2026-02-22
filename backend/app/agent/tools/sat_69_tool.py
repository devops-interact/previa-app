"""
Previa App — Article 69 Screening Tool
Screen RFCs against SAT's Article 69 non-compliance lists.
Queries indexed PublicNotice data first; falls back to mock for demo RFCs.
Supports search by razon_social (company name) as fallback.

Covers categories:
1. Créditos Fiscales Firmes — Taxpayers with firm, enforceable tax debts
2. No Localizados — Taxpayers whose fiscal domicile cannot be verified
3. Créditos Cancelados — Cancelled tax credits
4. Sentencia Condenatoria por Delito Fiscal — Criminal convictions for fiscal crimes
5. Exigibles, CSD sin efectos, Entes públicos omisos, etc.
"""

import logging
from typing import Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.risk_rules import Art69Category
from app.data.db.models import PublicNotice

logger = logging.getLogger(__name__)

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

_CATEGORY_MAP = {
    "credito_firme": Art69Category.CREDITO_FIRME.value,
    "no_localizado": Art69Category.NO_LOCALIZADO.value,
    "credito_cancelado": Art69Category.CREDITO_CANCELADO.value,
    "sentencia_condenatoria": Art69Category.SENTENCIA_CONDENATORIA.value,
    "csd_sin_efectos": Art69Category.CSD_SIN_EFECTOS.value,
}


def _notices_to_69_result(notices: list) -> Dict:
    """Aggregate multiple PublicNotice rows for the same RFC into one Art. 69 result."""
    categories: List[Dict] = []
    for n in notices:
        cat_raw = (n.category or n.status or "").strip().lower()
        cat_type = _CATEGORY_MAP.get(cat_raw, cat_raw)
        categories.append({
            "type": cat_type,
            "details": n.motivo or f"Art. 69 — {cat_type}",
            "publication_date": n.published_at.isoformat() if n.published_at else None,
            "sat_url": n.source_url,
        })
    return {"found": True, "categories": categories}


async def screen_69(
    rfc: str,
    db: AsyncSession,
    razon_social: Optional[str] = None,
) -> Dict:
    """
    Screen against Article 69 non-compliance lists.
    Queries by RFC first; falls back to razon_social (ILIKE) when provided.
    """
    rfc_upper = rfc.strip().upper() if rfc else ""

    if rfc_upper:
        result = await db.execute(
            select(PublicNotice)
            .where(PublicNotice.rfc == rfc_upper, PublicNotice.article_type == "art_69")
            .order_by(PublicNotice.indexed_at.desc())
        )
        rows = result.scalars().all()
        if rows:
            logger.info("RFC %s found in indexed Art. 69 data (%d records)", rfc, len(rows))
            return _notices_to_69_result(rows)

    if razon_social:
        name = razon_social.strip()
        if name:
            result = await db.execute(
                select(PublicNotice)
                .where(
                    PublicNotice.razon_social.ilike(f"%{name}%"),
                    PublicNotice.article_type == "art_69",
                )
                .order_by(PublicNotice.indexed_at.desc())
            )
            rows = result.scalars().all()
            if rows:
                logger.info("Company '%s' found in indexed Art. 69 data by name (%d records)", name, len(rows))
                return _notices_to_69_result(rows)

    if rfc_upper and rfc_upper in _MOCK_69:
        logger.info("RFC %s found in Art. 69 mock data", rfc)
        return _MOCK_69[rfc_upper]

    logger.info("RFC %s / name '%s' not found in Art. 69 lists", rfc, razon_social or "")
    return {"found": False, "categories": []}
