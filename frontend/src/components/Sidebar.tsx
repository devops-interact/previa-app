'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    ChevronDown, ChevronRight, Settings, LogOut,
    Building2, List, Plus, LayoutGrid, Menu, X, RefreshCw, Home,
} from '@/lib/icons'
import { useState, useEffect } from 'react'
import type { Organization, Watchlist } from '@/types'
import { apiClient } from '@/lib/api-client'
import { useOrg } from '@/contexts/OrgContext'
import { OrganizationModal } from './OrganizationModal'

interface SidebarProps {
    onWatchlistSelect?: (orgId: number, wlId: number, orgName: string, wlName: string) => void
}

function getUserInfo(): { username: string; email: string; initial: string } {
    if (typeof window === 'undefined') return { username: 'Usuario', email: '', initial: 'U' }
    try {
        const auth = JSON.parse(localStorage.getItem('previa_auth') || '{}')
        const email = auth.email || ''
        const username = auth.username || email.split('@')[0] || 'Usuario'
        const initial = username.charAt(0).toUpperCase()
        return { username, email, initial }
    } catch {
        return { username: 'Usuario', email: '', initial: 'U' }
    }
}

export function Sidebar({ onWatchlistSelect }: SidebarProps = {}) {
    const pathname = usePathname()
    const router = useRouter()
    const {
        organizations,
        loading: loadingOrgs,
        handleOrgCreated,
        handleOrgUpdated,
        handleOrgDeleted,
        handleWatchlistCreated,
        handleWatchlistUpdated,
        handleWatchlistDeleted,
    } = useOrg()

    const [expandedOrgs, setExpandedOrgs] = useState<Set<number>>(new Set())
    const [orgModal, setOrgModal] = useState<{ open: boolean; initialTab?: 'list' | 'create'; initialWlOrgId?: number }>({ open: false })
    const [activeWatchlist, setActiveWatchlist] = useState<number | null>(null)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [sweepStatus, setSweepStatus] = useState<{
        last_completed_at: string | null
        total_files: number
        total_rows: number
    } | null>(null)

    useEffect(() => { setMobileOpen(false) }, [pathname])

    // Auto-expand the first org once loaded
    useEffect(() => {
        if (organizations.length > 0 && expandedOrgs.size === 0) {
            setExpandedOrgs(new Set([organizations[0].id]))
        }
    }, [organizations])

    useEffect(() => {
        const loadSweepStatus = async () => {
            try {
                const res = await apiClient.healthCheck() as {
                    sweep_status?: { last_completed_at: string | null; total_files: number; total_rows: number } | null
                }
                setSweepStatus(res.sweep_status ?? null)
            } catch {
                setSweepStatus(null)
            }
        }
        loadSweepStatus()
        const t = setInterval(loadSweepStatus, 60_000)
        return () => clearInterval(t)
    }, [])

    const toggleOrg = (orgId: number) => {
        setExpandedOrgs((prev) => {
            const next = new Set(prev)
            if (next.has(orgId)) next.delete(orgId)
            else next.add(orgId)
            return next
        })
    }

    const handleWatchlistClick = (org: Organization, wl: Watchlist) => {
        setActiveWatchlist(wl.id)
        onWatchlistSelect?.(org.id, wl.id, org.name, wl.name)
        router.push(`/lista/${wl.id}`)
    }

    const handleLogout = () => {
        localStorage.removeItem('previa_auth')
        router.push('/')
    }

    const user = getUserInfo()

    return (
        <>
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="md:hidden fixed bottom-5 left-4 z-30 flex items-center justify-center w-12 h-12 rounded-xl border border-previa-border bg-previa-surface text-previa-ink shadow-lg hover:bg-previa-surface-hover hover:border-previa-accent/50 active:scale-95 transition-all"
                aria-label="Abrir menú"
            >
                <Menu className="w-5 h-5" />
            </button>

            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={() => setMobileOpen(false)}
                    className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity"
                />
            )}

            <aside
                className={`
                    w-64 max-w-[85vw] bg-previa-surface border-r border-previa-border flex flex-col h-screen flex-shrink-0
                    fixed left-0 top-0 z-50 transform transition-transform duration-200 ease-out
                    md:relative md:translate-x-0 md:z-0 md:max-w-none
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                {/* Logo */}
                <div className="p-4 sm:p-5 border-b border-previa-border flex items-center justify-between gap-3">
                    <Link href="/tablero" className="text-lg sm:text-xl font-bold text-previa-accent tracking-tight truncate" onClick={() => setMobileOpen(false)}>
                        Prevify
                    </Link>
                    <button
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        className="md:hidden p-2 rounded-lg text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover"
                        aria-label="Cerrar menú"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* User Info */}
                <div className="p-4 border-b border-previa-border flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-previa-accent/20 text-previa-accent flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {user.initial}
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-previa-ink truncate">
                            {user.username}
                        </div>
                        <div className="text-xs text-previa-muted truncate">
                            {user.email}
                        </div>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-4 space-y-1">

                    {/* Tablero link */}
                    <div className="px-4 mb-2">
                        <Link
                            href="/tablero"
                            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                pathname === '/tablero'
                                    ? 'bg-previa-accent/10 text-previa-accent font-semibold border border-previa-accent/20'
                                    : 'text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover'
                            }`}
                        >
                            <Home className="w-4 h-4" />
                            <span>Tablero</span>
                        </Link>
                    </div>

                    <div className="border-t border-previa-border mx-4 my-2" />

                    {/* Organizaciones section */}
                    <div className="px-4 mb-1 pb-4">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-previa-muted uppercase tracking-wider">
                                Organizaciones
                            </span>
                            <button
                                onClick={() => setOrgModal({ open: true, initialTab: 'create' })}
                                className="p-1 rounded-md hover:bg-previa-surface-hover text-previa-muted hover:text-previa-accent transition-colors"
                                title="Nueva organización"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {loadingOrgs ? (
                            <div className="space-y-1 py-1">
                                {[1, 2].map((i) => (
                                    <div key={i} className="h-7 rounded-lg bg-previa-surface-hover animate-pulse" />
                                ))}
                            </div>
                        ) : organizations.length === 0 ? (
                            <button
                                onClick={() => setOrgModal({ open: true, initialTab: 'create' })}
                                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs text-previa-muted hover:text-previa-accent hover:bg-previa-surface-hover transition-all border border-dashed border-previa-border mt-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Nueva organización</span>
                            </button>
                        ) : (
                            <ul className="space-y-0.5">
                                {organizations.map((org) => (
                                    <li key={org.id}>
                                        <button
                                            onClick={() => toggleOrg(org.id)}
                                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-previa-surface-hover transition-colors group"
                                        >
                                            <div className="flex items-center space-x-2 min-w-0">
                                                <Building2 className="w-3.5 h-3.5 text-previa-accent flex-shrink-0" />
                                                <span className="text-previa-ink font-medium truncate text-xs">{org.name}</span>
                                            </div>
                                            {expandedOrgs.has(org.id)
                                                ? <ChevronDown className="w-3 h-3 text-previa-muted flex-shrink-0" />
                                                : <ChevronRight className="w-3 h-3 text-previa-muted flex-shrink-0" />
                                            }
                                        </button>

                                        {expandedOrgs.has(org.id) && (
                                            <ul className="ml-5 border-l border-previa-border pl-3 mt-0.5 space-y-0.5 pb-1">
                                                <li>
                                                    <Link
                                                        href={`/organizacion/${org.id}`}
                                                        className={`w-full flex items-center space-x-1.5 px-2 py-1.5 rounded-lg text-xs transition-all ${
                                                            pathname === `/organizacion/${org.id}`
                                                                ? 'bg-previa-accent/10 text-previa-accent border border-previa-accent/20 font-semibold'
                                                                : 'text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover'
                                                        }`}
                                                    >
                                                        <LayoutGrid className="w-3 h-3 flex-shrink-0" />
                                                        <span>Ver empresas</span>
                                                    </Link>
                                                </li>

                                                {org.watchlists.length === 0 ? (
                                                    <li className="text-xs text-previa-muted py-1 px-2 italic">Sin listas</li>
                                                ) : (
                                                    org.watchlists.map((wl) => (
                                                        <li key={wl.id}>
                                                            <button
                                                                onClick={() => handleWatchlistClick(org, wl)}
                                                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all ${
                                                                    activeWatchlist === wl.id || pathname === `/lista/${wl.id}`
                                                                        ? 'bg-previa-accent/10 text-previa-accent border border-previa-accent/20 font-semibold'
                                                                        : 'text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover'
                                                                }`}
                                                            >
                                                                <div className="flex items-center space-x-1.5 min-w-0">
                                                                    <List className="w-3 h-3 flex-shrink-0" />
                                                                    <span className="truncate">{wl.name}</span>
                                                                </div>
                                                                <span className="text-previa-muted opacity-60 ml-1 flex-shrink-0 font-mono text-xs">
                                                                    {wl.company_count}
                                                                </span>
                                                            </button>
                                                        </li>
                                                    ))
                                                )}

                                                <li>
                                                    <button
                                                        onClick={() => setOrgModal({ open: true, initialTab: 'list', initialWlOrgId: org.id })}
                                                        className="w-full flex items-center space-x-1.5 px-2 py-1 rounded-lg text-xs text-previa-muted hover:text-previa-accent hover:bg-previa-surface-hover transition-colors"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        <span>Lista de Monitoreo</span>
                                                    </button>
                                                </li>
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="border-t border-previa-border mx-4 my-2" />

                    {/* Configuración */}
                    <div className="px-4 pb-4">
                        <h3 className="text-xs font-semibold text-previa-muted uppercase tracking-wider mb-1">
                            Configuración
                        </h3>
                        <ul className="space-y-0.5">
                            <li>
                                <Link
                                    href="/preferencias"
                                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                        pathname === '/preferencias'
                                            ? 'bg-previa-accent/10 text-previa-accent font-semibold border border-previa-accent/20'
                                            : 'text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover'
                                    }`}
                                >
                                    <Settings className="w-4 h-4" />
                                    <span>Preferencias</span>
                                </Link>
                            </li>
                            <li>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-previa-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Salir</span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </nav>

                {/* Daily sweep indicator */}
                <div className="flex-shrink-0 border-t border-previa-border px-4 py-3 bg-previa-surface-hover/50">
                    <div className="flex items-center gap-1.5 mb-1">
                        <RefreshCw className="w-3 h-3 text-previa-muted" />
                        <span className="text-xs font-semibold text-previa-muted uppercase tracking-wider">
                            Análisis diario SAT
                        </span>
                    </div>
                    {sweepStatus?.last_completed_at ? (
                        <>
                            <div className="text-xs text-previa-ink">
                                {new Date(sweepStatus.last_completed_at).toLocaleDateString(undefined, {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                })}{' '}
                                {new Date(sweepStatus.last_completed_at).toLocaleTimeString(undefined, {
                                    hour: '2-digit', minute: '2-digit',
                                })}
                            </div>
                            <div className="text-xs text-previa-muted mt-0.5">
                                {sweepStatus.total_files} archivos · {sweepStatus.total_rows.toLocaleString()} líneas
                            </div>
                        </>
                    ) : (
                        <div className="text-xs text-previa-muted">Sin análisis aún</div>
                    )}
                </div>
            </aside>

            {orgModal.open && (
                <OrganizationModal
                    organizations={organizations}
                    initialTab={orgModal.initialTab}
                    initialWlOrgId={orgModal.initialWlOrgId}
                    onClose={() => setOrgModal({ open: false })}
                    onCreated={handleOrgCreated}
                    onDeleted={handleOrgDeleted}
                    onOrgUpdated={handleOrgUpdated}
                    onWatchlistCreated={handleWatchlistCreated}
                    onWatchlistDeleted={handleWatchlistDeleted}
                    onWatchlistUpdated={handleWatchlistUpdated}
                />
            )}
        </>
    )
}
