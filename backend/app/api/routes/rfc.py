"""
Previa App — RFC Lookup Endpoint
Single RFC screening on-demand.
Screens against Articles 69, 69 BIS, 69-B, and 49 BIS.

Security:
- Requires a valid Bearer JWT (get_current_user dependency).
- Validates RFC format via regex before calling any tool.
"""

import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.schemas import RFCLookupResponse, Art69BFinding, Art69Finding, CertificateFinding
from app.agent.tools.rfc_validator import validate_rfc
from app.agent.tools.sat_69b_tool import screen_69b
from app.agent.tools.sat_69_tool import screen_69
from app.agent.tools.sat_69_bis_tool import screen_69_bis
from app.agent.tools.sat_49_bis_tool import screen_49_bis
from app.config.risk_rules import calculate_risk_score, Art69BStatus, Art69Category
from app.data.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

# Mexican RFC format: 3-4 uppercase letters (incl. Ñ &), 6-digit date, 3-char homoclave
RFC_REGEX = re.compile(r"^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$")


@router.post("/rfc/{rfc}", response_model=RFCLookupResponse)
async def lookup_rfc(
    rfc: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Perform immediate screening for a single RFC.
    Screens against Articles 69, 69 BIS, 69-B, and 49 BIS.
    Returns compliance findings and risk level.

    Requires: Authorization: Bearer <token>
    """
    # ── Input validation ──────────────────────────────────────────────────────
    rfc_upper = rfc.upper().strip()

    # Fast structural check before the heavier rfc_validator
    if not RFC_REGEX.match(rfc_upper):
        raise HTTPException(
            status_code=422,
            detail=(
                f"RFC '{rfc}' does not match the required format. "
                "Expected 3-4 letters, 6-digit date (YYMMDD), 3-char homoclave "
                "(e.g. ABC010101XY1)."
            ),
        )

    # Full semantic validation (date plausibility, tipo_persona, etc.)
    validation = validate_rfc(rfc_upper)
    if not validation["valid"]:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid RFC: {', '.join(validation['errors'])}",
        )

    # ── Screening ─────────────────────────────────────────────────────────────
    try:
        art_69b_result = await screen_69b(rfc_upper, db)
        art_69_result = await screen_69(rfc_upper, db)
        art_69_bis_result = await screen_69_bis(rfc_upper, db)
        art_49_bis_result = await screen_49_bis(rfc_upper, db)

        art_69b_finding = Art69BFinding(
            found=art_69b_result.get("found", False),
            status=art_69b_result.get("status"),
            oficio_number=art_69b_result.get("oficio_number"),
            authority=art_69b_result.get("authority"),
            motivo=art_69b_result.get("motivo"),
            publication_date=art_69b_result.get("publication_date"),
            dof_url=art_69b_result.get("dof_url"),
        )

        art_69_finding = Art69Finding(
            found=art_69_result.get("found", False),
            categories=art_69_result.get("categories", []),
        )

        cert_finding = CertificateFinding(checked=False)

        # Extract Art. 69 categories for risk scoring
        art_69_categories = []
        if art_69_result.get("found"):
            for cat in art_69_result.get("categories", []):
                cat_type = cat.get("type")
                if cat_type:
                    try:
                        art_69_categories.append(Art69Category(cat_type))
                    except ValueError:
                        logger.warning("Unknown Art. 69 category: %s", cat_type)

        findings = {
            "art_69b_status": art_69b_result.get("status", Art69BStatus.NOT_FOUND),
            "art_69_categories": art_69_categories,
            "cert_status": None,
        }
        risk_score, risk_level = calculate_risk_score(findings)

        from datetime import datetime

        return RFCLookupResponse(
            rfc=rfc_upper,
            razon_social=art_69b_result.get("razon_social"),
            risk_score=risk_score,
            risk_level=risk_level,
            art_69b=art_69b_finding,
            art_69=art_69_finding,
            certificates=cert_finding,
            screened_at=datetime.utcnow(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error screening RFC %s: %s", rfc_upper, str(e))
        raise HTTPException(status_code=500, detail=f"Error screening RFC: {str(e)}")
