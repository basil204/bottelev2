// Proxy Checker - Kiểm tra proxy live
import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

export async function checkProxyLive(proxyUrl, timeout = 10000) {
  try {
    // Format proxy URL
    let formattedProxyUrl = proxyUrl;
    if (proxyUrl.includes(':') && proxyUrl.split(':').length === 4) {
      const [ip, port, username, password] = proxyUrl.split(':');
      formattedProxyUrl = `http://${username}:${password}@${ip}:${port}`;
    } else if (!proxyUrl.startsWith('http://') && !proxyUrl.startsWith('https://') && !proxyUrl.startsWith('socks5://')) {
      formattedProxyUrl = `http://${proxyUrl}`;
    }
    
    const agent = new HttpsProxyAgent(formattedProxyUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch('https://httpbin.org/ip', {
      method: 'GET',
      agent: agent,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return {
        live: true,
        ip: data.origin,
        responseTime: Date.now() - Date.now(),
        proxy: proxyUrl
      };
    } else {
      return {
        live: false,
        error: `HTTP ${response.status}`,
        proxy: proxyUrl
      };
    }
  } catch (error) {
    return {
      live: false,
      error: error.message,
      proxy: proxyUrl
    };
  }
}

export async function checkMultipleProxies(proxies, maxConcurrent = 5) {
  const results = [];
  const chunks = [];
  
  // Chia proxies thành chunks để xử lý đồng thời
  for (let i = 0; i < proxies.length; i += maxConcurrent) {
    chunks.push(proxies.slice(i, i + maxConcurrent));
  }
  
  for (const chunk of chunks) {
    const promises = chunk.map(proxy => checkProxyLive(proxy));
    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
    
    // Delay giữa các chunks
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}
