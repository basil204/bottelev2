import { query } from '../database/index.js';

/**
 * ChatGPT FAM Controller
 * Quản lý FAM (workspace) ChatGPT Team và rentals
 */

// ==================== FAM MANAGEMENT ====================

/**
 * Lấy tất cả FAM
 */
export async function getAllFams() {
    const rows = await query(`
    SELECT f.*, 
           (SELECT COUNT(*) FROM chatgpt_rentals r WHERE r.fam_id = f.id AND r.status = 'active') as active_rentals
    FROM chatgpt_fams f
    ORDER BY f.created_at DESC
  `);
    return rows;
}

/**
 * Lấy FAM theo ID
 */
export async function getFamById(famId) {
    const rows = await query('SELECT * FROM chatgpt_fams WHERE id = ?', [famId]);
    return rows[0] || null;
}

/**
 * Lấy FAM có slot trống
 */
export async function getAvailableFam() {
    const rows = await query(`
    SELECT * FROM chatgpt_fams 
    WHERE status = 'active' AND used_slots < max_slots - 1
    ORDER BY used_slots ASC
    LIMIT 1
  `);
    return rows[0] || null;
}

/**
 * Thêm FAM mới
 */
export async function createFam(data) {
    const { name, workspace_id, authorization, max_slots = 5 } = data;
    const result = await query(
        'INSERT INTO chatgpt_fams (name, workspace_id, authorization, max_slots) VALUES (?, ?, ?, ?)',
        [name, workspace_id, authorization, max_slots]
    );
    return result.insertId;
}

/**
 * Cập nhật FAM
 */
export async function updateFam(famId, data) {
    const { name, authorization, status } = data;
    const updates = [];
    const params = [];

    if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
    }
    if (authorization !== undefined) {
        updates.push('authorization = ?');
        params.push(authorization);
    }
    if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
    }

    if (updates.length === 0) return false;

    params.push(famId);
    await query(`UPDATE chatgpt_fams SET ${updates.join(', ')} WHERE id = ?`, params);
    return true;
}

/**
 * Xóa FAM
 */
export async function deleteFam(famId) {
    await query('DELETE FROM chatgpt_fams WHERE id = ?', [famId]);
    return true;
}

/**
 * Cập nhật số slot đã dùng
 */
export async function updateFamSlots(famId) {
    const [result] = await query(
        'SELECT COUNT(*) as count FROM chatgpt_rentals WHERE fam_id = ? AND status = ?',
        [famId, 'active']
    );
    const usedSlots = result?.count || 0;

    await query('UPDATE chatgpt_fams SET used_slots = ? WHERE id = ?', [usedSlots, famId]);

    // Update status if full
    const fam = await getFamById(famId);
    if (fam && usedSlots >= fam.max_slots - 1) {
        await query('UPDATE chatgpt_fams SET status = ? WHERE id = ?', ['full', famId]);
    } else if (fam && fam.status === 'full') {
        await query('UPDATE chatgpt_fams SET status = ? WHERE id = ?', ['active', famId]);
    }
}

// ==================== RENTAL MANAGEMENT ====================

/**
 * Lấy tất cả rentals
 */
export async function getAllRentals(status = null) {
    let sql = `
    SELECT r.*, f.name as fam_name, u.telegram_id, u.username
    FROM chatgpt_rentals r
    LEFT JOIN chatgpt_fams f ON r.fam_id = f.id
    LEFT JOIN users u ON r.user_id = u.id
  `;
    const params = [];

    if (status) {
        sql += ' WHERE r.status = ?';
        params.push(status);
    }

    sql += ' ORDER BY r.created_at DESC';
    return await query(sql, params);
}

/**
 * Lấy rental theo email
 */
export async function getRentalByEmail(email) {
    const rows = await query(
        'SELECT * FROM chatgpt_rentals WHERE email = ? AND status = ? ORDER BY end_date DESC LIMIT 1',
        [email, 'active']
    );
    return rows[0] || null;
}

/**
 * Lấy rentals của user
 */
