import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, execute } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_SESSION_JSON = path.join(__dirname, 'canva_session.json');
const FILE_INVITES_OUTPUT = path.join(__dirname, 'canva_invites.json');
const FILE_INVITE_LINKS_TXT = path.join(__dirname, 'canva_invite_links.txt');

// Role Mapping:
// 'designer' -> Nhà thiết kế thương hiệu của đội (Mã C)
// 'member'   -> Thành viên đội (Mã B)
// 'admin'    -> Quản trị viên đội (Mã A)
export const ROLE_CODE_MAP = {
  designer: 'C',
  member: 'B',
  admin: 'A',
  C: 'C',
  B: 'B',
  A: 'A'
};

export const ROLE_NAME_MAP = {
  designer: 'Nhà thiết kế thương hiệu của đội',
  member: 'Thành viên đội',
  admin: 'Quản trị viên đội',
  C: 'Nhà thiết kế thương hiệu của đội',
  B: 'Thành viên đội',
  A: 'Quản trị viên đội'
};

const STEALTH_LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-infobars',
  '--window-size=1366,850',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-service-autorun',
  '--password-store=basic'
];

/**
 * Phân tích và chuẩn hóa dữ liệu Cookie từ nhiều nguồn khác nhau
 */
export function parseCookies(rawInput) {
  if (!rawInput) return [];

  let list = [];

  if (Array.isArray(rawInput)) {
    list = rawInput;
  } else if (typeof rawInput === 'object' && rawInput !== null) {
    if (Array.isArray(rawInput.cookies)) {
      list = rawInput.cookies;
    } else if (Array.isArray(rawInput.data)) {
      list = rawInput.data;
    }
  } else if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) return [];

    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseCookies(parsed);
      } catch (_) {}
    }

    if (trimmed.includes('\t') && (trimmed.includes('.canva.com') || trimmed.includes('canva.com'))) {
      const lines = trimmed.split('\n');
      for (const line of lines) {
        const l = line.trim();
        if (!l || l.startsWith('#')) continue;
        const parts = l.split('\t');
        if (parts.length >= 7) {
          list.push({
            domain: parts[0],
            httpOnly: parts[1] === 'TRUE',
            path: parts[2],
            secure: parts[3] === 'TRUE',
            expirationDate: parseInt(parts[4], 10),
            name: parts[5],
            value: parts[6]
          });
        }
      }
    }

    if (list.length === 0) {
      const pairs = trimmed.split(';');
      for (const pair of pairs) {
        const p = pair.trim();
        if (!p) continue;
        const eqIdx = p.indexOf('=');
        if (eqIdx > 0) {
          const name = p.slice(0, eqIdx).trim();
          const value = p.slice(eqIdx + 1).trim();
          if (name) {
            list.push({
              name,
              value,
              domain: '.canva.com',
              path: '/',
              secure: true,
              sameSite: 'Lax'
            });
          }
        }
      }
    }
  }

  // Lọc chỉ giữ các phần tử cookie hợp lệ (có name & value dạng chuỗi)
  return list.filter(c => c && typeof c === 'object' && typeof c.name === 'string' && c.name.trim() && c.value !== undefined);
}

/**
 * Format Cookie cho Playwright Context với SameSite & Domain chuẩn xác
 */
export function formatCookiesForPlaywright(rawCookies) {
  const cookieList = parseCookies(rawCookies);
  if (!Array.isArray(cookieList)) return [];

  return cookieList.map(c => {
    if (!c || !c.name) return null;

    let sameSite = 'Lax';
    const s = String(c.sameSite || '').toLowerCase();
    if (s === 'strict') sameSite = 'Strict';
    else if (s === 'none' || s === 'no_restriction') sameSite = 'None';
    else if (s === 'lax') sameSite = 'Lax';

    let secure = typeof c.secure === 'boolean' ? c.secure : true;
    if (sameSite === 'None') secure = true;

    let domain = c.domain || '.canva.com';

    const cookieObj = {
      name: String(c.name).trim(),
      value: String(c.value !== undefined && c.value !== null ? c.value : ''),
      domain: domain,
      path: c.path || '/',
      httpOnly: !!c.httpOnly,
      secure: secure,
      sameSite: sameSite
    };

    const exp = c.expirationDate || c.expires;
    if (typeof exp === 'number' && exp > 0) {
      const expSec = exp > 1e11 ? Math.floor(exp / 1000) : Math.floor(exp);
      if (expSec > Date.now() / 1000 - 86400) {
        cookieObj.expires = expSec;
      }
    }

    return cookieObj;
  }).filter(Boolean);
}

