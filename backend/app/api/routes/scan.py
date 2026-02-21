"""
Previa App — Scan Endpoints
File upload, scan creation, and status tracking.

Security:
- All endpoints require a valid Bearer JWT (get_current_user dependency).
- File uploads are validated for MIME type and maximum size (10 MB).
"""

import os
import uuid
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.deps import get_current_user, enforce_company_limit, verify_org_ownership
from app.data.db.session import get_db
from app.data.db.models import ScanJob, Entity, Organization, Watchlist, WatchlistCompany, ScreeningResult
from app.api.schemas import ScanCreateResponse, ScanStatusResponse, ScanResultsResponse, EntityResult
from app.data.ingest.file_parser import parse_upload_file
from app.agent.orchestrator import process_scan
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter()

# ── File upload constraints ───────────────────────────────────────────────────

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_CONTENT_TYPES = {
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",                                               # .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",      # .xlsx
}

ALLOWED_EXTENSIONS = {".csv", ".xls", ".xlsx"}


def _stem(filename: str) -> str:
    """Return filename without its extension, used as the default watchlist name."""
    return os.path.splitext(filename)[0]


async def _validate_upload(file: UploadFile) -> bytes:
    """
    Read the file into memory and validate MIME type, extension, and size.

    Returns:
        Raw file bytes (so the caller does not need to re-read).

    Raises:
        HTTPException 422 for type/extension violations.
        HTTPException 413 when the file exceeds the maximum allowed size.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"File extension '{ext}' is not allowed. "
                f"Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            ),
        )

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Content-Type '{content_type}' is not allowed. "
                "Accepted: CSV or Excel spreadsheets."
            ),
        )

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    return data


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/scan", response_model=ScanCreateResponse)
async def create_scan(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    file: UploadFile = File(...),
    org_id: Optional[int] = Form(None),
    watchlist_name: Optional[str] = Form(None),
):
    """
    Upload a CSV/XLSX file and create a new scan job.
    Processing happens asynchronously in the background.

    Optional form fields:
    - org_id: associate the upload with an organization (auto-creates a Watchlist)
    - watchlist_name: name for the new watchlist (defaults to filename without extension)

    Requires: Authorization: Bearer <token>
    """
    # ── Validate upload ───────────────────────────────────────────────────────
    await _validate_upload(file)

    # Reset file position after validation read
    await file.seek(0)

    try:
        logger.info("Parsing uploaded file: %s (user=%s)", file.filename, current_user.get("sub"))
        entities_data = await parse_upload_file(file)

        if not entities_data:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No valid entities found in file. "
                    "Ensure file has 'rfc' and 'razon_social' columns."
                ),
            )

        # Create scan job
        scan_id = str(uuid.uuid4())
        scan_job = ScanJob(
            scan_id=scan_id,
            user_id=current_user.get("user_id"),
            filename=file.filename,
            status="pending",
            total_entities=len(entities_data),
            processed_entities=0,
        )
        db.add(scan_job)
        await db.flush()

        # Create entity records
        for entity_data in entities_data:
            entity = Entity(
                scan_job_id=scan_job.id,
                rfc=entity_data["rfc"],
                razon_social=entity_data["razon_social"],
                tipo_persona=entity_data.get("tipo_persona"),
                relacion=entity_data.get("relacion"),
                id_interno=entity_data.get("id_interno"),
            )
            db.add(entity)

        # ── Auto-create Watchlist under the chosen organization ───────────────
        watchlist_id: Optional[int] = None
        if org_id is not None:
            org_result = await db.execute(
                select(Organization).where(
                    Organization.id == org_id,
                    Organization.user_id == current_user["user_id"],
                )
            )
            org = org_result.scalar_one_or_none()
            if org:
                wl_name = (watchlist_name or _stem(file.filename or "dataset")).strip() or "dataset"
                wl = Watchlist(organization_id=org_id, name=wl_name, description=f"Imported from {file.filename}")
                db.add(wl)
                await db.flush()
                watchlist_id = wl.id

                for entity_data in entities_data:
                    db.add(WatchlistCompany(
                        watchlist_id=wl.id,
                        rfc=entity_data["rfc"],
                        razon_social=entity_data["razon_social"],
                        group_tag=entity_data.get("relacion"),
                        extra_data={k: v for k, v in entity_data.items()
                                    if k not in ("rfc", "razon_social", "tipo_persona", "relacion", "id_interno")
                                    } or None,
                    ))
                logger.info("Created watchlist '%s' (id=%d) under org %d", wl_name, wl.id, org_id)

        await db.commit()
        logger.info("Created scan job %s with %d entities", scan_id, len(entities_data))

        asyncio.create_task(process_scan(scan_id))

        return ScanCreateResponse(
            scan_id=scan_id,
            status="pending",
            total_entities=len(entities_data),
            message=f"Scan created successfully. Processing {len(entities_data)} entities."
                    + (f" Watchlist created (id={watchlist_id})." if watchlist_id else ""),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating scan: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/scan/{scan_id}", response_model=ScanStatusResponse)
async def get_scan_status(
    scan_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Get the status and progress of a scan job.

    Requires: Authorization: Bearer <token>
    """
    uid = current_user.get("user_id")
    result = await db.execute(
        select(ScanJob).where(ScanJob.scan_id == scan_id, ScanJob.user_id == uid)
    )
    scan_job = result.scalar_one_or_none()

    if not scan_job:
        raise HTTPException(status_code=404, detail="Scan not found")

    return ScanStatusResponse(
        scan_id=scan_job.scan_id,
        status=scan_job.status,
        progress=scan_job.progress,
        total_entities=scan_job.total_entities,
        processed_entities=scan_job.processed_entities,
        created_at=scan_job.created_at,
        completed_at=scan_job.completed_at,
        error_message=scan_job.error_message,
    )


