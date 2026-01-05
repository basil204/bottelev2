import { getUserByTelegram, updateBalance } from '../controllers/userController.js';
import { 
  createGmailAccountForSale,
  getAvailableDomains
} from '../controllers/gmailAccountController.js';
import { getActiveVipPackage, incrementVipUsage } from '../controllers/vipPackageController.js';
import { createOrder } from '../controllers/orderController.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { formatCurrency, createCallbackData } from '../../utils/index.js';
import { logEvent, logError } from '../../utils/log.js';
import { checkAccountLoginStatus, scheduleAccountDeletion } from '../services/gmailAutoDelete.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { getGmailPrice } from '../controllers/gmailPricingController.js';

// Tính giá dựa trên số lượng và loại (lấy từ database)
const calculatePrice = async (type, duration, quantity) => {
  try {
    const price = await getGmailPrice(type, duration, quantity);
    return price;
  } catch (error) {
    console.error('[CALCULATE_PRICE] Lỗi khi lấy giá:', error);
    // Fallback về giá mặc định
    const defaultPricing = {
      edu: { single: { 1: 700, 10: 6500 }, daily: { 1: 4000, 10: 35000 } },
      non: { single: { 1: 4000, 10: 35000 }, daily: { 1: 4000, 10: 35000 } }
    };
    const pricing = defaultPricing[type]?.[duration];
    if (!pricing) return null;
    if (quantity >= 10) {
      return pricing[10] * Math.ceil(quantity / 10);
    }
    return pricing[1] * quantity;
  }
};

// Tạo file text với thông tin accounts
const createAccountFile = (accounts) => {
  const content = accounts.map(acc => `${acc.email}|${acc.password}`).join('\n');
  return content;
};

