import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, execute } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Format Cookie cho Playwright Context (Tự động lọc bỏ cookie Cloudflare cũ để tránh bị chặn Turnstile)
 */
export function formatCookiesForPlaywright(cookiesList) {
  if (!Array.isArray(cookiesList)) return [];
  // Lọc bỏ __cf_bm, _cfuvid, cf_clearance vì các cookie này bị gắn chặt với TLS fingerprint của trình duyệt cũ
  const validCookies = cookiesList.filter(c => c && c.name && !['__cf_bm', '_cfuvid', 'cf_clearance'].includes(c.name));

  return validCookies.map(c => {
    let sameSite = 'None';
    if (c.sameSite === 'strict' || c.sameSite === 'Strict') sameSite = 'Strict';
    else if (c.sameSite === 'lax' || c.sameSite === 'Lax') sameSite = 'Lax';
    else sameSite = 'None';

    const cookieObj = {
      name: c.name,
      value: c.value,
      domain: c.domain && c.domain.startsWith('.') ? c.domain : (c.domain || '.canva.com'),
      path: c.path || '/',
      httpOnly: !!c.httpOnly,
      secure: typeof c.secure === 'boolean' ? c.secure : true,
      sameSite: sameSite
    };

    if (typeof c.expirationDate === 'number') {
      cookieObj.expires = Math.floor(c.expirationDate);
    }

    return cookieObj;
  });
}

/**
 * Setup Stealth Browser Page (Bypass Cloudflare & Headless Detection on Linux/VPS)
 */
async function setupStealthPage(context, localStorage) {
  // Inject anti-detect scripts ở cấp độ context trước khi bất kỳ page nào load
  await context.addInitScript(() => {
    // 1. Hide navigator.webdriver hoàn toàn
    try {
      delete Object.getPrototypeOf(navigator).webdriver;
    } catch (_) {}
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // 2. Mock chrome object giống trình duyệt thật
    window.chrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
      app: {}
    };

    // 3. Mock languages & plugins
    Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' }
      ]
    });

    // 4. Mock notification permissions
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    }
  });

  const page = await context.newPage();

  // Inject LocalStorage if present
  if (localStorage && typeof localStorage === 'object') {
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

  return page;
}

/**
 * Tự động phát hiện và vượt qua màn hình Cloudflare Challenge / "Chờ một chút..." trên Server
 */
async function handleCloudflareChallenge(page) {
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      const title = await page.title().catch(() => '');
      const hasCf = title.includes('Chờ một chút') || 
                    title.includes('Just a moment') || 
                    title.includes('Attention Required') || 
                    title.includes('Cloudflare') ||
                    (await page.locator('text="We\'ll have you designing again soon", text="Đang xác minh", text="Verifying"').first().isVisible().catch(() => false));

      if (!hasCf) {
        break;
      }

      console.log(`[CANVA_STEALTH] 🛡️ Phát hiện màn hình Cloudflare ("${title}"), đang giải quyết (Lần ${attempt + 1}/10)...`);

      // Di chuyển chuột nhẹ tạo hành vi người dùng thật
      try {
        await page.mouse.move(100 + Math.random() * 200, 200 + Math.random() * 200);
      } catch (_) {}

      // 1. Thử tìm và click vào checkbox trong Turnstile iframe
      try {
        const frames = page.frames();
        for (const frame of frames) {
          const checkbox = frame.locator('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage input, #cf-stage input, .cf-turnstile-wrapper, div[role="checkbox"]');
          if (await checkbox.isVisible({ timeout: 1500 }).catch(() => false)) {
            console.log('[CANVA_STEALTH] 👉 Bấm Turnstile checkbox bên trong iframe...');
            await checkbox.click({ force: true }).catch(() => {});
            await page.waitForTimeout(2000);
            break;
          }
        }
      } catch (_) {}

      // 2. Thử click trực tiếp vào vị trí widget Cloudflare
      try {
        const cfWidget = page.locator('iframe[src*="cloudflare"], iframe[src*="turnstile"], iframe[title*="Cloudflare"], div[id*="turnstile"]').first();
        if (await cfWidget.isVisible({ timeout: 1500 }).catch(() => false)) {
          const box = await cfWidget.boundingBox();
          if (box) {
            console.log('[CANVA_STEALTH] 👉 Click tọa độ widget Cloudflare Turnstile...');
            await page.mouse.click(box.x + Math.min(box.width / 2, 35), box.y + box.height / 2);
          }
        }
      } catch (_) {}

      await page.waitForTimeout(2500);
    }
  } catch (_) {}
}

