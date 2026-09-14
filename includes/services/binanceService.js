import crypto from 'crypto';
import { query } from '../database/index.js';
import { updateBalance, getUserByTelegram, getUserById } from '../controllers/userController.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';
import { getActivePromotion, calculatePromotedAmount } from '../controllers/depositPromotionController.js';
import { formatCurrency } from '../../utils/index.js';

const BINANCE_API_BASE = 'https://api.binance.com';

/**
 * Lấy cấu hình Binance từ database
 */
export const getBinanceConfig = async () => {
  try {
    const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'binance_%' OR `key` = 'exchange_rate'");
    const config = {
      apiKey: '',
      secretKey: '',
      payId: '',
      autoDeposit: false,
      minDeposit: 1, // USDT
      exchangeRate: 26000
    };

    rows.forEach(r => {
      if (r.key === 'binance_api_key') config.apiKey = r.value || '';
      if (r.key === 'binance_secret_key') config.secretKey = r.value || '';
      if (r.key === 'binance_pay_id') config.payId = r.value || '';
      if (r.key === 'binance_auto_deposit') config.autoDeposit = r.value === 'true';
      if (r.key === 'binance_min_deposit') config.minDeposit = Number(r.value) || 1;
      if (r.key === 'exchange_rate') config.exchangeRate = Number(r.value) || 26000;
    });

    return config;
  } catch (error) {
    console.error('[BINANCE] Error loading config:', error.message);
    return null;
  }
};

/**
 * Tạo chữ ký HMAC-SHA256 cho Binance API
 */
const createSignature = (queryString, secretKey) => {
  return crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
};

/**
 * Kiểm tra kết nối Binance API Key
 */
