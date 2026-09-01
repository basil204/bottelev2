import { query } from '../database/index.js';
import { runNetflixBot } from '../../toolsauto_netflix/auto_netflix.js';
import { formatCurrency } from '../../utils/index.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';

let isWorkerRunning = false;
let activeTasksCount = 0;
let workerBot = null;
let queueInterval = null;

/**
 * Lấy cấu hình Netflix từ database
 */
export const getNetflixSettings = async () => {
  try {
    const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'netflix_%'");
    const map = {};
    rows.forEach(r => {
      map[r.key] = r.value;
    });

    const enabled = map['netflix_enabled'] !== 'false';
    const price = map['netflix_price'] ? Number(map['netflix_price']) : 25000;
    const headless = map['netflix_headless'] !== 'false';
    const concurrency = map['netflix_concurrency'] ? parseInt(map['netflix_concurrency'], 10) : 1;
    
    // Parse proxy list
    let proxies = [];
    if (map['netflix_proxies']) {
      proxies = map['netflix_proxies']
        .split('\n')
        .map(p => p.trim())
        .filter(p => p && !p.startsWith('#'));
    }

    // Parse cookies
    let cookies = [];
    if (map['netflix_cookies']) {
      try {
        const parsed = JSON.parse(map['netflix_cookies']);
        cookies = Array.isArray(parsed) ? parsed : (parsed.cookies || []);
      } catch (_) {}
    }

    // Parse message templates
    const DEFAULT_MSG_SUCCESS = `🎉 **NHẬN NETFLIX 30 NGÀY THÀNH CÔNG!**\n\n📧 **Email đăng ký:** \`{email}\`\n💰 **Đơn giá:** \`{price}\`\n🕒 **Thời gian hoàn tất:** {time}\n\n✨ Bạn có thể đăng nhập Netflix hoặc kiểm tra hòm thư Email để bắt đầu sử dụng gói dùng thử 30 ngày ngay!`;
    const DEFAULT_MSG_FAILED = `❌ **NHẬN NETFLIX 30 NGÀY THẤT BẠI!**\n\n📧 **Email:** \`{email}\`\n⚠️ **Lý do:** \`{reason}\`{refund_note}\n\n👉 Vui lòng thử lại với một Email khác hoặc liên hệ Admin để được hỗ trợ.`;

    return {
      enabled,
      price,
      headless,
      concurrency: Math.max(1, concurrency || 1),
      proxies,
      cookies,
      custom_emoji_id: map['netflix_custom_emoji_id'] || '',
      msg_menu: map['netflix_msg_menu'] || '',
      msg_prompt: map['netflix_msg_prompt'] || '',
      msg_processing: map['netflix_msg_processing'] || '',
      msg_success: map['netflix_msg_success'] || DEFAULT_MSG_SUCCESS,
      msg_failed: map['netflix_msg_failed'] || DEFAULT_MSG_FAILED
    };
  } catch (err) {
    console.error('[NETFLIX_QUEUE] Lỗi đọc cài đặt:', err.message);
    return {
      enabled: true,
      price: 25000,
      headless: true,
      concurrency: 1,
      proxies: [],
      cookies: [],
      msg_menu: '',
      msg_prompt: '',
      msg_processing: '',
      msg_success: '',
      msg_failed: ''
    };
  }
};

/**
 * Chọn 1 proxy ngẫu nhiên từ danh sách
 */
export const pickRandomProxy = (proxies = []) => {
  if (!Array.isArray(proxies) || proxies.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * proxies.length);
  return proxies[randomIndex];
};

/**
 * Xử lý một tác vụ Netflix đơn lẻ
 */
