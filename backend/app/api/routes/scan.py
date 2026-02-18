"""
Previa App — Scan Endpoints
File upload, scan creation, and status tracking.

Security:
- All endpoints require a valid Bearer JWT (get_current_user dependency).
- File uploads are validated for MIME type and maximum size (10 MB).
"""

import uuid
import logging
from typing import Annotated

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.data.db.session import get_db
from app.data.db.models import ScanJob, Entity
from app.api.schemas import ScanCreateResponse, ScanStatusResponse
from app.data.ingest.file_parser import parse_upload_file
from app.agent.orchestrator import process_scan

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


async def _validate_upload(file: UploadFile) -> bytes:
    """
    Read the file into memory and validate MIME type, extension, and size.

    Returns:
        Raw file bytes (so the caller does not need to re-read).

    Raises:
        HTTPException 422 for type/extension violations.
        HTTPException 413 when the file exceeds the maximum allowed size.
    """
    import os

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
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    file: UploadFile = File(...),
):
    """
    Upload a CSV/XLSX file and create a new scan job.
    Processing happens asynchronously in the background.

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

        await db.commit()
        logger.info("Created scan job %s with %d entities", scan_id, len(entities_data))

        background_tasks.add_task(process_scan, scan_id)

        return ScanCreateResponse(
            scan_id=scan_id,
            status="pending",
            total_entities=len(entities_data),
            message=f"Scan created successfully. Processing {len(entities_data)} entities.",
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
    result = await db.execute(select(ScanJob).where(ScanJob.scan_id == scan_id))
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
    result = await db.execute(select(ScanJob).where(ScanJob.scan_id == scan_id))
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
