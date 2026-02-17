'use client'

import { Send } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

export function AIAssistant() {
    const [message, setMessage] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // TODO: Implement AI chat functionality
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
        <aside className="w-80 bg-[#1a1a1a] text-white flex flex-col h-screen font-mono border-l border-gray-800">
            {/* Header */}
            <div className="p-8 mt-10">
                <h2 className="text-4xl font-bold mb-4 tracking-tight">Hola!</h2>
                <p className="text-lg text-gray-400 leading-relaxed">
                    Soy tu asistente para la verificación fiscal de tus proveedores
                </p>
            </div>

            {/* Chat Area */}
            <div className="flex-1 px-6 overflow-y-auto">
                <div className="space-y-6">
                    <div>
                        <p className="text-sm text-gray-500 mb-4 uppercase tracking-wider font-semibold">
                            Pregunta cualquier duda
                        </p>

                        {/* Example prompt */}
                        <div className="bg-[#2a2a2a] rounded-xl p-4 text-sm border border-gray-700 hover:border-gray-600 cursor-pointer transition-colors group">
                            <p className="text-gray-300 group-hover:text-white transition-colors">
                                Ayúdame a identificar los gastos deducibles y a hacer la declaración de éste mes <span className="inline-block bg-gray-700 text-xs px-1.5 py-0.5 rounded ml-1">Tab</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Footer */}
            <div className="p-6 mt-auto">
                <p className="text-xs text-gray-500 mb-4 font-semibold tracking-wide">Importa todos tus datos</p>
                <div className="flex flex-wrap gap-3">
                    {integrations.map((integration, idx) => (
                        <div
                            key={idx}
                            className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer"
                            title={integration.name}
                        >
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: integration.color }}></div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Message Input */}
            <div className="p-6 border-t border-gray-800 bg-[#1a1a1a]">
                {/* Input form would go here, matching screenshot style if needed */}
                <div className="relative">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Escribe tu mensaje..."
                        className="w-full bg-[#2a2a2a] text-white pl-4 pr-10 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-600 text-sm placeholder-gray-500"
                    />
                    <button className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white p-1">
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
