/**
 * DATABASE HORIZONTAL SHARDING ROUTER
 * Điều hướng truy vấn và ghi dữ liệu Cân Băng Tải ra các DB Server Node độc lập dựa trên Shard Key (scale_id)
 */

const { Pool } = require('pg');

class ShardRouter {
    constructor() {
        // Cấu hình các Shard Node Server DB
        this.shardConfigs = [
            { id: 0, name: 'Shard-Node-1', host: process.env.DB_SHARD1_HOST || 'localhost', port: parseInt(process.env.DB_SHARD1_PORT || '5432'), database: 'conveyor_db_shard1' },
            { id: 1, name: 'Shard-Node-2', host: process.env.DB_SHARD2_HOST || 'localhost', port: parseInt(process.env.DB_SHARD2_PORT || '5433'), database: 'conveyor_db_shard2' }
        ];

        this.pools = new Map();
        this.isMockMode = false;
        this.mockStorage = new Map(); // Dùng lưu trữ tạm nếu DB chưa bật Docker
    }

    /**
     * Khởi tạo Connection Pools đến tất cả các DB Shards
     */
    async initialize() {
        console.log('🔌 [ShardRouter] Đang kết nối đến các Database Shard Nodes...');
        for (const config of this.shardConfigs) {
            try {
                const pool = new Pool({
                    host: config.host,
                    port: config.port,
                    user: process.env.DB_USER || 'postgres',
                    password: process.env.DB_PASSWORD || 'postgres_password',
                    database: config.database,
                    max: 20, // Connection pool limit
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 2000
                });

                // Test connection
                await pool.query('SELECT 1');
                this.pools.set(config.id, pool);
                console.log(`✅ [ShardRouter] Kết nối thành công đến ${config.name} (${config.host}:${config.port}/${config.database})`);
            } catch (err) {
                console.warn(`⚠️ [ShardRouter] Không thể kết nối DB ${config.name} (${config.port}). Kích hoạt Chế độ Mock Storage tự động!`);
                this.isMockMode = true;
            }
        }

        if (this.isMockMode) {
            console.log('⚡ [ShardRouter] Đang chạy ở Chế độ Mô Phỏng In-Memory Sharding Router!');
            for (const config of this.shardConfigs) {
                this.mockStorage.set(config.id, []);
            }
        }
    }

    /**
     * Thuật toán Shard Hashing: Định vị Shard ID từ scale_id
     * @param {string} scaleId Mã định danh Cân băng tải (VD: 'scale_101')
     * @returns {number} Shard Index (0, 1, ...)
     */
    getShardId(scaleId) {
        if (!scaleId) return 0;
        let hash = 0;
        for (let i = 0; i < scaleId.length; i++) {
            hash = (hash << 5) - hash + scaleId.charCodeAt(i);
            hash |= 0; // Convert to 32-bit int
        }
        const shardId = Math.abs(hash) % this.shardConfigs.length;
        return shardId;
    }

    /**
     * Thực thi câu lệnh Query trên Shard thích hợp
     */
    async queryShard(scaleId, text, params = []) {
        const shardId = this.getShardId(scaleId);
        const config = this.shardConfigs[shardId];

        if (this.isMockMode) {
            const data = this.mockStorage.get(shardId) || [];
            const filtered = data.filter(item => item.scale_id === scaleId);
            return {
                rows: filtered.slice(0, 50),
                shardNode: config.name,
                shardId: shardId
            };
        }

        const pool = this.pools.get(shardId);
        const res = await pool.query(text, params);
        return {
            rows: res.rows,
            shardNode: config.name,
            shardId: shardId
        };
    }

    /**
     * Ghi Bulk Batch Data xuống DB Shard tương ứng
     * @param {Array} rows Danh sách record telemetry
     */
    async bulkInsert(rows) {
        if (!rows || rows.length === 0) return { inserted: 0 };

        // 1. Phân nhóm dữ liệu theo Shard Node
        const groupedByShard = new Map();
        for (const row of rows) {
            const shardId = this.getShardId(row.scale_id);
            if (!groupedByShard.has(shardId)) {
                groupedByShard.set(shardId, []);
            }
            groupedByShard.get(shardId).push(row);
        }

        let totalInserted = 0;

        // 2. Ghi song song vào từng Shard Node
        for (const [shardId, shardRows] of groupedByShard.entries()) {
            const config = this.shardConfigs[shardId];

            if (this.isMockMode) {
                const store = this.mockStorage.get(shardId);
                store.push(...shardRows);
                totalInserted += shardRows.length;
                console.log(`💾 [Mock DB ${config.name}] Ghi Bulk Batch thành công ${shardRows.length} bản ghi vào Shard ${shardId}`);
                continue;
            }

            // Ghi SQL Bulk Insert vào PostgreSQL Shard với Partitioning
            const pool = this.pools.get(shardId);
            const valueStrings = [];
            const values = [];
            let paramIdx = 1;

            for (const r of shardRows) {
                valueStrings.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
                values.push(
                    r.scale_id,
                    r.weight_kg,
                    r.speed_mps,
                    r.flow_rate_tph,
                    r.totalizer_kg,
                    r.status_code || 0,
                    r.created_at || new Date().toISOString()
                );
            }

            const queryText = `
                INSERT INTO conveyor_weight_logs 
                (scale_id, weight_kg, speed_mps, flow_rate_tph, totalizer_kg, status_code, created_at)
                VALUES ${valueStrings.join(', ')}
            `;

            try {
                await pool.query(queryText, values);
                totalInserted += shardRows.length;
                console.log(`💾 [DB ${config.name}] Bulk Insert thành công ${shardRows.length} bản ghi vào DB Partition`);
            } catch (err) {
                console.error(`❌ [DB ${config.name}] Bulk Insert thất bại:`, err.message);
            }
        }

        return { inserted: totalInserted };
    }

    /**
     * Đóng tất cả kết nối pool khi ứng dụng tắt
     */
    async close() {
        for (const [shardId, pool] of this.pools.entries()) {
            await pool.end();
        }
    }
}

module.exports = new ShardRouter();
