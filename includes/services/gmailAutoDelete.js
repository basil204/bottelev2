import { getUserInfo, deleteAccount } from './googleAdminService.js';
import { getCache, setCache, delCache, getAllKeys } from '../../lib/cache/index.js';
import { logEvent, logError } from '../../utils/log.js';
import { query } from '../database/index.js';

// Cache key prefix cho scheduled deletions
const deleteKey = (email) => `gmail_delete_${email}`;

// Constants cho thời gian xóa
const DELETE_DELAY_EDU_MS = 60 * 60 * 1000; // 1 giờ = 3600000 milliseconds (cho edu đã login)
const DELETE_DELAY_NON_MS = 24 * 60 * 60 * 1000; // 24 giờ = 86400000 milliseconds (cho non đã login)
const DELETE_EDU_NOT_LOGIN_AFTER_MS = 24 * 60 * 60 * 1000; // 24 giờ cho edu accounts chưa login (dựa trên creationTime)
const DELETE_NON_NOT_LOGIN_AFTER_MS = 72 * 60 * 60 * 1000; // 72 giờ cho non accounts chưa login (dựa trên creationTime)

// Check xem account đã login chưa
// - Edu và Non: check bằng lastLoginTime (khác "1970-01-01T00:00:00.000Z" thì đã login)
export const checkAccountLoginStatus = async (email, type) => {
  try {
    console.log(`[GMAIL_AUTO_DELETE] Checking login status for: ${email} (type: ${type})`);
    const userInfo = await getUserInfo(email, type);
    
    if (!userInfo.success || !userInfo.data) {
      console.log(`[GMAIL_AUTO_DELETE] Cannot get user info for ${email}`);
      return { isLoggedIn: false, error: userInfo.error };
    }

    const creationTime = userInfo.data.creationTime;
    const lastLoginTime = userInfo.data.lastLoginTime;
    const neverLoggedInTime = '1970-01-01T00:00:00.000Z';
    
    // Edu và Non: check bằng lastLoginTime - nếu khác "1970-01-01T00:00:00.000Z" thì đã login
    const isLoggedIn = lastLoginTime && lastLoginTime !== neverLoggedInTime;
    
    console.log(`[GMAIL_AUTO_DELETE] ${type.toUpperCase()} account - checking lastLoginTime: ${lastLoginTime}`);
    console.log(`[GMAIL_AUTO_DELETE] Account ${email} login status: ${isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);
    console.log(`[GMAIL_AUTO_DELETE]   - CreationTime: ${creationTime || 'N/A'}`);
    console.log(`[GMAIL_AUTO_DELETE]   - LastLoginTime: ${lastLoginTime || 'N/A'}`);
    
    return { isLoggedIn, creationTime, lastLoginTime, userInfo: userInfo.data };
  } catch (error) {
    console.error(`[GMAIL_AUTO_DELETE] Error checking login status:`, error);
    logError({ context: 'checkAccountLoginStatus', email, error: error.message });
    return { isLoggedIn: false, error: error.message };
  }
};

// Schedule xóa account: edu sau 1 giờ, non sau 24 giờ kể từ lastLoginTime
export const scheduleAccountDeletion = async (email, type, lastLoginTimeISO) => {
  // Edu: 1 giờ, Non: 24 giờ
  const deleteDelayMs = type === 'edu' 
    ? DELETE_DELAY_EDU_MS
    : DELETE_DELAY_NON_MS;
  
  // Tính thời gian xóa = lastLoginTime + delay (thay vì Date.now() + delay)
  const lastLoginTimeMs = new Date(lastLoginTimeISO).getTime();
  
  // Validate lastLoginTime
  if (isNaN(lastLoginTimeMs)) {
    console.error(`[GMAIL_AUTO_DELETE] ❌ Invalid lastLoginTime format: ${lastLoginTimeISO}`);
    throw new Error(`Invalid lastLoginTime format: ${lastLoginTimeISO}`);
  }
  
  // Check nếu lastLoginTime là epoch time (chưa login) - không schedule
  const neverLoggedInTime = '1970-01-01T00:00:00.000Z';
  const neverLoggedInTimeMs = new Date(neverLoggedInTime).getTime();
  if (lastLoginTimeMs === neverLoggedInTimeMs) {
    console.log(`[GMAIL_AUTO_DELETE] ⏭️ Account ${email} chưa login (lastLoginTime = epoch time) - không schedule xóa`);
    return;
  }
  
  const deleteTime = lastLoginTimeMs + deleteDelayMs;
  const now = Date.now();
  const timeUntilDelete = deleteTime - now;
  const minutesUntilDelete = Math.floor(timeUntilDelete / (60 * 1000));
  
  const key = deleteKey(email);
  
  // Cache time: thời gian xóa + thêm 10% buffer
  const cacheTime = deleteDelayMs * 1.1;
  
  setCache(key, { email, type, scheduledDeleteTime: deleteTime, lastLoginTime: lastLoginTimeISO }, cacheTime);
  
  const delayText = type === 'edu' ? '1 giờ' : '24 giờ';
  console.log(`[GMAIL_AUTO_DELETE] Scheduled deletion for ${email} (${type}) sau ${delayText} kể từ lastLoginTime`);
  console.log(`[GMAIL_AUTO_DELETE]   - LastLoginTime: ${lastLoginTimeISO} (${new Date(lastLoginTimeMs).toISOString()})`);
  console.log(`[GMAIL_AUTO_DELETE]   - DeleteDelayMs: ${deleteDelayMs}ms (${type === 'edu' ? '1 giờ' : '24 giờ'})`);
  console.log(`[GMAIL_AUTO_DELETE]   - DeleteTime: ${new Date(deleteTime).toISOString()}`);
  console.log(`[GMAIL_AUTO_DELETE]   - CurrentTime: ${new Date(now).toISOString()}`);
  console.log(`[GMAIL_AUTO_DELETE]   - TimeUntilDelete: ${minutesUntilDelete} phút (${Math.floor(timeUntilDelete / 1000)} giây)`);
  
  logEvent('gmail_account_scheduled_deletion', { 
    email, 
    type, 
    lastLoginTime: lastLoginTimeISO,
    deleteTime: new Date(deleteTime).toISOString(), 
    delay: delayText,
    minutesUntilDelete: minutesUntilDelete
  });
  
  // Update status trong database thành "sold" (đã login, đợi xóa)
  try {
    await query('UPDATE gmail_accounts SET status = "sold" WHERE email = ?', [email]);
    console.log(`[GMAIL_AUTO_DELETE] ✅ Updated status to "sold" for ${email} in database`);
  } catch (error) {
    console.error(`[GMAIL_AUTO_DELETE] ❌ Error updating status for ${email}:`, error);
  }
};

// Xóa account đã đến thời gian từ cache (đã chia ra edu và non với thời gian khác nhau)
export const processScheduledDeletions = async () => {
  try {
    const keys = getAllKeys('gmail_delete_');
    const now = Date.now();
    
    if (keys.length === 0) {
      return; // Không có account nào cần xóa
    }
    
    console.log(`[GMAIL_AUTO_DELETE] Checking ${keys.length} scheduled deletion(s) from cache...`);
    
    for (const key of keys) {
      const cache = getCache(key);
      if (!cache) continue;
      
      const { email, type, scheduledDeleteTime } = cache;
      
      if (scheduledDeleteTime <= now) {
        // Check lastLoginTime từ cache - nếu là epoch time thì không xóa
        const cachedLastLoginTime = cache.lastLoginTime;
        const neverLoggedInTime = '1970-01-01T00:00:00.000Z';
        const neverLoggedInTimeMs = new Date(neverLoggedInTime).getTime();
        
        if (cachedLastLoginTime) {
          const cachedLastLoginTimeMs = new Date(cachedLastLoginTime).getTime();
          if (cachedLastLoginTimeMs === neverLoggedInTimeMs) {
            console.log(`[GMAIL_AUTO_DELETE] ⏭️ Account ${email} chưa login (lastLoginTime = epoch time) - bỏ qua, xóa khỏi cache`);
            delCache(key);
            continue;
          }
        }
        
        const delayText = type === 'edu' ? '1 giờ' : '24 giờ';
        console.log(`[GMAIL_AUTO_DELETE] ⏰ Đến thời gian xóa account ${email} (${type}) - đã qua ${delayText} kể từ khi login`);
        console.log(`[GMAIL_AUTO_DELETE] Scheduled time: ${new Date(scheduledDeleteTime).toISOString()}, Current time: ${new Date(now).toISOString()}`);
        
        try {
          const result = await deleteAccount(email, type);
          if (result.success) {
            console.log(`[GMAIL_AUTO_DELETE] ✅ Successfully deleted ${type} account from Google: ${email}`);
            
            // Xóa luôn record khỏi database để không làm nặng database
            try {
              await query('DELETE FROM gmail_accounts WHERE email = ?', [email]);
              console.log(`[GMAIL_AUTO_DELETE] ✅ Deleted record from database: ${email}`);
            } catch (dbError) {
              console.error(`[GMAIL_AUTO_DELETE] ❌ Error deleting record from database for ${email}:`, dbError);
              logError({ context: 'processScheduledDeletions', email, type, error: dbError.message, action: 'delete_from_database' });
            }
            
            logEvent('gmail_account_auto_deleted', { email, type, delay: delayText });
          } else {
            console.error(`[GMAIL_AUTO_DELETE] ❌ Failed to delete ${type} account from Google ${email}: ${result.error}`);
            logError({ context: 'processScheduledDeletions', email, type, error: result.error });
          }
        } catch (error) {
          console.error(`[GMAIL_AUTO_DELETE] ❌ Exception deleting ${type} account ${email}:`, error);
          logError({ context: 'processScheduledDeletions', email, type, error: error.message });
        }
        
        // Xóa khỏi cache sau khi đã xử lý (dù thành công hay thất bại)
        delCache(key);
      }
    }
  } catch (error) {
    console.error(`[GMAIL_AUTO_DELETE] ❌ Error in processScheduledDeletions:`, error);
    logError({ context: 'processScheduledDeletions', error: error.message });
  }
};

// Xóa account đã đến thời gian từ database (backup check nếu cache bị mất)
export const processScheduledDeletionsFromDatabase = async () => {
  try {
    // Lấy tất cả accounts có status = "sold" và có lastLoginTime
    const accountsToCheck = await query(
      'SELECT * FROM gmail_accounts WHERE status = "sold" AND lastLoginTime IS NOT NULL ORDER BY id',
      []
    );
    
    if (!accountsToCheck || accountsToCheck.length === 0) {
      return; // Không có account nào cần check
    }
    
    const now = Date.now();
    const neverLoggedInTime = '1970-01-01T00:00:00.000Z';
    const neverLoggedInTimeMs = new Date(neverLoggedInTime).getTime();
    let deletedCount = 0;
    let errorCount = 0;
    
    console.log(`[GMAIL_AUTO_DELETE_DB] Checking ${accountsToCheck.length} account(s) from database...`);
    
    for (const account of accountsToCheck) {
      try {
        // Check lastLoginTime trong database - nếu khác epoch time thì đã login
        const dbLastLoginTime = account.lastLoginTime;
        const dbLastLoginTimeMs = new Date(dbLastLoginTime).getTime();
        const isEverLoggedIn = dbLastLoginTime && 
                               dbLastLoginTimeMs !== neverLoggedInTimeMs;
        
        if (!isEverLoggedIn) {
          // Chưa login (lastLoginTime = epoch time) - bỏ qua, không xóa
          console.log(`[GMAIL_AUTO_DELETE_DB] ⏭️ Account ${account.email} chưa login (lastLoginTime = epoch time) - bỏ qua`);
          continue;
        }
        
        // Đã login: tính thời gian xóa = lastLoginTime từ DB + delay
        // Edu: 1 giờ, Non: 24 giờ
        const deleteDelayMs = account.type === 'edu' 
          ? DELETE_DELAY_EDU_MS
          : DELETE_DELAY_NON_MS;
        
        const deleteTime = dbLastLoginTimeMs + deleteDelayMs;
        const delayText = account.type === 'edu' ? '1 giờ' : '24 giờ';
        
        if (deleteTime <= now) {
          // Đã đến thời gian xóa
          const timeSinceLogin = now - dbLastLoginTimeMs;
          const hoursSinceLogin = Math.floor(timeSinceLogin / (60 * 60 * 1000));
          const minutesSinceLogin = Math.floor((timeSinceLogin % (60 * 60 * 1000)) / (60 * 1000));
          
          console.log(`[GMAIL_AUTO_DELETE_DB] ⏰ Đến thời gian xóa: ${account.email} (${account.type}) - đã qua ${delayText} kể từ khi login`);
          console.log(`[GMAIL_AUTO_DELETE_DB]   - LastLoginTime (DB): ${dbLastLoginTime}`);
          console.log(`[GMAIL_AUTO_DELETE_DB]   - Time since login: ${hoursSinceLogin}h ${minutesSinceLogin}m`);
          console.log(`[GMAIL_AUTO_DELETE_DB]   - DeleteTime: ${new Date(deleteTime).toISOString()}`);
          console.log(`[GMAIL_AUTO_DELETE_DB]   - CurrentTime: ${new Date(now).toISOString()}`);
          
          try {
            // Xóa từ Google Admin API
            const result = await deleteAccount(account.email, account.type);
            if (result.success) {
              console.log(`[GMAIL_AUTO_DELETE_DB] ✅ Successfully deleted ${account.type} account from Google: ${account.email}`);
              
              // Xóa từ database
              await query('DELETE FROM gmail_accounts WHERE email = ?', [account.email]);
              console.log(`[GMAIL_AUTO_DELETE_DB] ✅ Deleted record from database: ${account.email}`);
              
              // Xóa khỏi cache nếu có
              const deleteKeyCache = deleteKey(account.email);
              delCache(deleteKeyCache);
              
              deletedCount++;
              logEvent('gmail_account_auto_deleted_from_db', { email: account.email, type: account.type, delay: delayText });
            } else {
              console.error(`[GMAIL_AUTO_DELETE_DB] ❌ Failed to delete ${account.type} account from Google ${account.email}: ${result.error}`);
              logError({ context: 'processScheduledDeletionsFromDatabase', email: account.email, type: account.type, error: result.error });
              errorCount++;
            }
          } catch (error) {
            console.error(`[GMAIL_AUTO_DELETE_DB] ❌ Exception deleting ${account.type} account ${account.email}:`, error);
            logError({ context: 'processScheduledDeletionsFromDatabase', email: account.email, type: account.type, error: error.message });
            errorCount++;
          }
        } else {
          // Chưa đến thời gian xóa
          const timeUntilDelete = deleteTime - now;
          const hoursUntilDelete = Math.floor(timeUntilDelete / (60 * 60 * 1000));
          const minutesUntilDelete = Math.floor((timeUntilDelete % (60 * 60 * 1000)) / (60 * 1000));
          console.log(`[GMAIL_AUTO_DELETE_DB] ⏳ Account ${account.email} (${account.type}) chưa đến thời gian xóa - còn ${hoursUntilDelete}h ${minutesUntilDelete}m`);
        }
        
        // Delay nhỏ giữa mỗi account để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`[GMAIL_AUTO_DELETE_DB] ❌ Error processing ${account.email}:`, error.message);
        logError({ context: 'processScheduledDeletionsFromDatabase', email: account.email, type: account.type, error: error.message });
        errorCount++;
      }
    }
    
    if (deletedCount > 0 || errorCount > 0) {
      console.log(`[GMAIL_AUTO_DELETE_DB] ✅ Hoàn thành: ${deletedCount} đã xóa, ${errorCount} lỗi`);
    }
    
  } catch (error) {
    console.error(`[GMAIL_AUTO_DELETE_DB] ❌ Error in processScheduledDeletionsFromDatabase:`, error);
    logError({ context: 'processScheduledDeletionsFromDatabase', error: error.message });
  }
};

// Check login status cho tất cả accounts theo type (edu hoặc non)
export const checkAccountsByType = async (type) => {
  try {
    console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] Bắt đầu check login status cho ${type} accounts...`);
    
    // Lấy tất cả accounts theo type từ database (chỉ những account chưa login - status = "available")
    // Bỏ qua những account đã login (status = "sold" - đã được schedule xóa)
    const accounts = await query('SELECT * FROM gmail_accounts WHERE type = ? AND status = "available" ORDER BY id', [type]);
    
    if (!accounts || accounts.length === 0) {
      console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] Không có ${type} account nào để check`);
      return { loggedIn: 0, notLoggedIn: 0, errors: 0, total: 0 };
    }
    
    console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] Tìm thấy ${accounts.length} ${type} account(s) để check`);
    
    let loggedInCount = 0;
    let notLoggedInCount = 0;
    let errorCount = 0;
    let deletedCount = 0;
    
    // Loop qua từng account, delay 3s giữa mỗi account
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      
      try {
        console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] [${i + 1}/${accounts.length}] Email: ${account.email}`);
        console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] Checking ${account.email} (${account.type})...`);
        
        // Gọi getUserInfo để check lastLoginTime
        const userInfo = await getUserInfo(account.email, account.type);
        
        if (!userInfo.success || !userInfo.data) {
          console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Không thể lấy thông tin cho ${account.email}: ${userInfo.error || 'Unknown error'}`);
          // Nếu account không tồn tại trên Google (404), tự động xóa khỏi database
          // NHƯNG chỉ xóa nếu account chưa từng login (lastLoginTime trong DB là NULL hoặc epoch time)
          // và đã đủ thời gian (edu: 60 phút, non: 24 giờ) kể từ khi tạo
          if (userInfo.error && (userInfo.error.includes('404') || userInfo.error.includes('Resource Not Found'))) {
            // Check lastLoginTime trong database - nếu khác NULL và khác epoch time thì đã từng login, không xóa
            const dbLastLoginTime = account.lastLoginTime;
            const neverLoggedInTime = '1970-01-01T00:00:00.000Z';
            const isEverLoggedIn = dbLastLoginTime && 
                                   dbLastLoginTime !== neverLoggedInTime && 
                                   new Date(dbLastLoginTime).getTime() !== new Date(neverLoggedInTime).getTime();
            
            if (isEverLoggedIn) {
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⚠️ Account ${account.email} không tồn tại trên Google nhưng đã từng login (lastLoginTime trong DB: ${dbLastLoginTime}) - KHÔNG xóa`);
              errorCount++;
            } else {
              // Chưa từng login - check thời gian tạo
              const now = new Date();
              const createdTime = new Date(account.created_at);
              const timeSinceCreation = now.getTime() - createdTime.getTime();
              
              // Edu: 60 phút, Non: 24 giờ
              const MIN_AGE_TO_DELETE_MS = type === 'edu' ? DELETE_DELAY_EDU_MS : DELETE_DELAY_NON_MS;
              const minutesSinceCreation = Math.floor(timeSinceCreation / (60 * 1000));
              const hoursSinceCreation = Math.floor(timeSinceCreation / (60 * 60 * 1000));
              
              if (timeSinceCreation >= MIN_AGE_TO_DELETE_MS) {
                const timeText = type === 'edu' 
                  ? `${minutesSinceCreation} phút` 
                  : `${hoursSinceCreation} giờ`;
                console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⚠️ Account ${account.email} không tồn tại trên Google Admin API (chưa login, đã tạo ${timeText} trước) - tự động xóa khỏi database`);
                try {
                  await query('DELETE FROM gmail_accounts WHERE email = ?', [account.email]);
                  console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Đã xóa ${account.email} khỏi database`);
                  deletedCount++;
                  logEvent('gmail_account_deleted_not_found', { 
                    email: account.email, 
                    type: account.type, 
                    minutesSinceCreation,
                    hoursSinceCreation,
                    timeText 
                  });
                } catch (deleteError) {
                  console.error(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Lỗi khi xóa ${account.email} khỏi database:`, deleteError);
                  logError({ context: 'checkAccountsByType', email: account.email, type, error: deleteError.message, action: 'delete_from_database' });
                  errorCount++;
                }
              } else {
                const timeText = type === 'edu' 
                  ? `${minutesSinceCreation} phút` 
                  : `${hoursSinceCreation} giờ`;
                const requiredTime = type === 'edu' ? '60 phút' : '24 giờ';
                console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⏳ Account ${account.email} không tồn tại trên Google nhưng mới tạo ${timeText} trước - bỏ qua (cần ${requiredTime} để xóa, có thể đang sync với Google)`);
              }
            }
          } else {
            errorCount++;
          }
        } else {
          // Check login status: Edu và Non đều check bằng lastLoginTime (khác "1970-01-01T00:00:00.000Z" thì đã login)
          const creationTime = userInfo.data.creationTime;
          const lastLoginTime = userInfo.data.lastLoginTime;
          const neverLoggedInTime = '1970-01-01T00:00:00.000Z';
          
          // Log thêm các field khác để debug
          const isMailboxSetup = userInfo.data.isMailboxSetup;
          const suspended = userInfo.data.suspended;
          
          // Edu và Non: check bằng lastLoginTime - nếu khác epoch time thì đã login
          const isLoggedIn = lastLoginTime && lastLoginTime !== neverLoggedInTime;
          
          console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] [${i + 1}/${accounts.length}] Checking ${account.email} (${account.type})...`);
          console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}]   - CreationTime: ${creationTime || 'N/A'}`);
          console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}]   - LastLoginTime: ${lastLoginTime || 'N/A'}`);
          console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}]   - Login: ${isLoggedIn ? 'YES ✅' : 'NO ❌'}`);
          
          if (isLoggedIn) {
            console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ ${account.email} đã login (lastLoginTime: ${lastLoginTime}, khác ${neverLoggedInTime})`);
            loggedInCount++;
            
            // Update lastLoginTime trong database (chỉ khi có giá trị hợp lệ, không phải epoch time)
            // Chuyển đổi ISO 8601 format sang MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
            try {
              let loginTimeToSave = null;
              if (lastLoginTime && lastLoginTime !== neverLoggedInTime) {
                // Chuyển đổi từ ISO 8601 (2025-12-24T16:27:44.000Z) sang MySQL format (2025-12-24 16:27:44)
                const date = new Date(lastLoginTime);
                if (!isNaN(date.getTime())) {
                  const year = date.getUTCFullYear();
                  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                  const day = String(date.getUTCDate()).padStart(2, '0');
                  const hours = String(date.getUTCHours()).padStart(2, '0');
                  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
                  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
                  loginTimeToSave = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                }
              }
              await query('UPDATE gmail_accounts SET lastLoginTime = ? WHERE email = ?', [loginTimeToSave, account.email]);
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Updated lastLoginTime for ${account.email} in database: ${loginTimeToSave || 'NULL (epoch time ignored)'}`);
            } catch (error) {
              console.error(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Error updating lastLoginTime:`, error);
            }
            
            // Check xem đã được schedule chưa (kiểm tra cache và status trong database)
            const deleteKeyCache = deleteKey(account.email);
            const existingSchedule = getCache(deleteKeyCache);
            const currentStatus = account.status;
            
            if (!existingSchedule && currentStatus !== 'sold') {
              // Chưa được schedule - thực hiện schedule deletion và đổi status thành "sold"
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] 📅 Lần đầu phát hiện login - Scheduling deletion for ${account.email} (${account.type})...`);
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}]   - LastLoginTime: ${lastLoginTime}`);
              
              // Schedule xóa dựa trên lastLoginTime + delay (thay vì Date.now() + delay)
              await scheduleAccountDeletion(account.email, account.type, lastLoginTime);
              
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Đã schedule xóa ${account.email} (${account.type}) và đổi status thành "sold"`);
            } else if (existingSchedule) {
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⏭️ ${account.email} đã được schedule xóa rồi (scheduled time: ${new Date(existingSchedule.scheduledDeleteTime).toISOString()}, lastLoginTime: ${existingSchedule.lastLoginTime || 'N/A'})`);
              
              // Đảm bảo status là "sold" nếu chưa được update
              if (currentStatus !== 'sold') {
                try {
                  await query('UPDATE gmail_accounts SET status = "sold" WHERE email = ?', [account.email]);
                  console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Updated status to "sold" for ${account.email} (đã có schedule nhưng status chưa đúng)`);
                } catch (error) {
                  console.error(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Error updating status:`, error);
                }
              }
            } else if (currentStatus === 'sold') {
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⏭️ ${account.email} đã có status = "sold" nhưng chưa có schedule - sẽ schedule lại`);
              
              // Có status = "sold" nhưng chưa có schedule (có thể cache bị mất) - schedule lại
              await scheduleAccountDeletion(account.email, account.type, lastLoginTime);
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Đã schedule lại xóa ${account.email} (${account.type})`);
            }
          } else {
            console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⏳ ${account.email} chưa login (lastLoginTime: ${lastLoginTime || 'N/A'} = ${neverLoggedInTime})`);
            notLoggedInCount++;
            
            // Check creationTime: nếu account chưa login và đã qua thời gian quy định thì xóa
            // Edu: 24h, Non: 72h kể từ creationTime
            const now = new Date();
            const createdTime = new Date(account.created_at);
            const timeSinceCreation = now.getTime() - createdTime.getTime();
            
            const NOT_LOGIN_DELETE_MS = type === 'edu' 
              ? DELETE_EDU_NOT_LOGIN_AFTER_MS 
              : DELETE_NON_NOT_LOGIN_AFTER_MS;
            
            const hoursSinceCreation = Math.floor(timeSinceCreation / (60 * 60 * 1000));
            const requiredHours = type === 'edu' ? 24 : 72;
            
            if (timeSinceCreation >= NOT_LOGIN_DELETE_MS) {
              // Đã qua thời gian quy định - xóa account chưa login
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⚠️ Account ${account.email} chưa login sau ${hoursSinceCreation}h (yêu cầu: ${requiredHours}h) - tự động xóa`);
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}]   - CreatedAt: ${account.created_at}`);
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}]   - LastLoginTime: ${lastLoginTime || 'N/A'} (epoch time = chưa login)`);
              
              try {
                // Xóa từ Google Admin API
                const deleteResult = await deleteAccount(account.email, account.type);
                if (deleteResult.success) {
                  console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Đã xóa ${account.email} từ Google Admin API`);
                } else {
                  console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⚠️ Không thể xóa từ Google Admin API: ${deleteResult.error} - vẫn xóa khỏi database`);
                }
                
                // Xóa khỏi database
                await query('DELETE FROM gmail_accounts WHERE email = ?', [account.email]);
                console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Đã xóa ${account.email} khỏi database`);
                
                deletedCount++;
                logEvent('gmail_account_deleted_not_login', { 
                  email: account.email, 
                  type: account.type, 
                  hoursSinceCreation,
                  requiredHours,
                  created_at: account.created_at
                });
              } catch (deleteError) {
                console.error(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Lỗi khi xóa ${account.email}:`, deleteError);
                logError({ context: 'checkAccountsByType', email: account.email, type, error: deleteError.message, action: 'delete_not_login' });
                errorCount++;
              }
            } else {
              // Chưa đến thời gian xóa
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⏳ Account ${account.email} chưa login nhưng mới tạo ${hoursSinceCreation}h trước - bỏ qua (cần ${requiredHours}h để xóa)`);
            }
          }
        }
        
        // Delay 3s giữa mỗi account (trừ account cuối cùng)
        if (i < accounts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Lỗi khi check ${account.email}:`, error.message);
        console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] Email lỗi: ${account.email}`);
        errorCount++;
        logError({ context: 'checkAccountsByType', email: account.email, type, error: error.message });
      }
    }
    
    console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Hoàn thành check ${type}: ${loggedInCount} đã login, ${notLoggedInCount} chưa login, ${deletedCount} đã xóa (không tồn tại), ${errorCount} lỗi`);
    logEvent('gmail_login_check_completed', { 
      type,
      total: accounts.length, 
      loggedIn: loggedInCount, 
      notLoggedIn: notLoggedInCount, 
      deleted: deletedCount,
      errors: errorCount 
    });
    
    return { loggedIn: loggedInCount, notLoggedIn: notLoggedInCount, deleted: deletedCount, errors: errorCount, total: accounts.length };
    
  } catch (error) {
    console.error(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Lỗi trong checkAccountsByType:`, error);
    logError({ context: 'checkAccountsByType', type, error: error.message });
    return { loggedIn: 0, notLoggedIn: 0, errors: 0, total: 0 };
  }
};

