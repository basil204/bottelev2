import { findOrCreateUser, getUserByTelegram } from '../controllers/userController.js';
import { getOrderByIdForUser, listTodayOrdersByUser, listOrdersByUser } from '../controllers/orderController.js';
import { formatCurrency, createCallbackData } from '../../utils/index.js';
import { query } from '../database/index.js';
import { getCache, setCache, delCache } from '../../lib/cache/index.js';
import { getBotTemplate, renderBotTemplate } from '../helpers/templateHelper.js';
import { markdownToTelegramHtml, formatReplyMarkup } from '../helpers/telegramFormatHelper.js';

const menuMessageKey = (chatId) => `active_menu_message_${chatId}`;

export const sendTrackedMenu = async (bot, chatId, text, options = {}) => {
  const previousMessageId = getCache(menuMessageKey(chatId));
  if (previousMessageId) {
    try {
      await bot.deleteMessage(chatId, previousMessageId);
    } catch {}
    delCache(menuMessageKey(chatId));
  }
  const sent = await bot.sendMessage(chatId, text, options);
  if (sent?.message_id) setCache(menuMessageKey(chatId), sent.message_id, 24 * 60 * 60 * 1000);
  return sent;
};

export const ensureUser = async (bot, msg) => {
  const user = await findOrCreateUser(msg.from.id, msg.from.username);
  return user;
};

export const getButtonTextForLang = (btn, lang = 'vi') => {
  if (lang === 'en') return btn.text_en || btn.text || btn.text_vi || '';
  if (lang === 'zh') return btn.text_zh || btn.text || btn.text_vi || '';
  return btn.text_vi || btn.text || '';
};

