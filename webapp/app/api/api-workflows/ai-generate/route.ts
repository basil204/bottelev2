import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const SYSTEM_PROMPT = `Bạn là chuyên gia kiến trúc hệ thống và tích hợp API cho Telegram Bot bán hàng tự động.
Nhiệm vụ của bạn là nhận vào:
- Một lệnh cURL,
- Hoặc một đoạn tài liệu API (Request URL, Headers, Body, Response sample),
- Hoặc một đoạn miêu tả yêu cầu mua hàng bằng tiếng Việt / tiếng Anh.

Sau đó PHÂN TÍCH và TỰ ĐỘNG TẠO ra cấu hình Luồng Mua Hàng (No-Code API Workflow) hoàn chỉnh dưới dạng JSON theo đúng schema sau:

{
  "name": "Tên dịch vụ ngắn gọn, rõ ràng (VD: Mua Proxy Xoay Dân Cư, Nạp Thẻ Cào, OTP Sim Thuê...)",
  "code": "slug_ma_dinh_danh (VD: buy_proxy_residential, topup_card, otp_rent)",
  "icon": "Emoji phù hợp (VD: 🌐, 📱, 💳, 🎬, 🚀, ⚡)",
  "description": "Mô tả chi tiết quyền lợi, thời hạn, định dạng dữ liệu giao cho khách...",
  "price_vnd": 10000, // Số tiền VNĐ ước lượng hoặc lấy từ mô tả (number)
  "price_usdt": 0.5,  // Số tiền USDT ước lượng (number)
  "api_url": "URL Endpoint chuẩn (có thể chứa biến {variable_name})",
  "http_method": "POST" | "GET" | "PUT" | "PATCH",
  "headers_json": "{\\n  \\"Content-Type\\": \\"application/json\\"\\n}", // Chuỗi JSON chứa headers, auth token, api key nếu có
  "body_template": "{\\n  \\"user_id\\": \\"{user_id}\\"\\n}", // Chuỗi JSON chứa Request Body payload, các giá trị động được bọc trong {ten_bien}
  "input_fields": [
    {
      "name": "ten_bien_viet_thuong (VD: target_uid, quantity, country, package_id)",
      "label": "Câu hỏi hiển thị cho khách hàng (VD: Nhập link tài khoản, Chọn quốc gia...)",
      "type": "text" | "number" | "url",
      "placeholder": "Ví dụ gợi ý (VD: https://..., 100, vn)",
      "description": "Ghi chú thêm cho khách hàng",
      "required": true
    }
  ],
  "response_data_path": "Đường dẫn trích xuất JSON Dot-Notation (VD: data, data.accounts, result.key, proxies). Để 'data' nếu chưa rõ.",
  "response_success_condition": "status == 200 || success == true",
  "success_message_template": "Mẫu tin nhắn Telegram Markdown định dạng đẹp mắt gửi cho khách khi mua thành công. Phải chứa các placeholder: {data} (dữ liệu nhận được từ API), {invoice_code}, {price_formatted}, và các trường khách đã nhập.",
  "show_in_menu": 1,
  "menu_row": 1,
  "is_active": 1
}

QUY TẮC QUAN TRỌNG:
1. Chỉ trả về DUY NHẤT một chuỗi JSON hợp lệ, KHÔNG bọc trong markdown code block (không dùng \`\`\`json).
2. Tự động nhận diện các tham số cần người dùng nhập và đưa vào mảng \`input_fields\`.
3. Trong \`body_template\` hoặc \`api_url\`, các vị trí cần thay thế dữ liệu từ \`input_fields\` phải để dạng \`{tên_biến}\`. Ngoài ra hệ thống có sẵn các biến hệ thống: \`{user_id}\`, \`{username}\`, \`{invoice_code}\`, \`{price}\`, \`{price_formatted}\`.
4. Mẫu tin nhắn \`success_message_template\` cần trình bày chuyên nghiệp với icon Telegram, định dạng rõ ràng để khách hàng dễ copy thông tin bàn giao.`;

