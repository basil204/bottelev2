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
import { checkProxyLive, checkMultipleProxies } from "./proxy_checker.js";
import { scrapeFreeProxies, getRandomFreeProxies } from "./free_proxy_scraper.js";
import fs from "fs";
import crypto from "crypto";
import { mgetWorkspaceInfoWithCookie } from "./capcutteamql/getinfo.js";
import { getMemberWithCookie } from "./capcutteamql/listmember.js";
import { inviteByEmailWithCookie } from "./capcutteamql/addmember.js";
import { removeUserWithCookie } from "./capcutteamql/removeuser.js";
import { updateNameWithCookie } from "./capcutteamql/updatename.js";
import { setUserRoleWithCookie } from "./capcutteamql/setroleuser.js";
import { getlinkWithCookie } from "./capcutteamql/getlink.js";
import { refresh_invitation_link } from "./capcutteamql/doilink.js";
import { getNoticeListWithCookie } from "./capcutteamql/notice.js";
import { 
  getAllTokens,
  saveToken,
  updateToken,
  deleteToken,
  findTokenByToken,
  findTokensByEmail,
  getActiveTokens,
  getExpiredTokens,
  generateToken,
  cleanupExpiredTokens,
  initializeDatabase,
  testMySQLConnection,
  saveChatGPTAccount,
  getAllChatGPTAccounts,
  getChatGPTAccountById,
  deleteChatGPTAccount
} from "./mysql_storage.js";
import {
  joinChatGPTEmail,
  deleteChatGPTUser,
  listChatGPTUsers,
  checkChatGPTDate
} from "./chatgpt/helpers.js";

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

// ===== Admin store helpers =====

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

app.get('/check-work', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'check-work.html'));
});

app.get('/login-and-check', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-and-check.html'));
});

// Admin pages
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/account/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'token.html'));
});

// API check workspace với cookie
app.post('/api/check-workspace', async (req, res) => {
  try {
    const { cookie } = req.body;
    
    if (!cookie) {
      return res.json({ 
        success: false, 
        error: 'Vui lòng cung cấp cookie' 
      });
    }
    
    console.log(`\n=== Kiểm tra workspace với cookie ===`);
    console.log(`🍪 Cookie length: ${cookie.length}`);
    
    const url = 'https://edit-api-sg.capcut.com/cc/v1/workspace/get_user_workspaces';
    
    const body = {
      cursor: '0',
      count: 100,
      need_convert_workspace: true
    };
    
    const headers = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'vi',
      'app-sdk-version': '48.0.0',
      'appid': '348188',
      'appvr': '5.8.0',
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      'device-time': '1758940192',
      'did': '7554588671887394305',
      'lan': 'en',
      'loc': 'sg',
      'pf': '7',
      'pragma': 'no-cache',
      'priority': 'u=1, i',
      'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'sign': '1f90ee625a9c4c8dc7f8ea2f1f7483cb',
      'sign-ver': '1',
      'store-country-code': 'vn',
      'store-country-code-src': 'uid',
      'tdid': '',
      'cookie': cookie,
      'Referer': 'https://www.capcut.com/'
    };
    
    console.log('🔍 Đang gọi API workspace...');
    console.log('📡 URL:', url);
    
    const workspaceRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    console.log('📊 Response status:', workspaceRes.status);
    console.log('📊 Response headers:', Object.fromEntries(workspaceRes.headers.entries()));
    
    if (!workspaceRes.ok) {
      throw new Error(`HTTP error! status: ${workspaceRes.status}`);
    }
    
    const workspaceData = await workspaceRes.json();
    
    console.log('✅ Workspace data received successfully');
    console.log('📊 Data structure:', {
      hasData: !!workspaceData.data,
      hasWorkspaces: !!(workspaceData.data && workspaceData.data.workspaces),
      workspaceCount: workspaceData.data?.workspaces?.length || 0,
      statusCode: workspaceData.status_code,
      statusMsg: workspaceData.status_msg
    });
    
    console.log(`📊 Workspace Data:`);
    console.log(JSON.stringify(workspaceData, null, 2));
    
    // Extract convenience fields
    const infos = workspaceData?.data?.workspace_infos || workspaceData?.data?.workspaces || [];
    const list = Array.isArray(infos) ? infos : [];
    const workspace_ids = list.map(w => String(w.workspace_id)).filter(Boolean);
    const names = list.map(w => ({ workspace_id: String(w.workspace_id), name: w.name, team_vip_status: w.team_vip_status, role: w.role }));
    const vip = list.filter(w => w.team_vip_status === 1);
    const first_vip = vip.length ? { workspace_id: String(vip[0].workspace_id), name: vip[0].name } : null;
    const first = list.length ? { workspace_id: String(list[0].workspace_id), name: list[0].name } : null;

    res.json({
      success: true,
      workspaceData: workspaceData,
      workspace_ids,
      workspaces: names,
      first_workspace: first,
      first_vip_workspace: first_vip
    });
    
  } catch (error) {
    console.error(`❌ Lỗi kiểm tra workspace:`, error.message);
    
    res.json({
      success: false,
      error: error.message
    });
  }
});
app.post('/api/login-and-check', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // tự động lấy domain hiện tại (ví dụ: http://localhost:3000)
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Step 1: Login
    const loginResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed with status: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);

    if (!loginData.success || !loginData.cookie) {
      return res.json({
        success: false,
        error: 'Login failed or no cookie received',
        loginData
      });
    }

    // Step 2: Wait 3 seconds then check workspace
    console.log('Đợi 3 giây trước khi gọi check-workspace...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const workspaceResponse = await fetch(`${baseUrl}/api/check-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cookie: loginData.cookie })
    });

    if (!workspaceResponse.ok) {
      throw new Error(`Check workspace failed with status: ${workspaceResponse.status}`);
    }

    const workspaceData = await workspaceResponse.json();
    console.log('Check workspace result:', JSON.stringify(workspaceData, null, 2));

    res.json({
      success: true,
      login: loginData,
      workspace: workspaceData
    });

  } catch (error) {
    console.error('Combined API error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API login để lấy cookie
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, proxyUrl } = req.body;
    
    if (!email || !password) {
      return res.json({ 
        success: false, 
        error: 'Vui lòng cung cấp email và password' 
      });
    }
    
    console.log(`\n=== Đăng nhập cho ${email} ===`);
    console.log(`Proxy: ${proxyUrl || 'Không'}`);
    
    // Tạo client với proxy nếu có
    const { jar, _fetch } = makeClient(proxyUrl);
    
    // 1) Seed để lấy CSRF/cookie nền
    await seedHome(_fetch);
    
    // 2) Login để lấy cookie
    await loginEmailPassword(jar, _fetch, email, password);
    
    // 3) Lấy cookie header
    const cookieHeader = await mergedCookieFor(jar, [
      "https://www.capcut.com",
      "https://commerce-api-sg.capcut.com",
    ]);
    
    console.log(`✅ Đăng nhập thành công cho ${email}`);
    console.log(`🍪 Cookie length: ${cookieHeader.length}`);
    console.log(`📊 Cookie header: ${cookieHeader}`);
    
    res.json({
      success: true,
      email: email,
      cookie: cookieHeader,
      cookieLength: cookieHeader.length,
      proxy: proxyUrl
    });
    
  } catch (error) {
    console.error(`❌ Lỗi đăng nhập:`, error.message);
    
    res.json({
      success: false,
      error: error.message
    });
  }
});

