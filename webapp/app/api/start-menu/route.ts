import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export interface StartMenuButton {
  id: string;
  text: string;
  type: 'url' | 'callback';
  url?: string;
  callback_data?: string;
  row: number;
  is_active: boolean;
}

export interface StartMenuConfig {
  enabled: boolean;
  welcome_text: string;
  image_url: string;
  buttons: StartMenuButton[];
}

const DEFAULT_CONFIG: StartMenuConfig = {
  enabled: true,
  welcome_text: `👋 **Chào mừng {name} đến với {shop_name}!**\n\n📌 **ID Telegram:** \`{id}\`\n💰 **Số dư tài khoản:** {balance}\n🎁 **Điểm thưởng Credit:** {credit}\n\n👇 *Vui lòng chọn dịch vụ bên dưới hoặc bấm nút menu:*`,
  image_url: '',
  buttons: [
    {
      id: 'zalo_group',
      text: '💬 Nhóm Zalo Hỗ Trợ',
      type: 'url',
      url: 'https://zalo.me',
      row: 1,
      is_active: true
    },
    {
      id: 'tele_channel',
      text: '📢 Kênh Telegram Update',
      type: 'url',
      url: 'https://t.me',
      row: 1,
      is_active: true
    },
    {
      id: 'website_link',
      text: '🌐 Website Shop',
      type: 'url',
      url: 'https://example.com',
      row: 2,
      is_active: true
    }
  ]
};

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT `value` FROM settings WHERE `key` = 'start_menu_config'"
    );

    if (rows && rows.length > 0 && rows[0].value) {
      try {
        const parsed = JSON.parse(rows[0].value);
        return NextResponse.json({
          enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
          welcome_text: parsed.welcome_text ?? DEFAULT_CONFIG.welcome_text,
          image_url: parsed.image_url ?? '',
          buttons: Array.isArray(parsed.buttons) ? parsed.buttons : DEFAULT_CONFIG.buttons
        });
      } catch (e) {
        console.error('[StartMenu API] Failed to parse JSON config:', e);
      }
    }

    return NextResponse.json(DEFAULT_CONFIG);
  } catch (error) {
    console.error('[StartMenu GET Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { enabled, welcome_text, image_url, buttons } = body;

    const configToSave: StartMenuConfig = {
      enabled: typeof enabled === 'boolean' ? enabled : true,
      welcome_text: typeof welcome_text === 'string' ? welcome_text : DEFAULT_CONFIG.welcome_text,
      image_url: typeof image_url === 'string' ? image_url.trim() : '',
      buttons: Array.isArray(buttons) ? buttons : DEFAULT_CONFIG.buttons
    };

    const jsonString = JSON.stringify(configToSave);

    await pool.query(
      "INSERT INTO settings (`key`, `value`) VALUES ('start_menu_config', ?) ON DUPLICATE KEY UPDATE `value` = ?",
      [jsonString, jsonString]
    );

    // Log admin action
    const { ipAddress, userAgent } = getRequestInfo(request);
    const adminName = await getAdminFromCookie(request);
    await logAdminAction({
      adminName: adminName || 'System',
      action: 'UPDATE',
      targetType: 'SETTING',
      details: ['Updated /start menu configuration'],
      ipAddress,
      userAgent,
      request
    });

    return NextResponse.json({ success: true, config: configToSave });
  } catch (error) {
    console.error('[StartMenu POST Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
