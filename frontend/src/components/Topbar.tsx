'use client'

import { Search, Upload, Bell, ChevronRight } from '@/lib/icons'
import Link from 'next/link'
import { useUploadModal } from '@/contexts/UploadModalContext'
import type { ChatContext } from '@/types'

export interface BreadcrumbItem {
    label: string
    href?: string
}

interface TopbarProps {
    breadcrumbs: BreadcrumbItem[]
    chatContext?: ChatContext
    alertCount?: number
    onBellClick?: () => void
    showSearch?: boolean
}

export function Topbar({
    breadcrumbs,
    chatContext,
    alertCount = 0,
    onBellClick,
    showSearch = true,
}: TopbarProps) {
    const { openUploadModal } = useUploadModal()

    return (
        <header className="min-h-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 sm:px-5 bg-previa-surface border-b border-previa-border flex-shrink-0">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 min-w-0 text-sm">
                {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1.5 min-w-0">
                        {i > 0 && <ChevronRight className="w-3 h-3 text-previa-muted flex-shrink-0" />}
                        {crumb.href ? (
                            <Link
                                href={crumb.href}
                                className="text-previa-muted hover:text-previa-ink transition-colors truncate"
                            >
                                {crumb.label}
                            </Link>
                        ) : (
                            <span className="font-semibold text-previa-ink truncate">
                                {crumb.label}
                            </span>
                        )}
                    </span>
                ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
                {showSearch && (
                    <div className="relative flex-1 min-w-[120px] sm:flex-initial sm:w-auto">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-previa-muted pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar RFC, empresa..."
                            className="w-full sm:w-44 pl-8 pr-3 py-2 sm:py-1.5 bg-previa-background border border-previa-border rounded-lg text-xs text-previa-ink placeholder-previa-muted focus:outline-none focus:ring-1 focus:ring-previa-accent/60 focus:border-previa-accent transition-all"
                        />
                    </div>
                )}
                <button
                    onClick={() => openUploadModal(chatContext)}
                    className="flex items-center justify-center space-x-1.5 px-3 py-2 sm:py-1.5 bg-previa-accent/10 text-previa-accent text-xs rounded-lg border border-previa-accent/30 hover:bg-previa-accent/20 active:scale-[0.97] transition-all flex-1 sm:flex-initial"
                >
                    <Upload className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Subir</span>
                </button>
                <button
                    onClick={onBellClick}
                    className="relative text-previa-muted hover:text-previa-accent transition-colors p-2 sm:p-1.5 rounded-lg hover:bg-previa-surface-hover"
                    title={`${alertCount} alertas`}
                >
                    <Bell className="w-4 h-4" />
                    {alertCount > 0 && (
                        <span className="absolute top-1 right-1 sm:-top-0.5 sm:-right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold leading-none">
                            {alertCount > 9 ? '9+' : alertCount}
                        </span>
                    )}
                </button>
            </div>
        </header>
    )
}
