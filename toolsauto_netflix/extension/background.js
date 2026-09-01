// Netflix Device Cookie Manager — Source: Telegram @storm9117
const LOG_PREFIX = "[Netflix Device Cookies]";
const STORAGE_KEY = "savedDeviceCookies";
const RENEWAL_SECONDS = 365 * 24 * 60 * 60;
const REQUIRED_COOKIE_NAMES = [
  "netflix-sans-normal-3-loaded",
  "netflix-sans-bold-3-loaded",
  "nfvdid",
  "flwssn",
  "OptanonConsent",
  "OTSessionTracking"
];

function isNetflixUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "https:" &&
      (parsedUrl.hostname === "netflix.com" || parsedUrl.hostname.endsWith(".netflix.com"));
  } catch (error) {
    return false;
  }
}

function storageGet(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(result[key]);
    });
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: value }, () => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve();
    });
  });
}

function validateDeviceCookies(cookies) {
  if (!Array.isArray(cookies)) throw new Error("Cookie thiết bị phải là một mảng JSON.");
  const names = new Set(cookies.map((cookie) => cookie && cookie.name));
  const missing = REQUIRED_COOKIE_NAMES.filter((name) => !names.has(name));
  if (missing.length) throw new Error(`Thiếu cookie thiết bị bắt buộc: ${missing.join(", ")}.`);
  if (cookies.length !== REQUIRED_COOKIE_NAMES.length) throw new Error("Bộ cookie thiết bị có cookie trùng lặp.");

  for (const cookie of cookies) {
    if (!cookie || typeof cookie !== "object" || Array.isArray(cookie)) {
      throw new Error("Có cookie không đúng định dạng object.");
    }
    if (!REQUIRED_COOKIE_NAMES.includes(cookie.name)) {
      throw new Error(`Cookie không thuộc bộ cookie thiết bị: ${cookie.name || "không có tên"}.`);
    }
    if (typeof cookie.domain !== "string" || typeof cookie.path !== "string" || typeof cookie.value !== "string") {
      throw new Error(`Cookie ${cookie.name} thiếu domain, path hoặc value.`);
    }
  }
}

async function getSavedDeviceCookies() {
  const cookies = await storageGet(STORAGE_KEY);
  return Array.isArray(cookies) ? cookies : null;
}

function cookieUrl(cookie) {
  const hostname = cookie.domain.replace(/^\./, "");
  return `https://${hostname}${cookie.path || "/"}`;
}

function cookieLookup(cookie) {
  const details = { url: cookieUrl(cookie), name: cookie.name };
  if (cookie.storeId !== undefined) details.storeId = cookie.storeId;
  return details;
}

function getCookie(details) {
  return new Promise((resolve, reject) => {
    chrome.cookies.get(details, (cookie) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(cookie || null);
    });
  });
}

function setCookie(cookie) {
  const details = {
    url: cookieUrl(cookie), name: cookie.name, value: cookie.value,
    domain: cookie.domain, path: cookie.path, secure: cookie.secure,
    httpOnly: cookie.httpOnly, sameSite: cookie.sameSite
  };
  if (!cookie.session && typeof cookie.expirationDate === "number") {
    const nowInSeconds = Date.now() / 1000;
    details.expirationDate = cookie.expirationDate <= nowInSeconds
      ? Math.floor(nowInSeconds) + RENEWAL_SECONDS
      : cookie.expirationDate;
  }
  if (cookie.storeId !== undefined) details.storeId = cookie.storeId;

  return new Promise((resolve, reject) => {
    chrome.cookies.set(details, (savedCookie) => {
      if (chrome.runtime.lastError) return reject(new Error(`${cookie.name}: ${chrome.runtime.lastError.message}`));
      if (!savedCookie) return reject(new Error(`Chrome không thể lưu cookie ${cookie.name}.`));
      resolve(savedCookie);
    });
  });
}

async function checkAndApplyDeviceCookies(reason) {
  const desiredCookies = await getSavedDeviceCookies();
  if (!desiredCookies) return { status: "NOT CONFIGURED", updated: false };
  let updatedCount = 0;
  for (const desired of desiredCookies) {
    const current = await getCookie(cookieLookup(desired));
    if (!current || current.value !== desired.value) {
      await setCookie(desired);
      updatedCount += 1;
    }
  }
  console.log(`${LOG_PREFIX} ${reason}: updated ${updatedCount}/${desiredCookies.length}`);
  return { status: "MATCH", updated: updatedCount > 0, updatedCount };
}

async function getDeviceCookieStatus() {
  const desiredCookies = await getSavedDeviceCookies();
  if (!desiredCookies) return { status: "NOT CONFIGURED" };
  for (const desired of desiredCookies) {
    const current = await getCookie(cookieLookup(desired));
    if (!current || current.value !== desired.value) return { status: "DIFFERENT" };
  }
  return { status: "MATCH" };
}

let checkQueue = Promise.resolve();
function scheduleCheck(reason) {
  checkQueue = checkQueue.catch(() => undefined).then(() => checkAndApplyDeviceCookies(reason));
  return checkQueue;
}

async function saveAndApplyDeviceCookies(cookies) {
  validateDeviceCookies(cookies);
  await storageSet(cookies);
  return scheduleCheck("device cookies saved from popup");
}

function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => chrome.tabs.query(queryInfo, (tabs) => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve(tabs);
  }));
}

async function reloadNetflixTabs() {
  const tabs = await queryTabs({});
  const netflixTabs = tabs.filter((tab) => typeof tab.url === "string" && isNetflixUrl(tab.url));
  await Promise.all(netflixTabs.map((tab) => new Promise((resolve, reject) => chrome.tabs.reload(tab.id, () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }))));
  return netflixTabs.length;
}

scheduleCheck("service worker started").catch((error) => console.error(LOG_PREFIX, error.message));
chrome.runtime.onStartup.addListener(() => scheduleCheck("browser startup").catch((error) => console.error(LOG_PREFIX, error.message)));
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0 && isNetflixUrl(details.url)) scheduleCheck("Netflix navigation");
});
chrome.tabs.onActivated.addListener((activeInfo) => chrome.tabs.get(activeInfo.tabId, (tab) => {
  if (!chrome.runtime.lastError && tab.url && isNetflixUrl(tab.url)) scheduleCheck("Netflix tab activated");
}));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;
  let operation;
  if (message.type === "GET_DEVICE_COOKIE_STATUS") operation = getDeviceCookieStatus();
  else if (message.type === "SAVE_DEVICE_COOKIES") operation = saveAndApplyDeviceCookies(message.cookies);
  else if (message.type === "RELOAD_NETFLIX") operation = reloadNetflixTabs().then((reloadedCount) => ({ reloadedCount }));
  else return false;

  operation.then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
