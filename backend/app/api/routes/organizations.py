"""
Previa App — Organizations & Watchlists API
CRUD for organizations and their nested watchlists + companies.
"""

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.data.db.session import AsyncSessionLocal
from app.data.db.models import Organization, Watchlist, WatchlistCompany

router = APIRouter()

# ── DB dependency ─────────────────────────────────────────────────────────────

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# ── Schemas ───────────────────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    name: str
    description: Optional[str] = None

class OrgResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: str

    class Config:
        from_attributes = True

class WatchlistCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WatchlistResponse(BaseModel):
    id: int
    organization_id: int
    name: str
    description: Optional[str]
    created_at: str
    company_count: int = 0

    class Config:
        from_attributes = True

class CompanyCreate(BaseModel):
    rfc: str
    razon_social: str
    group_tag: Optional[str] = None
    extra_data: Optional[dict] = None

class CompanyResponse(BaseModel):
    id: int
    watchlist_id: int
    rfc: str
    razon_social: str
    group_tag: Optional[str]
    extra_data: Optional[dict]
    added_at: str

    class Config:
        from_attributes = True

# ── Organizations ─────────────────────────────────────────────────────────────

@router.get("/organizations", response_model=List[dict])
async def list_organizations(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """List all organizations for the current user."""
    result = await db.execute(
        select(Organization).where(Organization.user_id == current_user["user_id"])
    )
    orgs = result.scalars().all()

    out = []
    for org in orgs:
        wl_result = await db.execute(
            select(Watchlist).where(Watchlist.organization_id == org.id)
        )
        watchlists = wl_result.scalars().all()
        wl_list = []
        for wl in watchlists:
            co_result = await db.execute(
                select(WatchlistCompany).where(WatchlistCompany.watchlist_id == wl.id)
            )
            companies = co_result.scalars().all()
            wl_list.append({
                "id": wl.id,
                "name": wl.name,
                "description": wl.description,
                "created_at": wl.created_at.isoformat() if wl.created_at else None,
                "company_count": len(companies),
            })
        out.append({
            "id": org.id,
            "name": org.name,
            "description": org.description,
            "created_at": org.created_at.isoformat() if org.created_at else None,
            "watchlists": wl_list,
        })
    return out


@router.post("/organizations", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrgCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new organization (user-only action)."""
    org = Organization(
        user_id=current_user["user_id"],
        name=body.name,
        description=body.description,
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return {
        "id": org.id,
        "name": org.name,
        "description": org.description,
        "created_at": org.created_at.isoformat() if org.created_at else None,
        "watchlists": [],
    }


@router.delete("/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Organization).where(
            Organization.id == org_id,
            Organization.user_id == current_user["user_id"],
        )
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await db.delete(org)
    await db.commit()


# ── Watchlists ────────────────────────────────────────────────────────────────

@router.get("/organizations/{org_id}/watchlists", response_model=List[dict])
async def list_watchlists(
    org_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    # Verify org ownership
    org_result = await db.execute(
        select(Organization).where(
            Organization.id == org_id,
            Organization.user_id == current_user["user_id"],
        )
    )
    if not org_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Organization not found")

    result = await db.execute(select(Watchlist).where(Watchlist.organization_id == org_id))
    watchlists = result.scalars().all()

    out = []
    for wl in watchlists:
        co_result = await db.execute(
            select(WatchlistCompany).where(WatchlistCompany.watchlist_id == wl.id)
        )
        companies = co_result.scalars().all()
        out.append({
            "id": wl.id,
            "organization_id": wl.organization_id,
            "name": wl.name,
            "description": wl.description,
            "created_at": wl.created_at.isoformat() if wl.created_at else None,
            "company_count": len(companies),
        })
    return out


@router.post("/organizations/{org_id}/watchlists", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_watchlist(
    org_id: int,
    body: WatchlistCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    org_result = await db.execute(
        select(Organization).where(
            Organization.id == org_id,
            Organization.user_id == current_user["user_id"],
        )
    )
    if not org_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Organization not found")

    wl = Watchlist(organization_id=org_id, name=body.name, description=body.description)
    db.add(wl)
    await db.commit()
    await db.refresh(wl)
    return {
        "id": wl.id,
        "organization_id": wl.organization_id,
        "name": wl.name,
        "description": wl.description,
        "created_at": wl.created_at.isoformat() if wl.created_at else None,
        "company_count": 0,
    }


@router.delete("/organizations/{org_id}/watchlists/{wl_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist(
    org_id: int,
    wl_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    org_result = await db.execute(
        select(Organization).where(
            Organization.id == org_id,
            Organization.user_id == current_user["user_id"],
        )
    )
    if not org_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Organization not found")

    wl_result = await db.execute(
        select(Watchlist).where(Watchlist.id == wl_id, Watchlist.organization_id == org_id)
    )
    wl = wl_result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    await db.delete(wl)
    await db.commit()


# ── Companies ─────────────────────────────────────────────────────────────────

@router.get("/watchlists/{wl_id}/companies", response_model=List[dict])
async def list_companies(
    wl_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchlistCompany).where(WatchlistCompany.watchlist_id == wl_id)
    )
    companies = result.scalars().all()
    return [
        {
            "id": c.id,
            "watchlist_id": c.watchlist_id,
            "rfc": c.rfc,
            "razon_social": c.razon_social,
            "group_tag": c.group_tag,
            "extra_data": c.extra_data,
            "added_at": c.added_at.isoformat() if c.added_at else None,
        }
        for c in companies
    ]


@router.post("/watchlists/{wl_id}/companies", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_company(
    wl_id: int,
    body: CompanyCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    c = WatchlistCompany(
        watchlist_id=wl_id,
        rfc=body.rfc,
        razon_social=body.razon_social,
        group_tag=body.group_tag,
        extra_data=body.extra_data,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return {
        "id": c.id,
        "watchlist_id": c.watchlist_id,
        "rfc": c.rfc,
        "razon_social": c.razon_social,
        "group_tag": c.group_tag,
        "extra_data": c.extra_data,
        "added_at": c.added_at.isoformat() if c.added_at else None,
    }


@router.delete("/watchlists/{wl_id}/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_company(
    wl_id: int,
    company_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchlistCompany).where(
            WatchlistCompany.id == company_id,
            WatchlistCompany.watchlist_id == wl_id,
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.delete(c)
    await db.commit()
