'use client'

import { MoreVertical } from 'lucide-react'

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

export function ComplianceTable({ data }: ComplianceTableProps) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-previa-muted overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-previa-surface border-b border-previa-muted">
                        <tr>
                            <th className="w-12 px-4 py-3">
                                <input
                                    type="checkbox"
                                    className="rounded border-previa-muted"
                                    aria-label="Select all"
                                />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-previa-ink uppercase tracking-wider">
                                Empresa
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-previa-ink uppercase tracking-wider">
                                Art.69
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-previa-ink uppercase tracking-wider">
                                Art.69-B
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-previa-ink uppercase tracking-wider">
                                Art.69-BIS
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-previa-ink uppercase tracking-wider">
                                Art.49-BIS
                            </th>
                            <th className="w-12 px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-previa-muted">
                        {data.map((row) => (
                            <tr key={row.id} className="hover:bg-previa-background transition-colors">
                                <td className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        className="rounded border-previa-muted"
                                        aria-label={`Select ${row.empresa}`}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <div>
                                        <div className="text-sm font-medium text-previa-ink">{row.rfc}</div>
                                        <div className="text-xs text-previa-muted">{row.empresa}</div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-previa-ink">{row.art69}</td>
                                <td className="px-4 py-3 text-sm text-previa-ink">{row.art69B}</td>
                                <td className="px-4 py-3 text-sm text-previa-ink">{row.art69BIS}</td>
                                <td className="px-4 py-3 text-sm text-previa-ink">{row.art49BIS}</td>
                                <td className="px-4 py-3">
                                    <button
                                        className="text-previa-muted hover:text-previa-ink transition-colors"
                                        aria-label="More options"
                                    >
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
