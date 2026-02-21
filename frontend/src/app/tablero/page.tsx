'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Upload, FileSpreadsheet, List, AlertTriangle, ShieldAlert, ShieldCheck, Info } from '@/lib/icons'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { AlertCard } from '@/components/AlertCard'
import { ComplianceTable } from '@/components/ComplianceTable'
import { AIAssistant } from '@/components/AIAssistant'
import { AuthGuard } from '@/components/AuthGuard'
import { NotificationModal } from '@/components/NotificationModal'
import { AlertsMosaicModal } from '@/components/AlertsMosaicModal'
import { useUploadModal } from '@/contexts/UploadModalContext'
import { apiClient } from '@/lib/api-client'
import type { Alert, AlertSeverity, ChatContext, ScanEntityResult, Organization } from '@/types'

function riskToSeverity(level: string): AlertSeverity {
    switch (level) {
        case 'CRITICAL': return 'CRITICAL'
        case 'HIGH': return 'HIGH'
        case 'MEDIUM': return 'MEDIUM'
        case 'LOW': return 'LOW'
        default: return 'INFO'
    }
}

function deriveArticle(r: ScanEntityResult): string {
    if (r.art_69b_found) return 'Art.69-B'
    if (r.art_69_found) return 'Art.69'
    if (r.art_69_bis_found) return 'Art.69-BIS'
    if (r.art_49_bis_found) return 'Art.49-BIS'
    return 'Sin hallazgo'
}

function resultToAlert(r: ScanEntityResult): Alert {
    return {
        id: String(r.id),
        severity: riskToSeverity(r.risk_level),
        article: deriveArticle(r),
        rfc: r.rfc,
        entityName: r.razon_social,
        status: r.art_69b_status
            ? `${r.art_69b_status.toUpperCase()} — ${r.art_69b_motivo ?? ''}`
            : r.art_69_found
                ? `Art.69 — ${r.art_69_categories.map((c: Record<string, unknown>) => c.type).join(', ')}`
                : 'Sin hallazgo',
        timestamp: r.screened_at ?? undefined,
        oficio: r.art_69b_oficio ?? undefined,
        authority: r.art_69b_authority ?? undefined,
        publicReportUrl: r.art_69b_dof_url ?? undefined,
    }
}

function resultToTableRow(r: ScanEntityResult) {
    const fmt69b = r.art_69b_found ? (r.art_69b_status ?? 'Encontrado') : 'N/A'
    const fmt69 = r.art_69_found
        ? (r.art_69_categories.map((c: Record<string, unknown>) => String(c.type)).join(', ') || 'Encontrado')
        : 'N/A'
    const fmt69bis = r.art_69_bis_found ? 'Encontrado' : 'N/A'
    const fmt49bis = r.art_49_bis_found ? 'Encontrado' : 'N/A'
    return {
        id: String(r.id),
        empresa: r.razon_social,
        rfc: r.rfc,
        art69: fmt69,
        art69B: fmt69b,
        art69BIS: fmt69bis,
        art49BIS: fmt49bis,
    }
}

interface ParamHandlerProps {
    openUploadModal: (ctx?: ChatContext) => void
    chatContext: ChatContext
    onScanId: (id: string) => void
}

function URLParamHandler({ openUploadModal, chatContext, onScanId }: ParamHandlerProps) {
    const searchParams = useSearchParams()
    const didUpload = useRef(false)
    const didScan = useRef(false)

    useEffect(() => {
        if (searchParams.get('upload') === '1' && !didUpload.current) {
            didUpload.current = true
            openUploadModal(chatContext)
            window.history.replaceState({}, '', '/tablero')
        }
        const scanId = searchParams.get('scan_id')
        if (scanId && !didScan.current) {
            didScan.current = true
            onScanId(scanId)
            window.history.replaceState({}, '', '/tablero')
        }
    }, [searchParams, openUploadModal, chatContext, onScanId])

    return null
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    CRITICAL: { label: 'Críticas', color: 'text-red-400', icon: ShieldAlert },
    HIGH: { label: 'Altas', color: 'text-orange-400', icon: AlertTriangle },
    MEDIUM: { label: 'Medias', color: 'text-yellow-400', icon: Info },
    LOW: { label: 'Bajas', color: 'text-previa-accent', icon: ShieldCheck },
}

