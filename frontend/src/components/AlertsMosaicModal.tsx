'use client'

import { useState, useMemo } from 'react'
import {
    X, Search, SlidersHorizontal, ArrowUpDown,
    AlertTriangle, Filter, Bell,
} from 'lucide-react'
import type { Alert, AlertSeverity } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type SortOrder = 'newest' | 'oldest'

const SEVERITY_ORDER: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']

const SEVERITY_META: Record<AlertSeverity, { label: string; dot: string; pill: string }> = {
    CRITICAL: { label: 'Crítico',  dot: 'bg-red-500',    pill: 'bg-red-500/15 text-red-400 border-red-500/30' },
    HIGH:     { label: 'Alto',     dot: 'bg-orange-500', pill: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    MEDIUM:   { label: 'Medio',    dot: 'bg-yellow-500', pill: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    LOW:      { label: 'Bajo',     dot: 'bg-blue-500',   pill: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    INFO:     { label: 'Info',     dot: 'bg-gray-500',   pill: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

const CARD_BG: Record<AlertSeverity, string> = {
    CRITICAL: 'bg-red-500/8 border-red-500/25 hover:border-red-500/50',
    HIGH:     'bg-orange-500/8 border-orange-500/25 hover:border-orange-500/50',
    MEDIUM:   'bg-yellow-500/8 border-yellow-500/25 hover:border-yellow-500/50',
    LOW:      'bg-blue-500/8 border-blue-500/25 hover:border-blue-500/50',
    INFO:     'bg-gray-500/8 border-gray-500/25 hover:border-gray-500/50',
}

const ICON_BG: Record<AlertSeverity, string> = {
    CRITICAL: 'bg-red-500',
    HIGH:     'bg-orange-500',
    MEDIUM:   'bg-yellow-500',
    LOW:      'bg-blue-500',
    INFO:     'bg-gray-500',
}

const ARTICLES = ['Art.69-B', 'Art.69', 'Art.69-BIS', 'Art.49-BIS'] as const
const STATUSES  = ['Presunto', 'Definitivo', 'Desvirtuado', 'Sentencia'] as const

// ── Sub-components ────────────────────────────────────────────────────────────

function PillBtn({
    active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 whitespace-nowrap active:scale-[0.97] ${active
                ? 'bg-previa-accent/15 text-previa-accent border-previa-accent/40'
                : 'bg-previa-background text-previa-muted border-previa-border hover:border-previa-accent/30 hover:text-previa-ink'
            }`}
        >
            {children}
        </button>
    )
}

function AlertMosaicCard({
    alert,
    idx,
    onClick,
}: { alert: Alert; idx: number; onClick: () => void }) {
    const meta = SEVERITY_META[alert.severity]
    return (
        <button
            onClick={onClick}
            className={`w-full text-left rounded-xl p-4 border ${CARD_BG[alert.severity]} transition-all duration-150 hover:scale-[1.015] active:scale-[0.99] animate-fade-up group`}
            style={{ animationDelay: `${Math.min(idx * 40, 400)}ms` }}
        >
            <div className="flex items-start gap-3">
                <div className={`shrink-0 w-8 h-8 ${ICON_BG[alert.severity]} rounded-lg flex items-center justify-center mt-0.5`}>
                    <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.pill}`}>
                            {meta.label}
                        </span>
                        <span className="text-[11px] font-mono text-previa-muted border border-previa-border bg-previa-background px-1.5 py-0.5 rounded">
                            {alert.article}
                        </span>
                    </div>
                    <p className="text-xs font-mono font-bold text-previa-ink leading-tight truncate">
                        {alert.rfc}
                    </p>
                    <p className="text-[11px] text-previa-muted uppercase tracking-wide truncate mt-0.5">
                        {alert.entityName}
                    </p>
                    {alert.status && alert.status !== 'Sin hallazgo' && (
                        <p className="text-[11px] text-previa-muted/70 truncate mt-1.5 leading-tight">
                            {alert.status}
                        </p>
                    )}
                </div>
            </div>
            {alert.timestamp && (
                <p className="text-[10px] text-previa-muted/50 mt-3 font-mono">
                    {new Date(alert.timestamp).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
            )}
        </button>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

interface AlertsMosaicModalProps {
    alerts: Alert[]
    onClose: () => void
    onSelectAlert: (filteredAlerts: Alert[], index: number) => void
}

export function AlertsMosaicModal({ alerts, onClose, onSelectAlert }: AlertsMosaicModalProps) {
    const [query, setQuery]               = useState('')
    const [severityFilter, setSeverity]   = useState<AlertSeverity | 'ALL'>('ALL')
    const [articleFilter, setArticle]     = useState<string>('ALL')
    const [statusFilter, setStatus]       = useState<string>('ALL')
    const [sortOrder, setSortOrder]       = useState<SortOrder>('newest')
    const [filtersOpen, setFiltersOpen]   = useState(false)

    const filtered = useMemo(() => {
        let list = [...alerts]

        // Text search (RFC or entity name)
        if (query.trim()) {
            const q = query.trim().toLowerCase()
            list = list.filter(
                a => a.rfc.toLowerCase().includes(q) || a.entityName.toLowerCase().includes(q)
            )
        }

        // Severity
        if (severityFilter !== 'ALL') {
            list = list.filter(a => a.severity === severityFilter)
        }

        // Article
        if (articleFilter !== 'ALL') {
            list = list.filter(a => a.article === articleFilter)
        }

        // Status (partial match against status string)
        if (statusFilter !== 'ALL') {
            const s = statusFilter.toLowerCase()
            list = list.filter(a => a.status.toLowerCase().includes(s))
        }

        // Sort
        list.sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0
            // Fall back to severity order if timestamps equal
            const sevDiff = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
            if (ta === tb) return sevDiff
            return sortOrder === 'newest' ? tb - ta : ta - tb
        })

        return list
    }, [alerts, query, severityFilter, articleFilter, statusFilter, sortOrder])

    // Counts per severity for the pill badges
    const severityCounts = useMemo(() => {
        const counts: Partial<Record<AlertSeverity, number>> = {}
        for (const a of alerts) counts[a.severity] = (counts[a.severity] ?? 0) + 1
        return counts
    }, [alerts])

    const activeFilterCount = [
        severityFilter !== 'ALL',
        articleFilter !== 'ALL',
        statusFilter !== 'ALL',
    ].filter(Boolean).length

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-previa-background/95 backdrop-blur-md">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-4 px-6 h-14 border-b border-previa-border bg-previa-surface flex-shrink-0">
                <div className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-previa-accent" />
                    <h2 className="text-sm font-semibold text-previa-ink">
                        Alertas Activas
                    </h2>
                    <span className="text-xs font-mono text-previa-muted bg-previa-background border border-previa-border px-2 py-0.5 rounded-full">
                        {filtered.length} / {alerts.length}
                    </span>
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-previa-muted" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar RFC o empresa…"
                        className="w-full pl-8 pr-3 py-1.5 bg-previa-background border border-previa-border rounded-lg text-xs text-previa-ink placeholder-previa-muted focus:outline-none focus:ring-1 focus:ring-previa-accent/60 focus:border-previa-accent transition-all"
                    />
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {/* Sort toggle */}
                    <button
                        onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-previa-border text-xs text-previa-muted hover:text-previa-ink hover:border-previa-accent/30 bg-previa-background transition-all"
                        title={sortOrder === 'newest' ? 'Más recientes primero' : 'Más antiguos primero'}
                    >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <span>{sortOrder === 'newest' ? 'Recientes' : 'Antiguos'}</span>
                    </button>

                    {/* Filters toggle */}
                    <button
                        onClick={() => setFiltersOpen(o => !o)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${filtersOpen || activeFilterCount > 0
                            ? 'border-previa-accent/40 bg-previa-accent/10 text-previa-accent'
                            : 'border-previa-border bg-previa-background text-previa-muted hover:text-previa-ink hover:border-previa-accent/30'
                        }`}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Filtros</span>
                        {activeFilterCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-previa-accent text-white text-[10px] flex items-center justify-center font-bold">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    <div className="w-px h-5 bg-previa-border" />

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Filter bar (collapsible) ────────────────────────────────────── */}
            {filtersOpen && (
                <div className="flex-shrink-0 px-6 py-3 border-b border-previa-border bg-previa-surface flex flex-wrap items-center gap-4 animate-fade-up">
                    {/* Severity */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-previa-muted uppercase tracking-wider font-semibold">Severidad</span>
                        <div className="flex items-center gap-1.5">
                            <PillBtn active={severityFilter === 'ALL'} onClick={() => setSeverity('ALL')}>
                                Todas
                            </PillBtn>
                            {SEVERITY_ORDER.map(sev => (
                                <PillBtn key={sev} active={severityFilter === sev} onClick={() => setSeverity(sev)}>
                                    <span className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_META[sev].dot}`} />
                                        {SEVERITY_META[sev].label}
                                        {severityCounts[sev] != null && (
                                            <span className="opacity-60 font-mono text-[10px]">{severityCounts[sev]}</span>
                                        )}
                                    </span>
                                </PillBtn>
                            ))}
                        </div>
                    </div>

                    <div className="w-px h-5 bg-previa-border" />

                    {/* Article */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-previa-muted uppercase tracking-wider font-semibold">Artículo</span>
                        <div className="flex items-center gap-1.5">
                            <PillBtn active={articleFilter === 'ALL'} onClick={() => setArticle('ALL')}>
                                Todos
                            </PillBtn>
                            {ARTICLES.map(a => (
                                <PillBtn key={a} active={articleFilter === a} onClick={() => setArticle(a)}>
                                    {a}
                                </PillBtn>
                            ))}
                        </div>
                    </div>

                    <div className="w-px h-5 bg-previa-border" />

                    {/* Status */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-previa-muted uppercase tracking-wider font-semibold">Estatus</span>
                        <div className="flex items-center gap-1.5">
                            <PillBtn active={statusFilter === 'ALL'} onClick={() => setStatus('ALL')}>
                                Todos
                            </PillBtn>
                            {STATUSES.map(s => (
                                <PillBtn key={s} active={statusFilter === s} onClick={() => setStatus(s)}>
                                    {s}
                                </PillBtn>
                            ))}
                        </div>
                    </div>

                    {/* Clear */}
                    {activeFilterCount > 0 && (
                        <>
                            <div className="w-px h-5 bg-previa-border" />
                            <button
                                onClick={() => { setSeverity('ALL'); setArticle('ALL'); setStatus('ALL') }}
                                className="text-xs text-previa-muted hover:text-red-400 transition-colors flex items-center gap-1"
                            >
                                <Filter className="w-3 h-3" />
                                Limpiar filtros
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ── Mosaic grid ─────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-6">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20">
                        <AlertTriangle className="w-12 h-12 text-previa-muted/30 mb-4" />
                        <p className="text-sm font-semibold text-previa-ink mb-1">
                            {alerts.length === 0 ? 'Sin alertas activas' : 'Sin resultados'}
                        </p>
                        <p className="text-xs text-previa-muted max-w-xs">
                            {alerts.length === 0
                                ? 'Sube un dataset para iniciar la verificación SAT.'
                                : 'Ninguna alerta coincide con los filtros actuales.'}
                        </p>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={() => { setSeverity('ALL'); setArticle('ALL'); setStatus('ALL'); setQuery('') }}
                                className="mt-4 text-xs text-previa-accent hover:underline"
                            >
                                Limpiar todos los filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filtered.map((alert, idx) => (
                            <AlertMosaicCard
                                key={alert.id}
                                alert={alert}
                                idx={idx}
                                onClick={() => onSelectAlert(filtered, idx)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Footer summary ──────────────────────────────────────────────── */}
            {filtered.length > 0 && (
                <div className="flex-shrink-0 px-6 py-3 border-t border-previa-border bg-previa-surface flex items-center gap-4">
                    {SEVERITY_ORDER.filter(s => severityCounts[s]).map(sev => (
                        <div key={sev} className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${SEVERITY_META[sev].dot}`} />
                            <span className="text-xs text-previa-muted">
                                {severityCounts[sev]} {SEVERITY_META[sev].label.toLowerCase()}
                            </span>
                        </div>
                    ))}
                    <span className="ml-auto text-xs text-previa-muted">
                        {filtered.length} alerta{filtered.length !== 1 ? 's' : ''} mostrada{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>
            )}
        </div>
    )
}
