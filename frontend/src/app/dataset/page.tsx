'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'

/**
 * Dataset upload is now a modal flow. Visiting /dataset redirects to tablero
 * with ?upload=1 so the tablero opens the upload modal.
 */
export default function DatasetPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/tablero?upload=1')
    }, [router])

    return (
        <AuthGuard>
            <div className="min-h-screen bg-previa-background flex items-center justify-center">
                <p className="text-previa-muted text-sm">Redirigiendo...</p>
            </div>
        </AuthGuard>
    )
}
