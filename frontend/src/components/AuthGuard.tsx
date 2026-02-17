'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AuthGuardProps {
    children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
    const router = useRouter()
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const auth = localStorage.getItem('previa_auth')
        if (!auth) {
            router.replace('/')
        } else {
            setIsAuthenticated(true)
        }
        setIsLoading(false)
    }, [router])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-previa-background flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-2 border-previa-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-previa-muted text-sm">Loading...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) return null

    return <>{children}</>
}
