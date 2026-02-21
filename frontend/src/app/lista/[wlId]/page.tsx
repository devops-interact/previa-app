'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { List, Plus, Download, Trash2, Pencil, Check, X } from '@/lib/icons'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { AuthGuard } from '@/components/AuthGuard'
import { apiClient } from '@/lib/api-client'
import type { WatchlistCompany, Watchlist } from '@/types'

export default function ListaDetailPage() {
    const params = useParams()
    const router = useRouter()
    const wlId = Number(params.wlId)
    const [watchlist, setWatchlist] = useState<Watchlist | null>(null)
    const [orgName, setOrgName] = useState('')
    const [companies, setCompanies] = useState<WatchlistCompany[]>([])
    const [loading, setLoading] = useState(true)
    const [addingCompany, setAddingCompany] = useState(false)
    const [newRfc, setNewRfc] = useState('')
    const [newRazon, setNewRazon] = useState('')

    // Inline edit state
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editRazon, setEditRazon] = useState('')
    const [editTag, setEditTag] = useState('')

    useEffect(() => {
        if (!wlId) return
        const load = async () => {
            try {
                setLoading(true)
                const [orgs, comps] = await Promise.all([
                    apiClient.listOrganizations(),
                    apiClient.listCompanies(wlId),
                ])
                let found: Watchlist | null = null
                for (const org of orgs) {
                    const wl = org.watchlists.find((w) => w.id === wlId)
                    if (wl) {
                        found = wl
                        setOrgName(org.name)
                        break
                    }
                }
                setWatchlist(found)
                setCompanies(comps)
            } catch {
                setWatchlist(null)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [wlId])

    const handleAddCompany = async () => {
        if (!newRfc.trim() || !newRazon.trim()) return
        try {
            const added = await apiClient.addCompany(wlId, { rfc: newRfc.trim().toUpperCase(), razon_social: newRazon.trim() })
            setCompanies((prev) => [...prev, added])
            setNewRfc('')
            setNewRazon('')
            setAddingCompany(false)
        } catch (err) {
            console.error('Error adding company:', err)
        }
    }

    const handleDeleteCompany = async (companyId: number) => {
        if (!confirm('¿Eliminar esta empresa de la lista?')) return
        try {
            await apiClient.deleteCompany(wlId, companyId)
            setCompanies((prev) => prev.filter((c) => c.id !== companyId))
        } catch (err) {
            console.error('Error deleting company:', err)
        }
    }

    const handleSaveEdit = async (companyId: number) => {
        try {
            const updated = await apiClient.updateCompany(wlId, companyId, {
                razon_social: editRazon.trim() || undefined,
                group_tag: editTag.trim() || undefined,
            })
            setCompanies((prev) => prev.map((c) => c.id === companyId ? updated : c))
            setEditingId(null)
        } catch (err) {
            console.error('Error updating company:', err)
        }
    }

    const startEdit = (c: WatchlistCompany) => {
        setEditingId(c.id)
        setEditRazon(c.razon_social)
        setEditTag(c.group_tag || '')
    }

    const handleExportCSV = () => {
        if (companies.length === 0) return
        const headers = ['RFC', 'Razón Social', 'Riesgo', 'Art. 69-B', 'Última Revisión']
        const rows = companies.map((c) => [
            c.rfc,
            c.razon_social,
            c.risk_level || '',
            c.art_69b_status || '',
            c.last_screened_at || '',
        ])
        const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${watchlist?.name || 'lista'}_empresas.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const riskCounts = companies.reduce<Record<string, number>>((acc, c) => {
        const level = c.risk_level || 'CLEAR'
        acc[level] = (acc[level] || 0) + 1
        return acc
    }, {})

    const breadcrumbs = watchlist
        ? [
            { label: 'Tablero', href: '/tablero' },
            { label: orgName, href: watchlist ? `/organizacion/${watchlist.organization_id}` : undefined },
            { label: watchlist.name },
        ]
        : [{ label: 'Tablero', href: '/tablero' }, { label: 'Lista de Monitoreo' }]

    return (
        <AuthGuard>
            <div className="flex h-screen bg-previa-background overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                    <Topbar breadcrumbs={breadcrumbs} showSearch={false} />

                    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 space-y-6">
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-24 rounded-xl bg-previa-surface-hover animate-pulse" />
                                ))}
                            </div>
                        ) : !watchlist ? (
                            <div className="text-center py-20">
                                <p className="text-previa-muted">Lista de monitoreo no encontrada</p>
                                <button onClick={() => router.push('/tablero')} className="mt-4 text-sm text-previa-accent hover:underline">
                                    Volver al tablero
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="flex items-start justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-previa-accent/10 border border-previa-accent/20 flex items-center justify-center">
                                            <List className="w-5 h-5 text-previa-accent" />
                                        </div>
                                        <div>
                                            <h1 className="text-lg font-bold text-previa-ink">{watchlist.name}</h1>
                                            <p className="text-xs text-previa-muted">
                                                {orgName} &middot; {companies.length} empresas &middot; Creada {new Date(watchlist.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setAddingCompany(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-previa-accent/10 text-previa-accent border border-previa-accent/30 rounded-lg hover:bg-previa-accent/20 transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Agregar empresa</span>
                                        </button>
                                        <button
                                            onClick={handleExportCSV}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-previa-muted hover:text-previa-ink bg-previa-surface border border-previa-border rounded-lg hover:bg-previa-surface-hover transition-all"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span>Exportar CSV</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Status breakdown */}
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                    {[
                                        { label: 'Total', value: companies.length, color: 'text-previa-ink' },
                                        { label: 'Crítico', value: riskCounts['CRITICAL'] || 0, color: 'text-red-400' },
                                        { label: 'Alto', value: riskCounts['HIGH'] || 0, color: 'text-orange-400' },
                                        { label: 'Medio', value: riskCounts['MEDIUM'] || 0, color: 'text-yellow-400' },
                                        { label: 'Limpio', value: riskCounts['CLEAR'] || 0, color: 'text-previa-accent' },
                                    ].map((stat) => (
                                        <div key={stat.label} className="bg-previa-surface border border-previa-border rounded-xl p-3 text-center">
                                            <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
                                            <p className="text-xs text-previa-muted mt-0.5">{stat.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Add company inline form */}
                                {addingCompany && (
                                    <div className="bg-previa-surface border border-previa-accent/20 rounded-xl p-4">
                                        <h3 className="text-sm font-semibold text-previa-ink mb-3">Agregar Empresa</h3>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input
                                                type="text"
                                                placeholder="RFC"
                                                value={newRfc}
                                                onChange={(e) => setNewRfc(e.target.value)}
                                                className="flex-1 input-cursor px-3 py-2"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Razón Social"
                                                value={newRazon}
                                                onChange={(e) => setNewRazon(e.target.value)}
                                                className="flex-[2] input-cursor px-3 py-2"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleAddCompany}
                                                    className="px-4 py-2 text-xs border border-previa-border bg-transparent text-previa-ink font-medium rounded-lg hover:bg-previa-surface-hover hover:border-previa-accent/50 transition-colors"
                                                >
                                                    Agregar
                                                </button>
                                                <button
                                                    onClick={() => { setAddingCompany(false); setNewRfc(''); setNewRazon('') }}
                                                    className="px-4 py-2 text-xs text-previa-muted hover:text-previa-ink border border-previa-border rounded-lg hover:bg-previa-surface-hover transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Companies table */}
                                {companies.length === 0 ? (
                                    <div className="bg-previa-surface border border-previa-border rounded-xl p-8 text-center">
                                        <List className="w-10 h-10 text-previa-muted/30 mx-auto mb-3" />
                                        <p className="text-sm text-previa-muted">Sin empresas en esta lista</p>
                                        <p className="text-xs text-previa-muted/60 mt-1">Agrega empresas manualmente o sube un dataset CSV</p>
                                    </div>
                                ) : (
                                    <div className="bg-previa-surface border border-previa-border rounded-xl overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-previa-border">
                                                        <th className="text-left px-4 py-3 text-previa-muted font-semibold">RFC</th>
                                                        <th className="text-left px-4 py-3 text-previa-muted font-semibold">Razón Social</th>
                                                        <th className="text-left px-4 py-3 text-previa-muted font-semibold">Etiqueta</th>
                                                        <th className="text-left px-4 py-3 text-previa-muted font-semibold">Riesgo</th>
                                                        <th className="text-left px-4 py-3 text-previa-muted font-semibold">Art. 69-B</th>
                                                        <th className="text-left px-4 py-3 text-previa-muted font-semibold">Art. 69</th>
                                                        <th className="text-left px-4 py-3 text-previa-muted font-semibold">Última Revisión</th>
                                                        <th className="w-20 px-4 py-3"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {companies.map((c) => (
                                                        <tr key={c.id} className="border-b border-previa-border/50 hover:bg-previa-surface-hover transition-colors group">
                                                            <td className="px-4 py-2.5 text-previa-ink font-mono">{c.rfc}</td>
                                                            <td className="px-4 py-2.5 text-previa-ink max-w-[200px]">
                                                                {editingId === c.id ? (
                                                                    <input
                                                                        value={editRazon}
                                                                        onChange={(e) => setEditRazon(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') handleSaveEdit(c.id)
                                                                            if (e.key === 'Escape') setEditingId(null)
                                                                        }}
                                                                        className="w-full bg-previa-background text-previa-ink text-xs px-2 py-0.5 rounded border border-previa-accent/50 focus:outline-none focus:ring-1 focus:ring-previa-accent"
                                                                        autoFocus
                                                                    />
                                                                ) : (
                                                                    <span className="truncate block">{c.razon_social}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-previa-muted">
                                                                {editingId === c.id ? (
                                                                    <input
                                                                        value={editTag}
                                                                        onChange={(e) => setEditTag(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') handleSaveEdit(c.id)
                                                                            if (e.key === 'Escape') setEditingId(null)
                                                                        }}
                                                                        className="w-full bg-previa-background text-previa-ink text-xs px-2 py-0.5 rounded border border-previa-accent/50 focus:outline-none focus:ring-1 focus:ring-previa-accent"
                                                                        placeholder="Etiqueta..."
                                                                    />
                                                                ) : (
                                                                    c.group_tag || '-'
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <span className={`text-xs font-medium ${
                                                                    c.risk_level === 'CRITICAL' ? 'text-red-400'
                                                                        : c.risk_level === 'HIGH' ? 'text-orange-400'
                                                                        : c.risk_level === 'MEDIUM' ? 'text-yellow-400'
                                                                        : c.risk_level === 'LOW' ? 'text-previa-accent'
                                                                        : 'text-previa-muted'
                                                                }`}>
                                                                    {c.risk_level || '-'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-previa-muted">{c.art_69b_status || '-'}</td>
                                                            <td className="px-4 py-2.5 text-previa-muted">
                                                                {c.art_69_categories && c.art_69_categories.length > 0
                                                                    ? c.art_69_categories.join(', ')
                                                                    : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-previa-muted">
                                                                {c.last_screened_at
                                                                    ? new Date(c.last_screened_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
                                                                    : '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                    {editingId === c.id ? (
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleSaveEdit(c.id)}
                                                                                className="p-1 rounded text-green-400 hover:text-green-300 hover:bg-green-400/10"
                                                                                title="Guardar"
                                                                            >
                                                                                <Check className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingId(null)}
                                                                                className="p-1 rounded text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover"
                                                                                title="Cancelar"
                                                                            >
                                                                                <X className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button
                                                                                onClick={() => startEdit(c)}
                                                                                className="p-1 rounded text-previa-muted hover:text-previa-accent hover:bg-previa-accent/10"
                                                                                title="Editar"
                                                                            >
                                                                                <Pencil className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteCompany(c.id)}
                                                                                className="p-1 rounded text-previa-muted hover:text-red-400 hover:bg-red-400/10"
                                                                                title="Eliminar"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>
        </AuthGuard>
    )
}
