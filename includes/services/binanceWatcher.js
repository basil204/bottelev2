import {
  getBinanceConfig,
  fetchBinancePayTransactions,
  processBinancePayTransaction,
  fetchBinanceOnchainDeposits
} from './binanceService.js';

let isRunning = false;
let watcherInterval = null;

/**
 * Quét giao dịch Binance Pay & On-chain USDT một lần
 */
export const pollBinanceDeposits = async (bot, config) => {
  if (isRunning) return;
  isRunning = true;

  try {
    const binanceConf = await getBinanceConfig();
    if (!binanceConf || !binanceConf.autoDeposit || !binanceConf.apiKey || !binanceConf.secretKey) {
      return;
    }

    // 1. Quét Binance Pay transactions trong 24 giờ qua
    const startTime = Date.now() - 24 * 60 * 60 * 1000;
    const transactions = await fetchBinancePayTransactions(binanceConf, startTime);

    if (Array.isArray(transactions) && transactions.length > 0) {
      for (const tx of transactions) {
        try {
          await processBinancePayTransaction(tx, bot);
        } catch (txErr) {
          console.error('[BINANCE_WATCHER] Error processing Binance Pay transaction:', txErr.message);
        }
      }
    }

    // 2. Quét Binance Onchain USDT Deposits (TRC20)
    try {
      const onchainDeposits = await fetchBinanceOnchainDeposits(binanceConf, 'USDT', startTime);
      // Onchain deposits được đối soát khi người dùng gửi TxID hoặc tự động đối soát theo TxID đã lưu
    } catch (onchainErr) {
      console.error('[BINANCE_WATCHER] Error fetching onchain deposits:', onchainErr.message);
    }
  } catch (error) {
    console.error('[BINANCE_WATCHER] Error during polling:', error.message);
  } finally {
    isRunning = false;
  }
};

/**
 * Khởi động background polling worker cho Binance Pay
 */
export const startBinanceWatcher = (bot, config, intervalSeconds = 20) => {
  if (watcherInterval) clearInterval(watcherInterval);

  console.log(`✅ [BINANCE_WATCHER] Đã khởi động dịch vụ tự động quét Binance Pay (${intervalSeconds}s/lần)`);

  // Quét ngay lần đầu sau 5 giây
  setTimeout(() => {
    pollBinanceDeposits(bot, config).catch(() => {});
  }, 5000);

  watcherInterval = setInterval(() => {
    pollBinanceDeposits(bot, config).catch(() => {});
  }, intervalSeconds * 1000);

  return watcherInterval;
};

export const stopBinanceWatcher = () => {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
    console.log('🛑 [BINANCE_WATCHER] Đã dừng quét Binance Pay');
  }
};
