'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { X, Upload, FileSpreadsheet, CheckCircle2, Info, Building2 } from '@/lib/icons'
import { apiClient } from '@/lib/api-client'
import type { ChatContext, Organization } from '@/types'

const FLEXIBLE_COLUMNS = [
    { name: 'rfc', required: true, desc: 'RFC del proveedor o cliente (13 caracteres)' },
    { name: 'razon_social', required: true, desc: 'Nombre o razón social completa' },
    { name: 'tipo_persona', required: false, desc: 'fisica / moral' },
    { name: 'relacion', required: false, desc: 'proveedor / cliente / socio / otro — se usará como tag' },
    { name: 'id_interno', required: false, desc: 'Tu identificador interno' },
    { name: '(cualquier columna adicional)', required: false, desc: 'El agente interpretará columnas adicionales automáticamente' },
]

function stemName(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '')
}

export interface DatasetUploadModalProps {
    isOpen: boolean
    onClose: () => void
    chatContext?: ChatContext
}

export function DatasetUploadModal({ isOpen, onClose, chatContext = {} }: DatasetUploadModalProps) {
    const router = useRouter()
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')

    // Org / watchlist fields
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [selectedOrgId, setSelectedOrgId] = useState<number | undefined>(undefined)
    const [watchlistName, setWatchlistName] = useState('')
    const [loadingOrgs, setLoadingOrgs] = useState(false)

    // Load orgs when modal opens
    useEffect(() => {
        if (!isOpen) return
        setLoadingOrgs(true)
        apiClient.listOrganizations()
            .then((orgs) => {
                setOrganizations(orgs)
                // Pre-select based on chat context (match org name)
                if (chatContext.organization) {
                    const match = orgs.find((o) => o.name === chatContext.organization)
                    if (match) setSelectedOrgId(match.id)
                } else if (orgs.length === 1) {
                    setSelectedOrgId(orgs[0].id)
                }
            })
            .catch(() => { })
            .finally(() => setLoadingOrgs(false))
    }, [isOpen, chatContext.organization])

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return
            const file = acceptedFiles[0]
            // Auto-fill watchlist name from filename
            if (!watchlistName) setWatchlistName(stemName(file.name))
        },
        [watchlistName]
    )

    const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
        },
        maxFiles: 1,
        disabled: uploading,
    })

    const handleSubmit = async () => {
        if (acceptedFiles.length === 0) return
        const file = acceptedFiles[0]
        setError('')
        setUploading(true)
        try {
            const response = await apiClient.uploadScan(
                file,
                selectedOrgId,
                watchlistName || stemName(file.name),
            )
            onClose()
            router.push(`/tablero?scan_id=${response.scan_id}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al subir el archivo')
        } finally {
            setUploading(false)
        }
    }

    // Auto-update watchlist name when file is picked and field is empty
    const currentFile = acceptedFiles[0]
    useEffect(() => {
        if (currentFile && !watchlistName) {
            setWatchlistName(stemName(currentFile.name))
        }
    }, [currentFile, watchlistName])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden
            />
            <div
                className="relative w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-previa-surface border border-previa-border border-b-0 sm:border-b shadow-2xl"
                role="dialog"
                aria-labelledby="upload-modal-title"
                aria-modal="true"
            >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-previa-border bg-previa-surface">
                    <h2 id="upload-modal-title" className="text-lg sm:text-xl font-bold text-previa-ink">
                        Cargar Dataset
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-previa-muted hover:text-previa-ink hover:bg-previa-background transition-colors"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-4 sm:px-6 pb-6 sm:pb-8 space-y-4 sm:space-y-5">
                    <p className="text-sm text-previa-muted pt-2 sm:pt-4">
                        Sube un archivo CSV o XLS para verificación SAT. El archivo crea una nueva watchlist en la organización seleccionada.
                    </p>

                    {/* Org + watchlist name — stack on mobile */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-previa-muted uppercase tracking-wider mb-1.5">
                                Organización
                            </label>
                            {loadingOrgs ? (
                                <div className="h-9 rounded-lg bg-previa-surface-hover animate-pulse" />
                            ) : organizations.length === 0 ? (
                                <div className="h-9 flex items-center px-3 rounded-lg border border-dashed border-previa-border text-xs text-previa-muted">
                                    Sin organizaciones — crea una primero
                                </div>
                            ) : (
                                <select
                                    value={selectedOrgId ?? ''}
                                    onChange={(e) => setSelectedOrgId(e.target.value ? Number(e.target.value) : undefined)}
                                    className="w-full px-3 py-2 bg-previa-background border border-previa-border rounded-lg text-xs text-previa-ink focus:outline-none focus:ring-1 focus:ring-previa-accent"
                                >
                                    <option value="">Sin organización</option>
                                    {organizations.map((o) => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-previa-muted uppercase tracking-wider mb-1.5">
                                Nombre de watchlist
                            </label>
                            <input
                                type="text"
                                value={watchlistName}
                                onChange={(e) => setWatchlistName(e.target.value)}
                                placeholder="Auto: nombre del archivo"
                                disabled={!selectedOrgId}
                                className="w-full px-3 py-2 bg-previa-background border border-previa-border rounded-lg text-xs text-previa-ink placeholder-previa-muted/60 focus:outline-none focus:ring-1 focus:ring-previa-accent disabled:opacity-40"
                            />
                        </div>
                    </div>

                    {selectedOrgId && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-previa-accent/5 border border-previa-accent/20 rounded-lg">
                            <Building2 className="w-3.5 h-3.5 text-previa-accent shrink-0" />
                            <span className="text-xs text-previa-accent">
                                Se creará la watchlist <strong>{watchlistName || 'nombre del archivo'}</strong> en <strong>{organizations.find(o => o.id === selectedOrgId)?.name}</strong>
                            </span>
                        </div>
                    )}

                    {/* Dropzone */}
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragActive
                            ? 'border-previa-accent bg-previa-accent/5'
                            : uploading
                                ? 'border-previa-border bg-previa-surface opacity-60 cursor-not-allowed'
                                : 'border-previa-border bg-previa-surface hover:border-previa-accent hover:bg-previa-accent/5'
                            }`}
                    >
                        <input {...getInputProps()} />
                        <div className="space-y-3">
                            {uploading ? (
                                <>
                                    <div className="w-10 h-10 border-2 border-previa-accent border-t-transparent rounded-full animate-spin mx-auto" />
                                    <p className="text-previa-ink font-medium">Procesando archivo...</p>
                                    <p className="text-xs text-previa-muted">Analizando columnas e iniciando verificación SAT</p>
                                </>
                            ) : isDragActive ? (
                                <>
                                    <Upload className="w-10 h-10 text-previa-accent mx-auto" />
                                    <p className="text-previa-accent font-medium">Suelta el archivo aquí</p>
                                </>
                            ) : currentFile ? (
                                <>
                                    <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
                                    <p className="text-previa-ink font-medium">{currentFile.name}</p>
                                    <p className="text-xs text-previa-muted">Archivo listo · Haz clic para cambiar</p>
                                </>
                            ) : (
                                <>
                                    <FileSpreadsheet className="w-10 h-10 text-previa-muted mx-auto" />
                                    <div>
                                        <p className="text-previa-ink font-semibold mb-1">
                                            Arrastra tu archivo o haz clic para seleccionar
                                        </p>
                                        <p className="text-sm text-previa-muted">
                                            Formatos: CSV, XLSX, XLS · Máximo 10 MB
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Upload button — only shown when file is ready */}
                    {currentFile && !uploading && (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="w-full py-2.5 bg-previa-accent text-black rounded-xl font-semibold text-sm hover:bg-previa-accent/90 transition-colors"
                        >
                            Subir y verificar
                        </button>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start space-x-2">
                            <span className="mt-0.5">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Column reference */}
                    <div className="bg-previa-background border border-previa-border rounded-xl overflow-hidden">
                        <div className="flex items-center space-x-2 px-4 py-3 border-b border-previa-border">
                            <Info className="w-4 h-4 text-previa-accent shrink-0" />
                            <h3 className="text-sm font-semibold text-previa-ink">Columnas del archivo</h3>
                            <span className="text-xs text-previa-muted hidden sm:block">— El agente interpreta columnas adicionales</span>
                        </div>
                        <div className="divide-y divide-previa-border">
                            {FLEXIBLE_COLUMNS.map((col) => (
                                <div key={col.name} className="flex items-center justify-between px-4 py-2.5">
                                    <div className="flex items-center space-x-2 min-w-0">
                                        <code
                                            className={`text-xs px-2 py-0.5 rounded font-mono shrink-0 ${col.required
                                                ? 'bg-previa-accent/15 text-previa-accent border border-previa-accent/25'
                                                : 'bg-previa-surface text-previa-muted border border-previa-border'
                                                }`}
                                        >
                                            {col.name}
                                        </code>
                                        {col.required && <span className="text-xs text-red-400 font-medium shrink-0">Requerida</span>}
                                    </div>
                                    <p className="text-xs text-previa-muted text-right max-w-[200px]">{col.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-previa-accent/5 border border-previa-accent/20 rounded-xl px-4 py-3 flex items-start space-x-3">
                        <span className="text-lg mt-0.5 shrink-0">🤖</span>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-previa-ink mb-0.5">El agente entiende cualquier formato</p>
                            <p className="text-xs text-previa-muted">
                                Si tu archivo tiene columnas con nombres distintos (ej. &quot;RFC_PROVEEDOR&quot;, &quot;EMPRESA&quot;), el agente las identificará y mapeará automáticamente. La columna <code className="text-previa-accent">relacion</code> se usará como tag de grupo.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
