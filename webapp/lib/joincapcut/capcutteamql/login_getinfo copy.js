import fetch from "node-fetch";
import { CookieJar } from "tough-cookie";
import fetchCookie from "fetch-cookie";
import { mgetWorkspaceInfoWithCookie, getUserWorkspacesWithCookie } from "./getinfo.js";

const AID = "348188";
const SDK_VERSION = "2.1.10-tiktok";
const LANGUAGE = "vi-VN";
const VERIFY_FP = "verify_men0a4cg_yEfkzeLx_7hft_4fKX_8ENt_fYQ6wdT6OUFB";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

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

/**
 * 1. Đăng nhập CapCut bằng Email + Mật khẩu ➔ Nhận chuỗi Cookie đầy đủ (CookieJar)
 */
export async function loginCapCut(email, password) {
  console.log(`\n==================================================`);
  console.log(`🔐 [STEP 1] ĐĂNG NHẬP CAPCUT: ${email}`);
  console.log(`==================================================`);

  const jar = new CookieJar();
  const _fetch = fetchCookie(fetch, jar);

  // 1a. Seed home page
  await _fetch("https://www.capcut.com/", {
    method: "GET",
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  const seedCookie = await getCookieStringFor(jar, "https://www.capcut.com");
  const csrf =
    (seedCookie.match(/passport_csrf_token=([^;]+)/) || [])[1] ||
    (seedCookie.match(/passport_csrf_token_default=([^;]+)/) || [])[1] ||
    "";

  // 1b. Gửi request đăng nhập CapCut Passport API
  const loginUrl = `https://www.capcut.com/passport/web/email/login/?aid=${AID}&account_sdk_source=web&sdk_version=${encodeURIComponent(SDK_VERSION)}&language=${encodeURIComponent(LANGUAGE)}&verifyFp=${encodeURIComponent(VERIFY_FP)}`;

  const body = new URLSearchParams({
    mix_mode: "1",
    email: encryptToHex(email),
    password: encryptToHex(password),
    fixed_mix_mode: "1"
  });

  const headers = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json, text/javascript",
    origin: "https://www.capcut.com",
    referer: "https://www.capcut.com/",
    "user-agent": UA,
    "store-country-code": "vn",
    "store-country-code-src": "uid"
  };

  if (csrf) headers["x-tt-passport-csrf-token"] = csrf;

  const res = await _fetch(loginUrl, { method: "POST", headers, body });
  const loginData = await res.json();

  if (!loginData?.message?.toLowerCase().includes("success")) {
    console.error("❌ Đăng nhập thất bại:", loginData?.description || loginData?.message);
    throw new Error(loginData?.description || loginData?.message || "Login failed");
  }

  const userInfo = loginData?.data || {};
  console.log(`✅ Đăng nhập THÀNH CÔNG!`);
  console.log(`👤 User ID: ${userInfo.user_id_str || userInfo.user_id}`);
  console.log(`🏷️ Nickname: ${userInfo.name || userInfo.screen_name}`);

  // Trích xuất toàn bộ cookie từ các domain capcut
  const fullCookieStr = await mergedCookieFor(jar, [
    "https://www.capcut.com",
    "https://edit-api-sg.capcut.com",
    "https://commerce-api-sg.capcut.com"
  ]);

  console.log(`🍪 Tổng độ dài Cookie thu thập: ${fullCookieStr.length} ký tự`);

  return { cookieStr: fullCookieStr, userInfo };
}

/**
 * 2. Gọi trực tiếp các hàm từ getinfo.js để lấy thông tin Workspace & User
 */
export async function getWorkspaceAndUserInfo(cookieStr) {
  console.log(`\n==================================================`);
  console.log(`🏢 [STEP 2] GỌI HÀM TRỰC TIẾP TỪ getinfo.js`);
  console.log(`==================================================`);

  // Đợi 2.5s để session CapCut đồng bộ trên hệ thống
  await new Promise(r => setTimeout(r, 2500));

  // Gọi getUserWorkspacesWithCookie từ getinfo.js
  const wsData = await getUserWorkspacesWithCookie(cookieStr, {
    cursor: "0",
    count: 100,
    need_convert_workspace: true
  });

  console.log(`📋 Raw get_user_workspaces Response:\n`, JSON.stringify(wsData, null, 2));
  const workspaces =
    wsData?.data?.workspace_infos ||
    wsData?.data?.workspaces ||
    wsData?.data?.list ||
    [];

  console.log(`📋 Số lượng Workspace tìm thấy: ${workspaces.length}`);
  if (workspaces.length > 0) {
    console.log(`🔍 Danh sách Workspaces:`, workspaces.map(w => ({ id: w.workspace_id, name: w.name, role: w.role })));
  }

  // Gọi mgetWorkspaceInfoWithCookie từ getinfo.js cho từng Workspace ID
  const details = [];
  if (workspaces.length > 0) {
    const wsIds = workspaces.map((w) => String(w.workspace_id || w.id));

    const infoData = await mgetWorkspaceInfoWithCookie(cookieStr, {
      workspace_ids: wsIds
    });

    console.log(`\nℹ️ [getinfo.js -> mgetWorkspaceInfoWithCookie] Kết quả:\n`, JSON.stringify(infoData, null, 2));
    details.push(infoData);
  }

  return { workspaces, details, wsData };
}

// Chạy trực tiếp qua command line
if (process.argv[1] && process.argv[1].endsWith("login_getinfo.js")) {
  const args = process.argv.slice(2);
  const email = args[0] || "MiriahCastelar229244@hotmail.com";
  const password = args[1] || "a123456";

  (async () => {
    try {
      const { cookieStr, userInfo } = await loginCapCut(email, password);
      const wsInfo = await getWorkspaceAndUserInfo(cookieStr);
      console.log(`\n🎉 HOÀN TẤT THỰC THI!`);
    } catch (err) {
      console.error("💥 Lỗi:", err.message);
    }
  })();
}
