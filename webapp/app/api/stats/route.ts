import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: Request) {
  try {
    await dbReady;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7days';
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    // Log action
    const adminName = await getAdminFromCookie(request);
    await logAdminAction({
      adminName: adminName || 'System',
      action: 'VIEW',
      targetType: 'WEBSITE',
      details: `Viewed P&L analytics stats (period: ${period})`,
      request
    });

    // Build SQL date condition
    let dateCondition = '';
    const queryParams: any[] = [];

    if (fromDate && toDate) {
      dateCondition = 'AND o.created_at >= ? AND o.created_at <= ?';
      queryParams.push(`${fromDate} 00:00:00`, `${toDate} 23:59:59`);
    } else {
      switch (period) {
        case 'today':
          dateCondition = 'AND DATE(o.created_at) = CURDATE()';
          break;
        case '7days':
          dateCondition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
          break;
        case '30days':
          dateCondition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
          break;
        case 'this_month':
          dateCondition = 'AND MONTH(o.created_at) = MONTH(NOW()) AND YEAR(o.created_at) = YEAR(NOW())';
          break;
        case 'last_month':
          dateCondition = 'AND MONTH(o.created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND YEAR(o.created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))';
          break;
        default:
          dateCondition = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
      }
    }

    // 1. Calculate Net Revenue and Total Completed Orders
    const [revenueRows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        COUNT(o.id) as total_orders,
        COALESCE(SUM(
          CASE WHEN u.telegram_id IN (SELECT telegram_id FROM admin_accounts WHERE telegram_id IS NOT NULL)
            THEN 0 ELSE o.price END
        ), 0) as net_revenue
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.status = 'completed' ${dateCondition}
    `, queryParams);

    const netRevenue = Number(revenueRows[0]?.net_revenue || 0);
    const totalOrders = Number(revenueRows[0]?.total_orders || 0);

    // 2. Calculate COGS (Giá vốn)
    // If cost_price column exists on products use it, else calculate estimated cost at 0 or query from accounts if available
    let cogs = 0;
    try {
      const [cogsRows] = await pool.query<RowDataPacket[]>(`
        SELECT COALESCE(SUM(
          CASE WHEN u.telegram_id IN (SELECT telegram_id FROM admin_accounts WHERE telegram_id IS NOT NULL)
            THEN 0 ELSE COALESCE(p.cost_price, 0) END
        ), 0) as total_cogs
        FROM orders o
        JOIN products p ON o.product_id = p.id
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.status = 'completed' ${dateCondition}
      `, queryParams);
      cogs = Number(cogsRows[0]?.total_cogs || 0);
    } catch {
      cogs = 0;
    }

    const grossProfit = netRevenue - cogs;
    const marginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    const refunds = 0; // Can be linked to refunded orders if implemented
    const refundOrdersCount = 0;
    const realProfitAfterRefunds = grossProfit - refunds;

    // 3. Customer behavior & Repeat rate statistics
    const [customerStats] = await pool.query<RowDataPacket[]>(`
      SELECT 
        o.user_id,
        COUNT(o.id) as order_count,
        SUM(o.price) as total_spent
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.status = 'completed' ${dateCondition}
        AND (u.telegram_id IS NULL OR u.telegram_id NOT IN (SELECT telegram_id FROM admin_accounts WHERE telegram_id IS NOT NULL))
      GROUP BY o.user_id
    `, queryParams);

    const totalBuyingCustomers = customerStats.length;
    const repeatCustomers = customerStats.filter(c => Number(c.order_count) >= 2).length;
    const repeatRate = totalBuyingCustomers > 0 ? (repeatCustomers / totalBuyingCustomers) * 100 : 0;

    const aov = totalOrders > 0 ? netRevenue / totalOrders : 0;
    const avgOrdersPerCustomer = totalBuyingCustomers > 0 ? totalOrders / totalBuyingCustomers : 0;

    // Customer frequency distribution
    const freq1 = customerStats.filter(c => Number(c.order_count) === 1).length;
    const freq2to3 = customerStats.filter(c => Number(c.order_count) >= 2 && Number(c.order_count) <= 3).length;
    const freq4to5 = customerStats.filter(c => Number(c.order_count) >= 4 && Number(c.order_count) <= 5).length;
    const freq6plus = customerStats.filter(c => Number(c.order_count) >= 6).length;

    // 4. Daily Trend Chart Data (Net Revenue, COGS, Gross Profit)
    const [dailyChartRows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        DATE_FORMAT(o.created_at, '%d/%m') as date,
        COALESCE(SUM(
          CASE WHEN u.telegram_id IN (SELECT telegram_id FROM admin_accounts WHERE telegram_id IS NOT NULL)
            THEN 0 ELSE o.price END
        ), 0) as revenue
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.status = 'completed' ${dateCondition}
      GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d'), DATE_FORMAT(o.created_at, '%d/%m')
      ORDER BY DATE_FORMAT(o.created_at, '%Y-%m-%d') ASC
    `, queryParams);

    const chartData = dailyChartRows.map(row => {
      const rev = Number(row.revenue || 0);
      const rowCogs = 0; // Estimated or from product cost
      return {
        date: row.date,
        revenue: rev,
        cogs: rowCogs,
        grossProfit: rev - rowCogs
      };
    });

    // 5. Product Profitability Matrix
    const [productMatrix] = await pool.query<RowDataPacket[]>(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        COALESCE(c.name, 'Chưa phân loại') as category_name,
        COUNT(o.id) as sold_count,
        COALESCE(SUM(
          CASE WHEN u.telegram_id IN (SELECT telegram_id FROM admin_accounts WHERE telegram_id IS NOT NULL)
            THEN 0 ELSE o.price END
        ), 0) as revenue
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      JOIN orders o ON p.id = o.product_id AND o.status = 'completed' ${dateCondition}
      LEFT JOIN users u ON o.user_id = u.id
      GROUP BY p.id, p.name, c.name
      ORDER BY revenue DESC
      LIMIT 15
    `, queryParams);

    const productProfitability = productMatrix.map(item => {
      const rev = Number(item.revenue || 0);
      const prodCogs = 0;
      const profit = rev - prodCogs;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        category_name: item.category_name,
        sold_count: Number(item.sold_count || 0),
        revenue: rev,
        cogs: prodCogs,
        gross_profit: profit,
        margin_percent: margin
      };
    });

    // General counters for compatibility
    const [usersCount] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM users');
    const [depositsTotal] = await pool.query<RowDataPacket[]>('SELECT SUM(amount) as total FROM deposits WHERE status = "approved"');

    return NextResponse.json({
      success: true,
      period,
      pnl: {
        netRevenue,
        cogs,
        grossProfit,
        marginPercent,
        refunds,
        refundOrdersCount,
        realProfitAfterRefunds,
        totalBuyingCustomers,
        repeatCustomers,
        repeatRate,
        aov,
        avgOrdersPerCustomer,
        frequencyDistribution: {
          freq1: { count: freq1, percent: totalBuyingCustomers > 0 ? (freq1 / totalBuyingCustomers) * 100 : 0 },
          freq2to3: { count: freq2to3, percent: totalBuyingCustomers > 0 ? (freq2to3 / totalBuyingCustomers) * 100 : 0 },
          freq4to5: { count: freq4to5, percent: totalBuyingCustomers > 0 ? (freq4to5 / totalBuyingCustomers) * 100 : 0 },
          freq6plus: { count: freq6plus, percent: totalBuyingCustomers > 0 ? (freq6plus / totalBuyingCustomers) * 100 : 0 },
        },
      },
      chartData,
      productProfitability,
      // General stats
      totalUsers: usersCount[0]?.count || 0,
      totalDeposits: depositsTotal[0]?.total || 0,
      totalOrders,
    });
  } catch (error: any) {
    console.error('Stats P&L API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
