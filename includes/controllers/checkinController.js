import { query } from '../database/index.js';

// Kiểm tra xem user đã check-in trong 24h chưa
export const canCheckIn = async (userId) => {
  const [lastCheckin] = await query(
    `SELECT * FROM checkins 
     WHERE user_id = ? 
     ORDER BY checked_at DESC 
     LIMIT 1`,
    [userId]
  );

  if (!lastCheckin) {
    return { canCheckIn: true, lastCheckin: null };
  }

  const lastCheckinTime = new Date(lastCheckin.checked_at);
  const now = new Date();
  const hoursDiff = (now - lastCheckinTime) / (1000 * 60 * 60);

  return {
    canCheckIn: hoursDiff >= 24,
    lastCheckin: lastCheckin,
    hoursRemaining: hoursDiff >= 24 ? 0 : Math.ceil(24 - hoursDiff)
  };
};

// Thực hiện check-in
export const doCheckIn = async (userId) => {
  const checkResult = await canCheckIn(userId);
  
  if (!checkResult.canCheckIn) {
    return {
      success: false,
      error: 'Bạn đã check-in rồi. Vui lòng đợi 24 giờ.',
      hoursRemaining: checkResult.hoursRemaining
    };
  }

  // Thêm check-in record
  await query('INSERT INTO checkins (user_id) VALUES (?)', [userId]);
  
  // Cộng 1 credit
  await query('UPDATE users SET credit = credit + 1 WHERE id = ?', [userId]);

  return {
    success: true,
    creditEarned: 1
  };
};

// Lấy lịch sử check-in
export const getCheckInHistory = async (userId, limit = 10) => {
  const rows = await query(
    `SELECT * FROM checkins 
     WHERE user_id = ? 
     ORDER BY checked_at DESC 
     LIMIT ?`,
    [userId, limit]
  );
  return rows;
};

// Tạo referral code cho user
export const generateReferralCode = async (userId) => {
  const user = await query('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user[0]) return null;

  // Nếu đã có referral code, trả về
  if (user[0].referral_code) {
    return user[0].referral_code;
  }

  // Tạo referral code mới (telegram_id + random)
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const referralCode = `REF${user[0].telegram_id}${random}`.substring(0, 20);

  await query('UPDATE users SET referral_code = ? WHERE id = ?', [referralCode, userId]);
  return referralCode;
};

// Xử lý referral khi user mới join
export const processReferral = async (referredUserId, referralCode) => {
  if (!referralCode) return { success: false, error: 'Không có mã giới thiệu' };

  // Kiểm tra xem user này đã sử dụng bất kỳ mã giới thiệu nào chưa
  const existingReferral = await query(
    'SELECT * FROM referrals WHERE referred_id = ?',
    [referredUserId]
  );

  if (existingReferral.length > 0) {
    return { 
      success: false, 
      error: 'Bạn đã sử dụng mã giới thiệu rồi. Mỗi tài khoản chỉ được sử dụng 1 mã giới thiệu duy nhất.' 
    };
  }

  // Tìm user có referral code này
  const referrer = await query('SELECT * FROM users WHERE referral_code = ?', [referralCode]);
  if (!referrer[0]) {
    return { success: false, error: 'Mã giới thiệu không hợp lệ' };
  }

  const referrerId = referrer[0].id;

  // Không cho tự giới thiệu chính mình
  if (referrerId === referredUserId) {
    return { success: false, error: 'Không thể tự giới thiệu chính mình' };
  }

  // Tạo referral record
  try {
    await query(
      'INSERT INTO referrals (referrer_id, referred_id, credit_rewarded) VALUES (?, ?, 3)',
      [referrerId, referredUserId]
    );

    // Cộng 3 credit cho người giới thiệu
    await query('UPDATE users SET credit = credit + 3 WHERE id = ?', [referrerId]);

    return {
      success: true,
      referrerId,
      creditRewarded: 3
    };
  } catch (error) {
    // Xử lý lỗi duplicate (có thể do race condition)
    if (error.code === 'ER_DUP_ENTRY') {
      return { 
        success: false, 
        error: 'Bạn đã sử dụng mã giới thiệu rồi. Mỗi tài khoản chỉ được sử dụng 1 mã giới thiệu duy nhất.' 
      };
    }
    // Nếu là lỗi khác, throw lại để xử lý ở nơi gọi
    throw error;
  }
};

// Lấy thống kê referral
export const getReferralStats = async (userId) => {
  const [stats] = await query(
    `SELECT 
      COUNT(*) as total_referrals,
      SUM(credit_rewarded) as total_credits_earned
     FROM referrals 
     WHERE referrer_id = ?`,
    [userId]
  );

  return stats || { total_referrals: 0, total_credits_earned: 0 };
};

// Tạo referral link
export const createReferralLink = (botUsername, referralCode) => {
  if (!botUsername) {
    return null;
  }
  return `https://t.me/${botUsername}?start=${referralCode}`;
};