const processTask = async (task, settings) => {
  activeTasksCount++;
  const proxy = pickRandomProxy(settings.proxies);

  console.log(`[NETFLIX_QUEUE] 🚀 Bắt đầu thực thi Task #${task.id} cho email: ${task.email} (Proxy: ${proxy || 'Direct'})`);

  // Cập nhật trạng thái bắt đầu
  await query(
    "UPDATE netflix_tasks SET status = 'running', proxy_used = ?, started_at = NOW(), step_status = 'Đang khởi động trình duyệt...' WHERE id = ?",
    [proxy || 'Direct', task.id]
  );

  let lastProgressUpdate = 0;
  const onProgress = async (progress) => {
    try {
      const now = Date.now();
      await query("UPDATE netflix_tasks SET step_status = ? WHERE id = ?", [progress.text, task.id]);

      // Throttle cập nhật tin nhắn cho Telegram user (ít nhất 2.5s / lần)
      if (workerBot && task.telegram_id && task.message_id && (now - lastProgressUpdate > 2500)) {
        lastProgressUpdate = now;
        const statusText = 
          `⏳ **ĐANG XỬ LÝ NHẬN NETFLIX 30 NGÀY...**\n\n` +
          `📧 **Email:** \`${task.email}\`\n` +
          `📌 **Tiến trình:** \`[${progress.step}/${progress.total}]\` ${progress.text}\n` +
          `🛡️ **Proxy:** \`${proxy || 'Direct Connection'}\`\n\n` +
          `⚡ Vui lòng đợi trong giây lát...`;

        await workerBot.editMessageText(statusText, {
          chat_id: task.telegram_id,
          message_id: task.message_id,
          parse_mode: 'Markdown'
        }).catch(() => {});
      }
    } catch (_) {}
  };

  try {
    const result = await runNetflixBot(
      task.email,
      {
        headless: settings.headless,
        proxy: proxy,
        cookies: settings.cookies
      },
      onProgress
    );

    if (result.success) {
      // Hoàn thành thành công
      await query(
        "UPDATE netflix_tasks SET status = 'completed', completed_at = NOW(), step_status = 'Kích hoạt thành công!' WHERE id = ?",
        [task.id]
      );

      console.log(`[NETFLIX_QUEUE] ✅ Hoàn thành Task #${task.id} (${task.email})`);

      // Gửi thông báo thành công cho khách hàng
      if (workerBot && task.telegram_id) {
        const timeStr = new Date().toLocaleString('vi-VN');
        let successMsg = settings.msg_success || 
          `🎉 **NHẬN NETFLIX 30 NGÀY THÀNH CÔNG!**\n\n` +
          `📧 **Email đăng ký:** \`{email}\`\n` +
          `💰 **Đơn giá:** \`{price}\`\n` +
          `🕒 **Thời gian hoàn tất:** {time}\n\n` +
          `✨ Bạn có thể đăng nhập Netflix hoặc kiểm tra hòm thư Email để bắt đầu sử dụng gói dùng thử 30 ngày ngay!`;

        successMsg = successMsg
          .split('{email}').join(task.email)
          .split('{price}').join(formatCurrency(task.price))
          .split('{time}').join(timeStr);

        if (task.message_id) {
          await workerBot.editMessageText(successMsg, {
            chat_id: task.telegram_id,
            message_id: task.message_id,
            parse_mode: 'Markdown'
          }).catch(() => {
            workerBot.sendMessage(task.telegram_id, successMsg, { parse_mode: 'Markdown' });
          });
        } else {
          await workerBot.sendMessage(task.telegram_id, successMsg, { parse_mode: 'Markdown' });
        }
      }
    } else {
      throw new Error(result.error || 'Quá trình tự động hóa không thành công');
    }
  } catch (err) {
    console.error(`[NETFLIX_QUEUE] ❌ Thất bại Task #${task.id}:`, err.message);

    // Cập nhật trạng thái thất bại
    await query(
      "UPDATE netflix_tasks SET status = 'failed', completed_at = NOW(), error_message = ?, step_status = 'Thất bại' WHERE id = ?",
      [err.message || 'Lỗi không xác định', task.id]
    );

    // Hoàn tiền cho khách nếu có thu phí
    let refundNote = '';
    if (task.price > 0 && task.user_id) {
      try {
        const userRows = await query("SELECT balance FROM users WHERE id = ?", [task.user_id]);
        if (userRows && userRows.length > 0) {
          const currentBal = Number(userRows[0].balance || 0);
          const newBal = currentBal + Number(task.price);
          await query("UPDATE users SET balance = balance + ? WHERE id = ?", [task.price, task.user_id]);
          await addBalanceLog({
            userId: task.user_id,
            amount: Number(task.price),
            reason: `refund_netflix_30days_${task.id}`
          });
          refundNote = `\n\n💵 **Đã hoàn lại:** \`${formatCurrency(task.price)}\` vào số dư Bot của bạn.`;
        }
      } catch (refundErr) {
        console.error('[NETFLIX_QUEUE] Lỗi hoàn tiền:', refundErr.message);
      }
    }

    // Gửi thông báo lỗi cho khách hàng
    if (workerBot && task.telegram_id) {
      let errorMsg = settings.msg_failed || 
        `❌ **NHẬN NETFLIX 30 NGÀY THẤT BẠI!**\n\n` +
        `📧 **Email:** \`{email}\`\n` +
        `⚠️ **Lý do:** \`{reason}\`{refund_note}\n\n` +
        `👉 Vui lòng thử lại với một Email khác hoặc liên hệ Admin để được hỗ trợ.`;

      errorMsg = errorMsg
        .split('{email}').join(task.email)
        .split('{reason}').join(err.message || 'Hệ thống Netflix bận hoặc lỗi xác minh')
        .split('{refund_note}').join(refundNote);

      if (task.message_id) {
        await workerBot.editMessageText(errorMsg, {
          chat_id: task.telegram_id,
          message_id: task.message_id,
          parse_mode: 'Markdown'
        }).catch(() => {
          workerBot.sendMessage(task.telegram_id, errorMsg, { parse_mode: 'Markdown' });
        });
      } else {
        await workerBot.sendMessage(task.telegram_id, errorMsg, { parse_mode: 'Markdown' });
      }
    }
  } finally {
    activeTasksCount--;
  }
};

