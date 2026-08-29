import { NextResponse } from 'next/server';
import { getAllUserWarranties } from '@/lib/capcutAutoService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const warranties = await getAllUserWarranties();
    return NextResponse.json({
      success: true,
      data: warranties
    });
  } catch (error: any) {
    console.error('[CAPCUT_WARRANTIES_GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
