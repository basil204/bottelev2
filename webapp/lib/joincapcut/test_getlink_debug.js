import fetch from 'node-fetch';
import { CookieJar } from 'tough-cookie';
import fetchCookie from 'fetch-cookie';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const AID = '348188';

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

function encryptToHex(str) {
  let hex = '';
  for (const ch of str) hex += (ch.charCodeAt(0) ^ 0x05).toString(16).padStart(2, '0');
  return hex;
}

async function testWithToughCookie() {
  const email = 'MissouriFaltin86943@outlook.com';
  const pass = 'a123456';

  console.log(`🔐 Logging in ${email} using tough-cookie...`);
  const jar = new CookieJar();
  const _fetch = fetchCookie(fetch, jar);

  // 1. Seed home
  await _fetch('https://www.capcut.com/', { headers: { 'user-agent': UA } });

  // 2. Login
  const capcutCookie = await getCookieStringFor(jar, 'https://www.capcut.com');
  const csrf = (capcutCookie.match(/passport_csrf_token=([^;]+)/) || [])[1] || '';

  const loginUrl = `https://www.capcut.com/passport/web/email/login/?aid=${AID}&account_sdk_source=web&sdk_version=2.1.10-tiktok&language=vi-VN&verifyFp=verify_men0a4cg_yEfkzeLx_7hft_4fKX_8ENt_fYQ6wdT6OUFB`;
  const body = new URLSearchParams({ mix_mode: '1', email: encryptToHex(email), password: encryptToHex(pass), fixed_mix_mode: '1' });
  
  const loginRes = await _fetch(loginUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': UA,
      'origin': 'https://www.capcut.com',
      'referer': 'https://www.capcut.com/',
      'store-country-code': 'vn',
      ...(csrf ? { 'x-tt-passport-csrf-token': csrf } : {})
    },
    body
  });

  const loginData = await loginRes.json();
  console.log('Login result:', loginData.message);

  const fullCookieStr = await mergedCookieFor(jar, ['https://www.capcut.com', 'https://commerce-api-sg.capcut.com']);
  console.log(`🍪 Full merged cookie length: ${fullCookieStr.length}`);

  // 3. Call get_user_workspaces
  console.log('\n🏢 Calling get_user_workspaces...');
  const wsRes = await fetch('https://edit-api-sg.capcut.com/cc/v1/workspace/get_user_workspaces', {
    method: 'POST',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'user-agent': UA,
      'cookie': fullCookieStr,
      'appid': AID,
      'appvr': '5.8.0',
      'device-time': '1758940192',
      'did': '7554588671887394305',
      'lan': 'vi-VN',
      'loc': 'sg',
      'pf': '7',
      'sign': '1f90ee625a9c4c8dc7f8ea2f1f7483cb',
      'sign-ver': '1',
      'store-country-code': 'vn',
      'Referer': 'https://www.capcut.com/'
    },
    body: JSON.stringify({ cursor: '0', count: 100, need_convert_workspace: true })
  });

  const wsData = await wsRes.json();
  console.log('Get Workspaces Raw Result:', JSON.stringify(wsData, null, 2));

  const list = wsData?.data?.workspace_infos || wsData?.data?.workspaces || [];
  console.log(`Found ${list.length} workspace(s).`);

  for (const ws of list) {
    const wsId = String(ws.workspace_id || ws.id);
    console.log(`\n🔍 Workspace ID: ${wsId}`);

    // Call get_invitation_link
    console.log('🔗 Calling get_invitation_link...');
    const linkRes = await fetch('https://edit-api-sg.capcut.com/cc/v1/workspace/get_invitation_link', {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'user-agent': UA,
        'cookie': fullCookieStr,
        'appid': AID,
        'appvr': '5.8.0',
        'device-time': '1759304283',
        'did': '7553826660933699073',
        'lan': 'en',
        'loc': 'sg',
        'pf': '7',
        'sign': '7f9daa202995b37f1de8064fb3d8e26e',
        'sign-ver': '1',
        'store-country-code': 'vn',
        'Referer': 'https://www.capcut.com/'
      },
      body: JSON.stringify({ workspace_id: wsId })
    });

    const linkData = await linkRes.json();
    console.log('Get Invitation Link Raw Result:', JSON.stringify(linkData, null, 2));
  }
}

testWithToughCookie().catch(console.error);
