import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET() {
  try {
    await dbReady;
    const [customers] = await pool.query<RowDataPacket[]>(`
      SELECT c.*, 
             COUNT(o.id) AS total_orders,
             SUM(IFNULL(o.total_amount, 0)) AS total_spent
      FROM seller_customers c
      LEFT JOIN seller_orders o ON o.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    const formatted = customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
      debtAmount: Number(c.debt_amount || 0),
      totalSpent: Number(c.total_spent || 0),
      totalOrders: Number(c.total_orders || 0)
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const { name, phone, email, notes, debtAmount } = await request.json();

    if (!name) {
      return NextResponse.json({ success: false, error: 'Tên khách hàng là bắt buộc' }, { status: 400 });
    }

    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO seller_customers (name, phone, email, notes, debt_amount) VALUES (?, ?, ?, ?, ?)`,
      [name, phone || null, email || null, notes || '', parseFloat(debtAmount) || 0]
    );

    return NextResponse.json({ success: true, data: { id: res.insertId, name } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
