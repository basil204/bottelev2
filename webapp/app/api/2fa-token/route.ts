import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Decode base32 to Buffer
function base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    const cleaned = encoded.replace(/[\s=-]+/g, '').toUpperCase();

    for (const char of cleaned) {
        const val = alphabet.indexOf(char);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }

    return Buffer.from(bytes);
}

// Generate TOTP token locally (no external API needed)
function generateTOTP(secret: string, period: number = 30, digits: number = 6): string {
    const key = base32Decode(secret);
    const time = Math.floor(Date.now() / 1000 / period);

    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(0, 0);
    timeBuffer.writeUInt32BE(time, 4);

    const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();

    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    ) % Math.pow(10, digits);

    return code.toString().padStart(digits, '0');
}

export async function GET(request: NextRequest) {
    const secret = request.nextUrl.searchParams.get('secret');

    if (!secret) {
        return NextResponse.json({ error: 'Missing secret' }, { status: 400 });
    }

    try {
        const token = generateTOTP(secret);
        const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
        return NextResponse.json({ token, remaining });
    } catch (error) {
        console.error('2FA token generation error:', error);
        return NextResponse.json({ error: 'Failed to generate 2FA token' }, { status: 500 });
    }
}
