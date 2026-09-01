const { chromium } = require('playwright');

// Danh sách Cookie thiết bị Netflix do bạn cung cấp
const rawCookieData = {
  "url": "https://www.netflix.com",
  "cookies": [
    {
      "domain": ".netflix.com",
      "expirationDate": 1794794191.068623,
      "hostOnly": false,
      "httpOnly": false,
      "name": "netflix-sans-normal-3-loaded",
      "path": "/",
      "sameSite": "unspecified",
      "secure": false,
      "session": false,
      "storeId": "0",
      "value": "true"
    },
    {
      "domain": ".netflix.com",
      "expirationDate": 1794794191.068734,
      "hostOnly": false,
      "httpOnly": false,
      "name": "netflix-sans-bold-3-loaded",
      "path": "/",
      "sameSite": "unspecified",
      "secure": false,
      "session": false,
      "storeId": "0",
      "value": "true"
    },
    {
      "domain": ".netflix.com",
      "expirationDate": 1817994254.277055,
      "hostOnly": false,
      "httpOnly": false,
      "name": "nfvdid",
      "path": "/",
      "sameSite": "unspecified",
      "secure": false,
      "session": false,
      "storeId": "0",
      "value": "BQFmAAEBEAMMb_H-IR2FmzGzu-4YAGlgribqPhXA5tSUU0gJyfgJJLXFuqjjYXzbIpx1TZGuXwyN30o-z-ETzcgTO1EfozIUDIoqCROn12VCs4JOMTfISzWlwYmwZPS1N5LtQeNW6PB6fkGQeOUZK_ZuLycb3Rgz"
    },
    {
      "domain": ".netflix.com",
      "expirationDate": 1817994254.277256,
      "hostOnly": false,
      "httpOnly": true,
      "name": "SecureNetflixId",
      "path": "/",
      "sameSite": "strict",
      "secure": true,
      "session": false,
      "storeId": "0",
      "value": "v%3D3%26mac%3DAQEAEQABABTJ6pVMLBwUupw4eD0fKNas7AiUkgRtK78.%26dt%3D1786458253238"
    },
    {
      "domain": ".netflix.com",
      "expirationDate": 1817994254.277352,
      "hostOnly": false,
      "httpOnly": true,
      "name": "NetflixId",
      "path": "/",
      "sameSite": "lax",
      "secure": true,
      "session": false,
      "storeId": "0",
      "value": "v%3D3%26ct%3DBgjHlOvcAxKhA6oKl6RlmBUz3muJyL0xWZAkk3fHi1A3kNApV6QdyjgMc1aAKmeKIykhXaLBcbCfoYVmJCzkpImp8B8KoAqycKYXXnlsT__SHS-8RwOK-L3jZPptdq0tWt63ynzeRxK6RJVUqi1wllNfF4m7N39OHvQXgA6pQDfD6BCI86U3TyqKTOQbN4YI0cCHZ1deqU9H91lH4ppsEEW2cYQDmts8rzF_JRJXUuVef9-aJbycaONaON9zncvC443Pj2G2Logg-ZoS6-86xlajIHQOR4dyev-DpcovR-sUncR0DM5o1SbIBBqZZOwrFOYezvGa78OyJe6Nuk-VSPIooxDUGXYKjpQXdP0XYvAXsimOyCzsONr6suX4qLNCokprVYe-5aCjmhk8wejLh7jyHJb-uYpGWNCVlHfaSMGHhctT93dSRurWFk6QW1mJYSeZV0Bkj3xwT6IgGhUZhmOR9neM3TLFpzLSLrPgUUUER5RsHge0vkh0gQHef0eum61fU1o0DGI7GEj2BCCmte4wS92kkGh7uwkzIRr76nMdrqVbozG_EP6TVxgGIg4KDIT8tsG5aPket04mmw..%26pg%3DZJ6KX4PQRZGH5CK5IWHY33QWFI%26ch%3DAQEAEAABABRxjZQp0VlTGnnPRrWTmyvwCoxYmmIdkws."
    },
    {
      "domain": ".netflix.com",
      "expirationDate": 1787104590.361632,
      "hostOnly": false,
      "httpOnly": true,
      "name": "gsid",
      "path": "/",
      "sameSite": "no_restriction",
      "secure": true,
      "session": false,
      "storeId": "0",
      "value": "e2e7e7fb-f5b5-406b-bc7a-d4386a232b69"
    },
    {
      "domain": ".netflix.com",
      "expirationDate": 1787028991.068788,
      "hostOnly": false,
      "httpOnly": false,
      "name": "flwssn",
      "path": "/",
      "sameSite": "unspecified",
      "secure": false,
      "session": false,
      "storeId": "0",
      "value": "477ac224-3f2b-44c6-8f90-eb2e48a20ded"
    },
    {
      "domain": ".netflix.com",
      "expirationDate": 1818554192,
      "hostOnly": false,
      "httpOnly": false,
      "name": "OptanonConsent",
      "path": "/",
      "sameSite": "lax",
      "secure": false,
      "session": false,
      "storeId": "0",
      "value": "isGpcEnabled=0&datestamp=Tue+Aug+18+2026+08%3A56%3A32+GMT%2B0700+(Gi%E1%BB%9D+%C4%90%C3%B4ng+D%C6%B0%C6%A1ng)&version=202604.2.0&browserGpcFlag=0&isDntEnabled=0&isIABGlobal=false&hosts=&consentId=0bff1419-2100-4f71-aa0a-d9c7345506f0&interactionCount=1&isAnonUser=1&prevHadToken=0&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1&crTime=1786458203063&AwaitingReconsent=false"
    },
    {
      "domain": "www.netflix.com",
      "expirationDate": 1787104592,
      "hostOnly": true,
      "httpOnly": false,
      "name": "OTSessionTracking",
      "path": "/",
      "sameSite": "lax",
      "secure": false,
      "session": false,
      "storeId": "0",
      "value": "87b6a5c0-0104-4e96-a291-092c11350111"
    }
  ]
};

