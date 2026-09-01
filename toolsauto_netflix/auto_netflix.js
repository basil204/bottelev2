import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đường dẫn file cấu hình và kết quả
const CONFIG_FILE = path.join(__dirname, 'config.json');
const SUCCESS_LOG_FILE = path.join(__dirname, 'netflix_success.txt');

/**
 * Phân tích và chuẩn hóa chuỗi proxy thành định dạng Playwright
 * Hỗ trợ:
 * - host:port
 * - host:port:user:pass
 * - user:pass@host:port
 * - http://user:pass@host:port
 * - socks5://user:pass@host:port
 */
export function parseProxy(proxyInput) {
  if (!proxyInput) return null;
  if (typeof proxyInput === 'object' && proxyInput.server) {
    return proxyInput;
  }

  const raw = String(proxyInput).trim();
  if (!raw) return null;

  try {
    let protocol = 'http';
    let clean = raw;

    if (clean.includes('://')) {
      const parts = clean.split('://');
      protocol = parts[0].toLowerCase();
      clean = parts[1];
    }

    // Format: user:pass@host:port
    if (clean.includes('@')) {
      const [auth, serverPart] = clean.split('@');
      const [username, password] = auth.split(':');
      return {
        server: `${protocol}://${serverPart}`,
        username: username || undefined,
        password: password || undefined
      };
    }

    // Format: host:port:user:pass or host:port
    const parts = clean.split(':');
    if (parts.length === 4) {
      const [host, port, user, pass] = parts;
      return {
        server: `${protocol}://${host}:${port}`,
        username: user,
        password: pass
      };
    } else if (parts.length === 2) {
      const [host, port] = parts;
      return {
        server: `${protocol}://${host}:${port}`
      };
    }

    return { server: `${protocol}://${clean}` };
  } catch (e) {
    console.warn('[!] Không thể parse proxy:', proxyInput, e.message);
    return null;
  }
}

// Đọc cấu hình
export function getConfiguration() {
  let config = {
    headless: false,
    useRealChrome: false,
    slowMo: 200,
    timeout: 45000,
    defaultEmail: 'testnetflix@hotmail.com',
    proxy: null,
    proxies: [],
    cookies: []
  };

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      config = { ...config, ...data };
    } catch (e) {
      console.warn('[!] Không thể đọc file config.json, sử dụng cấu hình mặc định:', e.message);
    }
  }

  // Parse tham số dòng lệnh
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase();
    if (arg === '--headless' || arg === '--hide' || arg === '-h') {
      config.headless = true;
    } else if (arg === '--show' || arg === '--visible' || arg === '--no-headless') {
      config.headless = false;
    } else if (arg === '--email' && args[i + 1]) {
      config.defaultEmail = args[i + 1];
      i++;
    } else if (arg === '--proxy' && args[i + 1]) {
      config.proxy = args[i + 1];
      i++;
    }
  }

  return config;
}

// Chuyển đổi cookie sang định dạng chuẩn của Playwright
export function formatCookies(cookiesList) {
  if (!Array.isArray(cookiesList)) return [];
  return cookiesList.map(c => {
    let sameSite = 'Lax';
    const s = String(c.sameSite || '').toLowerCase();
    if (s === 'strict') sameSite = 'Strict';
    else if (s === 'no_restriction' || s === 'none') sameSite = 'None';
    else sameSite = 'Lax';

    return {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: typeof c.expirationDate === 'number' ? Math.floor(c.expirationDate) : -1,
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
      sameSite: sameSite
    };
  });
}

/**
 * Hàm khởi chạy tự động thao tác Netflix
 * @param {string} email Email cần đăng ký
 * @param {object} customOpts Tùy chọn nâng cao (proxy, cookies, headless, timeout, etc.)
 * @param {function} onProgress Callback cập nhật tiến trình (step, message)
 */
