/**
 * PREV.IA — API Client
 * Typed HTTP client for backend communication
 */

import type { ScanCreateResponse, ScanStatusResponse, RFCLookupResponse } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class APIClient {
    private baseURL: string

    constructor(baseURL: string) {
        this.baseURL = baseURL
    }

    /**
     * Upload a file and create a new scan
     */
    async uploadScan(file: File): Promise<ScanCreateResponse> {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(`${this.baseURL}/api/scan`, {
            method: 'POST',
            body: formData,
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to upload file')
        }

        return response.json()
    }

    /**
     * Get scan status and progress
     */
    async getScanStatus(scanId: string): Promise<ScanStatusResponse> {
        const response = await fetch(`${this.baseURL}/api/scan/${scanId}`)

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to get scan status')
        }

        return response.json()
    }

    /**
     * Download report for completed scan
     */
    async downloadReport(scanId: string): Promise<Blob> {
        const response = await fetch(`${this.baseURL}/api/scan/${scanId}/report`)

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to download report')
        }

        return response.blob()
    }

    /**
     * Lookup a single RFC
     */
    async lookupRFC(rfc: string): Promise<RFCLookupResponse> {
        const response = await fetch(`${this.baseURL}/api/rfc/${rfc}`, {
            method: 'POST',
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Failed to lookup RFC')
        }

        return response.json()
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<any> {
        const response = await fetch(`${this.baseURL}/api/health`)

        if (!response.ok) {
            throw new Error('Health check failed')
        }

        return response.json()
    }
}

export const apiClient = new APIClient(API_URL)
