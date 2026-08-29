// Helper functions for ChatGPT API operations

/**
 * Check ChatGPT account subscription/date
 */
export async function checkChatGPTDate(accountId, authorization) {
  const url = `https://chatgpt.com/backend-api/subscriptions?account_id=${accountId}`;
  
  const headers = {
    "accept": "application/json",
    "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "authorization": authorization,
    "chatgpt-account-id": accountId,
    "oai-client-version": "prod-9f5aa1f7b48d4577791d0e660bac1111ba132ee6",
    "oai-device-id": "588a8a2b-77ad-406d-a4d2-0e975ba09cb7",
    "oai-language": "vi-VN",
    "origin": "https://chatgpt.com",
    "priority": "u=1, i",
    "referer": "https://chatgpt.com/admin",
    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
  };

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle HTTP 401 - Token invalidated
      if (response.status === 401) {
        try {
          const errorData = JSON.parse(errorText);
          const errorMsg = errorData?.detail?.error?.message || errorData?.error?.message || 'Token đã bị vô hiệu hóa';
          const errorCode = errorData?.detail?.error?.code || errorData?.error?.code || 'token_invalidated';
          
          if (errorCode === 'token_invalidated' || errorMsg.includes('invalidated') || errorMsg.includes('signing in again')) {
            const shortError = 'Token xác thực đã hết hạn hoặc bị vô hiệu hóa. Vui lòng đăng nhập lại để lấy token mới.';
            console.error('[CHATGPT_CHECK_DATE] Error: HTTP 401 - Token invalidated');
            return { success: false, error: shortError, code: 'token_invalidated' };
          }
        } catch (e) {
          // If JSON parse fails, use default message
        }
        const shortError = 'Token xác thực không hợp lệ. Vui lòng kiểm tra lại authorization token.';
        console.error('[CHATGPT_CHECK_DATE] Error: HTTP 401 - Unauthorized');
        return { success: false, error: shortError, code: 'unauthorized' };
      }
      
      // Handle HTTP 403 - Cloudflare challenge or forbidden
      if (response.status === 403) {
        if (errorText.includes('cf-chl') || errorText.includes('challenge-platform') || errorText.includes('Enable JavaScript') || errorText.includes('<html>')) {
          const shortError = 'Cloudflare đang chặn yêu cầu. Vui lòng kiểm tra lại authorization token hoặc thử lại sau.';
          console.error('[CHATGPT_CHECK_DATE] Error: HTTP 403 - Cloudflare challenge detected');
          return { success: false, error: shortError, code: 'cloudflare_blocked' };
        }
        
        try {
          const errorData = JSON.parse(errorText);
          const errorMsg = errorData?.detail?.error?.message || errorData?.error?.message || 'Không có quyền truy cập';
          console.error('[CHATGPT_CHECK_DATE] Error: HTTP 403 - Forbidden:', errorMsg);
          return { success: false, error: errorMsg, code: 'forbidden' };
        } catch (e) {
          const shortError = 'Không có quyền truy cập. Vui lòng kiểm tra lại quyền của tài khoản.';
          console.error('[CHATGPT_CHECK_DATE] Error: HTTP 403 - Forbidden');
          return { success: false, error: shortError, code: 'forbidden' };
        }
      }
      
      // Handle other errors - try to parse JSON first
      let errorMessage;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData?.detail?.error?.message || errorData?.error?.message || JSON.stringify(errorData);
      } catch (e) {
        errorMessage = errorText.length > 500 ? errorText.substring(0, 500) + '... (truncated)' : errorText;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMessage}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    let errorMessage = error.message;
    if (errorMessage.length > 500) {
      errorMessage = errorMessage.substring(0, 500) + '... (truncated)';
    }
    
    console.error('[CHATGPT_CHECK_DATE] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Join email to ChatGPT account
 */
export async function joinChatGPTEmail(accountId, authorization, emailAddresses, role = 'standard-user', resendEmails = true) {
  const url = `https://chatgpt.com/backend-api/accounts/${accountId}/invites`;
  
  const headers = {
    "accept": "application/json",
    "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "authorization": authorization,
    "chatgpt-account-id": accountId,
    "content-type": "application/json",
    "oai-client-version": "prod-9f5aa1f7b48d4577791d0e660bac1111ba132ee6",
    "oai-device-id": "588a8a2b-77ad-406d-a4d2-0e975ba09cb7",
    "oai-language": "vi-VN",
    "origin": "https://chatgpt.com",
    "priority": "u=1, i",
    "referer": "https://chatgpt.com/admin/members",
    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
  };

  const body = {
    "email_addresses": Array.isArray(emailAddresses) ? emailAddresses : [emailAddresses],
    "role": role,
    "resend_emails": resendEmails
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle HTTP 401 - Token invalidated
      if (response.status === 401) {
        try {
          const errorData = JSON.parse(errorText);
          const errorMsg = errorData?.detail?.error?.message || errorData?.error?.message || 'Token đã bị vô hiệu hóa';
          const errorCode = errorData?.detail?.error?.code || errorData?.error?.code || 'token_invalidated';
          
          if (errorCode === 'token_invalidated' || errorMsg.includes('invalidated') || errorMsg.includes('signing in again')) {
            const shortError = 'Token xác thực đã hết hạn hoặc bị vô hiệu hóa. Vui lòng đăng nhập lại để lấy token mới.';
            console.error('[CHATGPT_JOIN] Error: HTTP 401 - Token invalidated');
            return { success: false, error: shortError, code: 'token_invalidated' };
          }
        } catch (e) {
          // If JSON parse fails, use default message
        }
        const shortError = 'Token xác thực không hợp lệ. Vui lòng kiểm tra lại authorization token.';
        console.error('[CHATGPT_JOIN] Error: HTTP 401 - Unauthorized');
        return { success: false, error: shortError, code: 'unauthorized' };
      }
      
      // Handle HTTP 403 - Cloudflare challenge or forbidden
      if (response.status === 403) {
        if (errorText.includes('cf-chl') || errorText.includes('challenge-platform') || errorText.includes('Enable JavaScript') || errorText.includes('<html>')) {
          const shortError = 'Cloudflare đang chặn yêu cầu. Vui lòng kiểm tra lại authorization token hoặc thử lại sau.';
          console.error('[CHATGPT_JOIN] Error: HTTP 403 - Cloudflare challenge detected');
          return { success: false, error: shortError, code: 'cloudflare_blocked' };
        }
        
        try {
          const errorData = JSON.parse(errorText);
          const errorMsg = errorData?.detail?.error?.message || errorData?.error?.message || 'Không có quyền truy cập';
          console.error('[CHATGPT_JOIN] Error: HTTP 403 - Forbidden:', errorMsg);
          return { success: false, error: errorMsg, code: 'forbidden' };
        } catch (e) {
          const shortError = 'Không có quyền truy cập. Vui lòng kiểm tra lại quyền của tài khoản.';
          console.error('[CHATGPT_JOIN] Error: HTTP 403 - Forbidden');
          return { success: false, error: shortError, code: 'forbidden' };
        }
      }
      
      // Handle other errors - try to parse JSON first
      let errorMessage;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData?.detail?.error?.message || errorData?.error?.message || JSON.stringify(errorData);
      } catch (e) {
        errorMessage = errorText.length > 500 ? errorText.substring(0, 500) + '... (truncated)' : errorText;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMessage}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    let errorMessage = error.message;
    if (errorMessage.length > 500) {
      errorMessage = errorMessage.substring(0, 500) + '... (truncated)';
    }
    console.error('[CHATGPT_JOIN] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete user from ChatGPT account
 */
export async function deleteChatGPTUser(accountId, authorization, userId) {
  const url = `https://chatgpt.com/backend-api/accounts/${accountId}/users/${userId}`;
  
  const headers = {
    "accept": "application/json",
    "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "authorization": authorization,
    "chatgpt-account-id": accountId,
    "oai-client-version": "prod-9f5aa1f7b48d4577791d0e660bac1111ba132ee6",
    "oai-device-id": "588a8a2b-77ad-406d-a4d2-0e975ba09cb7",
    "oai-language": "vi-VN",
    "origin": "https://chatgpt.com",
    "priority": "u=1, i",
    "referer": "https://chatgpt.com/admin/members",
    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
  };

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle HTTP 401 - Token invalidated
      if (response.status === 401) {
        try {
          const errorData = JSON.parse(errorText);
          const errorMsg = errorData?.detail?.error?.message || errorData?.error?.message || 'Token đã bị vô hiệu hóa';
          const errorCode = errorData?.detail?.error?.code || errorData?.error?.code || 'token_invalidated';
          
          if (errorCode === 'token_invalidated' || errorMsg.includes('invalidated') || errorMsg.includes('signing in again')) {
            const shortError = 'Token xác thực đã hết hạn hoặc bị vô hiệu hóa. Vui lòng đăng nhập lại để lấy token mới.';
            console.error('[CHATGPT_DELETE] Error: HTTP 401 - Token invalidated');
            return { success: false, error: shortError, code: 'token_invalidated' };
          }
        } catch (e) {
          // If JSON parse fails, use default message
        }
        const shortError = 'Token xác thực không hợp lệ. Vui lòng kiểm tra lại authorization token.';
        console.error('[CHATGPT_DELETE] Error: HTTP 401 - Unauthorized');
        return { success: false, error: shortError, code: 'unauthorized' };
      }
      
      // Handle HTTP 403 - Cloudflare challenge or forbidden
      if (response.status === 403) {
        if (errorText.includes('cf-chl') || errorText.includes('challenge-platform') || errorText.includes('Enable JavaScript') || errorText.includes('<html>')) {
          const shortError = 'Cloudflare đang chặn yêu cầu. Vui lòng kiểm tra lại authorization token hoặc thử lại sau.';
          console.error('[CHATGPT_DELETE] Error: HTTP 403 - Cloudflare challenge detected');
          return { success: false, error: shortError, code: 'cloudflare_blocked' };
        }
        
        try {
          const errorData = JSON.parse(errorText);
          const errorMsg = errorData?.detail?.error?.message || errorData?.error?.message || 'Không có quyền truy cập';
          console.error('[CHATGPT_DELETE] Error: HTTP 403 - Forbidden:', errorMsg);
          return { success: false, error: errorMsg, code: 'forbidden' };
        } catch (e) {
          const shortError = 'Không có quyền truy cập. Vui lòng kiểm tra lại quyền của tài khoản.';
          console.error('[CHATGPT_DELETE] Error: HTTP 403 - Forbidden');
          return { success: false, error: shortError, code: 'forbidden' };
        }
      }
      
      // Handle other errors - try to parse JSON first
      let errorMessage;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData?.detail?.error?.message || errorData?.error?.message || JSON.stringify(errorData);
      } catch (e) {
        errorMessage = errorText.length > 500 ? errorText.substring(0, 500) + '... (truncated)' : errorText;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMessage}`);
    }

    return { success: true };
  } catch (error) {
    let errorMessage = error.message;
    if (errorMessage.length > 500) {
      errorMessage = errorMessage.substring(0, 500) + '... (truncated)';
    }
    console.error('[CHATGPT_DELETE] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * List users in ChatGPT account
 */
export async function listChatGPTUsers(accountId, authorization, offset = 0, limit = 25, query = '') {
  const url = `https://chatgpt.com/backend-api/accounts/${accountId}/users?offset=${offset}&limit=${limit}&query=${encodeURIComponent(query)}`;
  
  const headers = {
    "accept": "application/json",
    "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "authorization": authorization,
    "chatgpt-account-id": accountId,
    "content-type": "application/json",
    "oai-client-version": "prod-9f5aa1f7b48d4577791d0e660bac1111ba132ee6",
    "oai-device-id": "588a8a2b-77ad-406d-a4d2-0e975ba09cb7",
    "oai-language": "vi-VN",
    "origin": "https://chatgpt.com",
    "priority": "u=1, i",
    "referer": "https://chatgpt.com/admin/members",
    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
  };

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle HTTP 401 - Token invalidated
      if (response.status === 401) {
        try {
          const errorData = JSON.parse(errorText);
          const errorMsg = errorData?.detail?.error?.message || errorData?.error?.message || 'Token đã bị vô hiệu hóa';
          const errorCode = errorData?.detail?.error?.code || errorData?.error?.code || 'token_invalidated';
          
          if (errorCode === 'token_invalidated' || errorMsg.includes('invalidated') || errorMsg.includes('signing in again')) {
            const shortError = 'Token xác thực đã hết hạn hoặc bị vô hiệu hóa. Vui lòng đăng nhập lại để lấy token mới.';
            console.error('[CHATGPT_LIST] Error: HTTP 401 - Token invalidated');
            return { success: false, error: shortError, code: 'token_invalidated' };
          }
        } catch (e) {
          // If JSON parse fails, use default message
        }
        const shortError = 'Token xác thực không hợp lệ. Vui lòng kiểm tra lại authorization token.';
        console.error('[CHATGPT_LIST] Error: HTTP 401 - Unauthorized');
        return { success: false, error: shortError, code: 'unauthorized' };
      }
      
      // Handle HTTP 403 - Cloudflare challenge or forbidden
      if (response.status === 403) {
        // Check if it's a Cloudflare challenge page
        if (errorText.includes('cf-chl') || errorText.includes('challenge-platform') || errorText.includes('Enable JavaScript') || errorText.includes('<html>')) {
          const shortError = 'Cloudflare đang chặn yêu cầu. Vui lòng kiểm tra lại authorization token hoặc thử lại sau.';
          console.error('[CHATGPT_LIST] Error: HTTP 403 - Cloudflare challenge detected');
          return { success: false, error: shortError, code: 'cloudflare_blocked' };
        }
        
        // Try to parse JSON error if available
        try {
          const errorData = JSON.parse(errorText);
          const errorMsg = errorData?.detail?.error?.message || errorData?.error?.message || 'Không có quyền truy cập';
          console.error('[CHATGPT_LIST] Error: HTTP 403 - Forbidden:', errorMsg);
          return { success: false, error: errorMsg, code: 'forbidden' };
        } catch (e) {
          // If not JSON, return generic forbidden message
          const shortError = 'Không có quyền truy cập. Vui lòng kiểm tra lại quyền của tài khoản.';
          console.error('[CHATGPT_LIST] Error: HTTP 403 - Forbidden');
          return { success: false, error: shortError, code: 'forbidden' };
        }
      }
      
      // Handle other errors - try to parse JSON first
      let errorMessage;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData?.detail?.error?.message || errorData?.error?.message || JSON.stringify(errorData);
      } catch (e) {
        // If not JSON, use text (truncate if too long)
        errorMessage = errorText.length > 500 ? errorText.substring(0, 500) + '... (truncated)' : errorText;
      }
      
      throw new Error(`HTTP ${response.status}: ${errorMessage}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    // Truncate error message if it's too long (likely HTML)
    let errorMessage = error.message;
    if (errorMessage.length > 500) {
      errorMessage = errorMessage.substring(0, 500) + '... (truncated)';
    }
    
    console.error('[CHATGPT_LIST] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