// ===== Admin APIs =====
// Create or update an admin-managed CapCut account, persist to JSON, return token link
app.post('/api/admin/accounts', async (req, res) => {
  try {
    const { email, password, proxyUrl, tokenTtlMinutes, package: packageType } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Thiếu email hoặc mật khẩu' });
    }

    console.log(`\n=== [ADMIN] Bắt đầu đăng nhập cho ${email} ===`);

    // 1) Gọi API login để lấy cookie
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const loginResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, proxyUrl })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed with status: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    console.log('[ADMIN] Login response:', loginData);

    if (!loginData.success || !loginData.cookie) {
      return res.json({
        success: false,
        error: 'Login failed or no cookie received',
        loginData
      });
    }

    // 2) Đợi 3 giây rồi gọi API check-workspace để lấy thông tin workspace
    console.log('[ADMIN] Đợi 3 giây trước khi gọi check-workspace...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const workspaceResponse = await fetch(`${baseUrl}/api/check-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cookie: loginData.cookie })
    });

    if (!workspaceResponse.ok) {
      throw new Error(`Check workspace failed with status: ${workspaceResponse.status}`);
    }

    const workspaceData = await workspaceResponse.json();
    console.log('[ADMIN] Check workspace result:', JSON.stringify(workspaceData, null, 2));

    const wsList = workspaceData.workspaceData?.data?.workspace_infos || workspaceData.workspaceData?.data?.workspaces || [];
    const workspace_ids = (wsList || []).map(w => String(w.workspace_id)).filter(Boolean);
    const workspaces = (wsList || []).map(w => ({
      workspace_id: String(w.workspace_id),
      name: w.name,
      team_vip_status: w.team_vip_status,
      team_vip_end: w.team_vip_end,
      role: w.role,
      member_limit: w.member_limit,
      member_cnt: w.member_cnt
    }));
    const vipWs = (wsList || []).filter(w => w.team_vip_status === 1).map(w => ({
      workspace_id: String(w.workspace_id),
      name: w.name,
      team_vip_status: w.team_vip_status,
      team_vip_end: w.team_vip_end,
      role: w.role,
      member_limit: w.member_limit,
      member_cnt: w.member_cnt
    }));
    const first_vip_workspace = vipWs.length ? { workspace_id: String(vipWs[0].workspace_id), name: vipWs[0].name } : null;
    const first_workspace = wsList.length ? { workspace_id: String(wsList[0].workspace_id), name: wsList[0].name } : null;

    // Gọi mget_workspace_info để lấy thông tin chi tiết
    let mgetInfo = null;
    if (workspace_ids.length > 0) {
      try {
        mgetInfo = await mgetWorkspaceInfoWithCookie(loginData.cookie, { workspace_ids: workspace_ids.slice(0, 50) });
        console.log('[ADMIN] mget_workspace_info ok');
      } catch (e) {
        console.warn('[ADMIN] mget_workspace_info lỗi:', e.message);
      }
    }

            // 3) Save to MySQL
            const now = Date.now();
            const token = generateToken();
            const ttlMs = (parseInt(tokenTtlMinutes || '1440', 10) || 1440) * 60 * 1000; // default 24h
            const expiresAt = new Date(now + ttlMs);
            
            // Map workspaces với đầy đủ thông tin
            const mappedWorkspaces = wsList.map(w => ({
              workspace_id: String(w.workspace_id),
              name: w.name,
              team_vip_status: w.team_vip_status,
              team_vip_end: w.team_vip_end,
              role: w.role,
              member_limit: w.member_limit,
              member_cnt: w.member_cnt
            }));
            
            // Xác định loại gói từ tokenTtlMinutes
            let packageValue = packageType || null;
            if (!packageValue && tokenTtlMinutes) {
              const months = Math.round(parseInt(tokenTtlMinutes, 10) / (30 * 24 * 60));
              if (months === 1) packageValue = '1';
              else if (months === 2) packageValue = '2';
              else if (months === 3) packageValue = '3';
              else if (months === 6) packageValue = '6';
              else if (months === 12) packageValue = '12';
            }
            
            const tokenData = {
              email,
              token,
              link: `/account/${token}`, // Only store the path part
              expiresAt,
              workspaces: mappedWorkspaces,
              vipWorkspaces: vipWs,
              accountId: crypto.randomUUID(),
              cookie: loginData.cookie,
              password, // Lưu password để có thể refresh sau này
              package: packageValue // Lưu loại gói
            };
            
            await saveToken(tokenData);
            console.log(`[ADMIN] Đã lưu token vào MySQL cho ${email}`);

    res.json({
      success: true,
      email,
      token,
      tokenUrl: `${baseUrl}${tokenData.link}`, // Construct full URL dynamically
      workspaceCount: tokenData.workspaces?.length || 0,
      vipWorkspaces: tokenData.vipWorkspaces || [],
      workspace_ids,
      workspaces,
      first_workspace,
      first_vip_workspace,
      workspaceInfo: mgetInfo
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resolve token to basic info
app.get('/api/account/:token/info', async (req, res) => {
  try {
    const token = req.params.token;
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ hoặc đã hết hạn' });
    
    // Kiểm tra token có hết hạn không
    if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
      return res.status(404).json({ success: false, error: 'Token đã hết hạn' });
    }
    
    res.json({ success: true, hasCookie: !!tokenData.cookie });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List workspaces (VIP first)
app.get('/api/account/:token/workspaces', async (req, res) => {
  try {
    const token = req.params.token;
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ hoặc đã hết hạn' });
    
    // Kiểm tra token có hết hạn không
    if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
      return res.status(404).json({ success: false, error: 'Token đã hết hạn' });
    }
    
    const list = tokenData.workspaces || [];
    const vip = list.filter(w => w.team_vip_status === 1);
    const nonVip = list.filter(w => w.team_vip_status !== 1);
    res.json({ success: true, workspaces: [...vip, ...nonVip] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Refresh workspaces from CapCut
app.post('/api/account/:token/refresh-workspaces', async (req, res) => {
  try {
    const token = req.params.token;
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ' });
    
    console.log(`\n=== [REFRESH] Bắt đầu làm mới cho ${tokenData.email} ===`);
    
    if (!tokenData.password) {
      console.error('[REFRESH] No password found for token:', tokenData.email);
      return res.json({
        success: false,
        error: 'Không tìm thấy mật khẩu cho token này. Vui lòng tạo lại token.'
      });
    }
    
    // 1) Gọi API login để lấy cookie mới
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const loginResponse = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: tokenData.email, password: tokenData.password })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed with status: ${loginResponse.status}`);
    }

    const loginData = await loginResponse.json();
    console.log('[REFRESH] Login response:', loginData);

    if (!loginData.success || !loginData.cookie) {
      console.error('[REFRESH] Login failed:', loginData);
      return res.json({
        success: false,
        error: 'Login failed or no cookie received',
        loginData
      });
    }

    // 2) Đợi 3 giây rồi gọi API check-workspace để lấy thông tin workspace
    console.log('[REFRESH] Đợi 3 giây trước khi gọi check-workspace...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const workspaceResponse = await fetch(`${baseUrl}/api/check-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cookie: loginData.cookie })
    });

    if (!workspaceResponse.ok) {
      throw new Error(`Check workspace failed with status: ${workspaceResponse.status}`);
    }

    const workspaceData = await workspaceResponse.json();
    console.log('[REFRESH] Check workspace result:', JSON.stringify(workspaceData, null, 2));

    const wsList = workspaceData.workspaceData?.data?.workspace_infos || workspaceData.workspaceData?.data?.workspaces || [];
    const vipWs = (wsList || []).filter(w => w.team_vip_status === 1).map(w => ({
      workspace_id: String(w.workspace_id),
      name: w.name,
      team_vip_status: w.team_vip_status,
      team_vip_end: w.team_vip_end,
      role: w.role,
      member_limit: w.member_limit,
      member_cnt: w.member_cnt
    }));
    
    // 3) Cập nhật cookie và workspace trong MySQL
    const updatedWsList = wsList.map(w => ({
      workspace_id: String(w.workspace_id),
      name: w.name,
      team_vip_status: w.team_vip_status,
      team_vip_end: w.team_vip_end,
      role: w.role,
      member_limit: w.member_limit,
      member_cnt: w.member_cnt
    }));
    
    await updateToken(token, {
      cookie: loginData.cookie,
      workspaces: updatedWsList,
      vipWorkspaces: vipWs
    });
    console.log(`[REFRESH] Đã cập nhật cookie và workspace cho ${tokenData.email} trong MySQL`);
    
    res.json({ success: true, data: workspaceData });
  } catch (err) {
    console.error('[REFRESH] Lỗi:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== Token-based CapCut actions =====

// get info (mget_workspace_info)
app.post('/api/account/:token/getinfo', async (req, res) => {
  try {
    const token = req.params.token;
    const { workspace_id } = req.body || {};
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ' });
    if (!workspace_id) return res.status(400).json({ success: false, error: 'Thiếu workspace_id' });
    console.log("[getinfo] Cookie:", tokenData.cookie);
    const j = await mgetWorkspaceInfoWithCookie(tokenData.cookie, { workspace_ids: [String(workspace_id)] });
    res.json({ success: true, data: j });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// list member
app.post('/api/account/:token/listmember', async (req, res) => {
  try {
    const token = req.params.token;
    const { workspace_id, count = 50, cursor = '0' } = req.body || {};
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ' });
    if (!workspace_id) return res.status(400).json({ success: false, error: 'Thiếu workspace_id' });
    const cookie = tokenData.cookie;
    console.log("[listmember] Cookie:", cookie);
    const j = await getMemberWithCookie(cookie, { count, cursor: String(cursor), workspace_id: String(workspace_id) });
    res.json({ success: true, data: j });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// add member via email
app.post('/api/account/:token/addmember', async (req, res) => {
  try {
    const token = req.params.token;
    const { workspace_id, emails, role = 3 } = req.body || {};
    
    // Get token data from MySQL
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ' });
    
    // Check if token is expired
    if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
      return res.status(404).json({ success: false, error: 'Token đã hết hạn' });
    }
    
    if (!workspace_id || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, error: 'Thiếu workspace_id hoặc danh sách emails' });
    }
    
    // Use cookie from token data
    const cookie = tokenData.cookie || '';
    if (!cookie) return res.status(400).json({ success: false, error: 'Token không có cookie hợp lệ' });
    
    console.log("[addmember] Cookie:", cookie);
    console.log("[addmember] Emails:", emails);
    const payload = { workspace_id: String(workspace_id), emails: emails.map(e => ({ email: e, role })), query_param: {} };
    const j = await inviteByEmailWithCookie(cookie, payload);
    res.json({ success: true, data: j });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// remove user by uid
app.post('/api/account/:token/removeuser', async (req, res) => {
  try {
    const token = req.params.token;
    const { workspace_id, uid } = req.body || {};
    
    // Get token data from MySQL
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ' });
    
    // Check if token is expired
    if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
      return res.status(404).json({ success: false, error: 'Token đã hết hạn' });
    }
    
    if (!workspace_id || !uid) return res.status(400).json({ success: false, error: 'Thiếu workspace_id hoặc uid' });
    
    // Use cookie from token data
    const cookie = tokenData.cookie || '';
    if (!cookie) return res.status(400).json({ success: false, error: 'Token không có cookie hợp lệ' });
    
    console.log("[removeuser] Cookie:", cookie);
    console.log("[removeuser] UID:", uid);
    const j = await removeUserWithCookie(cookie, { workspace_id: String(workspace_id), uid: String(uid) });
    res.json({ success: true, data: j });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// update name
app.post('/api/account/:token/updatename', async (req, res) => {
  try {
    const token = req.params.token;
    const { workspace_id, name } = req.body || {};
    
    // Get token data from MySQL
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ' });
    
    // Check if token is expired
    if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
      return res.status(404).json({ success: false, error: 'Token đã hết hạn' });
    }
    
    if (!workspace_id || !name) return res.status(400).json({ success: false, error: 'Thiếu workspace_id hoặc name' });
    
    // Use cookie from token data
    const cookie = tokenData.cookie || '';
    if (!cookie) return res.status(400).json({ success: false, error: 'Token không có cookie hợp lệ' });
    
    console.log("[updatename] Cookie:", cookie);
    console.log("[updatename] New name:", name);
    const j = await updateNameWithCookie(cookie, { workspace_id: String(workspace_id), name: String(name) });
    
    // Update workspace name in MySQL token data
    if (j.success && tokenData.workspaces) {
      const workspace = tokenData.workspaces.find(w => String(w.workspace_id) === String(workspace_id));
      if (workspace) {
        workspace.name = name;
        await updateToken(token, { workspaces: tokenData.workspaces });
        console.log(`[updatename] Đã cập nhật tên workspace ${workspace_id} thành "${name}" trong MySQL`);
      }
    }
    
    res.json({ success: true, data: j });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// set user role
app.post('/api/account/:token/setrole', async (req, res) => {
  try {
    const token = req.params.token;
    const { workspace_id, uid, role } = req.body || {};
    
    // Get token data from MySQL
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ' });
    
    // Check if token is expired
    if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
      return res.status(404).json({ success: false, error: 'Token đã hết hạn' });
    }
    
    if (!workspace_id || !uid || !role) return res.status(400).json({ success: false, error: 'Thiếu workspace_id, uid hoặc role' });
    
    // Use cookie from token data
    const cookie = tokenData.cookie || '';
    if (!cookie) return res.status(400).json({ success: false, error: 'Token không có cookie hợp lệ' });
    
    console.log("[setrole] Cookie:", cookie);
    console.log("[setrole] UID:", uid, "Role:", role);
    const j = await setUserRoleWithCookie(cookie, { workspace_id: String(workspace_id), uid: String(uid), role: String(role) });
    res.json({ success: true, data: j });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// get invitation link
app.post('/api/account/:token/getlink', async (req, res) => {
  try {
    const token = req.params.token;
    const { workspace_id } = req.body || {};
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ' });
    if (!workspace_id) return res.status(400).json({ success: false, error: 'Thiếu workspace_id' });
    const cookie = tokenData.cookie;
    console.log("[getlink] Cookie:", cookie);
    console.log("[getlink] Workspace ID:", workspace_id);
    const j = await getlinkWithCookie(cookie, { workspace_id: String(workspace_id) });
    res.json({ success: true, data: j });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// refresh invitation link
app.post('/api/account/:token/refreshlink', async (req, res) => {
  try {
    const token = req.params.token;
    const { workspace_id } = req.body || {};
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ' });
    if (!workspace_id) return res.status(400).json({ success: false, error: 'Thiếu workspace_id' });
    const cookie = tokenData.cookie;
    console.log("[refreshlink] Cookie:", cookie);
    console.log("[refreshlink] Workspace ID:", workspace_id);
    const j = await refresh_invitation_link(cookie, { workspace_id: String(workspace_id) });
    res.json({ success: true, data: j });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// get notices
app.post('/api/account/:token/notices', async (req, res) => {
  try {
    const token = req.params.token;
    const { notice_type = [2, 3], cursor = '0', count = 20 } = req.body || {};
    const tokenData = await findTokenByToken(token);
    if (!tokenData) return res.status(404).json({ success: false, error: 'Token không hợp lệ' });
    if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
      return res.status(404).json({ success: false, error: 'Token đã hết hạn' });
    }
    const cookie = tokenData.cookie || '';
    if (!cookie) return res.status(400).json({ success: false, error: 'Token không có cookie hợp lệ' });
    const body = { notice_type, cursor: String(cursor), count };
    const j = await getNoticeListWithCookie(cookie, body);
    res.json({ success: true, data: j });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin API - Get all tokens
app.get('/api/admin/tokens', async (req, res) => {
  try {
    console.log('[ADMIN_TOKENS] Getting all tokens from MySQL...');
    const tokens = await getAllTokens();
    console.log('[ADMIN_TOKENS] Tokens array:', tokens.length, 'tokens');
    console.log('[ADMIN_TOKENS] Tokens type:', typeof tokens, 'Is array:', Array.isArray(tokens));
    
    if (!Array.isArray(tokens)) {
      console.error('[ADMIN_TOKENS] ERROR: tokens is not an array:', tokens);
      return res.status(500).json({ success: false, error: 'Tokens data is not an array' });
    }
    
    res.json({ success: true, tokens });
  } catch (err) {
    console.error('[ADMIN_TOKENS] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin API - Delete token
app.delete('/api/admin/tokens', async (req, res) => {
  try {
    const { token } = req.body;
    console.log('[DELETE_TOKEN] Request:', { token: token?.substring(0, 10) + '...' });
    
    if (!token) {
      return res.status(400).json({ success: false, error: 'Thiếu token' });
    }
    
    const result = await deleteToken(token);
    console.log('[DELETE_TOKEN] Deleted token:', result.deletedCount);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy token' });
    }
    
    res.json({ success: true, message: 'Đã xóa token thành công' });
  } catch (err) {
    console.error('[DELETE_TOKEN] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin API - Initialize database
app.post('/api/admin/init-database', async (req, res) => {
  try {
    console.log('[ADMIN_INIT_DB] Initializing database...');
    const result = await initializeDatabase();
    res.json(result);
  } catch (err) {
    console.error('[ADMIN_INIT_DB] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin API - Test MySQL connection
app.get('/api/admin/test-mysql', async (req, res) => {
  try {
    const result = await testMySQLConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API lấy proxy free
app.get('/api/free-proxies', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 10;
    const proxies = await getRandomFreeProxies(count);
    
    res.json({
      success: true,
      proxies: proxies,
      count: proxies.length,
      source: 'fineproxy.org'
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// API kiểm tra proxy live
app.post('/api/check-proxy', async (req, res) => {
  try {
    const { proxyUrl } = req.body;
    
    if (!proxyUrl) {
      return res.json({ success: false, error: 'Vui lòng cung cấp proxy URL' });
    }
    
    const result = await checkProxyLive(proxyUrl);
    
    res.json({
      success: true,
      result: result
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// API kiểm tra nhiều proxy
app.post('/api/check-proxies', async (req, res) => {
  try {
    const { proxies } = req.body;
    
    if (!proxies || !Array.isArray(proxies)) {
      return res.json({ success: false, error: 'Vui lòng cung cấp danh sách proxy' });
    }
    
    const results = await checkMultipleProxies(proxies);
    const liveProxies = results.filter(r => r.live);
    
    res.json({
      success: true,
      results: results,
      liveCount: liveProxies.length,
      totalCount: proxies.length,
      liveProxies: liveProxies
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// API tự động thêm email vào workspace theo gói đã chọn
app.post('/api/add-email-to-solo-work', async (req, res) => {
  try {
    const { email, package: packageType } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Vui lòng cung cấp email' 
      });
    }
    
    if (!packageType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Vui lòng chọn gói (1, 2, 3, 6, 12 tháng)' 
      });
    }
    
    // Xác định số slot theo gói
    const packageMonths = parseInt(packageType, 10);
    const requiredSlots = packageMonths * 30; // Mỗi tháng = 30 slot
    
    // Validate package
    const validPackages = [1, 2, 3, 6, 12];
    if (!validPackages.includes(packageMonths)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Gói không hợp lệ. Chọn 1, 2, 3, 6 hoặc 12 tháng' 
      });
    }
    
    console.log(`\n=== [ADD-TO-SOLO] Bắt đầu tìm workspace cho email: ${email} ===`);
    console.log(`[ADD-TO-SOLO] Gói đã chọn: ${packageMonths} tháng (${requiredSlots} slot)`);
    
    // 1. Lấy tất cả tokens từ database
    const allTokens = await getAllTokens();
    console.log(`[ADD-TO-SOLO] Tìm thấy ${allTokens.length} tokens`);
    
    if (allTokens.length === 0) {
      return res.json({
        success: false,
        error: 'Đã hết slot'
      });
    }
    
    // 2. CHECK GÓI TRƯỚC: Lọc tokens có package trùng với gói được chọn
    const packageStr = String(packageMonths);
    const tokensWithPackage = allTokens.filter(token => {
      const tokenPackage = String(token.package || '');
      return tokenPackage === packageStr;
    });
    
    console.log(`[ADD-TO-SOLO] Tìm thấy ${tokensWithPackage.length} token(s) có gói ${packageMonths} tháng`);
    
    // Nếu không có token nào có gói này thì trả về "đã hết slot"
    if (tokensWithPackage.length === 0) {
      return res.json({
        success: false,
        error: `Đã hết slot cho gói ${packageMonths} tháng (${packageMonths === 12 ? '1 năm' : packageMonths + ' tháng'})`
      });
    }
    
    // 3. Nếu có gói thì tiến hành check từng token có package đó
    let targetWorkspace = null;
    let targetToken = null;
    
    for (const tokenData of tokensWithPackage) {
      // Kiểm tra token có hết hạn không
      if (tokenData.expiresAt && new Date() > new Date(tokenData.expiresAt)) {
        console.log(`[ADD-TO-SOLO] Token ${tokenData.email} đã hết hạn, bỏ qua`);
        continue;
      }
      
      // Kiểm tra token có cookie không
      if (!tokenData.cookie) {
        console.log(`[ADD-TO-SOLO] Token ${tokenData.email} không có cookie, bỏ qua`);
        continue;
      }
      
      const workspaces = tokenData.workspaces || [];
      console.log(`[ADD-TO-SOLO] Đang kiểm tra token ${tokenData.email}, có ${workspaces.length} workspaces`);
      
      // Kiểm tra từng workspace trong token có gói này
      for (const workspace of workspaces) {
        const memberCnt = workspace.member_cnt || 0;
        const memberLimit = workspace.member_limit || 0;
        
        console.log(`[ADD-TO-SOLO] Workspace: ${workspace.name || workspace.workspace_id}`);
        console.log(`[ADD-TO-SOLO]   - Tổng slot (member_limit): ${memberLimit}`);
        console.log(`[ADD-TO-SOLO]   - Slot đang dùng (member_cnt): ${memberCnt}`);
        console.log(`[ADD-TO-SOLO]   - Slot còn trống: ${memberLimit - memberCnt}`);
        
        // Kiểm tra điều kiện: chỉ cần còn chỗ trống (không cần khớp chính xác số slot)
        if (memberCnt < memberLimit) {
          // Kiểm tra lại bằng cách list members để chắc chắn
          try {
            const memberList = await getMemberWithCookie(
              tokenData.cookie, 
              { 
                workspace_id: String(workspace.workspace_id), 
                count: 100, 
                cursor: '0' 
              }
            );
            
            // Kiểm tra số lượng members thực tế
            // Response có thể là: data.data.member_list hoặc data.member_list hoặc data.members
            const members = memberList?.data?.data?.member_list || 
                           memberList?.data?.member_list || 
                           memberList?.data?.members || 
                           memberList?.member_list || 
                           [];
            const actualMemberCount = members.length;
            
            console.log(`[ADD-TO-SOLO]   - Số member thực tế: ${actualMemberCount}`);
            
            // Nếu số member thực tế < member_limit, thì còn chỗ trống
            if (actualMemberCount < memberLimit) {
              targetWorkspace = workspace;
              targetToken = tokenData;
              console.log(`[ADD-TO-SOLO] ✅ Tìm thấy workspace phù hợp: ${workspace.name} (ID: ${workspace.workspace_id})`);
              console.log(`[ADD-TO-SOLO]   - Tổng slot: ${memberLimit}, Đã dùng: ${actualMemberCount}, Còn trống: ${memberLimit - actualMemberCount}`);
              break;
            } else {
              console.log(`[ADD-TO-SOLO]   - Workspace đã đầy (${actualMemberCount}/${memberLimit}), bỏ qua`);
            }
          } catch (memberError) {
            console.warn(`[ADD-TO-SOLO] Không thể kiểm tra members của workspace ${workspace.workspace_id}:`, memberError.message);
            // Nếu không kiểm tra được, vẫn dùng dựa trên member_cnt từ database
            if (memberCnt < memberLimit) {
              targetWorkspace = workspace;
              targetToken = tokenData;
              console.log(`[ADD-TO-SOLO] ✅ Tìm thấy workspace (dùng dữ liệu DB): ${workspace.name} (ID: ${workspace.workspace_id})`);
              break;
            }
          }
        } else {
          console.log(`[ADD-TO-SOLO]   - Workspace đã đầy (${memberCnt}/${memberLimit}), bỏ qua`);
        }
        
        if (targetWorkspace) break;
      }
      
      if (targetWorkspace) break;
    }
    
    if (!targetWorkspace || !targetToken) {
      return res.json({
        success: false,
        error: `Đã hết slot cho gói ${packageMonths} tháng (${requiredSlots} slot)`
      });
    }
    
    // 3. Thêm email vào workspace
    console.log(`[ADD-TO-SOLO] Đang thêm email ${email} vào workspace: ${targetWorkspace.name}`);
    
    const payload = {
      workspace_id: String(targetWorkspace.workspace_id),
      emails: [{ email: email, role: 3 }], // role 3 = member
      query_param: {}
    };
    
    const addResult = await inviteByEmailWithCookie(targetToken.cookie, payload);
    
    console.log(`[ADD-TO-SOLO] Kết quả thêm member:`, JSON.stringify(addResult, null, 2));
    
    // 4. Kiểm tra kết quả (ret có thể là chuỗi "0" hoặc số 0)
    const isSuccess = (addResult?.ret === 0 || addResult?.ret === "0" || Number(addResult?.ret) === 0) ||
                     (addResult?.status_code === 0 || addResult?.status_code === "0" || Number(addResult?.status_code) === 0) ||
                     (addResult?.errmsg && String(addResult.errmsg).toUpperCase() === "SUCCESS");
    
    if (isSuccess) {
      // Refresh workspace info để cập nhật member_cnt
      try {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const workspaceResponse = await fetch(`${baseUrl}/api/check-workspace`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ cookie: targetToken.cookie })
        });
        
        if (workspaceResponse.ok) {
          const workspaceData = await workspaceResponse.json();
          const wsList = workspaceData.workspaceData?.data?.workspace_infos || workspaceData.workspaceData?.data?.workspaces || [];
          const updatedWorkspace = wsList.find(w => String(w.workspace_id) === String(targetWorkspace.workspace_id));
          
          if (updatedWorkspace) {
            // Cập nhật workspace info trong token
            const updatedWorkspaces = (targetToken.workspaces || []).map(w => {
              if (String(w.workspace_id) === String(targetWorkspace.workspace_id)) {
                return {
                  ...w,
                  member_cnt: updatedWorkspace.member_cnt || w.member_cnt,
                  member_limit: updatedWorkspace.member_limit || w.member_limit
                };
              }
              return w;
            });
            
            await updateToken(targetToken.token, { workspaces: updatedWorkspaces });
            console.log(`[ADD-TO-SOLO] Đã cập nhật workspace info trong database`);
          }
        }
      } catch (refreshError) {
        console.warn(`[ADD-TO-SOLO] Không thể refresh workspace info:`, refreshError.message);
      }
      
      res.json({
        success: true,
        message: `Đã thêm email ${email} vào workspace thành công`,
        package: {
          months: packageMonths,
          slots: requiredSlots,
          display: packageMonths === 12 ? '1 Năm' : `${packageMonths} Tháng`
        },
        workspace: {
          workspace_id: targetWorkspace.workspace_id,
          name: targetWorkspace.name,
          owner_email: targetToken.email,
          total_slots: targetWorkspace.member_limit,
          used_slots: targetWorkspace.member_cnt,
          available_slots: targetWorkspace.member_limit - targetWorkspace.member_cnt
        },
        result: addResult
      });
    } else {
      const errorMsg = addResult?.errmsg || addResult?.status_msg || 'Không rõ lỗi';
      res.json({
        success: false,
        error: `Không thể thêm email vào workspace: ${errorMsg}`,
        result: addResult
      });
    }
    
  } catch (error) {
    console.error(`[ADD-TO-SOLO] ❌ Lỗi:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/join', async (req, res) => {
  const { accounts, proxies, inviteLink, inputMode, proxyMode } = req.body;
  
  if (!accounts || !Array.isArray(accounts) || accounts.length === 0 || !inviteLink) {
    return res.json({ success: false, error: 'Vui lòng điền đầy đủ thông tin' });
  }
  
  // Kiểm tra proxy bắt buộc
  if (!proxies || !Array.isArray(proxies) || proxies.length === 0) {
    return res.json({ success: false, error: 'Proxy là bắt buộc. Vui lòng cung cấp ít nhất một proxy.' });
  }
  
  // Kiểm tra proxy mode
  if (!proxyMode || (proxyMode !== 'single' && proxyMode !== 'batch')) {
    return res.json({ success: false, error: 'Vui lòng chọn chế độ proxy hợp lệ.' });
  }
  
  // Giới hạn 5 tài khoản mỗi lần
  if (accounts.length > 5) {
    return res.json({ 
      success: false, 
      error: `Quá nhiều tài khoản (${accounts.length}). Hệ thống chỉ hỗ trợ tối đa 5 tài khoản mỗi lần để đảm bảo tỷ lệ thành công cao.` 
    });
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
        
        // Parse error message để lấy thông tin chi tiết
        let errorDetails = {
          message: error.message,
          code: null,
          description: null
        };
        
        // Nếu error message chứa JSON response
        if (error.message.includes('{') && error.message.includes('}')) {
          try {
            const jsonMatch = error.message.match(/\{.*\}/);
            if (jsonMatch) {
              const errorData = JSON.parse(jsonMatch[0]);
              errorDetails.code = errorData.data?.error_code || errorData.ret;
              errorDetails.description = errorData.data?.description || errorData.errmsg;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
        
        results.push({
          success: false,
          email: account.email,
          error: error.message,
          errorDetails: errorDetails,
          proxy: proxyUrl
        });
      }
      
      // Delay giữa các request để tránh rate limit (5 giây)
      if (i < accounts.length - 1) {
        console.log(`⏳ Chờ 5 giây trước khi xử lý tài khoản tiếp theo...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
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

// ===== ChatGPT API Endpoints =====

// Get all ChatGPT accounts
app.get('/api/chatgpt/accounts', async (req, res) => {
  try {
    const accounts = await getAllChatGPTAccounts();
    res.json({ success: true, accounts });
  } catch (err) {
    console.error('[CHATGPT_ACCOUNTS] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add ChatGPT account
app.post('/api/chatgpt/accounts', async (req, res) => {
  try {
    const { accountId, authorization, name, email } = req.body;
    
    if (!accountId || !authorization) {
      return res.status(400).json({ 
        success: false, 
        error: 'Thiếu accountId hoặc authorization' 
      });
    }
    
    const result = await saveChatGPTAccount({
      accountId,
      authorization,
      name,
      email,
      status: 'active'
    });
    
    res.json({ success: true, accountId: result.id });
  } catch (err) {
    console.error('[CHATGPT_ADD] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete ChatGPT account
app.delete('/api/chatgpt/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteChatGPTAccount(id);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    }
    
    res.json({ success: true, message: 'Đã xóa tài khoản thành công' });
  } catch (err) {
    console.error('[CHATGPT_DELETE] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// List users in ChatGPT account
app.get('/api/chatgpt/accounts/:id/users', async (req, res) => {
  try {
    const { id } = req.params;
    const { offset = 0, limit = 25, query = '' } = req.query;
    
    const account = await getChatGPTAccountById(id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    }
    
    const result = await listChatGPTUsers(
      account.accountId,
      account.authorization,
      parseInt(offset),
      parseInt(limit),
      query
    );
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[CHATGPT_LIST_USERS] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Join email to ChatGPT account
app.post('/api/chatgpt/accounts/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { emailAddresses, role = 'standard-user', resendEmails = true } = req.body;
    
    if (!emailAddresses || (Array.isArray(emailAddresses) && emailAddresses.length === 0)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Vui lòng cung cấp email addresses' 
      });
    }
    
    const account = await getChatGPTAccountById(id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    }
    
    const result = await joinChatGPTEmail(
      account.accountId,
      account.authorization,
      emailAddresses,
      role,
      resendEmails
    );
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[CHATGPT_JOIN] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete user from ChatGPT account
app.delete('/api/chatgpt/accounts/:id/users/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    
    const account = await getChatGPTAccountById(id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    }
    
    const result = await deleteChatGPTUser(
      account.accountId,
      account.authorization,
      userId
    );
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    
    res.json({ success: true, message: 'Đã xóa user thành công' });
  } catch (err) {
    console.error('[CHATGPT_DELETE_USER] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check ChatGPT account subscription/date
app.get('/api/chatgpt/accounts/:id/subscription', async (req, res) => {
  try {
    const { id } = req.params;
    
    const account = await getChatGPTAccountById(id);
    if (!account) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    }
    
    const result = await checkChatGPTDate(
      account.accountId,
      account.authorization
    );
    
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error, code: result.code });
    }
    
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[CHATGPT_CHECK_DATE] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`📱 Mở browser và truy cập link trên để sử dụng`);
  console.log(`🗄️ Sử dụng MySQL database`);
  
  // Initialize database on startup
  console.log(`\n🔍 Đang khởi tạo database MySQL...`);
  try {
    const result = await initializeDatabase();
    if (result.success) {
      console.log(`✅ Khởi tạo database thành công!`);
      console.log(`📊 Hiện có ${result.totalTokens} tokens trong MySQL`);
    } else {
      console.log(`❌ Lỗi khởi tạo database: ${result.error}`);
    }
  } catch (error) {
    console.log(`❌ Lỗi khởi tạo database: ${error.message}`);
  }
  console.log(`\n🎯 Server sẵn sàng phục vụ!\n`);
});
