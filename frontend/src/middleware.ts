import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = new Set(['/', '/register'])

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
        return NextResponse.next()
    }

    const token = request.cookies.get('previa_token')?.value
    if (!token) {
        const loginUrl = new URL('/', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