export const testBinanceConnection = async (apiKey, secretKey) => {
  try {
    if (!apiKey || !secretKey) {
      return { success: false, message: 'Thiếu API Key hoặc Secret Key' };
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createSignature(queryString, secretKey);

    const res = await fetch(`${BINANCE_API_BASE}/sapi/v1/pay/transactions?${queryString}&signature=${signature}`, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    if (res.ok && (data.code === '000000' || data.success === true || Array.isArray(data.data))) {
      return { success: true, message: 'Kết nối Binance API thành công!', data };
    }

    // Fallback thử endpoint account info nếu Pay API chưa cấp quyền
    const accQuery = `timestamp=${timestamp}`;
    const accSig = createSignature(accQuery, secretKey);
    const accRes = await fetch(`${BINANCE_API_BASE}/api/v3/account?${accQuery}&signature=${accSig}`, {
      headers: { 'X-MBX-APIKEY': apiKey }
    });
    const accData = await accRes.json();

    if (accRes.ok && accData.accountType) {
      return { success: true, message: `Kết nối Binance API thành công (Tài khoản: ${accData.accountType})! Lưu ý: Hãy đảm bảo API Key có quyền truy cập Binance Pay để tự động quét giao dịch.` };
    }

    return {
      success: false,
      message: data.msg || data.message || `Lỗi từ Binance API: HTTP ${res.status}`
    };
  } catch (err) {
    return { success: false, message: `Lỗi kết nối: ${err.message}` };
  }
};

/**
 * Lấy lịch sử giao dịch Binance Pay gần nhất
 */
export const fetchBinancePayTransactions = async (config = null, startTime = null) => {
  const binanceConf = config || await getBinanceConfig();
  if (!binanceConf || !binanceConf.apiKey || !binanceConf.secretKey) {
    return [];
  }

  try {
    const timestamp = Date.now();
    let queryParams = `timestamp=${timestamp}&limit=100`;
    if (startTime) {
      queryParams = `startTime=${startTime}&${queryParams}`;
    }

    const signature = createSignature(queryParams, binanceConf.secretKey);
    const url = `${BINANCE_API_BASE}/sapi/v1/pay/transactions?${queryParams}&signature=${signature}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': binanceConf.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[BINANCE_PAY] API response error:', res.status, errText);
      return [];
    }

    const json = await res.json();
    if (json && Array.isArray(json.data)) {
      return json.data;
    }
    return [];
  } catch (error) {
    console.error('[BINANCE_PAY] Error fetching transactions:', error.message);
    return [];
  }
};

/**
 * Tìm Telegram ID hoặc Mã nạp từ nội dung ghi chú (note / remark / orderId)
 */
export const extractTelegramIdFromNote = (noteText) => {
  if (!noteText) return null;
  const str = String(noteText).trim();

  // 1. Khớp "NAP 123456789" hoặc "NAP123456789"
  const napMatch = str.match(/NAP\s*(\d{5,15})/i);
  if (napMatch) return napMatch[1];

  // 2. Khớp chuỗi số telegram id độc lập (5 - 15 chữ số)
  const idMatch = str.match(/\b(\d{6,14})\b/);
  if (idMatch) return idMatch[1];

  return null;
};

/**
 * Xử lý một giao dịch Binance Pay nạp tiền vào tài khoản
 */
export const processBinancePayTransaction = async (tx, bot = null) => {
  if (!tx) return null;

  const orderId = tx.orderId || tx.transactionId;
  const status = (tx.status || '').toUpperCase();
  const currency = (tx.currency || 'USDT').toUpperCase();
  const amountUsdt = parseFloat(tx.amount || 0);

  // Chỉ xử lý giao dịch nhận tiền thành công
  if (status !== 'SUCCESSFUL' && status !== 'SUCCESS' && status !== 'PAID') {
    return null;
  }

  // Chỉ hỗ trợ nhận USDT
  if (currency !== 'USDT' || amountUsdt <= 0) {
    return null;
  }

  const note = tx.note || tx.payerInfo?.name || tx.orderTitle || '';
  const telegramId = extractTelegramIdFromNote(note);

  if (!telegramId) {
    return null;
  }

  // Tìm người dùng theo Telegram ID
  const user = await getUserByTelegram(telegramId);
  if (!user) {
    console.warn(`[BINANCE_PAY] Không tìm thấy user Telegram ID ${telegramId} cho đơn #${orderId}`);
    return null;
  }

  // Kiểm tra xem giao dịch này đã được ghi nhận trong CSDL chưa
  const existing = await query(
    "SELECT id, status FROM deposits WHERE content = ? OR content LIKE ?",
    [`BINANCE_${orderId}`, `%BINANCE_${orderId}%`]
  );

  if (existing && existing.length > 0) {
    return null; // Đã xử lý
  }

  const binanceConf = await getBinanceConfig();
  const exchangeRate = binanceConf?.exchangeRate || 26000;
  const amountVnd = Math.round(amountUsdt * exchangeRate);

  if (amountVnd <= 0) {
    return null;
  }

  // Tính khuyến mại nạp tiền nếu có
  let bonusAmount = 0;
  let finalAmount = amountVnd;
  let promo = null;
  try {
    promo = await getActivePromotion(user.id);
    const promoResult = calculatePromotedAmount(amountVnd, promo);
    bonusAmount = promoResult.bonusAmount || 0;
    finalAmount = promoResult.finalAmount || amountVnd;
  } catch (promoErr) {
    console.warn('[BINANCE_PAY] Lỗi tính khuyến mại:', promoErr.message);
  }

  // 1. Tạo bản ghi nạp tiền
  const insertResult = await query(
    `INSERT INTO deposits (user_id, amount, status, type, content, created_at)
     VALUES (?, ?, 'approved', 'binance', ?, NOW())`,
    [user.id, finalAmount, `BINANCE_${orderId} | ${amountUsdt} USDT (Tỷ giá: ${exchangeRate})`]
  );
  const depositId = insertResult.insertId;

  // 2. Cộng số dư tài khoản
  await updateBalance(user.id, finalAmount);

  // 3. Ghi log số dư
  const logReason = bonusAmount > 0
    ? `deposit_binance_${amountUsdt}usdt_bonus_${promo?.bonus_percentage || 0}%`
    : `deposit_binance_${amountUsdt}usdt`;

  await addBalanceLog({
    userId: user.id,
    amount: finalAmount,
    reason: logReason,
    adminId: null
  });

  const updatedUser = await getUserById(user.id);
  const newBalanceStr = formatCurrency(updatedUser?.balance || 0);

  console.log(`✅ [BINANCE_PAY] Nạp thành công cho User ${telegramId}: +${formatCurrency(finalAmount)} (${amountUsdt} USDT). Số dư mới: ${newBalanceStr}`);

  // 4. Gửi thông báo Telegram cho khách hàng
  if (bot && telegramId) {
    try {
      let bonusText = bonusAmount > 0 ? `\n🎁 **Khuyến mại:** +${formatCurrency(bonusAmount)} (${promo?.bonus_percentage}%)` : '';
      const message =
        `🎉 **NẠP TIỀN BINANCE PAY THÀNH CÔNG!**\n\n` +
        `💵 **Số tiền USDT:** \`${amountUsdt} USDT\`\n` +
        `💱 **Tỷ giá quy đổi:** \`${formatCurrency(exchangeRate)} / 1 USDT\`\n` +
        `💰 **Tiền cộng vào ví:** **+${formatCurrency(finalAmount)}**${bonusText}\n` +
        `💳 **Số dư hiện tại:** **${newBalanceStr}**\n` +
        `🆔 **Mã giao dịch Binance:** \`${orderId}\`\n\n` +
        `✨ *Cảm ơn bạn đã sử dụng dịch vụ!*`;

      await bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    } catch (msgErr) {
      console.error('[BINANCE_PAY] Không thể gửi tin nhắn cho user:', msgErr.message);
    }
  }

  // 5. Gửi thông báo Admin
  if (bot) {
    try {
      const { notifyAdminAboutDepositSuccess } = await import('./autoDeposit.js');
      await notifyAdminAboutDepositSuccess(
        bot,
        updatedUser,
        finalAmount,
        `BINANCE PAY (${amountUsdt} USDT)`,
        `BINANCE_${orderId}`,
        updatedUser?.balance || 0
      );
    } catch (_) {}
  }

  return {
    depositId,
    orderId,
    telegramId,
    amountUsdt,
    amountVnd: finalAmount,
    newBalance: updatedUser?.balance
  };
};

/**
 * Lấy địa chỉ ví nạp tiền (Deposit Address) từ Binance (mặc định USDT mạng TRX - TRC20)
 */
export const getBinanceDepositAddress = async (coin = 'USDT', network = 'TRX', config = null) => {
  try {
    // 1. Ưu tiên kiểm tra trong settings CSDL trước
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'usdt_trc20_wallet'");
    if (rows?.[0]?.value && rows[0].value.trim()) {
      return {
        address: rows[0].value.trim(),
        coin,
        network,
        tag: '',
        source: 'settings'
      };
    }

    // 2. Nếu chưa cài đặt cứng, gọi Binance API lấy địa chỉ ví nạp
    const binanceConf = config || await getBinanceConfig();
    if (!binanceConf || !binanceConf.apiKey || !binanceConf.secretKey) {
      return null;
    }

    const timestamp = Date.now();
    const queryString = `coin=${coin}&network=${network}&timestamp=${timestamp}`;
    const signature = createSignature(queryString, binanceConf.secretKey);
    const url = `${BINANCE_API_BASE}/sapi/v1/capital/deposit/address?${queryString}&signature=${signature}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': binanceConf.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[BINANCE_ONCHAIN] Error fetching deposit address:', res.status, errText);
      return null;
    }

    const data = await res.json();
    if (data && data.address) {
      // Tự động lưu vào settings để tái sử dụng
      try {
        await query(
          "INSERT INTO settings (\`key\`, \`value\`, \`created_at\`, \`updated_at\`) VALUES ('usdt_trc20_wallet', ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE \`value\` = ?, \`updated_at\` = NOW()",
          [data.address, data.address]
        );
      } catch (_) {}

      return {
        address: data.address,
        tag: data.tag || '',
        coin: data.coin || coin,
        network,
        url: data.url || '',
        source: 'binance_api'
      };
    }

    return null;
  } catch (error) {
    console.error('[BINANCE_ONCHAIN] Error getting deposit address:', error.message);
    return null;
  }
};

/**
 * Lấy lịch sử nạp tiền On-chain từ Binance API (/sapi/v1/capital/deposit/hisrec)
 */
export const fetchBinanceOnchainDeposits = async (config = null, coin = 'USDT', startTime = null) => {
  const binanceConf = config || await getBinanceConfig();
  if (!binanceConf || !binanceConf.apiKey || !binanceConf.secretKey) {
    return [];
  }

  try {
    const timestamp = Date.now();
    let queryParams = `coin=${coin}&limit=100&timestamp=${timestamp}`;
    if (startTime) {
      queryParams = `startTime=${startTime}&${queryParams}`;
    }

    const signature = createSignature(queryParams, binanceConf.secretKey);
    const url = `${BINANCE_API_BASE}/sapi/v1/capital/deposit/hisrec?${queryParams}&signature=${signature}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': binanceConf.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[BINANCE_ONCHAIN] API response error:', res.status, errText);
      return [];
    }

    const json = await res.json();
    if (Array.isArray(json)) {
      return json;
    }
    return [];
  } catch (error) {
    console.error('[BINANCE_ONCHAIN] Error fetching onchain deposits:', error.message);
    return [];
  }
};

