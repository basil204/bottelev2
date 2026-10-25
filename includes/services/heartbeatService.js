import os from 'os';
import axios from 'axios';
import fs from 'fs';
import { getAdminIds } from '../handle/handleNotify.js';
import { query } from '../database/index.js';

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1 giờ

const gb = (bytes) => (bytes / 1024 ** 3).toFixed(2);
const mb = (bytes) => (bytes / 1024 ** 2).toFixed(1);
const pct = (used, total) => (total > 0 ? ((used / total) * 100).toFixed(1) : '0.0');

const formatUptime = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
};

const measureCpuUsage = async () => {
  const snap = () => os.cpus().reduce((a, c) => {
    const t = Object.values(c.times).reduce((x, y) => x + y, 0);
    return { idle: a.idle + c.times.idle, total: a.total + t };
  }, { idle: 0, total: 0 });
  const a = snap();
  await new Promise((r) => setTimeout(r, 500));
  const b = snap();
  const total = b.total - a.total;
  return total > 0 ? (100 - ((b.idle - a.idle) / total) * 100).toFixed(1) : '0.0';
};

const getDiskInfo = async () => {
  try {
    const s = await fs.promises.statfs(process.cwd());
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    return `${gb(total - free)}/${gb(total)} GB (${pct(total - free, total)}%)`;
  } catch {
    return 'N/A';
  }
};

const measureNetwork = async () => {
  const result = { ping: null, down: null, up: null };
  try {
    const t = Date.now();
    await axios.get('https://api.telegram.org', { timeout: 5_000, validateStatus: () => true });
    result.ping = Date.now() - t;
  } catch { /* ignore */ }
  try {
    const t = Date.now();
    // Test download 2MB thay vì 10MB để ra kết quả nhanh trong 1-2s
    const res = await axios.get('https://speed.cloudflare.com/__down?bytes=2000000', {
      responseType: 'arraybuffer', timeout: 6_000
    });
    result.down = (res.data.byteLength * 8) / 1e6 / ((Date.now() - t) / 1000);
  } catch { /* ignore */ }
  try {
    // Test upload 1MB thay vì 3MB
    const payload = Buffer.alloc(1_000_000);
    const t = Date.now();
    await axios.post('https://speed.cloudflare.com/__up', payload, {
      timeout: 6_000, headers: { 'Content-Type': 'application/octet-stream' }
    });
    result.up = (payload.length * 8) / 1e6 / ((Date.now() - t) / 1000);
  } catch { /* ignore */ }
  return result;
};

const measureDatabase = async () => {
  const info = { ok: false, latency: null, error: null };
  try {
    const t = Date.now();
    const ver = await query('SELECT VERSION() AS v, DATABASE() AS db, @@max_connections AS maxc');
    info.latency = Date.now() - t;
    info.ok = true;
    info.version = ver?.[0]?.v;
    info.db = ver?.[0]?.db;
    info.maxConn = Number(ver?.[0]?.maxc);
    const rows = await query(
      "SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Uptime','Max_used_connections','Slow_queries','Aborted_connects')"
    );
    const s = {};
    (rows || []).forEach((r) => { s[r.Variable_name] = Number(r.Value); });
    info.status = s;
    const size = await query(
      'SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS mb FROM information_schema.tables WHERE table_schema = DATABASE()'
    );
    info.sizeMb = Number(size?.[0]?.mb || 0);
  } catch (err) {
    info.ok = false;
    info.error = err?.message || String(err);
  }
  return info;
};

const buildDatabaseLines = (db) => {
  if (!db.ok) {
    return ['🗄 <b>Database</b>', '• 🔴 <b>Mất kết nối</b>', `• Lỗi: <code>${String(db.error).slice(0, 200)}</code>`];
  }
  const s = db.status || {};
  const lat = db.latency;
  const speed = lat < 100 ? '🟢 nhanh' : lat < 500 ? '🟡 chậm' : '🔴 rất chậm';
  return [
    '🗄 <b>Database (MySQL)</b>',
    `• Trạng thái: 🟢 Đang hoạt động (${db.version || 'N/A'})`,
    `• DB: <code>${db.db || 'N/A'}</code> – ${db.sizeMb} MB`,
    `• Độ trễ truy vấn: ${lat} ms (${speed})`,
    `• Kết nối: ${s.Threads_connected ?? 'N/A'}/${db.maxConn || 'N/A'} (đang chạy: ${s.Threads_running ?? 'N/A'}, cao nhất: ${s.Max_used_connections ?? 'N/A'})`,
    `• Slow queries: ${s.Slow_queries ?? 'N/A'} | Kết nối lỗi: ${s.Aborted_connects ?? 'N/A'}`,
    `• Uptime DB: ${s.Uptime ? formatUptime(s.Uptime) : 'N/A'}`
  ];
};

