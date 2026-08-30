import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    await dbReady;
    const [accountTypes] = await pool.query<RowDataPacket[]>('SELECT * FROM seller_account_types');
    const [products] = await pool.query<RowDataPacket[]>('SELECT * FROM seller_products');
    const [inventory] = await pool.query<RowDataPacket[]>('SELECT * FROM seller_inventory');
    const [customers] = await pool.query<RowDataPacket[]>('SELECT * FROM seller_customers');
    const [orders] = await pool.query<RowDataPacket[]>('SELECT * FROM seller_orders');
    const [wallets] = await pool.query<RowDataPacket[]>('SELECT * FROM seller_wallets');
    const [transactions] = await pool.query<RowDataPacket[]>('SELECT * FROM seller_transactions');

    return NextResponse.json({
      exportedAt: new Date(),
      data: {
        accountTypes,
        products,
        inventory,
        customers,
        orders,
        wallets,
        transactions
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