export async function getRentalsByUserId(userId) {
    return await query(
        'SELECT r.*, f.name as fam_name FROM chatgpt_rentals r LEFT JOIN chatgpt_fams f ON r.fam_id = f.id WHERE r.user_id = ? ORDER BY r.created_at DESC',
        [userId]
    );
}

/**
 * Tạo rental mới
 */
export async function createRental(data) {
    const { user_id, fam_id, email, price, days } = data;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (days || 30));

    const result = await query(
        'INSERT INTO chatgpt_rentals (user_id, fam_id, email, price, end_date) VALUES (?, ?, ?, ?, ?)',
        [user_id, fam_id, email, price, endDate]
    );

    // Update FAM slots
    await updateFamSlots(fam_id);

    return result.insertId;
}

/**
 * Cập nhật trạng thái rental
 */
export async function updateRentalStatus(rentalId, status) {
    await query('UPDATE chatgpt_rentals SET status = ? WHERE id = ?', [status, rentalId]);
}

/**
 * Cập nhật invite status
 */
export async function updateRentalInviteStatus(rentalId, inviteStatus) {
    await query('UPDATE chatgpt_rentals SET invite_status = ? WHERE id = ?', [inviteStatus, rentalId]);
}

/**
 * Gia hạn rental
 */
export async function extendRental(rentalId, days) {
    await query(
        'UPDATE chatgpt_rentals SET end_date = DATE_ADD(end_date, INTERVAL ? DAY) WHERE id = ?',
        [days, rentalId]
    );
}

/**
 * Chuyển rental sang FAM mới
 */
export async function moveRentalToFam(rentalId, newFamId) {
    const rows = await query('SELECT fam_id FROM chatgpt_rentals WHERE id = ?', [rentalId]);
    const oldFamId = rows[0]?.fam_id;

    await query('UPDATE chatgpt_rentals SET fam_id = ?, invite_status = ? WHERE id = ?',
        [newFamId, 'pending', rentalId]);

    // Update slots for both FAMs
    if (oldFamId) await updateFamSlots(oldFamId);
    await updateFamSlots(newFamId);
}

/**
 * Invite email vào FAM qua ChatGPT API
 * Cần authorization và workspace_id từ FAM
 */
