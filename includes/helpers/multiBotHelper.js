/**
 * Tạo Proxy điều phối thông minh cho danh sách các Telegram Bot instances
 * Khi gọi sendMessage / sendPhoto, nếu một bot gặp lỗi (ví dụ bot bị user chặn hoặc user chưa bấm /start với bot đó),
 * Proxy sẽ tự động thử lần lượt các bot còn lại.
 * Hỗ trợ nhận vào mảng bot hoặc một object holder { bots: [...] } để hỗ trợ hot-reload runtime.
 */
export const createMultiBotProxy = (botHolder) => {
  const getBots = () => {
    if (Array.isArray(botHolder)) return botHolder;
    if (botHolder && Array.isArray(botHolder.bots)) return botHolder.bots;
    return [];
  };

  const tryAcrossBots = async (methodName, args) => {
    const bots = getBots();
    if (bots.length === 0) {
      throw new Error('No active Telegram bot instances available');
    }

    let lastError = null;
    for (const bot of bots) {
      try {
        if (typeof bot[methodName] === 'function') {
          return await bot[methodName](...args);
        }
      } catch (err) {
        lastError = err;
        const msg = String(err?.message || '').toLowerCase();
        if (
          msg.includes('chat not found') ||
          msg.includes('bot was blocked') ||
          msg.includes('forbidden') ||
          msg.includes('user is deactivated') ||
          msg.includes('bot was kicked')
        ) {
          continue;
        }
      }
    }
    if (lastError) throw lastError;
  };

  const broadcastAcrossBots = async (methodName, args) => {
    const bots = getBots();
    return Promise.allSettled(
      bots.map((bot) => (typeof bot[methodName] === 'function' ? bot[methodName](...args) : Promise.resolve()))
    );
  };

  return new Proxy({}, {
    get(target, prop) {
      const bots = getBots();
      const primaryBot = bots[0] || {};
      if (prop === 'bots') return bots;
      if (prop === 'isMultiBot') return true;
      if (prop === 'sendMessage' || prop === 'sendPhoto' || prop === 'sendDocument') {
        return (...args) => tryAcrossBots(prop, args);
      }
      if (prop === 'broadcastMessage' || prop === 'broadcastPhoto') {
        const actualMethod = prop === 'broadcastPhoto' ? 'sendPhoto' : 'sendMessage';
        return (...args) => broadcastAcrossBots(actualMethod, args);
      }
      if (prop === 'stopPolling') {
        return () => Promise.all(bots.map((b) => b.stopPolling?.().catch(() => {})));
      }
      const val = primaryBot[prop];
      if (typeof val === 'function') {
        return val.bind(primaryBot);
      }
      return val;
    }
  });
};
