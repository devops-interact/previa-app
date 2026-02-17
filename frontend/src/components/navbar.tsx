'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'

export function Navbar() {
    const pathname = usePathname()
    const router = useRouter()

    const handleLogout = () => {
        localStorage.removeItem('demo_auth')
        router.push('/')
    }

    // Don't show navbar on login page
    if (pathname === '/') {
        return null
    }

    const navItems = [
        { href: '/dataset', label: 'New Dataset' },
        { href: '/tablero', label: 'Tablero' },
        { href: '/chat', label: 'Chat' },
    ]

    return (
        <nav className="bg-previa-navy text-white shadow-lg">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/tablero" className="text-xl font-bold">
                        PREV.IA
                    </Link>

                    {/* Navigation Links */}
                    <div className="flex items-center space-x-6">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${pathname === item.href
                                        ? 'bg-previa-accent text-previa-navy'
                                        : 'hover:bg-previa-navy/80'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}

                        {/* User Menu */}
                        <button
                            onClick={handleLogout}
                            className="px-3 py-2 rounded-md text-sm font-medium hover:bg-previa-navy/80 transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    )
}
