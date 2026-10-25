import { getPool } from '../database/index.js';

// Pool is created in initDb(), so resolve it lazily at call time.
const pool = { query: (...args) => getPool().query(...args) };
import { updateBalance, getUserByTelegram, getUserById } from '../controllers/userController.js';
import axios from 'axios';

/**
 * Utility to extract nested property via dot notation like 'data.account.password'
 */
export function getNestedValue(obj, path) {
  if (!path || path.trim() === '' || path === '.') return obj;
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
}

/**
 * Replace placeholders like {key} with variable value
 */
export function replaceWorkflowVariables(str, variables = {}) {
  if (typeof str !== 'string') return str;
  let result = str;
  for (const [key, value] of Object.entries(variables)) {
    const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value !== undefined && value !== null ? value : '');
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), valStr);
  }
  return result;
}

/**
 * Fetch all active API workflows
 */
export async function getActiveApiWorkflows(categoryId = null) {
  try {
    let query = 'SELECT * FROM api_workflows WHERE is_active = 1';
    const params = [];
    if (categoryId) {
      query += ' AND category_id = ?';
      params.push(categoryId);
    }
    query += ' ORDER BY menu_row ASC, id ASC';
    const [rows] = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error('Error in getActiveApiWorkflows:', error);
    return [];
  }
}

/**
 * Fetch workflow by ID
 */
export async function getApiWorkflowById(id) {
  try {
    const [rows] = await pool.query('SELECT * FROM api_workflows WHERE id = ?', [id]);
    return rows[0] || null;
  } catch (error) {
    console.error('Error in getApiWorkflowById:', error);
    return null;
  }
}

/**
 * Execute Workflow API call and deliver output to user
 */
export async function executeApiWorkflow(workflow, userInputValues = {}, user) {
  const invoiceCode = 'WF' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);
  const cost = Number(workflow.price_vnd || 0);

  // Check balance
  if (Number(user.balance || 0) < cost) {
    return {
      success: false,
      code: 'INSUFFICIENT_BALANCE',
      error: `Số dư không đủ! Cần ${cost.toLocaleString('vi-VN')} VNĐ, hiện có ${Number(user.balance || 0).toLocaleString('vi-VN')} VNĐ.`
    };
  }

  // Deduct balance first
  if (cost > 0) {
    await updateBalance(user.id, -cost);
  }

  const allVariables = {
    ...userInputValues,
    user_id: user.telegram_id || user.id,
    username: user.username || 'user',
    user_fullname: user.fullname || user.name || '',
    invoice_code: invoiceCode,
    price: cost,
    price_formatted: cost.toLocaleString('vi-VN') + ' đ'
  };

  try {
    // 1. Prepare URL
    const finalUrl = replaceWorkflowVariables(workflow.api_url, allVariables);

    // 2. Prepare Headers
    let headersObj = {
      'Content-Type': 'application/json',
      'User-Agent': 'TelegramBot-APIWorkflow/1.0'
    };
    if (workflow.headers_json) {
      try {
        const parsed = typeof workflow.headers_json === 'string' ? JSON.parse(workflow.headers_json) : workflow.headers_json;
        for (const [k, v] of Object.entries(parsed)) {
          headersObj[k] = replaceWorkflowVariables(String(v), allVariables);
        }
      } catch (e) {
        console.warn('Invalid headers JSON in workflow:', e.message);
      }
    }

    // 3. Prepare Body
    let finalBody = null;
    const method = (workflow.http_method || 'POST').toUpperCase();
    if (method !== 'GET') {
      const bodyStr = typeof workflow.body_template === 'string' ? workflow.body_template : JSON.stringify(workflow.body_template || {});
      const substitutedBody = replaceWorkflowVariables(bodyStr, allVariables);
      try {
        finalBody = JSON.parse(substitutedBody);
      } catch {
        finalBody = substitutedBody;
      }
    }

    // 4. Send HTTP Request
    const response = await axios({
      method: method,
      url: finalUrl,
      headers: headersObj,
      data: finalBody,
      timeout: 30000,
      validateStatus: () => true // Allow handling custom status codes
    });

    const responseStatus = response.status;
    const responseData = response.data;

    // 5. Evaluate Success Condition
    let isSuccess = false;
    if (responseStatus >= 200 && responseStatus < 300) {
      // Default consider 2xx success unless explicit fail flag in body
      if (typeof responseData === 'object' && responseData !== null) {
        if (responseData.status === false || responseData.success === false || responseData.error) {
          isSuccess = false;
        } else {
          isSuccess = true;
        }
      } else {
        isSuccess = true;
      }
    }

    if (!isSuccess) {
      throw new Error(`API trả về trạng thái thất bại: HTTP ${responseStatus} - ${typeof responseData === 'object' ? JSON.stringify(responseData) : String(responseData)}`);
    }

    // 6. Extract data path
    let extractedData = responseData;
    if (workflow.response_data_path) {
      extractedData = getNestedValue(responseData, workflow.response_data_path);
      if (extractedData === undefined) extractedData = responseData;
    }

    // Format extracted for template display
    let formattedExtracted = '';
    if (Array.isArray(extractedData)) {
      formattedExtracted = extractedData.map((item, idx) => {
        if (typeof item === 'object') {
          return Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(' | ');
        }
        return `${idx + 1}. ${item}`;
      }).join('\n');
    } else if (typeof extractedData === 'object' && extractedData !== null) {
      formattedExtracted = Object.entries(extractedData).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');
    } else {
      formattedExtracted = String(extractedData || '');
    }

    // 7. Render Success Message
    const templateRenderVars = {
      ...allVariables,
      data: formattedExtracted,
      raw_data: typeof responseData === 'object' ? JSON.stringify(responseData) : String(responseData),
      status: responseStatus
    };

    const finalSuccessMessage = replaceWorkflowVariables(
      workflow.success_message_template || '✅ Mua hàng thành công!\n\nChi tiết:\n{data}',
      templateRenderVars
    );

    // 8. Save Order to Database
    try {
      await pool.query(
        `INSERT INTO orders (
          user_id, code, product_name, price, quantity, data, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'completed', NOW())`,
        [
          user.id,
          invoiceCode,
          `[API] ${workflow.name}`,
          cost,
          1,
          formattedExtracted
        ]
      );
    } catch (orderDbErr) {
      console.error('Failed to log order into orders table:', orderDbErr);
    }

    return {
      success: true,
      invoiceCode,
      message: finalSuccessMessage,
      data: extractedData,
      raw: responseData
    };
  } catch (error) {
    console.error(`[API Workflow] Execution failed for ${workflow.name}:`, error.message);

    // Auto-refund user balance immediately
    if (cost > 0) {
      try {
        await updateBalance(user.id, cost);
        console.log(`[API Workflow] Refunded ${cost} to user ID ${user.id} due to API failure`);
      } catch (refundErr) {
        console.error(`[API Workflow] Failed to refund user ID ${user.id}:`, refundErr);
      }
    }

    return {
      success: false,
      error: `Giao dịch thất bại: ${error.message}. Đã tự động hoàn ${cost.toLocaleString('vi-VN')} VNĐ vào tài khoản!`
    };
  }
}
