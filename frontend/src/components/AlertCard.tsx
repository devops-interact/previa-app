'use client'

import { AlertTriangle, X } from '@/lib/icons'
import { useState } from 'react'
import type { AlertSeverity } from '@/types'

interface AlertCardProps {
    severity: AlertSeverity
    article: string
    rfc: string
    entityName: string
    status: string
    onDismiss?: () => void
}

const severityConfig = {
    CRITICAL: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        glow: 'shadow-red-500/10',
        iconBg: 'bg-red-500',
        textPrimary: 'text-red-400',
        textSecondary: 'text-red-300',
        textTertiary: 'text-red-400/70',
    },
    HIGH: {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        glow: 'shadow-orange-500/10',
        iconBg: 'bg-orange-500',
        textPrimary: 'text-orange-400',
        textSecondary: 'text-orange-300',
        textTertiary: 'text-orange-400/70',
    },
    MEDIUM: {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        glow: 'shadow-yellow-500/10',
        iconBg: 'bg-yellow-500',
        textPrimary: 'text-yellow-400',
        textSecondary: 'text-yellow-300',
        textTertiary: 'text-yellow-400/70',
    },
    LOW: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        glow: 'shadow-blue-500/10',
        iconBg: 'bg-blue-500',
        textPrimary: 'text-blue-400',
        textSecondary: 'text-blue-300',
        textTertiary: 'text-blue-400/70',
    },
    INFO: {
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/30',
        glow: 'shadow-gray-500/10',
        iconBg: 'bg-gray-500',
        textPrimary: 'text-gray-400',
        textSecondary: 'text-gray-300',
        textTertiary: 'text-gray-400/70',
    }
}

export function AlertCard({ severity, article, rfc, entityName, status, onDismiss }: AlertCardProps) {
    const [dismissed, setDismissed] = useState(false)
    const config = severityConfig[severity]

    const handleDismiss = () => {
        setDismissed(true)
        onDismiss?.()
    }

    if (dismissed) return null

    return (
        <div className={`${config.bg} rounded-xl p-3.5 flex items-start gap-3 border ${config.border} transition-all duration-150 hover:brightness-110 active:scale-[0.99] cursor-pointer`}>
            {/* Icon */}
            <div className={`shrink-0 w-8 h-8 ${config.iconBg} rounded-lg flex items-center justify-center`}>
                <AlertTriangle className="w-4 h-4 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${config.textPrimary} leading-tight`}>
                    Alerta {article}
                </p>
                <p className={`text-[11px] font-mono font-semibold ${config.textSecondary} mt-0.5`}>
                    {rfc}
                </p>
                <p className={`text-[11px] ${config.textTertiary} uppercase tracking-wide truncate mt-0.5`}>
                    {entityName}
                </p>
            </div>
        </div>
    )
}
