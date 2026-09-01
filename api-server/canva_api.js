const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const {
  DEFAULT_SESSION_FILE,
  loadCanvaSession,
  formatCookiesForPlaywright,
  getCookieHeaderString
} = require('./cookie_helper');

const FILE_SESSION_JSON = DEFAULT_SESSION_FILE;
const FILE_INVITES_OUTPUT = path.join(__dirname, 'canva_invites.json');
const FILE_INVITE_LINKS_TXT = path.join(__dirname, 'canva_invite_links.txt');

// Role Mapping:
// 'designer' -> Nhà thiết kế thương hiệu của đội (Mã C)
// 'member'   -> Thành viên đội (Mã B)
// 'admin'    -> Quản trị viên đội (Mã A)
const ROLE_CODE_MAP = {
  designer: 'C',
  member: 'B',
  admin: 'A'
};

const ROLE_NAME_MAP = {
  designer: 'Nhà thiết kế thương hiệu của đội',
  member: 'Thành viên đội',
  admin: 'Quản trị viên đội',
  C: 'Nhà thiết kế thương hiệu của đội',
  B: 'Thành viên đội',
  A: 'Quản trị viên đội'
};

/**
 * Lấy dữ liệu session từ canva_session.json
 */
function getSessionData() {
  if (!fs.existsSync(FILE_SESSION_JSON)) {
    throw new Error(`Không tìm thấy file ${FILE_SESSION_JSON}!`);
  }
  return loadCanvaSession(FILE_SESSION_JSON);
}

/**
 * Lấy số lượng thành viên và kiểm tra trạng thái Session từ canva_session.json
 */
