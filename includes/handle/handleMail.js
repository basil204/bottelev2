import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUserByTelegram, updateBalance } from '../controllers/userController.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { formatCurrency, createCallbackData } from '../../utils/index.js';
import { notifyAdminAboutPurchase } from './handleNotify.js';
import { globalConfig } from '../listen.js';

import { config } from '../../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAIL_API_KEY = config.MAIL_API_KEY || 'uJ5ktBJ19znIA77z709JaQnlN'; // Fallback for safety during migration, but ideally should be env only
const MAIL_API_BASE = config.MAIL_API_BASE;
const ALLOWED_ACCOUNT_TYPES = [5, 6]; // Chỉ lấy Hotmail TRUSTED và Outlook TRUSTED

// Lấy danh sách loại mail từ API
export const getMailTypes = async () => {
  try {
    const response = await axios.get(`${MAIL_API_BASE}/user/account_type`, {
      params: { apikey: MAIL_API_KEY },
      timeout: 10000
    });

    if (response.data?.status && response.data?.data) {
      // Chỉ lấy id 5 và 6
      const filtered = response.data.data.filter(item => ALLOWED_ACCOUNT_TYPES.includes(item.id));
      return filtered;
    }
    return [];
  } catch (error) {
    return [];
  }
};

// Hiển thị menu chọn loại mail
export const showMailMenu = async (bot, chatId) => {
  try {
    const mailTypes = await getMailTypes();

    if (mailTypes.length === 0) {
      return bot.sendMessage(chatId, '❌ Không thể lấy danh sách mail. Vui lòng thử lại sau.');
    }

    const inline_keyboard = mailTypes.map((type) => [
      {
        text: `${type.name} - ${formatCurrency(type.price * 2)} (còn ${type.quality})`,
        callback_data: createCallbackData({ a: 'mail_sel', t: type.id, p: type.price })
      }
    ]);

    await bot.sendMessage(
      chatId,
      '📧 **Chọn loại mail:**',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard }
      }
    );
  } catch (error) {
    console.error('[SHOW_MAIL_MENU] Lỗi:', error);
    await bot.sendMessage(chatId, '❌ Có lỗi xảy ra. Vui lòng thử lại sau.');
  }
};

// Xử lý khi user chọn loại mail
export const handleMailTypeSelection = async (bot, chatId, userId, accountType, apiPrice) => {
  try {
    const user = await getUserByTelegram(userId);
    if (!user) {
      return bot.sendMessage(chatId, 'Vui lòng /start để tạo tài khoản.');
    }

    // Lấy lại thông tin mail type để có name
    const mailTypes = await getMailTypes();
    const selectedType = mailTypes.find(t => t.id === accountType);
    if (!selectedType) {
      return bot.sendMessage(chatId, '❌ Loại mail không hợp lệ.');
    }

    // Tính giá bán (API price * 2)
    const sellPrice = apiPrice * 2;

    await bot.sendMessage(
      chatId,
      `📧 **${selectedType.name}**\n\n💰 Giá: ${formatCurrency(sellPrice)}/tài khoản\n\nNhập số lượng cần mua (1-100):`,
      { parse_mode: 'Markdown' }
    );

    // Lưu state để xử lý input số lượng
    const { getCache, setCache } = await import('../../lib/cache/index.js');
    const mailStateKey = `mail_state_${userId}`;
    setCache(mailStateKey, { accountType, name: selectedType.name, apiPrice, sellPrice }, 5 * 60 * 1000); // 5 phút
  } catch (error) {
    console.error('[HANDLE_MAIL_TYPE_SELECTION] Lỗi:', error);
    await bot.sendMessage(chatId, '❌ Có lỗi xảy ra. Vui lòng thử lại sau.');
  }
};

