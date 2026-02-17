'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'

export function Navbar() {
    const pathname = usePathname()
    const router = useRouter()

    const handleLogout = () => {
        localStorage.removeItem('previa_auth')
        router.push('/')
    }

    if (pathname === '/') {
        return null
    }

    const navItems = [
        { href: '/dataset', label: 'Nuevo Dataset' },
        { href: '/tablero', label: 'Tablero' },
        { href: '/chat', label: 'Chat' },
    ]

    return (
        <nav className="bg-previa-surface border-b border-previa-border shadow-lg shadow-black/20">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    <Link href="/tablero" className="text-xl font-bold text-previa-accent tracking-tight">
                        PREV.IA
                    </Link>

                    <div className="flex items-center space-x-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === item.href
                                        ? 'bg-previa-accent/10 text-previa-accent border border-previa-accent/20'
                                        : 'text-previa-muted hover:text-previa-ink hover:bg-previa-surface-hover'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}

                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-previa-muted hover:text-previa-danger hover:bg-previa-danger/10 transition-all ml-2"
                        >
                            Salir
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    )
}
