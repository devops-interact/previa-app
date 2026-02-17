'use client'

import { Send } from 'lucide-react'
import { useState } from 'react'

export function AIAssistant() {
    const [message, setMessage] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        console.log('Message:', message)
        setMessage('')
    }

    const integrations = [
        { name: 'Salesforce', color: '#00A1E0' },
        { name: 'Excel', color: '#217346' },
        { name: 'SAP', color: '#0FAAFF' },
        { name: 'Google Drive', color: '#4285F4' },
        { name: 'Dropbox', color: '#0061FF' },
        { name: 'HubSpot', color: '#FF7A59' },
        { name: 'Cloud', color: '#4285F4' }
    ]

    return (
        <aside className="w-80 bg-previa-surface text-previa-ink flex flex-col h-screen font-mono border-l border-previa-border">
            {/* Header */}
            <div className="p-8 mt-10">
                <h2 className="text-4xl font-bold mb-4 tracking-tight text-previa-ink">Hola!</h2>
                <p className="text-lg text-previa-muted leading-relaxed">
                    Soy tu asistente para la verificación fiscal de tus proveedores
                </p>
            </div>

            {/* Chat Area */}
            <div className="flex-1 px-6 overflow-y-auto">
                <div className="space-y-6">
                    <div>
                        <p className="text-sm text-previa-muted mb-4 uppercase tracking-wider font-semibold">
                            Pregunta cualquier duda
                        </p>

                        <div className="bg-previa-surface-hover rounded-xl p-4 text-sm border border-previa-border hover:border-previa-accent/30 cursor-pointer transition-colors group">
                            <p className="text-previa-muted group-hover:text-previa-ink transition-colors">
                                Ayúdame a identificar los gastos deducibles y a hacer la declaración de éste mes{' '}
                                <span className="inline-block bg-previa-background text-xs px-1.5 py-0.5 rounded ml-1 text-previa-muted">Tab</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Footer */}
            <div className="p-6 mt-auto">
                <p className="text-xs text-previa-muted mb-4 font-semibold tracking-wide">Importa todos tus datos</p>
                <div className="flex flex-wrap gap-3">
                    {integrations.map((integration, idx) => (
                        <div
                            key={idx}
                            className="w-8 h-8 rounded-full bg-previa-surface-hover flex items-center justify-center hover:bg-previa-background transition-colors cursor-pointer border border-previa-border"
                            title={integration.name}
                        >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: integration.color }}></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Message Input */}
            <div className="p-6 border-t border-previa-border">
                <div className="relative">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Escribe tu mensaje..."
                        className="w-full bg-previa-background text-previa-ink pl-4 pr-10 py-3 rounded-xl border border-previa-border focus:outline-none focus:ring-1 focus:ring-previa-accent/50 focus:border-previa-accent text-sm placeholder-previa-muted transition-all"
                    />
                    <button className="absolute right-2 top-1/2 transform -translate-y-1/2 text-previa-muted hover:text-previa-accent p-1 transition-colors">
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
