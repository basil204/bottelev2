import { NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let apiKey = body.apiKey;
    let secretKey = body.secretKey;

    if (!apiKey || !secretKey) {
      // Read from settings
      const [rows] = await pool.query<any[]>(
        "SELECT `key`, `value` FROM settings WHERE `key` IN ('binance_api_key', 'binance_secret_key')"
      );
      rows.forEach(r => {
        if (r.key === 'binance_api_key' && !apiKey) apiKey = r.value;
        if (r.key === 'binance_secret_key' && !secretKey) secretKey = r.value;
      });
    }

    if (!apiKey || !secretKey) {
      return NextResponse.json({ success: false, message: 'Vui lòng nhập đầy đủ Binance API Key và Secret Key!' }, { status: 400 });
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');

    const res = await fetch(`https://api.binance.com/sapi/v1/pay/transactions?${queryString}&signature=${signature}`, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();
    if (res.ok && (data.code === '000000' || data.success === true || Array.isArray(data.data))) {
      return NextResponse.json({
        success: true,
        message: 'Kết nối Binance API thành công! Hệ thống đã sẵn sàng tự động quét giao dịch Binance Pay.'
      });
    }

    // Fallback account check
    const accQuery = `timestamp=${timestamp}`;
    const accSig = crypto.createHmac('sha256', secretKey).update(accQuery).digest('hex');
    const accRes = await fetch(`https://api.binance.com/api/v3/account?${accQuery}&signature=${accSig}`, {
      headers: { 'X-MBX-APIKEY': apiKey }
    });
    const accData = await accRes.json();

    if (accRes.ok && accData.accountType) {
      return NextResponse.json({
        success: true,
        message: `Kết nối Binance API thành công (Tài khoản ${accData.accountType})! Hãy đảm bảo API Key đã được cấp quyền đọc Binance Pay.`
      });
    }

    return NextResponse.json({
      success: false,
      message: data.msg || data.message || `Lỗi từ Binance API: HTTP ${res.status}`
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: `Lỗi kết nối: ${err.message}` }, { status: 500 });
  }
}
