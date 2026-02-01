import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

/**
 * API Route cho quản lý giá Gmail EDU
 * GET - Lấy giá hiện tại
 * POST - Set giá Gmail EDU
 */

// GET - Lấy giá Gmail EDU
export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT `key`, `value` FROM settings WHERE `key` IN ('gmail_edu_price', 'gmail_edu_delete_hours', 'gmail_edu_enabled', 'gmail_edu_domain')"
        );

        const settings: Record<string, any> = {
            gmail_edu_price: 10000,
            gmail_edu_delete_hours: 1,
            gmail_edu_enabled: true,
            gmail_edu_domain: 'suafpoly.app'
        };

        rows.forEach((row) => {
            if (row.key === 'gmail_edu_price') {
                settings.gmail_edu_price = Number(row.value) || 10000;
            } else if (row.key === 'gmail_edu_delete_hours') {
                settings.gmail_edu_delete_hours = Number(row.value) || 1;
            } else if (row.key === 'gmail_edu_enabled') {
                settings.gmail_edu_enabled = row.value === 'true';
            } else if (row.key === 'gmail_edu_domain') {
                settings.gmail_edu_domain = row.value || 'suafpoly.app';
            }
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error fetching Gmail EDU price:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST - Set giá Gmail EDU
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { gmail_edu_price, gmail_edu_delete_hours, gmail_edu_enabled, gmail_edu_domain } = body;

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const upsertSetting = async (key: string, value: string | number | boolean) => {
                await connection.query(
                    'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
                    [key, String(value), String(value)]
                );
            };

            if (gmail_edu_price !== undefined) {
                await upsertSetting('gmail_edu_price', gmail_edu_price);
            }
            if (gmail_edu_delete_hours !== undefined) {
                await upsertSetting('gmail_edu_delete_hours', gmail_edu_delete_hours);
            }
            if (gmail_edu_enabled !== undefined) {
                await upsertSetting('gmail_edu_enabled', gmail_edu_enabled);
            }
            if (gmail_edu_domain !== undefined) {
                await upsertSetting('gmail_edu_domain', gmail_edu_domain);
            }

            await connection.commit();

            return NextResponse.json({ success: true, message: 'Settings updated' });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating Gmail EDU settings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
