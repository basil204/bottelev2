import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
  try {
    await dbReady;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const productId = searchParams.get('productId');
    const search = searchParams.get('search');

    let sql = `
      SELECT i.*, p.name AS product_name 
      FROM seller_inventory i
      LEFT JOIN seller_products p ON i.product_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      sql += ` AND i.status = ?`;
      params.push(status);
    }
    if (productId) {
      sql += ` AND i.product_id = ?`;
      params.push(productId);
    }
    if (search) {
      sql += ` AND i.credentials LIKE ?`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY i.created_at DESC`;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);

    const formatted = rows.map((item) => ({
      id: item.id,
      productId: item.product_id,
      credentials: item.credentials,
      costPrice: Number(item.cost_price),
      sellingPrice: Number(item.selling_price),
      status: item.status,
      note: item.note,
      product: { name: item.product_name }
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
