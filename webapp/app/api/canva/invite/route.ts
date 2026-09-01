import type { NextRequest } from 'next/server';
import pool, { dbReady } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await dbReady;
    const body = await req.json();
    const { email, role, team_id, teamId, headless } = body;

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Lấy canva_api_url & headless từ settings
    let apiUrl = 'http://localhost:1568';
    let isHeadless = true;
    try {
      const [rows] = await pool.query<any[]>(
        "SELECT `key`, `value` FROM settings WHERE `key` IN ('canva_api_url', 'canva_headless')"
      );
      rows.forEach(r => {
        if (r.key === 'canva_api_url' && r.value) apiUrl = r.value.trim();
        if (r.key === 'canva_headless' && r.value === 'false') isHeadless = false;
      });
    } catch (_) {}

    const cleanApiUrl = apiUrl.replace(/\/+$/, '');
    const apiRes = await fetch(`${cleanApiUrl}/api/canva/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        role: role || 'designer',
        headless: headless !== undefined ? headless : isHeadless,
        team_id: team_id || teamId
      }),
      signal: AbortSignal.timeout(60000)
    });

    const data = await apiRes.json();
    return new Response(JSON.stringify(data), {
      status: apiRes.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('API /api/canva/invite error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message || 'Canva API Connection Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
