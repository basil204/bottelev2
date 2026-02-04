import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [users] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM users');
    const [revenue] = await pool.query<RowDataPacket[]>('SELECT SUM(price) as total FROM orders WHERE status = "completed"');
    const [deposits] = await pool.query<RowDataPacket[]>('SELECT SUM(amount) as total FROM deposits WHERE status = "approved"');
    const [ordersCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM orders');

    // New stats for Dashboard
    const [todayDeposits] = await pool.query<RowDataPacket[]>('SELECT SUM(amount) as total FROM deposits WHERE status = "approved" AND DATE(created_at) = CURDATE()');
    const [monthDeposits] = await pool.query<RowDataPacket[]>('SELECT SUM(amount) as total FROM deposits WHERE status = "approved" AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())');

    // Chart data: Revenue last 7 days
    const [revenueChart] = await pool.query<RowDataPacket[]>(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, SUM(price) as total
      FROM orders
      WHERE status = 'completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY date
      ORDER BY date ASC
    `);

    // Revenue by product type
    const [productRevenue] = await pool.query<RowDataPacket[]>(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.price), 0) as total_revenue
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id AND o.status = 'completed'
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
      revenueChart,
      productRevenue
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