const buildRestartAdvice = ({ ramPct, heapPct, rssMb, uptimeSec, ping, dbOk, dbLatency }) => {
  const reasons = [];
  if (ramPct >= 90) reasons.push(`RAM hệ thống đang ${ramPct.toFixed(1)}% (rất cao)`);
  if (heapPct >= 85) reasons.push(`Heap bot ${heapPct.toFixed(1)}% (nghi rò rỉ bộ nhớ)`);
  if (rssMb >= 1024) reasons.push(`Bot đang chiếm ${rssMb.toFixed(0)} MB RAM`);
  if (uptimeSec >= 7 * 86400 && (rssMb >= 600 || heapPct >= 70)) reasons.push('Bot chạy liên tục > 7 ngày và RAM đang tăng');
  if (ping !== null && ping >= 1500) reasons.push(`Ping Telegram cao (${ping} ms)`);
  if (ping === null) reasons.push('Không kết nối được tới Telegram');
  if (dbOk === false) reasons.push('Database mất kết nối');
  if (dbLatency >= 1000) reasons.push(`Database phản hồi chậm (${dbLatency} ms)`);
  if (reasons.length === 0) return ['✅ <b>Không cần restart</b> – mọi thứ ổn định.'];
  return ['⚠️ <b>Nên chạy lại bot để tối ưu:</b>', ...reasons.map((r) => `• ${r}`)];
};

const buildReport = async () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const mem = process.memoryUsage();
  const cpus = os.cpus();
  const cpuUsage = await measureCpuUsage();
  const load = os.loadavg().map((n) => n.toFixed(2)).join(' / ');
  const disk = await getDiskInfo();
  const net = await measureNetwork();
  const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const fmtSpeed = (v) => (v === null ? 'N/A' : `${v.toFixed(1)} Mbps`);
  const db = await measureDatabase();
  const advice = buildRestartAdvice({
    ramPct: (used / total) * 100,
    heapPct: (mem.heapUsed / mem.heapTotal) * 100,
    rssMb: mem.rss / 1024 ** 2,
    uptimeSec: process.uptime(),
    ping: net.ping,
    dbOk: db.ok,
    dbLatency: db.latency || 0
  });

  return [
    '🟢 <b>BOT VẪN ĐANG LIVE</b>',
    `🕒 ${now}`,
    '',
    '🖥 <b>Máy chủ</b>',
    `• Host: <code>${os.hostname()}</code> (${os.platform()} ${os.arch()})`,
    `• Uptime máy: ${formatUptime(os.uptime())}`,
    `• Uptime bot: ${formatUptime(process.uptime())}`,
    '',
    '🧠 <b>RAM hệ thống</b>',
    `• Đã dùng: ${gb(used)}/${gb(total)} GB (${pct(used, total)}%)`,
    `• Còn trống: ${gb(free)} GB`,
    '',
    '⚙️ <b>CPU</b>',
    `• ${cpus[0]?.model?.trim() || 'N/A'} (${cpus.length} nhân)`,
    `• Đang dùng: ${cpuUsage}%`,
    `• Load avg (1/5/15p): ${load}`,
    '',
    '💾 <b>Ổ đĩa</b>',
    `• ${disk}`,
    '',
    '🤖 <b>Tiến trình bot (Node ' + process.version + ')</b>',
    `• RSS: ${mb(mem.rss)} MB`,
    `• Heap: ${mb(mem.heapUsed)}/${mb(mem.heapTotal)} MB (${pct(mem.heapUsed, mem.heapTotal)}%)`,
    `• External: ${mb(mem.external)} MB`,
    '',
    '🌐 <b>Mạng</b>',
    `• Ping Telegram: ${net.ping === null ? 'N/A' : net.ping + ' ms'}`,
    `• Tải xuống: ${fmtSpeed(net.down)}`,
    `• Tải lên: ${fmtSpeed(net.up)}`,
    '',
    ...buildDatabaseLines(db),
    '',
    ...advice
  ].join('\n');
};

export const sendReportToChat = async (bot, chatId) => {
  const text = await buildReport();
  return bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
};

export const sendHeartbeat = async (bot, config) => {
  try {
    const adminIds = await getAdminIds(config?.ADMIN_IDS || []);
    if (!adminIds || adminIds.length === 0) return;
    const text = await buildReport();
    for (const adminId of adminIds) {
      try {
        await bot.sendMessage(adminId, text, { parse_mode: 'HTML' });
      } catch (err) {
        console.error(`[HEARTBEAT] Gửi thất bại tới admin ${adminId}:`, err?.message || err);
      }
    }
  } catch (err) {
    console.error('[HEARTBEAT] Lỗi:', err?.message || err);
  }
};

export const startHeartbeat = (bot, config) => {
  console.log('💓 [HEARTBEAT] Báo trạng thái live cho admin mỗi 1 giờ');
  sendHeartbeat(bot, config); // báo ngay khi khởi động
  return setInterval(() => sendHeartbeat(bot, config), HEARTBEAT_INTERVAL_MS);
};
