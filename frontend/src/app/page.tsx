'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { GeometricBackground } from '@/components/GeometricBackground'
import { apiClient } from '@/lib/api-client'

export default function HomePage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showDemo, setShowDemo] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // Authenticate against the backend — receives a signed JWT
            const auth = await apiClient.login(email.trim(), password)

            // Persist the token for subsequent API calls (read by api-client.ts)
            localStorage.setItem('previa_auth', JSON.stringify(auth))

            router.push('/tablero')
        } catch (err: unknown) {
            const message = err instanceof Error
                ? err.message
                : 'Error al iniciar sesión. Intenta de nuevo.'
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-previa-background relative overflow-hidden">
            <GeometricBackground />

            <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
                <div className="w-full max-w-md">
                    <div className="bg-previa-surface/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/50 border border-previa-border p-8">
                        {/* Branding */}
                        <div className="text-center mb-8">
                            <h1 className="text-4xl font-bold text-previa-accent mb-2 tracking-tight">
                                PREV.IA
                            </h1>
                            <p className="text-previa-muted text-sm">
                                Autonomous Fiscal Compliance Screening
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block text-xs font-semibold text-previa-muted uppercase tracking-wider mb-2">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="usuario@empresa.com"
                                    className="w-full px-4 py-3 bg-previa-background border border-previa-border rounded-lg text-previa-ink placeholder-previa-muted/50 focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent transition-all"
                                    required
                                    disabled={loading}
                                    autoComplete="email"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-xs font-semibold text-previa-muted uppercase tracking-wider mb-2">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 bg-previa-background border border-previa-border rounded-lg text-previa-ink placeholder-previa-muted/50 focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent transition-all"
                                    required
                                    disabled={loading}
                                    autoComplete="current-password"
                                />
                            </div>

                            {error && (
                                <div className="bg-previa-danger/10 border border-previa-danger/30 text-previa-danger px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-previa-accent text-white py-3 rounded-lg hover:bg-previa-accent-glow transition-colors font-semibold shadow-lg shadow-previa-accent/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading && (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                {loading ? 'Autenticando...' : 'Iniciar Sesión'}
                            </button>
                        </form>

                        {/* Demo hint (collapsible) */}
                        <div className="mt-5">
                            <button
                                onClick={() => setShowDemo(!showDemo)}
                                className="text-xs text-previa-muted hover:text-previa-accent-glow transition-colors w-full text-center"
                            >
                                {showDemo ? 'Ocultar cuenta demo' : 'Mostrar cuenta demo'}
                            </button>
                            {showDemo && (
                                <div className="mt-2 p-3 bg-previa-primary-light rounded-lg border border-previa-border text-xs text-previa-muted">
                                    <p><span className="text-previa-ink font-semibold">Email:</span> user@product.test</p>
                                    <p><span className="text-previa-ink font-semibold">Password:</span> 1234</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-previa-muted">
                                ¿No tienes una cuenta?{' '}
                                <Link href="/register" className="text-previa-accent font-semibold hover:text-previa-accent-glow transition-colors">
                                    Crear Cuenta
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
