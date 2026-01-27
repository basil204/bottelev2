import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET() {
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM products ORDER BY id DESC');
        return NextResponse.json(rows);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, price, description, type } = body;

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO products (name, price, description, type) VALUES (?, ?, ?, ?)',
            [name, price, description, type || 'stock']
        );

        return NextResponse.json({ id: result.insertId, message: 'Product created' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, name, price, description, type } = body;

        await pool.query(
            'UPDATE products SET name = ?, price = ?, description = ?, type = ? WHERE id = ?',
            [name, price, description, type, id]
        );

        return NextResponse.json({ message: 'Product updated' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await pool.query('DELETE FROM products WHERE id = ?', [id]);

        return NextResponse.json({ message: 'Product deleted' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
