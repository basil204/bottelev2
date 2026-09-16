import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT `key`, `value` FROM settings');

        // Default settings
        const settings: Record<string, any> = {
            mb_auto_deposit: true,
            viettel_token: '',
            viettel_account: '',
            vcb_token: '',
            vcb_account: '',
            tpb_token: '',
            tpb_account: '',
            mb_token: '',
            mb_account: '',
            acb_token: '',
            acb_account: '',
            tcb_token: '',
            tcb_account: '',
            vp_token: '',
            vp_account: '',
            timo_token: '',
            timo_account: '',
            vietqr_bank_code: 'VCB',
            vietqr_account_no: '',
            vietqr_account_name: '',
            active_bank: 'viettel',
            min_deposit: 50000,
            exchange_rate: 26000, // USDT -> VND exchange rate
            telegram_bot_token: '',
            bot_username: '',
            shop_name: 'SHOP',
            usdt_trc20_wallet: '',
            telegram_group_link: '',
            // Binance Pay settings
            binance_api_key: '',
            binance_secret_key: '',
            binance_pay_id: '',
            binance_auto_deposit: false,
            binance_min_deposit: 1,
            // Admin IDs
            admin_ids: [],
            // Admin login accounts
            admin_fullname: '',
            admin_username: '',
            admin_password: '',
            admin_fullname2: '',
            admin_username2: '',
            admin_password2: '',
            gmail_checker_api_keys: [],
            deposit_rank_promotions: [],
        };

        rows.forEach((row) => {
            // Handle booleans
            if (['mb_auto_deposit', 'binance_auto_deposit'].includes(row.key)) {
                settings[row.key] = row.value !== 'false' && row.value !== false && row.value !== '0';
            } else if (['min_deposit', 'exchange_rate', 'binance_min_deposit'].includes(row.key)) {
                settings[row.key] = Number(row.value) || settings[row.key];
            } else if (['admin_ids', 'gmail_checker_api_keys', 'deposit_rank_promotions'].includes(row.key)) {
                // Parse JSON array settings
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
            vcb_token,
            vcb_account,
            tpb_token,
            tpb_account,
            mb_token,
            mb_account,
            acb_token,
            acb_account,
            tcb_token,
            tcb_account,
            vp_token,
            vp_account,
            timo_token,
            timo_account,
            vietqr_bank_code,
            vietqr_account_no,
            vietqr_account_name,
            active_bank,
            min_deposit,
            exchange_rate, // Exchange rate USDT -> VND
            telegram_bot_token,
            bot_username,
            shop_name,
            usdt_trc20_wallet,
            telegram_group_link,
            // Binance Pay settings
            binance_api_key,
            binance_secret_key,
            binance_pay_id,
            binance_auto_deposit,
            binance_min_deposit,
            // Admin IDs
            admin_ids,
            // Admin login accounts
            admin_fullname,
            admin_username,
            admin_password,
            admin_fullname2,
            admin_username2,
            admin_password2,
            gmail_checker_api_keys,
            deposit_rank_promotions
        } = body;

        const connection = await pool.getConnection();
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
            if (vcb_token !== undefined) await upsertSetting('vcb_token', vcb_token);
            if (vcb_account !== undefined) await upsertSetting('vcb_account', vcb_account);
            if (tpb_token !== undefined) await upsertSetting('tpb_token', tpb_token);
            if (tpb_account !== undefined) await upsertSetting('tpb_account', tpb_account);
            if (mb_token !== undefined) await upsertSetting('mb_token', mb_token);
            if (mb_account !== undefined) await upsertSetting('mb_account', mb_account);
            if (acb_token !== undefined) await upsertSetting('acb_token', acb_token);
            if (acb_account !== undefined) await upsertSetting('acb_account', acb_account);
            if (tcb_token !== undefined) await upsertSetting('tcb_token', tcb_token);
            if (tcb_account !== undefined) await upsertSetting('tcb_account', tcb_account);
            if (vp_token !== undefined) await upsertSetting('vp_token', vp_token);
            if (vp_account !== undefined) await upsertSetting('vp_account', vp_account);
            if (timo_token !== undefined) await upsertSetting('timo_token', timo_token);
            if (timo_account !== undefined) await upsertSetting('timo_account', timo_account);
            if (vietqr_bank_code !== undefined) await upsertSetting('vietqr_bank_code', vietqr_bank_code);
            if (vietqr_account_no !== undefined) await upsertSetting('vietqr_account_no', vietqr_account_no);
            if (vietqr_account_name !== undefined) await upsertSetting('vietqr_account_name', vietqr_account_name);
            if (active_bank !== undefined) await upsertSetting('active_bank', active_bank);
            if (min_deposit !== undefined) await upsertSetting('min_deposit', min_deposit);
            if (exchange_rate !== undefined) await upsertSetting('exchange_rate', exchange_rate);
            if (telegram_bot_token !== undefined) await upsertSetting('telegram_bot_token', telegram_bot_token);
            if (bot_username !== undefined) await upsertSetting('bot_username', bot_username);
            if (shop_name !== undefined) await upsertSetting('shop_name', shop_name);
            if (usdt_trc20_wallet !== undefined) await upsertSetting('usdt_trc20_wallet', usdt_trc20_wallet);
            if (telegram_group_link !== undefined) await upsertSetting('telegram_group_link', telegram_group_link);
            // Binance Pay settings
            if (binance_api_key !== undefined) await upsertSetting('binance_api_key', binance_api_key);
            if (binance_secret_key !== undefined) await upsertSetting('binance_secret_key', binance_secret_key);
            if (binance_pay_id !== undefined) await upsertSetting('binance_pay_id', binance_pay_id);
            if (binance_auto_deposit !== undefined) await upsertSetting('binance_auto_deposit', binance_auto_deposit ? 'true' : 'false');
            if (binance_min_deposit !== undefined) await upsertSetting('binance_min_deposit', binance_min_deposit);
            // Admin IDs - save as JSON string
            if (admin_ids !== undefined) await upsertSetting('admin_ids', JSON.stringify(admin_ids));
            // Admin login accounts
            if (admin_fullname !== undefined) await upsertSetting('admin_fullname', admin_fullname);
            if (admin_username !== undefined) await upsertSetting('admin_username', admin_username);
            if (admin_password !== undefined) await upsertSetting('admin_password', admin_password);
            if (admin_fullname2 !== undefined) await upsertSetting('admin_fullname2', admin_fullname2);
            if (admin_username2 !== undefined) await upsertSetting('admin_username2', admin_username2);
            if (admin_password2 !== undefined) await upsertSetting('admin_password2', admin_password2);
            if (gmail_checker_api_keys !== undefined) await upsertSetting('gmail_checker_api_keys', JSON.stringify(gmail_checker_api_keys));
            if (deposit_rank_promotions !== undefined) await upsertSetting('deposit_rank_promotions', JSON.stringify(deposit_rank_promotions));

            await connection.commit();

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
