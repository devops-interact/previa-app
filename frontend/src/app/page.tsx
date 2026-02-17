'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { GeometricBackground } from '@/components/GeometricBackground'

export default function HomePage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [showDemo, setShowDemo] = useState(false)

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (email === 'user@product.test' && password === '1234') {
            localStorage.setItem('previa_auth', JSON.stringify({
                user: { email: 'user@product.test', organization: 'Demo Corp' },
                token: 'demo-token'
            }))
            router.push('/tablero')
            return
        }

        try {
            const users = JSON.parse(localStorage.getItem('previa_users') || '[]')
            const user = users.find((u: any) => u.email === email && u.password === password)

            if (user) {
                localStorage.setItem('previa_auth', JSON.stringify({
                    user: { email: user.email, organization: user.organization },
                    token: 'user-token-' + user.id
                }))
                router.push('/tablero')
                return
            }
        } catch (err) {
            console.error('Login error', err)
        }

        setError('Credenciales inválidas. Usa la cuenta demo o registra una nueva.')
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
                                />
                            </div>

                            {error && (
                                <div className="bg-previa-danger/10 border border-previa-danger/30 text-previa-danger px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full bg-previa-accent text-white py-3 rounded-lg hover:bg-previa-accent-glow transition-colors font-semibold shadow-lg shadow-previa-accent/20"
                            >
                                Iniciar Sesión
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