export async function runNetflixBot(email = null, customOpts = {}, onProgress = null) {
  const notify = (step, total, text) => {
    const logText = `[${step}/${total}] ${text}`;
    console.log(logText);
    if (typeof onProgress === 'function') {
      try {
        onProgress({ step, total, text, timestamp: Date.now() });
      } catch (e) {}
    }
  };

  const config = { ...getConfiguration(), ...customOpts };
  const targetEmail = (email || config.defaultEmail || '').trim();

  // Chọn proxy
  let activeProxy = null;
  if (customOpts.proxy) {
    activeProxy = parseProxy(customOpts.proxy);
  } else if (config.proxy) {
    activeProxy = parseProxy(config.proxy);
  } else if (Array.isArray(config.proxies) && config.proxies.length > 0) {
    const randomProxy = config.proxies[Math.floor(Math.random() * config.proxies.length)];
    activeProxy = parseProxy(randomProxy);
  }

  console.log('================================================================');
  console.log('🎬 [NETFLIX AUTO BOT] Khởi động trình tự động hóa Netflix 30 Ngày');
  console.log(`📧 Email mục tiêu   : ${targetEmail}`);
  console.log(`👁️  Chế độ hiển thị : ${config.headless ? 'ẨN TRÌNH DUYỆT (Headless)' : 'HIỆN TRÌNH DUYỆT (Visible UI)'}`);
  console.log(`🛡️  Proxy sử dụng   : ${activeProxy ? activeProxy.server : 'Direct Connection (Không dùng proxy)'}`);
  console.log('================================================================\n');

  notify(1, 7, `Khởi tạo trình duyệt (Proxy: ${activeProxy ? activeProxy.server : 'Trực tiếp'})...`);

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--window-size=1280,850',
    '--start-maximized'
  ];

  const launchOptions = {
    headless: !!config.headless,
    slowMo: config.slowMo || 200,
    args: launchArgs
  };

  if (activeProxy) {
    launchOptions.proxy = activeProxy;
  }

  if (config.useRealChrome) {
    launchOptions.channel = 'chrome';
  }

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (err) {
    if (launchOptions.channel) {
      console.warn('[!] Không mở được bằng channel "chrome", chuyển sang Chromium tích hợp...');
      delete launchOptions.channel;
      browser = await chromium.launch(launchOptions);
    } else {
      throw err;
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    hasTouch: false,
    ignoreHTTPSErrors: true
  });

  // Chống phát hiện tự động hóa (WebDriver bot detection)
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(config.timeout || 45000);

  let screenshotPath = null;

  try {
    // -------------------------------------------------------------
    // Bước 1: Nạp Cookies thiết bị trước khi truy cập
    // -------------------------------------------------------------
    const cookieList = Array.isArray(customOpts.cookies) && customOpts.cookies.length > 0
      ? customOpts.cookies
      : config.cookies;

    const formattedCookies = formatCookies(cookieList);
    if (formattedCookies.length > 0) {
      notify(1, 7, `Đang nạp ${formattedCookies.length} Cookie thiết bị vào trình duyệt...`);
      await context.addCookies(formattedCookies);
    }

    // -------------------------------------------------------------
    // Bước 2: Mở trang Netflix (với cơ chế Retry và waitUntil linh hoạt)
    // -------------------------------------------------------------
    notify(2, 7, 'Đang truy cập https://www.netflix.com/ ...');
    try {
      await page.goto('https://www.netflix.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (gotoErr) {
      console.warn('[!] domcontentloaded chậm, thử chuyển hướng trực tiếp...');
      await page.goto('https://www.netflix.com/', { waitUntil: 'commit', timeout: 20000 }).catch(() => {});
    }

    await page.waitForTimeout(2000);

    // -------------------------------------------------------------
    // Bước 3: Bấm banner Dùng thử 30 ngày (Free Trial Banner) nếu có
    // -------------------------------------------------------------
    notify(3, 7, 'Kiểm tra Banner Dùng thử 30 ngày (Free Trial Banner)...');
    const bannerSelector = 'button[data-uia="free-trial-banner"], [data-uia="free-trial-banner"], a[data-uia="free-trial-banner"]';

    try {
      const bannerBtn = await page.waitForSelector(bannerSelector, { timeout: 6000 });
      if (bannerBtn) {
        await bannerBtn.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      // Banner fallback search by text
      try {
        const textBtn = page.locator('text="Mới trải nghiệm Netflix? Dùng thử 30 ngày"').first();
        if (await textBtn.isVisible({ timeout: 2000 })) {
          await textBtn.click();
          await page.waitForTimeout(2000);
        }
      } catch (_) {}
    }

    // -------------------------------------------------------------
    // Bước 4: Tìm ô nhập Email & điền email
    // -------------------------------------------------------------
    notify(4, 7, `Đang điền email đăng ký: ${targetEmail}...`);

    const emailSelectors = [
      'input[data-uia="field-userLoginId"]',
      'input[name="userLoginId"]',
      'input[data-uia="field-email"]',
      'input[name="email"]',
      'input[type="email"]',
      'input[autocomplete="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Địa chỉ email" i]'
    ];

    let emailFilled = false;
    for (const sel of emailSelectors) {
      try {
        const inputLoc = page.locator(sel).first();
        if (await inputLoc.isVisible({ timeout: 1500 })) {
          await inputLoc.click();
          await inputLoc.fill('');
          await page.waitForTimeout(200);
          await inputLoc.fill(targetEmail);
          emailFilled = true;
          break;
        }
      } catch (_) {}
    }

    if (!emailFilled) {
      const combinedSelector = emailSelectors.join(', ');
      await page.waitForSelector(combinedSelector, { timeout: 15000 });
      const inputLoc = page.locator(combinedSelector).first();
      await inputLoc.click();
      await inputLoc.fill('');
      await page.waitForTimeout(200);
      await inputLoc.fill(targetEmail);
    }

    await page.waitForTimeout(800);

    // -------------------------------------------------------------
    // Bước 5: Bấm nút Tiếp tục / Dùng thử 30 ngày (CTA Button)
    // -------------------------------------------------------------
    notify(5, 7, 'Bấm nút Tiếp tục / Dùng thử 30 ngày...');
    const continueSelectors = [
      'button[data-uia="continue-button"]',
      'button[data-uia="nmhp-card-cta+hero_fuji"]',
      'button[data-uia="our-story-cta"]',
      'button:has-text("Dùng thử 30 ngày")',
      'button:has-text("Bắt đầu")',
      'button:has-text("Tiếp tục")',
      'button[type="submit"]'
    ];

    let clickedContinue = false;
    for (const btnSel of continueSelectors) {
      try {
        const btn = page.locator(btnSel).first();
        if (await btn.isVisible({ timeout: 1500 })) {
          await btn.click();
          clickedContinue = true;
          break;
        }
      } catch (_) {}
    }

    if (!clickedContinue) {
      await page.click('button[type="submit"]').catch(() => {});
    }

    await page.waitForTimeout(2500);

    // Kiểm tra nếu trang yêu cầu xác nhận email lần 2
    try {
      const secondEmailInput = page.locator('input[data-uia="field-userLoginId"], input[name="userLoginId"]').first();
      if (await secondEmailInput.isVisible({ timeout: 2500 })) {
        await secondEmailInput.click();
        await secondEmailInput.fill('');
        await secondEmailInput.fill(targetEmail);
        await page.waitForTimeout(400);
        const submitBtn = page.locator('button[data-uia="continue-button"], button[type="submit"]').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
        }
      }
    } catch (_) {}

    // -------------------------------------------------------------
    // Bước 6: Đợi màn hình Xem lại để tiếp tục (Registration Consent)
    // -------------------------------------------------------------
    notify(6, 7, 'Đợi màn hình xác nhận chuyển tiếp...');
    try {
      await page.waitForSelector('[data-uia="registration-consent"], text="Xem lại để tiếp tục", button[data-uia="continue-button"]', { timeout: 20000 });
    } catch (e) {}

    await page.waitForTimeout(1500);

    // -------------------------------------------------------------
    // Bước 7: Bấm nút Tiếp tục lần cuối
    // -------------------------------------------------------------
    notify(7, 7, 'Bấm nút Tiếp tục hoàn tất nhận Netflix 30 ngày...');
    const finalContinueBtn = page.locator('button[data-uia="continue-button"], button[type="submit"]').first();
    await finalContinueBtn.waitFor({ state: 'visible', timeout: 15000 });
    await finalContinueBtn.click();

    await page.waitForTimeout(4000);

    // Lưu log thành công
    const logEntry = `[${new Date().toISOString()}] Thành công: ${targetEmail} | Proxy: ${activeProxy ? activeProxy.server : 'Direct'}\n`;
    try {
      fs.appendFileSync(SUCCESS_LOG_FILE, logEntry, 'utf8');
    } catch (_) {}

    console.log('\n================================================================');
    console.log(`🎉 [HOÀN TẤT THÀNH CÔNG] Đã kích hoạt 30 ngày cho: ${targetEmail}`);
    console.log('================================================================\n');

    return {
      success: true,
      email: targetEmail,
      proxy: activeProxy ? activeProxy.server : null
    };
  } catch (error) {
    console.error('\n❌ [LỖI THỰC THI]:', error.message);
    try {
      screenshotPath = path.join(__dirname, `error_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Đã lưu ảnh chụp màn hình lúc lỗi tại: ${screenshotPath}`);
    } catch (_) {}

    return {
      success: false,
      email: targetEmail,
      proxy: activeProxy ? activeProxy.server : null,
      error: error.message,
      screenshotPath: screenshotPath
    };
  } finally {
    if (browser) {
      if (config.headless) {
        await browser.close().catch(() => {});
      } else {
        // Tự động đóng sau 10s nếu không headless
        setTimeout(() => {
          browser.close().catch(() => {});
        }, 10000);
      }
    }
  }
}

