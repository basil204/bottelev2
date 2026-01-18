import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { query } from '../database/index.js';

// Load credentials và tokens từ database
const loadCredentials = async (type) => {
  try {
    const [row] = await query('SELECT * FROM google_tokens WHERE type = ?', [type]);
    if (!row) {
      console.warn(`[GOOGLE_API] No credentials found in DB for type: ${type}`);
      return { credentials: null, token: null };
    }

    const credentials = row.client_credentials ? JSON.parse(row.client_credentials) : null;
    const token = row.token ? JSON.parse(row.token) : null;

    return { credentials, token };
  } catch (err) {
    console.error(`Error loading credentials from DB: ${err.message}`);
    return { credentials: null, token: null };
  }
};

// Refresh access token
const refreshAccessToken = async (credentials, refreshToken, type) => {
  try {
    const clientId = credentials.web.client_id;
    const clientSecret = credentials.web.client_secret;
    const tokenUri = credentials.web.token_uri;

    const response = await axios.post(tokenUri, {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const newTokenData = {
      access_token: response.data.access_token,
      refresh_token: refreshToken, // Keep old refresh token
      scope: response.data.scope,
      token_type: response.data.token_type || 'Bearer',
      expiry_date: Date.now() + (response.data.expires_in * 1000)
    };

    // Update token in DB
    // First retrieve current token to merge if needed (though we rebuild it here)
    // Actually we should just update the token column

    // Nếu API trả về refresh_token mới (thường không, nhưng đề phòng)
    if (response.data.refresh_token) {
      newTokenData.refresh_token = response.data.refresh_token;
    }

    await query('UPDATE google_tokens SET token = ? WHERE type = ?', [JSON.stringify(newTokenData, null, 2), type]);

    return newTokenData.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    throw error;
  }
};

// Get authenticated client
const getAuthenticatedClient = async (type) => {
  const { credentials, token } = await loadCredentials(type);

  if (!credentials) {
    throw new Error(`No credentials found for type: ${type}`);
  }

  const oauth2Client = new google.auth.OAuth2(
    credentials.web.client_id,
    credentials.web.client_secret,
    credentials.web.redirect_uris[0]
  );

  if (!token) {
    throw new Error(`No token found for type: ${type}`);
  }

  // Check if token is expired
  if (token.expiry_date && token.expiry_date < Date.now()) {
    console.log(`Token (${type}) expired, refreshing...`);
    if (token.refresh_token) {
      const newAccessToken = await refreshAccessToken(credentials, token.refresh_token, type);
      token.access_token = newAccessToken;
      token.expiry_date = Date.now() + (3600 * 1000); // 1 hour approximation if not updated in obj
      // Note: refreshAccessToken already updates DB
    }
  }

  oauth2Client.setCredentials(token);

  return { auth: oauth2Client, token };
};

// Tạo Gmail account (edu)
export const createEduAccount = async (username, domain, password) => {
  try {
    console.log(`[GOOGLE_API] Tạo edu account: ${username}@${domain}`);
    const { auth } = await getAuthenticatedClient('edu');
    const admin = google.admin({ version: 'directory_v1', auth });

    const user = {
      primaryEmail: `${username}@${domain}`,
      name: {
        givenName: username,
        familyName: username
      },
      password: password,
      changePasswordAtNextLogin: false
    };

    console.log(`[GOOGLE_API] Gọi admin.users.insert...`);
    const response = await admin.users.insert({ requestBody: user });
    console.log(`[GOOGLE_API] ✅ Tạo thành công edu account: ${response.data.primaryEmail}, ID: ${response.data.id}`);
    return {
      success: true,
      email: response.data.primaryEmail,
      id: response.data.id
    };
  } catch (error) {
    console.error(`[GOOGLE_API] ❌ Lỗi khi tạo edu account:`, error.message);
    if (error.response) {
      console.error(`[GOOGLE_API] Response data:`, error.response.data);
    }
    return {
      success: false,
      error: error.message
    };
  }
};

// Tạo Gmail account (non - regular Google account)
export const createNonAccount = async (username, domain, password) => {
  try {
    console.log(`[GOOGLE_API] Tạo non account: ${username}@${domain}`);
    const { auth } = await getAuthenticatedClient('non');
    const admin = google.admin({ version: 'directory_v1', auth });

    const user = {
      primaryEmail: `${username}@${domain}`,
      name: {
        givenName: username,
        familyName: username
      },
      password: password,
      changePasswordAtNextLogin: false
    };

    console.log(`[GOOGLE_API] Gọi admin.users.insert...`);
    const response = await admin.users.insert({ requestBody: user });
    console.log(`[GOOGLE_API] ✅ Tạo thành công non account: ${response.data.primaryEmail}, ID: ${response.data.id}`);
    return {
      success: true,
      email: response.data.primaryEmail,
      id: response.data.id
    };
  } catch (error) {
    console.error(`[GOOGLE_API] ❌ Lỗi khi tạo non account:`, error.message);
    if (error.response) {
      console.error(`[GOOGLE_API] Response data:`, error.response.data);
    }
    return {
      success: false,
      error: error.message
    };
  }
};

// Xóa Gmail account
export const deleteAccount = async (email, type) => {
  try {
    const { auth } = await getAuthenticatedClient(type);
    const admin = google.admin({ version: 'directory_v1', auth });

    await admin.users.delete({
      userKey: email
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting account:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get user info (để check login status)
export const getUserInfo = async (email, type) => {
  try {
    const { auth } = await getAuthenticatedClient(type);
    const admin = google.admin({ version: 'directory_v1', auth });

    const response = await admin.users.get({
      userKey: email
    });

    // Log chi tiết để debug
    console.log(`[GOOGLE_API] getUserInfo for ${email} (${type}):`);
    console.log(`[GOOGLE_API]   - lastLoginTime: ${response.data.lastLoginTime || 'N/A'}`);
    console.log(`[GOOGLE_API]   - creationTime: ${response.data.creationTime || 'N/A'}`);
    console.log(`[GOOGLE_API]   - isMailboxSetup: ${response.data.isMailboxSetup || 'N/A'}`);
    console.log(`[GOOGLE_API]   - isEnrolledIn2Sv: ${response.data.isEnrolledIn2Sv || 'N/A'}`);
    console.log(`[GOOGLE_API]   - isEnforcedIn2Sv: ${response.data.isEnforcedIn2Sv || 'N/A'}`);
    console.log(`[GOOGLE_API]   - suspended: ${response.data.suspended || false}`);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error(`[GOOGLE_API] Error getting user info for ${email}:`, error.message);
    if (error.response) {
      console.error(`[GOOGLE_API] Response data:`, error.response.data);
    }
    return {
      success: false,
      error: error.message
    };
  }
};

// Get list of domains (cho edu accounts)
export const getDomains = async (type) => {
  try {
    const { auth } = await getAuthenticatedClient(type);
    const admin = google.admin({ version: 'directory_v1', auth });

    const response = await admin.domains.list({
      customer: 'my_customer'
    });

    return {
      success: true,
      domains: response.data.domains || []
    };
  } catch (error) {
    console.error('Error getting domains:', error.message);
    return {
      success: false,
      error: error.message,
      domains: []
    };
  }
};

// Random username generator
export const generateRandomUsername = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let username = '';
  for (let i = 0; i < 8; i++) {
    username += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return username;
};

// Gửi sign-in instructions đến email phụ (recovery email)
// Bằng cách cập nhật recovery email cho tài khoản Google
export const sendSignInInstructions = async (email, recoveryEmail, type) => {
  try {
    console.log(`[GOOGLE_API] Gửi sign-in instructions cho ${email} đến recovery email: ${recoveryEmail}`);
    const { auth } = await getAuthenticatedClient(type);
    const admin = google.admin({ version: 'directory_v1', auth });

    // Cập nhật recovery email cho user
    // Google sẽ tự động gửi email xác minh và sign-in instructions đến recovery email
    const user = {
      recoveryEmail: recoveryEmail
    };

    console.log(`[GOOGLE_API] Cập nhật recovery email cho ${email}...`);
    const response = await admin.users.update({
      userKey: email,
      requestBody: user
    });

    console.log(`[GOOGLE_API] ✅ Đã cập nhật recovery email cho ${email}. Google sẽ gửi sign-in instructions đến ${recoveryEmail}`);

    return {
      success: true,
      message: `Sign-in instructions đã được gửi đến ${recoveryEmail}`
    };
  } catch (error) {
    console.error(`[GOOGLE_API] ❌ Lỗi khi gửi sign-in instructions cho ${email}:`, error.message);
    if (error.response) {
      console.error(`[GOOGLE_API] Response data:`, error.response.data);
    }
    return {
      success: false,
      error: error.message
    };
  }
};
