'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
    Search, ChevronDown, ChevronRight, ChevronUp, LayoutList, LayoutGrid,
    Plus, Pencil, Check, X, Loader2, Building2, RefreshCw, ShieldAlert, ShieldCheck,
    AlertTriangle, Info,
} from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { AuthGuard } from '@/components/AuthGuard'
import { TagBadge } from '@/components/TagBadge'
import { useUploadModal } from '@/contexts/UploadModalContext'
import { apiClient } from '@/lib/api-client'
import type { EmpresaRow, ChatContext, Organization, Watchlist, RiskLevel } from '@/types'

// ── Risk badge ───────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
    CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40',
    HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    LOW: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    CLEAR: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}

const RISK_ICONS: Record<string, typeof ShieldAlert> = {
    CRITICAL: ShieldAlert,
    HIGH: AlertTriangle,
    MEDIUM: AlertTriangle,
    LOW: Info,
    CLEAR: ShieldCheck,
}

function RiskBadge({ level }: { level?: RiskLevel | string | null }) {
    const l = (level || 'CLEAR').toUpperCase()
    const color = RISK_COLORS[l] || RISK_COLORS.CLEAR
    const Icon = RISK_ICONS[l] || ShieldCheck
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${color}`}>
            <Icon className="w-3 h-3" />
            {l}
        </span>
    )
}

// ── Article status pill ──────────────────────────────────────────────────────

const ART_STATUS_COLORS: Record<string, string> = {
    definitivo: 'bg-red-500/20 text-red-300',
    presunto: 'bg-orange-500/20 text-orange-300',
    desvirtuado: 'bg-emerald-500/15 text-emerald-400',
    sentencia_favorable: 'bg-emerald-500/15 text-emerald-400',
    credito_firme: 'bg-red-500/20 text-red-300',
    no_localizado: 'bg-orange-500/20 text-orange-300',
    credito_cancelado: 'bg-yellow-500/20 text-yellow-300',
    sentencia_condenatoria: 'bg-red-500/20 text-red-300',
}

const ART_STATUS_LABELS: Record<string, string> = {
    definitivo: 'Definitivo',
    presunto: 'Presunto',
    desvirtuado: 'Desvirtuado',
    sentencia_favorable: 'Sent. Favorable',
    credito_firme: 'Crédito Firme',
    no_localizado: 'No Localizado',
    credito_cancelado: 'Créd. Cancelado',
    sentencia_condenatoria: 'Sent. Condenatoria',
}

function StatusPill({ status }: { status: string }) {
    const color = ART_STATUS_COLORS[status] || 'bg-previa-surface text-previa-muted'
    const label = ART_STATUS_LABELS[status] || status
    return (
        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${color}`}>
            {label}
        </span>
    )
}

// ── Tag inline editor ────────────────────────────────────────────────────────