export async function inviteEmailToFam(fam, email) {
    try {
        // Parse authorization để lấy thông tin cần thiết cho cookie
        // Authorization là access_token (JWT) - từ đó extract thông tin
        const accessToken = fam.authorization;
        const accountId = fam.workspace_id;

        // Tạo random device ID nếu cần
        const deviceId = generateDeviceId();

        // Tạo puid từ JWT payload nếu có thể
        let puid = '';
        try {
            const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
            const userId = payload['https://api.openai.com/auth']?.user_id || '';
            if (userId) {
                puid = `${userId}:${Date.now()}-placeholder`;
            }
        } catch (e) {
            console.log('[ChatGPT API] Could not parse JWT for puid');
        }

        // Cookie cần thiết để bypass Cloudflare
        const cookie = `oai-did=${deviceId}; _account=${accountId}${puid ? `; _puid=${puid}` : ''}`;

        const response = await fetch(
            `https://chatgpt.com/backend-api/accounts/${accountId}/invites`,
            {
                method: 'POST',
                headers: {
                    'accept': '*/*',
                    'accept-language': 'vi',
                    'authorization': `Bearer ${accessToken}`,
                    'chatgpt-account-id': accountId,
                    'content-type': 'application/json',
                    'cookie': cookie,
                    'oai-device-id': deviceId,
                    'oai-language': 'vi-VN',
                    'origin': 'https://chatgpt.com',
                    'referer': 'https://chatgpt.com/',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    email_addresses: [email],
                    role: 'standard-user',
                    resend_emails: true
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ChatGPT API] Invite failed:', response.status, errorText.substring(0, 200));
            return { success: false, error: errorText };
        }

        const data = await response.json();
        console.log('[ChatGPT API] Invite success:', JSON.stringify(data));
        return { success: true, data };
    } catch (error) {
        console.error('[ChatGPT API] Invite error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate random device ID (UUID v4 format)
 */
function generateDeviceId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Lấy danh sách members trong FAM
 */
export async function getFamMembers(fam) {
    try {
        const accessToken = fam.authorization;
        const accountId = fam.workspace_id;
        const deviceId = generateDeviceId();

        // Cookie cần thiết
        const cookie = `oai-did=${deviceId}; _account=${accountId}`;

        const response = await fetch(
            `https://chatgpt.com/backend-api/accounts/${accountId}/users?offset=0&limit=100`,
            {
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    'accept-language': 'vi',
                    'authorization': `Bearer ${accessToken}`,
                    'chatgpt-account-id': accountId,
                    'cookie': cookie,
                    'oai-device-id': deviceId,
                    'oai-language': 'vi-VN',
                    'origin': 'https://chatgpt.com',
                    'referer': 'https://chatgpt.com/',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ChatGPT API] Get members failed:', response.status, errorText.substring(0, 200));
            return { success: false, error: 'Failed to get members' };
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('[ChatGPT API] Get members error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if FAM account is live (có thể request được)
 */
export async function checkFamLive(fam) {
    try {
        const accessToken = fam.authorization;
        const accountId = fam.workspace_id;
        const deviceId = generateDeviceId();

        const cookie = `oai-did=${deviceId}; _account=${accountId}`;

        const response = await fetch(
            `https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27`,
            {
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    'accept-language': 'vi',
                    'authorization': `Bearer ${accessToken}`,
                    'chatgpt-account-id': accountId,
                    'cookie': cookie,
                    'oai-device-id': deviceId,
                    'oai-language': 'vi-VN',
                    'origin': 'https://chatgpt.com',
                    'referer': 'https://chatgpt.com/',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
                }
            }
        );

        if (!response.ok) {
            console.error('[ChatGPT API] Check account failed:', response.status);
            return { success: false, isLive: false };
        }

        const data = await response.json();
        const accountInfo = data.accounts?.[accountId]?.account;

        return {
            success: true,
            isLive: !!accountInfo && !accountInfo.is_deactivated,
            accountId: accountInfo?.account_id,
            planType: accountInfo?.plan_type,
            isDeactivated: accountInfo?.is_deactivated || false,
            data
        };
    } catch (error) {
        console.error('[ChatGPT API] Check account error:', error);
        return { success: false, isLive: false, error: error.message };
    }
}

// ==================== SETTINGS ====================

/**
 * Lấy giá slot
 */
export async function getSlotPrice() {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'chatgpt_slot_price'");
    return Number(rows[0]?.value) || 60000;
}

/**
 * Lấy số ngày thuê
 */
export async function getSlotDays() {
    const rows = await query("SELECT `value` FROM settings WHERE `key` = 'chatgpt_slot_days'");
    return Number(rows[0]?.value) || 30;
}

/**
 * Cập nhật settings
 */
export async function updateSettings(key, value) {
    await query(
        "INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?",
        [key, value, value]
    );
}

// ==================== AUTO RENEW ====================

/**
 * Check và auto renew FAM cho email
 * Nếu FAM hiện tại đầy hoặc inactive, chuyển sang FAM mới
 */
export async function checkAndRenewFam(email) {
    const rental = await getRentalByEmail(email);
    if (!rental) {
        return { needsNewRental: true, rental: null };
    }

    // Check if rental is still active
    const now = new Date();
    if (new Date(rental.end_date) < now) {
        await updateRentalStatus(rental.id, 'expired');
        return { needsNewRental: true, rental };
    }

    // Check current FAM status
    const fam = await getFamById(rental.fam_id);
    if (!fam || fam.status === 'inactive') {
        // Need to move to new FAM
        const newFam = await getAvailableFam();
        if (!newFam) {
            return { error: 'no_fam_available', rental };
        }

        // Move rental to new FAM
        await moveRentalToFam(rental.id, newFam.id);

        // Invite to new FAM
        const inviteResult = await inviteEmailToFam(newFam, email);
        if (inviteResult.success) {
            await updateRentalInviteStatus(rental.id, 'sent');
        }

        return { renewed: true, oldFam: fam, newFam, rental };
    }

    return { active: true, rental, fam };
}
