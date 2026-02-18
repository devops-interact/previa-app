/**
 * Previa App — API Client
 * Typed HTTP client for backend communication.
 *
 * Security:
 * - All data endpoints send the JWT Bearer token stored in localStorage.
 * - The token is obtained via login() and stored by the login page.
 * - The /api/auth/login and /api/health endpoints are public and do not send a token.
 */

import type {
    ScanCreateResponse,
    ScanStatusResponse,
    RFCLookupResponse,
    Organization,
    Watchlist,
    WatchlistCompany,
    ChatMessage,
    ChatContext,
} from '@/types'

/**
 * Backend base URL. Must be a full URL (e.g. https://your-app.up.railway.app) in production.
 * Do not use Railway internal hostnames (e.g. *.railway.internal) here — they only resolve inside Railway.
 * In Vercel, set NEXT_PUBLIC_API_URL to your Railway service's public URL.
 */
function getApiBaseUrl(): string {
    const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const url = raw.trim().replace(/\/+$/, '')
    if (typeof window !== 'undefined' && url && !url.startsWith('http://') && !url.startsWith('https://')) {
        console.warn(
            '[Previa App] NEXT_PUBLIC_API_URL should be a full URL (e.g. https://your-backend.up.railway.app). ' +
            'Using it as a path may cause 405 errors. Current value:', raw
        )
    }
    if (typeof window !== 'undefined' && url.includes('railway.internal')) {
        console.warn(
            '[Previa App] railway.internal is only reachable from Railway. Set NEXT_PUBLIC_API_URL to your Railway public URL (e.g. https://xxx.up.railway.app).'
        )
    }
    return url || 'http://localhost:8000'
}

const API_URL = getApiBaseUrl()

/** Shape stored in localStorage under the key 'previa_auth'. */
export interface AuthPayload {
    access_token: string
    email: string
    role: string
}

class APIClient {
    private baseURL: string