async function getTeamInfo() {
  let browser = null;
  try {
    if (!fs.existsSync(FILE_SESSION_JSON)) {
      return { valid: false, error: `Không tìm thấy file ${FILE_SESSION_JSON}` };
    }

    const sessionData = loadCanvaSession(FILE_SESSION_JSON);
    const cookies = sessionData.cookies;


    try {
      browser = await chromium.launch({
        headless: true,
        channel: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });
    } catch {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });
    }

    const context = await browser.newContext({
      viewport: { width: 1366, height: 850 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      ignoreHTTPSErrors: true
    });

    await context.addCookies(cookies);
    const page = await context.newPage();

    if (sessionData.localStorage) {
      await page.addInitScript((storage) => {
        try {
          if (storage) {
            for (const [key, value] of Object.entries(storage)) {
              window.localStorage.setItem(key, value);
            }
          }
        } catch (_) {}
      }, sessionData.localStorage);
    }

    await page.goto('https://www.canva.com/settings/people', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
      await browser.close();
      return {
        valid: false,
        error: 'Cookie Canva trong canva_session.json đã hết hạn (bị chuyển hướng về trang Login).'
      };
    }

    let memberCount = 'Không xác định';
    try {
      const headerElem = await page.waitForSelector('h1[aria-label*="Thành viên"], h1[aria-label*="Member"], h1:has-text("Thành viên")', { timeout: 6000 });
      if (headerElem) {
        const headerText = await headerElem.innerText();
        const match = headerText.match(/\((\d+)\)/);
        memberCount = match ? match[1] : headerText.trim();
      }
    } catch (_) {}

    await browser.close();

    return {
      valid: true,
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
 * Core API Service: Thực hiện mời thành viên Canva & bắt link mời
 * @param {string} email Email cần mời
 * @param {string} [role='designer'] 'designer' | 'member' | 'admin'
 * @param {boolean} [headless=true] Chạy ngầm (mặc định true)
 */
async function sendCanvaInviteApi(email, role = 'designer', headless = true) {
  if (!email || !email.trim()) {
    return { success: false, error: 'Email không được để trống.' };
  }

  const targetEmail = email.trim().toLowerCase();
  const targetRole = (role === 'C' ? 'designer' : (role === 'B' ? 'member' : (role === 'A' ? 'admin' : role))) || 'designer';
  const roleName = ROLE_NAME_MAP[targetRole] || ROLE_NAME_MAP.designer;
  const roleCode = ROLE_CODE_MAP[targetRole] || 'C';

  if (!fs.existsSync(FILE_SESSION_JSON)) {
    return { success: false, error: `Không tìm thấy file ${FILE_SESSION_JSON}. Hãy nạp session trước!` };
  }

  const sessionData = loadCanvaSession(FILE_SESSION_JSON);
  const cookies = sessionData.cookies;

  let browser;
  const startTime = Date.now();

  try {
    try {
      browser = await chromium.launch({
        headless: headless,
        channel: 'chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--start-maximized'
        ]
      });
    } catch (err) {
      browser = await chromium.launch({
        headless: headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });
    }

    const context = await browser.newContext({
      viewport: { width: 1366, height: 850 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh',
      ignoreHTTPSErrors: true
    });

    await context.addCookies(cookies);
    const page = await context.newPage();

    if (sessionData.localStorage) {
      await page.addInitScript((storage) => {
        try {
          if (storage) {
            for (const [key, value] of Object.entries(storage)) {
              window.localStorage.setItem(key, value);
            }
          }
        } catch (_) {}
      }, sessionData.localStorage);
    }

    // 1. Mở Settings People
    await page.goto('https://www.canva.com/settings/people', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);

    // Kiểm tra xem trang có bị chuyển hướng về trang Login do hết hạn cookie không
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
      await browser.close();
      return {
        success: false,
        email: targetEmail,
        role: roleName,
        roleCode: roleCode,
        error: 'Cookie Canva trong canva_session.json đã hết hạn hoặc bị đăng xuất trên trình duyệt. Vui lòng cập nhật session mới!'
      };
    }

    // 2. Lấy số lượng thành viên
    let memberCount = 'Không xác định';
    try {
      const headerElem = await page.waitForSelector('h1[aria-label*="Thành viên"], h1[aria-label*="Member"], h1:has-text("Thành viên")', { timeout: 6000 });
      if (headerElem) {
        const headerText = await headerElem.innerText();
        const match = headerText.match(/\((\d+)\)/);
        memberCount = match ? match[1] : headerText.trim();
      }
    } catch (_) {}

    // 3. Bấm "Mời thành viên"
    const inviteBtn = page.locator('button:has-text("Mời thành viên"), button:has-text("Invite members"), button:has-text("Thêm thành viên"), button[aria-label*="Mời" i], button[aria-label*="Invite" i]').first();
    await inviteBtn.waitFor({ state: 'visible', timeout: 10000 });
    await inviteBtn.click();
    await page.waitForTimeout(1200);

    // 4. Điền email
    const emailInput = page.locator('input[placeholder*="email" i], input[aria-label*="email" i], input[type="text"][inputmode="email"], input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.click();
    await emailInput.fill('');
    await emailInput.fill(targetEmail);
    await page.waitForTimeout(500);

    // 5. Chọn vai trò
    if (targetRole === 'designer' || targetRole === 'admin') {
      try {
        const roleBtn = page.locator('button[aria-label*="vai trò" i], button[role="combobox"]').first();
        if (await roleBtn.isVisible({ timeout: 4000 })) {
          await roleBtn.click();
          await page.waitForTimeout(500);
          if (targetRole === 'designer') {
            const designerOption = page.locator('button:has-text("Nhà thiết kế thương hiệu"), li:has-text("Nhà thiết kế thương hiệu")').first();
            await designerOption.click();
          } else if (targetRole === 'admin') {
            const adminOption = page.locator('button:has-text("Quản trị viên đội"), li:has-text("Quản trị viên đội")').first();
            await adminOption.click();
          }
        }
      } catch (_) {}
      await page.waitForTimeout(500);
    }

    // 6. Lắng nghe API Response và bấm Confirm
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/_ajax/invitation/brand/invitations/create') && resp.status() === 200,
      { timeout: 30000 }
    );

    const confirmBtn = page.locator('button:has-text("Xác nhận và mời"), button:has-text("Confirm and invite"), button:has-text("Gửi lời mời")').first();
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

    let inviteLink = null;
    let inviteToken = null;
    let teamName = null;

    if (responseJson && Array.isArray(responseJson.A) && responseJson.A.length > 0) {
      const firstItem = responseJson.A[0];
      inviteLink = firstItem.M || null;
      inviteToken = firstItem.F || null;
      teamName = (firstItem.L && firstItem.L.A) || null;
    }

    if (inviteLink) {
      const linkEntry = `[${new Date().toISOString()}] ${targetEmail} | Role: ${roleName} | ${inviteLink}\n`;
      fs.appendFileSync(FILE_INVITE_LINKS_TXT, linkEntry, 'utf8');
    }

    // Ghi log vào canva_invites.json
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
      teamName: teamName,
      fullResponse: responseJson
    });
    fs.writeFileSync(FILE_INVITES_OUTPUT, JSON.stringify(history, null, 2), 'utf8');

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
      teamName: teamName,
      elapsedMs: elapsed,
      response: responseJson
    };
  } catch (error) {
    if (browser) await browser.close().catch(() => {});
    return {
      success: false,
      email: targetEmail,
      role: roleName,
      roleCode: roleCode,
      error: error.message
    };
  }
}

