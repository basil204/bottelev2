import { getUserByTelegram, updateBalance } from '../controllers/userController.js';
import {
  createGmailAccountForSale,
  getAvailableDomains
} from '../controllers/gmailAccountController.js';
import { getActiveVipPackage, incrementVipUsage } from '../controllers/vipPackageController.js';
import { createOrder } from '../controllers/orderController.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { formatCurrency, createCallbackData } from '../../utils/index.js';
import { getSettingBoolean } from '../controllers/settingsController.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { getGmailPrice } from '../controllers/gmailPricingController.js';
import { notifyAdminAboutPurchase } from './handleNotify.js';
import { globalConfig } from '../listen.js';
import { config } from '../../config.js';

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
export const buyGmailAccount = async (bot, msg, type, quantity = 1, backupEmail = null) => {
  try {
    // Kiểm tra chức năng mua Gmail có được bật không
    const gmailBuyEnabled = await getSettingBoolean('gmail_buy_enabled', true);
    if (!gmailBuyEnabled) {
      return bot.sendMessage(msg.chat.id, '❌ Chức năng mua Gmail hiện đang tạm dừng. Vui lòng thử lại sau.');
    }

    // Kiểm tra trạng thái bật/tắt
    if (type === 'edu') {
      const eduEnabled = await getSettingBoolean('gmail_edu_enabled', true);
      if (!eduEnabled) {
        return bot.sendMessage(msg.chat.id, '❌ Dịch vụ mua Gmail Edu hiện đang tạm dừng. Vui lòng thử lại sau.');
      }
    } else if (type === 'non') {
      const nonEnabled = await getSettingBoolean('gmail_non_enabled', true);
      if (!nonEnabled) {
        return bot.sendMessage(msg.chat.id, '❌ Dịch vụ mua Google Non hiện đang tạm dừng. Vui lòng thử lại sau.');
      }
    }

    const user = await getUserByTelegram(msg.from.id);
    if (!user) {
      return bot.sendMessage(msg.chat.id, 'Vui lòng /start để tạo tài khoản.');
    }

    // Kiểm tra VIP package - chỉ áp dụng cho Gmail Edu (type === 'edu')
    const vipPackage = await getActiveVipPackage(user.id);
    const useVipPackage = vipPackage && type === 'edu' && (vipPackage.used_gmail + quantity <= vipPackage.total_gmail);

    let price = 0;
    let paymentMethod = 'balance'; // 'vip' or 'balance'

    if (useVipPackage) {
      // Sử dụng VIP package (chỉ cho Gmail Edu)
      paymentMethod = 'vip';
      console.log(`[BUY_GMAIL] User ${user.id} (${msg.from.id}) sử dụng VIP package cho Gmail Edu: ${vipPackage.used_gmail + quantity}/${vipPackage.total_gmail}`);
    } else {
      // Nếu không có VIP hoặc đã hết quota, tính giá bình thường
      price = await calculatePrice(type, 'single', quantity);

      // Kiểm tra giá hợp lệ
      if (price === null || price === undefined || isNaN(price) || price <= 0) {
        console.error(`[BUY_GMAIL] Giá không hợp lệ: ${price} cho type: ${type}, quantity: ${quantity}`);
        return bot.sendMessage(msg.chat.id, '❌ Lỗi: Không thể tính giá. Vui lòng thử lại sau.');
      }

      // Kiểm tra số dư - lấy lại user để đảm bảo số dư chính xác
      const currentUser = await getUserByTelegram(msg.from.id);
      const currentBalance = Number(currentUser.balance) || 0;

      if (currentBalance < price) {
        // Hiển thị thông tin VIP nếu đang mua Gmail Edu và có VIP package
        const remaining = (vipPackage && type === 'edu') ? (vipPackage.total_gmail - vipPackage.used_gmail) : 0;
        const vipInfo = (vipPackage && type === 'edu') ? `\n\n📦 Gói VIP: Đã dùng ${vipPackage.used_gmail}/${vipPackage.total_gmail} (còn ${remaining}) - Chỉ áp dụng cho Gmail Edu` : '';
        return bot.sendMessage(msg.chat.id, `❌ Số dư không đủ!\n\n💵 Cần: ${formatCurrency(price)}\n💰 Bạn có: ${formatCurrency(currentBalance)}${vipInfo}`);
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
    const password = config.GMAIL_DEFAULT_PASSWORD;

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
      const result = await createGmailAccountForSale(type, domain, password, backupEmail);
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

    // Thanh toán: Trừ tiền hoặc trừ VIP quota (sau khi tạo account thành công)
    let finalBalance = 0;
    try {
      if (paymentMethod === 'vip' && vipPackage) {
        // Kiểm tra lại VIP quota trước khi trừ
        const { query } = await import('../database/index.js');
        const [currentVipPkg] = await query('SELECT * FROM vip_packages WHERE id = ?', [vipPackage.id]);
        if (!currentVipPkg || (currentVipPkg.used_gmail + quantity > currentVipPkg.total_gmail)) {
          // VIP đã hết hoặc không còn đủ quota
          console.error(`[BUY_GMAIL] ❌ VIP package không còn đủ quota. Đã tạo ${accounts.length} account nhưng không thể thanh toán.`);
          return bot.sendMessage(msg.chat.id, `❌ Lỗi: Gói VIP không còn đủ quota. Vui lòng thử lại hoặc thanh toán bằng số dư.`);
        }

        // Trừ VIP quota cho từng account
        for (const account of accounts) {
          await incrementVipUsage(vipPackage.id, account.email);
        }
        // Lấy lại VIP package để có số liệu chính xác
        const [updatedPkg] = await query('SELECT * FROM vip_packages WHERE id = ?', [vipPackage.id]);
        const remaining = updatedPkg ? (updatedPkg.total_gmail - updatedPkg.used_gmail) : 0;
        console.log(`[BUY_GMAIL] ✅ Đã sử dụng ${quantity} quota từ VIP package (còn ${remaining}/${vipPackage.total_gmail})`);

        // Lấy balance hiện tại để hiển thị
        const userNow = await getUserByTelegram(msg.from.id);
        finalBalance = Number(userNow.balance);
      } else {
        // Trừ tiền từ balance (đã kiểm tra số dư trước khi tạo account)
        await updateBalance(user.id, -price);
        await addBalanceLog({
          userId: user.id,
          amount: -price,
          reason: `buy_gmail_${type}_single_${quantity}`,
          adminId: null
        });
        console.log(`[BUY_GMAIL] ✅ Đã trừ tiền: ${formatCurrency(price)}`);

        // Notify admins
        const adminIds = globalConfig?.ADMIN_IDS || [];
        const updatedUser = await getUserByTelegram(msg.from.id);
        finalBalance = Number(updatedUser.balance);

        if (adminIds.length > 0) {
          notifyAdminAboutPurchase(bot, adminIds, {
            orderId: 'GMAIL_API',
            productName: `Gmail ${type} (${quantity})`,
            username: user.username,
            telegramId: user.telegram_id,
            quantity: quantity,
            price: price,
            finalBalance: finalBalance,
            accounts: accounts // Pass account details
          });
        }
      }
    } catch (error) {
      console.error(`[BUY_GMAIL] ❌ Lỗi khi thanh toán:`, error);
      // Vẫn tiếp tục gửi thông tin tài khoản dù có lỗi thanh toán (log lại để xử lý sau nếu cần)
    }

    // Xử lý hiển thị kết quả
    if (quantity === 1) {
      // Trường hợp mua 1 account: Hiển thị dạng Receipt đẹp
      const account = accounts[0];
      const orderId = `PUR${Date.now()}${Math.floor(Math.random() * 1000)}`;

      let message = `✅ **MUA ${type === 'edu' ? 'GMAIL EDU' : 'GOOGLE NON'} THÀNH CÔNG!**\n\n` +
        `🆔 Mã đơn hàng: \`${orderId}\`\n` +
        `📧 Số lượng: ${quantity} Gmail (1 giờ)\n`;

      if (paymentMethod === 'vip') {
        // Lấy lại VIP package (ước lượng)
        const remaining = vipPackage ? (vipPackage.total_gmail - vipPackage.used_gmail - quantity) : 0;
        message += `📦 Thanh toán: VIP Package (Còn ${remaining})\n`;
      } else {
        message += `💰 Đã thanh toán: ${formatCurrency(price)}\n` +
          `💵 Số dư còn lại: ${formatCurrency(finalBalance)}\n`;
      }

      message += `⏰ Thời hạn: ${type === 'edu' ? '1 giờ (Login)' : '24 giờ (Login)'}\n\n` +
        `📧 **THÔNG TIN GMAIL:**\n` +
        `📧 Email: \`${account.email}\`\n` +
        `🔑 Mật khẩu: \`${account.password}\`\n\n`;

      // Hướng dẫn login hoặc lưu ý
      if (type === 'edu') {
        message += `⚠️ **Lưu ý:**\n` +
          `• Login ngay để kiểm tra tài khoản.\n` +
          `• Chỉ bảo hành login trong 1 giờ.\n`;
      } else {
        message += `⚠️ **Lưu ý:**\n` +
          `• Login ngay để kiểm tra tài khoản.\n` +
          `• Nên thêm phương thức thanh toán ngay để tài khoản ổn định nhất.\n`;
      }

      await bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });

    } else {
      // Trường hợp mua nhiều: Gửi file như cũ
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
        // Fallback send text
        const accountText = accounts.map(acc => `${acc.email}|${acc.password}`).join('\n');
        await bot.sendMessage(msg.chat.id, `✅ Mua thành công. Thông tin:\n\`\`\`\n${accountText}\n\`\`\``, { parse_mode: 'Markdown' });
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
    }

    // Thông báo thêm phương thức thanh toán cho Google Non (chung cho cả single/multiple)
    if (type === 'non') {
      await bot.sendMessage(
        msg.chat.id,
        `💳 **HƯỚNG DẪN SỬ DỤNG**\n\n` +
        `🔐 Để tài khoản Google Non hoạt động tốt nhất:\n\n` +
        `1️⃣ Đăng nhập vào tài khoản Google vừa nhận\n` +
        `2️⃣ Truy cập link bên dưới để thêm phương thức thanh toán:\n` +
        `🔗 https://play.google.com/store/paymentmethods?utm_source=emea_Med\n\n` +
        `✨ **Lợi ích:**\n` +
        `• Tài khoản hoạt động ổn định hơn\n` +
        `• Không bị yêu cầu xác minh thẻ khi sử dụng\n` +
        `• Tránh các vấn đề về thanh toán về sau\n\n` +
        `💡 **Khuyến nghị:** Thêm phương thức thanh toán ngay sau khi nhận tài khoản!`,
        { parse_mode: 'Markdown' }
      );
    }

    // Gmail thông thường: KHÔNG check login status ngay khi mua
    // Chỉ schedule xóa khi phát hiện đăng nhập (qua processScheduledDeletions hoặc checkAccountsByType)
    // Logic: User mua → nhận account → đăng nhập → hệ thống tự động phát hiện và schedule xóa
    console.log(`[BUY_GMAIL] ✅ Đã gửi ${accounts.length} account(s). Hệ thống sẽ tự động phát hiện và xóa khi user đăng nhập.`);

  } catch (error) {
    console.error(`[BUY_GMAIL] Global error:`, error);
    bot.sendMessage(msg.chat.id, 'Có lỗi xảy ra khi mua tài khoản.');
  }
};