/**
 * Vòng lặp kiểm tra và kéo việc từ hàng chờ
 */
export const checkQueueAndProcess = async () => {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    const settings = await getNetflixSettings();
    if (!settings.enabled) {
      isWorkerRunning = false;
      return;
    }

    const availableSlots = settings.concurrency - activeTasksCount;
    if (availableSlots <= 0) {
      isWorkerRunning = false;
      return;
    }

    // Lấy các task pending theo thứ tự thời gian tạo
    const pendingTasks = await query(
      "SELECT * FROM netflix_tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
      [availableSlots]
    );

    if (pendingTasks && pendingTasks.length > 0) {
      for (const task of pendingTasks) {
        // Chạy bất đồng bộ
        processTask(task, settings).catch(e => {
          console.error('[NETFLIX_QUEUE] Lỗi unhandled task:', e);
        });
      }
    }
  } catch (err) {
    console.error('[NETFLIX_QUEUE] Lỗi kiểm tra hàng chờ:', err.message);
  } finally {
    isWorkerRunning = false;
  }
};

/**
 * Khởi động Worker quản lý Hàng chờ Netflix
 */
export const startNetflixQueueWorker = (bot, config) => {
  workerBot = bot;
  if (queueInterval) clearInterval(queueInterval);

  console.log('✅ [NETFLIX_QUEUE] Đã khởi động dịch vụ quản lý Hàng chờ Netflix 30 Ngày');

  // Kiểm tra hàng chờ mỗi 4 giây
  queueInterval = setInterval(() => {
    checkQueueAndProcess().catch(() => {});
  }, 4000);

  // Kích hoạt ngay lần đầu
  checkQueueAndProcess().catch(() => {});
};

/**
 * Thêm một task mới vào hàng chờ
 */
export const addNetflixTask = async ({ userId, telegramId, email, price = 0, messageId = null }) => {
  const result = await query(
    `INSERT INTO netflix_tasks (user_id, telegram_id, email, price, status, step_status, created_at)
     VALUES (?, ?, ?, ?, 'pending', 'Đang trong hàng chờ...', NOW())`,
    [userId || null, telegramId || null, email.trim(), price]
  );

  const taskId = result.insertId;

  // Lấy số thứ tự trong hàng chờ
  const countRows = await query(
    "SELECT COUNT(*) as queue_pos FROM netflix_tasks WHERE status = 'pending' AND id <= ?",
    [taskId]
  );
  const queuePos = countRows[0]?.queue_pos || 1;

  // Gọi worker kích hoạt ngay
  setTimeout(() => {
    checkQueueAndProcess().catch(() => {});
  }, 300);

  return { taskId, queuePos };
};
