import fetch from 'node-fetch';
import fs from 'fs';
import { mgetWorkspaceInfoWithCookie } from './capcutteamql/getinfo.js';
import { getlinkWithCookie } from './capcutteamql/getlink.js';

const AID = '348188';
const SDK_VERSION = '2.1.10-tiktok';
const LANGUAGE = 'vi-VN';
const VERIFY_FP = 'verify_men0a4cg_yEfkzeLx_7hft_4fKX_8ENt_fYQ6wdT6OUFB';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function encryptToHex(str) {
  let hex = '';
  for (const ch of str) {
    const enc = ch.charCodeAt(0) ^ 0x05;
    hex += enc.toString(16).padStart(2, '0');
  }
  return hex;
}

function parseSetCookies(res, currentCookiesStr = '') {
  const cookieMap = new Map();
  if (currentCookiesStr) {
    currentCookiesStr.split(';').forEach(pair => {
      const parts = pair.split('=');
      if (parts.length >= 2) {
        cookieMap.set(parts[0].trim(), parts.slice(1).join('=').trim());
      }
    });
  }
  const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (setCookieHeaders.length === 0) {
    const singleHeader = res.headers.get('set-cookie');
    if (singleHeader) setCookieHeaders.push(singleHeader);
  }
  setCookieHeaders.forEach(header => {
    const cookiePart = header.split(';')[0];
    const parts = cookiePart.split('=');
    if (parts.length >= 2) {
      cookieMap.set(parts[0].trim(), parts.slice(1).join('=').trim());
    }
  });
  return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

// 1. Function Login CapCut Lấy Cookie
async function loginAndGetCookie(email, password) {
  console.log(`\n==================================================`);
  console.log(`🔐 BƯỚC 1: ĐĂNG NHẬP CAPCUT LẤY COOKIE`);
  console.log(`👤 Email: ${email}`);
  console.log(`==================================================`);

  const seedRes = await fetch('https://www.capcut.com/', {
    method: 'GET',
    headers: {
      'user-agent': UA,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  let cookieStr = parseSetCookies(seedRes, '');
  const csrf = (cookieStr.match(/passport_csrf_token=([^;]+)/) || [])[1] ||
               (cookieStr.match(/passport_csrf_token_default=([^;]+)/) || [])[1] || '';

  const loginUrl = `https://www.capcut.com/passport/web/email/login/?aid=${AID}&account_sdk_source=web&sdk_version=${encodeURIComponent(SDK_VERSION)}&language=${encodeURIComponent(LANGUAGE)}&verifyFp=${encodeURIComponent(VERIFY_FP)}`;

  const body = new URLSearchParams({
    mix_mode: '1',
    email: encryptToHex(email),
    password: encryptToHex(password),
    fixed_mix_mode: '1'
  });

  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json, text/javascript',
    origin: 'https://www.capcut.com',
    referer: 'https://www.capcut.com/',
    'user-agent': UA,
    'store-country-code': 'vn',
    'store-country-code-src': 'uid',
    'cookie': cookieStr
  };

  if (csrf) headers['x-tt-passport-csrf-token'] = csrf;

  const res = await fetch(loginUrl, { method: 'POST', headers, body });
  cookieStr = parseSetCookies(res, cookieStr);

  const loginData = await res.json();
  if (!loginData?.message?.toLowerCase().includes('success')) {
    console.error('❌ Đăng nhập thất bại:', loginData?.description || loginData?.message);
    throw new Error(loginData?.description || loginData?.message || 'Login failed');
  }

  const userInfo = loginData?.data || {};
  console.log(`✅ Đăng nhập THÀNH CÔNG!`);
  console.log(`👤 User ID (UID): ${userInfo.user_id_str || userInfo.user_id}`);
  console.log(`🏷️ Nickname: ${userInfo.name || userInfo.screen_name}`);
  console.log(`🍪 Cookie Length: ${cookieStr.length} ký tự`);

  const safeFilename = `cookies_${email.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  fs.writeFileSync(safeFilename, cookieStr, 'utf-8');
  console.log(`💾 Đã lưu cookie vào file: ${safeFilename}`);

  return { cookieStr, userInfo };
}

// 2. Function Lấy Info (getinfo.js) -> Rồi Lấy Link (getlink.js)
async function getWorkspacesInfoAndLink(cookieStr) {
  console.log(`\n==================================================`);
  console.log(`🏢 BƯỚC 2: LẤY THÔNG TIN WORKSPACE (getinfo.js)`);
  console.log(`==================================================`);

  // Lấy danh sách Workspaces của user
  const wsUrl = 'https://edit-api-sg.capcut.com/cc/v1/workspace/get_user_workspaces';
  const wsRes = await fetch(wsUrl, {
    method: 'POST',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'vi,fr-FR;q=0.9,fr;q=0.8,en-US;q=0.7,en;q=0.6,zh-TW;q=0.5,zh;q=0.4',
      'app-sdk-version': '48.0.0',
      'appid': AID,
      'appvr': '5.8.0',
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      'device-time': '1759222949',
      'did': '7543172286023616001',
      'lan': 'vi-VN',
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
      'sign': '4f24e01e9bd2aedd6f3d2856bf605b62',
      'sign-ver': '1',
      'store-country-code': 'vn',
      'store-country-code-src': 'uid',
      'tdid': '',
      'cookie': cookieStr,
      'Referer': 'https://www.capcut.com/'
    },
    body: JSON.stringify({ cursor: '0', count: 100, need_convert_workspace: true })
  });

  const wsData = await wsRes.json();
  const workspaces = wsData?.data?.workspace_infos || wsData?.data?.workspaces || wsData?.data?.list || wsData?.data?.workspace_list || wsData?.data?.user_workspace_list || [];

  console.log(`📋 Tổng số Workspace tìm thấy: ${workspaces.length}`);

  const results = [];

  for (const ws of workspaces) {
    const wsId = String(ws.workspace_id || ws.id || ws.workspace_info?.workspace_id || ws.workspace_id_str || '');
    if (!wsId) continue;

    console.log(`\n🔍 2.1. Đang gọi capcutteamql/getinfo.js cho Workspace ID: ${wsId}`);
    // Gọi capcutteamql/getinfo.js (mgetWorkspaceInfoWithCookie)
    const infoRes = await mgetWorkspaceInfoWithCookie(cookieStr, { workspace_ids: [wsId] });
    console.log(`ℹ️ [capcutteamql.getinfo] Trả về:`, JSON.stringify(infoRes));

    console.log(`🔗 2.2. Đang gọi capcutteamql/getlink.js cho Workspace ID: ${wsId}`);
    // Gọi capcutteamql/getlink.js (getlinkWithCookie)
    const linkRes = await getlinkWithCookie(cookieStr, { workspace_id: wsId });
    const inviteLink = linkRes?.data?.invitation_link || linkRes?.data?.invite_link || linkRes?.data?.short_link || linkRes?.data?.link || linkRes?.data?.url || linkRes?.data?.invite_url || '';
    console.log(`🔗 [capcutteamql.getlink] Trả về Link Invite: ${inviteLink || '(Rỗng)'}`);

    results.push({
      workspace_id: wsId,
      name: ws.name || 'CapCut Workspace',
      info_response: infoRes,
      invite_link: inviteLink,
      link_response: linkRes
    });
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const email = args[0] || 'KendrickBrezovsky2535@hotmail.com';
  const password = args[1] || 'a123456';

  try {
    const { cookieStr, userInfo } = await loginAndGetCookie(email, password);
    const results = await getWorkspacesInfoAndLink(cookieStr);

    console.log(`\n==================================================`);
    console.log(`🎉 TỔNG KẾT THỰC THI (GET INFO -> GET LINK)`);
    console.log(`==================================================`);
    console.log(`👤 User ID: ${userInfo.user_id_str || userInfo.user_id}`);
    console.log(`📁 Số Workspace: ${results.length}`);
    results.forEach((item, idx) => {
      console.log(` [${idx + 1}] WS ID: ${item.workspace_id} | Link Invite: ${item.invite_link || 'N/A'}`);
    });
    console.log(`==================================================\n`);

  } catch (err) {
    console.error('💥 LỖI THỰC THI:', err.message);
  }
}

main();
