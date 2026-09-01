import { query } from '../database/index.js';
// import removed; using external API
import { formatCurrency } from '../../utils/index.js';
import { addBalanceLog } from '../controllers/balanceLogController.js';

let isWorkerRunning = false;
let activeTasksCount = 0;
let workerBot = null;
let queueInterval = null;

/**
 * Lấy cấu hình Canva từ database
 */
export const getCanvaSettings = async () => {
  try {
    const rows = await query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'canva_%'");
    const map = {};
    rows.forEach(r => {
      map[r.key] = r.value;
    });

    const enabled = map['canva_enabled'] !== 'false';
    const priceDesigner = map['canva_price_designer'] !== undefined && map['canva_price_designer'] !== ''
      ? Number(map['canva_price_designer'])
      : (map['canva_price'] ? Number(map['canva_price']) : 20000);
    const priceMember = map['canva_price_member'] !== undefined && map['canva_price_member'] !== ''
      ? Number(map['canva_price_member'])
      : (map['canva_price'] ? Number(map['canva_price']) : 15000);
    const price = priceMember;
    const headless = map['canva_headless'] !== 'false';
    const concurrency = map['canva_concurrency'] ? parseInt(map['canva_concurrency'], 10) : 1;
    const defaultRole = map['canva_default_role'] || 'designer';
    const customEmojiId = map['canva_custom_emoji_id'] || '';

    // Parse proxy list
    let proxies = [];
    if (map['canva_proxies']) {
      proxies = map['canva_proxies']
        .split('\n')
        .map(p => p.trim())
        .filter(p => p && !p.startsWith('#'));
    }

    const DEFAULT_MSG_MENU = `🎨 **TỰ ĐỘNG MỜI CANVA PRO / ĐỘI NHÓM**\n\n` +
      `💎 **BẢNG GIÁ DỊCH VỤ:**\n` +
      `• 🎨 **Thiết kế thương hiệu (Brand Designer):** \`{price_designer}\`\n` +
      `• 👥 **Thành viên đội (Team Member):** \`{price_member}\`\n\n` +
      `👥 **Đội khả dụng:** \`{teams_available}\` đội\n` +
      `📊 **Còn trống:** \`{slots_available}\` slots\n` +
      `⏳ **Hàng chờ hiện tại:** \`{pending_count}\` yêu cầu\n` +
      `🎉 **Đã hoàn tất:** \`{success_count}\` lượt\n\n` +
      `👉 Bấm **⚡ BẮT ĐẦU MỜI CANVA PRO** bên dưới để chọn gói vai trò và nhập Email Canva của bạn!`;

    const DEFAULT_MSG_PROMPT = `📝 **VUI LÒNG NHẬP EMAIL CỦA BẠN ĐỂ NHẬN LỜI MỜI CANVA PRO**\n\n` +
      `📦 **Gói đã chọn:** {role_title}\n` +
      `💰 **Đơn giá:** \`{price}\` (Trừ thẳng vào số dư Bot)\n\n` +
      `👉 Vui lòng gửi địa chỉ Email tài khoản Canva của bạn vào khung chat bên dưới:\n` +
      `*(Ví dụ: \`example@gmail.com\`)*\n\n` +
      `Gõ /cancel hoặc nút **❌ Huỷ** để dừng thao tác.`;

    const DEFAULT_MSG_PROCESSING = `⏳ **ĐANG XỬ LÝ MỜI CANVA PRO...**\n\n🆔 **Mã đơn:** \`#{task_id}\`\n📧 **Email:** \`{email}\`\n🎭 **Vai trò:** \`{role_title}\`\n📊 **Vị trí hàng chờ:** Số \`{queue_pos}\`\n💰 **Đã trừ:** \`{price}\`\n\n🛡️ *Hệ thống đang tự động thao tác gửi lời mời qua Canva Team API. Vui lòng đợi trong giây lát...*`;

    const DEFAULT_MSG_SUCCESS = `🎉 **MỜI CANVA PRO THÀNH CÔNG!**\n\n📧 **Email nhận:** \`{email}\`\n🏢 **Tên Đội Canva:** \`{team_name}\`\n💰 **Đơn giá:** \`{price}\`\n🕒 **Thời gian:** {time}\n\n🔗 **LINK THAM GIA ĐỘI CANVA PRO:**\n👉 [BẤM VÀO ĐÂY ĐỂ VÀO ĐỘI]({invite_link})\n*(Hoặc copy link: \`{invite_link}\`)*\n\n✨ Bạn có thể bấm link trên hoặc kiểm tra hòm thư Email để chấp nhận vào nhóm Canva Pro ngay!`;

    const DEFAULT_MSG_FAILED = `❌ **MỜI CANVA PRO THẤT BẠI!**\n\n📧 **Email:** \`{email}\`\n⚠️ **Lý do:** \`{reason}\`{refund_note}\n\n👉 Vui lòng thử lại hoặc liên hệ Admin để được hỗ trợ.`;

    return {
      apiUrl: map['canva_api_url'] || 'http://localhost:1568',
      enabled,
      price,
      priceDesigner,
      priceMember,
      headless,
      concurrency: Math.max(1, concurrency || 1),
      defaultRole,
      customEmojiId,
      proxies,
      msg_menu: map['canva_msg_menu'] || DEFAULT_MSG_MENU,
      msg_prompt: map['canva_msg_prompt'] || DEFAULT_MSG_PROMPT,
      msg_processing: map['canva_msg_processing'] || DEFAULT_MSG_PROCESSING,
      msg_success: map['canva_msg_success'] || DEFAULT_MSG_SUCCESS,
      msg_failed: map['canva_msg_failed'] || DEFAULT_MSG_FAILED
    };
  } catch (err) {
    console.error('[CANVA_QUEUE] Lỗi đọc cài đặt:', err.message);
    return {
      apiUrl: 'http://localhost:1568',
      enabled: true,
      price: 15000,
      priceDesigner: 20000,
      priceMember: 15000,
      headless: true,
      concurrency: 1,
      defaultRole: 'designer',
      customEmojiId: '',
      proxies: [],
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
 * Chọn Đội Canva khả dụng còn chỗ trống
 */
export const pickAvailableCanvaTeam = async () => {
  const rows = await query(`
    SELECT * FROM canva_teams 
    WHERE status = 'active' AND current_members < member_limit
    ORDER BY current_members ASC, id ASC
    LIMIT 1
  `);
  return rows[0] || null;
};

/**
 * Xử lý một tác vụ mời Canva Pro đơn lẻ
 */
const processTask = async (task, settings) => {
  activeTasksCount++;
  console.log(`[CANVA_QUEUE] 🚀 Bắt đầu thực thi Task #${task.id} cho email: ${task.email}`);

  // Tìm Team khả dụng
  const team = await pickAvailableCanvaTeam();
  if (!team) {
    console.error(`[CANVA_QUEUE] ❌ Không có Canva Team nào khả dụng hoặc tất cả các đội đã đầy!`);
    await query(
      "UPDATE canva_tasks SET status = 'failed', completed_at = NOW(), error_message = 'Tất cả các đội Canva hiện đã đầy chỗ hoặc tạm bảo trì', step_status = 'Thất bại' WHERE id = ?",
      [task.id]
    );

    // Hoàn tiền cho khách
    if (task.price > 0 && task.user_id) {
      try {
        await query("UPDATE users SET balance = balance + ? WHERE id = ?", [task.price, task.user_id]);
        await addBalanceLog({
          userId: task.user_id,
          amount: Number(task.price),
          reason: `refund_canva_pro_no_team_${task.id}`
        });
      } catch (_) {}
    }

    if (workerBot && task.telegram_id) {
      const errorMsg = 
        `❌ **MỜI CANVA PRO THẤT BẠI!**\n\n` +
        `📧 **Email:** \`${task.email}\`\n` +
        `⚠️ **Lý do:** \`Tất cả các đội Canva hiện đã đầy slot. Đã hoàn tiền cho bạn.\`\n\n` +
        `💵 **Đã hoàn lại:** \`${formatCurrency(task.price)}\` vào số dư Bot của bạn.`;
      
      if (task.message_id) {
        await workerBot.editMessageText(errorMsg, { chat_id: task.telegram_id, message_id: task.message_id, parse_mode: 'Markdown' }).catch(() => {});
      } else {
        await workerBot.sendMessage(task.telegram_id, errorMsg, { parse_mode: 'Markdown' }).catch(() => {});
      }
    }

    activeTasksCount--;
    return;
  }

  const proxy = team.proxy || pickRandomProxy(settings.proxies);

  // Cập nhật trạng thái bắt đầu
  await query(
    "UPDATE canva_tasks SET status = 'running', team_id = ?, team_name = ?, proxy_used = ?, started_at = NOW(), step_status = 'Đang kết nối tài khoản Canva...' WHERE id = ?",
    [team.id, team.name, proxy || 'Direct', task.id]
  );

  let lastProgressUpdate = 0;
  const onProgress = async (progress) => {
    try {
      const now = Date.now();
      await query("UPDATE canva_tasks SET step_status = ? WHERE id = ?", [progress.text, task.id]);

      // Throttle cập nhật tin nhắn cho Telegram user (ít nhất 2.5s / lần)
      if (workerBot && task.telegram_id && task.message_id && (now - lastProgressUpdate > 2500)) {
        lastProgressUpdate = now;
        const statusText = 
          `⏳ **ĐANG XỬ LÝ MỜI CANVA PRO...**\n\n` +
          `📧 **Email:** \`${task.email}\`\n` +
          `🏢 **Đội Canva:** \`${team.name}\`\n` +
          `📌 **Tiến trình:** \`[${progress.step}/${progress.total}]\` ${progress.text}\n\n` +
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
    let result = null;

    // Call external Canva Invite API (Port 1568 by default or configured apiUrl)
    const apiUrl = (settings.apiUrl || 'http://localhost:1568').replace(/\/+$/, '');
    const endpoint = `${apiUrl}/api/canva/invite`;
    const requestPayload = {
      email: task.email,
      role: task.role || team.role || settings.defaultRole || 'designer',
      headless: settings.headless !== false,
      team_id: team.id
    };

    console.log(`[CANVA_QUEUE] 📤 Gửi request tới API: ${endpoint}`);
    console.log(`[CANVA_QUEUE] 📦 Dữ liệu gửi đi:`, JSON.stringify(requestPayload, null, 2));
    console.log(`[CANVA_QUEUE] ⏳ Đang đợi Canva xử lý và trả link mời...`);

    try {
      const apiRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(60000)
      });

      const apiData = await apiRes.json().catch(() => null);
      console.log(`[CANVA_QUEUE] 📥 Nhận phản hồi API Canva (HTTP ${apiRes.status}):`, JSON.stringify(apiData, null, 2));

      if (apiRes.ok && apiData && apiData.success) {
        result = apiData;
      } else {
        const errMsg = apiData?.error || `Canva API Server lỗi (HTTP ${apiRes.status})`;
        throw new Error(errMsg);
      }
    } catch (e) {
      console.error('[CANVA_QUEUE] API call error:', e.message);
      throw e;
    }

    if (result && result.success && result.inviteLink) {
      // 1. Cập nhật task thành công
      await query(
        `UPDATE canva_tasks 
         SET status = 'completed', completed_at = NOW(), invite_link = ?, invite_token = ?, team_name = ?, step_status = 'Mời thành công!' 
         WHERE id = ?`,
        [result.inviteLink, result.inviteToken || null, result.teamName || team.name, task.id]
      );

      // 2. Cập nhật số lượng thành viên của Canva Team (chuyển đổi số nguyên an toàn)
      let newMemberCount = Number(team.current_members || 0) + 1;
      if (result.memberCount !== undefined && result.memberCount !== null) {
        const digitsOnly = String(result.memberCount).replace(/\D/g, '');
        if (digitsOnly) {
          const parsed = parseInt(digitsOnly, 10);
          if (!isNaN(parsed) && parsed > 0) {
            newMemberCount = parsed;
          }
        }
      }

      const isFull = newMemberCount >= team.member_limit;
      await query(
        `UPDATE canva_teams 
         SET current_members = ?, status = ?, last_checked_at = NOW() 
         WHERE id = ?`,
        [newMemberCount, isFull ? 'full' : 'active', team.id]
      );

      console.log(`[CANVA_QUEUE] ✅ Hoàn thành Task #${task.id} (${task.email}) -> Link: ${result.inviteLink} (Tổng TV: ${newMemberCount})`);

      // 3. Gửi thông báo thành công kèm Link tham gia cho khách
      if (workerBot && task.telegram_id) {
        const timeStr = new Date().toLocaleString('vi-VN');
        const teamDisplayName = result.teamName || team.name || 'Đội Canva Pro';
        
        let successMsgHtml = `🎉 <b>MỜI CANVA PRO THÀNH CÔNG!</b>\n\n` +
          `📧 <b>Email nhận:</b> <code>${task.email}</code>\n` +
          `🏢 <b>Tên Đội Canva:</b> <b>${teamDisplayName}</b>\n` +
          `💰 <b>Đơn giá:</b> <code>${formatCurrency(task.price)}</code>\n` +
          `🕒 <b>Thời gian:</b> ${timeStr}\n\n` +
          `🔗 <b>LINK THAM GIA ĐỘI CANVA PRO:</b>\n👉 <a href="${result.inviteLink}">BẤM VÀO ĐÂY ĐỂ VÀO ĐỘI</a>\n\n` +
          `✨ Bạn có thể bấm nút <b>THAM GIA ĐỘI CANVA NGAY</b> bên dưới hoặc kiểm tra hòm thư Email!`;

        const inlineKeyboard = [
          [{ text: '🚀 THAM GIA ĐỘI CANVA NGAY', url: result.inviteLink }]
        ];

        if (task.message_id) {
          await workerBot.editMessageText(successMsgHtml, {
            chat_id: task.telegram_id,
            message_id: task.message_id,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: inlineKeyboard }
          }).catch(async (e) => {
            console.warn('[CANVA_QUEUE] Edit message failed, sending new message:', e.message);
            await workerBot.sendMessage(task.telegram_id, successMsgHtml, {
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: inlineKeyboard }
            }).catch(async () => {
              await workerBot.sendMessage(
                task.telegram_id,
                `🎉 MỜI CANVA PRO THÀNH CÔNG!\n\nEmail: ${task.email}\nĐội: ${teamDisplayName}\nLink tham gia: ${result.inviteLink}`,
                { reply_markup: { inline_keyboard: inlineKeyboard } }
              ).catch(() => {});
            });
          });
        } else {
          await workerBot.sendMessage(task.telegram_id, successMsgHtml, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: inlineKeyboard }
          }).catch(async () => {
            await workerBot.sendMessage(
              task.telegram_id,
              `🎉 MỜI CANVA PRO THÀNH CÔNG!\n\nEmail: ${task.email}\nĐội: ${teamDisplayName}\nLink tham gia: ${result.inviteLink}`,
              { reply_markup: { inline_keyboard: inlineKeyboard } }
            ).catch(() => {});
          });
        }
      }
    } else {
      throw new Error(result?.error || 'Không trích xuất được link mời Canva Pro');
    }
  } catch (err) {
    console.error(`[CANVA_QUEUE] ❌ Thất bại Task #${task.id}:`, err.message);

    // Cập nhật trạng thái thất bại
    await query(
      "UPDATE canva_tasks SET status = 'failed', completed_at = NOW(), error_message = ?, step_status = 'Thất bại' WHERE id = ?",
      [err.message || 'Lỗi không xác định', task.id]
    );

    // Kiểm tra nếu lỗi do cookie die thì đánh dấu team expired
    if (err.message && (err.message.includes('Login') || err.message.includes('Cookie') || err.message.includes('đăng xuất'))) {
      await query("UPDATE canva_teams SET status = 'expired' WHERE id = ?", [team.id]).catch(() => {});
    }

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
            reason: `refund_canva_pro_${task.id}`
          });
          refundNote = `\n\n💵 <b>Đã hoàn lại:</b> <code>${formatCurrency(task.price)}</code> vào số dư Bot của bạn.`;
        }
      } catch (refundErr) {
        console.error('[CANVA_QUEUE] Lỗi hoàn tiền:', refundErr.message);
      }
    }

    // Gửi thông báo lỗi cho khách hàng
    if (workerBot && task.telegram_id) {
      const errorMsgHtml = 
        `❌ <b>MỜI CANVA PRO THẤT BẠI!</b>\n\n` +
        `📧 <b>Email:</b> <code>${task.email}</code>\n` +
        `⚠️ <b>Lý do:</b> <code>${err.message || 'Hệ thống Canva bận hoặc lỗi xác minh'}</code>${refundNote}\n\n` +
        `👉 Vui lòng thử lại với một Email khác hoặc liên hệ Admin để được hỗ trợ.`;

      if (task.message_id) {
        await workerBot.editMessageText(errorMsgHtml, {
          chat_id: task.telegram_id,
          message_id: task.message_id,
          parse_mode: 'HTML'
        }).catch(async () => {
          await workerBot.sendMessage(task.telegram_id, errorMsgHtml, { parse_mode: 'HTML' }).catch(async () => {
            await workerBot.sendMessage(
              task.telegram_id,
              `❌ MỜI CANVA PRO THẤT BẠI!\nEmail: ${task.email}\nLý do: ${err.message || 'Lỗi xử lý'}`
            ).catch(() => {});
          });
        });
      } else {
        await workerBot.sendMessage(task.telegram_id, errorMsgHtml, { parse_mode: 'HTML' }).catch(async () => {
          await workerBot.sendMessage(
            task.telegram_id,
            `❌ MỜI CANVA PRO THẤT BẠI!\nEmail: ${task.email}\nLý do: ${err.message || 'Lỗi xử lý'}`
          ).catch(() => {});
        });
      }
    }
  } finally {
    activeTasksCount--;
  }
};

