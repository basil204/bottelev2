import fetch from 'node-fetch';
import fs from 'fs';
import { HttpsProxyAgent } from 'https-proxy-agent';

// The request URL and method
const url = 'https://edit-api-sg.capcut.com/cc/v1/workspace/join_workspace_with_apply';
const method = 'POST';

// Function để tạo request body với invite link
function createRequestBody(inviteLink) {
  return {
    "join_workspace_type": 1,
    "invite_link_param": {
        "invitation_link": inviteLink
    },
    "application_param": {}
  };
}

// The request headers from the provided data
const headers = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'vi,fr-FR;q=0.9,fr;q=0.8,en-US;q=0.7,en;q=0.6,zh-TW;q=0.5,zh;q=0.4',
  'App-Sdk-Version': '48.0.0',
  'Appid': '348188',
  'Appvr': '5.8.0',
  'Cache-Control': 'no-cache',
  'Content-Length': '207',
  'Content-Type': 'application/json',
  'Device-Time': '1758369405',
  'Did': '7543172286023616001',
  'Lan': 'vi-VN',
  'Loc': 'sg',
  'Origin': 'https://www.capcut.com',
  'Pf': '7',
  'Pragma': 'no-cache',
  'Priority': 'u=1, i',
  'Referer': 'https://www.capcut.com/',
  'Sec-Ch-Ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  'Sign': 'e7bd21718975d3e29df1f2b743ad39a9',
  'Sign-Ver': '1',
  'Store-Country-Code': 'vn',
  'Store-Country-Code-Src': 'uid',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

// Asynchronous function to make the request
async function joinWorkspace(cookieHeader, inviteLink , proxyUrl) {
  try {
    if (!cookieHeader) {
      console.error('Cookie header không được cung cấp');
      return;
    }

    // Tạo request body với invite link
    const requestBody = createRequestBody(inviteLink);

    // Cập nhật headers với cookie thực tế
    const updatedHeaders = {
      ...headers,
      'Cookie': cookieHeader
    };

    // Tạo fetch options với proxy nếu có
    const fetchOptions = {
      method: method,
      headers: updatedHeaders,
      body: JSON.stringify(requestBody)
    };
    
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

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Request successful!');
    console.log('Response data:', data);
    
    // Log chi tiết thông tin workspace
    if (data.data && data.data.workspace_info) {
      const workspace = data.data.workspace_info;
      console.log('=== Workspace Info ===');
      console.log('Name:', workspace.name);
      console.log('Role:', workspace.role);
      console.log('Caller nickname:', workspace.caller_nickname);
      console.log('Member limit:', workspace.member_limit);
      console.log('Member count:', workspace.member_cnt);
      console.log('VIP end:', new Date(workspace.team_vip_end * 1000).toLocaleDateString('vi-VN'));
      console.log('Region:', workspace.region);
      console.log('====================');
    }
    
    return data;

  } catch (error) {
    console.error('Request failed:', error.message);
    throw error;
  }
}

// Export function để web_app có thể sử dụng
export { joinWorkspace };

// Nếu chạy trực tiếp file này, cần cookie header
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Vui lòng cung cấp cookie header khi chạy file này');
  console.log('Ví dụ: import { joinWorkspace } from "./join.js"');
  console.log('       await joinWorkspace(cookieHeader)');
}