export const getMainKeyboardConfig = async () => {
  try {
    const { getBotTemplate } = await import('../helpers/templateHelper.js');
    const configStr = await getBotTemplate('bot_main_keyboard_config');
    if (configStr) {
      const parsed = JSON.parse(configStr);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [
    { id: 'btn_products', text: 'Sản phẩm', text_vi: 'Sản phẩm', text_en: 'Products', text_zh: '产品', action: 'products', row: 1, is_active: true },
    { id: 'btn_support', text: 'Hỗ trợ', text_vi: 'Hỗ trợ', text_en: 'Support', text_zh: '客服支持', action: 'support', row: 1, is_active: true },
    { id: 'btn_wallet', text: 'Ví', text_vi: 'Ví', text_en: 'Wallet', text_zh: '钱包', action: 'wallet', row: 2, is_active: true },
    { id: 'btn_api', text: 'API', text_vi: 'API', text_en: 'API', text_zh: 'API', action: 'api', row: 2, is_active: true },
    { id: 'btn_warranty', text: 'Bảo hành', text_vi: 'Bảo hành', text_en: 'Warranty', text_zh: '售后保修', action: 'warranty', row: 3, is_active: true }
  ];
};

export const buildMainKeyboard = async (t, lang = 'vi') => {
  const { formatReplyMarkup } = await import('../helpers/telegramFormatHelper.js');
  const buttons = await getMainKeyboardConfig();
  const activeButtons = buttons.filter((b) => b.is_active !== false);
  const rowsMap = {};
  activeButtons.forEach((btn) => {
    const rowNum = Number(btn.row) || 1;
    if (!rowsMap[rowNum]) rowsMap[rowNum] = [];
    const label = getButtonTextForLang(btn, lang);
    if (label) rowsMap[rowNum].push({ text: label });
  });

  const keyboard = Object.keys(rowsMap)
    .sort((a, b) => Number(a) - Number(b))
    .map((r) => rowsMap[r]);

  const defaultVi = [
    [{ text: 'Sản phẩm' }, { text: 'Hỗ trợ' }],
    [{ text: 'Ví' }, { text: 'API' }],
    [{ text: 'Bảo hành' }]
  ];
  const defaultEn = [
    [{ text: 'Products' }, { text: 'Support' }],
    [{ text: 'Wallet' }, { text: 'API' }],
    [{ text: 'Warranty' }]
  ];
  const defaultZh = [
    [{ text: '产品' }, { text: '客服支持' }],
    [{ text: '钱包' }, { text: 'API' }],
    [{ text: '售后保修' }]
  ];

  const defaultFallback = lang === 'en' ? defaultEn : (lang === 'zh' ? defaultZh : defaultVi);

  return formatReplyMarkup({
    keyboard: keyboard.length > 0 ? keyboard : defaultFallback,
    resize_keyboard: true
  });
};

export const sendMenu = async (bot, chatId, user, groupLinks = []) => {
  const { t } = await import('../helpers/langHelper.js');
  const { renderBotTemplate } = await import('../helpers/templateHelper.js');
  const { markdownToTelegramHtml, formatReplyMarkup } = await import('../helpers/telegramFormatHelper.js');
  const lang = user?.language || 'vi';
  if (user?.is_banned) {
    return bot.sendMessage(
      chatId,
      t('msg_account_banned', lang)
    );
  }

  // Tải cấu hình /start từ bảng settings
  let config = null;
  let shopName = 'DUCVIETSTORE';
  try {
    const rows = await query(
      "SELECT `key`, `value` FROM settings WHERE `key` IN ('start_menu_config', 'shop_name')"
    );
    rows.forEach((r) => {
      if (r.key === 'start_menu_config' && r.value) {
        try {
          config = JSON.parse(r.value);
        } catch {}
      } else if (r.key === 'shop_name' && r.value) {
        shopName = r.value;
      }
    });
  } catch (e) {
    console.error('[sendMenu] Error loading settings:', e.message);
  }

  if (!config) {
    config = {
      enabled: true,
      welcome_text: `👋 <b>Chào mừng {name} đến với {shop_name}!</b>\n\n📌 <b>ID Telegram:</b> <code>{id}</code>\n💰 <b>Số dư tài khoản:</b> {balance}\n🎁 <b>Điểm thưởng Credit:</b> {credit}\n\n👇 <i>Vui lòng chọn dịch vụ bên dưới hoặc sử dụng bàn phím:</i>`,
      image_url: '',
      buttons: [
        { id: 'zalo_group', text: '💬 Nhóm Zalo Hỗ Trợ', type: 'url', url: 'https://zalo.me', row: 1, is_active: true },
        { id: 'tele_channel', text: '📢 Kênh Telegram Update', type: 'url', url: 'https://t.me', row: 1, is_active: true },
        { id: 'website_link', text: '🌐 Website Shop', type: 'url', url: 'https://example.com', row: 2, is_active: true }
      ]
    };
  }

  const replyKeyboard = await buildMainKeyboard(t, lang);

  if (config && config.enabled !== false) {
    // Thay thế biến trong lời nhắn theo ngôn ngữ của user
    let rawTemplate = config.welcome_text || t('menu_title', lang);
    if (lang === 'en' && config.welcome_text_en) rawTemplate = config.welcome_text_en;
    else if (lang === 'zh' && config.welcome_text_zh) rawTemplate = config.welcome_text_zh;
    else if (config.welcome_text_vi) rawTemplate = config.welcome_text_vi;

    const userName = user?.username ? `@${user.username}` : (user?.first_name || user?.telegram_id || 'bạn');
    const messageHtml = markdownToTelegramHtml(renderBotTemplate(rawTemplate, {
      name: userName,
      username: userName,
      id: String(user?.telegram_id || chatId),
      balance: formatCurrency(user?.balance || 0),
      credit: String(user?.credit || 0),
      shop_name: shopName
    }));

    // Xây dựng danh sách nút inline theo hàng
    const activeButtons = Array.isArray(config.buttons) ? config.buttons.filter((b) => b.is_active) : [];
    const rowsMap = {};
    activeButtons.forEach((btn) => {
      const rowNum = Number(btn.row) || 1;
      if (!rowsMap[rowNum]) rowsMap[rowNum] = [];
      const btnText = (lang === 'en' && btn.text_en) || (lang === 'zh' && btn.text_zh) || btn.text_vi || btn.text;
      if (btn.type === 'url' && btn.url) {
        rowsMap[rowNum].push({ text: btnText, url: btn.url });
      } else if (btn.type === 'callback' && (btn.callback_data || btn.url)) {
        const rawCb = btn.callback_data || btn.url;
        let cbData = rawCb;
        if (rawCb === 'list_categories') {
          cbData = createCallbackData({ action: 'back_to_categories' });
        } else if (typeof rawCb === 'string' && rawCb.startsWith('category_products:')) {
          const catId = Number(rawCb.replace('category_products:', ''));
          cbData = createCallbackData({ action: 'category_products', catId });
        } else if (typeof rawCb === 'string' && rawCb.startsWith('view_product:')) {
          const productId = Number(rawCb.replace('view_product:', ''));
          cbData = createCallbackData({ action: 'view_product', productId });
        } else if (typeof rawCb === 'string' && !rawCb.startsWith('{')) {
          cbData = createCallbackData({ action: rawCb });
        }
        rowsMap[rowNum].push({ text: btnText, callback_data: cbData });
      }
    });

    const inline_keyboard = Object.keys(rowsMap)
      .sort((a, b) => Number(a) - Number(b))
      .map((r) => rowsMap[r]);

    const formattedInlineMarkup = formatReplyMarkup({ inline_keyboard });

    const options = {
      parse_mode: 'HTML'
    };
    if (formattedInlineMarkup?.inline_keyboard?.length > 0) {
      options.reply_markup = formattedInlineMarkup;
    }

    if (config.image_url && config.image_url.trim()) {
      try {
        await bot.sendPhoto(chatId, config.image_url.trim(), {
          caption: messageHtml,
          ...options
        });
      } catch (imgError) {
        console.warn('[sendMenu] Failed to send photo, fallback to text:', imgError.message);
        await sendTrackedMenu(bot, chatId, messageHtml, options);
      }
    } else {
      await sendTrackedMenu(bot, chatId, messageHtml, options);
    }

    // Gửi kèm Bàn phím chính dưới thanh chat (Hỗ trợ đa ngôn ngữ và tuỳ chỉnh qua Web Admin)
    let rawKbTemplate = await getBotTemplate('template_main_keyboard_caption', lang);
    if (!rawKbTemplate || !rawKbTemplate.trim()) {
      rawKbTemplate = t('main_menu_keyboard', lang) || (lang === 'en' ? '👇 <b>MAIN MENU KEYBOARD</b>' : (lang === 'zh' ? '👇 <b>主菜单键盘</b>' : '👇 <b>BÀN PHÍM MENU CHÍNH</b>'));
    }
    const kbText = markdownToTelegramHtml(renderBotTemplate(rawKbTemplate, {
      name: userName,
      username: userName,
      id: String(user?.telegram_id || chatId),
      shop_name: shopName
    }));
    return bot.sendMessage(chatId, kbText, {
      parse_mode: 'HTML',
      reply_markup: replyKeyboard
    });
  }

  // Mặc định nếu không có cấu hình tùy chỉnh
  await sendTrackedMenu(bot, chatId, t('menu_title', lang), {
    reply_markup: replyKeyboard
  });
};

export const getWalletButtonsConfig = async () => {
  try {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'wallet_buttons_config' LIMIT 1");
    if (rows && rows.length > 0 && rows[0].value) {
      const parsed = JSON.parse(rows[0].value);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [
    { id: 'btn_wal_deposit', text: 'Nạp tiền vào ví', text_vi: 'Nạp tiền vào ví', text_en: 'Deposit Funds', text_zh: '充值到钱包', type: 'callback', callback_data: 'start_deposit', row: 1, is_active: true },
    { id: 'btn_wal_history', text: 'Lịch sử nạp tiền', text_vi: 'Lịch sử nạp tiền', text_en: 'Deposit History', text_zh: '充值记录', type: 'callback', callback_data: 'deposit_history', row: 1, is_active: true },
    { id: 'btn_wal_products', text: 'Danh mục sản phẩm', text_vi: 'Danh mục sản phẩm', text_en: 'View Products', text_zh: '查看商品分类', type: 'callback', callback_data: 'list_categories', row: 2, is_active: true }
  ];
};

export const sendWalletMenu = async (bot, chatId, user, config = {}) => {
  const { createCallbackData } = await import('../../utils/index.js');
  const { getBotTemplate, renderBotTemplate } = await import('../helpers/templateHelper.js');
  const { formatReplyMarkup } = await import('../helpers/telegramFormatHelper.js');
  
  // Lấy thống kê nạp tiền & số dư
  let totalDeposited = 0;
  try {
    const depositStats = await query(
      `SELECT COUNT(*) as total_deposits, COALESCE(SUM(amount), 0) as total_deposited 
       FROM deposits WHERE user_id = ? AND status = 'approved'`,
      [user.id]
    );
    totalDeposited = depositStats?.[0]?.total_deposited || 0;
  } catch (_) {}

  const balanceStr = formatCurrency(user.balance || 0);
  const customerName = user.username ? `@${user.username}` : (user.first_name || 'Khách hàng');
  const telegramId = String(user.telegram_id || chatId);

  const lang = user?.language || 'vi';
  const rawTemplate = await getBotTemplate('template_wallet_info', lang);
  const text = renderBotTemplate(rawTemplate, {
    customerName,
    telegramId,
    balance: balanceStr,
    totalDeposited: formatCurrency(totalDeposited),
    credit: user.credit || 0
  });

  // Tải cấu hình nút bấm ví động
  const buttons = await getWalletButtonsConfig();
  const activeButtons = buttons.filter(b => b.is_active !== false);
  const rowsMap = {};
  activeButtons.forEach(btn => {
    const r = Number(btn.row) || 1;
    if (!rowsMap[r]) rowsMap[r] = [];
    const label = (lang === 'en' && btn.text_en) || (lang === 'zh' && btn.text_zh) || btn.text_vi || btn.text;
    if (btn.type === 'url' && btn.url) {
      rowsMap[r].push({ text: label, url: btn.url });
    } else {
      const cb = btn.callback_data || 'start_deposit';
      const cbData = cb.startsWith('{') ? cb : createCallbackData({ action: cb });
      rowsMap[r].push({ text: label, callback_data: cbData });
    }
  });

  const inline_keyboard = Object.keys(rowsMap)
    .sort((a, b) => Number(a) - Number(b))
    .map(r => rowsMap[r]);

  return bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: formatReplyMarkup({
      inline_keyboard: inline_keyboard.length > 0 ? inline_keyboard : [
        [
          { text: 'Nạp tiền vào ví', callback_data: createCallbackData({ action: 'start_deposit' }) },
          { text: 'Lịch sử nạp tiền', callback_data: createCallbackData({ action: 'deposit_history' }) }
        ],
        [
          { text: 'Danh mục sản phẩm', callback_data: createCallbackData({ action: 'list_categories' }) }
        ]
      ]
    })
  });
};

export const sendSupportMenu = async (bot, chatId, user) => {
  const { setCache } = await import('../../lib/cache/index.js');
  const { getBotTemplate, renderBotTemplate } = await import('../helpers/templateHelper.js');
  const userId = user?.telegram_id || chatId;
  const lang = user?.language || 'vi';
  setCache(`waiting_support_request_${userId}`, true, 10 * 60 * 1000);

  const rawTemplate = await getBotTemplate('template_support_info', lang);
  const text = renderBotTemplate(rawTemplate, {
    username: user?.username ? `@${user.username}` : '',
    userId
  });

  return bot.sendMessage(
    chatId,
    text,
    { parse_mode: 'Markdown' }
  );
};

export const sendApiMenu = async (bot, chatId, user) => {
  const { createCallbackData } = await import('../../utils/index.js');
  const { getBotTemplate, renderBotTemplate } = await import('../helpers/templateHelper.js');
  const crypto = await import('crypto');
  const lang = user?.language || 'vi';

  // Đảm bảo bảng user_api_keys tồn tại
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_api_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        api_key VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(100) DEFAULT 'API Key',
        permissions VARCHAR(255) DEFAULT 'all',
        is_active TINYINT(1) DEFAULT 1,
        last_used_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (_) {}

  // Lấy hoặc tạo API key
  let apiKey = '';
  let isActive = true;
  try {
    const rows = await query('SELECT * FROM user_api_keys WHERE user_id = ? LIMIT 1', [user.id]);
    if (rows && rows.length > 0) {
      apiKey = rows[0].api_key;
      isActive = Boolean(rows[0].is_active);
    } else {
      apiKey = `sk_${crypto.randomBytes(16).toString('hex')}`;
      await query(
        'INSERT INTO user_api_keys (user_id, api_key, name, permissions, is_active) VALUES (?, ?, ?, ?, 1)',
        [user.id, apiKey, 'API Key', 'all']
      );
    }
  } catch (e) {
    console.error('[sendApiMenu] Error getting api key:', e.message);
  }

  const rawTemplate = await getBotTemplate('template_api_info', lang);
  const text = renderBotTemplate(rawTemplate, {
    userId: user.id,
    telegramId: user.telegram_id || chatId,
    apiKey: apiKey || 'Chưa khởi tạo',
    balance: formatCurrency(user.balance || 0),
    statusText: isActive ? '✅ Active' : '❌ Inactive'
  });

  const regenBtn = lang === 'en' ? '🔄 Regenerate API Key' : (lang === 'zh' ? '🔄 重置 API Key' : '🔄 Đổi API Key mới');

  return bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: regenBtn, callback_data: createCallbackData({ action: 'regenerate_api_key' }) }
        ]
      ]
    }
  });
};

