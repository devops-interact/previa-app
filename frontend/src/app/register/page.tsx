'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { GeometricBackground } from '@/components/GeometricBackground'

export default function RegisterPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        email: '',
        organization: '',
        password: '',
        confirmPassword: ''
    })
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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

    const inputClass = "w-full px-4 py-3 bg-previa-background border border-previa-border rounded-lg text-previa-ink placeholder-previa-muted/50 focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent transition-all"
    const labelClass = "block text-xs font-semibold text-previa-muted uppercase tracking-wider mb-2"
    const eyeBtnClass = "absolute right-3 top-1/2 -translate-y-1/2 p-1 text-previa-muted hover:text-previa-ink focus:outline-none focus:ring-2 focus:ring-previa-accent/50 rounded"
    const EyeToggle = ({ visible, onToggle }: { visible: boolean; onToggle: () => void }) => (
        <button type="button" onClick={onToggle} className={eyeBtnClass} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} tabIndex={-1}>
            {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
    )

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
                            <div>
                                <label htmlFor="email" className={labelClass}>Correo Electrónico</label>
                                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="usuario@empresa.com" required />
                            </div>
                            <div>
                                <label htmlFor="organization" className={labelClass}>Nombre de la Organización</label>
                                <input type="text" id="organization" name="organization" value={formData.organization} onChange={handleChange} className={inputClass} placeholder="Mi Empresa S.A. de C.V." required />
                            </div>
                            <div>
                                <label htmlFor="password" className={labelClass}>Contraseña</label>
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} id="password" name="password" value={formData.password} onChange={handleChange} className={inputClass + ' pr-11'} placeholder="Mínimo 6 caracteres" required />
                                    <EyeToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="confirmPassword" className={labelClass}>Confirmar Contraseña</label>
                                <div className="relative">
                                    <input type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className={inputClass + ' pr-11'} placeholder="Confirma tu contraseña" required />
                                    <EyeToggle visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} />
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
