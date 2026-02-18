"""
Previa App — Public data source fetchers for DOF and SAT Datos Abiertos.
Used by the ingestion job to keep PublicNotice table updated for real alert generation.
"""

from app.data.sources.dof_fetcher import DOFFetcher
from app.data.sources.sat_datos_abiertos_fetcher import SATDatosAbiertosFetcher

__all__ = ["DOFFetcher", "SATDatosAbiertosFetcher"]
