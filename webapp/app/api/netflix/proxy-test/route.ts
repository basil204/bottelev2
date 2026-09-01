import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromCookie } from '@/lib/adminLog';
import http from 'http';
import https from 'https';

function testProxyWithNode(proxyInput: string): Promise<{ ip: string; latency: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let raw = proxyInput.trim();
    let host = '';
    let port = 8080;
    let auth = '';

    // Remove protocol prefix if exists
    if (raw.includes('://')) {
      raw = raw.split('://')[1];
    }

    if (raw.includes('@')) {
      const [authPart, hostPart] = raw.split('@');
      auth = authPart;
      const [h, p] = hostPart.split(':');
      host = h;
      port = parseInt(p, 10);
    } else {
      const parts = raw.split(':');
      if (parts.length === 4) {
        host = parts[0];
        port = parseInt(parts[1], 10);
        auth = `${parts[2]}:${parts[3]}`;
      } else if (parts.length === 2) {
        host = parts[0];
        port = parseInt(parts[1], 10);
      } else {
        return reject(new Error('Định dạng proxy không hợp lệ (hỗ trợ ip:port hoặc ip:port:user:pass)'));
      }
    }

    const headers: Record<string, string> = {
      'Host': 'api.ipify.org:443',
      'User-Agent': 'Mozilla/5.0'
    };

    if (auth) {
      headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(auth).toString('base64');
    }

    const req = http.request({
      host,
      port,
      method: 'CONNECT',
      path: 'api.ipify.org:443',
      headers,
      timeout: 10000
    });

    req.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        return reject(new Error(`Proxy CONNECT trả về HTTP ${res.statusCode}`));
      }

      const httpsReq = https.request({
        host: 'api.ipify.org',
        path: '/?format=json',
        method: 'GET',
        headers: {
          'Host': 'api.ipify.org',
          'User-Agent': 'Mozilla/5.0'
        },
        createConnection: () => socket as any,
        timeout: 10000
      }, (resp) => {
        let data = '';
        resp.on('data', chunk => { data += chunk; });
        resp.on('end', () => {
          const latency = Date.now() - startTime;
          try {
            const parsed = JSON.parse(data);
            resolve({ ip: parsed.ip || data.trim(), latency });
          } catch {
            resolve({ ip: data.trim() || 'OK', latency });
          }
        });
      });

      httpsReq.on('error', (e) => reject(e));
      httpsReq.on('timeout', () => {
        httpsReq.destroy();
        reject(new Error('Timeout khi gửi HTTPS request qua proxy (10s)'));
      });
      httpsReq.end();
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout khi kết nối Proxy (10s)'));
    });

    req.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromCookie(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { proxy } = await request.json();
    if (!proxy || typeof proxy !== 'string') {
      return NextResponse.json({ error: 'Vui lòng cung cấp chuỗi proxy' }, { status: 400 });
    }

    const { ip, latency } = await testProxyWithNode(proxy);

    return NextResponse.json({
      success: true,
      live: true,
      ip: ip,
      latency: `${latency}ms`,
      message: `Proxy hoạt động tốt! IP: ${ip} (${latency}ms)`
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      live: false,
      error: err.message || 'Không thể kết nối qua Proxy',
      message: `Proxy lỗi: ${err.message}`
    }, { status: 200 });
  }
}
