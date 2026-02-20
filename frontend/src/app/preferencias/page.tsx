'use client'

import { useState, useEffect, useRef } from 'react'
import { Camera, Save, Eye, EyeOff } from '@/lib/icons'
import { Sidebar } from '@/components/Sidebar'
import { Topbar } from '@/components/Topbar'
import { AuthGuard } from '@/components/AuthGuard'

interface UserProfile {
    username: string
    email: string
    avatar: string | null
    notificationsEnabled: boolean
}

function loadProfile(): UserProfile {
    if (typeof window === 'undefined') return { username: '', email: '', avatar: null, notificationsEnabled: true }
    try {
        const auth = JSON.parse(localStorage.getItem('previa_auth') || '{}')
        const prefs = JSON.parse(localStorage.getItem('previa_prefs') || '{}')
        return {
            username: prefs.username || auth.email?.split('@')[0] || '',
            email: auth.email || '',
            avatar: prefs.avatar || null,
            notificationsEnabled: prefs.notificationsEnabled !== false,
        }
    } catch {
        return { username: '', email: '', avatar: null, notificationsEnabled: true }
    }
}

function savePrefs(prefs: Partial<UserProfile>) {
    try {
        const current = JSON.parse(localStorage.getItem('previa_prefs') || '{}')
        localStorage.setItem('previa_prefs', JSON.stringify({ ...current, ...prefs }))
    } catch { /* ignore */ }
}

export default function PreferenciasPage() {
    const [profile, setProfile] = useState<UserProfile>(loadProfile)
    const [saved, setSaved] = useState(false)
    const [showCurrentPw, setShowCurrentPw] = useState(false)
    const [showNewPw, setShowNewPw] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [pwError, setPwError] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setProfile(loadProfile())
    }, [])

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 512 * 1024) {
            alert('La imagen debe pesar menos de 512 KB')
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            const base64 = reader.result as string
            setProfile((p) => ({ ...p, avatar: base64 }))
            savePrefs({ avatar: base64 })
        }
        reader.readAsDataURL(file)
    }

    const handleSaveProfile = () => {
        savePrefs({
            username: profile.username,
            notificationsEnabled: profile.notificationsEnabled,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const handleChangePassword = async () => {
        setPwError('')
        if (!currentPassword || !newPassword) {
            setPwError('Todos los campos son obligatorios')
            return
        }
        if (newPassword.length < 6) {
            setPwError('La contraseña debe tener al menos 6 caracteres')
            return
        }
        if (newPassword !== confirmPassword) {
            setPwError('Las contraseñas no coinciden')
            return
        }
        setPwError('')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const breadcrumbs = [
        { label: 'Tablero', href: '/tablero' },
        { label: 'Preferencias' },
    ]

    return (
        <AuthGuard>
            <div className="flex h-screen bg-previa-background overflow-hidden">
                <Sidebar />
                <main className="flex-1 flex flex-col overflow-hidden min-w-0">
                    <Topbar breadcrumbs={breadcrumbs} showSearch={false} />

                    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
                        <div className="max-w-2xl space-y-6">

                            {/* Profile Section */}
                            <section className="bg-previa-surface border border-previa-border rounded-xl p-6">
                                <h2 className="text-sm font-semibold text-previa-ink mb-4">Perfil</h2>

                                {/* Avatar */}
                                <div className="flex items-center gap-4 mb-6">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="relative w-16 h-16 rounded-full bg-previa-surface-hover border-2 border-previa-border hover:border-previa-accent/50 transition-colors flex items-center justify-center overflow-hidden group"
                                    >
                                        {profile.avatar ? (
                                            <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-2xl font-bold text-previa-ink">
                                                {profile.username?.charAt(0).toUpperCase() || 'U'}
                                            </span>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Camera className="w-5 h-5 text-white" />
                                        </div>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarUpload}
                                        className="hidden"
                                    />
                                    <div>
                                        <p className="text-sm text-previa-ink font-medium">{profile.username || 'Usuario'}</p>
                                        <p className="text-xs text-previa-muted">Haz click para cambiar tu foto</p>
                                    </div>
                                </div>

                                {/* Username */}
                                <div className="mb-4">
                                    <label className="block text-xs text-previa-muted mb-1.5">Nombre de usuario</label>
                                    <input
                                        type="text"
                                        value={profile.username}
                                        onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
                                        className="w-full input-cursor px-3 py-2"
                                    />
                                </div>

                                {/* Email (read-only) */}
                                <div className="mb-4">
                                    <label className="block text-xs text-previa-muted mb-1.5">Correo electrónico</label>
                                    <input
                                        type="email"
                                        value={profile.email}
                                        readOnly
                                        className="w-full px-3 py-2 bg-previa-background border border-previa-border rounded-lg text-xs text-previa-muted cursor-not-allowed"
                                    />
                                    <p className="text-xs text-previa-muted/60 mt-1">El correo no se puede cambiar por ahora</p>
                                </div>

                                <button
                                    onClick={handleSaveProfile}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs border border-previa-border bg-transparent text-previa-ink font-medium rounded-lg hover:bg-previa-surface-hover hover:border-previa-accent/50 transition-colors"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>{saved ? 'Guardado' : 'Guardar cambios'}</span>
                                </button>
                            </section>

                            {/* Password Section */}
                            <section className="bg-previa-surface border border-previa-border rounded-xl p-6">
                                <h2 className="text-sm font-semibold text-previa-ink mb-4">Cambiar Contraseña</h2>

                                <div className="space-y-3 mb-4">
                                    <div>
                                        <label className="block text-xs text-previa-muted mb-1.5">Contraseña actual</label>
                                        <div className="relative">
                                            <input
                                                type={showCurrentPw ? 'text' : 'password'}
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full input-cursor px-3 py-2 pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPw(!showCurrentPw)}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-previa-muted hover:text-previa-ink"
                                            >
                                                {showCurrentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-previa-muted mb-1.5">Nueva contraseña</label>
                                        <div className="relative">
                                            <input
                                                type={showNewPw ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full input-cursor px-3 py-2 pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPw(!showNewPw)}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-previa-muted hover:text-previa-ink"
                                            >
                                                {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-previa-muted mb-1.5">Confirmar contraseña</label>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full input-cursor px-3 py-2"
                                        />
                                    </div>
                                </div>

                                {pwError && <p className="text-xs text-red-400 mb-3">{pwError}</p>}

                                <button
                                    onClick={handleChangePassword}
                                    className="px-4 py-2 text-xs bg-previa-surface-hover text-previa-ink border border-previa-border rounded-lg hover:bg-previa-accent/10 hover:text-previa-accent hover:border-previa-accent/30 transition-all"
                                >
                                    Cambiar contraseña
                                </button>
                            </section>

                            {/* Notifications Section */}
                            <section className="bg-previa-surface border border-previa-border rounded-xl p-6">
                                <h2 className="text-sm font-semibold text-previa-ink mb-4">Notificaciones</h2>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-previa-ink">Alertas por correo</p>
                                        <p className="text-xs text-previa-muted">Recibir notificaciones cuando se detecten hallazgos en tus listas de monitoreo</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const next = !profile.notificationsEnabled
                                            setProfile((p) => ({ ...p, notificationsEnabled: next }))
                                            savePrefs({ notificationsEnabled: next })
                                        }}
                                        className={`relative w-11 h-6 rounded-full transition-colors ${
                                            profile.notificationsEnabled ? 'bg-previa-accent' : 'bg-previa-border'
                                        }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                                                profile.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    )
}