/**
 * Tạo chuỗi Cookie Header
 */
export function getCookieHeaderString(rawCookies) {
  const cookieList = parseCookies(rawCookies);
  if (!Array.isArray(cookieList)) return '';
  return cookieList
    .filter(c => c && c.name)
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

/**
 * Khởi tạo Context và Page Playwright đã nạp sẵn Cookie và Anti-Detect Scripts
 */
async function createCanvaBrowserAndPage(cookies, localStorage = {}, headless = true) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: headless,
      channel: 'chrome',
      ignoreDefaultArgs: ['--enable-automation'],
      args: STEALTH_LAUNCH_ARGS
    });
  } catch {
    browser = await chromium.launch({
      headless: headless,
      ignoreDefaultArgs: ['--enable-automation'],
      args: STEALTH_LAUNCH_ARGS
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    ignoreHTTPSErrors: true
  });

  // Anti-detect scripts
  await context.addInitScript(() => {
    try {
      delete Object.getPrototypeOf(navigator).webdriver;
    } catch (_) {}
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
      app: {}
    };
    Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });
  });

  // NẠP COOKIE TRƯỚC KHI TẠO PAGE ĐỂ BROWSER KHỞI TẠO Ở TRẠNG THÁI ĐÃ XÁC THỰC
  if (Array.isArray(cookies) && cookies.length > 0) {
    await context.addCookies(cookies);
  }

  const page = await context.newPage();

  // Nạp LocalStorage nếu có
  if (localStorage && typeof localStorage === 'object' && Object.keys(localStorage).length > 0) {
    await page.addInitScript((storage) => {
      try {
        if (storage) {
          for (const [key, value] of Object.entries(storage)) {
            window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
          }
        }
      } catch (_) {}
    }, localStorage);
  }

  return { browser, context, page };
}

/**
 * Tự động phát hiện và xử lý Cloudflare Challenge nếu gặp
 */
async function handleCloudflareChallenge(page) {
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const title = await page.title().catch(() => '');
      const hasCf = title.includes('Chờ một chút') || 
                    title.includes('Just a moment') || 
                    title.includes('Attention Required') || 
                    title.includes('Cloudflare');

      if (!hasCf) break;

      console.log(`[CANVA_STEALTH] 🛡️ Phát hiện màn hình Cloudflare ("${title}"), đang chờ/giải quyết (${attempt + 1}/5)...`);
      try {
        const frames = page.frames();
        for (const frame of frames) {
          const checkbox = frame.locator('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage input, .cf-turnstile-wrapper');
          if (await checkbox.isVisible({ timeout: 1500 }).catch(() => false)) {
            await checkbox.click({ force: true }).catch(() => {});
            await page.waitForTimeout(2000);
            break;
          }
        }
      } catch (_) {}

      await page.waitForTimeout(2500);
    }
  } catch (_) {}
}

/**
 * Lấy dữ liệu Canva Session từ MySQL CSDL hoặc File canva_session.json dự phòng
 */
