import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');

        if (!productId) {
            return NextResponse.json({ error: 'Missing productId' }, { status: 400 });
        }

        const [accounts] = await pool.query<RowDataPacket[]>(
            'SELECT id, username, password, status FROM accounts WHERE product_id = ? ORDER BY id DESC',
            [productId]
        );

        return NextResponse.json({ accounts });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId, data } = body; // data: string "user|pass\nuser2|pass2"

        if (!productId || !data) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const lines = data.split('\n').filter((line: string) => line.trim().length > 0);
        const addedAccounts = [];

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const line of lines) {
                const parts = line.split('|').map((s: string) => s.trim());
                let username, password, twofa, extra_data;

                // 1 part: key
                if (parts.length === 1) {
                    username = parts[0];
                    password = parts[0];
                }
                // 2 parts: user|pass
                else if (parts.length === 2) {
                    username = parts[0];
                    password = parts[1];
                }
                // 3 parts: user|pass|twofa OR user|pass|extra
                else if (parts.length === 3) {
                    username = parts[0];
                    password = parts[1];
                    const part3 = parts[2];
                    if (part3.includes('@')) {
                        extra_data = part3;
                    } else {
                        twofa = part3;
                    }
                }
                // 4 parts: user|pass|extra|twofa
                else if (parts.length >= 4) {
                    username = parts[0];
                    password = parts[1];
                    extra_data = parts[2];
                    twofa = parts[3];
                }

                if (username && password) {
                    await connection.query(
                        'INSERT INTO accounts (product_id, username, password, twofa, extra_data, status) VALUES (?, ?, ?, ?, ?, "available")',
                        [productId, username, password, twofa || null, extra_data || null]
                    );
                    addedAccounts.push(username);
                }
            }

            // Update product stock
            const [stockResult] = await connection.query<RowDataPacket[]>(
                'SELECT COUNT(*) as cnt FROM accounts WHERE product_id = ? AND status = "available"',
                [productId]
            );
            const totalStock = stockResult[0]?.cnt || 0;

            await connection.query(
                'UPDATE products SET stock = ? WHERE id = ?',
                [totalStock, productId]
            );

            await connection.commit();
            return NextResponse.json({ success: true, count: addedAccounts.length, totalStock });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
