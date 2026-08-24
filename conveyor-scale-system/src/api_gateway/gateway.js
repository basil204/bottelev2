/**
 * LƯỚI API (API GATEWAY GRID NODE)
 * Tiếp nhận Telemetry từ Cân băng tải & Phục vụ truy vấn cho Người Dùng
 */

const express = require('express');
const cors = require('cors');
const redisCache = require('../cache/redis_cache');
const shardRouter = require('../database/shard_router');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.GATEWAY_PORT || 4000;

// Middleware log request
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.originalUrl !== '/health') {
            console.log(`🌐 [API Grid] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
        }
    });
    next();
});

// ============================================================================
// 1. INGESTION API (Dành cho Cân Băng Tải - Push telemetry 100ms - 1s)
// ============================================================================
app.post('/api/v1/telemetry/scale-data', async (req, res) => {
    try {
        const { scale_id, weight_kg, speed_mps, totalizer_kg, status_code } = req.body;

        if (!scale_id || weight_kg === undefined || speed_mps === undefined) {
            return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: scale_id, weight_kg, speed_mps' });
        }

        // Tính toán lưu lượng tức thời (TPH - Tonnes Per Hour)
        // Flow Rate (kg/s) = Weight (kg/m) * Speed (m/s) -> TPH = kg/s * 3.6
        const flow_rate_tph = parseFloat((weight_kg * speed_mps * 3.6).toFixed(2));

        const scalePayload = {
            scale_id,
            weight_kg: parseFloat(weight_kg),
            speed_mps: parseFloat(speed_mps),
            flow_rate_tph,
            totalizer_kg: parseFloat(totalizer_kg || 0),
            status_code: status_code || 0,
            created_at: new Date().toISOString()
        };

        // A. Cập nhật Trạng thái Tức thì vào Redis Live Cache (< 1ms)
        await redisCache.setLatestScaleStatus(scale_id, scalePayload);

        // B. Đẩy vào Redis Write-Behind Queue để gom Batch ghi CSDL
        await redisCache.pushToBatchQueue(scalePayload);

        // Đánh hồi đáp nhanh ngay lập tức cho IoT Device
        return res.status(200).json({
            success: true,
            message: 'Đã nhận telemetry cân thành công (Cached & Queued)',
            flow_rate_tph
        });
    } catch (err) {
        console.error('❌ [API Grid] Lỗi tiếp nhận Telemetry:', err);
        return res.status(500).json({ error: 'Internal Gateway Error' });
    }
});


// ============================================================================
// 2. USER DASHBOARD API (Dành cho Người Dùng xem trạng thái Live)
// ĐẢM BẢO 100% ĐỌC TỪ REDIS RAM (< 1ms) - KHÔNG CHẠM VÀO SQL DATABASE
// ============================================================================
app.get('/api/v1/user/scale-status/:scaleId', async (req, res) => {
    try {
        const { scaleId } = req.params;

        // Đọc trực tiếp từ Redis Cache
        const liveStatus = await redisCache.getLatestScaleStatus(scaleId);

        if (!liveStatus) {
            return res.status(404).json({
                success: false,
                message: `Không tìm thấy dữ liệu tức thì cho Cân ${scaleId} trong Cache`
            });
        }

        const shardId = shardRouter.getShardId(scaleId);

        return res.status(200).json({
            success: true,
            source: 'Redis In-Memory Live Cache (< 1ms)',
            target_db_shard: `Shard-Node-${shardId + 1}`,
            data: liveStatus
        });
    } catch (err) {
        console.error('❌ [API Grid] Lỗi lấy Live Status:', err);
        return res.status(500).json({ error: 'Internal Gateway Error' });
    }
});


// ============================================================================
// 3. USER ANALYTICS & HISTORY API (Dành cho Người Dùng xem Lịch sử)
// ĐIỀU HƯỚNG BỞI SHARD ROUTER ĐẾN ĐÚNG SHARD NODE & PARTITION SQL DB
// ============================================================================
app.get('/api/v1/user/scale-history/:scaleId', async (req, res) => {
    try {
        const { scaleId } = req.params;
        const limit = parseInt(req.query.limit || '20');

        const queryText = `
            SELECT log_id, scale_id, weight_kg, speed_mps, flow_rate_tph, totalizer_kg, created_at
            FROM conveyor_weight_logs
            WHERE scale_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `;

        // Truy vấn thông qua Shard Router
        const result = await shardRouter.queryShard(scaleId, queryText, [scaleId, limit]);

        return res.status(200).json({
            success: true,
            source: 'PostgreSQL Partitioned & Sharded DB',
            shard_node: result.shardNode,
            shard_id: result.shardId,
            record_count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        console.error('❌ [API Grid] Lỗi truy vấn Lịch sử:', err);
        return res.status(500).json({ error: 'Internal Gateway Error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'API Grid Node OK', timestamp: new Date().toISOString() });
});

let server = null;

async function startGateway() {
    await redisCache.initialize();
    await shardRouter.initialize();

    return new Promise((resolve) => {
        server = app.listen(PORT, () => {
            console.log(`🚀 [Lưới API Gateway] Đang lắng nghe tại http://localhost:${PORT}`);
            resolve(server);
        });
    });
}

function stopGateway() {
    if (server) {
        server.close();
    }
}

if (require.main === module) {
    startGateway();
}

module.exports = { app, startGateway, stopGateway };
