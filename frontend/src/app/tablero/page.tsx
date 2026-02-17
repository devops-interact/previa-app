'use client'

import { Search, Bell, Settings as SettingsIcon } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { AlertCard } from '@/components/AlertCard'
import { ComplianceTable } from '@/components/ComplianceTable'
import { AIAssistant } from '@/components/AIAssistant'

export default function TableroPage() {
    // Sample alert data with severity hierarchy
    const alerts = [
        {
            id: '1',
            severity: 'CRITICAL' as const,
            article: 'Art.69-B',
            rfc: 'LAS191217BD4',
            entityName: 'LEGALIDAD Y AUDITORIA 727 S.C. DE...',
            status: 'DEFINITIVO - Operaciones inexistentes confirmadas'
        },
        {
            id: '2',
            severity: 'HIGH' as const,
            article: 'Art.69-B',
            rfc: 'BMS190313BU0',
            entityName: 'BMS COMERCIALIZADORA S.A. DE C.V.',
            status: 'PRESUNTO - Bajo investigación'
        },
        {
            id: '3',
            severity: 'MEDIUM' as const,
            article: 'Art.69',
            rfc: 'CAL080328S18',
            entityName: 'COMERCIALIZADORA ALCAER S.A.',
            status: 'Crédito fiscal firme pendiente'
        },
        {
            id: '4',
            severity: 'LOW' as const,
            article: 'Art.69-B',
            rfc: 'XYZ123456AB7',
            entityName: 'EMPRESA EJEMPLO S.A. DE C.V.',
            status: 'DESVIRTUADO - Presunción refutada'
        }
    ]

    // Sample table data
    const tableData = [
        {
            id: '1',
            empresa: 'LEGALIDAD Y AUDITORIA 727, S.C. DE...',
            rfc: 'LAS191217BD4',
            art69: 'Text',
            art69B: 'Text',
            art69BIS: 'Text',
            art49BIS: 'Text'
        },
        {
            id: '2',
            empresa: 'BMS190313BU0',
            rfc: 'BMS190313BU0',
            art69: 'Text',
            art69B: 'Text',
            art69BIS: 'Text',
            art49BIS: 'Text'
        },
        {
            id: '3',
            empresa: 'LAS191217BD4',
            rfc: 'LAS191217BD4',
            art69: 'Text',
            art69B: 'Text',
            art69BIS: 'Text',
            art49BIS: 'Text'
        },
        {
            id: '4',
            empresa: 'BMS190313BU0',
            rfc: 'BMS190313BU0',
            art69: 'Text',
            art69B: 'Text',
            art69BIS: 'Text',
            art49BIS: 'Text'
        },
        {
            id: '5',
            empresa: 'LAS191217BD4',
            rfc: 'LAS191217BD4',
            art69: 'Text',
            art69B: 'Text',
            art69BIS: 'Text',
            art49BIS: 'Text'
        },
        {
            id: '6',
            empresa: 'BMS190313BU0',
            rfc: 'BMS190313BU0',
            art69: 'Text',
            art69B: 'Text',
            art69BIS: 'Text',
            art49BIS: 'Text'
        },
        {
            id: '7',
            empresa: 'LAS191217BD4',
            rfc: 'LAS191217BD4',
            art69: 'Text',
            art69B: 'Text',
            art69BIS: 'Text',
            art49BIS: 'Text'
        },
        {
            id: '8',
            empresa: 'BMS190313BU0',
            rfc: 'BMS190313BU0',
            art69: 'Text',
            art69B: 'Text',
            art69BIS: 'Text',
            art49BIS: 'Text'
        }
    ]

    return (
        <div className="flex h-screen bg-previa-background overflow-hidden">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Navigation Bar */}
                <header className="bg-white border-b border-previa-muted px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button className="text-previa-ink hover:text-previa-navy transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </button>
                            <h1 className="text-lg font-semibold text-previa-ink">Organizaciones</h1>
                            <span className="text-sm text-previa-muted">Sistemas...</span>
                        </div>

                        <div className="flex items-center space-x-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-previa-muted" />
                                <input
                                    type="text"
                                    placeholder="Search"
                                    className="pl-10 pr-4 py-2 bg-previa-background border border-previa-muted rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-previa-accent"
                                />
                            </div>

                            {/* Icons */}
                            <button className="text-previa-muted hover:text-previa-ink transition-colors">
                                <Bell className="w-5 h-5" />
                            </button>
                            <button className="text-previa-muted hover:text-previa-ink transition-colors">
                                <SettingsIcon className="w-5 h-5" />
                            </button>
                            <button className="text-previa-muted hover:text-previa-ink transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Alert Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        {alerts.map((alert) => (
                            <AlertCard
                                key={alert.id}
                                severity={alert.severity}
                                article={alert.article}
                                rfc={alert.rfc}
                                entityName={alert.entityName}
                                status={alert.status}
                            />
                        ))}
                    </div>

                    {/* Compliance Table */}
                    <ComplianceTable data={tableData} />
                </div>
            </main>

            {/* AI Assistant Panel */}
            <AIAssistant />
        </div>
    )
}
