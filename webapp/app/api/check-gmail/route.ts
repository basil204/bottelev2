import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { emails } = body;

        if (!emails || !Array.isArray(emails)) {
            return NextResponse.json({ success: false, error: 'Emails must be an array' }, { status: 400 });
        }

        if (emails.length > 1000) {
            return NextResponse.json({ success: false, error: 'Maximum 1000 emails allowed per request' }, { status: 400 });
        }

        // Fetch API keys from settings
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT `value` FROM settings WHERE `key` = 'gmail_checker_api_keys'"
        );

        let apiKeys: string[] = [];
        try {
            apiKeys = rows.length > 0 ? JSON.parse(rows[0].value) : [];
        } catch (e) {
            console.error('[Check Gmail API] Error parsing api keys:', e);
        }

        if (apiKeys.length === 0) {
            return NextResponse.json({
                success: false,
                status: false,
                message: 'Chưa cấu hình API Key trong cài đặt'
            }, { status: 400 });
        }

        // Shuffle keys to pick a random one
        let shuffledKeys = [...apiKeys].sort(() => Math.random() - 0.5);
        let lastError = 'Không thể check mail với các key hiện tại';
        let successResponse = null;

        for (const apiKey of shuffledKeys) {
            try {
                // Prepare form data for gmailchecklive.com
                const formData = new URLSearchParams();
                const emailList = emails.join('\r\n');

                // Using URLSearchParams might work if they accept urlencoded, 
                // but user showed multipart. Let's use standard FormData if available or simulate it.
                // In Next.js/Browser environment, FormData is available.
                const fd = new FormData();
                fd.append('emails', emailList);
                fd.append('original_lines', emailList);
                fd.append('_t', '02497f2c'); // Placeholder token from user's example
                fd.append('chunk_id', 'chunk_1');
                fd.append('chunk_total', '1');

                const response = await fetch("https://www.gmailchecklive.com/index.php", {
                    method: "POST",
                    headers: {
                        "Accept": "*/*",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
                        "Referer": "https://www.gmailchecklive.com/",
                        "Origin": "https://www.gmailchecklive.com"
                    },
                    body: fd
                });

                const rawData = await response.json();

                // Check if success
                if (rawData.success) {
                    // Transform gmailchecklive.com format to the app's expected format
                    // gmailchecklive: { success: true, results: { "email": true/false } }
                    // expected: { status: true, data: [ { email, status: 'live'/'die', index } ] }

                    const transformedData = {
                        status: true,
                        success: true,
                        data: Object.entries(rawData.results || {}).map(([email, isLive], idx) => ({
                            email,
                            status: isLive ? 'live' : 'die',
                            index: idx + 1
                        }))
                    };

                    successResponse = transformedData;
                    break;
                }

                // If not success, judge if it's a key/service issue
                console.warn(`[Check Gmail API] gmailchecklive.com returned failure:`, rawData);
                lastError = rawData.message || 'gmailchecklive.com returned failure';

            } catch (error) {
                console.error(`[Check Gmail API] Error:`, error);
                lastError = 'Lỗi kết nối tới gmailchecklive.com';
            }
        }

        if (successResponse) {
            return NextResponse.json(successResponse);
        }

        return NextResponse.json({
            success: false,
            status: false,
            message: lastError
        }, { status: 500 });

    } catch (error) {
        console.error('[Check Gmail API] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
