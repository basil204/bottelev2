import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { loginCapCut } from '@/lib/joincapcut/capcutteamql/login_getinfo';
import { getUserWorkspacesWithCookie, mgetWorkspaceInfoWithCookie } from '@/lib/joincapcut/capcutteamql/getinfo';
import { getlinkWithCookie } from '@/lib/joincapcut/capcutteamql/getlink';
import { refresh_invitation_link } from '@/lib/joincapcut/capcutteamql/doilink';
import { joinWorkspace } from '@/lib/joincapcut/join';

export interface AdminWorkspaceRecord {
  id: number;
  admin_email: string;
  admin_password?: string;
  admin_cookie: string;
  workspace_id: string;
  workspace_name: string;
  member_limit: number;
  member_cnt: number;
  team_vip_end: number;
  status: 'active' | 'full' | 'expired' | 'disabled';
  created_at?: string;
  updated_at?: string;
}

export interface UserWarrantyRecord {
  id?: number;
  telegram_id: string;
  user_capcut_email: string;
  user_capcut_uid?: string;
  workspace_id: string;
  admin_email?: string;
  price_paid: number;
  joined_at?: string;
  expires_at?: string;
  status: 'active' | 'expired' | 'refunded';
  note?: string;
}

/**
 * 1. Admin Thêm/Cập nhật Tài khoản CapCut Admin vào CSDL
 */
export async function syncAdminCapCutAccount(email: string, pass: string): Promise<AdminWorkspaceRecord[]> {
  console.log(`[CAPCUT_SERVICE] Syncing Admin CapCut Account: ${email}`);

  // Đăng nhập lấy cookie mới
  const { cookieStr, userInfo } = await loginCapCut(email, pass);

  // Đợi 2s để session đồng bộ trên CapCut server
  await new Promise(r => setTimeout(r, 2000));

  // Lấy danh sách Workspace thuộc sở hữu tài khoản Admin
  const wsData = await getUserWorkspacesWithCookie(cookieStr, { cursor: '0', count: 100, need_convert_workspace: true });
  const workspaces = wsData?.data?.workspace_infos || wsData?.data?.workspaces || [];

  if (workspaces.length === 0) {
    throw new Error('Tài khoản Admin này hiện chưa tạo Workspace/Family nào trên CapCut.');
  }

  const savedRecords: AdminWorkspaceRecord[] = [];

  for (const ws of workspaces) {
    const wsId = String(ws.workspace_id || ws.id);
    const wsName = ws.name || `${userInfo?.name || 'Admin'}'s Space`;
    const memberLimit = Number(ws.member_limit) || 7;
    const memberCnt = Number(ws.member_cnt) || 1;
    const teamVipEnd = Number(ws.team_vip_end) || 0;

    let status: 'active' | 'full' | 'expired' | 'disabled' = 'active';
    if (memberCnt >= memberLimit) {
      status = 'full';
    } else if (teamVipEnd > 0 && teamVipEnd < Math.floor(Date.now() / 1000)) {
      status = 'expired';
    }

    await pool.query(
      `INSERT INTO capcut_admin_workspaces 
        (admin_email, admin_password, admin_cookie, workspace_id, workspace_name, member_limit, member_cnt, team_vip_end, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
        admin_password = VALUES(admin_password),
        admin_cookie = VALUES(admin_cookie),
        workspace_name = VALUES(workspace_name),
        member_limit = VALUES(member_limit),
        member_cnt = VALUES(member_cnt),
        team_vip_end = VALUES(team_vip_end),
        status = VALUES(status)`,
      [email, pass, cookieStr, wsId, wsName, memberLimit, memberCnt, teamVipEnd, status]
    );

    savedRecords.push({
      id: 0,
      admin_email: email,
      admin_cookie: cookieStr,
      workspace_id: wsId,
      workspace_name: wsName,
      member_limit: memberLimit,
      member_cnt: memberCnt,
      team_vip_end: teamVipEnd,
      status
    });
  }

  return savedRecords;
}

/**
 * 2. Tìm Workspace Admin ngẫu nhiên (còn slot & VIP còn hạn)
 */
