import { query } from '../database/index.js';

/**
 * Tra cứu thông tin Flash Sale đang hoạt động của sản phẩm
 * @param {number|string} productId 
 * @param {number} quantity 
 * @returns {Promise<{ hasFlashSale: boolean, saleId?: number, saleType?: string, salePrice?: number, bulkMinQty?: number, bulkPrice?: number, finalPrice?: number, originalPrice?: number, discountPercent?: number, endTime?: string, timeLeftStr?: string }>}
 */
export const getActiveFlashSaleForProduct = async (productId, quantity = 1) => {
  if (!productId) return { hasFlashSale: false };

  try {
    const rows = await query(`
      SELECT fs.*, p.price as original_price, p.name as product_name
      FROM flash_sales fs
      LEFT JOIN products p ON fs.product_id = p.id
      WHERE fs.product_id = ?
        AND fs.status = 'active'
        AND NOW() >= fs.start_time
        AND NOW() <= fs.end_time
      ORDER BY fs.id DESC
      LIMIT 1
    `, [productId]);

    if (!rows || rows.length === 0) {
      return { hasFlashSale: false };
    }

    const sale = rows[0];
    const originalPrice = Number(sale.original_price) || 0;
    let finalPrice = originalPrice;
    let isApplicable = false;

    if (sale.sale_type === 'BULK') {
      const minQty = Number(sale.bulk_min_qty) || 1;
      const bulkPrice = Number(sale.bulk_price) || 0;
      if (quantity >= minQty && bulkPrice > 0) {
        finalPrice = bulkPrice;
        isApplicable = true;
      }
    } else if (sale.sale_type === 'PERCENTAGE') {
      const discountPercent = Number(sale.discount_percent) || 0;
      if (discountPercent > 0 && originalPrice > 0) {
        finalPrice = Math.round(originalPrice * (1 - discountPercent / 100));
        isApplicable = true;
      }
    } else {
      // PRICE_SALE (mặc định)
      const salePrice = Number(sale.sale_price) || 0;
      if (salePrice > 0) {
        finalPrice = salePrice;
        isApplicable = true;
      }
    }

    if (!isApplicable) {
      return { hasFlashSale: false };
    }

    // Tính % giảm giá nếu có
    let discountPercent = 0;
    if (originalPrice > 0 && finalPrice < originalPrice) {
      discountPercent = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
    }

    // Tính thời gian còn lại
    const endTime = new Date(sale.end_time);
    const diffMs = endTime.getTime() - Date.now();
    let timeLeftStr = '';
    if (diffMs > 0) {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        timeLeftStr = `${days} ngày ${remHours}h`;
      } else {
        timeLeftStr = `${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
      }
    }

    return {
      hasFlashSale: true,
      saleId: sale.id,
      saleType: sale.sale_type,
      salePrice: Number(sale.sale_price) || 0,
      bulkMinQty: Number(sale.bulk_min_qty) || 0,
      bulkPrice: Number(sale.bulk_price) || 0,
      finalPrice,
      originalPrice,
      discountPercent,
      endTime: sale.end_time,
      timeLeftStr
    };
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('[FLASH_SALE] Lỗi tra cứu flash sale:', error.message);
    }
    return { hasFlashSale: false };
  }
};
