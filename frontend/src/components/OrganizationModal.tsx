'use client'

import { useState } from 'react'
import { X, Building2, Plus, Trash2, List, ChevronRight } from 'lucide-react'
import type { Organization, Watchlist } from '@/types'
import { apiClient } from '@/lib/api-client'

interface OrganizationModalProps {
    organizations: Organization[]
    onClose: () => void
    onCreated: (org: Organization) => void
    onDeleted: (orgId: number) => void
    onWatchlistCreated: (orgId: number, wl: Watchlist) => void
    onWatchlistDeleted: (orgId: number, wlId: number) => void
}

export function OrganizationModal({
    organizations,
    onClose,
    onCreated,
    onDeleted,
    onWatchlistCreated,
    onWatchlistDeleted,
}: OrganizationModalProps) {
    const [tab, setTab] = useState<'list' | 'create'>('list')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Watchlist creation state per org
    const [wlCreating, setWlCreating] = useState<number | null>(null)
    const [wlName, setWlName] = useState('')
    const [wlDesc, setWlDesc] = useState('')

    const handleCreate = async () => {
        if (!name.trim()) { setError('El nombre es obligatorio'); return }
        setLoading(true)
        setError('')
        try {
            const org = await apiClient.createOrganization(name.trim(), description.trim() || undefined)
            onCreated(org)
            setName('')
            setDescription('')
            setTab('list')
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (orgId: number) => {
        if (!confirm('¿Eliminar esta organización y todas sus watchlists?')) return
        try {
            await apiClient.deleteOrganization(orgId)
            onDeleted(orgId)
        } catch (e: any) {
            alert(e.message)
        }
    }

    const handleCreateWatchlist = async (orgId: number) => {
        if (!wlName.trim()) return
        try {
            const wl = await apiClient.createWatchlist(orgId, wlName.trim(), wlDesc.trim() || undefined)
            onWatchlistCreated(orgId, wl)
            setWlCreating(null)
            setWlName('')
            setWlDesc('')
        } catch (e: any) {
            alert(e.message)
        }
    }

    const handleDeleteWatchlist = async (orgId: number, wlId: number) => {
        if (!confirm('¿Eliminar esta watchlist y todas sus empresas?')) return
        try {
            await apiClient.deleteWatchlist(orgId, wlId)
            onWatchlistDeleted(orgId, wlId)
        } catch (e: any) {
            alert(e.message)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
            <div className="bg-previa-surface border border-previa-border rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-previa-border flex-shrink-0">
                    <div className="flex items-center space-x-2">
                        <Building2 className="w-5 h-5 text-previa-accent" />
                        <h2 className="text-lg font-semibold text-previa-ink">Organizaciones</h2>
                    </div>
                    <button onClick={onClose} className="text-previa-muted hover:text-previa-ink transition-colors p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-previa-border">
                    {[
                        { key: 'list' as const, label: 'Mis Organizaciones' },
                        { key: 'create' as const, label: 'Nueva Organización' },
                    ].map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t.key
                                ? 'text-previa-accent border-b-2 border-previa-accent'
                                : 'text-previa-muted hover:text-previa-ink'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto">
                    {/* List tab */}
                    {tab === 'list' && (
                        <div className="space-y-3">
                            {organizations.length === 0 && (
                                <div className="text-center py-8 text-previa-muted">
                                    <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No hay organizaciones. Crea la primera.</p>
                                </div>
                            )}
                            {organizations.map((org) => (
                                <div key={org.id} className="border border-previa-border rounded-xl p-4 bg-previa-background">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-2">
                                            <Building2 className="w-4 h-4 text-previa-accent" />
                                            <span className="font-semibold text-previa-ink text-sm">{org.name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(org.id)}
                                            className="text-previa-muted hover:text-red-400 transition-colors p-1"
                                            title="Eliminar organización"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {org.description && (
                                        <p className="text-xs text-previa-muted mb-3 ml-6">{org.description}</p>
                                    )}

                                    {/* Watchlists under this org */}
                                    <div className="ml-6 space-y-1">
                                        {org.watchlists.map((wl) => (
                                            <div key={wl.id} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-previa-surface-hover group">
                                                <div className="flex items-center space-x-2">
                                                    <List className="w-3 h-3 text-previa-muted" />
                                                    <span className="text-xs text-previa-muted group-hover:text-previa-ink">{wl.name}</span>
                                                    <span className="text-xs text-previa-muted opacity-60">({wl.company_count})</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteWatchlist(org.id, wl.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-previa-muted hover:text-red-400 transition-all p-0.5"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}

                                        {/* Add watchlist inline */}
                                        {wlCreating === org.id ? (
                                            <div className="mt-2 space-y-2">
                                                <input
                                                    value={wlName}
                                                    onChange={(e) => setWlName(e.target.value)}
                                                    placeholder="Nombre de watchlist..."
                                                    className="w-full bg-previa-surface text-previa-ink text-xs px-3 py-2 rounded-lg border border-previa-border focus:outline-none focus:ring-1 focus:ring-previa-accent/50"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateWatchlist(org.id)}
                                                    autoFocus
                                                />
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => handleCreateWatchlist(org.id)}
                                                        className="flex-1 bg-previa-accent/10 text-previa-accent text-xs py-1.5 rounded-lg hover:bg-previa-accent/20 transition-colors"
                                                    >
                                                        Crear
                                                    </button>
                                                    <button
                                                        onClick={() => { setWlCreating(null); setWlName('') }}
                                                        className="flex-1 text-previa-muted text-xs py-1.5 rounded-lg hover:bg-previa-surface-hover transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setWlCreating(org.id); setWlName('') }}
                                                className="flex items-center space-x-1 text-xs text-previa-muted hover:text-previa-accent transition-colors py-1 px-2 rounded-lg hover:bg-previa-surface-hover w-full"
                                            >
                                                <Plus className="w-3 h-3" />
                                                <span>Nueva Watchlist</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Create tab */}
                    {tab === 'create' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-previa-muted uppercase tracking-wider block mb-1.5">
                                    Nombre *
                                </label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej. Grupo Industrial Norte"
                                    className="w-full bg-previa-background text-previa-ink px-4 py-2.5 rounded-xl border border-previa-border focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent text-sm transition-all"
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-previa-muted uppercase tracking-wider block mb-1.5">
                                    Descripción (opcional)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Breve descripción..."
                                    rows={3}
                                    className="w-full bg-previa-background text-previa-ink px-4 py-2.5 rounded-xl border border-previa-border focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent text-sm resize-none transition-all"
                                />
                            </div>
                            {error && <p className="text-red-400 text-sm">{error}</p>}
                            <button
                                onClick={handleCreate}
                                disabled={loading}
                                className="w-full bg-previa-accent text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-previa-accent/90 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Creando...' : 'Crear Organización'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
