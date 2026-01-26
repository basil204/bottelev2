
import { NextResponse } from 'next/server';
import { timoService } from '@/lib/timoService';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const otp = searchParams.get('otp');
        const action = searchParams.get('action');

        if (action === 'history') {
            const result = await timoService.getHistory();
            return NextResponse.json(result);
        }

        // Default: Check status / Trigger Login
        // If otp param provided (via GET? better POST but existing logic used GET)

        const result = await timoService.login();
        return NextResponse.json(result);
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (body.otp) {
            const result = await timoService.login(body.otp);
            return NextResponse.json(result);
        }

        return NextResponse.json({ success: false, error: 'Invalid Request' });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
