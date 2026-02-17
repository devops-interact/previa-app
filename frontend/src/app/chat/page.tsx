'use client'

import { Navbar } from '@/components/navbar'

export default function ChatPage() {
    return (
        <>
            <Navbar />
            <main className="container mx-auto px-4 py-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-previa-navy mb-6">
                        Chat — Tax & Accounting Consultation
                    </h1>

                    <div className="bg-previa-surface rounded-lg shadow-lg p-8">
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">💬</div>
                            <h2 className="text-2xl font-semibold text-previa-ink mb-2">
                                Chat Coming Soon
                            </h2>
                            <p className="text-previa-muted">
                                Natural language consultation with PREV.IA will be available in Phase 3
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </>
    )
}
