// Cài: npm install node-fetch
import fetch from "node-fetch";

export async function getlinkWithCookie(cookie, body) {
    const url = 'https://edit-api-sg.capcut.com/cc/v1/workspace/get_invitation_link';
    
  const headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9,vi;q=0.8",
    "app-sdk-version": "48.0.0",
    "appid": "348188",
    "appvr": "5.8.0",
    "content-type": "application/json",
    "device-time": "1759304283",
    "did": "7553826660933699073",
    "lan": "en",
    "loc": "sg",
    "pf": "7",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "sign": "7f9daa202995b37f1de8064fb3d8e26e",
    "sign-ver": "1",
    "store-country-code": "vn",
    "store-country-code-src": "uid",
    "tdid": "",
    "cookie": cookie,
    "Referer": "https://www.capcut.com/"
  }

  console.log("[capcutteamql.listmember] cookie:", cookie);
  console.log("[capcutteamql.listmember] body:", body);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
}
