import fetch from "node-fetch";

const url = "https://edit-api-sg.capcut.com/cc/v1/workspace/refresh_invitation_link";

export async function refresh_invitation_link(cookie, body) {
  const headers = {
    "accept": "application/json, text/plain, */*",
    "content-type": "application/json",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "appid": "348188",
    "appvr": "5.8.0",
    "device-time": "1759304283",
    "did": "7553826660933699073",
    "lan": "en",
    "loc": "sg",
    "pf": "7",
    "sign": "7f9daa202995b37f1de8064fb3d8e26e",
    "sign-ver": "1",
    "store-country-code": "vn",
    "cookie": cookie,
    "Referer": "https://www.capcut.com/"
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
}