// Mua Gmail account (daily - 1 ngày) - Tạo mới qua API
export const buyGmailAccountDaily = async (bot, msg, type, quantity = 1) => {
  try {
    // Kiểm tra chức năng mua Gmail có được bật không
    const gmailBuyEnabled = await getSettingBoolean('gmail_buy_enabled', true);
    if (!gmailBuyEnabled) {
      return bot.sendMessage(msg.chat.id, '❌ Chức năng mua Gmail hiện đang tạm dừng. Vui lòng thử lại sau.');
    }

    // Kiểm tra trạng thái bật/tắt
    if (type === 'edu') {
      const eduEnabled = await getSettingBoolean('gmail_edu_enabled', true);
      if (!eduEnabled) {
        return bot.sendMessage(msg.chat.id, '❌ Dịch vụ mua Gmail Edu hiện đang tạm dừng. Vui lòng thử lại sau.');
      }
    } else if (type === 'non') {
      const nonEnabled = await getSettingBoolean('gmail_non_enabled', true);
      if (!nonEnabled) {
        return bot.sendMessage(msg.chat.id, '❌ Dịch vụ mua Google Non hiện đang tạm dừng. Vui lòng thử lại sau.');
      }
    }

    const user = await getUserByTelegram(msg.from.id);
    if (!user) {
      return bot.sendMessage(msg.chat.id, 'Vui lòng /start để tạo tài khoản.');
    }

    const price = await calculatePrice(type, 'daily', quantity);

    // Kiểm tra giá hợp lệ
    if (price === null || price === undefined || isNaN(price) || price <= 0) {
      console.error(`[BUY_GMAIL_DAILY] Giá không hợp lệ: ${price} cho type: ${type}, quantity: ${quantity}`);
      return bot.sendMessage(msg.chat.id, '❌ Lỗi: Không thể tính giá. Vui lòng thử lại sau.');
    }

    // Kiểm tra số dư - lấy lại user để đảm bảo số dư chính xác
    const currentUser = await getUserByTelegram(msg.from.id);
    const currentBalance = Number(currentUser.balance) || 0;

    if (currentBalance < price) {
      return bot.sendMessage(msg.chat.id, `❌ Số dư không đủ!\n\n💵 Cần: ${formatCurrency(price)}\n💰 Bạn có: ${formatCurrency(currentBalance)}`);
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
    const password = config.GMAIL_DEFAULT_PASSWORD;

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

    // Gmail thông thường: KHÔNG check login status ngay khi mua
    // Chỉ schedule xóa khi phát hiện đăng nhập (qua processScheduledDeletions hoặc checkAccountsByType)
    // Logic: User mua → nhận account → đăng nhập → hệ thống tự động phát hiện và schedule xóa
    console.log(`[BUY_GMAIL_DAILY] ✅ Đã gửi ${accounts.length} account(s). Hệ thống sẽ tự động phát hiện và xóa khi user đăng nhập.`);

    // Trừ tiền sau khi tạo thành công (đã kiểm tra số dư trước khi tạo account)
    await updateBalance(user.id, -price);
    await addBalanceLog({
      userId: user.id,
      amount: -price,
      reason: `buy_gmail_${type}_daily_${quantity}`,
      adminId: null
    });
    console.log(`[BUY_GMAIL_DAILY] ✅ Đã trừ tiền: ${formatCurrency(price)}`);

    // Notify admins
    const adminIds = globalConfig?.ADMIN_IDS || [];
    if (adminIds.length > 0) {
      // Lấy lại user để có số dư mới
      const updatedUser = await getUserByTelegram(msg.from.id);
      notifyAdminAboutPurchase(bot, adminIds, {
        orderId: 'GMAIL_API_DAILY',
        productName: `Gmail ${type} Daily (${quantity})`,
        username: user.username,
        telegramId: user.telegram_id,
        quantity: quantity,
        price: price,
        finalBalance: Number(updatedUser.balance),
        accounts: accounts // Pass account details
      });
    }

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

      // Thông báo thêm phương thức thanh toán cho Google Non
      if (type === 'non') {
        await bot.sendMessage(
          msg.chat.id,
          `💳 **HƯỚNG DẪN SỬ DỤNG**\n\n` +
          `🔐 Để tài khoản Google Non hoạt động tốt nhất:\n\n` +
          `1️⃣ Đăng nhập vào tài khoản Google vừa nhận\n` +
          `2️⃣ Truy cập link bên dưới để thêm phương thức thanh toán:\n` +
          `🔗 https://play.google.com/store/paymentmethods?utm_source=emea_Med\n\n` +
          `✨ **Lợi ích:**\n` +
          `• Tài khoản hoạt động ổn định hơn\n` +
          `• Không bị yêu cầu xác minh thẻ khi sử dụng\n` +
          `• Tránh các vấn đề về thanh toán về sau\n\n` +
          `💡 **Khuyến nghị:** Thêm phương thức thanh toán ngay sau khi nhận tài khoản!`,
          { parse_mode: 'Markdown' }
        );
      }
    } finally {
      // Xóa file tạm thời sau khi gửi
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

  } catch (error) {
    bot.sendMessage(msg.chat.id, 'Có lỗi xảy ra khi mua tài khoản.');
  }
};

// Map để lưu trạng thái đang chờ input quantity từ user
const waitingForQuantity = new Map();

// Map để lưu trạng thái đang chờ input email phụ cho Gmail non
const waitingForNonEmail = new Map();

// Hiển thị menu mua Gmail - chỉ chọn Edu hoặc Non
export const showGmailMenu = async (bot, chatId) => {
  // Kiểm tra chức năng mua Gmail có được bật không
  const gmailBuyEnabled = await getSettingBoolean('gmail_buy_enabled', true);
  if (!gmailBuyEnabled) {
    return bot.sendMessage(chatId, '❌ Chức năng mua Gmail hiện đang tạm dừng. Vui lòng thử lại sau.');
  }

  // Không cần kiểm tra tồn kho vì sẽ tạo mới qua API
  const eduCount = 'Unlimited';
  const nonCount = 'Unlimited';

  // Lấy giá từ database
  const eduPrice = await getGmailPrice('edu', 'single', 1);
  const nonPrice = await getGmailPrice('non', 'single', 1);

  // Kiểm tra trạng thái bật/tắt
  const eduEnabled = await getSettingBoolean('gmail_edu_enabled', true);
  const nonEnabled = await getSettingBoolean('gmail_non_enabled', true);

  const menuText = `🛒 **Mua Gmail Accounts**

**📧 Gmail Edu:**${eduEnabled ? '' : ' ❌ Tạm dừng'}
• Giá: ${formatCurrency(eduPrice)} / 1 account
• ⏰ Live: 1 giờ sau khi login
• 🔒 Bảo hành: Live 1h, không login 24h
• ✅ Chỉ bảo hành login (không bảo hành trial app)
📦 Tồn kho: ${eduCount} account(s)

**🌐 Google Non:**${nonEnabled ? '' : ' ❌ Tạm dừng'}
• Giá: ${formatCurrency(nonPrice)} / 1 account
• ⏰ Live: 24 giờ sau khi login
• 🔒 Bảo hành: Live 24h, không login 72h
• ✅ Cam kết add thẻ không bị verify
📦 Tồn kho: ${nonCount} account(s)

Chọn loại tài khoản bạn muốn mua:`;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: `📧 Gmail Edu${eduEnabled ? '' : ' (Tạm dừng)'}`,
          callback_data: createCallbackData({ a: 'gmail_select_type', t: 'edu' })
        },
        {
          text: `🌐 Google Non${nonEnabled ? '' : ' (Tạm dừng)'}`,
          callback_data: createCallbackData({ a: 'gmail_select_type', t: 'non' })
        }
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
  // Kiểm tra chức năng mua Gmail có được bật không
  const gmailBuyEnabled = await getSettingBoolean('gmail_buy_enabled', true);
  if (!gmailBuyEnabled) {
    return bot.sendMessage(chatId, '❌ Chức năng mua Gmail hiện đang tạm dừng. Vui lòng thử lại sau.');
  }

  // Kiểm tra trạng thái bật/tắt
  if (type === 'edu') {
    const eduEnabled = await getSettingBoolean('gmail_edu_enabled', true);
    if (!eduEnabled) {
      return bot.sendMessage(chatId, '❌ Dịch vụ mua Gmail Edu hiện đang tạm dừng. Vui lòng thử lại sau.');
    }
  } else if (type === 'non') {
    const nonEnabled = await getSettingBoolean('gmail_non_enabled', true);
    if (!nonEnabled) {
      return bot.sendMessage(chatId, '❌ Dịch vụ mua Google Non hiện đang tạm dừng. Vui lòng thử lại sau.');
    }
  }

  const typeName = type === 'edu' ? 'Gmail Edu' : 'Google Non';
  // Lấy giá từ database
  const pricePerAccount = await getGmailPrice(type, 'single', 1);

  // Thông tin bảo hành chi tiết
  let warrantyInfo = '';
  if (type === 'edu') {
    warrantyInfo = `🔒 **Thông tin bảo hành:**
• Live: 1 giờ sau khi login
• Bảo hành: Live 1h, không login 24h
• ✅ Chỉ bảo hành login (không bảo hành trial app)`;
  } else {
    warrantyInfo = `🔒 **Thông tin bảo hành:**
• Live: 24 giờ sau khi login
• Bảo hành: Live 24h, không login 72h
• ✅ Cam kết add thẻ không bị verify`;
  }

  // Lưu trạng thái đang chờ input quantity
  waitingForQuantity.set(userId, { type, timestamp: Date.now() });

  await bot.sendMessage(chatId,
    `📧 Bạn đã chọn: **${typeName}**\n\n` +
    `💰 Giá: ${formatCurrency(pricePerAccount)} / 1 account\n\n` +
    `${warrantyInfo}\n\n` +
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

  // Nếu là Gmail non, yêu cầu nhập email phụ
  if (type === 'non') {
    // Lưu trạng thái đang chờ email phụ
    waitingForNonEmail.set(userId, { type, quantity, timestamp: Date.now() });
    await bot.sendMessage(chatId,
      `📧 Bạn đã chọn mua **${quantity}** tài khoản Google Non\n\n` +
      `📮 Vui lòng nhập **email phụ** để nhận hướng dẫn login:\n\n` +
      `💡 Email phụ sẽ được dùng để gửi hướng dẫn đăng nhập tài khoản Google Non.`,
      { parse_mode: 'Markdown' }
    );
    return true; // Đã xử lý
  }

  // Gọi hàm mua account (cho Gmail Edu)
  await buyGmailAccount(bot, msg, type, quantity);
  return true; // Đã xử lý
};

// Xử lý input email phụ cho Gmail non
export const handleNonEmailInput = async (bot, msg, emailStr) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  // Kiểm tra xem user có đang chờ input email phụ không
  const waitingState = waitingForNonEmail.get(userId);
  if (!waitingState) {
    return false; // Không phải input email phụ, bỏ qua
  }

  // Xóa trạng thái chờ
  waitingForNonEmail.delete(userId);

  // Validate email đơn giản
  const email = emailStr.trim();
  if (!email || !email.includes('@')) {
    await bot.sendMessage(chatId, '❌ Email không hợp lệ. Vui lòng nhập email đúng định dạng (ví dụ: example@gmail.com).');
    return true; // Đã xử lý (lỗi validation)
  }

  const { type, quantity } = waitingState;

  // Gọi hàm mua account với email phụ
  await buyGmailAccount(bot, msg, type, quantity, email);
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
    return bot.sendMessage(msg.chat.id, 'Có lỗi xảy ra khi xử lý lệnh.');
  }
};

