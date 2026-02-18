"""
Previa App — Database Models
SQLAlchemy ORM models for entities, scans, results, audit logs, organizations, and watchlists.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class User(Base):
    """User accounts (demo + future multi-tenant)."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="analyst")  # analyst, admin, auditor
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    organizations = relationship("Organization", back_populates="user", cascade="all, delete-orphan")


class Organization(Base):
    """User-created organizations to group watchlists."""
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="organizations")
    watchlists = relationship("Watchlist", back_populates="organization", cascade="all, delete-orphan")


class Watchlist(Base):
    """Watchlists within an organization — tracks a set of companies."""
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="watchlists")
    companies = relationship("WatchlistCompany", back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistCompany(Base):
    """A company (RFC) that belongs to a watchlist."""
    __tablename__ = "watchlist_companies"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=False)
    rfc = Column(String, nullable=False, index=True)
    razon_social = Column(String, nullable=False)
    group_tag = Column(String, nullable=True)     # custom grouping criteria
    extra_data = Column(JSON, nullable=True)       # flexible columns from CSV/XLS
    added_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    watchlist = relationship("Watchlist", back_populates="companies")


class ScanJob(Base):
    """Scan job tracking."""
    __tablename__ = "scan_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(String, unique=True, index=True, nullable=False)  # UUID
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    progress = Column(Float, default=0.0)  # 0.0 to 100.0
    total_entities = Column(Integer, default=0)
    processed_entities = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Relationships
    entities = relationship("Entity", back_populates="scan_job", cascade="all, delete-orphan")
    results = relationship("ScreeningResult", back_populates="scan_job", cascade="all, delete-orphan")


class Entity(Base):
    """RFC entities to be screened."""
    __tablename__ = "entities"
    
    id = Column(Integer, primary_key=True, index=True)
    scan_job_id = Column(Integer, ForeignKey("scan_jobs.id"))
    rfc = Column(String, index=True, nullable=False)
    razon_social = Column(String, nullable=False)
    tipo_persona = Column(String, nullable=True)  # fisica, moral
    relacion = Column(String, nullable=True)  # cliente, proveedor, socio, otro
    id_interno = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    scan_job = relationship("ScanJob", back_populates="entities")
    result = relationship("ScreeningResult", back_populates="entity", uselist=False)


class ScreeningResult(Base):
    """Screening results for each entity."""
    __tablename__ = "screening_results"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), unique=True)
    scan_job_id = Column(Integer, ForeignKey("scan_jobs.id"))
    
    # Overall risk
    risk_score = Column(Integer, default=0)
    risk_level = Column(String, default="CLEAR")  # CRITICAL, HIGH, MEDIUM, LOW, CLEAR
    
    # Art. 69-B findings
    art_69b_found = Column(Boolean, default=False)
    art_69b_status = Column(String, nullable=True)  # presunto, definitivo, etc.
    art_69b_oficio = Column(String, nullable=True)
    art_69b_authority = Column(String, nullable=True)
    art_69b_motivo = Column(Text, nullable=True)
    art_69b_publication_date = Column(DateTime, nullable=True)
    art_69b_dof_url = Column(String, nullable=True)
    
    # Art. 69 findings (stored as JSON array)
    art_69_found = Column(Boolean, default=False)
    art_69_categories = Column(JSON, nullable=True)  # List of category objects
    
    # Certificate findings
    cert_checked = Column(Boolean, default=False)
    cert_status = Column(String, nullable=True)  # active, expired, revoked, not_found
    cert_serial_number = Column(String, nullable=True)
    cert_valid_from = Column(DateTime, nullable=True)
    cert_valid_to = Column(DateTime, nullable=True)
    
    # Metadata
    screened_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    entity = relationship("Entity", back_populates="result")
    scan_job = relationship("ScanJob", back_populates="results")
    audit_logs = relationship("AuditLog", back_populates="result", cascade="all, delete-orphan")


class AuditLog(Base):
    """Audit trail for all queries and results."""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("screening_results.id"))
    source = Column(String, nullable=False)  # sat_69b, sat_69, cert_portal, reachcore_api
    query = Column(String, nullable=False)  # RFC queried
    response_summary = Column(Text, nullable=True)
    success = Column(Boolean, default=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    result = relationship("ScreeningResult", back_populates="audit_logs")


class SATDataset(Base):
    """Track SAT dataset freshness."""
    __tablename__ = "sat_datasets"
    
    id = Column(Integer, primary_key=True, index=True)
    dataset_name = Column(String, unique=True, nullable=False)  # lista_69b, art69_incumplidos, etc.
    last_updated = Column(DateTime, nullable=True)
    row_count = Column(Integer, default=0)
    file_path = Column(String, nullable=True)