function TagEditor({
    current,
    knownTags,
    onSave,
    onCancel,
}: {
    current: string
    knownTags: string[]
    onSave: (tag: string) => void
    onCancel: () => void
}) {
    const [value, setValue] = useState(current)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { inputRef.current?.focus() }, [])

    const suggestions = knownTags.filter(
        (t) => t !== current && t.toLowerCase().includes(value.toLowerCase())
    )

    return (
        <div className="relative flex items-center gap-1">
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') onSave(value.trim())
                    if (e.key === 'Escape') onCancel()
                }}
                className="w-28 px-2 py-0.5 rounded-md bg-previa-background border border-previa-accent/50 text-xs text-previa-ink focus:outline-none focus:ring-1 focus:ring-previa-accent"
                placeholder="tag..."
            />
            <button onClick={() => onSave(value.trim())} className="p-0.5 text-green-400 hover:text-green-300"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={onCancel} className="p-0.5 text-previa-muted hover:text-previa-ink"><X className="w-3.5 h-3.5" /></button>
            {suggestions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-previa-surface border border-previa-border rounded-lg shadow-xl overflow-hidden min-w-[110px]">
                    {suggestions.map((s) => (
                        <button
                            key={s}
                            onClick={() => onSave(s)}
                            className="w-full text-left px-3 py-1.5 text-xs text-previa-ink hover:bg-previa-surface-hover transition-colors"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = 'rfc' | 'razon_social' | 'risk' | 'art_69b' | 'last_screened'
type SortDir = 'asc' | 'desc'

const RISK_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, CLEAR: 0 }

function sortRows(rows: EmpresaRow[], key: SortKey, dir: SortDir): EmpresaRow[] {
    const sorted = [...rows].sort((a, b) => {
        let cmp = 0
        switch (key) {
            case 'rfc': cmp = a.rfc.localeCompare(b.rfc); break
            case 'razon_social': cmp = a.razon_social.localeCompare(b.razon_social); break
            case 'risk': cmp = (RISK_ORDER[(a.risk_level || 'CLEAR')] ?? 0) - (RISK_ORDER[(b.risk_level || 'CLEAR')] ?? 0); break
            case 'art_69b': cmp = (a.art_69b_status || '').localeCompare(b.art_69b_status || ''); break
            case 'last_screened': cmp = (a.last_screened_at || '').localeCompare(b.last_screened_at || ''); break
        }
        return dir === 'asc' ? cmp : -cmp
    })
    return sorted
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <ChevronDown className="w-3 h-3 text-previa-muted/40" />
    return dir === 'asc'
        ? <ChevronUp className="w-3 h-3 text-previa-accent" />
        : <ChevronDown className="w-3 h-3 text-previa-accent" />
}

// ── Main CRM Page ────────────────────────────────────────────────────────────

export default function CRMPage() {
    return (
        <Suspense fallback={null}>
            <CRMPageContent />
        </Suspense>
    )
}

function CRMPageContent() {
    const params = useParams()
    const searchParams = useSearchParams()
    const router = useRouter()
    const orgId = Number(params.orgId)
    const { openUploadModal } = useUploadModal()

    const [org, setOrg] = useState<Organization | null>(null)
    const [empresas, setEmpresas] = useState<EmpresaRow[]>([])
    const [tags, setTags] = useState<string[]>([])
    const [watchlists, setWatchlists] = useState<Watchlist[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [activeTag, setActiveTag] = useState<string>(searchParams.get('tag') || '')
    const [activeWlId, setActiveWlId] = useState<number | undefined>(
        searchParams.get('wl') ? Number(searchParams.get('wl')) : undefined
    )
    const [searchQ, setSearchQ] = useState('')

    const [viewMode, setViewMode] = useState<'table' | 'grouped'>('table')
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

    const [sortKey, setSortKey] = useState<SortKey>('risk')
    const [sortDir, setSortDir] = useState<SortDir>('desc')

    const [editingId, setEditingId] = useState<number | null>(null)
    const [savingId, setSavingId] = useState<number | null>(null)

    const [chatContext, setChatContext] = useState<ChatContext>({})

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const [orgs, rows, tagList] = await Promise.all([
                apiClient.listOrganizations(),
                apiClient.listEmpresasByOrg(orgId),
                apiClient.listTags(orgId),
            ])
            const found = orgs.find((o) => o.id === orgId) ?? null
            setOrg(found)
            setWatchlists(found?.watchlists ?? [])
            setEmpresas(rows)
            setTags(tagList)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error cargando datos')
        } finally {
            setLoading(false)
        }
    }, [orgId])

    useEffect(() => { load() }, [load])

    // ── Filter + sort ────────────────────────────────────────────────────────
    const filtered = empresas.filter((row) => {
        if (activeTag && row.group_tag !== activeTag) return false
        if (activeWlId && row.watchlist_id !== activeWlId) return false
        if (searchQ) {
            const q = searchQ.toLowerCase()
            if (!row.rfc.toLowerCase().includes(q) && !row.razon_social.toLowerCase().includes(q)) return false
        }
        return true
    })
    const sorted = sortRows(filtered, sortKey, sortDir)

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDir('desc')
        }
    }

    const saveTag = async (row: EmpresaRow, newTag: string) => {
        setSavingId(row.id)
        try {
            await apiClient.updateCompany(row.watchlist_id, row.id, { group_tag: newTag || undefined })
            setEmpresas((prev) => prev.map((e) => e.id === row.id ? { ...e, group_tag: newTag || undefined } : e))
            if (newTag && !tags.includes(newTag)) setTags((prev) => [...prev, newTag].sort())
        } catch { /* ignore */ } finally {
            setSavingId(null)
            setEditingId(null)
        }
    }

    const toggleGroup = (g: string) =>
        setCollapsedGroups((prev) => {
            const next = new Set(prev)
            next.has(g) ? next.delete(g) : next.add(g)
            return next
        })

    const handleWatchlistSelect = (oid: number, wlId: number, orgName: string, wlName: string) => {
        setChatContext({ organization: orgName, watchlist: wlName, watchlist_id: wlId })
    }

    // ── Column definitions ───────────────────────────────────────────────────
    const columns: { key: string; label: string; sortable?: SortKey; width?: string }[] = [
        { key: 'rfc', label: 'RFC', sortable: 'rfc', width: 'w-36' },
        { key: 'razon_social', label: 'Razón Social', sortable: 'razon_social' },
        { key: 'risk', label: 'Riesgo', sortable: 'risk', width: 'w-28' },
        { key: 'art_69b', label: 'Art. 69-B', sortable: 'art_69b', width: 'w-28' },
        { key: 'art_69', label: 'Art. 69', width: 'w-32' },
        { key: 'art_69_bis', label: '69-B Bis', width: 'w-20' },
        { key: 'art_49_bis', label: '49 BIS', width: 'w-20' },
        { key: 'watchlist', label: 'Watchlist', width: 'w-28' },
        { key: 'tag', label: 'Tag', width: 'w-28' },
        { key: 'screened', label: 'Escaneo', sortable: 'last_screened', width: 'w-24' },
    ]

    // ── Row renderer ─────────────────────────────────────────────────────────
    const renderRow = (row: EmpresaRow) => (
        <tr key={row.id} className="border-b border-previa-border hover:bg-previa-surface-hover/40 transition-colors group">
            <td className="px-3 py-2.5 font-mono text-xs text-previa-accent whitespace-nowrap">{row.rfc}</td>
            <td className="px-3 py-2.5 text-sm text-previa-ink max-w-[200px] truncate">{row.razon_social}</td>
            <td className="px-3 py-2.5"><RiskBadge level={row.risk_level} /></td>
            <td className="px-3 py-2.5">
                {row.art_69b_status
                    ? <StatusPill status={row.art_69b_status} />
                    : <span className="text-[10px] text-previa-muted/50">—</span>
                }
            </td>
            <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                    {(row.art_69_categories || []).map((c) => (
                        <StatusPill key={c} status={c} />
                    ))}
                    {(!row.art_69_categories || row.art_69_categories.length === 0) && (
                        <span className="text-[10px] text-previa-muted/50">—</span>
                    )}
                </div>
            </td>
            <td className="px-3 py-2.5 text-center">
                {row.art_69_bis_found
                    ? <span className="text-[10px] font-bold text-red-400">SI</span>
                    : <span className="text-[10px] text-previa-muted/50">—</span>
                }
            </td>
            <td className="px-3 py-2.5 text-center">
                {row.art_49_bis_found
                    ? <span className="text-[10px] font-bold text-red-400">SI</span>
                    : <span className="text-[10px] text-previa-muted/50">—</span>
                }
            </td>
            <td className="px-3 py-2.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-previa-background border border-previa-border text-previa-muted truncate max-w-[100px] inline-block">
                    {row.watchlist_name}
                </span>
            </td>
            <td className="px-3 py-2.5">
                {editingId === row.id ? (
                    <TagEditor
                        current={row.group_tag ?? ''}
                        knownTags={tags}
                        onSave={(t) => saveTag(row, t)}
                        onCancel={() => setEditingId(null)}
                    />
                ) : savingId === row.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-previa-muted" />
                ) : (
                    <div className="flex items-center gap-1.5">
                        {row.group_tag
                            ? <TagBadge tag={row.group_tag} />
                            : <span className="text-xs text-previa-muted italic">—</span>
                        }
                        <button
                            onClick={() => setEditingId(row.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-previa-muted hover:text-previa-accent transition-all"
                            aria-label="Editar tag"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </td>
            <td className="px-3 py-2.5 text-[10px] text-previa-muted whitespace-nowrap">
                {row.last_screened_at
                    ? new Date(row.last_screened_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
                    : <span className="text-previa-muted/40">Sin escaneo</span>
                }
            </td>
        </tr>
    )

    // ── Summary stats ────────────────────────────────────────────────────────
    const stats = {
        critical: sorted.filter(r => r.risk_level === 'CRITICAL').length,
        high: sorted.filter(r => r.risk_level === 'HIGH').length,
        medium: sorted.filter(r => r.risk_level === 'MEDIUM').length,
        clear: sorted.filter(r => !r.risk_level || r.risk_level === 'CLEAR' || r.risk_level === 'LOW').length,
    }

    // ── Grouped view ─────────────────────────────────────────────────────────
    const grouped = sorted.reduce<Record<string, EmpresaRow[]>>((acc, row) => {
        const key = row.group_tag || '(sin tag)'
        if (!acc[key]) acc[key] = []
        acc[key].push(row)
        return acc
    }, {})
    const groupKeys = Object.keys(grouped).sort((a, b) => a === '(sin tag)' ? 1 : b === '(sin tag)' ? -1 : a.localeCompare(b))

    return (
        <AuthGuard>
            <div className="flex h-screen bg-previa-background overflow-hidden">
                <Sidebar onWatchlistSelect={handleWatchlistSelect} />

                <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                    {/* Header */}
                    <header className="bg-previa-surface border-b border-previa-border px-6 py-3 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Building2 className="w-5 h-5 text-previa-accent" />
                                <div>
                                    <h1 className="text-base font-semibold text-previa-ink">
                                        {org?.name ?? 'Organización'} — Base de Empresas
                                    </h1>
                                    <p className="text-xs text-previa-muted">
                                        {sorted.length} empresa{sorted.length !== 1 ? 's' : ''}
                                        {stats.critical > 0 && <span className="ml-2 text-red-400">{stats.critical} criticas</span>}
                                        {stats.high > 0 && <span className="ml-2 text-orange-400">{stats.high} altas</span>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openUploadModal(chatContext)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-previa-accent text-white text-xs rounded-lg hover:bg-previa-accent/90 transition-colors font-semibold"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Subir dataset
                                </button>
                                <button
                                    onClick={load}
                                    className="p-2 rounded-lg text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover transition-colors"
                                    title="Recargar"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Toolbar */}
                    <div className="bg-previa-surface border-b border-previa-border px-6 py-2 flex-shrink-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1 overflow-x-auto">
                                <button
                                    onClick={() => setActiveTag('')}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${!activeTag ? 'bg-previa-accent text-white' : 'text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover'}`}
                                >
                                    Todas ({empresas.length})
                                </button>
                                {tags.map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setActiveTag(activeTag === t ? '' : t)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${activeTag === t ? 'bg-previa-accent text-white' : 'text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover'}`}
                                    >
                                        {t} ({empresas.filter(e => e.group_tag === t).length})
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1" />

                            <select
                                value={activeWlId ?? ''}
                                onChange={(e) => setActiveWlId(e.target.value ? Number(e.target.value) : undefined)}
                                className="px-2 py-1 bg-previa-background border border-previa-border rounded-lg text-xs text-previa-ink focus:outline-none focus:ring-1 focus:ring-previa-accent"
                            >
                                <option value="">Todas las watchlists</option>
                                {watchlists.map((wl) => (
                                    <option key={wl.id} value={wl.id}>{wl.name}</option>
                                ))}
                            </select>

                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-previa-muted" />
                                <input
                                    type="text"
                                    value={searchQ}
                                    onChange={(e) => setSearchQ(e.target.value)}
                                    placeholder="Buscar RFC o empresa..."
                                    className="pl-8 pr-3 py-1 bg-previa-background border border-previa-border rounded-lg text-xs text-previa-ink placeholder-previa-muted focus:outline-none focus:ring-1 focus:ring-previa-accent w-52"
                                />
                            </div>

                            <div className="flex items-center rounded-lg border border-previa-border overflow-hidden">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`px-2 py-1.5 ${viewMode === 'table' ? 'bg-previa-accent/10 text-previa-accent' : 'text-previa-muted hover:text-previa-ink'} transition-colors`}
                                    title="Vista tabla"
                                >
                                    <LayoutList className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setViewMode('grouped')}
                                    className={`px-2 py-1.5 ${viewMode === 'grouped' ? 'bg-previa-accent/10 text-previa-accent' : 'text-previa-muted hover:text-previa-ink'} transition-colors`}
                                    title="Vista agrupada"
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="w-6 h-6 animate-spin text-previa-muted" />
                            </div>
                        ) : error ? (
                            <div className="m-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                                {error}
                            </div>
                        ) : sorted.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                                <Building2 className="w-10 h-10 text-previa-muted/40 mb-3" />
                                <p className="text-previa-muted text-sm mb-1">No hay empresas</p>
                                <p className="text-previa-muted/60 text-xs">
                                    {activeTag || activeWlId || searchQ
                                        ? 'Ninguna empresa coincide con los filtros actuales.'
                                        : 'Sube un dataset CSV o XLS para poblar esta organización.'}
                                </p>
                                {!activeTag && !activeWlId && !searchQ && (
                                    <button
                                        onClick={() => openUploadModal(chatContext)}
                                        className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-previa-accent text-white text-sm rounded-lg hover:bg-previa-accent/90 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Subir dataset
                                    </button>
                                )}
                            </div>
                        ) : viewMode === 'table' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[960px]">
                                    <thead className="bg-previa-surface border-b border-previa-border sticky top-0 z-10">
                                        <tr>
                                            {columns.map((col) => (
                                                <th
                                                    key={col.key}
                                                    className={`px-3 py-2.5 text-[10px] font-semibold text-previa-muted uppercase tracking-wider ${col.width || ''} ${col.sortable ? 'cursor-pointer select-none hover:text-previa-ink' : ''}`}
                                                    onClick={col.sortable ? () => handleSort(col.sortable!) : undefined}
                                                >
                                                    <span className="inline-flex items-center gap-1">
                                                        {col.label}
                                                        {col.sortable && <SortIcon active={sortKey === col.sortable} dir={sortDir} />}
                                                    </span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.map(renderRow)}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-6 space-y-4">
                                {groupKeys.map((gKey) => {
                                    const rows = grouped[gKey]
                                    const collapsed = collapsedGroups.has(gKey)
                                    const groupCritical = rows.filter(r => r.risk_level === 'CRITICAL').length
                                    return (
                                        <div key={gKey} className="bg-previa-surface border border-previa-border rounded-xl overflow-hidden">
                                            <button
                                                onClick={() => toggleGroup(gKey)}
                                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-previa-surface-hover transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    {collapsed
                                                        ? <ChevronRight className="w-4 h-4 text-previa-muted" />
                                                        : <ChevronDown className="w-4 h-4 text-previa-muted" />
                                                    }
                                                    {gKey !== '(sin tag)'
                                                        ? <TagBadge tag={gKey} size="md" />
                                                        : <span className="text-xs text-previa-muted italic">{gKey}</span>
                                                    }
                                                    <span className="text-xs text-previa-muted font-mono">{rows.length}</span>
                                                    {groupCritical > 0 && (
                                                        <span className="text-[10px] text-red-400 font-bold">{groupCritical} criticas</span>
                                                    )}
                                                </div>
                                            </button>
                                            {!collapsed && (
                                                <div className="border-t border-previa-border overflow-x-auto">
                                                    <table className="w-full text-left min-w-[960px]">
                                                        <thead className="bg-previa-background/50">
                                                            <tr>
                                                                {columns.map((col) => (
                                                                    <th key={col.key} className={`px-3 py-2 text-[10px] font-semibold text-previa-muted uppercase tracking-wider ${col.width || ''}`}>
                                                                        {col.label}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>{rows.map(renderRow)}</tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer stats bar */}
                    {sorted.length > 0 && (
                        <div className="bg-previa-surface border-t border-previa-border px-6 py-2 flex items-center gap-4 text-[10px] text-previa-muted flex-shrink-0">
                            <span>{sorted.length} empresas</span>
                            <span className="text-red-400">{stats.critical} CRITICAL</span>
                            <span className="text-orange-400">{stats.high} HIGH</span>
                            <span className="text-yellow-400">{stats.medium} MEDIUM</span>
                            <span className="text-emerald-400">{stats.clear} CLEAR/LOW</span>
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    )
}
