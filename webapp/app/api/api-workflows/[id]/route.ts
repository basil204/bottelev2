import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [rows]: any = await pool.query('SELECT * FROM api_workflows WHERE id = ?', [id]);
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy luồng API' }, { status: 404 });
    }
    return NextResponse.json({ success: true, workflow: rows[0] });
  } catch (error: any) {
    console.error('Error fetching API workflow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      code,
      icon = '⚡',
      category_id = null,
      description = '',
      price_vnd = 0,
      price_usdt = 0,
      api_url,
      http_method = 'POST',
      headers_json = '{}',
      body_template = '{}',
      input_fields_json = '[]',
      response_type = 'json',
      response_data_path = 'data',
      response_success_condition = 'status == 200 || success == true',
      success_message_template = '✅ Mua hàng thành công!\n\nChi tiết:\n{data}',
      show_in_menu = 1,
      menu_row = 1,
      is_active = 1
    } = body;

    // Check duplicate code on other records
    if (code) {
      const [existing]: any = await pool.query('SELECT id FROM api_workflows WHERE code = ? AND id != ?', [code, id]);
      if (existing.length > 0) {
        return NextResponse.json({ success: false, error: `Mã code "${code}" đã được dùng bởi luồng khác!` }, { status: 400 });
      }
    }

    await pool.query(
      `UPDATE api_workflows SET
        name = ?, code = ?, icon = ?, category_id = ?, description = ?, price_vnd = ?, price_usdt = ?,
        api_url = ?, http_method = ?, headers_json = ?, body_template = ?, input_fields_json = ?,
        response_type = ?, response_data_path = ?, response_success_condition = ?,
        success_message_template = ?, show_in_menu = ?, menu_row = ?, is_active = ?
      WHERE id = ?`,
      [
        name,
        code,
        icon,
        category_id || null,
        description,
        price_vnd,
        price_usdt,
        api_url,
        http_method,
        typeof headers_json === 'string' ? headers_json : JSON.stringify(headers_json),
        typeof body_template === 'string' ? body_template : JSON.stringify(body_template),
        typeof input_fields_json === 'string' ? input_fields_json : JSON.stringify(input_fields_json),
        response_type,
        response_data_path,
        response_success_condition,
        success_message_template,
        show_in_menu ? 1 : 0,
        menu_row || 1,
        is_active ? 1 : 0,
        id
      ]
    );

    return NextResponse.json({ success: true, message: 'Cập nhật luồng API thành công!' });
  } catch (error: any) {
    console.error('Error updating API workflow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await pool.query('DELETE FROM api_workflows WHERE id = ?', [id]);
    return NextResponse.json({ success: true, message: 'Đã xóa luồng API thành công!' });
  } catch (error: any) {
    console.error('Error deleting API workflow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
