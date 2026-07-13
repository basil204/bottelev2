import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';


interface Transaction {
    msisdn?: string;
    clientCode?: string;
    clientId?: string;
    msgContent?: string;
    transDate: string;
    accountId?: string;
    amount: string;
    balance?: string;
    bankTransId: string;
    description: string;
    paymentType?: 'CREDIT' | 'DEBIT';
}

// GET: Lấy lịch sử đã lưu trong database
export async function GET(request: Request) {
    try {
        // Log action
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'SYSTEM',
            details: 'Viewed bank transactions history',
            request
        });

        const { searchParams } = new URL(request.url);

        const date = searchParams.get('date'); // Format: YYYY-MM-DD
        const month = searchParams.get('month'); // Format: YYYY-MM
        const type = searchParams.get('type'); // CREDIT or DEBIT
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = (page - 1) * limit;

        let whereClause = '1=1';
        const params: any[] = [];

        if (date) {
            whereClause += ' AND DATE(trans_date) = ?';
            params.push(date);
        }

        if (month) {
            whereClause += ' AND DATE_FORMAT(trans_date, "%Y-%m") = ?';
            params.push(month);
        }

        if (type) {
            whereClause += ' AND payment_type = ?';
            params.push(type);
        }

        // Get transactions
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT * FROM bank_transactions WHERE ${whereClause} ORDER BY trans_date DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Get total count
        const [countResult] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total FROM bank_transactions WHERE ${whereClause}`,
            params
        );
        const total = countResult[0]?.total || 0;

        // Get daily summary
        const [dailySummary] = await pool.query<RowDataPacket[]>(
            `SELECT 
                DATE(trans_date) as date,
                SUM(CASE WHEN payment_type = 'CREDIT' THEN amount ELSE 0 END) as total_credit,
                SUM(CASE WHEN payment_type = 'DEBIT' THEN amount ELSE 0 END) as total_debit,
                COUNT(*) as count
            FROM bank_transactions 
            WHERE ${whereClause}
            GROUP BY DATE(trans_date)
            ORDER BY date DESC`,
            params
        );

        // Get monthly summary
        const [monthlySummary] = await pool.query<RowDataPacket[]>(
            `SELECT 
                DATE_FORMAT(trans_date, '%Y-%m') as month,
                SUM(CASE WHEN payment_type = 'CREDIT' THEN amount ELSE 0 END) as total_credit,
                SUM(CASE WHEN payment_type = 'DEBIT' THEN amount ELSE 0 END) as total_debit,
                COUNT(*) as count
            FROM bank_transactions 
            GROUP BY DATE_FORMAT(trans_date, '%Y-%m')
            ORDER BY month DESC`
        );

        return NextResponse.json({
            transactions: rows,
            total,
            page,
            limit,
            dailySummary,
            monthlySummary
        });
    } catch (error) {
        console.error('Bank Transactions GET Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Sync transactions từ Viettel API vào database
export async function POST(request: Request) {
    try {
        // Log start of sync
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'SYSTEM',
            details: 'Started bank transactions sync',
            request
        });

        // Get Viettel token from settings

        const [tokenRows] = await pool.query<RowDataPacket[]>(
            "SELECT `value` FROM settings WHERE `key` = 'viettel_token'"
        );

        if (!tokenRows || tokenRows.length === 0 || !tokenRows[0].value) {
            return NextResponse.json({ error: 'Viettel token not configured' }, { status: 400 });
        }

        const token = tokenRows[0].value;

        // Call Viettel API
        const response = await fetch(`https://api.sieuthicode.net/historyapiviettel/${token}`);
        const data = await response.json();

        if (!data || data.status?.code !== '00') {
            return NextResponse.json({ error: data?.status?.message || 'API Error' }, { status: 500 });
        }

        const rawTransactions = data.data?.content || data.data?.trans || [];

        if (rawTransactions.length === 0) {
            return NextResponse.json({ message: 'No transactions to sync', synced: 0 });
        }

        let syncedCount = 0;
        let skippedCount = 0;

        for (const rawTx of rawTransactions) {
            try {
                // Parse amount handling dot separator
                const rawAmt = rawTx.amount || rawTx.transAmount || '0';
                const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/\./g, '')) || 0;

                const tx = {
                    bankTransId: rawTx.bankTransId || rawTx.id || rawTx.transactionId || rawTx.requestId || '',
                    amount: parsedAmount.toString(),
                    description: rawTx.msgContent || rawTx.description || rawTx.transDesc || '',
                    transDate: rawTx.transDate || rawTx.requestDate || '',
                    paymentType: rawTx.paymentType || (rawTx.spendMoneyTransaction === true ? 'DEBIT' : 'CREDIT'),
                    balance: rawTx.balance ? rawTx.balance.toString() : null,
                    accountId: rawTx.accountId || null,
                    clientId: rawTx.clientId || null,
                    msgContent: rawTx.msgContent || rawTx.transDesc || ''
                };

                // Parse date - handle multiple formats
                let mysqlDate = tx.transDate;

                // Check if date contains "/" separator (DD/MM/YYYY format)
                if (tx.transDate.includes('/')) {
                    const parts = tx.transDate.split(' ');
                    const datePart = parts[0];
                    const timePart = parts[1] || '00:00:00';
                    const dateParts = datePart.split('/');
                    if (dateParts.length === 3) {
                        const [day, month, year] = dateParts;
                        mysqlDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`;
                    }
                }
                // Check if date contains "-" separator (could be DD-MM-YYYY or YYYY-MM-DD)
                else if (tx.transDate.includes('-')) {
                    const parts = tx.transDate.split(' ');
                    const datePart = parts[0];
                    const timePart = parts[1] || '00:00:00';
                    const dateParts = datePart.split('-');
                    if (dateParts.length === 3) {
                        // If first part is 4 digits, it's YYYY-MM-DD format (already MySQL format)
                        if (dateParts[0].length === 4) {
                            mysqlDate = `${datePart} ${timePart}`;
                        } else {
                            // DD-MM-YYYY format
                            const [day, month, year] = dateParts;
                            mysqlDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`;
                        }
                    }
                }

                // Try to insert, skip if duplicate
                const [result] = await pool.query<ResultSetHeader>(
                    `INSERT IGNORE INTO bank_transactions 
                    (bank_trans_id, trans_date, amount, balance, payment_type, msg_content, account_id, client_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        tx.bankTransId,
                        mysqlDate,
                        parseFloat(tx.amount),
                        tx.balance !== undefined && tx.balance !== null ? parseFloat(tx.balance) : null,
                        tx.paymentType || 'CREDIT',
                        tx.msgContent || tx.description || null,
                        tx.accountId || null,
                        tx.clientId || null
                    ]
                );

                if (result.affectedRows > 0) {
                    syncedCount++;
                } else {
                    skippedCount++;
                }
            } catch (err) {
                console.error('Error inserting transaction:', rawTx.bankTransId || rawTx.id || rawTx.transactionId || rawTx.requestId, err);
                skippedCount++;
            }
        }

        return NextResponse.json({
            message: 'Sync completed',
            synced: syncedCount,
            skipped: skippedCount,
            total: rawTransactions.length
        });
    } catch (error) {
        console.error('Bank Transactions POST Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

