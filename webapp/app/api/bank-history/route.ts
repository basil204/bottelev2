import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
    try {
        // Get Viettel token from settings
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT `value` FROM settings WHERE `key` = 'viettel_token'"
        );

        if (!rows || rows.length === 0 || !rows[0].value) {
            return NextResponse.json({ error: 'Viettel token not configured' }, { status: 400 });
        }

        const token = rows[0].value;

        // Call Viettel API
        const response = await fetch(`https://api.sieuthicode.net/historyapiviettel/${token}`);
        const data = await response.json();

        if (!data || data.status?.code !== '00') {
            return NextResponse.json({ error: data?.status?.message || 'API Error' }, { status: 500 });
        }

        return NextResponse.json(data.data);
    } catch (error) {
        console.error('Bank History Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
