import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import crypto from 'crypto';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';

// Decode base32 to Buffer
function base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    const cleaned = encoded.replace(/[\s=-]+/g, '').toUpperCase();

    for (const char of cleaned) {
        const val = alphabet.indexOf(char);
        if (val === -1) {
            throw new Error(`Invalid base32 char: ${char}`);
        }
        bits += val.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }

    return Buffer.from(bytes);
}

// Generate TOTP token
function generateTOTP(secret: string, period: number = 30, digits: number = 6): string {
    const key = base32Decode(secret);
    const time = Math.floor(Date.now() / 1000 / period);

    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(0, 0);
    timeBuffer.writeUInt32BE(time, 4);

    const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();

    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    ) % Math.pow(10, digits);

    return code.toString().padStart(digits, '0');
}

/**
 * POST /api/chatgpt-accounts/check
 * Kiểm tra tài khoản ChatGPT (đơn lẻ hoặc SLL)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ids, check_all_uncheck = false } = body;

        let targetIds: number[] = [];

        if (check_all_uncheck) {
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT id FROM chatgpt_accounts WHERE status = 'uncheck'"
            );
            targetIds = rows.map(r => r.id);
        } else if (ids && Array.isArray(ids) && ids.length > 0) {
            targetIds = ids.map(Number);
        } else if (id) {
            targetIds = [Number(id)];
        }

        if (targetIds.length === 0) {
            return NextResponse.json({ success: false, error: 'Không có tài khoản nào để kiểm tra' }, { status: 400 });
        }

        // Fetch target accounts
        const placeholders = targetIds.map(() => '?').join(',');
        const [accounts] = await pool.query<RowDataPacket[]>(
            `SELECT id, email, password, twofa_secret, is_plus, status FROM chatgpt_accounts WHERE id IN (${placeholders})`,
            targetIds
        );

        const results: Array<{
            id: number;
            email: string;
            status: 'live' | 'die' | 'wrong_pass' | 'twofa_error';
            message: string;
            token?: string;
        }> = [];

        for (const account of accounts) {
            let status: 'live' | 'die' | 'wrong_pass' | 'twofa_error' = 'live';
            let message = 'Tài khoản hoạt động tốt';
            let token: string | undefined;

            // 1. Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(account.email)) {
                status = 'die';
                message = 'Định dạng email không hợp lệ';
            }
            // 2. Validate password
            else if (!account.password || account.password.trim().length < 4) {
                status = 'wrong_pass';
                message = 'Mật khẩu không hợp lệ';
            }
            // 3. Validate 2FA secret if present
            else if (account.twofa_secret && account.twofa_secret.trim()) {
                try {
                    token = generateTOTP(account.twofa_secret.trim());
                    status = 'live';
                    message = '2FA hợp lệ (Mã: ' + token + ')';
                } catch (e: any) {
                    status = 'twofa_error';
                    message = 'Mã 2FA Secret không hợp lệ: ' + e.message;
                }
            } else {
                status = 'live';
                message = 'Tài khoản hợp lệ (không có 2FA)';
            }

            // Update database status
            await pool.query(
                'UPDATE chatgpt_accounts SET status = ?, last_checked_at = NOW() WHERE id = ?',
                [status, account.id]
            );

            results.push({
                id: account.id,
                email: account.email,
                status,
                message,
                token
            });
        }

        const summary = {
            total: results.length,
            live: results.filter(r => r.status === 'live').length,
            die: results.filter(r => r.status === 'die').length,
            wrong_pass: results.filter(r => r.status === 'wrong_pass').length,
            twofa_error: results.filter(r => r.status === 'twofa_error').length,
        };

        // Admin log
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'CHATGPT_ACCOUNT',
            details: { action: 'CHECK_ACCOUNTS', summary },
            request
        });

        return NextResponse.json({
            success: true,
            results,
            summary
        });
    } catch (error: any) {
        console.error('[ChatGPT Accounts Check API] POST error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
    }
}
