import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đường dẫn đến file credentials
const CREDENTIALS_PATH = path.join(process.cwd(), 'TokenGGW', 'client_secret-v2.json');
const TOKEN_PATH = path.join(process.cwd(), 'TokenGGW', 'token-v2.json');

// Scopes cần thiết cho Google Admin API
const SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.domain.readonly'
];

/**
 * Đọc credentials từ file
 */
function loadCredentials() {
  try {
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    const credentials = JSON.parse(content);
    return credentials;
  } catch (error) {
    console.error('❌ Lỗi khi đọc file credentials:', error.message);
    console.error(`   Đường dẫn: ${CREDENTIALS_PATH}`);
    process.exit(1);
  }
}

/**
 * Lưu token vào file
 */
function saveToken(token) {
  try {
    // Tạo thư mục nếu chưa có
    const tokenDir = path.dirname(TOKEN_PATH);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }
    
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    console.log('✅ Đã lưu token vào:', TOKEN_PATH);
  } catch (error) {
    console.error('❌ Lỗi khi lưu token:', error.message);
    process.exit(1);
  }
}

/**
 * Đăng nhập và lấy token
 */
async function authorize() {
  const credentials = loadCredentials();
  const { client_secret, client_id, redirect_uris } = credentials.web;

  // Tạo OAuth2 client
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Kiểm tra nếu đã có token
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);
    
    // Test token bằng cách lấy thông tin user
    console.log('✅ Đã tìm thấy token hiện tại. Đang kiểm tra...');
    
    try {
      const admin = google.admin({ version: 'directory_v1', auth: oAuth2Client });
      // Test API call
      await admin.domains.list({ customer: 'my_customer' });
      console.log('✅ Token hiện tại vẫn còn hiệu lực!');
      return;
    } catch (error) {
      console.log('⚠️ Token đã hết hạn hoặc không hợp lệ. Đang lấy token mới...');
    }
  } catch (error) {
    console.log('📝 Chưa có token. Đang bắt đầu quá trình đăng nhập...');
  }

  // Tạo URL authorization
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Yêu cầu consent để có refresh token
  });

  console.log('\n📋 Thực hiện các bước sau:');
  console.log('1. Mở URL sau trong trình duyệt:');
  console.log('\n' + authUrl + '\n');
  console.log('2. Đăng nhập bằng tài khoản Google Admin');
  console.log('3. Cho phép quyền truy cập');
  console.log('4. Copy authorization code từ URL (code=...)');
  console.log('   Ví dụ: URL có dạng http://localhost:5000/oauth2callback?code=4/0AeanS...\n');
  
  // Thử mở browser tự động
  try {
    const { exec } = await import('child_process');
    
    // Windows
    if (process.platform === 'win32') {
      exec(`start "" "${authUrl}"`, (error) => {
        if (error) console.log('💡 Vui lòng mở URL trên trong trình duyệt thủ công.');
      });
    }
    // macOS
    else if (process.platform === 'darwin') {
      exec(`open "${authUrl}"`, (error) => {
        if (error) console.log('💡 Vui lòng mở URL trên trong trình duyệt thủ công.');
      });
    }
    // Linux
    else {
      exec(`xdg-open "${authUrl}"`, (error) => {
        if (error) console.log('💡 Vui lòng mở URL trên trong trình duyệt thủ công.');
      });
    }
  } catch (error) {
    // Nếu không mở được, user sẽ mở thủ công
    console.log('💡 Vui lòng mở URL trên trong trình duyệt thủ công.');
  }

  // Đọc authorization code từ user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Nhập authorization code từ URL: ', async (code) => {
    rl.close();

    if (!code || code.trim() === '') {
      console.error('❌ Authorization code không được để trống!');
      process.exit(1);
    }

    try {
      // Đổi code thành token
      const { tokens } = await oAuth2Client.getToken(code.trim());
      oAuth2Client.setCredentials(tokens);

      // Thêm expiry_date nếu chưa có
      if (!tokens.expiry_date && tokens.expires_in) {
        tokens.expiry_date = Date.now() + (tokens.expires_in * 1000);
      }

      // Lưu token
      saveToken(tokens);

      console.log('\n✅ Đăng nhập thành công!');
      console.log('📝 Token đã được lưu vào:', TOKEN_PATH);
      console.log('\n🎉 Bạn có thể sử dụng Google Admin API Non bây giờ!');

    } catch (error) {
      console.error('❌ Lỗi khi lấy token:', error.message);
      if (error.response) {
        console.error('   Chi tiết:', error.response.data);
      }
      process.exit(1);
    }
  });
}

// Chạy script
console.log('🔐 Đăng nhập Google Admin API Non');
console.log('📁 Credentials:', CREDENTIALS_PATH);
console.log('📁 Token sẽ lưu tại:', TOKEN_PATH);
console.log('━'.repeat(50));
authorize().catch(console.error);

