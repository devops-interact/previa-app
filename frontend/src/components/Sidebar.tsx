'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    ChevronDown, ChevronRight, FileText, Settings, User, LogOut,
    Building2, List, Plus, LayoutGrid, Menu, X,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Organization, Watchlist } from '@/types'
import { apiClient } from '@/lib/api-client'
import { OrganizationModal } from './OrganizationModal'

interface SidebarProps {
    onWatchlistSelect?: (orgId: number, wlId: number, orgName: string, wlName: string) => void
}

export function Sidebar({ onWatchlistSelect }: SidebarProps = {}) {
    const pathname = usePathname()
    const router = useRouter()
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [expandedOrgs, setExpandedOrgs] = useState<Set<number>>(new Set())
    const [showOrgModal, setShowOrgModal] = useState(false)
    const [loadingOrgs, setLoadingOrgs] = useState(true)
    const [activeWatchlist, setActiveWatchlist] = useState<number | null>(null)
    const [mobileOpen, setMobileOpen] = useState(false)

    // Close mobile drawer on route change (e.g. after clicking a link)
    useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    useEffect(() => {
        loadOrganizations()
    }, [])

    const loadOrganizations = async () => {
        try {
            setLoadingOrgs(true)
            const orgs = await apiClient.listOrganizations()
            setOrganizations(orgs)
            // Auto-expand first org
            if (orgs.length > 0) {
                setExpandedOrgs(new Set([orgs[0].id]))
            }
        } catch {
            // Auth may not be ready yet; silently fail
        } finally {
            setLoadingOrgs(false)
        }
    }

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
    }

    const handleLogout = () => {
        localStorage.removeItem('previa_auth')
        router.push('/')
    }

    // ── Organization modal callbacks ───────────────────────────────────────────

    const handleOrgCreated = (org: Organization) => {
        setOrganizations((prev) => [...prev, org])
        setExpandedOrgs((prev) => new Set([...prev, org.id]))
    }

    const handleOrgDeleted = (orgId: number) => {
        setOrganizations((prev) => prev.filter((o) => o.id !== orgId))
    }

    const handleWatchlistCreated = (orgId: number, wl: Watchlist) => {
        setOrganizations((prev) =>
            prev.map((o) =>
                o.id === orgId ? { ...o, watchlists: [...o.watchlists, wl] } : o
            )
        )
    }

    const handleWatchlistDeleted = (orgId: number, wlId: number) => {
        setOrganizations((prev) =>
            prev.map((o) =>
                o.id === orgId
                    ? { ...o, watchlists: o.watchlists.filter((w) => w.id !== wlId) }
                    : o
            )
        )
        if (activeWatchlist === wlId) setActiveWatchlist(null)
    }

    return (
        <>
            {/* Mobile menu button — visible only on small screens */}
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="md:hidden fixed bottom-5 left-4 z-30 flex items-center justify-center w-12 h-12 rounded-xl bg-previa-accent text-white shadow-lg shadow-previa-accent/25 hover:bg-previa-accent/90 active:scale-95 transition-all"
                aria-label="Abrir menú"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Overlay when sidebar is open on mobile */}
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
                {/* Logo + mobile close */}
                <div className="p-4 sm:p-5 border-b border-previa-border flex items-center justify-between gap-3">
                    <Link href="/tablero" className="text-lg sm:text-xl font-bold text-previa-accent tracking-tight truncate" onClick={() => setMobileOpen(false)}>
                        Previa App
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
                <p className="text-xs text-previa-muted px-4 sm:px-5 -mt-2 pb-3 border-b border-previa-border">Cumplimiento Fiscal SAT</p>

                {/* User Info */}
                <div className="p-4 border-b border-previa-border flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-previa-accent/20 text-previa-accent flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        U
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-previa-ink truncate">
                            {typeof window !== 'undefined'
                                ? (() => { try { return JSON.parse(localStorage.getItem('previa_auth') || '{}').email || 'Usuario' } catch { return 'Usuario' } })()
                                : 'Usuario'}
                        </div>
                        <div className="text-xs text-previa-muted">Analista</div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4 space-y-1">

                    {/* ── Organizaciones section ───────────────────────────── */}
                    <div className="px-4 mb-1 pb-12">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-previa-muted uppercase tracking-wider">
                                Organizaciones
                            </span>
                            <button
                                onClick={() => setShowOrgModal(true)}
                                className="p-1 rounded-md hover:bg-previa-surface-hover text-previa-muted hover:text-previa-accent transition-colors"
                                title="Gestionar organizaciones"
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
                                onClick={() => setShowOrgModal(true)}
                                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs text-previa-muted hover:text-previa-accent hover:bg-previa-surface-hover transition-all border border-dashed border-previa-border mt-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Nueva organización</span>
                            </button>
                        ) : (
                            <ul className="space-y-0.5">
                                {organizations.map((org) => (
                                    <li key={org.id}>
                                        {/* Org row */}
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

                                        {/* Children under org */}
                                        {expandedOrgs.has(org.id) && (
                                            <ul className="ml-5 border-l border-previa-border pl-3 mt-0.5 space-y-0.5 pb-1">
                                                {/* Ver empresas → CRM */}
                                                <li>
                                                    <Link
                                                        href={`/crm/${org.id}`}
                                                        className={`w-full flex items-center space-x-1.5 px-2 py-1.5 rounded-lg text-xs transition-all ${pathname === `/crm/${org.id}`
                                                            ? 'bg-previa-accent/10 text-previa-accent border border-previa-accent/20 font-semibold'
                                                            : 'text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover'
                                                            }`}
                                                    >
                                                        <LayoutGrid className="w-3 h-3 flex-shrink-0" />
                                                        <span>Ver empresas</span>
                                                    </Link>
                                                </li>

                                                {/* Watchlists */}
                                                {org.watchlists.length === 0 ? (
                                                    <li className="text-xs text-previa-muted py-1 px-2 italic">Sin watchlists</li>
                                                ) : (
                                                    org.watchlists.map((wl) => (
                                                        <li key={wl.id}>
                                                            <button
                                                                onClick={() => handleWatchlistClick(org, wl)}
                                                                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-all ${activeWatchlist === wl.id
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

                                                {/* Add watchlist / upload */}
                                                <li>
                                                    <button
                                                        onClick={() => setShowOrgModal(true)}
                                                        className="w-full flex items-center space-x-1.5 px-2 py-1 rounded-lg text-xs text-previa-muted hover:text-previa-accent hover:bg-previa-surface-hover transition-colors"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        <span>Watchlist</span>
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

                    {/* ── Herramientas ─────────────────────────────────────── */}
                    <div className="px-4 pb-12">
                        <h3 className="text-xs font-semibold text-previa-muted uppercase tracking-wider mb-1">
                            Herramientas
                        </h3>
                        <ul className="space-y-0.5">
                            <li>
                                <Link
                                    href="/chat"
                                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-all ${pathname === '/chat'
                                        ? 'bg-previa-accent/10 text-previa-accent font-semibold border border-previa-accent/20'
                                        : 'text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover'
                                        }`}
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>Agente IA</span>
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div className="border-t border-previa-border mx-4 my-2" />

                    {/* ── Configuración ────────────────────────────────────── */}
                    <div className="px-4 pb-12">
                        <h3 className="text-xs font-semibold text-previa-muted uppercase tracking-wider mb-1">
                            Configuración
                        </h3>
                        <ul className="space-y-0.5">
                            <li>
                                <Link
                                    href="#"
                                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover transition-colors"
                                >
                                    <User className="w-4 h-4" />
                                    <span>Cuenta</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="#"
                                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover transition-colors"
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
            </aside>

            {/* Organization management modal */}
            {showOrgModal && (
                <OrganizationModal
                    organizations={organizations}
                    onClose={() => setShowOrgModal(false)}
                    onCreated={handleOrgCreated}
                    onDeleted={handleOrgDeleted}
                    onWatchlistCreated={handleWatchlistCreated}
                    onWatchlistDeleted={handleWatchlistDeleted}
                />
            )}
        </>
    )
}
