"""
Previa App — Pydantic Schemas
Request/response models for API endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.config.risk_rules import RiskLevel, Art69BStatus


# ============================================================
# Scan Endpoints
# ============================================================

class ScanCreateResponse(BaseModel):
    """Response when creating a new scan."""
    scan_id: str
    status: str
    total_entities: int
    message: str


class ScanStatusResponse(BaseModel):
    """Response for scan status query."""
    scan_id: str
    status: str
    progress: float
    total_entities: int
    processed_entities: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


# ============================================================
# RFC Lookup
# ============================================================

class Art69BFinding(BaseModel):
    """Article 69-B finding details."""
    found: bool
    status: Optional[Art69BStatus] = None
    oficio_number: Optional[str] = None
    authority: Optional[str] = None
    motivo: Optional[str] = None
    publication_date: Optional[datetime] = None
    dof_url: Optional[str] = None


class Art69Finding(BaseModel):
    """Article 69 finding details."""
    found: bool
    categories: List[dict] = []


class CertificateFinding(BaseModel):
    """Certificate status finding."""
    checked: bool
    status: Optional[str] = None
    serial_number: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None


class RFCLookupResponse(BaseModel):
    """Response for single RFC lookup."""
    rfc: str
    razon_social: Optional[str] = None
    risk_score: int
    risk_level: RiskLevel
    art_69b: Art69BFinding
    art_69: Art69Finding
    certificates: CertificateFinding
    screened_at: datetime


# ============================================================
# Scan Results
# ============================================================

class EntityResult(BaseModel):
    """Screening result for a single entity in a scan."""
    id: int
    rfc: str
    razon_social: str
    tipo_persona: Optional[str] = None
    relacion: Optional[str] = None
    risk_score: int
    risk_level: str           # CRITICAL, HIGH, MEDIUM, LOW, CLEAR
    art_69b_found: bool
    art_69b_status: Optional[str] = None
    art_69b_oficio: Optional[str] = None
    art_69b_authority: Optional[str] = None
    art_69b_motivo: Optional[str] = None
    art_69b_dof_url: Optional[str] = None
    art_69_found: bool
    art_69_categories: List[dict] = []
    art_69_bis_found: bool
    art_49_bis_found: bool
    screened_at: Optional[datetime] = None


class ScanResultsResponse(BaseModel):
    """Aggregated results for a completed scan."""
    scan_id: str
    status: str
    total_entities: int
    processed_entities: int
    results: List[EntityResult]


# ============================================================
# Entity Input
# ============================================================

class EntityInput(BaseModel):
    """Entity from CSV/XLSX file."""
    rfc: str = Field(..., min_length=12, max_length=13)
    razon_social: str
    tipo_persona: Optional[str] = None
    relacion: Optional[str] = None
    id_interno: Optional[str] = None
