import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { exec } from 'child_process';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

const restartCoba = () => {
    exec('pm2 restart all', (error, stdout, stderr) => {
        if (error) {
            // PM2 might not be installed in dev environment - silently ignore
            console.log('[Settings] PM2 not available, skip restart');
            return;
        }
        if (stdout) console.log(`[Settings] PM2: ${stdout}`);
    });
};

export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT `key`, `value` FROM settings');

        // Default settings
        const settings: Record<string, any> = {
            mb_auto_deposit: true,
            viettel_token: '',
            viettel_account: '',
            min_deposit: 50000,
            exchange_rate: 26000, // USDT -> VND exchange rate
            telegram_bot_token: '',
            shop_name: 'SHOP',
            usdt_trc20_wallet: '',
            telegram_group_link: '',
            // Gmail EDU defaults
            gmail_edu_enabled: true,
            gmail_edu_price: 10000,
            gmail_edu_domain: 'suafpoly.app',
            gmail_edu_delete_hours: 1,
            // Admin IDs
            admin_ids: [],
            // Admin login accounts
            admin_fullname: '',
            admin_username: '',
            admin_password: '',
            admin_fullname2: '',
            admin_username2: '',
            admin_password2: '',
        };

        rows.forEach((row) => {
            // Handle booleans
            if (['mb_auto_deposit', 'gmail_edu_enabled'].includes(row.key)) {
                settings[row.key] = row.value === 'true';
            } else if (['min_deposit', 'exchange_rate', 'gmail_edu_price', 'gmail_edu_delete_hours'].includes(row.key)) {
                settings[row.key] = Number(row.value) || settings[row.key];
            } else if (row.key === 'admin_ids') {
                // Parse admin_ids as JSON array
                try {
                    settings[row.key] = JSON.parse(row.value) || [];
                } catch {
                    settings[row.key] = [];
                }
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

        // Check admin role from cookie - only super_admin can modify admin accounts
        const cookieHeader = request.headers.get('cookie') || '';
        const adminRoleMatch = cookieHeader.match(/admin_role=([^;]+)/);
        const adminRole = adminRoleMatch ? adminRoleMatch[1] : 'admin';

        // If not super_admin, remove admin account fields from body
        if (adminRole !== 'super_admin') {
            delete body.admin_fullname;
            delete body.admin_username;
            delete body.admin_password;
            delete body.admin_fullname2;
            delete body.admin_username2;
            delete body.admin_password2;
        }

        const {
            mb_auto_deposit,
            viettel_token,
            viettel_account,
            min_deposit,
            exchange_rate, // Exchange rate USDT -> VND
            telegram_bot_token,
            shop_name,
            usdt_trc20_wallet,
            telegram_group_link,
            // Gmail EDU
            gmail_edu_enabled,
            gmail_edu_price,
            gmail_edu_domain,
            gmail_edu_delete_hours,
            // Admin IDs
            admin_ids,
            // Admin login accounts
            admin_fullname,
            admin_username,
            admin_password,
            admin_fullname2,
            admin_username2,
            admin_password2
        } = body;

        const connection = await pool.getConnection();
        let shouldRestart = false;
        const { ipAddress, userAgent } = getRequestInfo(request);

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
            if (viettel_account !== undefined) await upsertSetting('viettel_account', viettel_account);
            if (min_deposit !== undefined) await upsertSetting('min_deposit', min_deposit);
            if (exchange_rate !== undefined) await upsertSetting('exchange_rate', exchange_rate);
            if (telegram_bot_token !== undefined) {
                await upsertSetting('telegram_bot_token', telegram_bot_token);
                shouldRestart = true;
            }
            if (shop_name !== undefined) await upsertSetting('shop_name', shop_name);
            if (usdt_trc20_wallet !== undefined) await upsertSetting('usdt_trc20_wallet', usdt_trc20_wallet);
            if (telegram_group_link !== undefined) await upsertSetting('telegram_group_link', telegram_group_link);
            // Gmail EDU settings
            if (gmail_edu_enabled !== undefined) await upsertSetting('gmail_edu_enabled', gmail_edu_enabled);
            if (gmail_edu_price !== undefined) await upsertSetting('gmail_edu_price', gmail_edu_price);
            if (gmail_edu_domain !== undefined) await upsertSetting('gmail_edu_domain', gmail_edu_domain);
            if (gmail_edu_delete_hours !== undefined) await upsertSetting('gmail_edu_delete_hours', gmail_edu_delete_hours);
            // Admin IDs - save as JSON string
            if (admin_ids !== undefined) await upsertSetting('admin_ids', JSON.stringify(admin_ids));
            // Admin login accounts
            if (admin_fullname !== undefined) await upsertSetting('admin_fullname', admin_fullname);
            if (admin_username !== undefined) await upsertSetting('admin_username', admin_username);
            if (admin_password !== undefined) await upsertSetting('admin_password', admin_password);
            if (admin_fullname2 !== undefined) await upsertSetting('admin_fullname2', admin_fullname2);
            if (admin_username2 !== undefined) await upsertSetting('admin_username2', admin_username2);
            if (admin_password2 !== undefined) await upsertSetting('admin_password2', admin_password2);

            await connection.commit();

            if (shouldRestart) {
                restartCoba();
            }

            // Log admin action
            const adminName = await getAdminFromCookie(request);
            await logAdminAction({
                adminName: adminName || 'System',
                action: 'UPDATE',
                targetType: 'SETTING',
                details: Object.keys(body).filter(k => body[k] !== undefined),
                ipAddress,
                userAgent,
                request
            });

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
