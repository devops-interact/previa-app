'use client'

import { AlertTriangle, X } from 'lucide-react'
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
        bg: 'bg-red-50',
        border: 'border-red-200',
        iconBg: 'bg-red-500',
        textPrimary: 'text-red-900',
        textSecondary: 'text-red-800',
        textTertiary: 'text-red-700',
        badge: 'bg-red-100 text-red-800',
        dismissHover: 'hover:text-red-600'
    },
    HIGH: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        iconBg: 'bg-orange-500',
        textPrimary: 'text-orange-900',
        textSecondary: 'text-orange-800',
        textTertiary: 'text-orange-700',
        badge: 'bg-orange-100 text-orange-800',
        dismissHover: 'hover:text-orange-600'
    },
    MEDIUM: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        iconBg: 'bg-yellow-500',
        textPrimary: 'text-yellow-900',
        textSecondary: 'text-yellow-800',
        textTertiary: 'text-yellow-700',
        badge: 'bg-yellow-100 text-yellow-800',
        dismissHover: 'hover:text-yellow-600'
    },
    LOW: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        iconBg: 'bg-blue-500',
        textPrimary: 'text-blue-900',
        textSecondary: 'text-blue-800',
        textTertiary: 'text-blue-700',
        badge: 'bg-blue-100 text-blue-800',
        dismissHover: 'hover:text-blue-600'
    },
    INFO: {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        iconBg: 'bg-gray-500',
        textPrimary: 'text-gray-900',
        textSecondary: 'text-gray-800',
        textTertiary: 'text-gray-700',
        badge: 'bg-gray-100 text-gray-800',
        dismissHover: 'hover:text-gray-600'
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
        <div className={`${config.bg} rounded-xl p-4 flex items-start space-x-4 shadow-sm border border-transparent hover:shadow-md transition-shadow`}>
            {/* Icon Box */}
            <div className={`flex-shrink-0 w-10 h-10 ${config.iconBg} rounded-lg flex items-center justify-center shadow-sm`}>
                <AlertTriangle className="w-5 h-5 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                        <h3 className={`text-sm font-bold ${config.textPrimary} mb-1`}>
                            Alerta de Presuntos {article}
                        </h3>
                        <p className={`text-xs font-mono font-semibold ${config.textSecondary} mb-0.5`}>
                            {rfc}
                        </p>
                        <p className={`text-xs ${config.textTertiary} uppercase tracking-wide opacity-80 truncate`}>
                            {entityName}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
