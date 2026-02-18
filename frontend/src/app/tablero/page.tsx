'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Bell, Upload, FileSpreadsheet } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { AlertCard } from '@/components/AlertCard'
import { ComplianceTable } from '@/components/ComplianceTable'
import { AIAssistant } from '@/components/AIAssistant'
import { AuthGuard } from '@/components/AuthGuard'
import { NotificationModal } from '@/components/NotificationModal'
import { AlertsMosaicModal } from '@/components/AlertsMosaicModal'
import { useUploadModal } from '@/contexts/UploadModalContext'
import { apiClient } from '@/lib/api-client'
import type { Alert, AlertSeverity, ChatContext, ScanEntityResult } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── URL param handlers (must be inside Suspense) ──────────────────────────────

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TableroPage() {
    const { openUploadModal } = useUploadModal()
    const [notificationModal, setNotificationModal] = useState<{ open: boolean; alerts: Alert[]; index: number }>({ open: false, alerts: [], index: 0 })
    const [alertsMosaicOpen, setAlertsMosaicOpen] = useState(false)
    const [activeAlerts, setActiveAlerts] = useState<Alert[]>([])
    const [tableData, setTableData] = useState<ReturnType<typeof resultToTableRow>[]>([])
    const [chatContext, setChatContext] = useState<ChatContext>({})
    const [scanProgress, setScanProgress] = useState<{ active: boolean; pct: number; status: string }>({
        active: false,
        pct: 0,
        status: '',
    })

    // Called by AIAssistant when scan is completed through agent chat
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

    // Clicking a card in the dashboard grid opens mosaic (not direct detail)
    const handleAlertClick = (alertId: string) => {
        if (activeAlerts.length > 0) setAlertsMosaicOpen(true)
    }

    // Bell opens mosaic
    const handleBellClick = () => {
        if (activeAlerts.length > 0) setAlertsMosaicOpen(true)
    }

    // From within mosaic, clicking a card opens the detail modal against the *filtered* list
    const handleMosaicSelect = (filteredAlerts: Alert[], index: number) => {
        setNotificationModal({ open: true, alerts: filteredAlerts, index })
    }

    const handleWatchlistSelect = (orgId: number, wlId: number, orgName: string, wlName: string) => {
        setChatContext({ organization: orgName, watchlist: wlName, watchlist_id: wlId })
    }

    return (
        <AuthGuard>
            <Suspense fallback={null}>
                <URLParamHandler
                    openUploadModal={openUploadModal}
                    chatContext={chatContext}
                    onScanId={handleScanId}
                />
            </Suspense>

            <div className="flex h-screen bg-previa-background overflow-hidden">
                <Sidebar onWatchlistSelect={handleWatchlistSelect} />

                <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                    {/* Top bar: responsive — stack on mobile, row on sm+ */}
                    <header className="min-h-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 sm:px-5 bg-previa-surface border-b border-previa-border flex-shrink-0">
                        <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
                            <h1 className="text-sm font-semibold text-previa-ink truncate">Tablero</h1>
                            {chatContext.watchlist && (
                                <span className="hidden xs:inline-flex text-xs text-previa-muted bg-previa-background border border-previa-border px-2 py-0.5 rounded-full truncate max-w-[160px] sm:max-w-[200px]">
                                    {chatContext.organization} › {chatContext.watchlist}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative flex-1 min-w-[120px] sm:flex-initial sm:w-auto">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-previa-muted pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Buscar RFC, empresa..."
                                    className="w-full sm:w-44 pl-8 pr-3 py-2 sm:py-1.5 bg-previa-background border border-previa-border rounded-lg text-xs text-previa-ink placeholder-previa-muted focus:outline-none focus:ring-1 focus:ring-previa-accent/60 focus:border-previa-accent transition-all"
                                />
                            </div>
                            <button
                                onClick={() => openUploadModal(chatContext)}
                                className="flex items-center justify-center space-x-1.5 px-3 py-2 sm:py-1.5 bg-previa-accent/10 text-previa-accent text-xs rounded-lg border border-previa-accent/30 hover:bg-previa-accent/20 active:scale-[0.97] transition-all flex-1 sm:flex-initial"
                            >
                                <Upload className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Subir</span>
                            </button>
                            <button
                                onClick={handleBellClick}
                                className="relative text-previa-muted hover:text-previa-accent transition-colors p-2 sm:p-1.5 rounded-lg hover:bg-previa-surface-hover"
                                title={`${unreadCount} alertas`}
                            >
                                <Bell className="w-4 h-4" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 sm:-top-0.5 sm:-right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold leading-none">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>
                        </div>
                    </header>

                    {/* Scan progress bar */}
                    {scanProgress.active && (
                        <div className="flex-shrink-0 px-4 pt-3 sm:px-5 sm:pt-4">
                            <div className="bg-previa-surface border border-previa-border rounded-xl px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-previa-ink">
                                        Verificando empresas ante el SAT...
                                    </span>
                                    <span className="text-xs text-previa-muted">{Math.round(scanProgress.pct)}%</span>
                                </div>
                                <div className="h-1.5 bg-previa-background rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-previa-accent rounded-full transition-all duration-500"
                                        style={{ width: `${scanProgress.pct}%` }}
                                    />
                                </div>
                                <p className="text-xs text-previa-muted mt-1 capitalize">{scanProgress.status}</p>
                            </div>
                        </div>
                    )}

                    {/* Content Area — responsive padding and spacing */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 space-y-5 sm:space-y-6">
                        {tableData.length === 0 && !scanProgress.active ? (
                            /* Empty state */
                            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center py-12 sm:py-20 px-4">
                                <FileSpreadsheet className="w-14 h-14 sm:w-16 sm:h-16 text-previa-muted/40 mb-4" />
                                <h2 className="text-base sm:text-lg font-semibold text-previa-ink mb-2">
                                    Sin resultados
                                </h2>
                                <p className="text-sm text-previa-muted max-w-xs mb-6">
                                    Sube un dataset de proveedores o clientes para iniciar la verificación SAT.
                                </p>
                                <button
                                    onClick={() => openUploadModal(chatContext)}
                                    className="flex items-center justify-center space-x-2 px-4 py-2.5 sm:py-2 bg-previa-accent text-white text-sm rounded-lg hover:bg-previa-accent/90 transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>Subir dataset</span>
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Alert Cards — 1 col mobile, 2 cols sm+ */}
                                {activeAlerts.length > 0 && (
                                    <div className="section-gap">
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <h2 className="text-xs sm:text-sm font-semibold text-previa-muted uppercase tracking-wider">
                                                Alertas Activas
                                            </h2>
                                            <button
                                                onClick={() => setAlertsMosaicOpen(true)}
                                                className="text-xs text-previa-accent hover:underline whitespace-nowrap"
                                            >
                                                Ver todas ({unreadCount})
                                            </button>
                                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {activeAlerts.map((alert, idx) => (
                                <button
                                    key={alert.id}
                                    onClick={() => handleAlertClick(alert.id)}
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

                                {/* Compliance Table — responsive wrapper */}
                                <div className="section-gap overflow-hidden">
                                    <ComplianceTable data={tableData} />
                                </div>
                            </>
                        )}
                    </div>
                </main>

                <AIAssistant
                    context={chatContext}
                    onScanComplete={handleAgentScanComplete}
                />
            </div>

            {alertsMosaicOpen && (
                <AlertsMosaicModal
                    alerts={activeAlerts}
                    onClose={() => setAlertsMosaicOpen(false)}
                    onSelectAlert={handleMosaicSelect}
                />
            )}

            {notificationModal.open && (
                <NotificationModal
                    alerts={notificationModal.alerts}
                    initialIndex={notificationModal.index}
                    onClose={() => setNotificationModal({ open: false, alerts: [], index: 0 })}
                />
            )}
        </AuthGuard>
    )
}
