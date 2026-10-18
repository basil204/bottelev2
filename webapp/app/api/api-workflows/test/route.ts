import { NextResponse } from 'next/server';

function getNestedValue(obj: any, path: string) {
  if (!path || path.trim() === '' || path === '.') return obj;
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
}

function replaceVariables(str: string, variables: Record<string, any>) {
  if (typeof str !== 'string') return str;
  let result = str;
  for (const [key, value] of Object.entries(variables)) {
    const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), valStr);
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      api_url,
      http_method = 'POST',
      headers_json = '{}',
      body_template = '{}',
      response_data_path = 'data',
      success_message_template = '✅ Thành công:\n{data}',
      test_variables = {}
    } = body;

    if (!api_url) {
      return NextResponse.json({ success: false, error: 'Chưa nhập URL API' }, { status: 400 });
    }

    // Replace variables in URL
    const finalUrl = replaceVariables(api_url, test_variables);

    // Parse and replace headers
    let headersObj: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    try {
      const parsed = typeof headers_json === 'string' ? JSON.parse(headers_json || '{}') : headers_json;
      for (const [k, v] of Object.entries(parsed)) {
        headersObj[k] = replaceVariables(String(v), test_variables);
      }
    } catch (e: any) {
      return NextResponse.json({ success: false, error: 'Định dạng Headers JSON không hợp lệ: ' + e.message }, { status: 400 });
    }

    // Parse and replace body if not GET
    let finalBody: string | undefined = undefined;
    if (http_method.toUpperCase() !== 'GET') {
      try {
        const bodyStr = typeof body_template === 'string' ? body_template : JSON.stringify(body_template);
        finalBody = replaceVariables(bodyStr, test_variables);
        // validate JSON if string
        try {
          JSON.parse(finalBody);
        } catch {
          // Keep as string if raw text/form
        }
      } catch (e: any) {
        return NextResponse.json({ success: false, error: 'Định dạng Body Template không hợp lệ: ' + e.message }, { status: 400 });
      }
    }

    const startTime = Date.now();
    let responseStatus = 0;
    let responseHeaders: any = {};
    let rawResponseData: any = null;
    let extractedData: any = null;
    let renderedMessage = '';

    try {
      const fetchRes = await fetch(finalUrl, {
        method: http_method.toUpperCase(),
        headers: headersObj,
        body: http_method.toUpperCase() !== 'GET' ? finalBody : undefined,
        signal: AbortSignal.timeout(15000)
      });

      responseStatus = fetchRes.status;
      fetchRes.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });

      const contentType = fetchRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        rawResponseData = await fetchRes.json();
      } else {
        const text = await fetchRes.text();
        try {
          rawResponseData = JSON.parse(text);
        } catch {
          rawResponseData = text;
        }
      }

      // Extract data
      if (typeof rawResponseData === 'object' && rawResponseData !== null) {
        extractedData = getNestedValue(rawResponseData, response_data_path);
        if (extractedData === undefined) {
          extractedData = rawResponseData;
        }
      } else {
        extractedData = rawResponseData;
      }

      // Format extracted data for template
      const formattedExtracted = typeof extractedData === 'object'
        ? (Array.isArray(extractedData) ? extractedData.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join('\n') : JSON.stringify(extractedData, null, 2))
        : String(extractedData || '');

      // Render message
      const templateVars = {
        ...test_variables,
        data: formattedExtracted,
        status: responseStatus,
        status_code: responseStatus
      };
      renderedMessage = replaceVariables(success_message_template, templateVars);

      return NextResponse.json({
        success: true,
        executionTimeMs: Date.now() - startTime,
        request: {
          url: finalUrl,
          method: http_method.toUpperCase(),
          headers: headersObj,
          body: finalBody
        },
        response: {
          status: responseStatus,
          headers: responseHeaders,
          raw: rawResponseData,
          extracted: extractedData
        },
        renderedMessage
      });
    } catch (fetchErr: any) {
      return NextResponse.json({
        success: false,
        executionTimeMs: Date.now() - startTime,
        error: `Lỗi kết nối API: ${fetchErr.message}`,
        request: {
          url: finalUrl,
          method: http_method.toUpperCase(),
          headers: headersObj,
          body: finalBody
        }
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error testing API workflow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
