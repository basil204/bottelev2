import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';

export interface StartMenuButton {
  id: string;
  text: string;
  text_vi?: string;
  text_en?: string;
  text_zh?: string;
  type: 'url' | 'callback';
  url?: string;
  callback_data?: string;
  row: number;
  is_active: boolean;
}

export interface StartMenuConfig {
  enabled: boolean;
  welcome_text: string;
  welcome_text_vi?: string;
  welcome_text_en?: string;
  welcome_text_zh?: string;
  image_url: string;
  buttons: StartMenuButton[];
}

const DEFAULT_CONFIG: StartMenuConfig = {
  enabled: true,
  welcome_text: `👋 **Chào mừng {name} đến với {shop_name}!**\n\n📌 **ID Telegram:** \`{id}\`\n💰 **Số dư tài khoản:** {balance}\n🎁 **Điểm thưởng Credit:** {credit}\n\n👇 *Vui lòng chọn dịch vụ bên dưới hoặc bấm nút menu:*`,
  welcome_text_vi: `👋 **Chào mừng {name} đến với {shop_name}!**\n\n📌 **ID Telegram:** \`{id}\`\n💰 **Số dư tài khoản:** {balance}\n🎁 **Điểm thưởng Credit:** {credit}\n\n👇 *Vui lòng chọn dịch vụ bên dưới hoặc bấm nút menu:*`,
  welcome_text_en: `👋 **Welcome {name} to {shop_name}!**\n\n📌 **Telegram ID:** \`{id}\`\n💰 **Account Balance:** {balance}\n🎁 **Reward Credit:** {credit}\n\n👇 *Please choose a service below or use the keyboard menu:*`,
  welcome_text_zh: `👋 **欢迎 {name} 光临 {shop_name}！**\n\n📌 **Telegram ID:** \`{id}\`\n💰 **账户余额:** {balance}\n🎁 **奖励积分:** {credit}\n\n👇 *请选择下方服务或使用底部菜单：*`,
  image_url: '',
  buttons: [
    {
      id: 'zalo_group',
      text: 'Nhóm Hỗ Trợ',
      text_vi: 'Nhóm Hỗ Trợ',
      text_en: 'Support Group',
      text_zh: '官方群组',
      type: 'url',
      url: 'https://zalo.me',
      row: 1,
      is_active: true
    },
    {
      id: 'tele_channel',
      text: 'Kênh Update',
      text_vi: 'Kênh Update',
      text_en: 'News Channel',
      text_zh: '频道通知',
      type: 'url',
      url: 'https://t.me',
      row: 1,
      is_active: true
    },
    {
      id: 'website_link',
      text: 'Website Shop',
      text_vi: 'Website Shop',
      text_en: 'Web Store',
      text_zh: '官方网站',
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
          welcome_text_vi: parsed.welcome_text_vi ?? parsed.welcome_text ?? DEFAULT_CONFIG.welcome_text_vi,
          welcome_text_en: parsed.welcome_text_en ?? DEFAULT_CONFIG.welcome_text_en,
          welcome_text_zh: parsed.welcome_text_zh ?? DEFAULT_CONFIG.welcome_text_zh,
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
    const { enabled, welcome_text, welcome_text_vi, welcome_text_en, welcome_text_zh, image_url, buttons } = body;

    const configToSave: StartMenuConfig = {
      enabled: typeof enabled === 'boolean' ? enabled : true,
      welcome_text: typeof welcome_text === 'string' ? welcome_text : (welcome_text_vi || DEFAULT_CONFIG.welcome_text),
      welcome_text_vi: typeof welcome_text_vi === 'string' ? welcome_text_vi : (welcome_text || DEFAULT_CONFIG.welcome_text_vi),
      welcome_text_en: typeof welcome_text_en === 'string' ? welcome_text_en : DEFAULT_CONFIG.welcome_text_en,
      welcome_text_zh: typeof welcome_text_zh === 'string' ? welcome_text_zh : DEFAULT_CONFIG.welcome_text_zh,
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
