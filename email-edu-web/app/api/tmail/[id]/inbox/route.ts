import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getTMailMailboxes, getTMailMessages, getTMailMessageDetail } from '@/lib/tmail';

// GET - Lấy inbox messages
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const messageId = searchParams.get('messageId');

        // Check ownership or admin
        let checkSql = 'SELECT account_id, email FROM tmail_accounts WHERE id = ?';
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
        const email = rows[0].email;

        if (!accountId) {
            return NextResponse.json(
                { success: false, error: 'Invalid account' },
                { status: 400 }
            );
        }

        // Lấy mailboxes
        const mailboxResult = await getTMailMailboxes(accountId);
        if (!mailboxResult.success || !mailboxResult.data?.length) {
            return NextResponse.json({
                success: true,
                email,
                mailboxes: [],
                messages: []
            });
        }

        // Lấy INBOX mailbox (thường là cái đầu tiên hoặc có tên "INBOX")
        const inbox = mailboxResult.data.find(m => m.name === 'INBOX') || mailboxResult.data[0];

        // Nếu có messageId, lấy chi tiết message
        if (messageId) {
            const messageDetail = await getTMailMessageDetail(accountId, inbox.id, messageId);
            return NextResponse.json({
                success: messageDetail.success,
                email,
                message: messageDetail.data,
                error: messageDetail.error
            });
        }

        // Lấy messages từ inbox
        const messagesResult = await getTMailMessages(accountId, inbox.id, 1, 50);

        return NextResponse.json({
            success: true,
            email,
            mailbox: inbox,
            messages: messagesResult.data || [],
            total: messagesResult.total || 0
        });
    } catch (error) {
        console.error('Error fetching tmail inbox:', error);
        return NextResponse.json(
            { success: false, error: 'Lỗi server' },
            { status: 500 }
        );
    }
}