/**
 * Xử lý nạp tiền Onchain USDT TRC20 từ Binance
 */
export const processBinanceOnchainDeposit = async (tx, user, bot = null, customTxHash = null) => {
  if (!tx || !user) return null;

  const txHash = customTxHash || tx.txId || tx.id;
  const amountUsdt = parseFloat(tx.amount || 0);
  const coin = (tx.coin || 'USDT').toUpperCase();
  const network = (tx.network || 'TRX').toUpperCase();

  if (amountUsdt <= 0 || coin !== 'USDT') {
    return null;
  }

  // 1. Kiểm tra xem TxID này đã được nạp trước đó chưa
  const existing = await query(
    "SELECT id, status FROM deposits WHERE tx_ref = ? OR content LIKE ? OR content LIKE ?",
    [txHash, `%${txHash}%`, `%BINANCE_TRC20_${tx.id || txHash}%`]
  );

  if (existing && existing.length > 0) {
    return { alreadyProcessed: true, depositId: existing[0].id };
  }

  const binanceConf = await getBinanceConfig();
  const exchangeRate = binanceConf?.exchangeRate || 26000;
  const amountVnd = Math.round(amountUsdt * exchangeRate);

  if (amountVnd <= 0) return null;

  // 2. Tính khuyến mại nạp nếu có
  let bonusAmount = 0;
  let finalAmount = amountVnd;
  let promo = null;
  try {
    promo = await getActivePromotion(user.id);
    const promoResult = calculatePromotedAmount(amountVnd, promo);
    bonusAmount = promoResult.bonusAmount || 0;
    finalAmount = promoResult.finalAmount || amountVnd;
  } catch (promoErr) {
    console.warn('[BINANCE_TRC20] Lỗi tính khuyến mại:', promoErr.message);
  }

  // 3. Tạo bản ghi nạp tiền
  const insertResult = await query(
    `INSERT INTO deposits (user_id, amount, status, tx_ref, type, content, created_at)
     VALUES (?, ?, 'approved', ?, 'usdt_trc20', ?, NOW())`,
    [
      user.id,
      finalAmount,
      txHash,
      `BINANCE_TRC20_${tx.id || ''} | ${amountUsdt} USDT (${network}) | Tỷ giá: ${exchangeRate}`
    ]
  );
  const depositId = insertResult.insertId;

  // 4. Cộng tiền vào ví user
  await updateBalance(user.id, finalAmount);

  // 5. Ghi log số dư
  const logReason = bonusAmount > 0
    ? `deposit_usdt_trc20_${amountUsdt}usdt_bonus_${promo?.bonus_percentage || 0}%`
    : `deposit_usdt_trc20_${amountUsdt}usdt`;

  await addBalanceLog({
    userId: user.id,
    amount: finalAmount,
    reason: logReason,
    adminId: null
  });

  const updatedUser = await getUserById(user.id);
  const newBalanceStr = formatCurrency(updatedUser?.balance || 0);

  console.log(`✅ [BINANCE_TRC20] Nạp thành công cho User ${user.telegram_id}: +${formatCurrency(finalAmount)} (${amountUsdt} USDT). TxID: ${txHash}`);

  // 6. Gửi thông báo Telegram cho khách hàng
  if (bot && user.telegram_id) {
    try {
      let bonusText = bonusAmount > 0 ? `\n🎁 **Khuyến mại:** +${formatCurrency(bonusAmount)} (${promo?.bonus_percentage}%)` : '';
      const message =
        `🎉 **NẠP TIỀN USDT TRC20 THÀNH CÔNG!**\n\n` +
        `💎 **Số tiền nhận:** \`${amountUsdt} USDT\`\n` +
        `🌐 **Mạng lưới:** \`${network}\`\n` +
        `💱 **Tỷ giá quy đổi:** \`${formatCurrency(exchangeRate)} / 1 USDT\`\n` +
        `💰 **Tiền cộng vào ví:** **+${formatCurrency(finalAmount)}**${bonusText}\n` +
        `💳 **Số dư hiện tại:** **${newBalanceStr}**\n` +
        `📝 **Mã TxID:** \`${txHash.length > 24 ? txHash.substring(0, 12) + '...' + txHash.substring(txHash.length - 12) : txHash}\`\n\n` +
        `✨ *Cảm ơn bạn đã sử dụng dịch vụ!*`;

      await bot.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
    } catch (msgErr) {
      console.error('[BINANCE_TRC20] Không thể gửi tin nhắn cho user:', msgErr.message);
    }
  }

  // 7. Gửi thông báo Admin
  if (bot) {
    try {
      const { notifyAdminAboutDepositSuccess } = await import('./autoDeposit.js');
      await notifyAdminAboutDepositSuccess(
        bot,
        updatedUser,
        finalAmount,
        `USDT TRC20 (${amountUsdt} USDT - BINANCE)`,
        txHash,
        updatedUser?.balance || 0
      );
    } catch (_) {}
  }

  return {
    depositId,
    txHash,
    telegramId: user.telegram_id,
    amountUsdt,
    amountVnd: finalAmount,
    newBalance: updatedUser?.balance
  };
};

