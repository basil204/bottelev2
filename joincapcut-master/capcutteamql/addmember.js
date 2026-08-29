// Cài: npm install node-fetch
import fetch from "node-fetch";

const url = "https://edit-api-sg.capcut.com/cc/v1/workspace/email_directional_invited_v2";

export async function inviteByEmailWithCookie(cookie, body) {
  const headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "vi,fr-FR;q=0.9,fr;q=0.8,en-US;q=0.7,en;q=0.6,zh-TW;q=0.5,zh;q=0.4",
    "app-sdk-version": "48.0.0",
    "appid": "348188",
    "appvr": "5.8.0",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "device-time": "1759223082",
    "did": "7543172286023616001",
    "lan": "vi-VN",
    "loc": "sg",
    "pf": "7",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "sign": "01dbc72a418c51419cb2b861459d2278",
    "sign-ver": "1",
    "store-country-code": "es",
    "store-country-code-src": "uid",
    "tdid": "",
    "cookie": cookie,
    "Referer": "https://www.capcut.com/"
  };

  console.log("[capcutteamql.addmember] cookie:", cookie);
  console.log("[capcutteamql.addmember] body:", body);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
}