// Chạy trực tiếp từ CLI
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith('auto_netflix.js') ||
  process.argv[1].endsWith('auto_netflix')
);

if (isDirectCli) {
  const args = process.argv.slice(2);
  let emailArg = null;
  let headlessOverride = null;
  let proxyArg = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase();
    if (arg === '--headless' || arg === '--hide' || arg === '-h') {
      headlessOverride = true;
    } else if (arg === '--show' || arg === '--visible' || arg === '--no-headless') {
      headlessOverride = false;
    } else if (arg === '--email' && args[i + 1]) {
      emailArg = args[i + 1];
      i++;
    } else if (arg === '--proxy' && args[i + 1]) {
      proxyArg = args[i + 1];
      i++;
    } else if (!arg.startsWith('-') && !emailArg) {
      emailArg = args[i];
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  (async () => {
    try {
      const config = getConfiguration();

      console.clear();
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║        NETFLIX AUTO 30 DAYS BOT (PRO & PROXY SUPPORT)          ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');

      let targetEmail = emailArg;
      if (!targetEmail) {
        const inputEmail = await question(`👉 Nhập Email cần đăng ký (Enter để dùng: ${config.defaultEmail}): `);
        targetEmail = inputEmail.trim() || config.defaultEmail;
      }

      let isHeadless = headlessOverride !== null ? headlessOverride : config.headless;
      if (headlessOverride === null && process.argv.length <= 2) {
        const modeChoice = await question('👉 Chọn chế độ Chrome: [1] Hiện trình duyệt (Mặc định) | [2] Ẩn Chrome: ');
        isHeadless = modeChoice.trim() === '2';
      }

      rl.close();
      await runNetflixBot(targetEmail, { headless: isHeadless, proxy: proxyArg });
    } catch (e) {
      console.error('[-] Lỗi:', e.message);
      rl.close();
    }
  })();
}

export default {
  runNetflixBot,
  parseProxy,
  getConfiguration,
  formatCookies
};