/**
 * Xác minh giao dịch nạp USDT TRC20 qua Binance API (với Tronscan API fallback)
 */
export const verifyBinanceTrc20Deposit = async (txHash, user, expectedAmount = null, bot = null) => {
  if (!txHash || !user) {
    return { success: false, message: 'Thiếu thông tin TxID hoặc người dùng.' };
  }

  const cleanTxHash = txHash.trim();

  // 1. Kiểm tra xem TxID này đã được nạp trước đó chưa
  const existing = await query(
    "SELECT id, status FROM deposits WHERE tx_ref = ? OR content LIKE ?",
    [cleanTxHash, `%${cleanTxHash}%`]
  );

  if (existing && existing.length > 0) {
    return { success: false, message: '❌ Mã giao dịch (TxID) này đã được sử dụng trước đó!' };
  }

  // 2. Kiểm tra qua Binance Onchain Deposit API
  try {
    const binanceConf = await getBinanceConfig();
    if (binanceConf && binanceConf.apiKey && binanceConf.secretKey) {
      const startTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 ngày gần nhất
      const deposits = await fetchBinanceOnchainDeposits(binanceConf, 'USDT', startTime);

      if (Array.isArray(deposits) && deposits.length > 0) {
        // Tìm bản ghi khớp TxID (không phân biệt hoa thường)
        const matchedTx = deposits.find(d => 
          d.txId && cleanTxHash.toLowerCase() === d.txId.toLowerCase()
        );

        if (matchedTx) {
          // Kiểm tra trạng thái: status = 1 là thành công trên Binance
          if (matchedTx.status === 1) {
            const amountUsdt = parseFloat(matchedTx.amount || 0);
            
            // Nếu có yêu cầu số tiền tối thiểu
            if (binanceConf.minDeposit && amountUsdt < binanceConf.minDeposit) {
              return {
                success: false,
                message: `❌ Số tiền nạp (${amountUsdt} USDT) nhỏ hơn mức tối thiểu (${binanceConf.minDeposit} USDT).`
              };
            }

            // Xử lý nạp tiền tự động
            const processResult = await processBinanceOnchainDeposit(matchedTx, user, bot, cleanTxHash);
            if (processResult?.alreadyProcessed) {
              return { success: false, message: '❌ Mã giao dịch này đã được xử lý trước đó.' };
            }

            return {
              success: true,
              source: 'binance',
              amountUsdt,
              amountVnd: processResult?.amountVnd,
              newBalance: processResult?.newBalance,
              txId: cleanTxHash
            };
          } else if (matchedTx.status === 0) {
            return {
              success: false,
              message: '⏳ Giao dịch đang chờ xác nhận từ mạng lưới blockchain (Binance đang xử lý). Vui lòng đợi 1-2 phút rồi kiểm tra lại.'
            };
          } else {
            return {
              success: false,
              message: `⚠️ Giao dịch ở trạng thái không hợp lệ trên Binance (Trạng thái mã: ${matchedTx.status}).`
            };
          }
        }
      }
    }
  } catch (binanceErr) {
    console.error('[VERIFY_BINANCE_TRC20] Binance API error:', binanceErr.message);
  }

  // 3. Fallback: Kiểm tra qua Tronscan API nếu Binance chưa cập nhật kịp hoặc chưa có API Key
  try {
    const tronRes = await fetch(`https://apilist.tronscan.org/api/transaction-info?hash=${cleanTxHash}`);
    if (tronRes.ok) {
      const tronData = await tronRes.json();
      if (tronData && tronData.confirmed) {
        const trc20Info = tronData.trc20TransferInfo?.[0];
        if (trc20Info && trc20Info.symbol === 'USDT') {
          // Lấy ví đích cấu hình
          const ourWalletRows = await query("SELECT `value` FROM settings WHERE `key` = 'usdt_trc20_wallet'");
          const ourWallet = ourWalletRows?.[0]?.value || '';

          if (ourWallet && trc20Info.to_address && trc20Info.to_address.toLowerCase() !== ourWallet.toLowerCase()) {
            return {
              success: false,
              message: '❌ Địa chỉ ví nhận của giao dịch này không khớp với ví nạp của hệ thống.'
            };
          }

          const usdtAmount = Number(trc20Info.amount_str) / 1000000;
          if (expectedAmount && Math.abs(usdtAmount - expectedAmount) > 0.1) {
            return {
              success: false,
              message: `❌ Số tiền không khớp! Bạn đã nhập ${expectedAmount} USDT nhưng giao dịch thực tế là ${usdtAmount} USDT.`
            };
          }

          const mockTx = {
            id: tronData.hash || cleanTxHash,
            amount: usdtAmount,
            coin: 'USDT',
            network: 'TRX',
            status: 1,
            txId: cleanTxHash
          };

          const processResult = await processBinanceOnchainDeposit(mockTx, user, bot, cleanTxHash);
          if (processResult?.alreadyProcessed) {
            return { success: false, message: '❌ Mã giao dịch này đã được xử lý trước đó.' };
          }

          return {
            success: true,
            source: 'tronscan',
            amountUsdt: usdtAmount,
            amountVnd: processResult?.amountVnd,
            newBalance: processResult?.newBalance,
            txId: cleanTxHash
          };
        }
      }
    }
  } catch (tronErr) {
    console.error('[VERIFY_TRC20] Tronscan fallback error:', tronErr.message);
  }

  return {
    success: false,
    message: '❌ Không tìm thấy giao dịch hoặc giao dịch chưa được Binance xác nhận. Vui lòng đảm bảo bạn đã gửi đúng ví và thử lại sau 1-2 phút.'
  };
};

