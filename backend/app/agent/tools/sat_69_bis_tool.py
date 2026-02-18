"""
Previa App — Article 69 BIS Screening Tool
Screen RFCs against SAT's Article 69 BIS lists.
"""

import logging
from typing import Dict
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Demo RFCs with known Art. 69 BIS findings (none for initial demo set)
_MOCK_69_BIS: Dict[str, Dict] = {}


async def screen_69_bis(rfc: str, db: AsyncSession) -> Dict:
    """
    Screen an RFC against Article 69 BIS lists.

    Returns mock findings for known demo RFCs. In production this will
    query a locally-indexed SAT Art. 69 BIS dataset.
    """
    rfc_upper = rfc.strip().upper()
    if rfc_upper in _MOCK_69_BIS:
        logger.info("RFC %s found in Art. 69 BIS data", rfc)
        return _MOCK_69_BIS[rfc_upper]

    logger.info("RFC %s not found in Art. 69 BIS lists", rfc)
    return {"found": False}
