import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM deposit_promotions ORDER BY created_at DESC');
        return NextResponse.json(rows);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { start_time, end_time, bonus_percentage, min_amount } = body;

        if (!start_time || !end_time || !bonus_percentage || min_amount === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate dates
        const startDate = new Date(start_time);
        const endDate = new Date(end_time);

        if (startDate >= endDate) {
            return NextResponse.json({ error: 'Start time must be before end time' }, { status: 400 });
        }

        /* 
           The app usually sends local time (e.g. Asia/Ho_Chi_Minh). 
           However, the Node.js/MySQL driver might treat strings as UTC or Local depending on config.
           The bot code converts input to UTC string manually.
           Here, we'll assume the client sends ISO strings or valid date strings.
           We'll store them directly if they are in correct format "YYYY-MM-DD HH:mm:ss" or compatible.
           Ideally, we pass them as is if they are ISO8601, MySQL will handle DATETIME.
        */

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO deposit_promotions (start_time, end_time, bonus_percentage, min_amount, status) VALUES (?, ?, ?, ?, "active")',
            [start_time, end_time, bonus_percentage, min_amount]
        );

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }

        await pool.query('DELETE FROM deposit_promotions WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
