import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { get2FACode } from '@/lib/2fa';

// GET - Lấy mã 2FA từ secret
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const rawSecret = searchParams.get('secret');

        if (!rawSecret) {
            return NextResponse.json(
                { success: false, error: 'Secret là bắt buộc' },
                { status: 400 }
            );
        }

        // Remove all spaces from secret
        const secret = rawSecret.replace(/\s/g, '');

        const result = await get2FACode(secret);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || 'Không lấy được mã 2FA' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            token: result.token
        });
    } catch (error) {
        console.error('Error fetching 2FA:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
