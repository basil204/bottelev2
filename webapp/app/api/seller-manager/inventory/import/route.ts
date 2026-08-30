import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function POST(request: Request) {
  try {
    await dbReady;
    const { productId, rawText, costPrice, sellingPrice, note } = await request.json();

    if (!productId || !rawText) {
      return NextResponse.json({ success: false, error: 'Thiếu productId hoặc nội dung tài khoản' }, { status: 400 });
    }

    const [pRows] = await pool.query<RowDataPacket[]>('SELECT * FROM seller_products WHERE id = ?', [productId]);
    if (pRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Sản phẩm không tồn tại' }, { status: 404 });
    }
    const product = pRows[0];

    const finalCost = costPrice !== undefined && costPrice !== '' ? parseFloat(costPrice) : Number(product.default_cost_price);
    const finalSell = sellingPrice !== undefined && sellingPrice !== '' ? parseFloat(sellingPrice) : Number(product.default_selling_price);

    const lines = rawText
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    let insertedCount = 0;
    for (const cred of lines) {
      const [res] = await pool.query<ResultSetHeader>(
        `INSERT INTO seller_inventory (product_id, credentials, cost_price, selling_price, status, note)
         VALUES (?, ?, ?, ?, 'AVAILABLE', ?)`,
        [productId, cred, finalCost, finalSell, note || 'Import hàng loạt']
      );
      if (res.affectedRows > 0) insertedCount++;
    }

    return NextResponse.json({
      success: true,
      count: insertedCount,
      message: `Đã nạp ${insertedCount} tài khoản vào kho`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
