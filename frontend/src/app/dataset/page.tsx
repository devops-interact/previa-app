'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { apiClient } from '@/lib/api-client'
import { Navbar } from '@/components/navbar'

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

            // Redirect to tablero with scan_id
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
        <>
            <Navbar />
            <main className="container mx-auto px-4 py-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-previa-navy mb-6">
                        New Dataset / RFC Upload
                    </h1>

                    <div className="bg-previa-surface rounded-lg shadow-lg p-8">
                        <h2 className="text-xl font-semibold text-previa-ink mb-4">
                            Upload CSV or XLSX File
                        </h2>

                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive
                                ? 'border-previa-accent bg-previa-primary-light'
                                : 'border-previa-muted hover:border-previa-accent hover:bg-previa-primary-light'
                                } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <input {...getInputProps()} />

                            <div className="space-y-4">
                                <div className="text-4xl">📄</div>

                                {uploading ? (
                                    <p className="text-lg text-previa-ink">Uploading...</p>
                                ) : isDragActive ? (
                                    <p className="text-lg text-previa-ink">Drop the file here...</p>
                                ) : (
                                    <>
                                        <p className="text-lg text-previa-ink">
                                            Drag and drop a CSV or XLSX file here, or click to select
                                        </p>
                                        <p className="text-sm text-previa-muted">
                                            Required columns: <code>rfc</code>, <code>razon_social</code>
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="mt-8 p-4 bg-previa-primary-light rounded-md">
                            <h3 className="font-semibold text-previa-ink mb-2">File Format:</h3>
                            <ul className="text-sm text-previa-ink space-y-1">
                                <li>• <strong>Required:</strong> rfc, razon_social</li>
                                <li>• <strong>Optional:</strong> tipo_persona, relacion, id_interno</li>
                                <li>• Supported formats: CSV, XLSX, XLS</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </>
    )
}
