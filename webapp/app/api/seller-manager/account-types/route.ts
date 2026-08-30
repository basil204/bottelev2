import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET() {
  try {
    await dbReady;
    const [types] = await pool.query<RowDataPacket[]>(`
      SELECT at.*, COUNT(p.id) AS product_count 
      FROM seller_account_types at
      LEFT JOIN seller_products p ON p.account_type_id = at.id
      GROUP BY at.id
      ORDER BY at.id ASC
    `);

    return NextResponse.json({ success: true, data: types });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const { name, code, icon, description } = await request.json();
    if (!name || !code) {
      return NextResponse.json({ success: false, error: 'Tên và mã loại tài khoản là bắt buộc' }, { status: 400 });
    }

    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO seller_account_types (name, code, icon, description) VALUES (?, ?, ?, ?)`,
      [name, code.toUpperCase(), icon || 'Folder', description || '']
    );

    return NextResponse.json({ success: true, data: { id: res.insertId, name, code } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