export const sendWarrantyMenu = async (bot, chatId, user) => {
  const { createCallbackData } = await import('../../utils/index.js');
  const { getBotTemplate, renderBotTemplate } = await import('../helpers/templateHelper.js');
  const lang = user?.language || 'vi';

  // Lấy 5 đơn hàng gần nhất
  let orderListStr = '';
  try {
    const orders = await query(
      `SELECT id, name, price, created_at FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 5`,
      [user.id]
    );
    if (orders && orders.length > 0) {
      orderListStr = orders.map((o) => {
        const timeStr = o.created_at ? new Date(o.created_at).toLocaleDateString('vi-VN') : '';
        return `• **#${o.id}** - ${o.name} (${formatCurrency(o.price)}) - ${timeStr}`;
      }).join('\n');
    }
  } catch (_) {}

  const emptyOrdersText = lang === 'en' ? '📋 *You do not have any recent orders.*' : (lang === 'zh' ? '📋 *您近期没有任何订单。*' : '📋 *Bạn chưa có đơn hàng nào.*');
  const recentOrdersLabel = lang === 'en' ? '📋 **Your recent orders:**\n' : (lang === 'zh' ? '📋 **您最近的订单:**\n' : '📋 **Đơn hàng gần đây của bạn:**\n');

  const orderListFormatted = orderListStr ? `${recentOrdersLabel}${orderListStr}\n` : emptyOrdersText;
  const rawTemplate = await getBotTemplate('template_warranty_info', lang);
  const text = renderBotTemplate(rawTemplate, {
    orderList: orderListFormatted
  });

  return bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛡️ Gửi yêu cầu bảo hành', callback_data: createCallbackData({ action: 'start_warranty' }) },
          { text: '🧾 Xem tất cả đơn hàng', callback_data: createCallbackData({ action: 'order_history' }) }
        ]
      ]
    }
  });
};

