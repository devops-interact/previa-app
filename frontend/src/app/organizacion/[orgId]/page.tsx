'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, List, Users, Calendar, Pencil, Check, X, Plus, Trash2 } from '@/lib/icons'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { AuthGuard } from '@/components/AuthGuard'
import { apiClient } from '@/lib/api-client'
import type { Organization, EmpresaRow, Watchlist } from '@/types'

export default function OrganizacionDetailPage() {
    const params = useParams()
    const router = useRouter()
    const orgId = Number(params.orgId)

    const [org, setOrg] = useState<Organization | null>(null)
    const [empresas, setEmpresas] = useState<EmpresaRow[]>([])
    const [loading, setLoading] = useState(true)

    // Inline edit for org name/description
    const [editingOrg, setEditingOrg] = useState(false)
    const [editName, setEditName] = useState('')
    const [editDesc, setEditDesc] = useState('')

    // Create watchlist inline
    const [creatingWl, setCreatingWl] = useState(false)
    const [newWlName, setNewWlName] = useState('')
    const [newWlDesc, setNewWlDesc] = useState('')

    useEffect(() => {
        if (!orgId) return
        const load = async () => {
            try {
                setLoading(true)
                const [orgData, emp] = await Promise.all([
                    apiClient.getOrganization(orgId),
                    apiClient.listEmpresasByOrg(orgId),
                ])
                setOrg(orgData)
                setEmpresas(emp)
            } catch {
                setOrg(null)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [orgId])

    const handleSaveOrg = async () => {
        if (!editName.trim()) return
        try {
            const updated = await apiClient.updateOrganization(orgId, {
                name: editName.trim(),
                description: editDesc.trim() || undefined,
            })
            setOrg(updated)
            setEditingOrg(false)
        } catch (e: any) {
            alert(e.message)
        }
    }

    const startEditOrg = () => {
        if (!org) return
        setEditName(org.name)
        setEditDesc(org.description || '')
        setEditingOrg(true)
    }

    const handleCreateWatchlist = async () => {
        if (!newWlName.trim()) return
        try {
            const wl = await apiClient.createWatchlist(orgId, newWlName.trim(), newWlDesc.trim() || undefined)
            setOrg((prev) => prev ? { ...prev, watchlists: [...prev.watchlists, wl] } : prev)
            setCreatingWl(false)
            setNewWlName('')
            setNewWlDesc('')
        } catch (e: any) {
            alert(e.message)
        }
    }

    const handleDeleteWatchlist = async (wlId: number) => {
        if (!confirm('¿Eliminar esta watchlist y todas sus empresas?')) return
        try {
            await apiClient.deleteWatchlist(orgId, wlId)
            setOrg((prev) => prev ? { ...prev, watchlists: prev.watchlists.filter((w) => w.id !== wlId) } : prev)
        } catch (e: any) {
            alert(e.message)
        }
    }

    const totalCompanies = empresas.length
    const totalWatchlists = org?.watchlists.length ?? 0
    const latestScan = empresas
        .map((e) => e.last_screened_at)
        .filter(Boolean)
        .sort()
        .pop()

    const breadcrumbs = org
        ? [{ label: 'Tablero', href: '/tablero' }, { label: org.name }]
        : [{ label: 'Tablero', href: '/tablero' }, { label: 'Organización' }]

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
                        ) : !org ? (
                            <div className="text-center py-20">
                                <p className="text-previa-muted">Organización no encontrada</p>
                                <button onClick={() => router.push('/tablero')} className="mt-4 text-sm text-previa-accent hover:underline">
                                    Volver al tablero
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-previa-accent/10 border border-previa-accent/20 flex items-center justify-center">
                                            <Building2 className="w-5 h-5 text-previa-accent" />
                                        </div>
                                        {editingOrg ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveOrg()
                                                            if (e.key === 'Escape') setEditingOrg(false)
                                                        }}
                                                        className="bg-previa-surface text-previa-ink text-lg font-bold px-3 py-1 rounded-lg border border-previa-accent/50 focus:outline-none focus:ring-1 focus:ring-previa-accent"
                                                        autoFocus
                                                    />
                                                    <button onClick={handleSaveOrg} className="p-1 text-green-400 hover:text-green-300"><Check className="w-5 h-5" /></button>
                                                    <button onClick={() => setEditingOrg(false)} className="p-1 text-previa-muted hover:text-previa-ink"><X className="w-5 h-5" /></button>
                                                </div>
                                                <input
                                                    value={editDesc}
                                                    onChange={(e) => setEditDesc(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveOrg()
                                                        if (e.key === 'Escape') setEditingOrg(false)
                                                    }}
                                                    placeholder="Descripción (opcional)"
                                                    className="bg-previa-surface text-previa-muted text-xs px-3 py-1 rounded-lg border border-previa-border focus:outline-none focus:ring-1 focus:ring-previa-accent w-full"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <h1 className="text-lg font-bold text-previa-ink">{org.name}</h1>
                                                    {org.description && <p className="text-xs text-previa-muted">{org.description}</p>}
                                                </div>
                                                <button
                                                    onClick={startEditOrg}
                                                    className="p-1.5 rounded-lg text-previa-muted hover:text-previa-accent hover:bg-previa-accent/10 transition-colors"
                                                    title="Editar organización"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="bg-previa-surface border border-previa-border rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <List className="w-4 h-4 text-previa-accent" />
                                            <span className="text-xs text-previa-muted">Listas de Monitoreo</span>
                                        </div>
                                        <span className="text-2xl font-bold text-previa-ink">{totalWatchlists}</span>
                                    </div>
                                    <div className="bg-previa-surface border border-previa-border rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Users className="w-4 h-4 text-previa-accent" />
                                            <span className="text-xs text-previa-muted">Empresas</span>
                                        </div>
                                        <span className="text-2xl font-bold text-previa-ink">{totalCompanies}</span>
                                    </div>
                                    <div className="bg-previa-surface border border-previa-border rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Calendar className="w-4 h-4 text-previa-accent" />
                                            <span className="text-xs text-previa-muted">Último análisis</span>
                                        </div>
                                        <span className="text-sm font-medium text-previa-ink">
                                            {latestScan
                                                ? new Date(latestScan).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                                                : 'Sin análisis'}
                                        </span>
                                    </div>
                                </div>

                                {/* Watchlists */}
                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-xs sm:text-sm font-semibold text-previa-muted uppercase tracking-wider">
                                            Listas de Monitoreo
                                        </h2>
                                        <button
                                            onClick={() => setCreatingWl(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-previa-accent bg-previa-accent/10 border border-previa-accent/30 rounded-lg hover:bg-previa-accent/20 transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Nueva Lista</span>
                                        </button>
                                    </div>

                                    {/* Inline create watchlist form */}
                                    {creatingWl && (
                                        <div className="bg-previa-surface border border-previa-accent/20 rounded-xl p-4 mb-3">
                                            <h3 className="text-sm font-semibold text-previa-ink mb-3">Nueva Lista de Monitoreo</h3>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Nombre de la lista"
                                                    value={newWlName}
                                                    onChange={(e) => setNewWlName(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateWatchlist()}
                                                    className="flex-1 bg-previa-background text-previa-ink text-sm px-3 py-2 rounded-lg border border-previa-border focus:outline-none focus:ring-1 focus:ring-previa-accent/50"
                                                    autoFocus
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Descripción (opcional)"
                                                    value={newWlDesc}
                                                    onChange={(e) => setNewWlDesc(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateWatchlist()}
                                                    className="flex-1 bg-previa-background text-previa-ink text-sm px-3 py-2 rounded-lg border border-previa-border focus:outline-none focus:ring-1 focus:ring-previa-accent/50"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleCreateWatchlist}
                                                        className="px-4 py-2 text-xs bg-previa-accent/10 text-previa-accent border border-previa-accent/30 font-medium rounded-lg hover:bg-previa-accent/20 transition-colors"
                                                    >
                                                        Crear
                                                    </button>
                                                    <button
                                                        onClick={() => { setCreatingWl(false); setNewWlName(''); setNewWlDesc('') }}
                                                        className="px-4 py-2 text-xs text-previa-muted hover:text-previa-ink border border-previa-border rounded-lg hover:bg-previa-surface-hover transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {org.watchlists.length === 0 && !creatingWl ? (
                                        <div className="bg-previa-surface border border-previa-border rounded-xl p-8 text-center">
                                            <List className="w-10 h-10 text-previa-muted/30 mx-auto mb-3" />
                                            <p className="text-sm text-previa-muted">Sin listas de monitoreo</p>
                                            <p className="text-xs text-previa-muted/60 mt-1">Crea una lista para comenzar a monitorear empresas</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {org.watchlists.map((wl) => (
                                                <div
                                                    key={wl.id}
                                                    className="bg-previa-surface border border-previa-border rounded-xl p-4 hover:border-previa-accent/30 hover:bg-previa-surface-hover transition-all group relative"
                                                >
                                                    <Link href={`/lista/${wl.id}`} className="block">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex items-center space-x-2 min-w-0">
                                                                <List className="w-4 h-4 text-previa-accent flex-shrink-0" />
                                                                <span className="text-sm font-medium text-previa-ink truncate group-hover:text-previa-accent transition-colors">
                                                                    {wl.name}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-previa-muted font-mono flex-shrink-0 ml-2">
                                                                {wl.company_count} empresas
                                                            </span>
                                                        </div>
                                                        {wl.description && (
                                                            <p className="text-xs text-previa-muted truncate mb-1">{wl.description}</p>
                                                        )}
                                                        <p className="text-xs text-previa-muted/60">
                                                            Creada {new Date(wl.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </p>
                                                    </Link>
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); handleDeleteWatchlist(wl.id) }}
                                                        className="absolute top-3 right-3 p-1.5 rounded-lg text-previa-muted hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Eliminar watchlist"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Empresas table */}
                                {empresas.length > 0 && (
                                    <section>
                                        <h2 className="text-xs sm:text-sm font-semibold text-previa-muted uppercase tracking-wider mb-3">
                                            Empresas
                                        </h2>
                                        <div className="bg-previa-surface border border-previa-border rounded-xl overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="border-b border-previa-border">
                                                            <th className="text-left px-4 py-3 text-previa-muted font-semibold">RFC</th>
                                                            <th className="text-left px-4 py-3 text-previa-muted font-semibold">Razón Social</th>
                                                            <th className="text-left px-4 py-3 text-previa-muted font-semibold">Lista</th>
                                                            <th className="text-left px-4 py-3 text-previa-muted font-semibold">Riesgo</th>
                                                            <th className="text-left px-4 py-3 text-previa-muted font-semibold">Art. 69-B</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {empresas.slice(0, 50).map((emp) => (
                                                            <tr key={emp.id} className="border-b border-previa-border/50 hover:bg-previa-surface-hover transition-colors">
                                                                <td className="px-4 py-2.5 text-previa-ink font-mono">{emp.rfc}</td>
                                                                <td className="px-4 py-2.5 text-previa-ink truncate max-w-[200px]">{emp.razon_social}</td>
                                                                <td className="px-4 py-2.5 text-previa-muted">{emp.watchlist_name}</td>
                                                                <td className="px-4 py-2.5">
                                                                    <span className={`text-xs font-medium ${
                                                                        emp.risk_level === 'CRITICAL' ? 'text-red-400'
                                                                            : emp.risk_level === 'HIGH' ? 'text-orange-400'
                                                                            : emp.risk_level === 'MEDIUM' ? 'text-yellow-400'
                                                                            : emp.risk_level === 'LOW' ? 'text-previa-accent'
                                                                            : 'text-previa-muted'
                                                                    }`}>
                                                                        {emp.risk_level || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2.5 text-previa-muted">{emp.art_69b_status || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {empresas.length > 50 && (
                                                <div className="px-4 py-2 text-xs text-previa-muted border-t border-previa-border">
                                                    Mostrando 50 de {empresas.length} empresas
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                )}
                            </>
                        )}
                    </div>
                </main>
            </div>
        </AuthGuard>
    )
}
