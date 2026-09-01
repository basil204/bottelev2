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

    const [teams] = await pool.query<any[]>(`
      SELECT id, name, member_limit, current_members, role, status, proxy, last_checked_at, created_at, updated_at
      FROM canva_teams
      ORDER BY id DESC
    `);

    return NextResponse.json({
      success: true,
      teams
    });
  } catch (err: any) {
    console.error('[API_CANVA_TEAMS_GET]', err);
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
    const { action = 'create', id, name, cookies, localStorage, member_limit = 500, current_members = 0, role = 'member', status = 'active', proxy = null } = body;

    if (action === 'create') {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Tên Đội Canva không được để trống' }, { status: 400 });
      }
      if (!cookies || !cookies.trim()) {
        return NextResponse.json({ error: 'Cookies Canva không được để trống' }, { status: 400 });
      }

      const [res] = await pool.query<any>(
        `INSERT INTO canva_teams (name, cookies, local_storage, member_limit, current_members, role, status, proxy, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          name.trim(),
          cookies.trim(),
          localStorage ? (typeof localStorage === 'string' ? localStorage.trim() : JSON.stringify(localStorage)) : null,
          Math.max(1, Number(member_limit) || 500),
          Math.max(0, Number(current_members) || 0),
          role || 'member',
          status || 'active',
          proxy ? proxy.trim() : null
        ]
      );

      return NextResponse.json({
        success: true,
        message: 'Đã thêm Đội Canva mới thành công!',
        teamId: res.insertId
      });
    }

    if (action === 'update') {
      if (!id) {
        return NextResponse.json({ error: 'Thiếu ID Đội Canva' }, { status: 400 });
      }

      let queryStr = `UPDATE canva_teams SET name = ?, member_limit = ?, current_members = ?, role = ?, status = ?, proxy = ?`;
      const params: any[] = [
        name ? name.trim() : 'Canva Team',
        Math.max(1, Number(member_limit) || 500),
        Math.max(0, Number(current_members) || 0),
        role || 'member',
        status || 'active',
        proxy ? proxy.trim() : null
      ];

      if (cookies && cookies.trim()) {
        queryStr += `, cookies = ?`;
        params.push(cookies.trim());
      }
      if (localStorage !== undefined) {
        queryStr += `, local_storage = ?`;
        params.push(localStorage ? (typeof localStorage === 'string' ? localStorage.trim() : JSON.stringify(localStorage)) : null);
      }

      queryStr += ` WHERE id = ?`;
      params.push(id);

      await pool.query(queryStr, params);

      return NextResponse.json({
        success: true,
        message: 'Đã cập nhật Đội Canva thành công!'
      });
    }

    if (action === 'toggle_status') {
      if (!id) return NextResponse.json({ error: 'Thiếu ID Đội Canva' }, { status: 400 });
      const newStatus = status === 'active' ? 'disabled' : 'active';
      await pool.query("UPDATE canva_teams SET status = ? WHERE id = ?", [newStatus, id]);
      return NextResponse.json({ success: true, message: `Đã đổi trạng thái thành ${newStatus}` });
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Thiếu ID Đội Canva' }, { status: 400 });
      await pool.query("DELETE FROM canva_teams WHERE id = ?", [id]);
      return NextResponse.json({ success: true, message: 'Đã xóa Đội Canva thành công!' });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    console.error('[API_CANVA_TEAMS_POST]', err);
    return NextResponse.json({ error: err.message || 'Database error' }, { status: 500 });
  }
}
