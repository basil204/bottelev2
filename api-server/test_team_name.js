const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { loadCanvaSession } = require('./cookie_helper');

async function checkTeamInfo() {
  const sessionData = loadCanvaSession(path.join(__dirname, 'canva_session.json'));
  const cookies = sessionData.cookies;
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 850 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    locale: 'vi-VN'
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await context.addCookies(cookies);
  const page = await context.newPage();

  if (sessionData.localStorage && Object.keys(sessionData.localStorage).length > 0) {
    await page.addInitScript((storage) => {
      for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
    }, sessionData.localStorage);
  }

  await page.goto('https://www.canva.com/settings/people', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const teamData = await page.evaluate(() => {
    const allText = document.body.innerText;
    const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.innerText);
    const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.innerText);
    const spans = Array.from(document.querySelectorAll('span, p, div')).filter(el => {
      const txt = el.innerText ? el.innerText.trim() : '';
      return (txt.includes('Team') || txt.includes('Đội') || txt.includes('Nhóm')) && txt.length < 50;
    }).map(el => el.innerText.trim()).slice(0, 10);

    return {
      title: document.title,
      h1s,
      h2s,
      spans,
      textSnippet: allText.substring(0, 500)
    };
  });

  console.log('--- KẾT QUẢ KIỂM TRA TEAM CANVA ---');
  console.log(JSON.stringify(teamData, null, 2));

  await browser.close();
}

checkTeamInfo().catch(console.error);
