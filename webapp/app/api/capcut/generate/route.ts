import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function encryptToTargetHex(input: string): string {
  let hexResult = '';
  for (const char of input) {
    const encryptedCharCode = char.charCodeAt(0) ^ 0x05;
    hexResult += encryptedCharCode.toString(16).padStart(2, '0');
  }
  return hexResult;
}

// API LienManhGroup Temp Mail
async function generateTempEmail(username: string, domain: string): Promise<string> {
  try {
    const url = `https://lienmanhgroup.io.vn/generate?username=${encodeURIComponent(username)}&domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    if (data && data.email) {
      return data.email;
    }
    return `${username}@${domain}`;
  } catch (err: any) {
    console.error('[CAPCUT_GEN] Error generating temp email:', err?.message);
    return `${username}@${domain}`;
  }
}

async function getTempMailCode(email: string): Promise<string | null> {
  try {
    const res = await fetch(`https://lienmanhgroup.io.vn/inbox/${encodeURIComponent(email)}`, { cache: 'no-store' });
    const data = await res.json();
    const mails = data.mails || data.messages || (Array.isArray(data) ? data : []);

    if (Array.isArray(mails) && mails.length > 0) {
      for (const msg of mails) {
        // Check in subject / preview / text / body / html
        const textToSearch = `${msg.subject || ''} ${msg.preview || ''} ${msg.text || ''} ${msg.body || ''} ${msg.html || ''}`;
        let match = textToSearch.match(/\b\d{6}\b/);
        if (match) {
          return match[0];
        }

        // Check message detail via /mail/:id
        if (msg.id) {
          try {
            const detailRes = await fetch(`https://lienmanhgroup.io.vn/mail/${msg.id}`, { cache: 'no-store' });
            const detailData = await detailRes.json();
            const detailText = typeof detailData === 'string'
              ? detailData
              : `${detailData.subject || ''} ${detailData.text || ''} ${detailData.body || ''} ${detailData.html || ''}`;

            match = detailText.match(/\b\d{6}\b/);
            if (match) {
              return match[0];
            }

            // Check message HTML via /mail/:id/html
            const htmlRes = await fetch(`https://lienmanhgroup.io.vn/mail/${msg.id}/html`, { cache: 'no-store' });
            const htmlText = await htmlRes.text();
            match = htmlText.match(/\b\d{6}\b/);
            if (match) {
              return match[0];
            }
          } catch (e) {
            // ignore detail fetch error
          }
        }
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function regist_sendRequest(encryptedEmail: string, encryptedPassword: string) {
  try {
    const url = new URL('https://www.capcut.com/passport/web/email/send_code/');
    const queryParams = {
      aid: '348188',
      account_sdk_source: 'web',
      language: 'en',
      verifyFp: 'verify_m7euzwhw_PNtb4tlY_I0az_4me0_9Hrt_sEBZgW5GGPdn',
      check_region: '1'
    };

    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const formData = new URLSearchParams();
    formData.append('mix_mode', '1');
    formData.append('email', encryptedEmail);
    formData.append('password', encryptedPassword);
    formData.append('type', '34');
    formData.append('fixed_mix_mode', '1');

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: formData
    });
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[CAPCUT_GEN] Error send_code:', error?.message);
    return null;
  }
}

async function verify_sendRequest(encryptedEmail: string, encryptedPassword: string, encryptedCode: string) {
  try {
    const startYear = 1992;
    const endYear = 2004;
    const year = Math.floor(Math.random() * (endYear - startYear + 1)) + startYear;
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    const url = new URL('https://www.capcut.com/passport/web/email/register_verify_login/');
    const queryParams = {
      aid: '348188',
      account_sdk_source: 'web',
      language: 'en',
      verifyFp: 'verify_m7euzwhw_PNtb4tlY_I0az_4me0_9Hrt_sEBZgW5GGPdn',
      check_region: '1'
    };

    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const formData = new URLSearchParams();
    formData.append('mix_mode', '1');
    formData.append('email', encryptedEmail);
    formData.append('code', encryptedCode);
    formData.append('password', encryptedPassword);
    formData.append('type', '34');
    formData.append('birthday', formattedDate);
    formData.append('force_user_region', 'ID');
    formData.append('biz_param', '%7B%7D');
    formData.append('check_region', '1');
    formData.append('fixed_mix_mode', '1');

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: formData
    });
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('[CAPCUT_GEN] Error register_verify_login:', error?.message);
    return null;
  }
}

function generateRandomPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
  let pass = 'CapCut@';
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const count = Math.min(Math.max(Number(body.count) || 1, 1), 50);
    const domain = body.domain?.trim() || 'capcut.lienmanhgroup.io.vn';
    const customPassword = body.password?.trim() || '';
    const saveToStorage = Boolean(body.saveToStorage);
    const accountTypeId = Number(body.accountTypeId) || null;

    const results: Array<{
      index: number;
      email: string;
      password: string;
      userId?: string;
      code?: string;
      status: 'success' | 'failed' | 'timeout';
      message?: string;
      savedToDb?: boolean;
    }> = [];

    for (let i = 1; i <= count; i++) {
      const username = 'cc' + Math.random().toString(36).substring(2, 8) + Math.floor(Math.random() * 1000);
      const email = await generateTempEmail(username, domain);
      const password = customPassword || generateRandomPassword();

      const encryptedHexEmail = encryptToTargetHex(email);
      const encryptedHexPassword = encryptToTargetHex(password);

      const regReq = await regist_sendRequest(encryptedHexEmail, encryptedHexPassword);

      if (!regReq || regReq.message !== 'success') {
        results.push({
          index: i,
          email,
          password,
          status: 'failed',
          message: regReq?.message || 'Lỗi gửi yêu cầu tạo tài khoản CapCut'
        });
        continue;
      }

      // Poll for verification code max 30 retries (approx 120s max)
      let verificationCode: string | null = null;
      let retries = 0;
      const maxRetries = 24; // 24 * 4s = ~96s

      while (!verificationCode && retries < maxRetries) {
        await new Promise(r => setTimeout(r, 4000));
        verificationCode = await getTempMailCode(email);
        retries++;
      }

      if (!verificationCode) {
        results.push({
          index: i,
          email,
          password,
          status: 'timeout',
          message: 'Quá thời gian chờ mã OTP từ mail tạm'
        });
        continue;
      }

      const encryptedHexCode = encryptToTargetHex(verificationCode);
      const verifyRes = await verify_sendRequest(encryptedHexEmail, encryptedHexPassword, encryptedHexCode);

      if (verifyRes && verifyRes.message === 'success') {
        let savedToDb = false;
        const userId = String(verifyRes?.data?.user_id_str || verifyRes?.data?.user_id || verifyRes?.data?.uid || '');

        // Auto save to stored_accounts table if requested and accountTypeId provided
        if (saveToStorage && accountTypeId) {
          try {
            const accountDataStr = userId ? `${email}|${password}|${userId}` : `${email}|${password}`;
            await pool.query(
              "INSERT INTO stored_accounts (account_type_id, data, sale_status, note) VALUES (?, ?, 'in_stock', ?)",
              [accountTypeId, accountDataStr, userId ? `CapCut UID: ${userId}` : 'CapCut Auto Generated']
            );
            savedToDb = true;
          } catch (dbErr: any) {
            console.error('[CAPCUT_GEN] Error saving to stored_accounts:', dbErr?.message);
          }
        }

        results.push({
          index: i,
          email,
          password,
          userId,
          code: verificationCode,
          status: 'success',
          message: 'Tạo tài khoản thành công',
          savedToDb
        });
      } else {
        results.push({
          index: i,
          email,
          password,
          code: verificationCode,
          status: 'failed',
          message: verifyRes?.message || 'Lỗi xác minh mã OTP CapCut'
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: count,
      successCount: results.filter(r => r.status === 'success').length,
      data: results
    });

  } catch (error: any) {
    console.error('[CAPCUT_GEN] API Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