// Xử lý input số lượng
export const handleMailQuantityInput = async (bot, msg, user) => {
  try {
    const { getCache, delCache } = await import('../../lib/cache/index.js');
    const mailStateKey = `mail_state_${msg.from.id}`;
    const state = getCache(mailStateKey);

    if (!state) {
      return false; // Không có state, bỏ qua
    }

    const quantity = parseInt(msg.text);
    if (isNaN(quantity) || quantity < 1 || quantity > 100) {
      return bot.sendMessage(msg.chat.id, '❌ Số lượng không hợp lệ. Vui lòng nhập số từ 1 đến 100.');
    }

    const { accountType, name, apiPrice, sellPrice } = state;
    const totalPrice = sellPrice * quantity;

    // Lấy lại số dư mới nhất trước khi kiểm tra để đảm bảo chính xác
    const currentUser = await getUserByTelegram(msg.from.id);
    if (!currentUser) {
      delCache(mailStateKey);
      return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy user. Vui lòng /start để tạo tài khoản.');
    }

    const currentBalance = Number(currentUser.balance) || 0;

    // Kiểm tra số dư
    if (currentBalance < totalPrice) {
      return bot.sendMessage(
        msg.chat.id,
        `❌ **Số dư không đủ!**\n\n` +
        `💵 Cần: ${formatCurrency(totalPrice)}\n` +
        `💰 Bạn có: ${formatCurrency(currentBalance)}\n\n` +
        `💡 Vui lòng nạp thêm tiền để tiếp tục.`,
        { parse_mode: 'Markdown' }
      );
    }

    // Xóa state
    delCache(mailStateKey);

    // Thông báo đang mua
    await bot.sendMessage(msg.chat.id, `⏳ Đang mua ${quantity} tài khoản ${name}...`);

    // Gọi API mua
    const result = await buyMailFromAPI(accountType, quantity);

    if (!result || !result.success) {
      return bot.sendMessage(
        msg.chat.id,
        `❌ Không thể mua mail. ${result?.message || 'Vui lòng thử lại sau.'}`
      );
    }

    // Trừ tiền (đã kiểm tra số dư ở trên)
    await updateBalance(currentUser.id, -totalPrice);
    await addBalanceLog({
      userId: currentUser.id,
      amount: -totalPrice,
      reason: `buy_mail_${accountType}_${quantity}`,
      adminId: null
    });

    // Notify admins
    const adminIds = globalConfig?.ADMIN_IDS || [];
    if (adminIds.length > 0) {
      const updatedUser = await getUserByTelegram(currentUser.telegram_id);
      notifyAdminAboutPurchase(bot, adminIds, {
        orderId: result.data.order_code || 'MAIL_API',
        productName: `Mail ${name}`,
        username: currentUser.username,
        telegramId: currentUser.telegram_id,
        quantity: quantity,
        price: totalPrice,
        finalBalance: Number(updatedUser.balance)
      });
    }

    // Không tạo order vì mail không có product_id (orders table yêu cầu product_id NOT NULL)
    // Thông tin đã được log vào balance_logs

    // Parse accounts từ list_data
    const accounts = parseMailAccounts(result.data.list_data);

    // Tạo file tạm thời
    console.log(`[BUY_MAIL] Đang tạo file tài khoản...`);
    const fileContent = createMailAccountFile(accounts);
    const fileName = `mail_${accountType}_${quantity}_${Date.now()}.txt`;
    const tempFilePath = path.join(__dirname, '../../temp', fileName);

    // Đảm bảo thư mục temp tồn tại
    const tempDir = path.dirname(tempFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Ghi file tạm thời
    fs.writeFileSync(tempFilePath, fileContent, 'utf8');

    try {
      // Gửi file từ đường dẫn
      const caption = `✅ **Mua mail thành công!**\n\n` +
        `📧 Loại: ${name}\n` +
        `📦 Số lượng: ${quantity}\n` +
        `💰 Tổng tiền: ${formatCurrency(totalPrice)}\n` +
        `📝 Mã đơn: ${result.data.order_code}`;

      await bot.sendDocument(msg.chat.id, tempFilePath, {
        caption: caption,
        parse_mode: 'Markdown'
      });
      console.log(`[BUY_MAIL] ✅ Đã gửi file tài khoản thành công`);
    } catch (sendError) {
      console.error(`[BUY_MAIL] ❌ Lỗi khi gửi file:`, sendError);
      // Nếu không gửi được file, gửi thông tin account qua text
      const accountText = accounts.map(acc => `${acc.email}|${acc.password}`).join('\n');
      let messageText = `✅ Mua mail thành công!\n\n`;
      messageText += `📧 Loại: ${name}\n`;
      messageText += `📦 Số lượng: ${quantity}\n`;
      messageText += `💰 Tổng tiền: ${formatCurrency(totalPrice)}\n`;
      messageText += `📝 Mã đơn: ${result.data.order_code}\n\n`;
      messageText += `📋 Danh sách tài khoản:\n\n${accountText}`;
      await bot.sendMessage(msg.chat.id, messageText);
    } finally {
      // Xóa file tạm thời sau khi gửi
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

    return true; // Đã xử lý thành công

  } catch (error) {
    console.error('[HANDLE_MAIL_QUANTITY_INPUT] Lỗi:', error);
    await bot.sendMessage(msg.chat.id, '❌ Có lỗi xảy ra khi mua mail. Vui lòng thử lại sau.');
    return false;
  }
};

// Gọi API mua mail
const buyMailFromAPI = async (accountType, quantity) => {
  try {
    const response = await axios.get(`${MAIL_API_BASE}/user/buy`, {
      params: {
        apikey: MAIL_API_KEY,
        account_type: accountType,
        quality: quantity,
        type: 'full' // Lấy full info
      },
      timeout: 30000
    });

    if (response.data?.status && response.data?.error_code === 200) {
      return { success: true, data: response.data.data };
    }

    return {
      success: false,
      message: response.data?.message || 'Không thể mua mail'
    };
  } catch (error) {
    console.error('[BUY_MAIL_FROM_API] Lỗi:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Lỗi khi gọi API'
    };
  }
};

// Tạo file text với thông tin accounts
const createMailAccountFile = (accounts) => {
  const content = accounts.map(acc => {
    let line = `${acc.email}|${acc.password}`;
    if (acc.cookie) {
      line += `|${acc.cookie}`;
    }
    if (acc.recoveryId) {
      line += `|${acc.recoveryId}`;
    }
    return line;
  }).join('\n');
  return content;
};

// Parse accounts từ list_data
const parseMailAccounts = (listData) => {
  if (!Array.isArray(listData)) {
    return [];
  }

  return listData.map((item) => {
    // Format: email|password|cookie|recoveryId
    const parts = item.split('|');
    return {
      email: parts[0] || '',
      password: parts[1] || '',
      cookie: parts[2] || null,
      recoveryId: parts[3] || null
    };
  });
};