// Heuristic Parser Fallback when no AI API key is available
function fallbackHeuristicParse(text: string) {
  let method = 'POST';
  let url = 'https://api.example.com/v1/order';
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let bodyObj: Record<string, any> = {};
  const inputFields: any[] = [];

  const cleanText = text.trim();

  // 1. Detect cURL
  if (cleanText.toLowerCase().includes('curl')) {
    // Extract method
    const methodMatch = cleanText.match(/-X\s+([A-Z]+)/i);
    if (methodMatch) method = methodMatch[1].toUpperCase();

    // Extract URL
    const urlMatch = cleanText.match(/curl\s+(?:-[A-Za-z0-9]+\s+)*['"]?(https?:\/\/[^\s'"]+)['"]?/i);
    if (urlMatch) url = urlMatch[1];

    // Extract Headers
    const headerMatches = cleanText.matchAll(/-H\s+['"]([^'"]+)['"]/gi);
    for (const m of headerMatches) {
      const parts = m[1].split(':');
      if (parts.length >= 2) {
        headers[parts[0].trim()] = parts.slice(1).join(':').trim();
      }
    }

    // Extract Body
    const dataMatch = cleanText.match(/(?:-d|--data|--data-raw)\s+['"]({[\s\S]*?}|[^'"]+)['"]/i);
    if (dataMatch) {
      try {
        bodyObj = JSON.parse(dataMatch[1]);
      } catch {
        bodyObj = { raw_payload: dataMatch[1] };
      }
    }
  } else {
    // Check if plain URL
    const urlMatch = cleanText.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) url = urlMatch[0];
  }

  // Derive input fields from body keys
  const bodyTemplateObj: Record<string, any> = {};
  if (Object.keys(bodyObj).length > 0) {
    Object.keys(bodyObj).forEach((k) => {
      const val = bodyObj[k];
      const fieldName = k.toLowerCase();
      bodyTemplateObj[k] = `{${fieldName}}`;

      inputFields.push({
        name: fieldName,
        label: `Nhập ${k}`,
        type: typeof val === 'number' ? 'number' : 'text',
        placeholder: String(val),
        description: `Thông tin ${k}`,
        required: true
      });
    });
  } else {
    bodyTemplateObj.user_id = '{user_id}';
    bodyTemplateObj.target = '{target}';
    inputFields.push({
      name: 'target',
      label: 'Thông tin nhận hàng / UID',
      type: 'text',
      placeholder: 'https://... hoặc UID',
      description: 'Nhập thông tin nhận',
      required: true
    });
  }

  // Generate name
  let name = 'Dịch Vụ API Tự Động';
  try {
    const parsedUrl = new URL(url);
    name = `Dịch Vụ (${parsedUrl.hostname})`;
  } catch {}

  const code = 'api_flow_' + Date.now().toString().slice(-4);

  return {
    name,
    code,
    icon: '⚡',
    description: `Dịch vụ tự động kết nối qua API ${url}`,
    price_vnd: 10000,
    price_usdt: 0.5,
    api_url: url,
    http_method: method,
    headers_json: JSON.stringify(headers, null, 2),
    body_template: JSON.stringify(bodyTemplateObj, null, 2),
    input_fields: inputFields,
    response_data_path: 'data',
    response_success_condition: 'status == 200 || success == true',
    success_message_template: `✅ **ĐƠN HÀNG [${name}] THÀNH CÔNG!**\n\n🧾 **Mã đơn:** \`{invoice_code}\`\n💰 **Thanh toán:** \`{price_formatted}\`\n\n📋 **Kết quả bàn giao:**\n\`\`\`\n{data}\n\`\`\`\n\nCảm ơn quý khách đã sử dụng dịch vụ!`,
    show_in_menu: 1,
    menu_row: 1,
    is_active: 1
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, api_key: customApiKey } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ success: false, error: 'Vui lòng cung cấp cURL, tài liệu API hoặc mô tả dịch vụ!' }, { status: 400 });
    }

    // Check for Gemini or OpenAI API Key
    let geminiKey = customApiKey || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      try {
        const [rows]: any = await pool.query("SELECT `value` FROM settings WHERE `key` IN ('gemini_api_key', 'google_gemini_api_key') LIMIT 1");
        if (rows && rows.length > 0 && rows[0].value) {
          geminiKey = rows[0].value;
        }
      } catch {}
    }

    // If Gemini key is available, call Gemini 2.0 / 1.5 Flash
    if (geminiKey && geminiKey.trim()) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey.trim()}`;
        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: `${SYSTEM_PROMPT}\n\nĐÂY LÀ DỮ LIỆU ĐẦU VÀO CẦN PHÂN TÍCH:\n${prompt}` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          }),
          signal: AbortSignal.timeout(25000)
        });

        if (response.ok) {
          const resData = await response.json();
          const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText) {
            // Clean up possible markdown fences
            const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
            const parsedConfig = JSON.parse(cleaned);
            return NextResponse.json({
              success: true,
              source: 'gemini-ai',
              config: parsedConfig
            });
          }
        } else {
          console.warn('[AI Workflow Generator] Gemini API returned error:', await response.text());
        }
      } catch (geminiErr: any) {
        console.warn('[AI Workflow Generator] Gemini request error, falling back to smart heuristics:', geminiErr.message);
      }
    }

    // Fallback: Smart Heuristic Parser
    const fallbackConfig = fallbackHeuristicParse(prompt);
    return NextResponse.json({
      success: true,
      source: 'smart-heuristic-parser',
      config: fallbackConfig
    });
  } catch (error: any) {
    console.error('Error generating AI workflow:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
