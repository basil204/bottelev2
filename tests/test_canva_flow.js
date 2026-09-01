import { initDb, query, closeDb } from '../includes/database/index.js';
import { config } from '../config.js';
import { getCanvaSettings, addCanvaTask, pickAvailableCanvaTeam } from '../includes/services/canvaQueueService.js';

async function testFlow() {
  console.log('=== BẮT ĐẦU TEST TOÀN BỘ HỆ THỐNG AUTO CANVA PRO ===');
  await initDb(config);

  // 1. Kiểm tra đọc cài đặt Canva
  const settings = await getCanvaSettings();
  console.log('1. Cài đặt Canva:', {
    enabled: settings.enabled,
    price: settings.price,
    concurrency: settings.concurrency,
    headless: settings.headless,
    defaultRole: settings.defaultRole
  });

  // 2. Thêm 1 Đội Canva mẫu để test nếu chưa có
  const existingTeams = await query("SELECT * FROM canva_teams LIMIT 1");
  let testTeamId = null;
  if (existingTeams.length === 0) {
    const res = await query(
      `INSERT INTO canva_teams (name, cookies, member_limit, current_members, status)
       VALUES (?, ?, ?, ?, 'active')`,
      ['Đội Canva Test #1', JSON.stringify([{ name: 'test_cookie', value: '123', domain: '.canva.com' }]), 500, 10]
    );
    testTeamId = res.insertId;
    console.log('2. Đã thêm Đội Canva mẫu test:', testTeamId);
  } else {
    testTeamId = existingTeams[0].id;
    console.log('2. Đã có Đội Canva trong CSDL:', existingTeams[0].name, `(${existingTeams[0].current_members}/${existingTeams[0].member_limit})`);
  }

  // 3. Test chọn team khả dụng
  const picked = await pickAvailableCanvaTeam();
  console.log('3. Chọn Đội khả dụng:', picked ? `${picked.name} (ID: ${picked.id})` : 'Không có');

  // 4. Test tạo task vào hàng chờ
  const fakeEmail = `test_canva_${Date.now()}@gmail.com`;
  const { taskId, queuePos } = await addCanvaTask({
    userId: 1,
    telegramId: '123456789',
    email: fakeEmail,
    role: 'member',
    price: 15000
  });
  console.log('4. Đã thêm Task vào Hàng chờ:', { taskId, queuePos, email: fakeEmail });

  // 5. Kiểm tra Task trong CSDL
  const taskRows = await query("SELECT * FROM canva_tasks WHERE id = ?", [taskId]);
  console.log('5. Truy vấn Task từ CSDL:', {
    id: taskRows[0].id,
    email: taskRows[0].email,
    status: taskRows[0].status,
    price: taskRows[0].price
  });

  // Dọn dẹp task test
  await query("DELETE FROM canva_tasks WHERE id = ?", [taskId]);
  console.log('6. Đã dọn dẹp task test.');

  console.log('=== TEST TOÀN BỘ HỆ THỐNG AUTO CANVA PRO HOÀN TẤT THÀNH CÔNG ===');
  await closeDb();
}

testFlow().catch(e => {
  console.error('Lỗi test:', e);
  process.exit(1);
});
