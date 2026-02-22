'use client'

import { useState } from 'react'
import { X, Building2 } from '@/lib/icons'
import type { Organization } from '@/types'
import { apiClient } from '@/lib/api-client'

interface NewOrganizationModalProps {
    onClose: () => void
    onCreated: (org: Organization) => void
}

export function NewOrganizationModal({
    onClose,
    onCreated,
}: NewOrganizationModalProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setError('El nombre es obligatorio')
            return
        }
        setLoading(true)
        setError('')
        try {
            const org = await apiClient.createOrganization(name.trim(), description.trim() || undefined)
            onCreated(org)
            onClose()
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error al crear la organización')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6">
            <div className="bg-previa-surface border border-previa-border rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-previa-border">
                    <div className="flex items-center space-x-2">
                        <Building2 className="w-5 h-5 text-previa-accent" />
                        <h2 className="text-lg font-semibold text-previa-ink">Nueva Organización</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-previa-muted hover:text-previa-ink transition-colors p-1"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleCreate} className="p-4 sm:p-5 space-y-4">
                    <p className="text-sm text-previa-muted">
                        Las organizaciones te permiten agrupar listas de monitoreo por empresa o cliente.
                    </p>

                    <div>
                        <label htmlFor="org-name" className="block text-xs font-medium text-previa-muted uppercase tracking-wider mb-1.5">
                            Nombre *
                        </label>
                        <input
                            id="org-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. Grupo Industrial Norte"
                            className="w-full bg-previa-background text-previa-ink px-4 py-2.5 rounded-xl border border-previa-border focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent text-sm transition-all"
                            autoFocus
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label htmlFor="org-desc" className="block text-xs font-medium text-previa-muted uppercase tracking-wider mb-1.5">
                            Descripción (opcional)
                        </label>
                        <textarea
                            id="org-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Breve descripción de la organización..."
                            rows={2}
                            className="w-full bg-previa-background text-previa-ink px-4 py-2.5 rounded-xl border border-previa-border focus:outline-none focus:ring-2 focus:ring-previa-accent/50 focus:border-previa-accent text-sm resize-none transition-all"
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-400">{error}</p>
                    )}

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-previa-accent-light/60 text-previa-accent hover:bg-previa-accent-light border border-previa-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creando...' : 'Crear Organización'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
