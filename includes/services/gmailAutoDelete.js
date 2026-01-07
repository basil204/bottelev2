import { getUserInfo, deleteAccount } from './googleAdminService.js';
import { getCache, setCache, delCache, getAllKeys } from '../../lib/cache/index.js';
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
    
    return { isLoggedIn: false, error: error.message };
  }
};

// Schedule xóa account: edu sau 1 giờ, non sau 24 giờ kể từ thời điểm hiện tại
export const scheduleAccountDeletion = async (email, type) => {
  // Edu: 1 giờ, Non: 24 giờ
  const deleteDelayMs = type === 'edu' 
    ? DELETE_DELAY_EDU_MS
    : DELETE_DELAY_NON_MS;
  
  const now = Date.now();
  // Tính thời gian xóa = thời gian hiện tại + delay
  const deleteTime = now + deleteDelayMs;
  const timeUntilDelete = deleteDelayMs;
  const minutesUntilDelete = Math.floor(timeUntilDelete / (60 * 1000));
  
  const key = deleteKey(email);
  
  // Cache time: thời gian xóa + thêm 20% buffer để đảm bảo không mất cache trước khi xóa
  const cacheTime = deleteDelayMs * 1.2;
  
  // Lưu vào cache với scheduledDeleteTime
  setCache(key, { email, type, scheduledDeleteTime: deleteTime, scheduledAt: now }, cacheTime);
  
  const delayText = type === 'edu' ? '1 giờ' : '24 giờ';
  console.log(`[GMAIL_AUTO_DELETE] Scheduled deletion for ${email} (${type}) sau ${delayText} kể từ bây giờ`);
  console.log(`[GMAIL_AUTO_DELETE]   - ScheduledAt: ${new Date(now).toISOString()}`);
  console.log(`[GMAIL_AUTO_DELETE]   - DeleteDelayMs: ${deleteDelayMs}ms (${type === 'edu' ? '1 giờ' : '24 giờ'})`);
  console.log(`[GMAIL_AUTO_DELETE]   - DeleteTime: ${new Date(deleteTime).toISOString()}`);
  console.log(`[GMAIL_AUTO_DELETE]   - TimeUntilDelete: ${minutesUntilDelete} phút (${Math.floor(timeUntilDelete / 1000)} giây)`);
  
  // Update status trong database thành "sold" (đã login, đợi xóa)
  try {
    await query('UPDATE gmail_accounts SET status = "sold" WHERE email = ?', [email]);
    console.log(`[GMAIL_AUTO_DELETE] ✅ Updated status to "sold" for ${email} in database`);
  } catch (error) {
    console.error(`[GMAIL_AUTO_DELETE] ❌ Error updating status for ${email}:`, error);
  }
};

// Xóa account đã đến thời gian từ cache (dựa trên scheduledDeleteTime)
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
      
      const { email, type, scheduledDeleteTime, scheduledAt } = cache;
      
      // Kiểm tra account còn tồn tại trong database không
      const dbAccount = await query('SELECT * FROM gmail_accounts WHERE email = ? AND status = "sold"', [email]);
      
      if (dbAccount.length === 0) {
        // Account không còn trong DB, xóa khỏi cache
        delCache(key);
        continue;
      }
      
      // Kiểm tra xem đã đến thời gian xóa chưa (thêm buffer 1 phút để đảm bảo không xóa sớm)
      const bufferMs = 1 * 60 * 1000; // 1 phút buffer
      const actualDeleteTime = scheduledDeleteTime + bufferMs;
      
      if (now >= actualDeleteTime) {
        // Đã đến thời gian xóa
        const timeElapsed = now - (scheduledAt || scheduledDeleteTime - (type === 'edu' ? DELETE_DELAY_EDU_MS : DELETE_DELAY_NON_MS));
        const hoursElapsed = Math.floor(timeElapsed / (60 * 60 * 1000));
        const minutesElapsed = Math.floor((timeElapsed % (60 * 60 * 1000)) / (60 * 1000));
        const delayText = type === 'edu' ? '1 giờ' : '24 giờ';
        
        console.log(`[GMAIL_AUTO_DELETE] ⏰ Đến thời gian xóa account ${email} (${type}) - đã qua ${delayText} kể từ khi schedule`);
        console.log(`[GMAIL_AUTO_DELETE]   - ScheduledAt: ${scheduledAt ? new Date(scheduledAt).toISOString() : 'N/A'}`);
        console.log(`[GMAIL_AUTO_DELETE]   - ScheduledDeleteTime: ${new Date(scheduledDeleteTime).toISOString()}`);
        console.log(`[GMAIL_AUTO_DELETE]   - Time elapsed: ${hoursElapsed}h ${minutesElapsed}m`);
        console.log(`[GMAIL_AUTO_DELETE]   - Current time: ${new Date(now).toISOString()}`);
        
        try {
          const result = await deleteAccount(email, type);
          if (result.success) {
            console.log(`[GMAIL_AUTO_DELETE] ✅ Successfully deleted ${type} account from Google: ${email}`);
            
            // Xóa luôn record khỏi database
            try {
              await query('DELETE FROM gmail_accounts WHERE email = ?', [email]);
              console.log(`[GMAIL_AUTO_DELETE] ✅ Deleted record from database: ${email}`);
            } catch (dbError) {
              console.error(`[GMAIL_AUTO_DELETE] ❌ Error deleting record from database for ${email}:`, dbError);
            }
          } else {
            console.error(`[GMAIL_AUTO_DELETE] ❌ Failed to delete ${type} account from Google ${email}: ${result.error}`);
          }
        } catch (error) {
          console.error(`[GMAIL_AUTO_DELETE] ❌ Exception deleting ${type} account ${email}:`, error);
        }
        
        // Xóa khỏi cache sau khi đã xử lý
        delCache(key);
      } else {
        // Chưa đến thời gian xóa
        const timeRemaining = actualDeleteTime - now;
        const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
        const minutesRemaining = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
        
        console.log(`[GMAIL_AUTO_DELETE] ⏳ Account ${email} (${type}) chưa đến thời gian xóa - còn ${hoursRemaining}h ${minutesRemaining}m`);
      }
    }
  } catch (error) {
    console.error(`[GMAIL_AUTO_DELETE] ❌ Error in processScheduledDeletions:`, error);
  }
};

