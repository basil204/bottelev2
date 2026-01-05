import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load credentials và tokens
const loadCredentials = (type) => {
  const clientSecretFile = type === 'edu' 
    ? path.join(process.cwd(), 'TokenGGW', 'client_secret.json')
    : path.join(process.cwd(), 'TokenGGW', 'client_secret-v2.json');
  
  const tokenFile = type === 'edu'
    ? path.join(process.cwd(), 'TokenGGW', 'token.json')
    : path.join(process.cwd(), 'TokenGGW', 'token-v2.json');

  const credentials = JSON.parse(fs.readFileSync(clientSecretFile, 'utf8'));
  let token = null;
  
  try {
    token = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
  } catch (err) {
    console.error(`Error loading token file: ${err.message}`);
  }

  return { credentials, token, tokenFile };
};

// Refresh access token
const refreshAccessToken = async (credentials, refreshToken, tokenFile) => {
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

    const newToken = {
      access_token: response.data.access_token,
      refresh_token: refreshToken,
      scope: response.data.scope,
      token_type: response.data.token_type || 'Bearer',
      expiry_date: Date.now() + (response.data.expires_in * 1000)
    };

    // Lưu token mới
    fs.writeFileSync(tokenFile, JSON.stringify(newToken, null, 2));
    
    return newToken.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    throw error;
  }
};

// Get authenticated client
const getAuthenticatedClient = async (type) => {
  const { credentials, token, tokenFile } = loadCredentials(type);
  
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
    console.log('Token expired, refreshing...');
    if (token.refresh_token) {
      const newAccessToken = await refreshAccessToken(credentials, token.refresh_token, tokenFile);
      token.access_token = newAccessToken;
      token.expiry_date = Date.now() + (3600 * 1000); // 1 hour
      fs.writeFileSync(tokenFile, JSON.stringify(token, null, 2));
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

