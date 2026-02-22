'use client'

import { useState, useEffect } from 'react'
import { X, List, Building2 } from '@/lib/icons'
import type { Organization, Watchlist } from '@/types'
import { apiClient } from '@/lib/api-client'

interface NewWatchlistModalProps {
    organizations: Organization[]
    /** Preselect this org when provided */
    defaultOrgId?: number | null
    onClose: () => void
    onCreated: (orgId: number, wl: Watchlist) => void
}

export function NewWatchlistModal({
    organizations,
    defaultOrgId = null,
    onClose,
    onCreated,
}: NewWatchlistModalProps) {
    const [orgId, setOrgId] = useState<number | null>(defaultOrgId ?? (organizations[0]?.id ?? null))
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const selectedOrg = organizations.find((o) => o.id === orgId) ?? organizations[0]

    // Sync orgId when defaultOrgId or organizations change
    useEffect(() => {
        if (defaultOrgId) setOrgId(defaultOrgId)
        else if (organizations.length === 1 && !orgId) setOrgId(organizations[0].id)
    }, [defaultOrgId, organizations])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setError('El nombre es obligatorio')
            return
        }
        const targetOrgId = orgId ?? selectedOrg?.id
        if (!targetOrgId) {
            setError('Selecciona una organización')
            return
        }
        setLoading(true)
        setError('')
        try {
            const wl = await apiClient.createWatchlist(targetOrgId, name.trim())
            onCreated(targetOrgId, wl)
            onClose()
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error al crear la lista')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
            <div className="bg-previa-surface border border-previa-border rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-previa-border">
                    <div className="flex items-center space-x-2">
                        <List className="w-5 h-5 text-previa-accent" />
                        <h2 className="text-lg font-semibold text-previa-ink">Nueva Lista de Monitoreo</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-previa-muted hover:text-previa-ink transition-colors p-1"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleCreate} className="p-4 sm:p-5 space-y-4">
                    <p className="text-sm text-previa-muted">
                        Una lista de monitoreo agrupa RFCs para evaluar cumplimiento fiscal. Agrega proveedores o clientes y ejecuta análisis periódicamente.
                    </p>

                    {organizations.length > 1 ? (
                        <div>
                            <label htmlFor="wl-org" className="block text-xs font-medium text-previa-muted uppercase tracking-wider mb-1.5">
                                Organización *
                            </label>
                            <select
                                id="wl-org"
                                value={orgId ?? ''}
                                onChange={(e) => setOrgId(Number(e.target.value) || null)}
                                className="w-full bg-previa-background text-previa-ink px-4 py-2.5 rounded-xl border border-previa-border focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent text-sm transition-all"
                                disabled={loading}
                            >
                                <option value="">Selecciona una organización</option>
                                {organizations.map((org) => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : selectedOrg && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-previa-background border border-previa-border">
                            <Building2 className="w-4 h-4 text-previa-accent" />
                            <span className="text-sm text-previa-ink font-medium">{selectedOrg.name}</span>
                        </div>
                    )}

                    <div>
                        <label htmlFor="wl-name" className="block text-xs font-medium text-previa-muted uppercase tracking-wider mb-1.5">
                            Nombre de la lista *
                        </label>
                        <input
                            id="wl-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. Proveedores 2025, Clientes activos..."
                            className="w-full bg-previa-background text-previa-ink px-4 py-2.5 rounded-xl border border-previa-border focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent text-sm transition-all"
                            autoFocus
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-400">{error}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim() || !(orgId ?? selectedOrg?.id)}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-previa-accent-light/60 text-previa-accent hover:bg-previa-accent-light border border-previa-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creando...' : 'Crear Lista'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
