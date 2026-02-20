'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, List, Users, Calendar } from '@/lib/icons'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { AuthGuard } from '@/components/AuthGuard'
import { apiClient } from '@/lib/api-client'
import type { Organization, EmpresaRow } from '@/types'

export default function OrganizacionDetailPage() {
    const params = useParams()
    const router = useRouter()
    const orgId = Number(params.orgId)

    const [org, setOrg] = useState<Organization | null>(null)
    const [empresas, setEmpresas] = useState<EmpresaRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!orgId) return
        const load = async () => {
            try {
                setLoading(true)
                const [orgs, emp] = await Promise.all([
                    apiClient.listOrganizations(),
                    apiClient.listEmpresasByOrg(orgId),
                ])
                const found = orgs.find((o) => o.id === orgId) ?? null
                setOrg(found)
                setEmpresas(emp)
            } catch {
                setOrg(null)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [orgId])

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
                                        <div>
                                            <h1 className="text-lg font-bold text-previa-ink">{org.name}</h1>
                                            {org.description && <p className="text-xs text-previa-muted">{org.description}</p>}
                                        </div>
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
                                    </div>
                                    {org.watchlists.length === 0 ? (
                                        <div className="bg-previa-surface border border-previa-border rounded-xl p-8 text-center">
                                            <List className="w-10 h-10 text-previa-muted/30 mx-auto mb-3" />
                                            <p className="text-sm text-previa-muted">Sin listas de monitoreo</p>
                                            <p className="text-xs text-previa-muted/60 mt-1">Crea una lista para comenzar a monitorear empresas</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {org.watchlists.map((wl) => (
                                                <Link
                                                    key={wl.id}
                                                    href={`/lista/${wl.id}`}
                                                    className="bg-previa-surface border border-previa-border rounded-xl p-4 hover:border-previa-accent/30 hover:bg-previa-surface-hover transition-all group"
                                                >
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
