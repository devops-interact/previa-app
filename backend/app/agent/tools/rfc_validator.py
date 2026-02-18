"""
Previa App — RFC Validator
Validates RFC format according to Mexican tax authority rules.
"""

import re
from typing import Dict, List


def validate_rfc(rfc: str) -> Dict[str, any]:
    """
    Validate RFC format.
    
    Rules:
        - Personas Morales (legal entities): 12 characters
        - Personas Físicas (individuals): 13 characters
        - Alphanumeric format
        - First 3-4 chars: letters (name/company initials)
        - Next 6 chars: date (YYMMDD)
        - Last 3 chars: alphanumeric homoclave
    
    Args:
        rfc: RFC string to validate
        
    Returns:
        Dictionary with:
            - valid: bool
            - errors: List[str]
            - tipo_persona: "moral" or "fisica" or None
    """
    errors = []
    tipo_persona = None
    
    # Remove whitespace and convert to uppercase
    rfc = rfc.strip().upper()
    
    # Check length
    if len(rfc) not in [12, 13]:
        errors.append(f"Invalid length: {len(rfc)}. Must be 12 (moral) or 13 (física) characters.")
        return {"valid": False, "errors": errors, "tipo_persona": None}
    
    # Determine tipo_persona
    if len(rfc) == 12:
        tipo_persona = "moral"
    elif len(rfc) == 13:
        tipo_persona = "fisica"
    
    # Check format with regex
    # Moral: 3 letters + 6 digits (date) + 3 alphanumeric
    # Física: 4 letters + 6 digits (date) + 3 alphanumeric
    if tipo_persona == "moral":
        pattern = r'^[A-Z&Ñ]{3}\d{6}[A-Z0-9]{3}$'
    else:  # fisica
        pattern = r'^[A-Z&Ñ]{4}\d{6}[A-Z0-9]{3}$'
    
    if not re.match(pattern, rfc):
        errors.append(f"Invalid format for {tipo_persona}. RFC does not match expected pattern.")
    
    # Validate date portion (basic check)
    if tipo_persona == "moral":
        date_part = rfc[3:9]
    else:
        date_part = rfc[4:10]
    
    try:
        year = int(date_part[0:2])
        month = int(date_part[2:4])
        day = int(date_part[4:6])
        
        if month < 1 or month > 12:
            errors.append(f"Invalid month in date: {month}")
        if day < 1 or day > 31:
            errors.append(f"Invalid day in date: {day}")
    except ValueError:
        errors.append("Invalid date format in RFC")
    
    # Check for generic RFC (XAXX010101000 - Público en General)
    if rfc == "XAXX010101000":
        # This is valid but should be noted
        pass
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "tipo_persona": tipo_persona
    }
