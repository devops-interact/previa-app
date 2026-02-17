'use client'

import { Navbar } from '@/components/navbar'
import { AuthGuard } from '@/components/AuthGuard'

export default function ChatPage() {
    return (
        <AuthGuard>
            <Navbar />
            <main className="container mx-auto px-4 py-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-previa-ink mb-6">
                        Chat — Consultoría Fiscal
                    </h1>

                    <div className="bg-previa-surface rounded-xl shadow-lg border border-previa-border p-8">
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-previa-accent/10 flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">💬</span>
                            </div>
                            <h2 className="text-2xl font-semibold text-previa-ink mb-2">
                                Chat Próximamente
                            </h2>
                            <p className="text-previa-muted max-w-md mx-auto">
                                La consultoría fiscal con lenguaje natural vía PREV.IA estará disponible en la Fase 3.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </AuthGuard>
    )
}
