import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { generateRandomUsername, generateRandomPassword, getDeleteTime, getRandomVietnameseFullName } from '@/lib/utils';
import { createGoogleUser, deleteGoogleUser, checkEmailExists } from '@/lib/google-admin';

// GET - Lấy danh sách emails của user
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

        let sql = `
            SELECT e.*, d.domain as domain_name 
            FROM edu_emails e 
            JOIN edu_domains d ON e.domain_id = d.id
        `;
        const params: any[] = [];

        // If not admin, only show their own emails
        if (userRole !== 'admin') {
            sql += ' WHERE e.user_id = ?';
            params.push(parseInt(userId));
        }

        sql += ' ORDER BY e.id DESC';

        const [rows] = await pool.query<RowDataPacket[]>(sql, params);

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching emails:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// POST - Tạo email mới
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
        const { domain_id, username, quantity = 1, delete_hours = 24, twofa_secret } = body;

        if (!domain_id) {
            return NextResponse.json(
                { success: false, error: 'Domain là bắt buộc' },
                { status: 400 }
            );
        }

        // Check daily limit for permanent emails (delete_hours = 0)
        if (delete_hours === 0 || delete_hours === '0') {
            const DAILY_PERMANENT_LIMIT = 10;

            // Count permanent emails created by this user today
            const [todayCount] = await pool.query<RowDataPacket[]>(
                `SELECT COUNT(*) as count FROM edu_emails 
                 WHERE user_id = ? 
                 AND deleted_at IS NULL 
                 AND DATE(created_at) = CURDATE()`,
                [parseInt(userId)]
            );

            const createdToday = todayCount[0].count;
            const remainingToday = DAILY_PERMANENT_LIMIT - createdToday;

            if (quantity > remainingToday) {
                return NextResponse.json(
                    {
                        success: false,
                        error: remainingToday <= 0
                            ? `Bạn đã đạt giới hạn ${DAILY_PERMANENT_LIMIT} email vĩnh viễn/ngày. Thử lại vào ngày mai.`
                            : `Bạn chỉ còn ${remainingToday} email vĩnh viễn có thể tạo hôm nay (giới hạn ${DAILY_PERMANENT_LIMIT}/ngày)`
                    },
                    { status: 400 }
                );
            }
        }

        // Get domain
        const [domainRows] = await pool.query<RowDataPacket[]>(
            'SELECT domain FROM edu_domains WHERE id = ? AND is_active = 1',
            [domain_id]
        );

        if (domainRows.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Domain không tồn tại hoặc không active' },
                { status: 400 }
            );
        }

        const domain = domainRows[0].domain;
        const deleteAt = delete_hours > 0 ? getDeleteTime(delete_hours) : null;
        const createdEmails: { email: string; password: string; twofa_secret?: string }[] = [];
        const failedEmails: { email: string; error: string }[] = [];

        // Create emails
        for (let i = 0; i < quantity; i++) {
            const emailUsername = username && quantity === 1
                ? username
                : generateRandomUsername(8);
            const emailPassword = 'Abc@123456'; // Default password
            const email = `${emailUsername}@${domain}`;

            // Kiểm tra email đã tồn tại trên Google chưa
            const existsCheck = await checkEmailExists(email);
            if (existsCheck.exists) {
                failedEmails.push({ email, error: 'Email đã tồn tại trên Google Workspace' });
                continue;
            }

            // Tạo random tên Việt Nam
            const vietnameseName = getRandomVietnameseFullName();

            // Tạo user trên Google Workspace
            const googleResult = await createGoogleUser({
                email,
                password: emailPassword,
                firstName: vietnameseName.firstName,
                lastName: vietnameseName.lastName,
            });

            if (!googleResult.success) {
                failedEmails.push({ email, error: googleResult.error || 'Lỗi tạo email trên Google' });
                continue;
            }

            // Lưu vào database sau khi tạo thành công trên Google
            await pool.query<ResultSetHeader>(
                'INSERT INTO edu_emails (user_id, email, password, domain_id, delete_at) VALUES (?, ?, ?, ?, ?)',
                [parseInt(userId), email, emailPassword, domain_id, deleteAt]
            );

            createdEmails.push({ email, password: emailPassword });
        }

        return NextResponse.json({
            success: createdEmails.length > 0,
            emails: createdEmails,
            failed: failedEmails,
            message: `Đã tạo ${createdEmails.length}/${quantity} email thành công`
        });
    } catch (error) {
        console.error('Error creating email:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}

// DELETE - Xóa email (hỗ trợ xóa đơn lẻ hoặc nhiều)
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

        const body = await request.json();
        const { id, ids } = body;

        // Hỗ trợ cả xóa đơn lẻ (id) và xóa nhiều (ids)
        const idsToDelete: number[] = ids || (id ? [id] : []);

        if (idsToDelete.length === 0) {
            return NextResponse.json(
                { success: false, error: 'ID là bắt buộc' },
                { status: 400 }
            );
        }

        const results: { id: number; success: boolean; error?: string }[] = [];

        for (const emailId of idsToDelete) {
            try {
                // Check ownership or admin
                if (userRole !== 'admin') {
                    const [emailRows] = await pool.query<RowDataPacket[]>(
                        'SELECT id FROM edu_emails WHERE id = ? AND user_id = ?',
                        [emailId, parseInt(userId)]
                    );

                    if (emailRows.length === 0) {
                        results.push({ id: emailId, success: false, error: 'Không có quyền' });
                        continue;
                    }
                }

                // Lấy thông tin email trước khi xóa
                const [emailInfo] = await pool.query<RowDataPacket[]>(
                    'SELECT email FROM edu_emails WHERE id = ?',
                    [emailId]
                );

                if (emailInfo.length === 0) {
                    results.push({ id: emailId, success: false, error: 'Không tồn tại' });
                    continue;
                }

                const email = emailInfo[0].email;

                // Xóa user trên Google Workspace
                const googleResult = await deleteGoogleUser(email);
                if (!googleResult.success) {
                    // Nếu không tồn tại trên Google (đã bị xóa rồi), vẫn cho phép xóa trong DB
                    if (!googleResult.error?.includes('Resource Not Found') && !googleResult.error?.includes('notFound')) {
                        console.warn(`Warning: Không thể xóa ${email} trên Google: ${googleResult.error}`);
                    }
                }

                // Xóa hoàn toàn khỏi database
                await pool.query<ResultSetHeader>(
                    'DELETE FROM edu_emails WHERE id = ?',
                    [emailId]
                );

                results.push({ id: emailId, success: true });
            } catch (err) {
                results.push({ id: emailId, success: false, error: 'Lỗi xử lý' });
            }
        }

        const successCount = results.filter(r => r.success).length;

        return NextResponse.json({
            success: successCount > 0,
            results,
            message: `Đã xóa ${successCount}/${idsToDelete.length} email`
        });
    } catch (error) {
        console.error('Error deleting email:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
