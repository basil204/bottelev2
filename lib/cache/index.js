const memory = new Map();

export const setCache = (key, value, ttlMs = 300000) => {
  memory.set(key, { value, expire: Date.now() + ttlMs });
};

export const getCache = (key) => {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expire < Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
};

export const delCache = (key) => memory.delete(key);

export const clearCache = () => memory.clear();

// Get all keys matching a prefix (for iterating QR codes)
export const getAllKeys = (prefix = '') => {
  const keys = [];
  for (const [key, hit] of memory.entries()) {
    if (hit.expire < Date.now()) {
      memory.delete(key);
      continue;
    }
    if (!prefix || key.startsWith(prefix)) {
      keys.push(key);
    }
  }
  return keys;
};

