import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET() {
  try {
    await dbReady;
    const [wallets] = await pool.query<RowDataPacket[]>(`
      SELECT w.*, COUNT(t.id) AS transaction_count 
      FROM seller_wallets w
      LEFT JOIN seller_transactions t ON t.wallet_id = w.id
      GROUP BY w.id
      ORDER BY w.id ASC
    `);

    const formatted = wallets.map(w => ({
      id: w.id,
      name: w.name,
      type: w.type,
      accountNumber: w.account_number,
      balance: Number(w.balance),
      icon: w.icon,
      isDefault: Boolean(w.is_default)
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const { name, type, accountNumber, balance, icon } = await request.json();

    if (!name) {
      return NextResponse.json({ success: false, error: 'Tên ví là bắt buộc' }, { status: 400 });
    }

    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO seller_wallets (name, type, account_number, balance, icon) VALUES (?, ?, ?, ?, ?)`,
      [name, type || 'BANK', accountNumber || null, parseFloat(balance) || 0, icon || 'Wallet']
    );

    return NextResponse.json({ success: true, data: { id: res.insertId, name } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