export async function getCanvaSession(teamId = null) {
  try {
    // 1. Thử lấy từ bảng canva_teams theo schema
    let teamSql = 'SELECT id as team_id, name as team_name, cookies, local_storage, proxy FROM canva_teams WHERE status = "active"';
    let params = [];
    if (teamId) {
      teamSql += ' AND id = ? LIMIT 1';
      params.push(teamId);
    } else {
      teamSql += ' ORDER BY id ASC LIMIT 1';
    }

    try {
      const teamRows = await query(teamSql, params);
      if (teamRows && teamRows.length > 0) {
        const row = teamRows[0];
        let cookies = typeof row.cookies === 'string' ? JSON.parse(row.cookies) : row.cookies;
        let localStorage = row.local_storage ? (typeof row.local_storage === 'string' ? JSON.parse(row.local_storage) : row.local_storage) : null;

        const parsed = parseCookies(cookies);
        if (parsed.length > 0) {
          return {
            teamId: row.team_id,
            teamName: row.team_name,
            cookies: parsed,
            localStorage: localStorage,
            proxy: row.proxy
          };
        }
      }
    } catch (_) {}

    // 2. Thử lấy từ bảng canva_sessions
    try {
      const rows = await query('SELECT saved_at, cookies, local_storage FROM canva_sessions WHERE id = 1');
      if (rows && rows.length > 0) {
        const row = rows[0];
        let cookies = typeof row.cookies === 'string' ? JSON.parse(row.cookies) : row.cookies;
        let localStorage = row.local_storage ? (typeof row.local_storage === 'string' ? JSON.parse(row.local_storage) : row.local_storage) : null;

        const parsed = parseCookies(cookies);
        if (parsed.length > 0) {
          return {
            teamId: 1,
            teamName: 'Đội Canva #1',
            savedAt: row.saved_at,
            cookies: parsed,
            localStorage: localStorage
          };
        }
      }
    } catch (_) {}

    // 3. Fallback đọc từ file canva_session.json
    if (fs.existsSync(FILE_SESSION_JSON)) {
      try {
        const fileContent = fs.readFileSync(FILE_SESSION_JSON, 'utf8').trim();
        const parsedJson = JSON.parse(fileContent);
        const parsed = parseCookies(parsedJson);
        if (parsed.length > 0) {
          return {
            teamId: 1,
            teamName: 'Đội Canva #1',
            savedAt: new Date().toISOString(),
            cookies: parsed,
            localStorage: (typeof parsedJson === 'object' && parsedJson.localStorage) || null
          };
        }
      } catch (_) {}
    }

    return null;
  } catch (err) {
    console.error('[CANVA_GET_SESSION_ERR]', err);
    return null;
  }
}

/**
 * Lưu / cập nhật Canva Session vào MySQL DB và đồng bộ ra file canva_session.json
 */
export async function saveCanvaSession(cookies, localStorage = {}, teamId = 1) {
  const parsedCookies = parseCookies(cookies);
  const finalStorage = localStorage || {};

  const cookiesJson = JSON.stringify(parsedCookies, null, 2);
  const localStorageJson = JSON.stringify(finalStorage);

  // 1. Lưu ra file canva_session.json làm bản sao dự phòng
  try {
    fs.writeFileSync(FILE_SESSION_JSON, cookiesJson, 'utf8');
  } catch (fsErr) {
    console.warn('[CANVA_FILE_SAVE_WARN]', fsErr.message);
  }

  // 2. Cập nhật bảng canva_sessions
  try {
    await execute(
      `INSERT INTO canva_sessions (id, saved_at, cookies, local_storage) 
       VALUES (1, NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE saved_at = NOW(), cookies = VALUES(cookies), local_storage = VALUES(local_storage)`,
      [JSON.stringify(parsedCookies), localStorageJson]
    );
  } catch (dbErr) {
    console.warn('[CANVA_SESSIONS_DB_WARN]', dbErr.message);
  }

  // 3. Cập nhật bảng canva_teams
  try {
    await execute(
      `INSERT INTO canva_teams (id, name, cookies, local_storage, status, last_checked_at)
       VALUES (?, 'Đội Canva #1', ?, ?, 'active', NOW())
       ON DUPLICATE KEY UPDATE cookies = VALUES(cookies), local_storage = VALUES(local_storage), status = 'active', last_checked_at = NOW()`,
      [teamId || 1, JSON.stringify(parsedCookies), localStorageJson]
    );
  } catch (dbErr) {
    console.warn('[CANVA_TEAMS_DB_WARN]', dbErr.message);
  }

  return { success: true, savedAt: new Date().toISOString(), totalCookies: parsedCookies.length };
}

/**
 * Kiểm tra trạng thái Session và lấy số lượng thành viên thực tế của Canva Team
 */
