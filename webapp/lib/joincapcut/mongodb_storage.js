import { MongoClient } from 'mongodb';
import crypto from 'crypto';

// Sử dụng environment variable hoặc fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://69zd43zw_db_user:DLWy3u84ZQNTnT1u@cluster0.w2u2x36.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = process.env.MONGODB_DB_NAME || 'capcut_tokens';
const COLLECTION_NAME = process.env.MONGODB_COLLECTION || 'tokens';

let client = null;
let db = null;

// Kết nối MongoDB
async function connectToMongoDB() {
  try {
    if (!client || !db) {
      console.log('[MONGODB] Connecting to MongoDB...');
      console.log('[MONGODB] URI:', MONGODB_URI.substring(0, 50) + '...');
      
      client = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 30000, // 30 seconds for cloud
        connectTimeoutMS: 30000, // 30 seconds for cloud
        socketTimeoutMS: 45000, // 45 seconds socket timeout
        maxPoolSize: 10, // Maintain up to 10 socket connections
        minPoolSize: 2, // Maintain a minimum of 2 socket connections
        maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        retryWrites: true,
        retryReads: true,
        // For Render deployment
        tls: true,
        tlsAllowInvalidCertificates: false,
        tlsAllowInvalidHostnames: false
      });
      
      await client.connect();
      db = client.db(DB_NAME);
      console.log('[MONGODB] ✅ Connected to MongoDB successfully');
      console.log('[MONGODB] Database:', DB_NAME, 'Collection:', COLLECTION_NAME);
    } else {
      // Test if connection is still alive
      try {
        await db.admin().ping();
        console.log('[MONGODB] Connection is alive');
      } catch (pingError) {
        console.log('[MONGODB] Connection lost, reconnecting...');
        client = null;
        db = null;
        return connectToMongoDB(); // Recursive call to reconnect
      }
    }
    return db;
  } catch (error) {
    console.error('[MONGODB] ❌ Connection failed:', error.message);
    console.error('[MONGODB] Error code:', error.code);
    console.error('[MONGODB] Error name:', error.name);
    
    // Log specific error types for debugging
    if (error.code === 'ENOTFOUND') {
      console.error('[MONGODB] DNS resolution failed - check network connection');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('[MONGODB] Connection timeout - check firewall/proxy settings');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('[MONGODB] Connection refused - check MongoDB server status');
    } else if (error.name === 'MongoServerError') {
      console.error('[MONGODB] MongoDB server error - check credentials and permissions');
    }
    
    // Reset client and db on error
    client = null;
    db = null;
    throw error;
  }
}

// Đóng kết nối
async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[MONGODB] Connection closed');
  }
}

// Helper function để kiểm tra và lấy collection
async function getCollection() {
  const database = await connectToMongoDB();
  
  if (!database) {
    throw new Error('Database connection is null');
  }
  
  const collection = database.collection(COLLECTION_NAME);
  
  if (!collection) {
    throw new Error('Collection is null');
  }
  
  return collection;
}

// Lấy tất cả tokens
export async function getAllTokens() {
  try {
    const collection = await getCollection();
    const tokens = await collection.find({}).toArray();
    console.log('[MONGODB] Retrieved', tokens.length, 'tokens');
    
    return { success: true, tokens };
  } catch (error) {
    console.error('[MONGODB] Error getting tokens:', error.message);
    // Reset connection on error
    client = null;
    db = null;
    throw error;
  }
}

// Lưu token mới
export async function saveToken(tokenData) {
  try {
    const collection = await getCollection();
    
    const tokenDoc = {
      _id: tokenData.token, // Sử dụng token làm _id
      email: tokenData.email,
      token: tokenData.token,
      link: tokenData.link,
      expiresAt: tokenData.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaces: tokenData.workspaces || [],
      vipWorkspaces: tokenData.vipWorkspaces || [],
      accountId: tokenData.accountId,
      cookie: tokenData.cookie || '',
      status: 'active'
    };
    
    const result = await collection.insertOne(tokenDoc);
    console.log('[MONGODB] Saved token for', tokenData.email, 'with ID:', result.insertedId);
    
    return { success: true, insertedId: result.insertedId };
  } catch (error) {
    console.error('[MONGODB] Error saving token:', error.message);
    // Reset connection on error
    client = null;
    db = null;
    throw error;
  }
}

// Cập nhật token
export async function updateToken(token, updateData) {
  try {
    const collection = await getCollection();
    
    const updateDoc = {
      ...updateData,
      updatedAt: new Date()
    };
    
    const result = await collection.updateOne(
      { token: token },
      { $set: updateDoc }
    );
    
    console.log('[MONGODB] Updated token:', token, 'Modified count:', result.modifiedCount);
    
    return { success: true, modifiedCount: result.modifiedCount };
  } catch (error) {
    console.error('[MONGODB] Error updating token:', error.message);
    // Reset connection on error
    client = null;
    db = null;
    throw error;
  }
}