/**
 * Mời nhiều email liên tiếp
 */
async function batchInvite(emails, role = 'designer', delayMs = 1000) {
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
 * Lấy lịch sử lời mời đã lưu
 */
function getInviteHistory() {
  if (fs.existsSync(FILE_INVITES_OUTPUT)) {
    try {
      return JSON.parse(fs.readFileSync(FILE_INVITES_OUTPUT, 'utf8'));
    } catch (_) {
      return [];
    }
  }
  return [];
}

// Chạy trực tiếp từ CLI
if (require.main === module) {
  const readline = require('readline');
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
      const res = await sendCanvaInviteApi(targetEmail, role);
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
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    (async () => {
      console.clear();
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║               CANVA AUTOMATED INVITE BOT                       ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');

      const inputEmail = await question('👉 [1/2] Nhập Email cần mời: ');
      if (!inputEmail.trim()) {
        console.error('[-] Email không được để trống!');
        rl.close();
        process.exit(1);
      }

      console.log('\n👉 [2/2] Chọn vai trò:');
      console.log('   [1] Nhà thiết kế thương hiệu của đội (Mặc định - Designer)');
      console.log('   [2] Thành viên đội (Member)');
      console.log('   [3] Quản trị viên đội (Admin)');
      const roleChoice = await question('   Lựa chọn (1/2/3): ');

      let selectedRole = 'designer';
      if (roleChoice.trim() === '2') selectedRole = 'member';
      else if (roleChoice.trim() === '3') selectedRole = 'admin';

      rl.close();

      console.log('\n[+] Đang gửi yêu cầu mời thành viên từ canva_session.json...');
      const res = await sendCanvaInviteApi(inputEmail.trim(), selectedRole);

      if (res.success) {
        console.log('\n================================================================');
        console.log('🎉 [MỜI THÀNH CÔNG - RESPONSE TỪ CANVA API]');
        console.log('================================================================');
        console.log(`📧 Email        : ${res.email}`);
        console.log(`🎭 Vai trò      : ${res.role} (Code: ${res.roleCode})`);
        console.log(`🔗 Link Lời Mời : ${res.inviteLink || 'Không có link công khai'}`);
        console.log(`🔑 Invite Token : ${res.inviteToken || 'N/A'}`);
        console.log(`🏢 Tên Team     : ${res.teamName || 'N/A'}`);
        console.log(`⚡ Thời gian    : ${res.elapsedMs}ms`);
        console.log('================================================================\n');
      } else {
        console.error('\n❌ [LỖI]:', res.error);
      }
    })();
  }
}

module.exports = {
  sendCanvaInviteApi,
  batchInvite,
  getTeamInfo,
  getInviteHistory,
  ROLE_CODE_MAP,
  ROLE_NAME_MAP
};
