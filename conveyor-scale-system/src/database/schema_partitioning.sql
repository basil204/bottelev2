-- ============================================================================
-- KIẾN TRÚC CƠ SỞ DỮ LIỆU CÂN BẰNG TẢI: TABLE PARTITIONING & BRIN INDEXING
-- Áp dụng cho từng DB Shard Node (Shard 1, Shard 2,...)
-- ============================================================================

-- 1. Tạo bảng chính (Parent Partition Table) phân vùng theo Khoảng thời gian (RANGE partitioning)
CREATE TABLE IF NOT EXISTS conveyor_weight_logs (
    log_id UUID DEFAULT gen_random_uuid(),
    scale_id VARCHAR(50) NOT NULL,            -- Mã định danh Cân băng tải (e.g., 'scale_101')
    weight_kg NUMERIC(10, 2) NOT NULL,        -- Tải trọng tức thời trên băng (kg/m)
    speed_mps NUMERIC(6, 2) NOT NULL,         -- Tốc độ băng tải (m/s)
    flow_rate_tph NUMERIC(10, 2) NOT NULL,    -- Lưu lượng tức thời (Tấn/giờ - Tonnes Per Hour)
    totalizer_kg NUMERIC(15, 2) NOT NULL,     -- Tổng tích lũy của bộ cộng dồn (kg)
    status_code INT DEFAULT 0,                 -- Trạng thái vận hành (0: OK, 1: Overload, 2: Belt Deviation, 3: Sensor Err)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (log_id, created_at)
) PARTITION BY RANGE (created_at);

-- 2. Khởi tạo các Phân vùng (Partitions) theo Tháng (Monthly Partitions)
-- Phân vùng Tháng 8/2026
CREATE TABLE IF NOT EXISTS conveyor_weight_logs_2026_08 PARTITION OF conveyor_weight_logs
    FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');

-- Phân vùng Tháng 9/2026
CREATE TABLE IF NOT EXISTS conveyor_weight_logs_2026_09 PARTITION OF conveyor_weight_logs
    FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

-- Phân vùng Tháng 10/2026
CREATE TABLE IF NOT EXISTS conveyor_weight_logs_2026_10 PARTITION OF conveyor_weight_logs
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

-- Phân vùng mặc định cho dữ liệu tương lai (Default Partition)
CREATE TABLE IF NOT EXISTS conveyor_weight_logs_default PARTITION OF conveyor_weight_logs DEFAULT;


-- 3. CHỈ MỤC TỐI ƯU SIÊU MƯỢT (INDEXING OPTIMIZATION)

-- A. BRIN Index (Block Range Index) trên cột created_at:
-- Tối ưu 100x dung lượng RAM/Disk so với B-Tree cho dữ liệu ghi nối tiếp (Time-Series Append-only data).
CREATE INDEX IF NOT EXISTS idx_conveyor_logs_brin_created_at 
ON conveyor_weight_logs USING brin (created_at) WITH (pages_per_range = 32);

-- B. Composite B-Tree Index cho truy vấn lịch sử của 1 Cân băng tải cụ thể:
CREATE INDEX IF NOT EXISTS idx_conveyor_logs_scale_created 
ON conveyor_weight_logs (scale_id, created_at DESC);


-- 4. BẢNG TỔNG HỢP PRE-AGGREGATED (Summary Rollup Table)
-- Lưu trữ báo cáo nén theo giờ để xem thống kê nhanh mà không cần quét lại millions dòng log thô
CREATE TABLE IF NOT EXISTS conveyor_hourly_summary (
    summary_id BIGSERIAL PRIMARY KEY,
    scale_id VARCHAR(50) NOT NULL,
    hour_timestamp TIMESTAMPTZ NOT NULL,
    total_tonnes NUMERIC(12, 3) NOT NULL,      -- Tổng sản lượng trong giờ (Tấn)
    avg_speed_mps NUMERIC(6, 2) NOT NULL,      -- Tốc độ trung bình (m/s)
    avg_flow_tph NUMERIC(10, 2) NOT NULL,      -- Lưu lượng trung bình (TPH)
    max_weight_kg NUMERIC(10, 2) NOT NULL,     -- Tải trọng cực đại ghi nhận (kg)
    min_weight_kg NUMERIC(10, 2) NOT NULL,     -- Tải trọng nhỏ nhất (kg)
    sample_count INT NOT NULL,                 -- Số mẩu tin đo được trong giờ
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_scale_hour UNIQUE (scale_id, hour_timestamp)
);

CREATE INDEX IF NOT EXISTS idx_hourly_summary_scale_time 
ON conveyor_hourly_summary (scale_id, hour_timestamp DESC);
