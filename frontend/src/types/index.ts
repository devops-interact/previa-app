/**
 * Prevify — TypeScript Type Definitions
 * Shared interfaces matching backend Pydantic models
 */

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR'

export type Art69BStatus = 'presunto' | 'desvirtuado' | 'definitivo' | 'sentencia_favorable' | 'not_found'

export type ScanStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

// ── Alert ─────────────────────────────────────────────────────────────────────

export interface Alert {
    id: string
    severity: AlertSeverity
    article: string
    rfc: string
    entityName: string
    status: string
    timestamp?: string
    description?: string          // detailed context
    publicReportUrl?: string      // link to DOF / SAT public report
    oficio?: string               // official notice number
    authority?: string
}

// ── Scan ──────────────────────────────────────────────────────────────────────

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

/** Per-entity result returned by GET /scan/{scan_id}/results */
export interface ScanEntityResult {
    id: number
    rfc: string
    razon_social: string
    tipo_persona?: string
    relacion?: string
    risk_score: number
    risk_level: RiskLevel
    art_69b_found: boolean
    art_69b_status?: string
    art_69b_oficio?: string
    art_69b_authority?: string
    art_69b_motivo?: string
    art_69b_dof_url?: string
    art_69_found: boolean
    art_69_categories: Record<string, unknown>[]
    art_69_bis_found: boolean
    art_49_bis_found: boolean
    screened_at?: string
}

export interface ScanResultsResponse {
    scan_id: string
    status: ScanStatus
    total_entities: number
    processed_entities: number
    results: ScanEntityResult[]
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

// ── Auth ──────────────────────────────────────────────────────────────────────

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

// ── Organizations & Watchlists ────────────────────────────────────────────────

export interface WatchlistCompany {
    id: number
    watchlist_id: number
    rfc: string
    razon_social: string
    group_tag?: string
    extra_data?: Record<string, unknown>
    added_at: string
    risk_level?: RiskLevel | null
    risk_score?: number | null
    art_69b_status?: string | null
    art_69_categories?: string[] | null
    art_69_bis_found?: boolean
    art_49_bis_found?: boolean
    last_screened_at?: string | null
}

/** WatchlistCompany enriched with the parent watchlist name — returned by GET /organizations/{id}/empresas */
export interface EmpresaRow extends WatchlistCompany {
    watchlist_name: string
}

export interface Watchlist {
    id: number
    organization_id: number
    name: string
    description?: string
    created_at: string
    company_count: number
}

export interface Organization {
    id: number
    name: string
    description?: string
    created_at: string
    watchlists: Watchlist[]
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
    id: string
    role: ChatRole
    content: string
    timestamp: string
    suggested_action?: 'upload_csv' | 'create_watchlist' | 'scan_results' | null
}

export interface ChatContext {
    organization?: string
    watchlist?: string
    watchlist_id?: number
}
