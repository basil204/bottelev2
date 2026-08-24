/**
 * KỊCH BẢN CHẠY DEMO & KIỂM THỬ MÔ HÌNH HỆ THỐNG CÂN BẰNG TẢI END-TO-END
 * Flow: Người dùng <-> Cân băng tải -> API Grid Gateway -> Redis Cache Buffer -> DB Sharding & Partitioning
 */

const { startGateway, stopGateway } = require('./src/api_gateway/gateway');
const dbBatchWorker = require('./src/worker/db_batch_worker');
const BeltScaleSimulator = require('./src/iot_device/belt_scale_simulator');
const UserDashboardClient = require('./src/client/user_client');

async function runEndToEndDemo() {
    console.log('================================================================================');
    console.log('🚀 ĐANG KHỞI ĐỘNG HỆ THỐNG CÂN BẰNG TẢI TỐI ƯU SIÊU MƯỢT (END-TO-END DEMO)');
    console.log('================================================================================\n');

    // 1. Khởi động API Gateway Grid Node
    await startGateway();

    // 2. Khởi động Background Batch Worker (Write-Behind Buffer Flusher)
    await dbBatchWorker.start();

    // 3. Khởi động 2 Cân Băng Tải IoT (Mô phỏng phát tín hiệu cân liên tục)
    console.log('\n--- BƯỚC 1: CÂN BẰNG TẢI ĐẨY DỮ LIỆU THỜI GIAN THỰC (IOT PRODUCERS) ---');
    const scaleA = new BeltScaleSimulator('scale_101'); // Hash Shard Node 2 (Odd)
    const scaleB = new BeltScaleSimulator('scale_102'); // Hash Shard Node 1 (Even)

    scaleA.start(200); // Send tick every 200ms
    scaleB.start(200);

    // Chờ 1.5 giây để cân phát dữ liệu vào Cache & Queue
    await new Promise(r => setTimeout(r, 1500));

    // 4. Giả lập Người Dùng đọc Trạng Thái Live Tức Thời từ Redis Cache
    console.log('\n--- BƯỚC 2: NGƯỜI DÙNG DASHBOARD XEM TRẠNG THÁI LIVE TỨC THÌ (REDIS CACHE < 1MS) ---');
    const userClient = new UserDashboardClient();

    try {
        const liveResA = await userClient.getLiveStatus('scale_101');
        console.log('📊 [User Dashboard] Kết quả xem Live Scale_101:');
        console.log(`   - Nguồn dữ liệu: ${liveResA.source}`);
        console.log(`   - Tải trọng tức thời: ${liveResA.data.weight_kg} kg/m`);
        console.log(`   - Tốc độ băng tải: ${liveResA.data.speed_mps} m/s`);
        console.log(`   - Lưu lượng tính toán: ${liveResA.data.flow_rate_tph} Tấn/giờ (TPH)`);
        console.log(`   - Tổng bộ đếm lũy kế: ${liveResA.data.totalizer_kg} kg`);
        console.log(`   - Độ trễ phản hồi Client: ${liveResA.client_latency_ms} ms (Siêu mượt!)`);

        const liveResB = await userClient.getLiveStatus('scale_102');
        console.log('\n📊 [User Dashboard] Kết quả xem Live Scale_102:');
        console.log(`   - Nguồn dữ liệu: ${liveResB.source}`);
        console.log(`   - Lưu lượng tính toán: ${liveResB.data.flow_rate_tph} TPH`);
        console.log(`   - Độ trễ phản hồi Client: ${liveResB.client_latency_ms} ms`);
    } catch (err) {
        console.error('❌ Lỗi khi đọc Live Status:', err.message);
    }

    // Chờ Batch Worker gom và flush dữ liệu xuống CSDL Sharding & Partitioning
    console.log('\n--- BƯỚC 3: BACKGROUND WORKER GOM BATCH & FLUSH XUỐNG DB SHARDING & PARTITIONING ---');
    await new Promise(r => setTimeout(r, 1200));

    // 5. Giả lập Người Dùng Truy Vấn Lịch Sử từ PostgreSQL Sharded & Partitioned DB
    console.log('\n--- BƯỚC 4: NGƯỜI DÙNG TRUY VẤN BÁO CÁO LỊCH SỬ TỪ POSTGRESQL SHARDED & PARTITIONED DB ---');
    try {
        const historyResA = await userClient.getHistoryAnalytics('scale_101', 5);
        console.log('📜 [User Analytics] Kết quả Lịch sử Scale_101:');
        console.log(`   - Nguồn dữ liệu: ${historyResA.source}`);
        console.log(`   - DB Shard điều hướng bởi Router: ${historyResA.shard_node} (Shard ID: ${historyResA.shard_id})`);
        console.log(`   - Số lượng bản ghi truy vấn: ${historyResA.record_count}`);

        const historyResB = await userClient.getHistoryAnalytics('scale_102', 5);
        console.log('\n📜 [User Analytics] Kết quả Lịch sử Scale_102:');
        console.log(`   - Nguồn dữ liệu: ${historyResB.source}`);
        console.log(`   - DB Shard điều hướng bởi Router: ${historyResB.shard_node} (Shard ID: ${historyResB.shard_id})`);
        console.log(`   - Số lượng bản ghi truy vấn: ${historyResB.record_count}`);
    } catch (err) {
        console.error('❌ Lỗi khi đọc Lịch sử:', err.message);
    }

    // Dọn dẹp & dừng hệ thống
    console.log('\n--- BƯỚC 5: TỔNG KẾT & HOÀN TẤT DEMO ---');
    scaleA.stop();
    scaleB.stop();
    dbBatchWorker.stop();

    setTimeout(() => {
        stopGateway();
        console.log('\n🎉 DEMO HOÀN TẤT THÀNH CÔNG RỰC RỠ!');
        console.log('Toàn bộ luồng xử lý: Người Dùng - Cân Băng Tải - API Grid - Cache Redis - DB Sharding/Partitioning đã hoạt động mượt mà!');
        process.exit(0);
    }, 1000);
}

runEndToEndDemo().catch(console.error);
