"""
Previa App — Article 69 BIS Screening Tool
Screen RFCs against SAT's Article 69-B Bis lists.
Queries indexed PublicNotice data first; falls back to mock for demo RFCs.
"""

import logging
from typing import Dict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.db.models import PublicNotice

logger = logging.getLogger(__name__)

_MOCK_69_BIS: Dict[str, Dict] = {}


def _notice_to_69bis_result(notice) -> Dict:
    return {
        "found": True,
        "status": (notice.status or "definitivo").strip().lower(),
        "razon_social": notice.razon_social,
        "authority": notice.authority,
        "motivo": notice.motivo,
        "published_at": notice.published_at.isoformat() if notice.published_at else None,
        "source_url": notice.source_url,
    }


async def screen_69_bis(rfc: str, db: AsyncSession) -> Dict:
    """
    Screen an RFC against Article 69-B Bis lists.
    First queries indexed PublicNotice; then falls back to mock.
    """
    rfc_upper = rfc.strip().upper()

    result = await db.execute(
        select(PublicNotice)
        .where(PublicNotice.rfc == rfc_upper, PublicNotice.article_type == "art_69_bis")
        .order_by(PublicNotice.indexed_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row:
        logger.info("RFC %s found in indexed Art. 69-B Bis data (source=%s)", rfc, row.source)
        return _notice_to_69bis_result(row)

    if rfc_upper in _MOCK_69_BIS:
        logger.info("RFC %s found in Art. 69-B Bis mock data", rfc)
        return _MOCK_69_BIS[rfc_upper]

    logger.info("RFC %s not found in Art. 69-B Bis lists", rfc)
    return {"found": False}
