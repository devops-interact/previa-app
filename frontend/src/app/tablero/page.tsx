'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Bell, Settings as SettingsIcon, Upload, FileSpreadsheet } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { AlertCard } from '@/components/AlertCard'
import { ComplianceTable } from '@/components/ComplianceTable'
import { AIAssistant } from '@/components/AIAssistant'
import { AuthGuard } from '@/components/AuthGuard'
import { NotificationModal } from '@/components/NotificationModal'
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
    const [notificationModal, setNotificationModal] = useState<{ open: boolean; index: number }>({ open: false, index: 0 })
    const [activeAlerts, setActiveAlerts] = useState<Alert[]>([])
    const [tableData, setTableData] = useState<ReturnType<typeof resultToTableRow>[]>([])
    const [chatContext, setChatContext] = useState<ChatContext>({})
    const [scanProgress, setScanProgress] = useState<{ active: boolean; pct: number; status: string }>({
        active: false,
        pct: 0,
        status: '',
    })

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

    const handleAlertClick = (alertId: string) => {
        const idx = activeAlerts.findIndex((a) => a.id === alertId)
        if (idx !== -1) setNotificationModal({ open: true, index: idx })
    }

    const handleBellClick = () => {
        if (activeAlerts.length > 0) setNotificationModal({ open: true, index: 0 })
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
                    {/* Top Navigation Bar */}
                    <header className="bg-previa-surface border-b border-previa-border px-6 py-3 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <h1 className="text-base font-semibold text-previa-ink">Tablero</h1>
                                {chatContext.watchlist && (
                                    <span className="text-xs text-previa-muted bg-previa-background border border-previa-border px-2 py-0.5 rounded-full">
                                        {chatContext.organization} › {chatContext.watchlist}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center space-x-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-previa-muted" />
                                    <input
                                        type="text"
                                        placeholder="Buscar RFC, empresa..."
                                        className="pl-9 pr-4 py-1.5 bg-previa-background border border-previa-border rounded-lg text-sm text-previa-ink placeholder-previa-muted focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent transition-all w-52"
                                    />
                                </div>

                                <button
                                    onClick={() => openUploadModal(chatContext)}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-previa-accent/10 text-previa-accent text-sm rounded-lg border border-previa-accent/30 hover:bg-previa-accent/20 transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>Subir</span>
                                </button>

                                <button
                                    onClick={handleBellClick}
                                    className="relative text-previa-muted hover:text-previa-accent transition-colors p-1"
                                    title={`${unreadCount} alertas`}
                                >
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>

                                <button className="text-previa-muted hover:text-previa-accent transition-colors p-1">
                                    <SettingsIcon className="w-5 h-5" />
                                </button>
                                <div className="w-8 h-8 rounded-full bg-previa-accent/20 text-previa-accent flex items-center justify-center text-xs font-semibold">
                                    U
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Scan progress bar */}
                    {scanProgress.active && (
                        <div className="flex-shrink-0 px-5 pt-4">
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

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {tableData.length === 0 && !scanProgress.active ? (
                            /* Empty state */
                            <div className="flex flex-col items-center justify-center h-full text-center py-20">
                                <FileSpreadsheet className="w-16 h-16 text-previa-muted/40 mb-4" />
                                <h2 className="text-lg font-semibold text-previa-ink mb-1">
                                    Sin resultados
                                </h2>
                                <p className="text-sm text-previa-muted max-w-xs mb-5">
                                    Sube un dataset de proveedores o clientes para iniciar la verificación SAT.
                                </p>
                                <button
                                    onClick={() => openUploadModal(chatContext)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-previa-accent text-white text-sm rounded-lg hover:bg-previa-accent/90 transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>Subir dataset</span>
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Alert Cards */}
                                {activeAlerts.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h2 className="text-sm font-semibold text-previa-muted uppercase tracking-wider">
                                                Alertas Activas
                                            </h2>
                                            <button
                                                onClick={handleBellClick}
                                                className="text-xs text-previa-accent hover:underline"
                                            >
                                                Ver todas ({unreadCount})
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {activeAlerts.map((alert) => (
                                                <button
                                                    key={alert.id}
                                                    onClick={() => handleAlertClick(alert.id)}
                                                    className="text-left hover:scale-[1.01] active:scale-[0.99] transition-transform"
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

                                {/* Compliance Table */}
                                <ComplianceTable data={tableData} />
                            </>
                        )}
                    </div>
                </main>

                <AIAssistant context={chatContext} />
            </div>

            {notificationModal.open && (
                <NotificationModal
                    alerts={activeAlerts}
                    initialIndex={notificationModal.index}
                    onClose={() => setNotificationModal({ open: false, index: 0 })}
                />
            )}
        </AuthGuard>
    )
}
