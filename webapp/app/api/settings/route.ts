import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT `key`, `value` FROM settings');

        // Default settings
        const settings: Record<string, any> = {
            mb_auto_deposit: true,
            timo_auto_deposit: true,
            timo_username: '',
            timo_password: '',
            sepay_enabled: false,
            sepay_token: '',
            sepay_account_no: '',
            sepay_bank_code: '',
        };

        rows.forEach((row) => {
            // Handle booleans
            if (['mb_auto_deposit', 'timo_auto_deposit', 'sepay_enabled'].includes(row.key)) {
                settings[row.key] = row.value === 'true';
            } else {
                settings[row.key] = row.value;
            }
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            mb_auto_deposit,
            timo_auto_deposit,
            timo_username,
            timo_password,
            sepay_enabled,
            sepay_token,
            sepay_account_no,
            sepay_bank_code
        } = body;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const upsertSetting = async (key: string, value: string | boolean) => {
                await connection.query(
                    'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
                    [key, String(value), String(value)]
                );
            };

            if (mb_auto_deposit !== undefined) await upsertSetting('mb_auto_deposit', mb_auto_deposit);
            if (timo_auto_deposit !== undefined) await upsertSetting('timo_auto_deposit', timo_auto_deposit);
            if (timo_username !== undefined) await upsertSetting('timo_username', timo_username);
            if (timo_password !== undefined) await upsertSetting('timo_password', timo_password);

            // Sepay settings
            if (sepay_enabled !== undefined) await upsertSetting('sepay_enabled', sepay_enabled);
            if (sepay_token !== undefined) await upsertSetting('sepay_token', sepay_token);
            if (sepay_account_no !== undefined) await upsertSetting('sepay_account_no', sepay_account_no);
            if (sepay_bank_code !== undefined) await upsertSetting('sepay_bank_code', sepay_bank_code);

            await connection.commit();
            return NextResponse.json({ success: true });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