/**
 * Điều hướng an toàn vào trang Settings People của Canva:
 * 1. Mở https://www.canva.com và chờ trang load hoàn tất
 * 2. Nạp Cookies và LocalStorage vào phiên làm việc
 * 3. F5 / Reload lại trang chủ Canva để phiên đăng nhập được kích hoạt và chờ thành công
 * 4. Sau khi đăng nhập thành công trên trang chủ mới điều hướng vào https://www.canva.com/settings/people
 */
async function navigateToCanvaPeoplePage(context, page, cookies, localStorage) {
  // Bước 1: Mở trang chủ canva.com và chờ trang load hoàn tất
  console.log('[CANVA_STEALTH] 🌐 Bước 1: Đang truy cập https://www.canva.com (chờ load xong)...');
  await page.goto('https://www.canva.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);

  // Xử lý Cloudflare Challenge trên trang chủ nếu có
  await handleCloudflareChallenge(page);

  // Bước 2: Nạp Cookies và LocalStorage vào phiên làm việc sau khi đã load canva.com
  console.log('[CANVA_STEALTH] 🍪 Bước 2: Đang nạp Cookies và LocalStorage vào phiên...');
  if (Array.isArray(cookies) && cookies.length > 0) {
    await context.addCookies(cookies);
  }

  if (localStorage && typeof localStorage === 'object') {
    await page.evaluate((storage) => {
      try {
        for (const [key, value] of Object.entries(storage)) {
          window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      } catch (_) {}
    }, localStorage);
  }

  await page.waitForTimeout(1000);

  // Bước 3: Reload (F5) lại trang chủ Canva để phiên đăng nhập có hiệu lực và chờ xác thực thành công
  console.log('[CANVA_STEALTH] 🔄 Bước 3: Đang Reload lại trang chủ Canva để kích hoạt phiên đăng nhập...');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);

  // Xử lý Cloudflare sau khi reload trang chủ nếu có
  await handleCloudflareChallenge(page);

  // Chờ trang chủ nhận diện trạng thái đã đăng nhập (header / nav / profile)
  try {
    await page.waitForSelector('nav, header, button[aria-label*="tài khoản" i], button[aria-label*="account" i], button[aria-label*="cài đặt" i], a[href*="settings"]', { timeout: 8000 });
    console.log('[CANVA_STEALTH] ✅ Phiên đăng nhập đã được kích hoạt thành công trên trang chủ Canva.');
  } catch (_) {
    console.log('[CANVA_STEALTH] ⏳ Đã nạp phiên xong, tiếp tục chuyển trang...');
  }

  // Bước 4: Chuyển hướng vào trang quản lý thành viên /settings/people
  console.log('[CANVA_STEALTH] 👥 Bước 4: Đang chuyển vào https://www.canva.com/settings/people...');
  await page.goto('https://www.canva.com/settings/people', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);

  // Xử lý Cloudflare Challenge trên trang settings nếu có
  await handleCloudflareChallenge(page);

  // Kiểm tra nếu gặp thông báo "Đã xảy ra lỗi bên phía chúng tôi" -> tự động F5 / reload lại
  try {
    const errorNotice = page.locator('text="Đã xảy ra lỗi bên phía chúng tôi", text="Something went wrong on our end"').first();
    if (await errorNotice.isVisible({ timeout: 2000 })) {
      console.log('[CANVA_STEALTH] ⚠️ Phát hiện thông báo lỗi phía Canva, đang tự động F5 (Reload) lại trang Settings...');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await handleCloudflareChallenge(page);
    }
  } catch (_) {}
}

/**
 * Helper to fetch Canva session from MySQL DB (canva_teams or canva_sessions)
 */
export async function getCanvaSession(teamId = null) {
  try {
    // 1. Thử lấy từ bảng canva_teams theo schema chuẩn
    let teamSql = 'SELECT id as team_id, name as team_name, cookies, local_storage, proxy FROM canva_teams WHERE status = "active"';
    let params = [];
    if (teamId) {
      teamSql += ' AND id = ? LIMIT 1';
      params.push(teamId);
    } else {
      teamSql += ' ORDER BY id ASC LIMIT 1';
    }

    const teamRows = await query(teamSql, params);
    if (teamRows && teamRows.length > 0) {
      const row = teamRows[0];
      let cookies = [];
      try {
        cookies = typeof row.cookies === 'string' ? JSON.parse(row.cookies) : row.cookies;
      } catch (_) {}

      let localStorage = null;
      if (row.local_storage) {
        try {
          localStorage = typeof row.local_storage === 'string' ? JSON.parse(row.local_storage) : row.local_storage;
        } catch (_) {}
      }

      // Hỗ trợ nếu cookie được bọc dạng { url, savedAt, cookies: [...] }
      if (cookies && !Array.isArray(cookies) && Array.isArray(cookies.cookies)) {
        if (!localStorage && cookies.localStorage) localStorage = cookies.localStorage;
        cookies = cookies.cookies;
      }

      if (Array.isArray(cookies) && cookies.length > 0) {
        return {
          teamId: row.team_id,
          teamName: row.team_name,
          cookies: cookies,
          localStorage: localStorage,
          proxy: row.proxy
        };
      }
    }

    // 2. Fallback sang bảng canva_sessions
    const rows = await query('SELECT saved_at, cookies, local_storage FROM canva_sessions WHERE id = 1');
    if (rows && rows.length > 0) {
      const row = rows[0];
      let cookies = typeof row.cookies === 'string' ? JSON.parse(row.cookies) : row.cookies;
      let localStorage = row.local_storage ? (typeof row.local_storage === 'string' ? JSON.parse(row.local_storage) : row.local_storage) : null;

      if (cookies && !Array.isArray(cookies) && Array.isArray(cookies.cookies)) {
        if (!localStorage && cookies.localStorage) localStorage = cookies.localStorage;
        cookies = cookies.cookies;
      }

      if (Array.isArray(cookies) && cookies.length > 0) {
        return {
          teamId: 1,
          teamName: 'Đội Canva #1',
          savedAt: row.saved_at,
          cookies: cookies,
          localStorage: localStorage
        };
      }
    }

    return null;
  } catch (err) {
    console.error('[CANVA_GET_SESSION_ERR]', err);
    return null;
  }
}

/**
 * Helper to save/update Canva session in MySQL DB
 */
export async function saveCanvaSession(cookies, localStorage = {}, teamId = 1) {
  let finalCookies = cookies;
  let finalStorage = localStorage || {};

  if (typeof cookies === 'string') {
    try {
      finalCookies = JSON.parse(cookies);
    } catch (_) {}
  }

  if (finalCookies && !Array.isArray(finalCookies) && Array.isArray(finalCookies.cookies)) {
    if (finalCookies.localStorage && Object.keys(finalStorage).length === 0) {
      finalStorage = finalCookies.localStorage;
    }
    finalCookies = finalCookies.cookies;
  }

  const cookiesJson = JSON.stringify(finalCookies || []);
  const localStorageJson = JSON.stringify(finalStorage || {});

  // 1. Cập nhật bảng canva_sessions
  await execute(
    `INSERT INTO canva_sessions (id, saved_at, cookies, local_storage) 
     VALUES (1, NOW(), ?, ?)
     ON DUPLICATE KEY UPDATE saved_at = NOW(), cookies = VALUES(cookies), local_storage = VALUES(local_storage)`,
    [cookiesJson, localStorageJson]
  );

  // 2. Cập nhật bảng canva_teams theo schema.sql
  try {
    await execute(
      `INSERT INTO canva_teams (id, name, cookies, local_storage, status, last_checked_at)
       VALUES (?, 'Đội Canva #1', ?, ?, 'active', NOW())
       ON DUPLICATE KEY UPDATE cookies = VALUES(cookies), local_storage = VALUES(local_storage), status = 'active', last_checked_at = NOW()`,
      [teamId || 1, cookiesJson, localStorageJson]
    );
  } catch (e) {
    console.warn('[CANVA_TEAMS_SYNC_WARN]', e.message);
  }

  return { success: true, savedAt: new Date().toISOString() };
}

/**
 * Kiểm tra trạng thái Session và lấy thông tin số lượng thành viên (Đọc session từ MySQL DB)
 */
export async function getTeamInfo(teamId = null) {
  let browser = null;
  try {
    const sessionData = await getCanvaSession(teamId);
    if (!sessionData || !Array.isArray(sessionData.cookies) || sessionData.cookies.length === 0) {
      return { valid: false, error: 'Chưa có session Canva hợp lệ trong cơ sở dữ liệu.' };
    }

    const cookies = formatCookiesForPlaywright(sessionData.cookies);

    try {
      browser = await chromium.launch({
        headless: true,
        channel: 'chrome',
        ignoreDefaultArgs: ['--enable-automation'],
        args: STEALTH_LAUNCH_ARGS
      });
    } catch {
      browser = await chromium.launch({
        headless: true,
        ignoreDefaultArgs: ['--enable-automation'],
        args: STEALTH_LAUNCH_ARGS
      });
    }

    const context = await browser.newContext({
      viewport: { width: 1366, height: 850 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      ignoreHTTPSErrors: true
    });

    const page = await setupStealthPage(context, sessionData.localStorage);

    // Bước 1: canva.com -> Bước 2: Nạp cookie + localStorage -> Bước 3: settings/people (tự F5 nếu lỗi)
    await navigateToCanvaPeoplePage(context, page, cookies, sessionData.localStorage);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
      await browser.close();
      return {
        valid: false,
        error: 'Cookie Canva trong CSDL đã hết hạn (bị chuyển hướng về trang Login).'
      };
    }

    let memberCount = 'Không xác định';
    let numericMembers = null;
    try {
      const headerElem = await page.waitForSelector('h1[aria-label*="Thành viên"], h1[aria-label*="Member"], h1:has-text("Thành viên")', { timeout: 10000 });
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

    // Cập nhật số lượng thành viên vào bảng canva_teams
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
    if (browser) await browser.close().catch(() => {});
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Core API Service: Thực hiện mời thành viên Canva & lưu lịch sử vào MySQL Database (canva_tasks & canva_invites)
 * @param {object|string} params Email hoặc object { email, role, headless, teamId, userId, telegramId }
 * @param {string} [role='designer'] 'designer' | 'member' | 'admin' | 'A' | 'B' | 'C'
 * @param {boolean} [headless=true] Chạy ngầm (mặc định true)
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

  // 1. Đọc session và cookies từ MySQL CSDL (canva_teams / canva_sessions)
  const sessionData = await getCanvaSession(teamId);
  if (!sessionData || !Array.isArray(sessionData.cookies) || sessionData.cookies.length === 0) {
    return {
      success: false,
      email: targetEmail,
      role: roleName,
      roleCode: roleCode,
      error: 'Không tìm thấy session Canva hợp lệ trong cơ sở dữ liệu. Vui lòng nạp session trước!'
    };
  }

  const cookies = formatCookiesForPlaywright(sessionData.cookies);

  let browser;
  const startTime = Date.now();

  try {
    try {
      browser = await chromium.launch({
        headless: headless,
        channel: 'chrome',
        ignoreDefaultArgs: ['--enable-automation'],
        args: STEALTH_LAUNCH_ARGS
      });
    } catch (err) {
      browser = await chromium.launch({
        headless: headless,
        ignoreDefaultArgs: ['--enable-automation'],
        args: STEALTH_LAUNCH_ARGS
      });
    }

    const context = await browser.newContext({
      viewport: { width: 1366, height: 850 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      ignoreHTTPSErrors: true
    });

    const page = await setupStealthPage(context, sessionData.localStorage);

    // 1. Mở canva.com load xong -> 2. Nạp cookie + storage -> 3. Vào settings/people (tự F5 nếu lỗi)
    await navigateToCanvaPeoplePage(context, page, cookies, sessionData.localStorage);

    // Kiểm tra chuyển hướng đăng nhập
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
      await browser.close();
      return {
        success: false,
        email: targetEmail,
        role: roleName,
        roleCode: roleCode,
        error: 'Cookie Canva trong CSDL đã hết hạn hoặc bị đăng xuất trên trình duyệt. Vui lòng cập nhật session mới!'
      };
    }

    // Đóng các dialog / banner nếu có
    try {
      const dismissBtn = page.locator('button[aria-label="Đóng"], button[aria-label="Close"], button:has-text("Bỏ qua"), button:has-text("Dismiss"), button:has-text("Got it")').first();
      if (await dismissBtn.isVisible({ timeout: 2000 })) {
        await dismissBtn.click();
        await page.waitForTimeout(500);
      }
    } catch (_) {}

    // 3. Lấy số lượng thành viên
    let memberCount = 'Không xác định';
    let numericMembers = null;
    try {
      const headerElem = await page.waitForSelector('h1[aria-label*="Thành viên"], h1[aria-label*="Member"], h1:has-text("Thành viên")', { timeout: 8000 });
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

    // 4. Bấm "Mời thành viên" (Đa dạng bộ chọn và tự động thử lại nếu cần)
    const inviteSelectors = [
      'button:has-text("Mời thành viên")',
      'button:has-text("Invite members")',
      'button:has-text("Thêm thành viên")',
      'button:has-text("Invite people")',
      'button:has-text("Mời người")',
      'button[aria-label*="Mời" i]',
      'button[aria-label*="Invite" i]',
      'button[data-testid*="invite" i]',
      'a:has-text("Mời thành viên")',
      'a:has-text("Invite members")'
    ];

    let inviteBtn = null;
    for (const sel of inviteSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
        inviteBtn = el;
        break;
      }
    }

    if (!inviteBtn) {
      inviteBtn = page.locator(inviteSelectors.join(', ')).first();
      try {
        await inviteBtn.waitFor({ state: 'visible', timeout: 15000 });
      } catch (btnErr) {
        const pageUrlNow = page.url();
        const pageTitle = await page.title().catch(() => '');
        await page.screenshot({ path: path.join(__dirname, 'canva_error_debug.png') }).catch(() => {});
        await browser.close();
        return {
          success: false,
          email: targetEmail,
          role: roleName,
          roleCode: roleCode,
          error: `Không tìm thấy nút 'Mời thành viên' (URL: ${pageUrlNow}, Title: ${pageTitle}). Có thể tài khoản không phải Admin/Owner của đội hoặc cookies hết hạn.`
        };
      }
    }

    await inviteBtn.click();
    await page.waitForTimeout(1200);

    // 5. Điền email
    const emailInput = page.locator('input[placeholder*="email" i], input[aria-label*="email" i], input[type="text"][inputmode="email"], input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.click();
    await emailInput.fill('');
    await emailInput.fill(targetEmail);
    await page.waitForTimeout(500);

    // 6. Chọn vai trò
    if (normalizedRole === 'designer' || normalizedRole === 'admin') {
      try {
        const roleBtn = page.locator('button[aria-label*="vai trò" i], button[role="combobox"]').first();
        if (await roleBtn.isVisible({ timeout: 4000 })) {
          await roleBtn.click();
          await page.waitForTimeout(500);
          if (normalizedRole === 'designer') {
            const designerOption = page.locator('button:has-text("Nhà thiết kế thương hiệu"), li:has-text("Nhà thiết kế thương hiệu")').first();
            await designerOption.click();
          } else if (normalizedRole === 'admin') {
            const adminOption = page.locator('button:has-text("Quản trị viên đội"), li:has-text("Quản trị viên đội")').first();
            await adminOption.click();
          }
        }
      } catch (_) {}
      await page.waitForTimeout(500);
    }

    // 7. Lắng nghe API Response và bấm Confirm
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/_ajax/invitation/') && resp.status() === 200,
      { timeout: 35000 }
    );

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

    console.log('[CANVA_SERVICE] 📩 Intercepted Canva Ajax Response:', JSON.stringify(responseJson, null, 2));

    let inviteLink = null;
    let inviteToken = null;
    let teamName = null;

    if (responseJson && Array.isArray(responseJson.A) && responseJson.A.length > 0) {
      const firstItem = responseJson.A[0];
      inviteLink = firstItem.M || null;
      inviteToken = firstItem.F || null;
      teamName = (firstItem.L && firstItem.L.A) || null;
    }

    // 8. Ghi nhận kết quả mời vào MySQL Database (Bảng canva_tasks & canva_invites)
    try {
      // 8.1 Ghi vào canva_tasks theo schema.sql
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

      // 8.3 Cập nhật canva_teams
      if (sessionData.teamId && numericMembers !== null) {
        await execute(
          'UPDATE canva_teams SET current_members = ?, last_checked_at = NOW() WHERE id = ?',
          [numericMembers + 1, sessionData.teamId]
        );
      }
    } catch (dbLogErr) {
      console.error('[CANVA_DB_LOG_ERR]', dbLogErr.message);
    }

    await page.waitForTimeout(1500);
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
    if (browser) {
      await page.screenshot({ path: path.join(__dirname, 'canva_error_debug.png') }).catch(() => {});
      await browser.close().catch(() => {});
    }

    // Ghi nhận lỗi vào canva_tasks
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
 * Mời nhiều email liên tiếp
 */
export async function batchInvite(emails, role = 'designer', delayMs = 1000) {
  const results = [];
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i].trim();
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
 * Lấy lịch sử lời mời đã lưu từ MySQL Database (canva_tasks / canva_invites)
 */
export async function getInviteHistory(limit = 100) {
  try {
    const rows = await query(
      `SELECT id, email, role, role_code, member_count, invite_link, invite_token, team_name, response_json, created_at
       FROM canva_invites
       ORDER BY id DESC LIMIT ?`,
      [Number(limit) || 100]
    );
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
  } catch (err) {
    console.error('[CANVA_GET_HISTORY_ERR]', err);
    return [];
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
  ROLE_CODE_MAP,
  ROLE_NAME_MAP
};
