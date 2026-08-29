// CapCut Auto Join Workspace - Web Interface (Optimized)
// Usage: node web_app_optimized.js
// Mở browser: http://localhost:3000

import fetch from "node-fetch";
import { CookieJar } from "tough-cookie";
import fetchCookie from "fetch-cookie";
import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import { HttpsProxyAgent } from "https-proxy-agent";
import { joinWorkspace } from "./join.js";
import { convertCapCutLink } from "./link_converter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const AID = "348188";
const SDK_VERSION = "2.1.10-tiktok";
const LANGUAGE = "vi-VN";
const VERIFY_FP =
  process.env.VERIFY_FP ||
  "verify_men0a4cg_yEfkzeLx_7hft_4fKX_8ENt_fYQ6wdT6OUFB";
const UA =
  process.env.UA ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function makeClient(proxyUrl = null) {
  const jar = new CookieJar();
  
  // Tạo fetch options với proxy nếu có
  const fetchOptions = {};
  if (proxyUrl) {
    // Hỗ trợ proxy với format: ip:port:username:password
    let formattedProxyUrl = proxyUrl;
    if (proxyUrl.includes(':') && proxyUrl.split(':').length === 4) {
      const [ip, port, username, password] = proxyUrl.split(':');
      formattedProxyUrl = `http://${username}:${password}@${ip}:${port}`;
    } else if (!proxyUrl.startsWith('http://') && !proxyUrl.startsWith('https://') && !proxyUrl.startsWith('socks5://')) {
      formattedProxyUrl = `http://${proxyUrl}`;
    }
    
    const agent = new HttpsProxyAgent(formattedProxyUrl);
    fetchOptions.agent = agent;
  }
  
  const _fetch = fetchCookie(fetch, jar, fetchOptions);
  return { jar, _fetch };
}

function encryptToHex(str) {
  let hex = "";
  for (const ch of str) {
    const enc = ch.charCodeAt(0) ^ 0x05;
    hex += enc.toString(16).padStart(2, "0");
  }
  return hex;
}

function getCookieStringFor(jar, url) {
  return new Promise((resolve, reject) => {
    jar.getCookies(url, (err, arr) => {
      if (err) return reject(err);
      resolve(arr.map((c) => `${c.key}=${c.value}`).join("; "));
    });
  });
}

async function mergedCookieFor(jar, urls) {
  const m = new Map();
  for (const u of urls) {
    const s = await getCookieStringFor(jar, u);
    s.split(/;\s*/).filter(Boolean).forEach((kv) => {
      const i = kv.indexOf("=");
      if (i > 0) m.set(kv.slice(0, i), kv.slice(i + 1));
    });
  }
  return [...m.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function seedHome(_fetch) {
  await _fetch("https://www.capcut.com/", {
    method: "GET",
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
}

async function loginEmailPassword(jar, _fetch, email, password) {
  const capcutCookie = await getCookieStringFor(jar, "https://www.capcut.com");
  const csrf =
    (capcutCookie.match(/passport_csrf_token=([^;]+)/) || [])[1] ||
    (capcutCookie.match(/passport_csrf_token_default=([^;]+)/) || [])[1] ||
    "";

  const url =
    `https://www.capcut.com/passport/web/email/login/` +
    `?aid=${AID}` +
    `&account_sdk_source=web` +
    `&sdk_version=${encodeURIComponent(SDK_VERSION)}` +
    `&language=${encodeURIComponent(LANGUAGE)}` +
    `&verifyFp=${encodeURIComponent(VERIFY_FP)}`;

  const body = new URLSearchParams({
    mix_mode: "1",
    email: encryptToHex(email),
    password: encryptToHex(password),
    fixed_mix_mode: "1",
  });

  const headers = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json, text/javascript",
    origin: "https://www.capcut.com",
    referer: "https://www.capcut.com/",
    "user-agent": UA,
    "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "store-country-code": "vn",
    "store-country-code-src": "uid",
    ...(csrf ? { "x-tt-passport-csrf-token": csrf } : {}),
  };

  const res = await _fetch(url, { method: "POST", headers, body });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Login response not JSON: " + text.slice(0, 300));
  }

  const msg = String(json?.message || json?.status || "").toLowerCase();
  if (!msg.includes("success")) {
    const code = json?.data?.error_code ?? json?.status_code;
    throw new Error(
      `Login failed${code ? ` (code ${code})` : ""}: ${JSON.stringify(json)}`
    );
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/join', async (req, res) => {
  const { accounts, proxies, inviteLink, inputMode, proxyMode } = req.body;
  
  if (!accounts || !Array.isArray(accounts) || accounts.length === 0 || !inviteLink) {
    return res.json({ success: false, error: 'Vui lòng điền đầy đủ thông tin' });
  }
  
  try {
    const results = [];
    
    // Convert link nếu cần
    let finalInviteLink = inviteLink;
    let conversionInfo = null;
    
    if (inviteLink.includes('/sv2/')) {
      console.log("🔄 Đang convert sv2 link...");
      try {
        finalInviteLink = await convertCapCutLink(inviteLink, proxies[0] || null);
        console.log("✅ Convert thành công:", finalInviteLink);
        conversionInfo = {
          originalLink: inviteLink,
          convertedLink: finalInviteLink
        };
      } catch (error) {
        console.error("❌ Lỗi convert link:", error.message);
        return res.json({
          success: false,
          error: `Lỗi convert link: ${error.message}`
        });
      }
    }
    
    // Xử lý từng tài khoản
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const proxyUrl = proxies[i % proxies.length] || null; // Round-robin proxy
      
      console.log(`\n=== Xử lý tài khoản ${i + 1}/${accounts.length} ===`);
      console.log(`Email: ${account.email}`);
      console.log(`Proxy: ${proxyUrl || 'Không'}`);
      
      try {
        const { jar, _fetch } = makeClient(proxyUrl);
        
        // 1) Seed để lấy CSRF/cookie nền
        await seedHome(_fetch);

        // 2) Login
        await loginEmailPassword(jar, _fetch, account.email, account.password);

        // 3) Lấy cookie header
        const cookieHeader = await mergedCookieFor(jar, [
          "https://www.capcut.com",
          "https://commerce-api-sg.capcut.com",
        ]);

        // 4) Join workspace
        const response = await joinWorkspace(cookieHeader, finalInviteLink, proxyUrl);
        
        // Lấy thông tin session
        const capcutCookie = await getCookieStringFor(jar, "https://www.capcut.com");
        const sessionid = (capcutCookie.match(/sessionid=([^;]+)/) || [])[1] || "";
        
        results.push({
          success: true,
          email: account.email,
          sessionid: sessionid,
          response: response,
          proxy: proxyUrl
        });
        
        console.log(`✅ Thành công: ${account.email}`);
        
      } catch (error) {
        console.error(`❌ Lỗi với ${account.email}:`, error.message);
        results.push({
          success: false,
          email: account.email,
          error: error.message,
          proxy: proxyUrl
        });
      }
      
      // Delay giữa các request để tránh rate limit
      if (i < accounts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const responseData = {
      success: true,
      results: results,
      total: accounts.length,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length
    };
    
    if (conversionInfo) {
      responseData.originalLink = conversionInfo.originalLink;
      responseData.convertedLink = conversionInfo.convertedLink;
    }
    
    res.json(responseData);
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`📱 Mở browser và truy cập link trên để sử dụng`);
});
