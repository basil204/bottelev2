import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CookieJar } from "tough-cookie";
import fetchCookie from "fetch-cookie";
import { mgetWorkspaceInfoWithCookie, getUserWorkspacesWithCookie } from "./getinfo.js";
import { getlinkWithCookie } from "./getlink.js";
import { refresh_invitation_link } from "./doilink.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * 1. Đăng nhập CapCut & Lưu Cookie vào file Cache (không cần đăng nhập lại nhiều lần)
 */
export async function loginCapCut(email, password) {
  const cookiesDir = path.join(__dirname, "cookies_cache");
  if (!fs.existsSync(cookiesDir)) {
    fs.mkdirSync(cookiesDir, { recursive: true });
  }

  const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
  const cookiePath = path.join(cookiesDir, `cookie_${safeEmail}.txt`);

  // KIỂM TRA COOKIE CACHE ĐÃ TỒN TẠI VÀ CÒN HẠN SỬ DỤNG KHÔNG
  if (fs.existsSync(cookiePath)) {
    try {
      const cachedCookie = fs.readFileSync(cookiePath, "utf-8").trim();
      if (cachedCookie && cachedCookie.length > 50) {
        console.log(`\n==================================================`);
        console.log(`⚡ KIỂM TRA CACHE COOKIE ĐÃ LƯU DÀNH CHO: ${email}`);
        console.log(`==================================================`);

        // Test xem cookie cũ có còn sống không
        const testWs = await getUserWorkspacesWithCookie(cachedCookie, { cursor: "0", count: 10 });
        if (testWs && (testWs.ret === 0 || testWs.ret === "0" || testWs.errmsg === "SUCCESS")) {
          console.log(`✅ Cookie Cache CÒN SỐNG & HỢP LỆ! Không cần đăng nhập lại.`);
          console.log(`💾 File Cache: ${cookiePath}`);
          console.log(`🍪 Độ dài Cookie: ${cachedCookie.length} ký tự`);
          return { cookieStr: cachedCookie, fromCache: true };
        } else {
          console.log(`⚠️ Cookie Cache cũ đã hết hạn. Đang thực hiện đăng nhập lại...`);
        }
      }
    } catch (e) {
      console.log(`⚠️ Không thể đọc file cache cookie cũ, thực hiện đăng nhập mới.`);
    }
  }

  // THỰC HIỆN ĐĂNG NHẬP NẾU CHƯA CÓ CACHE HOẶC CACHE HẾT HẠN
  console.log(`\n==================================================`);
  console.log(`🔐 [STEP 1] ĐĂNG NHẬP CAPCUT MỚI: ${email}`);
  console.log(`==================================================`);

  const jar = new CookieJar();
  const _fetch = fetchCookie(fetch, jar);

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

  const fullCookieStr = await mergedCookieFor(jar, [
    "https://www.capcut.com",
    "https://edit-api-sg.capcut.com",
    "https://commerce-api-sg.capcut.com"
  ]);

  // LƯU COOKIE VÀO FILE CACHE DÙNG CHO CÁC LẦN SAU
  fs.writeFileSync(cookiePath, fullCookieStr, "utf-8");
  console.log(`💾 ĐÃ LƯU COOKIE MỚI VÀO FILE CACHE: ${cookiePath}`);
  console.log(`🍪 Tổng độ dài Cookie: ${fullCookieStr.length} ký tự`);

  return { cookieStr: fullCookieStr, userInfo, fromCache: false };
}

/**
 * 2. Lấy Info ➔ Lấy Link ➔ Đổi Link mới (doilink.js / refresh_invitation_link)
 */
