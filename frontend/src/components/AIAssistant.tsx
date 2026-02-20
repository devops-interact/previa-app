'use client'

import {
    Send, Paperclip, Bot, User as UserIcon, Loader2,
    CheckCircle2, AlertTriangle, FileSpreadsheet, Plus, X,
} from '@/lib/icons'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, ChatContext, Alert, AlertSeverity } from '@/types'
import type { ScanEntityResult } from '@/types'
import { apiClient } from '@/lib/api-client'
import { useUploadModal } from '@/contexts/UploadModalContext'

// ── Suggested prompts ─────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
    '¿Qué es un EFOS y cómo me afecta?',
    '¿Cómo funciona el Artículo 69-B del CFF?',
    '¿Cómo creo una watchlist para un proveedor?',
    'Explícame el riesgo de una empresa presunta',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function stemName(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '')
}

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

function buildScanSummary(results: ScanEntityResult[]): string {
    const total = results.length
    const alerts = results.filter(r => r.risk_level !== 'CLEAR')
    const critical = alerts.filter(r => r.risk_level === 'CRITICAL' || r.risk_level === 'HIGH').length
    const riskNames = alerts.slice(0, 3).map(r => `• **${r.razon_social || r.rfc}** — ${deriveArticle(r)}`).join('\n')
    const more = alerts.length > 3 ? `\n• …y ${alerts.length - 3} más` : ''

    if (alerts.length === 0) {
        return `✅ Revisé **${total} empresa${total !== 1 ? 's' : ''}** y no encontré hallazgos SAT. Todo está limpio.\n\n¿Quieres guardar estos resultados como una watchlist para monitoreo continuo?`
    }

    return `⚠️ Revisé **${total} empresa${total !== 1 ? 's' : ''}** y encontré **${alerts.length} con alertas** (${critical} de alto riesgo):\n\n${riskNames}${more}\n\n¿Qué quieres hacer con estos datos?\n— **Crear una watchlist nueva** con los resultados\n— **Agregar a una watchlist existente**\n— **Ver el reporte completo** en el tablero`
}

