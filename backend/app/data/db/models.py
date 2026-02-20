"""
Previa App — Database Models
SQLAlchemy ORM models for entities, scans, results, audit logs, organizations, and watchlists.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, JSON, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class User(Base):
    """User accounts with subscription plan tracking."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, default="analyst")  # analyst, admin, auditor
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Subscription
    plan = Column(String, default="free")  # free, basic, premium, company
    stripe_customer_id = Column(String, nullable=True, unique=True, index=True)
    stripe_subscription_id = Column(String, nullable=True)
    plan_expires_at = Column(DateTime, nullable=True)

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
    """A company (RFC) that belongs to a watchlist, enriched with compliance status."""
    __tablename__ = "watchlist_companies"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=False)
    rfc = Column(String, nullable=False, index=True)
    razon_social = Column(String, nullable=False)
    group_tag = Column(String, nullable=True)
    extra_data = Column(JSON, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow)

    # ── Compliance status (populated by sweep job) ─────────────────────────
    risk_level = Column(String, nullable=True)          # CRITICAL, HIGH, MEDIUM, LOW, CLEAR
    risk_score = Column(Integer, nullable=True)
    art_69b_status = Column(String, nullable=True)      # presunto, definitivo, desvirtuado, sentencia_favorable
    art_69_categories = Column(JSON, nullable=True)     # e.g. ["credito_firme", "no_localizado"]
    art_69_bis_found = Column(Boolean, default=False)
    art_49_bis_found = Column(Boolean, default=False)
    last_screened_at = Column(DateTime, nullable=True)

    # Relationships
    watchlist = relationship("Watchlist", back_populates="companies")

    __table_args__ = (
        Index("ix_wc_watchlist_rfc", "watchlist_id", "rfc"),
    )


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


class SweepMetadata(Base):
    """Single row: last daily SAT sweep completion time and totals (for UI indicator)."""
    __tablename__ = "sweep_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    last_completed_at = Column(DateTime, nullable=True)
    total_files = Column(Integer, default=0)
    total_rows = Column(Integer, default=0)


class PublicNotice(Base):
    """
    Indexed public notices from DOF (dof.gob.mx) and SAT Datos Abiertos
    (omawww.sat.gob.mx). Used by screening tools to generate alerts from real data.
    Refreshed periodically by the ingestion job.
    """
    __tablename__ = "public_notices"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, nullable=False, index=True)         # 'dof' | 'sat_datos_abiertos'
    source_url = Column(String, nullable=False)                  # page or list URL
    dof_url = Column(String, nullable=True)                      # DOF note URL when applicable

    rfc = Column(String, index=True, nullable=True)              # nullable for some DOF notices
    razon_social = Column(String, nullable=True)
    article_type = Column(String, nullable=False, index=True)    # art_69b, art_69, art_69_bis, art_49_bis
    status = Column(String, nullable=True)                       # presunto, definitivo, desvirtuado, etc.
    category = Column(String, nullable=True)                     # for Art. 69 categories
    oficio_number = Column(String, nullable=True)
    authority = Column(String, nullable=True)
    motivo = Column(Text, nullable=True)

    published_at = Column(DateTime, nullable=True)
    indexed_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow)     # updated on each ingestion run
    raw_snippet = Column(Text, nullable=True)

    __table_args__ = (
        Index("ix_pn_dedup", "source", "rfc", "article_type", "status", unique=False),
        Index("ix_pn_rfc_article", "rfc", "article_type"),
    )


class CompanyNews(Base):
    """
    Indexed controversial or relevant news about empresas (watchlist companies).
    Used by the chat agent to surface news when the user asks about a company.
    Populated by the news ingestion job (e.g. NewsAPI search by razon_social).
    """
    __tablename__ = "company_news"

    id = Column(Integer, primary_key=True, index=True)
    rfc = Column(String, index=True, nullable=True)
    razon_social = Column(String, nullable=True, index=True)
    source = Column(String, nullable=False)           # e.g. 'news_api', 'rss'
    title = Column(String, nullable=False)
    url = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    indexed_at = Column(DateTime, default=datetime.utcnow)
    # Optional: link to watchlist for scoping
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=True, index=True)

    __table_args__ = (
        Index("ix_cn_rfc_published", "rfc", "published_at"),
    )
