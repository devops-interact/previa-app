'use client'

import { Send, Upload, Bot, User as UserIcon, Loader2, Plus } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ChatMessage, ChatContext } from '@/types'
import { apiClient } from '@/lib/api-client'

const SUGGESTED_PROMPTS = [
    '¿Qué es un EFOS y cómo me afecta?',
    'Quiero subir mi lista de proveedores para revisión',
    '¿Cómo creo una watchlist para un proveedor específico?',
    'Explícame el Artículo 69-B del CFF',
]

interface AIAssistantProps {
    context?: ChatContext
}

export function AIAssistant({ context }: AIAssistantProps = {}) {
    const router = useRouter()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [width, setWidth] = useState(340)
    const isDragging = useRef(false)
    const startX = useRef(0)
    const startWidth = useRef(0)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // ── Auto-scroll ────────────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ── Resize drag logic ──────────────────────────────────────────────────────
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true
        startX.current = e.clientX
        startWidth.current = width
        e.preventDefault()
    }, [width])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return
            const delta = startX.current - e.clientX
            const newWidth = Math.max(280, Math.min(640, startWidth.current + delta))
            setWidth(newWidth)
        }
        const handleMouseUp = () => { isDragging.current = false }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [])

    // ── Chat ──────────────────────────────────────────────────────────────────

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
            const result = await apiClient.sendChatMessage(text.trim(), history, context)

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
                content: `Lo siento, ocurrió un error: ${err.message}. Por favor intenta de nuevo.`,
                timestamp: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, errMsg])
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        sendMessage(input)
    }

    const handleUploadRedirect = () => {
        router.push('/dataset')
    }

    const isEmpty = messages.length === 0

    return (
        <aside
            style={{ width }}
            className="bg-previa-surface text-previa-ink flex flex-col h-screen font-mono border-l border-previa-border flex-shrink-0 relative"
        >
            {/* Drag handle */}
            <div
                onMouseDown={handleMouseDown}
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-previa-accent/40 transition-colors z-10 group"
                title="Arrastrar para redimensionar"
            >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-previa-border group-hover:bg-previa-accent/60 transition-colors" />
            </div>

            {/* Header */}
            <div className="p-5 border-b border-previa-border">
                <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-previa-accent/20 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-previa-accent" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-previa-ink">Agente Fiscal</h2>
                        <p className="text-xs text-previa-muted">Previa App · Claude AI</p>
                    </div>
                </div>
                {context?.watchlist && (
                    <div className="mt-3 px-3 py-1.5 bg-previa-accent/5 border border-previa-accent/20 rounded-lg">
                        <p className="text-xs text-previa-accent font-medium truncate">
                            📋 {context.organization} › {context.watchlist}
                        </p>
                    </div>
                )}
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isEmpty ? (
                    <>
                        {/* Welcome state */}
                        <div className="text-center py-6">
                            <div className="w-12 h-12 rounded-full bg-previa-accent/10 flex items-center justify-center mx-auto mb-3">
                                <Bot className="w-6 h-6 text-previa-accent" />
                            </div>
                            <p className="text-sm font-semibold text-previa-ink mb-1">¡Hola!</p>
                            <p className="text-xs text-previa-muted leading-relaxed px-2">
                                Soy tu asistente de cumplimiento fiscal SAT. Puedo ayudarte a revisar proveedores, interpretar alertas y gestionar tus watchlists.
                            </p>
                        </div>

                        {/* Suggested prompts */}
                        <div className="space-y-1.5">
                            <p className="text-xs text-previa-muted uppercase tracking-wider font-semibold px-1">
                                Sugerencias
                            </p>
                            {SUGGESTED_PROMPTS.map((prompt, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(prompt)}
                                    className="w-full text-left px-3 py-2.5 rounded-xl bg-previa-background border border-previa-border hover:border-previa-accent/40 hover:bg-previa-surface-hover text-xs text-previa-muted hover:text-previa-ink transition-all"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        {/* Upload shortcut */}
                        <div className="mt-2">
                            <button
                                onClick={handleUploadRedirect}
                                className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl border border-dashed border-previa-accent/40 text-previa-accent hover:bg-previa-accent/5 transition-all text-xs"
                            >
                                <Upload className="w-4 h-4" />
                                <span>Subir CSV / XLS de proveedores</span>
                            </button>
                        </div>
                    </>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-start space-x-2`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-6 h-6 rounded-full bg-previa-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Bot className="w-3.5 h-3.5 text-previa-accent" />
                                </div>
                            )}
                            <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.role === 'user'
                                    ? 'bg-previa-accent text-white rounded-tr-sm'
                                    : 'bg-previa-background border border-previa-border text-previa-ink rounded-tl-sm'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                {/* Suggested action button */}
                                {msg.suggested_action === 'upload_csv' && (
                                    <button
                                        onClick={handleUploadRedirect}
                                        className="mt-2 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-previa-accent/20 text-previa-accent hover:bg-previa-accent/30 transition-colors w-full"
                                    >
                                        <Upload className="w-3 h-3" />
                                        <span className="text-xs font-medium">Subir archivo ahora</span>
                                    </button>
                                )}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-6 h-6 rounded-full bg-previa-surface-hover flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <UserIcon className="w-3.5 h-3.5 text-previa-muted" />
                                </div>
                            )}
                        </div>
                    ))
                )}

                {/* Loading indicator */}
                {loading && (
                    <div className="flex justify-start items-start space-x-2">
                        <div className="w-6 h-6 rounded-full bg-previa-accent/20 flex items-center justify-center flex-shrink-0">
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
                        className="text-xs text-previa-muted hover:text-previa-accent transition-colors mb-2 block"
                    >
                        + Nueva conversación
                    </button>
                )}
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Escribe tu pregunta..."
                        disabled={loading}
                        className="w-full bg-previa-background text-previa-ink pl-4 pr-10 py-3 rounded-xl border border-previa-border focus:outline-none focus:ring-1 focus:ring-previa-accent/50 focus:border-previa-accent text-xs placeholder-previa-muted transition-all disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-previa-muted hover:text-previa-accent disabled:opacity-30 transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </form>
            </div>
        </aside>
    )
}
