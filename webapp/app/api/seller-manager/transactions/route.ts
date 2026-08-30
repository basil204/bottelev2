import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET() {
  try {
    await dbReady;
    const [txs] = await pool.query<RowDataPacket[]>(`
      SELECT t.*, w.name AS wallet_name 
      FROM seller_transactions t
      LEFT JOIN seller_wallets w ON t.wallet_id = w.id
      ORDER BY t.created_at DESC
    `);

    const formatted = txs.map(t => ({
      id: t.id,
      walletId: t.wallet_id,
      orderId: t.order_id,
      type: t.type,
      category: t.category,
      amount: Number(t.amount),
      description: t.description,
      createdAt: t.created_at,
      wallet: { name: t.wallet_name }
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const { walletId, type, category, amount, description, reference } = await request.json();
    const numAmount = parseFloat(amount);

    if (!walletId || !numAmount || numAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Thông tin giao dịch không hợp lệ' }, { status: 400 });
    }

    const [txResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO seller_transactions (wallet_id, type, category, amount, description, reference)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [walletId, type, category || 'Khác', numAmount, description || '', reference || '']
    );

    // Update wallet balance
    const balanceChange = type === 'INCOME' ? numAmount : -numAmount;
    await pool.query(`UPDATE seller_wallets SET balance = balance + ? WHERE id = ?`, [balanceChange, walletId]);

    return NextResponse.json({ success: true, data: { id: txResult.insertId, amount: numAmount } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