export async function getTeamInfo(teamId = null) {
  let browserInstance = null;
  try {
    const sessionData = await getCanvaSession(teamId);
    if (!sessionData || !Array.isArray(sessionData.cookies) || sessionData.cookies.length === 0) {
      return { valid: false, error: 'Chưa có session Canva hợp lệ trong hệ thống.' };
    }

    const formattedCookies = formatCookiesForPlaywright(sessionData.cookies);
    const { browser, page } = await createCanvaBrowserAndPage(formattedCookies, sessionData.localStorage, true);
    browserInstance = browser;

    console.log('[CANVA_INFO] 🌐 Đang truy cập https://www.canva.com/settings/people...');
    await page.goto('https://www.canva.com/settings/people', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    await handleCloudflareChallenge(page);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
      await browser.close();
      return {
        valid: false,
        error: 'Cookie Canva đã hết hạn hoặc bị đăng xuất (bị chuyển hướng về trang Login).'
      };
    }

    let memberCount = 'Không xác định';
    let numericMembers = null;
    try {
      const headerElem = await page.waitForSelector('h1', { timeout: 8000 });
      if (headerElem) {
        const headerText = await headerElem.innerText();
        const match = headerText.match(/\((\d+)\)/) || headerText.match(/(\d+)/);
        if (match) {
          memberCount = match[1];
          numericMembers = parseInt(match[1], 10);
        } else {
          memberCount = headerText.trim();
        }
      }
    } catch (_) {}

    // Cập nhật số lượng thành viên vào CSDL nếu có
    if (sessionData.teamId && numericMembers !== null) {
      try {
        await execute(
          'UPDATE canva_teams SET current_members = ?, last_checked_at = NOW() WHERE id = ?',
          [numericMembers, sessionData.teamId]
        );
      } catch (_) {}
    }

    await browser.close();

    return {
      valid: true,
      teamId: sessionData.teamId,
      teamName: sessionData.teamName || 'Đội Canva',
      memberCount: memberCount,
      savedAt: sessionData.savedAt || new Date().toISOString()
    };
  } catch (error) {
    if (browserInstance) await browserInstance.close().catch(() => {});
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Core API Service: Thực hiện mời thành viên Canva & lấy link mời
 * @param {object|string} params Email hoặc object { email, role, headless, teamId, userId, telegramId }
 * @param {string} [defaultRole='designer'] 'designer' | 'member' | 'admin' | 'A' | 'B' | 'C'
 * @param {boolean} [defaultHeadless=true] Chạy ngầm (mặc định true)
 */
export async function sendCanvaInviteApi(params, defaultRole = 'designer', defaultHeadless = true) {
  let email, role, headless, teamId, userId, telegramId;
  if (typeof params === 'object' && params !== null) {
    email = params.email;
    role = params.role || defaultRole;
    headless = params.headless !== undefined ? params.headless : defaultHeadless;
    teamId = params.teamId || params.team_id || null;
    userId = params.userId || params.user_id || null;
    telegramId = params.telegramId || params.telegram_id || null;
  } else {
    email = params;
    role = defaultRole;
    headless = defaultHeadless;
  }

  if (!email || !String(email).trim()) {
    return { success: false, error: 'Email không được để trống.' };
  }

  const targetEmail = String(email).trim().toLowerCase();
  const rawRole = String(role || 'designer').trim();
  const normalizedRole = rawRole === 'C' ? 'designer' : (rawRole === 'B' ? 'member' : (rawRole === 'A' ? 'admin' : rawRole));
  const roleName = ROLE_NAME_MAP[normalizedRole] || ROLE_NAME_MAP.designer;
  const roleCode = ROLE_CODE_MAP[normalizedRole] || 'C';

  const sessionData = await getCanvaSession(teamId);
  if (!sessionData || !Array.isArray(sessionData.cookies) || sessionData.cookies.length === 0) {
    return {
      success: false,
      email: targetEmail,
      role: roleName,
      roleCode: roleCode,
      error: 'Không tìm thấy session Canva hợp lệ trong hệ thống. Vui lòng nạp session trước!'
    };
  }

  const formattedCookies = formatCookiesForPlaywright(sessionData.cookies);
  let browserInstance = null;
  let pageInstance = null;
  const startTime = Date.now();

  try {
    const { browser, page } = await createCanvaBrowserAndPage(formattedCookies, sessionData.localStorage, headless);
    browserInstance = browser;
    pageInstance = page;

    console.log(`[CANVA_SERVICE] 🚀 Bắt đầu quy trình mời: ${targetEmail} (Vai trò: ${roleName})...`);

    // 1. Mở trang quản lý thành viên trực tiếp
    await page.goto('https://www.canva.com/settings/people', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    await handleCloudflareChallenge(page);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
      await browser.close();
      return {
        success: false,
        email: targetEmail,
        role: roleName,
        roleCode: roleCode,
        error: 'Cookie Canva đã hết hạn hoặc bị đăng xuất trên trình duyệt. Vui lòng cập nhật session mới!'
      };
    }

    // 2. Lấy số lượng thành viên hiện tại
    let memberCount = 'Không xác định';
    let numericMembers = null;
    try {
      const headerElem = await page.waitForSelector('h1', { timeout: 6000 });
      if (headerElem) {
        const headerText = await headerElem.innerText();
        const match = headerText.match(/\((\d+)\)/) || headerText.match(/(\d+)/);
        if (match) {
          memberCount = match[1];
          numericMembers = parseInt(match[1], 10);
        } else {
          memberCount = headerText.trim();
        }
      }
    } catch (_) {}

    // 3. Bấm nút "Mời thành viên"
    const inviteBtn = page.locator('button:has-text("Mời thành viên"), button:has-text("Invite members"), button:has-text("Thêm thành viên"), button[aria-label*="Mời" i], button[aria-label*="Invite" i]').first();
    await inviteBtn.waitFor({ state: 'visible', timeout: 12000 });
    await inviteBtn.click();
    await page.waitForTimeout(1200);

    // 4. Điền email cần mời
    const emailInput = page.locator('input[placeholder*="email" i], input[aria-label*="email" i], input[type="text"][inputmode="email"], input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.click();
    await emailInput.fill('');
    await emailInput.fill(targetEmail);
    await page.waitForTimeout(600);

    // 5. Chọn vai trò (Role Selection) nếu là Designer hoặc Admin
    if (normalizedRole === 'designer' || normalizedRole === 'admin') {
      try {
        const roleBtn = page.locator('button[aria-label*="vai trò" i], button[role="combobox"], button:has-text("Thành viên đội")').first();
        if (await roleBtn.isVisible({ timeout: 3000 })) {
          await roleBtn.click();
          await page.waitForTimeout(500);
          if (normalizedRole === 'designer') {
            const designerOption = page.locator('button:has-text("Nhà thiết kế thương hiệu"), li:has-text("Nhà thiết kế thương hiệu"), [role="option"]:has-text("Nhà thiết kế")').first();
            await designerOption.click();
          } else if (normalizedRole === 'admin') {
            const adminOption = page.locator('button:has-text("Quản trị viên đội"), li:has-text("Quản trị viên đội"), [role="option"]:has-text("Quản trị viên")').first();
            await adminOption.click();
          }
        }
      } catch (_) {}
      await page.waitForTimeout(500);
    }

    // 6. Đăng ký bộ lắng nghe API response tạo lời mời
    const responsePromise = page.waitForResponse(
      resp => (resp.url().includes('/invitations/create') || resp.url().includes('/brand/invitations/create') || (resp.url().includes('/invitation') && resp.request().method() === 'POST')) && resp.status() === 200,
      { timeout: 35000 }
    );

    // 7. Bấm nút Xác nhận và mời
    const confirmBtn = page.locator('button:has-text("Xác nhận và mời"), button:has-text("Confirm and invite"), button:has-text("Gửi lời mời"), button:has-text("Gửi")').first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 15000 });
    await confirmBtn.click();

    const response = await responsePromise;
    const responseText = await response.text();
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { raw: responseText };
    }

    console.log('[CANVA_SERVICE] 📩 Intercepted Invitation API Response:', JSON.stringify(responseJson, null, 2));

    let inviteLink = null;
    let inviteToken = null;
    let teamName = null;

    if (responseJson && Array.isArray(responseJson.A) && responseJson.A.length > 0) {
      const firstItem = responseJson.A[0];
      inviteToken = firstItem.F || null;
      teamName = (firstItem.L && firstItem.L.A) || null;
      inviteLink = firstItem.M || (inviteToken ? `https://www.canva.com/brand/join?token=${inviteToken}` : null);
    }

    // 8. Ghi nhận kết quả vào CSDL và File log dự phòng
    try {
      // 8.1 Ghi vào canva_tasks
      await execute(
        `INSERT INTO canva_tasks (user_id, telegram_id, team_id, email, role, invite_link, invite_token, team_name, status, step_status, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', 'success', NOW(), NOW())`,
        [
          userId || null,
          telegramId || null,
          sessionData.teamId || 1,
          targetEmail,
          normalizedRole,
          inviteLink,
          inviteToken,
          teamName || sessionData.teamName || 'Đội Canva'
        ]
      );

      // 8.2 Ghi vào canva_invites
      await execute(
        `INSERT INTO canva_invites (email, role, role_code, member_count, invite_link, invite_token, team_name, response_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          targetEmail,
          roleName,
          roleCode,
          memberCount,
          inviteLink,
          inviteToken,
          teamName || sessionData.teamName || 'Đội Canva',
          JSON.stringify(responseJson || {})
        ]
      );

      // 8.3 Cập nhật số lượng thành viên trong canva_teams
      if (sessionData.teamId && numericMembers !== null) {
        await execute(
          'UPDATE canva_teams SET current_members = ?, last_checked_at = NOW() WHERE id = ?',
          [numericMembers + 1, sessionData.teamId]
        );
      }
    } catch (dbErr) {
      console.warn('[CANVA_DB_LOG_WARN]', dbErr.message);
    }

    // 8.4 Ghi log file JSON & TXT
    try {
      if (inviteLink) {
        const linkEntry = `[${new Date().toISOString()}] ${targetEmail} | Role: ${roleName} | ${inviteLink}\n`;
        fs.appendFileSync(FILE_INVITE_LINKS_TXT, linkEntry, 'utf8');
      }

      let history = [];
      if (fs.existsSync(FILE_INVITES_OUTPUT)) {
        try {
          history = JSON.parse(fs.readFileSync(FILE_INVITES_OUTPUT, 'utf8'));
        } catch (_) {}
      }
      history.push({
        email: targetEmail,
        role: roleName,
        memberCount: memberCount,
        createdAt: new Date().toISOString(),
        inviteLink: inviteLink,
        inviteToken: inviteToken,
        teamName: teamName || sessionData.teamName || 'Đội Canva',
        fullResponse: responseJson
      });
      fs.writeFileSync(FILE_INVITES_OUTPUT, JSON.stringify(history, null, 2), 'utf8');
    } catch (_) {}

    await page.waitForTimeout(1000);
    await browser.close();

    const elapsed = Date.now() - startTime;

    return {
      success: true,
      email: targetEmail,
      role: roleName,
      roleCode: roleCode,
      memberCount: memberCount,
      inviteLink: inviteLink,
      inviteToken: inviteToken,
      teamName: teamName || sessionData.teamName || 'Đội Canva',
      elapsedMs: elapsed,
      response: responseJson
    };
  } catch (error) {
    if (pageInstance) {
      await pageInstance.screenshot({ path: path.join(__dirname, 'canva_error_debug.png') }).catch(() => {});
    }
    if (browserInstance) {
      await browserInstance.close().catch(() => {});
    }

    // Ghi nhận lỗi vào canva_tasks nếu có CSDL
    try {
      await execute(
        `INSERT INTO canva_tasks (user_id, telegram_id, team_id, email, role, status, step_status, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, 'failed', 'error', ?, NOW())`,
        [userId || null, telegramId || null, sessionData?.teamId || 1, targetEmail, normalizedRole, error.message]
      );
    } catch (_) {}

    return {
      success: false,
      email: targetEmail,
      role: roleName,
      roleCode: roleCode,
      error: error.message
    };
  }
}

// Alias for compatibility
export const inviteMemberApi = sendCanvaInviteApi;

/**
 * Mời nhiều email liên tiếp (Batch)
 */
export async function batchInvite(emails, role = 'designer', delayMs = 1000) {
  const results = [];
  for (let i = 0; i < emails.length; i++) {
    const email = String(emails[i]).trim();
    if (!email) continue;

    console.log(`[${i + 1}/${emails.length}] Đang gửi lời mời cho: ${email}...`);
    const res = await sendCanvaInviteApi(email, role);
    results.push(res);

    if (res.success) {
      console.log(`  ✓ Thành công! Link: ${res.inviteLink || 'Đã gửi qua email'}`);
    } else {
      console.log(`  ✗ Thất bại: ${res.error}`);
    }

    if (i < emails.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return {
    total: emails.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results: results
  };
}

/**
 * Lấy lịch sử lời mời đã lưu (Từ MySQL DB hoặc file JSON fallback)
 */
export async function getInviteHistory(limit = 100) {
  try {
    const rows = await query(
      `SELECT id, email, role, role_code, member_count, invite_link, invite_token, team_name, response_json, created_at
       FROM canva_invites
       ORDER BY id DESC LIMIT ?`,
      [Number(limit) || 100]
    );
    if (rows && rows.length > 0) {
      return rows.map(r => {
        let parsedResponse = null;
        try {
          parsedResponse = typeof r.response_json === 'string' ? JSON.parse(r.response_json) : r.response_json;
        } catch (_) {}
        return {
          id: r.id,
          email: r.email,
          role: r.role,
          roleCode: r.role_code,
          memberCount: r.member_count,
          inviteLink: r.invite_link,
          inviteToken: r.invite_token,
          teamName: r.team_name,
          response: parsedResponse,
          createdAt: r.created_at
        };
      });
    }
  } catch (_) {}

  // Fallback đọc từ file canva_invites.json
  if (fs.existsSync(FILE_INVITES_OUTPUT)) {
    try {
      const data = JSON.parse(fs.readFileSync(FILE_INVITES_OUTPUT, 'utf8'));
      return data.slice(-limit).reverse();
    } catch (_) {}
  }

  return [];
}

// Chạy trực tiếp từ CLI
if (process.argv[1] && process.argv[1].endsWith('canva_service.js')) {
  const readline = await import('readline');
  const args = process.argv.slice(2);

  let targetEmail = null;
  let role = 'designer';

  for (let i = 0; i < args.length; i++) {
    const a = args[i].toLowerCase();
    if (a === '--designer' || a === '-d') {
      role = 'designer';
    } else if (a === '--member' || a === '-m') {
      role = 'member';
    } else if (a === '--admin' || a === '-a') {
      role = 'admin';
    } else if (!a.startsWith('-') && !targetEmail) {
      targetEmail = args[i];
    }
  }

  if (targetEmail) {
    (async () => {
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║               CANVA AUTOMATED INVITE API                       ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');
      const res = await sendCanvaInviteApi(targetEmail, role, false);
      if (res.success) {
        console.log('\n[✓] MỜI THÀNH CÔNG!');
        console.log(`📧 Email       : ${res.email}`);
        console.log(`🎭 Vai trò     : ${res.role}`);
        console.log(`🔗 Invite Link : ${res.inviteLink || 'N/A'}`);
        console.log(`🔑 Token       : ${res.inviteToken || 'N/A'}`);
        console.log(`🏢 Team        : ${res.teamName || 'N/A'}`);
      } else {
        console.error(`\n[-] THẤT BẠI: ${res.error}`);
      }
    })();
  }
}

export default {
  sendCanvaInviteApi,
  inviteMemberApi,
  batchInvite,
  getTeamInfo,
  getInviteHistory,
  getCanvaSession,
  saveCanvaSession,
  parseCookies,
  formatCookiesForPlaywright,
  getCookieHeaderString,
  ROLE_CODE_MAP,
  ROLE_NAME_MAP
};
