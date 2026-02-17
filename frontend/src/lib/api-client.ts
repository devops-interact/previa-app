/**
 * PREV.IA — API Client
 * Typed HTTP client for backend communication.
 *
 * Security:
 * - All data endpoints send the JWT Bearer token stored in localStorage.
 * - The token is obtained via login() and stored by the login page.
 * - The /api/auth/login and /api/health endpoints are public and do not send a token.
 */

import type { ScanCreateResponse, ScanStatusResponse, RFCLookupResponse } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

    /**
     * Read the stored JWT from localStorage.
     * Returns an empty string if no token is found (unauthenticated).
     */
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

    /**
     * Build request headers.
     *
     * @param extra  Additional headers to merge (e.g. { 'Content-Type': 'application/json' }).
     * @param auth   Whether to attach the Authorization: Bearer header (default true).
     */
    private headers(extra: Record<string, string> = {}, auth = true): Record<string, string> {
        const base: Record<string, string> = { ...extra }
        if (auth) {
            const token = this.getToken()
            if (token) base['Authorization'] = `Bearer ${token}`
        }
        return base
    }

    /**
     * Generic error extractor — returns the `detail` field from FastAPI error responses.
     */
    private async extractError(response: Response): Promise<string> {
        try {
            const body = await response.json()
            return body.detail || `HTTP ${response.status}`
        } catch {
            return `HTTP ${response.status}`
        }
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    /**
     * Authenticate with the backend and return an AuthPayload.
     * The caller is responsible for storing the result in localStorage.
     *
     * Throws an Error with a human-readable message on failure.
     */
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

    // ── Scan endpoints ────────────────────────────────────────────────────────

    /**
     * Upload a file and create a new scan job.
     */
    async uploadScan(file: File): Promise<ScanCreateResponse> {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(`${this.baseURL}/api/scan`, {
            method: 'POST',
            headers: this.headers(),   // Bearer token; no Content-Type (browser sets multipart boundary)
            body: formData,
        })

        if (!response.ok) {
            const detail = await this.extractError(response)
            throw new Error(detail)
        }

        return response.json()
    }

    /**
     * Get scan status and progress.
     */
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

    /**
     * Download the XLSX report for a completed scan.
     */
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

    /**
     * Lookup a single RFC.
     */
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

    // ── Public endpoints (no token required) ──────────────────────────────────

    /**
     * Backend health check (public endpoint).
     */
    async healthCheck(): Promise<unknown> {
        const response = await fetch(`${this.baseURL}/api/health`, {
            headers: this.headers({}, false),   // no auth header
        })

        if (!response.ok) {
            throw new Error('Health check failed')
        }

        return response.json()
    }
}

export const apiClient = new APIClient(API_URL)
