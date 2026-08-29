import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - List all broadcast templates
export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM broadcast_templates ORDER BY created_at DESC'
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    console.error('[BROADCAST_TPL_GET_ERROR]', err?.message);
    return NextResponse.json({ success: false, error: 'Lỗi máy chủ khi lấy danh sách mẫu' }, { status: 500 });
  }
}

// POST - Save or update broadcast template
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, title, category, message, imageUrl, inlineKeyboard } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Tên mẫu thông báo là bắt buộc' }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: 'Nội dung thông báo là bắt buộc' }, { status: 400 });
    }

    const categoryVal = category || 'general';
    const jsonKeyboard = inlineKeyboard ? JSON.stringify(inlineKeyboard) : null;

    if (id) {
      // Update
      await pool.query(
        `UPDATE broadcast_templates 
         SET title = ?, category = ?, message = ?, image_url = ?, inline_keyboard = ?
         WHERE id = ?`,
        [title.trim(), categoryVal, message.trim(), imageUrl || '', jsonKeyboard, id]
      );
      return NextResponse.json({ success: true, message: 'Đã cập nhật mẫu thông báo!' });
    } else {
      // Insert
      const [res] = await pool.query<ResultSetHeader>(
        `INSERT INTO broadcast_templates (title, category, message, image_url, inline_keyboard)
         VALUES (?, ?, ?, ?, ?)`,
        [title.trim(), categoryVal, message.trim(), imageUrl || '', jsonKeyboard]
      );
      return NextResponse.json({ success: true, id: res.insertId, message: 'Đã lưu mẫu thông báo mới!' });
    }
  } catch (err: any) {
    console.error('[BROADCAST_TPL_POST_ERROR]', err?.message);
    return NextResponse.json({ success: false, error: 'Lỗi máy chủ khi lưu mẫu' }, { status: 500 });
  }
}

// DELETE - Delete broadcast template
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID mẫu là bắt buộc' }, { status: 400 });
    }

    await pool.query('DELETE FROM broadcast_templates WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Đã xóa mẫu thông báo!' });
  } catch (err: any) {
    console.error('[BROADCAST_TPL_DELETE_ERROR]', err?.message);
    return NextResponse.json({ success: false, error: 'Lỗi máy chủ khi xóa mẫu' }, { status: 500 });
  }
}
