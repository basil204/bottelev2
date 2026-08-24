/**
 * BACKGROUND WRITE-BEHIND BATCH WORKER
 * Lấy danh sách telemetry từ Redis Buffer Queue và gom Bulk Insert xuống CSDL SQL theo Shard Router
 */

const redisCache = require('../cache/redis_cache');
const shardRouter = require('../database/shard_router');

class DbBatchWorker {
    constructor() {
        this.isRunning = false;
        this.timer = null;
        this.batchSize = 500; // Số lượng record gom trong 1 đợt ghi
        this.intervalMs = 1000; // Tần suất flush xuống DB (1 giây/lần)
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log(`⚙️ [DbBatchWorker] Đang khởi động Background Batch Flusher (Interval: ${this.intervalMs}ms, Max Batch: ${this.batchSize})...`);
        
        // Loop flush
        this.timer = setInterval(async () => {
            await this.flushBatch();
        }, this.intervalMs);
    }

    async flushBatch() {
        try {
            // 1. Rút batch dữ liệu từ Redis Write-Behind Queue
            const items = await redisCache.popBatchQueue(this.batchSize);

            if (!items || items.length === 0) {
                return;
            }

            console.log(`📦 [DbBatchWorker] Rút ${items.length} bản ghi từ Redis Buffer. Đang điều hướng đến Shard Nodes...`);

            // 2. Ghi Bulk Batch vào CSDL qua Shard Router
            const result = await shardRouter.bulkInsert(items);

            console.log(`✅ [DbBatchWorker] Đã gom và ghi thành công ${result.inserted} bản ghi vào DB Partitioned & Sharded!`);
        } catch (err) {
            console.error('❌ [DbBatchWorker] Lỗi khi xử lý flush batch:', err.message);
        }
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.isRunning = false;
            console.log('🛑 [DbBatchWorker] Đã dừng Background Batch Flusher.');
        }
    }
}

module.exports = new DbBatchWorker();
