// CapCut Auto Join Workspace - Web Interface
// Usage: node web_app.js
// Mở browser: http://localhost:3000

import fetch from "node-fetch";
import { CookieJar } from "tough-cookie";
import fetchCookie from "fetch-cookie";
import express from "express";
import path from "path";
import { HttpsProxyAgent } from "https-proxy-agent";
import { joinWorkspace } from "./join.js";
import { convertCapCutLink } from "./link_converter.js";

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

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
  res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CapCut Auto Join Workspace</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            width: 100%;
            max-width: 500px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            color: #333;
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            color: #666;
            font-size: 1.1em;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 600;
        }
        
        .form-group input {
            width: 100%;
            padding: 15px;
            border: 2px solid #e1e5e9;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .btn {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .btn:hover {
            transform: translateY(-2px);
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 10px;
            display: none;
        }
        
        .result.success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        
        .result.error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        
        .workspace-info {
            margin-top: 15px;
            padding: 15px;
            background-color: #e7f3ff;
            border: 1px solid #b8daff;
            border-radius: 6px;
        }
        
        .workspace-info h4 {
            margin: 0 0 10px 0;
            color: #004085;
            font-size: 16px;
        }
        
        .workspace-info p {
            margin: 5px 0;
            font-size: 14px;
        }
        
        .error-info {
            margin-top: 15px;
            padding: 15px;
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
        }
        
        .error-info h4 {
            margin: 0 0 10px 0;
            color: #856404;
            font-size: 16px;
        }
        
        .error-info p {
            margin: 5px 0;
            font-size: 14px;
        }
        
        .help-text {
            display: block;
            margin-top: 5px;
            font-size: 12px;
            color: #6c757d;
            font-style: italic;
        }
        
        textarea {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 14px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            resize: vertical;
            min-height: 100px;
        }
        
        textarea:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }
        
        select {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 14px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: white;
        }
        
        select:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }
        
        .conversion-info {
            margin-top: 15px;
            padding: 15px;
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
        }
        
        .conversion-info h4 {
            margin: 0 0 10px 0;
            color: #495057;
            font-size: 16px;
        }
        
        .conversion-info p {
            margin: 5px 0;
            font-size: 14px;
            word-break: break-all;
        }
        
        .loading {
            display: none;
            text-align: center;
            margin: 20px 0;
        }
        
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 CapCut Auto Join</h1>
            <p>Đăng nhập và join workspace tự động</p>
        </div>
        
        <form id="joinForm">
            <div class="form-group">
                <label for="inputMode">📝 Chế độ nhập</label>
                <select id="inputMode" name="inputMode" onchange="toggleInputMode()">
                    <option value="single">Đơn lẻ</option>
                    <option value="batch">Hàng loạt</option>
                </select>
            </div>
            
            <div id="singleMode">
                <div class="form-group">
                    <label for="email">📧 Email</label>
                    <input type="email" id="email" name="email">
                </div>
                
                <div class="form-group">
                    <label for="password">🔒 Password</label>
                    <input type="password" id="password" name="password">
                </div>
            </div>
            
            <div id="batchMode" style="display: none;">
                <div class="form-group">
                    <label for="accounts">👥 Danh sách tài khoản</label>
                    <textarea id="accounts" name="accounts" placeholder="email1:password1&#10;email2:password2&#10;email3:password3" rows="5"></textarea>
                    <small class="help-text">Mỗi dòng một tài khoản, format: email:password</small>
                </div>
            </div>
            
            <div class="form-group">
                <label for="inviteLink">🔗 Invite Link</label>
                <input type="url" id="inviteLink" name="inviteLink" placeholder="https://www.capcut.com/team-invite/... hoặc https://www.capcut.com/sv2/..." required>
                <small class="help-text">Hỗ trợ cả team-invite và sv2 links (tự động convert)</small>
            </div>
            
            <div class="form-group">
                <label for="proxyMode">🌐 Chế độ Proxy</label>
                <select id="proxyMode" name="proxyMode" onchange="toggleProxyMode()">
                    <option value="none">Không dùng proxy</option>
                    <option value="single">Proxy đơn lẻ</option>
                    <option value="batch">Danh sách proxy</option>
                </select>
            </div>
            
            <div id="singleProxyMode" style="display: none;">
                <div class="form-group">
                    <label for="proxyUrl">🌐 Proxy</label>
                    <input type="text" id="proxyUrl" name="proxyUrl" placeholder="ip:port:username:password hoặc http://proxy:port">
                </div>
            </div>
            
            <div id="batchProxyMode" style="display: none;">
                <div class="form-group">
                    <label for="proxies">🌐 Danh sách Proxy</label>
                    <textarea id="proxies" name="proxies" placeholder="ip1:port1:user1:pass1&#10;ip2:port2:user2:pass2&#10;ip3:port3:user3:pass3" rows="5"></textarea>
                    <small class="help-text">Mỗi dòng một proxy, format: ip:port:username:password</small>
                </div>
            </div>
            
            <button type="submit" class="btn" id="submitBtn">
                🚀 Bắt đầu
            </button>
        </form>
        
        <div class="loading" id="loading">
            <div class="spinner"></div>
            <p>Đang xử lý...</p>
        </div>
        
        <div class="result" id="result"></div>
    </div>

        <script>
        function toggleInputMode() {
            const inputMode = document.getElementById('inputMode').value;
            const singleMode = document.getElementById('singleMode');
            const batchMode = document.getElementById('batchMode');
            
            if (inputMode === 'single') {
                singleMode.style.display = 'block';
                batchMode.style.display = 'none';
            } else {
                singleMode.style.display = 'none';
                batchMode.style.display = 'block';
            }
        }
        
        function toggleProxyMode() {
            const proxyMode = document.getElementById('proxyMode').value;
            const singleProxyMode = document.getElementById('singleProxyMode');
            const batchProxyMode = document.getElementById('batchProxyMode');
            
            if (proxyMode === 'single') {
                singleProxyMode.style.display = 'block';
                batchProxyMode.style.display = 'none';
            } else if (proxyMode === 'batch') {
                singleProxyMode.style.display = 'none';
                batchProxyMode.style.display = 'block';
            } else {
                singleProxyMode.style.display = 'none';
                batchProxyMode.style.display = 'none';
            }
        }
        
        document.getElementById('joinForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const inputMode = document.getElementById('inputMode').value;
            const proxyMode = document.getElementById('proxyMode').value;
            const inviteLink = document.getElementById('inviteLink').value;
            
            // Lấy danh sách tài khoản
            let accounts = [];
            if (inputMode === 'single') {
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                if (!email || !password) {
                    alert('Vui lòng nhập đầy đủ email và password');
                    return;
                }
                accounts = [{ email, password }];
            } else {
                const accountsText = document.getElementById('accounts').value;
                if (!accountsText.trim()) {
                    alert('Vui lòng nhập danh sách tài khoản');
                    return;
                }
                accounts = accountsText.split('\n').map(line => {
                    const [email, password] = line.split(':');
                    return { email: email?.trim(), password: password?.trim() };
                }).filter(acc => acc.email && acc.password);
                
                if (accounts.length === 0) {
                    alert('Không có tài khoản hợp lệ nào');
                    return;
                }
            }
            
            // Lấy danh sách proxy
            let proxies = [];
            if (proxyMode === 'single') {
                const proxyUrl = document.getElementById('proxyUrl').value;
                if (proxyUrl.trim()) {
                    proxies = [proxyUrl.trim()];
                }
            } else if (proxyMode === 'batch') {
                const proxiesText = document.getElementById('proxies').value;
                if (proxiesText.trim()) {
                    proxies = proxiesText.split('\n').map(line => line.trim()).filter(line => line);
                }
            }
            
            const submitBtn = document.getElementById('submitBtn');
            const loading = document.getElementById('loading');
            const result = document.getElementById('result');
            
            // Show loading
            submitBtn.disabled = true;
            loading.style.display = 'block';
            result.style.display = 'none';
            
            try {
            const response = await fetch('/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    accounts, 
                    proxies, 
                    inviteLink,
                    inputMode,
                    proxyMode
                })
            });
                
                const data = await response.json();
                
                if (data.success) {
                    result.className = 'result success';
                    
                    let resultHtml = '';
                    
                    // Hiển thị thống kê tổng quan
                    if (data.results && data.results.length > 1) {
                        resultHtml += \`
                            <div class="summary-info">
                                <h4>📊 Tổng kết:</h4>
                                <p><strong>Tổng số:</strong> \${data.total}</p>
                                <p><strong>Thành công:</strong> \${data.successCount}</p>
                                <p><strong>Thất bại:</strong> \${data.errorCount}</p>
                            </div>
                        \`;
                    }
                    
                    // Hiển thị link conversion nếu có
                    if (data.convertedLink) {
                        resultHtml += \`
                            <div class="conversion-info">
                                <h4>🔄 Link Conversion:</h4>
                                <p><strong>Original:</strong> \${data.originalLink}</p>
                                <p><strong>Converted:</strong> \${data.convertedLink}</p>
                            </div>
                        \`;
                    }
                    
                    // Hiển thị kết quả từng tài khoản
                    if (data.results && data.results.length > 1) {
                        resultHtml += '<div class="batch-results">';
                        data.results.forEach((result, index) => {
                            const status = result.success ? '✅' : '❌';
                            const statusText = result.success ? 'Thành công' : 'Thất bại';
                            
                            resultHtml += \`
                                <div class="account-result \${result.success ? 'success' : 'error'}">
                                    <h5>\${status} Tài khoản \${index + 1}: \${result.email}</h5>
                                    <p><strong>Trạng thái:</strong> \${statusText}</p>
                                    \${result.proxy ? \`<p><strong>Proxy:</strong> \${result.proxy}</p>\` : ''}
                                    \${result.sessionid ? \`<p><strong>Session ID:</strong> \${result.sessionid}</p>\` : ''}
                                    \${result.error ? \`<p><strong>Lỗi:</strong> \${result.error}</p>\` : ''}
                                </div>
                            \`;
                        });
                        resultHtml += '</div>';
                    } else if (data.results && data.results.length === 1) {
                        // Hiển thị kết quả đơn lẻ
                        const singleResult = data.results[0];
                        if (singleResult.success) {
                            resultHtml += \`
                                <h3>✅ Thành công!</h3>
                                <p><strong>Email:</strong> \${singleResult.email}</p>
                                <p><strong>Session ID:</strong> \${singleResult.sessionid}</p>
                            \`;
                            
                            // Hiển thị thông tin workspace nếu có
                            if (singleResult.response && singleResult.response.data && singleResult.response.data.workspace_info) {
                                const workspace = singleResult.response.data.workspace_info;
                                resultHtml += \`
                                    <div class="workspace-info">
                                        <h4>📊 Thông tin Workspace:</h4>
                                        <p><strong>Tên:</strong> \${workspace.name}</p>
                                        <p><strong>Vai trò:</strong> \${workspace.role}</p>
                                        <p><strong>Người mời:</strong> \${workspace.caller_nickname}</p>
                                        <p><strong>Giới hạn thành viên:</strong> \${workspace.member_limit}</p>
                                        <p><strong>Số thành viên hiện tại:</strong> \${workspace.member_cnt}</p>
                                        <p><strong>VIP kết thúc:</strong> \${new Date(workspace.team_vip_end * 1000).toLocaleDateString('vi-VN')}</p>
                                        <p><strong>Khu vực:</strong> \${workspace.region}</p>
                                    </div>
                                \`;
                            } else if (singleResult.response) {
                                // Xử lý lỗi
                                let message = '';
                                if (singleResult.response.ret === '2311' && singleResult.response.errmsg === 'ERR_REPEAT_ADD_WORKSPACE') {
                                    message = '⚠️ Bạn đã tham gia workspace này rồi!';
                                } else if (singleResult.response.ret === '2310' && singleResult.response.errmsg === 'ERR_WORKSPACE_NOT_EXIST') {
                                    message = '❌ Workspace không tồn tại!';
                                } else if (singleResult.response.ret === '2312' && singleResult.response.errmsg === 'ERR_WORKSPACE_FULL') {
                                    message = '❌ Workspace đã đầy!';
                                } else if (singleResult.response.ret === '2313' && singleResult.response.errmsg === 'ERR_INVITE_LINK_EXPIRED') {
                                    message = '❌ Link mời đã hết hạn!';
                                } else {
                                    message = \`❌ Lỗi: \${singleResult.response.errmsg || 'Không xác định'}\`;
                                }
                                
                                resultHtml += \`
                                    <div class="error-info">
                                        <h4>\${message}</h4>
                                    </div>
                                \`;
                            }
                        } else {
                            resultHtml += \`
                                <h3>❌ Thất bại!</h3>
                                <p><strong>Email:</strong> \${singleResult.email}</p>
                                <p><strong>Lỗi:</strong> \${singleResult.error}</p>
                            \`;
                        }
                    }
                    
                    result.innerHTML = resultHtml;
                } else {
                    result.className = 'result error';
                    result.innerHTML = \`
                        <h3>❌ Lỗi!</h3>
                        <p>\${data.error}</p>
                    \`;
                }
                
                result.style.display = 'block';
                
            } catch (error) {
                result.className = 'result error';
                result.innerHTML = \`
                    <h3>❌ Lỗi!</h3>
                    <p>\${error.message}</p>
                \`;
                result.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                loading.style.display = 'none';
            }
        });
    </script>
</body>
</html>
  `);
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
