'use client'

import { useState } from 'react'
import { X, Building2, Trash2, List, Pencil, Check } from '@/lib/icons'
import type { Organization, Watchlist } from '@/types'
import { apiClient } from '@/lib/api-client'

interface OrganizationModalProps {
    organizations: Organization[]
    onClose: () => void
    onDeleted: (orgId: number) => void
    onOrgUpdated: (org: Organization) => void
    onWatchlistDeleted: (orgId: number, wlId: number) => void
    onWatchlistUpdated: (orgId: number, wl: Watchlist) => void
}

export function OrganizationModal({
    organizations,
    onClose,
    onDeleted,
    onOrgUpdated,
    onWatchlistDeleted,
    onWatchlistUpdated,
}: OrganizationModalProps) {
    const [editingOrgId, setEditingOrgId] = useState<number | null>(null)
    const [editOrgName, setEditOrgName] = useState('')
    const [editingWlKey, setEditingWlKey] = useState<string | null>(null)
    const [editWlName, setEditWlName] = useState('')

    const handleDeleteOrg = async (orgId: number) => {
        if (!confirm('¿Eliminar esta organización y todas sus listas de monitoreo?')) return
        try {
            await apiClient.deleteOrganization(orgId)
            onDeleted(orgId)
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : 'Error al eliminar')
        }
    }

    const handleRenameOrg = async (orgId: number) => {
        if (!editOrgName.trim()) return
        try {
            const updated = await apiClient.updateOrganization(orgId, { name: editOrgName.trim() })
            onOrgUpdated(updated)
            setEditingOrgId(null)
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : 'Error al renombrar')
        }
    }

    const handleDeleteWatchlist = async (orgId: number, wlId: number) => {
        if (!confirm('¿Eliminar esta lista y todas sus empresas?')) return
        try {
            await apiClient.deleteWatchlist(orgId, wlId)
            onWatchlistDeleted(orgId, wlId)
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : 'Error al eliminar')
        }
    }

    const handleRenameWatchlist = async (orgId: number, wlId: number) => {
        if (!editWlName.trim()) return
        try {
            const updated = await apiClient.updateWatchlist(orgId, wlId, { name: editWlName.trim() })
            onWatchlistUpdated(orgId, updated)
            setEditingWlKey(null)
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : 'Error al renombrar')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
            <div className="bg-previa-surface border border-previa-border rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-previa-border flex-shrink-0">
                    <div className="flex items-center space-x-2">
                        <Building2 className="w-5 h-5 text-previa-accent" />
                        <h2 className="text-lg font-semibold text-previa-ink">Gestionar Organizaciones</h2>
                    </div>
                    <button onClick={onClose} className="text-previa-muted hover:text-previa-ink transition-colors p-1" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto">
                    <p className="text-sm text-previa-muted mb-4">
                        Renombra o elimina organizaciones y listas de monitoreo. Para crear nuevas, usa los botones + en el menú lateral.
                    </p>

                    {organizations.length === 0 ? (
                        <div className="text-center py-8 text-previa-muted">
                            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No hay organizaciones.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {organizations.map((org) => (
                                <div key={org.id} className="border border-previa-border rounded-xl p-4 bg-previa-background">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                                            <Building2 className="w-4 h-4 text-previa-accent flex-shrink-0" />
                                            {editingOrgId === org.id ? (
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                    <input
                                                        value={editOrgName}
                                                        onChange={(e) => setEditOrgName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleRenameOrg(org.id)
                                                            if (e.key === 'Escape') setEditingOrgId(null)
                                                        }}
                                                        className="flex-1 min-w-0 bg-previa-surface text-previa-ink text-sm font-semibold px-2 py-0.5 rounded-lg border border-previa-accent/50 focus:outline-none focus:ring-1 focus:ring-previa-accent"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleRenameOrg(org.id)} className="p-0.5 text-green-400 hover:text-green-300">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingOrgId(null)} className="p-0.5 text-previa-muted hover:text-previa-ink">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span
                                                    className="font-semibold text-previa-ink text-sm truncate cursor-pointer hover:text-previa-accent transition-colors"
                                                    onClick={() => { setEditingOrgId(org.id); setEditOrgName(org.name) }}
                                                    title="Clic para renombrar"
                                                >
                                                    {org.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                            {editingOrgId !== org.id && (
                                                <button
                                                    onClick={() => { setEditingOrgId(org.id); setEditOrgName(org.name) }}
                                                    className="text-previa-muted hover:text-previa-accent transition-colors p-1"
                                                    title="Renombrar"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDeleteOrg(org.id)}
                                                className="text-previa-muted hover:text-red-400 transition-colors p-1"
                                                title="Eliminar organización"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="ml-6 space-y-1">
                                        {org.watchlists.length === 0 ? (
                                            <p className="text-xs text-previa-muted py-1 italic">Sin listas</p>
                                        ) : (
                                            org.watchlists.map((wl) => {
                                                const wlKey = `${org.id}-${wl.id}`
                                                return (
                                                    <div key={wl.id} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-previa-surface-hover group">
                                                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                                                            <List className="w-3 h-3 text-previa-muted flex-shrink-0" />
                                                            {editingWlKey === wlKey ? (
                                                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                                                    <input
                                                                        value={editWlName}
                                                                        onChange={(e) => setEditWlName(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') handleRenameWatchlist(org.id, wl.id)
                                                                            if (e.key === 'Escape') setEditingWlKey(null)
                                                                        }}
                                                                        className="flex-1 min-w-0 bg-previa-surface text-previa-ink text-xs px-2 py-0.5 rounded-md border border-previa-accent/50 focus:outline-none focus:ring-1 focus:ring-previa-accent"
                                                                        autoFocus
                                                                    />
                                                                    <button onClick={() => handleRenameWatchlist(org.id, wl.id)} className="p-0.5 text-green-400 hover:text-green-300">
                                                                        <Check className="w-3 h-3" />
                                                                    </button>
                                                                    <button onClick={() => setEditingWlKey(null)} className="p-0.5 text-previa-muted hover:text-previa-ink">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span
                                                                        className="text-xs text-previa-muted group-hover:text-previa-ink cursor-pointer hover:text-previa-accent transition-colors truncate"
                                                                        onClick={() => { setEditingWlKey(wlKey); setEditWlName(wl.name) }}
                                                                        title="Clic para renombrar"
                                                                    >
                                                                        {wl.name}
                                                                    </span>
                                                                    <span className="text-xs text-previa-muted opacity-60">({wl.company_count})</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        {editingWlKey !== wlKey && (
                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                                                                <button
                                                                    onClick={() => { setEditingWlKey(wlKey); setEditWlName(wl.name) }}
                                                                    className="text-previa-muted hover:text-previa-accent transition-colors p-0.5"
                                                                >
                                                                    <Pencil className="w-2.5 h-2.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteWatchlist(org.id, wl.id)}
                                                                    className="text-previa-muted hover:text-red-400 transition-all p-0.5"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
