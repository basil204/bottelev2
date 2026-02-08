import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/chatgpt
 * Lấy danh sách FAM, rentals và settings
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'all';

        if (type === 'fams' || type === 'all') {
            const [fams] = await pool.query<any[]>(`
        SELECT f.*, 
               (SELECT COUNT(*) FROM chatgpt_rentals r WHERE r.fam_id = f.id AND r.status = 'active') as active_rentals
        FROM chatgpt_fams f
        ORDER BY f.created_at DESC
      `);

            if (type === 'fams') {
                return NextResponse.json({ success: true, fams });
            }
        }

        if (type === 'rentals' || type === 'all') {
            const [rentals] = await pool.query<any[]>(`
        SELECT r.*, f.name as fam_name, u.telegram_id, u.username
        FROM chatgpt_rentals r
        LEFT JOIN chatgpt_fams f ON r.fam_id = f.id
        LEFT JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
      `);

            if (type === 'rentals') {
                return NextResponse.json({ success: true, rentals });
            }
        }

        // Get all data
        const [fams] = await pool.query<any[]>(`
      SELECT f.*, 
             (SELECT COUNT(*) FROM chatgpt_rentals r WHERE r.fam_id = f.id AND r.status = 'active') as active_rentals
      FROM chatgpt_fams f
      ORDER BY f.created_at DESC
    `);

        const [rentals] = await pool.query<any[]>(`
      SELECT r.*, f.name as fam_name, u.telegram_id, u.username
      FROM chatgpt_rentals r
      LEFT JOIN chatgpt_fams f ON r.fam_id = f.id
      LEFT JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `);

        // Get settings
        const [priceRows] = await pool.query<any[]>("SELECT `value` FROM settings WHERE `key` = 'chatgpt_slot_price'");
        const [daysRows] = await pool.query<any[]>("SELECT `value` FROM settings WHERE `key` = 'chatgpt_slot_days'");

        const settings = {
            slot_price: Number(priceRows[0]?.value) || 60000,
            slot_days: Number(daysRows[0]?.value) || 30
        };

        // Stats
        const totalFams = fams.length;
        const activeFams = fams.filter((f: any) => f.status === 'active').length;
        const totalSlots = fams.reduce((sum: number, f: any) => sum + (f.max_slots - 1), 0); // -1 for owner
        const usedSlots = fams.reduce((sum: number, f: any) => sum + f.active_rentals, 0);
        const activeRentals = rentals.filter((r: any) => r.status === 'active').length;

        // Revenue
        const [revenueRows] = await pool.query<any[]>(`
      SELECT SUM(price) as total FROM chatgpt_rentals WHERE status = 'active'
    `);
        const totalRevenue = Number(revenueRows[0]?.total) || 0;

        return NextResponse.json({
            success: true,
            fams,
            rentals,
            settings,
            stats: {
                totalFams,
                activeFams,
                totalSlots,
                usedSlots,
                availableSlots: totalSlots - usedSlots,
                activeRentals,
                totalRevenue
            }
        });
    } catch (error) {
        console.error('[ChatGPT API] GET error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/chatgpt
 * Thêm FAM mới
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, workspace_id, authorization, cookie, max_slots = 5 } = body;

        if (!name || !workspace_id || !authorization) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // Check if workspace_id already exists
        const [existing] = await pool.query<any[]>('SELECT id FROM chatgpt_fams WHERE workspace_id = ?', [workspace_id]);
        if (existing.length > 0) {
            return NextResponse.json({ success: false, error: 'Workspace ID already exists' }, { status: 400 });
        }

        const [result] = await pool.query<any>(
            'INSERT INTO chatgpt_fams (name, workspace_id, authorization, cookie, max_slots) VALUES (?, ?, ?, ?, ?)',
            [name, workspace_id, authorization, cookie, max_slots]
        );

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('[ChatGPT API] POST error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT /api/chatgpt
 * Cập nhật FAM
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, name, authorization, cookie, status } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing FAM ID' }, { status: 400 });
        }

        const updates: string[] = [];
        const params: any[] = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (authorization !== undefined) {
            updates.push('authorization = ?');
            params.push(authorization);
        }
        if (cookie !== undefined) {
            updates.push('cookie = ?');
            params.push(cookie);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }

        if (updates.length === 0) {
            return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
        }

        params.push(id);
        await pool.query(`UPDATE chatgpt_fams SET ${updates.join(', ')} WHERE id = ?`, params);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[ChatGPT API] PUT error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/chatgpt
 * Xóa FAM
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing FAM ID' }, { status: 400 });
        }

        // Check if FAM has active rentals
        const [rentals] = await pool.query<any[]>(
            'SELECT COUNT(*) as count FROM chatgpt_rentals WHERE fam_id = ? AND status = ?',
            [id, 'active']
        );

        const activeCount = rentals[0]?.count || 0;
        if (activeCount > 0) {
            console.log(`[ChatGPT API] DELETE failed: FAM ${id} has ${activeCount} active rentals`);
            return NextResponse.json({
                success: false,
                error: `Cannot delete FAM: has ${activeCount} active rentals`
            }, { status: 400 });
        }

        await pool.query('DELETE FROM chatgpt_fams WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[ChatGPT API] DELETE error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