export const sendPurchaseMenu = async (bot, chatId, user) => {
  const { t } = await import('../helpers/langHelper.js');
  const { createCallbackData } = await import('../../utils/index.js');
  const lang = user?.language || 'vi';
  return sendTrackedMenu(bot, chatId, t('purchase_menu_title', lang), {
    reply_markup: {
      inline_keyboard: [
        [{ text: t('btn_buy_accounts', lang), callback_data: createCallbackData({ action: 'list_categories' }) }],
        [{ text: t('btn_order_history', lang), callback_data: createCallbackData({ action: 'order_history' }) }]
      ],
      keyboard: [
        [{ text: '🛍️ Sản phẩm' }, { text: '💬 Hỗ trợ' }],
        [{ text: '👛 Ví' }, { text: '🔗 API' }],
        [{ text: '🛡️ Bảo hành' }]
      ],
      resize_keyboard: true
    }
  });
};

export const sendUtilityMenu = async (bot, chatId, user = null) => {
  const { t } = await import('../helpers/langHelper.js');
  const lang = user?.language || 'vi';

  const keyboard = [
    [{ text: t('btn_check_live', lang) }, { text: t('btn_download_all', lang) }],
    [{ text: t('btn_main_menu', lang) }]
  ];

  return sendTrackedMenu(bot, chatId, t('utility_menu_title', lang), {
    reply_markup: {
      keyboard,
      resize_keyboard: true
    }
  });
};

