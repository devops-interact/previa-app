'use client'

import { useState } from 'react'
import {
    X, AlertTriangle, ChevronLeft, ChevronRight,
    ExternalLink, Printer, Download, FileText, Clock,
    Building2, Shield,
} from 'lucide-react'
import type { Alert, AlertSeverity } from '@/types'

interface NotificationModalProps {
    alerts: Alert[]
    initialIndex?: number
    onClose: () => void
}

const severityConfig: Record<AlertSeverity, {
    bg: string; border: string; iconBg: string; badge: string; label: string
}> = {
    CRITICAL: {
        bg: 'bg-red-500/10', border: 'border-red-500/40',
        iconBg: 'bg-red-500', badge: 'bg-red-500/20 text-red-300 border-red-500/30', label: 'CRÍTICO',
    },
    HIGH: {
        bg: 'bg-orange-500/10', border: 'border-orange-500/40',
        iconBg: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30', label: 'ALTO',
    },
    MEDIUM: {
        bg: 'bg-yellow-500/10', border: 'border-yellow-500/40',
        iconBg: 'bg-yellow-500', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', label: 'MEDIO',
    },
    LOW: {
        bg: 'bg-blue-500/10', border: 'border-blue-500/40',
        iconBg: 'bg-blue-500', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30', label: 'BAJO',
    },
    INFO: {
        bg: 'bg-gray-500/10', border: 'border-gray-500/40',
        iconBg: 'bg-gray-500', badge: 'bg-gray-500/20 text-gray-300 border-gray-500/30', label: 'INFO',
    },
}

const articleContext: Record<string, string> = {
    'Art.69-B': 'Empresas que Facturan Operaciones Simuladas (EFOS). El SAT presume que las operaciones amparadas en los comprobantes fiscales de estos contribuyentes no producen efectos fiscales.',
    'Art.69': 'Contribuyentes con créditos fiscales firmes, incumplimiento de obligaciones, condonaciones u otras situaciones publicadas en el DOF conforme al Artículo 69 del CFF.',
    'Art.69-BIS': 'Artículo 69-BIS: Contribuyentes que transmiten indebidamente pérdidas fiscales. Las operaciones pueden ser rechazadas por la autoridad fiscal.',
    'Art.49-BIS': 'Artículo 49-BIS: Empresas con revisiones de gabinete o auditorías SAT en curso. Mayor riesgo de rechazo de deducciones.',
}

