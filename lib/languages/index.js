import fs from 'fs';
import path from 'path';

const cache = {};

export const loadLanguage = (code = 'vi') => {
  if (cache[code]) return cache[code];
  const langPath = path.join(process.cwd(), 'languages', `${code}.lang`);
  if (!fs.existsSync(langPath)) return {};
  const data = fs.readFileSync(langPath, 'utf8');
  const entries = {};
  data.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...rest] = trimmed.split('=');
    entries[key.trim()] = rest.join('=').trim();
  });
  cache[code] = entries;
  return entries;
};

