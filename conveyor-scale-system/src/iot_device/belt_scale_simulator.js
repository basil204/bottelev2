/**
 * SIMULATOR CÂN BẰNG TẢI (IOT BELT SCALE SENSOR PRODUCER)
 * Giả lập phát dữ liệu cảm biến cân băng tải thời gian thực (Tải trọng, Tốc độ, Lũy kế)
 */

const http = require('http');

class BeltScaleSimulator {
    constructor(scaleId = 'scale_101', targetUrl = 'http://localhost:4000/api/v1/telemetry/scale-data') {
        this.scaleId = scaleId;
        this.targetUrl = targetUrl;
        this.isRunning = false;
        this.timer = null;

        // Trạng thái giả lập của Cân
        this.cumulativeTotalKg = 50000.0; // Totalizer bắt đầu từ 50 tấn
        this.baseWeightKg = 45.0;         // Tải trọng trung bình 45 kg/m
        this.baseSpeedMps = 2.5;          // Tốc độ băng 2.5 m/s
    }

    start(intervalMs = 300) {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log(`🏭 [Cân Bằng Tải ${this.scaleId}] Đang bắt đầu phát Telemetry (Tần suất: ${intervalMs}ms/lần)...`);

        this.timer = setInterval(() => {
            this.sendTelemetryTick();
        }, intervalMs);
    }

    /**
     * Tạo và gửi 1 mẩu tin Telemetry tức thời
     */
    async sendTelemetryTick() {
        // Tạo biến động nhỏ ngẫu nhiên cho tải trọng và tốc độ
        const weightFluctuation = (Math.random() - 0.5) * 5.0; // +/- 2.5 kg/m
        const speedFluctuation = (Math.random() - 0.5) * 0.2;  // +/- 0.1 m/s

        const weight_kg = Math.max(5.0, parseFloat((this.baseWeightKg + weightFluctuation).toFixed(2)));
        const speed_mps = Math.max(0.5, parseFloat((this.baseSpeedMps + speedFluctuation).toFixed(2)));

        // Khối lượng qua cân trong 1 giây (kg) = weight(kg/m) * speed(m/s)
        const addedWeight = weight_kg * speed_mps * 0.3; // 0.3s interval
        this.cumulativeTotalKg += addedWeight;

        const payload = JSON.stringify({
            scale_id: this.scaleId,
            weight_kg,
            speed_mps,
            totalizer_kg: parseFloat(this.cumulativeTotalKg.toFixed(2)),
            status_code: 0
        });

        // Gửi HTTP POST request đến API Grid Gateway
        const urlObj = new URL(this.targetUrl);
        const reqOpts = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = http.request(reqOpts, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => {
                // Success
            });
        });

        req.on('error', (err) => {
            // Silence grid errors in background
        });

        req.write(payload);
        req.end();
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.isRunning = false;
            console.log(`🛑 [Cân Bằng Tải ${this.scaleId}] Đã dừng phát Telemetry.`);
        }
    }
}

if (require.main === module) {
    const scale1 = new BeltScaleSimulator('scale_101');
    const scale2 = new BeltScaleSimulator('scale_102');
    scale1.start(500);
    scale2.start(500);
}

module.exports = BeltScaleSimulator;
