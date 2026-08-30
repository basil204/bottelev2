import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    await dbReady;

    // Today range
    const now = new Date();
    const todayStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 00:00:00`;

    // Today Orders
    const [todayOrders] = await pool.query<RowDataPacket[]>(
      `SELECT SUM(total_amount) AS revenue, SUM(total_cost) AS cost, COUNT(id) AS order_count 
       FROM seller_orders 
       WHERE created_at >= ?`,
      [todayStartStr]
    );

    const todayRevenue = Number(todayOrders[0]?.revenue || 0);
    const todayCost = Number(todayOrders[0]?.cost || 0);
    const todayOrderCount = Number(todayOrders[0]?.order_count || 0);

    // Today Expenses from manual transactions
    const [todayExp] = await pool.query<RowDataPacket[]>(
      `SELECT SUM(amount) AS total_expense 
       FROM seller_transactions 
       WHERE type = 'EXPENSE' AND created_at >= ?`,
      [todayStartStr]
    );
    const todayManualExpense = Number(todayExp[0]?.total_expense || 0);
    const totalTodayExpense = todayCost + todayManualExpense;
    const todayProfit = todayRevenue - totalTodayExpense;

    // Available Inventory Count
    const [invCount] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(id) AS cnt FROM seller_inventory WHERE status = 'AVAILABLE'`
    );
    const availableInventoryCount = Number(invCount[0]?.cnt || 0);

    // Wallets Summary
    const [wallets] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM seller_wallets ORDER BY id ASC`
    );
    const totalWalletBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);

    // 7-day Sales Chart
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const sevenDaysAgoStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')} 00:00:00`;

    const [pastOrders] = await pool.query<RowDataPacket[]>(
      `SELECT total_amount, total_profit, created_at FROM seller_orders WHERE created_at >= ?`,
      [sevenDaysAgoStr]
    );

    const chartMap: Record<string, { date: string; revenue: number; profit: number; orders: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
      chartMap[dateStr] = { date: dateStr, revenue: 0, profit: 0, orders: 0 };
    }

    pastOrders.forEach((o) => {
      const d = new Date(o.created_at);
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
      if (chartMap[dateStr]) {
        chartMap[dateStr].revenue += Number(o.total_amount || 0);
        chartMap[dateStr].profit += Number(o.total_profit || 0);
        chartMap[dateStr].orders += 1;
      }
    });

    // Recent Transactions
    const [recentTx] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, w.name AS wallet_name 
       FROM seller_transactions t
       LEFT JOIN seller_wallets w ON t.wallet_id = w.id
       ORDER BY t.created_at DESC 
       LIMIT 6`
    );

    const formattedTx = recentTx.map((t) => ({
      id: t.id,
      walletId: t.wallet_id,
      orderId: t.order_id,
      type: t.type,
      category: t.category,
      amount: Number(t.amount),
      description: t.description,
      createdAt: t.created_at,
      wallet: { name: t.wallet_name }
    }));

    return NextResponse.json({
      success: true,
      data: {
        today: {
          revenue: todayRevenue,
          expense: totalTodayExpense,
          profit: todayProfit,
          orderCount: todayOrderCount
        },
        inventoryCount: availableInventoryCount,
        wallets: {
          total: totalWalletBalance,
          list: wallets.map((w) => ({
            id: w.id,
            name: w.name,
            type: w.type,
            accountNumber: w.account_number,
            balance: Number(w.balance),
            icon: w.icon
          }))
        },
        chart7Days: Object.values(chartMap),
        recentTransactions: formattedTx
      }
    });
  } catch (error: any) {
    console.error('Error in seller-manager dashboard API:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
