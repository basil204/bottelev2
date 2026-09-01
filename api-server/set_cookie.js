const { saveCookies, getTeamInfo } = require('./canva_api');
const readline = require('readline');

const args = process.argv.slice(2).join(' ');

async function promptAndSave(rawCookie) {
  try {
    const result = saveCookies(rawCookie);
    console.log('\n[✓] 🎉 Đã lưu Cookie Canva thành công!');
    console.log('[+] Đang kiểm tra kết nối tới Canva...');
    const info = await getTeamInfo();
    if (info.valid) {
      console.log(`[✓] Cookie HOẠT ĐỘNG TỐT! Đang có ${info.memberCount} thành viên trong team.`);
    } else {
      console.warn(`[!] Cảnh báo: ${info.error}`);
    }
  } catch (err) {
    console.error(`\n[-] Lỗi khi lưu cookie: ${err.message}`);
  }
}

if (args && args.trim()) {
  promptAndSave(args);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.clear();
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║               CẬP NHẬT COOKIE CANVA THỦ CÔNG                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log('👉 Hướng dẫn: Dán chuỗi Cookie Header hoặc JSON Cookie vào bên dưới rồi nhấn [ENTER]:\n');

  rl.question('🍪 Dán Cookie vào đây: ', async (cookieInput) => {
    rl.close();
    if (!cookieInput.trim()) {
      console.log('[-] Bạn chưa nhập cookie!');
      return;
    }
    await promptAndSave(cookieInput.trim());
  });
}