function resultToTableRow(r: ScanEntityResult) {
    const fmt69b = r.art_69b_found ? (r.art_69b_status ?? 'Encontrado') : 'N/A'
    const fmt69 = r.art_69_found
        ? (r.art_69_categories.map((c: Record<string, unknown>) => String(c.type)).join(', ') || 'Encontrado')
        : 'N/A'
    return {
        id: String(r.id),
        empresa: r.razon_social,
        rfc: r.rfc,
        art69: fmt69,
        art69B: fmt69b,
        art69BIS: r.art_69_bis_found ? 'Encontrado' : 'N/A',
        art49BIS: r.art_49_bis_found ? 'Encontrado' : 'N/A',
    }
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

// ── Inline scan-progress message ──────────────────────────────────────────────

interface ScanProgressProps {
    pct: number
    filename: string
    status: string
}

function ScanProgressBubble({ pct, filename, status }: ScanProgressProps) {
    const done = pct >= 100
    return (
        <div className="flex flex-col gap-1.5 w-full max-w-[85%]">
            <div className="flex items-center gap-2">
                {done
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    : <Loader2 className="w-3.5 h-3.5 text-previa-accent shrink-0 animate-spin" />
                }
                <span className="text-xs text-previa-ink font-medium truncate">
                    {done ? `Análisis completado — ${filename}` : `Analizando ${filename}…`}
                </span>
                <span className="text-xs text-previa-muted ml-auto shrink-0">{Math.round(pct)}%</span>
            </div>
            <div className="h-1 bg-previa-border rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-green-400' : 'bg-previa-accent'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            {!done && (
                <p className="text-[11px] text-previa-muted capitalize">{status}</p>
            )}
        </div>
    )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AIAssistantProps {
    context?: ChatContext
    onScanComplete?: (tableRows: ReturnType<typeof resultToTableRow>[], alerts: Alert[]) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

const AGENT_PANEL_MIN = 280
const AGENT_PANEL_MAX = 640
const AGENT_PANEL_DEFAULT = 340

export function AIAssistant({ context, onScanComplete }: AIAssistantProps = {}) {
    const { openUploadModal } = useUploadModal()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [width, setWidth] = useState(AGENT_PANEL_DEFAULT)
    const [mobileOpen, setMobileOpen] = useState(false)

    // Scan-through-agent state
    const [scanState, setScanState] = useState<{
        active: boolean; pct: number; status: string; filename: string; scanId: string
    } | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const isDragging = useRef(false)
    const startX = useRef(0)
    const startWidth = useRef(0)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [isLargeScreen, setIsLargeScreen] = useState(true)

    useEffect(() => {
        const mql = window.matchMedia('(min-width: 1024px)')
        const handler = () => setIsLargeScreen(mql.matches)
        handler()
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, scanState])

    useEffect(() => {
        return () => { if (pollRef.current) clearTimeout(pollRef.current) }
    }, [])

    // ── Resize ────────────────────────────────────────────────────────────────

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true
        startX.current = e.clientX
        startWidth.current = width
        e.preventDefault()
    }, [width])

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current) return
            const delta = startX.current - e.clientX
            setWidth(Math.max(AGENT_PANEL_MIN, Math.min(AGENT_PANEL_MAX, startWidth.current + delta)))
        }
        const onUp = () => { isDragging.current = false }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
    }, [])

    // ── Chat ──────────────────────────────────────────────────────────────────

    const appendMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        setMessages(prev => [...prev, {
            ...msg,
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date().toISOString(),
        }])
    }

    const sendMessage = async (text: string) => {
        if (!text.trim() || loading) return
        appendMessage({ role: 'user', content: text.trim() })
        setInput('')
        setLoading(true)
        try {
            const history = messages.map(m => ({ role: m.role, content: m.content }))
            const result = await apiClient.sendChatMessage(text.trim(), history, context)
            appendMessage({
                role: 'assistant',
                content: result.response,
                suggested_action: result.suggested_action as ChatMessage['suggested_action'],
            })
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido'
            appendMessage({ role: 'assistant', content: `Lo siento, ocurrió un error: ${msg}. Por favor intenta de nuevo.` })
        } finally {
            setLoading(false)
        }
    }

    // ── File upload through agent ─────────────────────────────────────────────

    const handleFileSelected = useCallback(async (file: File) => {
        const filename = file.name

        // 1. User message showing the attachment
        appendMessage({ role: 'user', content: `📎 ${filename}` })

        // 2. Agent typing → then starts scan
        setLoading(true)
        await new Promise(r => setTimeout(r, 600))
        setLoading(false)

        appendMessage({
            role: 'assistant',
            content: `Recibí **${filename}**. Iniciando verificación ante el SAT — esto tomará unos segundos.`,
        })

        // 3. Upload
        let scanId: string
        try {
            const resp = await apiClient.uploadScan(
                file,
                context?.watchlist_id ? undefined : undefined, // org from context if available
                stemName(filename),
            )
            scanId = resp.scan_id
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al subir'
            appendMessage({ role: 'assistant', content: `❌ No pude procesar el archivo: ${msg}` })
            return
        }

        // 4. Poll with inline progress
        setScanState({ active: true, pct: 0, status: 'pending', filename, scanId })

        const poll = async () => {
            try {
                const status = await apiClient.getScanStatus(scanId)
                setScanState(s => s ? { ...s, pct: status.progress, status: status.status } : null)

                if (status.status === 'completed' || status.status === 'failed') {
                    if (pollRef.current) clearTimeout(pollRef.current)
                    if (status.status === 'failed') {
                        setScanState(null)
                        appendMessage({ role: 'assistant', content: '❌ La verificación falló. Intenta de nuevo.' })
                        return
                    }
                    // 5. Fetch results
                    const data = await apiClient.getScanResults(scanId)
                    setScanState(s => s ? { ...s, pct: 100 } : null)

                    // Brief pause so 100% is visible
                    await new Promise(r => setTimeout(r, 800))
                    setScanState(null)

                    // 6. Build summary and offer actions
                    const summary = buildScanSummary(data.results)
                    appendMessage({ role: 'assistant', content: summary, suggested_action: 'scan_results' })

                    // 7. Propagate results to parent (tablero)
                    const tableRows = data.results.map(resultToTableRow)
                    const alerts = data.results
                        .filter(r => r.risk_level !== 'CLEAR')
                        .map(resultToAlert)
                    onScanComplete?.(tableRows, alerts)

                } else {
                    pollRef.current = setTimeout(poll, 2000)
                }
            } catch {
                setScanState(null)
                appendMessage({ role: 'assistant', content: '❌ Error al consultar el estado del análisis.' })
            }
        }

        poll()
    }, [context, onScanComplete, messages])

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFileSelected(file)
        e.target.value = ''
    }

    // ── Agent-area drag & drop ─────────────────────────────────────────────────

    const [draggingOver, setDraggingOver] = useState(false)

    const handleDragOver = (e: React.DragEvent) => {
        if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault()
            setDraggingOver(true)
        }
    }
    const handleDragLeave = () => setDraggingOver(false)
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDraggingOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFileSelected(file)
    }

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input) }
    const isEmpty = messages.length === 0

    return (
        <>
            {/* Mobile FAB — open agent panel on small screens */}
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden fixed bottom-20 right-4 z-30 flex items-center justify-center w-12 h-12 rounded-xl bg-previa-accent text-black shadow-lg shadow-previa-accent/25 hover:bg-previa-accent/90 active:scale-95 transition-all"
                aria-label="Abrir agente fiscal"
            >
                <Bot className="w-5 h-5" />
            </button>

            {/* Mobile overlay backdrop when agent is open */}
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Cerrar agente"
                    onClick={() => setMobileOpen(false)}
                    className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
                />
            )}

            <aside
                style={isLargeScreen ? { width: `${width}px` } : undefined}
                className={`
                    bg-previa-surface text-previa-ink flex flex-col h-screen font-mono border-l border-previa-border flex-shrink-0 relative transition-[border-color] duration-150
                    ${draggingOver ? 'border-previa-accent' : ''}
                    lg:relative
                    fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm
                    lg:max-w-none
                    transform transition-transform duration-200 ease-out
                    ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}
                    lg:translate-x-0
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
            {/* Drag overlay */}
            {draggingOver && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-previa-background/80 backdrop-blur-sm pointer-events-none rounded-sm border-2 border-dashed border-previa-accent">
                    <FileSpreadsheet className="w-10 h-10 text-previa-accent mb-2" />
                    <p className="text-sm font-semibold text-previa-accent">Suelta el archivo aquí</p>
                    <p className="text-xs text-previa-muted mt-1">CSV, XLS, XLSX</p>
                </div>
            )}

            {/* Resize handle — hidden on mobile */}
            <div
                onMouseDown={handleMouseDown}
                className="hidden lg:block absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-previa-accent/40 transition-colors z-10 group"
            >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-previa-border group-hover:bg-previa-accent/60 transition-colors" />
            </div>

            {/* Header — h-14 matches tablero header; close button on mobile */}
            <div className="h-14 flex items-center px-4 sm:px-5 border-b border-previa-border flex-shrink-0">
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-previa-accent/20 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-previa-accent" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-previa-ink leading-tight">Agente Fiscal</h2>
                        <p className="text-[11px] text-previa-muted leading-tight">Previa App · Claude AI</p>
                    </div>
                </div>
                {context?.watchlist && (
                    <div className="ml-auto pl-2 shrink-0">
                        <span className="text-[10px] text-previa-accent bg-previa-accent/10 border border-previa-accent/20 px-2 py-0.5 rounded-full truncate max-w-[100px] block">
                            {context.watchlist}
                        </span>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="lg:hidden ml-2 p-2 rounded-lg text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover"
                    aria-label="Cerrar agente"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isEmpty ? (
                    <>
                        <div className="text-center py-6">
                            <div className="w-12 h-12 rounded-full bg-previa-accent/10 flex items-center justify-center mx-auto mb-3">
                                <Bot className="w-6 h-6 text-previa-accent" />
                            </div>
                            <p className="text-sm font-semibold text-previa-ink mb-1">¡Hola!</p>
                            <p className="text-xs text-previa-muted leading-relaxed px-2">
                                Soy tu asistente de cumplimiento fiscal SAT. Puedes preguntarme cualquier cosa o <strong className="text-previa-ink">subir un archivo</strong> para que lo analice directamente aquí.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <p className="text-[11px] text-previa-muted uppercase tracking-wider font-semibold px-1">Sugerencias</p>
                            {SUGGESTED_PROMPTS.map((prompt, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(prompt)}
                                    className="w-full text-left px-3 py-2.5 rounded-lg bg-previa-background border border-previa-border hover:border-previa-accent/40 hover:bg-previa-surface-hover text-xs text-previa-muted hover:text-previa-ink transition-all duration-150 active:scale-[0.99]"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center space-x-2 px-3 py-3 rounded-lg border border-dashed border-previa-accent/40 text-previa-accent hover:bg-previa-accent/5 hover:border-previa-accent/70 transition-all duration-150 text-xs mt-1"
                        >
                            <Paperclip className="w-4 h-4" />
                            <span>Subir CSV / XLS para análisis SAT</span>
                        </button>
                    </>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start gap-2`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-6 h-6 rounded-full bg-previa-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                                    <Bot className="w-3.5 h-3.5 text-previa-accent" />
                                </div>
                            )}
                            <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.role === 'user'
                                    ? 'bg-previa-accent text-black rounded-tr-sm'
                                    : 'bg-previa-background border border-previa-border text-previa-ink rounded-tl-sm'
                                    }`}
                            >
                                {msg.content.split('\n').map((line, i) => (
                                    <p key={i} className={`whitespace-pre-wrap ${i > 0 ? 'mt-1' : ''}`}
                                        dangerouslySetInnerHTML={{
                                            __html: line
                                                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                        }}
                                    />
                                ))}

                                {msg.suggested_action === 'upload_csv' && (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="mt-2 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-previa-accent/20 text-previa-accent hover:bg-previa-accent/30 transition-colors w-full"
                                    >
                                        <Paperclip className="w-3 h-3" />
                                        <span className="text-xs font-medium">Adjuntar archivo</span>
                                    </button>
                                )}

                                {msg.suggested_action === 'scan_results' && (
                                    <button
                                        onClick={() => openUploadModal(context)}
                                        className="mt-2 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-previa-accent/20 text-previa-accent hover:bg-previa-accent/30 transition-colors w-full"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span className="text-xs font-medium">Asignar a watchlist</span>
                                    </button>
                                )}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-6 h-6 rounded-full bg-previa-surface-hover flex items-center justify-center shrink-0 mt-0.5">
                                    <UserIcon className="w-3.5 h-3.5 text-previa-muted" />
                                </div>
                            )}
                        </div>
                    ))
                )}

                {/* Inline scan progress */}
                {scanState && (
                    <div className="flex justify-start items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-previa-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                            <Bot className="w-3.5 h-3.5 text-previa-accent" />
                        </div>
                        <div className="max-w-[85%] w-full bg-previa-background border border-previa-border rounded-2xl rounded-tl-sm px-3 py-2.5">
                            <ScanProgressBubble
                                pct={scanState.pct}
                                filename={scanState.filename}
                                status={scanState.status}
                            />
                        </div>
                    </div>
                )}

                {/* LLM loading */}
                {loading && !scanState && (
                    <div className="flex justify-start items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-previa-accent/20 flex items-center justify-center shrink-0">
                            <Bot className="w-3.5 h-3.5 text-previa-accent" />
                        </div>
                        <div className="bg-previa-background border border-previa-border rounded-2xl rounded-tl-sm px-3 py-2.5">
                            <div className="flex space-x-1 items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-previa-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-previa-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-previa-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-previa-border">
                {!isEmpty && (
                    <button
                        onClick={() => setMessages([])}
                        className="text-[11px] text-previa-muted hover:text-previa-accent transition-colors mb-2 block"
                    >
                        + Nueva conversación
                    </button>
                )}
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    {/* File attach button */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!!scanState}
                        className="p-2 text-previa-muted hover:text-previa-accent hover:bg-previa-surface-hover rounded-lg transition-all duration-150 disabled:opacity-30 shrink-0"
                        title="Adjuntar archivo CSV/XLS"
                    >
                        <Paperclip className="w-4 h-4" />
                    </button>

                    <div className="relative flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribe tu pregunta..."
                            disabled={loading || !!scanState}
                            className="w-full bg-previa-background text-previa-ink pl-3 pr-9 py-2.5 rounded-xl border border-previa-border focus:outline-none focus:ring-1 focus:ring-previa-accent/50 focus:border-previa-accent text-xs placeholder-previa-muted transition-all disabled:opacity-60"
                        />
                        <button
                            type="submit"
                            disabled={loading || !!scanState || !input.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-previa-muted hover:text-previa-accent disabled:opacity-30 transition-colors"
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </form>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileInputChange}
                    className="hidden"
                />
            </div>
        </aside>
        </>
    )
}
