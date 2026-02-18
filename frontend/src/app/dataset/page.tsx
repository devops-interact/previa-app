'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, CheckCircle2, Info } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { Sidebar } from '@/components/Sidebar'
import { AuthGuard } from '@/components/AuthGuard'
import type { ChatContext } from '@/types'

const FLEXIBLE_COLUMNS = [
    { name: 'rfc', required: true, desc: 'RFC del proveedor o cliente (13 caracteres)' },
    { name: 'razon_social', required: true, desc: 'Nombre o razón social completa' },
    { name: 'tipo_persona', required: false, desc: 'fisica / moral' },
    { name: 'relacion', required: false, desc: 'proveedor / cliente / socio / otro' },
    { name: 'id_interno', required: false, desc: 'Tu identificador interno' },
    { name: '(cualquier columna adicional)', required: false, desc: 'El agente interpretará columnas adicionales automáticamente' },
]

export default function DatasetPage() {
    const router = useRouter()
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const [chatContext, setChatContext] = useState<ChatContext>({})

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return

        const file = acceptedFiles[0]
        setError('')
        setUploading(true)

        try {
            const response = await apiClient.uploadScan(file)
            router.push(`/tablero?scan_id=${response.scan_id}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al subir el archivo')
        } finally {
            setUploading(false)
        }
    }, [router])

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

    const handleWatchlistSelect = (orgId: number, wlId: number, orgName: string, wlName: string) => {
        setChatContext({ organization: orgName, watchlist: wlName, watchlist_id: wlId })
    }

    return (
        <AuthGuard>
            <div className="flex h-screen bg-previa-background overflow-hidden">
                <Sidebar onWatchlistSelect={handleWatchlistSelect} />

                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-6 py-8">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-previa-ink mb-1">
                                Cargar Dataset de Proveedores
                            </h1>
                            <p className="text-sm text-previa-muted">
                                Sube un archivo CSV o XLS con tu lista de proveedores o clientes para verificación ante el SAT.
                            </p>
                            {chatContext.watchlist && (
                                <div className="mt-3 inline-flex items-center space-x-2 px-3 py-1.5 bg-previa-accent/10 border border-previa-accent/30 rounded-lg">
                                    <span className="text-xs text-previa-accent font-medium">
                                        📋 Watchlist destino: {chatContext.organization} › {chatContext.watchlist}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Dropzone */}
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-5 ${isDragActive
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
                                ) : acceptedFiles.length > 0 ? (
                                    <>
                                        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
                                        <p className="text-previa-ink font-medium">{acceptedFiles[0].name}</p>
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

                        {error && (
                            <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start space-x-2">
                                <span className="mt-0.5">⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Column reference */}
                        <div className="bg-previa-surface border border-previa-border rounded-2xl overflow-hidden">
                            <div className="flex items-center space-x-2 px-5 py-4 border-b border-previa-border">
                                <Info className="w-4 h-4 text-previa-accent" />
                                <h3 className="text-sm font-semibold text-previa-ink">Columnas del archivo</h3>
                                <span className="text-xs text-previa-muted">— El agente interpreta automáticamente columnas adicionales</span>
                            </div>
                            <div className="divide-y divide-previa-border">
                                {FLEXIBLE_COLUMNS.map((col) => (
                                    <div key={col.name} className="flex items-center justify-between px-5 py-3 hover:bg-previa-surface-hover transition-colors">
                                        <div className="flex items-center space-x-3">
                                            <code className={`text-xs px-2 py-0.5 rounded font-mono ${col.required
                                                ? 'bg-previa-accent/15 text-previa-accent border border-previa-accent/25'
                                                : 'bg-previa-background text-previa-muted border border-previa-border'
                                                }`}>
                                                {col.name}
                                            </code>
                                            {col.required && (
                                                <span className="text-xs text-red-400 font-medium">Requerida</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-previa-muted max-w-xs text-right">{col.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Agent hint */}
                        <div className="mt-4 bg-previa-accent/5 border border-previa-accent/20 rounded-xl px-4 py-3 flex items-start space-x-3">
                            <span className="text-lg mt-0.5">🤖</span>
                            <div>
                                <p className="text-xs font-semibold text-previa-ink mb-0.5">El agente entiende cualquier formato</p>
                                <p className="text-xs text-previa-muted">
                                    Si tu archivo tiene columnas con nombres distintos (ej. "RFC_PROVEEDOR", "EMPRESA", "NOMBRE_RAZON_SOCIAL"), el agente de IA las identificará y mapeará automáticamente al verificar contra el SAT.
                                </p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </AuthGuard>
    )
}