export async function getWorkspaceAndRefreshLink(cookieStr, targetWsId = null) {
  console.log(`\n==================================================`);
  console.log(`🏢 [STEP 2] LẤY DANH SÁCH WORKSPACE (getinfo.js)`);
  console.log(`==================================================`);

  // Gọi getUserWorkspacesWithCookie từ getinfo.js
  const wsData = await getUserWorkspacesWithCookie(cookieStr, {
    cursor: "0",
    count: 100,
    need_convert_workspace: true
  });

  const workspaces =
    wsData?.data?.workspace_infos ||
    wsData?.data?.workspaces ||
    wsData?.data?.list ||
    [];

  console.log(`📋 Số lượng Workspace tìm thấy: ${workspaces.length}`);

  const results = [];

  for (const ws of workspaces) {
    const wsId = String(ws.workspace_id || ws.id);

    // Nếu chỉ định targetWsId thì chỉ xử lý đúng workspace_id đó
    if (targetWsId && wsId !== String(targetWsId)) {
      continue;
    }

    console.log(`\n🔍 Đang xử lý cho Workspace ID: ${wsId} (${ws.name})`);

    // 2b. Lấy chi tiết Workspace từ getinfo.js
    const infoData = await mgetWorkspaceInfoWithCookie(cookieStr, {
      workspace_ids: [wsId]
    });

    // 2c. Lấy link hiện tại từ getlink.js
    await new Promise(r => setTimeout(r, 1000));
    const linkRes = await getlinkWithCookie(cookieStr, { workspace_id: wsId });
    const oldLink =
      linkRes?.data?.invitation_link ||
      linkRes?.data?.invite_link ||
      linkRes?.data?.link ||
      linkRes?.data?.url ||
      "";

    console.log(`🔗 Link hiện tại: ${oldLink || "(Chưa có link)"}`);

    // 2d. Đổi Link mới (refresh_invitation_link từ doilink.js)
    console.log(`\n==================================================`);
    console.log(`🔄 [STEP 3] THỰC HIỆN ĐỔI LINK MỚI (doilink.js)`);
    console.log(`==================================================`);
    await new Promise(r => setTimeout(r, 2000));

    const refreshRes = await refresh_invitation_link(cookieStr, { workspace_id: wsId });
    const newLink =
      refreshRes?.data?.invitation_link ||
      refreshRes?.data?.invite_link ||
      refreshRes?.data?.link ||
      refreshRes?.data?.url ||
      "";

    console.log(`✨ LINK MỚI ĐÃ ĐỔI: ${newLink || "(Đã đổi thành công)"}`);

    results.push({
      workspace_id: wsId,
      name: ws.name,
      role: ws.role,
      infoData,
      oldLink,
      newLink,
      refreshRes
    });
  }

  return { workspaces, results, wsData };
}

// Chạy trực tiếp qua command line
if (process.argv[1] && process.argv[1].endsWith("login_getinfo.js")) {
  const args = process.argv.slice(2);
  const email = args[0] || "EliseAthanasiou572597@hotmail.com";
  const password = args[1] || "a123456";
  const targetWsId = args[2] || null;

  (async () => {
    try {
      const { cookieStr, fromCache } = await loginCapCut(email, password);
      const res = await getWorkspaceAndRefreshLink(cookieStr, targetWsId);

      console.log(`\n==================================================`);
      console.log(`🎉 TỔNG KẾT KẾT QUẢ ĐỔI LINK WORKSPACE`);
      console.log(`==================================================`);
      console.log(`👤 Tài khoản: ${email}`);
      console.log(`⚡ Trạng thái Cookie: ${fromCache ? "🟢 Dùng Cookie Cache" : "🟡 Đăng nhập mới"}`);
      console.log(`📁 Số lượng Workspace xử lý: ${res.results.length}`);
      
      res.results.forEach((item, idx) => {
        console.log(`\n [${idx + 1}] Workspace: ${item.name} (ID: ${item.workspace_id})`);
        console.log(`     🔗 Link cũ: ${item.oldLink || "N/A"}`);
        console.log(`     ✨ Link MỚI ĐÃ ĐỔI: ${item.newLink || JSON.stringify(item.refreshRes)}`);
      });
      console.log(`==================================================\n`);

    } catch (err) {
      console.error("💥 Lỗi:", err.message);
    }
  })();
}
