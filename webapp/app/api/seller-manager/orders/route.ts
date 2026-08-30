import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET() {
  try {
    await dbReady;
    const [orders] = await pool.query<RowDataPacket[]>(`
      SELECT o.*, 
             c.name AS customer_name, c.phone AS customer_phone,
             w.name AS wallet_name
      FROM seller_orders o
      LEFT JOIN seller_customers c ON o.customer_id = c.id
      LEFT JOIN seller_wallets w ON o.wallet_id = w.id
      ORDER BY o.created_at DESC
    `);

    const formattedOrders = await Promise.all(
      orders.map(async (o) => {
        const [orderItems] = await pool.query<RowDataPacket[]>(`
          SELECT oi.*, p.name AS product_name 
          FROM seller_order_items oi
          LEFT JOIN seller_products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `, [o.id]);

        const [items] = await pool.query<RowDataPacket[]>(`
          SELECT id, credentials, cost_price, selling_price 
          FROM seller_inventory 
          WHERE order_id = ?
        `, [o.id]);

        return {
          id: o.id,
          orderNumber: o.order_number,
          totalCost: Number(o.total_cost),
          totalAmount: Number(o.total_amount),
          totalProfit: Number(o.total_profit),
          status: o.status,
          paymentStatus: o.payment_status,
          createdAt: o.created_at,
          customer: { name: o.customer_name, phone: o.customer_phone },
          wallet: { name: o.wallet_name },
          orderItems: orderItems.map(oi => ({
            id: oi.id,
            quantity: oi.quantity,
            subtotal: Number(oi.subtotal),
            profit: Number(oi.profit),
            product: { name: oi.product_name }
          })),
          items: items.map(i => ({
            id: i.id,
            credentials: i.credentials
          }))
        };
      })
    );

    return NextResponse.json({ success: true, data: formattedOrders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const { customerId, walletId, items, notes } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Đơn hàng phải có ít nhất 1 sản phẩm' }, { status: 400 });
    }

    let totalOrderCost = 0;
    let totalOrderAmount = 0;
    const allocatedAccountItems: any[] = [];
    const orderItemRecords: any[] = [];

    // Verify stock & calculate profit
    for (const item of items) {
      const [pRows] = await pool.query<RowDataPacket[]>('SELECT * FROM seller_products WHERE id = ?', [item.productId]);
      if (pRows.length === 0) throw new Error(`Không tìm thấy sản phẩm ${item.productId}`);
      const product = pRows[0];

      const [availableItems] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM seller_inventory WHERE product_id = ? AND status = 'AVAILABLE' LIMIT ?`,
        [item.productId, parseInt(item.quantity)]
      );

      if (availableItems.length < parseInt(item.quantity)) {
        throw new Error(`Sản phẩm "${product.name}" chỉ còn ${availableItems.length} tài khoản (cần ${item.quantity})`);
      }

      const unitPrice = item.unitPrice !== undefined ? parseFloat(item.unitPrice) : Number(product.default_selling_price);
      const subtotal = unitPrice * item.quantity;
      const unitCost = availableItems.reduce((acc, i) => acc + Number(i.cost_price), 0) / availableItems.length;
      const totalItemCost = unitCost * item.quantity;
      const itemProfit = subtotal - totalItemCost;

      totalOrderCost += totalItemCost;
      totalOrderAmount += subtotal;

      orderItemRecords.push({
        productId: item.productId,
        quantity: item.quantity,
        unitCost,
        unitPrice,
        subtotal,
        profit: itemProfit
      });

      allocatedAccountItems.push(...availableItems);
    }

    const totalProfit = totalOrderAmount - totalOrderCost;
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    // Create Order
    const [ordResult] = await pool.query<ResultSetHeader>(
      `INSERT INTO seller_orders (order_number, customer_id, wallet_id, status, payment_status, total_cost, total_amount, total_profit, notes)
       VALUES (?, ?, ?, 'COMPLETED', 'PAID', ?, ?, ?, ?)`,
      [orderNumber, customerId || null, walletId || null, totalOrderCost, totalOrderAmount, totalProfit, notes || '']
    );
    const orderId = ordResult.insertId;

    // Insert Order Items
    for (const oi of orderItemRecords) {
      await pool.query(
        `INSERT INTO seller_order_items (order_id, product_id, quantity, unit_cost, unit_price, subtotal, profit)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, oi.productId, oi.quantity, oi.unitCost, oi.unitPrice, oi.subtotal, oi.profit]
      );
    }

    // Update allocated inventory items to SOLD
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
    for (const accItem of allocatedAccountItems) {
      await pool.query(
        `UPDATE seller_inventory SET status = 'SOLD', order_id = ?, sold_at = ? WHERE id = ?`,
        [orderId, nowStr, accItem.id]
      );
    }

    // Increment wallet balance & create transaction
    if (walletId) {
      await pool.query(`UPDATE seller_wallets SET balance = balance + ? WHERE id = ?`, [totalOrderAmount, walletId]);
      await pool.query(
        `INSERT INTO seller_transactions (wallet_id, order_id, type, category, amount, description, reference)
         VALUES (?, ?, 'INCOME', 'Sales', ?, ?, ?)`,
        [walletId, orderId, totalOrderAmount, `Thu tiền đơn hàng ${orderNumber}`, orderNumber]
      );
    }

    return NextResponse.json({ success: true, data: { id: orderId, orderNumber, totalAmount: totalOrderAmount, totalProfit } });
  } catch (error: any) {
    console.error('Order creation error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 400 });
  }
}