// Mua Gmail account (single) - Tạo mới qua API
export const buyGmailAccount = async (bot, msg, type, quantity = 1) => {
  try {
    const user = await getUserByTelegram(msg.from.id);
    if (!user) {
      return bot.sendMessage(msg.chat.id, 'Vui lòng /start để tạo tài khoản.');
    }

    // Kiểm tra VIP package
    const vipPackage = await getActiveVipPackage(user.id);
    const useVipPackage = vipPackage && (vipPackage.used_gmail + quantity <= vipPackage.total_gmail);
    
    let price = 0;
    let paymentMethod = 'balance'; // 'vip' or 'balance'
    
    if (useVipPackage) {
      // Sử dụng VIP package
      paymentMethod = 'vip';
      console.log(`[BUY_GMAIL] User ${user.id} (${msg.from.id}) sử dụng VIP package: ${vipPackage.used_gmail + quantity}/${vipPackage.total_gmail}`);
    } else {
      // Nếu không có VIP hoặc đã hết quota, tính giá bình thường
      price = await calculatePrice(type, 'single', quantity);
      if (price === null) {
        return bot.sendMessage(msg.chat.id, 'Loại tài khoản không hợp lệ.');
      }

      if (Number(user.balance) < price) {
        const remaining = vipPackage ? (vipPackage.total_gmail - vipPackage.used_gmail) : 0;
        const vipInfo = vipPackage ? `\n\n📦 Gói VIP: Đã dùng ${vipPackage.used_gmail}/${vipPackage.total_gmail} (còn ${remaining})` : '';
        return bot.sendMessage(msg.chat.id, `Số dư không đủ. Cần ${formatCurrency(price)}, bạn có ${formatCurrency(user.balance)}.${vipInfo}`);
      }
    }

    // Thông báo đang tạo account
    const priceInfo = paymentMethod === 'vip' ? 'sử dụng gói VIP' : `giá: ${formatCurrency(price)}`;
    console.log(`[BUY_GMAIL] User ${user.id} (${msg.from.id}) mua ${quantity} ${type} account(s), ${priceInfo}`);
    await bot.sendMessage(msg.chat.id, `⏳ Đang tạo ${quantity} tài khoản ${type === 'edu' ? 'Gmail Edu' : 'Google Non'}...`);

    // Lấy domain từ API
    console.log(`[BUY_GMAIL] Đang lấy domain cho type: ${type}`);
    const domains = await getAvailableDomains(type);
    console.log(`[BUY_GMAIL] Domains tìm được:`, domains);
    if (!domains || domains.length === 0) {
      console.error(`[BUY_GMAIL] Không tìm thấy domain nào cho ${type}`);
      return bot.sendMessage(msg.chat.id, `❌ Không tìm thấy domain nào cho ${type === 'edu' ? 'Gmail Edu' : 'Google Non'}.`);
    }
    // Tạo accounts mới qua API
    // Gmail Edu: chỉ dùng domain index 0
    // Google Non: random domain cho mỗi account
    const accounts = [];
    const password = 'Vietcombank9338739954';
    
    for (let i = 0; i < quantity; i++) {
      // Gmail Edu: dùng domain đầu tiên (index 0)
      // Google Non: random domain
      let domain;
      if (type === 'edu') {
        domain = domains[0];
        console.log(`[BUY_GMAIL] Đang tạo account ${i + 1}/${quantity} (${type}, domain: ${domain} - index: 0/${domains.length})`);
      } else {
        const randomIndex = Math.floor(Math.random() * domains.length);
        domain = domains[randomIndex];
        console.log(`[BUY_GMAIL] Đang tạo account ${i + 1}/${quantity} (${type}, domain: ${domain} - random index: ${randomIndex}/${domains.length})`);
      }
      const result = await createGmailAccountForSale(type, domain, password);
      if (!result.success) {
        console.error(`[BUY_GMAIL] Lỗi khi tạo account ${i + 1}: ${result.error}`);
        // Nếu có lỗi, rollback: hoàn tiền cho những account đã tạo thành công (chỉ nếu thanh toán bằng balance)
        // Note: Nếu dùng VIP, không cần rollback vì chưa gọi incrementVipUsage
        if (accounts.length > 0 && paymentMethod === 'balance') {
          const refundAmount = await calculatePrice(type, 'single', accounts.length);
          console.log(`[BUY_GMAIL] Hoàn tiền ${refundAmount} cho ${accounts.length} account đã tạo`);
          await updateBalance(user.id, refundAmount);
        }
        return bot.sendMessage(msg.chat.id, `❌ Lỗi khi tạo tài khoản: ${result.error}`);
      }
      console.log(`[BUY_GMAIL] ✅ Tạo thành công account ${i + 1}: ${result.email}`);
      accounts.push({
        email: result.email,
        password: result.password
      });
      
      // Delay nhỏ để tránh rate limit
      if (i < quantity - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    console.log(`[BUY_GMAIL] ✅ Hoàn thành tạo ${accounts.length} account(s)`);

    // Kiểm tra accounts có dữ liệu không
    if (!accounts || accounts.length === 0) {
      console.error(`[BUY_GMAIL] ❌ Không có account nào được tạo thành công`);
      return bot.sendMessage(msg.chat.id, `❌ Lỗi: Không có account nào được tạo thành công.`);
    }

    // Thanh toán: Trừ tiền hoặc trừ VIP quota
    try {
      if (paymentMethod === 'vip' && vipPackage) {
        // Trừ VIP quota cho từng account
        for (const account of accounts) {
          await incrementVipUsage(vipPackage.id, account.email);
        }
        // Lấy lại VIP package để có số liệu chính xác
        const { query } = await import('../database/index.js');
        const [updatedPkg] = await query('SELECT * FROM vip_packages WHERE id = ?', [vipPackage.id]);
        const remaining = updatedPkg ? (updatedPkg.total_gmail - updatedPkg.used_gmail) : 0;
        console.log(`[BUY_GMAIL] ✅ Đã sử dụng ${quantity} quota từ VIP package (còn ${remaining}/${vipPackage.total_gmail})`);
      } else {
        // Trừ tiền từ balance
        await updateBalance(user.id, -price);
        await addBalanceLog({
          userId: user.id,
          amount: -price,
          reason: `buy_gmail_${type}_single_${quantity}`,
          adminId: null
        });
        console.log(`[BUY_GMAIL] ✅ Đã trừ tiền: ${formatCurrency(price)}`);
      }
    } catch (error) {
      console.error(`[BUY_GMAIL] ❌ Lỗi khi thanh toán:`, error);
      // Vẫn tiếp tục gửi file dù có lỗi thanh toán
    }

    // Tạo file tạm thời
    console.log(`[BUY_GMAIL] Đang tạo file tài khoản...`);
    const fileContent = createAccountFile(accounts);
    const fileName = `gmail_${type}_${quantity}_${Date.now()}.txt`;
    const tempFilePath = path.join(__dirname, '../../temp', fileName);
    
    // Đảm bảo thư mục temp tồn tại
    const tempDir = path.dirname(tempFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Ghi file tạm thời
    fs.writeFileSync(tempFilePath, fileContent, 'utf8');
    console.log(`[BUY_GMAIL] ✅ Đã tạo file: ${tempFilePath}`);
    
    try {
      // Gửi file từ đường dẫn
      console.log(`[BUY_GMAIL] Đang gửi file tài khoản...`);
      // Tạo caption với thông tin VIP
      let caption = `✅ Mua thành công ${quantity} tài khoản ${type === 'edu' ? 'Gmail Edu' : 'Google Non'}\n`;
      if (paymentMethod === 'vip' && vipPackage) {
        // Lấy lại VIP package để có số liệu chính xác
        const { query } = await import('../database/index.js');
        const [updatedPkg] = await query('SELECT * FROM vip_packages WHERE id = ?', [vipPackage.id]);
        const remaining = updatedPkg ? (updatedPkg.total_gmail - updatedPkg.used_gmail) : 0;
        caption += `📦 Sử dụng gói VIP (còn ${remaining}/${vipPackage.total_gmail})\n`;
      } else {
        caption += `💰 Giá: ${formatCurrency(price)}\n`;
      }
      caption += `📧 Số lượng: ${quantity} account(s)`;
      
      await bot.sendDocument(msg.chat.id, tempFilePath, {
        caption: caption
      });
      console.log(`[BUY_GMAIL] ✅ Đã gửi file tài khoản thành công`);
    } catch (sendError) {
      console.error(`[BUY_GMAIL] ❌ Lỗi khi gửi file:`, sendError);
      // Nếu không gửi được file, gửi thông tin account qua text
      const accountText = accounts.map(acc => `${acc.email}|${acc.password}`).join('\n');
      let messageText = `✅ Mua thành công ${quantity} tài khoản ${type === 'edu' ? 'Gmail Edu' : 'Google Non'}\n`;
      if (paymentMethod === 'vip' && vipPackage) {
        // Lấy lại VIP package để có số liệu chính xác
        const { query } = await import('../database/index.js');
        const [updatedPkg] = await query('SELECT * FROM vip_packages WHERE id = ?', [vipPackage.id]);
        const remaining = updatedPkg ? (updatedPkg.total_gmail - updatedPkg.used_gmail) : 0;
        messageText += `📦 Sử dụng gói VIP (còn ${remaining}/${vipPackage.total_gmail})\n`;
      } else {
        messageText += `💰 Giá: ${formatCurrency(price)}\n`;
      }
      messageText += `\n📧 Thông tin tài khoản:\n\`\`\`\n${accountText}\n\`\`\``;
      await bot.sendMessage(msg.chat.id, messageText, { parse_mode: 'Markdown' });
    } finally {
      // Xóa file tạm thời sau khi gửi
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log(`[BUY_GMAIL] ✅ Đã xóa file tạm: ${tempFilePath}`);
        }
      } catch (cleanupError) {
        console.error(`[BUY_GMAIL] ⚠️ Lỗi khi xóa file tạm:`, cleanupError);
      }
    }

    // Check login status và schedule deletion nếu đã login (60 phút) - chạy sau khi gửi file
    console.log(`[BUY_GMAIL] Bắt đầu check login status cho các account...`);
    for (const account of accounts) {
      try {
        console.log(`[BUY_GMAIL] Checking login status for ${account.email} (type: ${type})...`);
        const loginStatus = await checkAccountLoginStatus(account.email, type);
        
        if (loginStatus.isLoggedIn && loginStatus.lastLoginTime) {
          console.log(`[BUY_GMAIL] Account ${account.email} đã login (lastLoginTime: ${loginStatus.lastLoginTime}), schedule xóa`);
          await scheduleAccountDeletion(account.email, type, loginStatus.lastLoginTime);
        } else {
          console.log(`[BUY_GMAIL] Account ${account.email} chưa login, không schedule xóa`);
        }
      } catch (error) {
        console.error(`[BUY_GMAIL] ⚠️ Error checking login status for ${account.email}:`, error);
        // Không throw error, chỉ log để không ảnh hưởng đến việc gửi file
      }
    }

    logEvent('gmail_account_sold', { 
      userId: user.id, 
      type, 
      quantity, 
      price: paymentMethod === 'vip' ? 0 : price,
      paymentMethod,
      vipPackageId: paymentMethod === 'vip' ? vipPackage.id : null,
      accounts: accounts.map(a => a.email)
    });

  } catch (error) {
    logError({ context: 'buyGmailAccount', error: error.message });
    bot.sendMessage(msg.chat.id, 'Có lỗi xảy ra khi mua tài khoản.');
  }
};

// Mua Gmail account (daily - 1 ngày) - Tạo mới qua API
export const buyGmailAccountDaily = async (bot, msg, type, quantity = 1) => {
  try {
    const user = await getUserByTelegram(msg.from.id);
    if (!user) {
      return bot.sendMessage(msg.chat.id, 'Vui lòng /start để tạo tài khoản.');
    }

    const price = await calculatePrice(type, 'daily', quantity);
    if (price === null) {
      return bot.sendMessage(msg.chat.id, 'Loại tài khoản không hợp lệ.');
    }

    if (Number(user.balance) < price) {
      return bot.sendMessage(msg.chat.id, `Số dư không đủ. Cần ${formatCurrency(price)}, bạn có ${formatCurrency(user.balance)}.`);
    }

    // Thông báo đang tạo account
    console.log(`[BUY_GMAIL_DAILY] User ${user.id} (${msg.from.id}) mua ${quantity} ${type} account(s) (daily), giá: ${price}`);
    await bot.sendMessage(msg.chat.id, `⏳ Đang tạo ${quantity} tài khoản ${type === 'edu' ? 'Gmail Edu' : 'Google Non'}...`);

    // Lấy domain từ API
    console.log(`[BUY_GMAIL_DAILY] Đang lấy domain cho type: ${type}`);
    const domains = await getAvailableDomains(type);
    console.log(`[BUY_GMAIL_DAILY] Domains tìm được:`, domains);
    if (!domains || domains.length === 0) {
      console.error(`[BUY_GMAIL_DAILY] Không tìm thấy domain nào cho ${type}`);
      return bot.sendMessage(msg.chat.id, `❌ Không tìm thấy domain nào cho ${type === 'edu' ? 'Gmail Edu' : 'Google Non'}.`);
    }
    // Tạo accounts mới qua API
    // Gmail Edu: chỉ dùng domain index 0
    // Google Non: random domain cho mỗi account
    const accounts = [];
    const password = 'Vietcombank9338739954';
    
    for (let i = 0; i < quantity; i++) {
      // Gmail Edu: dùng domain đầu tiên (index 0)
      // Google Non: random domain
      let domain;
      if (type === 'edu') {
        domain = domains[0];
        console.log(`[BUY_GMAIL_DAILY] Đang tạo account ${i + 1}/${quantity} (${type}, domain: ${domain} - index: 0/${domains.length})`);
      } else {
        const randomIndex = Math.floor(Math.random() * domains.length);
        domain = domains[randomIndex];
        console.log(`[BUY_GMAIL_DAILY] Đang tạo account ${i + 1}/${quantity} (${type}, domain: ${domain} - random index: ${randomIndex}/${domains.length})`);
      }
      const result = await createGmailAccountForSale(type, domain, password);
      if (!result.success) {
        console.error(`[BUY_GMAIL_DAILY] Lỗi khi tạo account ${i + 1}: ${result.error}`);
        // Nếu có lỗi, rollback: hoàn tiền cho những account đã tạo thành công
        if (accounts.length > 0) {
          const refundAmount = await calculatePrice(type, 'daily', accounts.length);
          console.log(`[BUY_GMAIL_DAILY] Hoàn tiền ${refundAmount} cho ${accounts.length} account đã tạo`);
          await updateBalance(user.id, refundAmount);
        }
        return bot.sendMessage(msg.chat.id, `❌ Lỗi khi tạo tài khoản: ${result.error}`);
      }
      console.log(`[BUY_GMAIL_DAILY] ✅ Tạo thành công account ${i + 1}: ${result.email}`);
      accounts.push({
        email: result.email,
        password: result.password
      });
      
      // Delay nhỏ để tránh rate limit
      if (i < quantity - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    console.log(`[BUY_GMAIL_DAILY] ✅ Hoàn thành tạo ${accounts.length} account(s)`);

    // Check login status và schedule deletion nếu đã login (60 phút)
    for (const account of accounts) {
      try {
        console.log(`[BUY_GMAIL_DAILY] Checking login status for ${account.email} (type: ${type})...`);
        const loginStatus = await checkAccountLoginStatus(account.email, type);
        
        if (loginStatus.isLoggedIn && loginStatus.lastLoginTime) {
          console.log(`[BUY_GMAIL_DAILY] Account ${account.email} đã login (lastLoginTime: ${loginStatus.lastLoginTime}), schedule xóa`);
          await scheduleAccountDeletion(account.email, type, loginStatus.lastLoginTime);
        } else {
          console.log(`[BUY_GMAIL_DAILY] Account ${account.email} chưa login, không schedule xóa`);
        }
      } catch (error) {
        console.error(`[BUY_GMAIL_DAILY] Error checking login status for ${account.email}:`, error);
      }
    }

    // Trừ tiền sau khi tạo thành công
    await updateBalance(user.id, -price);
    await addBalanceLog({
      userId: user.id,
      amount: -price,
      reason: `buy_gmail_${type}_daily_${quantity}`,
      adminId: null
    });

    // Tạo file tạm thời
    const fileContent = createAccountFile(accounts);
    const fileName = `gmail_${type}_daily_${quantity}_${Date.now()}.txt`;
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
      await bot.sendDocument(msg.chat.id, tempFilePath, {
        caption: `✅ Mua thành công ${quantity} tài khoản ${type === 'edu' ? 'Gmail Edu' : 'Google Non'} (1 ngày)\n` +
                 `💰 Giá: ${formatCurrency(price)}\n` +
                 `📧 Số lượng: ${quantity} account(s)`
      });
    } finally {
      // Xóa file tạm thời sau khi gửi
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

    logEvent('gmail_account_sold_daily', { 
      userId: user.id, 
      type, 
      quantity, 
      price,
      accounts: accounts.map(a => a.email)
    });

  } catch (error) {
    logError({ context: 'buyGmailAccountDaily', error: error.message });
    bot.sendMessage(msg.chat.id, 'Có lỗi xảy ra khi mua tài khoản.');
  }
};

// Map để lưu trạng thái đang chờ input quantity từ user
const waitingForQuantity = new Map();

// Hiển thị menu mua Gmail - chỉ chọn Edu hoặc Non
export const showGmailMenu = async (bot, chatId) => {
  // Không cần kiểm tra tồn kho vì sẽ tạo mới qua API
  const eduCount = 'Unlimited';
  const nonCount = 'Unlimited';

  // Lấy giá từ database
  const eduPrice = await getGmailPrice('edu', 'single', 1);
  const nonPrice = await getGmailPrice('non', 'single', 1);

  const menuText = `🛒 **Mua Gmail Accounts**

**📧 Gmail Edu:**
• Giá: ${formatCurrency(eduPrice)} / 1 account
📦 Tồn kho: ${eduCount} account(s)

**🌐 Google Non:**
• Giá: ${formatCurrency(nonPrice)} / 1 account
📦 Tồn kho: ${nonCount} account(s)

Chọn loại tài khoản bạn muốn mua:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📧 Gmail Edu', callback_data: createCallbackData({ a: 'gmail_select_type', t: 'edu' }) },
        { text: '🌐 Google Non', callback_data: createCallbackData({ a: 'gmail_select_type', t: 'non' }) }
      ]
    ]
  };

  await bot.sendMessage(chatId, menuText, { 
    reply_markup: keyboard,
    parse_mode: 'Markdown'
  });
};

// Xử lý khi chọn type (Edu hoặc Non) - yêu cầu nhập số lượng
export const handleGmailTypeSelection = async (bot, chatId, userId, type) => {
  const typeName = type === 'edu' ? 'Gmail Edu' : 'Google Non';
  // Lấy giá từ database
  const pricePerAccount = await getGmailPrice(type, 'single', 1);
  
  // Lưu trạng thái đang chờ input quantity
  waitingForQuantity.set(userId, { type, timestamp: Date.now() });
  
  await bot.sendMessage(chatId, 
    `📧 Bạn đã chọn: **${typeName}**\n\n` +
    `💰 Giá: ${formatCurrency(pricePerAccount)} / 1 account\n\n` +
    `Vui lòng nhập số lượng email bạn muốn mua (ví dụ: 1, 2, 5, 10...):`,
    { parse_mode: 'Markdown' }
  );
};

// Xử lý input quantity từ user
export const handleGmailQuantityInput = async (bot, msg, quantityStr) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  
  // Kiểm tra xem user có đang chờ input quantity không
  const waitingState = waitingForQuantity.get(userId);
  if (!waitingState) {
    return false; // Không phải input quantity, bỏ qua
  }
  
  // Xóa trạng thái chờ
  waitingForQuantity.delete(userId);
  
  // Parse quantity
  const quantity = parseInt(quantityStr.trim(), 10);
  if (isNaN(quantity) || quantity < 1) {
    await bot.sendMessage(chatId, '❌ Số lượng không hợp lệ. Vui lòng nhập số nguyên dương (ví dụ: 1, 2, 5, 10).');
    return true; // Đã xử lý (lỗi validation)
  }
  
  const type = waitingState.type;
  
  // Gọi hàm mua account
  await buyGmailAccount(bot, msg, type, quantity);
  return true; // Đã xử lý
};

// Hiển thị menu chọn số lượng
export const showGmailQuantityMenu = async (bot, chatId, type, duration) => {
  const typeName = type === 'edu' ? 'Gmail Edu' : 'Google Non';
  const durationName = duration === 'single' ? '1h' : '1 ngày';
  // Không cần kiểm tra tồn kho vì sẽ tạo mới qua API
  const count = 'Unlimited';

  // Lấy giá từ database
  const price1 = await getGmailPrice(type, duration, 1);
  const price10 = await getGmailPrice(type, duration, 10);

  const menuText = `Chọn số lượng ${typeName} (${durationName}):

📦 Tồn kho: ${count} account(s)

Giá:
• 1 account: ${formatCurrency(price1)}
• 10 accounts: ${formatCurrency(price10)}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '1 account', callback_data: createCallbackData({ a: 'buy_gmail', t: type, d: duration, q: 1 }) },
        { text: '10 accounts', callback_data: createCallbackData({ a: 'buy_gmail', t: type, d: duration, q: 10 }) }
      ],
      [
        { text: '⬅️ Quay lại', callback_data: createCallbackData({ a: 'gmail_menu' }) }
      ]
    ]
  };

  await bot.sendMessage(chatId, menuText, { reply_markup: keyboard });
};

// Xử lý command /buygmail
export const handleBuyGmailCommand = async (bot, msg, typeStr, quantityStr) => {
  try {
    // Parse type: "gmail" -> edu, "gmailnon" -> non
    let type;
    if (typeStr === 'gmail') {
      type = 'edu';
    } else if (typeStr === 'gmailnon') {
      type = 'non';
    } else {
      return bot.sendMessage(msg.chat.id, 'Sai cú pháp.\n\nSử dụng:\n/buygmail gmail <số_lượng>\n/buygmail gmailnon <số_lượng>\n\nVí dụ:\n/buygmail gmail 1\n/buygmail gmailnon 1');
    }

    // Parse quantity
    const quantity = parseInt(quantityStr, 10);
    if (isNaN(quantity) || quantity < 1) {
      return bot.sendMessage(msg.chat.id, 'Số lượng phải là số nguyên dương.');
    }

    // Sử dụng function buyGmailAccount (single - 1h)
    return await buyGmailAccount(bot, msg, type, quantity);

  } catch (error) {
    logError({ context: 'handleBuyGmailCommand', error: error.message });
    return bot.sendMessage(msg.chat.id, 'Có lỗi xảy ra khi xử lý lệnh.');
  }
};

