import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getlinkWithCookie } from "./getlink.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testGetLinkOnly() {
  const cookiePath = path.join(__dirname, "cookies_cache", "cookie_EliseAthanasiou572597_hotmail_com.txt");
  if (!fs.existsSync(cookiePath)) {
    console.error("❌ Không tìm thấy file cookie cache!");
    return;
  }

  const cookie = fs.readFileSync(cookiePath, "utf-8").trim();
  const workspace_id = "7675379068338012180";

  console.log(`\n==================================================`);
  console.log(`🔍 TEST TRỰC TIẾP GETLINK (getlink.js)`);
  console.log(`🏢 Workspace ID: ${workspace_id}`);
  console.log(`🍪 Cookie Length: ${cookie.length} ký tự`);
  console.log(`==================================================`);

  const res = await getlinkWithCookie(cookie, { workspace_id });
  console.log(`\n📋 Raw Response từ CapCut (getlink.js):\n`, JSON.stringify(res, null, 2));

  const inviteLink =
    res?.data?.invitation_link ||
    res?.data?.invite_link ||
    res?.data?.link ||
    res?.data?.url ||
    "";

  console.log(`\n🔗 LINK MỜI THU ĐƯỢC: ${inviteLink || "(Không lấy được link)"}\n`);
}

testGetLinkOnly();
