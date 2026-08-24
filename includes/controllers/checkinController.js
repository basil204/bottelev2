import { query } from '../database/index.js';

/**
 * Perform daily check-in for a user.
 */
export const doCheckIn = async (userId) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get user info
    const userRows = await query('SELECT * FROM users WHERE id = ? OR telegram_id = ? LIMIT 1', [userId, userId]);
    if (!userRows || userRows.length === 0) {
      return { success: false, message: 'User not found' };
    }
    const user = userRows[0];

    // Check if checked in today
    const logs = await query(
      'SELECT * FROM checkin_logs WHERE (user_id = ? OR telegram_id = ?) AND checkin_date = ? LIMIT 1',
      [user.id, user.telegram_id, today]
    );

    if (logs && logs.length > 0) {
      const lastCheckin = new Date(logs[0].created_at || Date.now());
      const nextAvailable = new Date(lastCheckin.getTime() + 24 * 60 * 60 * 1000);
      const diffMs = nextAvailable.getTime() - Date.now();
      const hoursRemaining = Math.max(0, diffMs / (1000 * 60 * 60));
      return { success: false, hoursRemaining, message: 'Already checked in today' };
    }

    // Get last check-in to calculate streak
    const lastLogs = await query(
      'SELECT * FROM checkin_logs WHERE user_id = ? OR telegram_id = ? ORDER BY created_at DESC LIMIT 1',
      [user.id, user.telegram_id]
    );

    let streak = 1;
    let totalCheckins = 1;

    if (lastLogs && lastLogs.length > 0) {
      totalCheckins = (Number(lastLogs[0].total_checkins) || 0) + 1;
      const lastDate = new Date(lastLogs[0].checkin_date || lastLogs[0].created_at);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastDate.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
        streak = (Number(lastLogs[0].streak) || 0) + 1;
      }
    }

    // Insert checkin log
    await query(
      'INSERT INTO checkin_logs (user_id, telegram_id, username, checkin_date, streak, total_checkins, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [user.id, user.telegram_id, user.username || user.name || '', today, streak, totalCheckins]
    );

    // Give checkin reward (1 Credit or 1000đ bonus)
    const rewardAmount = 1000;
    await query('UPDATE users SET balance = balance + ? WHERE id = ?', [rewardAmount, user.id]);

    return {
      success: true,
      streak,
      totalCheckins,
      rewardAmount
    };
  } catch (error) {
    console.error('[CHECKIN_ERROR]', error);
    return { success: false, message: error.message };
  }
};

/**
 * Generate referral code for user
 */
export const generateReferralCode = async (userId) => {
  try {
    const userRows = await query('SELECT telegram_id, referral_code FROM users WHERE id = ? OR telegram_id = ? LIMIT 1', [userId, userId]);
    if (userRows && userRows[0]?.referral_code) {
      return userRows[0].referral_code;
    }
    const code = `REF${userId}`;
    await query('UPDATE users SET referral_code = ? WHERE id = ? OR telegram_id = ?', [code, userId, userId]);
    return code;
  } catch (e) {
    return `REF${userId}`;
  }
};

/**
 * Get referral stats for user
 */
export const getReferralStats = async (userId) => {
  try {
    const rows = await query(
      'SELECT COUNT(*) as total_referrals FROM users WHERE referred_by = ? OR referred_by = (SELECT telegram_id FROM users WHERE id = ? LIMIT 1)',
      [userId, userId]
    );
    const total_referrals = Number(rows[0]?.total_referrals) || 0;
    return {
      total_referrals,
      total_credits_earned: total_referrals * 3
    };
  } catch (e) {
    return {
      total_referrals: 0,
      total_credits_earned: 0
    };
  }
};