// Xóa account đã đến thời gian từ database (backup check nếu cache bị mất)
export const processScheduledDeletionsFromDatabase = async () => {
  try {
    // Lấy tất cả accounts có status = "sold" (đã được schedule xóa)
    const accountsToCheck = await query(
      'SELECT * FROM gmail_accounts WHERE status = "sold" ORDER BY id',
      []
    );
    
    if (!accountsToCheck || accountsToCheck.length === 0) {
      return; // Không có account nào cần check
    }
    
    const now = Date.now();
    let deletedCount = 0;
    let errorCount = 0;
    
    console.log(`[GMAIL_AUTO_DELETE_DB] Checking ${accountsToCheck.length} account(s) from database...`);
    
    for (const account of accountsToCheck) {
      try {
        // Kiểm tra cache xem có schedule không
        const deleteKeyCache = deleteKey(account.email);
        const cache = getCache(deleteKeyCache);
        
        if (cache && cache.scheduledDeleteTime) {
          // Có cache, kiểm tra từ cache
          const bufferMs = 1 * 60 * 1000; // 1 phút buffer
          const actualDeleteTime = cache.scheduledDeleteTime + bufferMs;
          
          if (now >= actualDeleteTime) {
            // Đã đến thời gian xóa từ cache
            const delayText = account.type === 'edu' ? '1 giờ' : '24 giờ';
            console.log(`[GMAIL_AUTO_DELETE_DB] ⏰ Đến thời gian xóa: ${account.email} (${account.type}) - đã qua ${delayText} kể từ khi schedule`);
            console.log(`[GMAIL_AUTO_DELETE_DB]   - ScheduledDeleteTime: ${new Date(cache.scheduledDeleteTime).toISOString()}`);
            console.log(`[GMAIL_AUTO_DELETE_DB]   - CurrentTime: ${new Date(now).toISOString()}`);
            
            try {
              const result = await deleteAccount(account.email, account.type);
              if (result.success) {
                console.log(`[GMAIL_AUTO_DELETE_DB] ✅ Successfully deleted ${account.type} account from Google: ${account.email}`);
                
                await query('DELETE FROM gmail_accounts WHERE email = ?', [account.email]);
                console.log(`[GMAIL_AUTO_DELETE_DB] ✅ Deleted record from database: ${account.email}`);
                
                delCache(deleteKeyCache);
                deletedCount++;
              } else {
                console.error(`[GMAIL_AUTO_DELETE_DB] ❌ Failed to delete ${account.type} account from Google ${account.email}: ${result.error}`);
                errorCount++;
              }
            } catch (error) {
              console.error(`[GMAIL_AUTO_DELETE_DB] ❌ Exception deleting ${account.type} account ${account.email}:`, error);
              errorCount++;
            }
          } else {
            // Chưa đến thời gian xóa
            const timeRemaining = actualDeleteTime - now;
            const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
            const minutesRemaining = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
            console.log(`[GMAIL_AUTO_DELETE_DB] ⏳ Account ${account.email} (${account.type}) chưa đến thời gian xóa - còn ${hoursRemaining}h ${minutesRemaining}m`);
          }
        } else {
          // Không có cache, có thể cache bị mất - schedule lại
          console.log(`[GMAIL_AUTO_DELETE_DB] ⚠️ Account ${account.email} có status = "sold" nhưng không có cache - schedule lại`);
          await scheduleAccountDeletion(account.email, account.type);
        }
        
        // Delay nhỏ giữa mỗi account để tránh rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`[GMAIL_AUTO_DELETE_DB] ❌ Error processing ${account.email}:`, error.message);
        errorCount++;
      }
    }
    
    if (deletedCount > 0 || errorCount > 0) {
      console.log(`[GMAIL_AUTO_DELETE_DB] ✅ Hoàn thành: ${deletedCount} đã xóa, ${errorCount} lỗi`);
    }
    
  } catch (error) {
    console.error(`[GMAIL_AUTO_DELETE_DB] ❌ Error in processScheduledDeletionsFromDatabase:`, error);
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
      console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] Không có account nào cần check.`);
      return { loggedIn: 0, notLoggedIn: 0, deleted: 0, errors: 0, total: 0 };
    }
    
    console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] Tìm thấy ${accounts.length} account(s) cần check...`);
    
    let loggedInCount = 0;
    let notLoggedInCount = 0;
    let deletedCount = 0;
    let errorCount = 0;
    
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
                  
                } catch (deleteError) {
                  console.error(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Lỗi khi xóa ${account.email} khỏi database:`, deleteError);
                  
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
            
            // Check xem đã được schedule chưa (kiểm tra cache và status trong database)
            const deleteKeyCache = deleteKey(account.email);
            const existingSchedule = getCache(deleteKeyCache);
            const currentStatus = account.status;
            
            if (!existingSchedule && currentStatus !== 'sold') {
              // Chưa được schedule - thực hiện schedule deletion ngay (dựa trên thời gian hiện tại)
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] 📅 Lần đầu phát hiện login - Scheduling deletion for ${account.email} (${account.type})...`);
              
              // Schedule xóa dựa trên thời gian hiện tại + delay (không cần lastLoginTime)
              await scheduleAccountDeletion(account.email, account.type);
              
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Đã schedule xóa ${account.email} (${account.type}) và đổi status thành "sold"`);
            } else if (existingSchedule) {
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⏭️ ${account.email} đã được schedule xóa rồi (scheduled time: ${new Date(existingSchedule.scheduledDeleteTime).toISOString()})`);
              
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
              await scheduleAccountDeletion(account.email, account.type);
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
            
            // Edu: 24h, Non: 72h
            const requiredHours = type === 'edu' 
              ? DELETE_EDU_NOT_LOGIN_AFTER_MS 
              : DELETE_NON_NOT_LOGIN_AFTER_MS;
            
            const hoursSinceCreation = Math.floor(timeSinceCreation / (60 * 60 * 1000));
            
            if (timeSinceCreation >= requiredHours) {
              // Đã qua thời gian quy định, xóa account chưa login
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⚠️ Account ${account.email} chưa login và đã qua thời gian quy định (${hoursSinceCreation}h) - tự động xóa`);
              
              try {
                // Xóa từ Google Admin API
                const result = await deleteAccount(account.email, account.type);
                if (result.success) {
                  console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Successfully deleted ${account.type} account from Google: ${account.email}`);
                  
                  // Xóa từ database
                  await query('DELETE FROM gmail_accounts WHERE email = ?', [account.email]);
                  console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Deleted record from database: ${account.email}`);
                  
                  deletedCount++;
                } else {
                  console.error(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Failed to delete ${account.type} account from Google ${account.email}: ${result.error}`);
                  
                  errorCount++;
                }
              } catch (deleteError) {
                console.error(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Lỗi khi xóa ${account.email}:`, deleteError);
                
                errorCount++;
              }
            } else {
              // Chưa đến thời gian xóa
              console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ⏳ Account ${account.email} chưa login nhưng mới tạo ${hoursSinceCreation}h trước - bỏ qua (cần ${Math.floor(requiredHours / (60 * 60 * 1000))}h để xóa)`);
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
        
      }
    }
    
    console.log(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ✅ Hoàn thành check ${type}: ${loggedInCount} đã login, ${notLoggedInCount} chưa login, ${deletedCount} đã xóa (không tồn tại), ${errorCount} lỗi`);
    
    
    return { loggedIn: loggedInCount, notLoggedIn: notLoggedInCount, deleted: deletedCount, errors: errorCount, total: accounts.length };
    
  } catch (error) {
    console.error(`[GMAIL_LOGIN_CHECK_${type.toUpperCase()}] ❌ Lỗi trong checkAccountsByType:`, error);
    
    return { loggedIn: 0, notLoggedIn: 0, errors: 0, total: 0 };
  }
};

// Check login status cho tất cả accounts trong database (check riêng edu và non)
export const checkAllAccountsLoginStatusLoop = async () => {
  try {
    console.log('[GMAIL_LOGIN_CHECK] Bắt đầu check login status cho tất cả accounts (edu và non riêng biệt)...');
    
    // Check Edu accounts
    const eduResult = await checkAccountsByType('edu');
    
    // Delay 5 phút giữa edu và non để tránh rate limit
    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    
    // Check Non accounts
    const nonResult = await checkAccountsByType('non');
    
    // Tổng hợp kết quả
    const totalLoggedIn = eduResult.loggedIn + nonResult.loggedIn;
    const totalNotLoggedIn = eduResult.notLoggedIn + nonResult.notLoggedIn;
    const totalDeleted = eduResult.deleted + nonResult.deleted;
    const totalErrors = eduResult.errors + nonResult.errors;
    const totalAccounts = eduResult.total + nonResult.total;
    
    console.log(`[GMAIL_LOGIN_CHECK] ✅ Hoàn thành check tất cả accounts:`);
    console.log(`[GMAIL_LOGIN_CHECK]   - Edu: ${eduResult.loggedIn} đã login, ${eduResult.notLoggedIn} chưa login, ${eduResult.deleted} đã xóa, ${eduResult.errors} lỗi`);
    console.log(`[GMAIL_LOGIN_CHECK]   - Non: ${nonResult.loggedIn} đã login, ${nonResult.notLoggedIn} chưa login, ${nonResult.deleted} đã xóa, ${nonResult.errors} lỗi`);
    console.log(`[GMAIL_LOGIN_CHECK]   - Tổng: ${totalLoggedIn} đã login, ${totalNotLoggedIn} chưa login, ${totalDeleted} đã xóa, ${totalErrors} lỗi`);
    
    return {
      edu: eduResult,
      non: nonResult,
      total: {
        loggedIn: totalLoggedIn,
        notLoggedIn: totalNotLoggedIn,
        deleted: totalDeleted,
        errors: totalErrors,
        total: totalAccounts
      }
    };
  } catch (error) {
    console.error('[GMAIL_LOGIN_CHECK] ❌ Lỗi trong checkAllAccountsLoginStatusLoop:', error);
    
    return {
      edu: { loggedIn: 0, notLoggedIn: 0, deleted: 0, errors: 0, total: 0 },
      non: { loggedIn: 0, notLoggedIn: 0, deleted: 0, errors: 0, total: 0 },
      total: { loggedIn: 0, notLoggedIn: 0, deleted: 0, errors: 0, total: 0 }
    };
  }
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
};

// Start login checker (chạy mỗi 30 phút)
export const startGmailLoginChecker = () => {
  const checkInterval = 30 * 60 * 1000; // Check every 30 minutes
  
  setInterval(() => checkAllAccountsLoginStatusLoop(), checkInterval);
  checkAllAccountsLoginStatusLoop(); // Initial check
  
  console.log('[GMAIL_LOGIN_CHECK] Login checker started (check every 30 minutes)');
};

// Start daily cleanup cho Edu accounts chưa login (chạy lúc 00:00 VN time mỗi ngày)
export const startEduAccountsDailyCleanup = () => {
  const getNextMidnightVN = () => {
    const now = new Date();
    // VN time = UTC + 7
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const vnMidnight = new Date(vnTime);
    vnMidnight.setUTCHours(0, 0, 0, 0);
    // Convert về UTC
    const utcMidnight = new Date(vnMidnight.getTime() - (7 * 60 * 60 * 1000));
    // Nếu đã qua 00:00 hôm nay, schedule cho 00:00 ngày mai
    if (utcMidnight.getTime() <= now.getTime()) {
      utcMidnight.setUTCDate(utcMidnight.getUTCDate() + 1);
    }
    return utcMidnight.getTime() - now.getTime();
  };
  
  const scheduleNext = () => {
    const delay = getNextMidnightVN();
    setTimeout(() => {
      console.log('[GMAIL_AUTO_DELETE] 🧹 Bắt đầu daily cleanup cho Edu accounts chưa login...');
      checkAccountsByType('edu').then(() => {
        scheduleNext(); // Schedule cho ngày tiếp theo
      });
    }, delay);
  };
  
  scheduleNext();
  console.log('[GMAIL_AUTO_DELETE] Daily cleanup scheduler started (runs at 00:00 VN time)');
};
