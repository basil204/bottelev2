import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET() {
  try {
    await dbReady;
    const [products] = await pool.query<RowDataPacket[]>(`
      SELECT p.*, 
             t.name AS account_type_name, t.code AS account_type_code,
             COUNT(CASE WHEN i.status = 'AVAILABLE' THEN i.id END) AS in_stock_count
      FROM seller_products p
      LEFT JOIN seller_account_types t ON p.account_type_id = t.id
      LEFT JOIN seller_inventory i ON i.product_id = p.id
      GROUP BY p.id
      ORDER BY p.id ASC
    `);

    const formatted = products.map((p) => ({
      id: p.id,
      accountTypeId: p.account_type_id,
      name: p.name,
      defaultCostPrice: Number(p.default_cost_price),
      defaultSellingPrice: Number(p.default_selling_price),
      description: p.description,
      inStockCount: Number(p.in_stock_count || 0),
      accountType: { name: p.account_type_name, code: p.account_type_code }
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const { accountTypeId, name, defaultCostPrice, defaultSellingPrice, description } = await request.json();

    if (!accountTypeId || !name) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin sản phẩm' }, { status: 400 });
    }

    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO seller_products (account_type_id, name, default_cost_price, default_selling_price, description)
       VALUES (?, ?, ?, ?, ?)`,
      [accountTypeId, name, parseFloat(defaultCostPrice) || 0, parseFloat(defaultSellingPrice) || 0, description || '']
    );

    return NextResponse.json({ success: true, data: { id: res.insertId, name } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
