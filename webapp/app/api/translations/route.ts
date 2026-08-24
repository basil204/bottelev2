import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
    try {
        await dbReady;
        const [rows] = await pool.query<RowDataPacket[]>(`
            SELECT msg_key, lang, msg_value, updated_at
            FROM translations
            ORDER BY msg_key ASC, lang ASC
        `);

        // Group by msg_key
        const keyMap: Record<string, { msg_key: string; vi: string; en: string; zh: string; updated_at?: string }> = {};

        for (const row of rows) {
            const key = row.msg_key;
            if (!keyMap[key]) {
                keyMap[key] = {
                    msg_key: key,
                    vi: '',
                    en: '',
                    zh: '',
                    updated_at: row.updated_at
                };
            }
            if (row.lang === 'vi') keyMap[key].vi = row.msg_value;
            if (row.lang === 'en') keyMap[key].en = row.msg_value;
            if (row.lang === 'zh') keyMap[key].zh = row.msg_value;
        }

        const data = Object.values(keyMap);
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('[TRANSLATIONS_API_GET_ERR]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await dbReady;
        const body = await request.json();
        const { action, translations, msg_key, vi, en, zh } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        if (action === 'seed_from_code') {
            const { messages } = await import('../../../../includes/lang/messages.js');
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                for (const [lang, keyValues] of Object.entries(messages)) {
                    for (const [key, value] of Object.entries(keyValues as Record<string, string>)) {
                        await connection.query(
                            'INSERT INTO translations (msg_key, lang, msg_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE msg_value = VALUES(msg_value)',
                            [key, lang, value]
                        );
                    }
                }
                await connection.commit();
            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SETTINGS',
                details: { type: 'seed_from_code_messages' },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã nạp toàn bộ ngôn ngữ từ includes/lang/messages.js vào CSDL!' });
        }

        if (action === 'batch_update' && Array.isArray(translations)) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                for (const item of translations) {
                    if (!item.msg_key) continue;
                    if (item.vi !== undefined) {
                        await connection.query(
                            'INSERT INTO translations (msg_key, lang, msg_value) VALUES (?, "vi", ?) ON DUPLICATE KEY UPDATE msg_value = ?',
                            [item.msg_key, item.vi, item.vi]
                        );
                    }
                    if (item.en !== undefined) {
                        await connection.query(
                            'INSERT INTO translations (msg_key, lang, msg_value) VALUES (?, "en", ?) ON DUPLICATE KEY UPDATE msg_value = ?',
                            [item.msg_key, item.en, item.en]
                        );
                    }
                    if (item.zh !== undefined) {
                        await connection.query(
                            'INSERT INTO translations (msg_key, lang, msg_value) VALUES (?, "zh", ?) ON DUPLICATE KEY UPDATE msg_value = ?',
                            [item.msg_key, item.zh, item.zh]
                        );
                    }
                }
                await connection.commit();
            } catch (err) {
                await connection.rollback();
                throw err;
            } finally {
                connection.release();
            }

            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SETTINGS',
                details: { type: 'batch_update_translations', count: translations.length },
                ipAddress,
                userAgent,
                request
            });

            return NextResponse.json({ success: true, message: 'Đã cập nhật ngôn ngữ thành công!' });
        }

        // Single key update
        if (!msg_key) {
            return NextResponse.json({ error: 'Thiếu msg_key' }, { status: 400 });
        }

        if (vi !== undefined) {
            await pool.query(
                'INSERT INTO translations (msg_key, lang, msg_value) VALUES (?, "vi", ?) ON DUPLICATE KEY UPDATE msg_value = ?',
                [msg_key, vi, vi]
            );
        }
        if (en !== undefined) {
            await pool.query(
                'INSERT INTO translations (msg_key, lang, msg_value) VALUES (?, "en", ?) ON DUPLICATE KEY UPDATE msg_value = ?',
                [msg_key, en, en]
            );
        }
        if (zh !== undefined) {
            await pool.query(
                'INSERT INTO translations (msg_key, lang, msg_value) VALUES (?, "zh", ?) ON DUPLICATE KEY UPDATE msg_value = ?',
                [msg_key, zh, zh]
            );
        }

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'SETTINGS',
            details: { type: 'single_update_translation', msg_key },
            ipAddress,
            userAgent,
            request
        });

        return NextResponse.json({ success: true, message: 'Đã lưu ngôn ngữ!' });
    } catch (error: any) {
        console.error('[TRANSLATIONS_API_POST_ERR]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
