"""
Previa App — Article 49 BIS Screening Tool
Screen RFCs against SAT's Article 49 BIS lists.

Article 49 BIS of the CFF relates to provisions whose breach leads to
publication of taxpayer lists in the DOF.
"""

import logging
from typing import Dict
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Demo RFCs with known Art. 49 BIS findings (none for initial demo set)
_MOCK_49_BIS: Dict[str, Dict] = {}


async def screen_49_bis(rfc: str, db: AsyncSession) -> Dict:
    """
    Screen an RFC against Article 49 BIS lists.

    Returns mock findings for known demo RFCs. In production this will
    query a locally-indexed SAT Art. 49 BIS dataset.
    """
    rfc_upper = rfc.strip().upper()
    if rfc_upper in _MOCK_49_BIS:
        logger.info("RFC %s found in Art. 49 BIS data", rfc)
        return _MOCK_49_BIS[rfc_upper]

    logger.info("RFC %s not found in Art. 49 BIS lists", rfc)
    return {"found": False}
