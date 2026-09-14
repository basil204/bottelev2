import { query } from '../database/index.js';
import { getActiveFlashSaleForProduct } from './flashSaleHelper.js';

/**
 * Gets custom or flash sale price for a user and product.
 * Prioritizes active Flash Sale discounts or custom user pricing (whichever is more beneficial).
 */
export const getUserProductPrice = async (userId, productId, defaultPrice, isApiCall = false, quantity = 1) => {
  let finalPrice = Number(defaultPrice) || 0;
  if (!productId) return finalPrice;

  try {
    // 1. Check active Flash Sale
    const fsInfo = await getActiveFlashSaleForProduct(productId, quantity);
    if (fsInfo.hasFlashSale && fsInfo.finalPrice > 0) {
      finalPrice = fsInfo.finalPrice;
    }

    // 2. Check Custom User Pricing
    if (userId) {
      const rows = await query(`
        SELECT cp.* 
        FROM custom_pricing cp
        WHERE (cp.user_id = ? OR cp.user_id = (SELECT id FROM users WHERE telegram_id = ? LIMIT 1))
          AND cp.product_id = ?
          AND cp.is_active = 1
        ORDER BY cp.id DESC
        LIMIT 1
      `, [userId, userId, productId]);

      if (rows && rows.length > 0) {
        const cp = rows[0];

        // Nếu scope cài đặt là CLIENT_API nhưng đây không phải lượt mua qua API Key, bỏ qua giá này
        let canApply = true;
        if (cp.scope === 'CLIENT_API' && !isApiCall) {
          canApply = false;
        }

        if (cp.scope === 'FIRST_ORDER') {
          const orders = await query(`
            SELECT COUNT(*) as count FROM orders 
            WHERE (user_id = ? OR user_id = (SELECT id FROM users WHERE telegram_id = ? LIMIT 1)) 
              AND product_id = ? AND status = 'completed'
          `, [userId, userId, productId]);

          if (orders && orders[0]?.count > 0) {
            canApply = false;
          }
        }

        if (canApply && cp.custom_price > 0) {
          // Lấy mức giá tốt nhất (thấp nhất) giữa Custom Price và Flash Sale Price
          const customPrice = Number(cp.custom_price);
          finalPrice = Math.min(finalPrice, customPrice);
        }
      }
    }
  } catch (e) {
    if (e.code !== 'ER_NO_SUCH_TABLE') {
      console.error('[CUSTOM_PRICING] Error fetching price:', e.message);
    }
  }
  return finalPrice;
};
