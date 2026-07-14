import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';

const parseDateToMs = (dateStr: string) => {
    try {
        if (!dateStr) return 0;
        // If Unix milliseconds timestamp
        if (/^\d+$/.test(dateStr)) {
            return Number(dateStr);
        }
        // If DD/MM/YYYY format
        if (dateStr.includes('/')) {
            const [datePart, timePart] = dateStr.split(' ');
            const [day, month, year] = datePart.split('/');
            const time = timePart || '00:00:00';
            return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}`).getTime();
        }
        // Otherwise standard Date parsing
        return new Date(dateStr).getTime();
    } catch {
        return 0;
    }
};

export async function GET(request: Request) {
    try {
        const adminName = await getAdminFromCookie(request);
        await logAdminAction({
            adminName: adminName || 'System',
            action: 'VIEW',
            targetType: 'SYSTEM',
            details: 'Viewed bank history (8 banks combined)',
            request
        });

        // Get tokens from settings
        const tokenKeys = [
            'viettel_token', 'vcb_token', 'tpb_token', 'mb_token',
            'acb_token', 'tcb_token', 'vp_token', 'timo_token'
        ];
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT \`key\`, \`value\` FROM settings WHERE \`key\` IN (${tokenKeys.map(k => `'${k}'`).join(',')})`
        );

        const tokens: Record<string, string> = {};
        if (Array.isArray(rows)) {
            rows.forEach((r) => {
                tokens[r.key] = r.value || '';
            });
        }

        const unifiedTransactions: any[] = [];
        const fetchPromises: Promise<any>[] = [];

        // 1. Viettel Pay
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
                                unifiedTransactions.push({
                                    bankTransId: rawTx.bankTransId || rawTx.id || rawTx.transactionId || rawTx.requestId || '',
                                    amount: parsedAmount.toString(),
                                    transDate: rawTx.transDate || rawTx.requestDate || '',
                                    paymentType: rawTx.paymentType || (rawTx.spendMoneyTransaction === true ? 'DEBIT' : 'CREDIT'),
                                    msgContent: rawTx.msgContent || rawTx.transDesc || rawTx.description || '',
                                    balance: rawTx.balance ? rawTx.balance.toString() : null,
                                    bank: 'VIETTEL'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching Viettel History:', err.message))
            );
        }

        // 2. Vietcombank
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
                                unifiedTransactions.push({
                                    bankTransId: rawTx.Reference || rawTx.SeqNo || '',
                                    amount: parsedAmount.toString(),
                                    transDate: rawTx.tranDate || rawTx.TransactionDate || '',
                                    paymentType: (rawTx.CD === '+' || rawTx.DorCCode === 'C') ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.Description || rawTx.Remark || '',
                                    balance: rawTx.balance ? rawTx.balance.toString() : null,
                                    bank: 'VCB'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching VCB History:', err.message))
            );
        }

        // 3. TPBank
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
                                unifiedTransactions.push({
                                    bankTransId: rawTx.id || '',
                                    amount: parsedAmount.toString(),
                                    transDate: rawTx.bookingDate || '',
                                    paymentType: rawTx.creditDebitIndicator === 'CRDT' ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || '',
                                    balance: rawTx.runningBalance ? rawTx.runningBalance.toString() : null,
                                    bank: 'TPB'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching TPB History:', err.message))
            );
        }

        // 4. MBBank
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
                                unifiedTransactions.push({
                                    bankTransId: rawTx.tranId || rawTx.refNo || '',
                                    amount: parsedAmount.toString(),
                                    transDate: rawTx.postingDate || rawTx.transactionDate || '',
                                    paymentType: parsedAmount > 0 ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || rawTx.addDescription || '',
                                    balance: rawTx.availableBalance ? rawTx.availableBalance.toString() : null,
                                    bank: 'MB'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching MB History:', err.message))
            );
        }

        // 5. ACB
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
                                unifiedTransactions.push({
                                    bankTransId: rawTx.transactionNumber ? rawTx.transactionNumber.toString() : '',
                                    amount: parsedAmount.toString(),
                                    transDate: rawTx.postingDate ? new Date(rawTx.postingDate).toLocaleString('vi-VN') : '',
                                    paymentType: rawTx.type === 'IN' ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || '',
                                    balance: null,
                                    bank: 'ACB'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching ACB History:', err.message))
            );
        }

        // 6. Techcombank
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
                                unifiedTransactions.push({
                                    bankTransId: rawTx.transactionID || '',
                                    amount: parsedAmount.toString(),
                                    transDate: rawTx.date || '',
                                    paymentType: parsedAmount >= 0 ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || '',
                                    balance: null,
                                    bank: 'TCB'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching TCB History:', err.message))
            );
        }

        // 7. VPBank
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
                                unifiedTransactions.push({
                                    bankTransId: rawTx.transId || '',
                                    amount: parsedAmount.toString(),
                                    transDate: rawTx.date || '',
                                    paymentType: parsedAmount >= 0 ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || '',
                                    balance: null,
                                    bank: 'VP'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching VP History:', err.message))
            );
        }

        // 8. Timo
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
                                unifiedTransactions.push({
                                    bankTransId: rawTx.transId || '',
                                    amount: parsedAmount.toString(),
                                    transDate: rawTx.date || '',
                                    paymentType: parsedAmount >= 0 ? 'CREDIT' : 'DEBIT',
                                    msgContent: rawTx.description || '',
                                    balance: null,
                                    bank: 'TIMO'
                                });
                            });
                        }
                    })
                    .catch(err => console.error('Error fetching Timo History:', err.message))
            );
        }

        await Promise.all(fetchPromises);

        // Sort combined transactions by date desc
        unifiedTransactions.sort((a, b) => {
            return parseDateToMs(b.transDate) - parseDateToMs(a.transDate);
        });

        return NextResponse.json({
            transactions: unifiedTransactions,
            content: unifiedTransactions,
            trans: unifiedTransactions
        });
    } catch (error) {
        console.error('Bank History Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
