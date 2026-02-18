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
from typing import Dict, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.data.db.models import SATDataset
from app.config.risk_rules import Art69Category

logger = logging.getLogger(__name__)


async def screen_69(rfc: str, db: AsyncSession) -> Dict:
    """
    Screen an RFC against Article 69 non-compliance lists.
    
    For MVP, this returns mock data. In production, this would:
    1. Query local indexed SAT Art. 69 datasets
    2. Check all four categories
    3. Return list of matched categories with details
    
    Args:
        rfc: RFC to screen
        db: Database session
        
    Returns:
        Dictionary with screening results:
            - found: bool
            - categories: List[dict] with category details
    """
    # Check if we have SAT dataset loaded
    result = await db.execute(
        select(SATDataset).where(SATDataset.dataset_name.in_([
            "art69_creditos_firmes",
            "art69_no_localizados",
            "art69_creditos_cancelados",
            "art69_sentencias"
        ]))
    )
    datasets = result.scalars().all()
    
    if not datasets:
        logger.warning("Art. 69 datasets not loaded. Returning not_found.")
        return {
            "found": False,
            "categories": []
        }
    
    # Mock data for demo RFCs
    mock_69_data = {
        "GFS1109204G1": {
            "found": True,
            "categories": [
                {
                    "type": Art69Category.NO_LOCALIZADO.value,
                    "details": "Contribuyente no localizado en domicilio fiscal",
                    "publication_date": None,
                    "sat_url": "https://datos.gob.mx/dataset/contribuyentes_incumplidos"
                }
            ]
        },
        "BAD180409H32": {
            "found": True,
            "categories": [
                {
                    "type": Art69Category.CREDITO_FIRME.value,
                    "details": "Crédito fiscal firme pendiente de pago",
                    "amount": 150000.00,
                    "publication_date": None,
                    "sat_url": "https://datos.gob.mx/dataset/contribuyentes_incumplidos"
                }
            ]
        }
    }
    
    rfc_upper = rfc.upper()
    if rfc_upper in mock_69_data:
        logger.info(f"RFC {rfc} found in Art. 69 mock data")
        return mock_69_data[rfc_upper]
    else:
        logger.info(f"RFC {rfc} not found in Art. 69 lists")
        return {
            "found": False,
            "categories": []
        }
