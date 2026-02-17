"""
PREV.IA — RFC Lookup Endpoint
Single RFC screening on-demand.
Screens against Articles 69, 69 BIS, 69-B, and 49 BIS.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.data.db.session import get_db
from app.api.schemas import RFCLookupResponse, Art69BFinding, Art69Finding, CertificateFinding
from app.agent.tools.rfc_validator import validate_rfc
from app.agent.tools.sat_69b_tool import screen_69b
from app.agent.tools.sat_69_tool import screen_69
from app.agent.tools.sat_69_bis_tool import screen_69_bis
from app.agent.tools.sat_49_bis_tool import screen_49_bis
from app.config.risk_rules import calculate_risk_score, Art69BStatus, Art69Category

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/rfc/{rfc}", response_model=RFCLookupResponse)
async def lookup_rfc(
    rfc: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Perform immediate screening for a single RFC.
    Screens against Articles 69, 69 BIS, 69-B, and 49 BIS.
    Returns compliance findings and risk level.
    """
    # Validate RFC format
    validation = validate_rfc(rfc)
    if not validation["valid"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid RFC format: {', '.join(validation['errors'])}"
        )
    
    try:
        # Screen all articles
        art_69b_result = await screen_69b(rfc, db)
        art_69_result = await screen_69(rfc, db)
        art_69_bis_result = await screen_69_bis(rfc, db)
        art_49_bis_result = await screen_49_bis(rfc, db)
        
        # Build findings
        art_69b_finding = Art69BFinding(
            found=art_69b_result.get("found", False),
            status=art_69b_result.get("status"),
            oficio_number=art_69b_result.get("oficio_number"),
            authority=art_69b_result.get("authority"),
            motivo=art_69b_result.get("motivo"),
            publication_date=art_69b_result.get("publication_date"),
            dof_url=art_69b_result.get("dof_url")
        )
        
        art_69_finding = Art69Finding(
            found=art_69_result.get("found", False),
            categories=art_69_result.get("categories", [])
        )
        
        cert_finding = CertificateFinding(
            checked=False
        )
        
        # Extract Art. 69 categories for risk calculation
        art_69_categories = []
        if art_69_result.get("found"):
            for cat in art_69_result.get("categories", []):
                cat_type = cat.get("type")
                if cat_type:
                    try:
                        art_69_categories.append(Art69Category(cat_type))
                    except ValueError:
                        logger.warning(f"Unknown Art. 69 category: {cat_type}")
        
        # Calculate risk
        findings = {
            "art_69b_status": art_69b_result.get("status", Art69BStatus.NOT_FOUND),
            "art_69_categories": art_69_categories,
            "cert_status": None
        }
        risk_score, risk_level = calculate_risk_score(findings)
        
        from datetime import datetime
        return RFCLookupResponse(
            rfc=rfc.upper(),
            razon_social=art_69b_result.get("razon_social"),
            risk_score=risk_score,
            risk_level=risk_level,
            art_69b=art_69b_finding,
            art_69=art_69_finding,
            certificates=cert_finding,
            screened_at=datetime.utcnow()
        )
    
    except Exception as e:
        logger.error(f"Error screening RFC {rfc}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error screening RFC: {str(e)}")
