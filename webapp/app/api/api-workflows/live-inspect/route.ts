import { NextResponse } from 'next/server';

function getNestedKeys(obj: any, prefix = ''): { path: string; value: any; type: string }[] {
  let results: { path: string; value: any; type: string }[] = [];
  if (!obj || typeof obj !== 'object') return results;

  if (Array.isArray(obj)) {
    results.push({
      path: prefix || 'data',
      value: `Array of ${obj.length} items`,
      type: 'array'
    });
    if (obj.length > 0 && typeof obj[0] === 'object') {
      results = results.concat(getNestedKeys(obj[0], `${prefix ? prefix + '.' : ''}0`));
    }
    return results;
  }

  for (const [key, valRaw] of Object.entries(obj)) {
    const val: any = valRaw;
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const valType = Array.isArray(val) ? 'array' : typeof val;

    results.push({
      path: fullPath,
      value: valType === 'object' && val !== null ? '{...}' : (valType === 'array' ? `[${(val as any[]).length} items]` : String(val)),
      type: valType
    });

    if (val && typeof val === 'object' && !Array.isArray(val)) {
      results = results.concat(getNestedKeys(val, fullPath));
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      results = results.concat(getNestedKeys(val[0], `${fullPath}[0]`));
    }
  }

  return results;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { raw_curl, api_url, http_method = 'POST', headers_json, body_template } = body;

    let finalUrl = api_url;
    let finalMethod = http_method.toUpperCase();
    let finalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'TelegramBot-AutoInspector/1.0'
    };
    let finalBody: any = undefined;

    // 1. Parse cURL if provided
    if (raw_curl && raw_curl.trim()) {
      const curlText = raw_curl.trim();

      // Extract Method
      const methodMatch = curlText.match(/-X\s+([A-Z]+)/i);
      if (methodMatch) finalMethod = methodMatch[1].toUpperCase();

      // Extract URL
      const urlMatch = curlText.match(/curl\s+(?:-[A-Za-z0-9]+\s+)*['"]?(https?:\/\/[^\s'"]+)['"]?/i) || curlText.match(/https?:\/\/[^\s'"]+/i);
      if (urlMatch) finalUrl = urlMatch[1] || urlMatch[0];

      // Extract Headers
      const headerMatches = curlText.matchAll(/-H\s+['"]([^'"]+)['"]/gi);
      for (const m of headerMatches) {
        const parts = m[1].split(':');
        if (parts.length >= 2) {
          finalHeaders[parts[0].trim()] = parts.slice(1).join(':').trim();
        }
      }

      // Extract Data Body
      const dataMatch = curlText.match(/(?:-d|--data|--data-raw)\s+['"]({[\s\S]*?}|[^'"]+)['"]/i);
      if (dataMatch) {
        try {
          finalBody = JSON.parse(dataMatch[1]);
        } catch {
          finalBody = dataMatch[1];
        }
      }
    } else {
      if (headers_json) {
        try {
          const parsedH = typeof headers_json === 'string' ? JSON.parse(headers_json) : headers_json;
          finalHeaders = { ...finalHeaders, ...parsedH };
        } catch {}
      }
      if (body_template && finalMethod !== 'GET') {
        try {
          finalBody = typeof body_template === 'string' ? JSON.parse(body_template) : body_template;
        } catch {
          finalBody = body_template;
        }
      }
    }

    if (!finalUrl) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy URL API hợp lệ trong cURL hoặc cấu hình!' }, { status: 400 });
    }

    // Clean placeholders like {user_id} in URL for testing
    const testUrl = finalUrl.replace(/\{[a-zA-Z0-9_]+\}/g, 'test_val');

    // Clean placeholders in body if object
    let testBodyPayload: string | undefined = undefined;
    if (finalMethod !== 'GET' && finalBody !== undefined) {
      let bodyStr = typeof finalBody === 'object' ? JSON.stringify(finalBody) : String(finalBody);
      bodyStr = bodyStr.replace(/"\{([a-zA-Z0-9_]+)\}"/g, '"test_$1"').replace(/\{([a-zA-Z0-9_]+)\}/g, 'test_$1');
      testBodyPayload = bodyStr;
    }

    // Execute Live Request
    const startTime = Date.now();
    let responseStatus = 0;
    let rawResponseData: any = null;
    let detectedDataPath = 'data';
    let suggestedMessageTemplate = '';
    let extractedKeys: any[] = [];
    let detectedInputs: any[] = [];

    // Auto-detect inputs from body
    if (typeof finalBody === 'object' && finalBody !== null) {
      Object.keys(finalBody).forEach((k) => {
        const val = finalBody[k];
        const isNumeric = typeof val === 'number';
        detectedInputs.push({
          name: k.toLowerCase(),
          label: `Nhập ${k}`,
          type: isNumeric ? 'number' : (k.includes('link') || k.includes('url') ? 'url' : 'text'),
          placeholder: String(val),
          description: `Thông tin ${k}`,
          required: true
        });
      });
    }

    try {
      const fetchRes = await fetch(testUrl, {
        method: finalMethod,
        headers: finalHeaders,
        body: finalMethod !== 'GET' ? testBodyPayload : undefined,
        signal: AbortSignal.timeout(15000)
      });

      responseStatus = fetchRes.status;
      const contentType = fetchRes.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        rawResponseData = await fetchRes.json();
      } else {
        const text = await fetchRes.text();
        try {
          rawResponseData = JSON.parse(text);
        } catch {
          rawResponseData = { raw_text: text };
        }
      }

      // Analyze response data path
      if (typeof rawResponseData === 'object' && rawResponseData !== null) {
        extractedKeys = getNestedKeys(rawResponseData);

        // Find candidate for data path
        const candidateKeys = ['data', 'result', 'accounts', 'proxies', 'key', 'license', 'token', 'phone_number', 'content', 'items'];
        for (const cand of candidateKeys) {
          if (rawResponseData[cand] !== undefined) {
            detectedDataPath = cand;
            break;
          }
        }
      }

      // Generate suggested message template
      let serviceName = 'Dịch Vụ API';
      try {
        const parsedUrl = new URL(finalUrl);
        serviceName = `Dịch Vụ ${parsedUrl.hostname.replace('www.', '')}`;
      } catch {}

      suggestedMessageTemplate =
        `✅ **GIAO DỊCH THÀNH CÔNG!**\n\n` +
        `📦 **Dịch vụ:** ${serviceName}\n` +
        `🧾 **Mã đơn:** \`{invoice_code}\`\n` +
        `💰 **Đã thanh toán:** \`{price_formatted}\`\n\n` +
        `📋 **Dữ liệu bàn giao:**\n` +
        `\`\`\`\n` +
        `{data}\n` +
        `\`\`\`\n\n` +
        `Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ!`;

      return NextResponse.json({
        success: true,
        executionTimeMs: Date.now() - startTime,
        parsedRequest: {
          url: finalUrl,
          method: finalMethod,
          headers: finalHeaders,
          body: finalBody
        },
        response: {
          status: responseStatus,
          raw: rawResponseData,
          detectedDataPath,
          extractedKeys
        },
        suggestedConfig: {
          name: serviceName,
          code: 'api_' + (finalUrl.replace(/[^a-zA-Z0-9]/g, '_').slice(-15) || Date.now().toString().slice(-4)),
          icon: '⚡',
          price_vnd: 10000,
          price_usdt: 0.5,
          api_url: finalUrl,
          http_method: finalMethod,
          headers_json: JSON.stringify(finalHeaders, null, 2),
          body_template: typeof finalBody === 'object' ? JSON.stringify(finalBody, null, 2) : String(finalBody || '{}'),
          input_fields: detectedInputs.length > 0 ? detectedInputs : [
            { name: 'target', label: 'Thông tin nhận hàng / UID', type: 'text', placeholder: 'Nhập thông tin...', required: true }
          ],
          response_data_path: detectedDataPath,
          response_success_condition: 'status == 200 || success == true',
          success_message_template: suggestedMessageTemplate,
          show_in_menu: 1,
          menu_row: 1,
          is_active: 1
        }
      });
    } catch (fetchErr: any) {
      return NextResponse.json({
        success: false,
        error: `Không thể kết nối tới API đích: ${fetchErr.message}`,
        parsedRequest: {
          url: finalUrl,
          method: finalMethod,
          headers: finalHeaders,
          body: finalBody
        }
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in live inspector:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
