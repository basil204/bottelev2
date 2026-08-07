import { NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegramMiniApp';

const upstreamBase = (process.env.CAPCUT_API_BASE || 'https://tienich.manhit.dev').replace(/\/$/, '');
const endpoints = {
  login: '/api/v1/login',
  join: '/api/v1/join',
  batch: '/api/web/batch-join',
  invite: '/api/web/invite-members',
} as const;

export async function POST(request: Request) {
  try {
    const { initData, action, apiKey, payload } = await request.json();
    const user = verifyTelegramInitData(String(initData || ''));
    if (!(action in endpoints) || !payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Yêu cầu không hợp lệ' }, { status: 400 });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (action === 'join') {
      if (!apiKey) return NextResponse.json({ error: 'Thiếu API key' }, { status: 400 });
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(`${upstreamBase}${endpoints[action as keyof typeof endpoints]}`, {
        method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal, cache: 'no-store'
      });
      const data = await response.json().catch(() => ({ error: 'API CapCut trả về dữ liệu không hợp lệ' }));
      console.info(`[CAPCUT_MINIAPP] telegram=${user.id} action=${action} status=${response.status}`);
      return NextResponse.json(data, { status: response.status });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Phiên Telegram không hợp lệ hoặc đã hết hạn' }, { status: 401 });
    }
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'API CapCut phản hồi quá lâu' : 'Không thể kết nối API CapCut';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
