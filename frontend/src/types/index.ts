/**
 * PREV.IA — TypeScript Type Definitions
 * Shared interfaces matching backend Pydantic models
 */

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR'

export type Art69BStatus = 'presunto' | 'desvirtuado' | 'definitivo' | 'sentencia_favorable' | 'not_found'

export type ScanStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

export interface Alert {
    id: string
    severity: AlertSeverity
    article: string
    rfc: string
    entityName: string
    status: string
    timestamp?: string
}

export interface EntityInput {
    rfc: string
    razon_social: string
    tipo_persona?: string
    relacion?: string
    id_interno?: string
}

export interface ScanCreateResponse {
    scan_id: string
    status: ScanStatus
    total_entities: number
    message: string
}

export interface ScanStatusResponse {
    scan_id: string
    status: ScanStatus
    progress: number
    total_entities: number
    processed_entities: number
    created_at: string
    completed_at?: string
    error_message?: string
}

export interface Art69BFinding {
    found: boolean
    status?: Art69BStatus
    oficio_number?: string
    authority?: string
    motivo?: string
    publication_date?: string
    dof_url?: string
}

export interface Art69Finding {
    found: boolean
    categories: any[]
}

export interface CertificateFinding {
    checked: boolean
    status?: string
    serial_number?: string
    valid_from?: string
    valid_to?: string
}

export interface RFCLookupResponse {
    rfc: string
    razon_social?: string
    risk_score: number
    risk_level: RiskLevel
    art_69b: Art69BFinding
    art_69: Art69Finding
    certificates: CertificateFinding
    screened_at: string
}

export interface RegistrationData {
    email: string
    organization: string
    password: string
}

export interface RegistrationResponse {
    success: boolean
    message: string
    user_id?: string
}