export async function findAvailableAdminWorkspace(): Promise<AdminWorkspaceRecord | null> {
  const currentTs = Math.floor(Date.now() / 1000);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM capcut_admin_workspaces 
     WHERE status = 'active' 
       AND member_cnt < member_limit 
       AND (team_vip_end = 0 OR team_vip_end > ?)
     ORDER BY RAND() 
     LIMIT 1`,
    [currentTs]
  );

  if (rows.length === 0) return null;
  return rows[0] as AdminWorkspaceRecord;
}

/**
 * 3. Thực hiện Nâng cấp Tự động cho Khách Hàng (User Login ➔ Join ➔ Đổi Link ➔ Lưu Bảo Hành)
 */
export async function processCapCutUserUpgrade(
  telegramId: string,
  userEmail: string,
  userPass: string,
  pricePaid: number = 0
) {
  console.log(`[CAPCUT_SERVICE] Processing CapCut upgrade for TG: ${telegramId} | User Email: ${userEmail}`);

  // Bước 1: Tìm Workspace Admin còn chỗ (ngẫu nhiên)
  let adminWs = await findAvailableAdminWorkspace();

  if (!adminWs) {
    // Thử làm mới lại cookie tất cả Admin Workspaces trước khi báo hết slot
    const [allAdminWs] = await pool.query<RowDataPacket[]>(`SELECT * FROM capcut_admin_workspaces WHERE status != 'disabled'`);
    for (const ws of allAdminWs) {
      if (ws.admin_email && ws.admin_password) {
        try {
          await syncAdminCapCutAccount(ws.admin_email, ws.admin_password);
        } catch (e) {}
      }
    }
    adminWs = await findAvailableAdminWorkspace();
  }

  if (!adminWs) {
    throw new Error('Hiện tại kho Workspace Admin đang hết slot trống hoặc hết hạn VIP. Vui lòng liên hệ Admin!');
  }

  // Bước 2: Đăng nhập tài khoản User CapCut để lấy Cookie User
  console.log(`[CAPCUT_SERVICE] Logging into User CapCut Account: ${userEmail}`);
  const { cookieStr: userCookie, userInfo } = await loginCapCut(userEmail, userPass);
  const userUid = String(userInfo?.user_id_str || userInfo?.user_id || '');

  // Bước 3: Lấy Link mời từ Workspace Admin
  console.log(`[CAPCUT_SERVICE] Fetching invitation link from Admin Workspace ID: ${adminWs.workspace_id} (Admin: ${adminWs.admin_email})`);
  const linkRes = await getlinkWithCookie(adminWs.admin_cookie, { workspace_id: adminWs.workspace_id });
  const inviteLink = linkRes?.data?.invitation_link || linkRes?.data?.invite_link || linkRes?.data?.link || '';

  if (!inviteLink) {
    throw new Error(`Không lấy được Link mời từ Workspace Admin ID: ${adminWs.workspace_id}`);
  }

  // Bước 4: Cho User Join vào Workspace Admin
  console.log(`[CAPCUT_SERVICE] Joining User ${userEmail} to Workspace Link: ${inviteLink}`);
  const joinRes: any = await joinWorkspace(userCookie, inviteLink, null);

  const isSuccess = joinRes?.ret === 0 || joinRes?.ret === '0' || joinRes?.errmsg === 'SUCCESS' || (joinRes?.data && joinRes?.data?.workspace_info);

  if (!isSuccess) {
    const errMessage = joinRes?.errmsg || joinRes?.data?.description || 'Tham gia Workspace thất bại';
    throw new Error(`CapCut Join Error: ${errMessage}`);
  }

  // Bước 5: NGAY KHI JOIN THÀNH CÔNG ➔ ĐỔI MÃ/LINK MỜI MỚI NGAY LẬP TỨC
  console.log(`[CAPCUT_SERVICE] Join successful! Immediately refreshing Admin invitation link to invalidate old link...`);
  await new Promise(r => setTimeout(r, 2000));
  try {
    await refresh_invitation_link(adminWs.admin_cookie, { workspace_id: adminWs.workspace_id });
    console.log(`[CAPCUT_SERVICE] Successfully refreshed Admin invitation link!`);
  } catch (refreshErr: any) {
    console.error(`[CAPCUT_SERVICE] Warning: Failed to refresh invite link after join:`, refreshErr?.message);
  }

  // Bước 6: Cập nhật CSDL (Tăng số lượng member_cnt của Admin Workspace & Lưu Bảo hành Khách với admin_email)
  const newMemberCnt = adminWs.member_cnt + 1;
  const newStatus = newMemberCnt >= adminWs.member_limit ? 'full' : 'active';

  await pool.query(
    `UPDATE capcut_admin_workspaces SET member_cnt = ?, status = ? WHERE workspace_id = ?`,
    [newMemberCnt, newStatus, adminWs.workspace_id]
  );

  const expiresAtDate = adminWs.team_vip_end > 0 
    ? new Date(adminWs.team_vip_end * 1000) 
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO capcut_user_warranties 
      (telegram_id, user_capcut_email, user_capcut_uid, workspace_id, admin_email, price_paid, expires_at, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [telegramId, userEmail, userUid, adminWs.workspace_id, adminWs.admin_email, pricePaid, expiresAtDate, `Thành công | Admin: ${adminWs.admin_email} | WS: ${adminWs.workspace_name}`]
  );

  return {
    success: true,
    userEmail,
    userUid,
    workspaceId: adminWs.workspace_id,
    workspaceName: adminWs.workspace_name,
    expiresAt: expiresAtDate.toISOString(),
    message: 'Nâng cấp CapCut Pro chính chủ thành công!'
  };
}

/**
 * 4. Lấy tất cả danh sách Workspace Admin (cho WebApp Admin Dashboard)
 */
export async function getAllAdminWorkspaces(): Promise<AdminWorkspaceRecord[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM capcut_admin_workspaces ORDER BY created_at DESC`
  );
  return rows as AdminWorkspaceRecord[];
}

/**
 * 5. Lấy danh sách Bảo hành khách hàng (cho WebApp Admin Dashboard)
 */
export async function getAllUserWarranties(): Promise<UserWarrantyRecord[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT w.*, ws.workspace_name 
     FROM capcut_user_warranties w
     LEFT JOIN capcut_admin_workspaces ws ON w.workspace_id = ws.workspace_id
     ORDER BY w.joined_at DESC`
  );
  return rows as UserWarrantyRecord[];
}
