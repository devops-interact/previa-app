'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        email: '',
        organization: '',
        password: '',
        confirmPassword: ''
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (!formData.email || !formData.organization || !formData.password) {
            setError('Todos los campos son requeridos')
            return
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden')
            return
        }

        if (formData.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            return
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formData.email)) {
            setError('Por favor ingresa un correo electrónico válido')
            return
        }

        setLoading(true)

        try {
            // For MVP, store in localStorage
            const users = JSON.parse(localStorage.getItem('previa_users') || '[]')

            // Check if email already exists
            if (users.some((u: any) => u.email === formData.email)) {
                setError('Este correo electrónico ya está registrado')
                setLoading(false)
                return
            }

            const newUser = {
                id: Date.now().toString(),
                email: formData.email,
                organization: formData.organization,
                password: formData.password, // In production, this would be hashed
                createdAt: new Date().toISOString()
            }

            users.push(newUser)
            localStorage.setItem('previa_users', JSON.stringify(users))

            // Auto-login after registration
            localStorage.setItem('previa_auth', JSON.stringify({
                user: {
                    email: newUser.email,
                    organization: newUser.organization
                },
                token: 'demo-token-' + newUser.id
            }))

            // Redirect to dashboard
            router.push('/tablero')
        } catch (err) {
            setError('Error al crear la cuenta. Por favor intenta de nuevo.')
            setLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    return (
        <div className="min-h-screen bg-previa-background flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Logo/Branding */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-previa-navy mb-2">
                        PREVIA.APP
                    </h1>
                    <p className="text-previa-muted">
                        Crear nueva cuenta
                    </p>
                </div>

                {/* Registration Form */}
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-previa-ink mb-2">
                                Correo Electrónico
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-previa-muted rounded-md focus:outline-none focus:ring-2 focus:ring-previa-accent"
                                placeholder="usuario@empresa.com"
                                required
                            />
                        </div>

                        {/* Organization */}
                        <div>
                            <label htmlFor="organization" className="block text-sm font-medium text-previa-ink mb-2">
                                Nombre de la Organización
                            </label>
                            <input
                                type="text"
                                id="organization"
                                name="organization"
                                value={formData.organization}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-previa-muted rounded-md focus:outline-none focus:ring-2 focus:ring-previa-accent"
                                placeholder="Mi Empresa S.A. de C.V."
                                required
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-previa-ink mb-2">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-previa-muted rounded-md focus:outline-none focus:ring-2 focus:ring-previa-accent"
                                placeholder="Mínimo 6 caracteres"
                                required
                            />
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-previa-ink mb-2">
                                Confirmar Contraseña
                            </label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-previa-muted rounded-md focus:outline-none focus:ring-2 focus:ring-previa-accent"
                                placeholder="Confirma tu contraseña"
                                required
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-previa-navy text-white py-3 rounded-md font-semibold hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                        </button>
                    </form>

                    {/* Link to Login */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-previa-muted">
                            ¿Ya tienes una cuenta?{' '}
                            <Link href="/" className="text-previa-navy font-semibold hover:underline">
                                Iniciar Sesión
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-xs text-previa-muted">
                    <p>PREV.IA — Autonomous Fiscal Compliance Screening</p>
                </div>
            </div>
        </div>
    )
}
