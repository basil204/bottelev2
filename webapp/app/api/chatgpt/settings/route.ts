import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/chatgpt/settings
 * Lấy cài đặt giá slot
 */
export async function GET() {
    try {
        const [priceRows] = await pool.query<any[]>("SELECT `value` FROM settings WHERE `key` = 'chatgpt_slot_price'");
        const [daysRows] = await pool.query<any[]>("SELECT `value` FROM settings WHERE `key` = 'chatgpt_slot_days'");

        return NextResponse.json({
            success: true,
            settings: {
                slot_price: Number(priceRows[0]?.value) || 60000,
                slot_days: Number(daysRows[0]?.value) || 30
            }
        });
    } catch (error) {
        console.error('[ChatGPT Settings API] GET error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT /api/chatgpt/settings
 * Cập nhật cài đặt giá slot
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { slot_price, slot_days } = body;

        if (slot_price !== undefined) {
            await pool.query(
                "INSERT INTO settings (`key`, `value`) VALUES ('chatgpt_slot_price', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [String(slot_price), String(slot_price)]
            );
        }

        if (slot_days !== undefined) {
            await pool.query(
                "INSERT INTO settings (`key`, `value`) VALUES ('chatgpt_slot_days', ?) ON DUPLICATE KEY UPDATE `value` = ?",
                [String(slot_days), String(slot_days)]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[ChatGPT Settings API] PUT error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
