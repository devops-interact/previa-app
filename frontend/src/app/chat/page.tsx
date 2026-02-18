'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User as UserIcon, Loader2, Upload, Plus, Building2 } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { AuthGuard } from '@/components/AuthGuard'
import { useUploadModal } from '@/contexts/UploadModalContext'
import type { ChatMessage, ChatContext } from '@/types'
import { apiClient } from '@/lib/api-client'

const SUGGESTED_PROMPTS = [
    '¿Qué es un EFOS y cómo afecta mis deducciones?',
    'Quiero subir mi lista de proveedores en CSV para revisión',
    'Explícame el Artículo 69-B del Código Fiscal de la Federación',
    '¿Cómo puedo agrupar mis proveedores por riesgo en una watchlist?',
    '¿Qué debo revisar antes de pagar una factura de un proveedor nuevo?',
    '¿Cómo funciona el proceso de verificación del SAT?',
]

export default function ChatPage() {
    const { openUploadModal } = useUploadModal()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [chatContext, setChatContext] = useState<ChatContext>({})
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendMessage = async (text: string) => {
        if (!text.trim() || loading) return

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text.trim(),
            timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, userMsg])
        setInput('')
        setLoading(true)

        try {
            const history = messages.map((m) => ({ role: m.role, content: m.content }))
            const result = await apiClient.sendChatMessage(text.trim(), history, chatContext)

            const assistantMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: result.response,
                timestamp: new Date().toISOString(),
                suggested_action: result.suggested_action as ChatMessage['suggested_action'],
            }
            setMessages((prev) => [...prev, assistantMsg])
        } catch (err: any) {
            const errMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Ocurrió un error al procesar tu mensaje: ${err.message}`,
                timestamp: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, errMsg])
        } finally {
            setLoading(false)
            inputRef.current?.focus()
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        sendMessage(input)
    }

    const handleWatchlistSelect = (orgId: number, wlId: number, orgName: string, wlName: string) => {
        setChatContext({ organization: orgName, watchlist: wlName, watchlist_id: wlId })
        const ctxMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Contexto actualizado: ahora estás trabajando con la watchlist **${wlName}** de la organización **${orgName}**. ¿En qué te puedo ayudar?`,
            timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, ctxMsg])
    }

    const isEmpty = messages.length === 0

    return (
        <AuthGuard>
            <div className="flex h-screen bg-previa-background overflow-hidden">
                <Sidebar onWatchlistSelect={handleWatchlistSelect} />

                <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                    {/* Header — responsive stack on mobile */}
                    <header className="bg-previa-surface border-b border-previa-border px-4 py-3 sm:px-6 flex-shrink-0">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-previa-accent/20 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-4 h-4 text-previa-accent" />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-sm sm:text-base font-semibold text-previa-ink truncate">Agente Fiscal IA</h1>
                                    <p className="text-xs text-previa-muted truncate">Previa App · Claude AI</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {chatContext.watchlist && (
                                    <span className="text-xs px-2.5 py-1 bg-previa-accent/10 text-previa-accent border border-previa-accent/30 rounded-full flex items-center space-x-1 max-w-[180px] sm:max-w-none truncate">
                                        <Building2 className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{chatContext.organization} › {chatContext.watchlist}</span>
                                    </span>
                                )}
                                <button
                                    onClick={() => openUploadModal(chatContext)}
                                    className="flex items-center justify-center space-x-1.5 px-3 py-2 sm:py-1.5 bg-previa-accent/10 text-previa-accent text-xs rounded-lg border border-previa-accent/30 hover:bg-previa-accent/20 transition-colors"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Subir Datos</span>
                                </button>
                                {messages.length > 0 && (
                                    <button
                                        onClick={() => setMessages([])}
                                        className="flex items-center space-x-1.5 px-3 py-2 sm:py-1.5 text-previa-muted hover:text-previa-ink text-xs rounded-lg border border-previa-border hover:bg-previa-surface-hover transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Nueva sesión</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto">
                        {isEmpty ? (
                            /* Welcome screen — responsive padding and grid */
                            <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
                                <div className="text-center mb-8 sm:mb-10">
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-previa-accent/15 flex items-center justify-center mx-auto mb-4 border border-previa-accent/20">
                                        <Bot className="w-7 h-7 sm:w-8 sm:h-8 text-previa-accent" />
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-bold text-previa-ink mb-2">
                                        Agente Fiscal Previa App
                                    </h2>
                                    <p className="text-previa-muted text-sm leading-relaxed max-w-md mx-auto px-1">
                                        Soy tu asistente especializado en cumplimiento fiscal mexicano. Puedo ayudarte a revisar proveedores ante el SAT, interpretar alertas y gestionar tus watchlists.
                                    </p>
                                </div>

                                {/* Quick actions — 1 col mobile, 2 cols sm+ */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                                    <button
                                        onClick={() => openUploadModal(chatContext)}
                                        className="flex items-center space-x-3 p-4 bg-previa-surface border border-previa-border rounded-xl hover:border-previa-accent/40 hover:bg-previa-surface-hover transition-all text-left group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-previa-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-previa-accent/20 transition-colors">
                                            <Upload className="w-4 h-4 text-previa-accent" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-previa-ink">Subir CSV / XLS</p>
                                            <p className="text-xs text-previa-muted">Revisar lista de proveedores</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => sendMessage('¿Qué información necesitas para revisar mis proveedores ante el SAT?')}
                                        className="flex items-center space-x-3 p-4 bg-previa-surface border border-previa-border rounded-xl hover:border-previa-accent/40 hover:bg-previa-surface-hover transition-all text-left group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-previa-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-previa-accent/20 transition-colors">
                                            <Bot className="w-4 h-4 text-previa-accent" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-previa-ink">¿Cómo empezar?</p>
                                            <p className="text-xs text-previa-muted">Guía rápida de la plataforma</p>
                                        </div>
                                    </button>
                                </div>

                                {/* Suggested prompts */}
                                <p className="text-xs text-previa-muted uppercase tracking-wider font-semibold mb-3 px-1 mt-6 sm:mt-8">
                                    Preguntas frecuentes
                                </p>
                                <div className="space-y-2 sm:space-y-2.5">
                                    {SUGGESTED_PROMPTS.map((prompt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(prompt)}
                                            className="w-full text-left px-4 py-3 rounded-xl bg-previa-surface border border-previa-border hover:border-previa-accent/40 hover:bg-previa-surface-hover text-sm text-previa-muted hover:text-previa-ink transition-all"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Conversation — responsive padding */
                            <div className="max-w-3xl mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start space-x-3`}
                                    >
                                        {msg.role === 'assistant' && (
                                            <div className="w-8 h-8 rounded-full bg-previa-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <Bot className="w-4 h-4 text-previa-accent" />
                                            </div>
                                        )}
                                        <div
                                            className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                                                ? 'bg-previa-accent text-white rounded-tr-sm'
                                                : 'bg-previa-surface border border-previa-border text-previa-ink rounded-tl-sm'
                                                }`}
                                        >
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                            {msg.suggested_action === 'upload_csv' && (
                                                <button
                                                    onClick={() => openUploadModal(chatContext)}
                                                    className="mt-3 flex items-center space-x-2 px-3 py-2 rounded-lg bg-previa-accent/20 text-previa-accent hover:bg-previa-accent/30 transition-colors w-full"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    <span className="text-xs font-semibold">Subir archivo CSV / XLS ahora</span>
                                                </button>
                                            )}
                                            <p className="text-xs opacity-50 mt-2">
                                                {new Date(msg.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        {msg.role === 'user' && (
                                            <div className="w-8 h-8 rounded-full bg-previa-surface-hover flex items-center justify-center flex-shrink-0 mt-0.5 border border-previa-border">
                                                <UserIcon className="w-4 h-4 text-previa-muted" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {loading && (
                                    <div className="flex justify-start items-start space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-previa-accent/20 flex items-center justify-center flex-shrink-0">
                                            <Bot className="w-4 h-4 text-previa-accent" />
                                        </div>
                                        <div className="bg-previa-surface border border-previa-border rounded-2xl rounded-tl-sm px-4 py-3">
                                            <div className="flex space-x-1 items-center">
                                                <div className="w-2 h-2 rounded-full bg-previa-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 rounded-full bg-previa-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 rounded-full bg-previa-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input bar — responsive padding */}
                    <div className="bg-previa-surface border-t border-previa-border px-4 py-3 sm:p-4 flex-shrink-0">
                        <div className="max-w-3xl mx-auto">
                            <form onSubmit={handleSubmit} className="relative">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Escribe tu pregunta fiscal..."
                                    disabled={loading}
                                    className="w-full bg-previa-background text-previa-ink pl-5 pr-12 py-4 rounded-2xl border border-previa-border focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent text-sm placeholder-previa-muted transition-all disabled:opacity-60 shadow-sm"
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !input.trim()}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl bg-previa-accent text-white disabled:opacity-30 disabled:bg-previa-muted hover:bg-previa-accent/90 transition-all"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </form>
                            <p className="text-xs text-previa-muted text-center mt-2">
                                Respuestas generadas por Claude AI · No constituyen asesoría legal
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    )
}
