import { query } from '../database/index.js';

/**
 * Validate and calculate discount for a Coupon Code
 * @param {string} code Coupon Code
 * @param {number} userId User ID
 * @param {number} productId Product ID
 * @param {number} orderAmount Total purchase amount in VND
 */
export async function validateAndApplyCoupon(code, userId, productId, orderAmount) {
    if (!code || typeof code !== 'string' || !code.trim()) {
        return { valid: false, reason: 'Vui lòng nhập mã giảm giá hợp lệ.' };
    }

    const cleanCode = code.trim().toUpperCase();

    try {
        const rows = await query(
            `SELECT * FROM coupons WHERE UPPER(code) = ? AND (is_active = 1 OR is_active IS NULL) LIMIT 1`,
            [cleanCode]
        );

        if (!rows || rows.length === 0) {
            return { valid: false, reason: 'Mã giảm giá không tồn tại hoặc đã bị khóa.' };
        }

        const coupon = rows[0];

        // 1. Kiểm tra thời gian hiệu lực
        const now = new Date();
        if (coupon.start_time && new Date(coupon.start_time) > now) {
            return { valid: false, reason: 'Mã giảm giá chưa đến thời gian sử dụng.' };
        }
        if (coupon.end_time && new Date(coupon.end_time) < now) {
            return { valid: false, reason: 'Mã giảm giá đã hết hạn sử dụng.' };
        }

        // 2. Kiểm tra giới hạn lượt dùng
        if (coupon.max_uses && coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) {
            return { valid: false, reason: 'Mã giảm giá đã hết lượt sử dụng.' };
        }

        // 3. Kiểm tra sản phẩm áp dụng
        if (coupon.product_id && Number(coupon.product_id) !== Number(productId)) {
            return { valid: false, reason: 'Mã giảm giá không áp dụng cho sản phẩm này.' };
        }

        // 4. Kiểm tra đơn hàng tối thiểu
        if (coupon.min_order_amount && orderAmount < Number(coupon.min_order_amount)) {
            return {
                valid: false,
                reason: `Đơn hàng tối thiểu để áp dụng mã là ${Number(coupon.min_order_amount).toLocaleString('vi-VN')} VNĐ.`
            };
        }

        // 5. Tính toán số tiền được giảm
        let discountAmount = 0;
        const discountType = coupon.discount_type || (coupon.discount_percent ? 'percent' : 'fixed');
        const discountValue = Number(coupon.discount_value || coupon.discount_percent || coupon.discount_amount || 0);

        if (discountType === 'percent' || coupon.discount_percent) {
            discountAmount = Math.floor(orderAmount * (discountValue / 100));
            if (coupon.max_discount_amount && discountAmount > Number(coupon.max_discount_amount)) {
                discountAmount = Number(coupon.max_discount_amount);
            }
        } else {
            discountAmount = Math.min(orderAmount, discountValue);
        }

        const finalAmount = Math.max(0, orderAmount - discountAmount);

        return {
            valid: true,
            coupon,
            code: cleanCode,
            discountAmount,
            finalAmount
        };

    } catch (err) {
        console.error('[COUPON_VAL_ERR]', err);
        return { valid: false, reason: 'Lỗi kiểm tra mã giảm giá trên máy chủ.' };
    }
}

/**
 * Ghi nhận lượt sử dụng mã giảm giá
 */
export async function recordCouponUsage(couponId) {
    if (!couponId) return;
    try {
        await query('UPDATE coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE id = ?', [couponId]);
    } catch (err) {
        console.error('[COUPON_RECORD_ERR]', err);
    }
}
