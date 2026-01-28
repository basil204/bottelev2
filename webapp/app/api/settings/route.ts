import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { exec } from 'child_process';

const restartCoba = () => {
    exec('pm2 restart all', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
};

export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT `key`, `value` FROM settings');

        // Default settings
        const settings: Record<string, any> = {
            mb_auto_deposit: true,
            viettel_token: '',
            min_deposit: 50000,
            telegram_bot_token: '',
            shop_name: 'SHOP',
            usdt_trc20_wallet: '',
        };

        rows.forEach((row) => {
            // Handle booleans
            if (['mb_auto_deposit'].includes(row.key)) {
                settings[row.key] = row.value === 'true';
            } else if (['min_deposit'].includes(row.key)) {
                settings[row.key] = Number(row.value) || 50000;
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
            viettel_token,
            min_deposit,
            telegram_bot_token,
            shop_name,
            usdt_trc20_wallet
        } = body;

        const connection = await pool.getConnection();
        let shouldRestart = false;

        try {
            await connection.beginTransaction();

            const upsertSetting = async (key: string, value: string | boolean | number) => {
                await connection.query(
                    'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
                    [key, String(value), String(value)]
                );
            };

            if (mb_auto_deposit !== undefined) await upsertSetting('mb_auto_deposit', mb_auto_deposit);
            if (viettel_token !== undefined) await upsertSetting('viettel_token', viettel_token);
            if (min_deposit !== undefined) await upsertSetting('min_deposit', min_deposit);
            if (telegram_bot_token !== undefined) {
                await upsertSetting('telegram_bot_token', telegram_bot_token);
                shouldRestart = true;
            }
            if (shop_name !== undefined) await upsertSetting('shop_name', shop_name);
            if (usdt_trc20_wallet !== undefined) await upsertSetting('usdt_trc20_wallet', usdt_trc20_wallet);

            await connection.commit();

            if (shouldRestart) {
                restartCoba();
            }

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
