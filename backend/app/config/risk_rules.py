"""
Prevify — Risk Severity Rules
Fixed severity mapping (no scoring). Each finding maps directly to a level.
"""

from enum import Enum


class RiskLevel(str, Enum):
    """Risk level classification (CRITICAL > HIGH > MEDIUM > LOW > CLEAR)."""
    CRITICAL = "CRITICAL"  # Red
    HIGH = "HIGH"          # Orange
    MEDIUM = "MEDIUM"      # Yellow
    LOW = "LOW"            # Blue
    CLEAR = "CLEAR"        # Green / no finding


class Art69BStatus(str, Enum):
    """Article 69-B status classifications."""
    PRESUNTO = "presunto"
    DESVIRTUADO = "desvirtuado"
    DEFINITIVO = "definitivo"
    SENTENCIA_FAVORABLE = "sentencia_favorable"
    NOT_FOUND = "not_found"


class Art69Category(str, Enum):
    """Article 69 non-compliance categories."""
    CREDITO_FIRME = "credito_firme"
    NO_LOCALIZADO = "no_localizado"
    CREDITO_CANCELADO = "credito_cancelado"
    SENTENCIA_CONDENATORIA = "sentencia_condenatoria"
    CSD_SIN_EFECTOS = "csd_sin_efectos"  # CSD restringido temporal


class CertificateStatus(str, Enum):
    """Digital certificate status."""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    NOT_FOUND = "not_found"


# Severity priority (higher index = higher severity)
_SEVERITY_ORDER = (RiskLevel.CLEAR, RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL)


def _level_priority(level: RiskLevel) -> int:
    return _SEVERITY_ORDER.index(level) if level in _SEVERITY_ORDER else 0


def calculate_risk_score(findings: dict) -> tuple[int, RiskLevel]:
    """
    Determine risk level from findings using fixed severity mapping.
    No numeric scoring — each finding maps directly to a level.
    Highest severity wins when multiple findings exist.

    Severity scale:
    1. 69 sentencia_condenatoria → CRITICAL (Red)
    2. 69-B definitivo → HIGH (Orange)
    3. 69-B presunto → HIGH (Orange)
    4. 49-Bis → HIGH (Orange)
    5. 69 no_localizado → MEDIUM (Yellow)
    6. 69 credito_firme → LOW (Blue)
    7. CSD restringido temporal (csd_sin_efectos) → LOW (Blue)
    8. CSD cancelado/revocado → LOW (Blue)
    9. CSD vencido → LOW (Blue)

    Returns:
        Tuple of (risk_score, risk_level). risk_score is 0–100 for UI compatibility.
    """
    candidates: list[RiskLevel] = []

    # Art. 69-B (definitivo, presunto → HIGH)
    art69b = findings.get("art_69b_status")
    art69b_str = art69b.value if hasattr(art69b, "value") else str(art69b or "")
    if art69b_str in (Art69BStatus.DEFINITIVO.value, Art69BStatus.PRESUNTO.value):
        candidates.append(RiskLevel.HIGH)
    elif art69b_str and art69b_str != Art69BStatus.NOT_FOUND.value:
        candidates.append(RiskLevel.LOW)  # desvirtuado, sentencia_favorable

    # 49-Bis
    if findings.get("art_49_bis_found"):
        candidates.append(RiskLevel.HIGH)

    # Art. 69 categories
    for cat in findings.get("art_69_categories", []):
        cat_val = cat.value if hasattr(cat, "value") else str(cat)
        if cat_val == Art69Category.SENTENCIA_CONDENATORIA.value:
            candidates.append(RiskLevel.CRITICAL)
        elif cat_val == Art69Category.NO_LOCALIZADO.value:
            candidates.append(RiskLevel.MEDIUM)
        elif cat_val in (Art69Category.CREDITO_FIRME.value, Art69Category.CSD_SIN_EFECTOS.value):
            candidates.append(RiskLevel.LOW)
        elif cat_val == Art69Category.CREDITO_CANCELADO.value:
            candidates.append(RiskLevel.LOW)

    # Certificate status (CSD cancelado/revocado, CSD vencido → LOW)
    cert = findings.get("cert_status")
    cert_str = cert.value if hasattr(cert, "value") else str(cert or "").lower()
    if cert_str == CertificateStatus.REVOKED.value:
        candidates.append(RiskLevel.LOW)
    elif cert_str == CertificateStatus.EXPIRED.value:
        candidates.append(RiskLevel.LOW)

    if not candidates:
        return 0, RiskLevel.CLEAR

    risk_level = max(candidates, key=_level_priority)
    score_map = {RiskLevel.CLEAR: 0, RiskLevel.LOW: 25, RiskLevel.MEDIUM: 50, RiskLevel.HIGH: 80, RiskLevel.CRITICAL: 100}
    return score_map.get(risk_level, 0), risk_level
