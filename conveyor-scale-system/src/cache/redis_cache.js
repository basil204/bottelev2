/**
 * CACHE & WRITE-BEHIND BUFFER ENGINE (REDIS)
 * Quản lý Caching Trạng thái Tức thời (Live Dashboard < 1ms) 
 * và Hàng đợi Write-Behind Buffer giúp giảm 99% Write IOPS cho Database SQL
 */

const Redis = require('ioredis');

class RedisCacheEngine {
    constructor() {
        this.client = null;
        this.isMockMode = false;
        
        // Mock storage nếu Redis chưa bật Docker
        this.mockLiveState = new Map();
        this.mockBatchQueue = [];
    }

    /**
     * Khởi tạo kết nối Redis Client
     */
    async initialize() {
        console.log('⚡ [RedisCache] Đang kết nối đến Redis Cache Server...');
        try {
            this.client = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD || 'conveyor_redis_secret',
                connectTimeout: 1000,
                maxRetriesPerRequest: 1,
                retryStrategy: () => null // Don't retry if connection refused
            });

            this.client.on('error', (err) => {
                // Silently handle offline redis errors when fallback mode is active
            });

            await this.client.ping();
            console.log('✅ [RedisCache] Kết nối thành công đến Redis Cache!');
        } catch (err) {
            console.warn('⚠️ [RedisCache] Không thể kết nối Redis. Kích hoạt Chế độ Mock In-Memory Cache tự động!');
            this.isMockMode = true;
        }
    }

    /**
     * Cập nhật Trạng thái Cân tức thời (Real-time Live State)
     * Phục vụ User Dashboard đọc tức thì < 1ms
     */
    async setLatestScaleStatus(scaleId, statusData) {
        const payload = {
            scale_id: scaleId,
            weight_kg: statusData.weight_kg,
            speed_mps: statusData.speed_mps,
            flow_rate_tph: statusData.flow_rate_tph,
            totalizer_kg: statusData.totalizer_kg,
            status_code: statusData.status_code || 0,
            updated_at: new Date().toISOString()
        };

        if (this.isMockMode) {
            this.mockLiveState.set(scaleId, payload);
            return;
        }

        const key = `scale:${scaleId}:latest`;
        await this.client.hset(key, {
            scale_id: payload.scale_id,
            weight_kg: payload.weight_kg.toString(),
            speed_mps: payload.speed_mps.toString(),
            flow_rate_tph: payload.flow_rate_tph.toString(),
            totalizer_kg: payload.totalizer_kg.toString(),
            status_code: payload.status_code.toString(),
            updated_at: payload.updated_at
        });
        
        // TTL 1 hour cho live cache
        await this.client.expire(key, 3600);
    }

    /**
     * Đọc Trạng thái Cân tức thời từ Cache RAM
     * ĐẢM BẢO HOÀN TOÀN KHÔNG CHẠM VÀO DATABASE SQL
     */
    async getLatestScaleStatus(scaleId) {
        if (this.isMockMode) {
            return this.mockLiveState.get(scaleId) || null;
        }

        const key = `scale:${scaleId}:latest`;
        const data = await this.client.hgetall(key);
        if (!data || Object.keys(data).length === 0) return null;

        return {
            scale_id: data.scale_id,
            weight_kg: parseFloat(data.weight_kg),
            speed_mps: parseFloat(data.speed_mps),
            flow_rate_tph: parseFloat(data.flow_rate_tph),
            totalizer_kg: parseFloat(data.totalizer_kg),
            status_code: parseInt(data.status_code),
            updated_at: data.updated_at
        };
    }

    /**
     * Đẩy bản ghi Telemetry vào Write-Behind Buffer Queue trong Redis
     * @param {Object} scaleData Dữ liệu cân từ IoT device
     */
    async pushToBatchQueue(scaleData) {
        if (this.isMockMode) {
            this.mockBatchQueue.push(scaleData);
            return;
        }

        const queueKey = 'conveyor:telemetry:queue';
        await this.client.rpush(queueKey, JSON.stringify(scaleData));
    }

    /**
     * Rút các bản ghi từ Write-Behind Queue để Worker ghi gom Bulk vào DB
     * @param {number} batchSize Số bản ghi tối đa cần lấy
     */
    async popBatchQueue(batchSize = 500) {
        if (this.isMockMode) {
            const batch = this.mockBatchQueue.splice(0, batchSize);
            return batch;
        }

        const queueKey = 'conveyor:telemetry:queue';
        const pipeline = this.client.pipeline();
        
        for (let i = 0; i < batchSize; i++) {
            pipeline.lpop(queueKey);
        }

        const results = await pipeline.exec();
        const batch = [];
        
        for (const [err, item] of results) {
            if (!err && item) {
                try {
                    batch.push(JSON.parse(item));
                } catch (e) {
                    // skip parse err
                }
            }
        }

        return batch;
    }

    /**
     * Đóng kết nối Redis
     */
    async close() {
        if (this.client) {
            await this.client.quit();
        }
    }
}

module.exports = new RedisCacheEngine();
