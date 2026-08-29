import fetch from "node-fetch";

const url = "https://edit-api-sg.capcut.com/lv/v1/notice/get_notice_list";

export async function getNoticeListWithCookie(cookie, body) {
  const headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "vi,fr-FR;q=0.9,fr;q=0.8,en-US;q=0.7,en;q=0.6,zh-TW;q=0.5,zh;q=0.4",
    "app-sdk-version": "48.0.0",
    "appid": "348188",
    "appvr": "5.8.0",
    "content-type": "application/json",
    "device-time": "1762159041",
    "did": "7566581364880000529",
    "lan": "en",
    "loc": "sg",
    "pf": "7",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "sign": "c1c89ab929dca890256c0e549f5ea647",
    "sign-ver": "1",
    "store-country-code": "vn",
    "store-country-code-src": "uid",
    "tdid": "",
    "cookie": cookie,
    "Referer": "https://www.capcut.com/"
  };
// 
  const payload = body || { notice_type: [2, 3], cursor: "0", count: 10 };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
}