'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import type { Organization, Watchlist } from '@/types'

interface OrgContextValue {
    organizations: Organization[]
    loading: boolean
    refresh: () => Promise<void>
    handleOrgCreated: (org: Organization) => void
    handleOrgUpdated: (org: Organization) => void
    handleOrgDeleted: (orgId: number) => void
    handleWatchlistCreated: (orgId: number, wl: Watchlist) => void
    handleWatchlistUpdated: (orgId: number, wl: Watchlist) => void
    handleWatchlistDeleted: (orgId: number, wlId: number) => void
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({ children }: { children: React.ReactNode }) {
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        try {
            setLoading(true)
            const orgs = await apiClient.listOrganizations()
            setOrganizations(orgs)
        } catch {
            // auth may not be ready
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { refresh() }, [refresh])

    const handleOrgCreated = useCallback((org: Organization) => {
        setOrganizations((prev) => [...prev, org])
    }, [])

    const handleOrgUpdated = useCallback((org: Organization) => {
        setOrganizations((prev) => prev.map((o) => o.id === org.id ? org : o))
    }, [])

    const handleOrgDeleted = useCallback((orgId: number) => {
        setOrganizations((prev) => prev.filter((o) => o.id !== orgId))
    }, [])

    const handleWatchlistCreated = useCallback((orgId: number, wl: Watchlist) => {
        setOrganizations((prev) =>
            prev.map((o) => o.id === orgId ? { ...o, watchlists: [...o.watchlists, wl] } : o)
        )
    }, [])

    const handleWatchlistUpdated = useCallback((orgId: number, wl: Watchlist) => {
        setOrganizations((prev) =>
            prev.map((o) => o.id === orgId
                ? { ...o, watchlists: o.watchlists.map((w) => w.id === wl.id ? wl : w) }
                : o
            )
        )
    }, [])

    const handleWatchlistDeleted = useCallback((orgId: number, wlId: number) => {
        setOrganizations((prev) =>
            prev.map((o) => o.id === orgId
                ? { ...o, watchlists: o.watchlists.filter((w) => w.id !== wlId) }
                : o
            )
        )
    }, [])

    return (
        <OrgContext.Provider value={{
            organizations,
            loading,
            refresh,
            handleOrgCreated,
            handleOrgUpdated,
            handleOrgDeleted,
            handleWatchlistCreated,
            handleWatchlistUpdated,
            handleWatchlistDeleted,
        }}>
            {children}
        </OrgContext.Provider>
    )
}

export function useOrg(): OrgContextValue {
    const ctx = useContext(OrgContext)
    if (!ctx) throw new Error('useOrg must be used within OrgProvider')
    return ctx
}
