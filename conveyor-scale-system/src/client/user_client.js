/**
 * NGƯỜI DÙNG CLIENT / DASHBOARD SIMULATOR
 * Thực hiện yêu cầu giám sát trạng thái thời gian thực & truy vấn báo cáo lịch sử
 */

const http = require('http');

class UserDashboardClient {
    constructor(baseUrl = 'http://localhost:4000') {
        this.baseUrl = baseUrl;
    }

    /**
     * 1. Người dùng xem Trạng thái Live tức thì (< 1ms từ Redis RAM)
     */
    async getLiveStatus(scaleId) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            http.get(`${this.baseUrl}/api/v1/user/scale-status/${scaleId}`, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    const elapsed = Date.now() - start;
                    try {
                        const parsed = JSON.parse(body);
                        parsed.client_latency_ms = elapsed;
                        resolve(parsed);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * 2. Người dùng truy vấn Lịch sử cân (Từ PostgreSQL Sharded DB)
     */
    async getHistoryAnalytics(scaleId, limit = 10) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            http.get(`${this.baseUrl}/api/v1/user/scale-history/${scaleId}?limit=${limit}`, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    const elapsed = Date.now() - start;
                    try {
                        const parsed = JSON.parse(body);
                        parsed.client_latency_ms = elapsed;
                        resolve(parsed);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }
}

module.exports = UserDashboardClient;