// Check login status cho tất cả accounts trong database (check riêng edu và non)
export const checkAllAccountsLoginStatusLoop = async () => {
  try {
    console.log('[GMAIL_LOGIN_CHECK] Bắt đầu check login status cho tất cả accounts (edu và non riêng biệt)...');
    
    // Check edu accounts
    const eduResult = await checkAccountsByType('edu');
    
    // Check non accounts
    const nonResult = await checkAccountsByType('non');
    
    const totalLoggedIn = eduResult.loggedIn + nonResult.loggedIn;
    const totalNotLoggedIn = eduResult.notLoggedIn + nonResult.notLoggedIn;
    const totalErrors = eduResult.errors + nonResult.errors;
    const totalAccounts = eduResult.total + nonResult.total;
    
    console.log(`[GMAIL_LOGIN_CHECK] ✅ Hoàn thành check tất cả: Tổng ${totalAccounts} accounts (${totalLoggedIn} đã login, ${totalNotLoggedIn} chưa login, ${totalErrors} lỗi)`);
    console.log(`[GMAIL_LOGIN_CHECK]   - Edu: ${eduResult.total} accounts (${eduResult.loggedIn} login, ${eduResult.notLoggedIn} chưa login, ${eduResult.errors} lỗi)`);
    console.log(`[GMAIL_LOGIN_CHECK]   - Non: ${nonResult.total} accounts (${nonResult.loggedIn} login, ${nonResult.notLoggedIn} chưa login, ${nonResult.errors} lỗi)`);
    
  } catch (error) {
    console.error('[GMAIL_LOGIN_CHECK] ❌ Lỗi trong checkAllAccountsLoginStatusLoop:', error);
    logError({ context: 'checkAllAccountsLoginStatusLoop', error: error.message });
  }
};

