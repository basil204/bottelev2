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
                const [username, password] = line.split('|').map((s: string) => s.trim());
                if (username && password) {
                    await connection.query(
                        'INSERT INTO accounts (product_id, username, password, status) VALUES (?, ?, ?, "available")',
                        [productId, username, password]
                    );
                    addedAccounts.push(username);
                }
            }

            // Update product stock
            await connection.query(
                'UPDATE products SET stock = (SELECT COUNT(*) FROM accounts WHERE product_id = ? AND status = "available") WHERE id = ?',
                [productId, productId]
            );

            await connection.commit();
            return NextResponse.json({ success: true, count: addedAccounts.length });
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
