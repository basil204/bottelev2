// CapCut Link Converter
// Chuyển đổi link từ sv2 format sang team-invite format

import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/**
 * Chuyển đổi link CapCut từ sv2 format sang team-invite format
 * @param {string} sv2Link - Link dạng https://www.capcut.com/sv2/...
 * @param {string} proxyUrl - Proxy URL (optional)
 * @returns {Promise<string>} - Link team-invite format
 */
async function convertCapCutLink(sv2Link, proxyUrl = null) {
  try {
    console.log(`🔄 Đang chuyển đổi link: ${sv2Link}`);
    
    // Tạo fetch options với proxy nếu có
    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
      redirect: 'follow'
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

    // Gửi request để lấy redirect URL
    const response = await fetch(sv2Link, fetchOptions);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Lấy final URL sau khi redirect
    const finalUrl = response.url;
    console.log(`📍 Final URL: ${finalUrl}`);
    
    // Kiểm tra xem có phải team-invite link không
    if (finalUrl.includes('/team-invite/')) {
      console.log('✅ Đã chuyển đổi thành công!');
      return finalUrl;
    } else {
      // Nếu không phải team-invite, thử extract từ response body
      const html = await response.text();
      const teamInviteMatch = html.match(/https:\/\/www\.capcut\.com\/team-invite\/[^"'\s]+/);
      
      if (teamInviteMatch) {
        const teamInviteLink = teamInviteMatch[0];
        console.log('✅ Tìm thấy team-invite link trong HTML!');
        return teamInviteLink;
      } else {
        throw new Error('Không thể tìm thấy team-invite link');
      }
    }
    
  } catch (error) {
    console.error('❌ Lỗi khi chuyển đổi link:', error.message);
    throw error;
  }
}

/**
 * Batch convert nhiều links
 * @param {string[]} sv2Links - Array các sv2 links
 * @param {string} proxyUrl - Proxy URL (optional)
 * @returns {Promise<Object>} - Object chứa kết quả convert
 */
async function batchConvertLinks(sv2Links, proxyUrl = null) {
  const results = {};
  
  for (let i = 0; i < sv2Links.length; i++) {
    const sv2Link = sv2Links[i];
    try {
      console.log(`\n[${i + 1}/${sv2Links.length}] Đang xử lý: ${sv2Link}`);
      const teamInviteLink = await convertCapCutLink(sv2Link, proxyUrl);
      results[sv2Link] = {
        success: true,
        teamInviteLink: teamInviteLink
      };
    } catch (error) {
      results[sv2Link] = {
        success: false,
        error: error.message
      };
    }
    
    // Delay giữa các requests để tránh rate limit
    if (i < sv2Links.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// CLI usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🚀 CapCut Link Converter

Usage:
  node link_converter.js <sv2_link> [proxy_url]
  node link_converter.js --batch <file_path> [proxy_url]

Examples:
  node link_converter.js "https://www.capcut.com/sv2/ZSHnWvTee1wJJ-7e2fO/"
  node link_converter.js "https://www.capcut.com/sv2/ZSHnWvTee1wJJ-7e2fO/" "34.174.140.188:26413:k4MkehQZSj:gmbz3FLX8e"
  node link_converter.js --batch links.txt "34.174.140.188:26413:k4MkehQZSj:gmbz3FLX8e"

File format (for batch):
  https://www.capcut.com/sv2/link1
  https://www.capcut.com/sv2/link2
  https://www.capcut.com/sv2/link3
    `);
    return;
  }
  
  if (args[0] === '--batch') {
    // Batch mode
    const filePath = args[1];
    const proxyUrl = args[2];
    
    try {
      const fs = await import('fs');
      const content = fs.readFileSync(filePath, 'utf8');
      const sv2Links = content.split('\n').filter(line => line.trim() && line.includes('capcut.com/sv2/'));
      
      console.log(`📁 Đọc được ${sv2Links.length} links từ file: ${filePath}`);
      
      const results = await batchConvertLinks(sv2Links, proxyUrl);
      
      console.log('\n📊 Kết quả:');
      console.log('='.repeat(50));
      
      for (const [sv2Link, result] of Object.entries(results)) {
        if (result.success) {
          console.log(`✅ ${sv2Link}`);
          console.log(`   → ${result.teamInviteLink}`);
        } else {
          console.log(`❌ ${sv2Link}`);
          console.log(`   Error: ${result.error}`);
        }
        console.log('');
      }
      
    } catch (error) {
      console.error('❌ Lỗi khi đọc file:', error.message);
    }
  } else {
    // Single link mode
    const sv2Link = args[0];
    const proxyUrl = args[1];
    
    try {
      const teamInviteLink = await convertCapCutLink(sv2Link, proxyUrl);
      console.log(`\n🎉 Kết quả:`);
      console.log(`📥 Input:  ${sv2Link}`);
      console.log(`📤 Output: ${teamInviteLink}`);
    } catch (error) {
      console.error('❌ Lỗi:', error.message);
      process.exit(1);
    }
  }
}

// Export functions
export { convertCapCutLink, batchConvertLinks };

// Chạy CLI nếu file được execute trực tiếp
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
