import { NextResponse } from 'next/server';
import { validateLogin } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { success: false, error: 'Tên đăng nhập và mật khẩu là bắt buộc' },
                { status: 400 }
            );
        }

        const user = await validateLogin(username, password);

        if (user) {
            const response = NextResponse.json({
                success: true,
                role: user.role,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    role: user.role
                }
            });

            // Set cookies for 7 days
            const expires = new Date();
            expires.setDate(expires.getDate() + 7);

            response.cookies.set('auth_token', 'true', {
                expires,
                httpOnly: false,
                path: '/',
                sameSite: 'lax',
            });

            response.cookies.set('user_id', String(user.id), {
                expires,
                httpOnly: false,
                path: '/',
                sameSite: 'lax',
            });

            response.cookies.set('user_role', user.role, {
                expires,
                httpOnly: false,
                path: '/',
                sameSite: 'lax',
            });

            return response;
        } else {
            return NextResponse.json(
                { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' },
                { status: 401 }
            );
        }
    } catch (e: any) {
        console.error('Login error:', e);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
