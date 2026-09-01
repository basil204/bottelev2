import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { getMemberWithCookie } from '@/lib/joincapcut/capcutteamql/listmember';
import { inviteByEmailWithCookie } from '@/lib/joincapcut/capcutteamql/addmember';
import { removeUserWithCookie } from '@/lib/joincapcut/capcutteamql/removeuser';
import { setUserRoleWithCookie } from '@/lib/joincapcut/capcutteamql/setroleuser';
import { updateNameWithCookie } from '@/lib/joincapcut/capcutteamql/updatename';
import { getlinkWithCookie } from '@/lib/joincapcut/capcutteamql/getlink';
import { refresh_invitation_link } from '@/lib/joincapcut/capcutteamql/doilink';
import { syncAdminCapCutAccount } from '@/lib/capcutAutoService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Thiếu workspace_id' }, { status: 400 });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM capcut_admin_workspaces WHERE workspace_id = ?",
      [workspaceId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy Workspace trong CSDL' }, { status: 404 });
    }

    const ws = rows[0];
    const cookie = ws.admin_cookie;

    // Lấy danh sách thành viên từ CapCut API (gửi kèm cursor & count)
    let memberRes: any = null;
    try {
      memberRes = await getMemberWithCookie(cookie, {
        workspace_id: String(workspaceId),
        cursor: '0',
        count: 100
      });
    } catch (e: any) {
      console.warn('[CAPCUT_WS_GET] Error fetching members with existing cookie:', e.message);
    }

    // Nếu cookie hết hạn (ret !== 0), tự động sync lại tài khoản admin nếu có password
    if ((!memberRes || (memberRes.ret !== 0 && memberRes.ret !== '0')) && ws.admin_email && ws.admin_password) {
      try {
        console.log(`[CAPCUT_WS_GET] Cookie expired for ${ws.admin_email}, re-syncing...`);
        const synced = await syncAdminCapCutAccount(ws.admin_email, ws.admin_password);
        const updatedWs = synced.find(s => s.workspace_id === workspaceId) || synced[0];
        if (updatedWs) {
          ws.admin_cookie = updatedWs.admin_cookie;
          memberRes = await getMemberWithCookie(ws.admin_cookie, {
            workspace_id: String(workspaceId),
            cursor: '0',
            count: 100
          });
        }
      } catch (syncErr: any) {
        console.error('[CAPCUT_WS_GET] Re-sync failed:', syncErr.message);
      }
    }

    // Lấy link mời hiện tại
    let inviteLink = '';
    try {
      const linkRes = await getlinkWithCookie(ws.admin_cookie, { workspace_id: String(workspaceId) });
      inviteLink = linkRes?.data?.invitation_link || linkRes?.data?.invite_link || linkRes?.data?.link || '';
    } catch (e: any) {}

    // Extract members array from CapCut response
    let membersList = memberRes?.data?.member_list || memberRes?.data?.members || memberRes?.data?.users || memberRes?.data?.user_list || memberRes?.data?.workspace_info?.member_list || [];

    // Lấy danh sách thành viên đã mua qua hệ thống CSDL (để làm fallback)
    const [dbWarranties] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM capcut_user_warranties WHERE workspace_id = ? ORDER BY joined_at DESC",
      [workspaceId]
    );

    // Nếu CapCut API không trả về thành viên nhưng có dữ liệu CSDL bảo hành ➔ Dùng CSDL làm fallback
    if ((!Array.isArray(membersList) || membersList.length === 0) && Array.isArray(dbWarranties) && dbWarranties.length > 0) {
      membersList = dbWarranties.map((w: any) => ({
        user_id_str: w.user_capcut_uid || w.telegram_id,
        role_id: w.user_capcut_uid || w.telegram_id,
        nickname: `TG: ${w.telegram_id}`,
        email: w.user_capcut_email,
        role: 2,
        is_from_db: true
      }));
    }

    // Update member count in DB if list fetched successfully
    if (Array.isArray(membersList) && membersList.length > 0) {
      const newCnt = membersList.length;
      const newStatus = newCnt >= ws.member_limit ? 'full' : (ws.status === 'expired' ? 'expired' : 'active');
      await pool.query(
        "UPDATE capcut_admin_workspaces SET member_cnt = ?, status = ? WHERE workspace_id = ?",
        [newCnt, newStatus, workspaceId]
      );
      ws.member_cnt = newCnt;
      ws.status = newStatus;
    }

    return NextResponse.json({
      success: true,
      workspace: ws,
      members: membersList,
      invite_link: inviteLink,
      raw: memberRes
    });

  } catch (error: any) {
    console.error('[CAPCUT_WS_GET_ERR]', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, workspace_id, name, email, role, role_id, user_id } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'Thiếu workspace_id' }, { status: 400 });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM capcut_admin_workspaces WHERE workspace_id = ?",
      [workspace_id]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Workspace không tồn tại' }, { status: 404 });
    }

    const ws = rows[0];
    const cookie = ws.admin_cookie;

    switch (action) {
      // 1. Đổi tên Workspace
      case 'update_name': {
        if (!name || !name.trim()) {
          return NextResponse.json({ error: 'Vui lòng nhập tên Workspace mới' }, { status: 400 });
        }
        const newName = name.trim();
        const res = await updateNameWithCookie(cookie, { workspace_id, name: newName });
        if (res?.ret === 0 || res?.errmsg === 'SUCCESS') {
          await pool.query(
            "UPDATE capcut_admin_workspaces SET workspace_name = ? WHERE workspace_id = ?",
            [newName, workspace_id]
          );
          return NextResponse.json({ success: true, message: `Đã đổi tên Workspace thành "${newName}"!`, res });
        }
        return NextResponse.json({ error: res?.errmsg || 'Lỗi đổi tên Workspace từ CapCut API', res }, { status: 400 });
      }

      // 2. Làm mới & Tạo mới Link Mời
      case 'refresh_link': {
        const res = await refresh_invitation_link(cookie, { workspace_id });
        const newLink = res?.data?.invitation_link || res?.data?.invite_link || res?.data?.link || '';
        return NextResponse.json({
          success: true,
          message: 'Đã làm mới link mời Workspace thành công!',
          invite_link: newLink,
          res
        });
      }

      // 3. Thêm thành viên qua Email
      case 'add_member': {
        if (!email || !email.trim()) {
          return NextResponse.json({ error: 'Vui lòng nhập Email thành viên cần mời' }, { status: 400 });
        }
        const targetRole = role ? Number(role) : 2; // 1: Admin, 2: Member, 3: Editor
        const res = await inviteByEmailWithCookie(cookie, {
          workspace_id,
          email: email.trim(),
          role: targetRole
        });
        if (res?.ret === 0 || res?.errmsg === 'SUCCESS') {
          return NextResponse.json({ success: true, message: `Đã gửi lời mời tới email ${email}!`, res });
        }
        return NextResponse.json({ error: res?.errmsg || 'Lỗi gửi lời mời từ CapCut API', res }, { status: 400 });
      }

      // 4. Xóa / Kick thành viên khỏi Workspace
      case 'remove_member': {
        const targetRoleId = role_id || user_id;
        if (!targetRoleId) {
          return NextResponse.json({ error: 'Thiếu ID thành viên (role_id/user_id) cần xóa' }, { status: 400 });
        }
        const res = await removeUserWithCookie(cookie, {
          workspace_id,
          role_id: targetRoleId
        });
        if (res?.ret === 0 || res?.errmsg === 'SUCCESS') {
          // Giảm số lượng member_cnt trong CSDL
          await pool.query(
            "UPDATE capcut_admin_workspaces SET member_cnt = GREATEST(1, member_cnt - 1), status = 'active' WHERE workspace_id = ?",
            [workspace_id]
          );
          return NextResponse.json({ success: true, message: 'Đã xóa thành viên khỏi Workspace!', res });
        }
        return NextResponse.json({ error: res?.errmsg || 'Lỗi xóa thành viên từ CapCut API', res }, { status: 400 });
      }

      // 5. Thay đổi vai trò (Role) thành viên
      case 'set_role': {
        const targetRoleId = role_id || user_id;
        if (!targetRoleId || role === undefined) {
          return NextResponse.json({ error: 'Thiếu role_id hoặc vai trò role mới' }, { status: 400 });
        }
        const res = await setUserRoleWithCookie(cookie, {
          workspace_id,
          role_id: targetRoleId,
          role: Number(role)
        });
        if (res?.ret === 0 || res?.errmsg === 'SUCCESS') {
          return NextResponse.json({ success: true, message: 'Đã cập nhật vai trò thành viên!', res });
        }
        return NextResponse.json({ error: res?.errmsg || 'Lỗi cập nhật vai trò từ CapCut API', res }, { status: 400 });
      }

      // 6. Xóa Workspace khỏi hệ thống CSDL
      case 'delete_workspace': {
        await pool.query("DELETE FROM capcut_admin_workspaces WHERE workspace_id = ?", [workspace_id]);
        return NextResponse.json({ success: true, message: 'Đã xóa Workspace khỏi hệ thống CSDL!' });
      }

      default:
        return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('[CAPCUT_WS_POST_ERR]', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
