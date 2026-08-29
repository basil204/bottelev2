// Free Proxy Scraper - Lấy proxy free từ fineproxy.org
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

export async function scrapeFreeProxies() {
  try {
    console.log("🔍 Đang lấy proxy free từ fineproxy.org...");
    
    const response = await fetch('https://fineproxy.org/free-proxies/asia/vietnam/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const proxies = [];
    
    // Tìm bảng proxy
    const tables = document.querySelectorAll('table');
    
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      
      for (let i = 1; i < rows.length; i++) { // Bỏ qua header row
        const cells = rows[i].querySelectorAll('td');
        
        if (cells.length >= 2) {
          const ip = cells[0]?.textContent?.trim();
          const port = cells[1]?.textContent?.trim();
          
          if (ip && port && isValidIP(ip) && isValidPort(port)) {
            proxies.push({
              ip: ip,
              port: port,
              type: 'HTTP', // Mặc định HTTP
              country: 'Vietnam',
              source: 'fineproxy.org'
            });
          }
        }
      }
    }
    
    console.log(`✅ Tìm thấy ${proxies.length} proxy từ fineproxy.org`);
    return proxies;
    
  } catch (error) {
    console.error("❌ Lỗi khi lấy proxy free:", error.message);
    return [];
  }
}

function isValidIP(ip) {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
}

function isValidPort(port) {
  const portNum = parseInt(port);
  return portNum >= 1 && portNum <= 65535;
}

export async function getRandomFreeProxies(count = 10) {
  const allProxies = await scrapeFreeProxies();
  
  if (allProxies.length === 0) {
    return [];
  }
  
  // Shuffle và lấy random
  const shuffled = allProxies.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, allProxies.length));
}
