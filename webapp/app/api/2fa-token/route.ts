import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const secret = request.nextUrl.searchParams.get('secret');

    if (!secret) {
        return NextResponse.json({ error: 'Missing secret' }, { status: 400 });
    }

    try {
        const res = await fetch(`https://2fa.live/tok/${secret}`, {
            headers: {
                'accept': '*/*',
                'x-requested-with': 'XMLHttpRequest',
                'Referer': 'https://2fa.live/',
            },
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('2FA token fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch 2FA token' }, { status: 500 });
    }
}
