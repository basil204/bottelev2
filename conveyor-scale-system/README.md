# 🏭 Conveyor Belt Scale Telemetry Architecture System
### Hệ thống Cân Băng Tải Xử Lý Hiệu Năng Cao: Người Dùng -> Cân Băng Tải -> Lưới API -> Redis Cache Buffer -> DB Partitioning & Sharding Router

Project này hiện thực hóa toàn bộ luồng xử lý và kiến trúc tối ưu hóa CSDL siêu mượt cho bài toán cân băng tải với tốc độ đẩy dữ liệu cao (High Frequency Stream Processing).

---

## 📐 Kiến trúc Luồng Dữ Liệu (Data Flow & System Topology)

```
+------------------+         +----------------------------+
| 1. Người Dùng    | <-----> | 3. Lưới API                |
| (Dashboard / UI) |         | (API Gateway Grid Node)    |
+------------------+         +----------------------------+
                                      |            |
+------------------+                  | (Live)     | (Stream)
| 2. Cân Băng Tải  | -----------------+            v
| (IoT Simulators) |                      +----------------------+
+------------------+                      | 4. Cache (Redis RAM) |
                                          | - Live HSET (< 1ms)  |
                                          | - Write-Behind Queue |
                                          +----------------------+
                                                   |
                                                   v (Batch Flush 1s)
                                          +----------------------+
                                          | 5. DB Shard Router   |
                                          +----------------------+
                                             /                \
                                            v                  v
                              +--------------------+  +--------------------+
                              | Postgres Shard 1   |  | Postgres Shard 2   |
                              | (Table Partitions  |  | (Table Partitions  |
                              |  + BRIN Index)     |  |  + BRIN Index)     |
                              +--------------------+  +--------------------+
```

---

## ⚡ Các Kỹ Thuật Tối Ưu CSDL & Hệ Thống Siêu Mượt (Optimizations)

1. **Redis Write-Behind Buffer Pattern**:
   - Dữ liệu cảm biến từ cân đẩy liên tục (100ms - 500ms) được nạp trực tiếp vào hàng đợi **Redis Queue (In-Memory)**.
   - `DbBatchWorker` chạy ngầm gom thành các lô (Batch 500-1,000 bản ghi) để thực hiện `INSERT BULK` duy nhất vào SQL DB mỗi giây.
   - **Kết quả**: Giảm đến 99% Write IOPS cho đĩa cứng DB SQL.

2. **Tách biệt Đọc Tức thì (Live) & Đọc Lịch sử (Analytics)**:
   - Live Dashboard đọc trọng lượng, tốc độ, tổng tích lũy **100% từ Redis Cache (`< 1ms`)**, tuyệt đối KHÔNG làm phiền SQL DB.

3. **PostgreSQL Native Table Partitioning (Phân vùng theo Thời gian)**:
   - Bảng `conveyor_weight_logs` được chia thành các Sub-table theo **Tháng/Ngày** (`conveyor_weight_logs_2026_08`).
   - Giúp câu lệnh SQL Range Query quét trực tiếp trên 1 Partition nhỏ thay vì bảng khổng lồ hàng trăm triệu dòng.
   - Xóa dữ liệu cũ > 90 ngày bằng lệnh `DROP TABLE partition_name` cực nhanh trong **1ms**.

4. **BRIN Index (Block Range Index)**:
   - Dữ liệu cân là dữ liệu time-series ghi nối tiếp.
   - **BRIN Index** trên cột `created_at` tiết kiệm **99% RAM & Disk** so với chỉ mục B-Tree truyền thống mà vẫn giữ tốc độ tìm kiếm cực nhanh.

5. **Horizontal Database Sharding**:
   - `ShardRouter` thực hiện thuật toán Hash trên `scale_id` để phân bổ dữ liệu cân đều ra **nhiều Server/Node DB độc lập** (Shard Node 1, Shard Node 2,...).

---

## 📁 Cấu Trúc Mã Nguồn Project

```
conveyor-scale-system/
├── docker-compose.yml              # Môi trường Redis & 2 DB Postgres Shard Nodes
├── package.json                    # Khai báo dependency
├── README.md                       # Tài liệu hướng dẫn kiến trúc & chạy thử
├── test_flow.js                    # Script chạy kiểm thử toàn bộ luồng End-to-End
└── src/
    ├── api_gateway/                # 3. Lưới API Grid Node (Express Gateway)
    │   └── gateway.js
    ├── cache/                      # 4. Cache & Write-Behind Queue Engine (Redis)
    │   └── redis_cache.js
    ├── client/                     # 1. Dashboard Client phía Người Dùng
    │   └── user_client.js
    ├── database/                   # 5. Database Layer (Partitions & Sharding Router)
    │   ├── schema_partitioning.sql  # Partitioning + BRIN Index Schema SQL
    │   └── shard_router.js         # Horizontal Sharding Router by scale_id
    ├── iot_device/                 # 2. Simulator Cân Băng Tải IoT (Sensor Stream)
    │   └── belt_scale_simulator.js
    └── worker/                     # Background Batch Worker (Write-Behind Flusher)
        └── db_batch_worker.js
```

---

## 🚀 Hướng Dẫn Chạy & Kiểm Thử

### Cách 1: Chạy Demo Mô Phỏng Ngay Lập Tức (Tự động kích hoạt In-Memory Mock nếu không có Docker)
```bash
npm run test:flow
# hoặc
node test_flow.js
```

### Cách 2: Chạy Môi Trường Đầy Đủ Với Docker (Redis + 2 PostgreSQL Shard Nodes)

1. **Bật Container DB & Redis**:
```bash
docker-compose up -d
```

2. **Chạy kịch bản Demo**:
```bash
node test_flow.js
```
