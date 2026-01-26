import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('auth_token');
    const isLoginPage = request.nextUrl.pathname === '/login';

    // If user is trying to access login page but is already logged in
    if (isLoginPage && token) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // If user is trying to access protected route but is not logged in
    if (!isLoginPage && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder content (if any, though usually handled by _next checks)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
