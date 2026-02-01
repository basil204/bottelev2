import { NextResponse } from 'next/server';
import { createGoogleUser, checkEmailExists, getGoogleDomains } from '@/lib/google-admin';
import { generateRandomUsername, generateRandomPassword } from '@/lib/utils';

// API để test tạo email trực tiếp qua Google Admin
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { domain, username, firstName = 'Test', lastName = 'User' } = body;

        if (!domain) {
            return NextResponse.json(
                { success: false, error: 'Domain là bắt buộc' },
                { status: 400 }
            );
        }

        const emailUsername = username || generateRandomUsername(8);
        const password = generateRandomPassword(12);
        const email = `${emailUsername}@${domain}`;

        // Kiểm tra email đã tồn tại chưa
        const existsCheck = await checkEmailExists(email);
        if (existsCheck.exists) {
            return NextResponse.json(
                { success: false, error: 'Email đã tồn tại trên Google Workspace' },
                { status: 400 }
            );
        }

        // Tạo user trên Google
        const result = await createGoogleUser({
            email,
            password,
            firstName,
            lastName,
        });

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            email,
            password,
            message: 'Đã tạo email thành công trên Google Workspace',
        });
    } catch (error: any) {
        console.error('Error in test-google-email:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Lỗi server' },
            { status: 500 }
        );
    }
}

// GET - Lấy danh sách domain từ Google Workspace
export async function GET() {
    try {
        const result = await getGoogleDomains();

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            domains: result.domains,
        });
    } catch (error: any) {
        console.error('Error getting domains:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Lỗi server' },
            { status: 500 }
        );
    }
}
