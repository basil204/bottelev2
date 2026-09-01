import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromCookie } from '@/lib/adminLog';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';

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

    const raw = proxy.trim();
    let proxyUrl = raw;

    // Handle host:port:user:pass or user:pass@host:port or host:port
    if (!raw.includes('://')) {
      const parts = raw.split(':');
      if (parts.length === 4) {
        const [host, port, user, pass] = parts;
        proxyUrl = `http://${user}:${pass}@${host}:${port}`;
      } else if (parts.length === 2) {
        const [host, port] = parts;
        proxyUrl = `http://${host}:${port}`;
      } else if (raw.includes('@')) {
        proxyUrl = `http://${raw}`;
      } else {
        proxyUrl = `http://${raw}`;
      }
    }

    const startTime = Date.now();
    const httpsAgent = new HttpsProxyAgent(proxyUrl);

    const response = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent,
      httpAgent: httpsAgent,
      timeout: 10000
    });

    const latency = Date.now() - startTime;
    const ip = response.data?.ip || 'OK';

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
