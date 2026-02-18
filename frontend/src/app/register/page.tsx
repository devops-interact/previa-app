'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GeometricBackground } from '@/components/GeometricBackground'

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
            const users = JSON.parse(localStorage.getItem('previa_users') || '[]')

            if (users.some((u: any) => u.email === formData.email)) {
                setError('Este correo electrónico ya está registrado')
                setLoading(false)
                return
            }

            const newUser = {
                id: Date.now().toString(),
                email: formData.email,
                organization: formData.organization,
                password: formData.password,
                createdAt: new Date().toISOString()
            }

            users.push(newUser)
            localStorage.setItem('previa_users', JSON.stringify(users))

            localStorage.setItem('previa_auth', JSON.stringify({
                user: {
                    email: newUser.email,
                    organization: newUser.organization
                },
                token: 'demo-token-' + newUser.id
            }))

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

    const fields = [
        { id: 'email', label: 'Correo Electrónico', type: 'email', placeholder: 'usuario@empresa.com' },
        { id: 'organization', label: 'Nombre de la Organización', type: 'text', placeholder: 'Mi Empresa S.A. de C.V.' },
        { id: 'password', label: 'Contraseña', type: 'password', placeholder: 'Mínimo 6 caracteres' },
        { id: 'confirmPassword', label: 'Confirmar Contraseña', type: 'password', placeholder: 'Confirma tu contraseña' },
    ]

    return (
        <div className="min-h-screen bg-previa-background relative overflow-hidden">
            <GeometricBackground />

            <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
                <div className="max-w-md w-full">
                    {/* Branding */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-previa-accent mb-2 tracking-tight">
                            Previa App
                        </h1>
                        <p className="text-previa-muted text-sm">
                            Crear nueva cuenta
                        </p>
                    </div>

                    {/* Registration Form */}
                    <div className="bg-previa-surface/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/50 border border-previa-border p-8">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {fields.map((field) => (
                                <div key={field.id}>
                                    <label htmlFor={field.id} className="block text-xs font-semibold text-previa-muted uppercase tracking-wider mb-2">
                                        {field.label}
                                    </label>
                                    <input
                                        type={field.type}
                                        id={field.id}
                                        name={field.id}
                                        value={formData[field.id as keyof typeof formData]}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-previa-background border border-previa-border rounded-lg text-previa-ink placeholder-previa-muted/50 focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent transition-all"
                                        placeholder={field.placeholder}
                                        required
                                    />
                                </div>
                            ))}

                            {error && (
                                <div className="bg-previa-danger/10 border border-previa-danger/30 text-previa-danger px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-previa-accent text-white py-3 rounded-lg font-semibold hover:bg-previa-accent-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-previa-accent/20"
                            >
                                {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-previa-muted">
                                ¿Ya tienes una cuenta?{' '}
                                <Link href="/" className="text-previa-accent font-semibold hover:text-previa-accent-glow transition-colors">
                                    Iniciar Sesión
                                </Link>
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 text-center text-xs text-previa-muted">
                        <p>Previa App — Autonomous Fiscal Compliance Screening</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
