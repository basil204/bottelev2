import { NextResponse } from 'next/server';
import pool, { dbReady } from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { logAdminAction, getRequestInfo, getAdminFromCookie } from '@/lib/adminLog';
// Types and defaults live in a client-safe module so dashboard pages can import
// them without pulling server-only code (db, fs/promises) into the client bundle.
import {
  DEFAULT_WALLET_BUTTONS,
  DEFAULT_DEPOSIT_BUTTONS,
  DEFAULT_KEYBOARD_BUTTONS,
  DEFAULT_TEMPLATES,
  type MainKeyboardButton,
  type BotMenuInlineButton
} from '@/lib/botTemplateDefaults';

export async function GET() {
  try {
    await dbReady;
    const [rows] = await pool.query<RowDataPacket[]>('SELECT `key`, `value` FROM settings');

    const settingsMap: Record<string, string> = {};
    rows.forEach((r) => {
      settingsMap[r.key] = r.value;
    });

    // Parse main keyboard
    let mainKeyboard: MainKeyboardButton[] = DEFAULT_KEYBOARD_BUTTONS;
    if (settingsMap.bot_main_keyboard_config) {
      try {
        const parsed = JSON.parse(settingsMap.bot_main_keyboard_config);
        if (Array.isArray(parsed) && parsed.length > 0) {
          mainKeyboard = parsed;
        }
      } catch (e) {
        console.error('Error parsing bot_main_keyboard_config:', e);
      }
    }

    // Parse wallet buttons
    let walletButtons: BotMenuInlineButton[] = DEFAULT_WALLET_BUTTONS;
    if (settingsMap.wallet_buttons_config) {
      try {
        const parsed = JSON.parse(settingsMap.wallet_buttons_config);
        if (Array.isArray(parsed) && parsed.length > 0) {
          walletButtons = parsed;
        }
      } catch (e) {
        console.error('Error parsing wallet_buttons_config:', e);
      }
    }

    // Parse deposit buttons
    let depositButtons: BotMenuInlineButton[] = DEFAULT_DEPOSIT_BUTTONS;
    if (settingsMap.deposit_menu_buttons_config) {
      try {
        const parsed = JSON.parse(settingsMap.deposit_menu_buttons_config);
        if (Array.isArray(parsed) && parsed.length > 0) {
          depositButtons = parsed;
        }
      } catch (e) {
        console.error('Error parsing deposit_menu_buttons_config:', e);
      }
    }

    // Build templates map
    const templates: Record<string, { label: string; group: string; description: string; vars: string[]; value: string; value_vi: string; value_en: string; value_zh: string }> = {};
    for (const [key, meta] of Object.entries(DEFAULT_TEMPLATES)) {
      const valVi = settingsMap[key] !== undefined && settingsMap[key].trim() !== '' ? settingsMap[key] : meta.default_val;
      const valEn = settingsMap[`${key}_en`] !== undefined && settingsMap[`${key}_en`].trim() !== '' ? settingsMap[`${key}_en`] : (meta.default_val_en || meta.default_val);
      const valZh = settingsMap[`${key}_zh`] !== undefined && settingsMap[`${key}_zh`].trim() !== '' ? settingsMap[`${key}_zh`] : (meta.default_val_zh || meta.default_val);

      templates[key] = {
        label: meta.label,
        group: meta.group,
        description: meta.description,
        vars: meta.vars,
        value: valVi,
        value_vi: valVi,
        value_en: valEn,
        value_zh: valZh
      };
    }

    return NextResponse.json({
      success: true,
      main_keyboard: mainKeyboard,
      wallet_buttons: walletButtons,
      deposit_buttons: depositButtons,
      templates
    });
  } catch (error: any) {
    console.error('[BotTemplates GET Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const body = await request.json();
    const { main_keyboard, wallet_buttons, deposit_buttons, templates } = body;
    const { ipAddress, userAgent } = getRequestInfo(request);
    const adminName = await getAdminFromCookie(request);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      if (main_keyboard && Array.isArray(main_keyboard)) {
        const jsonStr = JSON.stringify(main_keyboard);
        await connection.query(
          'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
          ['bot_main_keyboard_config', jsonStr, jsonStr]
        );
      }

      if (wallet_buttons && Array.isArray(wallet_buttons)) {
        const jsonStr = JSON.stringify(wallet_buttons);
        await connection.query(
          'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
          ['wallet_buttons_config', jsonStr, jsonStr]
        );
      }

      if (deposit_buttons && Array.isArray(deposit_buttons)) {
        const jsonStr = JSON.stringify(deposit_buttons);
        await connection.query(
          'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
          ['deposit_menu_buttons_config', jsonStr, jsonStr]
        );
      }

      if (templates && typeof templates === 'object') {
        for (const [key, val] of Object.entries(templates)) {
          if (typeof val === 'string') {
            await connection.query(
              'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
              [key, val, val]
            );
          }
        }
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    await logAdminAction({
      adminName: adminName || 'System',
      action: 'UPDATE',
      targetType: 'SETTING',
      details: { type: 'bot_templates_and_buttons_updated' },
      ipAddress,
      userAgent,
      request
    });

    return NextResponse.json({ success: true, message: 'Đã lưu cấu hình nút bấm & nội dung Bot thành công!' });
  } catch (error: any) {
    console.error('[BotTemplates POST Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
