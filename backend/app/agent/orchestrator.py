"""
Previa App — Agent Orchestrator
Coordinates screening workflow for scan jobs.
Screens RFCs against Articles 69, 69 BIS, 69-B, and 49 BIS.
"""

import logging
import asyncio
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.data.db.session import AsyncSessionLocal
from app.data.db.models import ScanJob, Entity, ScreeningResult, AuditLog
from app.agent.tools.rfc_validator import validate_rfc
from app.agent.tools.sat_69b_tool import screen_69b
from app.agent.tools.sat_69_tool import screen_69
from app.agent.tools.sat_69_bis_tool import screen_69_bis
from app.agent.tools.sat_49_bis_tool import screen_49_bis
from app.config.risk_rules import calculate_risk_score, Art69BStatus

logger = logging.getLogger(__name__)


async def process_scan(scan_id: str):
    """
    Background task to process a scan job.
    Screens all entities and updates results.
    
    Args:
        scan_id: UUID of the scan job
    """
    logger.info(f"Starting scan processing for {scan_id}")
    
    async with AsyncSessionLocal() as db:
        try:
            # Get scan job
            result = await db.execute(
                select(ScanJob).where(ScanJob.scan_id == scan_id)
            )
            scan_job = result.scalar_one_or_none()
            
            if not scan_job:
                logger.error(f"Scan job {scan_id} not found")
                return
            
            # Update status to processing
            scan_job.status = "processing"
            scan_job.progress = 0.0
            await db.commit()
            
            # Get all entities for this scan
            result = await db.execute(
                select(Entity).where(Entity.scan_job_id == scan_job.id)
            )
            entities = result.scalars().all()
            
            total = len(entities)
            logger.info(f"Processing {total} entities for scan {scan_id}")
            
            # Process each entity
            for idx, entity in enumerate(entities):
                try:
                    await process_entity(entity, scan_job, db)
                    
                    # Update progress
                    scan_job.processed_entities = idx + 1
                    scan_job.progress = ((idx + 1) / total) * 100
                    await db.commit()
                    
                    logger.info(f"Processed entity {idx + 1}/{total}: {entity.rfc}")
                    
                except Exception as e:
                    logger.error(f"Error processing entity {entity.rfc}: {str(e)}")
                    # Continue with next entity
            
            # Mark scan as completed
            scan_job.status = "completed"
            scan_job.progress = 100.0
            scan_job.completed_at = datetime.utcnow()
            await db.commit()
            
            logger.info(f"Scan {scan_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Error processing scan {scan_id}: {str(e)}")
            
            # Mark scan as failed
            if scan_job:
                scan_job.status = "failed"
                scan_job.error_message = str(e)
                await db.commit()


async def process_entity(entity: Entity, scan_job: ScanJob, db: AsyncSession):
    """
    Process a single entity: validate, screen, score, and save results.
    Screens against Articles 69, 69 BIS, 69-B, and 49 BIS.
    
    Args:
        entity: Entity to process
        scan_job: Parent scan job
        db: Database session
    """
    # Validate RFC
    validation = validate_rfc(entity.rfc)
    if not validation["valid"]:
        logger.warning(f"Invalid RFC {entity.rfc}: {validation['errors']}")
        # Still process, but note the validation issue
    
    # Screen all articles (pass razon_social for name-based fallback)
    name = getattr(entity, "razon_social", None)
    art_69b_result = await screen_69b(entity.rfc, db, razon_social=name)
    art_69_result = await screen_69(entity.rfc, db, razon_social=name)
    art_69_bis_result = await screen_69_bis(entity.rfc, db, razon_social=name)
    art_49_bis_result = await screen_49_bis(entity.rfc, db, razon_social=name)
    
    # TODO: Check certificate status
    
    # Extract Art. 69 categories for risk calculation
    art_69_categories = []
    if art_69_result.get("found"):
        from app.config.risk_rules import Art69Category
        for cat in art_69_result.get("categories", []):
            cat_type = cat.get("type")
            if cat_type:
                try:
                    art_69_categories.append(Art69Category(cat_type))
                except ValueError:
                    logger.warning(f"Unknown Art. 69 category: {cat_type}")
    
    # Calculate risk
    findings = {
        "art_69b_status": art_69b_result.get("status", Art69BStatus.NOT_FOUND),
        "art_69_categories": art_69_categories,
        "cert_status": None
    }
    risk_score, risk_level = calculate_risk_score(findings)
    
    # Create screening result
    screening_result = ScreeningResult(
        entity_id=entity.id,
        scan_job_id=scan_job.id,
        risk_score=risk_score,
        risk_level=risk_level.value,
        
        # Art. 69-B
        art_69b_found=art_69b_result.get("found", False),
        art_69b_status=art_69b_result.get("status"),
        art_69b_oficio=art_69b_result.get("oficio_number"),
        art_69b_authority=art_69b_result.get("authority"),
        art_69b_motivo=art_69b_result.get("motivo"),
        art_69b_dof_url=art_69b_result.get("dof_url"),
        
        # Art. 69
        art_69_found=art_69_result.get("found", False),
        art_69_categories=art_69_result.get("categories", []),
        
        # Certificates
        cert_checked=False,
        
        screened_at=datetime.utcnow()
    )
    
    db.add(screening_result)
    await db.flush()  # Get screening_result.id
    
    # Create audit logs for all screening sources
    audit_logs = [
        AuditLog(
            result_id=screening_result.id,
            source="sat_69b",
            query=entity.rfc,
            response_summary=f"Art. 69-B Status: {art_69b_result.get('status', 'not_found')}",
            success=True,
            timestamp=datetime.utcnow()
        ),
        AuditLog(
            result_id=screening_result.id,
            source="sat_69",
            query=entity.rfc,
            response_summary=f"Art. 69 Found: {art_69_result.get('found', False)}, Categories: {len(art_69_result.get('categories', []))}",
            success=True,
            timestamp=datetime.utcnow()
        ),
        AuditLog(
            result_id=screening_result.id,
            source="sat_69_bis",
            query=entity.rfc,
            response_summary=f"Art. 69 BIS Found: {art_69_bis_result.get('found', False)}",
            success=True,
            timestamp=datetime.utcnow()
        ),
        AuditLog(
            result_id=screening_result.id,
            source="sat_49_bis",
            query=entity.rfc,
            response_summary=f"Art. 49 BIS Found: {art_49_bis_result.get('found', False)}",
            success=True,
            timestamp=datetime.utcnow()
        )
    ]
    
    for log in audit_logs:
        db.add(log)
    
    await db.commit()
