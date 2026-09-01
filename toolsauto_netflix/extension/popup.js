// Netflix NFVDID Manager
const LOG_PREFIX = "[Netflix Device Cookies]";
const DEVICE_COOKIE_NAMES = new Set([
  "netflix-sans-normal-3-loaded", "netflix-sans-bold-3-loaded", "nfvdid",
  "flwssn", "OptanonConsent", "OTSessionTracking"
]);

const statusElement = document.getElementById("status");
const messageElement = document.getElementById("message");
const cookieInput = document.getElementById("cookieInput");
const saveButton = document.getElementById("saveButton");
const reloadButton = document.getElementById("reloadButton");

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error("No response from the background service worker."));
        return;
      }
      if (!response.ok) {
        reject(new Error(response.error || "The operation failed."));
        return;
      }
      resolve(response);
    });
  });
}

function setMessage(text, type = "neutral") {
  messageElement.textContent = text;
  messageElement.dataset.type = type;
}

function showStatus(result) {
  if (result.status === "MATCH") {
    statusElement.textContent = "Sẵn sàng";
    statusElement.dataset.state = "ready";
  } else if (result.status === "NOT CONFIGURED") {
    statusElement.textContent = "Chưa lưu cookie";
    statusElement.dataset.state = "warning";
  } else {
    statusElement.textContent = "Đang chờ Netflix";
    statusElement.dataset.state = "warning";
  }
}

function extractDeviceCookies(rawCookieText) {
  let parsed;
  try {
    parsed = JSON.parse(rawCookieText);
  } catch (error) {
    throw new Error("JSON cookie không hợp lệ.");
  }
  const sourceCookies = Array.isArray(parsed) ? parsed : parsed && parsed.cookies;
  if (!Array.isArray(sourceCookies)) {
    throw new Error('JSON phải là mảng cookie hoặc object có trường "cookies".');
  }
  return sourceCookies.filter((cookie) => cookie && DEVICE_COOKIE_NAMES.has(cookie.name));
}

function showError(error) {
  console.error(`${LOG_PREFIX} Popup error:`, error.message);
  setMessage(`Lỗi: ${error.message}`, "error");
}

async function refreshStatus() {
  try {
    const result = await sendMessage({ type: "GET_DEVICE_COOKIE_STATUS" });
    showStatus(result);
  } catch (error) {
    showError(error);
  }
}

saveButton.addEventListener("click", async () => {
  saveButton.disabled = true;
  setMessage("Đang lưu…");
  try {
    const deviceCookies = extractDeviceCookies(cookieInput.value);
    const result = await sendMessage({ type: "SAVE_DEVICE_COOKIES", cookies: deviceCookies });
    showStatus(result);
    cookieInput.value = JSON.stringify(deviceCookies, null, 2);
    setMessage(`Đã tách và lưu đủ ${deviceCookies.length} cookie thiết bị.`, "success");
  } catch (error) {
    showError(error);
  } finally {
    saveButton.disabled = false;
  }
});

reloadButton.addEventListener("click", async () => {
  reloadButton.disabled = true;
  setMessage("Đang tải lại Netflix…");
  try {
    const result = await sendMessage({ type: "RELOAD_NETFLIX" });
    setMessage(`Đã tải lại ${result.reloadedCount} tab Netflix.`, "success");
  } catch (error) {
    showError(error);
  } finally {
    reloadButton.disabled = false;
  }
});

refreshStatus();
