import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const authToken = request.cookies.get('auth_token');
    const userRole = request.cookies.get('user_role')?.value;
    const pathname = request.nextUrl.pathname;

    // Public routes that don't need auth
    const publicRoutes = ['/login'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // API routes are handled separately
    if (pathname.startsWith('/api')) {
        return NextResponse.next();
    }

    // If user is on public route and is logged in
    if (isPublicRoute && authToken) {
        // Redirect to appropriate dashboard
        if (userRole === 'admin') {
            return NextResponse.redirect(new URL('/admin', request.url));
        }
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // If user is trying to access protected route but not logged in
    if (!isPublicRoute && !authToken) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check admin routes
    if (pathname.startsWith('/admin') && userRole !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Check user routes (non-admin users)
    if (pathname.startsWith('/dashboard') && userRole === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