    constructor(baseURL: string) {
        this.baseURL = baseURL
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private getToken(): string {
        if (typeof window === 'undefined') return ''
        try {
            const raw = localStorage.getItem('previa_auth')
            if (!raw) return ''
            const parsed: AuthPayload = JSON.parse(raw)
            return parsed.access_token || ''
        } catch {
            return ''
        }
    }

    private headers(extra: Record<string, string> = {}, auth = true): Record<string, string> {
        const base: Record<string, string> = { ...extra }
        if (auth) {
            const token = this.getToken()
            if (token) base['Authorization'] = `Bearer ${token}`
        }
        return base
    }

    private async extractError(response: Response): Promise<string> {
        try {
            const body = await response.json()
            const detail = body.detail
            if (detail == null) return `HTTP ${response.status}`
            if (Array.isArray(detail)) {
                // FastAPI 422 validation errors: [{ loc, msg, type }, ...]
                const first = detail[0]
                const msg = first?.msg ?? first?.message ?? JSON.stringify(detail)
                const loc = first?.loc?.filter((x: unknown) => typeof x === 'string')?.join('.')
                return loc ? `${msg} (${loc})` : msg
            }
            return typeof detail === 'string' ? detail : `HTTP ${response.status}`
        } catch {
            return `HTTP ${response.status}`
        }
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    async login(email: string, password: string): Promise<AuthPayload> {
        const response = await fetch(`${this.baseURL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
            const detail = await this.extractError(response)
            throw new Error(detail)
        }

        return response.json() as Promise<AuthPayload>
    }

    // ── Scan ──────────────────────────────────────────────────────────────────

    async uploadScan(file: File): Promise<ScanCreateResponse> {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(`${this.baseURL}/api/scan`, {
            method: 'POST',
            headers: this.headers(),
            body: formData,
        })

        if (!response.ok) {
            const detail = await this.extractError(response)
            throw new Error(detail)
        }

        return response.json()
    }

    async getScanStatus(scanId: string): Promise<ScanStatusResponse> {
        const response = await fetch(`${this.baseURL}/api/scan/${scanId}`, {
            headers: this.headers(),
        })

        if (!response.ok) {
            const detail = await this.extractError(response)
            throw new Error(detail)
        }

        return response.json()
    }

    async downloadReport(scanId: string): Promise<Blob> {
        const response = await fetch(`${this.baseURL}/api/scan/${scanId}/report`, {
            headers: this.headers(),
        })

        if (!response.ok) {
            const detail = await this.extractError(response)
            throw new Error(detail)
        }

        return response.blob()
    }

    async lookupRFC(rfc: string): Promise<RFCLookupResponse> {
        const response = await fetch(`${this.baseURL}/api/rfc/${rfc}`, {
            method: 'POST',
            headers: this.headers(),
        })

        if (!response.ok) {
            const detail = await this.extractError(response)
            throw new Error(detail)
        }

        return response.json()
    }

    // ── Organizations ─────────────────────────────────────────────────────────

    async listOrganizations(): Promise<Organization[]> {
        const response = await fetch(`${this.baseURL}/api/organizations`, {
            headers: this.headers(),
        })
        if (!response.ok) throw new Error(await this.extractError(response))
        return response.json()
    }

    async createOrganization(name: string, description?: string): Promise<Organization> {
        const response = await fetch(`${this.baseURL}/api/organizations`, {
            method: 'POST',
            headers: this.headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ name, description }),
        })
        if (!response.ok) throw new Error(await this.extractError(response))
        return response.json()
    }

    async deleteOrganization(orgId: number): Promise<void> {
        const response = await fetch(`${this.baseURL}/api/organizations/${orgId}`, {
            method: 'DELETE',
            headers: this.headers(),
        })
        if (!response.ok) throw new Error(await this.extractError(response))
    }

    // ── Watchlists ────────────────────────────────────────────────────────────

    async createWatchlist(orgId: number, name: string, description?: string): Promise<Watchlist> {
        const response = await fetch(`${this.baseURL}/api/organizations/${orgId}/watchlists`, {
            method: 'POST',
            headers: this.headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ name, description }),
        })
        if (!response.ok) throw new Error(await this.extractError(response))
        return response.json()
    }

    async deleteWatchlist(orgId: number, wlId: number): Promise<void> {
        const response = await fetch(`${this.baseURL}/api/organizations/${orgId}/watchlists/${wlId}`, {
            method: 'DELETE',
            headers: this.headers(),
        })
        if (!response.ok) throw new Error(await this.extractError(response))
    }

    async listCompanies(wlId: number): Promise<WatchlistCompany[]> {
        const response = await fetch(`${this.baseURL}/api/watchlists/${wlId}/companies`, {
            headers: this.headers(),
        })
        if (!response.ok) throw new Error(await this.extractError(response))
        return response.json()
    }

    async addCompany(wlId: number, data: { rfc: string; razon_social: string; group_tag?: string }): Promise<WatchlistCompany> {
        const response = await fetch(`${this.baseURL}/api/watchlists/${wlId}/companies`, {
            method: 'POST',
            headers: this.headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(data),
        })
        if (!response.ok) throw new Error(await this.extractError(response))
        return response.json()
    }

    // ── Chat ──────────────────────────────────────────────────────────────────

    async sendChatMessage(
        message: string,
        history: Array<{ role: string; content: string }> = [],
        context?: ChatContext,
    ): Promise<{ response: string; suggested_action?: string | null }> {
        const response = await fetch(`${this.baseURL}/api/chat`, {
            method: 'POST',
            headers: this.headers({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ message, history, context }),
        })
        if (!response.ok) throw new Error(await this.extractError(response))
        return response.json()
    }

    // ── Public ────────────────────────────────────────────────────────────────

    async healthCheck(): Promise<unknown> {
        const response = await fetch(`${this.baseURL}/api/health`, {
            headers: this.headers({}, false),
        })

        if (!response.ok) {
            throw new Error('Health check failed')
        }

        return response.json()
    }
}

export const apiClient = new APIClient(API_URL)
