/**
 * Check ChatGPT account subscription/date
 * @param {string} accountId - ChatGPT account ID
 * @param {string} authorization - Bearer token
 * @param {string} cookies - Cookie string for Cloudflare bypass (optional)
 * @returns {Promise<Object>} Result object with success status and subscription data
 */
async function checkChatGPTDate(accountId, authorization, cookies = null) {
    try {
      const url = `https://chatgpt.com/backend-api/subscriptions?account_id=${accountId}`;
      
      const { buildHeaders, isCloudflareChallenge } = require('./http-helper.js');
      // GET requests don't need content-type
      const headers = buildHeaders(accountId, authorization, 'https://chatgpt.com/admin', cookies, false);
  
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        
        // Kiểm tra Cloudflare challenge (403 với HTML)
        if (isCloudflareChallenge(response, errorText)) {
          return {
            success: false,
            error: `⚠️ Cloudflare đang chặn yêu cầu (HTTP 403). Đây là vấn đề bảo mật từ Cloudflare, không phải lỗi token. Giải pháp: Sử dụng cookies từ trình duyệt (đặc biệt là cookie cf_clearance) hoặc thử lại sau vài phút.`,
            statusCode: response.status,
            cloudflareBlocked: true
          };
        }
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = errorText;
        }
        
        // Kiểm tra lỗi token invalidated
        if (response.status === 401) {
          const errorMessage = errorData?.detail?.error?.message || errorData?.error?.message || errorData?.message || 'Token đã hết hạn';
          const errorCode = errorData?.detail?.error?.code || errorData?.error?.code;
          
          if (errorCode === 'token_invalidated' || errorMessage.includes('invalidated') || errorMessage.includes('expired')) {
            return {
              success: false,
              error: `⚠️ Token đã hết hạn hoặc không hợp lệ. Vui lòng cập nhật token mới trong phần "Thêm tài khoản business". Chi tiết: ${errorMessage}`,
              statusCode: response.status,
              data: errorData,
              tokenExpired: true
            };
          } else {
            return {
              success: false,
              error: `⚠️ Lỗi xác thực (401): ${errorMessage}. Vui lòng kiểm tra lại token.`,
              statusCode: response.status,
              data: errorData,
              tokenExpired: true
            };
          }
        }
        
        // Xử lý lỗi 403 khác (không phải Cloudflare challenge)
        if (response.status === 403) {
          return {
            success: false,
            error: `⚠️ Truy cập bị từ chối (HTTP 403). Có thể do quyền hạn không đủ hoặc token không hợp lệ.`,
            statusCode: response.status,
            data: errorData
          };
        }
        
        // Giới hạn độ dài error message để tránh log quá dài
        const errorMessage = typeof errorData === 'string' 
          ? (errorData.length > 500 ? errorData.substring(0, 500) + '...' : errorData)
          : (errorData.error?.message || errorData.message || `HTTP ${response.status}: Không thể lấy thông tin subscription`);
        
        return {
          success: false,
          error: errorMessage,
          statusCode: response.status,
          data: errorData
        };
      }
  
      const data = await response.json();
  
      return {
        success: true,
        data: data,
        message: 'Lấy thông tin subscription thành công'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Lỗi khi kiểm tra subscription',
        details: error
      };
    }
  }
  
  module.exports = checkChatGPTDate;
  