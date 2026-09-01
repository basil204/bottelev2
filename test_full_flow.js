const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// ==========================================
// 1. CẤU HÌNH PROXY & TÀI KHOẢN
// ==========================================
const PROXY_CONFIG = {
    host: 'snvn6.tunproxy.com',
    port: '30242',
    user: 'yD3b8w',
    pass: 'MD325VxB'
};

const proxyUrl = `http://${PROXY_CONFIG.user}:${PROXY_CONFIG.pass}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
const agent = new HttpsProxyAgent(proxyUrl);

const AID = '348188';
const SDK_VERSION = '2.1.10-tiktok';
const LANGUAGE = 'vi-VN';
const VERIFY_FP = 'verify_men0a4cg_yEfkzeLx_7hft_4fKX_8ENt_fYQ6wdT6OUFB';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// Hàm mã hóa XOR 0x05 mật khẩu/email của CapCut
function encryptToHex(str) {
    let hex = '';
    for (const ch of str) {
        const enc = ch.charCodeAt(0) ^ 0x05;
        hex += enc.toString(16).padStart(2, '0');
    }
    return hex;
}

// Hàm gộp Cookie từ Set-Cookie headers
function parseSetCookies(setCookieHeaders, currentCookieStr = '') {
    const cookieMap = new Map();
    if (currentCookieStr) {
        currentCookieStr.split(';').forEach(pair => {
            const parts = pair.split('=');
            if (parts.length >= 2) {
                cookieMap.set(parts[0].trim(), parts.slice(1).join('=').trim());
            }
        });
    }
    if (setCookieHeaders && Array.isArray(setCookieHeaders)) {
        setCookieHeaders.forEach(header => {
            const cookiePart = header.split(';')[0];
            const parts = cookiePart.split('=');
            if (parts.length >= 2) {
                cookieMap.set(parts[0].trim(), parts.slice(1).join('=').trim());
            }
        });
    }
    return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ==========================================
// 2. BƯỚC 1: ĐĂNG NHẬP LẤY COOKIE TỰ ĐỘNG
// ==========================================
async function loginCapCut(email, password) {
    console.log(`\n========================================`);
    console.log(`🔑 BƯỚC 1: ĐĂNG NHẬP LẤY COOKIE (Qua Proxy)`);
    console.log(`👤 Email: ${email}`);
    console.log(`========================================`);

    // 1.1 Lấy Seed Cookie & CSRF Token ban đầu
    const seedRes = await axios.get('https://www.capcut.com/', {
        headers: { 'user-agent': UA },
        httpsAgent: agent,
        httpAgent: agent
    });

    let cookieStr = parseSetCookies(seedRes.headers['set-cookie'], '');
    const csrfMatch = cookieStr.match(/passport_csrf_token=([^;]+)/) || cookieStr.match(/passport_csrf_token_default=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    // 1.2 Gửi Request Đăng Nhập
    const loginUrl = `https://www.capcut.com/passport/web/email/login/?aid=${AID}&account_sdk_source=web&sdk_version=${encodeURIComponent(SDK_VERSION)}&language=${encodeURIComponent(LANGUAGE)}&verifyFp=${encodeURIComponent(VERIFY_FP)}`;

    const params = new URLSearchParams();
    params.append('mix_mode', '1');
    params.append('email', encryptToHex(email));
    params.append('password', encryptToHex(password));
    params.append('fixed_mix_mode', '1');

    const headers = {
        'content-type': 'application/x-www-form-urlencoded',
        'accept': 'application/json, text/javascript',
        'origin': 'https://www.capcut.com',
        'referer': 'https://www.capcut.com/',
        'user-agent': UA,
        'store-country-code': 'vn',
        'store-country-code-src': 'uid',
        'cookie': cookieStr
    };
    if (csrfToken) headers['x-tt-passport-csrf-token'] = csrfToken;

    const loginRes = await axios.post(loginUrl, params.toString(), {
        headers,
        httpsAgent: agent,
        httpAgent: agent
    });

    cookieStr = parseSetCookies(loginRes.headers['set-cookie'], cookieStr);

    if (!loginRes.data?.message?.toLowerCase().includes('success')) {
        throw new Error(`Đăng nhập thất bại: ${loginRes.data?.description || loginRes.data?.message || 'Unkown error'}`);
    }

    console.log(`✅ Đăng nhập thành công! User ID: ${loginRes.data?.data?.user_id_str || loginRes.data?.data?.user_id}`);
    console.log(`🍪 Chuỗi Cookie thu được (đã cập nhật sessionid & sid_tt)`);
    return cookieStr;
}

