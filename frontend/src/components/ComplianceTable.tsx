'use client'

import { MoreVertical, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'

interface ComplianceRow {
    id: string
    empresa: string
    rfc: string
    art69: string
    art69B: string
    art69BIS: string
    art49BIS: string
}

interface ComplianceTableProps {
    data: ComplianceRow[]
}

type SortKey = keyof Pick<ComplianceRow, 'rfc' | 'art69' | 'art69B' | 'art69BIS' | 'art49BIS'>
type SortDir = 'asc' | 'desc' | null

function StatusChip({ value }: { value: string }) {
    if (value === 'N/A') {
        return <span className="text-previa-muted text-xs">—</span>
    }
    const isAlert = value !== 'N/A' && value.toLowerCase() !== 'limpio'
    const lower = value.toLowerCase()
    const color = lower.includes('definitiv') || lower.includes('crédito')
        ? 'bg-red-500/15 text-red-400 border-red-500/25'
        : lower.includes('presunt') || lower.includes('encontrado')
            ? 'bg-orange-500/15 text-orange-400 border-orange-500/25'
            : isAlert
                ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
                : 'bg-green-500/15 text-green-400 border-green-500/25'

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${color} whitespace-nowrap`}>
            {value}
        </span>
    )
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
    if (sortDir === 'asc') return <ChevronUp className="w-3 h-3 text-previa-accent" />
    return <ChevronDown className="w-3 h-3 text-previa-accent" />
}

export function ComplianceTable({ data }: ComplianceTableProps) {
    const [sortKey, setSortKey] = useState<SortKey | null>(null)
    const [sortDir, setSortDir] = useState<SortDir>(null)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc')
            if (sortDir === 'desc') setSortKey(null)
        } else {
            setSortKey(key)
            setSortDir('asc')
        }
    }

    const sorted = [...data].sort((a, b) => {
        if (!sortKey || !sortDir) return 0
        const av = a[sortKey] ?? ''
        const bv = b[sortKey] ?? ''
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })

    const allSelected = data.length > 0 && data.every(r => selected.has(r.id))
    const toggleAll = () => {
        setSelected(allSelected ? new Set() : new Set(data.map(r => r.id)))
    }
    const toggleRow = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const ThBtn = ({ col, label }: { col: SortKey; label: string }) => (
        <button
            onClick={() => handleSort(col)}
            className="flex items-center gap-1 text-xs font-semibold text-previa-muted uppercase tracking-wider hover:text-previa-ink transition-colors group"
        >
            {label}
            <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
        </button>
    )

    return (
        <div className="bg-previa-surface rounded-xl border border-previa-border overflow-hidden -mx-1 sm:mx-0">
            {selected.size > 0 && (
                <div className="flex items-center gap-3 px-3 sm:px-4 py-2 bg-previa-accent/5 border-b border-previa-accent/20">
                    <span className="text-xs text-previa-accent font-medium">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
                    <button className="text-xs text-previa-muted hover:text-previa-ink transition-colors" onClick={() => setSelected(new Set())}>
                        Deseleccionar
                    </button>
                </div>
            )}
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
                <table className="w-full min-w-[640px]">
                    <thead className="bg-previa-surface-hover border-b border-previa-border">
                        <tr>
                            <th className="w-10 px-2 sm:px-3 py-2 sm:py-3">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleAll}
                                    className="rounded border-previa-border bg-previa-background accent-blue-500 cursor-pointer"
                                />
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                                <ThBtn col="rfc" label="Empresa" />
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                                <ThBtn col="art69" label="Art.69" />
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                                <ThBtn col="art69B" label="Art.69-B" />
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                                <ThBtn col="art69BIS" label="Art.69-BIS" />
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">
                                <ThBtn col="art49BIS" label="Art.49-BIS" />
                            </th>
                            <th className="w-10 px-2 sm:px-3 py-2 sm:py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-previa-border">
                        {sorted.map((row) => {
                            const isSelected = selected.has(row.id)
                            return (
                                <tr
                                    key={row.id}
                                    onClick={() => toggleRow(row.id)}
                                    className={`group cursor-pointer transition-colors duration-100 ${isSelected
                                        ? 'bg-previa-accent/5'
                                        : 'hover:bg-previa-surface-hover'
                                        }`}
                                >
                                    <td className="px-2 sm:px-3 py-2 sm:py-3" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleRow(row.id)}
                                            className="rounded border-previa-border bg-previa-background accent-blue-500 cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                                        <div>
                                            <div className="text-xs font-mono font-semibold text-previa-ink">{row.rfc}</div>
                                            <div className="text-[11px] text-previa-muted truncate max-w-[140px] sm:max-w-[180px]">{row.empresa}</div>
                                        </div>
                                    </td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3"><StatusChip value={row.art69} /></td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3"><StatusChip value={row.art69B} /></td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3"><StatusChip value={row.art69BIS} /></td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3"><StatusChip value={row.art49BIS} /></td>
                                    <td className="px-2 sm:px-3 py-2 sm:py-3" onClick={e => e.stopPropagation()}>
                                        <button
                                            className="text-previa-muted hover:text-previa-ink transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-previa-border"
                                            aria-label="Más opciones"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {data.length === 0 && (
                <div className="py-10 text-center text-xs text-previa-muted">Sin datos</div>
            )}
        </div>
    )
}
