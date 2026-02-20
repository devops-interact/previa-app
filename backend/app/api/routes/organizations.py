"""
Previa App — Organizations & Watchlists API
CRUD for organizations and their nested watchlists + companies.
Includes plan limit enforcement and full tenant isolation.
"""

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct

from app.api.deps import (
    get_current_user,
    enforce_org_limit,
    enforce_watchlist_limit,
    enforce_company_limit,
    verify_org_ownership,
    verify_watchlist_ownership,
)
from app.data.db.session import get_db
from app.data.db.models import Organization, Watchlist, WatchlistCompany

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WatchlistCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CompanyCreate(BaseModel):
    rfc: str
    razon_social: str
    group_tag: Optional[str] = None
    extra_data: Optional[dict] = None

class CompanyPatch(BaseModel):
    razon_social: Optional[str] = None
    group_tag: Optional[str] = None
    extra_data: Optional[dict] = None

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int

# ── Company serialization ──────────────────────────────────────────────────

def _company_to_dict(c: WatchlistCompany) -> dict:
    return {
        "id": c.id,
        "watchlist_id": c.watchlist_id,
        "rfc": c.rfc,
        "razon_social": c.razon_social,
        "group_tag": c.group_tag,
        "extra_data": c.extra_data,
        "added_at": c.added_at.isoformat() if c.added_at else None,
        "risk_level": c.risk_level,
        "risk_score": c.risk_score,
        "art_69b_status": c.art_69b_status,
        "art_69_categories": c.art_69_categories,
        "art_69_bis_found": c.art_69_bis_found or False,
        "art_49_bis_found": c.art_49_bis_found or False,
        "last_screened_at": c.last_screened_at.isoformat() if c.last_screened_at else None,
    }

# ── Organizations ─────────────────────────────────────────────────────────────

