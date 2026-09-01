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

    // 1. Thống kê tổng quan
    const [statsRows] = await pool.query<any[]>(`
      SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
        SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END) as total_revenue
      FROM canva_tasks
    `);

    const [teamStats] = await pool.query<any[]>(`
      SELECT 
        COUNT(*) as total_teams,
        COALESCE(SUM(CASE WHEN current_members < member_limit AND status = 'active' THEN (member_limit - current_members) ELSE 0 END), 0) as slots_available
      FROM canva_teams
    `);

    const stats = {
      total: Number(statsRows[0]?.total_tasks || 0),
      pending: Number(statsRows[0]?.pending_tasks || 0),
      running: Number(statsRows[0]?.running_tasks || 0),
      completed: Number(statsRows[0]?.completed_tasks || 0),
      failed: Number(statsRows[0]?.failed_tasks || 0),
      totalRevenue: Number(statsRows[0]?.total_revenue || 0),
      totalTeams: Number(teamStats[0]?.total_teams || 0),
      slotsAvailable: Number(teamStats[0]?.slots_available || 0)
    };

    // 2. Hàng chờ (Pending)
    const [queueRows] = await pool.query<any[]>(`
      SELECT t.*, u.username as user_name
      FROM canva_tasks t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.status = 'pending'
      ORDER BY t.created_at ASC
      LIMIT 100
    `);

    // 3. Danh sách đang chạy (Running)
    const [runningRows] = await pool.query<any[]>(`
      SELECT t.*, u.username as user_name
      FROM canva_tasks t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.status = 'running'
      ORDER BY t.started_at DESC
      LIMIT 50
    `);

    // 4. Danh sách mua & Lịch sử mời (Completed, Failed, Cancelled)
    const [historyRows] = await pool.query<any[]>(`
      SELECT t.*, u.username as user_name, tm.name as team_assigned_name
      FROM canva_tasks t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN canva_teams tm ON t.team_id = tm.id
      WHERE t.status IN ('completed', 'failed', 'cancelled')
      ORDER BY t.id DESC
      LIMIT 150
    `);

    return NextResponse.json({
      success: true,
      stats,
      queue: queueRows,
      running: runningRows,
      history: historyRows
    });
  } catch (err: any) {
    console.error('[API_CANVA_QUEUE_GET]', err);
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
    const { action, taskId, email, role = 'member', price = 0, teamId = null } = body;

    // Thêm đơn thủ công từ WebApp
    if (action === 'add_manual') {
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Email không hợp lệ' }, { status: 400 });
      }

      const [res] = await pool.query<any>(
        `INSERT INTO canva_tasks (email, role, price, team_id, status, step_status, created_at)
         VALUES (?, ?, ?, ?, 'pending', 'Tạo thủ công từ WebApp', NOW())`,
        [email.trim().toLowerCase(), role || 'member', Math.max(0, Number(price) || 0), teamId || null]
      );

      return NextResponse.json({
        success: true,
        message: 'Đã thêm yêu cầu mời Canva Pro vào hàng chờ!',
        taskId: res.insertId
      });
    }

    // Hủy đơn đang pending
    if (action === 'cancel') {
      if (!taskId) return NextResponse.json({ error: 'Thiếu Task ID' }, { status: 400 });
      await pool.query(
        "UPDATE canva_tasks SET status = 'cancelled', completed_at = NOW(), step_status = 'Đã hủy bởi Admin' WHERE id = ? AND status = 'pending'",
        [taskId]
      );
      return NextResponse.json({ success: true, message: 'Đã hủy yêu cầu thành công!' });
    }

    // Chạy lại đơn bị lỗi
    if (action === 'retry') {
      if (!taskId) return NextResponse.json({ error: 'Thiếu Task ID' }, { status: 400 });
      await pool.query(
        "UPDATE canva_tasks SET status = 'pending', error_message = NULL, step_status = 'Đang chờ chạy lại...', started_at = NULL, completed_at = NULL WHERE id = ?",
        [taskId]
      );
      return NextResponse.json({ success: true, message: 'Đã đưa yêu cầu trở lại hàng chờ!' });
    }

    // Xóa task khỏi CSDL
    if (action === 'delete') {
      if (!taskId) return NextResponse.json({ error: 'Thiếu Task ID' }, { status: 400 });
      await pool.query("DELETE FROM canva_tasks WHERE id = ?", [taskId]);
      return NextResponse.json({ success: true, message: 'Đã xóa tác vụ thành công!' });
    }

    // Dọn dẹp lịch sử cũ
    if (action === 'clear_history') {
      await pool.query("DELETE FROM canva_tasks WHERE status IN ('completed', 'failed', 'cancelled')");
      return NextResponse.json({ success: true, message: 'Đã dọn dẹp sạch toàn bộ lịch sử!' });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    console.error('[API_CANVA_QUEUE_POST]', err);
    return NextResponse.json({ error: err.message || 'Database error' }, { status: 500 });
  }
}