/**
 * Vòng lặp kiểm tra và kéo việc từ hàng chờ
 */
export const checkCanvaQueueAndProcess = async () => {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    const settings = await getCanvaSettings();
    if (!settings.enabled) {
      isWorkerRunning = false;
      return;
    }

    const availableSlots = settings.concurrency - activeTasksCount;
    if (availableSlots <= 0) {
      isWorkerRunning = false;
      return;
    }

    const pendingTasks = await query(
      "SELECT * FROM canva_tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
      [availableSlots]
    );

    if (pendingTasks && pendingTasks.length > 0) {
      for (const task of pendingTasks) {
        processTask(task, settings).catch(e => {
          console.error('[CANVA_QUEUE] Lỗi unhandled task:', e);
        });
      }
    }
  } catch (err) {
    console.error('[CANVA_QUEUE] Lỗi kiểm tra hàng chờ:', err.message);
  } finally {
    isWorkerRunning = false;
  }
};

/**
 * Khởi động Worker quản lý Hàng chờ Canva Pro
 */
export const startCanvaQueueWorker = (bot, config) => {
  workerBot = bot;
  if (queueInterval) clearInterval(queueInterval);

  console.log('✅ [CANVA_QUEUE] Đã khởi động dịch vụ quản lý Hàng chờ Canva Pro Auto Invite');

  // Kiểm tra hàng chờ mỗi 4 giây
  queueInterval = setInterval(() => {
    checkCanvaQueueAndProcess().catch(() => {});
  }, 4000);

  // Kích hoạt ngay lần đầu
  checkCanvaQueueAndProcess().catch(() => {});
};

/**
 * Thêm một task mới vào hàng chờ Canva
 */
export const addCanvaTask = async ({ userId, telegramId, email, role = 'member', price = 0, messageId = null }) => {
  const result = await query(
    `INSERT INTO canva_tasks (user_id, telegram_id, email, role, price, status, step_status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 'Đang trong hàng chờ...', NOW())`,
    [userId || null, telegramId || null, email.trim(), role, price]
  );

  const taskId = result.insertId;

  const countRows = await query(
    "SELECT COUNT(*) as queue_pos FROM canva_tasks WHERE status = 'pending' AND id <= ?",
    [taskId]
  );
  const queuePos = countRows[0]?.queue_pos || 1;

  setTimeout(() => {
    checkCanvaQueueAndProcess().catch(() => {});
  }, 300);

  return { taskId, queuePos };
};