// Start auto login checker - chạy liên tục
export const startGmailLoginChecker = () => {
  const runCheck = async () => {
    await checkAllAccountsLoginStatusLoop();
    
    // Sau khi check hết, nghỉ 1 phút rồi check tiếp
    console.log('[GMAIL_LOGIN_CHECK] Nghỉ 1 phút trước khi check tiếp...');
    await new Promise(resolve => setTimeout(resolve, 60 * 1000));
    
    // Chạy lại
    runCheck();
  };
  
  // Bắt đầu check ngay
  runCheck();
  console.log('[GMAIL_LOGIN_CHECK] Auto login checker started');
  logEvent('gmail_login_checker_started');
};

// Xóa Edu accounts chưa login sau 24h kể từ khi tạo (check vào 00:00 giờ Việt Nam)
export const deleteEduAccountsNotLoggedInAfter24h = async () => {
  try {
    console.log('[GMAIL_EDU_CLEANUP] Bắt đầu check và xóa Edu accounts chưa login sau 24h...');
    
    // Lấy giờ Việt Nam hiện tại
    const now = new Date();
    const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    // Tính thời gian 24h trước (giờ VN)
    const cutoffTimeVN = new Date(vnNow.getTime() - DELETE_EDU_NOT_LOGIN_AFTER_MS);
    
    // Chuyển về UTC để query database
    // created_at trong database là UTC, cần convert cutoffTimeVN về UTC
    const localOffset = now.getTimezoneOffset() * 60 * 1000;
    const vnOffset = 7 * 60 * 60 * 1000;
    const cutoffTimeUTC = new Date(cutoffTimeVN.getTime() - localOffset - vnOffset);
    
    console.log(`[GMAIL_EDU_CLEANUP] Giờ Việt Nam hiện tại: ${vnNow.toISOString()}`);
    console.log(`[GMAIL_EDU_CLEANUP] Cutoff time (24h trước, giờ VN): ${cutoffTimeVN.toISOString()}`);
    console.log(`[GMAIL_EDU_CLEANUP] Cutoff time (UTC cho query): ${cutoffTimeUTC.toISOString()}`);
    
    // Format cho MySQL DATETIME (YYYY-MM-DD HH:MM:SS)
    const cutoffMySQL = cutoffTimeUTC.toISOString().slice(0, 19).replace('T', ' ');
    
    // Lấy tất cả Edu accounts có status = "available" (chưa login) và created_at < cutoffTime
    const accountsToDelete = await query(
      `SELECT * FROM gmail_accounts 
       WHERE type = 'edu' 
       AND status = 'available' 
       AND lastLoginTime IS NULL
       AND created_at < ?
       ORDER BY id`,
      [cutoffMySQL]
    );
    
    if (!accountsToDelete || accountsToDelete.length === 0) {
      console.log('[GMAIL_EDU_CLEANUP] Không có Edu account nào cần xóa');
      return { deleted: 0, errors: 0 };
    }
    
    console.log(`[GMAIL_EDU_CLEANUP] Tìm thấy ${accountsToDelete.length} Edu account(s) cần xóa (chưa login sau 24h)`);
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const account of accountsToDelete) {
      try {
        const createdTime = new Date(account.created_at);
        const createdTimeVN = new Date(createdTime.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const hoursSinceCreation = Math.floor((vnNow.getTime() - createdTimeVN.getTime()) / (60 * 60 * 1000));
        
        console.log(`[GMAIL_EDU_CLEANUP] Xóa account: ${account.email} (tạo ${hoursSinceCreation}h trước, created_at: ${account.created_at})`);
        
        // Xóa từ Google Admin API
        const result = await deleteAccount(account.email, account.type);
        if (result.success) {
          console.log(`[GMAIL_EDU_CLEANUP] ✅ Đã xóa ${account.email} từ Google Admin API`);
          
          // Xóa từ database
          await query('DELETE FROM gmail_accounts WHERE email = ?', [account.email]);
          console.log(`[GMAIL_EDU_CLEANUP] ✅ Đã xóa ${account.email} khỏi database`);
          
          deletedCount++;
          logEvent('gmail_edu_not_login_24h_deleted', { 
            email: account.email, 
            created_at: account.created_at,
            hoursSinceCreation 
          });
        } else {
          console.error(`[GMAIL_EDU_CLEANUP] ❌ Không thể xóa ${account.email} từ Google: ${result.error}`);
          errorCount++;
          logError({ context: 'deleteEduAccountsNotLoggedInAfter24h', email: account.email, error: result.error });
        }
        
        // Delay nhỏ giữa mỗi account để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[GMAIL_EDU_CLEANUP] ❌ Lỗi khi xóa ${account.email}:`, error);
        errorCount++;
        logError({ context: 'deleteEduAccountsNotLoggedInAfter24h', email: account.email, error: error.message });
      }
    }
    
    console.log(`[GMAIL_EDU_CLEANUP] ✅ Hoàn thành: ${deletedCount} đã xóa, ${errorCount} lỗi`);
    logEvent('gmail_edu_cleanup_completed', { deleted: deletedCount, errors: errorCount, total: accountsToDelete.length });
    
    return { deleted: deletedCount, errors: errorCount, total: accountsToDelete.length };
  } catch (error) {
    console.error('[GMAIL_EDU_CLEANUP] ❌ Lỗi trong deleteEduAccountsNotLoggedInAfter24h:', error);
    logError({ context: 'deleteEduAccountsNotLoggedInAfter24h', error: error.message });
    return { deleted: 0, errors: 0, total: 0 };
  }
};

