'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export default function HomePage() {
    const router = useRouter()
    const [email, setEmail] = useState('user@product.test')
    const [password, setPassword] = useState('1234')
    const [error, setError] = useState('')

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // 1. Check Demo Account
        if (email === 'user@product.test' && password === '1234') {
            localStorage.setItem('previa_auth', JSON.stringify({
                user: { email: 'user@product.test', organization: 'Demo Corp' },
                token: 'demo-token'
            }))
            router.push('/tablero')
            return
        }

        // 2. Check Registered Users (LocalStorage for MVP)
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

        // 3. Login Failed
        setError('Invalid credentials. Use demo account or register a new one.')
    }

    return (
        <div className="min-h-[80vh] flex items-center justify-center">
            <div className="w-full max-w-md">
                <div className="bg-previa-surface rounded-lg shadow-lg p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-previa-navy mb-2">PREV.IA</h1>
                        <p className="text-previa-ink opacity-75">
                            Fiscal Compliance Screening Agent
                        </p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-previa-ink mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 bg-previa-background border border-previa-muted rounded-md focus:outline-none focus:ring-2 focus:ring-previa-accent"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-previa-ink mb-2">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 bg-previa-background border border-previa-muted rounded-md focus:outline-none focus:ring-2 focus:ring-previa-accent"
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-previa-navy text-white py-3 rounded-md hover:opacity-90 transition-opacity font-medium"
                        >
                            Sign In
                        </button>
                    </form>

                    <div className="mt-6 p-4 bg-previa-primary-light rounded-md">
                        <p className="text-sm text-previa-ink">
                            <strong>Demo Account:</strong><br />
                            Email: user@product.test<br />
                            Password: 1234
                        </p>
                    </div>

                    {/* Sign Up Link */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-previa-muted">
                            ¿No tienes una cuenta?{' '}
                            <Link href="/register" className="text-previa-navy font-semibold hover:underline">
                                Crear Cuenta
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
