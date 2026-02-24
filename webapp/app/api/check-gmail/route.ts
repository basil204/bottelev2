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
                const response = await fetch("https://checkmail.live/check/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        api_key: apiKey,
                        fastCheck: true,
                        emails: emails
                    })
                });

                const data = await response.json();

                // Check if the API key is invalid
                // Based on checkmail.live behavior, if status is false and message indicates invalid key
                if (data.status === false && (
                    data.message?.toLowerCase().includes('api key') ||
                    data.message?.toLowerCase().includes('invalid') ||
                    response.status === 401
                )) {
                    console.warn(`[Check Gmail API] Invalid API Key detected: ${apiKey}. Removing from database.`);

                    // Remove the invalid key from database
                    const updatedKeys = apiKeys.filter(k => k !== apiKey);
                    await pool.query(
                        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
                        ['gmail_checker_api_keys', JSON.stringify(updatedKeys), JSON.stringify(updatedKeys)]
                    );

                    // Update the local list for consistency if needed, though we continue the loop
                    apiKeys = updatedKeys;
                    continue; // Try next key
                }

                successResponse = data;
                break; // Success or non-key error, exit loop
            } catch (error) {
                console.error(`[Check Gmail API] Error with key ${apiKey}:`, error);
                lastError = 'Lỗi kết nối tới checkmail.live';
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
