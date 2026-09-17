import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        let apiToken = body.apiToken || body.token;

        if (!apiToken) {
            const [rows] = await pool.query<any[]>(
                "SELECT `value` FROM settings WHERE `key` = 'sepay_api_token' LIMIT 1"
            );
            apiToken = rows[0]?.value;
        }

        if (!apiToken || !apiToken.trim()) {
            return NextResponse.json({
                success: false,
                message: 'Vui lòng nhập SePay API Token (Bearer Token từ https://my.sepay.vn)!'
            }, { status: 400 });
        }

        const res = await fetch('https://my.sepay.vn/userapi/transactions/list?limit=5', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiToken.trim()}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && (data.status === 200 || data.messages?.success === true || Array.isArray(data.transactions))) {
            const txCount = Array.isArray(data.transactions) ? data.transactions.length : 0;
            return NextResponse.json({
                success: true,
                message: `Kết nối SePay API thành công! Đã xác thực API Token hợp lệ (Lấy được ${txCount} giao dịch gần nhất).`,
                transactions: data.transactions || []
            });
        }

        const errMsg = data.error || data.message || `Mã lỗi HTTP ${res.status}: Token không hợp lệ hoặc hết hạn`;
        return NextResponse.json({
            success: false,
            message: `Lỗi kết nối SePay: ${errMsg}`
        }, { status: 400 });

    } catch (error: any) {
        console.error('[SEPAY_TEST_ERROR]:', error);
        return NextResponse.json({
            success: false,
            message: `Lỗi kết nối tới máy chủ SePay: ${error.message || error}`
        }, { status: 500 });
    }
}
