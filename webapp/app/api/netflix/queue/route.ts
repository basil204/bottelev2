import { NextRequest, NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { getAdminFromCookie } from '@/lib/adminLog';

export async function GET(request: NextRequest) {
  try {
    await dbReady;
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Thống kê
    const [statsRows] = await pool.query<any[]>(`
      SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
        SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END) as total_revenue
      FROM netflix_tasks
    `);

    const stats = {
      total: Number(statsRows[0]?.total_tasks || 0),
      pending: Number(statsRows[0]?.pending_tasks || 0),
      running: Number(statsRows[0]?.running_tasks || 0),
      completed: Number(statsRows[0]?.completed_tasks || 0),
      failed: Number(statsRows[0]?.failed_tasks || 0),
      totalRevenue: Number(statsRows[0]?.total_revenue || 0)
    };

    // 2. Hàng chờ (Pending)
    const [queueRows] = await pool.query<any[]>(`
      SELECT t.*, u.username as user_name
      FROM netflix_tasks t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.status = 'pending'
      ORDER BY t.created_at ASC
      LIMIT 100
    `);

    // 3. Danh sách đang chạy (Running)
    const [runningRows] = await pool.query<any[]>(`
      SELECT t.*, u.username as user_name
      FROM netflix_tasks t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.status = 'running'
      ORDER BY t.started_at DESC
      LIMIT 50
    `);

    // 4. Lịch sử hoàn tất / thất bại (Completed & Failed)
    const [historyRows] = await pool.query<any[]>(`
      SELECT t.*, u.username as user_name
      FROM netflix_tasks t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.status IN ('completed', 'failed', 'cancelled')
      ORDER BY t.id DESC
      LIMIT 100
    `);

    return NextResponse.json({
      success: true,
      stats,
      queue: queueRows,
      running: runningRows,
      history: historyRows
    });
  } catch (err: any) {
    console.error('[API_NETFLIX_QUEUE_GET]', err);
    return NextResponse.json({ error: err.message || 'Database error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbReady;
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, id, email, price } = body;

    if (action === 'add') {
      if (!email || !String(email).includes('@')) {
        return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });
      }

      const [res] = await pool.query<any>(
        `INSERT INTO netflix_tasks (email, price, status, step_status, created_at)
         VALUES (?, ?, 'pending', 'Đang trong hàng chờ...', NOW())`,
        [String(email).trim(), Number(price) || 0]
      );

      return NextResponse.json({
        success: true,
        message: `Đã thêm email ${email} vào hàng chờ!`,
        taskId: res.insertId
      });
    }

    if (action === 'cancel' && id) {
      await pool.query(
        "UPDATE netflix_tasks SET status = 'cancelled', step_status = 'Đã hủy từ WebApp' WHERE id = ? AND status = 'pending'",
        [id]
      );
      return NextResponse.json({ success: true, message: 'Đã hủy yêu cầu thành công!' });
    }

    if (action === 'retry' && id) {
      await pool.query(
        "UPDATE netflix_tasks SET status = 'pending', step_status = 'Đang trong hàng chờ...', error_message = NULL, started_at = NULL, completed_at = NULL WHERE id = ?",
        [id]
      );
      return NextResponse.json({ success: true, message: 'Đã đưa yêu cầu trở lại hàng chờ!' });
    }

    if (action === 'delete' && id) {
      await pool.query("DELETE FROM netflix_tasks WHERE id = ?", [id]);
      return NextResponse.json({ success: true, message: 'Đã xóa bản ghi thành công!' });
    }

    if (action === 'clear_history') {
      await pool.query("DELETE FROM netflix_tasks WHERE status IN ('completed', 'failed', 'cancelled')");
      return NextResponse.json({ success: true, message: 'Đã dọn dẹp sạch lịch sử cũ!' });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    console.error('[API_NETFLIX_QUEUE_POST]', err);
    return NextResponse.json({ error: err.message || 'Database error' }, { status: 500 });
  }
}
