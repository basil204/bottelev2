import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');

    let query = 'SELECT * FROM api_workflows ORDER BY created_at DESC';
    const params: any[] = [];

    if (categoryId) {
      query = 'SELECT * FROM api_workflows WHERE category_id = ? ORDER BY created_at DESC';
      params.push(categoryId);
    }

    const [rows]: any = await pool.query(query, params);
    return NextResponse.json({ success: true, workflows: rows });
  } catch (error: any) {
    console.error('Error fetching API workflows:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

    if (!name || !code || !api_url) {
      return NextResponse.json({ success: false, error: 'Tên, mã code và URL API không được để trống!' }, { status: 400 });
    }

    // Check duplicate code
    const [existing]: any = await pool.query('SELECT id FROM api_workflows WHERE code = ?', [code]);
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: `Mã code "${code}" đã tồn tại!` }, { status: 400 });
    }

    const [result]: any = await pool.query(
      `INSERT INTO api_workflows (
        name, code, icon, category_id, description, price_vnd, price_usdt,
        api_url, http_method, headers_json, body_template, input_fields_json,
        response_type, response_data_path, response_success_condition,
        success_message_template, show_in_menu, menu_row, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        is_active ? 1 : 0
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Tạo luồng mua hàng API thành công!',
      workflowId: result.insertId
    });
  } catch (error: any) {
    console.error('Error creating API workflow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
