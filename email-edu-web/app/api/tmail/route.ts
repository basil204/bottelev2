import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
    createTMailAccount,
    getTMailAccount,
    getTMailMailboxes,
    getTMailMessages,
    deleteTMailAccount
} from '@/lib/tmail';
import { generateRandomUsername, generateRandomPassword } from '@/lib/utils';

// GET - Lấy danh sách tMail của user
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const userRole = cookieStore.get('user_role')?.value;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        let sql = `SELECT * FROM tmail_accounts`;
        const params: any[] = [];

        // If not admin, only show their own tmails
        if (userRole !== 'admin') {
            sql += ' WHERE user_id = ?';
            params.push(parseInt(userId));
        }

        // Order by newest first, limit to 10
        sql += ' ORDER BY created_at DESC LIMIT 10';

        const [rows] = await pool.query<RowDataPacket[]>(sql, params);

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching tmails:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// POST - Tạo tMail mới
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        let { username, domain_id, full_email } = body;

        let domain: string;
        let address: string;
        let password: string;
        let accountId: string | undefined;

        // Case 1: User pasted a full email address
        if (full_email && full_email.includes('@')) {
            const [emailUsername, emailDomain] = full_email.split('@');

            if (!emailUsername || !emailDomain) {
                return NextResponse.json(
                    { success: false, error: 'Email không hợp lệ' },
                    { status: 400 }
                );
            }

            // Check if domain exists and is active
            const [domainRows] = await pool.query<RowDataPacket[]>(
                'SELECT id, domain FROM tmail_domains WHERE domain = ? AND is_active = 1',
                [emailDomain]
            );

            if (domainRows.length === 0) {
                return NextResponse.json(
                    { success: false, error: `Domain "${emailDomain}" không tồn tại hoặc không active` },
                    { status: 400 }
                );
            }

            domain = emailDomain;
            username = emailUsername;
            address = full_email;
            password = 'Abc@123456'; // Default password

            // Check if this email already exists in our database
            const [existingEmail] = await pool.query<RowDataPacket[]>(
                'SELECT id, email, password, account_id FROM tmail_accounts WHERE email = ? AND user_id = ?',
                [address, parseInt(userId)]
            );

            if (existingEmail.length > 0) {
                // Email already exists for this user, return the existing one
                return NextResponse.json({
                    success: true,
                    data: existingEmail[0],
                    message: 'Email đã tồn tại, trả về thông tin đã lưu'
                });
            }

            // Email not in our DB - check if exists on smtp.dev
            const existingAccount = await getTMailAccount(address);

            if (existingAccount.success && existingAccount.data) {
                // Account exists on smtp.dev, just save to our DB
                accountId = existingAccount.data.id;

                // Save to database
                const [insertResult] = await pool.query<ResultSetHeader>(
                    `INSERT INTO tmail_accounts (user_id, email, password, account_id, domain) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [parseInt(userId), address, password, accountId, domain]
                );

                return NextResponse.json({
                    success: true,
                    data: {
                        id: insertResult.insertId,
                        email: address,
                        password: password,
                        account_id: accountId,
                        domain: domain
                    },
                    message: 'Đã thêm email từ smtp.dev vào danh sách'
                });
            }

            // Account doesn't exist on smtp.dev, will create below

        } else {
            // Case 2: Normal flow - username + domain_id

            // Lấy domain từ database
            domain = 'fthcapital.com'; // default fallback

            if (domain_id) {
                const [domainRows] = await pool.query<RowDataPacket[]>(
                    'SELECT domain FROM tmail_domains WHERE id = ? AND is_active = 1',
                    [domain_id]
                );

                if (domainRows.length === 0) {
                    return NextResponse.json(
                        { success: false, error: 'Domain không hợp lệ hoặc không active' },
                        { status: 400 }
                    );
                }

                domain = domainRows[0].domain;
            } else {
                // Lấy domain đầu tiên active làm mặc định
                const [defaultDomain] = await pool.query<RowDataPacket[]>(
                    'SELECT domain FROM tmail_domains WHERE is_active = 1 ORDER BY id ASC LIMIT 1'
                );

                if (defaultDomain.length > 0) {
                    domain = defaultDomain[0].domain;
                }
            }

            // Generate random username if not provided
            if (!username) {
                username = generateRandomUsername(10);
            }

            // Default password
            password = 'Abc@123456';
            address = `${username}@${domain}`;
        }

        // Tạo tài khoản trên smtp.dev (only if not already fetched)
        const result = await createTMailAccount(address, password);

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error || 'Không thể tạo tMail' },
                { status: 400 }
            );
        }

        accountId = result.data?.id;

        // Lưu vào database
        const [insertResult] = await pool.query<ResultSetHeader>(
            `INSERT INTO tmail_accounts (user_id, email, password, account_id, domain) 
             VALUES (?, ?, ?, ?, ?)`,
            [parseInt(userId), address, password, accountId, domain]
        );

        return NextResponse.json({
            success: true,
            data: {
                id: insertResult.insertId,
                email: address,
                password: password,
                account_id: accountId,
                domain: domain
            }
        });
    } catch (error) {
        console.error('Error creating tmail:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// DELETE - Xóa tMail
export async function DELETE(request: Request) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const userRole = cookieStore.get('user_role')?.value;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await request.json();

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID là bắt buộc' },
                { status: 400 }
            );
        }

        // Check ownership or admin
        let checkSql = 'SELECT account_id FROM tmail_accounts WHERE id = ?';
        const checkParams: any[] = [id];

        if (userRole !== 'admin') {
            checkSql += ' AND user_id = ?';
            checkParams.push(parseInt(userId));
        }

        const [rows] = await pool.query<RowDataPacket[]>(checkSql, checkParams);

        if (rows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Không tìm thấy tMail hoặc không có quyền' },
                { status: 404 }
            );
        }

        const accountId = rows[0].account_id;

        // Xóa trên smtp.dev
        if (accountId) {
            await deleteTMailAccount(accountId);
        }

        // Xóa trong database
        await pool.query<ResultSetHeader>(
            'DELETE FROM tmail_accounts WHERE id = ?',
            [id]
        );

        return NextResponse.json({
            success: true,
            message: 'Đã xóa tMail'
        });
    } catch (error) {
        console.error('Error deleting tmail:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