// Tính toán thời gian đến 00:00 giờ Việt Nam tiếp theo (milliseconds)
const getNextMidnightVN = () => {
  const now = new Date();
  
  // Lấy giờ Việt Nam hiện tại
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  
  // Tạo 00:00 hôm nay (giờ VN)
  const midnightVN = new Date(vnNow);
  midnightVN.setHours(0, 0, 0, 0);
  
  // Nếu đã qua 00:00 hôm nay, lấy 00:00 ngày mai
  if (vnNow >= midnightVN) {
    midnightVN.setDate(midnightVN.getDate() + 1);
  }
  
  // Chuyển về UTC timestamp để tính delay
  // Lấy UTC offset của máy hiện tại
  const localOffset = now.getTimezoneOffset() * 60 * 1000;
  // UTC+7 offset
  const vnOffset = 7 * 60 * 60 * 1000;
  // Tính timestamp UTC của 00:00 VN
  const midnightVNUTC = midnightVN.getTime() - localOffset - vnOffset;
  
  return midnightVNUTC - now.getTime();
};

// Start daily cleanup cho Edu accounts chưa login (chạy vào 00:00 giờ Việt Nam)
export const startEduAccountsDailyCleanup = () => {
  const scheduleNext = () => {
    const delayMs = getNextMidnightVN();
    const nextRun = new Date(Date.now() + delayMs);
    
    console.log(`[GMAIL_EDU_CLEANUP] Sẽ chạy cleanup lúc 00:00 giờ Việt Nam (${nextRun.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })})`);
    
    setTimeout(async () => {
      console.log('[GMAIL_EDU_CLEANUP] ⏰ Đến giờ cleanup (00:00 giờ Việt Nam)');
      await deleteEduAccountsNotLoggedInAfter24h();
      
      // Schedule cho ngày tiếp theo
      scheduleNext();
    }, delayMs);
  };
  
  // Chạy ngay lần đầu (nếu đã qua 00:00) hoặc schedule cho 00:00 tiếp theo
  scheduleNext();
  
  console.log('[GMAIL_EDU_CLEANUP] Daily cleanup scheduler started (runs at 00:00 Vietnam time)');
  logEvent('gmail_edu_daily_cleanup_started');
};

// Start auto deletion checker
export const startGmailAutoDeleteChecker = () => {
  const checkInterval = 60 * 1000; // Check every 1 minute
  
  // Check từ cache (ưu tiên)
  setInterval(() => processScheduledDeletions(), checkInterval);
  processScheduledDeletions(); // Initial check
  
  // Check từ database (backup, chạy ít thường xuyên hơn - mỗi 5 phút)
  const dbCheckInterval = 5 * 60 * 1000; // Check every 5 minutes
  setInterval(() => processScheduledDeletionsFromDatabase(), dbCheckInterval);
  processScheduledDeletionsFromDatabase(); // Initial check
  
  console.log('[GMAIL_AUTO_DELETE] Auto deletion checker started (cache + database)');
  logEvent('gmail_auto_delete_checker_started');
};