// Chuẩn hóa cookies cho Playwright
function formatCookiesForPlaywright(cookiesList) {
  return cookiesList.map(c => {
    let sameSite = 'Lax';
    if (c.sameSite === 'strict') sameSite = 'Strict';
    else if (c.sameSite === 'no_restriction' || c.sameSite === 'none') sameSite = 'None';
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
 * Hàm tự động hóa đăng ký Netflix Free Trial theo đúng quy trình
 * @param {string} targetEmail Email cần nhập
 * @param {object} options Các tùy chọn (headless, proxy, v.v.)
 */
async function runNetflixAutomation(targetEmail, options = {}) {
  const {
    headless = false,
    proxy = null // ví dụ: { server: 'http://ip:port', username: '', password: '' }
  } = options;

  console.log(`[+] Bắt đầu quy trình tự động hóa Netflix cho email: ${targetEmail}`);

  const launchOptions = {
    headless: headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800'
    ]
  };

  if (proxy) {
    launchOptions.proxy = proxy;
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh'
  });

  const page = await context.newPage();

  try {
    // Bước 1: Truy cập vào link https://www.netflix.com/
    console.log('[1] Đang truy cập http://netflix.com/ ...');
    await page.goto('https://www.netflix.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);

    // Bước 2: Thêm Cookie vào context và F5 lại trang
    console.log('[2] Đang nạp Cookie vào Browser Context...');
    const formattedCookies = formatCookiesForPlaywright(rawCookieData.cookies);
    await context.addCookies(formattedCookies);
    console.log(`[✓] Đã nạp ${formattedCookies.length} cookies thành công.`);

    console.log('[2.1] Đang F5 (reload) lại trang...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    // Bước 3: Ấn vào nút Dùng thử 30 ngày (Free Trial Banner)
    console.log('[3] Đang tìm và bấm nút Dùng thử 30 ngày (data-uia="free-trial-banner")...');
    const freeTrialBannerSelector = 'button[data-uia="free-trial-banner"], [data-uia="free-trial-banner"]';
    
    // Đợi selector xuất hiện
    const bannerButton = await page.waitForSelector(freeTrialBannerSelector, { timeout: 15000 }).catch(() => null);
    
    if (bannerButton) {
      await bannerButton.click();
      console.log('[✓] Đã click nút Free Trial Banner.');
    } else {
      console.log('[-] Không tìm thấy button data-uia="free-trial-banner", thử tìm theo text hoặc tiếp tục...');
      const fallbackBtn = await page.locator('text="Mới trải nghiệm Netflix? Dùng thử 30 ngày"').first();
      if (await fallbackBtn.isVisible().catch(() => false)) {
        await fallbackBtn.click();
        console.log('[✓] Đã click banner theo text fallback.');
      }
    }

    await page.waitForTimeout(3000);

    // Bước 4: Xóa sạch input email và nhập email yêu cầu
    console.log(`[4] Đang tìm trường nhập email userLoginId và điền: ${targetEmail}...`);
    const emailInputSelector = 'input[data-uia="field-userLoginId"], input[name="userLoginId"]';
    await page.waitForSelector(emailInputSelector, { timeout: 20000 });

    // Xóa sạch giá trị cũ nếu có
    const emailInput = page.locator(emailInputSelector);
    await emailInput.click();
    await emailInput.fill(''); // Xóa trắng
    await page.waitForTimeout(500);
    await emailInput.fill(targetEmail); // Nhập email mới
    console.log(`[✓] Đã điền email: ${targetEmail}`);

    await page.waitForTimeout(1000);

    // Bước 5: Ấn nút Tiếp tục (continue-button)
    console.log('[5] Đang bấm nút Tiếp tục (data-uia="continue-button")...');
    const continueBtnSelector = 'button[data-uia="continue-button"]';
    await page.waitForSelector(continueBtnSelector, { timeout: 10000 });
    await page.click(continueBtnSelector);
    console.log('[✓] Đã click nút Tiếp tục lần 1.');

    // Bước 6: Đợi màn hình "Xem lại để tiếp tục" (registration-consent) xuất hiện
    console.log('[6] Đợi màn hình "Xem lại để tiếp tục"...');
    const consentHeader = await page.waitForSelector('[data-uia="registration-consent"], text="Xem lại để tiếp tục"', { timeout: 25000 }).catch(() => null);
    
    if (consentHeader) {
      console.log('[✓] Đã hiện màn hình "Xem lại để tiếp tục".');
    } else {
      console.log('[!] Chưa thấy tiêu đề, kiểm tra nút tiếp tục tiếp theo...');
    }

    await page.waitForTimeout(2000);

    // Bước 7: Bấm tiếp tục lần 2 ở màn Xem lại để tiếp tục
    console.log('[7] Đang bấm nút Tiếp tục ở màn hình Xem lại (data-uia="continue-button")...');
    await page.waitForSelector(continueBtnSelector, { timeout: 15000 });
    await page.click(continueBtnSelector);
    console.log('[✓] Đã click nút Tiếp tục lần 2 thành công!');

    await page.waitForTimeout(4000);
    console.log('[🎉] Hoàn thành các bước!');

    return { success: true };
  } catch (error) {
    console.error('[-] Lỗi trong quá trình thực thi:', error);
    // Chụp ảnh màn hình nếu gặp lỗi để dễ debug
    try {
      await page.screenshot({ path: 'netflix_error.png', fullPage: true });
      console.log('[!] Đã lưu ảnh chụp lỗi vào netflix_error.png');
    } catch (_) {}
    return { success: false, error: error.message };
  } finally {
    // Nếu muốn giữ browser mở để xem kết quả, có thể bỏ dòng đóng này
    // await browser.close();
  }
}

// Chạy thử nghiệm nếu gọi trực tiếp từ terminal: node toolsauto_netflix/netflix_reg.js <email>
if (require.main === module) {
  const emailArg = process.argv[2] || 'test_email_' + Date.now() + '@hotmail.com';
  runNetflixAutomation(emailArg, { headless: false });
}

module.exports = {
  runNetflixAutomation,
  rawCookieData
};
