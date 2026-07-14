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

// POST: Sync transactions từ Viettel & VCB API vào database
export async function POST(request: Request) {
    try {
        // Log start of sync
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'UPDATE',
            targetType: 'SYSTEM',
            details: 'Started bank transactions sync (8 banks combined)',
            request
        });

        // Get tokens from settings
        const tokenKeys = [
            'viettel_token', 'vcb_token', 'tpb_token', 'mb_token',
            'acb_token', 'tcb_token', 'vp_token', 'timo_token'
        ];
        const [tokenRows] = await pool.query<RowDataPacket[]>(
            `SELECT \`key\`, \`value\` FROM settings WHERE \`key\` IN (${tokenKeys.map(k => `'${k}'`).join(',')})`
        );

        const tokens: Record<string, string> = {};
        if (Array.isArray(tokenRows)) {
            tokenRows.forEach((r) => {
                tokens[r.key] = r.value || '';
            });
        }

        const txsToSync: any[] = [];
        const fetchPromises: Promise<any>[] = [];

        // 1. Fetch Viettel transactions
        if (tokens.viettel_token) {
            fetchPromises.push(
                fetch(`https://api.sieuthicode.net/historyapiviettel/${tokens.viettel_token}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.status?.code === '00') {
                            const rawTransactions = data.data?.content || data.data?.trans || [];
                            rawTransactions.forEach((rawTx: any) => {
                                const rawAmt = rawTx.amount || rawTx.transAmount || '0';
                                const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/\./g, '')) || 0;
                                txsToSync.push({
                                    bankTransId: rawTx.bankTransId || rawTx.id || rawTx.transactionId || rawTx.requestId || '',
                                    amount: parsedAmount,
                                    transDate: rawTx.transDate || rawTx.requestDate || '',
                                    paymentType: rawTx.paymentType || (rawTx.spendMoneyTransaction === true ? 'DEBIT' : 'CREDIT'),
                                    msgContent: rawTx.msgContent || rawTx.transDesc || rawTx.description || '',
                                    balance: rawTx.balance ? parseFloat(rawTx.balance.toString()) : null,
                                    accountId: rawTx.accountId || null,
                                    clientId: rawTx.clientId || null,
                                    bank: 'VIETTEL'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching Viettel for sync:', err.message))
            );
        }

        // 2. Fetch VCB transactions
        if (tokens.vcb_token) {
            fetchPromises.push(
                fetch(`https://api.sieuthicode.net/historyapivcb/${tokens.vcb_token}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && (data.code === '00' || data.status?.code === '00')) {
                            const rawTransactions = data.transactions || [];
                            rawTransactions.forEach((rawTx: any) => {
                                const rawAmt = rawTx.Amount || '0';
                                const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
                                txsToSync.push({
                                    bankTransId: rawTx.Reference || rawTx.SeqNo || '',
                                    amount: parsedAmount,
                                    transDate: rawTx.tranDate || rawTx.TransactionDate || '',
                                    paymentType: (rawTx.CD === '+' || rawTx.DorCCode === 'C') ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.Description || rawTx.Remark || '',
                                    balance: rawTx.balance ? parseFloat(rawTx.balance.toString()) : null,
                                    accountId: null,
                                    clientId: null,
                                    bank: 'VCB'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching VCB for sync:', err.message))
            );
        }

        // 3. Fetch TPB transactions
        if (tokens.tpb_token) {
            fetchPromises.push(
                fetch(`https://api.sieuthicode.net/historyapitpbank/${tokens.tpb_token}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.transactionInfos) {
                            const rawTransactions = data.transactionInfos || [];
                            rawTransactions.forEach((rawTx: any) => {
                                const rawAmt = rawTx.amount || '0';
                                const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
                                txsToSync.push({
                                    bankTransId: rawTx.id || '',
                                    amount: parsedAmount,
                                    transDate: rawTx.bookingDate || '',
                                    paymentType: rawTx.creditDebitIndicator === 'CRDT' ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || '',
                                    balance: rawTx.runningBalance ? parseFloat(rawTx.runningBalance.toString()) : null,
                                    accountId: null,
                                    clientId: null,
                                    bank: 'TPB'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching TPB for sync:', err.message))
            );
        }

        // 4. Fetch MB transactions
        if (tokens.mb_token) {
            fetchPromises.push(
                fetch(`https://api.sieuthicode.net/historyapimb/${tokens.mb_token}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.status === 'success' && data.TranList) {
                            const rawTransactions = data.TranList || [];
                            rawTransactions.forEach((rawTx: any) => {
                                const rawAmt = rawTx.creditAmount || '0';
                                const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
                                txsToSync.push({
                                    bankTransId: rawTx.tranId || rawTx.refNo || '',
                                    amount: parsedAmount,
                                    transDate: rawTx.postingDate || rawTx.transactionDate || '',
                                    paymentType: parsedAmount > 0 ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || rawTx.addDescription || '',
                                    balance: rawTx.availableBalance ? parseFloat(rawTx.availableBalance.toString()) : null,
                                    accountId: null,
                                    clientId: null,
                                    bank: 'MB'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching MB for sync:', err.message))
            );
        }

        // 5. Fetch ACB transactions
        if (tokens.acb_token) {
            fetchPromises.push(
                fetch(`https://api.sieuthicode.net/historyapiacb/${tokens.acb_token}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.data) {
                            const rawTransactions = data.data || [];
                            rawTransactions.forEach((rawTx: any) => {
                                const rawAmt = rawTx.amount || 0;
                                const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
                                txsToSync.push({
                                    bankTransId: rawTx.transactionNumber ? rawTx.transactionNumber.toString() : '',
                                    amount: parsedAmount,
                                    transDate: rawTx.postingDate ? new Date(rawTx.postingDate).toISOString().slice(0, 19).replace('T', ' ') : '',
                                    paymentType: rawTx.type === 'IN' ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || '',
                                    balance: null,
                                    accountId: null,
                                    clientId: null,
                                    bank: 'ACB'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching ACB for sync:', err.message))
            );
        }

        // 6. Fetch TCB transactions
        if (tokens.tcb_token) {
            fetchPromises.push(
                fetch(`https://api.sieuthicode.net/historyapitcb/${tokens.tcb_token}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.status === 'success' && data.transactions) {
                            const rawTransactions = data.transactions || [];
                            rawTransactions.forEach((rawTx: any) => {
                                const rawAmt = rawTx.amount || 0;
                                const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
                                txsToSync.push({
                                    bankTransId: rawTx.transactionID || '',
                                    amount: parsedAmount,
                                    transDate: rawTx.date || '',
                                    paymentType: parsedAmount >= 0 ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || '',
                                    balance: null,
                                    accountId: null,
                                    clientId: null,
                                    bank: 'TCB'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching TCB for sync:', err.message))
            );
        }

        // 7. Fetch VP transactions
        if (tokens.vp_token) {
            fetchPromises.push(
                fetch(`https://api.sieuthicode.net/historyapivpbank/${tokens.vp_token}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.status === 'success' && data.data) {
                            const rawTransactions = data.data || [];
                            rawTransactions.forEach((rawTx: any) => {
                                const rawAmt = rawTx.amount || 0;
                                const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
                                txsToSync.push({
                                    bankTransId: rawTx.transId || '',
                                    amount: parsedAmount,
                                    transDate: rawTx.date || '',
                                    paymentType: parsedAmount >= 0 ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || '',
                                    balance: null,
                                    accountId: null,
                                    clientId: null,
                                    bank: 'VP'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching VP for sync:', err.message))
            );
        }

        // 8. Fetch Timo transactions
        if (tokens.timo_token) {
            fetchPromises.push(
                fetch(`https://api.sieuthicode.net/historyapitimo/${tokens.timo_token}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.status === 'success' && data.data) {
                            const rawTransactions = data.data || [];
                            rawTransactions.forEach((rawTx: any) => {
                                const rawAmt = rawTx.amount || 0;
                                const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/,/g, '')) || 0;
                                txsToSync.push({
                                    bankTransId: rawTx.transId || '',
                                    amount: parsedAmount,
                                    transDate: rawTx.date || '',
                                    paymentType: parsedAmount >= 0 ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || '',
                                    balance: null,
                                    accountId: null,
                                    clientId: null,
                                    bank: 'TIMO'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching Timo for sync:', err.message))
            );
        }

        await Promise.all(fetchPromises);

        if (txsToSync.length === 0) {
            return NextResponse.json({ message: 'No transactions to sync', synced: 0 });
        }

        let syncedCount = 0;
        let skippedCount = 0;

        for (const tx of txsToSync) {
            try {
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
                    (bank_trans_id, trans_date, amount, balance, payment_type, msg_content, bank, account_id, client_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        tx.bankTransId,
                        mysqlDate,
                        tx.amount,
                        tx.balance,
                        tx.paymentType || 'CREDIT',
                        tx.msgContent || null,
                        tx.bank,
                        tx.accountId,
                        tx.clientId
                    ]
                );

                if (result.affectedRows > 0) {
                    syncedCount++;
                } else {
                    skippedCount++;
                }
            } catch (err) {
                console.error('Error inserting transaction:', tx.bankTransId, err);
                skippedCount++;
            }
        }

        return NextResponse.json({
            message: 'Sync completed',
            synced: syncedCount,
            skipped: skippedCount,
            total: txsToSync.length
        });
    } catch (error) {
        console.error('Bank Transactions POST Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

