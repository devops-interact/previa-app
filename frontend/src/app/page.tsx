'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from '@/lib/icons'
import { GeometricBackground } from '@/components/GeometricBackground'
import { apiClient } from '@/lib/api-client'

export default function HomePage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
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

            localStorage.setItem('previa_auth', JSON.stringify(auth))
            document.cookie = `previa_token=${auth.access_token}; path=/; max-age=${60 * 60 * 8}; SameSite=Lax`

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
                            <h1 className="text-4xl font-bold text-previa-ink mb-2 tracking-tight">
                                Prevify
                            </h1>
                            <p className="text-previa-muted text-sm">
                                Evaluación inteligente del cumplimiento fiscal
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
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 pr-11 bg-previa-background border border-previa-border rounded-lg text-previa-ink placeholder-previa-muted/50 focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent transition-all"
                                        required
                                        disabled={loading}
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-previa-muted hover:text-previa-ink focus:outline-none focus:ring-2 focus:ring-previa-accent/50 rounded"
                                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-previa-danger/10 border border-previa-danger/30 text-previa-danger px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full border border-previa-border bg-transparent text-previa-ink py-3 rounded-lg hover:bg-previa-surface-hover hover:border-previa-accent/50 transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading && (
                                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                )}
                                {loading ? 'Autenticando...' : 'Iniciar Sesión'}
                            </button>
                        </form>

                        {/* Demo hint (collapsible) */}
                        <div className="mt-5">
                            <button
                                onClick={() => setShowDemo(!showDemo)}
                                className="text-xs text-previa-muted hover:text-previa-accent transition-colors w-full text-center"
                            >
                                {showDemo ? 'Ocultar cuenta demo' : 'Mostrar cuenta demo'}
                            </button>
                            {showDemo && (
                                <div className="mt-2 p-3 bg-previa-primary-light rounded-lg border border-previa-border text-xs text-previa-muted">
                                    <p><span className="text-previa-ink font-semibold">Email:</span> user@example.com</p>
                                    <p><span className="text-previa-ink font-semibold">Password:</span> 1234</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-previa-muted">
                                ¿No tienes una cuenta?{' '}
                                <Link href="/register" className="text-previa-accent font-semibold hover:text-previa-accent-glow transition-colors underline underline-offset-2">
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