export function NotificationModal({ alerts, initialIndex = 0, onClose }: NotificationModalProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)
    const alert = alerts[currentIndex]

    if (!alert) return null

    const cfg = severityConfig[alert.severity]
    const context = articleContext[alert.article] || 'Consulta el DOF y el portal del SAT para mayor información sobre esta alerta.'

    const handlePrint = () => {
        const printContent = `
            <html>
            <head>
                <title>Alerta Fiscal — ${alert.rfc}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
                    h1 { font-size: 18px; margin-bottom: 4px; }
                    .badge { display: inline-block; background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 16px; }
                    .section { margin-bottom: 12px; }
                    .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px; }
                    .value { font-size: 14px; }
                    .context { background: #f3f4f6; padding: 12px; border-radius: 8px; font-size: 13px; color: #374151; }
                    footer { margin-top: 32px; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
                </style>
            </head>
            <body>
                <h1>Reporte de Alerta Fiscal</h1>
                <div class="badge">Severidad: ${cfg.label}</div>
                <div class="section"><div class="label">RFC</div><div class="value">${alert.rfc}</div></div>
                <div class="section"><div class="label">Entidad</div><div class="value">${alert.entityName}</div></div>
                <div class="section"><div class="label">Artículo</div><div class="value">${alert.article}</div></div>
                <div class="section"><div class="label">Estatus</div><div class="value">${alert.status}</div></div>
                ${alert.oficio ? `<div class="section"><div class="label">Oficio</div><div class="value">${alert.oficio}</div></div>` : ''}
                ${alert.authority ? `<div class="section"><div class="label">Autoridad</div><div class="value">${alert.authority}</div></div>` : ''}
                <div class="section"><div class="label">Contexto Regulatorio</div><div class="context">${context}</div></div>
                <footer>Generado por Previa App · ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</footer>
            </body>
            </html>
        `
        const win = window.open('', '_blank')
        if (win) {
            win.document.write(printContent)
            win.document.close()
            win.print()
        }
    }

    const handleDownloadPDF = () => {
        // Browser print-to-PDF fallback
        handlePrint()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className={`bg-previa-surface border ${cfg.border} rounded-2xl w-full max-w-xl shadow-2xl`}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-previa-border">
                    <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-lg ${cfg.iconBg} flex items-center justify-center`}>
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-previa-ink">Detalle de Alerta</h2>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.badge} font-mono`}>
                                {cfg.label} · {alert.article}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {/* Navigation */}
                        <button
                            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                            disabled={currentIndex === 0}
                            className="p-1.5 rounded-lg hover:bg-previa-surface-hover disabled:opacity-30 transition-colors text-previa-muted"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-previa-muted font-mono">
                            {currentIndex + 1}/{alerts.length}
                        </span>
                        <button
                            onClick={() => setCurrentIndex(Math.min(alerts.length - 1, currentIndex + 1))}
                            disabled={currentIndex === alerts.length - 1}
                            className="p-1.5 rounded-lg hover:bg-previa-surface-hover disabled:opacity-30 transition-colors text-previa-muted"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-previa-border mx-1" />
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-previa-surface-hover transition-colors text-previa-muted">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* RFC + Entity */}
                    <div className={`${cfg.bg} rounded-xl p-4 border ${cfg.border}`}>
                        <div className="flex items-start space-x-3">
                            <Building2 className="w-4 h-4 text-previa-muted mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-mono text-sm font-bold text-previa-ink">{alert.rfc}</p>
                                <p className="text-xs text-previa-muted mt-0.5">{alert.entityName}</p>
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-previa-background rounded-xl p-3 border border-previa-border">
                            <div className="flex items-center space-x-1.5 mb-1">
                                <Shield className="w-3.5 h-3.5 text-previa-muted" />
                                <span className="text-xs font-medium text-previa-muted uppercase tracking-wider">Estatus</span>
                            </div>
                            <p className="text-sm text-previa-ink">{alert.status}</p>
                        </div>
                        {alert.timestamp && (
                            <div className="bg-previa-background rounded-xl p-3 border border-previa-border">
                                <div className="flex items-center space-x-1.5 mb-1">
                                    <Clock className="w-3.5 h-3.5 text-previa-muted" />
                                    <span className="text-xs font-medium text-previa-muted uppercase tracking-wider">Fecha</span>
                                </div>
                                <p className="text-sm text-previa-ink font-mono">{alert.timestamp}</p>
                            </div>
                        )}
                        {alert.oficio && (
                            <div className="bg-previa-background rounded-xl p-3 border border-previa-border">
                                <div className="flex items-center space-x-1.5 mb-1">
                                    <FileText className="w-3.5 h-3.5 text-previa-muted" />
                                    <span className="text-xs font-medium text-previa-muted uppercase tracking-wider">Oficio</span>
                                </div>
                                <p className="text-sm text-previa-ink font-mono">{alert.oficio}</p>
                            </div>
                        )}
                        {alert.authority && (
                            <div className="bg-previa-background rounded-xl p-3 border border-previa-border">
                                <div className="flex items-center space-x-1.5 mb-1">
                                    <Shield className="w-3.5 h-3.5 text-previa-muted" />
                                    <span className="text-xs font-medium text-previa-muted uppercase tracking-wider">Autoridad</span>
                                </div>
                                <p className="text-sm text-previa-ink">{alert.authority}</p>
                            </div>
                        )}
                    </div>

                    {/* Regulatory context */}
                    <div className="bg-previa-background rounded-xl p-4 border border-previa-border">
                        <p className="text-xs font-semibold text-previa-muted uppercase tracking-wider mb-2">
                            Contexto Regulatorio — {alert.article}
                        </p>
                        <p className="text-sm text-previa-muted leading-relaxed">{context}</p>
                    </div>

                    {/* Public report link */}
                    {alert.publicReportUrl && (
                        <a
                            href={alert.publicReportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 text-previa-accent text-sm hover:underline"
                        >
                            <ExternalLink className="w-4 h-4" />
                            <span>Ver publicación en el DOF / SAT</span>
                        </a>
                    )}
                </div>

                {/* Footer actions */}
                <div className="p-4 border-t border-previa-border flex items-center justify-between">
                    <p className="text-xs text-previa-muted">
                        Generado por Previa App
                    </p>
                    <div className="flex space-x-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-previa-border text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover transition-all text-xs"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir</span>
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-previa-accent/10 text-previa-accent hover:bg-previa-accent/20 transition-all text-xs border border-previa-accent/30"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Descargar PDF</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
