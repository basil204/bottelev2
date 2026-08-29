import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { syncAdminCapCutAccount, getAllAdminWorkspaces } from '@/lib/capcutAutoService';
import { RowDataPacket } from 'mysql2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const workspaces = await getAllAdminWorkspaces();
    const [priceRows] = await pool.query<RowDataPacket[]>(
      "SELECT value FROM settings WHERE `key` = 'capcut_upgrade_price'"
    );
    const [enabledRows] = await pool.query<RowDataPacket[]>(
      "SELECT value FROM settings WHERE `key` = 'capcut_upgrade_enabled'"
    );

    const price = priceRows[0]?.value ? Number(priceRows[0].value) : 50000;
    const enabled = enabledRows[0]?.value ? enabledRows[0].value === 'true' : true;

    return NextResponse.json({
      success: true,
      data: workspaces,
      settings: {
        price,
        enabled
      }
    });
  } catch (error: any) {
    console.error('[CAPCUT_ADMIN_WS_GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim();
    const password = body.password?.trim();

    if (!email || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ Email và Mật khẩu CapCut Admin' }, { status: 400 });
    }

    const savedRecords = await syncAdminCapCutAccount(email, password);

    return NextResponse.json({
      success: true,
      message: `Đã thêm/đồng bộ thành công ${savedRecords.length} Workspace từ tài khoản ${email}!`,
      data: savedRecords
    });
  } catch (error: any) {
    console.error('[CAPCUT_ADMIN_WS_POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xử lý tài khoản Admin CapCut' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { price, enabled } = body;

    if (price !== undefined) {
      const numericPrice = Math.max(0, Number(price) || 0);
      await pool.query(
        "INSERT INTO settings (`key`, `value`) VALUES ('capcut_upgrade_price', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
        [String(numericPrice)]
      );
    }

    if (enabled !== undefined) {
      await pool.query(
        "INSERT INTO settings (`key`, `value`) VALUES ('capcut_upgrade_enabled', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
        [String(Boolean(enabled))]
      );
    }

    return NextResponse.json({ success: true, message: 'Đã cập nhật cấu hình bán hàng CapCut thành công!' });
  } catch (error: any) {
    console.error('[CAPCUT_ADMIN_WS_PUT] Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
