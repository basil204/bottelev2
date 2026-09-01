const fs = require('fs');
const path = require('path');

const DEFAULT_SESSION_FILE = path.join(__dirname, 'canva_session.json');

/**
 * Phân tích và chuẩn hóa dữ liệu Cookie từ nhiều định dạng:
 * - Mảng JSON: [ { name: "...", value: "..." } ]
 * - Object JSON: { cookies: [ ... ], localStorage: { ... } }
 * - Object Playwright: { cookies: [ ... ], origins: [ ... ] }
 * - Chuỗi Cookie Header: "name1=val1; name2=val2;"
 * - Chuỗi Netscape Tab-delimited
 */
function parseCookies(rawInput) {
  if (!rawInput) return [];

  let list = [];

  if (Array.isArray(rawInput)) {
    list = rawInput;
  } else if (typeof rawInput === 'object' && rawInput !== null) {
    if (Array.isArray(rawInput.cookies)) {
      list = rawInput.cookies;
    } else if (Array.isArray(rawInput.data)) {
      list = rawInput.data;
    }
  } else if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) return [];

    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseCookies(parsed);
      } catch (_) {}
    }

    if (trimmed.includes('\t') && (trimmed.includes('.canva.com') || trimmed.includes('canva.com'))) {
      const lines = trimmed.split('\n');
      for (const line of lines) {
        const l = line.trim();
        if (!l || l.startsWith('#')) continue;
        const parts = l.split('\t');
        if (parts.length >= 7) {
          list.push({
            domain: parts[0],
            httpOnly: parts[1] === 'TRUE',
            path: parts[2],
            secure: parts[3] === 'TRUE',
            expirationDate: parseInt(parts[4], 10),
            name: parts[5],
            value: parts[6]
          });
        }
      }
    }

    if (list.length === 0) {
      const pairs = trimmed.split(';');
      for (const pair of pairs) {
        const p = pair.trim();
        if (!p) continue;
        const eqIdx = p.indexOf('=');
        if (eqIdx > 0) {
          const name = p.slice(0, eqIdx).trim();
          const value = p.slice(eqIdx + 1).trim();
          if (name) {
            list.push({
              name,
              value,
              domain: '.canva.com',
              path: '/',
              secure: true,
              sameSite: 'Lax'
            });
          }
        }
      }
    }
  }

  return list;
}

function formatCookiesForPlaywright(rawCookies) {
  const cookieList = parseCookies(rawCookies);
  if (!Array.isArray(cookieList)) return [];

  return cookieList.map(c => {
    if (!c || !c.name) return null;

    let sameSite = 'Lax';
    const s = String(c.sameSite || '').toLowerCase();
    if (s === 'strict') sameSite = 'Strict';
    else if (s === 'none' || s === 'no_restriction') sameSite = 'None';
    else if (s === 'lax') sameSite = 'Lax';

    let secure = typeof c.secure === 'boolean' ? c.secure : true;
    if (sameSite === 'None') secure = true;

    let domain = c.domain || '.canva.com';

    const cookieObj = {
      name: String(c.name).trim(),
      value: String(c.value !== undefined && c.value !== null ? c.value : ''),
      domain: domain,
      path: c.path || '/',
      httpOnly: !!c.httpOnly,
      secure: secure,
      sameSite: sameSite
    };

    const exp = c.expirationDate || c.expires;
    if (typeof exp === 'number' && exp > 0) {
      const expSec = exp > 1e11 ? Math.floor(exp / 1000) : Math.floor(exp);
      if (expSec > Date.now() / 1000 - 86400) {
        cookieObj.expires = expSec;
      }
    }

    return cookieObj;
  }).filter(Boolean);
}

function getCookieHeaderString(rawCookies) {
  const cookieList = parseCookies(rawCookies);
  if (!Array.isArray(cookieList)) return '';
  return cookieList
    .filter(c => c && c.name)
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

function loadCanvaSession(filePath = DEFAULT_SESSION_FILE) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file session tại: ${filePath}`);
  }

  const rawContent = fs.readFileSync(filePath, 'utf8').trim();
  let parsedJson = null;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (_) {
    parsedJson = rawContent;
  }

  const rawCookies = parseCookies(parsedJson);
  const playwrightCookies = formatCookiesForPlaywright(rawCookies);
  const cookieString = getCookieHeaderString(rawCookies);

  let localStorageData = {};
  if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson) && parsedJson.localStorage) {
    localStorageData = parsedJson.localStorage;
  }

  return {
    raw: parsedJson,
    totalCookies: playwrightCookies.length,
    cookies: playwrightCookies,
    cookieString: cookieString,
    localStorage: localStorageData
  };
}

module.exports = {
  DEFAULT_SESSION_FILE,
  parseCookies,
  formatCookiesForPlaywright,
  getCookieHeaderString,
  loadCanvaSession
};
