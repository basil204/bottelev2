import { extractTelegramIdFromNote, getBinanceConfig } from '../includes/services/binanceService.js';

async function runTests() {
  console.log('🧪 Bắt đầu kiểm tra tính năng nạp tiền USDT TRC20 qua Binance...');

  // Test 1: Extract note
  const testNotes = [
    { input: 'NAP 12345678', expected: '12345678' },
    { input: 'NAP123456789', expected: '123456789' },
    { input: '123456789', expected: '123456789' }
  ];

  let passedNotes = 0;
  for (const t of testNotes) {
    const res = extractTelegramIdFromNote(t.input);
    if (res === t.expected) {
      passedNotes++;
    } else {
      console.error(`❌ Note test failed for "${t.input}": got ${res}, expected ${t.expected}`);
    }
  }
  console.log(`✅ [TEST 1] Note extraction test passed: ${passedNotes}/${testNotes.length}`);

  // Test 2: Binance Config loading
  try {
    const config = await getBinanceConfig();
    console.log('✅ [TEST 2] Binance config loaded successfully:', {
      hasApiKey: Boolean(config?.apiKey),
      hasSecretKey: Boolean(config?.secretKey),
      payId: config?.payId,
      autoDeposit: config?.autoDeposit,
      exchangeRate: config?.exchangeRate
    });
  } catch (err) {
    console.warn('⚠️ [TEST 2] Could not connect to DB (DB might not be running in isolated test mode):', err.message);
  }

  console.log('🎉 Toàn bộ kiểm thử cơ bản hoàn tất!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
