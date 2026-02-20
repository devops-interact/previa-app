'use client'

import { X } from '@/lib/icons'

/**
 * Deterministically maps a tag string to a color class so the same tag always
 * gets the same color across the app without storing color data.
 */
const TAG_COLORS = [
    'bg-violet-500/15 text-violet-300 border-violet-500/25',
    'bg-blue-500/15 text-blue-300 border-blue-500/25',
    'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    'bg-amber-500/15 text-amber-300 border-amber-500/25',
    'bg-rose-500/15 text-rose-300 border-rose-500/25',
    'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
    'bg-orange-500/15 text-orange-300 border-orange-500/25',
    'bg-pink-500/15 text-pink-300 border-pink-500/25',
]

function tagColor(tag: string): string {
    let hash = 0
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

interface TagBadgeProps {
    tag: string
    onRemove?: () => void
    onClick?: () => void
    size?: 'sm' | 'md'
}

export function TagBadge({ tag, onRemove, onClick, size = 'sm' }: TagBadgeProps) {
    const color = tagColor(tag)
    const base = size === 'md'
        ? 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border'
        : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border'

    return (
        <span
            className={`${base} ${color} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        >
            {tag}
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove() }}
                    className="opacity-60 hover:opacity-100 transition-opacity ml-0.5"
                    aria-label={`Quitar tag ${tag}`}
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </span>
    )
}
