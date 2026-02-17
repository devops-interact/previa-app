'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { apiClient } from '@/lib/api-client'
import { Navbar } from '@/components/navbar'
import { AuthGuard } from '@/components/AuthGuard'

export default function DatasetPage() {
    const router = useRouter()
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return

        const file = acceptedFiles[0]
        setError('')
        setUploading(true)

        try {
            const response = await apiClient.uploadScan(file)
            console.log('Scan created:', response)
            router.push(`/tablero?scan_id=${response.scan_id}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload file')
        } finally {
            setUploading(false)
        }
    }, [router])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
        },
        maxFiles: 1,
        disabled: uploading,
    })

    return (
        <AuthGuard>
            <Navbar />
            <main className="container mx-auto px-4 py-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-previa-ink mb-6">
                        Nuevo Dataset / Carga de RFCs
                    </h1>

                    <div className="bg-previa-surface rounded-xl shadow-lg border border-previa-border p-8">
                        <h2 className="text-xl font-semibold text-previa-ink mb-4">
                            Subir archivo CSV o XLSX
                        </h2>

                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isDragActive
                                ? 'border-previa-accent bg-previa-accent/5'
                                : 'border-previa-border hover:border-previa-accent hover:bg-previa-surface-hover'
                                } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <input {...getInputProps()} />

                            <div className="space-y-4">
                                <div className="text-4xl">📄</div>

                                {uploading ? (
                                    <div className="space-y-2">
                                        <div className="w-8 h-8 border-2 border-previa-accent border-t-transparent rounded-full animate-spin mx-auto" />
                                        <p className="text-lg text-previa-ink">Subiendo archivo...</p>
                                    </div>
                                ) : isDragActive ? (
                                    <p className="text-lg text-previa-accent">Suelta el archivo aquí...</p>
                                ) : (
                                    <>
                                        <p className="text-lg text-previa-ink">
                                            Arrastra un archivo CSV o XLSX aquí, o haz clic para seleccionar
                                        </p>
                                        <p className="text-sm text-previa-muted">
                                            Columnas requeridas: <code className="bg-previa-surface-hover px-1.5 py-0.5 rounded text-previa-accent text-xs">rfc</code>, <code className="bg-previa-surface-hover px-1.5 py-0.5 rounded text-previa-accent text-xs">razon_social</code>
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="mt-4 bg-previa-danger/10 border border-previa-danger/30 text-previa-danger px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div className="mt-8 p-4 bg-previa-primary-light rounded-lg border border-previa-border">
                            <h3 className="font-semibold text-previa-ink mb-2">Formato del archivo:</h3>
                            <ul className="text-sm text-previa-muted space-y-1">
                                <li>• <span className="text-previa-ink font-medium">Requeridos:</span> rfc, razon_social</li>
                                <li>• <span className="text-previa-ink font-medium">Opcionales:</span> tipo_persona, relacion, id_interno</li>
                                <li>• Formatos soportados: CSV, XLSX, XLS</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </AuthGuard>
    )
}