// Xóa token
export async function deleteToken(token) {
  try {
    const collection = await getCollection();
    
    const result = await collection.deleteOne({ token: token });
    console.log('[MONGODB] Deleted token:', token, 'Deleted count:', result.deletedCount);
    
    return { success: true, deletedCount: result.deletedCount };
  } catch (error) {
    console.error('[MONGODB] Error deleting token:', error.message);
    // Reset connection on error
    client = null;
    db = null;
    throw error;
  }
}

// Tìm token theo token string
export async function findTokenByToken(tokenString) {
  try {
    const collection = await getCollection();
    
    const token = await collection.findOne({ token: tokenString });
    
    if (token) {
      console.log('[MONGODB] Found token for email:', token.email);
    } else {
      console.log('[MONGODB] Token not found:', tokenString);
    }
    
    return token;
  } catch (error) {
    console.error('[MONGODB] Error finding token:', error.message);
    // Reset connection on error
    client = null;
    db = null;
    return null;
  }
}

// Tìm tokens theo email
export async function findTokensByEmail(email) {
  try {
    const collection = await getCollection();
    
    const tokens = await collection.find({ email: email }).toArray();
    console.log('[MONGODB] Found', tokens.length, 'tokens for email:', email);
    
    return tokens;
  } catch (error) {
    console.error('[MONGODB] Error finding tokens by email:', error.message);
    // Reset connection on error
    client = null;
    db = null;
    return [];
  }
}

// Lấy tokens hết hạn
export async function getExpiredTokens() {
  try {
    const collection = await getCollection();
    
    const now = new Date();
    const expiredTokens = await collection.find({ 
      expiresAt: { $lt: now } 
    }).toArray();
    
    console.log('[MONGODB] Found', expiredTokens.length, 'expired tokens');
    
    return expiredTokens;
  } catch (error) {
    console.error('[MONGODB] Error getting expired tokens:', error.message);
    // Reset connection on error
    client = null;
    db = null;
    return [];
  }
}

// Lấy tokens còn hiệu lực
export async function getActiveTokens() {
  try {
    const collection = await getCollection();
    
    const now = new Date();
    const activeTokens = await collection.find({ 
      $or: [
        { expiresAt: { $gt: now } },
        { expiresAt: { $exists: false } }
      ]
    }).toArray();
    
    console.log('[MONGODB] Found', activeTokens.length, 'active tokens');
    
    return activeTokens;
  } catch (error) {
    console.error('[MONGODB] Error getting active tokens:', error.message);
    // Reset connection on error
    client = null;
    db = null;
    return [];
  }
}

// Test kết nối MongoDB
export async function testMongoDBConnection() {
  try {
    console.log('[MONGODB] Starting connection test...');
    console.log('[MONGODB] Environment:', process.env.NODE_ENV || 'development');
    console.log('[MONGODB] Using URI from env:', !!process.env.MONGODB_URI);
    
    // Reset connection state
    client = null;
    db = null;
    
    const collection = await getCollection();
    
    // Test ping
    const database = await connectToMongoDB();
    await database.admin().ping();
    console.log('[MONGODB] Ping successful');
    
    // Đếm số documents
    const count = await collection.countDocuments();
    console.log('[MONGODB] Count documents successful:', count);
    
    // Test insert/delete để verify write permissions
    const testDoc = { _id: 'test_' + Date.now(), test: true, createdAt: new Date() };
    await collection.insertOne(testDoc);
    await collection.deleteOne({ _id: testDoc._id });
    console.log('[MONGODB] Write/Delete test successful');
    
    console.log('[MONGODB] ✅ Connection test successful');
    console.log('[MONGODB] Total tokens in database:', count);
    
    return { 
      success: true, 
      message: 'MongoDB connection successful',
      totalTokens: count,
      environment: process.env.NODE_ENV || 'development',
      usingEnvUri: !!process.env.MONGODB_URI
    };
  } catch (error) {
    console.error('[MONGODB] ❌ Connection test failed:', error.message);
    console.error('[MONGODB] Error code:', error.code);
    console.error('[MONGODB] Error name:', error.name);
    console.error('[MONGODB] Full error:', error);
    
    // Reset connection state on error
    client = null;
    db = null;
    
    return { 
      success: false, 
      error: error.message,
      errorCode: error.code,
      errorName: error.name,
      environment: process.env.NODE_ENV || 'development',
      usingEnvUri: !!process.env.MONGODB_URI
    };
  }
}

// Generate token
export function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Cleanup expired tokens
export async function cleanupExpiredTokens() {
  try {
    const database = await connectToMongoDB();
    const collection = database.collection(COLLECTION_NAME);
    
    const now = new Date();
    const result = await collection.deleteMany({ 
      expiresAt: { $lt: now } 
    });
    
    console.log('[MONGODB] Cleaned up', result.deletedCount, 'expired tokens');
    
    return { success: true, deletedCount: result.deletedCount };
  } catch (error) {
    console.error('[MONGODB] Error cleaning up expired tokens:', error.message);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[MONGODB] Graceful shutdown...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[MONGODB] Graceful shutdown...');
  await closeConnection();
  process.exit(0);
});
