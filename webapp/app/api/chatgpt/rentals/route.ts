import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/chatgpt/rentals
 * Lấy danh sách rentals với filter
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const fam_id = searchParams.get('fam_id');

        let sql = `
      SELECT r.*, f.name as fam_name, u.telegram_id, u.username
      FROM chatgpt_rentals r
      LEFT JOIN chatgpt_fams f ON r.fam_id = f.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
        const params: any[] = [];

        if (status) {
            sql += ' AND r.status = ?';
            params.push(status);
        }

        if (fam_id) {
            sql += ' AND r.fam_id = ?';
            params.push(fam_id);
        }

        sql += ' ORDER BY r.created_at DESC';

        const [rentals] = await pool.query<any[]>(sql, params);

        return NextResponse.json({ success: true, rentals });
    } catch (error) {
        console.error('[ChatGPT Rentals API] GET error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/chatgpt/rentals
 * Thêm rental thủ công
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { user_id, fam_id, email, price, days = 30 } = body;

        if (!user_id || !fam_id || !email) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);

        const [result] = await pool.query<any>(
            'INSERT INTO chatgpt_rentals (user_id, fam_id, email, price, end_date) VALUES (?, ?, ?, ?, ?)',
            [user_id, fam_id, email, price || 0, endDate]
        );

        // Update FAM slots
        const [countResult] = await pool.query<any[]>(
            'SELECT COUNT(*) as count FROM chatgpt_rentals WHERE fam_id = ? AND status = ?',
            [fam_id, 'active']
        );
        const usedSlots = countResult[0]?.count || 0;
        await pool.query('UPDATE chatgpt_fams SET used_slots = ? WHERE id = ?', [usedSlots, fam_id]);

        return NextResponse.json({ success: true, id: result.insertId });
    } catch (error) {
        console.error('[ChatGPT Rentals API] POST error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT /api/chatgpt/rentals
 * Cập nhật rental (gia hạn, hủy, etc)
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status, extend_days, fam_id } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing rental ID' }, { status: 400 });
        }

        // Get current rental
        const [rentals] = await pool.query<any[]>('SELECT * FROM chatgpt_rentals WHERE id = ?', [id]);
        if (rentals.length === 0) {
            return NextResponse.json({ success: false, error: 'Rental not found' }, { status: 404 });
        }
        const rental = rentals[0];

        const updates: string[] = [];
        const params: any[] = [];

        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }

        if (extend_days) {
            updates.push('end_date = DATE_ADD(end_date, INTERVAL ? DAY)');
            params.push(extend_days);
        }

        if (fam_id !== undefined) {
            updates.push('fam_id = ?');
            params.push(fam_id);
            updates.push("invite_status = 'pending'");
        }

        if (updates.length === 0) {
            return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
        }

        params.push(id);
        await pool.query(`UPDATE chatgpt_rentals SET ${updates.join(', ')} WHERE id = ?`, params);

        // Update FAM slots if status changed
        if (status || fam_id !== undefined) {
            const oldFamId = rental.fam_id;
            const newFamId = fam_id || oldFamId;

            // Update old FAM
            const [oldCount] = await pool.query<any[]>(
                'SELECT COUNT(*) as count FROM chatgpt_rentals WHERE fam_id = ? AND status = ?',
                [oldFamId, 'active']
            );
            await pool.query('UPDATE chatgpt_fams SET used_slots = ? WHERE id = ?', [oldCount[0]?.count || 0, oldFamId]);

            // Update new FAM if different
            if (fam_id !== undefined && fam_id !== oldFamId) {
                const [newCount] = await pool.query<any[]>(
                    'SELECT COUNT(*) as count FROM chatgpt_rentals WHERE fam_id = ? AND status = ?',
                    [newFamId, 'active']
                );
                await pool.query('UPDATE chatgpt_fams SET used_slots = ? WHERE id = ?', [newCount[0]?.count || 0, newFamId]);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[ChatGPT Rentals API] PUT error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/chatgpt/rentals
 * Xóa/hủy rental
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing rental ID' }, { status: 400 });
        }

        // Get rental to update FAM slots
        const [rentals] = await pool.query<any[]>('SELECT fam_id FROM chatgpt_rentals WHERE id = ?', [id]);
        const famId = rentals[0]?.fam_id;

        // Change status to cancelled instead of delete
        await pool.query('UPDATE chatgpt_rentals SET status = ? WHERE id = ?', ['cancelled', id]);

        // Update FAM slots
        if (famId) {
            const [countResult] = await pool.query<any[]>(
                'SELECT COUNT(*) as count FROM chatgpt_rentals WHERE fam_id = ? AND status = ?',
                [famId, 'active']
            );
            await pool.query('UPDATE chatgpt_fams SET used_slots = ? WHERE id = ?', [countResult[0]?.count || 0, famId]);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[ChatGPT Rentals API] DELETE error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
