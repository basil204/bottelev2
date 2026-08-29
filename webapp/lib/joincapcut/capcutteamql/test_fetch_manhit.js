import fetch from "node-fetch";

async function testManhitWorkspaces() {
  const url = "https://tienich.manhit.dev/api/web/workspaces";
  const headers = {
    "accept": "*/*",
    "accept-language": "vi,fr-FR;q=0.9,fr;q=0.8,en-US;q=0.7,en;q=0.6,zh-TW;q=0.5,zh;q=0.4",
    "content-type": "application/json",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Not=A?Brand\";v=\"99\", \"Google Chrome\";v=\"151\", \"Chromium\";v=\"151\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "Referer": "https://tienich.manhit.dev/admin/login"
  };

  const body = JSON.stringify({
    email: "TheolaGallogly424023@hotmail.com",
    password: "a123456",
    proxy_url: ""
  });

  console.log(`\n==================================================`);
  console.log(`🔍 GỌI TEST API: ${url}`);
  console.log(`👤 Email: TheolaGallogly424023@hotmail.com`);
  console.log(`==================================================`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body
    });

    console.log(`🌐 Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`\n📋 Raw Kết Quả Trả Về:\n`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("💥 Lỗi:", err.message);
  }
}

testManhitWorkspaces();
