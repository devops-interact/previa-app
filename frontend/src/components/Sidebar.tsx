'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, FileText, Activity, Settings, User, LogOut } from 'lucide-react'
import { useState } from 'react'

export function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const [organizacionesOpen, setOrganizacionesOpen] = useState(false)

    const handleLogout = () => {
        localStorage.removeItem('demo_auth')
        router.push('/')
    }

    const navSections = [
        {
            title: 'Organizaciones',
            expandable: true,
            items: [
                { label: 'Sistemas...', href: '/tablero' }
            ]
        },
        {
            title: 'Watchlists',
            items: [
                { label: 'Watchlist 1', count: '10 items', href: '/tablero?watchlist=1' },
                { label: 'Watchlist 2', count: '10 items', href: '/tablero?watchlist=2' }
            ]
        },
        {
            title: 'Herramientas',
            items: [
                { label: 'Seguimiento', icon: Activity, href: '/dataset' },
                { label: 'Documentos', icon: FileText, href: '/chat' }
            ]
        },
        {
            title: 'Configuración',
            items: [
                { label: 'Cuenta', icon: User, href: '#' },
                { label: 'Configuración', icon: Settings, href: '#' },
                { label: 'Salir', icon: LogOut, onClick: handleLogout }
            ]
        }
    ]

    return (
        <aside className="w-64 bg-previa-surface border-r border-previa-muted flex flex-col h-screen">
            {/* Logo */}
            <div className="p-6 border-b border-previa-muted">
                <Link href="/tablero" className="text-2xl font-bold text-previa-navy">
                    PREVIA.APP
                </Link>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-previa-muted flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-previa-navy text-white flex items-center justify-center font-semibold">
                    U
                </div>
                <div>
                    <div className="text-sm font-semibold text-previa-ink">Usuario #420</div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                {navSections.map((section, idx) => (
                    <div key={idx}>
                        {section.expandable ? (
                            <button
                                onClick={() => setOrganizacionesOpen(!organizacionesOpen)}
                                className="w-full flex items-center justify-between text-sm font-medium text-previa-ink mb-2 hover:text-previa-navy transition-colors"
                            >
                                <span>{section.title}</span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${organizacionesOpen ? 'rotate-180' : ''}`} />
                            </button>
                        ) : (
                            <h3 className="text-xs font-semibold text-previa-muted uppercase tracking-wider mb-2">
                                {section.title}
                            </h3>
                        )}

                        <ul className="space-y-1">
                            {section.items.map((item, itemIdx) => {
                                const Icon = 'icon' in item ? item.icon : null
                                const isActive = 'href' in item && item.href ? pathname === item.href : false

                                if ('onClick' in item && item.onClick) {
                                    return (
                                        <li key={itemIdx}>
                                            <button
                                                onClick={item.onClick}
                                                className="w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm hover:bg-previa-primary-light transition-colors text-previa-ink"
                                            >
                                                {Icon && <Icon className="w-4 h-4" />}
                                                <span>{item.label}</span>
                                            </button>
                                        </li>
                                    )
                                }

                                const href = 'href' in item ? item.href : '#'
                                const count = 'count' in item ? item.count : null

                                return (
                                    <li key={itemIdx}>
                                        <Link
                                            href={href || '#'}
                                            className={`flex items-center justify-between px-4 py-2 my-1 rounded-r-full mr-4 text-sm transition-all duration-200 ${isActive
                                                ? 'bg-previa-accent text-previa-ink font-bold shadow-sm translate-x-1'
                                                : 'text-previa-muted hover:text-previa-ink hover:bg-previa-surface'
                                                }`}
                                        >
                                            <div className="flex items-center space-x-2">
                                                {Icon && <Icon className="w-4 h-4" />}
                                                <span>{item.label}</span>
                                            </div>
                                            {count && (
                                                <span className="text-xs text-previa-muted">{count}</span>
                                            )}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ))}
            </nav>
        </aside>
    )
}
