"""
Previa App — Public data source fetchers for DOF, SAT Datos Abiertos,
Gaceta Parlamentaria, and Leyes Federales.
Used by the ingestion job to keep PublicNotice table updated for real alert generation.
"""

from app.data.sources.dof_fetcher import DOFFetcher
from app.data.sources.sidof_fetcher import SIDOFFetcher
from app.data.sources.sat_datos_abiertos_fetcher import SATDatosAbiertosFetcher
from app.data.sources.gaceta_fetcher import GacetaDiputadosFetcher
from app.data.sources.leyes_federales_fetcher import LeyesFederalesFetcher
from app.data.sources.sweep_job import sweep_watchlist_companies

__all__ = [
    "DOFFetcher",
    "SIDOFFetcher",
    "SATDatosAbiertosFetcher",
    "GacetaDiputadosFetcher",
    "LeyesFederalesFetcher",
    "sweep_watchlist_companies",
]
