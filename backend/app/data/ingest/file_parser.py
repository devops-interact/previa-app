"""
Previa App — File Parser
Parse CSV and XLSX files containing RFC entities.
"""

import pandas as pd
import logging
from typing import List, Dict
from fastapi import UploadFile
from io import BytesIO

logger = logging.getLogger(__name__)


async def parse_upload_file(file: UploadFile) -> List[Dict]:
    """
    Parse uploaded CSV or XLSX file and extract entity data.
    
    Required columns:
        - rfc: RFC identifier (12 or 13 characters)
        - razon_social: Legal name
    
    Optional columns:
        - tipo_persona: fisica or moral
        - relacion: cliente, proveedor, socio, otro
        - id_interno: Internal reference ID
    
    Args:
        file: Uploaded file from FastAPI
        
    Returns:
        List of entity dictionaries
        
    Raises:
        ValueError: If required columns are missing or file is invalid
    """
    try:
        # Read file content
        content = await file.read()
        
        # Parse based on file extension
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        elif file.filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(BytesIO(content))
        else:
            raise ValueError(f"Unsupported file type: {file.filename}")
        
        logger.info(f"Parsed file with {len(df)} rows and columns: {df.columns.tolist()}")
        
        # Normalize column names (lowercase, strip whitespace)
        df.columns = df.columns.str.lower().str.strip()
        
        # Check required columns
        required_columns = ['rfc', 'razon_social']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise ValueError(
                f"Missing required columns: {', '.join(missing_columns)}. "
                f"Found columns: {', '.join(df.columns.tolist())}"
            )
        
        # Drop rows with missing RFC or razon_social
        df = df.dropna(subset=['rfc', 'razon_social'])
        
        # Convert to list of dictionaries
        entities = []
        for _, row in df.iterrows():
            entity = {
                'rfc': str(row['rfc']).strip().upper(),
                'razon_social': str(row['razon_social']).strip()
            }
            
            # Add optional fields if present
            if 'tipo_persona' in df.columns and pd.notna(row.get('tipo_persona')):
                entity['tipo_persona'] = str(row['tipo_persona']).strip().lower()
            
            if 'relacion' in df.columns and pd.notna(row.get('relacion')):
                entity['relacion'] = str(row['relacion']).strip().lower()
            
            if 'id_interno' in df.columns and pd.notna(row.get('id_interno')):
                entity['id_interno'] = str(row['id_interno']).strip()
            
            entities.append(entity)
        
        logger.info(f"Extracted {len(entities)} valid entities from file")
        return entities
    
    except Exception as e:
        logger.error(f"Error parsing file: {str(e)}")
        raise ValueError(f"Error parsing file: {str(e)}")