export default function TableroPage() {
    const { openUploadModal } = useUploadModal()
    const [notificationModal, setNotificationModal] = useState<{ open: boolean; alerts: Alert[]; index: number }>({ open: false, alerts: [], index: 0 })
    const [alertsMosaicOpen, setAlertsMosaicOpen] = useState(false)
    const [activeAlerts, setActiveAlerts] = useState<Alert[]>([])
    const [tableData, setTableData] = useState<ReturnType<typeof resultToTableRow>[]>([])
    const [chatContext, setChatContext] = useState<ChatContext>({})
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [scanProgress, setScanProgress] = useState<{ active: boolean; pct: number; status: string }>({
        active: false, pct: 0, status: '',
    })

    useEffect(() => {
        apiClient.listOrganizations().then(setOrganizations).catch(() => {})
    }, [])

    const handleAgentScanComplete = useCallback((results: ReturnType<typeof resultToTableRow>[], alerts: Alert[]) => {
        setTableData(results)
        setActiveAlerts(alerts)
    }, [])

    const pollInterval = useRef<ReturnType<typeof setTimeout> | null>(null)

    const loadScanResults = useCallback(async (scanId: string) => {
        try {
            const data = await apiClient.getScanResults(scanId)
            const nonClear = data.results.filter((r) => r.risk_level !== 'CLEAR')
            setActiveAlerts(nonClear.map(resultToAlert))
            setTableData(data.results.map(resultToTableRow))
            setScanProgress({ active: false, pct: 100, status: data.status })
        } catch {
            setScanProgress((p) => ({ ...p, active: false }))
        }
    }, [])

    const startPolling = useCallback((scanId: string) => {
        setScanProgress({ active: true, pct: 0, status: 'pending' })
        const poll = async () => {
            try {
                const status = await apiClient.getScanStatus(scanId)
                setScanProgress({ active: true, pct: status.progress, status: status.status })
                if (status.status === 'completed' || status.status === 'failed') {
                    if (pollInterval.current) clearTimeout(pollInterval.current)
                    if (status.status === 'completed') await loadScanResults(scanId)
                    else setScanProgress({ active: false, pct: 0, status: 'failed' })
                } else {
                    pollInterval.current = setTimeout(poll, 2000)
                }
            } catch {
                if (pollInterval.current) clearTimeout(pollInterval.current)
                setScanProgress({ active: false, pct: 0, status: 'error' })
            }
        }
        poll()
    }, [loadScanResults])

    useEffect(() => {
        return () => { if (pollInterval.current) clearTimeout(pollInterval.current) }
    }, [])

    const handleScanId = useCallback((id: string) => startPolling(id), [startPolling])
    const unreadCount = activeAlerts.length

    const handleAlertClick = () => {
        if (activeAlerts.length > 0) setAlertsMosaicOpen(true)
    }
    const handleBellClick = () => {
        if (activeAlerts.length > 0) setAlertsMosaicOpen(true)
    }
    const handleMosaicSelect = (filteredAlerts: Alert[], index: number) => {
        setNotificationModal({ open: true, alerts: filteredAlerts, index })
    }
    const handleWatchlistSelect = (orgId: number, wlId: number, orgName: string, wlName: string) => {
        setChatContext({ organization: orgName, watchlist: wlName, watchlist_id: wlId })
    }

    const recentWatchlists = organizations
        .flatMap((org) => org.watchlists.map((wl) => ({ ...wl, orgName: org.name, orgId: org.id })))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)

    const severityCounts = activeAlerts.reduce<Record<string, number>>((acc, a) => {
        acc[a.severity] = (acc[a.severity] || 0) + 1
        return acc
    }, {})

    const breadcrumbs = chatContext.watchlist
        ? [
            { label: 'Tablero', href: '/tablero' },
            { label: chatContext.organization || '' },
            { label: chatContext.watchlist },
        ]
        : [{ label: 'Tablero' }]

    return (
        <AuthGuard>
            <Suspense fallback={null}>
                <URLParamHandler openUploadModal={openUploadModal} chatContext={chatContext} onScanId={handleScanId} />
            </Suspense>

            <div className="flex h-screen bg-previa-background overflow-hidden">
                <Sidebar onWatchlistSelect={handleWatchlistSelect} />

                <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                    <Topbar
                        breadcrumbs={breadcrumbs}
                        chatContext={chatContext}
                        alertCount={unreadCount}
                        onBellClick={handleBellClick}
                    />

                    {scanProgress.active && (
                        <div className="flex-shrink-0 px-4 pt-3 sm:px-5 lg:px-6 sm:pt-4">
                            <div className="bg-previa-surface border border-previa-border rounded-xl px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-previa-ink">Verificando empresas ante el SAT...</span>
                                    <span className="text-xs text-previa-muted">{Math.round(scanProgress.pct)}%</span>
                                </div>
                                <div className="h-1.5 bg-previa-background rounded-full overflow-hidden">
                                    <div className="h-full bg-previa-accent/60 rounded-full transition-all duration-500" style={{ width: `${scanProgress.pct}%` }} />
                                </div>
                                <p className="text-xs text-previa-muted mt-1 capitalize">{scanProgress.status}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 space-y-5 sm:space-y-6">
                        {tableData.length === 0 && !scanProgress.active ? (
                            <div className="space-y-6">
                                {/* Listas de Monitoreo Recientes */}
                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-xs sm:text-sm font-semibold text-previa-muted uppercase tracking-wider">
                                            Listas de Monitoreo Recientes
                                        </h2>
                                    </div>
                                    {recentWatchlists.length === 0 ? (
                                        <div className="text-center py-8">
                                            <List className="w-10 h-10 text-previa-muted/30 mx-auto mb-3" />
                                            <p className="text-sm text-previa-muted">Sin listas de monitoreo aún</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {recentWatchlists.map((wl) => (
                                                <Link
                                                    key={wl.id}
                                                    href={`/lista/${wl.id}`}
                                                    className="bg-previa-surface border border-previa-border rounded-xl p-4 hover:border-previa-accent/30 hover:bg-previa-surface-hover transition-all group"
                                                >
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center space-x-2 min-w-0">
                                                            <List className="w-4 h-4 text-previa-accent flex-shrink-0" />
                                                            <span className="text-sm font-medium text-previa-ink truncate group-hover:text-previa-accent transition-colors">
                                                                {wl.name}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-previa-muted font-mono flex-shrink-0 ml-2">
                                                            {wl.company_count}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-previa-muted truncate">{wl.orgName}</p>
                                                    <p className="text-xs text-previa-muted/60 mt-1">
                                                        {new Date(wl.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Resumen de Notificaciones */}
                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h2 className="text-xs sm:text-sm font-semibold text-previa-muted uppercase tracking-wider">
                                            Resumen de Notificaciones
                                        </h2>
                                        {activeAlerts.length > 0 && (
                                            <button onClick={() => setAlertsMosaicOpen(true)} className="text-xs text-previa-accent hover:underline">
                                                Ver todas ({unreadCount})
                                            </button>
                                        )}
                                    </div>
                                    {activeAlerts.length === 0 ? (
                                        <div className="bg-previa-surface border border-previa-border rounded-xl p-6 text-center">
                                            <ShieldCheck className="w-10 h-10 text-previa-accent/30 mx-auto mb-3" />
                                            <p className="text-sm text-previa-muted">Sin alertas activas</p>
                                            <p className="text-xs text-previa-muted/60 mt-1">Sube un dataset para iniciar el monitoreo</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => {
                                                const count = severityCounts[key] || 0
                                                const Icon = cfg.icon
                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={handleBellClick}
                                                        className="bg-previa-surface border border-previa-border rounded-xl p-4 hover:border-previa-accent/30 transition-all text-left"
                                                    >
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                                                            <span className="text-xs text-previa-muted">{cfg.label}</span>
                                                        </div>
                                                        <span className={`text-2xl font-bold ${count > 0 ? cfg.color : 'text-previa-muted/30'}`}>
                                                            {count}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </section>

                                {/* Upload CTA */}
                                <div className="flex flex-col items-center justify-center text-center py-8 px-4">
                                    <FileSpreadsheet className="w-14 h-14 sm:w-16 sm:h-16 text-previa-muted/40 mb-4" />
                                    <h2 className="text-base sm:text-lg font-semibold text-previa-ink mb-2">Verificar Empresas</h2>
                                    <p className="text-sm text-previa-muted max-w-xs mb-6">
                                        Sube un dataset de proveedores o clientes para iniciar la verificación SAT.
                                    </p>
                                    <button
                                        onClick={() => openUploadModal(chatContext)}
                                        className="flex items-center justify-center space-x-2 px-4 py-2.5 sm:py-2 border border-previa-border bg-transparent text-previa-ink text-sm font-medium rounded-lg hover:bg-previa-surface-hover hover:border-previa-accent/50 transition-colors"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>Subir dataset</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {activeAlerts.length > 0 && (
                                    <div className="section-gap">
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <h2 className="text-xs sm:text-sm font-semibold text-previa-muted uppercase tracking-wider">
                                                Alertas Activas
                                            </h2>
                                            <button onClick={() => setAlertsMosaicOpen(true)} className="text-xs text-previa-accent hover:underline whitespace-nowrap">
                                                Ver todas ({unreadCount})
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                            {activeAlerts.map((alert, idx) => (
                                                <button
                                                    key={alert.id}
                                                    onClick={handleAlertClick}
                                                    className="text-left animate-fade-up"
                                                    style={{ animationDelay: `${idx * 60}ms` }}
                                                >
                                                    <AlertCard
                                                        severity={alert.severity}
                                                        article={alert.article}
                                                        rfc={alert.rfc}
                                                        entityName={alert.entityName}
                                                        status={alert.status}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="section-gap overflow-hidden">
                                    <ComplianceTable data={tableData} />
                                </div>
                            </>
                        )}
                    </div>
                </main>

                <AIAssistant context={chatContext} onScanComplete={handleAgentScanComplete} />
            </div>

            {alertsMosaicOpen && (
                <AlertsMosaicModal alerts={activeAlerts} onClose={() => setAlertsMosaicOpen(false)} onSelectAlert={handleMosaicSelect} />
            )}
            {notificationModal.open && (
                <NotificationModal alerts={notificationModal.alerts} initialIndex={notificationModal.index} onClose={() => setNotificationModal({ open: false, alerts: [], index: 0 })} />
            )}
        </AuthGuard>
    )
}