// ==========================================
// 3. THỰC THI TOÀN BỘ TIẾN TRÌNH
// ==========================================
async function main() {
    // Nhận Email & Mật khẩu từ Command Line hoặc dùng mặc định bên dưới
    const email = process.argv[2] || 'your_email@gmail.com';
    const password = process.argv[3] || 'your_password';

    try {
        // 1. Đăng nhập để lấy Cookie hợp lệ
        const cookieStr = await loginCapCut(email, password);

        const nowSec = Math.floor(Date.now() / 1000);
        const commonHeaders = {
            "accept": "application/json, text/plain, */*",
            "accept-language": "en-US,en;q=0.9",
            "appid": AID,
            "appvr": "12.4.0",
            "content-type": "application/json",
            "device-time": nowSec.toString(),
            "did": "7679797942002533909",
            "lan": "en",
            "loc": "VN",
            "pf": "7",
            "sec-ch-ua": '"Chromium";v="143", "Not A(Brand";v="24"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "sign-ver": "1",
            "store-country-code": "vn",
            "store-country-code-src": "uid",
            "tdid": "",
            "web_id": "7679797942002533909",
            "Referer": "https://www.capcut.com/",
            "cookie": cookieStr
        };

        // 2. BƯỚC 2: Gọi API user_credit
        console.log(`\n========================================`);
        console.log(`💳 BƯỚC 2: LẤY USER CREDIT`);
        console.log(`========================================`);
        const creditRes = await axios({
            method: 'post',
            url: 'https://commerce-api-sg.capcut.com/commerce/v1/benefits/user_credit',
            headers: {
                ...commonHeaders,
                "sign": "6323b5fedd50ed2b48acbcaba8777e81"
            },
            data: {},
            httpsAgent: agent,
            httpAgent: agent
        });
        console.log('Response Credit:', creditRes.data);

        // 3. BƯỚC 3: Gọi API init_trade để tạo Cashier Link
        console.log(`\n========================================`);
        console.log(`🛒 BƯỚC 3: KHỞI TẠO ĐƠN HÀNG (INIT TRADE)`);
        console.log(`========================================`);
        const tradeUrl = "https://commerce-api-sg.capcut.com/commerce/v3/trade/init_trade?msToken=R-CjumMlpd2QAoCqSJuJaIz3vEAnWXg5Pe7rTznGFmbwuYgX5EQL09wlV0qrIT0_6CoFd7_sfDGWpitJBjzOSp4IxSANVrC_R8G2aGeFL3QJTHC56c9rWMxDRtVnajrRmLI1QUVrSHoCCzjnI_M76Zdd&X-Bogus=DFSzswjLDyNWWv47CwpjscVRr3NK&X-Gnarly=M8Xqcca2289wbliJXYJx5lBFgQjK3d9guk3uwqZ4qNIyIf-oUo9NB9cbtK1gUO93PlZGbS3JSXa7pNmymEgn564KwvkUYtxl/WxmZpn1yGHsMnsCIxpQSLnswxBNq9ydiAZRD0ssX4n66wLnv8c0VeELMh0uRRqGaBldrr14YIQzZCUYl1ZJ3uLPLiXJ/RF/ozb0EvoDRnE37s-BDecfVv4vBsO0Mke8ylFwGCdxsR63R6Iwan4j35NyVXPWcPcIb1r-4p8TQKMZmo-1fKyGquQuUc0EFcgYQib7QnlXQW1XR-wRbtVj9a-gDG0UUsv2ghRcfFgOLzv=";

        const nowMs = Date.now();
        const tradeBody = {
            "app_id": Number(AID),
            "aid": Number(AID),
            "region": "VN",
            "scene": "vip",
            "type": "vip",
            "benefit_target": {},
            "trade_type": "subscription",
            "sku_id": "SKU176641536273",
            "product_id": "capcut_pro_monthly_discount2",
            "pms_trade": JSON.stringify({
                "sku_plan_id": "1541136422660",
                "sku_plan_uniq_id": "599610158084",
                "display_price": "0",
                "currency_code": "VND"
            }),
            "pay_channel": "aggregate",
            "pipo_aggregate_info": {
                "color_theme": "light",
                "gp_unavailable": true,
                "language": "en",
                "request_id": nowMs.toString(),
                "return_url": "https://www.capcut.com/commerce/payment-result?closeImmediately=1",
                "user_create_time": Math.floor(nowMs / 1000)
            }
        };

        const tradeRes = await axios({
            method: 'post',
            url: tradeUrl,
            headers: {
                ...commonHeaders,
                "sign": "5716bdcf04bd1cb47fc439d0776e38ca"
            },
            data: tradeBody,
            httpsAgent: agent,
            httpAgent: agent
        });

        // Parse kết quả trả về để lấy cashier_url
        const resData = tradeRes.data;
        let cashierUrl = resData.data?.pipo_aggregate_pay_info?.cashier_url;

        if (!cashierUrl && resData.response) {
            try {
                const parsedResponse = JSON.parse(resData.response);
                cashierUrl = parsedResponse.pipo_aggregate_pay_info?.cashier_url;
            } catch (e) { }
        }

        console.log(`\n========================================`);
        if (cashierUrl) {
            console.log(`🔗 LINK CASHIER URL THÀNH CÔNG:`);
            console.log(cashierUrl);
        } else {
            console.log('⚠️ Không tìm thấy cashier_url, Chi tiết Response:');
            console.dir(resData, { depth: null });
        }
        console.log(`========================================\n`);

    } catch (err) {
        console.error('❌ LỖI:', err.response ? JSON.stringify(err.response.data) : err.message);
    }
}

main();