@router.get("/organizations")
async def list_organizations(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """List all organizations for the current user (paginated)."""
    user_id = current_user["user_id"]
    base = select(Organization).where(Organization.user_id == user_id)

    total = (await db.execute(
        select(func.count()).select_from(Organization).where(Organization.user_id == user_id)
    )).scalar() or 0

    result = await db.execute(
        base.order_by(Organization.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
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
            co_count = (await db.execute(
                select(func.count()).select_from(WatchlistCompany)
                .where(WatchlistCompany.watchlist_id == wl.id)
            )).scalar() or 0
            wl_list.append({
                "id": wl.id,
                "name": wl.name,
                "description": wl.description,
                "created_at": wl.created_at.isoformat() if wl.created_at else None,
                "company_count": co_count,
            })
        out.append({
            "id": org.id,
            "name": org.name,
            "description": org.description,
            "created_at": org.created_at.isoformat() if org.created_at else None,
            "watchlists": wl_list,
        })
    return {"items": out, "total": total, "page": page, "page_size": page_size}


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrgCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new organization (enforces plan limits)."""
    user_id = current_user["user_id"]
    await enforce_org_limit(user_id, db)

    org = Organization(user_id=user_id, name=body.name, description=body.description)
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
    await verify_org_ownership(org_id, current_user["user_id"], db)
    org = (await db.execute(
        select(Organization).where(Organization.id == org_id)
    )).scalar_one()
    await db.delete(org)
    await db.commit()


# ── Watchlists ────────────────────────────────────────────────────────────────

@router.get("/organizations/{org_id}/watchlists")
async def list_watchlists(
    org_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await verify_org_ownership(org_id, current_user["user_id"], db)

    result = await db.execute(select(Watchlist).where(Watchlist.organization_id == org_id))
    watchlists = result.scalars().all()

    out = []
    for wl in watchlists:
        co_count = (await db.execute(
            select(func.count()).select_from(WatchlistCompany)
            .where(WatchlistCompany.watchlist_id == wl.id)
        )).scalar() or 0
        out.append({
            "id": wl.id,
            "organization_id": wl.organization_id,
            "name": wl.name,
            "description": wl.description,
            "created_at": wl.created_at.isoformat() if wl.created_at else None,
            "company_count": co_count,
        })
    return out


@router.post("/organizations/{org_id}/watchlists", status_code=status.HTTP_201_CREATED)
async def create_watchlist(
    org_id: int,
    body: WatchlistCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["user_id"]
    await verify_org_ownership(org_id, user_id, db)
    await enforce_watchlist_limit(org_id, user_id, db)

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
    await verify_org_ownership(org_id, current_user["user_id"], db)

    wl_result = await db.execute(
        select(Watchlist).where(Watchlist.id == wl_id, Watchlist.organization_id == org_id)
    )
    wl = wl_result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    await db.delete(wl)
    await db.commit()


# ── Companies (tenant-isolated via verify_watchlist_ownership) ────────────────

@router.get("/watchlists/{wl_id}/companies")
async def list_companies(
    wl_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """List companies in a watchlist (paginated, tenant-isolated)."""
    await verify_watchlist_ownership(wl_id, current_user["user_id"], db)

    base_filter = WatchlistCompany.watchlist_id == wl_id
    total = (await db.execute(
        select(func.count()).select_from(WatchlistCompany).where(base_filter)
    )).scalar() or 0

    result = await db.execute(
        select(WatchlistCompany)
        .where(base_filter)
        .order_by(WatchlistCompany.added_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    companies = result.scalars().all()
    return {
        "items": [_company_to_dict(c) for c in companies],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/watchlists/{wl_id}/companies", status_code=status.HTTP_201_CREATED)
async def add_company(
    wl_id: int,
    body: CompanyCreate,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Add a company to a watchlist (enforces plan limits, tenant-isolated)."""
    user_id = current_user["user_id"]
    await verify_watchlist_ownership(wl_id, user_id, db)
    await enforce_company_limit(wl_id, user_id, db)

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
    return _company_to_dict(c)


@router.delete("/watchlists/{wl_id}/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_company(
    wl_id: int,
    company_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Remove a company (tenant-isolated)."""
    await verify_watchlist_ownership(wl_id, current_user["user_id"], db)

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


@router.patch("/watchlists/{wl_id}/companies/{company_id}")
async def update_company(
    wl_id: int,
    company_id: int,
    body: CompanyPatch,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Inline-edit a company (tenant-isolated)."""
    await verify_watchlist_ownership(wl_id, current_user["user_id"], db)

    result = await db.execute(
        select(WatchlistCompany).where(
            WatchlistCompany.id == company_id,
            WatchlistCompany.watchlist_id == wl_id,
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Company not found")

    if body.razon_social is not None:
        c.razon_social = body.razon_social
    if body.group_tag is not None:
        c.group_tag = body.group_tag
    if body.extra_data is not None:
        c.extra_data = body.extra_data

    await db.commit()
    await db.refresh(c)
    return _company_to_dict(c)


# ── CRM cross-watchlist endpoints ─────────────────────────────────────────────

@router.get("/organizations/{org_id}/tags")
async def list_org_tags(
    org_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Return all distinct group_tag values across every watchlist in the org."""
    await verify_org_ownership(org_id, current_user["user_id"], db)

    wl_result = await db.execute(select(Watchlist.id).where(Watchlist.organization_id == org_id))
    wl_ids = [row[0] for row in wl_result.all()]
    if not wl_ids:
        return []

    tags_result = await db.execute(
        select(distinct(WatchlistCompany.group_tag)).where(
            WatchlistCompany.watchlist_id.in_(wl_ids),
            WatchlistCompany.group_tag.isnot(None),
            WatchlistCompany.group_tag != "",
        )
    )
    return sorted(tag for (tag,) in tags_result.all() if tag)


@router.get("/organizations/{org_id}/empresas")
async def list_org_empresas(
    org_id: int,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    tag: Optional[str] = None,
    watchlist_id: Optional[int] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Cross-watchlist empresa view (paginated, tenant-isolated)."""
    await verify_org_ownership(org_id, current_user["user_id"], db)

    wl_result = await db.execute(select(Watchlist).where(Watchlist.organization_id == org_id))
    watchlists = wl_result.scalars().all()
    wl_map = {wl.id: wl.name for wl in watchlists}
    wl_ids = list(wl_map.keys())
    if not wl_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size}

    base = select(WatchlistCompany).where(WatchlistCompany.watchlist_id.in_(wl_ids))
    count_base = select(func.count()).select_from(WatchlistCompany).where(
        WatchlistCompany.watchlist_id.in_(wl_ids)
    )

    if watchlist_id is not None:
        base = base.where(WatchlistCompany.watchlist_id == watchlist_id)
        count_base = count_base.where(WatchlistCompany.watchlist_id == watchlist_id)
    if tag:
        base = base.where(WatchlistCompany.group_tag == tag)
        count_base = count_base.where(WatchlistCompany.group_tag == tag)
    if q:
        like = f"%{q.lower()}%"
        text_filter = (
            func.lower(WatchlistCompany.rfc).like(like)
            | func.lower(WatchlistCompany.razon_social).like(like)
        )
        base = base.where(text_filter)
        count_base = count_base.where(text_filter)

    total = (await db.execute(count_base)).scalar() or 0
    result = await db.execute(
        base.order_by(WatchlistCompany.added_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    companies = result.scalars().all()

    items = [
        {
            **_company_to_dict(c),
            "watchlist_name": wl_map.get(c.watchlist_id, ""),
        }
        for c in companies
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}
