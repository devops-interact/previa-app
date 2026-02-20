"""
Previa App — API Dependencies
JWT authentication, plan enforcement, and tenant isolation utilities.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.config.plan_limits import get_plan_limits

# ── Password hashing ─────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


# ── Logging ───────────────────────────────────────────────────────────────────

logger = logging.getLogger(__name__)


# ── JWT utilities ─────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


# ── FastAPI security scheme ───────────────────────────────────────────────────

bearer_scheme = HTTPBearer(auto_error=True)

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired authentication token",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Validate a Bearer JWT token and return the decoded payload.
    Payload includes "sub" (email), "role", "user_id" (User.id).
    """
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        email: str = payload.get("sub")
        if not email:
            raise _credentials_exception
        return payload
    except JWTError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise _credentials_exception


# ── Plan enforcement helpers ──────────────────────────────────────────────────

async def get_user_plan(user_id: int, db: AsyncSession) -> str:
    """Resolve the current plan for a user_id. Returns 'free' as fallback."""
    from app.data.db.models import User
    r = await db.execute(select(User.plan).where(User.id == user_id))
    row = r.scalar_one_or_none()
    return row or "free"


async def enforce_org_limit(user_id: int, db: AsyncSession) -> None:
    """Raise 403 if user has reached their plan's organization limit."""
    from app.data.db.models import Organization
    plan = await get_user_plan(user_id, db)
    limits = get_plan_limits(plan)
    max_orgs = limits["max_orgs"]
    if max_orgs == -1:
        return
    count = (await db.execute(
        select(func.count()).select_from(Organization).where(Organization.user_id == user_id)
    )).scalar() or 0
    if count >= max_orgs:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Plan '{plan}' permite máximo {max_orgs} organizaciones. Actualiza tu plan para crear más.",
        )


async def enforce_watchlist_limit(org_id: int, user_id: int, db: AsyncSession) -> None:
    """Raise 403 if org has reached the plan's watchlist-per-org limit."""
    from app.data.db.models import Watchlist
    plan = await get_user_plan(user_id, db)
    limits = get_plan_limits(plan)
    max_wl = limits["max_watchlists_per_org"]
    if max_wl == -1:
        return
    count = (await db.execute(
        select(func.count()).select_from(Watchlist).where(Watchlist.organization_id == org_id)
    )).scalar() or 0
    if count >= max_wl:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Plan '{plan}' permite máximo {max_wl} watchlists por organización.",
        )


async def enforce_company_limit(wl_id: int, user_id: int, db: AsyncSession) -> None:
    """Raise 403 if watchlist has reached the plan's RFCs-per-watchlist limit."""
    from app.data.db.models import WatchlistCompany
    plan = await get_user_plan(user_id, db)
    limits = get_plan_limits(plan)
    max_rfcs = limits["max_rfcs_per_watchlist"]
    if max_rfcs == -1:
        return
    count = (await db.execute(
        select(func.count()).select_from(WatchlistCompany).where(WatchlistCompany.watchlist_id == wl_id)
    )).scalar() or 0
    if count >= max_rfcs:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Plan '{plan}' permite máximo {max_rfcs} empresas por watchlist.",
        )


# ── Tenant isolation helpers ──────────────────────────────────────────────────

async def verify_org_ownership(org_id: int, user_id: int, db: AsyncSession):
    """Raise 404 if org doesn't belong to user."""
    from app.data.db.models import Organization
    r = await db.execute(
        select(Organization).where(Organization.id == org_id, Organization.user_id == user_id)
    )
    org = r.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


async def verify_watchlist_ownership(wl_id: int, user_id: int, db: AsyncSession):
    """Raise 404 if watchlist doesn't belong to user (through org)."""
    from app.data.db.models import Watchlist, Organization
    r = await db.execute(
        select(Watchlist)
        .join(Organization)
        .where(Watchlist.id == wl_id, Organization.user_id == user_id)
    )
    wl = r.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return wl
