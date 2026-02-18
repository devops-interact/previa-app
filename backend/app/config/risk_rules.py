"""
Previa App — Risk Scoring Rules
Defines the risk scoring matrix for compliance findings.
"""

from enum import Enum


class RiskLevel(str, Enum):
    """Risk level classification."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    CLEAR = "CLEAR"


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


class CertificateStatus(str, Enum):
    """Digital certificate status."""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    NOT_FOUND = "not_found"


# Risk Scoring Matrix
# Format: (finding_type, finding_value) -> risk_score
RISK_SCORES = {
    # Article 69-B
    ("art_69b", Art69BStatus.DEFINITIVO): 100,
    ("art_69b", Art69BStatus.PRESUNTO): 80,
    ("art_69b", Art69BStatus.DESVIRTUADO): 10,
    ("art_69b", Art69BStatus.SENTENCIA_FAVORABLE): 5,
    
    # Article 69
    ("art_69", Art69Category.SENTENCIA_CONDENATORIA): 95,
    ("art_69", Art69Category.NO_LOCALIZADO): 70,
    ("art_69", Art69Category.CREDITO_FIRME): 60,
    ("art_69", Art69Category.CREDITO_CANCELADO): 40,
    
    # Certificate Status
    ("cert", CertificateStatus.REVOKED): 65,
    ("cert_expired_90plus", True): 50,  # Expired > 90 days
    ("cert_expired_under90", True): 30,  # Expired < 90 days
}


def get_risk_level(score: int) -> RiskLevel:
    """
    Convert a numeric risk score to a risk level.
    
    Args:
        score: Numeric risk score (0-100)
        
    Returns:
        RiskLevel enum value
    """
    if score >= 80:
        return RiskLevel.CRITICAL
    elif score >= 60:
        return RiskLevel.HIGH
    elif score >= 30:
        return RiskLevel.MEDIUM
    elif score > 0:
        return RiskLevel.LOW
    else:
        return RiskLevel.CLEAR


def calculate_risk_score(findings: dict) -> tuple[int, RiskLevel]:
    """
    Calculate overall risk score from all findings.
    Uses highest individual score (max aggregation).
    
    Args:
        findings: Dictionary of findings with structure:
            {
                "art_69b_status": Art69BStatus,
                "art_69_categories": List[Art69Category],
                "cert_status": CertificateStatus,
                "cert_expired_days": int or None
            }
    
    Returns:
        Tuple of (risk_score, risk_level)
    """
    scores = []
    
    # Art. 69-B score
    if findings.get("art_69b_status"):
        status = findings["art_69b_status"]
        if status != Art69BStatus.NOT_FOUND:
            score = RISK_SCORES.get(("art_69b", status), 0)
            scores.append(score)
    
    # Art. 69 scores
    for category in findings.get("art_69_categories", []):
        score = RISK_SCORES.get(("art_69", category), 0)
        scores.append(score)
    
    # Certificate score
    cert_status = findings.get("cert_status")
    if cert_status == CertificateStatus.REVOKED:
        scores.append(RISK_SCORES[("cert", CertificateStatus.REVOKED)])
    elif cert_status == CertificateStatus.EXPIRED:
        expired_days = findings.get("cert_expired_days", 0)
        if expired_days > 90:
            scores.append(RISK_SCORES[("cert_expired_90plus", True)])
        else:
            scores.append(RISK_SCORES[("cert_expired_under90", True)])
    
    # Highest score wins
    overall_score = max(scores) if scores else 0
    risk_level = get_risk_level(overall_score)
    
    return overall_score, risk_level
