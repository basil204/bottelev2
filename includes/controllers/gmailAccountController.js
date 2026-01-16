import { query } from '../database/index.js';
import { createEduAccount, createNonAccount, deleteAccount, getUserInfo, getDomains, generateRandomUsername } from '../services/googleAdminService.js';

// Tạo Gmail account và lưu vào database
export const createGmailAccount = async (type, domain, password = 'Vietcombank9338739954') => {
  try {
    // Với type 'non', chỉ sử dụng domain krishokerbondhu.org
    if (type === 'non') {
      domain = 'krishokerbondhu.org';
    }
    
    // Generate random username
    const username = generateRandomUsername();
    const email = `${username}@${domain}`;

    // Tạo account trên Google Admin
    let result;
    if (type === 'edu') {
      result = await createEduAccount(username, domain, password);
    } else if (type === 'non') {
      result = await createNonAccount(username, domain, password);
    } else {
      return { success: false, error: 'Invalid account type' };
    }

    if (!result.success) {
      return result;
    }

    // Lưu vào database
    await query(
      'INSERT INTO gmail_accounts (email, password, type, domain, status) VALUES (?, ?, ?, ?, "available")',
      [email, password, type, domain]
    );
    
    return {
      success: true,
      email,
      password,
      type,
      domain
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Tạo Gmail account cho user mua và lưu vào database với status "available" (chưa login)
export const createGmailAccountForSale = async (type, domain, password = 'Vietcombank9338739954') => {
  try {
    // Với type 'non', chỉ sử dụng domain krishokerbondhu.org
    if (type === 'non') {
      domain = 'krishokerbondhu.org';
    }
    
    // Generate random username
    const username = generateRandomUsername();
    const email = `${username}@${domain}`;
    console.log(`[CREATE_GMAIL] Bắt đầu tạo account: type=${type}, domain=${domain}, username=${username}, email=${email}`);

    // Tạo account trên Google Admin
    let result;
    if (type === 'edu') {
      console.log(`[CREATE_GMAIL] Gọi createEduAccount...`);
      result = await createEduAccount(username, domain, password);
    } else if (type === 'non') {
      console.log(`[CREATE_GMAIL] Gọi createNonAccount...`);
      result = await createNonAccount(username, domain, password);
    } else {
      console.error(`[CREATE_GMAIL] Invalid account type: ${type}`);
      return { success: false, error: 'Invalid account type' };
    }

    if (!result.success) {
      console.error(`[CREATE_GMAIL] ❌ Lỗi khi tạo account: ${result.error}`);
      return result;
    }

    console.log(`[CREATE_GMAIL] ✅ Tạo thành công account: ${result.email}, ID: ${result.id}`);

    // Lưu vào database với status "available" (chưa login)
    await query(
      'INSERT INTO gmail_accounts (email, password, type, domain, status, lastLoginTime) VALUES (?, ?, ?, ?, "available", NULL)',
      [email, password, type, domain]
    );
    
    console.log(`[CREATE_GMAIL] ✅ Đã lưu account vào database với status "available" (chưa login)`);
    
    return {
      success: true,
      email,
      password,
      type,
      domain
    };
  } catch (error) {
    console.error(`[CREATE_GMAIL] Exception:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Tạo nhiều Gmail accounts
export const createMultipleGmailAccounts = async (type, domain, count, password = 'Vietcombank9338739954') => {
  const results = [];
  for (let i = 0; i < count; i++) {
    const result = await createGmailAccount(type, domain, password);
    results.push(result);
    // Delay nhỏ để tránh rate limit
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return results;
};

// Xóa Gmail account
export const deleteGmailAccount = async (accountId) => {
  try {
    // Lấy thông tin account
    const [account] = await query('SELECT * FROM gmail_accounts WHERE id = ?', [accountId]);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    // Xóa trên Google Admin
    const deleteResult = await deleteAccount(account.email, account.type);
    if (!deleteResult.success) {
      return deleteResult;
    }

    // Cập nhật status trong database
    await query(
      'UPDATE gmail_accounts SET status = "deleted" WHERE id = ?',
      [accountId]
    );
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Check login status của account
export const checkLoginStatus = async (accountId) => {
  try {
    const [account] = await query('SELECT * FROM gmail_accounts WHERE id = ?', [accountId]);
    if (!account) {
      return { success: false, error: 'Account not found' };
    }

    // Kiểm tra trạng thái đăng nhập từ database
    let isLoggedIn = false;
    let lastLoginTime = account.lastLoginTime;
    
    if (lastLoginTime) {
      const neverLoggedInTime = new Date('1970-01-01T00:00:00.000Z').getTime();
      const currentLastLoginTime = new Date(lastLoginTime).getTime();
      isLoggedIn = currentLastLoginTime !== neverLoggedInTime;
    }

    // Có thể lấy thêm thông tin từ Google Admin API nếu cần
    const userInfo = await getUserInfo(account.email, account.type);
    
    return {
      success: true,
      accountId: account.id,
      email: account.email,
      isLoggedIn,
      lastLoginTime: lastLoginTime ? new Date(lastLoginTime).toISOString() : null,
      userInfo: userInfo.success ? userInfo.data : null
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Check login status cho tất cả accounts
export const checkAllAccountsLoginStatus = async () => {
  try {
    const accounts = await query('SELECT * FROM gmail_accounts WHERE status = "available"');
    const results = [];
    
    for (const account of accounts) {
      const status = await checkLoginStatus(account.id);
      results.push(status);
      // Delay để tránh rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  } catch (error) {
    return [];
  }
};

// Lấy account available để bán
export const getAvailableAccount = async (type) => {
  try {
    const [account] = await query(
      'SELECT * FROM gmail_accounts WHERE type = ? AND status = "available" LIMIT 1',
      [type]
    );
    return account || null;
  } catch (error) {
    return null;
  }
};

// Đánh dấu account đã bán
export const markAccountSold = async (accountId) => {
  try {
    await query(
      'UPDATE gmail_accounts SET status = "sold", sold_at = NOW() WHERE id = ?',
      [accountId]
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Lấy danh sách accounts
export const listGmailAccounts = async (type, status, offset, limit) => {
  try {
    let sql = 'SELECT * FROM gmail_accounts WHERE 1=1';
    const params = [];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const rows = await query(sql, params);
    const [{ total }] = await query(
      sql.replace('SELECT *', 'SELECT COUNT(*) as total').replace('ORDER BY id DESC LIMIT ? OFFSET ?', ''),
      params.slice(0, -2)
    );
    
    return { rows, total };
  } catch (error) {
    return { rows: [], total: 0 };
  }
};

// Get domains
export const getAvailableDomains = async (type) => {
  try {
    console.log(`[GET_DOMAINS] Đang lấy domains cho type: ${type}`);
    const result = await getDomains(type);
    console.log(`[GET_DOMAINS] Kết quả:`, result);
    if (!result || !result.success || !result.domains || !Array.isArray(result.domains)) {
      console.log(`[GET_DOMAINS] Không có domains hợp lệ`);
      return [];
    }
    const domains = result.domains.map(d => d.domainName || d).filter(d => d);
    console.log(`[GET_DOMAINS] Domains tìm được:`, domains);
    return domains;
  } catch (error) {
    console.error(`[GET_DOMAINS] Lỗi:`, error.message);
    return [];
  }
};

// Count available accounts by type
export const countAvailableAccounts = async (type) => {
  try {
    const [{ count }] = await query(
      'SELECT COUNT(*) as count FROM gmail_accounts WHERE type = ? AND status = "available"',
      [type]
    );
    return count || 0;
  } catch (error) {
    return 0;
  }
};

