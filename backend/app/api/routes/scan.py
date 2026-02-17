"""
PREV.IA — Scan Endpoints
File upload, scan creation, and status tracking.
"""

import uuid
import logging
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.data.db.session import get_db
from app.data.db.models import ScanJob, Entity
from app.api.schemas import ScanCreateResponse, ScanStatusResponse
from app.data.ingest.file_parser import parse_upload_file
from app.agent.orchestrator import process_scan

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/scan", response_model=ScanCreateResponse)
async def create_scan(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload CSV/XLSX file and create a new scan job.
    Processing happens in the background.
    """
    # Validate file type
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only CSV and XLSX files are supported."
        )
    
    try:
        # Parse file
        logger.info(f"Parsing uploaded file: {file.filename}")
        entities_data = await parse_upload_file(file)
        
        if not entities_data:
            raise HTTPException(
                status_code=400,
                detail="No valid entities found in file. Ensure file has 'rfc' and 'razon_social' columns."
            )
        
        # Create scan job
        scan_id = str(uuid.uuid4())
        scan_job = ScanJob(
            scan_id=scan_id,
            filename=file.filename,
            status="pending",
            total_entities=len(entities_data),
            processed_entities=0
        )
        db.add(scan_job)
        await db.flush()  # Get scan_job.id
        
        # Create entity records
        for entity_data in entities_data:
            entity = Entity(
                scan_job_id=scan_job.id,
                rfc=entity_data["rfc"],
                razon_social=entity_data["razon_social"],
                tipo_persona=entity_data.get("tipo_persona"),
                relacion=entity_data.get("relacion"),
                id_interno=entity_data.get("id_interno")
            )
            db.add(entity)
        
        await db.commit()
        logger.info(f"Created scan job {scan_id} with {len(entities_data)} entities")
        
        # Queue background processing
        background_tasks.add_task(process_scan, scan_id)
        
        return ScanCreateResponse(
            scan_id=scan_id,
            status="pending",
            total_entities=len(entities_data),
            message=f"Scan created successfully. Processing {len(entities_data)} entities."
        )
    
    except Exception as e:
        logger.error(f"Error creating scan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/scan/{scan_id}", response_model=ScanStatusResponse)
async def get_scan_status(
    scan_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the status and progress of a scan job.
    """
    result = await db.execute(
        select(ScanJob).where(ScanJob.scan_id == scan_id)
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
        error_message=scan_job.error_message
    )


@router.get("/scan/{scan_id}/report")
async def download_report(
    scan_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Download the generated XLSX report for a completed scan.
    """
    result = await db.execute(
        select(ScanJob).where(ScanJob.scan_id == scan_id)
    )
    scan_job = result.scalar_one_or_none()
    
    if not scan_job:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    if scan_job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Scan is not completed yet. Current status: {scan_job.status}"
        )
    
    # TODO: Generate and return XLSX report
    # For now, return a placeholder
    raise HTTPException(status_code=501, detail="Report generation not implemented yet")
