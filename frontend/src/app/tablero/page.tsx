'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Bell, Settings as SettingsIcon, Upload } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { AlertCard } from '@/components/AlertCard'
import { ComplianceTable } from '@/components/ComplianceTable'
import { AIAssistant } from '@/components/AIAssistant'
import { AuthGuard } from '@/components/AuthGuard'
import { NotificationModal } from '@/components/NotificationModal'
import { useUploadModal } from '@/contexts/UploadModalContext'
import type { Alert, ChatContext } from '@/types'

const ALERTS: Alert[] = [
    {
        id: '1',
        severity: 'CRITICAL',
        article: 'Art.69-B',
        rfc: 'LAS191217BD4',
        entityName: 'LEGALIDAD Y AUDITORIA 727 S.C. DE...',
        status: 'DEFINITIVO - Operaciones inexistentes confirmadas',
        timestamp: '2024-01-15',
        oficio: 'SAT-700-07-2024-0012',
        authority: 'Administración Central de Fiscalización',
        publicReportUrl: 'https://www.sat.gob.mx/consultas/76355/consulta-la-lista-de-contribuyentes-con-operaciones-presuntamente-inexistentes',
    },
    {
        id: '2',
        severity: 'HIGH',
        article: 'Art.69-B',
        rfc: 'BMS190313BU0',
        entityName: 'BMS COMERCIALIZADORA S.A. DE C.V.',
        status: 'PRESUNTO - Bajo investigación',
        timestamp: '2024-01-10',
        authority: 'SAT — Administración Regional',
    },
    {
        id: '3',
        severity: 'MEDIUM',
        article: 'Art.69',
        rfc: 'CAL080328S18',
        entityName: 'COMERCIALIZADORA ALCAER S.A.',
        status: 'Crédito fiscal firme pendiente',
        timestamp: '2024-01-08',
    },
    {
        id: '4',
        severity: 'LOW',
        article: 'Art.69-B',
        rfc: 'XYZ123456AB7',
        entityName: 'EMPRESA EJEMPLO S.A. DE C.V.',
        status: 'DESVIRTUADO - Presunción refutada',
        timestamp: '2024-01-05',
    },
]

const TABLE_DATA = [
    { id: '1', empresa: 'LEGALIDAD Y AUDITORIA 727, S.C. DE...', rfc: 'LAS191217BD4', art69: 'Definitivo', art69B: 'Definitivo', art69BIS: 'N/A', art49BIS: 'N/A' },
    { id: '2', empresa: 'BMS COMERCIALIZADORA S.A. DE C.V.', rfc: 'BMS190313BU0', art69: 'N/A', art69B: 'Presunto', art69BIS: 'N/A', art49BIS: 'N/A' },
    { id: '3', empresa: 'COMERCIALIZADORA ALCAER S.A.', rfc: 'CAL080328S18', art69: 'Crédito firme', art69B: 'N/A', art69BIS: 'N/A', art49BIS: 'N/A' },
    { id: '4', empresa: 'AGROEXPORT DE CAMPECHE S.P.R.', rfc: 'ACA0604119X3', art69: 'N/A', art69B: 'N/A', art69BIS: 'N/A', art49BIS: 'N/A' },
    { id: '5', empresa: 'GRUPO FISCAL SOLUCIONES S.A.', rfc: 'GFS1109204G1', art69: 'N/A', art69B: 'N/A', art69BIS: 'N/A', art49BIS: 'N/A' },
    { id: '6', empresa: 'BADESA CONSTRUCCIONES S.A.', rfc: 'BAD180409H32', art69: 'N/A', art69B: 'N/A', art69BIS: 'N/A', art49BIS: 'N/A' },
]

export default function TableroPage() {
    const searchParams = useSearchParams()
    const { openUploadModal } = useUploadModal()
    const [notificationModal, setNotificationModal] = useState<{ open: boolean; index: number }>({ open: false, index: 0 })
    const [activeAlerts, setActiveAlerts] = useState(ALERTS)
    const [chatContext, setChatContext] = useState<ChatContext>({})

    // Open upload modal when arriving from /dataset (e.g. ?upload=1)
    const didOpenUpload = useRef(false)
    useEffect(() => {
        if (searchParams.get('upload') === '1' && !didOpenUpload.current) {
            didOpenUpload.current = true
            openUploadModal(chatContext)
            window.history.replaceState({}, '', '/tablero')
        }
    }, [searchParams, openUploadModal, chatContext])

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

                                {/* Upload button — opens modal */}
                                <button
                                    onClick={() => openUploadModal(chatContext)}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-previa-accent/10 text-previa-accent text-sm rounded-lg border border-previa-accent/30 hover:bg-previa-accent/20 transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>Subir</span>
                                </button>

                                {/* Bell with badge */}
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

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {/* Alert Cards — clickable */}
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

                        {/* Compliance Table */}
                        <ComplianceTable data={TABLE_DATA} />
                    </div>
                </main>

                <AIAssistant context={chatContext} />
            </div>

            {/* Notification Detail Modal */}
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
