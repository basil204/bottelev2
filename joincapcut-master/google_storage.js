import fetch from 'node-fetch';
import crypto from 'crypto';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx3dnWJUw3rr_0JB7qvZ950MduhPOb6mUbemZWpuCyFAvQbRANm3j0BgawwahWoAKU1Jw/exec';

// GET tất cả accounts
export async function getAllAccounts() {
  try {
    console.log('[GOOGLE_STORAGE] Getting all accounts...');
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[GOOGLE_STORAGE] Got accounts:', data.accounts?.length || 0);
    return data;
  } catch (error) {
    console.error('[GOOGLE_STORAGE] Error getting accounts:', error.message);
    throw error;
  }
}

// POST thay toàn bộ dataset
export async function updateAllAccounts(accounts) {
  try {
    console.log('[GOOGLE_STORAGE] Updating all accounts to Google Sheets...', accounts.length);
    const totalTokens = accounts.reduce((sum, acc) => sum + (acc.tokens?.length || 0), 0);
    const totalWorkspaces = accounts.reduce((sum, acc) => sum + (acc.workspaces?.length || 0), 0);
    console.log('[GOOGLE_STORAGE] Total tokens:', totalTokens, 'Total workspaces:', totalWorkspaces);
    
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ accounts })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[GOOGLE_STORAGE] Updated all accounts successfully to Google Sheets');
    return data;
  } catch (error) {
    console.error('[GOOGLE_STORAGE] Error updating all accounts to Google Sheets:', error.message);
    throw error;
  }
}

// POST upsert 1 account
export async function upsertAccount(account) {
  try {
    console.log('[GOOGLE_STORAGE] Upserting account:', account.email);
    console.log('[GOOGLE_STORAGE] Account tokens:', account.tokens?.length || 0);
    console.log('[GOOGLE_STORAGE] Account workspaces:', account.workspaces?.length || 0);
    
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(account)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[GOOGLE_STORAGE] Upserted account successfully to Google Sheets');
    console.log('[GOOGLE_STORAGE] Response:', data);
    return data;
  } catch (error) {
    console.error('[GOOGLE_STORAGE] Error upserting account to Google Sheets:', error.message);
    throw error;
  }
}

// POST xóa theo id
export async function deleteAccount(accountId) {
  try {
    console.log('[GOOGLE_STORAGE] Deleting account:', accountId);
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: 'delete', id: accountId })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[GOOGLE_STORAGE] Deleted account successfully');
    return data;
  } catch (error) {
    console.error('[GOOGLE_STORAGE] Error deleting account:', error.message);
    throw error;
  }
}

// Helper function để tìm account theo email
export async function findAccountByEmail(email) {
  try {
    const data = await getAllAccounts();
    const accounts = data.accounts || [];
    return accounts.find(acc => acc.email === email);
  } catch (error) {
    console.error('[GOOGLE_STORAGE] Error finding account by email:', error.message);
    return null;
  }
}

// Helper function để tìm account theo token
export async function findAccountByToken(token) {
  try {
    const data = await getAllAccounts();
    const accounts = data.accounts || [];
    
    for (const account of accounts) {
      const validToken = account.tokens?.find(t => 
        t.token === token && t.expiresAt > Date.now()
      );
      if (validToken) {
        return account;
      }
    }
    return null;
  } catch (error) {
    console.error('[GOOGLE_STORAGE] Error finding account by token:', error.message);
    return null;
  }
}

// Helper function để lấy cookie từ account
export function getCookieFromAccount(account) {
  return account?.cookie || '';
}

// Helper function để generate token
export function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Test connection to Google Sheets
export async function testGoogleSheetsConnection() {
  try {
    console.log('[GOOGLE_STORAGE] Testing connection to Google Sheets...');
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[GOOGLE_STORAGE] ✅ Google Sheets connection successful');
    console.log('[GOOGLE_STORAGE] Current accounts in sheets:', data.accounts?.length || 0);
    return { success: true, accountsCount: data.accounts?.length || 0 };
  } catch (error) {
    console.error('[GOOGLE_STORAGE] ❌ Google Sheets connection failed:', error.message);
    return { success: false, error: error.message };
  }
}