@router.get("/scan/{scan_id}/report")
async def download_report(
    scan_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Download the generated XLSX report for a completed scan.

    Requires: Authorization: Bearer <token>
    """
    uid = current_user.get("user_id")
    result = await db.execute(
        select(ScanJob).where(ScanJob.scan_id == scan_id, ScanJob.user_id == uid)
    )
    scan_job = result.scalar_one_or_none()

    if not scan_job:
        raise HTTPException(status_code=404, detail="Scan not found")

    if scan_job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Scan is not completed yet. Current status: {scan_job.status}",
        )

    # TODO: Generate and return XLSX report
    raise HTTPException(status_code=501, detail="Report generation not implemented yet")


@router.get("/scan/{scan_id}/results")
async def get_scan_results(
    scan_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """
    Return per-entity screening results for a scan job (paginated).
    Available while the scan is in progress (partial) and after completion.
    """
    uid = current_user.get("user_id")
    result = await db.execute(
        select(ScanJob).where(ScanJob.scan_id == scan_id, ScanJob.user_id == uid)
    )
    scan_job = result.scalar_one_or_none()
    if not scan_job:
        raise HTTPException(status_code=404, detail="Scan not found")

    total = (await db.execute(
        select(func.count()).select_from(Entity).where(Entity.scan_job_id == scan_job.id)
    )).scalar() or 0

    ent_result = await db.execute(
        select(Entity)
        .where(Entity.scan_job_id == scan_job.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    entities = ent_result.scalars().all()
    entity_ids = [e.id for e in entities]

    screening_map = {}
    if entity_ids:
        res_result = await db.execute(
            select(ScreeningResult).where(ScreeningResult.entity_id.in_(entity_ids))
        )
        screening_map = {sr.entity_id: sr for sr in res_result.scalars().all()}

    entity_results = []
    for entity in entities:
        sr = screening_map.get(entity.id)
        entity_results.append(
            EntityResult(
                id=entity.id,
                rfc=entity.rfc,
                razon_social=entity.razon_social,
                tipo_persona=entity.tipo_persona,
                relacion=entity.relacion,
                risk_score=sr.risk_score if sr else 0,
                risk_level=sr.risk_level if sr else "CLEAR",
                art_69b_found=sr.art_69b_found if sr else False,
                art_69b_status=sr.art_69b_status if sr else None,
                art_69b_oficio=sr.art_69b_oficio if sr else None,
                art_69b_authority=sr.art_69b_authority if sr else None,
                art_69b_motivo=sr.art_69b_motivo if sr else None,
                art_69b_dof_url=sr.art_69b_dof_url if sr else None,
                art_69_found=sr.art_69_found if sr else False,
                art_69_categories=sr.art_69_categories if sr else [],
                art_69_bis_found=False,
                art_49_bis_found=False,
                screened_at=sr.screened_at if sr else None,
            )
        )

    return {
        "scan_id": scan_job.scan_id,
        "status": scan_job.status,
        "total_entities": scan_job.total_entities,
        "processed_entities": scan_job.processed_entities,
        "results": {
            "items": [r.model_dump() if hasattr(r, "model_dump") else r.dict() for r in entity_results],
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    }
