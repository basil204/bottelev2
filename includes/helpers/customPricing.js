import { query } from '../database/index.js';

/**
 * Gets custom price for a user and product if configured in custom_pricing table.
 * Returns default price if no active custom price exists.
 */
export const getUserProductPrice = async (userId, productId, defaultPrice, isApiCall = false) => {
  const numDefault = Number(defaultPrice) || 0;
  if (!userId || !productId) return numDefault;

  try {
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
      if (cp.scope === 'CLIENT_API' && !isApiCall) {
        return numDefault;
      }

      if (cp.scope === 'FIRST_ORDER') {
        const orders = await query(`
          SELECT COUNT(*) as count FROM orders 
          WHERE (user_id = ? OR user_id = (SELECT id FROM users WHERE telegram_id = ? LIMIT 1)) 
            AND product_id = ? AND status = 'completed'
        `, [userId, userId, productId]);

        if (orders && orders[0]?.count > 0) {
          return numDefault;
        }
      }
      return Number(cp.custom_price);
    }
  } catch (e) {
    if (e.code !== 'ER_NO_SUCH_TABLE') {
      console.error('[CUSTOM_PRICING] Error fetching custom price:', e.message);
    }
  }
  return numDefault;
};
