import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';


export async function GET(request: Request) {
  try {
    await dbReady;
    // Log action
    const adminName = await getAdminFromCookie(request);
    await logAdminAction({
      adminName: adminName || 'System',
      action: 'VIEW',
      targetType: 'WEBSITE',
      details: 'Viewed dashboard statistics',
      request
    });

    const [users] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM users');
    // Admin orders count as 0đ revenue (CASE WHEN), still counted in order count
    const [revenue] = await pool.query<RowDataPacket[]>(`
      SELECT SUM(
        CASE WHEN u.telegram_id IN (SELECT telegram_id FROM admin_accounts WHERE telegram_id IS NOT NULL)
          THEN 0 ELSE o.price END
      ) as total
      FROM orders o
      INNER JOIN users u ON o.user_id = u.id
      WHERE o.status = 'completed'
    `);
    const [deposits] = await pool.query<RowDataPacket[]>('SELECT SUM(amount) as total FROM deposits WHERE status = "approved"');
    const [ordersCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM orders');
    const [pendingDepositStats] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM deposits WHERE status = "pending"');
    const [inventoryAlerts] = await pool.query<RowDataPacket[]>(`
      SELECT id, name, stock, low_stock_threshold,
             CASE WHEN stock = 0 THEN 'out' ELSE 'low' END AS stock_status
      FROM products
      WHERE type = 'stock' AND stock <= COALESCE(low_stock_threshold, 5)
      ORDER BY stock ASC, priority DESC, id DESC
      LIMIT 8
    `);

    // New stats for Dashboard
    const [todayDeposits] = await pool.query<RowDataPacket[]>('SELECT SUM(amount) as total FROM deposits WHERE status = "approved" AND DATE(created_at) = CURDATE()');
    const [monthDeposits] = await pool.query<RowDataPacket[]>('SELECT SUM(amount) as total FROM deposits WHERE status = "approved" AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())');

    // Chart data: Revenue last 7 days (admin orders = 0đ)
    const [revenueChart] = await pool.query<RowDataPacket[]>(`
      SELECT DATE_FORMAT(o.created_at, '%Y-%m-%d') as date,
        SUM(
          CASE WHEN u.telegram_id IN (SELECT telegram_id FROM admin_accounts WHERE telegram_id IS NOT NULL)
            THEN 0 ELSE o.price END
        ) as total
      FROM orders o
      INNER JOIN users u ON o.user_id = u.id
      WHERE o.status = 'completed'
        AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY date
      ORDER BY date ASC
    `);

    // Revenue by product type (admin orders = 0đ, still counted)
    const [productRevenue] = await pool.query<RowDataPacket[]>(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        COUNT(CASE WHEN u.telegram_id IS NULL OR u.telegram_id NOT IN (SELECT telegram_id FROM admin_accounts WHERE telegram_id IS NOT NULL) THEN o.id END) as order_count,
        COALESCE(SUM(
          CASE WHEN u.telegram_id IN (SELECT telegram_id FROM admin_accounts WHERE telegram_id IS NOT NULL)
            THEN 0 ELSE o.price END
        ), 0) as total_revenue
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id AND o.status = 'completed'
      LEFT JOIN users u ON o.user_id = u.id
      GROUP BY p.id, p.name
      ORDER BY total_revenue DESC
    `);

    return NextResponse.json({
      totalUsers: users[0].count,
      totalRevenue: revenue[0].total || 0,
      totalDeposits: deposits[0].total || 0,
      todayDeposits: todayDeposits[0].total || 0,
      monthDeposits: monthDeposits[0].total || 0,
      totalOrders: ordersCount[0].count,
      pendingDeposits: Number(pendingDepositStats[0]?.count || 0),
      pendingDepositAmount: Number(pendingDepositStats[0]?.total || 0),
      inventoryAlerts,
      revenueChart,
      productRevenue
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