export const sendOrderHistory = async (bot, chatId, userId) => {
  const { getUserById } = await import('../controllers/userController.js');
  const user = await getUserById(userId);
  const lang = user?.language || 'vi';

  const { rows } = await listOrdersByUser(userId, 0, 10);
  if (!rows || !rows.length) {
    const emptyMessages = {
      en: 'You have no order history yet.',
      zh: '您暂无购买记录。'
    };
    return bot.sendMessage(chatId, emptyMessages[lang] || 'Bạn chưa có lịch sử giao dịch mua hàng nào.');
  }

  const orderBlocks = rows.map((order) => {
    const purchased = String(order.email || '').split(/\r?\n/).filter((line) => line.includes('|'));
    const credentials = purchased.map((line, index) => {
      const [username = '', password = '', ...extra] = line.split('|');
      let result = `  TK ${index + 1}: ${username}\n  MK ${index + 1}: ${password}`;
      if (extra.length) result += `\n  Thông tin thêm: ${extra.join(' | ')}`;
      return result;
    }).join('\n');
    const time = order.created_at ? new Date(order.created_at).toLocaleString('vi-VN') : '';
    return `#${order.id} · ${order.name}\nGiá: ${formatCurrency(order.price)}\nThời gian: ${time}${credentials ? `\n${credentials}` : '\nKhông có TK/MK tự động'}`;
  });

  const chunks = [];
  let current = `🧾 10 GIAO DỊCH GẦN NHẤT HÔM NAY\n\n`;
  for (const block of orderBlocks) {
    if ((current + block).length > 3900) {
      chunks.push(current.trim());
      current = `${block}\n\n`;
    } else {
      current += `${block}\n\n`;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  for (const chunk of chunks) await bot.sendMessage(chatId, chunk);
};

export const sendOrderCredentials = async (bot, chatId, userId, orderId) => {
  const order = await getOrderByIdForUser(orderId, userId);
  if (!order) return bot.sendMessage(chatId, '❌ Không tìm thấy đơn hàng này.');
  if (!order.email || !String(order.email).includes('|')) {
    return bot.sendMessage(chatId, 'Đơn hàng này không có tài khoản tự động để xem lại.');
  }

  const accounts = String(order.email).split(/\r?\n/).filter(Boolean);
  const details = accounts.map((line, index) => {
    const [username = '', password = '', ...extra] = line.split('|');
    let item = `Tài khoản ${index + 1}:\nTK: ${username}\nMK: ${password}`;
    if (extra.length) item += `\nThông tin thêm: ${extra.join(' | ')}`;
    return item;
  }).join('\n\n');

  return bot.sendMessage(chatId, `🔐 THÔNG TIN ĐÃ MUA\n\nĐơn: #${order.id}\nSản phẩm: ${order.name}\n\n${details}`);
};

export const getUserCache = async (telegramId) => {
  return await getUserByTelegram(telegramId);
};

export const sendUserInfo = async (bot, chatId, user) => {
  try {
    // Lấy thống kê đơn hàng
    const orderStats = await query(
      `SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(price), 0) as total_spent
       FROM orders 
       WHERE user_id = ?`,
      [user.id]
    );
    const { total_orders, total_spent } = orderStats[0] || { total_orders: 0, total_spent: 0 };

    // Lấy thống kê nạp tiền
    const depositStats = await query(
      `SELECT 
        COUNT(*) as total_deposits,
        COALESCE(SUM(amount), 0) as total_deposited
       FROM deposits 
       WHERE user_id = ? AND status = 'approved'`,
      [user.id]
    );
    const { total_deposits, total_deposited } = depositStats[0] || { total_deposits: 0, total_deposited: 0 };

    // Format ngày tạo tài khoản
    const createdDate = user.created_at
      ? new Date(user.created_at).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
      : 'N/A';

    const lang = user.language || 'vi';
    const noUsername = { en: 'Not set', zh: '未设置' };
    const username = user.username ? `@${user.username}` : (noUsername[lang] || 'Chưa có');
    const credit = user.credit || 0;

    // Lấy thống kê check-in
    const checkinStats = await query(
      `SELECT COUNT(*) as total_checkins FROM checkins WHERE user_id = ?`,
      [user.id]
    );
    const total_checkins = checkinStats[0]?.total_checkins || 0;

    // Lấy thống kê referral
    const referralStats = await query(
      `SELECT 
        COUNT(*) as total_referrals,
        SUM(credit_rewarded) as total_credits_earned
       FROM referrals 
       WHERE referrer_id = ?`,
      [user.id]
    );
    const { total_referrals, total_credits_earned } = referralStats[0] || { total_referrals: 0, total_credits_earned: 0 };

    const infoTexts = {
      en: `📊 **ACCOUNT INFORMATION**

👤 **Personal Info:**
• ID: \`${user.telegram_id}\`
• Username: ${username}
• Created: ${createdDate}

💰 **Balance:**
• Current balance: ${formatCurrency(user.balance)}
• Credit: ${credit}

🎁 **Credit Stats:**
• Total check-ins: ${total_checkins}
• Total referrals: ${total_referrals}
• Credits from referrals: ${total_credits_earned || 0}

📦 **Order Stats:**
• Total orders: ${total_orders}
• Total spent: ${formatCurrency(total_spent)}

💵 **Deposit Stats:**
• Total deposits: ${total_deposits}
• Total deposited: ${formatCurrency(total_deposited)}`,
      zh: `📊 **账户信息**

👤 **个人信息：**
• ID: \`${user.telegram_id}\`
• 用户名: ${username}
• 创建日期: ${createdDate}

💰 **余额：**
• 当前余额: ${formatCurrency(user.balance)}
• 积分: ${credit}

🎁 **积分统计：**
• 签到次数: ${total_checkins}
• 推荐人数: ${total_referrals}
• 推荐积分: ${total_credits_earned || 0}

📦 **订单统计：**
• 总订单: ${total_orders}
• 总消费: ${formatCurrency(total_spent)}

💵 **充值统计：**
• 充值次数: ${total_deposits}
• 充值总额: ${formatCurrency(total_deposited)}`
    };

    const infoText = infoTexts[lang] || `📊 **THÔNG TIN TÀI KHOẢN**

👤 **Thông tin cá nhân:**
• ID: \`${user.telegram_id}\`
• Username: ${username}
• Ngày tạo: ${createdDate}

💰 **Số dư:**
• Số dư hiện tại: ${formatCurrency(user.balance)}
• Credit: ${credit}

🎁 **Thống kê Credit:**
• Tổng lần check-in: ${total_checkins}
• Tổng người giới thiệu: ${total_referrals}
• Credit từ giới thiệu: ${total_credits_earned || 0}

📦 **Thống kê đơn hàng:**
• Tổng đơn hàng: ${total_orders}
• Tổng đã chi: ${formatCurrency(total_spent)}

💵 **Thống kê nạp tiền:**
• Tổng lần nạp: ${total_deposits}
• Tổng đã nạp: ${formatCurrency(total_deposited)}`;

    await bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('[SEND_USER_INFO] Error:', error);
    const errorMsgs = { en: 'Error loading info. Please try again.', zh: '加载信息出错，请重试。' };
    await bot.sendMessage(chatId, errorMsgs[user?.language] || 'Có lỗi xảy ra khi lấy thông tin. Vui lòng thử lại sau.');
  }
};
